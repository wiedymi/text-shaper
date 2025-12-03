import { describe, expect, test } from "bun:test";
import {
	parseKerx,
	getKerxValue,
	KerxSubtableType,
	type KerxTable,
	type KerxOrderedListSubtable,
	type KerxStateTableSubtable,
	type KerxSimpleArraySubtable,
	type KerxFormat6Subtable,
	type KerxCoverage,
} from "../../../src/font/tables/kerx.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

describe("kerx table", () => {
	describe("parseKerx", () => {
		test("parses kerx table header", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);
			let offset = 0;

			// Version
			view.setUint16(offset, 2, false);
			offset += 2;
			// Padding
			view.setUint16(offset, 0, false);
			offset += 2;
			// nTables
			view.setUint32(offset, 0, false);
			offset += 4;

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.version).toBe(2);
			expect(kerx.nTables).toBe(0);
			expect(Array.isArray(kerx.subtables)).toBe(true);
			expect(kerx.subtables.length).toBe(0);
		});

		test("parses version and nTables correctly", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 3, false); // version = 3
			view.setUint16(2, 0, false); // padding
			view.setUint32(4, 1, false); // nTables = 1

			// Add a minimal format 0 subtable
			let offset = 8;
			view.setUint32(offset, 32, false); // length
			offset += 4;
			view.setUint32(offset, 0x00000000, false); // coverage + format 0
			offset += 4;
			view.setUint16(offset, 0, false); // tupleCount
			offset += 2;
			view.setUint16(offset, 0, false); // padding
			offset += 2;
			view.setUint32(offset, 0, false); // nPairs
			offset += 4;

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.version).toBe(3);
			expect(kerx.nTables).toBe(1);
			expect(kerx.subtables.length).toBe(1);
		});

		test("skips padding after version", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false); // version
			view.setUint16(2, 0xffff, false); // padding (should be ignored)
			view.setUint32(4, 0, false); // nTables

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.version).toBe(2);
			expect(kerx.nTables).toBe(0);
		});
	});

	describe("KerxCoverage", () => {
		test("parses vertical flag", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 32, false); // length
			offset += 4;
			view.setUint32(offset, 0x80000000, false); // vertical flag set
			offset += 4;
			view.setUint16(offset, 0, false); // tupleCount
			offset += 2;
			view.setUint16(offset, 0, false); // padding
			offset += 2;
			view.setUint32(offset, 0, false); // nPairs

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.subtables.length).toBe(1);
			expect(kerx.subtables[0]?.coverage.vertical).toBe(true);
			expect(kerx.subtables[0]?.coverage.crossStream).toBe(false);
			expect(kerx.subtables[0]?.coverage.variation).toBe(false);
		});

		test("parses crossStream flag", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 32, false);
			offset += 4;
			view.setUint32(offset, 0x40000000, false); // crossStream flag set
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 0, false);

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.subtables[0]?.coverage.vertical).toBe(false);
			expect(kerx.subtables[0]?.coverage.crossStream).toBe(true);
			expect(kerx.subtables[0]?.coverage.variation).toBe(false);
		});

		test("parses variation flag", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 32, false);
			offset += 4;
			view.setUint32(offset, 0x20000000, false); // variation flag set
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 0, false);

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.subtables[0]?.coverage.vertical).toBe(false);
			expect(kerx.subtables[0]?.coverage.crossStream).toBe(false);
			expect(kerx.subtables[0]?.coverage.variation).toBe(true);
		});

		test("parses multiple coverage flags", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 32, false);
			offset += 4;
			view.setUint32(offset, 0xe0000000, false); // all flags set
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 0, false);

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.subtables[0]?.coverage.vertical).toBe(true);
			expect(kerx.subtables[0]?.coverage.crossStream).toBe(true);
			expect(kerx.subtables[0]?.coverage.variation).toBe(true);
		});
	});

	describe("format 0 - ordered list", () => {
		test("parses format 0 subtable with no pairs", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 32, false); // length
			offset += 4;
			view.setUint32(offset, 0x00000000, false); // coverage + format 0
			offset += 4;
			view.setUint16(offset, 0, false); // tupleCount
			offset += 2;
			view.setUint16(offset, 0, false); // padding
			offset += 2;
			view.setUint32(offset, 0, false); // nPairs = 0
			offset += 4;

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.subtables.length).toBe(1);
			const subtable = kerx.subtables[0] as KerxOrderedListSubtable;
			expect(subtable.format).toBe(KerxSubtableType.OrderedList);
			expect(subtable.nPairs).toBe(0);
			expect(subtable.pairs.length).toBe(0);
		});

		test("parses format 0 subtable with pairs", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			// length: 12 (header) + 4 (nPairs) + 12 (search fields - parser skips 12) + 8*2 (pairs) = 44
			view.setUint32(offset, 44, false);
			offset += 4;
			view.setUint32(offset, 0x00000000, false); // coverage + format 0
			offset += 4;
			view.setUint16(offset, 0, false); // tupleCount
			offset += 2;
			view.setUint16(offset, 0, false); // padding
			offset += 2;
			view.setUint32(offset, 2, false); // nPairs = 2
			offset += 4;
			// Parser skips 12 bytes here, so write 12 bytes of search data
			offset += 12;

			// Pair 1: left=10, right=20, value=-50
			view.setUint16(offset, 10, false);
			offset += 2;
			view.setUint16(offset, 20, false);
			offset += 2;
			view.setInt16(offset, -50, false);
			offset += 2;
			view.setUint16(offset, 0, false); // padding
			offset += 2;

			// Pair 2: left=30, right=40, value=100
			view.setUint16(offset, 30, false);
			offset += 2;
			view.setUint16(offset, 40, false);
			offset += 2;
			view.setInt16(offset, 100, false);
			offset += 2;
			view.setUint16(offset, 0, false); // padding

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			const subtable = kerx.subtables[0] as KerxOrderedListSubtable;
			expect(subtable.format).toBe(KerxSubtableType.OrderedList);
			expect(subtable.nPairs).toBe(2);
			expect(subtable.pairs.length).toBe(2);
			expect(subtable.pairs[0]?.left).toBe(10);
			expect(subtable.pairs[0]?.right).toBe(20);
			expect(subtable.pairs[0]?.value).toBe(-50);
			expect(subtable.pairs[1]?.left).toBe(30);
			expect(subtable.pairs[1]?.right).toBe(40);
			expect(subtable.pairs[1]?.value).toBe(100);
		});

		test("handles tupleCount correctly", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 32, false);
			offset += 4;
			view.setUint32(offset, 0x00000000, false);
			offset += 4;
			view.setUint16(offset, 5, false); // tupleCount = 5
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 0, false);

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.subtables[0]?.tupleCount).toBe(5);
		});

		test("parses pairs with negative values", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 56, false);
			offset += 4;
			view.setUint32(offset, 0x00000000, false);
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 1, false);
			offset += 4;
			offset += 12; // skip search fields

			view.setUint16(offset, 100, false);
			offset += 2;
			view.setUint16(offset, 200, false);
			offset += 2;
			view.setInt16(offset, -1000, false); // large negative value
			offset += 2;
			view.setUint16(offset, 0, false);

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			const subtable = kerx.subtables[0] as KerxOrderedListSubtable;
			expect(subtable.pairs[0]?.value).toBe(-1000);
		});

		test("parses pairs with positive values", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 56, false);
			offset += 4;
			view.setUint32(offset, 0x00000000, false);
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 1, false);
			offset += 4;
			offset += 12; // skip search fields

			view.setUint16(offset, 15, false);
			offset += 2;
			view.setUint16(offset, 25, false);
			offset += 2;
			view.setInt16(offset, 500, false);
			offset += 2;
			view.setUint16(offset, 0, false);

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			const subtable = kerx.subtables[0] as KerxOrderedListSubtable;
			expect(subtable.pairs[0]?.value).toBe(500);
		});
	});

	describe("format 1 - state table", () => {
		test("parses format 1 subtable", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 64, false); // length
			offset += 4;
			view.setUint32(offset, 0x00000001, false); // format 1
			offset += 4;
			view.setUint16(offset, 0, false); // tupleCount
			offset += 2;
			view.setUint16(offset, 0, false); // padding
			offset += 2;

			// State header
			view.setUint32(offset, 10, false); // nClasses
			offset += 4;
			view.setUint32(offset, 100, false); // classTableOffset
			offset += 4;
			view.setUint32(offset, 200, false); // stateArrayOffset
			offset += 4;
			view.setUint32(offset, 300, false); // entryTableOffset
			offset += 4;
			view.setUint32(offset, 400, false); // valueTableOffset

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.subtables.length).toBe(1);
			const subtable = kerx.subtables[0] as KerxStateTableSubtable;
			expect(subtable.format).toBe(KerxSubtableType.StateTable);
			expect(subtable.stateHeader.nClasses).toBe(10);
			expect(subtable.stateHeader.classTableOffset).toBe(100);
			expect(subtable.stateHeader.stateArrayOffset).toBe(200);
			expect(subtable.stateHeader.entryTableOffset).toBe(300);
			expect(subtable.stateHeader.valueTableOffset).toBe(400);
		});

		test("handles state table with zero classes", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 64, false);
			offset += 4;
			view.setUint32(offset, 0x00000001, false);
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;

			view.setUint32(offset, 0, false); // nClasses = 0
			offset += 4;
			view.setUint32(offset, 0, false);
			offset += 4;
			view.setUint32(offset, 0, false);
			offset += 4;
			view.setUint32(offset, 0, false);
			offset += 4;
			view.setUint32(offset, 0, false);

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			const subtable = kerx.subtables[0] as KerxStateTableSubtable;
			expect(subtable.stateHeader.nClasses).toBe(0);
		});
	});

	describe("format 2 - simple array", () => {
		test("parses format 2 subtable structure", () => {
			const buffer = new ArrayBuffer(500);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			// Minimal format 2 with empty arrays
			view.setUint32(offset, 36, false); // length
			offset += 4;
			view.setUint32(offset, 0x00000002, false); // format 2
			offset += 4;
			view.setUint16(offset, 0, false); // tupleCount
			offset += 2;
			view.setUint16(offset, 0, false); // padding
			offset += 2;

			view.setUint16(offset, 4, false); // rowWidth
			offset += 2;
			view.setUint16(offset, 0, false); // padding
			offset += 2;

			// Just write offsets pointing to empty data
			view.setUint32(offset, 32, false); // leftClassTableOffset
			offset += 4;
			view.setUint32(offset, 36, false); // rightClassTableOffset
			offset += 4;
			view.setUint32(offset, 40, false); // kerningArrayOffset
			offset += 4;

			// Empty class tables
			view.setUint16(32, 0, false); // firstGlyph
			view.setUint16(34, 0, false); // nGlyphs
			view.setUint16(36, 0, false); // firstGlyph
			view.setUint16(38, 0, false); // nGlyphs

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.subtables.length).toBe(1);
			const subtable = kerx.subtables[0] as KerxSimpleArraySubtable;
			expect(subtable.format).toBe(KerxSubtableType.SimpleArray);
			expect(subtable.rowWidth).toBe(4);
			expect(subtable.leftClassTable.nGlyphs).toBe(0);
			expect(subtable.rightClassTable.nGlyphs).toBe(0);
		});

		test("handles empty class tables", () => {
			const buffer = new ArrayBuffer(300);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			// length: 12 + 16 + 4 + 4 = 36
			view.setUint32(offset, 36, false);
			offset += 4;
			view.setUint32(offset, 0x00000002, false);
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;

			const format2DataStart = offset;

			view.setUint16(offset, 4, false); // rowWidth
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;

			const leftClassTableOffset = format2DataStart + 12; // 20 + 12 = 32
			const rightClassTableOffset = leftClassTableOffset + 4;
			const kerningArrayOffset = rightClassTableOffset + 4;

			view.setUint32(offset, leftClassTableOffset, false);
			offset += 4;
			view.setUint32(offset, rightClassTableOffset, false);
			offset += 4;
			view.setUint32(offset, kerningArrayOffset, false);
			offset += 4;

			// Empty left class table
			view.setUint16(leftClassTableOffset, 0, false);
			view.setUint16(leftClassTableOffset + 2, 0, false); // nGlyphs = 0

			// Empty right class table
			view.setUint16(rightClassTableOffset, 0, false);
			view.setUint16(rightClassTableOffset + 2, 0, false); // nGlyphs = 0

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			const subtable = kerx.subtables[0] as KerxSimpleArraySubtable;
			expect(subtable.leftClassTable.nGlyphs).toBe(0);
			expect(subtable.rightClassTable.nGlyphs).toBe(0);
			expect(subtable.kerningArray.length).toBe(0);
		});
	});

	describe("format 6 - extended", () => {
		test("parses format 6 subtable", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 64, false); // length
			offset += 4;
			view.setUint32(offset, 0x00000006, false); // format 6
			offset += 4;
			view.setUint16(offset, 0, false); // tupleCount
			offset += 2;
			view.setUint16(offset, 0, false); // padding
			offset += 2;

			view.setUint32(offset, 0x12345678, false); // flags
			offset += 4;
			view.setUint16(offset, 10, false); // rowCount
			offset += 2;
			view.setUint16(offset, 20, false); // columnCount
			offset += 2;
			view.setUint32(offset, 100, false); // rowIndexTableOffset
			offset += 4;
			view.setUint32(offset, 200, false); // columnIndexTableOffset
			offset += 4;
			view.setUint32(offset, 300, false); // kerningArrayOffset
			offset += 4;
			view.setUint32(offset, 400, false); // kerningVectorOffset

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.subtables.length).toBe(1);
			const subtable = kerx.subtables[0] as KerxFormat6Subtable;
			expect(subtable.format).toBe(KerxSubtableType.Format6);
			expect(subtable.flags).toBe(0x12345678);
			expect(subtable.rowCount).toBe(10);
			expect(subtable.columnCount).toBe(20);
			expect(subtable.rowIndexTableOffset).toBe(100);
			expect(subtable.columnIndexTableOffset).toBe(200);
			expect(subtable.kerningArrayOffset).toBe(300);
			expect(subtable.kerningVectorOffset).toBe(400);
		});

		test("handles zero row and column counts", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 64, false);
			offset += 4;
			view.setUint32(offset, 0x00000006, false);
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;

			view.setUint32(offset, 0, false);
			offset += 4;
			view.setUint16(offset, 0, false); // rowCount = 0
			offset += 2;
			view.setUint16(offset, 0, false); // columnCount = 0
			offset += 2;
			view.setUint32(offset, 0, false);
			offset += 4;
			view.setUint32(offset, 0, false);
			offset += 4;
			view.setUint32(offset, 0, false);
			offset += 4;
			view.setUint32(offset, 0, false);

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			const subtable = kerx.subtables[0] as KerxFormat6Subtable;
			expect(subtable.rowCount).toBe(0);
			expect(subtable.columnCount).toBe(0);
		});
	});

	describe("multiple subtables", () => {
		test("parses multiple subtables", () => {
			const buffer = new ArrayBuffer(300);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 2, false); // 2 subtables

			// Subtable 1: format 0 (12 byte header + 4 byte nPairs + 12 byte padding = 28)
			let offset = 8;
			view.setUint32(offset, 28, false);
			offset += 4;
			view.setUint32(offset, 0x00000000, false);
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 0, false);
			offset += 4;
			offset += 12; // skip search fields

			// Subtable 2: format 1 (12 byte header + 20 byte state header = 32)
			view.setUint32(offset, 32, false);
			offset += 4;
			view.setUint32(offset, 0x00000001, false);
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 5, false);
			offset += 4;
			view.setUint32(offset, 10, false);
			offset += 4;
			view.setUint32(offset, 20, false);
			offset += 4;
			view.setUint32(offset, 30, false);
			offset += 4;
			view.setUint32(offset, 40, false);

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.subtables.length).toBe(2);
			expect(kerx.subtables[0]?.format).toBe(KerxSubtableType.OrderedList);
			expect(kerx.subtables[1]?.format).toBe(KerxSubtableType.StateTable);
		});

		test("handles mixed format subtables", () => {
			const buffer = new ArrayBuffer(400);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 2, false); // 2 subtables

			// Subtable 1: format 0 (28 bytes total)
			let offset = 8;
			view.setUint32(offset, 28, false);
			offset += 4;
			view.setUint32(offset, 0x00000000, false);
			offset += 4;
			view.setUint16(offset, 1, false); // tupleCount = 1
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 0, false);
			offset += 4;
			offset += 12;

			// Subtable 2: format 6 (44 bytes total)
			view.setUint32(offset, 44, false);
			offset += 4;
			view.setUint32(offset, 0x40000006, false); // crossStream + format 6
			offset += 4;
			view.setUint16(offset, 2, false); // tupleCount = 2
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 0, false); // flags
			offset += 4;
			view.setUint16(offset, 5, false); // rowCount
			offset += 2;
			view.setUint16(offset, 5, false); // columnCount
			offset += 2;
			view.setUint32(offset, 0, false);
			offset += 4;
			view.setUint32(offset, 0, false);
			offset += 4;
			view.setUint32(offset, 0, false);
			offset += 4;
			view.setUint32(offset, 0, false);
			offset += 4;

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.subtables.length).toBe(2);
			expect(kerx.subtables[0]?.format).toBe(KerxSubtableType.OrderedList);
			expect(kerx.subtables[0]?.tupleCount).toBe(1);
			expect(kerx.subtables[1]?.format).toBe(KerxSubtableType.Format6);
			expect(kerx.subtables[1]?.tupleCount).toBe(2);
			expect(kerx.subtables[1]?.coverage.crossStream).toBe(true);
		});
	});

	describe("unknown formats", () => {
		test("skips unknown format subtables", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 2, false); // 2 subtables

			// Subtable 1: format 99 (unknown)
			let offset = 8;
			view.setUint32(offset, 32, false);
			offset += 4;
			view.setUint32(offset, 0x00000063, false); // format 99
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			offset += 16; // skip rest

			// Subtable 2: format 0 (valid)
			view.setUint32(offset, 32, false);
			offset += 4;
			view.setUint32(offset, 0x00000000, false);
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 0, false);

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			// Unknown format should be skipped
			expect(kerx.subtables.length).toBe(1);
			expect(kerx.subtables[0]?.format).toBe(KerxSubtableType.OrderedList);
		});

		test("skips control point format (format 4)", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 32, false);
			offset += 4;
			view.setUint32(offset, 0x00000004, false); // format 4 (not implemented)
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			// Format 4 should be skipped (not implemented in parser)
			expect(kerx.subtables.length).toBe(0);
		});
	});

	describe("getKerxValue", () => {
		test("returns 0 for empty table", () => {
			const kerx: KerxTable = {
				version: 2,
				nTables: 0,
				subtables: [],
			};

			const value = getKerxValue(kerx, 10, 20);
			expect(value).toBe(0);
		});

		test("skips vertical subtables", () => {
			const kerx: KerxTable = {
				version: 2,
				nTables: 1,
				subtables: [
					{
						length: 32,
						coverage: {
							vertical: true,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.OrderedList,
						nPairs: 1,
						pairs: [{ left: 10, right: 20, value: -100 }],
					},
				],
			};

			const value = getKerxValue(kerx, 10, 20);
			expect(value).toBe(0);
		});

		test("finds value in format 0 subtable", () => {
			const kerx: KerxTable = {
				version: 2,
				nTables: 1,
				subtables: [
					{
						length: 32,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.OrderedList,
						nPairs: 3,
						pairs: [
							{ left: 5, right: 10, value: -20 },
							{ left: 10, right: 20, value: -50 },
							{ left: 30, right: 40, value: 100 },
						],
					},
				],
			};

			const value = getKerxValue(kerx, 10, 20);
			expect(value).toBe(-50);
		});

		test("binary search in ordered list", () => {
			const pairs = [];
			for (let i = 0; i < 100; i++) {
				pairs.push({ left: i * 2, right: i * 2 + 1, value: -i - 1 });
			}

			const kerx: KerxTable = {
				version: 2,
				nTables: 1,
				subtables: [
					{
						length: 1000,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.OrderedList,
						nPairs: 100,
						pairs,
					},
				],
			};

			// Test finding first pair
			expect(getKerxValue(kerx, 0, 1)).toBe(-1);

			// Test finding middle pair
			expect(getKerxValue(kerx, 100, 101)).toBe(-51);

			// Test finding last pair
			expect(getKerxValue(kerx, 198, 199)).toBe(-100);

			// Test missing pair
			expect(getKerxValue(kerx, 1, 2)).toBe(0);
		});

		test("returns 0 for missing pair in format 0", () => {
			const kerx: KerxTable = {
				version: 2,
				nTables: 1,
				subtables: [
					{
						length: 32,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.OrderedList,
						nPairs: 2,
						pairs: [
							{ left: 10, right: 20, value: -50 },
							{ left: 30, right: 40, value: 100 },
						],
					},
				],
			};

			const value = getKerxValue(kerx, 15, 25);
			expect(value).toBe(0);
		});

		test("finds value in format 2 subtable", () => {
			const kerx: KerxTable = {
				version: 2,
				nTables: 1,
				subtables: [
					{
						length: 100,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.SimpleArray,
						rowWidth: 4,
						leftClassTable: {
							firstGlyph: 10,
							nGlyphs: 5,
							classes: new Uint8Array([1, 2, 1, 2, 0]),
						},
						rightClassTable: {
							firstGlyph: 20,
							nGlyphs: 5,
							classes: new Uint8Array([1, 1, 1, 2, 0]),
						},
						kerningArray: new Int16Array([
							0, 0, // row 0
							0, -50, // row 1
							0, -100, // row 2
						]),
					},
				],
			};

			// left=10 (offset 0 in table), leftClass=1, right=20 (offset 0 in table), rightClass=1
			// numCols = rowWidth / 2 = 2
			// index = 1 * 2 + 1 = 3
			const value = getKerxValue(kerx, 10, 20);
			expect(value).toBe(-50);
		});

		test("handles out of range glyphs in format 2", () => {
			const kerx: KerxTable = {
				version: 2,
				nTables: 1,
				subtables: [
					{
						length: 100,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.SimpleArray,
						rowWidth: 4,
						leftClassTable: {
							firstGlyph: 10,
							nGlyphs: 2,
							classes: new Uint8Array([1, 2]),
						},
						rightClassTable: {
							firstGlyph: 20,
							nGlyphs: 2,
							classes: new Uint8Array([1, 2]),
						},
						kerningArray: new Int16Array([0, 0, 0, 0]),
					},
				],
			};

			// Glyph before range
			expect(getKerxValue(kerx, 5, 20)).toBe(0);

			// Glyph after range
			expect(getKerxValue(kerx, 10, 25)).toBe(0);
		});

		test("handles undefined classes in format 2", () => {
			const kerx: KerxTable = {
				version: 2,
				nTables: 1,
				subtables: [
					{
						length: 100,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.SimpleArray,
						rowWidth: 4,
						leftClassTable: {
							firstGlyph: 10,
							nGlyphs: 1,
							classes: new Uint8Array([]),
						},
						rightClassTable: {
							firstGlyph: 20,
							nGlyphs: 1,
							classes: new Uint8Array([]),
						},
						kerningArray: new Int16Array([0]),
					},
				],
			};

			const value = getKerxValue(kerx, 10, 20);
			expect(value).toBe(0);
		});

		test("handles out of bounds array index in format 2", () => {
			const kerx: KerxTable = {
				version: 2,
				nTables: 1,
				subtables: [
					{
						length: 100,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.SimpleArray,
						rowWidth: 4,
						leftClassTable: {
							firstGlyph: 10,
							nGlyphs: 2,
							classes: new Uint8Array([10, 20]), // Very high classes
						},
						rightClassTable: {
							firstGlyph: 20,
							nGlyphs: 2,
							classes: new Uint8Array([10, 20]),
						},
						kerningArray: new Int16Array([0, 0]), // Small array
					},
				],
			};

			const value = getKerxValue(kerx, 10, 20);
			expect(value).toBe(0);
		});

		test("handles zero value in format 2", () => {
			const kerx: KerxTable = {
				version: 2,
				nTables: 1,
				subtables: [
					{
						length: 100,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.SimpleArray,
						rowWidth: 4,
						leftClassTable: {
							firstGlyph: 10,
							nGlyphs: 2,
							classes: new Uint8Array([1, 2]),
						},
						rightClassTable: {
							firstGlyph: 20,
							nGlyphs: 2,
							classes: new Uint8Array([1, 2]),
						},
						kerningArray: new Int16Array([0, 0, 0, 0]),
					},
				],
			};

			const value = getKerxValue(kerx, 10, 20);
			expect(value).toBe(0);
		});

		test("skips format 1 and 6 subtables", () => {
			const kerx: KerxTable = {
				version: 2,
				nTables: 2,
				subtables: [
					{
						length: 64,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.StateTable,
						stateHeader: {
							nClasses: 0,
							classTableOffset: 0,
							stateArrayOffset: 0,
							entryTableOffset: 0,
							valueTableOffset: 0,
						},
					},
					{
						length: 64,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.Format6,
						flags: 0,
						rowCount: 0,
						columnCount: 0,
						rowIndexTableOffset: 0,
						columnIndexTableOffset: 0,
						kerningArrayOffset: 0,
						kerningVectorOffset: 0,
					},
				],
			};

			const value = getKerxValue(kerx, 10, 20);
			expect(value).toBe(0);
		});

		test("searches multiple subtables", () => {
			const kerx: KerxTable = {
				version: 2,
				nTables: 2,
				subtables: [
					{
						length: 32,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.OrderedList,
						nPairs: 1,
						pairs: [{ left: 10, right: 20, value: -50 }],
					},
					{
						length: 32,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.OrderedList,
						nPairs: 1,
						pairs: [{ left: 30, right: 40, value: 100 }],
					},
				],
			};

			// Found in first subtable
			expect(getKerxValue(kerx, 10, 20)).toBe(-50);

			// Found in second subtable
			expect(getKerxValue(kerx, 30, 40)).toBe(100);

			// Not found in either
			expect(getKerxValue(kerx, 15, 25)).toBe(0);
		});

		test("handles empty pairs array", () => {
			const kerx: KerxTable = {
				version: 2,
				nTables: 1,
				subtables: [
					{
						length: 32,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.OrderedList,
						nPairs: 0,
						pairs: [],
					},
				],
			};

			const value = getKerxValue(kerx, 10, 20);
			expect(value).toBe(0);
		});

		test("handles glyph ID 0", () => {
			const kerx: KerxTable = {
				version: 2,
				nTables: 1,
				subtables: [
					{
						length: 32,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.OrderedList,
						nPairs: 1,
						pairs: [{ left: 0, right: 0, value: -25 }],
					},
				],
			};

			const value = getKerxValue(kerx, 0, 0);
			expect(value).toBe(-25);
		});

		test("handles large glyph IDs", () => {
			const kerx: KerxTable = {
				version: 2,
				nTables: 1,
				subtables: [
					{
						length: 32,
						coverage: {
							vertical: false,
							crossStream: false,
							variation: false,
						},
						tupleCount: 0,
						format: KerxSubtableType.OrderedList,
						nPairs: 1,
						pairs: [{ left: 65000, right: 65500, value: -75 }],
					},
				],
			};

			const value = getKerxValue(kerx, 65000, 65500);
			expect(value).toBe(-75);
		});
	});

	describe("edge cases", () => {
		test("handles subtable with exact length", () => {
			const buffer = new ArrayBuffer(40);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 32, false); // exact length
			offset += 4;
			view.setUint32(offset, 0x00000000, false);
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 0, false);

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.subtables.length).toBe(1);
		});

		test("handles maximum tuple count", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 32, false);
			offset += 4;
			view.setUint32(offset, 0x00000000, false);
			offset += 4;
			view.setUint16(offset, 65535, false); // max tupleCount
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 0, false);

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			expect(kerx.subtables[0]?.tupleCount).toBe(65535);
		});

		test("handles all coverage flags set", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 2, false);
			view.setUint16(2, 0, false);
			view.setUint32(4, 1, false);

			let offset = 8;
			view.setUint32(offset, 32, false);
			offset += 4;
			view.setUint32(offset, 0xe0000000, false); // all coverage flags
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 0, false);

			const reader = new Reader(buffer);
			const kerx = parseKerx(reader);

			const coverage = kerx.subtables[0]?.coverage;
			expect(coverage?.vertical).toBe(true);
			expect(coverage?.crossStream).toBe(true);
			expect(coverage?.variation).toBe(true);
		});
	});
});
