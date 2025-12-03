import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import { Reader } from "../../../src/font/binary/reader.ts";
import {
	parseFontDirectory,
	isTrueType,
	isCFF,
	type FontDirectory,
} from "../../../src/font/tables/sfnt.ts";
import { Tags } from "../../../src/types.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";
const STIX_MATH_PATH = "/System/Library/Fonts/Supplemental/STIXTwoMath.otf";
const MENLO_TTC_PATH = "/System/Library/Fonts/Menlo.ttc";

describe("sfnt - font directory parsing", () => {
	let arialFont: Font;
	let arialBuffer: ArrayBuffer;

	beforeAll(async () => {
		arialFont = await Font.fromFile(ARIAL_PATH);
		const file = Bun.file(ARIAL_PATH);
		arialBuffer = await file.arrayBuffer();
	});

	describe("parseFontDirectory", () => {
		test("parses TrueType font directory", () => {
			const reader = new Reader(arialBuffer);
			const directory = parseFontDirectory(reader);

			expect(directory.sfntVersion).toBeDefined();
			expect(directory.numTables).toBeGreaterThan(0);
			expect(directory.searchRange).toBeGreaterThan(0);
			expect(directory.entrySelector).toBeGreaterThanOrEqual(0);
			expect(directory.rangeShift).toBeGreaterThanOrEqual(0);
			expect(directory.tables).toBeInstanceOf(Map);
			expect(directory.tables.size).toBe(directory.numTables);
		});

		test("sfnt version is valid TrueType", () => {
			const reader = new Reader(arialBuffer);
			const directory = parseFontDirectory(reader);

			// TrueType version should be 0x00010000 or 0x74727565 ('true')
			expect(
				directory.sfntVersion === 0x00010000 ||
					directory.sfntVersion === 0x74727565,
			).toBe(true);
		});

		test("table records have required properties", () => {
			const reader = new Reader(arialBuffer);
			const directory = parseFontDirectory(reader);

			for (const [tag, record] of directory.tables) {
				expect(record.tag).toBe(tag);
				expect(typeof record.checksum).toBe("number");
				expect(typeof record.offset).toBe("number");
				expect(typeof record.length).toBe("number");
				expect(record.offset).toBeGreaterThan(0);
				expect(record.length).toBeGreaterThan(0);
			}
		});

		test("contains required tables", () => {
			const reader = new Reader(arialBuffer);
			const directory = parseFontDirectory(reader);

			// Required tables for all fonts
			expect(directory.tables.has(Tags.head)).toBe(true);
			expect(directory.tables.has(Tags.maxp)).toBe(true);
			expect(directory.tables.has(Tags.hhea)).toBe(true);
			expect(directory.tables.has(Tags.hmtx)).toBe(true);
			expect(directory.tables.has(Tags.cmap)).toBe(true);
			expect(directory.tables.has(Tags.name)).toBe(true);
			expect(directory.tables.has(Tags.post)).toBe(true);
		});

		test("table offsets are within file bounds", () => {
			const reader = new Reader(arialBuffer);
			const directory = parseFontDirectory(reader);

			for (const record of directory.tables.values()) {
				// Offset + length should not exceed buffer size
				expect(record.offset + record.length).toBeLessThanOrEqual(
					arialBuffer.byteLength,
				);
				// Offsets should be positive
				expect(record.offset).toBeGreaterThan(0);
			}
		});

		test("searchRange formula is correct", () => {
			const reader = new Reader(arialBuffer);
			const directory = parseFontDirectory(reader);

			// searchRange = (maximum power of 2 <= numTables) × 16
			const maxPowerOf2 = 2 ** Math.floor(Math.log2(directory.numTables));
			expect(directory.searchRange).toBe(maxPowerOf2 * 16);
		});

		test("entrySelector formula is correct", () => {
			const reader = new Reader(arialBuffer);
			const directory = parseFontDirectory(reader);

			// entrySelector = log2(maximum power of 2 <= numTables)
			const expectedSelector = Math.floor(Math.log2(directory.numTables));
			expect(directory.entrySelector).toBe(expectedSelector);
		});

		test("rangeShift formula is correct", () => {
			const reader = new Reader(arialBuffer);
			const directory = parseFontDirectory(reader);

			// rangeShift = numTables × 16 - searchRange
			expect(directory.rangeShift).toBe(
				directory.numTables * 16 - directory.searchRange,
			);
		});

		test("throws on invalid sfnt version", () => {
			// Create a buffer with invalid magic number
			const badBuffer = new ArrayBuffer(12);
			const view = new DataView(badBuffer);
			view.setUint32(0, 0xdeadbeef, false); // Invalid version
			view.setUint16(4, 0, false); // numTables
			view.setUint16(6, 0, false); // searchRange
			view.setUint16(8, 0, false); // entrySelector
			view.setUint16(10, 0, false); // rangeShift

			const reader = new Reader(badBuffer);

			expect(() => parseFontDirectory(reader)).toThrow(
				/Invalid sfnt version: 0xdeadbeef/,
			);
		});
	});

	describe("isTrueType", () => {
		test("returns true for TrueType fonts", async () => {
			const reader = new Reader(arialBuffer);
			const directory = parseFontDirectory(reader);

			expect(isTrueType(directory)).toBe(true);
			expect(isCFF(directory)).toBe(false);
		});

		test("returns false for CFF fonts", async () => {
			const file = Bun.file(STIX_MATH_PATH);
			const buffer = await file.arrayBuffer();
			const reader = new Reader(buffer);
			const directory = parseFontDirectory(reader);

			expect(isTrueType(directory)).toBe(false);
			expect(isCFF(directory)).toBe(true);
		});
	});

	describe("isCFF", () => {
		test("returns true for CFF fonts", async () => {
			const file = Bun.file(STIX_MATH_PATH);
			const buffer = await file.arrayBuffer();
			const reader = new Reader(buffer);
			const directory = parseFontDirectory(reader);

			expect(isCFF(directory)).toBe(true);
			expect(isTrueType(directory)).toBe(false);
		});

		test("returns false for TrueType fonts", () => {
			const reader = new Reader(arialBuffer);
			const directory = parseFontDirectory(reader);

			expect(isCFF(directory)).toBe(false);
			expect(isTrueType(directory)).toBe(true);
		});
	});

	describe("Font integration", () => {
		test("Font class uses sfnt parsing correctly", () => {
			expect(arialFont.hasTable(Tags.head)).toBe(true);
			expect(arialFont.hasTable(Tags.maxp)).toBe(true);
			expect(arialFont.hasTable(Tags.cmap)).toBe(true);

			const headRecord = arialFont.getTableRecord(Tags.head);
			expect(headRecord).toBeDefined();
			expect(headRecord!.tag).toBe(Tags.head);
			expect(headRecord!.offset).toBeGreaterThan(0);
			expect(headRecord!.length).toBeGreaterThan(0);
		});

		test("can access all tables from directory", () => {
			const reader = new Reader(arialBuffer);
			const directory = parseFontDirectory(reader);

			for (const [tag, record] of directory.tables) {
				const tableReader = arialFont.getTableReader(tag);
				expect(tableReader).not.toBeNull();
				expect(tableReader!.length).toBe(record.length);
			}
		});
	});

	describe("TTC font collection detection", () => {
		test("detects TTC collection file", async () => {
			const file = Bun.file(MENLO_TTC_PATH);
			const buffer = await file.arrayBuffer();
			const reader = new Reader(buffer);

			// Read first 4 bytes as magic
			const magic = reader.uint32();

			// TTC files start with 'ttcf' (0x74746366)
			expect(magic).toBe(0x74746366);
		});

		test("TTC file throws when parsed as single font", async () => {
			const file = Bun.file(MENLO_TTC_PATH);
			const buffer = await file.arrayBuffer();
			const reader = new Reader(buffer);

			// TTC magic 'ttcf' is not a valid sfnt version
			expect(() => parseFontDirectory(reader)).toThrow(/Invalid sfnt version/);
		});
	});
});
