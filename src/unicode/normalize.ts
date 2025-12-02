import type { GlyphInfo } from "../types.ts";

/**
 * Normalization mode for shaping
 */
export const enum NormalizationMode {
	/** No normalization */
	None = 0,
	/** Decompose (NFD-like) */
	Decompose = 1,
	/** Compose (NFC-like) */
	Compose = 2,
	/** Auto-detect based on script */
	Auto = 3,
}

/**
 * Canonical Combining Class (ccc) for combining marks
 * Based on Unicode 15.0
 */
export function getCombiningClass(cp: number): number {
	// Common combining classes
	// 0 = Not_Reordered (base characters, most characters)
	// 1 = Overlay
	// 7 = Nukta
	// 8 = Kana_Voicing
	// 9 = Virama
	// 200-240 = Various marks

	// Hebrew combining marks (0591-05BD, 05BF, 05C1-05C2, 05C4-05C5, 05C7)
	if (cp >= 0x0591 && cp <= 0x05bd) return getHebrewCcc(cp);
	if (cp === 0x05bf) return 23;
	if (cp === 0x05c1) return 24;
	if (cp === 0x05c2) return 25;
	if (cp === 0x05c4) return 230;
	if (cp === 0x05c5) return 220;
	if (cp === 0x05c7) return 18;

	// Arabic combining marks (064B-065F, 0670)
	if (cp >= 0x064b && cp <= 0x065f) return getArabicCcc(cp);
	if (cp === 0x0670) return 35;
	// Extended Arabic marks
	if (cp >= 0x0610 && cp <= 0x061a) return 230;
	if (cp >= 0x06d6 && cp <= 0x06dc) return 230;
	if (cp >= 0x06df && cp <= 0x06e4) return 230;
	if (cp >= 0x06e7 && cp <= 0x06e8) return 230;
	if (cp >= 0x06ea && cp <= 0x06ed) return 220;
	if (cp === 0x08d4) return 230;
	if (cp >= 0x08e3 && cp <= 0x08ff) return 220;

	// Devanagari nukta and signs
	if (cp === 0x093c) return 7; // Nukta
	if (cp === 0x094d) return 9; // Virama
	if (cp >= 0x0951 && cp <= 0x0954) return 230; // Accent marks
	if (cp === 0x0955) return 0;
	if (cp >= 0x0956 && cp <= 0x0957) return 0;

	// Bengali nukta and virama
	if (cp === 0x09bc) return 7;
	if (cp === 0x09cd) return 9;
	if (cp === 0x09fe) return 230;

	// Gurmukhi
	if (cp === 0x0a3c) return 7; // Nukta
	if (cp === 0x0a4d) return 9; // Virama

	// Gujarati
	if (cp === 0x0abc) return 7; // Nukta
	if (cp === 0x0acd) return 9; // Virama

	// Oriya
	if (cp === 0x0b3c) return 7; // Nukta
	if (cp === 0x0b4d) return 9; // Virama

	// Tamil
	if (cp === 0x0bcd) return 9; // Virama

	// Telugu
	if (cp === 0x0c4d) return 9; // Virama
	if (cp === 0x0c55) return 84;
	if (cp === 0x0c56) return 91;

	// Kannada
	if (cp === 0x0cbc) return 7; // Nukta
	if (cp === 0x0ccd) return 9; // Virama

	// Malayalam
	if (cp === 0x0d4d) return 9; // Virama

	// Sinhala
	if (cp === 0x0dca) return 9; // Virama

	// Thai/Lao vowels and tone marks
	if (cp >= 0x0e31 && cp <= 0x0e3a) return 0; // Positioned, not reordered
	if (cp >= 0x0e47 && cp <= 0x0e4e) return getThaiCcc(cp);
	if (cp >= 0x0eb1 && cp <= 0x0ebc) return 0;
	if (cp >= 0x0ec8 && cp <= 0x0ecd) return getThaiCcc(cp);

	// Tibetan
	if (cp >= 0x0f18 && cp <= 0x0f19) return 220;
	if (cp === 0x0f35) return 220;
	if (cp === 0x0f37) return 220;
	if (cp === 0x0f39) return 216;
	if (cp >= 0x0f71 && cp <= 0x0f7e) return getTibetanCcc(cp);
	if (cp >= 0x0f80 && cp <= 0x0f84) return getTibetanCcc(cp);
	if (cp >= 0x0f86 && cp <= 0x0f87) return 230;

	// Myanmar
	if (cp === 0x1037) return 7; // Nukta
	if (cp === 0x1039) return 9; // Virama
	if (cp === 0x103a) return 9;

	// Hangul Jamo (combining)
	if (cp >= 0x302a && cp <= 0x302f) return getHangulCcc(cp);
	if (cp >= 0x3099 && cp <= 0x309a) return 8; // Kana voicing

	// General combining marks (0300-036F)
	if (cp >= 0x0300 && cp <= 0x036f) return getLatinCcc(cp);

	// Combining Diacritical Marks Extended (1AB0-1AFF)
	if (cp >= 0x1ab0 && cp <= 0x1aff) return getCdmeClass(cp);

	// Combining Diacritical Marks Supplement (1DC0-1DFF)
	if (cp >= 0x1dc0 && cp <= 0x1dff) return getCdmsClass(cp);

	// Combining Half Marks (FE20-FE2F)
	if (cp >= 0xfe20 && cp <= 0xfe2f) return 230;

	return 0;
}

function getThaiCcc(cp: number): number {
	// Thai tone marks and vowel signs above
	if (cp >= 0x0e48 && cp <= 0x0e4b) return 107; // Tone marks
	if (cp === 0x0e4c) return 0; // Thanthakhat
	if (cp === 0x0e4d) return 0; // Nikhahit
	if (cp === 0x0e4e) return 0; // Yamakkan
	// Lao tone marks
	if (cp >= 0x0ec8 && cp <= 0x0ecb) return 122;
	return 0;
}

function getTibetanCcc(cp: number): number {
	if (cp === 0x0f71) return 129;
	if (cp === 0x0f72) return 130;
	if (cp === 0x0f73) return 0; // Composed
	if (cp === 0x0f74) return 132;
	if (cp === 0x0f75) return 0; // Composed
	if (cp === 0x0f76) return 0; // Composed
	if (cp === 0x0f77) return 0; // Composed
	if (cp === 0x0f78) return 0; // Composed
	if (cp === 0x0f79) return 0; // Composed
	if (cp === 0x0f7a) return 130;
	if (cp === 0x0f7b) return 130;
	if (cp === 0x0f7c) return 130;
	if (cp === 0x0f7d) return 130;
	if (cp === 0x0f7e) return 0;
	if (cp === 0x0f80) return 130;
	if (cp === 0x0f81) return 0; // Composed
	if (cp === 0x0f82) return 230;
	if (cp === 0x0f83) return 230;
	if (cp === 0x0f84) return 9;
	return 0;
}

function getHangulCcc(cp: number): number {
	if (cp === 0x302a) return 218;
	if (cp === 0x302b) return 228;
	if (cp === 0x302c) return 232;
	if (cp === 0x302d) return 222;
	if (cp === 0x302e) return 224;
	if (cp === 0x302f) return 224;
	return 0;
}

function getCdmeClass(cp: number): number {
	// Combining Diacritical Marks Extended
	if (cp >= 0x1ab0 && cp <= 0x1abe) return 230;
	if (cp === 0x1abf) return 220;
	if (cp === 0x1ac0) return 220;
	return 230;
}

function getCdmsClass(cp: number): number {
	// Combining Diacritical Marks Supplement
	if (cp >= 0x1dc0 && cp <= 0x1dc1) return 230;
	if (cp === 0x1dc2) return 220;
	if (cp >= 0x1dc3 && cp <= 0x1dca) return 230;
	if (cp === 0x1dcb) return 230;
	if (cp === 0x1dcc) return 230;
	if (cp === 0x1dcd) return 234;
	if (cp === 0x1dce) return 214;
	if (cp === 0x1dcf) return 220;
	if (cp === 0x1dd0) return 202;
	if (cp >= 0x1dd1 && cp <= 0x1df5) return 230;
	if (cp >= 0x1df6 && cp <= 0x1df8) return 232;
	if (cp === 0x1df9) return 220;
	if (cp === 0x1dfa) return 218;
	if (cp >= 0x1dfb && cp <= 0x1dff) return 230;
	return 230;
}

function getHebrewCcc(cp: number): number {
	// Hebrew accents and marks have specific combining classes
	if (cp >= 0x0591 && cp <= 0x05a1) return 220; // Below marks
	if (cp >= 0x05a2 && cp <= 0x05af) return 230; // Above marks
	if (cp >= 0x05b0 && cp <= 0x05b9) {
		// Vowel points
		if (cp === 0x05b0) return 10; // Sheva
		if (cp === 0x05b1) return 11; // Hataf Segol
		if (cp === 0x05b2) return 12; // Hataf Patah
		if (cp === 0x05b3) return 13; // Hataf Qamats
		if (cp === 0x05b4) return 14; // Hiriq
		if (cp === 0x05b5) return 15; // Tsere
		if (cp === 0x05b6) return 16; // Segol
		if (cp === 0x05b7) return 17; // Patah
		if (cp === 0x05b8) return 18; // Qamats
		if (cp === 0x05b9) return 19; // Holam
	}
	if (cp === 0x05ba) return 19; // Holam Haser
	if (cp === 0x05bb) return 20; // Qubuts
	if (cp === 0x05bc) return 21; // Dagesh
	if (cp === 0x05bd) return 22; // Meteg
	return 0;
}

function getArabicCcc(cp: number): number {
	if (cp === 0x064b) return 27; // Fathatan
	if (cp === 0x064c) return 28; // Dammatan
	if (cp === 0x064d) return 29; // Kasratan
	if (cp === 0x064e) return 30; // Fatha
	if (cp === 0x064f) return 31; // Damma
	if (cp === 0x0650) return 32; // Kasra
	if (cp === 0x0651) return 33; // Shadda
	if (cp === 0x0652) return 34; // Sukun
	if (cp >= 0x0653 && cp <= 0x0655) return 230; // Maddah, Hamza above
	if (cp === 0x0656) return 220; // Subscript Alef
	if (cp === 0x0657) return 230; // Inverted Damma
	if (cp === 0x0658) return 230; // Mark Noon Ghunna
	if (cp >= 0x0659 && cp <= 0x065f) return 230;
	return 0;
}

function getLatinCcc(cp: number): number {
	// Combining diacritical marks
	if (cp >= 0x0300 && cp <= 0x0314) return 230; // Above marks
	if (cp >= 0x0315 && cp <= 0x0315) return 232; // Above right
	if (cp >= 0x0316 && cp <= 0x0319) return 220; // Below marks
	if (cp >= 0x031a && cp <= 0x031a) return 232; // Above right
	if (cp >= 0x031b && cp <= 0x031b) return 216; // Attached above right
	if (cp >= 0x031c && cp <= 0x0320) return 220; // Below
	if (cp >= 0x0321 && cp <= 0x0322) return 202; // Attached below
	if (cp >= 0x0323 && cp <= 0x0326) return 220; // Below
	if (cp >= 0x0327 && cp <= 0x0328) return 202; // Attached below
	if (cp >= 0x0329 && cp <= 0x0333) return 220; // Below
	if (cp >= 0x0334 && cp <= 0x0338) return 1; // Overlay
	if (cp >= 0x0339 && cp <= 0x033c) return 220; // Below
	if (cp >= 0x033d && cp <= 0x0344) return 230; // Above
	if (cp === 0x0345) return 240; // Iota subscript
	if (cp >= 0x0346 && cp <= 0x034e) return 230; // Above
	if (cp === 0x034f) return 0; // CGJ
	if (cp >= 0x0350 && cp <= 0x0352) return 230; // Above
	if (cp >= 0x0353 && cp <= 0x0356) return 220; // Below
	if (cp >= 0x0357 && cp <= 0x0358) return 230; // Above
	if (cp >= 0x0359 && cp <= 0x035a) return 220; // Below
	if (cp >= 0x035b && cp <= 0x035b) return 230; // Above
	if (cp >= 0x035c && cp <= 0x035c) return 233; // Double below
	if (cp >= 0x035d && cp <= 0x035e) return 234; // Double above
	if (cp >= 0x035f && cp <= 0x035f) return 233; // Double below
	if (cp >= 0x0360 && cp <= 0x0361) return 234; // Double above
	if (cp >= 0x0362 && cp <= 0x0362) return 233; // Double below
	if (cp >= 0x0363 && cp <= 0x036f) return 230; // Above
	return 0;
}

/**
 * Reorder combining marks according to canonical combining class
 */
export function reorderMarks(infos: GlyphInfo[]): void {
	// Simple bubble sort for stability (marks with same ccc keep order)
	const n = infos.length;
	let i = 1;

	while (i < n) {
		const info = infos[i];
		if (!info) {
			i++;
			continue;
		}

		const ccc = getCombiningClass(info.codepoint);
		if (ccc === 0) {
			// Non-combining, advance
			i++;
			continue;
		}

		// Look backward for marks to reorder with
		let j = i;
		while (j > 0) {
			const prevInfo = infos[j - 1];
			if (!prevInfo) break;

			const prevCcc = getCombiningClass(prevInfo.codepoint);
			if (prevCcc === 0) break; // Hit a base character
			if (prevCcc <= ccc) break; // Already in order

			// Swap
			infos[j] = prevInfo;
			infos[j - 1] = info;
			j--;
		}

		i++;
	}
}

/**
 * Common decomposition mappings (subset of Unicode decomposition)
 */
const DECOMPOSITIONS: Map<number, number[]> = new Map([
	// Latin precomposed characters (Latin-1 Supplement)
	[0x00c0, [0x0041, 0x0300]], // À = A + grave
	[0x00c1, [0x0041, 0x0301]], // Á = A + acute
	[0x00c2, [0x0041, 0x0302]], // Â = A + circumflex
	[0x00c3, [0x0041, 0x0303]], // Ã = A + tilde
	[0x00c4, [0x0041, 0x0308]], // Ä = A + diaeresis
	[0x00c5, [0x0041, 0x030a]], // Å = A + ring
	[0x00c7, [0x0043, 0x0327]], // Ç = C + cedilla
	[0x00c8, [0x0045, 0x0300]], // È = E + grave
	[0x00c9, [0x0045, 0x0301]], // É = E + acute
	[0x00ca, [0x0045, 0x0302]], // Ê = E + circumflex
	[0x00cb, [0x0045, 0x0308]], // Ë = E + diaeresis
	[0x00cc, [0x0049, 0x0300]], // Ì = I + grave
	[0x00cd, [0x0049, 0x0301]], // Í = I + acute
	[0x00ce, [0x0049, 0x0302]], // Î = I + circumflex
	[0x00cf, [0x0049, 0x0308]], // Ï = I + diaeresis
	[0x00d1, [0x004e, 0x0303]], // Ñ = N + tilde
	[0x00d2, [0x004f, 0x0300]], // Ò = O + grave
	[0x00d3, [0x004f, 0x0301]], // Ó = O + acute
	[0x00d4, [0x004f, 0x0302]], // Ô = O + circumflex
	[0x00d5, [0x004f, 0x0303]], // Õ = O + tilde
	[0x00d6, [0x004f, 0x0308]], // Ö = O + diaeresis
	[0x00d9, [0x0055, 0x0300]], // Ù = U + grave
	[0x00da, [0x0055, 0x0301]], // Ú = U + acute
	[0x00db, [0x0055, 0x0302]], // Û = U + circumflex
	[0x00dc, [0x0055, 0x0308]], // Ü = U + diaeresis
	[0x00dd, [0x0059, 0x0301]], // Ý = Y + acute
	// Lowercase Latin-1
	[0x00e0, [0x0061, 0x0300]], // à = a + grave
	[0x00e1, [0x0061, 0x0301]], // á = a + acute
	[0x00e2, [0x0061, 0x0302]], // â = a + circumflex
	[0x00e3, [0x0061, 0x0303]], // ã = a + tilde
	[0x00e4, [0x0061, 0x0308]], // ä = a + diaeresis
	[0x00e5, [0x0061, 0x030a]], // å = a + ring
	[0x00e7, [0x0063, 0x0327]], // ç = c + cedilla
	[0x00e8, [0x0065, 0x0300]], // è = e + grave
	[0x00e9, [0x0065, 0x0301]], // é = e + acute
	[0x00ea, [0x0065, 0x0302]], // ê = e + circumflex
	[0x00eb, [0x0065, 0x0308]], // ë = e + diaeresis
	[0x00ec, [0x0069, 0x0300]], // ì = i + grave
	[0x00ed, [0x0069, 0x0301]], // í = i + acute
	[0x00ee, [0x0069, 0x0302]], // î = i + circumflex
	[0x00ef, [0x0069, 0x0308]], // ï = i + diaeresis
	[0x00f1, [0x006e, 0x0303]], // ñ = n + tilde
	[0x00f2, [0x006f, 0x0300]], // ò = o + grave
	[0x00f3, [0x006f, 0x0301]], // ó = o + acute
	[0x00f4, [0x006f, 0x0302]], // ô = o + circumflex
	[0x00f5, [0x006f, 0x0303]], // õ = o + tilde
	[0x00f6, [0x006f, 0x0308]], // ö = o + diaeresis
	[0x00f9, [0x0075, 0x0300]], // ù = u + grave
	[0x00fa, [0x0075, 0x0301]], // ú = u + acute
	[0x00fb, [0x0075, 0x0302]], // û = u + circumflex
	[0x00fc, [0x0075, 0x0308]], // ü = u + diaeresis
	[0x00fd, [0x0079, 0x0301]], // ý = y + acute
	[0x00ff, [0x0079, 0x0308]], // ÿ = y + diaeresis
	// Latin Extended-A
	[0x0100, [0x0041, 0x0304]], // Ā = A + macron
	[0x0101, [0x0061, 0x0304]], // ā = a + macron
	[0x0102, [0x0041, 0x0306]], // Ă = A + breve
	[0x0103, [0x0061, 0x0306]], // ă = a + breve
	[0x0104, [0x0041, 0x0328]], // Ą = A + ogonek
	[0x0105, [0x0061, 0x0328]], // ą = a + ogonek
	[0x0106, [0x0043, 0x0301]], // Ć = C + acute
	[0x0107, [0x0063, 0x0301]], // ć = c + acute
	[0x0108, [0x0043, 0x0302]], // Ĉ = C + circumflex
	[0x0109, [0x0063, 0x0302]], // ĉ = c + circumflex
	[0x010a, [0x0043, 0x0307]], // Ċ = C + dot above
	[0x010b, [0x0063, 0x0307]], // ċ = c + dot above
	[0x010c, [0x0043, 0x030c]], // Č = C + caron
	[0x010d, [0x0063, 0x030c]], // č = c + caron
	[0x010e, [0x0044, 0x030c]], // Ď = D + caron
	[0x010f, [0x0064, 0x030c]], // ď = d + caron
	[0x0112, [0x0045, 0x0304]], // Ē = E + macron
	[0x0113, [0x0065, 0x0304]], // ē = e + macron
	[0x0114, [0x0045, 0x0306]], // Ĕ = E + breve
	[0x0115, [0x0065, 0x0306]], // ĕ = e + breve
	[0x0116, [0x0045, 0x0307]], // Ė = E + dot above
	[0x0117, [0x0065, 0x0307]], // ė = e + dot above
	[0x0118, [0x0045, 0x0328]], // Ę = E + ogonek
	[0x0119, [0x0065, 0x0328]], // ę = e + ogonek
	[0x011a, [0x0045, 0x030c]], // Ě = E + caron
	[0x011b, [0x0065, 0x030c]], // ě = e + caron
	[0x011c, [0x0047, 0x0302]], // Ĝ = G + circumflex
	[0x011d, [0x0067, 0x0302]], // ĝ = g + circumflex
	[0x011e, [0x0047, 0x0306]], // Ğ = G + breve
	[0x011f, [0x0067, 0x0306]], // ğ = g + breve
	[0x0120, [0x0047, 0x0307]], // Ġ = G + dot above
	[0x0121, [0x0067, 0x0307]], // ġ = g + dot above
	[0x0122, [0x0047, 0x0327]], // Ģ = G + cedilla
	[0x0123, [0x0067, 0x0327]], // ģ = g + cedilla
	[0x0124, [0x0048, 0x0302]], // Ĥ = H + circumflex
	[0x0125, [0x0068, 0x0302]], // ĥ = h + circumflex
	[0x0128, [0x0049, 0x0303]], // Ĩ = I + tilde
	[0x0129, [0x0069, 0x0303]], // ĩ = i + tilde
	[0x012a, [0x0049, 0x0304]], // Ī = I + macron
	[0x012b, [0x0069, 0x0304]], // ī = i + macron
	[0x012c, [0x0049, 0x0306]], // Ĭ = I + breve
	[0x012d, [0x0069, 0x0306]], // ĭ = i + breve
	[0x012e, [0x0049, 0x0328]], // Į = I + ogonek
	[0x012f, [0x0069, 0x0328]], // į = i + ogonek
	[0x0130, [0x0049, 0x0307]], // İ = I + dot above
	[0x0134, [0x004a, 0x0302]], // Ĵ = J + circumflex
	[0x0135, [0x006a, 0x0302]], // ĵ = j + circumflex
	[0x0136, [0x004b, 0x0327]], // Ķ = K + cedilla
	[0x0137, [0x006b, 0x0327]], // ķ = k + cedilla
	[0x0139, [0x004c, 0x0301]], // Ĺ = L + acute
	[0x013a, [0x006c, 0x0301]], // ĺ = l + acute
	[0x013b, [0x004c, 0x0327]], // Ļ = L + cedilla
	[0x013c, [0x006c, 0x0327]], // ļ = l + cedilla
	[0x013d, [0x004c, 0x030c]], // Ľ = L + caron
	[0x013e, [0x006c, 0x030c]], // ľ = l + caron
	[0x0143, [0x004e, 0x0301]], // Ń = N + acute
	[0x0144, [0x006e, 0x0301]], // ń = n + acute
	[0x0145, [0x004e, 0x0327]], // Ņ = N + cedilla
	[0x0146, [0x006e, 0x0327]], // ņ = n + cedilla
	[0x0147, [0x004e, 0x030c]], // Ň = N + caron
	[0x0148, [0x006e, 0x030c]], // ň = n + caron
	[0x014c, [0x004f, 0x0304]], // Ō = O + macron
	[0x014d, [0x006f, 0x0304]], // ō = o + macron
	[0x014e, [0x004f, 0x0306]], // Ŏ = O + breve
	[0x014f, [0x006f, 0x0306]], // ŏ = o + breve
	[0x0150, [0x004f, 0x030b]], // Ő = O + double acute
	[0x0151, [0x006f, 0x030b]], // ő = o + double acute
	[0x0154, [0x0052, 0x0301]], // Ŕ = R + acute
	[0x0155, [0x0072, 0x0301]], // ŕ = r + acute
	[0x0156, [0x0052, 0x0327]], // Ŗ = R + cedilla
	[0x0157, [0x0072, 0x0327]], // ŗ = r + cedilla
	[0x0158, [0x0052, 0x030c]], // Ř = R + caron
	[0x0159, [0x0072, 0x030c]], // ř = r + caron
	[0x015a, [0x0053, 0x0301]], // Ś = S + acute
	[0x015b, [0x0073, 0x0301]], // ś = s + acute
	[0x015c, [0x0053, 0x0302]], // Ŝ = S + circumflex
	[0x015d, [0x0073, 0x0302]], // ŝ = s + circumflex
	[0x015e, [0x0053, 0x0327]], // Ş = S + cedilla
	[0x015f, [0x0073, 0x0327]], // ş = s + cedilla
	[0x0160, [0x0053, 0x030c]], // Š = S + caron
	[0x0161, [0x0073, 0x030c]], // š = s + caron
	[0x0162, [0x0054, 0x0327]], // Ţ = T + cedilla
	[0x0163, [0x0074, 0x0327]], // ţ = t + cedilla
	[0x0164, [0x0054, 0x030c]], // Ť = T + caron
	[0x0165, [0x0074, 0x030c]], // ť = t + caron
	[0x0168, [0x0055, 0x0303]], // Ũ = U + tilde
	[0x0169, [0x0075, 0x0303]], // ũ = u + tilde
	[0x016a, [0x0055, 0x0304]], // Ū = U + macron
	[0x016b, [0x0075, 0x0304]], // ū = u + macron
	[0x016c, [0x0055, 0x0306]], // Ŭ = U + breve
	[0x016d, [0x0075, 0x0306]], // ŭ = u + breve
	[0x016e, [0x0055, 0x030a]], // Ů = U + ring
	[0x016f, [0x0075, 0x030a]], // ů = u + ring
	[0x0170, [0x0055, 0x030b]], // Ű = U + double acute
	[0x0171, [0x0075, 0x030b]], // ű = u + double acute
	[0x0172, [0x0055, 0x0328]], // Ų = U + ogonek
	[0x0173, [0x0075, 0x0328]], // ų = u + ogonek
	[0x0174, [0x0057, 0x0302]], // Ŵ = W + circumflex
	[0x0175, [0x0077, 0x0302]], // ŵ = w + circumflex
	[0x0176, [0x0059, 0x0302]], // Ŷ = Y + circumflex
	[0x0177, [0x0079, 0x0302]], // ŷ = y + circumflex
	[0x0178, [0x0059, 0x0308]], // Ÿ = Y + diaeresis
	[0x0179, [0x005a, 0x0301]], // Ź = Z + acute
	[0x017a, [0x007a, 0x0301]], // ź = z + acute
	[0x017b, [0x005a, 0x0307]], // Ż = Z + dot above
	[0x017c, [0x007a, 0x0307]], // ż = z + dot above
	[0x017d, [0x005a, 0x030c]], // Ž = Z + caron
	[0x017e, [0x007a, 0x030c]], // ž = z + caron
	// Vietnamese characters (Latin Extended Additional)
	[0x1ea0, [0x0041, 0x0323]], // Ạ = A + dot below
	[0x1ea1, [0x0061, 0x0323]], // ạ = a + dot below
	[0x1ea2, [0x0041, 0x0309]], // Ả = A + hook above
	[0x1ea3, [0x0061, 0x0309]], // ả = a + hook above
	[0x1eb8, [0x0045, 0x0323]], // Ẹ = E + dot below
	[0x1eb9, [0x0065, 0x0323]], // ẹ = e + dot below
	[0x1eba, [0x0045, 0x0309]], // Ẻ = E + hook above
	[0x1ebb, [0x0065, 0x0309]], // ẻ = e + hook above
	[0x1ebc, [0x0045, 0x0303]], // Ẽ = E + tilde
	[0x1ebd, [0x0065, 0x0303]], // ẽ = e + tilde
	[0x1ec8, [0x0049, 0x0309]], // Ỉ = I + hook above
	[0x1ec9, [0x0069, 0x0309]], // ỉ = i + hook above
	[0x1eca, [0x0049, 0x0323]], // Ị = I + dot below
	[0x1ecb, [0x0069, 0x0323]], // ị = i + dot below
	[0x1ecc, [0x004f, 0x0323]], // Ọ = O + dot below
	[0x1ecd, [0x006f, 0x0323]], // ọ = o + dot below
	[0x1ece, [0x004f, 0x0309]], // Ỏ = O + hook above
	[0x1ecf, [0x006f, 0x0309]], // ỏ = o + hook above
	[0x1ee4, [0x0055, 0x0323]], // Ụ = U + dot below
	[0x1ee5, [0x0075, 0x0323]], // ụ = u + dot below
	[0x1ee6, [0x0055, 0x0309]], // Ủ = U + hook above
	[0x1ee7, [0x0075, 0x0309]], // ủ = u + hook above
	[0x1ef2, [0x0059, 0x0300]], // Ỳ = Y + grave
	[0x1ef3, [0x0079, 0x0300]], // ỳ = y + grave
	[0x1ef4, [0x0059, 0x0323]], // Ỵ = Y + dot below
	[0x1ef5, [0x0079, 0x0323]], // ỵ = y + dot below
	[0x1ef6, [0x0059, 0x0309]], // Ỷ = Y + hook above
	[0x1ef7, [0x0079, 0x0309]], // ỷ = y + hook above
	[0x1ef8, [0x0059, 0x0303]], // Ỹ = Y + tilde
	[0x1ef9, [0x0079, 0x0303]], // ỹ = y + tilde
	// Greek Extended
	[0x1f00, [0x03b1, 0x0313]], // ἀ = α + psili
	[0x1f01, [0x03b1, 0x0314]], // ἁ = α + dasia
	[0x1f08, [0x0391, 0x0313]], // Ἀ = Α + psili
	[0x1f09, [0x0391, 0x0314]], // Ἁ = Α + dasia
	// Cyrillic (common)
	[0x0439, [0x0438, 0x0306]], // й = и + breve
	[0x0419, [0x0418, 0x0306]], // Й = И + breve
	[0x0451, [0x0435, 0x0308]], // ё = е + diaeresis
	[0x0401, [0x0415, 0x0308]], // Ё = Е + diaeresis
]);

/**
 * Decompose a codepoint if it has a canonical decomposition
 */
export function decompose(cp: number): number[] | null {
	return DECOMPOSITIONS.get(cp) ?? null;
}

/**
 * Common composition mappings (subset of Unicode canonical composition)
 * Maps (base, combining) pairs to composed character
 */
const COMPOSITIONS: Map<number, Map<number, number>> = new Map([
	// Latin A compositions
	[0x0041, new Map([
		[0x0300, 0x00c0], // A + grave = À
		[0x0301, 0x00c1], // A + acute = Á
		[0x0302, 0x00c2], // A + circumflex = Â
		[0x0303, 0x00c3], // A + tilde = Ã
		[0x0308, 0x00c4], // A + diaeresis = Ä
		[0x030a, 0x00c5], // A + ring = Å
		[0x0328, 0x0104], // A + ogonek = Ą
		[0x030c, 0x01cd], // A + caron = Ǎ
		[0x0304, 0x0100], // A + macron = Ā
		[0x0306, 0x0102], // A + breve = Ă
	])],
	// Latin C compositions
	[0x0043, new Map([
		[0x0327, 0x00c7], // C + cedilla = Ç
		[0x0301, 0x0106], // C + acute = Ć
		[0x0302, 0x0108], // C + circumflex = Ĉ
		[0x030c, 0x010c], // C + caron = Č
		[0x0307, 0x010a], // C + dot above = Ċ
	])],
	// Latin E compositions
	[0x0045, new Map([
		[0x0300, 0x00c8], // E + grave = È
		[0x0301, 0x00c9], // E + acute = É
		[0x0302, 0x00ca], // E + circumflex = Ê
		[0x0308, 0x00cb], // E + diaeresis = Ë
		[0x0328, 0x0118], // E + ogonek = Ę
		[0x030c, 0x011a], // E + caron = Ě
		[0x0304, 0x0112], // E + macron = Ē
		[0x0306, 0x0114], // E + breve = Ĕ
		[0x0307, 0x0116], // E + dot above = Ė
	])],
	// Latin I compositions
	[0x0049, new Map([
		[0x0300, 0x00cc], // I + grave = Ì
		[0x0301, 0x00cd], // I + acute = Í
		[0x0302, 0x00ce], // I + circumflex = Î
		[0x0308, 0x00cf], // I + diaeresis = Ï
		[0x0303, 0x0128], // I + tilde = Ĩ
		[0x0304, 0x012a], // I + macron = Ī
		[0x0306, 0x012c], // I + breve = Ĭ
		[0x0328, 0x012e], // I + ogonek = Į
		[0x0307, 0x0130], // I + dot above = İ
	])],
	// Latin N compositions
	[0x004e, new Map([
		[0x0303, 0x00d1], // N + tilde = Ñ
		[0x0301, 0x0143], // N + acute = Ń
		[0x0327, 0x0145], // N + cedilla = Ņ
		[0x030c, 0x0147], // N + caron = Ň
	])],
	// Latin O compositions
	[0x004f, new Map([
		[0x0300, 0x00d2], // O + grave = Ò
		[0x0301, 0x00d3], // O + acute = Ó
		[0x0302, 0x00d4], // O + circumflex = Ô
		[0x0303, 0x00d5], // O + tilde = Õ
		[0x0308, 0x00d6], // O + diaeresis = Ö
		[0x0304, 0x014c], // O + macron = Ō
		[0x0306, 0x014e], // O + breve = Ŏ
		[0x030b, 0x0150], // O + double acute = Ő
		[0x0328, 0x01ea], // O + ogonek = Ǫ
	])],
	// Latin U compositions
	[0x0055, new Map([
		[0x0300, 0x00d9], // U + grave = Ù
		[0x0301, 0x00da], // U + acute = Ú
		[0x0302, 0x00db], // U + circumflex = Û
		[0x0308, 0x00dc], // U + diaeresis = Ü
		[0x0303, 0x0168], // U + tilde = Ũ
		[0x0304, 0x016a], // U + macron = Ū
		[0x0306, 0x016c], // U + breve = Ŭ
		[0x030a, 0x016e], // U + ring = Ů
		[0x030b, 0x0170], // U + double acute = Ű
		[0x0328, 0x0172], // U + ogonek = Ų
		[0x030c, 0x01d3], // U + caron = Ǔ
	])],
	// Latin Y compositions
	[0x0059, new Map([
		[0x0301, 0x00dd], // Y + acute = Ý
		[0x0302, 0x0176], // Y + circumflex = Ŷ
		[0x0308, 0x0178], // Y + diaeresis = Ÿ
	])],
	// Lowercase a compositions
	[0x0061, new Map([
		[0x0300, 0x00e0], // a + grave = à
		[0x0301, 0x00e1], // a + acute = á
		[0x0302, 0x00e2], // a + circumflex = â
		[0x0303, 0x00e3], // a + tilde = ã
		[0x0308, 0x00e4], // a + diaeresis = ä
		[0x030a, 0x00e5], // a + ring = å
		[0x0328, 0x0105], // a + ogonek = ą
		[0x030c, 0x01ce], // a + caron = ǎ
		[0x0304, 0x0101], // a + macron = ā
		[0x0306, 0x0103], // a + breve = ă
	])],
	// Lowercase c compositions
	[0x0063, new Map([
		[0x0327, 0x00e7], // c + cedilla = ç
		[0x0301, 0x0107], // c + acute = ć
		[0x0302, 0x0109], // c + circumflex = ĉ
		[0x030c, 0x010d], // c + caron = č
		[0x0307, 0x010b], // c + dot above = ċ
	])],
	// Lowercase e compositions
	[0x0065, new Map([
		[0x0300, 0x00e8], // e + grave = è
		[0x0301, 0x00e9], // e + acute = é
		[0x0302, 0x00ea], // e + circumflex = ê
		[0x0308, 0x00eb], // e + diaeresis = ë
		[0x0328, 0x0119], // e + ogonek = ę
		[0x030c, 0x011b], // e + caron = ě
		[0x0304, 0x0113], // e + macron = ē
		[0x0306, 0x0115], // e + breve = ĕ
		[0x0307, 0x0117], // e + dot above = ė
	])],
	// Lowercase i compositions
	[0x0069, new Map([
		[0x0300, 0x00ec], // i + grave = ì
		[0x0301, 0x00ed], // i + acute = í
		[0x0302, 0x00ee], // i + circumflex = î
		[0x0308, 0x00ef], // i + diaeresis = ï
		[0x0303, 0x0129], // i + tilde = ĩ
		[0x0304, 0x012b], // i + macron = ī
		[0x0306, 0x012d], // i + breve = ĭ
		[0x0328, 0x012f], // i + ogonek = į
	])],
	// Lowercase n compositions
	[0x006e, new Map([
		[0x0303, 0x00f1], // n + tilde = ñ
		[0x0301, 0x0144], // n + acute = ń
		[0x0327, 0x0146], // n + cedilla = ņ
		[0x030c, 0x0148], // n + caron = ň
	])],
	// Lowercase o compositions
	[0x006f, new Map([
		[0x0300, 0x00f2], // o + grave = ò
		[0x0301, 0x00f3], // o + acute = ó
		[0x0302, 0x00f4], // o + circumflex = ô
		[0x0303, 0x00f5], // o + tilde = õ
		[0x0308, 0x00f6], // o + diaeresis = ö
		[0x0304, 0x014d], // o + macron = ō
		[0x0306, 0x014f], // o + breve = ŏ
		[0x030b, 0x0151], // o + double acute = ő
		[0x0328, 0x01eb], // o + ogonek = ǫ
	])],
	// Lowercase u compositions
	[0x0075, new Map([
		[0x0300, 0x00f9], // u + grave = ù
		[0x0301, 0x00fa], // u + acute = ú
		[0x0302, 0x00fb], // u + circumflex = û
		[0x0308, 0x00fc], // u + diaeresis = ü
		[0x0303, 0x0169], // u + tilde = ũ
		[0x0304, 0x016b], // u + macron = ū
		[0x0306, 0x016d], // u + breve = ŭ
		[0x030a, 0x016f], // u + ring = ů
		[0x030b, 0x0171], // u + double acute = ű
		[0x0328, 0x0173], // u + ogonek = ų
		[0x030c, 0x01d4], // u + caron = ǔ
	])],
	// Lowercase y compositions
	[0x0079, new Map([
		[0x0301, 0x00fd], // y + acute = ý
		[0x0308, 0x00ff], // y + diaeresis = ÿ
		[0x0302, 0x0177], // y + circumflex = ŷ
	])],
	// Other common compositions
	[0x0053, new Map([ // S
		[0x0301, 0x015a], // S + acute = Ś
		[0x0302, 0x015c], // S + circumflex = Ŝ
		[0x0327, 0x015e], // S + cedilla = Ş
		[0x030c, 0x0160], // S + caron = Š
	])],
	[0x0073, new Map([ // s
		[0x0301, 0x015b], // s + acute = ś
		[0x0302, 0x015d], // s + circumflex = ŝ
		[0x0327, 0x015f], // s + cedilla = ş
		[0x030c, 0x0161], // s + caron = š
	])],
	[0x005a, new Map([ // Z
		[0x0301, 0x0179], // Z + acute = Ź
		[0x0307, 0x017b], // Z + dot above = Ż
		[0x030c, 0x017d], // Z + caron = Ž
	])],
	[0x007a, new Map([ // z
		[0x0301, 0x017a], // z + acute = ź
		[0x0307, 0x017c], // z + dot above = ż
		[0x030c, 0x017e], // z + caron = ž
	])],
]);

/**
 * Try to compose a base character with a combining mark
 * Returns the composed character or null if no composition exists
 */
export function tryCompose(base: number, combining: number): number | null {
	const baseCompositions = COMPOSITIONS.get(base);
	if (!baseCompositions) return null;
	return baseCompositions.get(combining) ?? null;
}

/**
 * Compose combining marks with their bases where possible (NFC-like)
 */
function composeMarks(infos: GlyphInfo[]): GlyphInfo[] {
	if (infos.length === 0) return infos;

	const result: GlyphInfo[] = [];
	let i = 0;

	while (i < infos.length) {
		const current = infos[i]!;
		const currentCcc = getCombiningClass(current.codepoint);

		// If this is a base character (ccc = 0), try to compose with following marks
		if (currentCcc === 0) {
			let composedCp = current.codepoint;
			let lastCcc = 0;
			let j = i + 1;

			// Look for combining marks that can be composed
			while (j < infos.length) {
				const mark = infos[j]!;
				const markCcc = getCombiningClass(mark.codepoint);

				// Stop at next base character
				if (markCcc === 0) break;

				// Can only compose if:
				// 1. Mark has higher ccc than last composed mark (or last was base)
				// 2. Composition exists for the pair
				if (markCcc > lastCcc || lastCcc === 0) {
					const composed = tryCompose(composedCp, mark.codepoint);
					if (composed !== null) {
						composedCp = composed;
						// Mark this position as consumed (will skip)
						j++;
						continue;
					}
				}

				// Mark wasn't composed, stop looking for compositions
				// but continue with remaining marks
				lastCcc = markCcc;
				j++;
			}

			// Output the (possibly composed) base
			result.push({
				glyphId: current.glyphId,
				cluster: current.cluster,
				mask: current.mask,
				codepoint: composedCp,
			});

			// Output any marks that weren't composed
			for (let k = i + 1; k < j; k++) {
				const mark = infos[k]!;
				const markCcc = getCombiningClass(mark.codepoint);
				// Only output marks that weren't composed (check if they're still combining marks)
				// We need to re-check if a composition exists to determine what to output
				const compositionExists = tryCompose(composedCp, mark.codepoint) !== null;
				if (!compositionExists && markCcc !== 0) {
					result.push(mark);
				}
			}

			i = j;
		} else {
			// Standalone combining mark (no base), just copy it
			result.push(current);
			i++;
		}
	}

	return result;
}

/**
 * Apply normalization to glyph infos
 */
export function normalize(infos: GlyphInfo[], mode: NormalizationMode): GlyphInfo[] {
	if (mode === NormalizationMode.None) {
		return infos;
	}

	if (mode === NormalizationMode.Decompose) {
		// Decompose precomposed characters (NFD-like)
		const result: GlyphInfo[] = [];

		for (const info of infos) {
			const decomposed = decompose(info.codepoint);
			if (decomposed) {
				// Replace with decomposed sequence
				for (let i = 0; i < decomposed.length; i++) {
					result.push({
						glyphId: info.glyphId, // Will be remapped later
						cluster: info.cluster,
						mask: info.mask,
						codepoint: decomposed[i]!,
					});
				}
			} else {
				result.push(info);
			}
		}

		// Reorder combining marks
		reorderMarks(result);

		return result;
	}

	if (mode === NormalizationMode.Compose) {
		// First decompose, reorder, then compose (NFC-like)
		// Step 1: Decompose
		const decomposed: GlyphInfo[] = [];
		for (const info of infos) {
			const dec = decompose(info.codepoint);
			if (dec) {
				for (let i = 0; i < dec.length; i++) {
					decomposed.push({
						glyphId: info.glyphId,
						cluster: info.cluster,
						mask: info.mask,
						codepoint: dec[i]!,
					});
				}
			} else {
				decomposed.push(info);
			}
		}

		// Step 2: Reorder combining marks
		reorderMarks(decomposed);

		// Step 3: Compose
		return composeMarks(decomposed);
	}

	if (mode === NormalizationMode.Auto) {
		// Auto mode: use decomposition by default (better for shaping)
		const result: GlyphInfo[] = [];

		for (const info of infos) {
			const decomposed = decompose(info.codepoint);
			if (decomposed) {
				for (let i = 0; i < decomposed.length; i++) {
					result.push({
						glyphId: info.glyphId,
						cluster: info.cluster,
						mask: info.mask,
						codepoint: decomposed[i]!,
					});
				}
			} else {
				result.push(info);
			}
		}

		reorderMarks(result);
		return result;
	}

	return infos;
}
