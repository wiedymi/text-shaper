import type { GlyphInfo } from "../../types.ts";

/**
 * Hebrew character categories
 */
export const enum HebrewCategory {
	Other = 0,
	Letter = 1, // Regular letter
	Point = 2, // Niqqud (vowel point)
	Dagesh = 3, // Dagesh/Mapiq
	Shin = 4, // Shin/Sin dot
	Rafe = 5, // Rafe mark
	Accent = 6, // Cantillation marks
	Maqaf = 7, // Hebrew hyphen
	Punctuation = 8, // Punctuation
}

/**
 * Hebrew Unicode range
 */
const HEBREW_START = 0x0590;
const HEBREW_END = 0x05ff;
const HEBREW_EXTENDED_START = 0xfb1d;
const HEBREW_EXTENDED_END = 0xfb4f;

/**
 * Check if codepoint is Hebrew
 */
export function isHebrew(cp: number): boolean {
	return (cp >= HEBREW_START && cp <= HEBREW_END) ||
		(cp >= HEBREW_EXTENDED_START && cp <= HEBREW_EXTENDED_END);
}

/**
 * Get Hebrew category for a codepoint
 */
export function getHebrewCategory(cp: number): HebrewCategory {
	// Cantillation marks (0591-05AF)
	if (cp >= 0x0591 && cp <= 0x05af) return HebrewCategory.Accent;

	// Points (05B0-05BD)
	if (cp >= 0x05b0 && cp <= 0x05bd) return HebrewCategory.Point;

	// Maqaf
	if (cp === 0x05be) return HebrewCategory.Maqaf;

	// Rafe
	if (cp === 0x05bf) return HebrewCategory.Rafe;

	// Paseq, Sof Pasuq
	if (cp === 0x05c0 || cp === 0x05c3) return HebrewCategory.Punctuation;

	// Shin/Sin dot
	if (cp === 0x05c1 || cp === 0x05c2) return HebrewCategory.Shin;

	// Dagesh/Mapiq
	if (cp === 0x05bc) return HebrewCategory.Dagesh;

	// Meteg
	if (cp === 0x05bd) return HebrewCategory.Point;

	// Letters (05D0-05EA)
	if (cp >= 0x05d0 && cp <= 0x05ea) return HebrewCategory.Letter;

	// Final letters are handled the same
	if (cp >= 0x05f0 && cp <= 0x05f4) return HebrewCategory.Letter;

	// Extended forms (FB1D-FB4F)
	if (cp >= 0xfb1d && cp <= 0xfb4f) return HebrewCategory.Letter;

	if (isHebrew(cp)) return HebrewCategory.Other;
	return HebrewCategory.Other;
}

/**
 * Set up masks for Hebrew shaping
 * Hebrew is relatively simple - mainly RTL with marks
 */
export function setupHebrewMasks(infos: GlyphInfo[]): void {
	// Hebrew shaping primarily relies on:
	// 1. Mark positioning (handled by GPOS)
	// 2. RTL reordering (handled by main shaper)

	// Group characters with their base letters
	let baseIndex = 0;

	for (let i = 0; i < infos.length; i++) {
		const info = infos[i];
		if (!info) continue;

		const cat = getHebrewCategory(info.codepoint);

		// Letters start new clusters
		if (cat === HebrewCategory.Letter) {
			baseIndex = i;
		}

		// Store base index for mark attachment
		info.mask = (info.mask & 0xffff0000) | (baseIndex & 0xffff);
	}
}
