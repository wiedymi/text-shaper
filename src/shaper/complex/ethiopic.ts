import type { GlyphInfo } from "../../types.ts";

/**
 * Ethiopic shaper
 * Handles Ethiopic/Ge'ez script
 *
 * Ethiopic is an abugida (alphasyllabary) where:
 * - Base consonants have inherent vowel 'a'
 * - Vowels modify the base consonant shape
 * - No joining behavior (unlike Arabic)
 * - Left-to-right direction
 *
 * Key features:
 * - Syllable-based writing (CV or CVC)
 * - Labialization marks (W modifier)
 * - Extended character sets for various languages
 */

/**
 * Ethiopic character categories
 */
export enum EthiopicCategory {
	Other = 0,
	Syllable = 1, // Main syllabic characters (consonant + vowel)
	Digit = 2, // Ethiopic digits
	Punctuation = 3, // Ethiopic punctuation
	Modifier = 4, // Combining marks
	ToneMark = 5, // Tonal letters
}

/**
 * Get Ethiopic category for codepoint
 */
export function getEthiopicCategory(cp: number): EthiopicCategory {
	// Main Ethiopic block (1200-137F)
	if (cp >= 0x1200 && cp <= 0x137f) {
		// Syllables (1200-1248, 124A-124D, 1250-1256, etc.)
		if (cp >= 0x1200 && cp <= 0x1248) return EthiopicCategory.Syllable;
		if (cp >= 0x124a && cp <= 0x124d) return EthiopicCategory.Syllable;
		if (cp >= 0x1250 && cp <= 0x1256) return EthiopicCategory.Syllable;
		if (cp === 0x1258) return EthiopicCategory.Syllable;
		if (cp >= 0x125a && cp <= 0x125d) return EthiopicCategory.Syllable;
		if (cp >= 0x1260 && cp <= 0x1288) return EthiopicCategory.Syllable;
		if (cp >= 0x128a && cp <= 0x128d) return EthiopicCategory.Syllable;
		if (cp >= 0x1290 && cp <= 0x12b0) return EthiopicCategory.Syllable;
		if (cp >= 0x12b2 && cp <= 0x12b5) return EthiopicCategory.Syllable;
		if (cp >= 0x12b8 && cp <= 0x12be) return EthiopicCategory.Syllable;
		if (cp === 0x12c0) return EthiopicCategory.Syllable;
		if (cp >= 0x12c2 && cp <= 0x12c5) return EthiopicCategory.Syllable;
		if (cp >= 0x12c8 && cp <= 0x12d6) return EthiopicCategory.Syllable;
		if (cp >= 0x12d8 && cp <= 0x1310) return EthiopicCategory.Syllable;
		if (cp >= 0x1312 && cp <= 0x1315) return EthiopicCategory.Syllable;
		if (cp >= 0x1318 && cp <= 0x135a) return EthiopicCategory.Syllable;

		// Combining marks (135D-135F)
		if (cp >= 0x135d && cp <= 0x135f) return EthiopicCategory.Modifier;

		// Punctuation (1360-1368)
		if (cp >= 0x1360 && cp <= 0x1368) return EthiopicCategory.Punctuation;

		// Digits (1369-137C)
		if (cp >= 0x1369 && cp <= 0x137c) return EthiopicCategory.Digit;

		return EthiopicCategory.Other;
	}

	// Ethiopic Supplement (1380-139F)
	if (cp >= 0x1380 && cp <= 0x139f) {
		if (cp >= 0x1380 && cp <= 0x1399) return EthiopicCategory.Syllable;
		return EthiopicCategory.Other;
	}

	// Ethiopic Extended (2D80-2DDF)
	if (cp >= 0x2d80 && cp <= 0x2ddf) {
		if (cp >= 0x2d80 && cp <= 0x2d96) return EthiopicCategory.Syllable;
		if (cp >= 0x2da0 && cp <= 0x2da6) return EthiopicCategory.Syllable;
		if (cp >= 0x2da8 && cp <= 0x2dae) return EthiopicCategory.Syllable;
		if (cp >= 0x2db0 && cp <= 0x2db6) return EthiopicCategory.Syllable;
		if (cp >= 0x2db8 && cp <= 0x2dbe) return EthiopicCategory.Syllable;
		if (cp >= 0x2dc0 && cp <= 0x2dc6) return EthiopicCategory.Syllable;
		if (cp >= 0x2dc8 && cp <= 0x2dce) return EthiopicCategory.Syllable;
		if (cp >= 0x2dd0 && cp <= 0x2dd6) return EthiopicCategory.Syllable;
		if (cp >= 0x2dd8 && cp <= 0x2dde) return EthiopicCategory.Syllable;
		return EthiopicCategory.Other;
	}

	// Ethiopic Extended-A (AB00-AB2F)
	if (cp >= 0xab00 && cp <= 0xab2f) {
		if (cp >= 0xab00 && cp <= 0xab06) return EthiopicCategory.Syllable;
		if (cp >= 0xab09 && cp <= 0xab0e) return EthiopicCategory.Syllable;
		if (cp >= 0xab11 && cp <= 0xab16) return EthiopicCategory.Syllable;
		if (cp >= 0xab20 && cp <= 0xab26) return EthiopicCategory.Syllable;
		if (cp >= 0xab28 && cp <= 0xab2e) return EthiopicCategory.Syllable;
		return EthiopicCategory.Other;
	}

	// Ethiopic Extended-B (1E7E0-1E7FF)
	if (cp >= 0x1e7e0 && cp <= 0x1e7ff) {
		if (cp >= 0x1e7e0 && cp <= 0x1e7e6) return EthiopicCategory.Syllable;
		if (cp >= 0x1e7e8 && cp <= 0x1e7eb) return EthiopicCategory.Syllable;
		if (cp >= 0x1e7ed && cp <= 0x1e7ee) return EthiopicCategory.Syllable;
		if (cp >= 0x1e7f0 && cp <= 0x1e7fe) return EthiopicCategory.Syllable;
		return EthiopicCategory.Other;
	}

	return EthiopicCategory.Other;
}

/**
 * Check if codepoint is an Ethiopic syllable
 */
export function isEthiopicSyllable(cp: number): boolean {
	return getEthiopicCategory(cp) === EthiopicCategory.Syllable;
}

/**
 * Get the vowel form of an Ethiopic syllable (0-7)
 * 0 = First form (inherent ä or a)
 * 1 = Second form (u)
 * 2 = Third form (i)
 * 3 = Fourth form (a)
 * 4 = Fifth form (e)
 * 5 = Sixth form (ə or no vowel)
 * 6 = Seventh form (o)
 * 7 = Eighth form (wa) - labialized
 */
export function getEthiopicVowelForm(cp: number): number {
	if (!isEthiopicSyllable(cp)) return -1;

	// Most Ethiopic syllables follow a pattern where the vowel
	// is determined by (cp - base) % 8 or similar
	// This is a simplified version

	if (cp >= 0x1200 && cp <= 0x1357) {
		// The ordering is irregular but generally follows:
		// base + 0 = first form (ä)
		// base + 1 = second form (u)
		// base + 2 = third form (i)
		// base + 3 = fourth form (a)
		// base + 4 = fifth form (e)
		// base + 5 = sixth form (ə)
		// base + 6 = seventh form (o)
		// base + 7 = eighth form (wa) when applicable

		// Find the base consonant (start of the row)
		// This is simplified; actual mapping is more complex
		const _row = Math.floor((cp - 0x1200) / 8);
		const form = (cp - 0x1200) % 8;

		// Some rows have fewer than 8 forms
		return Math.min(form, 7);
	}

	return 0;
}

/**
 * Ethiopic feature masks
 */
export const EthiopicFeatureMask = {
	ccmp: 0x0001, // Composition/decomposition
	locl: 0x0002, // Localized forms
	calt: 0x0004, // Contextual alternates
	liga: 0x0008, // Standard ligatures
	ss01: 0x0010, // Stylistic set 1
	ss02: 0x0020, // Stylistic set 2
} as const;

/**
 * Set up masks for Ethiopic shaping
 */
export function setupEthiopicMasks(infos: GlyphInfo[]): void {
	for (let i = 0; i < infos.length; i++) {
		const info = infos[i];
		if (!info) continue;

		const cat = getEthiopicCategory(info.codepoint);

		// All characters get basic features
		info.mask |= EthiopicFeatureMask.ccmp | EthiopicFeatureMask.locl;

		if (cat === EthiopicCategory.Syllable) {
			// Syllables participate in all features
			info.mask |=
				EthiopicFeatureMask.calt |
				EthiopicFeatureMask.liga |
				EthiopicFeatureMask.ss01 |
				EthiopicFeatureMask.ss02;
		} else if (cat === EthiopicCategory.Modifier) {
			// Modifiers need contextual features
			info.mask |= EthiopicFeatureMask.calt;
		}
	}
}

/**
 * Get default Ethiopic features in order
 */
export function getEthiopicFeatures(): string[] {
	return [
		"ccmp", // Character composition/decomposition
		"locl", // Localized forms
		"calt", // Contextual alternates
		"liga", // Standard ligatures
	];
}

/**
 * Check if script uses Ethiopic shaper
 */
export function usesEthiopic(script: string): boolean {
	return script === "ethi" || script === "Ethi";
}
