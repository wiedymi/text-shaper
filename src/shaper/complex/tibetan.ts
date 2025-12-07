import type { GlyphInfo } from "../../types.ts";

/**
 * Tibetan shaper
 * Handles Tibetan script complex text layout
 *
 * Tibetan is an Indic-derived script with:
 * - Base consonants (Ka, Kha, Ga, etc.)
 * - Subjoined consonants (below base)
 * - Vowel signs (above/below)
 * - Head letters (pre-composed stacks)
 * - Various combining marks
 */

/**
 * Tibetan character categories
 */
export enum TibetanCategory {
	Other = 0,
	Base = 1, // Base consonants (Ka-A)
	Subjoined = 2, // Subjoined consonants (0F90-0FBC)
	VowelAbove = 3, // Vowel signs above (0F71-0F7D, 0F80-0F83)
	VowelBelow = 4, // Vowel signs below (0F71, 0F7A-0F7D)
	ASubjoin = 5, // Subjoined A (0FB0)
	HeadMark = 6, // Head marks (0F39)
	Anusvara = 7, // Anusvara/Candrabindu (0F7E, 0F7F, 0F82, 0F83)
	Halanta = 8, // Halanta (0F84)
	Digit = 9, // Digits (0F20-0F33)
	Symbol = 10, // Symbols and punctuation
	ZWNJ = 11, // Zero Width Non-Joiner
	ZWJ = 12, // Zero Width Joiner
}

/**
 * Classify Tibetan codepoint
 */
export function getTibetanCategory(cp: number): TibetanCategory {
	// Control characters
	if (cp === 0x200c) return TibetanCategory.ZWNJ;
	if (cp === 0x200d) return TibetanCategory.ZWJ;

	// Not Tibetan
	if (cp < 0x0f00 || cp > 0x0fff) return TibetanCategory.Other;

	// Digits
	if (cp >= 0x0f20 && cp <= 0x0f33) return TibetanCategory.Digit;

	// Base consonants (0F40-0F6C)
	if (cp >= 0x0f40 && cp <= 0x0f6c) return TibetanCategory.Base;

	// Subjoined consonants (0F90-0FBC)
	if (cp >= 0x0f90 && cp <= 0x0fbc) {
		if (cp === 0x0fb0) return TibetanCategory.ASubjoin; // Subjoined A
		return TibetanCategory.Subjoined;
	}

	// Vowel signs
	if (cp === 0x0f71) return TibetanCategory.VowelBelow; // AA
	if (cp >= 0x0f72 && cp <= 0x0f7d) {
		// I, II, U, UU, Vocalic R, Vocalic RR, E, EE, O, OO, reversed I
		if (cp >= 0x0f7a && cp <= 0x0f7d) return TibetanCategory.VowelBelow;
		return TibetanCategory.VowelAbove;
	}
	if (cp >= 0x0f80 && cp <= 0x0f83) {
		if (cp === 0x0f82 || cp === 0x0f83) return TibetanCategory.Anusvara;
		return TibetanCategory.VowelAbove;
	}

	// Anusvara and Visarga
	if (cp === 0x0f7e || cp === 0x0f7f) return TibetanCategory.Anusvara;

	// Halanta (Srog med)
	if (cp === 0x0f84) return TibetanCategory.Halanta;

	// Head mark (Tsa phru)
	if (cp === 0x0f39) return TibetanCategory.HeadMark;

	// Symbols and punctuation (0F00-0F1F, 0F34-0F3F)
	if (cp >= 0x0f00 && cp <= 0x0f1f) return TibetanCategory.Symbol;
	if (cp >= 0x0f34 && cp <= 0x0f3f) return TibetanCategory.Symbol;

	return TibetanCategory.Other;
}

/**
 * Tibetan syllable structure
 */
interface TibetanSyllable {
	start: number;
	end: number;
	base: number;
}

/**
 * Find Tibetan syllable boundaries
 */
function findTibetanSyllables(infos: GlyphInfo[]): TibetanSyllable[] {
	const syllables: TibetanSyllable[] = [];
	const n = infos.length;
	if (n === 0) return syllables;

	let i = 0;

	while (i < n) {
		const start = i;
		let base = -1;

		// Find base consonant
		const cat = getTibetanCategory(infos[i]?.codepoint ?? 0);
		if (cat === TibetanCategory.Base) {
			base = i;
			i++;
		} else if (
			cat === TibetanCategory.Digit ||
			cat === TibetanCategory.Symbol
		) {
			// Non-base characters form their own syllable
			i++;
			syllables.push({ start, end: i, base: start });
			continue;
		} else {
			// Skip other characters
			i++;
			syllables.push({ start, end: i, base: start });
			continue;
		}

		// Consume subjoined consonants (stacked below)
		while (i < n) {
			const subCat = getTibetanCategory(infos[i]?.codepoint ?? 0);
			if (
				subCat === TibetanCategory.Subjoined ||
				subCat === TibetanCategory.ASubjoin ||
				subCat === TibetanCategory.Halanta ||
				subCat === TibetanCategory.ZWJ ||
				subCat === TibetanCategory.ZWNJ
			) {
				i++;
			} else {
				break;
			}
		}

		// Consume vowel signs (above and below)
		while (i < n) {
			const vowelCat = getTibetanCategory(infos[i]?.codepoint ?? 0);
			if (
				vowelCat === TibetanCategory.VowelAbove ||
				vowelCat === TibetanCategory.VowelBelow
			) {
				i++;
			} else {
				break;
			}
		}

		// Consume anusvara/visarga
		while (i < n) {
			const markCat = getTibetanCategory(infos[i]?.codepoint ?? 0);
			if (markCat === TibetanCategory.Anusvara) {
				i++;
			} else {
				break;
			}
		}

		// Consume head marks
		while (i < n) {
			const headCat = getTibetanCategory(infos[i]?.codepoint ?? 0);
			if (headCat === TibetanCategory.HeadMark) {
				i++;
			} else {
				break;
			}
		}

		syllables.push({ start, end: i, base });
	}

	return syllables;
}

/**
 * Tibetan feature masks
 */
export const TibetanFeatureMask = {
	ccmp: 0x0001, // Glyph composition/decomposition
	locl: 0x0002, // Localized forms
	abvs: 0x0004, // Above-base substitutions
	blws: 0x0008, // Below-base substitutions
	calt: 0x0010, // Contextual alternates
	liga: 0x0020, // Standard ligatures
} as const;

/**
 * Set up masks for Tibetan shaping
 */
export function setupTibetanMasks(infos: GlyphInfo[]): void {
	const syllables = findTibetanSyllables(infos);

	for (let s = 0; s < syllables.length; s++) {
		const syllable = syllables[s]!;
		for (let i = syllable.start; i < syllable.end; i++) {
			const info = infos[i];
			if (!info) continue;

			// Store syllable index
			info.mask = (info.mask & 0x0000ffff) | ((s & 0xffff) << 16);

			const cat = getTibetanCategory(info.codepoint);

			// All glyphs get ccmp and locl
			info.mask |= TibetanFeatureMask.ccmp | TibetanFeatureMask.locl;

			// Subjoined consonants get blws
			if (
				cat === TibetanCategory.Subjoined ||
				cat === TibetanCategory.ASubjoin
			) {
				info.mask |= TibetanFeatureMask.blws;
			}

			// Vowels above get abvs
			if (
				cat === TibetanCategory.VowelAbove ||
				cat === TibetanCategory.Anusvara
			) {
				info.mask |= TibetanFeatureMask.abvs;
			}

			// Vowels below get blws
			if (cat === TibetanCategory.VowelBelow) {
				info.mask |= TibetanFeatureMask.blws;
			}

			// All characters can participate in calt and liga
			info.mask |= TibetanFeatureMask.calt | TibetanFeatureMask.liga;
		}
	}
}

/**
 * Get default Tibetan features in order
 */
export function getTibetanFeatures(): string[] {
	return [
		"ccmp", // Character composition/decomposition
		"locl", // Localized forms
		"abvs", // Above-base substitutions
		"blws", // Below-base substitutions
		"calt", // Contextual alternates
		"liga", // Standard ligatures
	];
}

/**
 * Check if script uses Tibetan shaper
 */
export function usesTibetan(script: string): boolean {
	return script === "tibt" || script === "Tibt";
}
