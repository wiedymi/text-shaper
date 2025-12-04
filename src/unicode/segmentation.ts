/**
 * Unicode Text Segmentation (UAX #29)
 * Grapheme cluster and word boundaries
 */

import type { GlyphInfo } from "../types.ts";

/**
 * Grapheme cluster break property
 */
export enum GraphemeBreakProperty {
	Other = 0,
	CR = 1,
	LF = 2,
	Control = 3,
	Extend = 4,
	ZWJ = 5,
	Regional_Indicator = 6,
	Prepend = 7,
	SpacingMark = 8,
	L = 9, // Hangul L
	V = 10, // Hangul V
	T = 11, // Hangul T
	LV = 12, // Hangul LV
	LVT = 13, // Hangul LVT
	Extended_Pictographic = 14,
}

/**
 * Word break property
 */
export enum WordBreakProperty {
	Other = 0,
	CR = 1,
	LF = 2,
	Newline = 3,
	Extend = 4,
	ZWJ = 5,
	Regional_Indicator = 6,
	Format = 7,
	Katakana = 8,
	Hebrew_Letter = 9,
	ALetter = 10,
	Single_Quote = 11,
	Double_Quote = 12,
	MidNumLet = 13,
	MidLetter = 14,
	MidNum = 15,
	Numeric = 16,
	ExtendNumLet = 17,
	WSegSpace = 18,
	Extended_Pictographic = 19,
}

/**
 * Get grapheme break property for codepoint
 */
export function getGraphemeBreakProperty(cp: number): GraphemeBreakProperty {
	// CR, LF
	if (cp === 0x000d) return GraphemeBreakProperty.CR;
	if (cp === 0x000a) return GraphemeBreakProperty.LF;

	// Control characters
	if (cp >= 0x0000 && cp <= 0x001f && cp !== 0x000a && cp !== 0x000d)
		return GraphemeBreakProperty.Control;
	if (cp >= 0x007f && cp <= 0x009f) return GraphemeBreakProperty.Control;
	if (cp === 0x00ad) return GraphemeBreakProperty.Control; // Soft hyphen
	if (cp === 0x061c) return GraphemeBreakProperty.Control; // ALM
	if (cp === 0x180e) return GraphemeBreakProperty.Control;
	if (cp === 0x200b) return GraphemeBreakProperty.Control; // ZWSP
	if (cp >= 0x200e && cp <= 0x200f) return GraphemeBreakProperty.Control; // LRM, RLM
	if (cp >= 0x2028 && cp <= 0x202e) return GraphemeBreakProperty.Control;
	if (cp >= 0x2060 && cp <= 0x206f) return GraphemeBreakProperty.Control;
	if (cp === 0xfeff) return GraphemeBreakProperty.Control; // BOM
	if (cp >= 0xfff0 && cp <= 0xfffb) return GraphemeBreakProperty.Control;

	// ZWJ
	if (cp === 0x200d) return GraphemeBreakProperty.ZWJ;

	// Regional Indicator
	if (cp >= 0x1f1e0 && cp <= 0x1f1ff)
		return GraphemeBreakProperty.Regional_Indicator;

	// Prepend
	if (
		cp === 0x0600 ||
		cp === 0x0601 ||
		cp === 0x0602 ||
		cp === 0x0603 ||
		cp === 0x0604 ||
		cp === 0x0605 ||
		cp === 0x06dd ||
		cp === 0x070f ||
		cp === 0x0890 ||
		cp === 0x0891 ||
		cp === 0x08e2 ||
		cp === 0x110bd ||
		cp === 0x110cd
	)
		return GraphemeBreakProperty.Prepend;

	// Hangul L (Leading consonants)
	if (cp >= 0x1100 && cp <= 0x115f) return GraphemeBreakProperty.L;
	if (cp >= 0xa960 && cp <= 0xa97c) return GraphemeBreakProperty.L;

	// Hangul V (Vowels)
	if (cp >= 0x1160 && cp <= 0x11a7) return GraphemeBreakProperty.V;
	if (cp >= 0xd7b0 && cp <= 0xd7c6) return GraphemeBreakProperty.V;

	// Hangul T (Trailing consonants)
	if (cp >= 0x11a8 && cp <= 0x11ff) return GraphemeBreakProperty.T;
	if (cp >= 0xd7cb && cp <= 0xd7fb) return GraphemeBreakProperty.T;

	// Hangul syllables
	if (cp >= 0xac00 && cp <= 0xd7a3) {
		const sIndex = cp - 0xac00;
		if (sIndex % 28 === 0) return GraphemeBreakProperty.LV;
		return GraphemeBreakProperty.LVT;
	}

	// Extended Pictographic (Emoji)
	if (cp >= 0x1f300 && cp <= 0x1f9ff)
		return GraphemeBreakProperty.Extended_Pictographic;
	if (cp >= 0x1fa00 && cp <= 0x1faff)
		return GraphemeBreakProperty.Extended_Pictographic;
	if (cp >= 0x2600 && cp <= 0x26ff)
		return GraphemeBreakProperty.Extended_Pictographic;
	if (cp >= 0x2700 && cp <= 0x27bf)
		return GraphemeBreakProperty.Extended_Pictographic;
	if (cp === 0x00a9 || cp === 0x00ae)
		return GraphemeBreakProperty.Extended_Pictographic;
	if (cp >= 0x2300 && cp <= 0x23ff)
		return GraphemeBreakProperty.Extended_Pictographic;
	if (cp >= 0x1f000 && cp <= 0x1f02f)
		return GraphemeBreakProperty.Extended_Pictographic;
	if (cp >= 0x1f0a0 && cp <= 0x1f0ff)
		return GraphemeBreakProperty.Extended_Pictographic;
	if (cp >= 0x1f100 && cp <= 0x1f1ff)
		return GraphemeBreakProperty.Extended_Pictographic;
	if (cp >= 0x1f200 && cp <= 0x1f2ff)
		return GraphemeBreakProperty.Extended_Pictographic;

	// Spacing Mark
	if (cp >= 0x0903 && cp <= 0x0903) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x093b && cp <= 0x093b) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x093e && cp <= 0x0940) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0949 && cp <= 0x094c) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x094e && cp <= 0x094f) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0982 && cp <= 0x0983) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x09be && cp <= 0x09c0) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x09c7 && cp <= 0x09cc) return GraphemeBreakProperty.SpacingMark;
	if (cp === 0x09d7) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0a03 && cp <= 0x0a03) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0a3e && cp <= 0x0a40) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0a83 && cp <= 0x0a83) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0abe && cp <= 0x0ac0) return GraphemeBreakProperty.SpacingMark;
	if (cp === 0x0ac9) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0acb && cp <= 0x0acc) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0b02 && cp <= 0x0b03) return GraphemeBreakProperty.SpacingMark;
	if (cp === 0x0b3e) return GraphemeBreakProperty.SpacingMark;
	if (cp === 0x0b40) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0b47 && cp <= 0x0b4c) return GraphemeBreakProperty.SpacingMark;
	if (cp === 0x0b57) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0bbe && cp <= 0x0bbf) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0bc1 && cp <= 0x0bcc) return GraphemeBreakProperty.SpacingMark;
	if (cp === 0x0bd7) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0c01 && cp <= 0x0c03) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0c41 && cp <= 0x0c44) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0c82 && cp <= 0x0c83) return GraphemeBreakProperty.SpacingMark;
	if (cp === 0x0cbe) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0cc0 && cp <= 0x0cc4) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0cc7 && cp <= 0x0ccb) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0cd5 && cp <= 0x0cd6) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0d02 && cp <= 0x0d03) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0d3e && cp <= 0x0d40) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0d46 && cp <= 0x0d4c) return GraphemeBreakProperty.SpacingMark;
	if (cp === 0x0d57) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0d82 && cp <= 0x0d83) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0dcf && cp <= 0x0dd1) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0dd8 && cp <= 0x0ddf) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x0df2 && cp <= 0x0df3) return GraphemeBreakProperty.SpacingMark;
	if (cp === 0x0f3e || cp === 0x0f3f) return GraphemeBreakProperty.SpacingMark;
	if (cp === 0x0f7f) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x102b && cp <= 0x102c) return GraphemeBreakProperty.SpacingMark;
	if (cp === 0x1031) return GraphemeBreakProperty.SpacingMark;
	if (cp === 0x1038) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x103b && cp <= 0x103c) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x1056 && cp <= 0x1057) return GraphemeBreakProperty.SpacingMark;
	if (cp === 0x1062) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x1067 && cp <= 0x1068) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x1083 && cp <= 0x1084) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x1087 && cp <= 0x108c) return GraphemeBreakProperty.SpacingMark;
	if (cp === 0x108f) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x109a && cp <= 0x109c) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x17b6 && cp <= 0x17b6) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x17be && cp <= 0x17c5) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x17c7 && cp <= 0x17c8) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x1923 && cp <= 0x1926) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x1929 && cp <= 0x192b) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x1930 && cp <= 0x1931) return GraphemeBreakProperty.SpacingMark;
	if (cp >= 0x1933 && cp <= 0x1938) return GraphemeBreakProperty.SpacingMark;

	// Extend (combining marks, etc.)
	if (cp >= 0x0300 && cp <= 0x036f) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0483 && cp <= 0x0489) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0591 && cp <= 0x05bd) return GraphemeBreakProperty.Extend;
	if (cp === 0x05bf) return GraphemeBreakProperty.Extend;
	if (cp >= 0x05c1 && cp <= 0x05c2) return GraphemeBreakProperty.Extend;
	if (cp >= 0x05c4 && cp <= 0x05c5) return GraphemeBreakProperty.Extend;
	if (cp === 0x05c7) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0610 && cp <= 0x061a) return GraphemeBreakProperty.Extend;
	if (cp >= 0x064b && cp <= 0x065f) return GraphemeBreakProperty.Extend;
	if (cp === 0x0670) return GraphemeBreakProperty.Extend;
	if (cp >= 0x06d6 && cp <= 0x06dc) return GraphemeBreakProperty.Extend;
	if (cp >= 0x06df && cp <= 0x06e4) return GraphemeBreakProperty.Extend;
	if (cp >= 0x06e7 && cp <= 0x06e8) return GraphemeBreakProperty.Extend;
	if (cp >= 0x06ea && cp <= 0x06ed) return GraphemeBreakProperty.Extend;
	if (cp === 0x0711) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0730 && cp <= 0x074a) return GraphemeBreakProperty.Extend;
	if (cp >= 0x07a6 && cp <= 0x07b0) return GraphemeBreakProperty.Extend;
	if (cp >= 0x07eb && cp <= 0x07f3) return GraphemeBreakProperty.Extend;
	if (cp === 0x07fd) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0816 && cp <= 0x0819) return GraphemeBreakProperty.Extend;
	if (cp >= 0x081b && cp <= 0x0823) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0825 && cp <= 0x0827) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0829 && cp <= 0x082d) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0859 && cp <= 0x085b) return GraphemeBreakProperty.Extend;
	if (cp >= 0x08d3 && cp <= 0x08e1) return GraphemeBreakProperty.Extend;
	if (cp >= 0x08e3 && cp <= 0x0902) return GraphemeBreakProperty.Extend;
	if (cp === 0x093a) return GraphemeBreakProperty.Extend;
	if (cp === 0x093c) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0941 && cp <= 0x0948) return GraphemeBreakProperty.Extend;
	if (cp === 0x094d) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0951 && cp <= 0x0957) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0962 && cp <= 0x0963) return GraphemeBreakProperty.Extend;
	if (cp === 0x0981) return GraphemeBreakProperty.Extend;
	if (cp === 0x09bc) return GraphemeBreakProperty.Extend;
	if (cp >= 0x09c1 && cp <= 0x09c4) return GraphemeBreakProperty.Extend;
	if (cp === 0x09cd) return GraphemeBreakProperty.Extend;
	if (cp >= 0x09e2 && cp <= 0x09e3) return GraphemeBreakProperty.Extend;
	if (cp === 0x09fe) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0a01 && cp <= 0x0a02) return GraphemeBreakProperty.Extend;
	if (cp === 0x0a3c) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0a41 && cp <= 0x0a42) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0a47 && cp <= 0x0a48) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0a4b && cp <= 0x0a4d) return GraphemeBreakProperty.Extend;
	if (cp === 0x0a51) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0a70 && cp <= 0x0a71) return GraphemeBreakProperty.Extend;
	if (cp === 0x0a75) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0a81 && cp <= 0x0a82) return GraphemeBreakProperty.Extend;
	if (cp === 0x0abc) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0ac1 && cp <= 0x0ac5) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0ac7 && cp <= 0x0ac8) return GraphemeBreakProperty.Extend;
	if (cp === 0x0acd) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0ae2 && cp <= 0x0ae3) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0afa && cp <= 0x0aff) return GraphemeBreakProperty.Extend;
	if (cp === 0x0b01) return GraphemeBreakProperty.Extend;
	if (cp === 0x0b3c) return GraphemeBreakProperty.Extend;
	if (cp === 0x0b3f) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0b41 && cp <= 0x0b44) return GraphemeBreakProperty.Extend;
	if (cp === 0x0b4d) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0b55 && cp <= 0x0b56) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0b62 && cp <= 0x0b63) return GraphemeBreakProperty.Extend;
	if (cp === 0x0b82) return GraphemeBreakProperty.Extend;
	if (cp === 0x0bc0) return GraphemeBreakProperty.Extend;
	if (cp === 0x0bcd) return GraphemeBreakProperty.Extend;
	if (cp === 0x0c00) return GraphemeBreakProperty.Extend;
	if (cp === 0x0c04) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0c3e && cp <= 0x0c40) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0c46 && cp <= 0x0c48) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0c4a && cp <= 0x0c4d) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0c55 && cp <= 0x0c56) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0c62 && cp <= 0x0c63) return GraphemeBreakProperty.Extend;
	if (cp === 0x0c81) return GraphemeBreakProperty.Extend;
	if (cp === 0x0cbc) return GraphemeBreakProperty.Extend;
	if (cp === 0x0cbf) return GraphemeBreakProperty.Extend;
	if (cp === 0x0cc6) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0ccc && cp <= 0x0ccd) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0ce2 && cp <= 0x0ce3) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0d00 && cp <= 0x0d01) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0d3b && cp <= 0x0d3c) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0d41 && cp <= 0x0d44) return GraphemeBreakProperty.Extend;
	if (cp === 0x0d4d) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0d62 && cp <= 0x0d63) return GraphemeBreakProperty.Extend;
	if (cp === 0x0d81) return GraphemeBreakProperty.Extend;
	if (cp === 0x0dca) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0dd2 && cp <= 0x0dd4) return GraphemeBreakProperty.Extend;
	if (cp === 0x0dd6) return GraphemeBreakProperty.Extend;
	if (cp === 0x0e31) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0e34 && cp <= 0x0e3a) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0e47 && cp <= 0x0e4e) return GraphemeBreakProperty.Extend;
	if (cp === 0x0eb1) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0eb4 && cp <= 0x0ebc) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0ec8 && cp <= 0x0ecd) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0f18 && cp <= 0x0f19) return GraphemeBreakProperty.Extend;
	if (cp === 0x0f35) return GraphemeBreakProperty.Extend;
	if (cp === 0x0f37) return GraphemeBreakProperty.Extend;
	if (cp === 0x0f39) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0f71 && cp <= 0x0f7e) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0f80 && cp <= 0x0f84) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0f86 && cp <= 0x0f87) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0f8d && cp <= 0x0f97) return GraphemeBreakProperty.Extend;
	if (cp >= 0x0f99 && cp <= 0x0fbc) return GraphemeBreakProperty.Extend;
	if (cp === 0x0fc6) return GraphemeBreakProperty.Extend;
	if (cp >= 0x102d && cp <= 0x1030) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1032 && cp <= 0x1037) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1039 && cp <= 0x103a) return GraphemeBreakProperty.Extend;
	if (cp >= 0x103d && cp <= 0x103e) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1058 && cp <= 0x1059) return GraphemeBreakProperty.Extend;
	if (cp >= 0x105e && cp <= 0x1060) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1071 && cp <= 0x1074) return GraphemeBreakProperty.Extend;
	if (cp === 0x1082) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1085 && cp <= 0x1086) return GraphemeBreakProperty.Extend;
	if (cp === 0x108d) return GraphemeBreakProperty.Extend;
	if (cp === 0x109d) return GraphemeBreakProperty.Extend;
	if (cp >= 0x135d && cp <= 0x135f) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1712 && cp <= 0x1714) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1732 && cp <= 0x1734) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1752 && cp <= 0x1753) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1772 && cp <= 0x1773) return GraphemeBreakProperty.Extend;
	if (cp >= 0x17b4 && cp <= 0x17b5) return GraphemeBreakProperty.Extend;
	if (cp >= 0x17b7 && cp <= 0x17bd) return GraphemeBreakProperty.Extend;
	if (cp === 0x17c6) return GraphemeBreakProperty.Extend;
	if (cp >= 0x17c9 && cp <= 0x17d3) return GraphemeBreakProperty.Extend;
	if (cp === 0x17dd) return GraphemeBreakProperty.Extend;
	if (cp >= 0x180b && cp <= 0x180d) return GraphemeBreakProperty.Extend;
	if (cp === 0x180f) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1885 && cp <= 0x1886) return GraphemeBreakProperty.Extend;
	if (cp === 0x18a9) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1920 && cp <= 0x1922) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1927 && cp <= 0x1928) return GraphemeBreakProperty.Extend;
	if (cp === 0x1932) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1939 && cp <= 0x193b) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1a17 && cp <= 0x1a18) return GraphemeBreakProperty.Extend;
	if (cp === 0x1a1b) return GraphemeBreakProperty.Extend;
	if (cp === 0x1a56) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1a58 && cp <= 0x1a5e) return GraphemeBreakProperty.Extend;
	if (cp === 0x1a60) return GraphemeBreakProperty.Extend;
	if (cp === 0x1a62) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1a65 && cp <= 0x1a6c) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1a73 && cp <= 0x1a7c) return GraphemeBreakProperty.Extend;
	if (cp === 0x1a7f) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1ab0 && cp <= 0x1ace) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1b00 && cp <= 0x1b03) return GraphemeBreakProperty.Extend;
	if (cp === 0x1b34) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1b36 && cp <= 0x1b3a) return GraphemeBreakProperty.Extend;
	if (cp === 0x1b3c) return GraphemeBreakProperty.Extend;
	if (cp === 0x1b42) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1b6b && cp <= 0x1b73) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1b80 && cp <= 0x1b81) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1ba2 && cp <= 0x1ba5) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1ba8 && cp <= 0x1ba9) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1bab && cp <= 0x1bad) return GraphemeBreakProperty.Extend;
	if (cp === 0x1be6) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1be8 && cp <= 0x1be9) return GraphemeBreakProperty.Extend;
	if (cp === 0x1bed) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1bef && cp <= 0x1bf1) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1c2c && cp <= 0x1c33) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1c36 && cp <= 0x1c37) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1cd0 && cp <= 0x1cd2) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1cd4 && cp <= 0x1ce0) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1ce2 && cp <= 0x1ce8) return GraphemeBreakProperty.Extend;
	if (cp === 0x1ced) return GraphemeBreakProperty.Extend;
	if (cp === 0x1cf4) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1cf8 && cp <= 0x1cf9) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1dc0 && cp <= 0x1dff) return GraphemeBreakProperty.Extend;
	if (cp >= 0x20d0 && cp <= 0x20f0) return GraphemeBreakProperty.Extend;
	if (cp >= 0x2cef && cp <= 0x2cf1) return GraphemeBreakProperty.Extend;
	if (cp === 0x2d7f) return GraphemeBreakProperty.Extend;
	if (cp >= 0x2de0 && cp <= 0x2dff) return GraphemeBreakProperty.Extend;
	if (cp >= 0x302a && cp <= 0x302f) return GraphemeBreakProperty.Extend;
	if (cp >= 0x3099 && cp <= 0x309a) return GraphemeBreakProperty.Extend;
	if (cp >= 0xa66f && cp <= 0xa672) return GraphemeBreakProperty.Extend;
	if (cp >= 0xa674 && cp <= 0xa67d) return GraphemeBreakProperty.Extend;
	if (cp >= 0xa69e && cp <= 0xa69f) return GraphemeBreakProperty.Extend;
	if (cp >= 0xa6f0 && cp <= 0xa6f1) return GraphemeBreakProperty.Extend;
	if (cp === 0xa802) return GraphemeBreakProperty.Extend;
	if (cp === 0xa806) return GraphemeBreakProperty.Extend;
	if (cp === 0xa80b) return GraphemeBreakProperty.Extend;
	if (cp >= 0xa825 && cp <= 0xa826) return GraphemeBreakProperty.Extend;
	if (cp === 0xa82c) return GraphemeBreakProperty.Extend;
	if (cp >= 0xa8c4 && cp <= 0xa8c5) return GraphemeBreakProperty.Extend;
	if (cp >= 0xa8e0 && cp <= 0xa8f1) return GraphemeBreakProperty.Extend;
	if (cp === 0xa8ff) return GraphemeBreakProperty.Extend;
	if (cp >= 0xa926 && cp <= 0xa92d) return GraphemeBreakProperty.Extend;
	if (cp >= 0xa947 && cp <= 0xa951) return GraphemeBreakProperty.Extend;
	if (cp >= 0xa980 && cp <= 0xa982) return GraphemeBreakProperty.Extend;
	if (cp === 0xa9b3) return GraphemeBreakProperty.Extend;
	if (cp >= 0xa9b6 && cp <= 0xa9b9) return GraphemeBreakProperty.Extend;
	if (cp >= 0xa9bc && cp <= 0xa9bd) return GraphemeBreakProperty.Extend;
	if (cp === 0xa9e5) return GraphemeBreakProperty.Extend;
	if (cp >= 0xaa29 && cp <= 0xaa2e) return GraphemeBreakProperty.Extend;
	if (cp >= 0xaa31 && cp <= 0xaa32) return GraphemeBreakProperty.Extend;
	if (cp >= 0xaa35 && cp <= 0xaa36) return GraphemeBreakProperty.Extend;
	if (cp === 0xaa43) return GraphemeBreakProperty.Extend;
	if (cp === 0xaa4c) return GraphemeBreakProperty.Extend;
	if (cp === 0xaa7c) return GraphemeBreakProperty.Extend;
	if (cp === 0xaab0) return GraphemeBreakProperty.Extend;
	if (cp >= 0xaab2 && cp <= 0xaab4) return GraphemeBreakProperty.Extend;
	if (cp >= 0xaab7 && cp <= 0xaab8) return GraphemeBreakProperty.Extend;
	if (cp >= 0xaabe && cp <= 0xaabf) return GraphemeBreakProperty.Extend;
	if (cp === 0xaac1) return GraphemeBreakProperty.Extend;
	if (cp >= 0xaaec && cp <= 0xaaed) return GraphemeBreakProperty.Extend;
	if (cp === 0xaaf6) return GraphemeBreakProperty.Extend;
	if (cp === 0xabe5) return GraphemeBreakProperty.Extend;
	if (cp === 0xabe8) return GraphemeBreakProperty.Extend;
	if (cp === 0xabed) return GraphemeBreakProperty.Extend;
	if (cp === 0xfb1e) return GraphemeBreakProperty.Extend;
	if (cp >= 0xfe00 && cp <= 0xfe0f) return GraphemeBreakProperty.Extend;
	if (cp >= 0xfe20 && cp <= 0xfe2f) return GraphemeBreakProperty.Extend;
	if (cp >= 0x1f3fb && cp <= 0x1f3ff) return GraphemeBreakProperty.Extend; // Emoji modifiers
	if (cp >= 0xe0100 && cp <= 0xe01ef) return GraphemeBreakProperty.Extend; // Variation selectors

	return GraphemeBreakProperty.Other;
}

/**
 * Get word break property for codepoint
 */
export function getWordBreakProperty(cp: number): WordBreakProperty {
	// CR, LF, Newline
	if (cp === 0x000d) return WordBreakProperty.CR;
	if (cp === 0x000a) return WordBreakProperty.LF;
	if (
		cp === 0x000b ||
		cp === 0x000c ||
		cp === 0x0085 ||
		cp === 0x2028 ||
		cp === 0x2029
	)
		return WordBreakProperty.Newline;

	// ZWJ
	if (cp === 0x200d) return WordBreakProperty.ZWJ;

	// Format characters
	if (cp === 0x00ad) return WordBreakProperty.Format;
	if (cp === 0x061c) return WordBreakProperty.Format;
	if (cp === 0x200b) return WordBreakProperty.Format;
	if (cp >= 0x200e && cp <= 0x200f) return WordBreakProperty.Format;
	if (cp >= 0x2060 && cp <= 0x206f) return WordBreakProperty.Format;
	if (cp === 0xfeff) return WordBreakProperty.Format;

	// Regional Indicator
	if (cp >= 0x1f1e0 && cp <= 0x1f1ff)
		return WordBreakProperty.Regional_Indicator;

	// Extended Pictographic
	if (cp >= 0x1f300 && cp <= 0x1f9ff)
		return WordBreakProperty.Extended_Pictographic;
	if (cp >= 0x1fa00 && cp <= 0x1faff)
		return WordBreakProperty.Extended_Pictographic;
	if (cp >= 0x2600 && cp <= 0x26ff)
		return WordBreakProperty.Extended_Pictographic;
	if (cp >= 0x2700 && cp <= 0x27bf)
		return WordBreakProperty.Extended_Pictographic;

	// Hebrew Letter
	if (cp >= 0x05d0 && cp <= 0x05ea) return WordBreakProperty.Hebrew_Letter;
	if (cp >= 0xfb1d && cp <= 0xfb4f) return WordBreakProperty.Hebrew_Letter;

	// Katakana
	if (cp >= 0x30a0 && cp <= 0x30ff) return WordBreakProperty.Katakana;
	if (
		cp === 0x3031 ||
		cp === 0x3032 ||
		cp === 0x3033 ||
		cp === 0x3034 ||
		cp === 0x3035
	)
		return WordBreakProperty.Katakana;
	if (cp === 0x309b || cp === 0x309c) return WordBreakProperty.Katakana;
	if (cp >= 0x31f0 && cp <= 0x31ff) return WordBreakProperty.Katakana;
	if (cp >= 0x32d0 && cp <= 0x32fe) return WordBreakProperty.Katakana;
	if (cp >= 0x3300 && cp <= 0x3357) return WordBreakProperty.Katakana;
	if (cp >= 0xff66 && cp <= 0xff9d) return WordBreakProperty.Katakana;

	// Single Quote
	if (cp === 0x0027) return WordBreakProperty.Single_Quote;

	// Double Quote
	if (cp === 0x0022) return WordBreakProperty.Double_Quote;

	// MidNumLet
	if (cp === 0x002e) return WordBreakProperty.MidNumLet; // .
	if (cp === 0x2018 || cp === 0x2019) return WordBreakProperty.MidNumLet;
	if (cp === 0x2024) return WordBreakProperty.MidNumLet;
	if (cp === 0xfe52) return WordBreakProperty.MidNumLet;
	if (cp === 0xff07) return WordBreakProperty.MidNumLet;
	if (cp === 0xff0e) return WordBreakProperty.MidNumLet;

	// MidLetter
	if (cp === 0x003a) return WordBreakProperty.MidLetter; // :
	if (cp === 0x00b7) return WordBreakProperty.MidLetter;
	if (cp === 0x0387) return WordBreakProperty.MidLetter;
	if (cp === 0x05f4) return WordBreakProperty.MidLetter;
	if (cp === 0x2027) return WordBreakProperty.MidLetter;
	if (cp === 0xfe13) return WordBreakProperty.MidLetter;
	if (cp === 0xfe55) return WordBreakProperty.MidLetter;
	if (cp === 0xff1a) return WordBreakProperty.MidLetter;

	// MidNum
	if (cp === 0x002c) return WordBreakProperty.MidNum; // ,
	if (cp === 0x003b) return WordBreakProperty.MidNum; // ;
	if (cp === 0x037e) return WordBreakProperty.MidNum;
	if (cp === 0x0589) return WordBreakProperty.MidNum;
	if (cp === 0x060c || cp === 0x060d) return WordBreakProperty.MidNum;
	if (cp === 0x066c) return WordBreakProperty.MidNum;
	if (cp === 0x07f8) return WordBreakProperty.MidNum;
	if (cp === 0x2044) return WordBreakProperty.MidNum;
	if (cp === 0xfe10) return WordBreakProperty.MidNum;
	if (cp === 0xfe14) return WordBreakProperty.MidNum;
	if (cp === 0xfe50) return WordBreakProperty.MidNum;
	if (cp === 0xfe54) return WordBreakProperty.MidNum;
	if (cp === 0xff0c) return WordBreakProperty.MidNum;
	if (cp === 0xff1b) return WordBreakProperty.MidNum;

	// Numeric
	if (cp >= 0x0030 && cp <= 0x0039) return WordBreakProperty.Numeric;
	if (cp >= 0x0660 && cp <= 0x0669) return WordBreakProperty.Numeric;
	if (cp >= 0x06f0 && cp <= 0x06f9) return WordBreakProperty.Numeric;
	if (cp >= 0x07c0 && cp <= 0x07c9) return WordBreakProperty.Numeric;
	if (cp >= 0x0966 && cp <= 0x096f) return WordBreakProperty.Numeric;
	if (cp >= 0x09e6 && cp <= 0x09ef) return WordBreakProperty.Numeric;
	if (cp >= 0x0a66 && cp <= 0x0a6f) return WordBreakProperty.Numeric;
	if (cp >= 0x0ae6 && cp <= 0x0aef) return WordBreakProperty.Numeric;
	if (cp >= 0x0b66 && cp <= 0x0b6f) return WordBreakProperty.Numeric;
	if (cp >= 0x0be6 && cp <= 0x0bef) return WordBreakProperty.Numeric;
	if (cp >= 0x0c66 && cp <= 0x0c6f) return WordBreakProperty.Numeric;
	if (cp >= 0x0ce6 && cp <= 0x0cef) return WordBreakProperty.Numeric;
	if (cp >= 0x0d66 && cp <= 0x0d6f) return WordBreakProperty.Numeric;
	if (cp >= 0x0de6 && cp <= 0x0def) return WordBreakProperty.Numeric;
	if (cp >= 0x0e50 && cp <= 0x0e59) return WordBreakProperty.Numeric;
	if (cp >= 0x0ed0 && cp <= 0x0ed9) return WordBreakProperty.Numeric;
	if (cp >= 0x0f20 && cp <= 0x0f29) return WordBreakProperty.Numeric;
	if (cp >= 0x1040 && cp <= 0x1049) return WordBreakProperty.Numeric;
	if (cp >= 0x1090 && cp <= 0x1099) return WordBreakProperty.Numeric;
	if (cp >= 0x17e0 && cp <= 0x17e9) return WordBreakProperty.Numeric;
	if (cp >= 0x1810 && cp <= 0x1819) return WordBreakProperty.Numeric;
	if (cp >= 0x1946 && cp <= 0x194f) return WordBreakProperty.Numeric;
	if (cp >= 0x19d0 && cp <= 0x19d9) return WordBreakProperty.Numeric;
	if (cp >= 0x1a80 && cp <= 0x1a89) return WordBreakProperty.Numeric;
	if (cp >= 0x1a90 && cp <= 0x1a99) return WordBreakProperty.Numeric;
	if (cp >= 0x1b50 && cp <= 0x1b59) return WordBreakProperty.Numeric;
	if (cp >= 0x1bb0 && cp <= 0x1bb9) return WordBreakProperty.Numeric;
	if (cp >= 0x1c40 && cp <= 0x1c49) return WordBreakProperty.Numeric;
	if (cp >= 0x1c50 && cp <= 0x1c59) return WordBreakProperty.Numeric;
	if (cp >= 0xa620 && cp <= 0xa629) return WordBreakProperty.Numeric;
	if (cp >= 0xa8d0 && cp <= 0xa8d9) return WordBreakProperty.Numeric;
	if (cp >= 0xa900 && cp <= 0xa909) return WordBreakProperty.Numeric;
	if (cp >= 0xa9d0 && cp <= 0xa9d9) return WordBreakProperty.Numeric;
	if (cp >= 0xa9f0 && cp <= 0xa9f9) return WordBreakProperty.Numeric;
	if (cp >= 0xaa50 && cp <= 0xaa59) return WordBreakProperty.Numeric;
	if (cp >= 0xabf0 && cp <= 0xabf9) return WordBreakProperty.Numeric;
	if (cp >= 0xff10 && cp <= 0xff19) return WordBreakProperty.Numeric;

	// ExtendNumLet
	if (cp === 0x005f) return WordBreakProperty.ExtendNumLet; // _
	if (cp === 0x202f) return WordBreakProperty.ExtendNumLet;
	if (cp === 0x2040) return WordBreakProperty.ExtendNumLet;
	if (cp === 0x2054) return WordBreakProperty.ExtendNumLet;
	if (cp === 0xfe33 || cp === 0xfe34) return WordBreakProperty.ExtendNumLet;
	if (cp >= 0xfe4d && cp <= 0xfe4f) return WordBreakProperty.ExtendNumLet;
	if (cp === 0xff3f) return WordBreakProperty.ExtendNumLet;

	// WSegSpace
	if (cp === 0x0020) return WordBreakProperty.WSegSpace;
	if (cp === 0x1680) return WordBreakProperty.WSegSpace;
	if (cp >= 0x2000 && cp <= 0x200a && cp !== 0x2007)
		return WordBreakProperty.WSegSpace;
	if (cp === 0x205f) return WordBreakProperty.WSegSpace;
	if (cp === 0x3000) return WordBreakProperty.WSegSpace;

	// Extend (same as grapheme extend)
	const gbp = getGraphemeBreakProperty(cp);
	if (gbp === GraphemeBreakProperty.Extend) return WordBreakProperty.Extend;

	// ALetter (alphabetic)
	if (cp >= 0x0041 && cp <= 0x005a) return WordBreakProperty.ALetter;
	if (cp >= 0x0061 && cp <= 0x007a) return WordBreakProperty.ALetter;
	if (cp >= 0x00c0 && cp <= 0x00d6) return WordBreakProperty.ALetter;
	if (cp >= 0x00d8 && cp <= 0x00f6) return WordBreakProperty.ALetter;
	if (cp >= 0x00f8 && cp <= 0x024f) return WordBreakProperty.ALetter;
	if (cp >= 0x0250 && cp <= 0x02af) return WordBreakProperty.ALetter;
	if (cp >= 0x0370 && cp <= 0x03ff) return WordBreakProperty.ALetter;
	if (cp >= 0x0400 && cp <= 0x04ff) return WordBreakProperty.ALetter;
	if (cp >= 0x0500 && cp <= 0x052f) return WordBreakProperty.ALetter;
	if (cp >= 0x0531 && cp <= 0x0556) return WordBreakProperty.ALetter;
	if (cp >= 0x0560 && cp <= 0x0588) return WordBreakProperty.ALetter;
	if (cp >= 0x0600 && cp <= 0x06ff) return WordBreakProperty.ALetter;
	if (cp >= 0x0900 && cp <= 0x097f) return WordBreakProperty.ALetter;
	if (cp >= 0x0980 && cp <= 0x09ff) return WordBreakProperty.ALetter;
	if (cp >= 0x0a00 && cp <= 0x0a7f) return WordBreakProperty.ALetter;
	if (cp >= 0x0a80 && cp <= 0x0aff) return WordBreakProperty.ALetter;
	if (cp >= 0x0b00 && cp <= 0x0b7f) return WordBreakProperty.ALetter;
	if (cp >= 0x0b80 && cp <= 0x0bff) return WordBreakProperty.ALetter;
	if (cp >= 0x0c00 && cp <= 0x0c7f) return WordBreakProperty.ALetter;
	if (cp >= 0x0c80 && cp <= 0x0cff) return WordBreakProperty.ALetter;
	if (cp >= 0x0d00 && cp <= 0x0d7f) return WordBreakProperty.ALetter;
	if (cp >= 0x0e00 && cp <= 0x0e7f) return WordBreakProperty.ALetter;
	if (cp >= 0x0e80 && cp <= 0x0eff) return WordBreakProperty.ALetter;
	if (cp >= 0x1000 && cp <= 0x109f) return WordBreakProperty.ALetter;
	if (cp >= 0x10a0 && cp <= 0x10ff) return WordBreakProperty.ALetter;
	if (cp >= 0x1100 && cp <= 0x11ff) return WordBreakProperty.ALetter;
	if (cp >= 0x1780 && cp <= 0x17ff) return WordBreakProperty.ALetter;
	if (cp >= 0x3040 && cp <= 0x309f) return WordBreakProperty.ALetter; // Hiragana
	if (cp >= 0x1f00 && cp <= 0x1fff) return WordBreakProperty.ALetter;
	if (cp >= 0x2c00 && cp <= 0x2c5f) return WordBreakProperty.ALetter;
	if (cp >= 0xa000 && cp <= 0xa48f) return WordBreakProperty.ALetter;
	if (cp >= 0xa4d0 && cp <= 0xa4ff) return WordBreakProperty.ALetter;
	if (cp >= 0xa500 && cp <= 0xa63f) return WordBreakProperty.ALetter;
	if (cp >= 0xa640 && cp <= 0xa69f) return WordBreakProperty.ALetter;
	if (cp >= 0xa720 && cp <= 0xa7ff) return WordBreakProperty.ALetter;
	if (cp >= 0xab00 && cp <= 0xab6f) return WordBreakProperty.ALetter;
	if (cp >= 0xac00 && cp <= 0xd7af) return WordBreakProperty.ALetter; // Hangul
	if (cp >= 0xfb00 && cp <= 0xfb06) return WordBreakProperty.ALetter;
	if (cp >= 0xff21 && cp <= 0xff3a) return WordBreakProperty.ALetter;
	if (cp >= 0xff41 && cp <= 0xff5a) return WordBreakProperty.ALetter;

	return WordBreakProperty.Other;
}

/**
 * Grapheme cluster boundary result
 */
export interface GraphemeBoundaries {
	/** Boundary positions (indices where clusters end) */
	boundaries: number[];
	/** Grapheme break properties */
	properties: GraphemeBreakProperty[];
}

/**
 * Find grapheme cluster boundaries in codepoints
 */
export function findGraphemeBoundaries(
	codepoints: number[],
): GraphemeBoundaries {
	const len = codepoints.length;
	const properties: GraphemeBreakProperty[] = [];
	const boundaries: number[] = [];

	for (const cp of codepoints) {
		properties.push(getGraphemeBreakProperty(cp));
	}

	if (len === 0) return { boundaries, properties };

	// GB1: Break at the start of text
	// (implicitly handled)

	// Track state for RI pairs
	let riCount = 0;
	let inExtendedPictographicSequence = false;

	for (let i = 1; i < len; i++) {
		const prev = properties[i - 1];
		const curr = properties[i];

		let shouldBreak = true;

		// GB3: Do not break between a CR and LF
		if (
			prev === GraphemeBreakProperty.CR &&
			curr === GraphemeBreakProperty.LF
		) {
			shouldBreak = false;
		}
		// GB4: Break after controls
		else if (
			prev === GraphemeBreakProperty.Control ||
			prev === GraphemeBreakProperty.CR ||
			prev === GraphemeBreakProperty.LF
		) {
			shouldBreak = true;
		}
		// GB5: Break before controls
		else if (
			curr === GraphemeBreakProperty.Control ||
			curr === GraphemeBreakProperty.CR ||
			curr === GraphemeBreakProperty.LF
		) {
			shouldBreak = true;
		}
		// GB6: Do not break Hangul syllable sequences
		else if (
			prev === GraphemeBreakProperty.L &&
			(curr === GraphemeBreakProperty.L ||
				curr === GraphemeBreakProperty.V ||
				curr === GraphemeBreakProperty.LV ||
				curr === GraphemeBreakProperty.LVT)
		) {
			shouldBreak = false;
		}
		// GB7
		else if (
			(prev === GraphemeBreakProperty.LV || prev === GraphemeBreakProperty.V) &&
			(curr === GraphemeBreakProperty.V || curr === GraphemeBreakProperty.T)
		) {
			shouldBreak = false;
		}
		// GB8
		else if (
			(prev === GraphemeBreakProperty.LVT ||
				prev === GraphemeBreakProperty.T) &&
			curr === GraphemeBreakProperty.T
		) {
			shouldBreak = false;
		}
		// GB9: Do not break before extending characters or ZWJ
		else if (
			curr === GraphemeBreakProperty.Extend ||
			curr === GraphemeBreakProperty.ZWJ
		) {
			shouldBreak = false;
		}
		// GB9a: Do not break before SpacingMarks
		else if (curr === GraphemeBreakProperty.SpacingMark) {
			shouldBreak = false;
		}
		// GB9b: Do not break after Prepend characters
		else if (prev === GraphemeBreakProperty.Prepend) {
			shouldBreak = false;
		}
		// GB11: Do not break within emoji modifier sequences or emoji ZWJ sequences
		else if (
			inExtendedPictographicSequence &&
			prev === GraphemeBreakProperty.ZWJ &&
			curr === GraphemeBreakProperty.Extended_Pictographic
		) {
			shouldBreak = false;
		}
		// GB12-13: Do not break within emoji flag sequences
		else if (
			prev === GraphemeBreakProperty.Regional_Indicator &&
			curr === GraphemeBreakProperty.Regional_Indicator
		) {
			// Only break after even number of RIs
			if (riCount % 2 === 1) {
				shouldBreak = false;
			}
		}

		// Track extended pictographic state
		if (curr === GraphemeBreakProperty.Extended_Pictographic) {
			inExtendedPictographicSequence = true;
		} else if (
			curr !== GraphemeBreakProperty.Extend &&
			curr !== GraphemeBreakProperty.ZWJ
		) {
			inExtendedPictographicSequence = false;
		}

		// Track RI count
		if (curr === GraphemeBreakProperty.Regional_Indicator) {
			riCount++;
		} else {
			riCount = 0;
		}

		if (shouldBreak) {
			boundaries.push(i);
		}
	}

	// GB2: Break at the end of text
	boundaries.push(len);

	return { boundaries, properties };
}

/**
 * Word boundary result
 */
export interface WordBoundaries {
	/** Boundary positions */
	boundaries: number[];
	/** Word break properties */
	properties: WordBreakProperty[];
}

/**
 * Find word boundaries in codepoints
 */
export function findWordBoundaries(codepoints: number[]): WordBoundaries {
	const len = codepoints.length;
	const properties: WordBreakProperty[] = [];
	const boundaries: number[] = [];

	for (const cp of codepoints) {
		properties.push(getWordBreakProperty(cp));
	}

	if (len === 0) return { boundaries, properties };

	// WB1: Break at the start
	boundaries.push(0);

	let riCount = 0;

	for (let i = 1; i < len; i++) {
		const prev = properties[i - 1];
		const curr = properties[i];

		let shouldBreak = true;

		// WB3: Do not break within CRLF
		if (prev === WordBreakProperty.CR && curr === WordBreakProperty.LF) {
			shouldBreak = false;
		}
		// WB3a-b: Break before and after Newlines
		else if (
			prev === WordBreakProperty.Newline ||
			prev === WordBreakProperty.CR ||
			prev === WordBreakProperty.LF
		) {
			shouldBreak = true;
		} else if (
			curr === WordBreakProperty.Newline ||
			curr === WordBreakProperty.CR ||
			curr === WordBreakProperty.LF
		) {
			shouldBreak = true;
		}
		// WB3c: Do not break within emoji ZWJ sequences
		else if (
			prev === WordBreakProperty.ZWJ &&
			curr === WordBreakProperty.Extended_Pictographic
		) {
			shouldBreak = false;
		}
		// WB3d: Keep horizontal whitespace together
		else if (
			prev === WordBreakProperty.WSegSpace &&
			curr === WordBreakProperty.WSegSpace
		) {
			shouldBreak = false;
		}
		// WB4: Ignore Format and Extend characters
		else if (
			curr === WordBreakProperty.Format ||
			curr === WordBreakProperty.Extend ||
			curr === WordBreakProperty.ZWJ
		) {
			shouldBreak = false;
		}
		// WB5: Do not break between most letters
		else if (
			(prev === WordBreakProperty.ALetter ||
				prev === WordBreakProperty.Hebrew_Letter) &&
			(curr === WordBreakProperty.ALetter ||
				curr === WordBreakProperty.Hebrew_Letter)
		) {
			shouldBreak = false;
		}
		// WB6-7: Do not break letters across certain punctuation
		else if (
			(prev === WordBreakProperty.ALetter ||
				prev === WordBreakProperty.Hebrew_Letter) &&
			(curr === WordBreakProperty.MidLetter ||
				curr === WordBreakProperty.MidNumLet ||
				curr === WordBreakProperty.Single_Quote)
		) {
			// Look ahead
			if (i + 1 < len) {
				const next = properties[i + 1];
				if (
					next === WordBreakProperty.ALetter ||
					next === WordBreakProperty.Hebrew_Letter
				) {
					shouldBreak = false;
				}
			}
		}
		// WB8-10: Do not break within sequences of digits
		else if (
			prev === WordBreakProperty.Numeric &&
			curr === WordBreakProperty.Numeric
		) {
			shouldBreak = false;
		} else if (
			(prev === WordBreakProperty.ALetter ||
				prev === WordBreakProperty.Hebrew_Letter) &&
			curr === WordBreakProperty.Numeric
		) {
			shouldBreak = false;
		} else if (
			prev === WordBreakProperty.Numeric &&
			(curr === WordBreakProperty.ALetter ||
				curr === WordBreakProperty.Hebrew_Letter)
		) {
			shouldBreak = false;
		}
		// WB11-12: Do not break within sequences with numeric separators
		else if (
			prev === WordBreakProperty.Numeric &&
			(curr === WordBreakProperty.MidNum ||
				curr === WordBreakProperty.MidNumLet ||
				curr === WordBreakProperty.Single_Quote)
		) {
			if (i + 1 < len && properties[i + 1] === WordBreakProperty.Numeric) {
				shouldBreak = false;
			}
		}
		// WB13: Do not break between Katakana
		else if (
			prev === WordBreakProperty.Katakana &&
			curr === WordBreakProperty.Katakana
		) {
			shouldBreak = false;
		}
		// WB13a-b: ExtendNumLet binding
		else if (
			(prev === WordBreakProperty.ALetter ||
				prev === WordBreakProperty.Hebrew_Letter ||
				prev === WordBreakProperty.Numeric ||
				prev === WordBreakProperty.Katakana ||
				prev === WordBreakProperty.ExtendNumLet) &&
			curr === WordBreakProperty.ExtendNumLet
		) {
			shouldBreak = false;
		} else if (
			prev === WordBreakProperty.ExtendNumLet &&
			(curr === WordBreakProperty.ALetter ||
				curr === WordBreakProperty.Hebrew_Letter ||
				curr === WordBreakProperty.Numeric ||
				curr === WordBreakProperty.Katakana)
		) {
			shouldBreak = false;
		}
		// WB15-16: Do not break within emoji flag sequences
		else if (
			prev === WordBreakProperty.Regional_Indicator &&
			curr === WordBreakProperty.Regional_Indicator
		) {
			if (riCount % 2 === 1) {
				shouldBreak = false;
			}
		}

		// Track RI count
		if (curr === WordBreakProperty.Regional_Indicator) {
			riCount++;
		} else {
			riCount = 0;
		}

		if (shouldBreak) {
			boundaries.push(i);
		}
	}

	// WB2: Break at the end
	boundaries.push(len);

	return { boundaries, properties };
}

/**
 * Split text into grapheme clusters
 */
export function splitGraphemes(text: string): string[] {
	const codepoints: number[] = [];
	const chars: string[] = [];

	for (const char of text) {
		codepoints.push(char.codePointAt(0) ?? 0);
		chars.push(char);
	}

	const { boundaries } = findGraphemeBoundaries(codepoints);
	const graphemes: string[] = [];

	let start = 0;
	for (const end of boundaries) {
		if (end > start) {
			graphemes.push(chars.slice(start, end).join(""));
		}
		start = end;
	}

	return graphemes;
}

/**
 * Split text into words
 */
export function splitWords(text: string): string[] {
	const codepoints: number[] = [];
	const chars: string[] = [];

	for (const char of text) {
		codepoints.push(char.codePointAt(0) ?? 0);
		chars.push(char);
	}

	const { boundaries, properties } = findWordBoundaries(codepoints);
	const words: string[] = [];

	for (let i = 0; i < boundaries.length - 1; i++) {
		const start = boundaries[i];
		const end = boundaries[i + 1];

		// Skip whitespace-only segments
		let hasContent = false;
		for (let j = start; j < end; j++) {
			const prop = properties[j];
			if (
				prop !== WordBreakProperty.WSegSpace &&
				prop !== WordBreakProperty.CR &&
				prop !== WordBreakProperty.LF &&
				prop !== WordBreakProperty.Newline
			) {
				hasContent = true;
				break;
			}
		}

		if (hasContent) {
			words.push(chars.slice(start, end).join(""));
		}
	}

	return words;
}

/**
 * Count grapheme clusters in text
 */
export function countGraphemes(text: string): number {
	const codepoints: number[] = [];
	for (const char of text) {
		codepoints.push(char.codePointAt(0) ?? 0);
	}
	const { boundaries } = findGraphemeBoundaries(codepoints);
	return boundaries.length;
}

/**
 * Analyze grapheme boundaries for glyph infos
 */
export function analyzeGraphemesForGlyphs(
	infos: GlyphInfo[],
): GraphemeBoundaries {
	const codepoints = infos.map((info) => info.codepoint);
	return findGraphemeBoundaries(codepoints);
}

/**
 * Analyze word boundaries for glyph infos
 */
export function analyzeWordsForGlyphs(infos: GlyphInfo[]): WordBoundaries {
	const codepoints = infos.map((info) => info.codepoint);
	return findWordBoundaries(codepoints);
}
