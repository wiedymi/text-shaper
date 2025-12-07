import type { Font } from "../font/font.ts";
import { getGlyphClass } from "../font/tables/gdef.ts";
import { getKernValue } from "../font/tables/kern.ts";
import type { GlyphId, GlyphInfo, GlyphPosition } from "../types.ts";
import { GlyphClass } from "../types.ts";
import { getCombiningClass } from "../unicode/normalize.ts";

/**
 * Quick check if text has any potential marks based on codepoints.
 * Uses fast O(1) checks for common non-mark ranges.
 */
function hasAnyMarks(infos: GlyphInfo[]): boolean {
	for (let i = 0; i < infos.length; i++) {
		const cp = infos[i]!.codepoint;
		// Fast check: most scripts have no combining marks
		// Only check getCombiningClass for potential mark ranges
		if (cp >= 0x0300 && cp < 0x0370) return true; // Latin combining
		if (cp >= 0x0591 && cp < 0x05c8) return true; // Hebrew
		if (cp >= 0x0610 && cp < 0x0900) return true; // Arabic and extended
		if (cp >= 0x093c && cp < 0x0970) return true; // Devanagari marks
		if (cp >= 0x09bc && cp < 0x09ff) return true; // Bengali marks
		if (cp >= 0x0a3c && cp < 0x0a75) return true; // Gurmukhi marks
		if (cp >= 0x0abc && cp < 0x0aff) return true; // Gujarati marks
		if (cp >= 0x0b3c && cp < 0x0b70) return true; // Oriya marks
		if (cp >= 0x0bcd && cp < 0x0bd8) return true; // Tamil marks
		if (cp >= 0x0c4d && cp < 0x0c70) return true; // Telugu marks
		if (cp >= 0x0cbc && cp < 0x0cff) return true; // Kannada marks
		if (cp >= 0x0d4d && cp < 0x0d70) return true; // Malayalam marks
		if (cp >= 0x0dca && cp < 0x0df5) return true; // Sinhala marks
		if (cp >= 0x0e31 && cp < 0x0e50) return true; // Thai marks
		if (cp >= 0x0eb1 && cp < 0x0ed0) return true; // Lao marks
		if (cp >= 0x0f18 && cp < 0x0f88) return true; // Tibetan marks
		if (cp >= 0x1037 && cp < 0x103b) return true; // Myanmar marks
		if (cp >= 0x1ab0 && cp < 0x1b00) return true; // Combining Extended
		if (cp >= 0x1dc0 && cp < 0x1e00) return true; // Combining Supplement
		if (cp >= 0x302a && cp < 0x3030) return true; // Hangul combining
		if (cp >= 0x3099 && cp < 0x309b) return true; // Kana voicing
		if (cp >= 0xfe20 && cp < 0xfe30) return true; // Combining Half Marks
	}
	return false;
}

/**
 * Fallback mark positioning when GPOS is not available
 * Uses combining class information to position marks
 */
export function applyFallbackMarkPositioning(
	font: Font,
	infos: GlyphInfo[],
	positions: GlyphPosition[],
): void {
	// Fast path: skip entirely if no marks detected
	if (!hasAnyMarks(infos)) return;

	// Cache glyph classes to avoid repeated GDEF lookups
	const glyphClassCache = new Map<GlyphId, number>();
	const getClass = (glyphId: GlyphId): number => {
		let cls = glyphClassCache.get(glyphId);
		if (cls === undefined) {
			cls = font.gdef ? getGlyphClass(font.gdef, glyphId) : 0;
			glyphClassCache.set(glyphId, cls);
		}
		return cls;
	};

	for (let i = 0; i < infos.length; i++) {
		const info = infos[i]!;
		const pos = positions[i]!;

		const glyphClass = getClass(info.glyphId);
		const ccc = getCombiningClass(info.codepoint);

		// Skip if not a mark
		if (glyphClass !== GlyphClass.Mark && ccc === 0) continue;

		// Find the base glyph
		let baseIndex = -1;
		for (let j = i - 1; j >= 0; j--) {
			const prevInfo = infos[j]!;
			const prevClass = getClass(prevInfo.glyphId);
			const prevCcc = getCombiningClass(prevInfo.codepoint);

			if (prevClass === GlyphClass.Base || (prevClass === 0 && prevCcc === 0)) {
				baseIndex = j;
				break;
			}
		}

		if (baseIndex < 0) continue;

		const baseInfo = infos[baseIndex]!;
		const basePos = positions[baseIndex]!;

		// Get base glyph metrics
		const baseAdvance = font.advanceWidth(baseInfo.glyphId);

		// Position mark relative to base based on combining class
		// This is a simplified heuristic - real mark positioning uses anchors
		positionMarkFallback(font, info, pos, baseInfo, basePos, baseAdvance, ccc);

		// Mark has zero advance (already accounted for in base)
		pos.xAdvance = 0;
		pos.yAdvance = 0;
	}
}

function positionMarkFallback(
	font: Font,
	markInfo: GlyphInfo,
	markPos: GlyphPosition,
	_baseInfo: GlyphInfo,
	basePos: GlyphPosition,
	baseAdvance: number,
	ccc: number,
): void {
	const markAdvance = font.advanceWidth(markInfo.glyphId);
	const unitsPerEm = font.unitsPerEm;

	// Default: center mark over base
	let xOffset = (baseAdvance - markAdvance) / 2;
	let yOffset = 0;

	// Position based on combining class
	if (ccc >= 200 && ccc <= 240) {
		// Above marks (ccc 230 is common for above)
		yOffset = unitsPerEm * 0.7; // 70% of em height
		xOffset = (baseAdvance - markAdvance) / 2;
	} else if (ccc >= 202 && ccc <= 220) {
		// Below marks (ccc 220 is common for below)
		yOffset = -unitsPerEm * 0.15;
		xOffset = (baseAdvance - markAdvance) / 2;
	} else if (ccc === 1) {
		// Overlay marks
		xOffset = (baseAdvance - markAdvance) / 2;
		yOffset = unitsPerEm * 0.3;
	} else if (ccc >= 7 && ccc <= 9) {
		// Nukta, virama (below consonant)
		yOffset = -unitsPerEm * 0.1;
		xOffset = (baseAdvance - markAdvance) / 2;
	} else if (ccc >= 10 && ccc <= 35) {
		// Hebrew/Arabic vowels - specific positioning
		if (ccc <= 22) {
			// Hebrew below vowels
			yOffset = -unitsPerEm * 0.2;
		} else {
			// Arabic marks
			yOffset = ccc < 30 ? -unitsPerEm * 0.15 : unitsPerEm * 0.6;
		}
		xOffset = (baseAdvance - markAdvance) / 2;
	}

	// Apply offset relative to base position
	markPos.xOffset = basePos.xOffset + xOffset - baseAdvance;
	markPos.yOffset = basePos.yOffset + yOffset;
}

/**
 * Apply fallback kerning using kern table
 */
export function applyFallbackKerning(
	font: Font,
	infos: GlyphInfo[],
	positions: GlyphPosition[],
): void {
	const kern = font.kern;
	if (!kern) return;

	for (let i = 0; i < infos.length - 1; i++) {
		const info1 = infos[i];
		const info2 = infos[i + 1];
		if (!info1 || !info2) continue;

		const pos1 = positions[i];
		if (!pos1) continue;

		// Skip marks
		const class1 = font.gdef ? getGlyphClass(font.gdef, info1.glyphId) : 0;
		const class2 = font.gdef ? getGlyphClass(font.gdef, info2.glyphId) : 0;
		if (class1 === GlyphClass.Mark || class2 === GlyphClass.Mark) continue;

		// Get kerning from kern table
		const kernValue = getKernValueFromTable(font, info1.glyphId, info2.glyphId);
		if (kernValue !== 0) {
			pos1.xAdvance += kernValue;
		}
	}
}

function getKernValueFromTable(
	font: Font,
	left: GlyphId,
	right: GlyphId,
): number {
	const kern = font.kern;
	if (!kern) return 0;

	return getKernValue(kern, left, right);
}

/**
 * Recategorize combining marks for proper processing
 * Some scripts need marks to be processed in specific order
 */
export function recategorizeCombiningMarks(
	_font: Font,
	infos: GlyphInfo[],
): void {
	// For Hebrew, Arabic, and other scripts, ensure marks are in canonical order
	// This is typically handled by normalization, but we do a final check here

	let i = 0;
	while (i < infos.length) {
		const info = infos[i];
		if (!info) {
			i++;
			continue;
		}

		const ccc = getCombiningClass(info.codepoint);
		if (ccc === 0) {
			i++;
			continue;
		}

		// Find extent of combining sequence
		let j = i + 1;
		while (j < infos.length) {
			const nextInfo = infos[j];
			if (!nextInfo) break;
			const nextCcc = getCombiningClass(nextInfo.codepoint);
			if (nextCcc === 0) break;
			j++;
		}

		// Sort combining marks by CCC (stable sort)
		if (j - i > 1) {
			const marks = infos.slice(i, j);
			marks.sort((a, b) => {
				const cccA = getCombiningClass(a.codepoint);
				const cccB = getCombiningClass(b.codepoint);
				return cccA - cccB;
			});
			for (let k = 0; k < marks.length; k++) {
				const mark = marks[k]!;
				infos[i + k] = mark;
			}
		}

		i = j;
	}
}
