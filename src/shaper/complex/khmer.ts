import type { GlyphInfo } from "../../types.ts";

/**
 * Khmer shaper
 * Handles Khmer script syllable structure and reordering
 */

// Khmer Unicode range
const KHMER_START = 0x1780;
const KHMER_END = 0x17ff;
const KHMER_SYMBOLS_START = 0x19e0;
const KHMER_SYMBOLS_END = 0x19ff;

/**
 * Khmer character categories
 */
export enum KhmerCategory {
	Other = 0,
	Consonant = 1,
	IndependentVowel = 2,
	DependentVowel = 3,
	Coeng = 4, // Subscript sign (្)
	Register = 5, // Register shifters
	Robat = 6, // Consonant shifter (៌)
	Sign = 7,
	Anusvara = 8, // Nikahit (ំ)
	Visarga = 9, // Reahmuk (ះ)
}

/**
 * Get Khmer character category
 */
export function getKhmerCategory(cp: number): KhmerCategory {
	if (cp < KHMER_START || cp > KHMER_END) return KhmerCategory.Other;

	// Consonants (ក-ស)
	if (cp >= 0x1780 && cp <= 0x17a2) return KhmerCategory.Consonant;
	if (cp === 0x17a3 || cp === 0x17a4) return KhmerCategory.IndependentVowel;

	// Independent vowels (ឣ-ឱ)
	if (cp >= 0x17a5 && cp <= 0x17b3) return KhmerCategory.IndependentVowel;

	// Dependent vowels (ា-ៅ)
	if (cp >= 0x17b6 && cp <= 0x17c5) return KhmerCategory.DependentVowel;

	// Signs
	if (cp === 0x17c6) return KhmerCategory.Anusvara; // Nikahit
	if (cp === 0x17c7) return KhmerCategory.Visarga; // Reahmuk
	if (cp === 0x17c8) return KhmerCategory.Sign; // Yuukaleapintu

	// Register shifters
	if (cp === 0x17c9 || cp === 0x17ca) return KhmerCategory.Register;

	// Coeng (subscript marker)
	if (cp === 0x17d2) return KhmerCategory.Coeng;

	// Robat
	if (cp === 0x17cc) return KhmerCategory.Robat;

	// Other signs
	if (cp >= 0x17cb && cp <= 0x17d1) return KhmerCategory.Sign;
	if (cp >= 0x17d3 && cp <= 0x17dd) return KhmerCategory.Sign;

	return KhmerCategory.Other;
}

/**
 * Khmer feature masks
 */
export const KhmerFeatureMask = {
	pref: 0x0001, // Pre-base forms
	blwf: 0x0002, // Below-base forms
	abvf: 0x0004, // Above-base forms
	pstf: 0x0008, // Post-base forms
	cfar: 0x0010, // Conjunct form after Ra
	pres: 0x0020, // Pre-base substitutions
	abvs: 0x0040, // Above-base substitutions
	blws: 0x0080, // Below-base substitutions
	psts: 0x0100, // Post-base substitutions
	clig: 0x0200, // Contextual ligatures
} as const;

/**
 * Check if codepoint is Khmer
 */
export function isKhmer(cp: number): boolean {
	return (
		(cp >= KHMER_START && cp <= KHMER_END) ||
		(cp >= KHMER_SYMBOLS_START && cp <= KHMER_SYMBOLS_END)
	);
}

/**
 * Setup Khmer masks for feature application
 */
export function setupKhmerMasks(infos: GlyphInfo[]): void {
	let i = 0;

	while (i < infos.length) {
		const info = infos[i];
		if (!info) {
			i++;
			continue;
		}
		const cat = getKhmerCategory(info.codepoint);

		if (cat === KhmerCategory.Other) {
			i++;
			continue;
		}

		// Find syllable extent
		const _syllableStart = i;
		let _base = -1;

		// Find base consonant
		if (cat === KhmerCategory.Consonant) {
			_base = i;
		}

		// Process syllable
		let j = i + 1;
		while (j < infos.length) {
			const nextInfo = infos[j];
			if (!nextInfo) {
				j++;
				continue;
			}
			const nextCat = getKhmerCategory(nextInfo.codepoint);

			if (nextCat === KhmerCategory.Other) break;
			if (nextCat === KhmerCategory.Consonant) {
				// Check if followed by coeng
				const prevInfo = infos[j - 1];
				if (
					prevInfo &&
					getKhmerCategory(prevInfo.codepoint) !== KhmerCategory.Coeng
				) {
					break;
				}
			}

			// Coeng + consonant = subscript consonant
			if (nextCat === KhmerCategory.Coeng && j + 1 < infos.length) {
				const afterCoeng = infos[j + 1];
				if (
					afterCoeng &&
					getKhmerCategory(afterCoeng.codepoint) === KhmerCategory.Consonant
				) {
					// Mark for below-base forms
					nextInfo.mask |= KhmerFeatureMask.blwf;
					afterCoeng.mask |= KhmerFeatureMask.blwf;
					j += 2;
					continue;
				}
			}

			// Dependent vowels
			if (nextCat === KhmerCategory.DependentVowel) {
				// Pre-base vowels: ◌េ ◌ែ ◌ៃ
				if (nextInfo.codepoint >= 0x17c1 && nextInfo.codepoint <= 0x17c3) {
					nextInfo.mask |= KhmerFeatureMask.pref;
				}
				// Above-base vowels
				else if (nextInfo.codepoint >= 0x17b7 && nextInfo.codepoint <= 0x17ba) {
					nextInfo.mask |= KhmerFeatureMask.abvf;
				}
				// Below-base vowels
				else if (
					nextInfo.codepoint === 0x17bb ||
					nextInfo.codepoint === 0x17bc ||
					nextInfo.codepoint === 0x17bd
				) {
					nextInfo.mask |= KhmerFeatureMask.blwf;
				}
				// Post-base vowels
				else {
					nextInfo.mask |= KhmerFeatureMask.pstf;
				}
			}

			// Register shifters (above)
			if (nextCat === KhmerCategory.Register) {
				nextInfo.mask |= KhmerFeatureMask.abvs;
			}

			// Robat (above)
			if (nextCat === KhmerCategory.Robat) {
				nextInfo.mask |= KhmerFeatureMask.abvs;
			}

			j++;
		}

		i = j;
	}
}

/**
 * Reorder Khmer pre-base vowels
 * Pre-base vowels (◌េ ◌ែ ◌ៃ) should visually appear before the base
 */
export function reorderKhmer(infos: GlyphInfo[]): void {
	let i = 0;

	while (i < infos.length) {
		const info = infos[i];
		if (!info) {
			i++;
			continue;
		}
		const cat = getKhmerCategory(info.codepoint);

		if (cat !== KhmerCategory.Consonant) {
			i++;
			continue;
		}

		// Found base consonant, look for pre-base vowels after it
		const base = i;
		let j = i + 1;

		// Skip coeng sequences
		while (j < infos.length) {
			const jInfo = infos[j];
			if (!jInfo) break;
			const jCat = getKhmerCategory(jInfo.codepoint);
			if (jCat === KhmerCategory.Coeng && j + 1 < infos.length) {
				j += 2; // Skip coeng + consonant
			} else {
				break;
			}
		}

		// Check for pre-base vowel
		if (j < infos.length) {
			const jInfo = infos[j];
			if (jInfo) {
				const cp = jInfo.codepoint;
				if (cp >= 0x17c1 && cp <= 0x17c3) {
					// Move pre-base vowel before base
					const vowel = jInfo;
					for (let k = j; k > base; k--) {
						const prevInfo = infos[k - 1];
						if (prevInfo) {
							infos[k] = prevInfo;
						}
					}
					infos[base] = vowel;
				}
			}
		}

		i = j + 1;
	}
}
