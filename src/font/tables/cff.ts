import { Reader } from "../binary/reader.ts";

/**
 * CFF (Compact Font Format) table parser
 * Used by OpenType fonts with PostScript outlines
 */

export interface CffTable {
	version: { major: number; minor: number };
	names: string[];
	topDicts: TopDict[];
	strings: string[];
	globalSubrs: Uint8Array[];
	charStrings: Uint8Array[][];
	localSubrs: Uint8Array[][];
	fdArrays: FDDict[][];
	fdSelects: FDSelect[];
}

export interface TopDict {
	version?: string;
	notice?: string;
	copyright?: string;
	fullName?: string;
	familyName?: string;
	weight?: string;
	isFixedPitch?: boolean;
	italicAngle?: number;
	underlinePosition?: number;
	underlineThickness?: number;
	paintType?: number;
	charstringType?: number;
	fontMatrix?: number[];
	uniqueID?: number;
	fontBBox?: number[];
	strokeWidth?: number;
	charset?: number;
	encoding?: number;
	charStrings?: number;
	private?: [number, number]; // [size, offset]
	syntheticBase?: number;
	postScript?: string;
	baseFontName?: string;
	baseFontBlend?: number[];
	// CIDFont-specific
	ros?: { registry: string; ordering: string; supplement: number };
	cidFontVersion?: number;
	cidFontRevision?: number;
	cidFontType?: number;
	cidCount?: number;
	uidBase?: number;
	fdArray?: number;
	fdSelect?: number;
	fontName?: string;
}

export interface PrivateDict {
	blueValues?: number[];
	otherBlues?: number[];
	familyBlues?: number[];
	familyOtherBlues?: number[];
	blueScale?: number;
	blueShift?: number;
	blueFuzz?: number;
	stdHW?: number;
	stdVW?: number;
	stemSnapH?: number[];
	stemSnapV?: number[];
	forceBold?: boolean;
	languageGroup?: number;
	expansionFactor?: number;
	initialRandomSeed?: number;
	subrs?: number;
	defaultWidthX?: number;
	nominalWidthX?: number;
}

export interface FDDict extends PrivateDict {
	fontName?: string;
}

export interface FDSelect {
	format: number;
	select: (glyphId: number) => number;
}

// Standard strings defined in CFF spec
const STANDARD_STRINGS = [
	".notdef",
	"space",
	"exclam",
	"quotedbl",
	"numbersign",
	"dollar",
	"percent",
	"ampersand",
	"quoteright",
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
	"quoteleft",
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
	"exclamdown",
	"cent",
	"sterling",
	"fraction",
	"yen",
	"florin",
	"section",
	"currency",
	"quotesingle",
	"quotedblleft",
	"guillemotleft",
	"guilsinglleft",
	"guilsinglright",
	"fi",
	"fl",
	"endash",
	"dagger",
	"daggerdbl",
	"periodcentered",
	"paragraph",
	"bullet",
	"quotesinglbase",
	"quotedblbase",
	"quotedblright",
	"guillemotright",
	"ellipsis",
	"perthousand",
	"questiondown",
	"grave",
	"acute",
	"circumflex",
	"tilde",
	"macron",
	"breve",
	"dotaccent",
	"dieresis",
	"ring",
	"cedilla",
	"hungarumlaut",
	"ogonek",
	"caron",
	"emdash",
	"AE",
	"ordfeminine",
	"Lslash",
	"Oslash",
	"OE",
	"ordmasculine",
	"ae",
	"dotlessi",
	"lslash",
	"oslash",
	"oe",
	"germandbls",
	"onesuperior",
	"logicalnot",
	"mu",
	"trademark",
	"Eth",
	"onehalf",
	"plusminus",
	"Thorn",
	"onequarter",
	"divide",
	"brokenbar",
	"degree",
	"thorn",
	"threequarters",
	"twosuperior",
	"registered",
	"minus",
	"eth",
	"multiply",
	"threesuperior",
	"copyright",
	"Aacute",
	"Acircumflex",
	"Adieresis",
	"Agrave",
	"Aring",
	"Atilde",
	"Ccedilla",
	"Eacute",
	"Ecircumflex",
	"Edieresis",
	"Egrave",
	"Iacute",
	"Icircumflex",
	"Idieresis",
	"Igrave",
	"Ntilde",
	"Oacute",
	"Ocircumflex",
	"Odieresis",
	"Ograve",
	"Otilde",
	"Scaron",
	"Uacute",
	"Ucircumflex",
	"Udieresis",
	"Ugrave",
	"Yacute",
	"Ydieresis",
	"Zcaron",
	"aacute",
	"acircumflex",
	"adieresis",
	"agrave",
	"aring",
	"atilde",
	"ccedilla",
	"eacute",
	"ecircumflex",
	"edieresis",
	"egrave",
	"iacute",
	"icircumflex",
	"idieresis",
	"igrave",
	"ntilde",
	"oacute",
	"ocircumflex",
	"odieresis",
	"ograve",
	"otilde",
	"scaron",
	"uacute",
	"ucircumflex",
	"udieresis",
	"ugrave",
	"yacute",
	"ydieresis",
	"zcaron",
	"exclamsmall",
	"Hungarumlautsmall",
	"dollaroldstyle",
	"dollarsuperior",
	"ampersandsmall",
	"Acutesmall",
	"parenleftsuperior",
	"parenrightsuperior",
	"twodotenleader",
	"onedotenleader",
	"zerooldstyle",
	"oneoldstyle",
	"twooldstyle",
	"threeoldstyle",
	"fouroldstyle",
	"fiveoldstyle",
	"sixoldstyle",
	"sevenoldstyle",
	"eightoldstyle",
	"nineoldstyle",
	"commasuperior",
	"threequartersemdash",
	"periodsuperior",
	"questionsmall",
	"asuperior",
	"bsuperior",
	"centsuperior",
	"dsuperior",
	"esuperior",
	"isuperior",
	"lsuperior",
	"msuperior",
	"nsuperior",
	"osuperior",
	"rsuperior",
	"ssuperior",
	"tsuperior",
	"ff",
	"ffi",
	"ffl",
	"parenleftinferior",
	"parenrightinferior",
	"Circumflexsmall",
	"hyphensuperior",
	"Gravesmall",
	"Asmall",
	"Bsmall",
	"Csmall",
	"Dsmall",
	"Esmall",
	"Fsmall",
	"Gsmall",
	"Hsmall",
	"Ismall",
	"Jsmall",
	"Ksmall",
	"Lsmall",
	"Msmall",
	"Nsmall",
	"Osmall",
	"Psmall",
	"Qsmall",
	"Rsmall",
	"Ssmall",
	"Tsmall",
	"Usmall",
	"Vsmall",
	"Wsmall",
	"Xsmall",
	"Ysmall",
	"Zsmall",
	"colonmonetary",
	"onefitted",
	"rupiah",
	"Tildesmall",
	"exclamdownsmall",
	"centoldstyle",
	"Lslashsmall",
	"Scaronsmall",
	"Zcaronsmall",
	"Dieresissmall",
	"Brevesmall",
	"Caronsmall",
	"Dotaccentsmall",
	"Macronsmall",
	"figuredash",
	"hypheninferior",
	"Ogoneksmall",
	"Ringsmall",
	"Cedillasmall",
	"questiondownsmall",
	"oneeighth",
	"threeeighths",
	"fiveeighths",
	"seveneighths",
	"onethird",
	"twothirds",
	"zerosuperior",
	"foursuperior",
	"fivesuperior",
	"sixsuperior",
	"sevensuperior",
	"eightsuperior",
	"ninesuperior",
	"zeroinferior",
	"oneinferior",
	"twoinferior",
	"threeinferior",
	"fourinferior",
	"fiveinferior",
	"sixinferior",
	"seveninferior",
	"eightinferior",
	"nineinferior",
	"centinferior",
	"dollarinferior",
	"periodinferior",
	"commainferior",
	"Agravesmall",
	"Aacutesmall",
	"Acircumflexsmall",
	"Atildesmall",
	"Adieresissmall",
	"Aringsmall",
	"AEsmall",
	"Ccedillasmall",
	"Egravesmall",
	"Eacutesmall",
	"Ecircumflexsmall",
	"Edieresissmall",
	"Igravesmall",
	"Iacutesmall",
	"Icircumflexsmall",
	"Idieresissmall",
	"Ethsmall",
	"Ntildesmall",
	"Ogravesmall",
	"Oacutesmall",
	"Ocircumflexsmall",
	"Otildesmall",
	"Odieresissmall",
	"OEsmall",
	"Oslashsmall",
	"Ugravesmall",
	"Uacutesmall",
	"Ucircumflexsmall",
	"Udieresissmall",
	"Yacutesmall",
	"Thornsmall",
	"Ydieresissmall",
	"001.000",
	"001.001",
	"001.002",
	"001.003",
	"Black",
	"Bold",
	"Book",
	"Light",
	"Medium",
	"Regular",
	"Roman",
	"Semibold",
];

// Top DICT operators
enum TopDictOp {
	version = 0,
	Notice = 1,
	FullName = 2,
	FamilyName = 3,
	Weight = 4,
	FontBBox = 5,
	UniqueID = 13,
	XUID = 14,
	charset = 15,
	Encoding = 16,
	CharStrings = 17,
	Private = 18,
	Copyright = 0x0c00,
	isFixedPitch = 0x0c01,
	ItalicAngle = 0x0c02,
	UnderlinePosition = 0x0c03,
	UnderlineThickness = 0x0c04,
	PaintType = 0x0c05,
	CharstringType = 0x0c06,
	FontMatrix = 0x0c07,
	StrokeWidth = 0x0c08,
	SyntheticBase = 0x0c14,
	PostScript = 0x0c15,
	BaseFontName = 0x0c16,
	BaseFontBlend = 0x0c17,
	// CID-specific
	ROS = 0x0c1e,
	CIDFontVersion = 0x0c1f,
	CIDFontRevision = 0x0c20,
	CIDFontType = 0x0c21,
	CIDCount = 0x0c22,
	UIDBase = 0x0c23,
	FDArray = 0x0c24,
	FDSelect = 0x0c25,
	FontName = 0x0c26,
}

// Private DICT operators
enum PrivateDictOp {
	BlueValues = 6,
	OtherBlues = 7,
	FamilyBlues = 8,
	FamilyOtherBlues = 9,
	StdHW = 10,
	StdVW = 11,
	Subrs = 19,
	defaultWidthX = 20,
	nominalWidthX = 21,
	BlueScale = 0x0c09,
	BlueShift = 0x0c0a,
	BlueFuzz = 0x0c0b,
	StemSnapH = 0x0c0c,
	StemSnapV = 0x0c0d,
	ForceBold = 0x0c0e,
	LanguageGroup = 0x0c11,
	ExpansionFactor = 0x0c12,
	initialRandomSeed = 0x0c13,
}

/**
 * Parse CFF table
 */
export function parseCff(reader: Reader): CffTable {
	const startOffset = reader.offset;

	// Header
	const major = reader.uint8();
	const minor = reader.uint8();
	const hdrSize = reader.uint8();
	const _offSize = reader.uint8();

	reader.seek(startOffset + hdrSize);

	// Name INDEX
	const names = parseIndex(reader).map((data) =>
		new TextDecoder().decode(data),
	);

	// Top DICT INDEX
	const topDictData = parseIndex(reader);
	const topDicts: TopDict[] = [];

	// String INDEX
	const stringData = parseIndex(reader);
	const strings = stringData.map((data) => new TextDecoder().decode(data));

	// Global Subr INDEX
	const globalSubrs = parseIndex(reader);

	// Parse Top DICTs
	for (const data of topDictData) {
		topDicts.push(
			parseTopDict(
				new Reader(
					data.buffer as ArrayBuffer,
					data.byteOffset,
					data.byteLength,
				),
				strings,
			),
		);
	}

	// Parse CharStrings and local subrs for each font
	const charStrings: Uint8Array[][] = [];
	const localSubrs: Uint8Array[][] = [];
	const fdArrays: FDDict[][] = [];
	const fdSelects: FDSelect[] = [];

	for (const topDict of topDicts) {
		// CharStrings
		if (topDict.charStrings !== undefined) {
			reader.seek(startOffset + topDict.charStrings);
			charStrings.push(parseIndex(reader));
		} else {
			charStrings.push([]);
		}

		// Private DICT and local subrs
		if (topDict.private) {
			const [privateSize, privateOffset] = topDict.private;
			const privateDict = parsePrivateDict(
				reader.slice(privateOffset, privateSize),
				strings,
			);

			if (privateDict.subrs !== undefined) {
				reader.seek(startOffset + privateOffset + privateDict.subrs);
				localSubrs.push(parseIndex(reader));
			} else {
				localSubrs.push([]);
			}
		} else {
			localSubrs.push([]);
		}

		// FDArray (for CID fonts)
		if (topDict.fdArray !== undefined) {
			reader.seek(startOffset + topDict.fdArray);
			const fdData = parseIndex(reader);
			const fds: FDDict[] = [];
			for (const data of fdData) {
				const fdDict = parseTopDict(
					new Reader(
						data.buffer as ArrayBuffer,
						data.byteOffset,
						data.byteLength,
					),
					strings,
				) as FDDict;
				fds.push(fdDict);
			}
			fdArrays.push(fds);
		} else {
			fdArrays.push([]);
		}

		// FDSelect (for CID fonts)
		if (topDict.fdSelect !== undefined) {
			reader.seek(startOffset + topDict.fdSelect);
			const lastCharStrings = charStrings[charStrings.length - 1];
			fdSelects.push(parseFDSelect(reader, lastCharStrings?.length ?? 0));
		} else {
			fdSelects.push({ format: 0, select: () => 0 });
		}
	}

	return {
		version: { major, minor },
		names,
		topDicts,
		strings,
		globalSubrs,
		charStrings,
		localSubrs,
		fdArrays,
		fdSelects,
	};
}

/**
 * Parse an INDEX structure
 */
function parseIndex(reader: Reader): Uint8Array[] {
	const count = reader.uint16();
	if (count === 0) return [];

	const offSize = reader.uint8();
	const offsets: number[] = [];

	for (let i = 0; i <= count; i++) {
		offsets.push(readOffset(reader, offSize));
	}

	const result: Uint8Array[] = [];
	for (let i = 0; i < count; i++) {
		const start = offsets[i];
		const end = offsets[i + 1];
		if (start === undefined || end === undefined) continue;
		const length = end - start;
		result.push(reader.bytes(length));
	}

	return result;
}

/**
 * Read offset of given size
 */
function readOffset(reader: Reader, offSize: number): number {
	switch (offSize) {
		case 1:
			return reader.uint8();
		case 2:
			return reader.uint16();
		case 3:
			return reader.uint24();
		case 4:
			return reader.uint32();
		default:
			throw new Error(`Invalid offset size: ${offSize}`);
	}
}

/**
 * Parse a DICT structure
 */
function parseDict(reader: Reader): Map<number, number[]> {
	const result = new Map<number, number[]>();
	const operands: number[] = [];

	while (reader.remaining > 0) {
		const b0 = reader.uint8();

		if (b0 <= 21) {
			// Operator
			let op = b0;
			if (b0 === 12) {
				op = 0x0c00 | reader.uint8();
			}
			result.set(op, [...operands]);
			operands.length = 0;
		} else if (b0 === 28) {
			// 16-bit signed integer
			operands.push(reader.int16());
		} else if (b0 === 29) {
			// 32-bit signed integer
			operands.push(reader.int32());
		} else if (b0 === 30) {
			// Real number
			operands.push(parseReal(reader));
		} else if (b0 >= 32 && b0 <= 246) {
			operands.push(b0 - 139);
		} else if (b0 >= 247 && b0 <= 250) {
			const b1 = reader.uint8();
			operands.push((b0 - 247) * 256 + b1 + 108);
		} else if (b0 >= 251 && b0 <= 254) {
			const b1 = reader.uint8();
			operands.push(-(b0 - 251) * 256 - b1 - 108);
		}
	}

	return result;
}

/**
 * Parse real number from DICT
 */
function parseReal(reader: Reader): number {
	let str = "";
	const nibbleChars = "0123456789.EE -";
	let done = false;

	while (!done) {
		const byte = reader.uint8();
		for (let i = 0; i < 2; i++) {
			const nibble = i === 0 ? byte >> 4 : byte & 0x0f;
			if (nibble === 0x0f) {
				done = true;
				break;
			}
			if (nibble === 0x0c) {
				str += "E-";
			} else {
				str += nibbleChars[nibble];
			}
		}
	}

	return parseFloat(str);
}

/**
 * Parse Top DICT
 */
function parseTopDict(reader: Reader, strings: string[]): TopDict {
	const dict = parseDict(reader);
	const result: TopDict = {};

	const getString = (sid: number): string => {
		if (sid < STANDARD_STRINGS.length) {
			const str = STANDARD_STRINGS[sid];
			return str ?? "";
		}
		return strings[sid - STANDARD_STRINGS.length] ?? "";
	};

	for (const [op, operands] of dict) {
		const op0 = operands[0];
		const op1 = operands[1];
		const op2 = operands[2];

		switch (op) {
			case TopDictOp.version:
				if (op0 !== undefined) result.version = getString(op0);
				break;
			case TopDictOp.Notice:
				if (op0 !== undefined) result.notice = getString(op0);
				break;
			case TopDictOp.Copyright:
				if (op0 !== undefined) result.copyright = getString(op0);
				break;
			case TopDictOp.FullName:
				if (op0 !== undefined) result.fullName = getString(op0);
				break;
			case TopDictOp.FamilyName:
				if (op0 !== undefined) result.familyName = getString(op0);
				break;
			case TopDictOp.Weight:
				if (op0 !== undefined) result.weight = getString(op0);
				break;
			case TopDictOp.isFixedPitch:
				result.isFixedPitch = op0 !== 0;
				break;
			case TopDictOp.ItalicAngle:
				result.italicAngle = op0;
				break;
			case TopDictOp.UnderlinePosition:
				result.underlinePosition = op0;
				break;
			case TopDictOp.UnderlineThickness:
				result.underlineThickness = op0;
				break;
			case TopDictOp.PaintType:
				result.paintType = op0;
				break;
			case TopDictOp.CharstringType:
				result.charstringType = op0;
				break;
			case TopDictOp.FontMatrix:
				result.fontMatrix = operands;
				break;
			case TopDictOp.UniqueID:
				result.uniqueID = op0;
				break;
			case TopDictOp.FontBBox:
				result.fontBBox = operands;
				break;
			case TopDictOp.StrokeWidth:
				result.strokeWidth = op0;
				break;
			case TopDictOp.charset:
				result.charset = op0;
				break;
			case TopDictOp.Encoding:
				result.encoding = op0;
				break;
			case TopDictOp.CharStrings:
				result.charStrings = op0;
				break;
			case TopDictOp.Private:
				if (op0 !== undefined && op1 !== undefined) {
					result.private = [op0, op1];
				}
				break;
			case TopDictOp.SyntheticBase:
				result.syntheticBase = op0;
				break;
			case TopDictOp.PostScript:
				if (op0 !== undefined) result.postScript = getString(op0);
				break;
			case TopDictOp.BaseFontName:
				if (op0 !== undefined) result.baseFontName = getString(op0);
				break;
			case TopDictOp.BaseFontBlend:
				result.baseFontBlend = operands;
				break;
			case TopDictOp.ROS:
				if (op0 !== undefined && op1 !== undefined && op2 !== undefined) {
					result.ros = {
						registry: getString(op0),
						ordering: getString(op1),
						supplement: op2,
					};
				}
				break;
			case TopDictOp.CIDFontVersion:
				result.cidFontVersion = op0;
				break;
			case TopDictOp.CIDFontRevision:
				result.cidFontRevision = op0;
				break;
			case TopDictOp.CIDFontType:
				result.cidFontType = op0;
				break;
			case TopDictOp.CIDCount:
				result.cidCount = op0;
				break;
			case TopDictOp.UIDBase:
				result.uidBase = op0;
				break;
			case TopDictOp.FDArray:
				result.fdArray = op0;
				break;
			case TopDictOp.FDSelect:
				result.fdSelect = op0;
				break;
			case TopDictOp.FontName:
				if (op0 !== undefined) result.fontName = getString(op0);
				break;
		}
	}

	return result;
}

/**
 * Parse Private DICT
 */
function parsePrivateDict(reader: Reader, _strings: string[]): PrivateDict {
	const dict = parseDict(reader);
	const result: PrivateDict = {};

	for (const [op, operands] of dict) {
		const op0 = operands[0];

		switch (op) {
			case PrivateDictOp.BlueValues:
				result.blueValues = deltaToAbsolute(operands);
				break;
			case PrivateDictOp.OtherBlues:
				result.otherBlues = deltaToAbsolute(operands);
				break;
			case PrivateDictOp.FamilyBlues:
				result.familyBlues = deltaToAbsolute(operands);
				break;
			case PrivateDictOp.FamilyOtherBlues:
				result.familyOtherBlues = deltaToAbsolute(operands);
				break;
			case PrivateDictOp.BlueScale:
				result.blueScale = op0;
				break;
			case PrivateDictOp.BlueShift:
				result.blueShift = op0;
				break;
			case PrivateDictOp.BlueFuzz:
				result.blueFuzz = op0;
				break;
			case PrivateDictOp.StdHW:
				result.stdHW = op0;
				break;
			case PrivateDictOp.StdVW:
				result.stdVW = op0;
				break;
			case PrivateDictOp.StemSnapH:
				result.stemSnapH = deltaToAbsolute(operands);
				break;
			case PrivateDictOp.StemSnapV:
				result.stemSnapV = deltaToAbsolute(operands);
				break;
			case PrivateDictOp.ForceBold:
				result.forceBold = op0 !== 0;
				break;
			case PrivateDictOp.LanguageGroup:
				result.languageGroup = op0;
				break;
			case PrivateDictOp.ExpansionFactor:
				result.expansionFactor = op0;
				break;
			case PrivateDictOp.initialRandomSeed:
				result.initialRandomSeed = op0;
				break;
			case PrivateDictOp.Subrs:
				result.subrs = op0;
				break;
			case PrivateDictOp.defaultWidthX:
				result.defaultWidthX = op0;
				break;
			case PrivateDictOp.nominalWidthX:
				result.nominalWidthX = op0;
				break;
		}
	}

	return result;
}

/**
 * Convert delta-encoded values to absolute
 */
function deltaToAbsolute(deltas: number[]): number[] {
	const result: number[] = [];
	let value = 0;
	for (const delta of deltas) {
		value += delta;
		result.push(value);
	}
	return result;
}

/**
 * Parse FDSelect structure
 */
function parseFDSelect(reader: Reader, numGlyphs: number): FDSelect {
	const format = reader.uint8();

	if (format === 0) {
		const fds = reader.uint8Array(numGlyphs);
		return {
			format,
			select: (glyphId: number) => fds[glyphId] ?? 0,
		};
	} else if (format === 3) {
		const nRanges = reader.uint16();
		const ranges: Array<{ first: number; fd: number }> = [];

		for (let i = 0; i < nRanges; i++) {
			ranges.push({
				first: reader.uint16(),
				fd: reader.uint8(),
			});
		}
		const _sentinel = reader.uint16();

		return {
			format,
			select: (glyphId: number) => {
				// Binary search through ranges
				let lo = 0;
				let hi = ranges.length - 1;
				while (lo < hi) {
					const mid = Math.ceil((lo + hi) / 2);
					const range = ranges[mid];
					if (range && range.first <= glyphId) {
						lo = mid;
					} else {
						hi = mid - 1;
					}
				}
				const foundRange = ranges[lo];
				return foundRange?.fd ?? 0;
			},
		};
	}

	return { format, select: () => 0 };
}

/**
 * Get string by SID
 */
export function getCffString(cff: CffTable, sid: number): string {
	if (sid < STANDARD_STRINGS.length) {
		const str = STANDARD_STRINGS[sid];
		return str ?? "";
	}
	return cff.strings[sid - STANDARD_STRINGS.length] ?? "";
}
