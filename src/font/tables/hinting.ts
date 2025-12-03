import type { Reader } from "../binary/reader.ts";

/**
 * fpgm table - Font program
 * Contains TrueType instructions to be executed once when the font is loaded
 */
export interface FpgmTable {
	/** Raw bytecode instructions */
	instructions: Uint8Array;
}

/**
 * prep table - CVT program (Control Value Program)
 * Contains TrueType instructions executed whenever the font size or transformation changes
 */
export interface PrepTable {
	/** Raw bytecode instructions */
	instructions: Uint8Array;
}

/**
 * cvt table - Control Value Table
 * Contains values referenced by TrueType instructions for consistent spacing/positioning
 * Values are in FUnits (font design units)
 */
export interface CvtTable {
	/** Control values (FWORD, i.e., int16 in font units) */
	values: Int16Array;
}

/**
 * Parse fpgm table
 */
export function parseFpgm(reader: Reader): FpgmTable {
	const instructions = reader.bytes(reader.remaining);
	return { instructions };
}

/**
 * Parse prep table
 */
export function parsePrep(reader: Reader): PrepTable {
	const instructions = reader.bytes(reader.remaining);
	return { instructions };
}

/**
 * Parse cvt table
 */
export function parseCvt(reader: Reader): CvtTable {
	const count = Math.floor(reader.remaining / 2);
	const values = new Int16Array(count);
	for (let i = 0; i < count; i++) {
		values[i] = reader.int16();
	}
	return { values };
}
