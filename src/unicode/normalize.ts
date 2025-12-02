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

	// Devanagari nukta and signs
	if (cp === 0x093c) return 7; // Nukta
	if (cp === 0x094d) return 9; // Virama
	if (cp >= 0x0951 && cp <= 0x0954) return 230; // Accent marks

	// Bengali nukta and virama
	if (cp === 0x09bc) return 7;
	if (cp === 0x09cd) return 9;

	// Thai/Lao vowels and tone marks
	if (cp >= 0x0e31 && cp <= 0x0e3a) return 0; // Positioned, not reordered
	if (cp >= 0x0e47 && cp <= 0x0e4e) return 0;

	// General combining marks (0300-036F)
	if (cp >= 0x0300 && cp <= 0x036f) return getLatinCcc(cp);

	return 0;
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
	// Latin precomposed characters
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
	// Lowercase
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
]);

/**
 * Decompose a codepoint if it has a canonical decomposition
 */
export function decompose(cp: number): number[] | null {
	return DECOMPOSITIONS.get(cp) ?? null;
}

/**
 * Apply normalization to glyph infos
 */
export function normalize(infos: GlyphInfo[], mode: NormalizationMode): GlyphInfo[] {
	if (mode === NormalizationMode.None) {
		return infos;
	}

	if (mode === NormalizationMode.Decompose || mode === NormalizationMode.Auto) {
		// Decompose precomposed characters
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

	return infos;
}
