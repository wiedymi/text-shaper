import {
	processContextual,
	processInsertion,
	processLigature,
	processRearrangement,
} from "../aat/state-machine.ts";
import { GlyphBuffer } from "../buffer/glyph-buffer.ts";
import type { UnicodeBuffer } from "../buffer/unicode-buffer.ts";
import { Face } from "../font/face.ts";
import type { Font } from "../font/font.ts";
import { getGlyphClass } from "../font/tables/gdef.ts";
import {
	type AnyGposLookup,
	type CursivePosLookup,
	GposLookupType,
	getKerning,
	type MarkBasePosLookup,
	type MarkLigaturePosLookup,
	type MarkMarkPosLookup,
	type PairPosLookup,
	type SinglePosLookup,
} from "../font/tables/gpos.ts";
import type {
	ChainingContextPosFormat1,
	ChainingContextPosFormat2,
	ChainingContextPosFormat3,
	ChainingContextPosLookup,
	ContextPosFormat1,
	ContextPosFormat2,
	ContextPosFormat3,
	ContextPosLookup,
	PosLookupRecord,
} from "../font/tables/gpos-contextual.ts";
import {
	type AlternateSubstLookup,
	type AnyGsubLookup,
	applyLigatureSubst,
	applyLigatureSubstDirect,
	applySingleSubst,
	type ChainingContextSubstLookup,
	type ContextSubstLookup,
	GsubLookupType,
	type LigatureSubstLookup,
	type MultipleSubstLookup,
	type ReverseChainingSingleSubstLookup,
	type SingleSubstLookup,
} from "../font/tables/gsub.ts";
import type {
	ChainingContextFormat1,
	ChainingContextFormat2,
	ChainingContextFormat3,
	ContextSubstFormat1,
	ContextSubstFormat2,
	ContextSubstFormat3,
	SequenceLookupRecord,
} from "../font/tables/gsub-contextual.ts";
import {
	applyNonContextual,
	type MorxContextualSubtable,
	type MorxInsertionSubtable,
	type MorxLigatureSubtable,
	type MorxNonContextualSubtable,
	type MorxRearrangementSubtable,
	MorxSubtableType,
} from "../font/tables/morx.ts";
import type { ClassDef } from "../layout/structures/class-def.ts";
import {
	getMarkAttachmentType,
	LookupFlag,
} from "../layout/structures/layout-common.ts";
import type { GlyphId, GlyphInfo, GlyphPosition } from "../types.ts";
import { GlyphClass } from "../types.ts";
import { setupArabicMasks } from "./complex/arabic.ts";
import {
	isKorean,
	normalizeHangul,
	setupHangulMasks,
} from "./complex/hangul.ts";
import { setupHebrewMasks } from "./complex/hebrew.ts";
import { isIndic, reorderIndic, setupIndicMasks } from "./complex/indic.ts";
import { isKhmer, reorderKhmer, setupKhmerMasks } from "./complex/khmer.ts";
import {
	isMyanmar,
	reorderMyanmar,
	setupMyanmarMasks,
} from "./complex/myanmar.ts";
import {
	isLao,
	isThai,
	reorderThaiLao,
	setupThaiLaoMasks,
} from "./complex/thai-lao.ts";
import { reorderUSE, setupUseMasks, usesUSE } from "./complex/use.ts";
import {
	applyFallbackKerning,
	applyFallbackMarkPositioning,
} from "./fallback.ts";
import {
	createShapePlan,
	type ShapeFeature,
	type ShapePlan,
} from "./shape-plan.ts";

export interface ShapeOptions {
	script?: string;
	language?: string | null;
	direction?: "ltr" | "rtl";
	features?: ShapeFeature[];
}

/**
 * Pre-allocated arrays for ligature matching to avoid per-glyph allocations.
 * Max 16 components per ligature is a reasonable limit.
 */
const _ligMatchIndices = new Uint16Array(16);
const _ligMatchGlyphs = new Uint16Array(16);

/** Font or Face - accepted by shape function */
export type FontLike = Font | Face;

/** Get the underlying Font from a FontLike */
function getFont(fontLike: FontLike): Font {
	return fontLike instanceof Face ? fontLike.font : fontLike;
}

/** Get Face (create if needed) */
function getFace(fontLike: FontLike): Face {
	return fontLike instanceof Face ? fontLike : new Face(fontLike);
}

/**
 * Pre-computed skip markers for efficient glyph skipping in contextual matching.
 * Bit is set to 1 if glyph at that position should be skipped for the given lookup flag.
 */
type SkipMarkers = Uint8Array;

/**
 * Pre-compute skip markers for all glyphs in the buffer.
 * This avoids calling shouldSkipGlyph() repeatedly in tight loops.
 * O(n) one-time cost instead of O(n²) repeated calls.
 */
function precomputeSkipMarkers(
	font: Font,
	buffer: GlyphBuffer,
	lookupFlag: number,
): SkipMarkers {
	const markers = new Uint8Array(buffer.infos.length);
	const gdef = font.gdef;

	// If no GDEF or no filtering flags, nothing to skip
	if (!gdef || lookupFlag === 0) {
		return markers;
	}

	const ignoreBase = lookupFlag & LookupFlag.IgnoreBaseGlyphs;
	const ignoreLig = lookupFlag & LookupFlag.IgnoreLigatures;
	const ignoreMark = lookupFlag & LookupFlag.IgnoreMarks;
	const markAttachmentType = getMarkAttachmentType(lookupFlag);

	for (let i = 0; i < buffer.infos.length; i++) {
		const info = buffer.infos[i];
		if (!info) continue;

		const glyphClass = getGlyphClass(gdef, info.glyphId);

		if (ignoreBase && glyphClass === GlyphClass.Base) {
			markers[i] = 1;
		} else if (ignoreLig && glyphClass === GlyphClass.Ligature) {
			markers[i] = 1;
		} else if (ignoreMark && glyphClass === GlyphClass.Mark) {
			markers[i] = 1;
		} else if (markAttachmentType !== 0 && glyphClass === GlyphClass.Mark) {
			const glyphMarkClass = gdef.markAttachClassDef.get(info.glyphId);
			if (glyphMarkClass !== markAttachmentType) {
				markers[i] = 1;
			}
		}
	}

	return markers;
}

/**
 * Pre-compute next non-skip index array for O(1) pair lookups.
 * nextNonSkip[i] = index of next non-skipped glyph after i, or -1 if none.
 * Built in reverse for O(n) construction.
 */
function buildNextNonSkipArray(
	skip: SkipMarkers,
	length: number,
): Int16Array {
	const next = new Int16Array(length);
	let lastNonSkip = -1;

	// Build in reverse
	for (let i = length - 1; i >= 0; i--) {
		next[i] = lastNonSkip;
		if (!skip[i]) {
			lastNonSkip = i;
		}
	}

	return next;
}

/**
 * Pre-computed base glyph index array for O(1) mark-to-base lookup.
 * baseIndex[i] = index of the base/ligature glyph for mark at position i, or -1.
 */
function buildBaseIndexArray(
	buffer: GlyphBuffer,
	glyphClassCache: GlyphClassCache,
	font: Font,
): Int16Array {
	const baseIndex = new Int16Array(buffer.infos.length);
	baseIndex.fill(-1);

	let lastBaseIndex = -1;

	for (let i = 0; i < buffer.infos.length; i++) {
		const info = buffer.infos[i];
		if (!info) continue;

		const cls = getCachedGlyphClass(font, info.glyphId, glyphClassCache);

		if (cls === GlyphClass.Base || cls === 0 || cls === GlyphClass.Ligature) {
			// This is a base or ligature, update the last base
			lastBaseIndex = i;
			baseIndex[i] = -1; // Bases don't have a base index
		} else if (cls === GlyphClass.Mark) {
			// This is a mark, point to the last base
			baseIndex[i] = lastBaseIndex;
		}
	}

	return baseIndex;
}

/**
 * Shape text using OpenType features.
 * Accepts Font or Face (for variable fonts).
 */
export function shape(
	fontLike: FontLike,
	buffer: UnicodeBuffer,
	options: ShapeOptions = {},
): GlyphBuffer {
	const font = getFont(fontLike);
	const face = getFace(fontLike);

	const script = options.script ?? buffer.script ?? "latn";
	const language = options.language ?? buffer.language ?? null;
	const direction = options.direction ?? "ltr";
	const features = options.features ?? [];

	// Get axis coordinates from face for feature variations
	const axisCoords =
		face.normalizedCoords.length > 0 ? face.normalizedCoords : null;
	const plan = createShapePlan(
		font,
		script,
		language,
		direction,
		features,
		axisCoords,
	);

	const glyphBuffer = new GlyphBuffer();
	glyphBuffer.direction = buffer.direction;
	glyphBuffer.script = script;
	glyphBuffer.language = language;

	// Convert codepoints to initial glyph infos
	const infos: GlyphInfo[] = [];
	const codepoints = buffer.codepoints;
	const clusters = buffer.clusters;
	for (let i = 0; i < codepoints.length; i++) {
		const codepoint = codepoints[i]!;
		const cluster = clusters[i];
		if (cluster === undefined) continue;
		const glyphId = font.glyphId(codepoint);

		infos.push({
			glyphId,
			cluster,
			mask: 0xffffffff,
			codepoint,
		});
	}

	glyphBuffer.initFromInfos(infos);

	// Pre-shaping: Apply complex script analysis
	preShape(glyphBuffer, script);

	// Apply GSUB
	applyGsub(font, glyphBuffer, plan);

	// Initialize positions (using Face for variable font metrics)
	initializePositions(face, glyphBuffer);

	// Apply GPOS or fallback positioning
	const hasGpos = font.gpos !== null && plan.gposLookups.length > 0;
	if (hasGpos) {
		applyGpos(font, glyphBuffer, plan);
	} else {
		// Fallback kerning using kern table
		applyFallbackKerning(font, glyphBuffer.infos, glyphBuffer.positions);
		// Fallback mark positioning using combining classes
		applyFallbackMarkPositioning(
			font,
			glyphBuffer.infos,
			glyphBuffer.positions,
		);
	}

	// Apply AAT morx substitutions if no GSUB
	if (!font.gsub && font.morx) {
		applyMorx(font, glyphBuffer);
	}

	// Reverse for RTL
	if (direction === "rtl") {
		glyphBuffer.reverse();
	}

	return glyphBuffer;
}

// Pre-shaping for complex scripts

function preShape(buffer: GlyphBuffer, script: string): void {
	// Arabic joining analysis
	if (
		script === "arab" ||
		script === "syrc" ||
		script === "mand" ||
		script === "nko "
	) {
		setupArabicMasks(buffer.infos);
		return;
	}

	// Hebrew (RTL with marks)
	if (script === "hebr") {
		setupHebrewMasks(buffer.infos);
		return;
	}

	// Hangul (Korean)
	if (script === "hang" || script === "kore") {
		// Normalize Jamo sequences into precomposed syllables
		const normalized = normalizeHangul(buffer.infos);
		if (normalized.length !== buffer.infos.length) {
			buffer.initFromInfos(normalized);
		}
		setupHangulMasks(buffer.infos);
		return;
	}

	// Indic scripts (syllable-based)
	if (
		script === "deva" ||
		script === "beng" ||
		script === "guru" ||
		script === "gujr" ||
		script === "orya" ||
		script === "taml" ||
		script === "telu" ||
		script === "knda" ||
		script === "mlym"
	) {
		setupIndicMasks(buffer.infos);
		reorderIndic(buffer.infos);
		return;
	}

	// Thai and Lao (leading vowel reordering)
	if (script === "thai" || script === "lao ") {
		setupThaiLaoMasks(buffer.infos);
		reorderThaiLao(buffer.infos);
		return;
	}

	// Khmer (subscript consonants, pre-base vowels)
	if (script === "khmr") {
		setupKhmerMasks(buffer.infos);
		reorderKhmer(buffer.infos);
		return;
	}

	// Myanmar (medials, pre-base vowels, stacking)
	if (script === "mymr") {
		setupMyanmarMasks(buffer.infos);
		reorderMyanmar(buffer.infos);
		return;
	}

	// Universal Shaping Engine (many other complex scripts)
	if (usesUSE(script)) {
		setupUseMasks(buffer.infos);
		reorderUSE(buffer.infos);
		return;
	}

	// Auto-detect based on content if script is unknown
	if (script === "Zyyy" || script === "Zinh" || script === "Zzzz") {
		detectAndApplyComplexShaping(buffer.infos);
	}
}

// Auto-detect complex script from content
function detectAndApplyComplexShaping(infos: GlyphInfo[]): void {
	if (infos.length === 0) return;

	// Sample first few codepoints to detect script
	const sample = infos.slice(0, Math.min(10, infos.length));

	for (const info of sample) {
		const cp = info.codepoint;

		// Arabic range
		if (
			(cp >= 0x0600 && cp <= 0x06ff) ||
			(cp >= 0x0750 && cp <= 0x077f) ||
			(cp >= 0x08a0 && cp <= 0x08ff)
		) {
			setupArabicMasks(infos);
			return;
		}

		// Hebrew range
		if (cp >= 0x0590 && cp <= 0x05ff) {
			setupHebrewMasks(infos);
			return;
		}

		// Korean/Hangul
		if (isKorean(cp)) {
			const normalized = normalizeHangul(infos);
			if (normalized.length !== infos.length) {
				// Replace infos in place
				infos.length = 0;
				infos.push(...normalized);
			}
			setupHangulMasks(infos);
			return;
		}

		// Devanagari and other Indic
		if (isIndic(cp)) {
			setupIndicMasks(infos);
			reorderIndic(infos);
			return;
		}

		// Thai
		if (isThai(cp)) {
			setupThaiLaoMasks(infos);
			reorderThaiLao(infos);
			return;
		}

		// Lao
		if (isLao(cp)) {
			setupThaiLaoMasks(infos);
			reorderThaiLao(infos);
			return;
		}

		// Khmer
		if (isKhmer(cp)) {
			setupKhmerMasks(infos);
			reorderKhmer(infos);
			return;
		}

		// Myanmar
		if (isMyanmar(cp)) {
			setupMyanmarMasks(infos);
			reorderMyanmar(infos);
			return;
		}
	}
}

// GSUB application

function applyGsub(font: Font, buffer: GlyphBuffer, plan: ShapePlan): void {
	for (const { lookup } of plan.gsubLookups) {
		applyGsubLookup(font, buffer, lookup, plan);
	}
	// Compact buffer after all GSUB lookups to remove marked-deleted glyphs
	buffer.compact();
}

function applyGsubLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: AnyGsubLookup,
	plan: ShapePlan,
): void {
	switch (lookup.type) {
		case GsubLookupType.Single:
			applySingleSubstLookup(font, buffer, lookup);
			break;
		case GsubLookupType.Multiple:
			applyMultipleSubstLookup(font, buffer, lookup);
			break;
		case GsubLookupType.Alternate:
			// Alternate requires user selection - use first alternate as default
			applyAlternateSubstLookup(font, buffer, lookup);
			break;
		case GsubLookupType.Ligature:
			applyLigatureSubstLookup(font, buffer, lookup);
			break;
		case GsubLookupType.Context:
			applyContextSubstLookup(font, buffer, lookup, plan);
			break;
		case GsubLookupType.ChainingContext:
			applyChainingContextSubstLookup(font, buffer, lookup, plan);
			break;
		// Note: Extension lookups (Type 7) are unwrapped during parsing
		// and converted to their actual lookup types, so no case needed here
		case GsubLookupType.ReverseChainingSingle:
			applyReverseChainingSingleSubstLookup(font, buffer, lookup);
			break;
	}
}

function applySingleSubstLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: SingleSubstLookup,
): void {
	const infos = buffer.infos;
	const len = infos.length;

	// FAST PATH: No skip checking needed
	if (lookup.flag === 0 || !font.gdef) {
		for (let i = 0; i < len; i++) {
			const info = infos[i]!;
			const replacement = applySingleSubst(lookup, info.glyphId);
			if (replacement !== null) {
				info.glyphId = replacement;
			}
		}
		return;
	}

	// WITH SKIP: Need to check each glyph
	const skip = precomputeSkipMarkers(font, buffer, lookup.flag);
	for (let i = 0; i < len; i++) {
		if (skip[i]) continue;
		const info = infos[i]!;
		const replacement = applySingleSubst(lookup, info.glyphId);
		if (replacement !== null) {
			info.glyphId = replacement;
		}
	}
}

function applyMultipleSubstLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: MultipleSubstLookup,
): void {
	let i = 0;
	while (i < buffer.infos.length) {
		const info = buffer.infos[i];
		if (!info) {
			i++;
			continue;
		}
		if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) {
			i++;
			continue;
		}

		let applied = false;
		for (const subtable of lookup.subtables) {
			const coverageIndex = subtable.coverage.get(info.glyphId);
			if (coverageIndex === null) continue;

			const sequence = subtable.sequences[coverageIndex];
			if (!sequence || sequence.length === 0) continue;

			const [firstGlyph, ...restGlyphs] = sequence;
			if (firstGlyph === undefined) continue;

			// Replace with sequence
			info.glyphId = firstGlyph;

			// Insert remaining glyphs
			for (let j = 0; j < restGlyphs.length; j++) {
				const glyphId = restGlyphs[j]!;
				const newInfo: GlyphInfo = {
					glyphId,
					cluster: info.cluster,
					mask: info.mask,
					codepoint: info.codepoint,
				};
				const newPos: GlyphPosition = {
					xAdvance: 0,
					yAdvance: 0,
					xOffset: 0,
					yOffset: 0,
				};
				buffer.insertGlyph(i + j + 1, newInfo, newPos);
			}

			i += sequence.length;
			applied = true;
			break;
		}

		if (!applied) i++;
	}
}

function applyAlternateSubstLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: AlternateSubstLookup,
): void {
	// Alternate substitution allows selecting from multiple alternates
	// By default, use the first alternate (index 0)
	for (const info of buffer.infos) {
		if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;

		for (const subtable of lookup.subtables) {
			const coverageIndex = subtable.coverage.get(info.glyphId);
			if (coverageIndex === null) continue;

			const alternateSet = subtable.alternateSets[coverageIndex];
			if (!alternateSet || alternateSet.length === 0) continue;

			const [firstAlternate] = alternateSet;
			if (firstAlternate === undefined) continue;

			// Use first alternate by default
			info.glyphId = firstAlternate;
			break;
		}
	}
}

function applyLigatureSubstLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: LigatureSubstLookup,
): void {
	const infos = buffer.infos;
	const len = infos.length;
	const needsSkipCheck = lookup.flag !== 0 && font.gdef !== null;

	// Pre-compute skip markers only if needed
	let skip: Uint8Array | null = null;
	if (needsSkipCheck) {
		skip = precomputeSkipMarkers(font, buffer, lookup.flag);
	}

	let i = 0;
	while (i < len) {
		// Skip deleted glyphs
		if (buffer.isDeleted(i)) {
			i++;
			continue;
		}
		const info = infos[i];
		if (!info) {
			i++;
			continue;
		}
		// Use pre-computed skip markers
		if (skip && skip[i]) {
			i++;
			continue;
		}

		// Collect matchable glyphs using pre-allocated arrays
		let matchLen = 1;
		_ligMatchIndices[0] = i;
		_ligMatchGlyphs[0] = info.glyphId;

		for (let j = i + 1; j < len && matchLen < 16; j++) {
			// Skip deleted glyphs
			if (buffer.isDeleted(j)) continue;
			const nextInfo = infos[j];
			if (!nextInfo) continue;
			// Use pre-computed skip markers
			if (skip && skip[j]) continue;
			_ligMatchIndices[matchLen] = j;
			_ligMatchGlyphs[matchLen] = nextInfo.glyphId;
			matchLen++;
		}

		// Use direct Uint16Array version to avoid Array.from allocation
		const result = applyLigatureSubstDirect(
			lookup,
			_ligMatchGlyphs,
			matchLen,
			0,
		);
		if (result) {
			// Replace first glyph with ligature
			info.glyphId = result.ligatureGlyph;

			// Merge clusters and mark consumed glyphs for deletion
			for (let k = 1; k < result.consumed; k++) {
				const idx = _ligMatchIndices[k];
				if (idx !== undefined) {
					const targetInfo = infos[idx];
					if (targetInfo) {
						info.cluster = Math.min(info.cluster, targetInfo.cluster);
					}
					// Mark for deferred deletion instead of immediate removal
					buffer.markDeleted(idx);
				}
			}
		}

		i++;
	}
}

function applyContextSubstLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: ContextSubstLookup,
	plan: ShapePlan,
): void {
	const infos = buffer.infos;
	const len = infos.length;

	// Pre-compute skip markers only if needed
	let skip: Uint8Array | null = null;
	if (lookup.flag !== 0 && font.gdef !== null) {
		skip = precomputeSkipMarkers(font, buffer, lookup.flag);
	}

	// Context substitution - matches input sequence and applies nested lookups
	for (let i = 0; i < len; i++) {
		const info = infos[i];
		if (!info) continue;
		if (skip && skip[i]) continue;

		for (const subtable of lookup.subtables) {
			let matched = false;
			let lookupRecords: SequenceLookupRecord[] = [];

			if (subtable.format === 1) {
				const result = matchContextFormat1(
					font,
					buffer,
					i,
					subtable,
					lookup.flag,
				);
				if (result) {
					matched = true;
					lookupRecords = result;
				}
			} else if (subtable.format === 2) {
				const result = matchContextFormat2(
					font,
					buffer,
					i,
					subtable,
					lookup.flag,
				);
				if (result) {
					matched = true;
					lookupRecords = result;
				}
			} else if (subtable.format === 3) {
				if (matchContextFormat3(font, buffer, i, subtable, lookup.flag)) {
					matched = true;
					lookupRecords = subtable.lookupRecords;
				}
			}

			if (matched) {
				applyNestedLookups(font, buffer, i, lookupRecords, plan);
				break;
			}
		}
	}
}

function applyChainingContextSubstLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: ChainingContextSubstLookup,
	plan: ShapePlan,
): void {
	const infos = buffer.infos;
	const len = infos.length;

	// Pre-compute skip markers only if needed
	let skip: Uint8Array | null = null;
	if (lookup.flag !== 0 && font.gdef !== null) {
		skip = precomputeSkipMarkers(font, buffer, lookup.flag);
	}

	for (let i = 0; i < len; i++) {
		const info = infos[i];
		if (!info) continue;
		if (skip && skip[i]) continue;

		for (const subtable of lookup.subtables) {
			let matched = false;
			let lookupRecords: SequenceLookupRecord[] = [];

			if (subtable.format === 1) {
				const result = matchChainingFormat1(
					font,
					buffer,
					i,
					subtable,
					lookup.flag,
				);
				if (result) {
					matched = true;
					lookupRecords = result;
				}
			} else if (subtable.format === 2) {
				const result = matchChainingFormat2(
					font,
					buffer,
					i,
					subtable,
					lookup.flag,
				);
				if (result) {
					matched = true;
					lookupRecords = result;
				}
			} else if (subtable.format === 3) {
				if (matchChainingFormat3(font, buffer, i, subtable, lookup.flag)) {
					matched = true;
					lookupRecords = subtable.lookupRecords;
				}
			}

			if (matched) {
				applyNestedLookups(font, buffer, i, lookupRecords, plan);
				break;
			}
		}
	}
}

function applyReverseChainingSingleSubstLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: ReverseChainingSingleSubstLookup,
): void {
	// Process in reverse order
	for (let i = buffer.infos.length - 1; i >= 0; i--) {
		const info = buffer.infos[i];
		if (!info) continue;
		if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;

		for (const subtable of lookup.subtables) {
			const coverageIndex = subtable.coverage.get(info.glyphId);
			if (coverageIndex === null) continue;

			// Check backtrack (glyphs after current in reverse order)
			let backtrackMatch = true;
			let backtrackPos = i + 1;
			for (const backCov of subtable.backtrackCoverages) {
				while (
					backtrackPos < buffer.infos.length &&
					shouldSkipGlyph(
						font,
						buffer.infos[backtrackPos]?.glyphId,
						lookup.flag,
					)
				) {
					backtrackPos++;
				}
				if (
					backtrackPos >= buffer.infos.length ||
					backCov.get(buffer.infos[backtrackPos]?.glyphId) === null
				) {
					backtrackMatch = false;
					break;
				}
				backtrackPos++;
			}
			if (!backtrackMatch) continue;

			// Check lookahead (glyphs before current)
			let lookaheadMatch = true;
			let lookaheadPos = i - 1;
			for (const lookCov of subtable.lookaheadCoverages) {
				while (
					lookaheadPos >= 0 &&
					shouldSkipGlyph(
						font,
						buffer.infos[lookaheadPos]?.glyphId,
						lookup.flag,
					)
				) {
					lookaheadPos--;
				}
				if (
					lookaheadPos < 0 ||
					lookCov.get(buffer.infos[lookaheadPos]?.glyphId) === null
				) {
					lookaheadMatch = false;
					break;
				}
				lookaheadPos--;
			}
			if (!lookaheadMatch) continue;

			// Apply substitution
			const substitute = subtable.substituteGlyphIds[coverageIndex];
			if (substitute !== undefined) {
				info.glyphId = substitute;
			}
			break;
		}
	}
}

// Note: Extension lookups (Type 7) are unwrapped during parsing,
// so no applyExtensionGsubLookup function is needed at runtime.

/** Match Context Format 1 - glyph-based rules */
function matchContextFormat1(
	font: Font,
	buffer: GlyphBuffer,
	startIndex: number,
	subtable: ContextSubstFormat1,
	lookupFlag: number,
): SequenceLookupRecord[] | null {
	const firstGlyph = buffer.infos[startIndex]?.glyphId;
	const coverageIndex = subtable.coverage.get(firstGlyph);
	if (coverageIndex === null) return null;

	const ruleSet = subtable.ruleSets[coverageIndex];
	if (!ruleSet) return null;

	for (const rule of ruleSet) {
		if (
			matchGlyphSequence(
				font,
				buffer,
				startIndex + 1,
				rule.inputSequence,
				lookupFlag,
			)
		) {
			return rule.lookupRecords;
		}
	}
	return null;
}

/** Match Context Format 2 - class-based rules */
function matchContextFormat2(
	font: Font,
	buffer: GlyphBuffer,
	startIndex: number,
	subtable: ContextSubstFormat2,
	lookupFlag: number,
): SequenceLookupRecord[] | null {
	const firstGlyph = buffer.infos[startIndex]?.glyphId;
	const coverageIndex = subtable.coverage.get(firstGlyph);
	if (coverageIndex === null) return null;

	const firstClass = subtable.classDef.get(firstGlyph);
	const classRuleSet = subtable.classRuleSets[firstClass];
	if (!classRuleSet) return null;

	for (const rule of classRuleSet) {
		if (
			matchClassSequence(
				font,
				buffer,
				startIndex + 1,
				rule.inputClasses,
				subtable.classDef,
				lookupFlag,
			)
		) {
			return rule.lookupRecords;
		}
	}
	return null;
}

/** Match Context Format 3 - coverage-based */
function matchContextFormat3(
	font: Font,
	buffer: GlyphBuffer,
	startIndex: number,
	subtable: ContextSubstFormat3,
	lookupFlag: number,
): boolean {
	let pos = startIndex;
	for (const coverage of subtable.coverages) {
		while (
			pos < buffer.infos.length &&
			shouldSkipGlyph(font, buffer.infos[pos]?.glyphId, lookupFlag)
		) {
			pos++;
		}
		if (pos >= buffer.infos.length) return false;
		if (coverage.get(buffer.infos[pos]?.glyphId) === null) return false;
		pos++;
	}
	return true;
}

/** Match Chaining Context Format 1 - glyph-based rules */
function matchChainingFormat1(
	font: Font,
	buffer: GlyphBuffer,
	startIndex: number,
	subtable: ChainingContextFormat1,
	lookupFlag: number,
): SequenceLookupRecord[] | null {
	const firstGlyph = buffer.infos[startIndex]?.glyphId;
	const coverageIndex = subtable.coverage.get(firstGlyph);
	if (coverageIndex === null) return null;

	const chainRuleSet = subtable.chainRuleSets[coverageIndex];
	if (!chainRuleSet) return null;

	for (const rule of chainRuleSet) {
		// Check backtrack (reversed order, before startIndex)
		if (
			!matchGlyphSequenceBackward(
				font,
				buffer,
				startIndex - 1,
				rule.backtrackSequence,
				lookupFlag,
			)
		) {
			continue;
		}

		// Check input (excluding first glyph which is in coverage)
		if (
			!matchGlyphSequence(
				font,
				buffer,
				startIndex + 1,
				rule.inputSequence,
				lookupFlag,
			)
		) {
			continue;
		}

		// Find where input sequence ends
		let inputEnd = startIndex + 1;
		for (let i = 0; i < rule.inputSequence.length; i++) {
			while (
				inputEnd < buffer.infos.length &&
				shouldSkipGlyph(font, buffer.infos[inputEnd]?.glyphId, lookupFlag)
			) {
				inputEnd++;
			}
			inputEnd++;
		}

		// Check lookahead
		if (
			!matchGlyphSequence(
				font,
				buffer,
				inputEnd,
				rule.lookaheadSequence,
				lookupFlag,
			)
		) {
			continue;
		}

		return rule.lookupRecords;
	}
	return null;
}

/** Match Chaining Context Format 2 - class-based rules */
function matchChainingFormat2(
	font: Font,
	buffer: GlyphBuffer,
	startIndex: number,
	subtable: ChainingContextFormat2,
	lookupFlag: number,
): SequenceLookupRecord[] | null {
	const firstGlyph = buffer.infos[startIndex]?.glyphId;
	const coverageIndex = subtable.coverage.get(firstGlyph);
	if (coverageIndex === null) return null;

	const firstClass = subtable.inputClassDef.get(firstGlyph);
	const chainClassRuleSet = subtable.chainClassRuleSets[firstClass];
	if (!chainClassRuleSet) return null;

	for (const rule of chainClassRuleSet) {
		// Check backtrack classes (reversed order)
		if (
			!matchClassSequenceBackward(
				font,
				buffer,
				startIndex - 1,
				rule.backtrackClasses,
				subtable.backtrackClassDef,
				lookupFlag,
			)
		) {
			continue;
		}

		// Check input classes (excluding first)
		if (
			!matchClassSequence(
				font,
				buffer,
				startIndex + 1,
				rule.inputClasses,
				subtable.inputClassDef,
				lookupFlag,
			)
		) {
			continue;
		}

		// Find where input ends
		let inputEnd = startIndex + 1;
		for (let i = 0; i < rule.inputClasses.length; i++) {
			while (
				inputEnd < buffer.infos.length &&
				shouldSkipGlyph(font, buffer.infos[inputEnd]?.glyphId, lookupFlag)
			) {
				inputEnd++;
			}
			inputEnd++;
		}

		// Check lookahead classes
		if (
			!matchClassSequence(
				font,
				buffer,
				inputEnd,
				rule.lookaheadClasses,
				subtable.lookaheadClassDef,
				lookupFlag,
			)
		) {
			continue;
		}

		return rule.lookupRecords;
	}
	return null;
}

/** Match Chaining Context Format 3 - coverage-based */
function matchChainingFormat3(
	font: Font,
	buffer: GlyphBuffer,
	startIndex: number,
	subtable: ChainingContextFormat3,
	lookupFlag: number,
): boolean {
	// Check backtrack (in reverse order, before startIndex)
	let backtrackPos = startIndex - 1;
	for (const coverage of subtable.backtrackCoverages) {
		while (
			backtrackPos >= 0 &&
			shouldSkipGlyph(font, buffer.infos[backtrackPos]?.glyphId, lookupFlag)
		) {
			backtrackPos--;
		}
		if (backtrackPos < 0) return false;
		if (coverage.get(buffer.infos[backtrackPos]?.glyphId) === null)
			return false;
		backtrackPos--;
	}

	// Check input sequence
	let inputPos = startIndex;
	for (const coverage of subtable.inputCoverages) {
		while (
			inputPos < buffer.infos.length &&
			shouldSkipGlyph(font, buffer.infos[inputPos]?.glyphId, lookupFlag)
		) {
			inputPos++;
		}
		if (inputPos >= buffer.infos.length) return false;
		if (coverage.get(buffer.infos[inputPos]?.glyphId) === null) return false;
		inputPos++;
	}

	// Check lookahead
	let lookaheadPos = inputPos;
	for (const coverage of subtable.lookaheadCoverages) {
		while (
			lookaheadPos < buffer.infos.length &&
			shouldSkipGlyph(font, buffer.infos[lookaheadPos]?.glyphId, lookupFlag)
		) {
			lookaheadPos++;
		}
		if (lookaheadPos >= buffer.infos.length) return false;
		if (coverage.get(buffer.infos[lookaheadPos]?.glyphId) === null)
			return false;
		lookaheadPos++;
	}

	return true;
}

function applyNestedLookups(
	_font: Font,
	buffer: GlyphBuffer,
	startIndex: number,
	lookupRecords: Array<{ sequenceIndex: number; lookupListIndex: number }>,
	plan: ShapePlan,
): void {
	// Sort by sequence index descending to apply from end to start
	// Use slice() instead of spread operator for better performance
	const sorted = lookupRecords.slice().sort(
		(a, b) => b.sequenceIndex - a.sequenceIndex,
	);

	for (const record of sorted) {
		// O(1) lookup via map instead of O(n) find
		const lookupEntry = plan.gsubLookupMap.get(record.lookupListIndex);
		if (!lookupEntry) continue;

		// Apply at the specific position
		const pos = startIndex + record.sequenceIndex;
		if (pos >= buffer.infos.length) continue;

		const targetInfo = buffer.infos[pos];
		if (!targetInfo) continue;

		// For single subst, apply directly
		if (lookupEntry.lookup.type === GsubLookupType.Single) {
			const replacement = applySingleSubst(
				lookupEntry.lookup as SingleSubstLookup,
				targetInfo.glyphId,
			);
			if (replacement !== null) {
				targetInfo.glyphId = replacement;
			}
		}
	}
}

// GPOS application

function initializePositions(face: Face, buffer: GlyphBuffer): void {
	const infos = buffer.infos;
	for (let i = 0; i < infos.length; i++) {
		const info = infos[i]!;
		// Use Face.advanceWidth to include variable font deltas
		const advance = face.advanceWidth(info.glyphId);
		buffer.setAdvance(i, advance, 0);
	}
}

/**
 * Glyph class cache for efficient repeated lookups during GPOS positioning.
 * Map from GlyphId to GlyphClass (avoids repeated GDEF lookups for same glyph).
 */
type GlyphClassCache = Map<GlyphId, number>;

/**
 * Get glyph class with caching for O(1) repeated lookups.
 */
function getCachedGlyphClass(
	font: Font,
	glyphId: GlyphId,
	cache: GlyphClassCache,
): number {
	let cls = cache.get(glyphId);
	if (cls === undefined) {
		cls = getGlyphClass(font.gdef, glyphId);
		cache.set(glyphId, cls);
	}
	return cls;
}

function applyGpos(font: Font, buffer: GlyphBuffer, plan: ShapePlan): void {
	// Create glyph class cache for efficient mark positioning
	const glyphClassCache: GlyphClassCache = new Map();

	// Pre-compute base index array for O(1) mark-to-base lookup
	const baseIndexArray = buildBaseIndexArray(buffer, glyphClassCache, font);

	for (const { lookup } of plan.gposLookups) {
		applyGposLookup(font, buffer, lookup, plan, glyphClassCache, baseIndexArray);
	}
}

function applyGposLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: AnyGposLookup,
	plan: ShapePlan,
	glyphClassCache: GlyphClassCache,
	baseIndexArray: Int16Array,
): void {
	switch (lookup.type) {
		case GposLookupType.Single:
			applySinglePosLookup(font, buffer, lookup);
			break;
		case GposLookupType.Pair:
			applyPairPosLookup(font, buffer, lookup);
			break;
		case GposLookupType.Cursive:
			applyCursivePosLookup(font, buffer, lookup);
			break;
		case GposLookupType.MarkToBase:
			applyMarkBasePosLookup(font, buffer, lookup, glyphClassCache, baseIndexArray);
			break;
		case GposLookupType.MarkToLigature:
			applyMarkLigaturePosLookup(font, buffer, lookup, glyphClassCache, baseIndexArray);
			break;
		case GposLookupType.MarkToMark:
			applyMarkMarkPosLookup(font, buffer, lookup, glyphClassCache);
			break;
		case GposLookupType.Context:
			applyContextPosLookup(font, buffer, lookup as ContextPosLookup, plan);
			break;
		case GposLookupType.ChainingContext:
			applyChainingContextPosLookup(
				font,
				buffer,
				lookup as ChainingContextPosLookup,
				plan,
			);
			break;
		// Extension (type 9) is unwrapped during parsing - no runtime case needed
	}
}

function applySinglePosLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: SinglePosLookup,
): void {
	const infos = buffer.infos;
	const positions = buffer.positions;
	const len = infos.length;

	// Helper to apply single positioning at index i
	const applySingle = (i: number) => {
		const info = infos[i]!;
		const pos = positions[i];
		if (!pos) return;

		for (const subtable of lookup.subtables) {
			const coverageIndex = subtable.coverage.get(info.glyphId);
			if (coverageIndex === null) continue;

			const value =
				subtable.format === 1
					? subtable.value
					: subtable.values?.[coverageIndex];
			if (value) {
				if (value.xPlacement) pos.xOffset += value.xPlacement;
				if (value.yPlacement) pos.yOffset += value.yPlacement;
				if (value.xAdvance) pos.xAdvance += value.xAdvance;
				if (value.yAdvance) pos.yAdvance += value.yAdvance;
			}
			break;
		}
	};

	// FAST PATH: No skip checking needed
	if (lookup.flag === 0 || !font.gdef) {
		for (let i = 0; i < len; i++) {
			applySingle(i);
		}
		return;
	}

	// WITH SKIP: Need to check each glyph
	const skip = precomputeSkipMarkers(font, buffer, lookup.flag);
	for (let i = 0; i < len; i++) {
		if (skip[i]) continue;
		applySingle(i);
	}
}

function applyPairPosLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: PairPosLookup,
): void {
	const infos = buffer.infos;
	const positions = buffer.positions;
	const len = infos.length;

	// FAST PATH: No skip checking needed (no GDEF or no filtering flags)
	// This handles simple Latin text with no marks - O(n) with zero allocation
	if (lookup.flag === 0 || !font.gdef) {
		for (let i = 0; i < len - 1; i++) {
			const info1 = infos[i]!;
			const info2 = infos[i + 1]!;

			const kern = getKerning(lookup, info1.glyphId, info2.glyphId);
			if (kern) {
				const pos1 = positions[i];
				const pos2 = positions[i + 1];
				if (pos1) pos1.xAdvance += kern.xAdvance1;
				if (pos2) pos2.xAdvance += kern.xAdvance2;
			}
		}
		return;
	}

	// OPTIMIZED PATH: With skip markers - O(n) with precomputed arrays
	// Used for complex text with marks that need to be skipped
	const skip = precomputeSkipMarkers(font, buffer, lookup.flag);
	const nextNonSkip = buildNextNonSkipArray(skip, len);

	for (let i = 0; i < len - 1; i++) {
		if (skip[i]) continue;

		const j = nextNonSkip[i];
		if (j < 0) break;

		const info1 = infos[i]!;
		const info2 = infos[j]!;

		const kern = getKerning(lookup, info1.glyphId, info2.glyphId);
		if (kern) {
			const pos1 = positions[i];
			const pos2 = positions[j];
			if (pos1) pos1.xAdvance += kern.xAdvance1;
			if (pos2) pos2.xAdvance += kern.xAdvance2;
		}
	}
}

function applyCursivePosLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: CursivePosLookup,
): void {
	const infos = buffer.infos;
	const positions = buffer.positions;
	const len = infos.length;

	// Helper to apply cursive positioning between glyphs at i and j
	const applyCursive = (i: number, j: number) => {
		const info1 = infos[i]!;
		const info2 = infos[j]!;

		for (const subtable of lookup.subtables) {
			const exitIndex = subtable.coverage.get(info1.glyphId);
			const entryIndex = subtable.coverage.get(info2.glyphId);

			if (exitIndex === null || entryIndex === null) continue;

			const exitRecord = subtable.entryExitRecords[exitIndex];
			const entryRecord = subtable.entryExitRecords[entryIndex];

			if (!exitRecord?.exitAnchor || !entryRecord?.entryAnchor) continue;

			const exitAnchor = exitRecord.exitAnchor;
			const entryAnchor = entryRecord.entryAnchor;

			const pos2 = positions[j];
			if (pos2) {
				pos2.yOffset = exitAnchor.yCoordinate - entryAnchor.yCoordinate;
			}

			break;
		}
	};

	// FAST PATH: No skip checking needed
	if (lookup.flag === 0 || !font.gdef) {
		for (let i = 0; i < len - 1; i++) {
			applyCursive(i, i + 1);
		}
		return;
	}

	// OPTIMIZED PATH: With skip markers
	const skip = precomputeSkipMarkers(font, buffer, lookup.flag);
	const nextNonSkip = buildNextNonSkipArray(skip, len);

	for (let i = 0; i < len - 1; i++) {
		if (skip[i]) continue;

		const j = nextNonSkip[i];
		if (j < 0) break;

		applyCursive(i, j);
	}
}

function applyMarkBasePosLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: MarkBasePosLookup,
	glyphClassCache: GlyphClassCache,
	baseIndexArray: Int16Array,
): void {
	for (let i = 0; i < buffer.infos.length; i++) {
		const markInfo = buffer.infos[i];
		if (!markInfo) continue;

		// Must be a mark glyph
		if (getCachedGlyphClass(font, markInfo.glyphId, glyphClassCache) !== GlyphClass.Mark)
			continue;

		// Use pre-computed base index for O(1) lookup instead of O(n) backward scan
		const baseIndex = baseIndexArray[i];
		if (baseIndex < 0) continue;

		const baseInfo = buffer.infos[baseIndex];
		if (!baseInfo) continue;

		for (const subtable of lookup.subtables) {
			const markCoverageIndex = subtable.markCoverage.get(markInfo.glyphId);
			const baseCoverageIndex = subtable.baseCoverage.get(baseInfo.glyphId);

			if (markCoverageIndex === null || baseCoverageIndex === null) continue;

			const markRecord = subtable.markArray.markRecords[markCoverageIndex];
			const baseRecord = subtable.baseArray[baseCoverageIndex];

			if (!markRecord || !baseRecord) continue;

			const baseAnchor = baseRecord.baseAnchors[markRecord.markClass];
			if (!baseAnchor) continue;

			const markAnchor = markRecord.markAnchor;

			// Position mark relative to base
			const markPos = buffer.positions[i];
			const basePos = buffer.positions[baseIndex];
			if (!markPos || !basePos) continue;

			markPos.xOffset =
				baseAnchor.xCoordinate - markAnchor.xCoordinate + basePos.xOffset;
			markPos.yOffset =
				baseAnchor.yCoordinate - markAnchor.yCoordinate + basePos.yOffset;

			// Mark doesn't advance cursor
			markPos.xAdvance = 0;
			markPos.yAdvance = 0;

			break;
		}
	}
}

function applyMarkLigaturePosLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: MarkLigaturePosLookup,
	glyphClassCache: GlyphClassCache,
	baseIndexArray: Int16Array,
): void {
	for (let i = 0; i < buffer.infos.length; i++) {
		const markInfo = buffer.infos[i];
		if (!markInfo) continue;

		if (getCachedGlyphClass(font, markInfo.glyphId, glyphClassCache) !== GlyphClass.Mark)
			continue;

		// Use pre-computed base index for O(1) lookup
		const ligIndex = baseIndexArray[i];
		if (ligIndex < 0) continue;

		const ligInfo = buffer.infos[ligIndex];
		if (!ligInfo) continue;

		// Must be a ligature
		if (getCachedGlyphClass(font, ligInfo.glyphId, glyphClassCache) !== GlyphClass.Ligature)
			continue;

		// Count intervening marks to determine component index
		let componentIndex = 0;
		for (let j = ligIndex + 1; j < i; j++) {
			const midInfo = buffer.infos[j];
			if (midInfo && getCachedGlyphClass(font, midInfo.glyphId, glyphClassCache) === GlyphClass.Mark) {
				componentIndex++;
			}
		}

		for (const subtable of lookup.subtables) {
			const markCoverageIndex = subtable.markCoverage.get(markInfo.glyphId);
			const ligCoverageIndex = subtable.ligatureCoverage.get(ligInfo.glyphId);

			if (markCoverageIndex === null || ligCoverageIndex === null) continue;

			const markRecord = subtable.markArray.markRecords[markCoverageIndex];
			const ligAttach = subtable.ligatureArray[ligCoverageIndex];

			if (!markRecord || !ligAttach) continue;

			// Clamp component index
			const compIdx = Math.min(
				componentIndex,
				ligAttach.componentRecords.length - 1,
			);
			const component = ligAttach.componentRecords[compIdx];
			if (!component) continue;

			const ligAnchor = component.ligatureAnchors[markRecord.markClass];
			if (!ligAnchor) continue;

			const markAnchor = markRecord.markAnchor;
			const markPos = buffer.positions[i];
			const ligPos = buffer.positions[ligIndex];
			if (!markPos || !ligPos) continue;

			markPos.xOffset =
				ligAnchor.xCoordinate - markAnchor.xCoordinate + ligPos.xOffset;
			markPos.yOffset =
				ligAnchor.yCoordinate - markAnchor.yCoordinate + ligPos.yOffset;
			markPos.xAdvance = 0;
			markPos.yAdvance = 0;

			break;
		}
	}
}

function applyMarkMarkPosLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: MarkMarkPosLookup,
	glyphClassCache: GlyphClassCache,
): void {
	for (let i = 0; i < buffer.infos.length; i++) {
		const mark1Info = buffer.infos[i];
		if (!mark1Info) continue;

		if (getCachedGlyphClass(font, mark1Info.glyphId, glyphClassCache) !== GlyphClass.Mark)
			continue;

		// Find preceding mark (mark2) - must be immediately preceding
		let mark2Index = -1;
		if (i > 0) {
			const prevInfo = buffer.infos[i - 1];
			if (prevInfo) {
				const prevClass = getCachedGlyphClass(font, prevInfo.glyphId, glyphClassCache);
				if (prevClass === GlyphClass.Mark) {
					mark2Index = i - 1;
				}
			}
		}

		if (mark2Index < 0) continue;
		const mark2Info = buffer.infos[mark2Index];
		if (!mark2Info) continue;

		for (const subtable of lookup.subtables) {
			const mark1CoverageIndex = subtable.mark1Coverage.get(mark1Info.glyphId);
			const mark2CoverageIndex = subtable.mark2Coverage.get(mark2Info.glyphId);

			if (mark1CoverageIndex === null || mark2CoverageIndex === null) continue;

			const mark1Record = subtable.mark1Array.markRecords[mark1CoverageIndex];
			const mark2Record = subtable.mark2Array[mark2CoverageIndex];

			if (!mark1Record || !mark2Record) continue;

			const mark2Anchor = mark2Record.mark2Anchors[mark1Record.markClass];
			if (!mark2Anchor) continue;

			const mark1Anchor = mark1Record.markAnchor;
			const mark1Pos = buffer.positions[i];
			const mark2Pos = buffer.positions[mark2Index];
			if (!mark1Pos || !mark2Pos) continue;

			mark1Pos.xOffset =
				mark2Anchor.xCoordinate - mark1Anchor.xCoordinate + mark2Pos.xOffset;
			mark1Pos.yOffset =
				mark2Anchor.yCoordinate - mark1Anchor.yCoordinate + mark2Pos.yOffset;

			break;
		}
	}
}

// GPOS Context positioning

function applyContextPosLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: ContextPosLookup,
	plan: ShapePlan,
): void {
	for (let i = 0; i < buffer.infos.length; i++) {
		const info = buffer.infos[i];
		if (!info) continue;
		if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;

		for (const subtable of lookup.subtables) {
			let matched = false;
			let lookupRecords: PosLookupRecord[] = [];

			if (subtable.format === 1) {
				const result = matchContextPosFormat1(
					font,
					buffer,
					i,
					subtable,
					lookup.flag,
				);
				if (result) {
					matched = true;
					lookupRecords = result;
				}
			} else if (subtable.format === 2) {
				const result = matchContextPosFormat2(
					font,
					buffer,
					i,
					subtable,
					lookup.flag,
				);
				if (result) {
					matched = true;
					lookupRecords = result;
				}
			} else if (subtable.format === 3) {
				if (matchContextPosFormat3(font, buffer, i, subtable, lookup.flag)) {
					matched = true;
					lookupRecords = subtable.lookupRecords;
				}
			}

			if (matched) {
				applyNestedPosLookups(font, buffer, i, lookupRecords, plan);
				break;
			}
		}
	}
}

function applyChainingContextPosLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: ChainingContextPosLookup,
	plan: ShapePlan,
): void {
	for (let i = 0; i < buffer.infos.length; i++) {
		const info = buffer.infos[i];
		if (!info) continue;
		if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;

		for (const subtable of lookup.subtables) {
			let matched = false;
			let lookupRecords: PosLookupRecord[] = [];

			if (subtable.format === 1) {
				const result = matchChainingContextPosFormat1(
					font,
					buffer,
					i,
					subtable,
					lookup.flag,
				);
				if (result) {
					matched = true;
					lookupRecords = result;
				}
			} else if (subtable.format === 2) {
				const result = matchChainingContextPosFormat2(
					font,
					buffer,
					i,
					subtable,
					lookup.flag,
				);
				if (result) {
					matched = true;
					lookupRecords = result;
				}
			} else if (subtable.format === 3) {
				if (
					matchChainingContextPosFormat3(font, buffer, i, subtable, lookup.flag)
				) {
					matched = true;
					lookupRecords = subtable.lookupRecords;
				}
			}

			if (matched) {
				applyNestedPosLookups(font, buffer, i, lookupRecords, plan);
				break;
			}
		}
	}
}

/** Match Context Pos Format 1 - glyph-based rules */
function matchContextPosFormat1(
	font: Font,
	buffer: GlyphBuffer,
	startIndex: number,
	subtable: ContextPosFormat1,
	lookupFlag: number,
): PosLookupRecord[] | null {
	const firstGlyph = buffer.infos[startIndex]?.glyphId;
	const coverageIndex = subtable.coverage.get(firstGlyph);
	if (coverageIndex === null) return null;

	const ruleSet = subtable.ruleSets[coverageIndex];
	if (!ruleSet) return null;

	for (const rule of ruleSet) {
		if (
			matchGlyphSequence(
				font,
				buffer,
				startIndex + 1,
				rule.inputSequence,
				lookupFlag,
			)
		) {
			return rule.lookupRecords;
		}
	}
	return null;
}

/** Match Context Pos Format 2 - class-based rules */
function matchContextPosFormat2(
	font: Font,
	buffer: GlyphBuffer,
	startIndex: number,
	subtable: ContextPosFormat2,
	lookupFlag: number,
): PosLookupRecord[] | null {
	const firstGlyph = buffer.infos[startIndex]?.glyphId;
	const coverageIndex = subtable.coverage.get(firstGlyph);
	if (coverageIndex === null) return null;

	const firstClass = subtable.classDef.get(firstGlyph);
	const classRuleSet = subtable.classRuleSets[firstClass];
	if (!classRuleSet) return null;

	for (const rule of classRuleSet) {
		if (
			matchClassSequence(
				font,
				buffer,
				startIndex + 1,
				rule.inputClasses,
				subtable.classDef,
				lookupFlag,
			)
		) {
			return rule.lookupRecords;
		}
	}
	return null;
}

/** Match Context Pos Format 3 - coverage-based */
function matchContextPosFormat3(
	font: Font,
	buffer: GlyphBuffer,
	startIndex: number,
	subtable: ContextPosFormat3,
	lookupFlag: number,
): boolean {
	let pos = startIndex;
	for (const coverage of subtable.coverages) {
		while (
			pos < buffer.infos.length &&
			shouldSkipGlyph(font, buffer.infos[pos]?.glyphId, lookupFlag)
		) {
			pos++;
		}
		if (pos >= buffer.infos.length) return false;
		if (coverage.get(buffer.infos[pos]?.glyphId) === null) return false;
		pos++;
	}
	return true;
}

/** Match Chaining Context Pos Format 1 - glyph-based rules */
function matchChainingContextPosFormat1(
	font: Font,
	buffer: GlyphBuffer,
	startIndex: number,
	subtable: ChainingContextPosFormat1,
	lookupFlag: number,
): PosLookupRecord[] | null {
	const firstGlyph = buffer.infos[startIndex]?.glyphId;
	const coverageIndex = subtable.coverage.get(firstGlyph);
	if (coverageIndex === null) return null;

	const chainRuleSet = subtable.chainRuleSets[coverageIndex];
	if (!chainRuleSet) return null;

	for (const rule of chainRuleSet) {
		// Check backtrack (reversed order, before startIndex)
		if (
			!matchGlyphSequenceBackward(
				font,
				buffer,
				startIndex - 1,
				rule.backtrackSequence,
				lookupFlag,
			)
		) {
			continue;
		}

		// Check input (excluding first glyph which is in coverage)
		if (
			!matchGlyphSequence(
				font,
				buffer,
				startIndex + 1,
				rule.inputSequence,
				lookupFlag,
			)
		) {
			continue;
		}

		// Find where input sequence ends
		let inputEnd = startIndex + 1;
		for (let i = 0; i < rule.inputSequence.length; i++) {
			while (
				inputEnd < buffer.infos.length &&
				shouldSkipGlyph(font, buffer.infos[inputEnd]?.glyphId, lookupFlag)
			) {
				inputEnd++;
			}
			inputEnd++;
		}

		// Check lookahead
		if (
			!matchGlyphSequence(
				font,
				buffer,
				inputEnd,
				rule.lookaheadSequence,
				lookupFlag,
			)
		) {
			continue;
		}

		return rule.lookupRecords;
	}
	return null;
}

/** Match Chaining Context Pos Format 2 - class-based rules */
function matchChainingContextPosFormat2(
	font: Font,
	buffer: GlyphBuffer,
	startIndex: number,
	subtable: ChainingContextPosFormat2,
	lookupFlag: number,
): PosLookupRecord[] | null {
	const firstGlyph = buffer.infos[startIndex]?.glyphId;
	const coverageIndex = subtable.coverage.get(firstGlyph);
	if (coverageIndex === null) return null;

	const firstClass = subtable.inputClassDef.get(firstGlyph);
	const chainClassRuleSet = subtable.chainClassRuleSets[firstClass];
	if (!chainClassRuleSet) return null;

	for (const rule of chainClassRuleSet) {
		// Check backtrack classes (reversed order)
		if (
			!matchClassSequenceBackward(
				font,
				buffer,
				startIndex - 1,
				rule.backtrackClasses,
				subtable.backtrackClassDef,
				lookupFlag,
			)
		) {
			continue;
		}

		// Check input classes (excluding first)
		if (
			!matchClassSequence(
				font,
				buffer,
				startIndex + 1,
				rule.inputClasses,
				subtable.inputClassDef,
				lookupFlag,
			)
		) {
			continue;
		}

		// Find where input ends
		let inputEnd = startIndex + 1;
		for (let i = 0; i < rule.inputClasses.length; i++) {
			while (
				inputEnd < buffer.infos.length &&
				shouldSkipGlyph(font, buffer.infos[inputEnd]?.glyphId, lookupFlag)
			) {
				inputEnd++;
			}
			inputEnd++;
		}

		// Check lookahead classes
		if (
			!matchClassSequence(
				font,
				buffer,
				inputEnd,
				rule.lookaheadClasses,
				subtable.lookaheadClassDef,
				lookupFlag,
			)
		) {
			continue;
		}

		return rule.lookupRecords;
	}
	return null;
}

/** Match Chaining Context Pos Format 3 - coverage-based */
function matchChainingContextPosFormat3(
	font: Font,
	buffer: GlyphBuffer,
	startIndex: number,
	subtable: ChainingContextPosFormat3,
	lookupFlag: number,
): boolean {
	// Check backtrack (in reverse order, before startIndex)
	let backtrackPos = startIndex - 1;
	for (const coverage of subtable.backtrackCoverages) {
		while (
			backtrackPos >= 0 &&
			shouldSkipGlyph(font, buffer.infos[backtrackPos]?.glyphId, lookupFlag)
		) {
			backtrackPos--;
		}
		if (backtrackPos < 0) return false;
		if (coverage.get(buffer.infos[backtrackPos]?.glyphId) === null)
			return false;
		backtrackPos--;
	}

	// Check input sequence
	let inputPos = startIndex;
	for (const coverage of subtable.inputCoverages) {
		while (
			inputPos < buffer.infos.length &&
			shouldSkipGlyph(font, buffer.infos[inputPos]?.glyphId, lookupFlag)
		) {
			inputPos++;
		}
		if (inputPos >= buffer.infos.length) return false;
		if (coverage.get(buffer.infos[inputPos]?.glyphId) === null) return false;
		inputPos++;
	}

	// Check lookahead
	let lookaheadPos = inputPos;
	for (const coverage of subtable.lookaheadCoverages) {
		while (
			lookaheadPos < buffer.infos.length &&
			shouldSkipGlyph(font, buffer.infos[lookaheadPos]?.glyphId, lookupFlag)
		) {
			lookaheadPos++;
		}
		if (lookaheadPos >= buffer.infos.length) return false;
		if (coverage.get(buffer.infos[lookaheadPos]?.glyphId) === null)
			return false;
		lookaheadPos++;
	}

	return true;
}

/** Apply nested positioning lookups at specific positions */
function applyNestedPosLookups(
	font: Font,
	buffer: GlyphBuffer,
	startIndex: number,
	lookupRecords: PosLookupRecord[],
	plan: ShapePlan,
): void {
	// Sort by sequence index descending to apply from end to start
	// Use slice() instead of spread operator for better performance
	const sorted = lookupRecords.slice().sort(
		(a, b) => b.sequenceIndex - a.sequenceIndex,
	);

	// Build cache and base index for nested lookups (may use mark positioning)
	const glyphClassCache: GlyphClassCache = new Map();
	const baseIndexArray = buildBaseIndexArray(buffer, glyphClassCache, font);

	for (const record of sorted) {
		// O(1) lookup via map instead of O(n) find
		const lookupEntry = plan.gposLookupMap.get(record.lookupListIndex);
		if (!lookupEntry) continue;

		// Apply at the specific position
		const pos = startIndex + record.sequenceIndex;
		if (pos >= buffer.infos.length) continue;

		// Apply the lookup directly
		applyGposLookup(font, buffer, lookupEntry.lookup, plan, glyphClassCache, baseIndexArray);
	}
}

// Sequence matching helpers

/** Match a sequence of specific glyphs forward */
function matchGlyphSequence(
	font: Font,
	buffer: GlyphBuffer,
	startPos: number,
	glyphs: GlyphId[],
	lookupFlag: number,
): boolean {
	let pos = startPos;
	for (const glyph of glyphs) {
		while (
			pos < buffer.infos.length &&
			shouldSkipGlyph(font, buffer.infos[pos]?.glyphId, lookupFlag)
		) {
			pos++;
		}
		if (pos >= buffer.infos.length) return false;
		if (buffer.infos[pos]?.glyphId !== glyph) return false;
		pos++;
	}
	return true;
}

/** Match a sequence of specific glyphs backward */
function matchGlyphSequenceBackward(
	font: Font,
	buffer: GlyphBuffer,
	startPos: number,
	glyphs: GlyphId[],
	lookupFlag: number,
): boolean {
	let pos = startPos;
	for (const glyph of glyphs) {
		while (
			pos >= 0 &&
			shouldSkipGlyph(font, buffer.infos[pos]?.glyphId, lookupFlag)
		) {
			pos--;
		}
		if (pos < 0) return false;
		if (buffer.infos[pos]?.glyphId !== glyph) return false;
		pos--;
	}
	return true;
}

/** Match a sequence of classes forward */
function matchClassSequence(
	font: Font,
	buffer: GlyphBuffer,
	startPos: number,
	classes: number[],
	classDef: ClassDef,
	lookupFlag: number,
): boolean {
	let pos = startPos;
	for (const cls of classes) {
		while (
			pos < buffer.infos.length &&
			shouldSkipGlyph(font, buffer.infos[pos]?.glyphId, lookupFlag)
		) {
			pos++;
		}
		if (pos >= buffer.infos.length) return false;
		if (classDef.get(buffer.infos[pos]?.glyphId) !== cls) return false;
		pos++;
	}
	return true;
}

/** Match a sequence of classes backward */
function matchClassSequenceBackward(
	font: Font,
	buffer: GlyphBuffer,
	startPos: number,
	classes: number[],
	classDef: ClassDef,
	lookupFlag: number,
): boolean {
	let pos = startPos;
	for (const cls of classes) {
		while (
			pos >= 0 &&
			shouldSkipGlyph(font, buffer.infos[pos]?.glyphId, lookupFlag)
		) {
			pos--;
		}
		if (pos < 0) return false;
		if (classDef.get(buffer.infos[pos]?.glyphId) !== cls) return false;
		pos--;
	}
	return true;
}

// Utility

function shouldSkipGlyph(
	font: Font,
	glyphId: GlyphId,
	lookupFlag: number,
): boolean {
	const gdef = font.gdef;
	if (!gdef) return false;

	const glyphClass = getGlyphClass(gdef, glyphId);

	if (
		lookupFlag & LookupFlag.IgnoreBaseGlyphs &&
		glyphClass === GlyphClass.Base
	)
		return true;
	if (
		lookupFlag & LookupFlag.IgnoreLigatures &&
		glyphClass === GlyphClass.Ligature
	)
		return true;
	if (lookupFlag & LookupFlag.IgnoreMarks && glyphClass === GlyphClass.Mark)
		return true;

	const markAttachmentType = getMarkAttachmentType(lookupFlag);
	if (markAttachmentType !== 0 && glyphClass === GlyphClass.Mark) {
		const glyphMarkClass = gdef.markAttachClassDef.get(glyphId);
		if (glyphMarkClass !== markAttachmentType) return true;
	}

	return false;
}

// AAT morx substitution

function applyMorx(font: Font, buffer: GlyphBuffer): void {
	const morx = font.morx;
	if (!morx) return;

	for (const chain of morx.chains) {
		for (const subtable of chain.subtables) {
			// Apply if subFeatureFlags match (default: all enabled)
			if ((chain.defaultFlags & subtable.subFeatureFlags) === 0) continue;

			switch (subtable.type) {
				case MorxSubtableType.NonContextual:
					// Simple substitution (Type 4)
					for (const info of buffer.infos) {
						const replacement = applyNonContextual(
							subtable as MorxNonContextualSubtable,
							info.glyphId,
						);
						if (replacement !== null) {
							info.glyphId = replacement;
						}
					}
					break;

				case MorxSubtableType.Rearrangement:
					// Rearrangement (Type 0) - reorder glyphs
					processRearrangement(
						subtable as MorxRearrangementSubtable,
						buffer.infos,
					);
					break;

				case MorxSubtableType.Contextual:
					// Contextual substitution (Type 1)
					processContextual(subtable as MorxContextualSubtable, buffer.infos);
					break;

				case MorxSubtableType.Ligature: {
					// Ligature (Type 2)
					const newInfos = processLigature(
						subtable as MorxLigatureSubtable,
						buffer.infos,
					);
					// Update buffer with new infos (may be shorter due to ligatures)
					if (newInfos.length !== buffer.infos.length) {
						buffer.initFromInfos(newInfos);
					}
					break;
				}

				case MorxSubtableType.Insertion: {
					// Insertion (Type 5)
					const newInfos = processInsertion(
						subtable as MorxInsertionSubtable,
						buffer.infos,
					);
					// Update buffer with new infos (may be longer due to insertions)
					if (newInfos.length !== buffer.infos.length) {
						buffer.initFromInfos(newInfos);
					}
					break;
				}
			}
		}
	}
}
