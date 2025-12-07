import type { int16, uint16, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * post table - PostScript font information
 * Contains additional PostScript info like glyph names and italic angle
 */
export interface PostTable {
	version: number;
	italicAngle: number;
	underlinePosition: int16;
	underlineThickness: int16;
	isFixedPitch: uint32;
	minMemType42: uint32;
	maxMemType42: uint32;
	minMemType1: uint32;
	maxMemType1: uint32;
	// Version 2.0 only
	numberOfGlyphs?: uint16;
	glyphNameIndex?: uint16[];
	names?: string[];
}

/** Standard PostScript glyph names (first 258) */
const standardNames: string[] = [
	".notdef",
	".null",
	"nonmarkingreturn",
	"space",
	"exclam",
	"quotedbl",
	"numbersign",
	"dollar",
	"percent",
	"ampersand",
	"quotesingle",
	"parenleft",
	"parenright",
	"asterisk",
	"plus",
	"comma",
	"hyphen",
	"period",
	"slash",
	"zero",
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
	"eight",
	"nine",
	"colon",
	"semicolon",
	"less",
	"equal",
	"greater",
	"question",
	"at",
	"A",
	"B",
	"C",
	"D",
	"E",
	"F",
	"G",
	"H",
	"I",
	"J",
	"K",
	"L",
	"M",
	"N",
	"O",
	"P",
	"Q",
	"R",
	"S",
	"T",
	"U",
	"V",
	"W",
	"X",
	"Y",
	"Z",
	"bracketleft",
	"backslash",
	"bracketright",
	"asciicircum",
	"underscore",
	"grave",
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g",
	"h",
	"i",
	"j",
	"k",
	"l",
	"m",
	"n",
	"o",
	"p",
	"q",
	"r",
	"s",
	"t",
	"u",
	"v",
	"w",
	"x",
	"y",
	"z",
	"braceleft",
	"bar",
	"braceright",
	"asciitilde",
	"Adieresis",
	"Aring",
	"Ccedilla",
	"Eacute",
	"Ntilde",
	"Odieresis",
	"Udieresis",
	"aacute",
	"agrave",
	"acircumflex",
	"adieresis",
	"atilde",
	"aring",
	"ccedilla",
	"eacute",
	"egrave",
	"ecircumflex",
	"edieresis",
	"iacute",
	"igrave",
	"icircumflex",
	"idieresis",
	"ntilde",
	"oacute",
	"ograve",
	"ocircumflex",
	"odieresis",
	"otilde",
	"uacute",
	"ugrave",
	"ucircumflex",
	"udieresis",
	"dagger",
	"degree",
	"cent",
	"sterling",
	"section",
	"bullet",
	"paragraph",
	"germandbls",
	"registered",
	"copyright",
	"trademark",
	"acute",
	"dieresis",
	"notequal",
	"AE",
	"Oslash",
	"infinity",
	"plusminus",
	"lessequal",
	"greaterequal",
	"yen",
	"mu",
	"partialdiff",
	"summation",
	"product",
	"pi",
	"integral",
	"ordfeminine",
	"ordmasculine",
	"Omega",
	"ae",
	"oslash",
	"questiondown",
	"exclamdown",
	"logicalnot",
	"radical",
	"florin",
	"approxequal",
	"Delta",
	"guillemotleft",
	"guillemotright",
	"ellipsis",
	"nonbreakingspace",
	"Agrave",
	"Atilde",
	"Otilde",
	"OE",
	"oe",
	"endash",
	"emdash",
	"quotedblleft",
	"quotedblright",
	"quoteleft",
	"quoteright",
	"divide",
	"lozenge",
	"ydieresis",
	"Ydieresis",
	"fraction",
	"currency",
	"guilsinglleft",
	"guilsinglright",
	"fi",
	"fl",
	"daggerdbl",
	"periodcentered",
	"quotesinglbase",
	"quotedblbase",
	"perthousand",
	"Acircumflex",
	"Ecircumflex",
	"Aacute",
	"Edieresis",
	"Egrave",
	"Iacute",
	"Icircumflex",
	"Idieresis",
	"Igrave",
	"Oacute",
	"Ocircumflex",
	"apple",
	"Ograve",
	"Uacute",
	"Ucircumflex",
	"Ugrave",
	"dotlessi",
	"circumflex",
	"tilde",
	"macron",
	"breve",
	"dotaccent",
	"ring",
	"cedilla",
	"hungarumlaut",
	"ogonek",
	"caron",
	"Lslash",
	"lslash",
	"Scaron",
	"scaron",
	"Zcaron",
	"zcaron",
	"brokenbar",
	"Eth",
	"eth",
	"Yacute",
	"yacute",
	"Thorn",
	"thorn",
	"minus",
	"multiply",
	"onesuperior",
	"twosuperior",
	"threesuperior",
	"onehalf",
	"onequarter",
	"threequarters",
	"franc",
	"Gbreve",
	"gbreve",
	"Idotaccent",
	"Scedilla",
	"scedilla",
	"Cacute",
	"cacute",
	"Ccaron",
	"ccaron",
	"dcroat",
];

export function parsePost(reader: Reader): PostTable {
	const versionMajor = reader.uint16();
	const versionMinor = reader.uint16();
	const version = versionMajor + versionMinor / 0x10000;

	const italicAngle = reader.fixed();
	const underlinePosition = reader.int16();
	const underlineThickness = reader.int16();
	const isFixedPitch = reader.uint32();
	const minMemType42 = reader.uint32();
	const maxMemType42 = reader.uint32();
	const minMemType1 = reader.uint32();
	const maxMemType1 = reader.uint32();

	const result: PostTable = {
		version,
		italicAngle,
		underlinePosition,
		underlineThickness,
		isFixedPitch,
		minMemType42,
		maxMemType42,
		minMemType1,
		maxMemType1,
	};

	// Version 2.0: includes glyph names
	if (version === 2.0) {
		const numberOfGlyphs = reader.uint16();
		const glyphNameIndex: uint16[] = [];

		for (let i = 0; i < numberOfGlyphs; i++) {
			glyphNameIndex.push(reader.uint16());
		}

		// Collect custom names (indexes >= 258)
		const customNames: string[] = [];
		let maxIndex = 0;
		for (let i = 0; i < glyphNameIndex.length; i++) {
			const idx = glyphNameIndex[i]!;
			if (idx >= 258 && idx > maxIndex) {
				maxIndex = idx;
			}
		}

		// Read custom names
		const numCustomNames = maxIndex >= 258 ? maxIndex - 257 : 0;
		for (let i = 0; i < numCustomNames; i++) {
			const length = reader.uint8();
			const chars: string[] = [];
			for (let j = 0; j < length; j++) {
				chars.push(String.fromCharCode(reader.uint8()));
			}
			customNames.push(chars.join(""));
		}

		result.numberOfGlyphs = numberOfGlyphs;
		result.glyphNameIndex = glyphNameIndex;
		result.names = customNames;
	}

	return result;
}

/** Get glyph name by glyph ID */
export function getGlyphName(post: PostTable, glyphId: number): string | null {
	// Version 1: standard 258 names
	if (post.version === 1.0) {
		const name = standardNames[glyphId];
		return name !== undefined ? name : null;
	}

	// Version 2: indexed names
	if (post.version === 2.0 && post.glyphNameIndex) {
		const index = post.glyphNameIndex[glyphId];
		if (index === undefined) return null;

		// Standard name
		if (index < 258) {
			return standardNames[index] ?? null;
		}

		// Custom name
		const customIndex = index - 258;
		return post.names?.[customIndex] ?? null;
	}

	// Version 3: no names stored
	return null;
}

/** Check if font is monospaced */
export function isMonospaced(post: PostTable): boolean {
	return post.isFixedPitch !== 0;
}
