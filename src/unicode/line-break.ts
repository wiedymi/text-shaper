/**
 * Unicode Line Breaking Algorithm (UAX #14)
 * Determines line break opportunities in text
 */

import type { GlyphInfo } from "../types.ts";

/**
 * Line break class from UAX #14
 */
export enum LineBreakClass {
	// Non-tailorable Line Breaking Classes
	BK = 0, // Mandatory Break
	CR = 1, // Carriage Return
	LF = 2, // Line Feed
	CM = 3, // Combining Mark
	NL = 4, // Next Line
	SG = 5, // Surrogate (not used)
	WJ = 6, // Word Joiner
	ZW = 7, // Zero Width Space
	GL = 8, // Non-breaking ("Glue")
	SP = 9, // Space
	ZWJ = 10, // Zero Width Joiner

	// Break Opportunities
	B2 = 11, // Break Opportunity Before and After
	BA = 12, // Break After
	BB = 13, // Break Before
	HY = 14, // Hyphen
	CB = 15, // Contingent Break Opportunity

	// Characters Prohibiting Certain Breaks
	CL = 16, // Close Punctuation
	CP = 17, // Close Parenthesis
	EX = 18, // Exclamation/Interrogation
	IN = 19, // Inseparable
	NS = 20, // Nonstarter
	OP = 21, // Open Punctuation
	QU = 22, // Quotation

	// Numeric Context
	IS = 23, // Infix Numeric Separator
	NU = 24, // Numeric
	PO = 25, // Postfix Numeric
	PR = 26, // Prefix Numeric
	SY = 27, // Symbols Allowing Break After

	// Other Characters
	AI = 28, // Ambiguous (Alphabetic or Ideographic)
	AL = 29, // Alphabetic
	CJ = 30, // Conditional Japanese Starter
	EB = 31, // Emoji Base
	EM = 32, // Emoji Modifier
	H2 = 33, // Hangul LV Syllable
	H3 = 34, // Hangul LVT Syllable
	HL = 35, // Hebrew Letter
	ID = 36, // Ideographic
	JL = 37, // Hangul L Jamo
	JV = 38, // Hangul V Jamo
	JT = 39, // Hangul T Jamo
	RI = 40, // Regional Indicator
	SA = 41, // Complex Context Dependent (South East Asian)
	XX = 42, // Unknown
}

/**
 * Break action
 */
export enum BreakAction {
	Direct = 0, // Direct break opportunity (after space)
	Indirect = 1, // Indirect break (only if spaces intervene)
	CombiningIndirect = 2, // Indirect break for combining marks
	CombiningProhibited = 3, // Prohibited break for combining marks
	Prohibited = 4, // No break allowed
	Explicit = 5, // Explicit break (BK, CR, LF, NL)
}

/**
 * Line break opportunity
 */
export enum BreakOpportunity {
	NoBreak = 0,
	Optional = 1,
	Mandatory = 2,
}

/**
 * Get line break class for a codepoint
 */
export function getLineBreakClass(cp: number): LineBreakClass {
	// Mandatory breaks
	if (cp === 0x000a) return LineBreakClass.LF;
	if (cp === 0x000d) return LineBreakClass.CR;
	if (cp === 0x0085) return LineBreakClass.NL;
	if (cp === 0x000b || cp === 0x000c) return LineBreakClass.BK;
	if (cp === 0x2028) return LineBreakClass.BK; // Line Separator
	if (cp === 0x2029) return LineBreakClass.BK; // Paragraph Separator

	// Zero-width characters
	if (cp === 0x200b) return LineBreakClass.ZW; // Zero Width Space
	if (cp === 0x200d) return LineBreakClass.ZWJ; // Zero Width Joiner
	if (cp === 0x2060) return LineBreakClass.WJ; // Word Joiner
	if (cp === 0xfeff) return LineBreakClass.WJ; // BOM / ZWNBSP

	// Spaces
	if (cp === 0x0020) return LineBreakClass.SP;
	if (cp === 0x00a0) return LineBreakClass.GL; // No-Break Space
	if (cp === 0x202f) return LineBreakClass.GL; // Narrow No-Break Space
	if (cp === 0x2007) return LineBreakClass.GL; // Figure Space
	if (cp === 0x2011) return LineBreakClass.GL; // Non-Breaking Hyphen

	// Tabs and other whitespace
	if (cp === 0x0009) return LineBreakClass.BA; // Tab
	if (cp >= 0x2000 && cp <= 0x200a) return LineBreakClass.BA; // Various spaces

	// Combining marks
	if (cp >= 0x0300 && cp <= 0x036f) return LineBreakClass.CM; // Combining Diacritical Marks
	if (cp >= 0x0483 && cp <= 0x0489) return LineBreakClass.CM; // Cyrillic combining
	if (cp >= 0x0591 && cp <= 0x05bd) return LineBreakClass.CM; // Hebrew points
	if (cp >= 0x05bf && cp <= 0x05c7) return LineBreakClass.CM;
	if (cp >= 0x0610 && cp <= 0x061a) return LineBreakClass.CM; // Arabic marks
	if (cp >= 0x064b && cp <= 0x065f) return LineBreakClass.CM;
	if (cp >= 0x0670 && cp <= 0x0670) return LineBreakClass.CM;
	if (cp >= 0x06d6 && cp <= 0x06ed) return LineBreakClass.CM;
	if (cp >= 0x0711 && cp <= 0x0711) return LineBreakClass.CM; // Syriac
	if (cp >= 0x0730 && cp <= 0x074a) return LineBreakClass.CM;
	if (cp >= 0x07a6 && cp <= 0x07b0) return LineBreakClass.CM; // Thaana
	if (cp >= 0x0816 && cp <= 0x0823) return LineBreakClass.CM; // Samaritan
	if (cp >= 0x0825 && cp <= 0x082d) return LineBreakClass.CM;
	if (cp >= 0x0859 && cp <= 0x085b) return LineBreakClass.CM; // Mandaic
	if (cp >= 0x08d3 && cp <= 0x08e1) return LineBreakClass.CM; // Arabic extended
	if (cp >= 0x08e3 && cp <= 0x0903) return LineBreakClass.CM;
	if (cp >= 0x093a && cp <= 0x093c) return LineBreakClass.CM; // Devanagari
	if (cp >= 0x093e && cp <= 0x094f) return LineBreakClass.CM;
	if (cp >= 0x0951 && cp <= 0x0957) return LineBreakClass.CM;
	if (cp >= 0x0962 && cp <= 0x0963) return LineBreakClass.CM;
	if (cp >= 0x0981 && cp <= 0x0983) return LineBreakClass.CM; // Bengali
	if (cp === 0x09bc) return LineBreakClass.CM;
	if (cp >= 0x09be && cp <= 0x09cd) return LineBreakClass.CM;
	if (cp >= 0x09d7 && cp <= 0x09d7) return LineBreakClass.CM;
	if (cp >= 0x09e2 && cp <= 0x09e3) return LineBreakClass.CM;
	if (cp >= 0x09fe && cp <= 0x09fe) return LineBreakClass.CM;
	if (cp >= 0x0a01 && cp <= 0x0a03) return LineBreakClass.CM; // Gurmukhi
	if (cp >= 0x0a3c && cp <= 0x0a51) return LineBreakClass.CM;
	if (cp >= 0x0a70 && cp <= 0x0a71) return LineBreakClass.CM;
	if (cp >= 0x0a75 && cp <= 0x0a75) return LineBreakClass.CM;
	if (cp >= 0x0a81 && cp <= 0x0a83) return LineBreakClass.CM; // Gujarati
	if (cp >= 0x0abc && cp <= 0x0acd) return LineBreakClass.CM;
	if (cp >= 0x0ae2 && cp <= 0x0ae3) return LineBreakClass.CM;
	if (cp >= 0x0afa && cp <= 0x0aff) return LineBreakClass.CM;
	if (cp >= 0x0b01 && cp <= 0x0b03) return LineBreakClass.CM; // Oriya
	if (cp >= 0x0b3c && cp <= 0x0b57) return LineBreakClass.CM;
	if (cp >= 0x0b62 && cp <= 0x0b63) return LineBreakClass.CM;
	if (cp >= 0x0b82 && cp <= 0x0b82) return LineBreakClass.CM; // Tamil
	if (cp >= 0x0bbe && cp <= 0x0bcd) return LineBreakClass.CM;
	if (cp >= 0x0bd7 && cp <= 0x0bd7) return LineBreakClass.CM;
	if (cp >= 0x0c00 && cp <= 0x0c04) return LineBreakClass.CM; // Telugu
	if (cp >= 0x0c3e && cp <= 0x0c56) return LineBreakClass.CM;
	if (cp >= 0x0c62 && cp <= 0x0c63) return LineBreakClass.CM;
	if (cp >= 0x0c81 && cp <= 0x0c83) return LineBreakClass.CM; // Kannada
	if (cp >= 0x0cbc && cp <= 0x0cd6) return LineBreakClass.CM;
	if (cp >= 0x0ce2 && cp <= 0x0ce3) return LineBreakClass.CM;
	if (cp >= 0x0d00 && cp <= 0x0d03) return LineBreakClass.CM; // Malayalam
	if (cp >= 0x0d3b && cp <= 0x0d4d) return LineBreakClass.CM;
	if (cp >= 0x0d57 && cp <= 0x0d57) return LineBreakClass.CM;
	if (cp >= 0x0d62 && cp <= 0x0d63) return LineBreakClass.CM;
	if (cp >= 0x0d81 && cp <= 0x0d83) return LineBreakClass.CM; // Sinhala
	if (cp >= 0x0dca && cp <= 0x0df3) return LineBreakClass.CM;
	if (cp >= 0x0f18 && cp <= 0x0f19) return LineBreakClass.CM; // Tibetan
	if (cp >= 0x0f35 && cp <= 0x0f39) return LineBreakClass.CM;
	if (cp >= 0x0f3e && cp <= 0x0f3f) return LineBreakClass.CM;
	if (cp >= 0x0f71 && cp <= 0x0f84) return LineBreakClass.CM;
	if (cp >= 0x0f86 && cp <= 0x0f87) return LineBreakClass.CM;
	if (cp >= 0x0f8d && cp <= 0x0fbc) return LineBreakClass.CM;
	if (cp === 0x0fc6) return LineBreakClass.CM;
	if (cp >= 0x1712 && cp <= 0x1714) return LineBreakClass.CM; // Tagalog
	if (cp >= 0x1732 && cp <= 0x1734) return LineBreakClass.CM; // Hanunoo
	if (cp >= 0x1752 && cp <= 0x1753) return LineBreakClass.CM; // Buhid
	if (cp >= 0x1772 && cp <= 0x1773) return LineBreakClass.CM; // Tagbanwa
	if (cp >= 0x17b4 && cp <= 0x17d3) return LineBreakClass.CM; // Khmer
	if (cp === 0x17dd) return LineBreakClass.CM;
	if (cp >= 0x180b && cp <= 0x180d) return LineBreakClass.CM; // Mongolian
	if (cp === 0x180f) return LineBreakClass.CM;
	if (cp >= 0x1885 && cp <= 0x1886) return LineBreakClass.CM;
	if (cp === 0x18a9) return LineBreakClass.CM;
	if (cp >= 0x1920 && cp <= 0x193b) return LineBreakClass.CM; // Limbu, Buginese
	if (cp >= 0x1a17 && cp <= 0x1a1b) return LineBreakClass.CM;
	if (cp >= 0x1a55 && cp <= 0x1a7f) return LineBreakClass.CM; // Tai Tham
	if (cp >= 0x1ab0 && cp <= 0x1ace) return LineBreakClass.CM; // Combining Diacritical Marks Extended
	if (cp >= 0x1b00 && cp <= 0x1b04) return LineBreakClass.CM; // Balinese
	if (cp >= 0x1b34 && cp <= 0x1b44) return LineBreakClass.CM;
	if (cp >= 0x1b6b && cp <= 0x1b73) return LineBreakClass.CM;
	if (cp >= 0x1b80 && cp <= 0x1b82) return LineBreakClass.CM; // Sundanese
	if (cp >= 0x1ba1 && cp <= 0x1bad) return LineBreakClass.CM;
	if (cp >= 0x1be6 && cp <= 0x1bf3) return LineBreakClass.CM; // Batak
	if (cp >= 0x1c24 && cp <= 0x1c37) return LineBreakClass.CM; // Lepcha
	if (cp >= 0x1cd0 && cp <= 0x1cf9) return LineBreakClass.CM; // Vedic Extensions
	if (cp >= 0x1dc0 && cp <= 0x1dff) return LineBreakClass.CM; // Combining Diacritical Marks Supplement
	if (cp >= 0x20d0 && cp <= 0x20f0) return LineBreakClass.CM; // Combining Diacritical Marks for Symbols
	if (cp >= 0x2cef && cp <= 0x2cf1) return LineBreakClass.CM; // Coptic
	if (cp === 0x2d7f) return LineBreakClass.CM; // Tifinagh
	if (cp >= 0x2de0 && cp <= 0x2dff) return LineBreakClass.CM; // Cyrillic Extended-A
	if (cp >= 0x302a && cp <= 0x302f) return LineBreakClass.CM; // Ideographic Description
	if (cp >= 0x3099 && cp <= 0x309a) return LineBreakClass.CM; // Hiragana/Katakana voicing
	if (cp >= 0xa66f && cp <= 0xa672) return LineBreakClass.CM; // Combining Cyrillic
	if (cp >= 0xa674 && cp <= 0xa67d) return LineBreakClass.CM;
	if (cp >= 0xa69e && cp <= 0xa69f) return LineBreakClass.CM;
	if (cp >= 0xa6f0 && cp <= 0xa6f1) return LineBreakClass.CM; // Bamum
	if (cp >= 0xa802 && cp <= 0xa827) return LineBreakClass.CM; // Syloti Nagri
	if (cp >= 0xa82c && cp <= 0xa82c) return LineBreakClass.CM;
	if (cp >= 0xa880 && cp <= 0xa881) return LineBreakClass.CM; // Saurashtra
	if (cp >= 0xa8b4 && cp <= 0xa8c5) return LineBreakClass.CM;
	if (cp >= 0xa8e0 && cp <= 0xa8f1) return LineBreakClass.CM; // Devanagari Extended
	if (cp === 0xa8ff) return LineBreakClass.CM;
	if (cp >= 0xa926 && cp <= 0xa92d) return LineBreakClass.CM; // Kayah Li
	if (cp >= 0xa947 && cp <= 0xa953) return LineBreakClass.CM; // Rejang
	if (cp >= 0xa980 && cp <= 0xa983) return LineBreakClass.CM; // Javanese
	if (cp >= 0xa9b3 && cp <= 0xa9cd) return LineBreakClass.CM;
	if (cp === 0xa9e5) return LineBreakClass.CM; // Myanmar Extended-B
	if (cp >= 0xaa29 && cp <= 0xaa36) return LineBreakClass.CM; // Cham
	if (cp >= 0xaa43 && cp <= 0xaa43) return LineBreakClass.CM;
	if (cp >= 0xaa4c && cp <= 0xaa4d) return LineBreakClass.CM;
	if (cp >= 0xaa7b && cp <= 0xaa7d) return LineBreakClass.CM; // Myanmar Extended-A
	if (cp >= 0xaab0 && cp <= 0xaac2) return LineBreakClass.CM; // Tai Viet
	if (cp >= 0xaaeb && cp <= 0xaaef) return LineBreakClass.CM; // Meetei Mayek Extensions
	if (cp >= 0xaaf5 && cp <= 0xaaf6) return LineBreakClass.CM;
	if (cp >= 0xabe3 && cp <= 0xabea) return LineBreakClass.CM; // Meetei Mayek
	if (cp >= 0xabec && cp <= 0xabed) return LineBreakClass.CM;
	if (cp === 0xfb1e) return LineBreakClass.CM; // Hebrew
	if (cp >= 0xfe00 && cp <= 0xfe0f) return LineBreakClass.CM; // Variation Selectors
	if (cp >= 0xfe20 && cp <= 0xfe2f) return LineBreakClass.CM; // Combining Half Marks
	if (cp >= 0x101fd && cp <= 0x101fd) return LineBreakClass.CM; // Phaistos
	if (cp >= 0x102e0 && cp <= 0x102e0) return LineBreakClass.CM; // Coptic Epact
	if (cp >= 0x10376 && cp <= 0x1037a) return LineBreakClass.CM; // Old Permic
	if (cp >= 0x10a01 && cp <= 0x10a0f) return LineBreakClass.CM; // Kharoshthi
	if (cp >= 0x10a38 && cp <= 0x10a3f) return LineBreakClass.CM;
	if (cp >= 0x10ae5 && cp <= 0x10ae6) return LineBreakClass.CM; // Manichaean
	if (cp >= 0x10d24 && cp <= 0x10d27) return LineBreakClass.CM; // Hanifi Rohingya
	if (cp >= 0x10eab && cp <= 0x10eac) return LineBreakClass.CM; // Yezidi
	if (cp >= 0x10f46 && cp <= 0x10f50) return LineBreakClass.CM; // Sogdian
	if (cp >= 0x10f82 && cp <= 0x10f85) return LineBreakClass.CM; // Old Uyghur
	if (cp >= 0x11000 && cp <= 0x11002) return LineBreakClass.CM; // Brahmi
	if (cp >= 0x11038 && cp <= 0x11046) return LineBreakClass.CM;
	if (cp >= 0x11070 && cp <= 0x11070) return LineBreakClass.CM;
	if (cp >= 0x11073 && cp <= 0x11074) return LineBreakClass.CM;
	if (cp >= 0x1107f && cp <= 0x11082) return LineBreakClass.CM;
	if (cp >= 0x110b0 && cp <= 0x110c2) return LineBreakClass.CM; // Kaithi
	if (cp >= 0x11100 && cp <= 0x11102) return LineBreakClass.CM; // Chakma
	if (cp >= 0x11127 && cp <= 0x11134) return LineBreakClass.CM;
	if (cp === 0x11145) return LineBreakClass.CM;
	if (cp === 0x11146) return LineBreakClass.CM;
	if (cp >= 0x11173 && cp <= 0x11173) return LineBreakClass.CM; // Mahajani
	if (cp >= 0x11180 && cp <= 0x11182) return LineBreakClass.CM; // Sharada
	if (cp >= 0x111b3 && cp <= 0x111c0) return LineBreakClass.CM;
	if (cp >= 0x111c9 && cp <= 0x111cc) return LineBreakClass.CM;
	if (cp === 0x111ce) return LineBreakClass.CM;
	if (cp === 0x111cf) return LineBreakClass.CM;
	if (cp >= 0x1122c && cp <= 0x11237) return LineBreakClass.CM; // Khojki
	if (cp === 0x1123e) return LineBreakClass.CM;
	if (cp >= 0x112df && cp <= 0x112ea) return LineBreakClass.CM; // Khudawadi
	if (cp >= 0x11300 && cp <= 0x11303) return LineBreakClass.CM; // Grantha
	if (cp >= 0x1133b && cp <= 0x1133c) return LineBreakClass.CM;
	if (cp >= 0x1133e && cp <= 0x1134d) return LineBreakClass.CM;
	if (cp >= 0x11357 && cp <= 0x11357) return LineBreakClass.CM;
	if (cp >= 0x11362 && cp <= 0x11374) return LineBreakClass.CM;
	if (cp >= 0x11435 && cp <= 0x11446) return LineBreakClass.CM; // Newa
	if (cp === 0x1145e) return LineBreakClass.CM;
	if (cp >= 0x114b0 && cp <= 0x114c3) return LineBreakClass.CM; // Tirhuta
	if (cp >= 0x115af && cp <= 0x115c0) return LineBreakClass.CM; // Siddham
	if (cp >= 0x115dc && cp <= 0x115dd) return LineBreakClass.CM;
	if (cp >= 0x11630 && cp <= 0x11640) return LineBreakClass.CM; // Modi
	if (cp >= 0x116ab && cp <= 0x116b7) return LineBreakClass.CM; // Takri
	if (cp >= 0x1171d && cp <= 0x1172b) return LineBreakClass.CM; // Ahom
	if (cp >= 0x1182c && cp <= 0x1183a) return LineBreakClass.CM; // Dogra
	if (cp >= 0x11930 && cp <= 0x11935) return LineBreakClass.CM; // Dives Akuru
	if (cp >= 0x11937 && cp <= 0x11938) return LineBreakClass.CM;
	if (cp >= 0x1193b && cp <= 0x1193e) return LineBreakClass.CM;
	if (cp === 0x11940) return LineBreakClass.CM;
	if (cp >= 0x11942 && cp <= 0x11943) return LineBreakClass.CM;
	if (cp >= 0x119d1 && cp <= 0x119d7) return LineBreakClass.CM; // Nandinagari
	if (cp >= 0x119da && cp <= 0x119e0) return LineBreakClass.CM;
	if (cp === 0x119e4) return LineBreakClass.CM;
	if (cp >= 0x11a01 && cp <= 0x11a0a) return LineBreakClass.CM; // Zanabazar Square
	if (cp >= 0x11a33 && cp <= 0x11a39) return LineBreakClass.CM;
	if (cp >= 0x11a3b && cp <= 0x11a3e) return LineBreakClass.CM;
	if (cp === 0x11a47) return LineBreakClass.CM;
	if (cp >= 0x11a51 && cp <= 0x11a5b) return LineBreakClass.CM; // Soyombo
	if (cp >= 0x11a8a && cp <= 0x11a99) return LineBreakClass.CM;
	if (cp >= 0x11c2f && cp <= 0x11c36) return LineBreakClass.CM; // Bhaiksuki
	if (cp >= 0x11c38 && cp <= 0x11c3f) return LineBreakClass.CM;
	if (cp >= 0x11c92 && cp <= 0x11ca7) return LineBreakClass.CM; // Marchen
	if (cp >= 0x11ca9 && cp <= 0x11cb6) return LineBreakClass.CM;
	if (cp >= 0x11d31 && cp <= 0x11d45) return LineBreakClass.CM; // Masaram Gondi
	if (cp === 0x11d47) return LineBreakClass.CM;
	if (cp >= 0x11d8a && cp <= 0x11d97) return LineBreakClass.CM; // Gunjala Gondi
	if (cp >= 0x11ef3 && cp <= 0x11ef6) return LineBreakClass.CM; // Makasar
	if (cp >= 0x16af0 && cp <= 0x16af4) return LineBreakClass.CM; // Bassa Vah
	if (cp >= 0x16b30 && cp <= 0x16b36) return LineBreakClass.CM; // Pahawh Hmong
	if (cp === 0x16f4f) return LineBreakClass.CM; // Miao
	if (cp >= 0x16f51 && cp <= 0x16f87) return LineBreakClass.CM;
	if (cp >= 0x16f8f && cp <= 0x16f92) return LineBreakClass.CM;
	if (cp >= 0x16fe4 && cp <= 0x16fe4) return LineBreakClass.CM; // Khitan Small Script
	if (cp >= 0x16ff0 && cp <= 0x16ff1) return LineBreakClass.CM;
	if (cp >= 0x1bc9d && cp <= 0x1bc9e) return LineBreakClass.CM; // Duployan
	if (cp >= 0x1cf00 && cp <= 0x1cf46) return LineBreakClass.CM; // Znamenny Musical Notation
	if (cp >= 0x1d165 && cp <= 0x1d169) return LineBreakClass.CM; // Musical Symbols
	if (cp >= 0x1d16d && cp <= 0x1d172) return LineBreakClass.CM;
	if (cp >= 0x1d17b && cp <= 0x1d182) return LineBreakClass.CM;
	if (cp >= 0x1d185 && cp <= 0x1d18b) return LineBreakClass.CM;
	if (cp >= 0x1d1aa && cp <= 0x1d1ad) return LineBreakClass.CM;
	if (cp >= 0x1d242 && cp <= 0x1d244) return LineBreakClass.CM;
	if (cp >= 0x1da00 && cp <= 0x1da36) return LineBreakClass.CM; // Sutton SignWriting
	if (cp >= 0x1da3b && cp <= 0x1da6c) return LineBreakClass.CM;
	if (cp === 0x1da75) return LineBreakClass.CM;
	if (cp === 0x1da84) return LineBreakClass.CM;
	if (cp >= 0x1da9b && cp <= 0x1daaf) return LineBreakClass.CM;
	if (cp >= 0x1e000 && cp <= 0x1e02a) return LineBreakClass.CM; // Glagolitic Supplement
	if (cp >= 0x1e130 && cp <= 0x1e136) return LineBreakClass.CM; // Nyiakeng Puachue Hmong
	if (cp >= 0x1e2ae && cp <= 0x1e2ae) return LineBreakClass.CM; // Toto
	if (cp >= 0x1e2ec && cp <= 0x1e2ef) return LineBreakClass.CM; // Wancho
	if (cp >= 0x1e8d0 && cp <= 0x1e8d6) return LineBreakClass.CM; // Mende Kikakui
	if (cp >= 0x1e944 && cp <= 0x1e94a) return LineBreakClass.CM; // Adlam
	if (cp >= 0xe0100 && cp <= 0xe01ef) return LineBreakClass.CM; // Variation Selectors Supplement

	// Punctuation
	if (cp === 0x0021) return LineBreakClass.EX; // !
	if (cp === 0x003f) return LineBreakClass.EX; // ?
	if (cp === 0x0022) return LineBreakClass.QU; // "
	if (cp === 0x0027) return LineBreakClass.QU; // '
	if (cp === 0x0028) return LineBreakClass.OP; // (
	if (cp === 0x0029) return LineBreakClass.CP; // )
	if (cp === 0x005b) return LineBreakClass.OP; // [
	if (cp === 0x005d) return LineBreakClass.CP; // ]
	if (cp === 0x007b) return LineBreakClass.OP; // {
	if (cp === 0x007d) return LineBreakClass.CL; // }
	if (cp === 0x002c) return LineBreakClass.IS; // ,
	if (cp === 0x002e) return LineBreakClass.IS; // .
	if (cp === 0x003a) return LineBreakClass.IS; // :
	if (cp === 0x003b) return LineBreakClass.IS; // ;
	if (cp === 0x002d) return LineBreakClass.HY; // -
	if (cp === 0x2010) return LineBreakClass.BA; // Hyphen
	if (cp === 0x2013) return LineBreakClass.BA; // En Dash
	if (cp === 0x2014) return LineBreakClass.B2; // Em Dash
	if (cp === 0x2018 || cp === 0x2019) return LineBreakClass.QU; // Single quotes
	if (cp === 0x201c || cp === 0x201d) return LineBreakClass.QU; // Double quotes
	if (cp === 0x2026) return LineBreakClass.IN; // Ellipsis

	// CJK punctuation
	if (cp === 0x3001 || cp === 0x3002) return LineBreakClass.CL; // Ideographic comma, period
	if (cp === 0x3008) return LineBreakClass.OP;
	if (cp === 0x3009) return LineBreakClass.CL;
	if (cp === 0x300a) return LineBreakClass.OP;
	if (cp === 0x300b) return LineBreakClass.CL;
	if (cp === 0x300c) return LineBreakClass.OP;
	if (cp === 0x300d) return LineBreakClass.CL;
	if (cp === 0x300e) return LineBreakClass.OP;
	if (cp === 0x300f) return LineBreakClass.CL;
	if (cp === 0x3010) return LineBreakClass.OP;
	if (cp === 0x3011) return LineBreakClass.CL;
	if (cp === 0x3014) return LineBreakClass.OP;
	if (cp === 0x3015) return LineBreakClass.CL;
	if (cp === 0x3016) return LineBreakClass.OP;
	if (cp === 0x3017) return LineBreakClass.CL;
	if (cp >= 0x3018 && cp <= 0x301b)
		return cp % 2 === 0 ? LineBreakClass.OP : LineBreakClass.CL;
	if (cp === 0xff08) return LineBreakClass.OP; // Fullwidth (
	if (cp === 0xff09) return LineBreakClass.CL; // Fullwidth )
	if (cp === 0xff0c) return LineBreakClass.CL; // Fullwidth ,
	if (cp === 0xff0e) return LineBreakClass.CL; // Fullwidth .
	if (cp === 0xff1a) return LineBreakClass.NS; // Fullwidth :
	if (cp === 0xff1b) return LineBreakClass.NS; // Fullwidth ;
	if (cp === 0xff1f) return LineBreakClass.EX; // Fullwidth ?
	if (cp === 0xff01) return LineBreakClass.EX; // Fullwidth !

	// Small Kana
	if (cp >= 0x3041 && cp <= 0x3096) {
		// Check for small kana
		if (
			cp === 0x3041 ||
			cp === 0x3043 ||
			cp === 0x3045 ||
			cp === 0x3047 ||
			cp === 0x3049 ||
			cp === 0x3063 ||
			cp === 0x3083 ||
			cp === 0x3085 ||
			cp === 0x3087 ||
			cp === 0x308e ||
			cp === 0x3095 ||
			cp === 0x3096
		)
			return LineBreakClass.CJ;
		return LineBreakClass.ID;
	}
	if (cp >= 0x30a1 && cp <= 0x30fa) {
		// Check for small katakana
		if (
			cp === 0x30a1 ||
			cp === 0x30a3 ||
			cp === 0x30a5 ||
			cp === 0x30a7 ||
			cp === 0x30a9 ||
			cp === 0x30c3 ||
			cp === 0x30e3 ||
			cp === 0x30e5 ||
			cp === 0x30e7 ||
			cp === 0x30ee ||
			cp === 0x30f5 ||
			cp === 0x30f6
		)
			return LineBreakClass.CJ;
		return LineBreakClass.ID;
	}

	// Hiragana/Katakana prolonged sound mark
	if (cp === 0x30fc) return LineBreakClass.CJ;

	// Hangul
	if (cp >= 0x1100 && cp <= 0x115f) return LineBreakClass.JL;
	if (cp >= 0xa960 && cp <= 0xa97c) return LineBreakClass.JL;
	if (cp >= 0x1160 && cp <= 0x11a7) return LineBreakClass.JV;
	if (cp >= 0xd7b0 && cp <= 0xd7c6) return LineBreakClass.JV;
	if (cp >= 0x11a8 && cp <= 0x11ff) return LineBreakClass.JT;
	if (cp >= 0xd7cb && cp <= 0xd7fb) return LineBreakClass.JT;
	// Hangul syllables
	if (cp >= 0xac00 && cp <= 0xd7a3) {
		const sIndex = cp - 0xac00;
		if (sIndex % 28 === 0) return LineBreakClass.H2;
		return LineBreakClass.H3;
	}

	// Numbers
	if (cp >= 0x0030 && cp <= 0x0039) return LineBreakClass.NU;
	if (cp >= 0x0660 && cp <= 0x0669) return LineBreakClass.NU; // Arabic-Indic
	if (cp >= 0x06f0 && cp <= 0x06f9) return LineBreakClass.NU; // Extended Arabic-Indic
	if (cp >= 0x0966 && cp <= 0x096f) return LineBreakClass.NU; // Devanagari
	if (cp >= 0xff10 && cp <= 0xff19) return LineBreakClass.NU; // Fullwidth

	// Currency symbols
	if (cp === 0x0024) return LineBreakClass.PR; // $
	if (cp === 0x00a3) return LineBreakClass.PR; // £
	if (cp === 0x00a5) return LineBreakClass.PR; // ¥
	if (cp === 0x20ac) return LineBreakClass.PR; // €
	if (cp === 0x0025) return LineBreakClass.PO; // %

	// Hebrew
	if (cp >= 0x05d0 && cp <= 0x05ea) return LineBreakClass.HL;
	if (cp >= 0xfb1d && cp <= 0xfb4f) return LineBreakClass.HL;

	// CJK Ideographs
	if (cp >= 0x4e00 && cp <= 0x9fff) return LineBreakClass.ID;
	if (cp >= 0x3400 && cp <= 0x4dbf) return LineBreakClass.ID;
	if (cp >= 0x20000 && cp <= 0x2a6df) return LineBreakClass.ID;
	if (cp >= 0x2a700 && cp <= 0x2b73f) return LineBreakClass.ID;
	if (cp >= 0x2b740 && cp <= 0x2b81f) return LineBreakClass.ID;
	if (cp >= 0x2b820 && cp <= 0x2ceaf) return LineBreakClass.ID;
	if (cp >= 0x2ceb0 && cp <= 0x2ebef) return LineBreakClass.ID;
	if (cp >= 0x30000 && cp <= 0x3134f) return LineBreakClass.ID;
	if (cp >= 0xf900 && cp <= 0xfaff) return LineBreakClass.ID;
	if (cp >= 0x2f800 && cp <= 0x2fa1f) return LineBreakClass.ID;

	// Emoji
	if (cp >= 0x1f300 && cp <= 0x1f9ff) return LineBreakClass.ID;
	if (cp >= 0x1fa00 && cp <= 0x1faff) return LineBreakClass.ID;
	if (cp >= 0x2600 && cp <= 0x26ff) return LineBreakClass.ID;
	if (cp >= 0x2700 && cp <= 0x27bf) return LineBreakClass.ID;

	// Regional indicators
	if (cp >= 0x1f1e0 && cp <= 0x1f1ff) return LineBreakClass.RI;

	// Emoji modifiers
	if (cp >= 0x1f3fb && cp <= 0x1f3ff) return LineBreakClass.EM;

	// Thai
	if (cp >= 0x0e00 && cp <= 0x0e7f) return LineBreakClass.SA;

	// Lao
	if (cp >= 0x0e80 && cp <= 0x0eff) return LineBreakClass.SA;

	// Myanmar
	if (cp >= 0x1000 && cp <= 0x109f) return LineBreakClass.SA;
	if (cp >= 0xa9e0 && cp <= 0xa9ff) return LineBreakClass.SA;
	if (cp >= 0xaa60 && cp <= 0xaa7f) return LineBreakClass.SA;

	// Khmer
	if (cp >= 0x1780 && cp <= 0x17ff) return LineBreakClass.SA;
	if (cp >= 0x19e0 && cp <= 0x19ff) return LineBreakClass.SA;

	// Default: treat as alphabetic
	if (cp >= 0x0041 && cp <= 0x005a) return LineBreakClass.AL; // A-Z
	if (cp >= 0x0061 && cp <= 0x007a) return LineBreakClass.AL; // a-z
	if (cp >= 0x00c0 && cp <= 0x024f) return LineBreakClass.AL; // Latin Extended

	// Arabic
	if (cp >= 0x0600 && cp <= 0x06ff) return LineBreakClass.AL;
	if (cp >= 0x0750 && cp <= 0x077f) return LineBreakClass.AL;
	if (cp >= 0x08a0 && cp <= 0x08ff) return LineBreakClass.AL;

	// Devanagari and other Indic
	if (cp >= 0x0900 && cp <= 0x097f) return LineBreakClass.AL;
	if (cp >= 0x0980 && cp <= 0x09ff) return LineBreakClass.AL;
	if (cp >= 0x0a00 && cp <= 0x0a7f) return LineBreakClass.AL;
	if (cp >= 0x0a80 && cp <= 0x0aff) return LineBreakClass.AL;
	if (cp >= 0x0b00 && cp <= 0x0b7f) return LineBreakClass.AL;
	if (cp >= 0x0b80 && cp <= 0x0bff) return LineBreakClass.AL;
	if (cp >= 0x0c00 && cp <= 0x0c7f) return LineBreakClass.AL;
	if (cp >= 0x0c80 && cp <= 0x0cff) return LineBreakClass.AL;
	if (cp >= 0x0d00 && cp <= 0x0d7f) return LineBreakClass.AL;

	// Cyrillic
	if (cp >= 0x0400 && cp <= 0x04ff) return LineBreakClass.AL;
	if (cp >= 0x0500 && cp <= 0x052f) return LineBreakClass.AL;

	// Greek
	if (cp >= 0x0370 && cp <= 0x03ff) return LineBreakClass.AL;

	return LineBreakClass.XX;
}

/**
 * Pair table for line break classes
 * Returns whether a break is allowed between two classes
 */
function getPairAction(
	before: LineBreakClass,
	after: LineBreakClass,
): BreakAction {
	// LB1: Resolve AI, CB, CJ, SA, SG, XX -> AL (simplified)
	if (before === LineBreakClass.AI) before = LineBreakClass.AL;
	if (before === LineBreakClass.SA) before = LineBreakClass.AL;
	if (before === LineBreakClass.SG) before = LineBreakClass.AL;
	if (before === LineBreakClass.XX) before = LineBreakClass.AL;
	if (before === LineBreakClass.CJ) before = LineBreakClass.NS;

	if (after === LineBreakClass.AI) after = LineBreakClass.AL;
	if (after === LineBreakClass.SA) after = LineBreakClass.AL;
	if (after === LineBreakClass.SG) after = LineBreakClass.AL;
	if (after === LineBreakClass.XX) after = LineBreakClass.AL;
	if (after === LineBreakClass.CJ) after = LineBreakClass.NS;

	// LB4: Always break after hard line breaks
	if (before === LineBreakClass.BK) return BreakAction.Explicit;

	// LB5: Treat CR followed by LF, as well as CR, LF, and NL as hard line breaks
	if (before === LineBreakClass.CR && after === LineBreakClass.LF)
		return BreakAction.Prohibited;
	if (
		before === LineBreakClass.CR ||
		before === LineBreakClass.LF ||
		before === LineBreakClass.NL
	)
		return BreakAction.Explicit;

	// LB6: Do not break before hard line breaks
	if (
		after === LineBreakClass.BK ||
		after === LineBreakClass.CR ||
		after === LineBreakClass.LF ||
		after === LineBreakClass.NL
	)
		return BreakAction.Prohibited;

	// LB7: Do not break before spaces or zero width space
	if (after === LineBreakClass.SP || after === LineBreakClass.ZW)
		return BreakAction.Prohibited;

	// LB8: Break before any character following a zero-width space
	if (before === LineBreakClass.ZW) return BreakAction.Direct;

	// LB8a: Do not break after a zero width joiner
	if (before === LineBreakClass.ZWJ) return BreakAction.Prohibited;

	// LB9: Do not break a combining character sequence
	// Note: BK, CR, LF, NL, ZW are already handled by early returns above
	if (after === LineBreakClass.CM || after === LineBreakClass.ZWJ) {
		if (before !== LineBreakClass.SP) return BreakAction.Prohibited;
	}

	// LB10: Treat any remaining combining mark or ZWJ as AL
	// Use type assertion since we know these could be CM/ZWJ from above
	let beforeResolved: LineBreakClass = before;
	let afterResolved: LineBreakClass = after;
	if (before === LineBreakClass.CM || (before as number) === LineBreakClass.ZWJ)
		beforeResolved = LineBreakClass.AL;
	if (after === LineBreakClass.CM || after === LineBreakClass.ZWJ)
		afterResolved = LineBreakClass.AL;
	before = beforeResolved;
	after = afterResolved;

	// LB11: Do not break before or after Word Joiner
	if (before === LineBreakClass.WJ || after === LineBreakClass.WJ)
		return BreakAction.Prohibited;

	// LB12: Do not break after NBSP and related characters
	if (before === LineBreakClass.GL) return BreakAction.Prohibited;

	// LB12a: Do not break before NBSP and related characters, except after spaces and hyphens
	if (after === LineBreakClass.GL) {
		if (
			before !== LineBreakClass.SP &&
			before !== LineBreakClass.BA &&
			before !== LineBreakClass.HY
		)
			return BreakAction.Prohibited;
	}

	// LB13: Do not break before ']' or '!' or ';' or '/', even after spaces
	if (
		after === LineBreakClass.CL ||
		after === LineBreakClass.CP ||
		after === LineBreakClass.EX ||
		after === LineBreakClass.IS ||
		after === LineBreakClass.SY
	)
		return BreakAction.Prohibited;

	// LB14: Do not break after '[', even after spaces
	if (before === LineBreakClass.OP) return BreakAction.Prohibited;

	// LB15: Do not break within '"[', even with intervening spaces
	if (before === LineBreakClass.QU && after === LineBreakClass.OP)
		return BreakAction.Prohibited;

	// LB16: Do not break between closing punctuation and nonstarter
	if (
		(before === LineBreakClass.CL || before === LineBreakClass.CP) &&
		after === LineBreakClass.NS
	)
		return BreakAction.Prohibited;

	// LB17: Do not break within '——', even with intervening spaces
	if (before === LineBreakClass.B2 && after === LineBreakClass.B2)
		return BreakAction.Prohibited;

	// LB18: Break after spaces
	if (before === LineBreakClass.SP) return BreakAction.Direct;

	// LB19: Do not break before or after quotation marks
	if (before === LineBreakClass.QU || after === LineBreakClass.QU)
		return BreakAction.Prohibited;

	// LB20: Break before and after unresolved CB
	if (before === LineBreakClass.CB || after === LineBreakClass.CB)
		return BreakAction.Direct;

	// LB21: Do not break before hyphen-minus, etc.
	// Note: LB21a (Hebrew + Hyphen) is subsumed by this rule
	if (
		after === LineBreakClass.BA ||
		after === LineBreakClass.HY ||
		after === LineBreakClass.NS
	)
		return BreakAction.Prohibited;
	if (before === LineBreakClass.BB) return BreakAction.Prohibited;

	// LB21b: Don't break between Solidus and Hebrew letters
	if (before === LineBreakClass.SY && after === LineBreakClass.HL)
		return BreakAction.Prohibited;

	// LB22: Do not break before ellipses
	if (after === LineBreakClass.IN) return BreakAction.Prohibited;

	// LB23: Do not break between digits and letters
	if (
		(before === LineBreakClass.AL || before === LineBreakClass.HL) &&
		after === LineBreakClass.NU
	)
		return BreakAction.Prohibited;
	if (
		before === LineBreakClass.NU &&
		(after === LineBreakClass.AL || after === LineBreakClass.HL)
	)
		return BreakAction.Prohibited;

	// LB23a: Do not break between numeric prefixes/postfixes and ideographs
	if (before === LineBreakClass.PR && after === LineBreakClass.ID)
		return BreakAction.Prohibited;
	if (before === LineBreakClass.ID && after === LineBreakClass.PO)
		return BreakAction.Prohibited;

	// LB24: Do not break between numeric prefix/postfix and letters
	if (
		(before === LineBreakClass.PR || before === LineBreakClass.PO) &&
		(after === LineBreakClass.AL || after === LineBreakClass.HL)
	)
		return BreakAction.Prohibited;
	if (
		(before === LineBreakClass.AL || before === LineBreakClass.HL) &&
		(after === LineBreakClass.PR || after === LineBreakClass.PO)
	)
		return BreakAction.Prohibited;

	// LB25: Do not break between numbers
	if (
		(before === LineBreakClass.CL || before === LineBreakClass.CP) &&
		after === LineBreakClass.NU
	)
		return BreakAction.Prohibited;
	if (
		before === LineBreakClass.NU &&
		(after === LineBreakClass.PO || after === LineBreakClass.PR)
	)
		return BreakAction.Prohibited;
	if (
		(before === LineBreakClass.PO ||
			before === LineBreakClass.PR ||
			before === LineBreakClass.HY ||
			before === LineBreakClass.IS ||
			before === LineBreakClass.NU ||
			before === LineBreakClass.SY) &&
		after === LineBreakClass.NU
	)
		return BreakAction.Prohibited;

	// LB26: Do not break a Korean syllable
	if (before === LineBreakClass.JL) {
		if (
			after === LineBreakClass.JL ||
			after === LineBreakClass.JV ||
			after === LineBreakClass.H2 ||
			after === LineBreakClass.H3
		)
			return BreakAction.Prohibited;
	}
	if (before === LineBreakClass.JV || before === LineBreakClass.H2) {
		if (after === LineBreakClass.JV || after === LineBreakClass.JT)
			return BreakAction.Prohibited;
	}
	if (before === LineBreakClass.JT || before === LineBreakClass.H3) {
		if (after === LineBreakClass.JT) return BreakAction.Prohibited;
	}

	// LB27: Treat Korean syllables as ID
	if (
		before === LineBreakClass.JL ||
		before === LineBreakClass.JV ||
		before === LineBreakClass.JT ||
		before === LineBreakClass.H2 ||
		before === LineBreakClass.H3
	) {
		if (after === LineBreakClass.PO) return BreakAction.Prohibited;
	}
	if (
		after === LineBreakClass.JL ||
		after === LineBreakClass.JV ||
		after === LineBreakClass.JT ||
		after === LineBreakClass.H2 ||
		after === LineBreakClass.H3
	) {
		if (before === LineBreakClass.PR) return BreakAction.Prohibited;
	}

	// LB28: Do not break between alphabetics
	if (
		(before === LineBreakClass.AL || before === LineBreakClass.HL) &&
		(after === LineBreakClass.AL || after === LineBreakClass.HL)
	)
		return BreakAction.Prohibited;

	// LB29: Do not break between numeric punctuation and alphabetics
	if (
		before === LineBreakClass.IS &&
		(after === LineBreakClass.AL || after === LineBreakClass.HL)
	)
		return BreakAction.Prohibited;

	// LB30: Do not break between letters/numbers and opening/closing
	if (
		(before === LineBreakClass.AL ||
			before === LineBreakClass.HL ||
			before === LineBreakClass.NU) &&
		after === LineBreakClass.OP
	)
		return BreakAction.Prohibited;
	if (
		before === LineBreakClass.CP &&
		(after === LineBreakClass.AL ||
			after === LineBreakClass.HL ||
			after === LineBreakClass.NU)
	)
		return BreakAction.Prohibited;

	// LB30a: Break between pairs of regional indicator symbols
	if (before === LineBreakClass.RI && after === LineBreakClass.RI)
		return BreakAction.Prohibited;

	// LB30b: Do not break between an emoji base and an emoji modifier
	if (before === LineBreakClass.EB && after === LineBreakClass.EM)
		return BreakAction.Prohibited;

	// LB31: Break everywhere else
	return BreakAction.Direct;
}

/**
 * Result of line break analysis
 */
export interface LineBreakAnalysis {
	/** Break opportunities (one per character boundary) */
	breaks: BreakOpportunity[];
	/** Line break classes for each character */
	classes: LineBreakClass[];
}

/**
 * Analyze line break opportunities in text
 */
export function analyzeLineBreaks(text: string): LineBreakAnalysis {
	const codepoints: number[] = [];
	const chars = [...text];
	for (let i = 0; i < chars.length; i++) {
		const char = chars[i]!;
		codepoints.push(char.codePointAt(0) ?? 0);
	}

	return analyzeLineBreaksFromCodepoints(codepoints);
}

/**
 * Analyze line break opportunities from codepoints
 */
export function analyzeLineBreaksFromCodepoints(
	codepoints: number[],
): LineBreakAnalysis {
	const len = codepoints.length;
	const classes: LineBreakClass[] = [];
	const breaks: BreakOpportunity[] = [];

	// Get classes for all codepoints
	for (let i = 0; i < codepoints.length; i++) {
		const cp = codepoints[i]!;
		classes.push(getLineBreakClass(cp));
	}

	// LB1: Assign a line breaking class - done in getLineBreakClass

	// LB2: Never break at the start of text
	breaks.push(BreakOpportunity.NoBreak);

	// Process each boundary
	for (let i = 1; i < len; i++) {
		const before = classes[i - 1];
		const after = classes[i];

		const action = getPairAction(before, after);

		switch (action) {
			case BreakAction.Explicit:
				breaks.push(BreakOpportunity.Mandatory);
				break;
			case BreakAction.Direct:
				breaks.push(BreakOpportunity.Optional);
				break;
			case BreakAction.Indirect:
				// Look for intervening space
				if (before === LineBreakClass.SP) {
					breaks.push(BreakOpportunity.Optional);
				} else {
					breaks.push(BreakOpportunity.NoBreak);
				}
				break;
			default:
				breaks.push(BreakOpportunity.NoBreak);
		}
	}

	// LB3: Always break at the end of text
	breaks.push(BreakOpportunity.Mandatory);

	return { breaks, classes };
}

/**
 * Analyze line breaks for glyph infos
 */
export function analyzeLineBreaksForGlyphs(
	infos: GlyphInfo[],
): LineBreakAnalysis {
	const codepoints = infos.map((info) => info.codepoint);
	return analyzeLineBreaksFromCodepoints(codepoints);
}

/**
 * Find next line break opportunity
 */
export function findNextBreak(
	analysis: LineBreakAnalysis,
	startIndex: number,
): number {
	for (let i = startIndex + 1; i < analysis.breaks.length; i++) {
		if (analysis.breaks[i] !== BreakOpportunity.NoBreak) {
			return i;
		}
	}
	return analysis.breaks.length - 1;
}

/**
 * Check if break is allowed at position
 */
export function canBreakAt(
	analysis: LineBreakAnalysis,
	index: number,
): boolean {
	if (index < 0 || index >= analysis.breaks.length) return false;
	return analysis.breaks[index] !== BreakOpportunity.NoBreak;
}

/**
 * Check if break is mandatory at position
 */
export function mustBreakAt(
	analysis: LineBreakAnalysis,
	index: number,
): boolean {
	if (index < 0 || index >= analysis.breaks.length) return false;
	return analysis.breaks[index] === BreakOpportunity.Mandatory;
}

/**
 * Get all break opportunities
 */
export function getAllBreakOpportunities(
	analysis: LineBreakAnalysis,
): number[] {
	const opportunities: number[] = [];
	for (let i = 0; i < analysis.breaks.length; i++) {
		if (analysis.breaks[i] !== BreakOpportunity.NoBreak) {
			opportunities.push(i);
		}
	}
	return opportunities;
}
