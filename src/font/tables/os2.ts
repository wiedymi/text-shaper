import type { int16, uint8, uint16, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * OS/2 table - Font metrics and classification
 * Contains Windows-specific metrics and font embedding information
 */
export interface Os2Table {
	version: uint16;
	xAvgCharWidth: int16;
	usWeightClass: uint16;
	usWidthClass: uint16;
	fsType: uint16;
	ySubscriptXSize: int16;
	ySubscriptYSize: int16;
	ySubscriptXOffset: int16;
	ySubscriptYOffset: int16;
	ySuperscriptXSize: int16;
	ySuperscriptYSize: int16;
	ySuperscriptXOffset: int16;
	ySuperscriptYOffset: int16;
	yStrikeoutSize: int16;
	yStrikeoutPosition: int16;
	sFamilyClass: int16;
	panose: uint8[];
	ulUnicodeRange1: uint32;
	ulUnicodeRange2: uint32;
	ulUnicodeRange3: uint32;
	ulUnicodeRange4: uint32;
	achVendID: string;
	fsSelection: uint16;
	usFirstCharIndex: uint16;
	usLastCharIndex: uint16;
	sTypoAscender: int16;
	sTypoDescender: int16;
	sTypoLineGap: int16;
	usWinAscent: uint16;
	usWinDescent: uint16;
	// Version 1+
	ulCodePageRange1?: uint32;
	ulCodePageRange2?: uint32;
	// Version 2+
	sxHeight?: int16;
	sCapHeight?: int16;
	usDefaultChar?: uint16;
	usBreakChar?: uint16;
	usMaxContext?: uint16;
	// Version 5+
	usLowerOpticalPointSize?: uint16;
	usUpperOpticalPointSize?: uint16;
}

/** Weight class constants */
export const WeightClass = {
	Thin: 100,
	ExtraLight: 200,
	Light: 300,
	Normal: 400,
	Medium: 500,
	SemiBold: 600,
	Bold: 700,
	ExtraBold: 800,
	Black: 900,
} as const;

/** Width class constants */
export const WidthClass = {
	UltraCondensed: 1,
	ExtraCondensed: 2,
	Condensed: 3,
	SemiCondensed: 4,
	Normal: 5,
	SemiExpanded: 6,
	Expanded: 7,
	ExtraExpanded: 8,
	UltraExpanded: 9,
} as const;

/** Font selection flags (fsSelection) */
export const FsSelection = {
	Italic: 0x0001,
	Underscore: 0x0002,
	Negative: 0x0004,
	Outlined: 0x0008,
	Strikeout: 0x0010,
	Bold: 0x0020,
	Regular: 0x0040,
	UseTypoMetrics: 0x0080,
	WWS: 0x0100,
	Oblique: 0x0200,
} as const;

/** Font embedding permissions (fsType) */
export const FsType = {
	InstallableEmbedding: 0x0000,
	RestrictedLicense: 0x0002,
	PreviewAndPrint: 0x0004,
	Editable: 0x0008,
	NoSubsetting: 0x0100,
	BitmapOnly: 0x0200,
} as const;

/**
 * Parse OS/2 table - Windows-specific metrics, weight, width, and classification
 * @param reader - Reader positioned at start of OS/2 table
 * @returns Parsed OS/2 table
 */
export function parseOs2(reader: Reader): Os2Table {
	const version = reader.uint16();
	const xAvgCharWidth = reader.int16();
	const usWeightClass = reader.uint16();
	const usWidthClass = reader.uint16();
	const fsType = reader.uint16();
	const ySubscriptXSize = reader.int16();
	const ySubscriptYSize = reader.int16();
	const ySubscriptXOffset = reader.int16();
	const ySubscriptYOffset = reader.int16();
	const ySuperscriptXSize = reader.int16();
	const ySuperscriptYSize = reader.int16();
	const ySuperscriptXOffset = reader.int16();
	const ySuperscriptYOffset = reader.int16();
	const yStrikeoutSize = reader.int16();
	const yStrikeoutPosition = reader.int16();
	const sFamilyClass = reader.int16();

	// PANOSE classification (10 bytes)
	const panose: uint8[] = [];
	for (let i = 0; i < 10; i++) {
		panose.push(reader.uint8());
	}

	const ulUnicodeRange1 = reader.uint32();
	const ulUnicodeRange2 = reader.uint32();
	const ulUnicodeRange3 = reader.uint32();
	const ulUnicodeRange4 = reader.uint32();

	// Vendor ID (4 bytes as ASCII)
	const achVendID = String.fromCharCode(
		reader.uint8(),
		reader.uint8(),
		reader.uint8(),
		reader.uint8(),
	);

	const fsSelection = reader.uint16();
	const usFirstCharIndex = reader.uint16();
	const usLastCharIndex = reader.uint16();
	const sTypoAscender = reader.int16();
	const sTypoDescender = reader.int16();
	const sTypoLineGap = reader.int16();
	const usWinAscent = reader.uint16();
	const usWinDescent = reader.uint16();

	const result: Os2Table = {
		version,
		xAvgCharWidth,
		usWeightClass,
		usWidthClass,
		fsType,
		ySubscriptXSize,
		ySubscriptYSize,
		ySubscriptXOffset,
		ySubscriptYOffset,
		ySuperscriptXSize,
		ySuperscriptYSize,
		ySuperscriptXOffset,
		ySuperscriptYOffset,
		yStrikeoutSize,
		yStrikeoutPosition,
		sFamilyClass,
		panose,
		ulUnicodeRange1,
		ulUnicodeRange2,
		ulUnicodeRange3,
		ulUnicodeRange4,
		achVendID,
		fsSelection,
		usFirstCharIndex,
		usLastCharIndex,
		sTypoAscender,
		sTypoDescender,
		sTypoLineGap,
		usWinAscent,
		usWinDescent,
	};

	// Version 1+ fields
	if (version >= 1) {
		result.ulCodePageRange1 = reader.uint32();
		result.ulCodePageRange2 = reader.uint32();
	}

	// Version 2+ fields
	if (version >= 2) {
		result.sxHeight = reader.int16();
		result.sCapHeight = reader.int16();
		result.usDefaultChar = reader.uint16();
		result.usBreakChar = reader.uint16();
		result.usMaxContext = reader.uint16();
	}

	// Version 5+ fields
	if (version >= 5) {
		result.usLowerOpticalPointSize = reader.uint16();
		result.usUpperOpticalPointSize = reader.uint16();
	}

	return result;
}

/** Check if font is italic */
export function isItalic(os2: Os2Table): boolean {
	return (os2.fsSelection & FsSelection.Italic) !== 0;
}

/** Check if font is bold */
export function isBold(os2: Os2Table): boolean {
	return (os2.fsSelection & FsSelection.Bold) !== 0;
}

/** Check if USE_TYPO_METRICS flag is set */
export function useTypoMetrics(os2: Os2Table): boolean {
	return (os2.fsSelection & FsSelection.UseTypoMetrics) !== 0;
}

/** Get embedding permission level */
export function getEmbeddingPermission(
	os2: Os2Table,
): "installable" | "restricted" | "preview" | "editable" {
	const fsType = os2.fsType;
	if ((fsType & FsType.RestrictedLicense) !== 0) return "restricted";
	if ((fsType & FsType.PreviewAndPrint) !== 0) return "preview";
	if ((fsType & FsType.Editable) !== 0) return "editable";
	return "installable";
}
