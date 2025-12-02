import type { GlyphInfo } from "../../types.ts";

/**
 * Universal Shaping Engine (USE) categories
 * Based on Unicode USE specification
 */
export enum UseCategory {
	O = 0, // Other
	B = 1, // Base
	CGJ = 2, // Combining Grapheme Joiner
	CM = 3, // Consonant modifier
	CS = 4, // Consonant with stacker
	F = 5, // Final
	FM = 6, // Final modifier
	GB = 7, // Generic base
	H = 8, // Halant/Virama
	HN = 9, // Halant or Nukta
	IND = 10, // Independent
	J = 11, // Joiner
	N = 12, // Nukta
	R = 13, // Repha
	S = 14, // Symbol
	SB = 15, // Symbol modifier
	SE = 16, // Syllable ending
	SUB = 17, // Subjoined
	VS = 18, // Variation selector
	WJ = 19, // Word joiner
	ZWJ = 20, // Zero Width Joiner
	ZWNJ = 21, // Zero Width Non-Joiner
	V = 22, // Vowel (independent)
	VD = 23, // Vowel dependent
	VMAbv = 24, // Vowel modifier above
	VMBlw = 25, // Vowel modifier below
	VMPre = 26, // Vowel modifier pre
	VMPst = 27, // Vowel modifier post
	VAbv = 28, // Vowel above
	VBlw = 29, // Vowel below
	VPre = 30, // Vowel pre
	VPst = 31, // Vowel post
	SMAbv = 32, // Syllable modifier above
	SMBlw = 33, // Syllable modifier below
	FAbv = 34, // Final above
	FBlw = 35, // Final below
	FPst = 36, // Final post
	MAbv = 37, // Medial above
	MBlw = 38, // Medial below
	MPre = 39, // Medial pre
	MPst = 40, // Medial post
}

/**
 * Check if a script uses USE
 */
export function usesUSE(script: string): boolean {
	// Scripts that use Universal Shaping Engine
	const useScripts = [
		"bali", // Balinese
		"batk", // Batak
		"brah", // Brahmi
		"bugi", // Buginese
		"buhd", // Buhid
		"cakm", // Chakma
		"cham", // Cham
		"dupl", // Duployan
		"egyp", // Egyptian Hieroglyphs
		"gran", // Grantha
		"hano", // Hanunoo
		"java", // Javanese
		"kthi", // Kaithi
		"khar", // Kharoshthi
		"khmr", // Khmer
		"khoj", // Khojki
		"lana", // Tai Tham
		"lepc", // Lepcha
		"limb", // Limbu
		"mahj", // Mahajani
		"modi", // Modi
		"mtei", // Meetei Mayek
		"mymr", // Myanmar
		"newa", // Newa
		"phlp", // Psalter Pahlavi
		"rjng", // Rejang
		"saur", // Saurashtra
		"shrd", // Sharada
		"sidd", // Siddham
		"sind", // Sindhi (Khudawadi)
		"sinh", // Sinhala
		"sund", // Sundanese
		"sylo", // Syloti Nagri
		"tagb", // Tagbanwa
		"takr", // Takri
		"tale", // Tai Le
		"talu", // New Tai Lue
		"tavt", // Tai Viet
		"tibt", // Tibetan
		"tirh", // Tirhuta
	];
	return useScripts.includes(script);
}

/**
 * Get USE category for a codepoint
 */
export function getUseCategory(cp: number): UseCategory {
	// Zero-width characters
	if (cp === 0x200c) return UseCategory.ZWNJ;
	if (cp === 0x200d) return UseCategory.ZWJ;
	if (cp === 0x034f) return UseCategory.CGJ; // Combining Grapheme Joiner
	if (cp === 0x2060) return UseCategory.WJ; // Word Joiner
	if (cp >= 0xfe00 && cp <= 0xfe0f) return UseCategory.VS; // Variation Selectors
	if (cp >= 0xe0100 && cp <= 0xe01ef) return UseCategory.VS; // VS 17-256

	// Myanmar (1000-109F)
	if (cp >= 0x1000 && cp <= 0x109f) {
		// Consonants
		if (cp >= 0x1000 && cp <= 0x1020) return UseCategory.B;
		// Independent vowels
		if (cp >= 0x1021 && cp <= 0x102a) return UseCategory.IND;
		// Dependent vowels
		if (cp >= 0x102b && cp <= 0x1032) return UseCategory.VPst;
		// Anusvara etc
		if (cp >= 0x1036 && cp <= 0x1037) return UseCategory.SMAbv;
		// Virama
		if (cp === 0x1039) return UseCategory.H;
		// Asat (visible virama)
		if (cp === 0x103a) return UseCategory.H;
		// Medial consonants
		if (cp >= 0x103b && cp <= 0x103e) return UseCategory.MBlw;
		// Digits
		if (cp >= 0x1040 && cp <= 0x1049) return UseCategory.GB;
		return UseCategory.O;
	}

	// Khmer (1780-17FF)
	if (cp >= 0x1780 && cp <= 0x17ff) {
		// Consonants
		if (cp >= 0x1780 && cp <= 0x17a2) return UseCategory.B;
		// Independent vowels
		if (cp >= 0x17a3 && cp <= 0x17b3) return UseCategory.IND;
		// Dependent vowels
		if (cp >= 0x17b6 && cp <= 0x17c5) return UseCategory.VPst;
		// Coeng (stacking virama)
		if (cp === 0x17d2) return UseCategory.H;
		// Anusvara, Visarga
		if (cp >= 0x17c6 && cp <= 0x17c8) return UseCategory.SMAbv;
		return UseCategory.O;
	}

	// Tibetan (0F00-0FFF)
	if (cp >= 0x0f00 && cp <= 0x0fff) {
		// Syllable markers
		if (cp >= 0x0f00 && cp <= 0x0f17) return UseCategory.S;
		// Vowel signs
		if (cp >= 0x0f71 && cp <= 0x0f7d) return UseCategory.VAbv;
		// Subjoined consonants
		if (cp >= 0x0f90 && cp <= 0x0fbc) return UseCategory.SUB;
		// Base consonants
		if (cp >= 0x0f40 && cp <= 0x0f6c) return UseCategory.B;
		return UseCategory.O;
	}

	// Thai (0E00-0E7F)
	if (cp >= 0x0e00 && cp <= 0x0e7f) {
		// Consonants
		if (cp >= 0x0e01 && cp <= 0x0e2e) return UseCategory.B;
		// Vowels
		if (cp >= 0x0e30 && cp <= 0x0e3a) return UseCategory.VPst;
		if (cp >= 0x0e40 && cp <= 0x0e44) return UseCategory.VPre;
		// Tone marks
		if (cp >= 0x0e48 && cp <= 0x0e4b) return UseCategory.SMAbv;
		return UseCategory.O;
	}

	// Lao (0E80-0EFF)
	if (cp >= 0x0e80 && cp <= 0x0eff) {
		// Consonants
		if (cp >= 0x0e81 && cp <= 0x0ea3) return UseCategory.B;
		// Vowels
		if (cp >= 0x0eb0 && cp <= 0x0ebc) return UseCategory.VPst;
		if (cp >= 0x0ec0 && cp <= 0x0ec4) return UseCategory.VPre;
		// Tone marks
		if (cp >= 0x0ec8 && cp <= 0x0ecd) return UseCategory.SMAbv;
		return UseCategory.O;
	}

	return UseCategory.O;
}

/** USE feature masks */
export const UseFeatureMask = {
	rphf: 0x0001, // Reph forms
	pref: 0x0002, // Pre-base forms
	blwf: 0x0004, // Below-base forms
	abvf: 0x0008, // Above-base forms
	pstf: 0x0010, // Post-base forms
	half: 0x0020, // Half forms
	cjct: 0x0040, // Conjunct forms
	vatu: 0x0080, // Vattu variants
	pres: 0x0100, // Pre-base substitutions
	abvs: 0x0200, // Above-base substitutions
	blws: 0x0400, // Below-base substitutions
	psts: 0x0800, // Post-base substitutions
	haln: 0x1000, // Halant forms
} as const;

/**
 * USE syllable structure
 */
interface UseSyllable {
	start: number;
	end: number;
	base: number;
	hasReph: boolean;
}

/**
 * Find syllable boundaries in USE text
 */
function findUseSyllables(infos: GlyphInfo[]): UseSyllable[] {
	const syllables: UseSyllable[] = [];
	const n = infos.length;
	if (n === 0) return syllables;

	let start = 0;

	while (start < n) {
		const syllable = parseUseSyllable(infos, start);
		syllables.push(syllable);
		start = syllable.end;
	}

	return syllables;
}

/**
 * Parse a single USE syllable
 */
function parseUseSyllable(infos: GlyphInfo[], start: number): UseSyllable {
	const n = infos.length;
	let pos = start;
	let base = -1;
	let hasReph = false;

	// Check for Repha (R + H at start)
	if (pos + 1 < n) {
		const cat1 = getUseCategory(infos[pos]?.codepoint ?? 0);
		const cat2 = getUseCategory(infos[pos + 1]?.codepoint ?? 0);
		if (cat1 === UseCategory.R && cat2 === UseCategory.H) {
			hasReph = true;
			pos += 2;
		}
	}

	// Find base character
	while (pos < n) {
		const cat = getUseCategory(infos[pos]?.codepoint ?? 0);

		// Base characters
		if (
			cat === UseCategory.B ||
			cat === UseCategory.IND ||
			cat === UseCategory.GB ||
			cat === UseCategory.V
		) {
			base = pos;
			pos++;
			break;
		}

		// Non-base starters - continue looking
		if (
			cat === UseCategory.VMPre ||
			cat === UseCategory.VPre ||
			cat === UseCategory.MPre
		) {
			pos++;
			continue;
		}

		// End of valid cluster start
		if (base === -1) {
			pos++;
		}
		break;
	}

	if (base === -1) base = start;

	// Consume consonant cluster
	while (pos < n) {
		const cat = getUseCategory(infos[pos]?.codepoint ?? 0);

		// Halant + Consonant continues cluster
		if (cat === UseCategory.H) {
			pos++;
			if (pos < n) {
				const nextCat = getUseCategory(infos[pos]?.codepoint ?? 0);
				if (
					nextCat === UseCategory.B ||
					nextCat === UseCategory.CS ||
					nextCat === UseCategory.SUB
				) {
					pos++;
					continue;
				}
				// ZWJ/ZWNJ after halant
				if (nextCat === UseCategory.ZWJ || nextCat === UseCategory.ZWNJ) {
					pos++;
				}
			}
			continue;
		}

		// Subjoined consonants
		if (cat === UseCategory.SUB || cat === UseCategory.CS) {
			pos++;
			continue;
		}

		// Nukta
		if (cat === UseCategory.N || cat === UseCategory.HN) {
			pos++;
			continue;
		}

		break;
	}

	// Consume matras and modifiers
	while (pos < n) {
		const cat = getUseCategory(infos[pos]?.codepoint ?? 0);

		// Vowel signs
		if (
			cat === UseCategory.VAbv ||
			cat === UseCategory.VBlw ||
			cat === UseCategory.VPre ||
			cat === UseCategory.VPst ||
			cat === UseCategory.VD
		) {
			pos++;
			continue;
		}

		// Medials
		if (
			cat === UseCategory.MAbv ||
			cat === UseCategory.MBlw ||
			cat === UseCategory.MPre ||
			cat === UseCategory.MPst
		) {
			pos++;
			continue;
		}

		// Vowel modifiers
		if (
			cat === UseCategory.VMAbv ||
			cat === UseCategory.VMBlw ||
			cat === UseCategory.VMPre ||
			cat === UseCategory.VMPst
		) {
			pos++;
			continue;
		}

		// Syllable modifiers
		if (cat === UseCategory.SMAbv || cat === UseCategory.SMBlw) {
			pos++;
			continue;
		}

		// Finals
		if (
			cat === UseCategory.FAbv ||
			cat === UseCategory.FBlw ||
			cat === UseCategory.FPst ||
			cat === UseCategory.F ||
			cat === UseCategory.FM
		) {
			pos++;
			continue;
		}

		// CGJ, VS
		if (cat === UseCategory.CGJ || cat === UseCategory.VS) {
			pos++;
			continue;
		}

		break;
	}

	// Ensure we advance at least one position
	if (pos === start) {
		pos = start + 1;
	}

	return { start, end: pos, base, hasReph };
}

/**
 * Set up masks for USE shaping
 */
export function setupUseMasks(infos: GlyphInfo[]): void {
	const syllables = findUseSyllables(infos);

	for (let i = 0; i < syllables.length; i++) {
		const syllable = syllables[i]!;

		for (let j = syllable.start; j < syllable.end; j++) {
			const info = infos[j];
			if (!info) continue;

			// Store syllable index in upper mask bits
			info.mask = (info.mask & 0x0000ffff) | ((i & 0xffff) << 16);

			const cat = getUseCategory(info.codepoint);

			// Reph handling
			if (syllable.hasReph && j < syllable.start + 2) {
				info.mask |= UseFeatureMask.rphf;
			}

			// Pre-base handling
			if (j < syllable.base) {
				if (
					cat === UseCategory.B ||
					cat === UseCategory.CS ||
					cat === UseCategory.SUB
				) {
					info.mask |= UseFeatureMask.half | UseFeatureMask.cjct;
				}
			}

			// Post-base handling
			if (j > syllable.base) {
				if (
					cat === UseCategory.B ||
					cat === UseCategory.CS ||
					cat === UseCategory.SUB
				) {
					info.mask |=
						UseFeatureMask.blwf | UseFeatureMask.pstf | UseFeatureMask.vatu;
				}
			}

			// Halant
			if (cat === UseCategory.H || cat === UseCategory.HN) {
				if (j < syllable.base) {
					info.mask |= UseFeatureMask.half;
				} else {
					info.mask |= UseFeatureMask.haln;
				}
			}

			// Vowel signs
			if (cat === UseCategory.VPre) {
				info.mask |= UseFeatureMask.pref | UseFeatureMask.pres;
			} else if (cat === UseCategory.VAbv) {
				info.mask |= UseFeatureMask.abvf | UseFeatureMask.abvs;
			} else if (cat === UseCategory.VBlw) {
				info.mask |= UseFeatureMask.blwf | UseFeatureMask.blws;
			} else if (cat === UseCategory.VPst || cat === UseCategory.VD) {
				info.mask |= UseFeatureMask.pstf | UseFeatureMask.psts;
			}

			// Medials
			if (cat === UseCategory.MAbv) {
				info.mask |= UseFeatureMask.abvs;
			} else if (cat === UseCategory.MBlw) {
				info.mask |= UseFeatureMask.blws;
			} else if (cat === UseCategory.MPre) {
				info.mask |= UseFeatureMask.pres;
			} else if (cat === UseCategory.MPst) {
				info.mask |= UseFeatureMask.psts;
			}

			// Syllable modifiers
			if (cat === UseCategory.SMAbv) {
				info.mask |= UseFeatureMask.abvs;
			} else if (cat === UseCategory.SMBlw) {
				info.mask |= UseFeatureMask.blws;
			}

			// Finals
			if (cat === UseCategory.FAbv) {
				info.mask |= UseFeatureMask.abvs;
			} else if (cat === UseCategory.FBlw) {
				info.mask |= UseFeatureMask.blws;
			} else if (
				cat === UseCategory.FPst ||
				cat === UseCategory.F ||
				cat === UseCategory.FM
			) {
				info.mask |= UseFeatureMask.psts;
			}
		}
	}
}

/**
 * Reorder USE syllables (pre-base vowels, reph)
 */
export function reorderUSE(infos: GlyphInfo[]): void {
	const syllables = findUseSyllables(infos);

	for (const syllable of syllables) {
		reorderUseSyllable(infos, syllable);
	}
}

/**
 * Reorder a single USE syllable
 */
function reorderUseSyllable(infos: GlyphInfo[], syllable: UseSyllable): void {
	const { start, end, base, hasReph } = syllable;

	// Collect pre-base vowels that need to move
	const preBaseVowels: { index: number; info: GlyphInfo }[] = [];

	for (let i = base + 1; i < end; i++) {
		const info = infos[i];
		if (!info) continue;

		const cat = getUseCategory(info.codepoint);
		if (cat === UseCategory.VPre || cat === UseCategory.MPre) {
			preBaseVowels.push({ index: i, info });
		}
	}

	// Move pre-base vowels before the base
	if (preBaseVowels.length > 0) {
		preBaseVowels.sort((a, b) => b.index - a.index);

		for (const { index, info } of preBaseVowels) {
			infos.splice(index, 1);
			const insertPos = hasReph ? start + 2 : start;
			infos.splice(insertPos, 0, info);
		}
	}

	// Move reph to end (if present)
	if (hasReph && end > start + 2) {
		const rephStart = infos[start];
		const rephH = infos[start + 1];

		if (rephStart && rephH) {
			// Find target position: after matras, before finals
			let rephTarget = end - 1;

			while (rephTarget > base) {
				const targetInfo = infos[rephTarget];
				if (!targetInfo) break;

				const cat = getUseCategory(targetInfo.codepoint);
				if (
					cat === UseCategory.SMAbv ||
					cat === UseCategory.SMBlw ||
					cat === UseCategory.FAbv ||
					cat === UseCategory.FBlw ||
					cat === UseCategory.FPst ||
					cat === UseCategory.F ||
					cat === UseCategory.FM
				) {
					rephTarget--;
				} else {
					break;
				}
			}

			if (rephTarget > start + 1) {
				infos.splice(start, 2);
				const adjustedTarget = rephTarget - 2;
				infos.splice(adjustedTarget + 1, 0, rephStart, rephH);
			}
		}
	}
}
