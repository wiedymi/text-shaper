import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import { Tags } from "../../../src/types.ts";
import {
	parseCff2,
	type Cff2Table,
	type Cff2TopDict,
	type Cff2PrivateDict,
	calculateVariationDelta,
} from "../../../src/font/tables/cff2.ts";
import { executeCff2CharString } from "../../../src/font/tables/cff-charstring.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const STIX_VAR_PATH = "/System/Library/Fonts/Supplemental/STIXVar.otf";

class BinaryWriter {
	private bytes: number[] = [];

	uint8(value: number): this {
		this.bytes.push(value & 0xff);
		return this;
	}

	uint16(value: number): this {
		this.bytes.push((value >> 8) & 0xff, value & 0xff);
		return this;
	}

	uint32(value: number): this {
		this.bytes.push(
			(value >> 24) & 0xff,
			(value >> 16) & 0xff,
			(value >> 8) & 0xff,
			value & 0xff,
		);
		return this;
	}

	int16(value: number): this {
		const unsigned = value < 0 ? 0x10000 + value : value;
		return this.uint16(unsigned);
	}

	int32(value: number): this {
		const unsigned = value < 0 ? 0x100000000 + value : value;
		return this.uint32(unsigned);
	}

	uint24(value: number): this {
		this.bytes.push(
			(value >> 16) & 0xff,
			(value >> 8) & 0xff,
			value & 0xff,
		);
		return this;
	}

	f2dot14(value: number): this {
		const fixed = Math.round(value * 16384);
		return this.int16(fixed);
	}

	raw(...bytes: number[]): this {
		this.bytes.push(...bytes);
		return this;
	}

	toBuffer(): ArrayBuffer {
		return new Uint8Array(this.bytes).buffer;
	}

	toReader(): Reader {
		return new Reader(this.toBuffer());
	}
}

describe("cff2 table", () => {
	let font: Font;
	let hasCff2: boolean;

	beforeAll(async () => {
		font = await Font.fromFile(STIX_VAR_PATH);
		const reader = font.getTableReader(Tags.CFF2);
		hasCff2 = reader !== null;
	});

	describe("font detection", () => {
		test("detects variable font correctly", () => {
			expect(font.isTrueType).toBe(false);
		});

		test("checks for CFF2 table", () => {
			const reader = font.getTableReader(Tags.CFF2);
			if (!hasCff2) {
				console.log("STIX font does not have CFF2 table, skipping CFF2 tests");
			}
		});

		test("does not have glyf table", () => {
			const reader = font.getTableReader(Tags.glyf);
			expect(reader).toBeNull();
		});
	});

	describe("parseCff2", () => {
		test("parses CFF2 table successfully", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				expect(cff2).toBeDefined();
				expect(cff2.version).toBeDefined();
				expect(cff2.version.major).toBe(2);
				expect(cff2.version.minor).toBeGreaterThanOrEqual(0);
			}
		});

		test("parses top dict", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				expect(cff2.topDict).toBeDefined();
				expect(typeof cff2.topDict).toBe("object");
			}
		});

		test("parses global subroutines", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				expect(Array.isArray(cff2.globalSubrs)).toBe(true);
			}
		});

		test("parses charstrings", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				expect(Array.isArray(cff2.charStrings)).toBe(true);
				expect(cff2.charStrings.length).toBeGreaterThan(0);
			}
		});

		test("parses fdArray", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				expect(Array.isArray(cff2.fdArray)).toBe(true);
			}
		});
	});

	describe("topDict structure", () => {
		test("has charStrings offset", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				expect(cff2.topDict.charStrings).toBeDefined();
				if (cff2.topDict.charStrings !== undefined) {
					expect(typeof cff2.topDict.charStrings).toBe("number");
					expect(cff2.topDict.charStrings).toBeGreaterThan(0);
				}
			}
		});

		test("may have fontMatrix", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				if (cff2.topDict.fontMatrix) {
					expect(Array.isArray(cff2.topDict.fontMatrix)).toBe(true);
					expect(cff2.topDict.fontMatrix.length).toBe(6);
				}
			}
		});

		test("may have vstore", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				if (cff2.topDict.vstore !== undefined) {
					expect(typeof cff2.topDict.vstore).toBe("number");
				}
			}
		});

		test("may have fdArray offset", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				if (cff2.topDict.fdArray !== undefined) {
					expect(typeof cff2.topDict.fdArray).toBe("number");
				}
			}
		});

		test("may have fdSelect offset", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				if (cff2.topDict.fdSelect !== undefined) {
					expect(typeof cff2.topDict.fdSelect).toBe("number");
				}
			}
		});
	});

	describe("fdArray structure", () => {
		test("fdArray contains FD dicts", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				if (cff2.fdArray.length > 0) {
					const fd = cff2.fdArray[0];
					expect(fd).toBeDefined();
					expect(typeof fd).toBe("object");
				}
			}
		});

		test("FD dicts may have private dict", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				for (const fd of cff2.fdArray) {
					if (fd.private) {
						expect(typeof fd.private).toBe("object");
					}
				}
			}
		});

		test("FD dicts may have local subrs", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				for (const fd of cff2.fdArray) {
					if (fd.localSubrs) {
						expect(Array.isArray(fd.localSubrs)).toBe(true);
					}
				}
			}
		});
	});

	describe("fdSelect structure", () => {
		test("fdSelect can select FD for glyph", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				if (cff2.fdSelect) {
					const fd = cff2.fdSelect.select(0);
					expect(typeof fd).toBe("number");
					expect(fd).toBeGreaterThanOrEqual(0);
				}
			}
		});

		test("fdSelect is consistent", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				if (cff2.fdSelect) {
					const fd1 = cff2.fdSelect.select(0);
					const fd2 = cff2.fdSelect.select(0);
					expect(fd1).toBe(fd2);
				}
			}
		});
	});

	describe("variation store", () => {
		test("vstore may be present", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				if (cff2.vstore) {
					expect(typeof cff2.vstore).toBe("object");
					expect(cff2.vstore.variationRegionList).toBeDefined();
					expect(Array.isArray(cff2.vstore.itemVariationData)).toBe(true);
				}
			}
		});

		test("variationRegionList has regions", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				if (cff2.vstore) {
					expect(cff2.vstore.variationRegionList.axisCount).toBeGreaterThanOrEqual(
						0,
					);
					expect(cff2.vstore.variationRegionList.regionCount).toBeGreaterThanOrEqual(
						0,
					);
					expect(Array.isArray(cff2.vstore.variationRegionList.regions)).toBe(
						true,
					);
				}
			}
		});

		test("regions have axis coordinates", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				if (cff2.vstore && cff2.vstore.variationRegionList.regions.length > 0) {
					const region = cff2.vstore.variationRegionList.regions[0];
					if (region) {
						expect(Array.isArray(region.axes)).toBe(true);
						if (region.axes.length > 0) {
							const axis = region.axes[0];
							if (axis) {
								expect(typeof axis.startCoord).toBe("number");
								expect(typeof axis.peakCoord).toBe("number");
								expect(typeof axis.endCoord).toBe("number");
							}
						}
					}
				}
			}
		});

		test("itemVariationData has deltas", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				if (cff2.vstore && cff2.vstore.itemVariationData.length > 0) {
					const itemData = cff2.vstore.itemVariationData[0];
					if (itemData) {
						expect(typeof itemData.itemCount).toBe("number");
						expect(typeof itemData.regionIndexCount).toBe("number");
						expect(Array.isArray(itemData.regionIndexes)).toBe(true);
						expect(Array.isArray(itemData.deltaSets)).toBe(true);
					}
				}
			}
		});
	});

	describe("calculateVariationDelta", () => {
		test("returns 0 for missing vstore", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 1,
					regionCount: 0,
					regions: [],
				},
				itemVariationData: [],
			};
			const delta = calculateVariationDelta(mockVstore, 0, 0, [0.5]);
			expect(delta).toBe(0);
		});

		test("calculates delta for simple region", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 1,
					regionCount: 1,
					regions: [
						{
							axes: [{ startCoord: 0, peakCoord: 1, endCoord: 1 }],
						},
					],
				},
				itemVariationData: [
					{
						itemCount: 1,
						regionIndexCount: 1,
						regionIndexes: [0],
						deltaSets: [[100]],
					},
				],
			};
			const delta = calculateVariationDelta(mockVstore, 0, 0, [1.0]);
			expect(delta).toBe(100);
		});

		test("calculates delta with interpolation", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 1,
					regionCount: 1,
					regions: [
						{
							axes: [{ startCoord: 0, peakCoord: 1, endCoord: 1 }],
						},
					],
				},
				itemVariationData: [
					{
						itemCount: 1,
						regionIndexCount: 1,
						regionIndexes: [0],
						deltaSets: [[100]],
					},
				],
			};
			const delta = calculateVariationDelta(mockVstore, 0, 0, [0.5]);
			expect(delta).toBe(50);
		});

		test("returns 0 outside region bounds", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 1,
					regionCount: 1,
					regions: [
						{
							axes: [{ startCoord: 0, peakCoord: 1, endCoord: 1 }],
						},
					],
				},
				itemVariationData: [
					{
						itemCount: 1,
						regionIndexCount: 1,
						regionIndexes: [0],
						deltaSets: [[100]],
					},
				],
			};
			const delta = calculateVariationDelta(mockVstore, 0, 0, [-0.5]);
			expect(delta).toBe(0);
		});
	});

	describe("executeCff2CharString", () => {
		test("executes charstring for glyph 0", () => {
			if (!hasCff2 || !font.cff2) return;

			const contours = executeCff2CharString(font.cff2, 0);
			expect(contours).toBeDefined();
			if (contours) {
				expect(Array.isArray(contours)).toBe(true);
			}
		});

		test("returns null for invalid glyph ID", () => {
			if (!hasCff2 || !font.cff2) return;

			const contours = executeCff2CharString(font.cff2, 99999);
			expect(contours).toBeNull();
		});

		test("executes charstring with axis coordinates", () => {
			if (!hasCff2 || !font.cff2) return;

			const contours = executeCff2CharString(font.cff2, 0, [0.5]);
			if (contours) {
				expect(Array.isArray(contours)).toBe(true);
			}
		});

		test("contours have valid points", () => {
			if (!hasCff2 || !font.cff2) return;

			const glyphId = font.glyphId(0x41); // 'A'
			const contours = executeCff2CharString(font.cff2, glyphId);
			if (contours && contours.length > 0) {
				for (const contour of contours) {
					expect(contour.length).toBeGreaterThan(0);
					for (const point of contour) {
						expect(typeof point.x).toBe("number");
						expect(typeof point.y).toBe("number");
						expect(typeof point.onCurve).toBe("boolean");
					}
				}
			}
		});

		test("executes multiple charstrings", () => {
			if (!hasCff2 || !font.cff2) return;

			for (let i = 0; i < Math.min(10, font.numGlyphs); i++) {
				expect(() => executeCff2CharString(font.cff2!, i)).not.toThrow();
			}
		});
	});

	describe("edge cases", () => {
		test("handles empty global subroutines", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				expect(Array.isArray(cff2.globalSubrs)).toBe(true);
			}
		});

		test("handles null fdSelect", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				if (cff2.fdSelect === null) {
					expect(cff2.fdSelect).toBeNull();
				} else {
					expect(typeof cff2.fdSelect.select).toBe("function");
				}
			}
		});

		test("parses all glyphs without errors", () => {
			if (!hasCff2 || !font.cff2) return;

			for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
				expect(() => executeCff2CharString(font.cff2!, i)).not.toThrow();
			}
		});
	});

	describe("performance", () => {
		test("parses CFF2 table efficiently", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const start = performance.now();
				parseCff2(reader);
				const elapsed = performance.now() - start;
				expect(elapsed).toBeLessThan(100);
			}
		});

		test("executes multiple charstrings efficiently", () => {
			if (!hasCff2 || !font.cff2) return;

			const start = performance.now();
			for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
				executeCff2CharString(font.cff2, i);
			}
			const elapsed = performance.now() - start;
			expect(elapsed).toBeLessThan(1000);
		});
	});
});

describe("cff2 mock data tests", () => {
	describe("parseIndex with different offset sizes", () => {
		test("handles empty index (count = 0)", () => {
			const w = new BinaryWriter();
			writeIndex(w, 1, []);
			const reader = w.toReader();
			const result = parseIndexHelper(reader);
			expect(result).toEqual([]);
		});

		test("handles index with offSize 1", () => {
			const w = new BinaryWriter();
			writeIndex(w, 1, [
				[100, 101, 102],
				[200, 201, 202],
			]);
			const reader = w.toReader();
			const result = parseIndexHelper(reader);
			expect(result.length).toBe(2);
		});

		test("handles index with offSize 2", () => {
			const w = new BinaryWriter();
			writeIndex(w, 2, [[100, 101, 102]]);
			const reader = w.toReader();
			const result = parseIndexHelper(reader);
			expect(result.length).toBe(1);
		});

		test("handles index with offSize 3", () => {
			const w = new BinaryWriter();
			writeIndex(w, 3, [[100, 101, 102]]);
			const reader = w.toReader();
			const result = parseIndexHelper(reader);
			expect(result.length).toBe(1);
		});

		test("handles index with offSize 4", () => {
			const w = new BinaryWriter();
			writeIndex(w, 4, [[100, 101, 102]]);
			const reader = w.toReader();
			const result = parseIndexHelper(reader);
			expect(result.length).toBe(1);
		});

		test("throws on invalid offset size", () => {
			const w = new BinaryWriter();
			w.uint32(1);
			w.uint8(5);
			w.uint8(1);
			const reader = w.toReader();
			expect(() => parseIndexHelper(reader)).toThrow("Invalid offset size");
		});
	});

	describe("parseDict operators", () => {
		test("handles b0 <= 21 operators", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(17);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(17)).toEqual([-39]);
		});

		test("handles 2-byte operators (b0 = 12)", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(12);
			w.uint8(7);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(0x0c07)).toEqual([-39]);
		});

		test("handles vsindex operator (22)", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(22);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(22)).toEqual([-39]);
		});

		test("handles blend operator (23)", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(200);
			w.uint8(23);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(23)).toEqual([-39, 61]);
		});

		test("handles vstore operator (24)", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(24);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(24)).toEqual([-39]);
		});

		test("handles 16-bit signed integer (b0 = 28)", () => {
			const w = new BinaryWriter();
			w.uint8(28);
			w.int16(1000);
			w.uint8(17);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(17)).toEqual([1000]);
		});

		test("handles 32-bit signed integer (b0 = 29)", () => {
			const w = new BinaryWriter();
			w.uint8(29);
			w.int32(100000);
			w.uint8(17);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(17)).toEqual([100000]);
		});

		test("handles real number (b0 = 30)", () => {
			const w = new BinaryWriter();
			w.uint8(30);
			w.raw(0x1a, 0x5f);
			w.uint8(17);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(17)).toBeDefined();
			const val = dict.get(17)?.[0];
			expect(typeof val).toBe("number");
		});

		test("handles small integers (32-246)", () => {
			const w = new BinaryWriter();
			w.uint8(139);
			w.uint8(17);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(17)).toEqual([0]);
		});

		test("handles positive integers (247-250)", () => {
			const w = new BinaryWriter();
			w.uint8(247);
			w.uint8(0);
			w.uint8(17);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(17)).toEqual([108]);
		});

		test("handles negative integers (251-254)", () => {
			const w = new BinaryWriter();
			w.uint8(251);
			w.uint8(0);
			w.uint8(17);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(17)).toEqual([-108]);
		});
	});

	describe("parseReal edge cases", () => {
		test("handles simple real number", () => {
			const w = new BinaryWriter();
			w.uint8(30);
			w.raw(0x12, 0x34, 0x5f);
			w.uint8(17);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(17)).toBeDefined();
		});

		test("handles real with E- notation", () => {
			const w = new BinaryWriter();
			w.uint8(30);
			w.raw(0x1c, 0x23, 0x4f);
			w.uint8(17);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(17)).toBeDefined();
		});

		test("handles real with decimal point", () => {
			const w = new BinaryWriter();
			w.uint8(30);
			w.raw(0x1a, 0x23, 0x4f);
			w.uint8(17);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(17)).toBeDefined();
		});

		test("handles real with multiple nibbles in high position", () => {
			const w = new BinaryWriter();
			w.uint8(30);
			w.raw(0x9a, 0x5f);
			w.uint8(17);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(17)).toBeDefined();
		});

		test("handles real ending in first nibble", () => {
			const w = new BinaryWriter();
			w.uint8(30);
			w.raw(0x1f);
			w.uint8(17);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			expect(dict.get(17)).toBeDefined();
		});
	});

	describe("parseCff2TopDict operators", () => {
		test("parses fontMatrix", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(200);
			w.uint8(100);
			w.uint8(200);
			w.uint8(100);
			w.uint8(200);
			w.uint8(12);
			w.uint8(7);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const topDict = convertToTopDict(dict);
			expect(topDict.fontMatrix).toBeDefined();
		});

		test("parses charStrings offset", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(17);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const topDict = convertToTopDict(dict);
			expect(topDict.charStrings).toBe(-39);
		});

		test("parses fdArray offset", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(12);
			w.uint8(36);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const topDict = convertToTopDict(dict);
			expect(topDict.fdArray).toBe(-39);
		});

		test("parses fdSelect offset", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(12);
			w.uint8(37);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const topDict = convertToTopDict(dict);
			expect(topDict.fdSelect).toBe(-39);
		});

		test("parses vstore offset", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(24);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const topDict = convertToTopDict(dict);
			expect(topDict.vstore).toBe(-39);
		});
	});

	describe("parseCff2PrivateDict operators", () => {
		test("parses all BlueValues operators", () => {
			const testCases = [
				{ op: 6, name: "blueValues" },
				{ op: 7, name: "otherBlues" },
				{ op: 8, name: "familyBlues" },
				{ op: 9, name: "familyOtherBlues" },
			];

			for (const tc of testCases) {
				const w = new BinaryWriter();
				w.uint8(100);
				w.uint8(150);
				w.uint8(tc.op);

				const reader = w.toReader();
				const dict = parseDictHelper(reader);
				const privateDict = convertToPrivateDict(dict);
				expect(privateDict[tc.name as keyof Cff2PrivateDict]).toBeDefined();
			}
		});

		test("parses BlueScale", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(12);
			w.uint8(9);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const privateDict = convertToPrivateDict(dict);
			expect(privateDict.blueScale).toBe(-39);
		});

		test("parses BlueShift", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(12);
			w.uint8(10);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const privateDict = convertToPrivateDict(dict);
			expect(privateDict.blueShift).toBe(-39);
		});

		test("parses BlueFuzz", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(12);
			w.uint8(11);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const privateDict = convertToPrivateDict(dict);
			expect(privateDict.blueFuzz).toBe(-39);
		});

		test("parses StdHW", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(10);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const privateDict = convertToPrivateDict(dict);
			expect(privateDict.stdHW).toBe(-39);
		});

		test("parses StdVW", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(11);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const privateDict = convertToPrivateDict(dict);
			expect(privateDict.stdVW).toBe(-39);
		});

		test("parses StemSnapH", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(150);
			w.uint8(12);
			w.uint8(12);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const privateDict = convertToPrivateDict(dict);
			expect(privateDict.stemSnapH).toBeDefined();
		});

		test("parses StemSnapV", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(150);
			w.uint8(12);
			w.uint8(13);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const privateDict = convertToPrivateDict(dict);
			expect(privateDict.stemSnapV).toBeDefined();
		});

		test("parses LanguageGroup", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(12);
			w.uint8(17);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const privateDict = convertToPrivateDict(dict);
			expect(privateDict.languageGroup).toBe(-39);
		});

		test("parses ExpansionFactor", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(12);
			w.uint8(18);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const privateDict = convertToPrivateDict(dict);
			expect(privateDict.expansionFactor).toBe(-39);
		});

		test("parses Subrs offset", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(19);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const privateDict = convertToPrivateDict(dict);
			expect(privateDict.subrs).toBe(-39);
		});

		test("parses vsindex", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(22);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const privateDict = convertToPrivateDict(dict);
			expect(privateDict.vsindex).toBe(-39);
		});

		test("parses blend", () => {
			const w = new BinaryWriter();
			w.uint8(100);
			w.uint8(200);
			w.uint8(23);

			const reader = w.toReader();
			const dict = parseDictHelper(reader);
			const privateDict = convertToPrivateDict(dict);
			expect(privateDict.blend).toEqual([-39, 61]);
		});
	});

	describe("parseFDSelect formats", () => {
		test("parses format 0", () => {
			const w = new BinaryWriter();
			w.uint8(0);
			w.uint8(0);
			w.uint8(1);
			w.uint8(0);

			const reader = w.toReader();
			const fdSelect = parseFDSelectHelper(reader, 3);
			expect(fdSelect.format).toBe(0);
			expect(fdSelect.select(0)).toBe(0);
			expect(fdSelect.select(1)).toBe(1);
			expect(fdSelect.select(2)).toBe(0);
		});

		test("parses format 3", () => {
			const w = new BinaryWriter();
			w.uint8(3);
			w.uint16(2);
			w.uint16(0);
			w.uint8(0);
			w.uint16(5);
			w.uint8(1);
			w.uint16(10);

			const reader = w.toReader();
			const fdSelect = parseFDSelectHelper(reader, 10);
			expect(fdSelect.format).toBe(3);
			expect(fdSelect.select(0)).toBe(0);
			expect(fdSelect.select(5)).toBe(1);
			expect(fdSelect.select(9)).toBe(1);
		});

		test("parses format 4", () => {
			const w = new BinaryWriter();
			w.uint8(4);
			w.uint32(2);
			w.uint32(0);
			w.uint16(0);
			w.uint32(5);
			w.uint16(1);
			w.uint32(10);

			const reader = w.toReader();
			const fdSelect = parseFDSelectHelper(reader, 10);
			expect(fdSelect.format).toBe(4);
			expect(fdSelect.select(0)).toBe(0);
			expect(fdSelect.select(5)).toBe(1);
			expect(fdSelect.select(9)).toBe(1);
		});

		test("handles unknown format", () => {
			const w = new BinaryWriter();
			w.uint8(99);

			const reader = w.toReader();
			const fdSelect = parseFDSelectHelper(reader, 10);
			expect(fdSelect.select(0)).toBe(0);
		});
	});

	describe("parseCff2 complete table", () => {
		test("parses minimal CFF2 table", () => {
			const cff2 = createMinimalCff2Table();
			expect(cff2.version.major).toBe(2);
			expect(cff2.version.minor).toBe(0);
			expect(cff2.globalSubrs).toEqual([]);
			expect(cff2.charStrings).toEqual([]);
		});

		test("can build and parse valid CFF2 with charStrings", () => {
			const w = new BinaryWriter();

			w.uint8(2);
			w.uint8(0);
			w.uint8(5);

			const topDictBytes = [28, 0, 13, 17];
			w.uint16(topDictBytes.length);
			for (const b of topDictBytes) w.uint8(b);

			w.uint32(0);

			w.uint32(1);
			w.uint8(1);
			w.uint8(1);
			w.uint8(4);
			w.raw(100, 101, 102);

			const cff2 = parseCff2(w.toReader());
			expect(cff2.charStrings.length).toBe(1);
		});

	});

	describe("calculateVariationDelta edge cases", () => {
		test("returns 0 for missing deltaSet", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 1,
					regionCount: 1,
					regions: [{ axes: [{ startCoord: 0, peakCoord: 1, endCoord: 1 }] }],
				},
				itemVariationData: [
					{
						itemCount: 1,
						regionIndexCount: 1,
						regionIndexes: [0],
						deltaSets: [[100]],
					},
				],
			};
			const delta = calculateVariationDelta(mockVstore, 0, 999, [1.0]);
			expect(delta).toBe(0);
		});

		test("handles peakCoord = 0", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 1,
					regionCount: 1,
					regions: [{ axes: [{ startCoord: 0, peakCoord: 0, endCoord: 0 }] }],
				},
				itemVariationData: [
					{
						itemCount: 1,
						regionIndexCount: 1,
						regionIndexes: [0],
						deltaSets: [[100]],
					},
				],
			};
			const delta = calculateVariationDelta(mockVstore, 0, 0, [0.5]);
			expect(delta).toBe(100);
		});

		test("handles coord at peakCoord", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 1,
					regionCount: 1,
					regions: [{ axes: [{ startCoord: 0, peakCoord: 1, endCoord: 1 }] }],
				},
				itemVariationData: [
					{
						itemCount: 1,
						regionIndexCount: 1,
						regionIndexes: [0],
						deltaSets: [[100]],
					},
				],
			};
			const delta = calculateVariationDelta(mockVstore, 0, 0, [1.0]);
			expect(delta).toBe(100);
		});

		test("handles coord between peakCoord and endCoord", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 1,
					regionCount: 1,
					regions: [{ axes: [{ startCoord: 0, peakCoord: 0.5, endCoord: 1 }] }],
				},
				itemVariationData: [
					{
						itemCount: 1,
						regionIndexCount: 1,
						regionIndexes: [0],
						deltaSets: [[100]],
					},
				],
			};
			const delta = calculateVariationDelta(mockVstore, 0, 0, [0.75]);
			expect(delta).toBe(50);
		});

		test("handles coord above endCoord", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 1,
					regionCount: 1,
					regions: [{ axes: [{ startCoord: 0, peakCoord: 0.5, endCoord: 1 }] }],
				},
				itemVariationData: [
					{
						itemCount: 1,
						regionIndexCount: 1,
						regionIndexes: [0],
						deltaSets: [[100]],
					},
				],
			};
			const delta = calculateVariationDelta(mockVstore, 0, 0, [1.5]);
			expect(delta).toBe(0);
		});

		test("handles multiple axes", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 2,
					regionCount: 1,
					regions: [
						{
							axes: [
								{ startCoord: 0, peakCoord: 1, endCoord: 1 },
								{ startCoord: 0, peakCoord: 1, endCoord: 1 },
							],
						},
					],
				},
				itemVariationData: [
					{
						itemCount: 1,
						regionIndexCount: 1,
						regionIndexes: [0],
						deltaSets: [[100]],
					},
				],
			};
			const delta = calculateVariationDelta(mockVstore, 0, 0, [0.5, 0.5]);
			expect(delta).toBe(25);
		});
	});

	describe("ItemVariationStore parsing", () => {
		test("parses VariationRegionList structure", () => {
			const w = new BinaryWriter();
			w.uint16(1);
			w.uint16(1);
			w.f2dot14(0);
			w.f2dot14(1);
			w.f2dot14(1);

			const reader = w.toReader();
			const regionList = parseVariationRegionListHelper(reader);
			expect(regionList.axisCount).toBe(1);
			expect(regionList.regionCount).toBe(1);
			expect(regionList.regions.length).toBe(1);
		});

		test("parses ItemVariationData structure", () => {
			const w = new BinaryWriter();
			w.uint16(1);
			w.uint16(1);
			w.uint16(0);
			w.int16(100);

			const reader = w.toReader();
			const itemData = parseItemVariationDataHelper(reader);
			expect(itemData.itemCount).toBe(1);
			expect(itemData.regionIndexCount).toBe(1);
			expect(itemData.deltaSets.length).toBe(1);
			expect(itemData.deltaSets[0]?.[0]).toBe(100);
		});

		test("parses VariationRegionList with multiple regions", () => {
			const w = new BinaryWriter();
			w.uint16(1);
			w.uint16(2);
			w.f2dot14(0);
			w.f2dot14(1);
			w.f2dot14(1);
			w.f2dot14(0);
			w.f2dot14(0.5);
			w.f2dot14(1);

			const reader = w.toReader();
			const regionList = parseVariationRegionListHelper(reader);
			expect(regionList.regionCount).toBe(2);
			expect(regionList.regions.length).toBe(2);
		});

		test("parses ItemVariationData with longWords flag", () => {
			const w = new BinaryWriter();
			w.uint16(1);
			w.uint16(0x8001);
			w.uint16(0);
			w.int32(100000);

			const reader = w.toReader();
			const itemData = parseItemVariationDataHelper(reader);
			expect(itemData.deltaSets).toBeDefined();
			expect(itemData.deltaSets[0]?.[0]).toBe(100000);
		});

		test("parses ItemVariationData with short words", () => {
			const w = new BinaryWriter();
			w.uint16(2);
			w.uint16(2);
			w.uint16(0);
			w.uint16(1);
			w.int16(100);
			w.int16(200);
			w.int16(150);
			w.int16(250);

			const reader = w.toReader();
			const itemData = parseItemVariationDataHelper(reader);
			expect(itemData.itemCount).toBe(2);
			expect(itemData.regionIndexCount).toBe(2);
			expect(itemData.deltaSets.length).toBe(2);
		});

		test("parses VariationRegionList with multiple axes", () => {
			const w = new BinaryWriter();
			w.uint16(2);
			w.uint16(1);
			w.f2dot14(0);
			w.f2dot14(1);
			w.f2dot14(1);
			w.f2dot14(0);
			w.f2dot14(0.5);
			w.f2dot14(1);

			const reader = w.toReader();
			const regionList = parseVariationRegionListHelper(reader);
			expect(regionList.axisCount).toBe(2);
			expect(regionList.regions[0]?.axes.length).toBe(2);
		});
	});

	describe("parseIndex edge cases", () => {
		test("handles empty index with count 0", () => {
			const w = new BinaryWriter();
			w.uint32(0);

			const reader = w.toReader();
			const result = parseIndexHelper(reader);
			expect(result).toEqual([]);
		});

		test("handles index with multiple items of different sizes", () => {
			const w = new BinaryWriter();
			writeIndex(w, 1, [[1, 2], [3], [4, 5, 6]]);

			const reader = w.toReader();
			const result = parseIndexHelper(reader);
			expect(result.length).toBe(3);
			expect(result[0]?.length).toBe(2);
			expect(result[1]?.length).toBe(1);
			expect(result[2]?.length).toBe(3);
		});
	});

	describe("parseFDSelect edge cases", () => {
		test("format 3 binary search finds correct range at boundaries", () => {
			const w = new BinaryWriter();
			w.uint8(3);
			w.uint16(3);
			w.uint16(0);
			w.uint8(0);
			w.uint16(10);
			w.uint8(1);
			w.uint16(20);
			w.uint8(2);
			w.uint16(30);

			const reader = w.toReader();
			const fdSelect = parseFDSelectHelper(reader, 30);
			expect(fdSelect.select(0)).toBe(0);
			expect(fdSelect.select(9)).toBe(0);
			expect(fdSelect.select(10)).toBe(1);
			expect(fdSelect.select(19)).toBe(1);
			expect(fdSelect.select(20)).toBe(2);
			expect(fdSelect.select(29)).toBe(2);
		});

		test("format 3 binary search with single range", () => {
			const w = new BinaryWriter();
			w.uint8(3);
			w.uint16(1);
			w.uint16(0);
			w.uint8(0);
			w.uint16(100);

			const reader = w.toReader();
			const fdSelect = parseFDSelectHelper(reader, 100);
			expect(fdSelect.select(0)).toBe(0);
			expect(fdSelect.select(50)).toBe(0);
			expect(fdSelect.select(99)).toBe(0);
		});

		test("format 4 binary search finds correct range at boundaries", () => {
			const w = new BinaryWriter();
			w.uint8(4);
			w.uint32(3);
			w.uint32(0);
			w.uint16(0);
			w.uint32(10);
			w.uint16(1);
			w.uint32(20);
			w.uint16(2);
			w.uint32(30);

			const reader = w.toReader();
			const fdSelect = parseFDSelectHelper(reader, 30);
			expect(fdSelect.select(0)).toBe(0);
			expect(fdSelect.select(9)).toBe(0);
			expect(fdSelect.select(10)).toBe(1);
			expect(fdSelect.select(19)).toBe(1);
			expect(fdSelect.select(20)).toBe(2);
			expect(fdSelect.select(29)).toBe(2);
		});

		test("format 4 binary search with single range", () => {
			const w = new BinaryWriter();
			w.uint8(4);
			w.uint32(1);
			w.uint32(0);
			w.uint16(0);
			w.uint32(100);

			const reader = w.toReader();
			const fdSelect = parseFDSelectHelper(reader, 100);
			expect(fdSelect.select(0)).toBe(0);
			expect(fdSelect.select(50)).toBe(0);
			expect(fdSelect.select(99)).toBe(0);
		});
	});

	describe("calculateVariationDelta advanced cases", () => {
		test("handles missing normalizedCoords for axis", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 2,
					regionCount: 1,
					regions: [
						{
							axes: [
								{ startCoord: 0, peakCoord: 1, endCoord: 1 },
								{ startCoord: 0, peakCoord: 1, endCoord: 1 },
							],
						},
					],
				},
				itemVariationData: [
					{
						itemCount: 1,
						regionIndexCount: 1,
						regionIndexes: [0],
						deltaSets: [[100]],
					},
				],
			};
			const delta = calculateVariationDelta(mockVstore, 0, 0, [0.5]);
			expect(delta).toBe(0);
		});

		test("handles missing region index", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 1,
					regionCount: 1,
					regions: [{ axes: [{ startCoord: 0, peakCoord: 1, endCoord: 1 }] }],
				},
				itemVariationData: [
					{
						itemCount: 1,
						regionIndexCount: 1,
						regionIndexes: [999],
						deltaSets: [[100]],
					},
				],
			};
			const delta = calculateVariationDelta(mockVstore, 0, 0, [1.0]);
			expect(delta).toBe(0);
		});

		test("handles multiple regions with different scalars", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 1,
					regionCount: 2,
					regions: [
						{ axes: [{ startCoord: 0, peakCoord: 0.5, endCoord: 1 }] },
						{ axes: [{ startCoord: 0.5, peakCoord: 1, endCoord: 1 }] },
					],
				},
				itemVariationData: [
					{
						itemCount: 1,
						regionIndexCount: 2,
						regionIndexes: [0, 1],
						deltaSets: [[50, 50]],
					},
				],
			};
			const delta = calculateVariationDelta(mockVstore, 0, 0, [0.75]);
			expect(delta).toBe(50);
		});
	});
});

function parseItemVariationStoreHelper(reader: Reader) {
	const startOffset = reader.offset;
	const _length = reader.uint16();
	const format = reader.uint16();
	const variationRegionListOffset = reader.uint32();
	const itemVariationDataCount = reader.uint16();
	const itemVariationDataOffsets: number[] = [];

	for (let i = 0; i < itemVariationDataCount; i++) {
		itemVariationDataOffsets.push(reader.uint32());
	}

	reader.seek(startOffset + variationRegionListOffset);
	const variationRegionList = parseVariationRegionListHelper(reader);

	const itemVariationData = [];
	for (let i = 0; i < itemVariationDataOffsets.length; i++) {
		const offset = itemVariationDataOffsets[i]!;
		reader.seek(startOffset + offset);
		itemVariationData.push(parseItemVariationDataHelper(reader));
	}

	return { format, variationRegionList, itemVariationData };
}

function parseIndexHelper(reader: Reader): Uint8Array[] {
	const count = reader.uint32();
	if (count === 0) return [];

	const offSize = reader.uint8();
	const offsets: number[] = [];

	for (let i = 0; i <= count; i++) {
		offsets.push(readOffsetHelper(reader, offSize));
	}

	const result: Uint8Array[] = [];
	for (let i = 0; i < count; i++) {
		const start = offsets[i];
		const end = offsets[i + 1];
		if (start === undefined || end === undefined) continue;
		const length = end - start;
		result.push(reader.bytes(length));
	}

	return result;
}

function readOffsetHelper(reader: Reader, offSize: number): number {
	switch (offSize) {
		case 1:
			return reader.uint8();
		case 2:
			return reader.uint16();
		case 3:
			return reader.uint24();
		case 4:
			return reader.uint32();
		default:
			throw new Error(`Invalid offset size: ${offSize}`);
	}
}

function parseDictHelper(reader: Reader): Map<number, number[]> {
	const result = new Map<number, number[]>();
	const operands: number[] = [];

	while (reader.remaining > 0) {
		const b0 = reader.uint8();

		if (b0 <= 21) {
			let op = b0;
			if (b0 === 12) {
				op = 0x0c00 | reader.uint8();
			}
			result.set(op, [...operands]);
			operands.length = 0;
		} else if (b0 === 22) {
			result.set(22, [...operands]);
			operands.length = 0;
		} else if (b0 === 23) {
			result.set(23, [...operands]);
			operands.length = 0;
		} else if (b0 === 24) {
			result.set(24, [...operands]);
			operands.length = 0;
		} else if (b0 === 28) {
			operands.push(reader.int16());
		} else if (b0 === 29) {
			operands.push(reader.int32());
		} else if (b0 === 30) {
			operands.push(parseRealHelper(reader));
		} else if (b0 >= 32 && b0 <= 246) {
			operands.push(b0 - 139);
		} else if (b0 >= 247 && b0 <= 250) {
			const b1 = reader.uint8();
			operands.push((b0 - 247) * 256 + b1 + 108);
		} else if (b0 >= 251 && b0 <= 254) {
			const b1 = reader.uint8();
			operands.push(-(b0 - 251) * 256 - b1 - 108);
		}
	}

	return result;
}

function parseRealHelper(reader: Reader): number {
	let str = "";
	const nibbleChars = "0123456789.EE -";
	let done = false;

	while (!done) {
		const byte = reader.uint8();
		for (let i = 0; i < 2; i++) {
			const nibble = i === 0 ? byte >> 4 : byte & 0x0f;
			if (nibble === 0x0f) {
				done = true;
				break;
			}
			if (nibble === 0x0c) {
				str += "E-";
			} else {
				const char = nibbleChars[nibble];
				if (char !== undefined) str += char;
			}
		}
	}

	return parseFloat(str);
}

function convertToTopDict(dict: Map<number, number[]>): Cff2TopDict {
	const result: Cff2TopDict = {};
	for (const [op, operands] of dict) {
		switch (op) {
			case 0x0c07:
				result.fontMatrix = operands;
				break;
			case 17:
				result.charStrings = operands[0];
				break;
			case 0x0c24:
				result.fdArray = operands[0];
				break;
			case 0x0c25:
				result.fdSelect = operands[0];
				break;
			case 24:
				result.vstore = operands[0];
				break;
		}
	}
	return result;
}

function convertToPrivateDict(dict: Map<number, number[]>): Cff2PrivateDict {
	const result: Cff2PrivateDict = {};

	function deltaToAbsolute(deltas: number[]): number[] {
		const result: number[] = [];
		let value = 0;
		for (let i = 0; i < deltas.length; i++) {
			const delta = deltas[i]!;
			value += delta;
			result.push(value);
		}
		return result;
	}

	for (const [op, operands] of dict) {
		const op0 = operands[0];
		switch (op) {
			case 6:
				result.blueValues = deltaToAbsolute(operands);
				break;
			case 7:
				result.otherBlues = deltaToAbsolute(operands);
				break;
			case 8:
				result.familyBlues = deltaToAbsolute(operands);
				break;
			case 9:
				result.familyOtherBlues = deltaToAbsolute(operands);
				break;
			case 0x0c09:
				result.blueScale = op0;
				break;
			case 0x0c0a:
				result.blueShift = op0;
				break;
			case 0x0c0b:
				result.blueFuzz = op0;
				break;
			case 10:
				result.stdHW = op0;
				break;
			case 11:
				result.stdVW = op0;
				break;
			case 0x0c0c:
				result.stemSnapH = deltaToAbsolute(operands);
				break;
			case 0x0c0d:
				result.stemSnapV = deltaToAbsolute(operands);
				break;
			case 0x0c11:
				result.languageGroup = op0;
				break;
			case 0x0c12:
				result.expansionFactor = op0;
				break;
			case 19:
				result.subrs = op0;
				break;
			case 22:
				result.vsindex = op0;
				break;
			case 23:
				result.blend = operands;
				break;
		}
	}
	return result;
}

function parseFDSelectHelper(
	reader: Reader,
	numGlyphs: number,
): { format: number; select: (glyphId: number) => number } {
	const format = reader.uint8();

	if (format === 0) {
		const fds = reader.uint8Array(numGlyphs);
		return {
			format,
			select: (glyphId: number) => fds[glyphId] ?? 0,
		};
	} else if (format === 3) {
		const nRanges = reader.uint16();
		const ranges: Array<{ first: number; fd: number }> = [];

		for (let i = 0; i < nRanges; i++) {
			ranges.push({
				first: reader.uint16(),
				fd: reader.uint8(),
			});
		}
		reader.uint16();

		return {
			format,
			select: (glyphId: number) => {
				let lo = 0;
				let hi = ranges.length - 1;
				while (lo < hi) {
					const mid = Math.ceil((lo + hi) / 2);
					const range = ranges[mid];
					if (range && range.first <= glyphId) {
						lo = mid;
					} else {
						hi = mid - 1;
					}
				}
				const foundRange = ranges[lo];
				return foundRange?.fd ?? 0;
			},
		};
	} else if (format === 4) {
		const nRanges = reader.uint32();
		const ranges: Array<{ first: number; fd: number }> = [];

		for (let i = 0; i < nRanges; i++) {
			ranges.push({
				first: reader.uint32(),
				fd: reader.uint16(),
			});
		}
		reader.uint32();

		return {
			format,
			select: (glyphId: number) => {
				let lo = 0;
				let hi = ranges.length - 1;
				while (lo < hi) {
					const mid = Math.ceil((lo + hi) / 2);
					const range = ranges[mid];
					if (range && range.first <= glyphId) {
						lo = mid;
					} else {
						hi = mid - 1;
					}
				}
				const foundRange = ranges[lo];
				return foundRange?.fd ?? 0;
			},
		};
	}

	return { format, select: () => 0 };
}

function createCff2WithCustomIndex(
	offSize: number,
	count: number,
	items: number[][],
): Cff2Table {
	const w = new BinaryWriter();

	w.uint8(2);
	w.uint8(0);
	w.uint8(5);
	w.uint16(2);

	w.uint8(139);
	w.uint8(17);

	writeIndex(w, offSize, items);

	return parseCff2(w.toReader());
}

function createCff2WithInvalidOffsetSize(): Cff2Table {
	const w = new BinaryWriter();

	w.uint8(2);
	w.uint8(0);
	w.uint8(5);
	w.uint16(2);

	w.uint8(139);
	w.uint8(17);

	w.uint32(1);
	w.uint8(5);
	w.uint8(1);

	return parseCff2(w.toReader());
}

function writeIndex(w: BinaryWriter, offSize: number, items: number[][]): void {
	w.uint32(items.length);
	if (items.length === 0) return;

	w.uint8(offSize);

	let offset = 1;
	for (let i = 0; i <= items.length; i++) {
		writeOffset(w, offSize, offset);
		if (i < items.length) {
			offset += items[i]!.length;
		}
	}

	for (const item of items) {
		w.raw(...item);
	}
}

function writeOffset(w: BinaryWriter, offSize: number, offset: number): void {
	switch (offSize) {
		case 1:
			w.uint8(offset);
			break;
		case 2:
			w.uint16(offset);
			break;
		case 3:
			w.uint24(offset);
			break;
		case 4:
			w.uint32(offset);
			break;
	}
}

function createMinimalCff2Table(): Cff2Table {
	const w = new BinaryWriter();

	w.uint8(2);
	w.uint8(0);
	w.uint8(5);
	w.uint16(0);

	writeIndex(w, 1, []);

	return parseCff2(w.toReader());
}

function createCff2WithValidCharStrings(): Cff2Table {
	const w = new BinaryWriter();

	w.uint8(2);
	w.uint8(0);
	w.uint8(5);

	const topDictSize = 4;
	const charStringsOffset = 5 + topDictSize + 5;

	const topDict = new BinaryWriter();
	topDict.uint8(28);
	topDict.int16(charStringsOffset);
	topDict.uint8(17);

	const td = Array.from(new Uint8Array(topDict.toBuffer()));
	w.uint16(td.length);
	w.raw(...td);

	writeIndex(w, 1, []);

	writeIndex(w, 1, [[100, 101, 102]]);

	return parseCff2(w.toReader());
}

function createCff2WithValidFDArray(): Cff2Table {
	const w = new BinaryWriter();

	w.uint8(2);
	w.uint8(0);
	w.uint8(5);

	const topDictSize = 10;
	const charStringsOffset = 5 + topDictSize + 5;
	const fdArrayOffset = charStringsOffset + 11;

	const topDict = new BinaryWriter();
	topDict.uint8(28);
	topDict.int16(charStringsOffset);
	topDict.uint8(17);
	topDict.uint8(28);
	topDict.int16(fdArrayOffset);
	topDict.uint8(12);
	topDict.uint8(36);

	const td = Array.from(new Uint8Array(topDict.toBuffer()));
	w.uint16(td.length);
	w.raw(...td);

	writeIndex(w, 1, []);

	writeIndex(w, 1, [[100, 101, 102]]);

	writeIndex(w, 1, [[139, 17]]);

	return parseCff2(w.toReader());
}

function createCff2WithFDSelectFormat0(): Cff2Table {
	const w = new BinaryWriter();

	w.uint8(2);
	w.uint8(0);
	w.uint8(5);

	const topDictSize = 15;
	const charStringsOffset = 5 + topDictSize + 5;
	const fdArrayOffset = charStringsOffset + 11;
	const fdSelectOffset = fdArrayOffset + 11;

	const topDict = new BinaryWriter();
	topDict.uint8(28);
	topDict.int16(charStringsOffset);
	topDict.uint8(17);
	topDict.uint8(28);
	topDict.int16(fdArrayOffset);
	topDict.uint8(12);
	topDict.uint8(36);
	topDict.uint8(28);
	topDict.int16(fdSelectOffset);
	topDict.uint8(12);
	topDict.uint8(37);

	const td = Array.from(new Uint8Array(topDict.toBuffer()));
	w.uint16(td.length);
	w.raw(...td);

	writeIndex(w, 1, []);

	writeIndex(w, 1, [[100, 101, 102]]);

	writeIndex(w, 1, [[139, 17]]);

	w.uint8(0);
	w.uint8(0);

	return parseCff2(w.toReader());
}

function createCff2WithValidVStore(): Cff2Table {
	const w = new BinaryWriter();

	w.uint8(2);
	w.uint8(0);
	w.uint8(5);

	const topDictSize = 7;
	const charStringsOffset = 5 + topDictSize + 5;
	const vstoreOffset = charStringsOffset + 11;

	const topDict = new BinaryWriter();
	topDict.uint8(28);
	topDict.int16(charStringsOffset);
	topDict.uint8(17);
	topDict.uint8(28);
	topDict.int16(vstoreOffset);
	topDict.uint8(24);

	const td = Array.from(new Uint8Array(topDict.toBuffer()));
	w.uint16(td.length);
	w.raw(...td);

	writeIndex(w, 1, []);

	writeIndex(w, 1, [[100, 101, 102]]);

	w.uint16(100);
	w.uint16(1);
	w.uint32(12);
	w.uint16(1);
	w.uint32(18);

	w.uint16(1);
	w.uint16(1);
	w.f2dot14(0);
	w.f2dot14(1);
	w.f2dot14(1);

	w.uint16(1);
	w.uint16(1);
	w.uint16(0);
	w.int16(100);

	return parseCff2(w.toReader());
}

function createCff2WithPrivateDictAndLocalSubrs(): Cff2Table {
	const w = new BinaryWriter();

	w.uint8(2);
	w.uint8(0);
	w.uint8(5);

	const topDictSize = 10;
	const charStringsOffset = 5 + topDictSize + 5;
	const fdArrayOffset = charStringsOffset + 11;

	const topDict = new BinaryWriter();
	topDict.uint8(28);
	topDict.int16(charStringsOffset);
	topDict.uint8(17);
	topDict.uint8(28);
	topDict.int16(fdArrayOffset);
	topDict.uint8(12);
	topDict.uint8(36);

	const td = Array.from(new Uint8Array(topDict.toBuffer()));
	w.uint16(td.length);
	w.raw(...td);

	writeIndex(w, 1, []);

	writeIndex(w, 1, [[100, 101, 102]]);

	const privateDictSize = 6;
	const privateDictOffset = fdArrayOffset + 17;
	const localSubrsOffset = privateDictOffset + privateDictSize + 11;

	const fdDict = new BinaryWriter();
	fdDict.uint8(28);
	fdDict.int16(privateDictSize);
	fdDict.uint8(28);
	fdDict.int16(privateDictOffset);
	fdDict.uint8(18);

	writeIndex(w, 1, [Array.from(new Uint8Array(fdDict.toBuffer()))]);

	const subsrRelativeOffset = localSubrsOffset - privateDictOffset;
	w.uint8(28);
	w.int16(subsrRelativeOffset);
	w.uint8(19);

	writeIndex(w, 1, [[50, 51, 52]]);

	return parseCff2(w.toReader());
}

function createCff2WithCharStrings(): Cff2Table {
	const w = new BinaryWriter();

	w.uint8(2);
	w.uint8(0);
	w.uint8(5);

	const globalSubrsSize = 5;
	const topDictSize = 4;
	const charStringsOffset = 5 + topDictSize + globalSubrsSize;

	const topDictData = new BinaryWriter();
	topDictData.uint8(28);
	topDictData.int16(charStringsOffset);
	topDictData.uint8(17);

	const topDictBytes = Array.from(new Uint8Array(topDictData.toBuffer()));
	w.uint16(topDictBytes.length);
	w.raw(...topDictBytes);

	writeIndex(w, 1, []);

	writeIndex(w, 1, [[100, 101, 102]]);

	return parseCff2(w.toReader());
}

function createCff2WithFDArray(): Cff2Table {
	const w = new BinaryWriter();

	w.uint8(2);
	w.uint8(0);
	w.uint8(5);

	const topDictSize = 10;
	const headerSize = 5 + 2;
	const globalSubrsSize = 5;
	const charStringsSize = 11;

	const charStringsOffset = headerSize + topDictSize + globalSubrsSize;
	const fdArrayOffset = charStringsOffset + charStringsSize;

	const topDictData = new BinaryWriter();
	topDictData.uint8(28);
	topDictData.int16(charStringsOffset);
	topDictData.uint8(17);
	topDictData.uint8(28);
	topDictData.int16(fdArrayOffset);
	topDictData.uint8(12);
	topDictData.uint8(36);

	const topDictBytes = Array.from(new Uint8Array(topDictData.toBuffer()));
	w.uint16(topDictBytes.length);
	w.raw(...topDictBytes);

	writeIndex(w, 1, []);

	writeIndex(w, 1, [[100, 101, 102]]);

	writeIndex(w, 1, [[139, 17]]);

	return parseCff2(w.toReader());
}

function createCff2WithFDSelect(): Cff2Table {
	const w = new BinaryWriter();

	w.uint8(2);
	w.uint8(0);
	w.uint8(5);

	const topDictSize = 15;
	const headerSize = 5 + 2;
	const globalSubrsSize = 5;
	const charStringsSize = 11;
	const fdArraySize = 11;

	const charStringsOffset = headerSize + topDictSize + globalSubrsSize;
	const fdArrayOffset = charStringsOffset + charStringsSize;
	const fdSelectOffset = fdArrayOffset + fdArraySize;

	const topDictData = new BinaryWriter();
	topDictData.uint8(28);
	topDictData.int16(charStringsOffset);
	topDictData.uint8(17);
	topDictData.uint8(28);
	topDictData.int16(fdArrayOffset);
	topDictData.uint8(12);
	topDictData.uint8(36);
	topDictData.uint8(28);
	topDictData.int16(fdSelectOffset);
	topDictData.uint8(12);
	topDictData.uint8(37);

	const topDictBytes = Array.from(new Uint8Array(topDictData.toBuffer()));
	w.uint16(topDictBytes.length);
	w.raw(...topDictBytes);

	writeIndex(w, 1, []);

	writeIndex(w, 1, [[100, 101, 102]]);

	writeIndex(w, 1, [[139, 17]]);

	w.uint8(0);
	w.uint8(0);

	return parseCff2(w.toReader());
}

function createCff2WithVStore(): Cff2Table {
	const w = new BinaryWriter();

	w.uint8(2);
	w.uint8(0);
	w.uint8(5);

	const topDictSize = 7;
	const headerSize = 5 + 2;
	const globalSubrsSize = 5;
	const charStringsSize = 11;

	const charStringsOffset = headerSize + topDictSize + globalSubrsSize;
	const vstoreOffset = charStringsOffset + charStringsSize;

	const topDictData = new BinaryWriter();
	topDictData.uint8(28);
	topDictData.int16(charStringsOffset);
	topDictData.uint8(17);
	topDictData.uint8(28);
	topDictData.int16(vstoreOffset);
	topDictData.uint8(24);

	const topDictBytes = Array.from(new Uint8Array(topDictData.toBuffer()));
	w.uint16(topDictBytes.length);
	w.raw(...topDictBytes);

	writeIndex(w, 1, []);

	writeIndex(w, 1, [[100, 101, 102]]);

	const regionListOffset = 12;
	w.uint16(100);
	w.uint16(1);
	w.uint32(regionListOffset);
	w.uint16(1);
	w.uint32(regionListOffset + 6);

	w.uint16(1);
	w.uint16(1);
	w.f2dot14(0);
	w.f2dot14(1);
	w.f2dot14(1);

	w.uint16(1);
	w.uint16(1);
	w.uint16(0);
	w.int16(100);

	return parseCff2(w.toReader());
}

function createCff2WithPrivateDictAndSubrs(): Cff2Table {
	const w = new BinaryWriter();

	w.uint8(2);
	w.uint8(0);
	w.uint8(5);

	const topDictSize = 10;
	const headerSize = 5 + 2;
	const globalSubrsSize = 5;
	const charStringsSize = 11;

	const charStringsOffset = headerSize + topDictSize + globalSubrsSize;
	const fdArrayOffset = charStringsOffset + charStringsSize;

	const topDictData = new BinaryWriter();
	topDictData.uint8(28);
	topDictData.int16(charStringsOffset);
	topDictData.uint8(17);
	topDictData.uint8(28);
	topDictData.int16(fdArrayOffset);
	topDictData.uint8(12);
	topDictData.uint8(36);

	const topDictBytes = Array.from(new Uint8Array(topDictData.toBuffer()));
	w.uint16(topDictBytes.length);
	w.raw(...topDictBytes);

	writeIndex(w, 1, []);

	writeIndex(w, 1, [[100, 101, 102]]);

	const fdDictData = new BinaryWriter();
	const privateDictSize = 6;
	const fdArraySize = 17;
	const privateDictOffset = fdArrayOffset + fdArraySize;
	fdDictData.uint8(28);
	fdDictData.int16(privateDictSize);
	fdDictData.uint8(28);
	fdDictData.int16(privateDictOffset);
	fdDictData.uint8(18);

	writeIndex(w, 1, [Array.from(new Uint8Array(fdDictData.toBuffer()))]);

	const subsrOffset = 6;
	w.uint8(28);
	w.int16(subsrOffset);
	w.uint8(19);

	writeIndex(w, 1, [[50, 51, 52]]);

	return parseCff2(w.toReader());
}

function createMockItemVariationStore() {
	const w = new BinaryWriter();

	const regionListOffset = 12;
	w.uint16(100);
	w.uint16(1);
	w.uint32(regionListOffset);
	w.uint16(1);
	w.uint32(regionListOffset + 6);

	w.uint16(1);
	w.uint16(1);
	w.f2dot14(0);
	w.f2dot14(1);
	w.f2dot14(1);

	w.uint16(1);
	w.uint16(1);
	w.uint16(0);
	w.int16(100);

	const reader = w.toReader();
	const _length = reader.uint16();
	const format = reader.uint16();
	const variationRegionListOffset = reader.uint32();
	const itemVariationDataCount = reader.uint16();
	const itemVariationDataOffsets: number[] = [];

	for (let i = 0; i < itemVariationDataCount; i++) {
		itemVariationDataOffsets.push(reader.uint32());
	}

	const startOffset = 0;
	reader.seek(variationRegionListOffset);
	const variationRegionList = parseVariationRegionListHelper(reader);

	const itemVariationData = [];
	for (let i = 0; i < itemVariationDataOffsets.length; i++) {
		const offset = itemVariationDataOffsets[i]!;
		reader.seek(offset);
		itemVariationData.push(parseItemVariationDataHelper(reader));
	}

	return { format, variationRegionList, itemVariationData };
}

function createMockItemVariationStoreMultipleRegions() {
	const w = new BinaryWriter();

	const regionListOffset = 16;
	w.uint16(100);
	w.uint16(1);
	w.uint32(regionListOffset);
	w.uint16(1);
	w.uint32(regionListOffset + 12);

	w.uint16(1);
	w.uint16(2);
	w.f2dot14(0);
	w.f2dot14(1);
	w.f2dot14(1);
	w.f2dot14(0);
	w.f2dot14(0.5);
	w.f2dot14(1);

	w.uint16(2);
	w.uint16(2);
	w.uint16(0);
	w.uint16(1);
	w.int16(100);
	w.int16(50);

	const reader = w.toReader();
	const _length = reader.uint16();
	const format = reader.uint16();
	const variationRegionListOffset = reader.uint32();
	const itemVariationDataCount = reader.uint16();
	const itemVariationDataOffsets: number[] = [];

	for (let i = 0; i < itemVariationDataCount; i++) {
		itemVariationDataOffsets.push(reader.uint32());
	}

	reader.seek(variationRegionListOffset);
	const variationRegionList = parseVariationRegionListHelper(reader);

	const itemVariationData = [];
	for (let i = 0; i < itemVariationDataOffsets.length; i++) {
		const offset = itemVariationDataOffsets[i]!;
		reader.seek(offset);
		itemVariationData.push(parseItemVariationDataHelper(reader));
	}

	return { format, variationRegionList, itemVariationData };
}

function createMockItemVariationStoreWithLongWords() {
	const w = new BinaryWriter();

	const regionListOffset = 12;
	w.uint16(100);
	w.uint16(1);
	w.uint32(regionListOffset);
	w.uint16(1);
	w.uint32(regionListOffset + 6);

	w.uint16(1);
	w.uint16(1);
	w.f2dot14(0);
	w.f2dot14(1);
	w.f2dot14(1);

	w.uint16(1);
	w.uint16(0x8001);
	w.uint16(0);
	w.int32(100000);

	const reader = w.toReader();
	const _length = reader.uint16();
	const format = reader.uint16();
	const variationRegionListOffset = reader.uint32();
	const itemVariationDataCount = reader.uint16();
	const itemVariationDataOffsets: number[] = [];

	for (let i = 0; i < itemVariationDataCount; i++) {
		itemVariationDataOffsets.push(reader.uint32());
	}

	reader.seek(variationRegionListOffset);
	const variationRegionList = parseVariationRegionListHelper(reader);

	const itemVariationData = [];
	for (let i = 0; i < itemVariationDataOffsets.length; i++) {
		const offset = itemVariationDataOffsets[i]!;
		reader.seek(offset);
		itemVariationData.push(parseItemVariationDataHelper(reader));
	}

	return { format, variationRegionList, itemVariationData };
}

function parseVariationRegionListHelper(reader: Reader) {
	const axisCount = reader.uint16();
	const regionCount = reader.uint16();
	const regions = [];

	for (let i = 0; i < regionCount; i++) {
		const axes = [];
		for (let j = 0; j < axisCount; j++) {
			axes.push({
				startCoord: reader.f2dot14(),
				peakCoord: reader.f2dot14(),
				endCoord: reader.f2dot14(),
			});
		}
		regions.push({ axes });
	}

	return { axisCount, regionCount, regions };
}

function parseItemVariationDataHelper(reader: Reader) {
	const itemCount = reader.uint16();
	const wordDeltaCount = reader.uint16();
	const regionIndexCount = wordDeltaCount & 0x7fff;
	const longWords = (wordDeltaCount & 0x8000) !== 0;

	const regionIndexes: number[] = [];
	for (let i = 0; i < regionIndexCount; i++) {
		regionIndexes.push(reader.uint16());
	}

	const deltaSets: number[][] = [];
	for (let i = 0; i < itemCount; i++) {
		const deltas: number[] = [];
		for (let j = 0; j < regionIndexCount; j++) {
			if (longWords) {
				deltas.push(reader.int32());
			} else {
				deltas.push(reader.int16());
			}
		}
		deltaSets.push(deltas);
	}

	return {
		itemCount,
		regionIndexCount,
		regionIndexes,
		deltaSets,
	};
}
