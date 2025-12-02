import type { GlyphId, int16, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * Legacy kern table for kerning pairs
 * Used when GPOS kerning is not available
 */
export interface KernTable {
	version: number;
	subtables: KernSubtable[];
}

export type KernSubtable = KernFormat0 | KernFormat2;

/**
 * Format 0: Ordered list of kerning pairs
 */
export interface KernFormat0 {
	format: 0;
	coverage: KernCoverage;
	pairs: Map<number, int16>; // key = (left << 16) | right, value = kerning
}

/**
 * Format 2: Class-based kerning (two-dimensional array)
 */
export interface KernFormat2 {
	format: 2;
	coverage: KernCoverage;
	rowWidth: uint16;
	leftClassTable: Map<GlyphId, uint16>;
	rightClassTable: Map<GlyphId, uint16>;
	kerningValues: int16[][];
}

export interface KernCoverage {
	horizontal: boolean;
	minimum: boolean;
	crossStream: boolean;
	override: boolean;
}

/**
 * Parse kern table
 */
export function parseKern(reader: Reader): KernTable {
	const version = reader.uint16();
	const subtables: KernSubtable[] = [];

	if (version === 0) {
		// Microsoft format
		const nTables = reader.uint16();
		for (let i = 0; i < nTables; i++) {
			const subtable = parseKernSubtable(reader);
			if (subtable) subtables.push(subtable);
		}
	} else if (version === 1) {
		// Apple format (version is actually 0x00010000)
		reader.skip(2); // Skip rest of version
		const nTables = reader.uint32();
		for (let i = 0; i < nTables; i++) {
			const subtable = parseAppleKernSubtable(reader);
			if (subtable) subtables.push(subtable);
		}
	}

	return { version, subtables };
}

function parseKernSubtable(reader: Reader): KernSubtable | null {
	const version = reader.uint16();
	const length = reader.uint16();
	const coverageBits = reader.uint16();

	const coverage: KernCoverage = {
		horizontal: (coverageBits & 0x0001) !== 0,
		minimum: (coverageBits & 0x0002) !== 0,
		crossStream: (coverageBits & 0x0004) !== 0,
		override: (coverageBits & 0x0008) !== 0,
	};

	const format = (coverageBits >> 8) & 0xff;

	if (format === 0) {
		return parseKernFormat0(reader, coverage);
	} else if (format === 2) {
		return parseKernFormat2(reader, coverage, length - 6);
	}

	// Skip unknown format
	reader.skip(length - 6);
	return null;
}

function parseAppleKernSubtable(reader: Reader): KernSubtable | null {
	const length = reader.uint32();
	const coverageBits = reader.uint16();
	const tupleIndex = reader.uint16();

	const coverage: KernCoverage = {
		horizontal: (coverageBits & 0x8000) === 0, // bit 15: 0=horizontal
		minimum: false,
		crossStream: (coverageBits & 0x4000) !== 0,
		override: (coverageBits & 0x2000) !== 0,
	};

	const format = coverageBits & 0x00ff;

	if (format === 0) {
		return parseKernFormat0(reader, coverage);
	} else if (format === 2) {
		return parseKernFormat2(reader, coverage, length - 8);
	}

	// Skip unknown format
	reader.skip(length - 8);
	return null;
}

function parseKernFormat0(reader: Reader, coverage: KernCoverage): KernFormat0 {
	const nPairs = reader.uint16();
	reader.skip(6); // searchRange, entrySelector, rangeShift

	const pairs = new Map<number, int16>();

	for (let i = 0; i < nPairs; i++) {
		const left = reader.uint16();
		const right = reader.uint16();
		const value = reader.int16();
		const key = (left << 16) | right;
		pairs.set(key, value);
	}

	return { format: 0, coverage, pairs };
}

function parseKernFormat2(reader: Reader, coverage: KernCoverage, dataLength: number): KernFormat2 {
	const startOffset = reader.position;
	const rowWidth = reader.uint16();
	const leftClassOffset = reader.uint16();
	const rightClassOffset = reader.uint16();
	const arrayOffset = reader.uint16();

	// Parse left class table
	const leftClassTable = new Map<GlyphId, uint16>();
	reader.seek(startOffset + leftClassOffset);
	const leftFirstGlyph = reader.uint16();
	const leftNGlyphs = reader.uint16();
	for (let i = 0; i < leftNGlyphs; i++) {
		const classValue = reader.uint16();
		if (classValue !== 0) {
			leftClassTable.set(leftFirstGlyph + i, classValue);
		}
	}

	// Parse right class table
	const rightClassTable = new Map<GlyphId, uint16>();
	reader.seek(startOffset + rightClassOffset);
	const rightFirstGlyph = reader.uint16();
	const rightNGlyphs = reader.uint16();
	for (let i = 0; i < rightNGlyphs; i++) {
		const classValue = reader.uint16();
		if (classValue !== 0) {
			rightClassTable.set(rightFirstGlyph + i, classValue);
		}
	}

	// Parse kerning array
	reader.seek(startOffset + arrayOffset);
	const numRows = rowWidth > 0 ? Math.floor(dataLength / rowWidth) : 0;
	const numCols = rowWidth / 2;
	const kerningValues: int16[][] = [];

	for (let row = 0; row < numRows; row++) {
		const rowValues: int16[] = [];
		for (let col = 0; col < numCols; col++) {
			rowValues.push(reader.int16());
		}
		kerningValues.push(rowValues);
	}

	return { format: 2, coverage, rowWidth, leftClassTable, rightClassTable, kerningValues };
}

/**
 * Get kerning value from kern table
 */
export function getKernValue(kern: KernTable, left: GlyphId, right: GlyphId): number {
	let total = 0;

	for (const subtable of kern.subtables) {
		if (!subtable.coverage.horizontal) continue; // Only horizontal for now

		if (subtable.format === 0) {
			const key = (left << 16) | right;
			const value = subtable.pairs.get(key);
			if (value !== undefined) {
				if (subtable.coverage.override) {
					total = value;
				} else {
					total += value;
				}
			}
		} else if (subtable.format === 2) {
			const leftClass = subtable.leftClassTable.get(left) ?? 0;
			const rightClass = subtable.rightClassTable.get(right) ?? 0;

			if (leftClass > 0 && rightClass > 0) {
				const rowIndex = Math.floor(leftClass / 2);
				const colIndex = Math.floor(rightClass / 2);
				const row = subtable.kerningValues[rowIndex];
				if (row) {
					const value = row[colIndex];
					if (value !== undefined) {
						if (subtable.coverage.override) {
							total = value;
						} else {
							total += value;
						}
					}
				}
			}
		}
	}

	return total;
}
