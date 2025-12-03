import { describe, expect, test } from "bun:test";
import { Reader } from "../../../src/font/binary/reader.ts";
import {
	parseClassDef,
	parseClassDefAt,
	EMPTY_CLASS_DEF,
} from "../../../src/layout/structures/class-def.ts";

function createBuffer(...bytes: number[]): ArrayBuffer {
	return new Uint8Array(bytes).buffer;
}

describe("ClassDef", () => {
	describe("Format 1 (array-based)", () => {
		test("parses single class value", () => {
			// Format 1: startGlyphId=10, count=1, class=2
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x0a, // startGlyphId = 10
				0x00, 0x01, // glyphCount = 1
				0x00, 0x02, // classValue[0] = 2
			));
			const classDef = parseClassDef(reader);

			expect(classDef.get(10)).toBe(2);
			expect(classDef.get(9)).toBe(0); // Before range
			expect(classDef.get(11)).toBe(0); // After range
		});

		test("parses multiple class values", () => {
			// Format 1: glyphs 5-9 with various classes
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x05, // startGlyphId = 5
				0x00, 0x05, // glyphCount = 5
				0x00, 0x01, // classValue[0] = 1 (glyph 5)
				0x00, 0x02, // classValue[1] = 2 (glyph 6)
				0x00, 0x01, // classValue[2] = 1 (glyph 7)
				0x00, 0x03, // classValue[3] = 3 (glyph 8)
				0x00, 0x02, // classValue[4] = 2 (glyph 9)
			));
			const classDef = parseClassDef(reader);

			expect(classDef.get(5)).toBe(1);
			expect(classDef.get(6)).toBe(2);
			expect(classDef.get(7)).toBe(1);
			expect(classDef.get(8)).toBe(3);
			expect(classDef.get(9)).toBe(2);
		});

		test("returns 0 for glyphs before range", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x0a, // startGlyphId = 10
				0x00, 0x02, // glyphCount = 2
				0x00, 0x01, // class = 1
				0x00, 0x01, // class = 1
			));
			const classDef = parseClassDef(reader);

			expect(classDef.get(0)).toBe(0);
			expect(classDef.get(5)).toBe(0);
			expect(classDef.get(9)).toBe(0);
		});

		test("returns 0 for glyphs after range", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x05, // startGlyphId = 5
				0x00, 0x02, // glyphCount = 2
				0x00, 0x01,
				0x00, 0x01,
			));
			const classDef = parseClassDef(reader);

			expect(classDef.get(7)).toBe(0);
			expect(classDef.get(100)).toBe(0);
		});

		test("glyphsInClass returns correct glyphs", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x05, // startGlyphId = 5
				0x00, 0x05, // glyphCount = 5
				0x00, 0x01, // glyph 5 -> class 1
				0x00, 0x02, // glyph 6 -> class 2
				0x00, 0x01, // glyph 7 -> class 1
				0x00, 0x02, // glyph 8 -> class 2
				0x00, 0x03, // glyph 9 -> class 3
			));
			const classDef = parseClassDef(reader);

			expect(classDef.glyphsInClass(1)).toEqual([5, 7]);
			expect(classDef.glyphsInClass(2)).toEqual([6, 8]);
			expect(classDef.glyphsInClass(3)).toEqual([9]);
			expect(classDef.glyphsInClass(4)).toEqual([]);
		});

		test("handles class 0 in array", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x05, // startGlyphId = 5
				0x00, 0x03, // glyphCount = 3
				0x00, 0x00, // glyph 5 -> class 0
				0x00, 0x01, // glyph 6 -> class 1
				0x00, 0x00, // glyph 7 -> class 0
			));
			const classDef = parseClassDef(reader);

			expect(classDef.get(5)).toBe(0);
			expect(classDef.get(6)).toBe(1);
			expect(classDef.get(7)).toBe(0);
			expect(classDef.glyphsInClass(0)).toEqual([5, 7]);
		});
	});

	describe("Format 2 (range-based)", () => {
		test("parses single range", () => {
			// Format 2: range 10-15 -> class 2
			const reader = new Reader(createBuffer(
				0x00, 0x02, // format = 2
				0x00, 0x01, // classRangeCount = 1
				0x00, 0x0a, // startGlyphId = 10
				0x00, 0x0f, // endGlyphId = 15
				0x00, 0x02, // classValue = 2
			));
			const classDef = parseClassDef(reader);

			expect(classDef.get(10)).toBe(2);
			expect(classDef.get(12)).toBe(2);
			expect(classDef.get(15)).toBe(2);
			expect(classDef.get(9)).toBe(0);
			expect(classDef.get(16)).toBe(0);
		});

		test("parses multiple ranges", () => {
			// Format 2: ranges 5-7 -> class 1, 20-22 -> class 2
			const reader = new Reader(createBuffer(
				0x00, 0x02, // format = 2
				0x00, 0x02, // classRangeCount = 2
				0x00, 0x05, // range[0].start = 5
				0x00, 0x07, // range[0].end = 7
				0x00, 0x01, // range[0].class = 1
				0x00, 0x14, // range[1].start = 20
				0x00, 0x16, // range[1].end = 22
				0x00, 0x02, // range[1].class = 2
			));
			const classDef = parseClassDef(reader);

			expect(classDef.get(5)).toBe(1);
			expect(classDef.get(6)).toBe(1);
			expect(classDef.get(7)).toBe(1);
			expect(classDef.get(20)).toBe(2);
			expect(classDef.get(21)).toBe(2);
			expect(classDef.get(22)).toBe(2);
			expect(classDef.get(10)).toBe(0);
		});

		test("glyphsInClass expands ranges", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x02, // format = 2
				0x00, 0x02, // classRangeCount = 2
				0x00, 0x05, // range[0].start = 5
				0x00, 0x07, // range[0].end = 7
				0x00, 0x01, // range[0].class = 1
				0x00, 0x0a, // range[1].start = 10
				0x00, 0x0b, // range[1].end = 11
				0x00, 0x01, // range[1].class = 1 (same class)
			));
			const classDef = parseClassDef(reader);

			expect(classDef.glyphsInClass(1)).toEqual([5, 6, 7, 10, 11]);
		});

		test("handles single-glyph range", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x02, // format = 2
				0x00, 0x01, // classRangeCount = 1
				0x00, 0x0a, // start = 10
				0x00, 0x0a, // end = 10 (same)
				0x00, 0x03, // class = 3
			));
			const classDef = parseClassDef(reader);

			expect(classDef.get(10)).toBe(3);
			expect(classDef.get(9)).toBe(0);
			expect(classDef.get(11)).toBe(0);
		});

		test("binary search through ranges", () => {
			// Create multiple ranges to test binary search
			const reader = new Reader(createBuffer(
				0x00, 0x02, // format = 2
				0x00, 0x05, // rangeCount = 5
				// Range 0: 10-19 -> class 1
				0x00, 0x0a, 0x00, 0x13, 0x00, 0x01,
				// Range 1: 30-39 -> class 2
				0x00, 0x1e, 0x00, 0x27, 0x00, 0x02,
				// Range 2: 50-59 -> class 3
				0x00, 0x32, 0x00, 0x3b, 0x00, 0x03,
				// Range 3: 70-79 -> class 4
				0x00, 0x46, 0x00, 0x4f, 0x00, 0x04,
				// Range 4: 90-99 -> class 5
				0x00, 0x5a, 0x00, 0x63, 0x00, 0x05,
			));
			const classDef = parseClassDef(reader);

			// Test boundaries
			expect(classDef.get(10)).toBe(1);
			expect(classDef.get(19)).toBe(1);
			expect(classDef.get(30)).toBe(2);
			expect(classDef.get(50)).toBe(3);
			expect(classDef.get(99)).toBe(5);

			// Test gaps (should return 0)
			expect(classDef.get(5)).toBe(0);
			expect(classDef.get(25)).toBe(0);
			expect(classDef.get(45)).toBe(0);
			expect(classDef.get(100)).toBe(0);
		});

		test("handles empty range list", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x02, // format = 2
				0x00, 0x00, // classRangeCount = 0
			));
			const classDef = parseClassDef(reader);

			expect(classDef.get(10)).toBe(0);
			expect(classDef.glyphsInClass(1)).toEqual([]);
		});
	});

	describe("EMPTY_CLASS_DEF", () => {
		test("returns 0 for all glyphs", () => {
			expect(EMPTY_CLASS_DEF.get(0)).toBe(0);
			expect(EMPTY_CLASS_DEF.get(10)).toBe(0);
			expect(EMPTY_CLASS_DEF.get(1000)).toBe(0);
			expect(EMPTY_CLASS_DEF.get(65535)).toBe(0);
		});

		test("glyphsInClass returns empty array", () => {
			expect(EMPTY_CLASS_DEF.glyphsInClass(0)).toEqual([]);
			expect(EMPTY_CLASS_DEF.glyphsInClass(1)).toEqual([]);
		});
	});

	describe("parseClassDefAt", () => {
		test("parses at offset", () => {
			// Padding + classdef data
			const reader = new Reader(createBuffer(
				0xaa, 0xbb, 0xcc, 0xdd, // 4 bytes padding
				0x00, 0x01, // format = 1
				0x00, 0x0a, // startGlyphId = 10
				0x00, 0x01, // glyphCount = 1
				0x00, 0x02, // class = 2
			));
			const classDef = parseClassDefAt(reader, 4);

			expect(classDef.get(10)).toBe(2);
		});

		test("returns EMPTY_CLASS_DEF for offset 0", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // This would be format if read
				0x00, 0x0a,
				0x00, 0x01,
				0x00, 0x02,
			));
			const classDef = parseClassDefAt(reader, 0);

			expect(classDef).toBe(EMPTY_CLASS_DEF);
			expect(classDef.get(10)).toBe(0);
		});
	});

	describe("edge cases", () => {
		test("glyph ID 0", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x00, // startGlyphId = 0
				0x00, 0x01, // glyphCount = 1
				0x00, 0x05, // class = 5
			));
			const classDef = parseClassDef(reader);

			expect(classDef.get(0)).toBe(5);
		});

		test("high class value", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x0a, // startGlyphId = 10
				0x00, 0x01, // glyphCount = 1
				0xff, 0xff, // class = 65535
			));
			const classDef = parseClassDef(reader);

			expect(classDef.get(10)).toBe(65535);
		});

		test("throws for unknown format", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x03, // format = 3 (invalid)
				0x00, 0x00,
			));

			expect(() => parseClassDef(reader)).toThrow();
		});
	});
});
