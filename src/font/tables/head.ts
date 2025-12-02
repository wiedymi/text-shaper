import type { FWord, Fixed, uint16, uint32, int16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

const HEAD_MAGIC_NUMBER = 0x5f0f3cf5;

/** Font header table */
export interface HeadTable {
	majorVersion: uint16;
	minorVersion: uint16;
	fontRevision: Fixed;
	checksumAdjustment: uint32;
	magicNumber: uint32;
	flags: uint16;
	unitsPerEm: uint16;
	created: bigint;
	modified: bigint;
	xMin: FWord;
	yMin: FWord;
	xMax: FWord;
	yMax: FWord;
	macStyle: uint16;
	lowestRecPPEM: uint16;
	fontDirectionHint: int16;
	/** 0 = short offsets (uint16), 1 = long offsets (uint32) in loca table */
	indexToLocFormat: int16;
	glyphDataFormat: int16;
}

/** Head table flags */
export const HeadFlags = {
	BaselineAtY0: 0x0001,
	LeftSidebearingAtX0: 0x0002,
	InstructionsDependOnPointSize: 0x0004,
	ForcePPEMToInteger: 0x0008,
	InstructionsAlterAdvanceWidth: 0x0010,
	Lossless: 0x0800,
	Converted: 0x1000,
	OptimizedForClearType: 0x2000,
	LastResortFont: 0x4000,
} as const;

/** Mac style flags */
export const MacStyle = {
	Bold: 0x0001,
	Italic: 0x0002,
	Underline: 0x0004,
	Outline: 0x0008,
	Shadow: 0x0010,
	Condensed: 0x0020,
	Extended: 0x0040,
} as const;

export function parseHead(reader: Reader): HeadTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	const fontRevision = reader.fixed();
	const checksumAdjustment = reader.uint32();
	const magicNumber = reader.uint32();

	if (magicNumber !== HEAD_MAGIC_NUMBER) {
		throw new Error(
			`Invalid head table magic number: 0x${magicNumber.toString(16)}`,
		);
	}

	const flags = reader.uint16();
	const unitsPerEm = reader.uint16();
	const created = reader.longDateTime();
	const modified = reader.longDateTime();
	const xMin = reader.fword();
	const yMin = reader.fword();
	const xMax = reader.fword();
	const yMax = reader.fword();
	const macStyle = reader.uint16();
	const lowestRecPPEM = reader.uint16();
	const fontDirectionHint = reader.int16();
	const indexToLocFormat = reader.int16();
	const glyphDataFormat = reader.int16();

	return {
		majorVersion,
		minorVersion,
		fontRevision,
		checksumAdjustment,
		magicNumber,
		flags,
		unitsPerEm,
		created,
		modified,
		xMin,
		yMin,
		xMax,
		yMax,
		macStyle,
		lowestRecPPEM,
		fontDirectionHint,
		indexToLocFormat,
		glyphDataFormat,
	};
}
