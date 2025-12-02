import type { GlyphInfo } from "../../types.ts";

/**
 * Thai/Lao character categories
 */
export const enum ThaiLaoCategory {
	Other = 0,
	Consonant = 1,
	LeadingVowel = 2, // Vowels that appear before consonant
	AboveVowel = 3, // Vowels above consonant
	BelowVowel = 4, // Vowels below consonant
	FollowingVowel = 5, // Vowels after consonant
	Tone = 6, // Tone marks
	NikhahitMaiEk = 7, // Special combining marks
	SaraAm = 8, // Thai Sara Am (combines anusvara + aa)
	Symbol = 9,
}

/**
 * Check if codepoint is Thai
 */
export function isThai(cp: number): boolean {
	return cp >= 0x0e00 && cp <= 0x0e7f;
}

/**
 * Check if codepoint is Lao
 */
export function isLao(cp: number): boolean {
	return cp >= 0x0e80 && cp <= 0x0eff;
}

/**
 * Get Thai/Lao category for a codepoint
 */
export function getThaiLaoCategory(cp: number): ThaiLaoCategory {
	// Thai (0E00-0E7F)
	if (isThai(cp)) {
		// Consonants
		if (cp >= 0x0e01 && cp <= 0x0e2e) return ThaiLaoCategory.Consonant;
		// Additional consonants
		if (cp === 0x0e2f) return ThaiLaoCategory.Consonant; // Paiyannoi

		// Leading vowels (displayed before consonant)
		if (cp >= 0x0e40 && cp <= 0x0e44) return ThaiLaoCategory.LeadingVowel;

		// Above vowels
		if (cp === 0x0e31) return ThaiLaoCategory.AboveVowel; // Mai Han-Akat
		if (cp >= 0x0e34 && cp <= 0x0e37) return ThaiLaoCategory.AboveVowel;
		if (cp === 0x0e47) return ThaiLaoCategory.AboveVowel; // Maitaikhu

		// Below vowels
		if (cp >= 0x0e38 && cp <= 0x0e3a) return ThaiLaoCategory.BelowVowel;

		// Following vowels
		if (cp === 0x0e30) return ThaiLaoCategory.FollowingVowel; // Sara A
		if (cp === 0x0e32 || cp === 0x0e33) return ThaiLaoCategory.FollowingVowel; // Sara Aa, Sara Am
		if (cp === 0x0e45) return ThaiLaoCategory.FollowingVowel; // Lakkhangyao

		// Sara Am (special - decomposes to nikhahit + sara aa)
		if (cp === 0x0e33) return ThaiLaoCategory.SaraAm;

		// Tone marks
		if (cp >= 0x0e48 && cp <= 0x0e4b) return ThaiLaoCategory.Tone;

		// Thanthakhat (cancellation mark)
		if (cp === 0x0e4c) return ThaiLaoCategory.Tone;

		// Nikhahit (anusvara)
		if (cp === 0x0e4d) return ThaiLaoCategory.NikhahitMaiEk;

		// Yamakkan
		if (cp === 0x0e4e) return ThaiLaoCategory.NikhahitMaiEk;

		// Digits and symbols
		if (cp >= 0x0e50 && cp <= 0x0e5b) return ThaiLaoCategory.Symbol;

		return ThaiLaoCategory.Other;
	}

	// Lao (0E80-0EFF)
	if (isLao(cp)) {
		// Consonants
		if (cp >= 0x0e81 && cp <= 0x0eae) return ThaiLaoCategory.Consonant;

		// Leading vowels
		if (cp >= 0x0ec0 && cp <= 0x0ec4) return ThaiLaoCategory.LeadingVowel;

		// Above vowels
		if (cp === 0x0eb1) return ThaiLaoCategory.AboveVowel;
		if (cp >= 0x0eb4 && cp <= 0x0eb7) return ThaiLaoCategory.AboveVowel;
		if (cp === 0x0ebb) return ThaiLaoCategory.AboveVowel;

		// Below vowels
		if (cp >= 0x0eb8 && cp <= 0x0eb9) return ThaiLaoCategory.BelowVowel;
		if (cp === 0x0ebc) return ThaiLaoCategory.BelowVowel;

		// Following vowels
		if (cp === 0x0eb0) return ThaiLaoCategory.FollowingVowel;
		if (cp === 0x0eb2 || cp === 0x0eb3) return ThaiLaoCategory.FollowingVowel;

		// Tone marks
		if (cp >= 0x0ec8 && cp <= 0x0ecd) return ThaiLaoCategory.Tone;

		// Digits
		if (cp >= 0x0ed0 && cp <= 0x0ed9) return ThaiLaoCategory.Symbol;

		return ThaiLaoCategory.Other;
	}

	return ThaiLaoCategory.Other;
}

/**
 * Set up masks for Thai/Lao shaping
 *
 * Thai/Lao require:
 * 1. Reordering of pre-base vowels (they appear before consonant visually but after in Unicode)
 * 2. Proper stacking of above/below vowels and tone marks
 */
export function setupThaiLaoMasks(infos: GlyphInfo[]): void {
	// Group characters into syllable-like clusters
	// Each cluster starts with a consonant

	let clusterIndex = 0;
	let consonantIndex = -1;

	for (let i = 0; i < infos.length; i++) {
		const info = infos[i];
		if (!info) continue;

		const cat = getThaiLaoCategory(info.codepoint);

		// Consonants start new clusters
		if (cat === ThaiLaoCategory.Consonant) {
			clusterIndex++;
			consonantIndex = i;
		}

		// Store cluster info in mask
		// Upper bits: cluster index
		// Lower bits: category for reordering
		info.mask = (info.mask & 0xffffff00) | (cat & 0xff);
		info.mask = (info.mask & 0x0000ffff) | ((clusterIndex & 0xffff) << 16);

		// Mark leading vowels for reordering
		if (cat === ThaiLaoCategory.LeadingVowel) {
			// These need to be moved before the consonant during shaping
			// The GSUB pref feature handles this
			info.mask |= 0x100; // Mark for pre-base processing
		}
	}
}

/**
 * Reorder Thai/Lao clusters
 * Leading vowels (Sara E, Sara Ae, Sara O, Sara Ai Mai Muan, Sara Ai Mai Malai)
 * are stored after consonant in Unicode but displayed before
 */
export function reorderThaiLao(infos: GlyphInfo[]): void {
	let i = 0;
	while (i < infos.length) {
		const info = infos[i];
		if (!info) {
			i++;
			continue;
		}

		const cat = getThaiLaoCategory(info.codepoint);

		// If we find a leading vowel, move it before its consonant
		if (cat === ThaiLaoCategory.LeadingVowel) {
			// Find the following consonant
			let j = i + 1;
			while (j < infos.length) {
				const nextCat = getThaiLaoCategory(infos[j]?.codepoint ?? 0);
				if (nextCat === ThaiLaoCategory.Consonant) {
					// Swap vowel and consonant
					const temp = infos[i]!;
					infos[i] = infos[j]!;
					infos[j] = temp;
					break;
				}
				if (nextCat !== ThaiLaoCategory.LeadingVowel) {
					break;
				}
				j++;
			}
		}
		i++;
	}
}
