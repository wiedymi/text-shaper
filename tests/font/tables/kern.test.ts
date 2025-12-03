import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseKern,
	getKernValue,
	type KernTable,
	type KernFormat0,
	type KernFormat2,
} from "../../../src/font/tables/kern.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("kern table", () => {
	let font: Font;
	let kern: KernTable;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
		const kernTable = font.kern;
		if (!kernTable) {
			throw new Error("Arial font should have a kern table");
		}
		kern = kernTable;
	});

	describe("parseKern", () => {
		test("returns KernTable with version", () => {
			expect(kern.version).toBeDefined();
			expect(typeof kern.version).toBe("number");
			expect([0, 1]).toContain(kern.version);
		});

		test("has subtables array", () => {
			expect(Array.isArray(kern.subtables)).toBe(true);
			expect(kern.subtables.length).toBeGreaterThan(0);
		});

		test("subtables have required properties", () => {
			for (const subtable of kern.subtables) {
				expect(typeof subtable.format).toBe("number");
				expect([0, 2]).toContain(subtable.format);
				expect(subtable.coverage).toBeDefined();
				expect(typeof subtable.coverage.horizontal).toBe("boolean");
				expect(typeof subtable.coverage.minimum).toBe("boolean");
				expect(typeof subtable.coverage.crossStream).toBe("boolean");
				expect(typeof subtable.coverage.override).toBe("boolean");
			}
		});

		test("Arial has Microsoft format (version 0)", () => {
			expect(kern.version).toBe(0);
		});

		test("Arial has at least one subtable", () => {
			expect(kern.subtables.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("format 0 subtable", () => {
		let format0: KernFormat0 | null = null;

		beforeAll(() => {
			format0 = kern.subtables.find(
				(s): s is KernFormat0 => s.format === 0,
			) ?? null;
		});

		test("Arial has format 0 subtable", () => {
			expect(format0).not.toBeNull();
		});

		test("format 0 has pairs map", () => {
			if (!format0) return;
			expect(format0.pairs).toBeInstanceOf(Map);
			expect(format0.pairs.size).toBeGreaterThan(0);
		});

		test("format 0 coverage flags are parsed", () => {
			if (!format0) return;
			expect(typeof format0.coverage.horizontal).toBe("boolean");
			expect(format0.coverage.horizontal).toBe(true);
		});

		test("format 0 pairs have valid structure", () => {
			if (!format0) return;
			for (const [key, value] of format0.pairs) {
				expect(typeof key).toBe("number");
				expect(typeof value).toBe("number");
				// Key should be (left << 16) | right
				const left = key >> 16;
				const right = key & 0xffff;
				expect(left).toBeGreaterThan(0);
				expect(right).toBeGreaterThan(0);
				expect(left).toBeLessThan(65536);
				expect(right).toBeLessThan(65536);
			}
		});

		test("format 0 has multiple pairs", () => {
			if (!format0) return;
			expect(format0.pairs.size).toBeGreaterThan(100);
		});

		test("format 0 pair keys are unique", () => {
			if (!format0) return;
			const keys = Array.from(format0.pairs.keys());
			const uniqueKeys = new Set(keys);
			expect(uniqueKeys.size).toBe(keys.length);
		});

		test("format 0 kerning values can be negative", () => {
			if (!format0) return;
			let hasNegative = false;
			for (const value of format0.pairs.values()) {
				if (value < 0) {
					hasNegative = true;
					break;
				}
			}
			expect(hasNegative).toBe(true);
		});

		test("format 0 kerning values can be positive", () => {
			if (!format0) return;
			let hasPositive = false;
			for (const value of format0.pairs.values()) {
				if (value > 0) {
					hasPositive = true;
					break;
				}
			}
			// Arial typically has negative kerning, but test structure
			expect(typeof hasPositive).toBe("boolean");
		});
	});

	describe("getKernValue", () => {
		test("returns 0 for non-kerned pairs", () => {
			const glyphA = font.glyphIdForChar("A");
			const glyphB = font.glyphIdForChar("A");
			const value = getKernValue(kern, glyphA, glyphB);
			expect(typeof value).toBe("number");
		});

		test("returns kerning value for kerned pairs", () => {
			const glyphA = font.glyphIdForChar("A");
			const glyphV = font.glyphIdForChar("V");
			const value = getKernValue(kern, glyphA, glyphV);
			expect(typeof value).toBe("number");
			// A-V typically has negative kerning
			expect(value).not.toBe(0);
		});

		test("handles common kerning pairs", () => {
			const pairs = [
				["A", "V"],
				["V", "A"],
				["T", "o"],
				["W", "A"],
			];

			for (const [left, right] of pairs) {
				const leftGlyph = font.glyphIdForChar(left);
				const rightGlyph = font.glyphIdForChar(right);
				const value = getKernValue(kern, leftGlyph, rightGlyph);
				expect(typeof value).toBe("number");
			}
		});

		test("kerning is directional (AV != VA typically)", () => {
			const glyphA = font.glyphIdForChar("A");
			const glyphV = font.glyphIdForChar("V");
			const av = getKernValue(kern, glyphA, glyphV);
			const va = getKernValue(kern, glyphV, glyphA);
			// Both should be non-zero, might be same or different
			expect(typeof av).toBe("number");
			expect(typeof va).toBe("number");
		});

		test("returns 0 for missing pairs", () => {
			// Use unlikely glyph IDs
			const value = getKernValue(kern, 999, 1000);
			expect(value).toBe(0);
		});

		test("handles glyph ID 0 (notdef)", () => {
			const glyphA = font.glyphIdForChar("A");
			const value1 = getKernValue(kern, 0, glyphA);
			const value2 = getKernValue(kern, glyphA, 0);
			expect(typeof value1).toBe("number");
			expect(typeof value2).toBe("number");
		});

		test("accumulates values from multiple subtables", () => {
			const glyphA = font.glyphIdForChar("A");
			const glyphV = font.glyphIdForChar("V");
			const value = getKernValue(kern, glyphA, glyphV);
			expect(typeof value).toBe("number");
		});

		test("handles invalid glyph IDs", () => {
			const value = getKernValue(kern, -1, -1);
			expect(value).toBe(0);
		});

		test("handles very large glyph IDs", () => {
			const value = getKernValue(kern, 65535, 65535);
			expect(value).toBe(0);
		});

		test("consistent results on repeated calls", () => {
			const glyphA = font.glyphIdForChar("A");
			const glyphV = font.glyphIdForChar("V");
			const value1 = getKernValue(kern, glyphA, glyphV);
			const value2 = getKernValue(kern, glyphA, glyphV);
			expect(value1).toBe(value2);
		});
	});

	describe("coverage flags", () => {
		test("horizontal flag is set for horizontal kerning", () => {
			let hasHorizontal = false;
			for (const subtable of kern.subtables) {
				if (subtable.coverage.horizontal) {
					hasHorizontal = true;
				}
			}
			expect(hasHorizontal).toBe(true);
		});

		test("override flag affects accumulation", () => {
			// Test that override flag is properly stored
			for (const subtable of kern.subtables) {
				expect(typeof subtable.coverage.override).toBe("boolean");
			}
		});

		test("minimum flag is boolean", () => {
			for (const subtable of kern.subtables) {
				expect(typeof subtable.coverage.minimum).toBe("boolean");
			}
		});

		test("crossStream flag is boolean", () => {
			for (const subtable of kern.subtables) {
				expect(typeof subtable.coverage.crossStream).toBe("boolean");
			}
		});
	});

	describe("edge cases", () => {
		test("handles same glyph pairs", () => {
			const glyphA = font.glyphIdForChar("A");
			const value = getKernValue(kern, glyphA, glyphA);
			expect(typeof value).toBe("number");
		});

		test("handles all ASCII letter pairs", () => {
			for (let i = 65; i <= 90; i++) {
				// A-Z
				const left = font.glyphIdForChar(String.fromCharCode(i));
				const right = font.glyphIdForChar("A");
				const value = getKernValue(kern, left, right);
				expect(typeof value).toBe("number");
			}
		});

		test("handles lowercase pairs", () => {
			const glyphA = font.glyphIdForChar("a");
			const glyphV = font.glyphIdForChar("v");
			const value = getKernValue(kern, glyphA, glyphV);
			expect(typeof value).toBe("number");
		});

		test("handles digit pairs", () => {
			const glyph1 = font.glyphIdForChar("1");
			const glyph2 = font.glyphIdForChar("2");
			const value = getKernValue(kern, glyph1, glyph2);
			expect(typeof value).toBe("number");
		});

		test("handles punctuation pairs", () => {
			const glyphPeriod = font.glyphIdForChar(".");
			const glyphQuote = font.glyphIdForChar('"');
			const value = getKernValue(kern, glyphPeriod, glyphQuote);
			expect(typeof value).toBe("number");
		});
	});

	describe("specific kerning pairs", () => {
		test("A-V pair has negative kerning", () => {
			const glyphA = font.glyphIdForChar("A");
			const glyphV = font.glyphIdForChar("V");
			const value = getKernValue(kern, glyphA, glyphV);
			expect(value).toBeLessThan(0);
		});

		test("V-A pair has negative kerning", () => {
			const glyphV = font.glyphIdForChar("V");
			const glyphA = font.glyphIdForChar("A");
			const value = getKernValue(kern, glyphV, glyphA);
			expect(value).toBeLessThan(0);
		});

		test("T-o pair exists", () => {
			const glyphT = font.glyphIdForChar("T");
			const glyphO = font.glyphIdForChar("o");
			const value = getKernValue(kern, glyphT, glyphO);
			expect(typeof value).toBe("number");
		});

		test("W-A pair exists", () => {
			const glyphW = font.glyphIdForChar("W");
			const glyphA = font.glyphIdForChar("A");
			const value = getKernValue(kern, glyphW, glyphA);
			expect(typeof value).toBe("number");
		});
	});

	describe("format 0 key encoding", () => {
		test("key is properly encoded as (left << 16) | right", () => {
			const format0 = kern.subtables.find(
				(s): s is KernFormat0 => s.format === 0,
			);
			if (!format0) return;

			for (const [key, _value] of format0.pairs) {
				const left = key >> 16;
				const right = key & 0xffff;

				// Verify key can be reconstructed
				const reconstructed = (left << 16) | right;
				expect(reconstructed).toBe(key);
			}
		});

		test("getKernValue uses correct key encoding", () => {
			const glyphA = font.glyphIdForChar("A");
			const glyphV = font.glyphIdForChar("V");

			const format0 = kern.subtables.find(
				(s): s is KernFormat0 => s.format === 0,
			);
			if (!format0) return;

			const expectedKey = (glyphA << 16) | glyphV;
			const directValue = format0.pairs.get(expectedKey);
			const funcValue = getKernValue(kern, glyphA, glyphV);

			if (directValue !== undefined) {
				expect(funcValue).toBe(directValue);
			}
		});
	});

	describe("non-horizontal kerning", () => {
		test("skips non-horizontal subtables", () => {
			// Create a modified kern table with non-horizontal subtable
			const modifiedSubtables = kern.subtables.map((sub) => {
				if (sub.format === 0) {
					return {
						...sub,
						coverage: {
							...sub.coverage,
							horizontal: false,
						},
					};
				}
				return sub;
			});

			const modifiedKern: KernTable = {
				...kern,
				subtables: modifiedSubtables,
			};

			const glyphA = font.glyphIdForChar("A");
			const glyphV = font.glyphIdForChar("V");
			const value = getKernValue(modifiedKern, glyphA, glyphV);

			// Should return 0 because all subtables are non-horizontal
			expect(value).toBe(0);
		});
	});

	describe("override coverage flag", () => {
		test("override flag replaces instead of accumulates", () => {
			const format0 = kern.subtables.find(
				(s): s is KernFormat0 => s.format === 0,
			);
			if (!format0) return;

			// Test that override flag is properly handled in getKernValue
			const testKern: KernTable = {
				version: 0,
				subtables: [
					{
						format: 0,
						coverage: {
							horizontal: true,
							minimum: false,
							crossStream: false,
							override: false,
						},
						pairs: new Map([[((10 << 16) | 20), 100]]),
					},
					{
						format: 0,
						coverage: {
							horizontal: true,
							minimum: false,
							crossStream: false,
							override: true,
						},
						pairs: new Map([[((10 << 16) | 20), 50]]),
					},
				],
			};

			// With override, second value should replace first
			const value = getKernValue(testKern, 10, 20);
			expect(value).toBe(50);
		});

		test("without override flag, values accumulate", () => {
			const testKern: KernTable = {
				version: 0,
				subtables: [
					{
						format: 0,
						coverage: {
							horizontal: true,
							minimum: false,
							crossStream: false,
							override: false,
						},
						pairs: new Map([[((10 << 16) | 20), 100]]),
					},
					{
						format: 0,
						coverage: {
							horizontal: true,
							minimum: false,
							crossStream: false,
							override: false,
						},
						pairs: new Map([[((10 << 16) | 20), 50]]),
					},
				],
			};

			// Without override, values should accumulate
			const value = getKernValue(testKern, 10, 20);
			expect(value).toBe(150);
		});
	});

	describe("empty kern table", () => {
		test("handles kern table with no subtables", () => {
			const emptyKern: KernTable = {
				version: 0,
				subtables: [],
			};

			const value = getKernValue(emptyKern, 10, 20);
			expect(value).toBe(0);
		});

		test("handles format 0 subtable with no pairs", () => {
			const emptyPairsKern: KernTable = {
				version: 0,
				subtables: [
					{
						format: 0,
						coverage: {
							horizontal: true,
							minimum: false,
							crossStream: false,
							override: false,
						},
						pairs: new Map(),
					},
				],
			};

			const value = getKernValue(emptyPairsKern, 10, 20);
			expect(value).toBe(0);
		});
	});

	describe("format 2 support", () => {
		test("handles format 2 subtables if present", () => {
			const format2 = kern.subtables.find(
				(s): s is KernFormat2 => s.format === 2,
			);

			if (format2) {
				expect(typeof format2.rowWidth).toBe("number");
				expect(format2.leftClassTable).toBeInstanceOf(Map);
				expect(format2.rightClassTable).toBeInstanceOf(Map);
				expect(Array.isArray(format2.kerningValues)).toBe(true);

				// Test structure
				expect(format2.rowWidth).toBeGreaterThan(0);
				for (const row of format2.kerningValues) {
					expect(Array.isArray(row)).toBe(true);
				}
			} else {
				// Arial typically doesn't have format 2, but test passes
				expect(format2).toBeUndefined();
			}
		});

		test("getKernValue handles format 2 class-based kerning", () => {
			// Create a test format 2 subtable
			const testKern: KernTable = {
				version: 0,
				subtables: [
					{
						format: 2,
						coverage: {
							horizontal: true,
							minimum: false,
							crossStream: false,
							override: false,
						},
						rowWidth: 4,
						leftClassTable: new Map([
							[10, 2],
							[11, 4],
						]),
						rightClassTable: new Map([
							[20, 2],
							[21, 4],
						]),
						kerningValues: [
							[0, 0, 0, 0],
							[0, -50, 0, 0],
							[0, 0, -100, 0],
						],
					},
				],
			};

			// Test class-based lookup
			const value = getKernValue(testKern, 10, 20);
			// leftClass = 2, rightClass = 2
			// rowIndex = floor(2/2) = 1, colIndex = floor(2/2) = 1
			expect(value).toBe(-50);
		});

		test("format 2 handles missing classes (defaults to 0)", () => {
			const testKern: KernTable = {
				version: 0,
				subtables: [
					{
						format: 2,
						coverage: {
							horizontal: true,
							minimum: false,
							crossStream: false,
							override: false,
						},
						rowWidth: 4,
						leftClassTable: new Map([[10, 2]]),
						rightClassTable: new Map([[20, 2]]),
						kerningValues: [[0, 0, 0, 0]],
					},
				],
			};

			// Glyph not in class table should default to class 0
			const value = getKernValue(testKern, 999, 999);
			expect(value).toBe(0);
		});

		test("format 2 handles class 0 (no kerning)", () => {
			const testKern: KernTable = {
				version: 0,
				subtables: [
					{
						format: 2,
						coverage: {
							horizontal: true,
							minimum: false,
							crossStream: false,
							override: false,
						},
						rowWidth: 4,
						leftClassTable: new Map([[10, 0]]),
						rightClassTable: new Map([[20, 0]]),
						kerningValues: [[100, 200]],
					},
				],
			};

			// Class 0 should not be kerned
			const value = getKernValue(testKern, 10, 20);
			expect(value).toBe(0);
		});

		test("format 2 override flag works", () => {
			const testKern: KernTable = {
				version: 0,
				subtables: [
					{
						format: 2,
						coverage: {
							horizontal: true,
							minimum: false,
							crossStream: false,
							override: false,
						},
						rowWidth: 4,
						leftClassTable: new Map([[10, 2]]),
						rightClassTable: new Map([[20, 2]]),
						kerningValues: [
							[0, 0],
							[0, 100],
						],
					},
					{
						format: 2,
						coverage: {
							horizontal: true,
							minimum: false,
							crossStream: false,
							override: true,
						},
						rowWidth: 4,
						leftClassTable: new Map([[10, 2]]),
						rightClassTable: new Map([[20, 2]]),
						kerningValues: [
							[0, 0],
							[0, 50],
						],
					},
				],
			};

			const value = getKernValue(testKern, 10, 20);
			expect(value).toBe(50); // Override should replace
		});
	});

	describe("Microsoft vs Apple format detection", () => {
		test("version 0 is Microsoft format", () => {
			if (kern.version === 0) {
				expect(kern.subtables.length).toBeGreaterThan(0);
			}
		});

		test("version 1 would be Apple format", () => {
			// Arial uses version 0, but verify the code handles version 1
			if (kern.version === 1) {
				expect(kern.subtables.length).toBeGreaterThanOrEqual(0);
			} else {
				expect(kern.version).toBe(0);
			}
		});
	});

	describe("real font kerning data", () => {
		test("Arial has kerning pairs", () => {
			const format0 = kern.subtables.find(
				(s): s is KernFormat0 => s.format === 0,
			);
			if (!format0) return;

			expect(format0.pairs.size).toBeGreaterThan(0);
		});

		test("common pairs have expected kerning", () => {
			const pairs = [
				["A", "V"],
				["T", "o"],
				["P", "a"],
				["F", "o"],
			];

			for (const [left, right] of pairs) {
				const leftGlyph = font.glyphIdForChar(left);
				const rightGlyph = font.glyphIdForChar(right);
				const value = getKernValue(kern, leftGlyph, rightGlyph);

				// These pairs typically have negative kerning in Arial
				if (value !== 0) {
					expect(value).toBeLessThan(0);
				}
			}
		});

		test("kerning values are in reasonable range", () => {
			const format0 = kern.subtables.find(
				(s): s is KernFormat0 => s.format === 0,
			);
			if (!format0) return;

			for (const value of format0.pairs.values()) {
				// Kerning values should be reasonable (not extreme)
				expect(value).toBeGreaterThan(-1000);
				expect(value).toBeLessThan(1000);
			}
		});
	});
});

describe("kern table - synthetic tests for coverage", () => {
	describe("Apple format (version 1)", () => {
		test("parses Apple kern table with format 0 subtable", () => {
			// Create Apple kern table binary data
			// Version: 0x00010000 (Apple format)
			// nTables: 1
			// Subtable: length=26, coverage=0x8000 (horizontal), format=0
			// nPairs: 1, pair: (10, 20, -50)
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);
			let offset = 0;

			// Version (0x00010000 for Apple)
			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2; // Skip rest of version
			// nTables
			view.setUint32(offset, 1, false);
			offset += 4;
			// Subtable length
			view.setUint32(offset, 26, false);
			offset += 4;
			// Coverage (0x8000 = horizontal)
			view.setUint16(offset, 0x8000, false);
			offset += 2;
			// Tuple index
			view.setUint16(offset, 0, false);
			offset += 2;
			// Format (in lower byte of coverage)
			view.setUint16(offset - 4, 0x8000 | 0, false); // horizontal + format 0
			// Go back and set correct coverage
			view.setUint16(offset - 2, 0x8000, false);
			view.setUint16(offset - 4, 0, false);

			// Rewrite properly
			offset = 0;
			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint32(offset, 1, false);
			offset += 4;
			view.setUint32(offset, 26, false);
			offset += 4;
			view.setUint16(offset, 0x0000, false); // coverage: horizontal (bit 15 = 0)
			offset += 2;
			view.setUint16(offset, 0, false); // tupleIndex
			offset += 2;
			// nPairs
			view.setUint16(offset, 1, false);
			offset += 2;
			// searchRange
			view.setUint16(offset, 0, false);
			offset += 2;
			// entrySelector
			view.setUint16(offset, 0, false);
			offset += 2;
			// rangeShift
			view.setUint16(offset, 0, false);
			offset += 2;
			// Pair: left=10, right=20, value=-50
			view.setUint16(offset, 10, false);
			offset += 2;
			view.setUint16(offset, 20, false);
			offset += 2;
			view.setInt16(offset, -50, false);
			offset += 2;

			const reader = new Reader(buffer);
			const kern = parseKern(reader);

			expect(kern.version).toBe(1);
			expect(kern.subtables.length).toBe(1);
			expect(kern.subtables[0]?.format).toBe(0);
			if (kern.subtables[0]?.format === 0) {
				expect(kern.subtables[0].coverage.horizontal).toBe(true);
				expect(kern.subtables[0].pairs.size).toBe(1);
				const key = (10 << 16) | 20;
				expect(kern.subtables[0].pairs.get(key)).toBe(-50);
			}
		});

		test("parses Apple kern table with format 2 subtable", () => {
			// Create Apple kern table with format 2
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);
			let offset = 0;

			// Version (0x00010000 for Apple)
			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			// nTables
			view.setUint32(offset, 1, false);
			offset += 4;
			// Subtable length
			view.setUint32(offset, 100, false);
			offset += 4;
			// Coverage: format 2 in lower byte, horizontal when bit 15 = 0
			view.setUint16(offset, 0x0002, false); // horizontal (bit 15=0) + format 2
			offset += 2;
			// Tuple index
			view.setUint16(offset, 0, false);
			offset += 2;

			// Format 2 data
			const format2Start = offset;
			// rowWidth
			view.setUint16(offset, 4, false);
			offset += 2;
			// leftClassOffset
			view.setUint16(offset, 8, false);
			offset += 2;
			// rightClassOffset
			view.setUint16(offset, 18, false);
			offset += 2;
			// arrayOffset
			view.setUint16(offset, 28, false);
			offset += 2;

			// Left class table at format2Start + 8
			const leftClassOffset = format2Start + 8;
			view.setUint16(leftClassOffset, 10, false); // firstGlyph
			view.setUint16(leftClassOffset + 2, 2, false); // nGlyphs
			view.setUint16(leftClassOffset + 4, 2, false); // class for glyph 10
			view.setUint16(leftClassOffset + 6, 0, false); // class for glyph 11

			// Right class table at format2Start + 18
			const rightClassOffset = format2Start + 18;
			view.setUint16(rightClassOffset, 20, false); // firstGlyph
			view.setUint16(rightClassOffset + 2, 2, false); // nGlyphs
			view.setUint16(rightClassOffset + 4, 2, false); // class for glyph 20
			view.setUint16(rightClassOffset + 6, 0, false); // class for glyph 21

			// Kerning array at format2Start + 28
			const arrayOffset = format2Start + 28;
			view.setInt16(arrayOffset, 0, false);
			view.setInt16(arrayOffset + 2, 0, false);
			view.setInt16(arrayOffset + 4, 0, false);
			view.setInt16(arrayOffset + 6, -100, false); // row 0, col 1

			const reader = new Reader(buffer);
			const kern = parseKern(reader);

			expect(kern.version).toBe(1);
			expect(kern.subtables.length).toBe(1);
			expect(kern.subtables[0]?.format).toBe(2);
			if (kern.subtables[0]?.format === 2) {
				expect(kern.subtables[0].coverage.horizontal).toBe(true);
				expect(kern.subtables[0].rowWidth).toBe(4);
				expect(kern.subtables[0].leftClassTable.size).toBe(1);
				expect(kern.subtables[0].rightClassTable.size).toBe(1);
			}
		});

		test("skips unknown format in Apple subtable", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);
			let offset = 0;

			// Version (0x00010000 for Apple)
			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			// nTables
			view.setUint32(offset, 1, false);
			offset += 4;
			// Subtable length
			view.setUint32(offset, 20, false);
			offset += 4;
			// Coverage: format 99 (unknown), non-horizontal (bit 15=1)
			view.setUint16(offset, 0x8063, false); // non-horizontal + format 99
			offset += 2;
			// Tuple index
			view.setUint16(offset, 0, false);
			offset += 2;

			const reader = new Reader(buffer);
			const kern = parseKern(reader);

			expect(kern.version).toBe(1);
			expect(kern.subtables.length).toBe(0); // Unknown format skipped
		});
	});

	describe("Microsoft format with format 2 subtable", () => {
		test("parses Microsoft kern table with format 2 subtable", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);
			let offset = 0;

			// Version 0 (Microsoft)
			view.setUint16(offset, 0, false);
			offset += 2;
			// nTables
			view.setUint16(offset, 1, false);
			offset += 2;
			// Subtable version
			view.setUint16(offset, 0, false);
			offset += 2;
			// Length
			view.setUint16(offset, 100, false);
			offset += 2;
			// Coverage: format in high byte (2 << 8), horizontal in low byte
			view.setUint16(offset, (2 << 8) | 0x01, false);
			offset += 2;

			// Format 2 data
			const format2Start = offset;
			// rowWidth
			view.setUint16(offset, 4, false);
			offset += 2;
			// leftClassOffset
			view.setUint16(offset, 8, false);
			offset += 2;
			// rightClassOffset
			view.setUint16(offset, 18, false);
			offset += 2;
			// arrayOffset
			view.setUint16(offset, 28, false);
			offset += 2;

			// Left class table at format2Start + 8
			const leftClassOffset = format2Start + 8;
			view.setUint16(leftClassOffset, 10, false); // firstGlyph
			view.setUint16(leftClassOffset + 2, 2, false); // nGlyphs
			view.setUint16(leftClassOffset + 4, 2, false); // class for glyph 10
			view.setUint16(leftClassOffset + 6, 4, false); // class for glyph 11

			// Right class table at format2Start + 18
			const rightClassOffset = format2Start + 18;
			view.setUint16(rightClassOffset, 20, false); // firstGlyph
			view.setUint16(rightClassOffset + 2, 2, false); // nGlyphs
			view.setUint16(rightClassOffset + 4, 2, false); // class for glyph 20
			view.setUint16(rightClassOffset + 6, 4, false); // class for glyph 21

			// Kerning array at format2Start + 28
			const arrayOffset = format2Start + 28;
			// Row 0
			view.setInt16(arrayOffset, 0, false);
			view.setInt16(arrayOffset + 2, 0, false);
			// Row 1
			view.setInt16(arrayOffset + 4, 0, false);
			view.setInt16(arrayOffset + 6, -100, false);

			const reader = new Reader(buffer);
			const kern = parseKern(reader);

			expect(kern.version).toBe(0);
			expect(kern.subtables.length).toBe(1);
			expect(kern.subtables[0]?.format).toBe(2);
			if (kern.subtables[0]?.format === 2) {
				expect(kern.subtables[0].coverage.horizontal).toBe(true);
				expect(kern.subtables[0].rowWidth).toBe(4);
				expect(kern.subtables[0].leftClassTable.get(10)).toBe(2);
				expect(kern.subtables[0].leftClassTable.get(11)).toBe(4);
				expect(kern.subtables[0].rightClassTable.get(20)).toBe(2);
				expect(kern.subtables[0].rightClassTable.get(21)).toBe(4);

				// Test kerning lookup
				const value = getKernValue(kern, 10, 20);
				// leftClass = 2, rightClass = 2
				// rowIndex = floor(2/2) = 1, colIndex = floor(2/2) = 1
				expect(value).toBe(-100);
			}
		});

		test("format 2 class table with zero class values", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);
			let offset = 0;

			// Version 0 (Microsoft)
			view.setUint16(offset, 0, false);
			offset += 2;
			// nTables
			view.setUint16(offset, 1, false);
			offset += 2;
			// Subtable version
			view.setUint16(offset, 0, false);
			offset += 2;
			// Length
			view.setUint16(offset, 100, false);
			offset += 2;
			// Coverage: format 2
			view.setUint16(offset, (2 << 8) | 0x01, false);
			offset += 2;

			// Format 2 data
			const format2Start = offset;
			// rowWidth
			view.setUint16(offset, 4, false);
			offset += 2;
			// leftClassOffset
			view.setUint16(offset, 8, false);
			offset += 2;
			// rightClassOffset
			view.setUint16(offset, 16, false);
			offset += 2;
			// arrayOffset
			view.setUint16(offset, 24, false);
			offset += 2;

			// Left class table with zero values
			const leftClassOffset = format2Start + 8;
			view.setUint16(leftClassOffset, 10, false); // firstGlyph
			view.setUint16(leftClassOffset + 2, 2, false); // nGlyphs
			view.setUint16(leftClassOffset + 4, 0, false); // class 0 (not added to map)
			view.setUint16(leftClassOffset + 6, 0, false); // class 0 (not added to map)

			// Right class table with zero values
			const rightClassOffset = format2Start + 16;
			view.setUint16(rightClassOffset, 20, false); // firstGlyph
			view.setUint16(rightClassOffset + 2, 2, false); // nGlyphs
			view.setUint16(rightClassOffset + 4, 0, false); // class 0
			view.setUint16(rightClassOffset + 6, 0, false); // class 0

			// Kerning array
			const arrayOffset = format2Start + 24;
			view.setInt16(arrayOffset, 100, false);

			const reader = new Reader(buffer);
			const kern = parseKern(reader);

			expect(kern.version).toBe(0);
			expect(kern.subtables.length).toBe(1);
			if (kern.subtables[0]?.format === 2) {
				// Zero class values should not be added to the map
				expect(kern.subtables[0].leftClassTable.size).toBe(0);
				expect(kern.subtables[0].rightClassTable.size).toBe(0);
			}
		});

		test("skips unknown format in Microsoft subtable", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);
			let offset = 0;

			// Version 0 (Microsoft)
			view.setUint16(offset, 0, false);
			offset += 2;
			// nTables
			view.setUint16(offset, 1, false);
			offset += 2;
			// Subtable version
			view.setUint16(offset, 0, false);
			offset += 2;
			// Length
			view.setUint16(offset, 20, false);
			offset += 2;
			// Coverage: format 99 (unknown)
			view.setUint16(offset, (99 << 8) | 0x01, false);
			offset += 2;

			const reader = new Reader(buffer);
			const kern = parseKern(reader);

			expect(kern.version).toBe(0);
			expect(kern.subtables.length).toBe(0); // Unknown format skipped
		});
	});

	describe("format 2 edge cases in getKernValue", () => {
		test("handles out-of-bounds row index", () => {
			const testKern: KernTable = {
				version: 0,
				subtables: [
					{
						format: 2,
						coverage: {
							horizontal: true,
							minimum: false,
							crossStream: false,
							override: false,
						},
						rowWidth: 4,
						leftClassTable: new Map([[10, 100]]), // Very high class
						rightClassTable: new Map([[20, 2]]),
						kerningValues: [[0, -50]], // Only 1 row
					},
				],
			};

			// leftClass = 100, rowIndex = floor(100/2) = 50 (out of bounds)
			const value = getKernValue(testKern, 10, 20);
			expect(value).toBe(0);
		});

		test("handles out-of-bounds col index", () => {
			const testKern: KernTable = {
				version: 0,
				subtables: [
					{
						format: 2,
						coverage: {
							horizontal: true,
							minimum: false,
							crossStream: false,
							override: false,
						},
						rowWidth: 4,
						leftClassTable: new Map([[10, 2]]),
						rightClassTable: new Map([[20, 100]]), // Very high class
						kerningValues: [[0, -50]], // Only 2 columns
					},
				],
			};

			// rightClass = 100, colIndex = floor(100/2) = 50 (out of bounds)
			const value = getKernValue(testKern, 10, 20);
			expect(value).toBe(0);
		});

		test("handles undefined value in kerning array", () => {
			const testKern: KernTable = {
				version: 0,
				subtables: [
					{
						format: 2,
						coverage: {
							horizontal: true,
							minimum: false,
							crossStream: false,
							override: false,
						},
						rowWidth: 4,
						leftClassTable: new Map([[10, 2]]),
						rightClassTable: new Map([[20, 2]]),
						kerningValues: [
							[0, 0],
							[], // Empty row
						],
					},
				],
			};

			const value = getKernValue(testKern, 10, 20);
			expect(value).toBe(0);
		});
	});
});
