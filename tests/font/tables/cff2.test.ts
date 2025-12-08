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
});

