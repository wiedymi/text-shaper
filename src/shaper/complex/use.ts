import type { GlyphInfo } from "../../types.ts";

/**
 * Universal Shaping Engine (USE) categories
 * Based on Unicode USE specification
 */
export const enum UseCategory {
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

/**
 * Set up masks for USE shaping
 */
export function setupUseMasks(infos: GlyphInfo[]): void {
	// Mark cluster boundaries based on base characters
	let clusterStart = 0;
	let clusterIndex = 0;

	for (let i = 0; i < infos.length; i++) {
		const info = infos[i];
		if (!info) continue;

		const cat = getUseCategory(info.codepoint);

		// Start new cluster at base/independent vowel
		if (cat === UseCategory.B || cat === UseCategory.IND ||
			cat === UseCategory.GB || cat === UseCategory.S) {
			if (i > clusterStart) {
				clusterIndex++;
			}
			clusterStart = i;
		}

		// Store cluster index in upper mask bits
		info.mask = (info.mask & 0x0000ffff) | ((clusterIndex & 0xffff) << 16);
	}
}
