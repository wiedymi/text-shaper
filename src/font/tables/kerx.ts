import type { GlyphId, int16, uint16, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * Extended Kerning table (kerx)
 * Apple Advanced Typography kerning
 */
export interface KerxTable {
	version: uint16;
	nTables: uint32;
	subtables: KerxSubtable[];
}

/**
 * kerx subtable types
 */
export enum KerxSubtableType {
	OrderedList = 0,
	StateTable = 1,
	SimpleArray = 2,
	ControlPoint = 4,
	Format6 = 6,
}

/**
 * Coverage flags
 */
export interface KerxCoverage {
	vertical: boolean;
	crossStream: boolean;
	variation: boolean;
}

/**
 * Base subtable
 */
export interface KerxSubtableBase {
	length: uint32;
	coverage: KerxCoverage;
	tupleCount: uint16;
}

export type KerxSubtable =
	| KerxOrderedListSubtable
	| KerxStateTableSubtable
	| KerxSimpleArraySubtable
	| KerxControlPointSubtable
	| KerxFormat6Subtable;

/**
 * Format 0: Ordered list of kerning pairs
 */
export interface KerxOrderedListSubtable extends KerxSubtableBase {
	format: KerxSubtableType.OrderedList;
	nPairs: uint32;
	pairs: KerxPair[];
}

export interface KerxPair {
	left: GlyphId;
	right: GlyphId;
	value: int16;
}

/**
 * Format 1: State table
 */
export interface KerxStateTableSubtable extends KerxSubtableBase {
	format: KerxSubtableType.StateTable;
	stateHeader: KerxStateHeader;
	// State machine data
}

export interface KerxStateHeader {
	nClasses: uint32;
	classTableOffset: uint32;
	stateArrayOffset: uint32;
	entryTableOffset: uint32;
	valueTableOffset: uint32;
}

/**
 * Format 2: Simple array
 */
export interface KerxSimpleArraySubtable extends KerxSubtableBase {
	format: KerxSubtableType.SimpleArray;
	rowWidth: uint16;
	leftClassTable: KerxClassTable;
	rightClassTable: KerxClassTable;
	kerningArray: Int16Array;
}

export interface KerxClassTable {
	firstGlyph: GlyphId;
	nGlyphs: uint16;
	classes: Uint8Array;
}

/**
 * Format 4: Control point actions
 */
export interface KerxControlPointSubtable extends KerxSubtableBase {
	format: KerxSubtableType.ControlPoint;
	flags: uint32;
	// Control point data
}

/**
 * Format 6: Extended kerning pairs
 */
export interface KerxFormat6Subtable extends KerxSubtableBase {
	format: KerxSubtableType.Format6;
	flags: uint32;
	rowCount: uint16;
	columnCount: uint16;
	rowIndexTableOffset: uint32;
	columnIndexTableOffset: uint32;
	kerningArrayOffset: uint32;
	kerningVectorOffset: uint32;
}

/**
 * Parse kerx table
 */
export function parseKerx(reader: Reader): KerxTable {
	const version = reader.uint16();
	reader.skip(2); // padding
	const nTables = reader.uint32();

	const subtables: KerxSubtable[] = [];

	for (let i = 0; i < nTables; i++) {
		const subtable = parseKerxSubtable(reader);
		if (subtable) subtables.push(subtable);
	}

	return { version, nTables, subtables };
}

function parseKerxSubtable(reader: Reader): KerxSubtable | null {
	const length = reader.uint32();
	const coverageAndFormat = reader.uint32();
	const tupleCount = reader.uint16();
	reader.skip(2); // padding

	const format = coverageAndFormat & 0xff;
	const coverage: KerxCoverage = {
		vertical: (coverageAndFormat & 0x80000000) !== 0,
		crossStream: (coverageAndFormat & 0x40000000) !== 0,
		variation: (coverageAndFormat & 0x20000000) !== 0,
	};

	const base: KerxSubtableBase = { length, coverage, tupleCount };
	const subtableEnd = reader.offset + length - 12; // Already read 12 bytes

	let subtable: KerxSubtable | null = null;

	switch (format) {
		case KerxSubtableType.OrderedList:
			subtable = parseKerxFormat0(reader, base);
			break;
		case KerxSubtableType.StateTable:
			subtable = parseKerxFormat1(reader, base);
			break;
		case KerxSubtableType.SimpleArray:
			subtable = parseKerxFormat2(reader, base);
			break;
		case KerxSubtableType.Format6:
			subtable = parseKerxFormat6(reader, base);
			break;
	}

	// Skip to end of subtable
	reader.seek(subtableEnd);

	return subtable;
}

function parseKerxFormat0(
	reader: Reader,
	base: KerxSubtableBase,
): KerxOrderedListSubtable {
	const nPairs = reader.uint32();
	reader.skip(12); // searchRange, entrySelector, rangeShift

	const pairs: KerxPair[] = [];
	for (let i = 0; i < nPairs; i++) {
		pairs.push({
			left: reader.uint16(),
			right: reader.uint16(),
			value: reader.int16(),
		});
		reader.skip(2); // padding
	}

	return {
		...base,
		format: KerxSubtableType.OrderedList,
		nPairs,
		pairs,
	};
}

function parseKerxFormat1(
	reader: Reader,
	base: KerxSubtableBase,
): KerxStateTableSubtable {
	const stateHeader: KerxStateHeader = {
		nClasses: reader.uint32(),
		classTableOffset: reader.offset32(),
		stateArrayOffset: reader.offset32(),
		entryTableOffset: reader.offset32(),
		valueTableOffset: reader.offset32(),
	};

	return {
		...base,
		format: KerxSubtableType.StateTable,
		stateHeader,
	};
}

function parseKerxFormat2(
	reader: Reader,
	base: KerxSubtableBase,
): KerxSimpleArraySubtable {
	const rowWidth = reader.uint16();
	reader.skip(2); // padding

	const leftClassTableOffset = reader.offset32();
	const rightClassTableOffset = reader.offset32();
	const kerningArrayOffset = reader.offset32();

	// Parse class tables
	const leftClassTable = parseKerxClassTable(
		reader.sliceFrom(leftClassTableOffset),
	);
	const rightClassTable = parseKerxClassTable(
		reader.sliceFrom(rightClassTableOffset),
	);

	// Parse kerning array
	const arrayReader = reader.sliceFrom(kerningArrayOffset);
	const numRows =
		leftClassTable.nGlyphs > 0
			? Math.max(...Array.from(leftClassTable.classes)) + 1
			: 0;
	const numCols = rowWidth / 2;
	const kerningArray = new Int16Array(numRows * numCols);

	for (const [i, _] of kerningArray.entries()) {
		kerningArray[i] = arrayReader.int16();
	}

	return {
		...base,
		format: KerxSubtableType.SimpleArray,
		rowWidth,
		leftClassTable,
		rightClassTable,
		kerningArray,
	};
}

function parseKerxClassTable(reader: Reader): KerxClassTable {
	const firstGlyph = reader.uint16();
	const nGlyphs = reader.uint16();
	const classes = new Uint8Array(nGlyphs);

	for (let i = 0; i < nGlyphs; i++) {
		classes[i] = reader.uint8();
	}

	return { firstGlyph, nGlyphs, classes };
}

function parseKerxFormat6(
	reader: Reader,
	base: KerxSubtableBase,
): KerxFormat6Subtable {
	const flags = reader.uint32();
	const rowCount = reader.uint16();
	const columnCount = reader.uint16();
	const rowIndexTableOffset = reader.offset32();
	const columnIndexTableOffset = reader.offset32();
	const kerningArrayOffset = reader.offset32();
	const kerningVectorOffset = reader.offset32();

	return {
		...base,
		format: KerxSubtableType.Format6,
		flags,
		rowCount,
		columnCount,
		rowIndexTableOffset,
		columnIndexTableOffset,
		kerningArrayOffset,
		kerningVectorOffset,
	};
}

/**
 * Get kerning value from kerx table
 */
export function getKerxValue(
	kerx: KerxTable,
	left: GlyphId,
	right: GlyphId,
): number {
	for (const subtable of kerx.subtables) {
		if (subtable.coverage.vertical) continue; // Skip vertical kerning

		switch (subtable.format) {
			case KerxSubtableType.OrderedList: {
				// Binary search for the pair
				const pairs = subtable.pairs;
				let lo = 0;
				let hi = pairs.length - 1;

				while (lo <= hi) {
					const mid = (lo + hi) >> 1;
					const pair = pairs[mid];
					if (!pair) break;

					const key = (pair.left << 16) | pair.right;
					const target = (left << 16) | right;

					if (key === target) {
						return pair.value;
					} else if (key < target) {
						lo = mid + 1;
					} else {
						hi = mid - 1;
					}
				}
				break;
			}
			case KerxSubtableType.SimpleArray: {
				const leftTable = subtable.leftClassTable;
				const rightTable = subtable.rightClassTable;

				if (
					left < leftTable.firstGlyph ||
					left >= leftTable.firstGlyph + leftTable.nGlyphs
				) {
					continue;
				}
				if (
					right < rightTable.firstGlyph ||
					right >= rightTable.firstGlyph + rightTable.nGlyphs
				) {
					continue;
				}

				const leftClass = leftTable.classes[left - leftTable.firstGlyph];
				const rightClass = rightTable.classes[right - rightTable.firstGlyph];
				if (leftClass === undefined || rightClass === undefined) continue;

				const numCols = subtable.rowWidth / 2;
				const index = leftClass * numCols + rightClass;

				if (index < subtable.kerningArray.length) {
					const value = subtable.kerningArray[index];
					if (value !== undefined && value !== 0) return value;
				}
				break;
			}
		}
	}

	return 0;
}
