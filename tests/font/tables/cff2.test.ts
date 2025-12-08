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

describe("cff2 synthetic tests", () => {
	function buildCff2(options: {
		topDict?: BinaryWriter;
		globalSubrs?: number[][];
		charStrings?: number[][];
		fdArray?: number[][];
		fdSelect?: { format: number; data: number[] };
		vstore?: BinaryWriter;
		privateDict?: {
			dict: BinaryWriter;
			offset: number;
			localSubrs?: number[][];
		};
	}): ArrayBuffer {
		const parts: BinaryWriter[] = [];

		const header = new BinaryWriter();
		header.uint8(2);
		header.uint8(0);
		header.uint8(5);

		const topDict = options.topDict || new BinaryWriter();
		const topDictBytes = topDict.toBytes();
		header.uint16(topDictBytes.length);

		parts.push(header);
		parts.push(topDict);

		const globalSubrs = new BinaryWriter();
		writeIndex(globalSubrs, 1, options.globalSubrs || []);
		parts.push(globalSubrs);

		if (options.charStrings) {
			const charStrings = new BinaryWriter();
			writeIndex(charStrings, 1, options.charStrings);
			parts.push(charStrings);
		}

		if (options.fdArray) {
			const fdArray = new BinaryWriter();
			writeIndex(fdArray, 1, options.fdArray);
			parts.push(fdArray);
		}

		if (options.privateDict) {
			parts.push(options.privateDict.dict);
			if (options.privateDict.localSubrs) {
				const localSubrs = new BinaryWriter();
				writeIndex(localSubrs, 1, options.privateDict.localSubrs);
				parts.push(localSubrs);
			}
		}

		if (options.fdSelect) {
			const fdSelect = new BinaryWriter();
			fdSelect.raw(...options.fdSelect.data);
			parts.push(fdSelect);
		}

		if (options.vstore) {
			parts.push(options.vstore);
		}

		const combined = new BinaryWriter();
		for (const part of parts) {
			combined.raw(...part.toBytes());
		}

		return combined.toBuffer();
	}

	test("parses minimal CFF2", () => {
		const w = new BinaryWriter();
		w.uint8(2);
		w.uint8(0);
		w.uint8(5);
		w.uint16(0);
		writeIndex(w, 1, []);

		const cff2 = parseCff2(w.toReader());
		expect(cff2.version.major).toBe(2);
		expect(cff2.charStrings.length).toBe(0);
	});

	test("parses CFF2 with charStrings", () => {
		const w = new BinaryWriter();
		w.uint8(2);
		w.uint8(0);
		w.uint8(5);

		const topDict = new BinaryWriter();
		topDict.uint8(28);
		topDict.int16(5 + 4 + 5);
		topDict.uint8(17);

		const topDictBytes = topDict.toBytes();
		w.uint16(topDictBytes.length);
		w.raw(...topDictBytes);

		writeIndex(w, 1, []);
		writeIndex(w, 1, [[1, 2, 3], [4, 5]]);

		const cff2 = parseCff2(w.toReader());
		expect(cff2.charStrings.length).toBe(2);
	});

	test("parses FDArray with multiple Font DICTs", () => {
		const w = new BinaryWriter();
		w.uint8(2);
		w.uint8(0);
		w.uint8(5);

		const charStringsOff = 5 + 4 + 10 + 5;
		const fdArrayOff = charStringsOff + 15;

		const topDict = new BinaryWriter();
		topDict.uint8(28);
		topDict.int16(charStringsOff);
		topDict.uint8(17);
		topDict.uint8(28);
		topDict.int16(fdArrayOff);
		topDict.uint8(12);
		topDict.uint8(36);

		const topDictBytes = topDict.toBytes();
		w.uint16(topDictBytes.length);
		w.raw(...topDictBytes);

		writeIndex(w, 1, []);
		writeIndex(w, 1, [[1, 2, 3]]);

		const fd1 = new BinaryWriter();
		fd1.uint8(139);
		fd1.uint8(17);

		const fd2 = new BinaryWriter();
		fd2.uint8(139);
		fd2.uint8(17);

		writeIndex(w, 1, [fd1.toBytes(), fd2.toBytes()]);

		const cff2 = parseCff2(w.toReader());
		expect(cff2.fdArray.length).toBe(2);
	});

	test("parses Private DICT with local subroutines", () => {
		const w = new BinaryWriter();
		w.uint8(2);
		w.uint8(0);
		w.uint8(5);

		const charStringsOff = 5 + 4 + 10 + 5;
		const fdArrayOff = charStringsOff + 15;
		const privateDictOff = fdArrayOff + 20;
		const localSubrsOff = privateDictOff + 6;

		const topDict = new BinaryWriter();
		topDict.uint8(28);
		topDict.int16(charStringsOff);
		topDict.uint8(17);
		topDict.uint8(28);
		topDict.int16(fdArrayOff);
		topDict.uint8(12);
		topDict.uint8(36);

		const topDictBytes = topDict.toBytes();
		w.uint16(topDictBytes.length);
		w.raw(...topDictBytes);

		writeIndex(w, 1, []);
		writeIndex(w, 1, [[1, 2, 3]]);

		const fdDict = new BinaryWriter();
		fdDict.uint8(28);
		fdDict.int16(6);
		fdDict.uint8(28);
		fdDict.int16(privateDictOff);
		fdDict.uint8(18);

		writeIndex(w, 1, [fdDict.toBytes()]);

		w.uint8(28);
		w.int16(6);
		w.uint8(19);

		writeIndex(w, 1, [[10, 11], [20, 21]]);

		const cff2 = parseCff2(w.toReader());
		expect(cff2.fdArray[0]?.localSubrs?.length).toBe(2);
	});

	test("parses FDSelect format 0", () => {
		const w = new BinaryWriter();
		w.uint8(2);
		w.uint8(0);
		w.uint8(5);

		const charStringsOff = 5 + 4 + 15 + 5;
		const fdArrayOff = charStringsOff + 15;
		const fdSelectOff = fdArrayOff + 15;

		const topDict = new BinaryWriter();
		topDict.uint8(28);
		topDict.int16(charStringsOff);
		topDict.uint8(17);
		topDict.uint8(28);
		topDict.int16(fdArrayOff);
		topDict.uint8(12);
		topDict.uint8(36);
		topDict.uint8(28);
		topDict.int16(fdSelectOff);
		topDict.uint8(12);
		topDict.uint8(37);

		const topDictBytes = topDict.toBytes();
		w.uint16(topDictBytes.length);
		w.raw(...topDictBytes);

		writeIndex(w, 1, []);
		writeIndex(w, 1, [[1], [2], [3]]);

		const fd = new BinaryWriter();
		fd.uint8(139);
		fd.uint8(17);
		writeIndex(w, 1, [fd.toBytes()]);

		w.uint8(0);
		w.uint8(0);
		w.uint8(1);
		w.uint8(0);

		const cff2 = parseCff2(w.toReader());
		expect(cff2.fdSelect?.format).toBe(0);
		expect(cff2.fdSelect?.select(1)).toBe(1);
	});

	test("parses FDSelect format 3", () => {
		const w = new BinaryWriter();
		w.uint8(2);
		w.uint8(0);
		w.uint8(5);

		const charStringsOff = 5 + 4 + 15 + 5;
		const fdArrayOff = charStringsOff + 15;
		const fdSelectOff = fdArrayOff + 15;

		const topDict = new BinaryWriter();
		topDict.uint8(28);
		topDict.int16(charStringsOff);
		topDict.uint8(17);
		topDict.uint8(28);
		topDict.int16(fdArrayOff);
		topDict.uint8(12);
		topDict.uint8(36);
		topDict.uint8(28);
		topDict.int16(fdSelectOff);
		topDict.uint8(12);
		topDict.uint8(37);

		const topDictBytes = topDict.toBytes();
		w.uint16(topDictBytes.length);
		w.raw(...topDictBytes);

		writeIndex(w, 1, []);
		writeIndex(w, 1, [[1], [2]]);

		const fd = new BinaryWriter();
		fd.uint8(139);
		fd.uint8(17);
		writeIndex(w, 1, [fd.toBytes()]);

		w.uint8(3);
		w.uint16(2);
		w.uint16(0);
		w.uint8(0);
		w.uint16(1);
		w.uint8(1);
		w.uint16(2);

		const cff2 = parseCff2(w.toReader());
		expect(cff2.fdSelect?.format).toBe(3);
		expect(cff2.fdSelect?.select(0)).toBe(0);
		expect(cff2.fdSelect?.select(1)).toBe(1);
	});

	test("parses FDSelect format 4", () => {
		const w = new BinaryWriter();
		w.uint8(2);
		w.uint8(0);
		w.uint8(5);

		const charStringsOff = 5 + 4 + 15 + 5;
		const fdArrayOff = charStringsOff + 15;
		const fdSelectOff = fdArrayOff + 15;

		const topDict = new BinaryWriter();
		topDict.uint8(28);
		topDict.int16(charStringsOff);
		topDict.uint8(17);
		topDict.uint8(28);
		topDict.int16(fdArrayOff);
		topDict.uint8(12);
		topDict.uint8(36);
		topDict.uint8(28);
		topDict.int16(fdSelectOff);
		topDict.uint8(12);
		topDict.uint8(37);

		const topDictBytes = topDict.toBytes();
		w.uint16(topDictBytes.length);
		w.raw(...topDictBytes);

		writeIndex(w, 1, []);
		writeIndex(w, 1, [[1], [2]]);

		const fd = new BinaryWriter();
		fd.uint8(139);
		fd.uint8(17);
		writeIndex(w, 1, [fd.toBytes()]);

		w.uint8(4);
		w.uint32(2);
		w.uint32(0);
		w.uint16(0);
		w.uint32(1);
		w.uint16(1);
		w.uint32(2);

		const cff2 = parseCff2(w.toReader());
		expect(cff2.fdSelect?.format).toBe(4);
		expect(cff2.fdSelect?.select(0)).toBe(0);
		expect(cff2.fdSelect?.select(1)).toBe(1);
	});

	test("parses VariationStore", () => {
		const w = new BinaryWriter();
		w.uint8(2);
		w.uint8(0);
		w.uint8(5);

		const charStringsOff = 5 + 4 + 7 + 5;
		const vstoreOff = charStringsOff + 15;

		const topDict = new BinaryWriter();
		topDict.uint8(28);
		topDict.int16(charStringsOff);
		topDict.uint8(17);
		topDict.uint8(28);
		topDict.int16(vstoreOff);
		topDict.uint8(24);

		const topDictBytes = topDict.toBytes();
		w.uint16(topDictBytes.length);
		w.raw(...topDictBytes);

		writeIndex(w, 1, []);
		writeIndex(w, 1, [[1, 2, 3]]);

		w.uint16(50);
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

		const cff2 = parseCff2(w.toReader());
		expect(cff2.vstore).toBeDefined();
		expect(cff2.vstore?.itemVariationData.length).toBe(1);
	});

	test("parses VariationStore with longWords", () => {
		const w = new BinaryWriter();
		w.uint8(2);
		w.uint8(0);
		w.uint8(5);

		const charStringsOff = 5 + 4 + 7 + 5;
		const vstoreOff = charStringsOff + 15;

		const topDict = new BinaryWriter();
		topDict.uint8(28);
		topDict.int16(charStringsOff);
		topDict.uint8(17);
		topDict.uint8(28);
		topDict.int16(vstoreOff);
		topDict.uint8(24);

		const topDictBytes = topDict.toBytes();
		w.uint16(topDictBytes.length);
		w.raw(...topDictBytes);

		writeIndex(w, 1, []);
		writeIndex(w, 1, [[1, 2, 3]]);

		w.uint16(50);
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
		w.uint16(0x8001);
		w.uint16(0);
		w.int32(100000);

		const cff2 = parseCff2(w.toReader());
		expect(cff2.vstore?.itemVariationData[0]?.deltaSets[0]?.[0]).toBe(100000);
	});

	test("parses all Private DICT operators", () => {
		const w = new BinaryWriter();
		w.uint8(2);
		w.uint8(0);
		w.uint8(5);

		const charStringsOff = 5 + 4 + 10 + 5;
		const fdArrayOff = charStringsOff + 15;
		const privateDictOff = fdArrayOff + 20;

		const topDict = new BinaryWriter();
		topDict.uint8(28);
		topDict.int16(charStringsOff);
		topDict.uint8(17);
		topDict.uint8(28);
		topDict.int16(fdArrayOff);
		topDict.uint8(12);
		topDict.uint8(36);

		const topDictBytes = topDict.toBytes();
		w.uint16(topDictBytes.length);
		w.raw(...topDictBytes);

		writeIndex(w, 1, []);
		writeIndex(w, 1, [[1, 2, 3]]);

		const privateSize = 100;
		const fdDict = new BinaryWriter();
		fdDict.uint8(28);
		fdDict.int16(privateSize);
		fdDict.uint8(28);
		fdDict.int16(privateDictOff);
		fdDict.uint8(18);

		writeIndex(w, 1, [fdDict.toBytes()]);

		w.uint8(100);
		w.uint8(110);
		w.uint8(6);

		w.uint8(100);
		w.uint8(7);

		w.uint8(100);
		w.uint8(8);

		w.uint8(100);
		w.uint8(9);

		w.uint8(100);
		w.uint8(12);
		w.uint8(9);

		w.uint8(100);
		w.uint8(12);
		w.uint8(10);

		w.uint8(100);
		w.uint8(12);
		w.uint8(11);

		w.uint8(100);
		w.uint8(10);

		w.uint8(100);
		w.uint8(11);

		w.uint8(100);
		w.uint8(110);
		w.uint8(12);
		w.uint8(12);

		w.uint8(100);
		w.uint8(110);
		w.uint8(12);
		w.uint8(13);

		w.uint8(100);
		w.uint8(12);
		w.uint8(17);

		w.uint8(100);
		w.uint8(12);
		w.uint8(18);

		w.uint8(100);
		w.uint8(22);

		w.uint8(100);
		w.uint8(110);
		w.uint8(23);

		const cff2 = parseCff2(w.toReader());
		const pd = cff2.fdArray[0]?.private;
		expect(pd?.blueValues).toBeDefined();
		expect(pd?.otherBlues).toBeDefined();
		expect(pd?.familyBlues).toBeDefined();
		expect(pd?.familyOtherBlues).toBeDefined();
		expect(pd?.blueScale).toBe(-39);
		expect(pd?.blueShift).toBe(-39);
		expect(pd?.blueFuzz).toBe(-39);
		expect(pd?.stdHW).toBe(-39);
		expect(pd?.stdVW).toBe(-39);
		expect(pd?.stemSnapH).toBeDefined();
		expect(pd?.stemSnapV).toBeDefined();
		expect(pd?.languageGroup).toBe(-39);
		expect(pd?.expansionFactor).toBe(-39);
		expect(pd?.vsindex).toBe(-39);
		expect(pd?.blend).toBeDefined();
	});

	test("parses offset size 3 and 4", () => {
		const w = new BinaryWriter();
		w.uint8(2);
		w.uint8(0);
		w.uint8(5);
		w.uint16(0);

		writeIndex(w, 3, [[1, 2, 3]]);

		const cff2 = parseCff2(w.toReader());
		expect(cff2.globalSubrs.length).toBe(1);
	});

	test("parses real numbers in DICT", () => {
		const w = new BinaryWriter();
		w.uint8(2);
		w.uint8(0);
		w.uint8(5);

		const topDict = new BinaryWriter();
		topDict.uint8(30);
		topDict.raw(0x12, 0x34, 0x5f);
		topDict.uint8(30);
		topDict.raw(0x1c, 0x23, 0x4f);
		topDict.uint8(30);
		topDict.raw(0x1a, 0x23, 0x4f);
		topDict.uint8(30);
		topDict.raw(0x9a, 0x5f);
		topDict.uint8(30);
		topDict.raw(0x1f);
		topDict.uint8(100);
		topDict.uint8(200);
		topDict.uint8(12);
		topDict.uint8(7);

		const topDictBytes = topDict.toBytes();
		w.uint16(topDictBytes.length);
		w.raw(...topDictBytes);

		writeIndex(w, 1, []);

		const cff2 = parseCff2(w.toReader());
		expect(cff2.topDict.fontMatrix).toBeDefined();
		expect(cff2.topDict.fontMatrix?.length).toBe(6);
	});

	test("handles all number encodings", () => {
		const w = new BinaryWriter();
		w.uint8(2);
		w.uint8(0);
		w.uint8(5);

		const topDict = new BinaryWriter();

		topDict.uint8(28);
		topDict.int16(1000);

		topDict.uint8(29);
		topDict.int32(100000);

		topDict.uint8(30);
		topDict.raw(0x12, 0x34, 0x5f);

		topDict.uint8(139);

		topDict.uint8(247);
		topDict.uint8(0);

		topDict.uint8(251);
		topDict.uint8(0);

		topDict.uint8(100);
		topDict.uint8(200);

		topDict.uint8(12);
		topDict.uint8(7);

		const topDictBytes = topDict.toBytes();
		w.uint16(topDictBytes.length);
		w.raw(...topDictBytes);

		writeIndex(w, 1, []);

		const cff2 = parseCff2(w.toReader());
		expect(cff2.topDict.fontMatrix).toBeDefined();
	});
});
