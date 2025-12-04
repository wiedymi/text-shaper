import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import { Reader } from "../../../src/font/binary/reader.ts";
import {
	parseKerx,
	getKerxValue,
	KerxSubtableType,
	type KerxTable,
	type KerxOrderedListSubtable,
	type KerxSimpleArraySubtable,
	type KerxStateTableSubtable,
	type KerxFormat6Subtable,
} from "../../../src/font/tables/kerx.ts";

/**
 * Create synthetic kerx table binary data
 */
function createKerxData(subtables: ArrayBuffer[]): ArrayBuffer {
	const headerSize = 8;
	const totalSize = headerSize + subtables.reduce((sum, s) => sum + s.byteLength, 0);
	const buffer = new ArrayBuffer(totalSize);
	const view = new DataView(buffer);

	view.setUint16(0, 1, false);
	view.setUint16(2, 0, false);
	view.setUint32(4, subtables.length, false);

	let offset = headerSize;
	for (const subtable of subtables) {
		new Uint8Array(buffer, offset, subtable.byteLength).set(new Uint8Array(subtable));
		offset += subtable.byteLength;
	}

	return buffer;
}

function createFormat0Subtable(pairs: { left: number; right: number; value: number }[]): ArrayBuffer {
	const headerSize = 12;
	const format0Header = 16;
	const pairSize = 8;
	const length = headerSize + format0Header + pairs.length * pairSize;

	const buffer = new ArrayBuffer(length);
	const view = new DataView(buffer);

	view.setUint32(0, length, false);
	view.setUint32(4, KerxSubtableType.OrderedList, false);
	view.setUint16(8, 0, false);
	view.setUint16(10, 0, false);

	view.setUint32(12, pairs.length, false);
	view.setUint32(16, 0, false);
	view.setUint32(20, 0, false);
	view.setUint32(24, 0, false);

	let offset = 28;
	for (const pair of pairs) {
		view.setUint16(offset, pair.left, false);
		view.setUint16(offset + 2, pair.right, false);
		view.setInt16(offset + 4, pair.value, false);
		view.setUint16(offset + 6, 0, false);
		offset += 8;
	}

	return buffer;
}

function createFormat1Subtable(): ArrayBuffer {
	const headerSize = 12;
	const stateHeaderSize = 20;
	const length = headerSize + stateHeaderSize;

	const buffer = new ArrayBuffer(length);
	const view = new DataView(buffer);

	view.setUint32(0, length, false);
	view.setUint32(4, KerxSubtableType.StateTable, false);
	view.setUint16(8, 0, false);
	view.setUint16(10, 0, false);

	view.setUint32(12, 4, false);
	view.setUint32(16, 32, false);
	view.setUint32(20, 36, false);
	view.setUint32(24, 40, false);
	view.setUint32(28, 44, false);

	return buffer;
}

function createFormat2Subtable(
	leftFirst: number,
	leftClasses: number[],
	rightFirst: number,
	rightClasses: number[],
	kerningValues: number[][],
): ArrayBuffer {
	const headerSize = 12;
	const format2Header = 16;
	const leftClassSize = 4 + leftClasses.length;
	const rightClassSize = 4 + rightClasses.length;
	const numRows = Math.max(...leftClasses) + 1;
	const numCols = Math.max(...rightClasses) + 1;
	const kerningSize = numRows * numCols * 2;

	const leftClassPadded = Math.ceil(leftClassSize / 4) * 4;
	const rightClassPadded = Math.ceil(rightClassSize / 4) * 4;

	const length = headerSize + format2Header + leftClassPadded + rightClassPadded + kerningSize;

	const buffer = new ArrayBuffer(length);
	const view = new DataView(buffer);

	view.setUint32(0, length, false);
	view.setUint32(4, KerxSubtableType.SimpleArray, false);
	view.setUint16(8, 0, false);
	view.setUint16(10, 0, false);

	const rowWidth = numCols * 2;
	view.setUint16(12, rowWidth, false);
	view.setUint16(14, 0, false);
	view.setUint32(16, headerSize + format2Header, false);
	view.setUint32(20, headerSize + format2Header + leftClassPadded, false);
	view.setUint32(24, headerSize + format2Header + leftClassPadded + rightClassPadded, false);

	let offset = headerSize + format2Header;
	view.setUint16(offset, leftFirst, false);
	view.setUint16(offset + 2, leftClasses.length, false);
	for (let i = 0; i < leftClasses.length; i++) {
		view.setUint8(offset + 4 + i, leftClasses[i]!);
	}

	offset = headerSize + format2Header + leftClassPadded;
	view.setUint16(offset, rightFirst, false);
	view.setUint16(offset + 2, rightClasses.length, false);
	for (let i = 0; i < rightClasses.length; i++) {
		view.setUint8(offset + 4 + i, rightClasses[i]!);
	}

	offset = headerSize + format2Header + leftClassPadded + rightClassPadded;
	for (let row = 0; row < numRows; row++) {
		for (let col = 0; col < numCols; col++) {
			const value = kerningValues[row]?.[col] ?? 0;
			view.setInt16(offset, value, false);
			offset += 2;
		}
	}

	return buffer;
}

function createFormat6Subtable(): ArrayBuffer {
	const headerSize = 12;
	const format6Size = 24;
	const length = headerSize + format6Size;

	const buffer = new ArrayBuffer(length);
	const view = new DataView(buffer);

	view.setUint32(0, length, false);
	view.setUint32(4, KerxSubtableType.Format6, false);
	view.setUint16(8, 0, false);
	view.setUint16(10, 0, false);

	view.setUint32(12, 0, false);
	view.setUint16(16, 10, false);
	view.setUint16(18, 20, false);
	view.setUint32(20, 36, false);
	view.setUint32(24, 56, false);
	view.setUint32(28, 96, false);
	view.setUint32(32, 296, false);

	return buffer;
}

describe("kerx table", () => {
	describe("parseKerx", () => {
		test("parses empty kerx table", () => {
			const data = createKerxData([]);
			const reader = new Reader(new DataView(data));
			const kerx = parseKerx(reader);

			expect(kerx.version).toBe(1);
			expect(kerx.nTables).toBe(0);
			expect(kerx.subtables).toHaveLength(0);
		});

		test("parses kerx with format 0 subtable", () => {
			const pairs = [
				{ left: 10, right: 20, value: -50 },
				{ left: 10, right: 30, value: -30 },
				{ left: 20, right: 30, value: 20 },
			];
			const data = createKerxData([createFormat0Subtable(pairs)]);
			const reader = new Reader(new DataView(data));
			const kerx = parseKerx(reader);

			expect(kerx.version).toBe(1);
			expect(kerx.nTables).toBe(1);
			expect(kerx.subtables).toHaveLength(1);

			const subtable = kerx.subtables[0] as KerxOrderedListSubtable;
			expect(subtable.format).toBe(KerxSubtableType.OrderedList);
			expect(subtable.nPairs).toBe(3);
			expect(subtable.pairs).toHaveLength(3);
			expect(subtable.pairs[0]).toEqual({ left: 10, right: 20, value: -50 });
		});

		test("parses kerx with format 1 subtable", () => {
			const data = createKerxData([createFormat1Subtable()]);
			const reader = new Reader(new DataView(data));
			const kerx = parseKerx(reader);

			expect(kerx.subtables).toHaveLength(1);
			const subtable = kerx.subtables[0] as KerxStateTableSubtable;
			expect(subtable.format).toBe(KerxSubtableType.StateTable);
			expect(subtable.stateHeader.nClasses).toBe(4);
		});

		test("handles unknown format gracefully", () => {
			const buffer = new ArrayBuffer(24);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false); // version
			view.setUint16(2, 0, false); // padding
			view.setUint32(4, 1, false); // nTables
			view.setUint32(8, 16, false); // length
			view.setUint32(12, 99, false); // unknown format
			view.setUint16(16, 0, false); // tupleCount
			view.setUint16(18, 0, false); // padding
			view.setUint32(20, 0, false); // padding

			const reader = new Reader(view);
			const kerx = parseKerx(reader);

			// Unknown formats are skipped (return null from parseKerxSubtable)
			expect(kerx.nTables).toBe(1);
			expect(kerx.subtables).toHaveLength(0);
		});

		test("parses kerx with format 6 subtable", () => {
			const data = createKerxData([createFormat6Subtable()]);
			const reader = new Reader(new DataView(data));
			const kerx = parseKerx(reader);

			expect(kerx.subtables).toHaveLength(1);
			const subtable = kerx.subtables[0] as KerxFormat6Subtable;
			expect(subtable.format).toBe(KerxSubtableType.Format6);
			expect(subtable.rowCount).toBe(10);
		});

		test("parses kerx with multiple subtables", () => {
			const pairs = [{ left: 10, right: 20, value: -50 }];
			const data = createKerxData([
				createFormat0Subtable(pairs),
				createFormat1Subtable(),
				createFormat6Subtable(),
			]);
			const reader = new Reader(new DataView(data));
			const kerx = parseKerx(reader);

			expect(kerx.nTables).toBe(3);
			expect(kerx.subtables).toHaveLength(3);
		});

		test("parses coverage flags", () => {
			const buffer = new ArrayBuffer(44);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);
			view.setUint32(8, 36, false);
			view.setUint32(12, 0xc0000000 | KerxSubtableType.OrderedList, false);
			view.setUint16(16, 1, false);
			view.setUint16(18, 0, false);
			view.setUint32(20, 0, false);
			view.setUint32(24, 0, false);
			view.setUint32(28, 0, false);
			view.setUint32(32, 0, false);

			const reader = new Reader(view);
			const kerx = parseKerx(reader);

			const subtable = kerx.subtables[0]!;
			expect(subtable.coverage.vertical).toBe(true);
			expect(subtable.coverage.crossStream).toBe(true);
		});
	});

	describe("getKerxValue", () => {
		test("returns 0 for empty kerx", () => {
			const kerx: KerxTable = { version: 1, nTables: 0, subtables: [] };
			expect(getKerxValue(kerx, 10, 20)).toBe(0);
		});

		test("finds kerning value in format 0 subtable", () => {
			const pairs = [
				{ left: 10, right: 20, value: -50 },
				{ left: 10, right: 30, value: -30 },
				{ left: 20, right: 30, value: 20 },
			];
			const data = createKerxData([createFormat0Subtable(pairs)]);
			const reader = new Reader(new DataView(data));
			const kerx = parseKerx(reader);

			expect(getKerxValue(kerx, 10, 20)).toBe(-50);
			expect(getKerxValue(kerx, 10, 30)).toBe(-30);
			expect(getKerxValue(kerx, 20, 30)).toBe(20);
		});

		test("returns 0 for missing pair", () => {
			const pairs = [{ left: 10, right: 20, value: -50 }];
			const data = createKerxData([createFormat0Subtable(pairs)]);
			const reader = new Reader(new DataView(data));
			const kerx = parseKerx(reader);

			expect(getKerxValue(kerx, 10, 30)).toBe(0);
		});

		test("handles binary search edge cases in format 0", () => {
			const pairs = [
				{ left: 1, right: 1, value: -10 },
				{ left: 1, right: 2, value: -20 },
				{ left: 2, right: 1, value: -30 },
				{ left: 2, right: 2, value: -40 },
				{ left: 3, right: 1, value: -50 },
			];
			const data = createKerxData([createFormat0Subtable(pairs)]);
			const reader = new Reader(new DataView(data));
			const kerx = parseKerx(reader);

			// First pair
			expect(getKerxValue(kerx, 1, 1)).toBe(-10);
			// Last pair
			expect(getKerxValue(kerx, 3, 1)).toBe(-50);
			// Middle pair
			expect(getKerxValue(kerx, 2, 1)).toBe(-30);
		});

		test("returns 0 for out-of-range glyphs in format 0", () => {
			const pairs = [
				{ left: 10, right: 20, value: -50 },
				{ left: 10, right: 30, value: -30 },
			];
			const data = createKerxData([createFormat0Subtable(pairs)]);
			const reader = new Reader(new DataView(data));
			const kerx = parseKerx(reader);

			// Test glyphs not in the pair list
			expect(getKerxValue(kerx, 5, 20)).toBe(0);
			expect(getKerxValue(kerx, 15, 20)).toBe(0);
			expect(getKerxValue(kerx, 10, 40)).toBe(0);
		});

		test("skips vertical kerning", () => {
			const buffer = new ArrayBuffer(52);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);
			view.setUint32(8, 44, false);
			view.setUint32(12, 0x80000000 | KerxSubtableType.OrderedList, false);
			view.setUint16(16, 0, false);
			view.setUint16(18, 0, false);
			view.setUint32(20, 1, false);
			view.setUint32(24, 0, false);
			view.setUint32(28, 0, false);
			view.setUint32(32, 0, false);
			view.setUint16(36, 10, false);
			view.setUint16(38, 20, false);
			view.setInt16(40, -100, false);
			view.setUint16(42, 0, false);

			const reader = new Reader(view);
			const kerx = parseKerx(reader);

			expect(getKerxValue(kerx, 10, 20)).toBe(0);
		});
	});

	describe("KerxSubtableType", () => {
		test("has correct values", () => {
			expect(KerxSubtableType.OrderedList).toBe(0);
			expect(KerxSubtableType.StateTable).toBe(1);
			expect(KerxSubtableType.SimpleArray).toBe(2);
			expect(KerxSubtableType.ControlPoint).toBe(4);
			expect(KerxSubtableType.Format6).toBe(6);
		});
	});

	describe("real font tests", () => {
		let font: Font | null = null;

		beforeAll(async () => {
			try {
				const fontPaths = [
					"/System/Library/Fonts/Supplemental/Skia.ttf",
					"/System/Library/Fonts/Geneva.ttf",
					"/System/Library/Fonts/Monaco.ttf",
				];

				for (const path of fontPaths) {
					try {
						const f = await Font.fromFile(path);
						if (f.kerx) {
							font = f;
							break;
						}
					} catch {}
				}
			} catch {}
		});

		test("parses kerx from real font if available", () => {
			if (!font?.kerx) {
				console.log("No kerx font found");
				return;
			}

			const kerx = font.kerx;
			expect(kerx.version).toBeGreaterThanOrEqual(0);
			expect(kerx.nTables).toBeGreaterThanOrEqual(0);
		});
	});
});
