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

	const plan = createShapePlan(font, script, language, direction, features);

	const glyphBuffer = new GlyphBuffer();
	glyphBuffer.direction = buffer.direction;
	glyphBuffer.script = script;
	glyphBuffer.language = language;

	// Convert codepoints to initial glyph infos
	const infos: GlyphInfo[] = [];
	for (let i = 0; i < buffer.codepoints.length; i++) {
		const codepoint = buffer.codepoints[i]!;
		const cluster = buffer.clusters[i]!;
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
	for (let i = 0; i < buffer.infos.length; i++) {
		const info = buffer.infos[i]!;
		if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;

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
		const info = buffer.infos[i]!;
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

			// Replace with sequence
			info.glyphId = sequence[0]!;

			// Insert remaining glyphs
			for (let j = 1; j < sequence.length; j++) {
				const newInfo: GlyphInfo = {
					glyphId: sequence[j]!,
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
	for (let i = 0; i < buffer.infos.length; i++) {
		const info = buffer.infos[i]!;
		if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;

		for (const subtable of lookup.subtables) {
			const coverageIndex = subtable.coverage.get(info.glyphId);
			if (coverageIndex === null) continue;

			const alternateSet = subtable.alternateSets[coverageIndex];
			if (!alternateSet || alternateSet.length === 0) continue;

			// Use first alternate by default
			info.glyphId = alternateSet[0]!;
			break;
		}
	}
}

function applyLigatureSubstLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: LigatureSubstLookup,
): void {
	let i = 0;
	while (i < buffer.infos.length) {
		const info = buffer.infos[i]!;
		if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) {
			i++;
			continue;
		}

		// Collect matchable glyphs (skipping ignored ones)
		const matchIndices: number[] = [i];
		const matchGlyphs: GlyphId[] = [info.glyphId];

		for (
			let j = i + 1;
			j < buffer.infos.length && matchGlyphs.length < 16;
			j++
		) {
			const nextInfo = buffer.infos[j]!;
			if (shouldSkipGlyph(font, nextInfo.glyphId, lookup.flag)) continue;
			matchIndices.push(j);
			matchGlyphs.push(nextInfo.glyphId);
		}

		const result = applyLigatureSubst(lookup, matchGlyphs, 0);
		if (result) {
			// Replace first glyph with ligature
			info.glyphId = result.ligatureGlyph;

			// Merge clusters and remove consumed glyphs
			const indicesToRemove: number[] = [];
			for (let k = 1; k < result.consumed; k++) {
				const idx = matchIndices[k];
				if (idx !== undefined) {
					info.cluster = Math.min(info.cluster, buffer.infos[idx]?.cluster);
					indicesToRemove.push(idx);
				}
			}

			// Remove in reverse order to maintain indices
			for (let k = indicesToRemove.length - 1; k >= 0; k--) {
				buffer.removeRange(indicesToRemove[k]!, indicesToRemove[k]! + 1);
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
	// Context substitution - matches input sequence and applies nested lookups
	for (let i = 0; i < buffer.infos.length; i++) {
		const info = buffer.infos[i]!;
		if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;

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
	for (let i = 0; i < buffer.infos.length; i++) {
		const info = buffer.infos[i]!;
		if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;

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
		const info = buffer.infos[i]!;
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
	const sorted = [...lookupRecords].sort(
		(a, b) => b.sequenceIndex - a.sequenceIndex,
	);

	for (const record of sorted) {
		const lookupEntry = plan.gsubLookups.find(
			(l) => l.index === record.lookupListIndex,
		);
		if (!lookupEntry) continue;

		// Apply at the specific position
		const pos = startIndex + record.sequenceIndex;
		if (pos >= buffer.infos.length) continue;

		// For single subst, apply directly
		if (lookupEntry.lookup.type === GsubLookupType.Single) {
			const replacement = applySingleSubst(
				lookupEntry.lookup as SingleSubstLookup,
				buffer.infos[pos]?.glyphId,
			);
			if (replacement !== null) {
				buffer.infos[pos]!.glyphId = replacement;
			}
		}
	}
}

// GPOS application

function initializePositions(face: Face, buffer: GlyphBuffer): void {
	for (let i = 0; i < buffer.infos.length; i++) {
		const glyphId = buffer.infos[i]?.glyphId;
		// Use Face.advanceWidth to include variable font deltas
		const advance = face.advanceWidth(glyphId);
		buffer.setAdvance(i, advance, 0);
	}
}

function applyGpos(font: Font, buffer: GlyphBuffer, plan: ShapePlan): void {
	for (const { lookup } of plan.gposLookups) {
		applyGposLookup(font, buffer, lookup, plan);
	}
}

function applyGposLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: AnyGposLookup,
	plan: ShapePlan,
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
			applyMarkBasePosLookup(font, buffer, lookup);
			break;
		case GposLookupType.MarkToLigature:
			applyMarkLigaturePosLookup(font, buffer, lookup);
			break;
		case GposLookupType.MarkToMark:
			applyMarkMarkPosLookup(font, buffer, lookup);
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
	for (let i = 0; i < buffer.infos.length; i++) {
		const info = buffer.infos[i]!;
		const pos = buffer.positions[i]!;
		if (shouldSkipGlyph(font, info.glyphId, lookup.flag)) continue;

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
	}
}

function applyPairPosLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: PairPosLookup,
): void {
	for (let i = 0; i < buffer.infos.length - 1; i++) {
		const info1 = buffer.infos[i]!;
		if (shouldSkipGlyph(font, info1.glyphId, lookup.flag)) continue;

		// Find next non-skipped glyph
		let j = i + 1;
		while (
			j < buffer.infos.length &&
			shouldSkipGlyph(font, buffer.infos[j]?.glyphId, lookup.flag)
		) {
			j++;
		}
		if (j >= buffer.infos.length) break;

		const info2 = buffer.infos[j]!;
		const kern = getKerning(lookup, info1.glyphId, info2.glyphId);
		if (kern) {
			buffer.positions[i]!.xAdvance += kern.xAdvance1;
			buffer.positions[j]!.xAdvance += kern.xAdvance2;
		}
	}
}

function applyCursivePosLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: CursivePosLookup,
): void {
	// Cursive attachment - connect exit anchor of one glyph to entry anchor of next
	for (let i = 0; i < buffer.infos.length - 1; i++) {
		const info1 = buffer.infos[i]!;
		if (shouldSkipGlyph(font, info1.glyphId, lookup.flag)) continue;

		// Find next non-skipped glyph
		let j = i + 1;
		while (
			j < buffer.infos.length &&
			shouldSkipGlyph(font, buffer.infos[j]?.glyphId, lookup.flag)
		) {
			j++;
		}
		if (j >= buffer.infos.length) break;

		const info2 = buffer.infos[j]!;

		for (const subtable of lookup.subtables) {
			const exitIndex = subtable.coverage.get(info1.glyphId);
			const entryIndex = subtable.coverage.get(info2.glyphId);

			if (exitIndex === null || entryIndex === null) continue;

			const exitRecord = subtable.entryExitRecords[exitIndex];
			const entryRecord = subtable.entryExitRecords[entryIndex];

			if (!exitRecord?.exitAnchor || !entryRecord?.entryAnchor) continue;

			// Calculate offset to align anchors
			const exitAnchor = exitRecord.exitAnchor;
			const entryAnchor = entryRecord.entryAnchor;

			// Adjust position of second glyph
			const pos2 = buffer.positions[j]!;
			pos2.yOffset = exitAnchor.yCoordinate - entryAnchor.yCoordinate;

			break;
		}
	}
}

function applyMarkBasePosLookup(
	font: Font,
	buffer: GlyphBuffer,
	lookup: MarkBasePosLookup,
): void {
	for (let i = 0; i < buffer.infos.length; i++) {
		const markInfo = buffer.infos[i]!;

		// Must be a mark glyph
		if (getGlyphClass(font.gdef, markInfo.glyphId) !== GlyphClass.Mark)
			continue;

		// Find preceding base glyph
		let baseIndex = -1;
		for (let j = i - 1; j >= 0; j--) {
			const prevClass = getGlyphClass(font.gdef, buffer.infos[j]?.glyphId);
			if (prevClass === GlyphClass.Base || prevClass === 0) {
				baseIndex = j;
				break;
			}
			// Skip marks
			if (prevClass === GlyphClass.Mark) continue;
			// Stop at ligature
			if (prevClass === GlyphClass.Ligature) {
				baseIndex = j;
				break;
			}
		}

		if (baseIndex < 0) continue;
		const baseInfo = buffer.infos[baseIndex]!;

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
			const markPos = buffer.positions[i]!;
			const basePos = buffer.positions[baseIndex]!;

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
): void {
	for (let i = 0; i < buffer.infos.length; i++) {
		const markInfo = buffer.infos[i]!;

		if (getGlyphClass(font.gdef, markInfo.glyphId) !== GlyphClass.Mark)
			continue;

		// Find preceding ligature
		let ligIndex = -1;
		let componentIndex = 0; // Which component of the ligature

		for (let j = i - 1; j >= 0; j--) {
			const prevClass = getGlyphClass(font.gdef, buffer.infos[j]?.glyphId);
			if (prevClass === GlyphClass.Ligature) {
				ligIndex = j;
				break;
			}
			if (prevClass === GlyphClass.Mark) {
				componentIndex++;
				continue;
			}
			break;
		}

		if (ligIndex < 0) continue;
		const ligInfo = buffer.infos[ligIndex]!;

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
			const markPos = buffer.positions[i]!;
			const ligPos = buffer.positions[ligIndex]!;

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
): void {
	for (let i = 0; i < buffer.infos.length; i++) {
		const mark1Info = buffer.infos[i]!;

		if (getGlyphClass(font.gdef, mark1Info.glyphId) !== GlyphClass.Mark)
			continue;

		// Find preceding mark (mark2)
		let mark2Index = -1;
		for (let j = i - 1; j >= 0; j--) {
			const prevClass = getGlyphClass(font.gdef, buffer.infos[j]?.glyphId);
			if (prevClass === GlyphClass.Mark) {
				mark2Index = j;
				break;
			}
			// Stop at non-mark
			break;
		}

		if (mark2Index < 0) continue;
		const mark2Info = buffer.infos[mark2Index]!;

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
			const mark1Pos = buffer.positions[i]!;
			const mark2Pos = buffer.positions[mark2Index]!;

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
		const info = buffer.infos[i]!;
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
		const info = buffer.infos[i]!;
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
	const sorted = [...lookupRecords].sort(
		(a, b) => b.sequenceIndex - a.sequenceIndex,
	);

	for (const record of sorted) {
		const lookupEntry = plan.gposLookups.find(
			(l) => l.index === record.lookupListIndex,
		);
		if (!lookupEntry) continue;

		// Apply at the specific position
		const pos = startIndex + record.sequenceIndex;
		if (pos >= buffer.infos.length) continue;

		// Apply the lookup directly
		applyGposLookup(font, buffer, lookupEntry.lookup, plan);
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
					for (let i = 0; i < buffer.infos.length; i++) {
						const replacement = applyNonContextual(
							subtable as MorxNonContextualSubtable,
							buffer.infos[i]?.glyphId,
						);
						if (replacement !== null) {
							buffer.infos[i]!.glyphId = replacement;
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
