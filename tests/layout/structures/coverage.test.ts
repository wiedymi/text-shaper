import { describe, expect, test } from "bun:test";
import { Reader } from "../../../src/font/binary/reader.ts";
import { parseCoverage, parseCoverageAt } from "../../../src/layout/structures/coverage.ts";

function createBuffer(...bytes: number[]): ArrayBuffer {
	return new Uint8Array(bytes).buffer;
}

describe("Coverage", () => {
	describe("Format 1 (individual glyphs)", () => {
		test("parses single glyph coverage", () => {
			// Format 1: format=1, count=1, glyphId=10
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x01, // glyphCount = 1
				0x00, 0x0a, // glyph[0] = 10
			));
			const coverage = parseCoverage(reader);

			expect(coverage.size).toBe(1);
			expect(coverage.get(10)).toBe(0);
			expect(coverage.get(11)).toBeNull();
		});

		test("parses multiple glyph coverage", () => {
			// Format 1: glyphs 5, 10, 15
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x03, // glyphCount = 3
				0x00, 0x05, // glyph[0] = 5
				0x00, 0x0a, // glyph[1] = 10
				0x00, 0x0f, // glyph[2] = 15
			));
			const coverage = parseCoverage(reader);

			expect(coverage.size).toBe(3);
			expect(coverage.get(5)).toBe(0);
			expect(coverage.get(10)).toBe(1);
			expect(coverage.get(15)).toBe(2);
		});

		test("covers() returns boolean", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x02, // glyphCount = 2
				0x00, 0x05, // glyph[0] = 5
				0x00, 0x0a, // glyph[1] = 10
			));
			const coverage = parseCoverage(reader);

			expect(coverage.covers(5)).toBe(true);
			expect(coverage.covers(10)).toBe(true);
			expect(coverage.covers(7)).toBe(false);
			expect(coverage.covers(0)).toBe(false);
		});

		test("glyphs() returns all covered glyphs", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x03, // glyphCount = 3
				0x00, 0x05, // glyph[0] = 5
				0x00, 0x0a, // glyph[1] = 10
				0x00, 0x0f, // glyph[2] = 15
			));
			const coverage = parseCoverage(reader);

			expect(coverage.glyphs()).toEqual([5, 10, 15]);
		});

		test("handles empty coverage", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x00, // glyphCount = 0
			));
			const coverage = parseCoverage(reader);

			expect(coverage.size).toBe(0);
			expect(coverage.glyphs()).toEqual([]);
		});

		test("binary search finds correct index", () => {
			// Create coverage with many glyphs to test binary search
			const glyphs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
			const bytes = [0x00, 0x01, 0x00, glyphs.length];
			for (const g of glyphs) {
				bytes.push(0x00, g);
			}
			const reader = new Reader(createBuffer(...bytes));
			const coverage = parseCoverage(reader);

			for (let i = 0; i < glyphs.length; i++) {
				expect(coverage.get(glyphs[i])).toBe(i);
			}

			// Test non-existent glyphs
			expect(coverage.get(5)).toBeNull();
			expect(coverage.get(15)).toBeNull();
			expect(coverage.get(105)).toBeNull();
		});
	});

	describe("Format 2 (glyph ranges)", () => {
		test("parses single range", () => {
			// Format 2: range 10-15 starting at coverage index 0
			const reader = new Reader(createBuffer(
				0x00, 0x02, // format = 2
				0x00, 0x01, // rangeCount = 1
				0x00, 0x0a, // startGlyphId = 10
				0x00, 0x0f, // endGlyphId = 15
				0x00, 0x00, // startCoverageIndex = 0
			));
			const coverage = parseCoverage(reader);

			expect(coverage.size).toBe(6); // 15 - 10 + 1
			expect(coverage.get(10)).toBe(0);
			expect(coverage.get(12)).toBe(2);
			expect(coverage.get(15)).toBe(5);
			expect(coverage.get(9)).toBeNull();
			expect(coverage.get(16)).toBeNull();
		});

		test("parses multiple ranges", () => {
			// Format 2: ranges 5-7 and 20-22
			const reader = new Reader(createBuffer(
				0x00, 0x02, // format = 2
				0x00, 0x02, // rangeCount = 2
				0x00, 0x05, // range[0].start = 5
				0x00, 0x07, // range[0].end = 7
				0x00, 0x00, // range[0].startIndex = 0
				0x00, 0x14, // range[1].start = 20
				0x00, 0x16, // range[1].end = 22
				0x00, 0x03, // range[1].startIndex = 3
			));
			const coverage = parseCoverage(reader);

			expect(coverage.size).toBe(6); // 3 + 3

			// First range
			expect(coverage.get(5)).toBe(0);
			expect(coverage.get(6)).toBe(1);
			expect(coverage.get(7)).toBe(2);

			// Second range
			expect(coverage.get(20)).toBe(3);
			expect(coverage.get(21)).toBe(4);
			expect(coverage.get(22)).toBe(5);

			// Gaps
			expect(coverage.get(8)).toBeNull();
			expect(coverage.get(19)).toBeNull();
		});

		test("glyphs() expands ranges", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x02, // format = 2
				0x00, 0x02, // rangeCount = 2
				0x00, 0x05, // range[0].start = 5
				0x00, 0x07, // range[0].end = 7
				0x00, 0x00, // range[0].startIndex = 0
				0x00, 0x0a, // range[1].start = 10
				0x00, 0x0b, // range[1].end = 11
				0x00, 0x03, // range[1].startIndex = 3
			));
			const coverage = parseCoverage(reader);

			expect(coverage.glyphs()).toEqual([5, 6, 7, 10, 11]);
		});

		test("handles empty coverage", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x02, // format = 2
				0x00, 0x00, // rangeCount = 0
			));
			const coverage = parseCoverage(reader);

			expect(coverage.size).toBe(0);
			expect(coverage.glyphs()).toEqual([]);
		});

		test("handles single-glyph range", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x02, // format = 2
				0x00, 0x01, // rangeCount = 1
				0x00, 0x0a, // start = 10
				0x00, 0x0a, // end = 10 (same)
				0x00, 0x00, // startIndex = 0
			));
			const coverage = parseCoverage(reader);

			expect(coverage.size).toBe(1);
			expect(coverage.get(10)).toBe(0);
			expect(coverage.get(9)).toBeNull();
			expect(coverage.get(11)).toBeNull();
		});

		test("binary search through ranges", () => {
			// Create multiple ranges to test binary search
			const reader = new Reader(createBuffer(
				0x00, 0x02, // format = 2
				0x00, 0x05, // rangeCount = 5
				// Range 0: 10-19
				0x00, 0x0a, 0x00, 0x13, 0x00, 0x00,
				// Range 1: 30-39
				0x00, 0x1e, 0x00, 0x27, 0x00, 0x0a,
				// Range 2: 50-59
				0x00, 0x32, 0x00, 0x3b, 0x00, 0x14,
				// Range 3: 70-79
				0x00, 0x46, 0x00, 0x4f, 0x00, 0x1e,
				// Range 4: 90-99
				0x00, 0x5a, 0x00, 0x63, 0x00, 0x28,
			));
			const coverage = parseCoverage(reader);

			// Test boundaries
			expect(coverage.get(10)).toBe(0);
			expect(coverage.get(19)).toBe(9);
			expect(coverage.get(30)).toBe(10);
			expect(coverage.get(50)).toBe(20);
			expect(coverage.get(99)).toBe(49);

			// Test gaps
			expect(coverage.get(5)).toBeNull();
			expect(coverage.get(25)).toBeNull();
			expect(coverage.get(45)).toBeNull();
			expect(coverage.get(100)).toBeNull();
		});
	});

	describe("parseCoverageAt", () => {
		test("parses coverage at offset", () => {
			// Padding + coverage data
			const reader = new Reader(createBuffer(
				0xaa, 0xbb, 0xcc, 0xdd, // 4 bytes padding
				0x00, 0x01, // format = 1
				0x00, 0x01, // glyphCount = 1
				0x00, 0x0a, // glyph = 10
			));
			const coverage = parseCoverageAt(reader, 4);

			expect(coverage.get(10)).toBe(0);
		});
	});

	describe("edge cases", () => {
		test("glyph ID 0", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x01, // glyphCount = 1
				0x00, 0x00, // glyph = 0
			));
			const coverage = parseCoverage(reader);

			expect(coverage.get(0)).toBe(0);
			expect(coverage.covers(0)).toBe(true);
		});

		test("high glyph ID", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x01, // glyphCount = 1
				0xff, 0xff, // glyph = 65535
			));
			const coverage = parseCoverage(reader);

			expect(coverage.get(65535)).toBe(0);
		});

		test("throws for unknown format", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x03, // format = 3 (invalid)
				0x00, 0x00,
			));

			expect(() => parseCoverage(reader)).toThrow();
		});
	});
});
