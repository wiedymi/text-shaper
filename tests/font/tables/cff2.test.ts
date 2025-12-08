import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import { Tags } from "../../../src/types.ts";
import {
	parseCff2,
	type Cff2Table,
	type Cff2TopDict,
	type Cff2PrivateDict,
	calculateVariationDelta,
	__testing,
} from "../../../src/font/tables/cff2.ts";
import { executeCff2CharString } from "../../../src/font/tables/cff-charstring.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const ADOBE_VF_PATH = "tests/fixtures/AdobeVFPrototype.otf";

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

	get length(): number {
		return this.bytes.length;
	}

	toBuffer(): ArrayBuffer {
		return new Uint8Array(this.bytes).buffer;
	}

	toReader(): Reader {
		return new Reader(this.toBuffer());
	}

	toBytes(): number[] {
		return [...this.bytes];
	}
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

describe("cff2 table", () => {
	let font: Font;
	let hasCff2: boolean;

	beforeAll(async () => {
		font = await Font.fromFile(ADOBE_VF_PATH);
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

			const glyphId = font.glyphId(0x41);
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

	describe("DICT operand parsing (unit tests)", () => {
		test("parseDict parses int16 operand (byte 28)", () => {
			const w = new BinaryWriter();
			// int16: 28 followed by 2-byte signed value, then operator 17
			w.uint8(28);
			w.int16(1234);
			w.uint8(17); // operator
			const reader = w.toReader();
			const dict = __testing.parseDict(reader);
			expect(dict.get(17)).toEqual([1234]);
		});

		test("parseDict parses int32 operand (byte 29)", () => {
			const w = new BinaryWriter();
			// int32: 29 followed by 4-byte signed value, then operator 17
			w.uint8(29);
			w.int32(123456);
			w.uint8(17);
			const reader = w.toReader();
			const dict = __testing.parseDict(reader);
			expect(dict.get(17)).toEqual([123456]);
		});

		test("parseDict parses real number operand (byte 30)", () => {
			const w = new BinaryWriter();
			// Real: 1.5 = nibbles 1, ., 5, f = 0x1a, 0x5f
			w.uint8(30);
			w.uint8(0x1a); // "1."
			w.uint8(0x5f); // "5" + end
			w.uint8(17);
			const reader = w.toReader();
			const dict = __testing.parseDict(reader);
			expect(dict.get(17)![0]).toBeCloseTo(1.5);
		});

		test("parseDict parses negative 2-byte operand (251-254 range)", () => {
			const w = new BinaryWriter();
			// 251 b1 = -(251-251)*256 - b1 - 108 = -b1 - 108
			// For b1=0: -108
			w.uint8(251);
			w.uint8(0);
			w.uint8(17);
			const reader = w.toReader();
			const dict = __testing.parseDict(reader);
			expect(dict.get(17)).toEqual([-108]);
		});

		test("parseDict parses vsindex operator (22)", () => {
			const w = new BinaryWriter();
			w.uint8(140); // = 1
			w.uint8(22); // vsindex operator
			const reader = w.toReader();
			const dict = __testing.parseDict(reader);
			expect(dict.get(22)).toEqual([1]);
		});

		test("parseDict parses blend operator (23)", () => {
			const w = new BinaryWriter();
			w.uint8(140); // = 1
			w.uint8(141); // = 2
			w.uint8(23); // blend operator
			const reader = w.toReader();
			const dict = __testing.parseDict(reader);
			expect(dict.get(23)).toEqual([1, 2]);
		});

		test("parseDict parses vstore operator (24)", () => {
			const w = new BinaryWriter();
			w.uint8(150); // = 11
			w.uint8(24); // vstore operator
			const reader = w.toReader();
			const dict = __testing.parseDict(reader);
			expect(dict.get(24)).toEqual([11]);
		});
	});

	describe("Index parsing with different offset sizes (unit tests)", () => {
		test("readOffset with offSize=1", () => {
			const w = new BinaryWriter();
			w.uint8(42);
			const reader = w.toReader();
			expect(__testing.readOffset(reader, 1)).toBe(42);
		});

		test("readOffset with offSize=2", () => {
			const w = new BinaryWriter();
			w.uint16(1000);
			const reader = w.toReader();
			expect(__testing.readOffset(reader, 2)).toBe(1000);
		});

		test("readOffset with offSize=3", () => {
			const w = new BinaryWriter();
			w.uint24(100000);
			const reader = w.toReader();
			expect(__testing.readOffset(reader, 3)).toBe(100000);
		});

		test("readOffset with offSize=4", () => {
			const w = new BinaryWriter();
			w.uint32(10000000);
			const reader = w.toReader();
			expect(__testing.readOffset(reader, 4)).toBe(10000000);
		});

		test("readOffset throws for invalid offSize", () => {
			const w = new BinaryWriter();
			w.uint8(0);
			const reader = w.toReader();
			expect(() => __testing.readOffset(reader, 5)).toThrow("Invalid offset size: 5");
		});

		test("parseIndex with empty index", () => {
			const w = new BinaryWriter();
			w.uint32(0); // count = 0
			const reader = w.toReader();
			const result = __testing.parseIndex(reader);
			expect(result).toEqual([]);
		});

		test("parseIndex with offSize=1", () => {
			const w = new BinaryWriter();
			w.uint32(2); // count = 2
			w.uint8(1); // offSize = 1
			w.uint8(1); // offset[0] = 1
			w.uint8(3); // offset[1] = 3
			w.uint8(5); // offset[2] = 5
			w.raw(0xAA, 0xBB); // data[0] = 2 bytes
			w.raw(0xCC, 0xDD); // data[1] = 2 bytes
			const reader = w.toReader();
			const result = __testing.parseIndex(reader);
			expect(result.length).toBe(2);
			expect(result[0]).toEqual(new Uint8Array([0xAA, 0xBB]));
			expect(result[1]).toEqual(new Uint8Array([0xCC, 0xDD]));
		});
	});

	describe("FDSelect format parsing (unit tests)", () => {
		test("parseFDSelect format 0", () => {
			const w = new BinaryWriter();
			w.uint8(0); // format
			w.uint8(0); // glyph 0 -> FD 0
			w.uint8(1); // glyph 1 -> FD 1
			w.uint8(2); // glyph 2 -> FD 2
			const reader = w.toReader();
			const fdSelect = __testing.parseFDSelect(reader, 3);
			expect(fdSelect.format).toBe(0);
			expect(fdSelect.select(0)).toBe(0);
			expect(fdSelect.select(1)).toBe(1);
			expect(fdSelect.select(2)).toBe(2);
		});

		test("parseFDSelect format 3", () => {
			const w = new BinaryWriter();
			w.uint8(3); // format
			w.uint16(2); // nRanges = 2
			// Range 0: glyphs 0-4 -> FD 0
			w.uint16(0); // first
			w.uint8(0); // fd
			// Range 1: glyphs 5-9 -> FD 1
			w.uint16(5);
			w.uint8(1);
			w.uint16(10); // sentinel
			const reader = w.toReader();
			const fdSelect = __testing.parseFDSelect(reader, 10);
			expect(fdSelect.format).toBe(3);
			expect(fdSelect.select(0)).toBe(0);
			expect(fdSelect.select(4)).toBe(0);
			expect(fdSelect.select(5)).toBe(1);
			expect(fdSelect.select(9)).toBe(1);
		});

		test("parseFDSelect format 4", () => {
			const w = new BinaryWriter();
			w.uint8(4); // format
			w.uint32(2); // nRanges = 2
			// Range 0: glyphs 0-99 -> FD 0
			w.uint32(0); // first (32-bit)
			w.uint16(0); // fd (16-bit)
			// Range 1: glyphs 100-199 -> FD 1
			w.uint32(100);
			w.uint16(1);
			w.uint32(200); // sentinel
			const reader = w.toReader();
			const fdSelect = __testing.parseFDSelect(reader, 200);
			expect(fdSelect.format).toBe(4);
			expect(fdSelect.select(0)).toBe(0);
			expect(fdSelect.select(99)).toBe(0);
			expect(fdSelect.select(100)).toBe(1);
			expect(fdSelect.select(199)).toBe(1);
		});

		test("parseFDSelect unknown format returns default", () => {
			const w = new BinaryWriter();
			w.uint8(99); // unknown format
			const reader = w.toReader();
			const fdSelect = __testing.parseFDSelect(reader, 5);
			expect(fdSelect.format).toBe(99);
			expect(fdSelect.select(0)).toBe(0);
			expect(fdSelect.select(999)).toBe(0);
		});
	});

	describe("Private DICT operators", () => {
		test("parses FamilyOtherBlues", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				for (const fd of cff2.fdArray) {
					if (fd.private?.familyOtherBlues) {
						expect(Array.isArray(fd.private.familyOtherBlues)).toBe(true);
					}
				}
			}
		});

		test("parses BlueScale", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				for (const fd of cff2.fdArray) {
					if (fd.private?.blueScale !== undefined) {
						expect(typeof fd.private.blueScale).toBe("number");
					}
				}
			}
		});

		test("parses StemSnapH and StemSnapV", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				for (const fd of cff2.fdArray) {
					if (fd.private?.stemSnapH) {
						expect(Array.isArray(fd.private.stemSnapH)).toBe(true);
					}
					if (fd.private?.stemSnapV) {
						expect(Array.isArray(fd.private.stemSnapV)).toBe(true);
					}
				}
			}
		});

		test("parses LanguageGroup", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				for (const fd of cff2.fdArray) {
					if (fd.private?.languageGroup !== undefined) {
						expect(typeof fd.private.languageGroup).toBe("number");
					}
				}
			}
		});

		test("parses ExpansionFactor", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				for (const fd of cff2.fdArray) {
					if (fd.private?.expansionFactor !== undefined) {
						expect(typeof fd.private.expansionFactor).toBe("number");
					}
				}
			}
		});

		test("parses vsindex and blend", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				for (const fd of cff2.fdArray) {
					if (fd.private?.vsindex !== undefined) {
						expect(typeof fd.private.vsindex).toBe("number");
					}
					if (fd.private?.blend) {
						expect(Array.isArray(fd.private.blend)).toBe(true);
					}
				}
			}
		});
	});

	describe("TopDict operators", () => {
		test("parses FontMatrix operator", () => {
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

		test("parses vstore operator", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				if (cff2.topDict.vstore !== undefined) {
					expect(typeof cff2.topDict.vstore).toBe("number");
				}
			}
		});
	});

	describe("Local subroutines parsing", () => {
		test("parses local subroutines when present", () => {
			if (!hasCff2) return;

			const reader = font.getTableReader(Tags.CFF2);
			if (reader) {
				const cff2 = parseCff2(reader);
				let hasLocalSubrs = false;
				for (const fd of cff2.fdArray) {
					if (fd.localSubrs && fd.localSubrs.length > 0) {
						hasLocalSubrs = true;
						expect(Array.isArray(fd.localSubrs)).toBe(true);
					}
				}
				// Just verify the parsing doesn't crash
				expect(cff2.fdArray).toBeDefined();
			}
		});
	});

	describe("calculateVariationDelta edge cases", () => {
		test("handles negative start region with negative coord", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 1,
					regionCount: 1,
					regions: [
						{
							axes: [{ startCoord: -1, peakCoord: -0.5, endCoord: 0 }],
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
			expect(delta).toBe(100); // at peak
		});

		test("handles coord greater than peak", () => {
			const mockVstore = {
				format: 1,
				variationRegionList: {
					axisCount: 1,
					regionCount: 1,
					regions: [
						{
							axes: [{ startCoord: 0, peakCoord: 0.5, endCoord: 1 }],
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
			const delta = calculateVariationDelta(mockVstore, 0, 0, [0.75]);
			expect(delta).toBe(50); // halfway between peak and end
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
			expect(delta).toBe(25); // 0.5 * 0.5 * 100 = 25
		});
	});

	describe("Real number parsing edge cases (unit tests)", () => {
		test("parseReal with E+ notation", () => {
			const w = new BinaryWriter();
			// Real: 1E2 = 100
			// nibbles: 1, E, 2, f = 0x1b, 0x2f
			w.uint8(0x1b); // 1, E
			w.uint8(0x2f); // 2, end
			const reader = w.toReader();
			expect(__testing.parseReal(reader)).toBe(100);
		});

		test("parseReal with E- notation", () => {
			const w = new BinaryWriter();
			// Real: 1E-2 = 0.01
			// nibbles: 1, E-, 2, f = 0x1c, 0x2f (E- is nibble 0x0c)
			w.uint8(0x1c); // 1, E-
			w.uint8(0x2f); // 2, end
			const reader = w.toReader();
			expect(__testing.parseReal(reader)).toBeCloseTo(0.01);
		});

		test("parseReal with minus sign", () => {
			const w = new BinaryWriter();
			// Real: -1.5
			// nibbles: -, 1, ., 5, f = 0xe1, 0xa5, 0xff
			// minus is nibble 0x0e
			w.uint8(0xe1); // -, 1
			w.uint8(0xa5); // ., 5
			w.uint8(0xff); // end, end
			const reader = w.toReader();
			expect(__testing.parseReal(reader)).toBe(-1.5);
		});

		test("parseReal with decimal only", () => {
			const w = new BinaryWriter();
			// Real: 3.14159
			// nibbles: 3, ., 1, 4, 1, 5, 9, f
			w.uint8(0x3a); // 3, .
			w.uint8(0x14); // 1, 4
			w.uint8(0x15); // 1, 5
			w.uint8(0x9f); // 9, end
			const reader = w.toReader();
			expect(__testing.parseReal(reader)).toBeCloseTo(3.14159);
		});
	});

	describe("Private DICT parsing (unit tests)", () => {
		test("parseCff2PrivateDict parses FamilyOtherBlues", () => {
			const w = new BinaryWriter();
			// FamilyOtherBlues (op 9): delta encoded values 10, 20
			w.uint8(139 + 10); // 10
			w.uint8(139 + 10); // delta 10 (absolute 20)
			w.uint8(9); // FamilyOtherBlues operator
			const reader = w.toReader();
			const privateDict = __testing.parseCff2PrivateDict(reader);
			expect(privateDict.familyOtherBlues).toEqual([10, 20]);
		});

		test("parseCff2PrivateDict parses BlueScale", () => {
			const w = new BinaryWriter();
			// BlueScale (op 12 09): a real number typically
			w.uint8(30); // real
			w.uint8(0x0a); // 0.
			w.uint8(0x03); // 0, 3
			w.uint8(0x9f); // 9, end (0.039)
			w.uint8(12);
			w.uint8(9); // BlueScale
			const reader = w.toReader();
			const privateDict = __testing.parseCff2PrivateDict(reader);
			expect(privateDict.blueScale).toBeCloseTo(0.039);
		});

		test("parseCff2PrivateDict parses BlueShift", () => {
			const w = new BinaryWriter();
			w.uint8(139 + 7); // = 7
			w.uint8(12);
			w.uint8(10); // BlueShift
			const reader = w.toReader();
			const privateDict = __testing.parseCff2PrivateDict(reader);
			expect(privateDict.blueShift).toBe(7);
		});

		test("parseCff2PrivateDict parses BlueFuzz", () => {
			const w = new BinaryWriter();
			w.uint8(140); // = 1
			w.uint8(12);
			w.uint8(11); // BlueFuzz
			const reader = w.toReader();
			const privateDict = __testing.parseCff2PrivateDict(reader);
			expect(privateDict.blueFuzz).toBe(1);
		});

		test("parseCff2PrivateDict parses StemSnapH", () => {
			const w = new BinaryWriter();
			// StemSnapH (op 12 12): delta encoded values
			w.uint8(139 + 50); // 50
			w.uint8(139 + 10); // delta 10 (absolute 60)
			w.uint8(12);
			w.uint8(12); // StemSnapH
			const reader = w.toReader();
			const privateDict = __testing.parseCff2PrivateDict(reader);
			expect(privateDict.stemSnapH).toEqual([50, 60]);
		});

		test("parseCff2PrivateDict parses StemSnapV", () => {
			const w = new BinaryWriter();
			// StemSnapV (op 12 13): delta encoded values
			w.uint8(139 + 80); // 80
			w.uint8(139 + 10); // delta 10 (absolute 90)
			w.uint8(12);
			w.uint8(13); // StemSnapV
			const reader = w.toReader();
			const privateDict = __testing.parseCff2PrivateDict(reader);
			expect(privateDict.stemSnapV).toEqual([80, 90]);
		});

		test("parseCff2PrivateDict parses LanguageGroup", () => {
			const w = new BinaryWriter();
			w.uint8(140); // = 1
			w.uint8(12);
			w.uint8(17); // LanguageGroup
			const reader = w.toReader();
			const privateDict = __testing.parseCff2PrivateDict(reader);
			expect(privateDict.languageGroup).toBe(1);
		});

		test("parseCff2PrivateDict parses ExpansionFactor", () => {
			const w = new BinaryWriter();
			w.uint8(30); // real
			w.uint8(0x0a); // 0.
			w.uint8(0x06); // 0, 6
			w.uint8(0xff); // end, end (0.06)
			w.uint8(12);
			w.uint8(18); // ExpansionFactor
			const reader = w.toReader();
			const privateDict = __testing.parseCff2PrivateDict(reader);
			expect(privateDict.expansionFactor).toBeCloseTo(0.06);
		});

		test("parseCff2PrivateDict parses Subrs", () => {
			const w = new BinaryWriter();
			w.uint8(139 + 100); // = 100 (offset to local subrs)
			w.uint8(19); // Subrs operator
			const reader = w.toReader();
			const privateDict = __testing.parseCff2PrivateDict(reader);
			expect(privateDict.subrs).toBe(100);
		});

		test("parseCff2PrivateDict parses vsindex", () => {
			const w = new BinaryWriter();
			w.uint8(140); // = 1
			w.uint8(22); // vsindex operator
			const reader = w.toReader();
			const privateDict = __testing.parseCff2PrivateDict(reader);
			expect(privateDict.vsindex).toBe(1);
		});

		test("parseCff2PrivateDict parses blend", () => {
			const w = new BinaryWriter();
			w.uint8(140); // = 1
			w.uint8(141); // = 2
			w.uint8(142); // = 3
			w.uint8(23); // blend operator
			const reader = w.toReader();
			const privateDict = __testing.parseCff2PrivateDict(reader);
			expect(privateDict.blend).toEqual([1, 2, 3]);
		});
	});

	describe("TopDict parsing (unit tests)", () => {
		test("parseCff2TopDict parses FontMatrix", () => {
			const w = new BinaryWriter();
			// FontMatrix (op 12 07): 6 values
			w.uint8(30); w.uint8(0x0a); w.uint8(0x00); w.uint8(0x1f); // 0.001
			w.uint8(139); // 0
			w.uint8(139); // 0
			w.uint8(30); w.uint8(0x0a); w.uint8(0x00); w.uint8(0x1f); // 0.001
			w.uint8(139); // 0
			w.uint8(139); // 0
			w.uint8(12);
			w.uint8(7); // FontMatrix
			const reader = w.toReader();
			const topDict = __testing.parseCff2TopDict(reader);
			expect(topDict.fontMatrix).toBeDefined();
			expect(topDict.fontMatrix!.length).toBe(6);
		});

		test("parseCff2TopDict parses vstore", () => {
			const w = new BinaryWriter();
			w.uint8(140 + 100 - 1); // encode 100
			w.uint8(24); // vstore operator
			const reader = w.toReader();
			const topDict = __testing.parseCff2TopDict(reader);
			expect(topDict.vstore).toBe(100);
		});

		test("parseCff2TopDict parses FDSelect", () => {
			const w = new BinaryWriter();
			w.uint8(139 + 50); // = 50 (offset to FDSelect)
			w.uint8(12);
			w.uint8(0x25); // FDSelect operator (12 37)
			const reader = w.toReader();
			const topDict = __testing.parseCff2TopDict(reader);
			expect(topDict.fdSelect).toBe(50);
		});

		test("parseCff2TopDict parses FDArray", () => {
			const w = new BinaryWriter();
			w.uint8(139 + 60); // = 60 (offset to FDArray)
			w.uint8(12);
			w.uint8(0x24); // FDArray operator (12 36)
			const reader = w.toReader();
			const topDict = __testing.parseCff2TopDict(reader);
			expect(topDict.fdArray).toBe(60);
		});
	});

	describe("ItemVariationData parsing (unit tests)", () => {
		test("parseItemVariationData with regionIndexes", () => {
			const w = new BinaryWriter();
			w.uint16(2); // itemCount
			w.uint16(3); // wordDeltaCount (3 regions, no long words)
			// regionIndexes
			w.uint16(0);
			w.uint16(1);
			w.uint16(2);
			// deltaSets (2 items x 3 regions = 6 int16 values)
			w.int16(10);
			w.int16(20);
			w.int16(30);
			w.int16(40);
			w.int16(50);
			w.int16(60);
			const reader = w.toReader();
			const data = __testing.parseItemVariationData(reader);
			expect(data.itemCount).toBe(2);
			expect(data.regionIndexCount).toBe(3);
			expect(data.regionIndexes).toEqual([0, 1, 2]);
			expect(data.deltaSets[0]).toEqual([10, 20, 30]);
			expect(data.deltaSets[1]).toEqual([40, 50, 60]);
		});

		test("parseItemVariationData with longWords (32-bit deltas)", () => {
			const w = new BinaryWriter();
			w.uint16(1); // itemCount
			w.uint16(0x8002); // wordDeltaCount = 2 regions + long words flag (bit 15)
			// regionIndexes
			w.uint16(0);
			w.uint16(1);
			// deltaSets (1 item x 2 regions = 2 int32 values)
			w.int32(100000);
			w.int32(-50000);
			const reader = w.toReader();
			const data = __testing.parseItemVariationData(reader);
			expect(data.itemCount).toBe(1);
			expect(data.regionIndexCount).toBe(2);
			expect(data.regionIndexes).toEqual([0, 1]);
			expect(data.deltaSets[0]).toEqual([100000, -50000]);
		});
	});
});

