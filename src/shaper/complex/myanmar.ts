import type { GlyphInfo } from "../../types.ts";

/**
 * Myanmar shaper
 * Handles Myanmar script syllable structure and reordering
 */

// Myanmar Unicode ranges
const MYANMAR_START = 0x1000;
const MYANMAR_END = 0x109f;
const MYANMAR_EXT_A_START = 0xaa60;
const MYANMAR_EXT_A_END = 0xaa7f;
const MYANMAR_EXT_B_START = 0xa9e0;
const MYANMAR_EXT_B_END = 0xa9ff;

/**
 * Myanmar character categories
 */
export const enum MyanmarCategory {
	Other = 0,
	Consonant = 1,
	IndependentVowel = 2,
	DependentVowel = 3,
	Medial = 4,
	Asat = 5,        // Killer (္)
	Anusvara = 6,    // Dot below
	Visarga = 7,     // Visarga
	Sign = 8,
	Number = 9,
	Placeholder = 10, // Placeholder for visible virama
}

/**
 * Get Myanmar character category
 */
export function getMyanmarCategory(cp: number): MyanmarCategory {
	// Main Myanmar block
	if (cp >= MYANMAR_START && cp <= MYANMAR_END) {
		// Consonants (က-အ)
		if (cp >= 0x1000 && cp <= 0x1021) return MyanmarCategory.Consonant;
		if (cp >= 0x1023 && cp <= 0x1027) return MyanmarCategory.IndependentVowel;
		if (cp >= 0x1029 && cp <= 0x102a) return MyanmarCategory.IndependentVowel;

		// Dependent vowels
		if (cp >= 0x102b && cp <= 0x1035) return MyanmarCategory.DependentVowel;

		// Anusvara
		if (cp === 0x1036) return MyanmarCategory.Anusvara;

		// Dot below (asat indicator)
		if (cp === 0x1037) return MyanmarCategory.Sign;

		// Visarga
		if (cp === 0x1038) return MyanmarCategory.Visarga;

		// Asat (killer/virama)
		if (cp === 0x1039) return MyanmarCategory.Asat;
		if (cp === 0x103a) return MyanmarCategory.Asat;

		// Medials (ျ ြ ွ ှ)
		if (cp >= 0x103b && cp <= 0x103e) return MyanmarCategory.Medial;

		// More consonants (ဿ, etc.)
		if (cp >= 0x103f && cp <= 0x1049) {
			if (cp === 0x103f) return MyanmarCategory.Consonant;
			return MyanmarCategory.Number;
		}

		// Signs and digits
		if (cp >= 0x104a && cp <= 0x104f) return MyanmarCategory.Sign;
		if (cp >= 0x1050 && cp <= 0x1059) return MyanmarCategory.Consonant;

		// Extended consonants
		if (cp >= 0x105a && cp <= 0x105d) return MyanmarCategory.Consonant;
		if (cp >= 0x1060 && cp <= 0x1061) return MyanmarCategory.Consonant;
		if (cp >= 0x1062 && cp <= 0x1064) return MyanmarCategory.DependentVowel;
		if (cp >= 0x1065 && cp <= 0x1066) return MyanmarCategory.Consonant;
		if (cp >= 0x1067 && cp <= 0x106d) return MyanmarCategory.DependentVowel;
		if (cp >= 0x106e && cp <= 0x1070) return MyanmarCategory.Consonant;
		if (cp >= 0x1071 && cp <= 0x1074) return MyanmarCategory.DependentVowel;
		if (cp >= 0x1075 && cp <= 0x1081) return MyanmarCategory.Consonant;
		if (cp >= 0x1082 && cp <= 0x1082) return MyanmarCategory.Medial;
		if (cp >= 0x1083 && cp <= 0x108c) return MyanmarCategory.DependentVowel;
		if (cp === 0x108d) return MyanmarCategory.Sign;
		if (cp === 0x108e) return MyanmarCategory.Consonant;
		if (cp === 0x108f) return MyanmarCategory.Sign;
		if (cp >= 0x1090 && cp <= 0x1099) return MyanmarCategory.Number;
	}

	// Myanmar Extended-A
	if (cp >= MYANMAR_EXT_A_START && cp <= MYANMAR_EXT_A_END) {
		if (cp >= 0xaa60 && cp <= 0xaa76) return MyanmarCategory.Consonant;
		if (cp >= 0xaa77 && cp <= 0xaa79) return MyanmarCategory.Sign;
		if (cp === 0xaa7a) return MyanmarCategory.Consonant;
		if (cp === 0xaa7b) return MyanmarCategory.Sign;
		if (cp === 0xaa7c) return MyanmarCategory.Sign;
		if (cp === 0xaa7d) return MyanmarCategory.Sign;
		if (cp >= 0xaa7e && cp <= 0xaa7f) return MyanmarCategory.Consonant;
	}

	// Myanmar Extended-B
	if (cp >= MYANMAR_EXT_B_START && cp <= MYANMAR_EXT_B_END) {
		if (cp >= 0xa9e0 && cp <= 0xa9e4) return MyanmarCategory.Consonant;
		if (cp === 0xa9e5) return MyanmarCategory.DependentVowel;
		if (cp >= 0xa9e6 && cp <= 0xa9ef) return MyanmarCategory.Consonant;
		if (cp >= 0xa9f0 && cp <= 0xa9f9) return MyanmarCategory.Number;
		if (cp >= 0xa9fa && cp <= 0xa9fe) return MyanmarCategory.Consonant;
	}

	return MyanmarCategory.Other;
}

/**
 * Myanmar feature masks
 */
export const MyanmarFeatureMask = {
	rphf: 0x0001, // Reph forms
	pref: 0x0002, // Pre-base forms
	blwf: 0x0004, // Below-base forms
	pstf: 0x0008, // Post-base forms
	pres: 0x0010, // Pre-base substitutions
	abvs: 0x0020, // Above-base substitutions
	blws: 0x0040, // Below-base substitutions
	psts: 0x0080, // Post-base substitutions
} as const;

/**
 * Check if codepoint is Myanmar
 */
export function isMyanmar(cp: number): boolean {
	return (cp >= MYANMAR_START && cp <= MYANMAR_END) ||
	       (cp >= MYANMAR_EXT_A_START && cp <= MYANMAR_EXT_A_END) ||
	       (cp >= MYANMAR_EXT_B_START && cp <= MYANMAR_EXT_B_END);
}

/**
 * Setup Myanmar masks for feature application
 */
export function setupMyanmarMasks(infos: GlyphInfo[]): void {
	let i = 0;

	while (i < infos.length) {
		const info = infos[i]!;
		const cat = getMyanmarCategory(info.codepoint);

		if (cat === MyanmarCategory.Other) {
			i++;
			continue;
		}

		// Find syllable extent
		let base = -1;
		let hasAsat = false;

		if (cat === MyanmarCategory.Consonant) {
			base = i;
		}

		let j = i + 1;
		while (j < infos.length) {
			const nextInfo = infos[j]!;
			const nextCat = getMyanmarCategory(nextInfo.codepoint);

			if (nextCat === MyanmarCategory.Other) break;

			// Asat (killer) marks a stacked consonant
			if (nextCat === MyanmarCategory.Asat) {
				hasAsat = true;
				nextInfo.mask |= MyanmarFeatureMask.blwf;

				// Check for following consonant (stacking)
				if (j + 1 < infos.length) {
					const afterAsat = infos[j + 1]!;
					if (getMyanmarCategory(afterAsat.codepoint) === MyanmarCategory.Consonant) {
						afterAsat.mask |= MyanmarFeatureMask.blwf;
						j += 2;
						continue;
					}
				}
			}

			// Medials
			if (nextCat === MyanmarCategory.Medial) {
				const cp = nextInfo.codepoint;
				// ျ (ya) - pre-base
				if (cp === 0x103b) {
					nextInfo.mask |= MyanmarFeatureMask.pref;
				}
				// ြ (ra) - pre-base
				else if (cp === 0x103c) {
					nextInfo.mask |= MyanmarFeatureMask.pref;
				}
				// ွ (wa) - below-base
				else if (cp === 0x103d) {
					nextInfo.mask |= MyanmarFeatureMask.blwf;
				}
				// ှ (ha) - below-base
				else if (cp === 0x103e) {
					nextInfo.mask |= MyanmarFeatureMask.blwf;
				}
			}

			// Dependent vowels
			if (nextCat === MyanmarCategory.DependentVowel) {
				const cp = nextInfo.codepoint;
				// Pre-base vowels: ေ
				if (cp === 0x1031) {
					nextInfo.mask |= MyanmarFeatureMask.pref;
				}
				// Above-base vowels
				else if (cp === 0x102d || cp === 0x102e || cp === 0x1032) {
					nextInfo.mask |= MyanmarFeatureMask.abvs;
				}
				// Below-base vowels
				else if (cp === 0x102f || cp === 0x1030) {
					nextInfo.mask |= MyanmarFeatureMask.blws;
				}
				// Post-base vowels
				else {
					nextInfo.mask |= MyanmarFeatureMask.psts;
				}
			}

			// Signs above
			if (nextCat === MyanmarCategory.Anusvara || nextCat === MyanmarCategory.Sign) {
				nextInfo.mask |= MyanmarFeatureMask.abvs;
			}

			// New syllable on consonant without asat
			if (nextCat === MyanmarCategory.Consonant && !hasAsat) {
				// Check if previous was asat
				const prevCat = getMyanmarCategory(infos[j - 1]!.codepoint);
				if (prevCat !== MyanmarCategory.Asat) {
					break;
				}
			}

			hasAsat = false;
			j++;
		}

		i = j;
	}
}

/**
 * Reorder Myanmar pre-base vowels and medials
 * ေ and ြ should visually appear before the base consonant
 */
export function reorderMyanmar(infos: GlyphInfo[]): void {
	let i = 0;

	while (i < infos.length) {
		const cat = getMyanmarCategory(infos[i]!.codepoint);

		if (cat !== MyanmarCategory.Consonant) {
			i++;
			continue;
		}

		// Found base consonant
		const base = i;
		const preBase: GlyphInfo[] = [];

		// Collect pre-base elements that follow base
		let j = i + 1;
		while (j < infos.length) {
			const info = infos[j]!;
			const jCat = getMyanmarCategory(info.codepoint);

			// Pre-base vowel (ေ)
			if (info.codepoint === 0x1031) {
				preBase.push(info);
				infos.splice(j, 1);
				continue;
			}

			// Pre-base medial (ြ ra)
			if (info.codepoint === 0x103c) {
				preBase.push(info);
				infos.splice(j, 1);
				continue;
			}

			// Stop at next syllable
			if (jCat === MyanmarCategory.Consonant || jCat === MyanmarCategory.Other) {
				break;
			}

			j++;
		}

		// Insert pre-base elements before base
		if (preBase.length > 0) {
			infos.splice(base, 0, ...preBase);
			i += preBase.length;
		}

		i++;
	}
}
