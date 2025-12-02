/**
 * Unicode Script Detection
 * Detects the script of text based on codepoints
 */

/**
 * Unicode script values (ISO 15924)
 */
export enum Script {
	Common = "Zyyy",
	Inherited = "Zinh",
	Unknown = "Zzzz",

	// Major scripts
	Latin = "Latn",
	Greek = "Grek",
	Cyrillic = "Cyrl",
	Armenian = "Armn",
	Hebrew = "Hebr",
	Arabic = "Arab",
	Syriac = "Syrc",
	Thaana = "Thaa",
	Devanagari = "Deva",
	Bengali = "Beng",
	Gurmukhi = "Guru",
	Gujarati = "Gujr",
	Oriya = "Orya",
	Tamil = "Taml",
	Telugu = "Telu",
	Kannada = "Knda",
	Malayalam = "Mlym",
	Sinhala = "Sinh",
	Thai = "Thai",
	Lao = "Laoo",
	Tibetan = "Tibt",
	Myanmar = "Mymr",
	Georgian = "Geor",
	Hangul = "Hang",
	Ethiopic = "Ethi",
	Cherokee = "Cher",
	CanadianAboriginal = "Cans",
	Ogham = "Ogam",
	Runic = "Runr",
	Khmer = "Khmr",
	Mongolian = "Mong",
	Hiragana = "Hira",
	Katakana = "Kana",
	Bopomofo = "Bopo",
	Han = "Hani",
	Yi = "Yiii",
	OldItalic = "Ital",
	Gothic = "Goth",
	Deseret = "Dsrt",
	Tagalog = "Tglg",
	Hanunoo = "Hano",
	Buhid = "Buhd",
	Tagbanwa = "Tagb",
	Limbu = "Limb",
	TaiLe = "Tale",
	LinearB = "Linb",
	Ugaritic = "Ugar",
	Shavian = "Shaw",
	Osmanya = "Osma",
	Cypriot = "Cprt",
	Braille = "Brai",
	Buginese = "Bugi",
	Coptic = "Copt",
	NewTaiLue = "Talu",
	Glagolitic = "Glag",
	Tifinagh = "Tfng",
	SylotiNagri = "Sylo",
	OldPersian = "Xpeo",
	Kharoshthi = "Khar",
	Balinese = "Bali",
	Cuneiform = "Xsux",
	Phoenician = "Phnx",
	PhagsPa = "Phag",
	Nko = "Nkoo",
	Sundanese = "Sund",
	Lepcha = "Lepc",
	OlChiki = "Olck",
	Vai = "Vaii",
	Saurashtra = "Saur",
	KayahLi = "Kali",
	Rejang = "Rjng",
	Lycian = "Lyci",
	Carian = "Cari",
	Lydian = "Lydi",
	Cham = "Cham",
	TaiTham = "Lana",
	TaiViet = "Tavt",
	Avestan = "Avst",
	EgyptianHieroglyphs = "Egyp",
	Samaritan = "Samr",
	Lisu = "Lisu",
	Bamum = "Bamu",
	Javanese = "Java",
	MeeteiMayek = "Mtei",
	ImperialAramaic = "Armi",
	OldSouthArabian = "Sarb",
	InscriptionalParthian = "Prti",
	InscriptionalPahlavi = "Phli",
	OldTurkic = "Orkh",
	Kaithi = "Kthi",
	Batak = "Batk",
	Brahmi = "Brah",
	Mandaic = "Mand",
	Chakma = "Cakm",
	MeroiticCursive = "Merc",
	MeroiticHieroglyphs = "Mero",
	Miao = "Plrd",
	Sharada = "Shrd",
	SoraSompeng = "Sora",
	Takri = "Takr",
	CaucasianAlbanian = "Aghb",
	BassaVah = "Bass",
	Duployan = "Dupl",
	Elbasan = "Elba",
	Grantha = "Gran",
	PahawhHmong = "Hmng",
	Khojki = "Khoj",
	LinearA = "Lina",
	Mahajani = "Mahj",
	Manichaean = "Mani",
	MendeKikakui = "Mend",
	Modi = "Modi",
	Mro = "Mroo",
	OldNorthArabian = "Narb",
	Nabataean = "Nbat",
	Palmyrene = "Palm",
	PauCinHau = "Pauc",
	OldPermic = "Perm",
	PsalterPahlavi = "Phlp",
	Siddham = "Sidd",
	Khudawadi = "Sind",
	Tirhuta = "Tirh",
	WarangCiti = "Wara",
	Ahom = "Ahom",
	AnatolianHieroglyphs = "Hluw",
	Hatran = "Hatr",
	Multani = "Mult",
	OldHungarian = "Hung",
	SignWriting = "Sgnw",
	Adlam = "Adlm",
	Bhaiksuki = "Bhks",
	Marchen = "Marc",
	Newa = "Newa",
	Osage = "Osge",
	Tangut = "Tang",
	MasaramGondi = "Gonm",
	Nushu = "Nshu",
	Soyombo = "Soyo",
	ZanabazarSquare = "Zanb",
	Dogra = "Dogr",
	GunjalaGondi = "Gong",
	Makasar = "Maka",
	Medefaidrin = "Medf",
	HanifiRohingya = "Rohg",
	Sogdian = "Sogd",
	OldSogdian = "Sogo",
	Elymaic = "Elym",
	Nandinagari = "Nand",
	NyiakengPuachueHmong = "Hmnp",
	Wancho = "Wcho",
	Yezidi = "Yezi",
	Chorasmian = "Chrs",
	DivesAkuru = "Diak",
	KhitanSmallScript = "Kits",
	Vithkuqi = "Vith",
	OldUyghur = "Ougr",
	Cypro_Minoan = "Cpmn",
	Tangsa = "Tnsa",
	Toto = "Toto",
	Kawi = "Kawi",
	NagMundari = "Nagm",
}

/**
 * Script range entry
 */
interface ScriptRange {
	start: number;
	end: number;
	script: Script;
}

/**
 * Script ranges (sorted by start codepoint)
 */
const SCRIPT_RANGES: ScriptRange[] = [
	// Basic Latin
	{ start: 0x0000, end: 0x007f, script: Script.Common },
	// Latin-1 Supplement
	{ start: 0x0080, end: 0x00ff, script: Script.Latin },
	// Latin Extended-A
	{ start: 0x0100, end: 0x017f, script: Script.Latin },
	// Latin Extended-B
	{ start: 0x0180, end: 0x024f, script: Script.Latin },
	// IPA Extensions
	{ start: 0x0250, end: 0x02af, script: Script.Latin },
	// Spacing Modifier Letters
	{ start: 0x02b0, end: 0x02ff, script: Script.Common },
	// Combining Diacritical Marks
	{ start: 0x0300, end: 0x036f, script: Script.Inherited },
	// Greek and Coptic
	{ start: 0x0370, end: 0x03ff, script: Script.Greek },
	// Cyrillic
	{ start: 0x0400, end: 0x04ff, script: Script.Cyrillic },
	// Cyrillic Supplement
	{ start: 0x0500, end: 0x052f, script: Script.Cyrillic },
	// Armenian
	{ start: 0x0530, end: 0x058f, script: Script.Armenian },
	// Hebrew
	{ start: 0x0590, end: 0x05ff, script: Script.Hebrew },
	// Arabic
	{ start: 0x0600, end: 0x06ff, script: Script.Arabic },
	// Syriac
	{ start: 0x0700, end: 0x074f, script: Script.Syriac },
	// Arabic Supplement
	{ start: 0x0750, end: 0x077f, script: Script.Arabic },
	// Thaana
	{ start: 0x0780, end: 0x07bf, script: Script.Thaana },
	// NKo
	{ start: 0x07c0, end: 0x07ff, script: Script.Nko },
	// Samaritan
	{ start: 0x0800, end: 0x083f, script: Script.Samaritan },
	// Mandaic
	{ start: 0x0840, end: 0x085f, script: Script.Mandaic },
	// Syriac Supplement
	{ start: 0x0860, end: 0x086f, script: Script.Syriac },
	// Arabic Extended-B
	{ start: 0x0870, end: 0x089f, script: Script.Arabic },
	// Arabic Extended-A
	{ start: 0x08a0, end: 0x08ff, script: Script.Arabic },
	// Devanagari
	{ start: 0x0900, end: 0x097f, script: Script.Devanagari },
	// Bengali
	{ start: 0x0980, end: 0x09ff, script: Script.Bengali },
	// Gurmukhi
	{ start: 0x0a00, end: 0x0a7f, script: Script.Gurmukhi },
	// Gujarati
	{ start: 0x0a80, end: 0x0aff, script: Script.Gujarati },
	// Oriya
	{ start: 0x0b00, end: 0x0b7f, script: Script.Oriya },
	// Tamil
	{ start: 0x0b80, end: 0x0bff, script: Script.Tamil },
	// Telugu
	{ start: 0x0c00, end: 0x0c7f, script: Script.Telugu },
	// Kannada
	{ start: 0x0c80, end: 0x0cff, script: Script.Kannada },
	// Malayalam
	{ start: 0x0d00, end: 0x0d7f, script: Script.Malayalam },
	// Sinhala
	{ start: 0x0d80, end: 0x0dff, script: Script.Sinhala },
	// Thai
	{ start: 0x0e00, end: 0x0e7f, script: Script.Thai },
	// Lao
	{ start: 0x0e80, end: 0x0eff, script: Script.Lao },
	// Tibetan
	{ start: 0x0f00, end: 0x0fff, script: Script.Tibetan },
	// Myanmar
	{ start: 0x1000, end: 0x109f, script: Script.Myanmar },
	// Georgian
	{ start: 0x10a0, end: 0x10ff, script: Script.Georgian },
	// Hangul Jamo
	{ start: 0x1100, end: 0x11ff, script: Script.Hangul },
	// Ethiopic
	{ start: 0x1200, end: 0x137f, script: Script.Ethiopic },
	// Ethiopic Supplement
	{ start: 0x1380, end: 0x139f, script: Script.Ethiopic },
	// Cherokee
	{ start: 0x13a0, end: 0x13ff, script: Script.Cherokee },
	// Unified Canadian Aboriginal Syllabics
	{ start: 0x1400, end: 0x167f, script: Script.CanadianAboriginal },
	// Ogham
	{ start: 0x1680, end: 0x169f, script: Script.Ogham },
	// Runic
	{ start: 0x16a0, end: 0x16ff, script: Script.Runic },
	// Tagalog
	{ start: 0x1700, end: 0x171f, script: Script.Tagalog },
	// Hanunoo
	{ start: 0x1720, end: 0x173f, script: Script.Hanunoo },
	// Buhid
	{ start: 0x1740, end: 0x175f, script: Script.Buhid },
	// Tagbanwa
	{ start: 0x1760, end: 0x177f, script: Script.Tagbanwa },
	// Khmer
	{ start: 0x1780, end: 0x17ff, script: Script.Khmer },
	// Mongolian
	{ start: 0x1800, end: 0x18af, script: Script.Mongolian },
	// Unified Canadian Aboriginal Syllabics Extended
	{ start: 0x18b0, end: 0x18ff, script: Script.CanadianAboriginal },
	// Limbu
	{ start: 0x1900, end: 0x194f, script: Script.Limbu },
	// Tai Le
	{ start: 0x1950, end: 0x197f, script: Script.TaiLe },
	// New Tai Lue
	{ start: 0x1980, end: 0x19df, script: Script.NewTaiLue },
	// Khmer Symbols
	{ start: 0x19e0, end: 0x19ff, script: Script.Khmer },
	// Buginese
	{ start: 0x1a00, end: 0x1a1f, script: Script.Buginese },
	// Tai Tham
	{ start: 0x1a20, end: 0x1aaf, script: Script.TaiTham },
	// Combining Diacritical Marks Extended
	{ start: 0x1ab0, end: 0x1aff, script: Script.Inherited },
	// Balinese
	{ start: 0x1b00, end: 0x1b7f, script: Script.Balinese },
	// Sundanese
	{ start: 0x1b80, end: 0x1bbf, script: Script.Sundanese },
	// Batak
	{ start: 0x1bc0, end: 0x1bff, script: Script.Batak },
	// Lepcha
	{ start: 0x1c00, end: 0x1c4f, script: Script.Lepcha },
	// Ol Chiki
	{ start: 0x1c50, end: 0x1c7f, script: Script.OlChiki },
	// Cyrillic Extended-C
	{ start: 0x1c80, end: 0x1c8f, script: Script.Cyrillic },
	// Georgian Extended
	{ start: 0x1c90, end: 0x1cbf, script: Script.Georgian },
	// Sundanese Supplement
	{ start: 0x1cc0, end: 0x1ccf, script: Script.Sundanese },
	// Vedic Extensions
	{ start: 0x1cd0, end: 0x1cff, script: Script.Inherited },
	// Phonetic Extensions
	{ start: 0x1d00, end: 0x1d7f, script: Script.Latin },
	// Phonetic Extensions Supplement
	{ start: 0x1d80, end: 0x1dbf, script: Script.Latin },
	// Combining Diacritical Marks Supplement
	{ start: 0x1dc0, end: 0x1dff, script: Script.Inherited },
	// Latin Extended Additional
	{ start: 0x1e00, end: 0x1eff, script: Script.Latin },
	// Greek Extended
	{ start: 0x1f00, end: 0x1fff, script: Script.Greek },
	// General Punctuation
	{ start: 0x2000, end: 0x206f, script: Script.Common },
	// Superscripts and Subscripts
	{ start: 0x2070, end: 0x209f, script: Script.Common },
	// Currency Symbols
	{ start: 0x20a0, end: 0x20cf, script: Script.Common },
	// Combining Diacritical Marks for Symbols
	{ start: 0x20d0, end: 0x20ff, script: Script.Inherited },
	// Letterlike Symbols
	{ start: 0x2100, end: 0x214f, script: Script.Common },
	// Number Forms
	{ start: 0x2150, end: 0x218f, script: Script.Common },
	// Arrows
	{ start: 0x2190, end: 0x21ff, script: Script.Common },
	// Mathematical Operators
	{ start: 0x2200, end: 0x22ff, script: Script.Common },
	// Miscellaneous Technical
	{ start: 0x2300, end: 0x23ff, script: Script.Common },
	// Control Pictures
	{ start: 0x2400, end: 0x243f, script: Script.Common },
	// OCR
	{ start: 0x2440, end: 0x245f, script: Script.Common },
	// Enclosed Alphanumerics
	{ start: 0x2460, end: 0x24ff, script: Script.Common },
	// Box Drawing
	{ start: 0x2500, end: 0x257f, script: Script.Common },
	// Block Elements
	{ start: 0x2580, end: 0x259f, script: Script.Common },
	// Geometric Shapes
	{ start: 0x25a0, end: 0x25ff, script: Script.Common },
	// Miscellaneous Symbols
	{ start: 0x2600, end: 0x26ff, script: Script.Common },
	// Dingbats
	{ start: 0x2700, end: 0x27bf, script: Script.Common },
	// Miscellaneous Mathematical Symbols-A
	{ start: 0x27c0, end: 0x27ef, script: Script.Common },
	// Supplemental Arrows-A
	{ start: 0x27f0, end: 0x27ff, script: Script.Common },
	// Braille Patterns
	{ start: 0x2800, end: 0x28ff, script: Script.Braille },
	// Supplemental Arrows-B
	{ start: 0x2900, end: 0x297f, script: Script.Common },
	// Miscellaneous Mathematical Symbols-B
	{ start: 0x2980, end: 0x29ff, script: Script.Common },
	// Supplemental Mathematical Operators
	{ start: 0x2a00, end: 0x2aff, script: Script.Common },
	// Miscellaneous Symbols and Arrows
	{ start: 0x2b00, end: 0x2bff, script: Script.Common },
	// Glagolitic
	{ start: 0x2c00, end: 0x2c5f, script: Script.Glagolitic },
	// Latin Extended-C
	{ start: 0x2c60, end: 0x2c7f, script: Script.Latin },
	// Coptic
	{ start: 0x2c80, end: 0x2cff, script: Script.Coptic },
	// Georgian Supplement
	{ start: 0x2d00, end: 0x2d2f, script: Script.Georgian },
	// Tifinagh
	{ start: 0x2d30, end: 0x2d7f, script: Script.Tifinagh },
	// Ethiopic Extended
	{ start: 0x2d80, end: 0x2ddf, script: Script.Ethiopic },
	// Cyrillic Extended-A
	{ start: 0x2de0, end: 0x2dff, script: Script.Cyrillic },
	// Supplemental Punctuation
	{ start: 0x2e00, end: 0x2e7f, script: Script.Common },
	// CJK Radicals Supplement
	{ start: 0x2e80, end: 0x2eff, script: Script.Han },
	// Kangxi Radicals
	{ start: 0x2f00, end: 0x2fdf, script: Script.Han },
	// Ideographic Description Characters
	{ start: 0x2ff0, end: 0x2fff, script: Script.Common },
	// CJK Symbols and Punctuation
	{ start: 0x3000, end: 0x303f, script: Script.Common },
	// Hiragana
	{ start: 0x3040, end: 0x309f, script: Script.Hiragana },
	// Katakana
	{ start: 0x30a0, end: 0x30ff, script: Script.Katakana },
	// Bopomofo
	{ start: 0x3100, end: 0x312f, script: Script.Bopomofo },
	// Hangul Compatibility Jamo
	{ start: 0x3130, end: 0x318f, script: Script.Hangul },
	// Kanbun
	{ start: 0x3190, end: 0x319f, script: Script.Common },
	// Bopomofo Extended
	{ start: 0x31a0, end: 0x31bf, script: Script.Bopomofo },
	// CJK Strokes
	{ start: 0x31c0, end: 0x31ef, script: Script.Common },
	// Katakana Phonetic Extensions
	{ start: 0x31f0, end: 0x31ff, script: Script.Katakana },
	// Enclosed CJK Letters and Months
	{ start: 0x3200, end: 0x32ff, script: Script.Common },
	// CJK Compatibility
	{ start: 0x3300, end: 0x33ff, script: Script.Common },
	// CJK Unified Ideographs Extension A
	{ start: 0x3400, end: 0x4dbf, script: Script.Han },
	// Yijing Hexagram Symbols
	{ start: 0x4dc0, end: 0x4dff, script: Script.Common },
	// CJK Unified Ideographs
	{ start: 0x4e00, end: 0x9fff, script: Script.Han },
	// Yi Syllables
	{ start: 0xa000, end: 0xa48f, script: Script.Yi },
	// Yi Radicals
	{ start: 0xa490, end: 0xa4cf, script: Script.Yi },
	// Lisu
	{ start: 0xa4d0, end: 0xa4ff, script: Script.Lisu },
	// Vai
	{ start: 0xa500, end: 0xa63f, script: Script.Vai },
	// Cyrillic Extended-B
	{ start: 0xa640, end: 0xa69f, script: Script.Cyrillic },
	// Bamum
	{ start: 0xa6a0, end: 0xa6ff, script: Script.Bamum },
	// Modifier Tone Letters
	{ start: 0xa700, end: 0xa71f, script: Script.Common },
	// Latin Extended-D
	{ start: 0xa720, end: 0xa7ff, script: Script.Latin },
	// Syloti Nagri
	{ start: 0xa800, end: 0xa82f, script: Script.SylotiNagri },
	// Common Indic Number Forms
	{ start: 0xa830, end: 0xa83f, script: Script.Common },
	// Phags-pa
	{ start: 0xa840, end: 0xa87f, script: Script.PhagsPa },
	// Saurashtra
	{ start: 0xa880, end: 0xa8df, script: Script.Saurashtra },
	// Devanagari Extended
	{ start: 0xa8e0, end: 0xa8ff, script: Script.Devanagari },
	// Kayah Li
	{ start: 0xa900, end: 0xa92f, script: Script.KayahLi },
	// Rejang
	{ start: 0xa930, end: 0xa95f, script: Script.Rejang },
	// Hangul Jamo Extended-A
	{ start: 0xa960, end: 0xa97f, script: Script.Hangul },
	// Javanese
	{ start: 0xa980, end: 0xa9df, script: Script.Javanese },
	// Myanmar Extended-B
	{ start: 0xa9e0, end: 0xa9ff, script: Script.Myanmar },
	// Cham
	{ start: 0xaa00, end: 0xaa5f, script: Script.Cham },
	// Myanmar Extended-A
	{ start: 0xaa60, end: 0xaa7f, script: Script.Myanmar },
	// Tai Viet
	{ start: 0xaa80, end: 0xaadf, script: Script.TaiViet },
	// Meetei Mayek Extensions
	{ start: 0xaae0, end: 0xaaff, script: Script.MeeteiMayek },
	// Ethiopic Extended-A
	{ start: 0xab00, end: 0xab2f, script: Script.Ethiopic },
	// Latin Extended-E
	{ start: 0xab30, end: 0xab6f, script: Script.Latin },
	// Cherokee Supplement
	{ start: 0xab70, end: 0xabbf, script: Script.Cherokee },
	// Meetei Mayek
	{ start: 0xabc0, end: 0xabff, script: Script.MeeteiMayek },
	// Hangul Syllables
	{ start: 0xac00, end: 0xd7af, script: Script.Hangul },
	// Hangul Jamo Extended-B
	{ start: 0xd7b0, end: 0xd7ff, script: Script.Hangul },
	// High Surrogates, Low Surrogates
	{ start: 0xd800, end: 0xdfff, script: Script.Unknown },
	// Private Use Area
	{ start: 0xe000, end: 0xf8ff, script: Script.Unknown },
	// CJK Compatibility Ideographs
	{ start: 0xf900, end: 0xfaff, script: Script.Han },
	// Alphabetic Presentation Forms
	{ start: 0xfb00, end: 0xfb4f, script: Script.Latin },
	// Arabic Presentation Forms-A
	{ start: 0xfb50, end: 0xfdff, script: Script.Arabic },
	// Variation Selectors
	{ start: 0xfe00, end: 0xfe0f, script: Script.Inherited },
	// Vertical Forms
	{ start: 0xfe10, end: 0xfe1f, script: Script.Common },
	// Combining Half Marks
	{ start: 0xfe20, end: 0xfe2f, script: Script.Inherited },
	// CJK Compatibility Forms
	{ start: 0xfe30, end: 0xfe4f, script: Script.Common },
	// Small Form Variants
	{ start: 0xfe50, end: 0xfe6f, script: Script.Common },
	// Arabic Presentation Forms-B
	{ start: 0xfe70, end: 0xfeff, script: Script.Arabic },
	// Halfwidth and Fullwidth Forms
	{ start: 0xff00, end: 0xffef, script: Script.Common },
	// Specials
	{ start: 0xfff0, end: 0xffff, script: Script.Common },
	// Linear B Syllabary
	{ start: 0x10000, end: 0x1007f, script: Script.LinearB },
	// Linear B Ideograms
	{ start: 0x10080, end: 0x100ff, script: Script.LinearB },
	// Aegean Numbers
	{ start: 0x10100, end: 0x1013f, script: Script.Common },
	// Ancient Greek Numbers
	{ start: 0x10140, end: 0x1018f, script: Script.Greek },
	// Ancient Symbols
	{ start: 0x10190, end: 0x101cf, script: Script.Common },
	// Phaistos Disc
	{ start: 0x101d0, end: 0x101ff, script: Script.Common },
	// Lycian
	{ start: 0x10280, end: 0x1029f, script: Script.Lycian },
	// Carian
	{ start: 0x102a0, end: 0x102df, script: Script.Carian },
	// Coptic Epact Numbers
	{ start: 0x102e0, end: 0x102ff, script: Script.Inherited },
	// Old Italic
	{ start: 0x10300, end: 0x1032f, script: Script.OldItalic },
	// Gothic
	{ start: 0x10330, end: 0x1034f, script: Script.Gothic },
	// Old Permic
	{ start: 0x10350, end: 0x1037f, script: Script.OldPermic },
	// Ugaritic
	{ start: 0x10380, end: 0x1039f, script: Script.Ugaritic },
	// Old Persian
	{ start: 0x103a0, end: 0x103df, script: Script.OldPersian },
	// Deseret
	{ start: 0x10400, end: 0x1044f, script: Script.Deseret },
	// Shavian
	{ start: 0x10450, end: 0x1047f, script: Script.Shavian },
	// Osmanya
	{ start: 0x10480, end: 0x104af, script: Script.Osmanya },
	// Osage
	{ start: 0x104b0, end: 0x104ff, script: Script.Osage },
	// Elbasan
	{ start: 0x10500, end: 0x1052f, script: Script.Elbasan },
	// Caucasian Albanian
	{ start: 0x10530, end: 0x1056f, script: Script.CaucasianAlbanian },
	// Vithkuqi
	{ start: 0x10570, end: 0x105bf, script: Script.Vithkuqi },
	// Linear A
	{ start: 0x10600, end: 0x1077f, script: Script.LinearA },
	// Latin Extended-F
	{ start: 0x10780, end: 0x107bf, script: Script.Latin },
	// Cypriot Syllabary
	{ start: 0x10800, end: 0x1083f, script: Script.Cypriot },
	// Imperial Aramaic
	{ start: 0x10840, end: 0x1085f, script: Script.ImperialAramaic },
	// Palmyrene
	{ start: 0x10860, end: 0x1087f, script: Script.Palmyrene },
	// Nabataean
	{ start: 0x10880, end: 0x108af, script: Script.Nabataean },
	// Hatran
	{ start: 0x108e0, end: 0x108ff, script: Script.Hatran },
	// Phoenician
	{ start: 0x10900, end: 0x1091f, script: Script.Phoenician },
	// Lydian
	{ start: 0x10920, end: 0x1093f, script: Script.Lydian },
	// Meroitic Hieroglyphs
	{ start: 0x10980, end: 0x1099f, script: Script.MeroiticHieroglyphs },
	// Meroitic Cursive
	{ start: 0x109a0, end: 0x109ff, script: Script.MeroiticCursive },
	// Kharoshthi
	{ start: 0x10a00, end: 0x10a5f, script: Script.Kharoshthi },
	// Old South Arabian
	{ start: 0x10a60, end: 0x10a7f, script: Script.OldSouthArabian },
	// Old North Arabian
	{ start: 0x10a80, end: 0x10a9f, script: Script.OldNorthArabian },
	// Manichaean
	{ start: 0x10ac0, end: 0x10aff, script: Script.Manichaean },
	// Avestan
	{ start: 0x10b00, end: 0x10b3f, script: Script.Avestan },
	// Inscriptional Parthian
	{ start: 0x10b40, end: 0x10b5f, script: Script.InscriptionalParthian },
	// Inscriptional Pahlavi
	{ start: 0x10b60, end: 0x10b7f, script: Script.InscriptionalPahlavi },
	// Psalter Pahlavi
	{ start: 0x10b80, end: 0x10baf, script: Script.PsalterPahlavi },
	// Old Turkic
	{ start: 0x10c00, end: 0x10c4f, script: Script.OldTurkic },
	// Old Hungarian
	{ start: 0x10c80, end: 0x10cff, script: Script.OldHungarian },
	// Hanifi Rohingya
	{ start: 0x10d00, end: 0x10d3f, script: Script.HanifiRohingya },
	// Yezidi
	{ start: 0x10e80, end: 0x10ebf, script: Script.Yezidi },
	// Old Sogdian
	{ start: 0x10f00, end: 0x10f2f, script: Script.OldSogdian },
	// Sogdian
	{ start: 0x10f30, end: 0x10f6f, script: Script.Sogdian },
	// Old Uyghur
	{ start: 0x10f70, end: 0x10faf, script: Script.OldUyghur },
	// Chorasmian
	{ start: 0x10fb0, end: 0x10fdf, script: Script.Chorasmian },
	// Elymaic
	{ start: 0x10fe0, end: 0x10fff, script: Script.Elymaic },
	// Brahmi
	{ start: 0x11000, end: 0x1107f, script: Script.Brahmi },
	// Kaithi
	{ start: 0x11080, end: 0x110cf, script: Script.Kaithi },
	// Sora Sompeng
	{ start: 0x110d0, end: 0x110ff, script: Script.SoraSompeng },
	// Chakma
	{ start: 0x11100, end: 0x1114f, script: Script.Chakma },
	// Mahajani
	{ start: 0x11150, end: 0x1117f, script: Script.Mahajani },
	// Sharada
	{ start: 0x11180, end: 0x111df, script: Script.Sharada },
	// Sinhala Archaic Numbers
	{ start: 0x111e0, end: 0x111ff, script: Script.Sinhala },
	// Khojki
	{ start: 0x11200, end: 0x1124f, script: Script.Khojki },
	// Multani
	{ start: 0x11280, end: 0x112af, script: Script.Multani },
	// Khudawadi
	{ start: 0x112b0, end: 0x112ff, script: Script.Khudawadi },
	// Grantha
	{ start: 0x11300, end: 0x1137f, script: Script.Grantha },
	// Newa
	{ start: 0x11400, end: 0x1147f, script: Script.Newa },
	// Tirhuta
	{ start: 0x11480, end: 0x114df, script: Script.Tirhuta },
	// Siddham
	{ start: 0x11580, end: 0x115ff, script: Script.Siddham },
	// Modi
	{ start: 0x11600, end: 0x1165f, script: Script.Modi },
	// Mongolian Supplement
	{ start: 0x11660, end: 0x1167f, script: Script.Mongolian },
	// Takri
	{ start: 0x11680, end: 0x116cf, script: Script.Takri },
	// Ahom
	{ start: 0x11700, end: 0x1174f, script: Script.Ahom },
	// Dogra
	{ start: 0x11800, end: 0x1184f, script: Script.Dogra },
	// Warang Citi
	{ start: 0x118a0, end: 0x118ff, script: Script.WarangCiti },
	// Dives Akuru
	{ start: 0x11900, end: 0x1195f, script: Script.DivesAkuru },
	// Nandinagari
	{ start: 0x119a0, end: 0x119ff, script: Script.Nandinagari },
	// Zanabazar Square
	{ start: 0x11a00, end: 0x11a4f, script: Script.ZanabazarSquare },
	// Soyombo
	{ start: 0x11a50, end: 0x11aaf, script: Script.Soyombo },
	// UCAS Extended-A
	{ start: 0x11ab0, end: 0x11abf, script: Script.CanadianAboriginal },
	// Pau Cin Hau
	{ start: 0x11ac0, end: 0x11aff, script: Script.PauCinHau },
	// Bhaiksuki
	{ start: 0x11c00, end: 0x11c6f, script: Script.Bhaiksuki },
	// Marchen
	{ start: 0x11c70, end: 0x11cbf, script: Script.Marchen },
	// Masaram Gondi
	{ start: 0x11d00, end: 0x11d5f, script: Script.MasaramGondi },
	// Gunjala Gondi
	{ start: 0x11d60, end: 0x11daf, script: Script.GunjalaGondi },
	// Makasar
	{ start: 0x11ee0, end: 0x11eff, script: Script.Makasar },
	// Kawi
	{ start: 0x11f00, end: 0x11f5f, script: Script.Kawi },
	// Cuneiform
	{ start: 0x12000, end: 0x123ff, script: Script.Cuneiform },
	// Cuneiform Numbers and Punctuation
	{ start: 0x12400, end: 0x1247f, script: Script.Cuneiform },
	// Early Dynastic Cuneiform
	{ start: 0x12480, end: 0x1254f, script: Script.Cuneiform },
	// Cypro-Minoan
	{ start: 0x12f90, end: 0x12fff, script: Script.Cypro_Minoan },
	// Egyptian Hieroglyphs
	{ start: 0x13000, end: 0x1342f, script: Script.EgyptianHieroglyphs },
	// Egyptian Hieroglyph Format Controls
	{ start: 0x13430, end: 0x1345f, script: Script.EgyptianHieroglyphs },
	// Anatolian Hieroglyphs
	{ start: 0x14400, end: 0x1467f, script: Script.AnatolianHieroglyphs },
	// Bamum Supplement
	{ start: 0x16800, end: 0x16a3f, script: Script.Bamum },
	// Mro
	{ start: 0x16a40, end: 0x16a6f, script: Script.Mro },
	// Tangsa
	{ start: 0x16a70, end: 0x16acf, script: Script.Tangsa },
	// Bassa Vah
	{ start: 0x16ad0, end: 0x16aff, script: Script.BassaVah },
	// Pahawh Hmong
	{ start: 0x16b00, end: 0x16b8f, script: Script.PahawhHmong },
	// Medefaidrin
	{ start: 0x16e40, end: 0x16e9f, script: Script.Medefaidrin },
	// Miao
	{ start: 0x16f00, end: 0x16f9f, script: Script.Miao },
	// Ideographic Symbols and Punctuation
	{ start: 0x16fe0, end: 0x16fff, script: Script.Common },
	// Tangut
	{ start: 0x17000, end: 0x187ff, script: Script.Tangut },
	// Tangut Components
	{ start: 0x18800, end: 0x18aff, script: Script.Tangut },
	// Khitan Small Script
	{ start: 0x18b00, end: 0x18cff, script: Script.KhitanSmallScript },
	// Tangut Supplement
	{ start: 0x18d00, end: 0x18d7f, script: Script.Tangut },
	// Kana Extended-B
	{ start: 0x1aff0, end: 0x1afff, script: Script.Katakana },
	// Kana Supplement
	{ start: 0x1b000, end: 0x1b0ff, script: Script.Hiragana },
	// Kana Extended-A
	{ start: 0x1b100, end: 0x1b12f, script: Script.Hiragana },
	// Small Kana Extension
	{ start: 0x1b130, end: 0x1b16f, script: Script.Katakana },
	// Nushu
	{ start: 0x1b170, end: 0x1b2ff, script: Script.Nushu },
	// Duployan
	{ start: 0x1bc00, end: 0x1bc9f, script: Script.Duployan },
	// Shorthand Format Controls
	{ start: 0x1bca0, end: 0x1bcaf, script: Script.Common },
	// Znamenny Musical Notation
	{ start: 0x1cf00, end: 0x1cfcf, script: Script.Common },
	// Byzantine Musical Symbols
	{ start: 0x1d000, end: 0x1d0ff, script: Script.Common },
	// Musical Symbols
	{ start: 0x1d100, end: 0x1d1ff, script: Script.Common },
	// Ancient Greek Musical Notation
	{ start: 0x1d200, end: 0x1d24f, script: Script.Greek },
	// Kaktovik Numerals
	{ start: 0x1d2c0, end: 0x1d2df, script: Script.Common },
	// Mayan Numerals
	{ start: 0x1d2e0, end: 0x1d2ff, script: Script.Common },
	// Tai Xuan Jing Symbols
	{ start: 0x1d300, end: 0x1d35f, script: Script.Common },
	// Counting Rod Numerals
	{ start: 0x1d360, end: 0x1d37f, script: Script.Common },
	// Mathematical Alphanumeric Symbols
	{ start: 0x1d400, end: 0x1d7ff, script: Script.Common },
	// Sutton SignWriting
	{ start: 0x1d800, end: 0x1daaf, script: Script.SignWriting },
	// Latin Extended-G
	{ start: 0x1df00, end: 0x1dfff, script: Script.Latin },
	// Glagolitic Supplement
	{ start: 0x1e000, end: 0x1e02f, script: Script.Glagolitic },
	// Cyrillic Extended-D
	{ start: 0x1e030, end: 0x1e08f, script: Script.Cyrillic },
	// Nyiakeng Puachue Hmong
	{ start: 0x1e100, end: 0x1e14f, script: Script.NyiakengPuachueHmong },
	// Toto
	{ start: 0x1e290, end: 0x1e2bf, script: Script.Toto },
	// Wancho
	{ start: 0x1e2c0, end: 0x1e2ff, script: Script.Wancho },
	// Nag Mundari
	{ start: 0x1e4d0, end: 0x1e4ff, script: Script.NagMundari },
	// Ethiopic Extended-B
	{ start: 0x1e7e0, end: 0x1e7ff, script: Script.Ethiopic },
	// Mende Kikakui
	{ start: 0x1e800, end: 0x1e8df, script: Script.MendeKikakui },
	// Adlam
	{ start: 0x1e900, end: 0x1e95f, script: Script.Adlam },
	// Indic Siyaq Numbers
	{ start: 0x1ec70, end: 0x1ecbf, script: Script.Common },
	// Ottoman Siyaq Numbers
	{ start: 0x1ed00, end: 0x1ed4f, script: Script.Common },
	// Arabic Mathematical Alphabetic Symbols
	{ start: 0x1ee00, end: 0x1eeff, script: Script.Arabic },
	// Mahjong Tiles
	{ start: 0x1f000, end: 0x1f02f, script: Script.Common },
	// Domino Tiles
	{ start: 0x1f030, end: 0x1f09f, script: Script.Common },
	// Playing Cards
	{ start: 0x1f0a0, end: 0x1f0ff, script: Script.Common },
	// Enclosed Alphanumeric Supplement
	{ start: 0x1f100, end: 0x1f1ff, script: Script.Common },
	// Enclosed Ideographic Supplement
	{ start: 0x1f200, end: 0x1f2ff, script: Script.Common },
	// Miscellaneous Symbols and Pictographs
	{ start: 0x1f300, end: 0x1f5ff, script: Script.Common },
	// Emoticons
	{ start: 0x1f600, end: 0x1f64f, script: Script.Common },
	// Ornamental Dingbats
	{ start: 0x1f650, end: 0x1f67f, script: Script.Common },
	// Transport and Map Symbols
	{ start: 0x1f680, end: 0x1f6ff, script: Script.Common },
	// Alchemical Symbols
	{ start: 0x1f700, end: 0x1f77f, script: Script.Common },
	// Geometric Shapes Extended
	{ start: 0x1f780, end: 0x1f7ff, script: Script.Common },
	// Supplemental Arrows-C
	{ start: 0x1f800, end: 0x1f8ff, script: Script.Common },
	// Supplemental Symbols and Pictographs
	{ start: 0x1f900, end: 0x1f9ff, script: Script.Common },
	// Chess Symbols
	{ start: 0x1fa00, end: 0x1fa6f, script: Script.Common },
	// Symbols and Pictographs Extended-A
	{ start: 0x1fa70, end: 0x1faff, script: Script.Common },
	// Symbols for Legacy Computing
	{ start: 0x1fb00, end: 0x1fbff, script: Script.Common },
	// CJK Unified Ideographs Extension B
	{ start: 0x20000, end: 0x2a6df, script: Script.Han },
	// CJK Unified Ideographs Extension C
	{ start: 0x2a700, end: 0x2b73f, script: Script.Han },
	// CJK Unified Ideographs Extension D
	{ start: 0x2b740, end: 0x2b81f, script: Script.Han },
	// CJK Unified Ideographs Extension E
	{ start: 0x2b820, end: 0x2ceaf, script: Script.Han },
	// CJK Unified Ideographs Extension F
	{ start: 0x2ceb0, end: 0x2ebef, script: Script.Han },
	// CJK Compatibility Ideographs Supplement
	{ start: 0x2f800, end: 0x2fa1f, script: Script.Han },
	// CJK Unified Ideographs Extension G
	{ start: 0x30000, end: 0x3134f, script: Script.Han },
	// CJK Unified Ideographs Extension H
	{ start: 0x31350, end: 0x323af, script: Script.Han },
	// Tags
	{ start: 0xe0000, end: 0xe007f, script: Script.Common },
	// Variation Selectors Supplement
	{ start: 0xe0100, end: 0xe01ef, script: Script.Inherited },
	// Supplementary Private Use Area-A
	{ start: 0xf0000, end: 0xfffff, script: Script.Unknown },
	// Supplementary Private Use Area-B
	{ start: 0x100000, end: 0x10ffff, script: Script.Unknown },
];

/**
 * Get script for a codepoint using binary search
 */
export function getScript(cp: number): Script {
	let left = 0;
	let right = SCRIPT_RANGES.length - 1;

	while (left <= right) {
		const mid = (left + right) >>> 1;
		const range = SCRIPT_RANGES[mid]!;

		if (cp < range.start) {
			right = mid - 1;
		} else if (cp > range.end) {
			left = mid + 1;
		} else {
			return range.script;
		}
	}

	return Script.Unknown;
}

/**
 * Get script for a string (returns the dominant non-Common/Inherited script)
 */
export function detectScript(text: string): Script {
	const counts = new Map<Script, number>();

	for (const char of text) {
		const cp = char.codePointAt(0) ?? 0;
		const script = getScript(cp);

		// Skip Common and Inherited scripts
		if (script === Script.Common || script === Script.Inherited) {
			continue;
		}

		counts.set(script, (counts.get(script) ?? 0) + 1);
	}

	if (counts.size === 0) {
		return Script.Common;
	}

	// Return the most frequent script
	let maxScript = Script.Common;
	let maxCount = 0;

	for (const [script, count] of counts) {
		if (count > maxCount) {
			maxCount = count;
			maxScript = script;
		}
	}

	return maxScript;
}

/**
 * Get all scripts present in text
 */
export function getScripts(text: string): Script[] {
	const scripts = new Set<Script>();

	for (const char of text) {
		const cp = char.codePointAt(0) ?? 0;
		const script = getScript(cp);
		scripts.add(script);
	}

	return Array.from(scripts);
}

/**
 * Check if text contains only characters from a specific script
 * (Common and Inherited are allowed)
 */
export function isScript(text: string, script: Script): boolean {
	for (const char of text) {
		const cp = char.codePointAt(0) ?? 0;
		const charScript = getScript(cp);

		if (
			charScript !== script &&
			charScript !== Script.Common &&
			charScript !== Script.Inherited
		) {
			return false;
		}
	}

	return true;
}

/**
 * Script run - a contiguous sequence of characters with the same script
 */
export interface ScriptRun {
	script: Script;
	start: number;
	end: number;
	text: string;
}

/**
 * Split text into script runs
 */
export function getScriptRuns(text: string): ScriptRun[] {
	const runs: ScriptRun[] = [];
	if (text.length === 0) return runs;

	let currentScript: Script | null = null;
	let runStart = 0;
	let charIndex = 0;

	const chars: string[] = [];
	for (const char of text) {
		chars.push(char);
	}

	for (let i = 0; i < chars.length; i++) {
		const char = chars[i]!;
		const cp = char.codePointAt(0) ?? 0;
		let script = getScript(cp);

		// Treat Common and Inherited as part of the current run
		if (script === Script.Common || script === Script.Inherited) {
			if (currentScript !== null) {
				script = currentScript;
			}
		}

		if (currentScript === null) {
			currentScript = script;
			runStart = i;
		} else if (script !== currentScript && script !== Script.Common && script !== Script.Inherited) {
			// End current run
			runs.push({
				script: currentScript,
				start: runStart,
				end: i,
				text: chars.slice(runStart, i).join(""),
			});
			currentScript = script;
			runStart = i;
		}
	}

	// Add final run
	if (currentScript !== null) {
		runs.push({
			script: currentScript,
			start: runStart,
			end: chars.length,
			text: chars.slice(runStart).join(""),
		});
	}

	return runs;
}

/**
 * Get OpenType script tag for a Unicode script
 */
export function getScriptTag(script: Script): string {
	// Map Script enum to OpenType script tags
	const tagMap: Record<Script, string> = {
		[Script.Common]: "DFLT",
		[Script.Inherited]: "DFLT",
		[Script.Unknown]: "DFLT",
		[Script.Latin]: "latn",
		[Script.Greek]: "grek",
		[Script.Cyrillic]: "cyrl",
		[Script.Armenian]: "armn",
		[Script.Hebrew]: "hebr",
		[Script.Arabic]: "arab",
		[Script.Syriac]: "syrc",
		[Script.Thaana]: "thaa",
		[Script.Devanagari]: "deva",
		[Script.Bengali]: "beng",
		[Script.Gurmukhi]: "guru",
		[Script.Gujarati]: "gujr",
		[Script.Oriya]: "orya",
		[Script.Tamil]: "taml",
		[Script.Telugu]: "telu",
		[Script.Kannada]: "knda",
		[Script.Malayalam]: "mlym",
		[Script.Sinhala]: "sinh",
		[Script.Thai]: "thai",
		[Script.Lao]: "lao ",
		[Script.Tibetan]: "tibt",
		[Script.Myanmar]: "mymr",
		[Script.Georgian]: "geor",
		[Script.Hangul]: "hang",
		[Script.Ethiopic]: "ethi",
		[Script.Cherokee]: "cher",
		[Script.CanadianAboriginal]: "cans",
		[Script.Ogham]: "ogam",
		[Script.Runic]: "runr",
		[Script.Khmer]: "khmr",
		[Script.Mongolian]: "mong",
		[Script.Hiragana]: "kana",
		[Script.Katakana]: "kana",
		[Script.Bopomofo]: "bopo",
		[Script.Han]: "hani",
		[Script.Yi]: "yi  ",
		[Script.OldItalic]: "ital",
		[Script.Gothic]: "goth",
		[Script.Deseret]: "dsrt",
		[Script.Tagalog]: "tglg",
		[Script.Hanunoo]: "hano",
		[Script.Buhid]: "buhd",
		[Script.Tagbanwa]: "tagb",
		[Script.Limbu]: "limb",
		[Script.TaiLe]: "tale",
		[Script.LinearB]: "linb",
		[Script.Ugaritic]: "ugar",
		[Script.Shavian]: "shaw",
		[Script.Osmanya]: "osma",
		[Script.Cypriot]: "cprt",
		[Script.Braille]: "brai",
		[Script.Buginese]: "bugi",
		[Script.Coptic]: "copt",
		[Script.NewTaiLue]: "talu",
		[Script.Glagolitic]: "glag",
		[Script.Tifinagh]: "tfng",
		[Script.SylotiNagri]: "sylo",
		[Script.OldPersian]: "xpeo",
		[Script.Kharoshthi]: "khar",
		[Script.Balinese]: "bali",
		[Script.Cuneiform]: "xsux",
		[Script.Phoenician]: "phnx",
		[Script.PhagsPa]: "phag",
		[Script.Nko]: "nko ",
		[Script.Sundanese]: "sund",
		[Script.Lepcha]: "lepc",
		[Script.OlChiki]: "olck",
		[Script.Vai]: "vai ",
		[Script.Saurashtra]: "saur",
		[Script.KayahLi]: "kali",
		[Script.Rejang]: "rjng",
		[Script.Lycian]: "lyci",
		[Script.Carian]: "cari",
		[Script.Lydian]: "lydi",
		[Script.Cham]: "cham",
		[Script.TaiTham]: "lana",
		[Script.TaiViet]: "tavt",
		[Script.Avestan]: "avst",
		[Script.EgyptianHieroglyphs]: "egyp",
		[Script.Samaritan]: "samr",
		[Script.Lisu]: "lisu",
		[Script.Bamum]: "bamu",
		[Script.Javanese]: "java",
		[Script.MeeteiMayek]: "mtei",
		[Script.ImperialAramaic]: "armi",
		[Script.OldSouthArabian]: "sarb",
		[Script.InscriptionalParthian]: "prti",
		[Script.InscriptionalPahlavi]: "phli",
		[Script.OldTurkic]: "orkh",
		[Script.Kaithi]: "kthi",
		[Script.Batak]: "batk",
		[Script.Brahmi]: "brah",
		[Script.Mandaic]: "mand",
		[Script.Chakma]: "cakm",
		[Script.MeroiticCursive]: "merc",
		[Script.MeroiticHieroglyphs]: "mero",
		[Script.Miao]: "plrd",
		[Script.Sharada]: "shrd",
		[Script.SoraSompeng]: "sora",
		[Script.Takri]: "takr",
		[Script.CaucasianAlbanian]: "aghb",
		[Script.BassaVah]: "bass",
		[Script.Duployan]: "dupl",
		[Script.Elbasan]: "elba",
		[Script.Grantha]: "gran",
		[Script.PahawhHmong]: "hmng",
		[Script.Khojki]: "khoj",
		[Script.LinearA]: "lina",
		[Script.Mahajani]: "mahj",
		[Script.Manichaean]: "mani",
		[Script.MendeKikakui]: "mend",
		[Script.Modi]: "modi",
		[Script.Mro]: "mroo",
		[Script.OldNorthArabian]: "narb",
		[Script.Nabataean]: "nbat",
		[Script.Palmyrene]: "palm",
		[Script.PauCinHau]: "pauc",
		[Script.OldPermic]: "perm",
		[Script.PsalterPahlavi]: "phlp",
		[Script.Siddham]: "sidd",
		[Script.Khudawadi]: "sind",
		[Script.Tirhuta]: "tirh",
		[Script.WarangCiti]: "wara",
		[Script.Ahom]: "ahom",
		[Script.AnatolianHieroglyphs]: "hluw",
		[Script.Hatran]: "hatr",
		[Script.Multani]: "mult",
		[Script.OldHungarian]: "hung",
		[Script.SignWriting]: "sgnw",
		[Script.Adlam]: "adlm",
		[Script.Bhaiksuki]: "bhks",
		[Script.Marchen]: "marc",
		[Script.Newa]: "newa",
		[Script.Osage]: "osge",
		[Script.Tangut]: "tang",
		[Script.MasaramGondi]: "gonm",
		[Script.Nushu]: "nshu",
		[Script.Soyombo]: "soyo",
		[Script.ZanabazarSquare]: "zanb",
		[Script.Dogra]: "dogr",
		[Script.GunjalaGondi]: "gong",
		[Script.Makasar]: "maka",
		[Script.Medefaidrin]: "medf",
		[Script.HanifiRohingya]: "rohg",
		[Script.Sogdian]: "sogd",
		[Script.OldSogdian]: "sogo",
		[Script.Elymaic]: "elym",
		[Script.Nandinagari]: "nand",
		[Script.NyiakengPuachueHmong]: "hmnp",
		[Script.Wancho]: "wcho",
		[Script.Yezidi]: "yezi",
		[Script.Chorasmian]: "chrs",
		[Script.DivesAkuru]: "diak",
		[Script.KhitanSmallScript]: "kits",
		[Script.Vithkuqi]: "vith",
		[Script.OldUyghur]: "ougr",
		[Script.Cypro_Minoan]: "cpmn",
		[Script.Tangsa]: "tnsa",
		[Script.Toto]: "toto",
		[Script.Kawi]: "kawi",
		[Script.NagMundari]: "nagm",
	};

	return tagMap[script] ?? "DFLT";
}

/**
 * Check if a script requires complex shaping
 */
export function isComplexScript(script: Script): boolean {
	const complexScripts = new Set([
		Script.Arabic,
		Script.Syriac,
		Script.Hebrew,
		Script.Thaana,
		Script.Nko,
		Script.Devanagari,
		Script.Bengali,
		Script.Gurmukhi,
		Script.Gujarati,
		Script.Oriya,
		Script.Tamil,
		Script.Telugu,
		Script.Kannada,
		Script.Malayalam,
		Script.Sinhala,
		Script.Thai,
		Script.Lao,
		Script.Tibetan,
		Script.Myanmar,
		Script.Khmer,
		Script.Mongolian,
		Script.Hangul,
	]);

	return complexScripts.has(script);
}

/**
 * Get script direction (LTR or RTL)
 */
export function getScriptDirection(script: Script): "ltr" | "rtl" {
	const rtlScripts = new Set([
		Script.Arabic,
		Script.Hebrew,
		Script.Syriac,
		Script.Thaana,
		Script.Nko,
		Script.Samaritan,
		Script.Mandaic,
		Script.ImperialAramaic,
		Script.Phoenician,
		Script.OldSouthArabian,
		Script.OldNorthArabian,
		Script.Avestan,
		Script.InscriptionalParthian,
		Script.InscriptionalPahlavi,
		Script.PsalterPahlavi,
		Script.Hatran,
		Script.Lydian,
		Script.Nabataean,
		Script.Palmyrene,
		Script.Manichaean,
		Script.MendeKikakui,
		Script.HanifiRohingya,
		Script.Yezidi,
		Script.OldSogdian,
		Script.Sogdian,
		Script.Elymaic,
		Script.Chorasmian,
		Script.OldUyghur,
		Script.Adlam,
	]);

	return rtlScripts.has(script) ? "rtl" : "ltr";
}
