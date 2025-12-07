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
	applyKerningDirect,
	type CursivePosLookup,
	GposLookupType,
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
import { SetDigest } from "../layout/structures/set-digest.ts";
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
	getOrCreateShapePlan,
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

/** Cached Face per Font for avoiding allocation overhead */
const _faceCache = new WeakMap<Font, Face>();

/** Get Face (cached for non-variable fonts) */
function getFace(fontLike: FontLike): Face {
	if (fontLike instanceof Face) return fontLike;
	// Cache Face per Font to avoid allocation per shape
	let face = _faceCache.get(fontLike);
	if (!face) {
		face = new Face(fontLike);
		_faceCache.set(fontLike, face);
	}
	return face;
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
function buildNextNonSkipArray(skip: SkipMarkers, length: number): Int16Array {
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
 * Also returns whether any marks were found in the buffer.
 */
function buildBaseIndexArray(
	buffer: GlyphBuffer,
	glyphClassCache: GlyphClassCache,
	font: Font,
): { baseIndex: Int16Array; hasMarks: boolean } {
	const baseIndex = new Int16Array(buffer.infos.length);
	baseIndex.fill(-1);

	let lastBaseIndex = -1;
	let hasMarks = false;

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
			hasMarks = true;
		}
	}

	return { baseIndex, hasMarks };
}

// Reusable GlyphBuffer pool for shapeInto
const _glyphBufferPool: GlyphBuffer[] = [];
const MAX_POOL_SIZE = 8;

/**
 * Return a GlyphBuffer to the pool for reuse.
 * Call this when done with a buffer from shape() to reduce allocations.
 */
export function releaseBuffer(buffer: GlyphBuffer): void {
	if (_glyphBufferPool.length < MAX_POOL_SIZE) {
		buffer.reset();
		_glyphBufferPool.push(buffer);
	}
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
	// Try to get a pooled buffer
	let glyphBuffer = _glyphBufferPool.pop();
	if (!glyphBuffer) {
		glyphBuffer = GlyphBuffer.withCapacity(64);
	}

	shapeInto(fontLike, buffer, glyphBuffer, options);
	return glyphBuffer;
}

/**
 * Shape text into an existing GlyphBuffer (zero-allocation hot path).
 * Use this for maximum performance when shaping repeatedly.
 */
export function shapeInto(
	fontLike: FontLike,
	buffer: UnicodeBuffer,
	glyphBuffer: GlyphBuffer,
	options: ShapeOptions = {},
): void {
	const font = getFont(fontLike);
	const face = getFace(fontLike);

	const script = options.script ?? buffer.script ?? "latn";
	const language = options.language ?? buffer.language ?? null;
	const direction = options.direction ?? "ltr";
	const features = options.features ?? [];

	// Get axis coordinates from face for feature variations
	const axisCoords =
		face.normalizedCoords.length > 0 ? face.normalizedCoords : null;
	// Use cached shape plan for repeated shaping with same parameters
	const plan = getOrCreateShapePlan(
		font,
		script,
		language,
		direction,
		features,
		axisCoords,
	);

	// Reset and reuse buffer
	glyphBuffer.reset();
	glyphBuffer.direction = buffer.direction;
	glyphBuffer.script = script;
	glyphBuffer.language = language;

	// Use pooled object initialization - inline glyphId lookup to avoid closure
	glyphBuffer.initFromCodepointsWithFont(
		buffer.codepoints,
		buffer.clusters,
		font,
	);

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
	const sampleLen = Math.min(10, infos.length);

	for (let s = 0; s < sampleLen; s++) {
		const info = infos[s]!;
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
	const lookups = plan.gsubLookups;

	// Build buffer digest for fast lookup skipping
	// Note: We rebuild after each lookup that modifies glyphs
	let bufferDigest = new SetDigest();
	const infos = buffer.infos;
	for (let i = 0; i < buffer.length; i++) {
		bufferDigest.add(infos[i]!.glyphId);
	}

	for (let i = 0; i < lookups.length; i++) {
		const entry = lookups[i]!;
		// Skip entire lookup if no glyph in buffer could match
		if (!bufferDigest.mayIntersect(entry.lookup.digest)) continue;

		const prevLength = buffer.length;
		applyGsubLookup(font, buffer, entry.lookup, plan);

		// Rebuild digest if buffer was modified (length change indicates substitution)
		if (buffer.length !== prevLength) {
			bufferDigest = new SetDigest();
			for (let j = 0; j < buffer.length; j++) {
				bufferDigest.add(infos[j]!.glyphId);
			}
		}
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
	const digest = lookup.digest;

	// FAST PATH: No skip checking needed
	if (lookup.flag === 0 || !font.gdef) {
		// Super-fast path for single subtable (very common)
		if (lookup.subtables.length === 1) {
			const subtable = lookup.subtables[0]!;
			if (subtable.format === 1 && subtable.deltaGlyphId !== undefined) {
				const delta = subtable.deltaGlyphId;
				for (let i = 0; i < len; i++) {
					const info = infos[i]!;
					// Fast digest check before expensive Coverage lookup
					if (!digest.mayHave(info.glyphId)) continue;
					if (subtable.coverage.get(info.glyphId) !== null) {
						info.glyphId = (info.glyphId + delta) & 0xffff;
					}
				}
			} else if (subtable.format === 2 && subtable.substituteGlyphIds) {
				const subs = subtable.substituteGlyphIds;
				for (let i = 0; i < len; i++) {
					const info = infos[i]!;
					// Fast digest check before expensive Coverage lookup
					if (!digest.mayHave(info.glyphId)) continue;
					const idx = subtable.coverage.get(info.glyphId);
					if (idx !== null) {
						const rep = subs[idx];
						if (rep !== undefined) info.glyphId = rep;
					}
				}
			}
			return;
		}
		// Multiple subtables - use function
		for (let i = 0; i < len; i++) {
			const info = infos[i]!;
			// Fast digest check before expensive Coverage lookup
			if (!digest.mayHave(info.glyphId)) continue;
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
		// Fast digest check before expensive Coverage lookup
		if (!digest.mayHave(info.glyphId)) continue;
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
	const digest = lookup.digest;
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
		// Fast digest check before expensive Coverage lookup
		if (!digest.mayHave(info.glyphId)) {
			i++;
			continue;
		}

		let applied = false;
		const subtables = lookup.subtables;
		for (let s = 0; s < subtables.length; s++) {
			const subtable = subtables[s]!;
			const coverageIndex = subtable.coverage.get(info.glyphId);
			if (coverageIndex === null) continue;

			const sequence = subtable.sequences[coverageIndex];
			if (!sequence || sequence.length === 0) continue;

			const firstGlyph = sequence[0];
			if (firstGlyph === undefined) continue;

			// Replace with first glyph
			info.glyphId = firstGlyph;

			// Insert remaining glyphs (avoid array destructuring allocation)
			for (let j = 1; j < sequence.length; j++) {
				const glyphId = sequence[j]!;
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
				buffer.insertGlyph(i + j, newInfo, newPos);
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
	const infos = buffer.infos;
	const subtables = lookup.subtables;
	const digest = lookup.digest;
	for (let i = 0; i < infos.length; i++) {
		const info = infos[i]!;
		if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;
		// Fast digest check before expensive Coverage lookup
		if (!digest.mayHave(info.glyphId)) continue;

		for (let s = 0; s < subtables.length; s++) {
			const subtable = subtables[s]!;
			const coverageIndex = subtable.coverage.get(info.glyphId);
			if (coverageIndex === null) continue;

			const alternateSet = subtable.alternateSets[coverageIndex];
			if (!alternateSet || alternateSet.length === 0) continue;

			const firstAlternate = alternateSet[0];
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
	const digest = lookup.digest;

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
		if (skip?.[i]) {
			i++;
			continue;
		}
		// Fast digest check before expensive Coverage lookup
		if (!digest.mayHave(info.glyphId)) {
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
			if (skip?.[j]) continue;
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
	const digest = lookup.digest;

	// Pre-compute skip markers only if needed
	let skip: Uint8Array | null = null;
	if (lookup.flag !== 0 && font.gdef !== null) {
		skip = precomputeSkipMarkers(font, buffer, lookup.flag);
	}

	// Context substitution - matches input sequence and applies nested lookups
	const subtables = lookup.subtables;
	for (let i = 0; i < len; i++) {
		const info = infos[i];
		if (!info) continue;
		if (skip?.[i]) continue;
		// Fast digest check before expensive Coverage lookup
		if (!digest.mayHave(info.glyphId)) continue;

		for (let s = 0; s < subtables.length; s++) {
			const subtable = subtables[s]!;
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
	const digest = lookup.digest;

	// Pre-compute skip markers only if needed
	let skip: Uint8Array | null = null;
	if (lookup.flag !== 0 && font.gdef !== null) {
		skip = precomputeSkipMarkers(font, buffer, lookup.flag);
	}

	const subtables = lookup.subtables;
	for (let i = 0; i < len; i++) {
		const info = infos[i];
		if (!info) continue;
		if (skip?.[i]) continue;
		// Fast digest check before expensive Coverage lookup
		if (!digest.mayHave(info.glyphId)) continue;

		for (let s = 0; s < subtables.length; s++) {
			const subtable = subtables[s]!;
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
	const infos = buffer.infos;
	const subtables = lookup.subtables;
	const digest = lookup.digest;
	// Process in reverse order
	for (let i = infos.length - 1; i >= 0; i--) {
		const info = infos[i];
		if (!info) continue;
		if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;
		// Fast digest check before expensive Coverage lookup
		if (!digest.mayHave(info.glyphId)) continue;

		for (let s = 0; s < subtables.length; s++) {
			const subtable = subtables[s]!;
			const coverageIndex = subtable.coverage.get(info.glyphId);
			if (coverageIndex === null) continue;

			// Check backtrack (glyphs after current in reverse order)
			let backtrackMatch = true;
			let backtrackPos = i + 1;
			const backtrackCoverages = subtable.backtrackCoverages;
			for (let b = 0; b < backtrackCoverages.length; b++) {
				const backCov = backtrackCoverages[b]!;
				while (
					backtrackPos < infos.length &&
					shouldSkipGlyph(font, infos[backtrackPos]?.glyphId, lookup.flag)
				) {
					backtrackPos++;
				}
				if (
					backtrackPos >= infos.length ||
					backCov.get(infos[backtrackPos]?.glyphId) === null
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
			const lookaheadCoverages = subtable.lookaheadCoverages;
			for (let l = 0; l < lookaheadCoverages.length; l++) {
				const lookCov = lookaheadCoverages[l]!;
				while (
					lookaheadPos >= 0 &&
					shouldSkipGlyph(font, infos[lookaheadPos]?.glyphId, lookup.flag)
				) {
					lookaheadPos--;
				}
				if (
					lookaheadPos < 0 ||
					lookCov.get(infos[lookaheadPos]?.glyphId) === null
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

	for (let r = 0; r < ruleSet.length; r++) {
		const rule = ruleSet[r]!;
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

	for (let r = 0; r < classRuleSet.length; r++) {
		const rule = classRuleSet[r]!;
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
	const infos = buffer.infos;
	const coverages = subtable.coverages;
	let pos = startIndex;
	for (let c = 0; c < coverages.length; c++) {
		const coverage = coverages[c]!;
		while (
			pos < infos.length &&
			shouldSkipGlyph(font, infos[pos]?.glyphId, lookupFlag)
		) {
			pos++;
		}
		if (pos >= infos.length) return false;
		if (coverage.get(infos[pos]?.glyphId) === null) return false;
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

	for (let r = 0; r < chainRuleSet.length; r++) {
		const rule = chainRuleSet[r]!;
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

	for (let r = 0; r < chainClassRuleSet.length; r++) {
		const rule = chainClassRuleSet[r]!;
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
		const infos = buffer.infos;
		let inputEnd = startIndex + 1;
		for (let i = 0; i < rule.inputClasses.length; i++) {
			while (
				inputEnd < infos.length &&
				shouldSkipGlyph(font, infos[inputEnd]?.glyphId, lookupFlag)
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
	const infos = buffer.infos;
	// Check backtrack (in reverse order, before startIndex)
	let backtrackPos = startIndex - 1;
	const backtrackCoverages = subtable.backtrackCoverages;
	for (let b = 0; b < backtrackCoverages.length; b++) {
		const coverage = backtrackCoverages[b]!;
		while (
			backtrackPos >= 0 &&
			shouldSkipGlyph(font, infos[backtrackPos]?.glyphId, lookupFlag)
		) {
			backtrackPos--;
		}
		if (backtrackPos < 0) return false;
		if (coverage.get(infos[backtrackPos]?.glyphId) === null) return false;
		backtrackPos--;
	}

	// Check input sequence
	let inputPos = startIndex;
	const inputCoverages = subtable.inputCoverages;
	for (let i = 0; i < inputCoverages.length; i++) {
		const coverage = inputCoverages[i]!;
		while (
			inputPos < infos.length &&
			shouldSkipGlyph(font, infos[inputPos]?.glyphId, lookupFlag)
		) {
			inputPos++;
		}
		if (inputPos >= infos.length) return false;
		if (coverage.get(infos[inputPos]?.glyphId) === null) return false;
		inputPos++;
	}

	// Check lookahead
	let lookaheadPos = inputPos;
	const lookaheadCoverages = subtable.lookaheadCoverages;
	for (let l = 0; l < lookaheadCoverages.length; l++) {
		const coverage = lookaheadCoverages[l]!;
		while (
			lookaheadPos < infos.length &&
			shouldSkipGlyph(font, infos[lookaheadPos]?.glyphId, lookupFlag)
		) {
			lookaheadPos++;
		}
		if (lookaheadPos >= infos.length) return false;
		if (coverage.get(infos[lookaheadPos]?.glyphId) === null) return false;
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
	const len = lookupRecords.length;
	if (len === 0) return;

	// Fast path for single record (common case)
	if (len === 1) {
		const record = lookupRecords[0]!;
		const lookupEntry = plan.gsubLookupMap.get(record.lookupListIndex);
		if (!lookupEntry) return;
		const pos = startIndex + record.sequenceIndex;
		if (pos >= buffer.infos.length) return;
		const targetInfo = buffer.infos[pos];
		if (!targetInfo) return;
		if (lookupEntry.lookup.type === GsubLookupType.Single) {
			const replacement = applySingleSubst(
				lookupEntry.lookup as SingleSubstLookup,
				targetInfo.glyphId,
			);
			if (replacement !== null) {
				targetInfo.glyphId = replacement;
			}
		}
		return;
	}

	// For multiple records, apply in descending sequence index order
	// Use selection approach for small arrays (typical case) to avoid alloc
	const applied = new Uint8Array(len);
	for (let round = 0; round < len; round++) {
		// Find max unapplied sequence index
		let maxIdx = -1;
		let maxSeq = -1;
		for (let i = 0; i < len; i++) {
			if (applied[i]) continue;
			const seq = lookupRecords[i]?.sequenceIndex;
			if (seq > maxSeq) {
				maxSeq = seq;
				maxIdx = i;
			}
		}
		if (maxIdx < 0) break;
		applied[maxIdx] = 1;

		const record = lookupRecords[maxIdx]!;
		const lookupEntry = plan.gsubLookupMap.get(record.lookupListIndex);
		if (!lookupEntry) continue;
		const pos = startIndex + record.sequenceIndex;
		if (pos >= buffer.infos.length) continue;
		const targetInfo = buffer.infos[pos];
		if (!targetInfo) continue;

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
	const positions = buffer.positions;
	const len = infos.length;
	const hmtx = face.font.hmtx;
	const hMetrics = hmtx.hMetrics;
	const hMetricsLen = hMetrics.length;
	const lastAdvance = hMetrics[hMetricsLen - 1]?.advanceWidth ?? 0;
	const isVariable = face.normalizedCoords.length > 0;

	// Fast path for non-variable fonts - inline array access
	if (!isVariable) {
		for (let i = 0; i < len; i++) {
			const gid = infos[i]!.glyphId;
			positions[i]!.xAdvance =
				gid < hMetricsLen ? (hMetrics[gid]?.advanceWidth ?? 0) : lastAdvance;
		}
		return;
	}

	// Variable font path - use Face for delta calculation
	for (let i = 0; i < len; i++) {
		const info = infos[i]!;
		positions[i]!.xAdvance = face.advanceWidth(info.glyphId);
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

	// Pre-compute base index array and detect marks in a single pass
	const { baseIndex: baseIndexArray, hasMarks } = buildBaseIndexArray(
		buffer,
		glyphClassCache,
		font,
	);

	// Build buffer digest for fast lookup skipping
	const bufferDigest = new SetDigest();
	const infos = buffer.infos;
	const len = buffer.length;
	for (let i = 0; i < len; i++) {
		bufferDigest.add(infos[i]!.glyphId);
	}

	const lookups = plan.gposLookups;
	for (let i = 0; i < lookups.length; i++) {
		const entry = lookups[i]!;
		// Skip entire lookup if no glyph in buffer could match
		if (!bufferDigest.mayIntersect(entry.lookup.digest)) continue;

		applyGposLookup(
			font,
			buffer,
			entry.lookup,
			plan,
			glyphClassCache,
			baseIndexArray,
			hasMarks,
		);
	}
}

function applyGposLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: AnyGposLookup,
	plan: ShapePlan,
	glyphClassCache: GlyphClassCache,
	baseIndexArray: Int16Array,
	hasMarks: boolean,
): void {
	switch (lookup.type) {
		case GposLookupType.Single:
			applySinglePosLookup(font, buffer, lookup, hasMarks);
			break;
		case GposLookupType.Pair:
			applyPairPosLookup(font, buffer, lookup, hasMarks);
			break;
		case GposLookupType.Cursive:
			applyCursivePosLookup(font, buffer, lookup, hasMarks);
			break;
		case GposLookupType.MarkToBase:
			// Skip mark-to-base if no marks in buffer - O(1) check saves full buffer scan
			if (!hasMarks) break;
			applyMarkBasePosLookup(
				font,
				buffer,
				lookup,
				glyphClassCache,
				baseIndexArray,
			);
			break;
		case GposLookupType.MarkToLigature:
			// Skip mark-to-ligature if no marks in buffer
			if (!hasMarks) break;
			applyMarkLigaturePosLookup(
				font,
				buffer,
				lookup,
				glyphClassCache,
				baseIndexArray,
			);
			break;
		case GposLookupType.MarkToMark:
			// Skip mark-to-mark if no marks in buffer
			if (!hasMarks) break;
			applyMarkMarkPosLookup(font, buffer, lookup, glyphClassCache);
			break;
		case GposLookupType.Context:
			applyContextPosLookup(
				font,
				buffer,
				lookup as ContextPosLookup,
				plan,
				glyphClassCache,
				baseIndexArray,
				hasMarks,
			);
			break;
		case GposLookupType.ChainingContext:
			applyChainingContextPosLookup(
				font,
				buffer,
				lookup as ChainingContextPosLookup,
				plan,
				glyphClassCache,
				baseIndexArray,
				hasMarks,
			);
			break;
		// Extension (type 9) is unwrapped during parsing - no runtime case needed
	}
}

function applySinglePosLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: SinglePosLookup,
	hasMarks: boolean,
): void {
	const infos = buffer.infos;
	const positions = buffer.positions;
	const len = infos.length;
	const digest = lookup.digest;
	const subtables = lookup.subtables;

	// FAST PATH: No skip checking needed (no flags, no GDEF, or no marks in buffer)
	// IgnoreMarks (0x10) is useless if there are no marks
	const needsSkip = hasMarks && lookup.flag !== 0 && font.gdef !== null;

	// Optimized fast path: single subtable format 1 (common case)
	if (subtables.length === 1 && !needsSkip) {
		const subtable = subtables[0]!;
		if (subtable.format === 1 && subtable.value) {
			const value = subtable.value;
			const hasX = value.xPlacement !== undefined && value.xPlacement !== 0;
			const hasY = value.yPlacement !== undefined && value.yPlacement !== 0;
			const hasXAdv = value.xAdvance !== undefined && value.xAdvance !== 0;
			const hasYAdv = value.yAdvance !== undefined && value.yAdvance !== 0;

			// Skip entirely if all values are zero
			if (!hasX && !hasY && !hasXAdv && !hasYAdv) return;

			for (let i = 0; i < len; i++) {
				const info = infos[i]!;
				// Fast digest check before expensive Coverage lookup
				if (!digest.mayHave(info.glyphId)) continue;
				if (subtable.coverage.get(info.glyphId) === null) continue;
				const pos = positions[i]!;
				if (hasX) pos.xOffset += value.xPlacement!;
				if (hasY) pos.yOffset += value.yPlacement!;
				if (hasXAdv) pos.xAdvance += value.xAdvance!;
				if (hasYAdv) pos.yAdvance += value.yAdvance!;
			}
			return;
		}
	}

	// Helper to apply single positioning at index i
	const applySingle = (i: number) => {
		const info = infos[i]!;
		// Fast digest check before expensive Coverage lookup
		if (!digest.mayHave(info.glyphId)) return;
		const pos = positions[i];
		if (!pos) return;

		for (let s = 0; s < subtables.length; s++) {
			const subtable = subtables[s]!;
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

	if (!needsSkip) {
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
	hasMarks: boolean,
): void {
	const infos = buffer.infos;
	const positions = buffer.positions;
	const len = infos.length;
	const digest = lookup.digest;

	// FAST PATH: No skip checking needed (no flags, no GDEF, or no marks to skip)
	// This handles simple Latin text - O(n) with zero allocation
	const needsSkip = hasMarks && lookup.flag !== 0 && font.gdef !== null;
	if (!needsSkip) {
		for (let i = 0; i < len - 1; i++) {
			const info1 = infos[i]!;
			// Fast digest check before expensive Coverage lookup
			if (!digest.mayHave(info1.glyphId)) continue;
			const info2 = infos[i + 1]!;
			const pos1 = positions[i]!;
			const pos2 = positions[i + 1]!;
			applyKerningDirect(lookup, info1.glyphId, info2.glyphId, pos1, pos2);
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
		// Fast digest check before expensive Coverage lookup
		if (!digest.mayHave(info1.glyphId)) continue;
		const info2 = infos[j]!;
		const pos1 = positions[i]!;
		const pos2 = positions[j]!;
		applyKerningDirect(lookup, info1.glyphId, info2.glyphId, pos1, pos2);
	}
}

function applyCursivePosLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: CursivePosLookup,
	hasMarks: boolean,
): void {
	const infos = buffer.infos;
	const positions = buffer.positions;
	const len = infos.length;
	const digest = lookup.digest;

	const subtables = lookup.subtables;
	// Helper to apply cursive positioning between glyphs at i and j
	const applyCursive = (i: number, j: number) => {
		const info1 = infos[i]!;
		const info2 = infos[j]!;
		// Fast digest check before expensive Coverage lookup
		if (!digest.mayHave(info1.glyphId) && !digest.mayHave(info2.glyphId))
			return;

		for (let s = 0; s < subtables.length; s++) {
			const subtable = subtables[s]!;
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

	// FAST PATH: No skip checking needed (no flags, no GDEF, or no marks)
	const needsSkip = hasMarks && lookup.flag !== 0 && font.gdef !== null;
	if (!needsSkip) {
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
	const digest = lookup.digest;
	const infos = buffer.infos;
	const positions = buffer.positions;
	const subtables = lookup.subtables;

	for (let i = 0; i < infos.length; i++) {
		const markInfo = infos[i];
		if (!markInfo) continue;

		// Fast digest check before expensive glyph class lookup
		if (!digest.mayHave(markInfo.glyphId)) continue;

		// Must be a mark glyph
		if (
			getCachedGlyphClass(font, markInfo.glyphId, glyphClassCache) !==
			GlyphClass.Mark
		)
			continue;

		// Use pre-computed base index for O(1) lookup instead of O(n) backward scan
		const baseIndex = baseIndexArray[i];
		if (baseIndex < 0) continue;

		const baseInfo = infos[baseIndex];
		if (!baseInfo) continue;

		for (let s = 0; s < subtables.length; s++) {
			const subtable = subtables[s]!;
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
			const markPos = positions[i];
			const basePos = positions[baseIndex];
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
	const digest = lookup.digest;
	const infos = buffer.infos;
	const positions = buffer.positions;
	const subtables = lookup.subtables;

	for (let i = 0; i < infos.length; i++) {
		const markInfo = infos[i];
		if (!markInfo) continue;

		// Fast digest check before expensive glyph class lookup
		if (!digest.mayHave(markInfo.glyphId)) continue;

		if (
			getCachedGlyphClass(font, markInfo.glyphId, glyphClassCache) !==
			GlyphClass.Mark
		)
			continue;

		// Use pre-computed base index for O(1) lookup
		const ligIndex = baseIndexArray[i];
		if (ligIndex < 0) continue;

		const ligInfo = infos[ligIndex];
		if (!ligInfo) continue;

		// Must be a ligature
		if (
			getCachedGlyphClass(font, ligInfo.glyphId, glyphClassCache) !==
			GlyphClass.Ligature
		)
			continue;

		// Count intervening marks to determine component index
		let componentIndex = 0;
		for (let j = ligIndex + 1; j < i; j++) {
			const midInfo = infos[j];
			if (
				midInfo &&
				getCachedGlyphClass(font, midInfo.glyphId, glyphClassCache) ===
					GlyphClass.Mark
			) {
				componentIndex++;
			}
		}

		for (let s = 0; s < subtables.length; s++) {
			const subtable = subtables[s]!;
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
			const markPos = positions[i];
			const ligPos = positions[ligIndex];
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
	const digest = lookup.digest;
	const infos = buffer.infos;
	const positions = buffer.positions;
	const subtables = lookup.subtables;

	for (let i = 0; i < infos.length; i++) {
		const mark1Info = infos[i];
		if (!mark1Info) continue;

		// Fast digest check before expensive glyph class lookup
		if (!digest.mayHave(mark1Info.glyphId)) continue;

		if (
			getCachedGlyphClass(font, mark1Info.glyphId, glyphClassCache) !==
			GlyphClass.Mark
		)
			continue;

		// Find preceding mark (mark2) - must be immediately preceding
		let mark2Index = -1;
		if (i > 0) {
			const prevInfo = infos[i - 1];
			if (prevInfo) {
				const prevClass = getCachedGlyphClass(
					font,
					prevInfo.glyphId,
					glyphClassCache,
				);
				if (prevClass === GlyphClass.Mark) {
					mark2Index = i - 1;
				}
			}
		}

		if (mark2Index < 0) continue;
		const mark2Info = infos[mark2Index];
		if (!mark2Info) continue;

		for (let s = 0; s < subtables.length; s++) {
			const subtable = subtables[s]!;
			const mark1CoverageIndex = subtable.mark1Coverage.get(mark1Info.glyphId);
			const mark2CoverageIndex = subtable.mark2Coverage.get(mark2Info.glyphId);

			if (mark1CoverageIndex === null || mark2CoverageIndex === null) continue;

			const mark1Record = subtable.mark1Array.markRecords[mark1CoverageIndex];
			const mark2Record = subtable.mark2Array[mark2CoverageIndex];

			if (!mark1Record || !mark2Record) continue;

			const mark2Anchor = mark2Record.mark2Anchors[mark1Record.markClass];
			if (!mark2Anchor) continue;

			const mark1Anchor = mark1Record.markAnchor;
			const mark1Pos = positions[i];
			const mark2Pos = positions[mark2Index];
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
	glyphClassCache: GlyphClassCache,
	baseIndexArray: Int16Array,
	hasMarks: boolean,
): void {
	const infos = buffer.infos;
	const len = infos.length;
	const digest = lookup.digest;
	const subtables = lookup.subtables;

	// Pre-compute skip markers only if needed
	let skip: Uint8Array | null = null;
	if (lookup.flag !== 0 && font.gdef !== null) {
		skip = precomputeSkipMarkers(font, buffer, lookup.flag);
	}

	for (let i = 0; i < len; i++) {
		const info = infos[i];
		if (!info) continue;
		if (skip?.[i]) continue;
		// Fast digest check before expensive Coverage lookup
		if (!digest.mayHave(info.glyphId)) continue;

		for (let s = 0; s < subtables.length; s++) {
			const subtable = subtables[s]!;
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
				applyNestedPosLookups(
					font,
					buffer,
					i,
					lookupRecords,
					plan,
					glyphClassCache,
					baseIndexArray,
					hasMarks,
				);
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
	glyphClassCache: GlyphClassCache,
	baseIndexArray: Int16Array,
	hasMarks: boolean,
): void {
	const infos = buffer.infos;
	const len = infos.length;
	const digest = lookup.digest;
	const subtables = lookup.subtables;

	// Pre-compute skip markers only if needed
	let skip: Uint8Array | null = null;
	if (lookup.flag !== 0 && font.gdef !== null) {
		skip = precomputeSkipMarkers(font, buffer, lookup.flag);
	}

	for (let i = 0; i < len; i++) {
		const info = infos[i];
		if (!info) continue;
		if (skip?.[i]) continue;
		// Fast digest check before expensive Coverage lookup
		if (!digest.mayHave(info.glyphId)) continue;

		for (let s = 0; s < subtables.length; s++) {
			const subtable = subtables[s]!;
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
				applyNestedPosLookups(
					font,
					buffer,
					i,
					lookupRecords,
					plan,
					glyphClassCache,
					baseIndexArray,
					hasMarks,
				);
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

	for (let r = 0; r < ruleSet.length; r++) {
		const rule = ruleSet[r]!;
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

	for (let r = 0; r < classRuleSet.length; r++) {
		const rule = classRuleSet[r]!;
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
	const infos = buffer.infos;
	const coverages = subtable.coverages;
	let pos = startIndex;
	for (let c = 0; c < coverages.length; c++) {
		const coverage = coverages[c]!;
		while (
			pos < infos.length &&
			shouldSkipGlyph(font, infos[pos]?.glyphId, lookupFlag)
		) {
			pos++;
		}
		if (pos >= infos.length) return false;
		if (coverage.get(infos[pos]?.glyphId) === null) return false;
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

	for (let r = 0; r < chainRuleSet.length; r++) {
		const rule = chainRuleSet[r]!;
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

	for (let r = 0; r < chainClassRuleSet.length; r++) {
		const rule = chainClassRuleSet[r]!;
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
		const infos = buffer.infos;
		let inputEnd = startIndex + 1;
		for (let i = 0; i < rule.inputClasses.length; i++) {
			while (
				inputEnd < infos.length &&
				shouldSkipGlyph(font, infos[inputEnd]?.glyphId, lookupFlag)
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
	const infos = buffer.infos;
	// Check backtrack (in reverse order, before startIndex)
	let backtrackPos = startIndex - 1;
	const backtrackCoverages = subtable.backtrackCoverages;
	for (let b = 0; b < backtrackCoverages.length; b++) {
		const coverage = backtrackCoverages[b]!;
		while (
			backtrackPos >= 0 &&
			shouldSkipGlyph(font, infos[backtrackPos]?.glyphId, lookupFlag)
		) {
			backtrackPos--;
		}
		if (backtrackPos < 0) return false;
		if (coverage.get(infos[backtrackPos]?.glyphId) === null) return false;
		backtrackPos--;
	}

	// Check input sequence
	let inputPos = startIndex;
	const inputCoverages = subtable.inputCoverages;
	for (let i = 0; i < inputCoverages.length; i++) {
		const coverage = inputCoverages[i]!;
		while (
			inputPos < infos.length &&
			shouldSkipGlyph(font, infos[inputPos]?.glyphId, lookupFlag)
		) {
			inputPos++;
		}
		if (inputPos >= infos.length) return false;
		if (coverage.get(infos[inputPos]?.glyphId) === null) return false;
		inputPos++;
	}

	// Check lookahead
	let lookaheadPos = inputPos;
	const lookaheadCoverages = subtable.lookaheadCoverages;
	for (let l = 0; l < lookaheadCoverages.length; l++) {
		const coverage = lookaheadCoverages[l]!;
		while (
			lookaheadPos < infos.length &&
			shouldSkipGlyph(font, infos[lookaheadPos]?.glyphId, lookupFlag)
		) {
			lookaheadPos++;
		}
		if (lookaheadPos >= infos.length) return false;
		if (coverage.get(infos[lookaheadPos]?.glyphId) === null) return false;
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
	glyphClassCache: GlyphClassCache,
	baseIndexArray: Int16Array,
	hasMarks: boolean,
): void {
	const len = lookupRecords.length;
	if (len === 0) return;

	// Fast path for single record (common case)
	if (len === 1) {
		const record = lookupRecords[0]!;
		const lookupEntry = plan.gposLookupMap.get(record.lookupListIndex);
		if (!lookupEntry) return;
		const pos = startIndex + record.sequenceIndex;
		if (pos >= buffer.infos.length) return;
		applyGposLookup(
			font,
			buffer,
			lookupEntry.lookup,
			plan,
			glyphClassCache,
			baseIndexArray,
			hasMarks,
		);
		return;
	}

	// For multiple records, apply in descending sequence index order
	// Use selection approach for small arrays (typical case) to avoid alloc
	const applied = new Uint8Array(len);
	for (let round = 0; round < len; round++) {
		let maxIdx = -1;
		let maxSeq = -1;
		for (let i = 0; i < len; i++) {
			if (applied[i]) continue;
			const seq = lookupRecords[i]!.sequenceIndex;
			if (seq > maxSeq) {
				maxSeq = seq;
				maxIdx = i;
			}
		}
		if (maxIdx < 0) break;
		applied[maxIdx] = 1;

		const record = lookupRecords[maxIdx]!;
		const lookupEntry = plan.gposLookupMap.get(record.lookupListIndex);
		if (!lookupEntry) continue;
		const pos = startIndex + record.sequenceIndex;
		if (pos >= buffer.infos.length) continue;
		applyGposLookup(
			font,
			buffer,
			lookupEntry.lookup,
			plan,
			glyphClassCache,
			baseIndexArray,
			hasMarks,
		);
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
	for (let g = 0; g < glyphs.length; g++) {
		const glyph = glyphs[g]!;
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
	const infos = buffer.infos;
	let pos = startPos;
	for (let g = 0; g < glyphs.length; g++) {
		const glyph = glyphs[g]!;
		while (pos >= 0 && shouldSkipGlyph(font, infos[pos]?.glyphId, lookupFlag)) {
			pos--;
		}
		if (pos < 0) return false;
		if (infos[pos]?.glyphId !== glyph) return false;
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
	const infos = buffer.infos;
	let pos = startPos;
	for (let c = 0; c < classes.length; c++) {
		const cls = classes[c]!;
		while (
			pos < infos.length &&
			shouldSkipGlyph(font, infos[pos]?.glyphId, lookupFlag)
		) {
			pos++;
		}
		if (pos >= infos.length) return false;
		if (classDef.get(infos[pos]?.glyphId) !== cls) return false;
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
	const infos = buffer.infos;
	let pos = startPos;
	for (let c = 0; c < classes.length; c++) {
		const cls = classes[c]!;
		while (pos >= 0 && shouldSkipGlyph(font, infos[pos]?.glyphId, lookupFlag)) {
			pos--;
		}
		if (pos < 0) return false;
		if (classDef.get(infos[pos]?.glyphId) !== cls) return false;
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
	// Fast path: if no ignore flags are set, nothing to skip
	// This avoids GDEF lookup for the common case of lookupFlag === 0
	if ((lookupFlag & 0x000e) === 0 && (lookupFlag & 0xff00) === 0) return false;

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

	const chains = morx.chains;
	for (let c = 0; c < chains.length; c++) {
		const chain = chains[c]!;
		const chainSubtables = chain.subtables;
		for (let s = 0; s < chainSubtables.length; s++) {
			const subtable = chainSubtables[s]!;
			// Apply if subFeatureFlags match (default: all enabled)
			if ((chain.defaultFlags & subtable.subFeatureFlags) === 0) continue;

			switch (subtable.type) {
				case MorxSubtableType.NonContextual: {
					// Simple substitution (Type 4)
					const infos = buffer.infos;
					for (let i = 0; i < infos.length; i++) {
						const info = infos[i]!;
						const replacement = applyNonContextual(
							subtable as MorxNonContextualSubtable,
							info.glyphId,
						);
						if (replacement !== null) {
							info.glyphId = replacement;
						}
					}
					break;
				}

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
