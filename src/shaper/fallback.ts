import type { Font } from "../font/font.ts";
import { getGlyphClass } from "../font/tables/gdef.ts";
import { getKernValue } from "../font/tables/kern.ts";
import type { GlyphId, GlyphInfo, GlyphPosition } from "../types.ts";
import { GlyphClass } from "../types.ts";
import { getCombiningClass } from "../unicode/normalize.ts";

/**
 * Fallback mark positioning when GPOS is not available
 * Uses combining class information to position marks
 */
export function applyFallbackMarkPositioning(
	font: Font,
	infos: GlyphInfo[],
	positions: GlyphPosition[],
): void {
	for (let i = 0; i < infos.length; i++) {
		const info = infos[i];
		const pos = positions[i];
		if (!info || !pos) continue;

		const glyphClass = font.gdef ? getGlyphClass(font.gdef, info.glyphId) : 0;
		const ccc = getCombiningClass(info.codepoint);

		// Skip if not a mark
		if (glyphClass !== GlyphClass.Mark && ccc === 0) continue;

		// Find the base glyph
		let baseIndex = -1;
		for (let j = i - 1; j >= 0; j--) {
			const prevInfo = infos[j];
			if (!prevInfo) continue;

			const prevClass = font.gdef
				? getGlyphClass(font.gdef, prevInfo.glyphId)
				: 0;
			const prevCcc = getCombiningClass(prevInfo.codepoint);

			if (prevClass === GlyphClass.Base || (prevClass === 0 && prevCcc === 0)) {
				baseIndex = j;
				break;
			}
		}

		if (baseIndex < 0) continue;

		const baseInfo = infos[baseIndex];
		const basePos = positions[baseIndex];
		if (!baseInfo || !basePos) continue;

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
