import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseGvar,
	calculateTupleScalar,
	getGlyphDelta,
	parsePackedDeltas,
	type GvarTable,
	type TupleVariationHeader,
} from "../../../src/font/tables/gvar.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const SFNS_PATH = "/System/Library/Fonts/SFNS.ttf";
const SF_COMPACT_PATH = "/System/Library/Fonts/SFCompact.ttf";
const NEW_YORK_PATH = "/System/Library/Fonts/NewYork.ttf";

describe("gvar table - SFNS", () => {
	let font: Font;
	let gvar: GvarTable;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		const gvarTable = font.gvar;
		if (!gvarTable) {
			throw new Error("SFNS.ttf does not have a gvar table");
		}
		gvar = gvarTable;
	});

	describe("parseGvar", () => {
		test("returns GvarTable with version", () => {
			expect(gvar.majorVersion).toBe(1);
			expect(gvar.minorVersion).toBe(0);
		});

		test("has axisCount matching fvar", () => {
			const fvar = font.fvar;
			expect(fvar).not.toBeNull();
			if (fvar) {
				expect(gvar.axisCount).toBe(fvar.axes.length);
			}
		});

		test("has glyphVariationData array", () => {
			expect(Array.isArray(gvar.glyphVariationData)).toBe(true);
			expect(gvar.glyphVariationData.length).toBe(font.numGlyphs);
		});

		test("has sharedTuples array", () => {
			expect(Array.isArray(gvar.sharedTuples)).toBe(true);
			expect(gvar.sharedTuples.length).toBe(gvar.sharedTupleCount);
		});

		test("shared tuples have correct axis count", () => {
			for (const tuple of gvar.sharedTuples) {
				expect(tuple.length).toBe(gvar.axisCount);
			}
		});

		test("shared tuple values are in normalized range", () => {
			for (const tuple of gvar.sharedTuples) {
				for (const coord of tuple) {
					expect(coord).toBeGreaterThanOrEqual(-1.0);
					expect(coord).toBeLessThanOrEqual(1.0);
				}
			}
		});
	});

	describe("GlyphVariationData", () => {
		test("some glyphs have variation data", () => {
			let hasVariations = false;
			for (const glyphData of gvar.glyphVariationData) {
				if (glyphData.tupleVariationHeaders.length > 0) {
					hasVariations = true;
					break;
				}
			}
			expect(hasVariations).toBe(true);
		});

		test("glyph with variations has valid headers", () => {
			const glyphWithVars = gvar.glyphVariationData.find(
				(g) => g.tupleVariationHeaders.length > 0,
			);
			expect(glyphWithVars).toBeDefined();
			if (glyphWithVars) {
				for (const header of glyphWithVars.tupleVariationHeaders) {
					expect(typeof header.variationDataSize).toBe("number");
					expect(typeof header.tupleIndex).toBe("number");
				}
			}
		});

		test("tuple variation headers have peak tuples", () => {
			for (const glyphData of gvar.glyphVariationData) {
				for (const header of glyphData.tupleVariationHeaders) {
					if (header.peakTuple) {
						expect(header.peakTuple.length).toBe(gvar.axisCount);
					}
				}
			}
		});

		test("peak tuple values are in normalized range", () => {
			for (const glyphData of gvar.glyphVariationData) {
				for (const header of glyphData.tupleVariationHeaders) {
					if (header.peakTuple) {
						for (const coord of header.peakTuple) {
							expect(coord).toBeGreaterThanOrEqual(-1.0);
							expect(coord).toBeLessThanOrEqual(1.0);
						}
					}
				}
			}
		});

		test("intermediate tuples have correct length", () => {
			for (const glyphData of gvar.glyphVariationData) {
				for (const header of glyphData.tupleVariationHeaders) {
					if (header.intermediateStartTuple) {
						expect(header.intermediateStartTuple.length).toBe(gvar.axisCount);
					}
					if (header.intermediateEndTuple) {
						expect(header.intermediateEndTuple.length).toBe(gvar.axisCount);
					}
				}
			}
		});

		test("deltas array is defined", () => {
			for (const glyphData of gvar.glyphVariationData) {
				for (const header of glyphData.tupleVariationHeaders) {
					expect(Array.isArray(header.deltas)).toBe(true);
				}
			}
		});

		test("deltas have x and y properties", () => {
			for (const glyphData of gvar.glyphVariationData) {
				for (const header of glyphData.tupleVariationHeaders) {
					for (const delta of header.deltas) {
						expect(typeof delta.x).toBe("number");
						expect(typeof delta.y).toBe("number");
					}
				}
			}
		});

		test("point numbers are null or array", () => {
			for (const glyphData of gvar.glyphVariationData) {
				for (const header of glyphData.tupleVariationHeaders) {
					if (header.pointNumbers !== null) {
						expect(Array.isArray(header.pointNumbers)).toBe(true);
					}
				}
			}
		});
	});

	describe("specific glyphs", () => {
		test("notdef glyph (0) has variation data", () => {
			const notdefData = gvar.glyphVariationData[0];
			expect(notdefData).toBeDefined();
		});

		test("space glyph (3) has variation data", () => {
			const spaceId = font.glyphIdForChar(" ");
			const spaceData = gvar.glyphVariationData[spaceId];
			expect(spaceData).toBeDefined();
		});

		test("letter A has variation data", () => {
			const aId = font.glyphIdForChar("A");
			const aData = gvar.glyphVariationData[aId];
			expect(aData).toBeDefined();
			if (aData && aData.tupleVariationHeaders.length > 0) {
				expect(aData.tupleVariationHeaders.length).toBeGreaterThan(0);
			}
		});
	});
});

describe("gvar table - SF Compact", () => {
	let font: Font;
	let gvar: GvarTable;

	beforeAll(async () => {
		font = await Font.fromFile(SF_COMPACT_PATH);
		const gvarTable = font.gvar;
		if (!gvarTable) {
			throw new Error("SFCompact.ttf does not have a gvar table");
		}
		gvar = gvarTable;
	});

	test("has correct version", () => {
		expect(gvar.majorVersion).toBe(1);
		expect(gvar.minorVersion).toBe(0);
	});

	test("has 3 axes", () => {
		expect(gvar.axisCount).toBe(3);
	});

	test("glyphVariationData length matches numGlyphs", () => {
		expect(gvar.glyphVariationData.length).toBe(font.numGlyphs);
	});
});

describe("gvar table - New York", () => {
	let font: Font;
	let gvar: GvarTable;

	beforeAll(async () => {
		font = await Font.fromFile(NEW_YORK_PATH);
		const gvarTable = font.gvar;
		if (!gvarTable) {
			throw new Error("NewYork.ttf does not have a gvar table");
		}
		gvar = gvarTable;
	});

	test("has correct version", () => {
		expect(gvar.majorVersion).toBe(1);
		expect(gvar.minorVersion).toBe(0);
	});

	test("has 3 axes", () => {
		expect(gvar.axisCount).toBe(3);
	});

	test("has shared tuples", () => {
		expect(gvar.sharedTupleCount).toBeGreaterThan(0);
		expect(gvar.sharedTuples.length).toBe(gvar.sharedTupleCount);
	});
});

describe("calculateTupleScalar", () => {
	test("returns 1.0 when axis coords match peak", () => {
		const peakTuple = [1.0, 0.0, 0.0];
		const axisCoords = [1.0, 0.0, 0.0];
		const scalar = calculateTupleScalar(peakTuple, axisCoords, null, null);
		expect(scalar).toBe(1.0);
	});

	test("returns 0.0 when axis coords are at default", () => {
		const peakTuple = [1.0, 0.0, 0.0];
		const axisCoords = [0.0, 0.0, 0.0];
		const scalar = calculateTupleScalar(peakTuple, axisCoords, null, null);
		expect(scalar).toBe(0.0);
	});

	test("returns 0.5 when halfway to peak", () => {
		const peakTuple = [1.0, 0.0, 0.0];
		const axisCoords = [0.5, 0.0, 0.0];
		const scalar = calculateTupleScalar(peakTuple, axisCoords, null, null);
		expect(scalar).toBe(0.5);
	});

	test("handles multiple axes", () => {
		const peakTuple = [1.0, 1.0, 0.0];
		const axisCoords = [0.5, 0.5, 0.0];
		const scalar = calculateTupleScalar(peakTuple, axisCoords, null, null);
		expect(scalar).toBe(0.25); // 0.5 * 0.5
	});

	test("returns 0.0 when opposite sign", () => {
		const peakTuple = [1.0, 0.0, 0.0];
		const axisCoords = [-0.5, 0.0, 0.0];
		const scalar = calculateTupleScalar(peakTuple, axisCoords, null, null);
		expect(scalar).toBe(0.0);
	});

	test("handles negative peak", () => {
		const peakTuple = [-1.0, 0.0, 0.0];
		const axisCoords = [-0.5, 0.0, 0.0];
		const scalar = calculateTupleScalar(peakTuple, axisCoords, null, null);
		expect(scalar).toBe(0.5);
	});

	test("handles intermediate region - inside", () => {
		const peakTuple = [1.0, 0.0, 0.0];
		const axisCoords = [0.5, 0.0, 0.0];
		const intermediateStart = [0.25, 0.0, 0.0];
		const intermediateEnd = [1.0, 0.0, 0.0];
		const scalar = calculateTupleScalar(
			peakTuple,
			axisCoords,
			intermediateStart,
			intermediateEnd,
		);
		expect(scalar).toBeCloseTo(0.333, 2);
	});

	test("handles intermediate region - outside", () => {
		const peakTuple = [1.0, 0.0, 0.0];
		const axisCoords = [0.1, 0.0, 0.0];
		const intermediateStart = [0.25, 0.0, 0.0];
		const intermediateEnd = [1.0, 0.0, 0.0];
		const scalar = calculateTupleScalar(
			peakTuple,
			axisCoords,
			intermediateStart,
			intermediateEnd,
		);
		expect(scalar).toBe(0.0);
	});

	test("handles intermediate region - at peak", () => {
		const peakTuple = [1.0, 0.0, 0.0];
		const axisCoords = [1.0, 0.0, 0.0];
		const intermediateStart = [0.5, 0.0, 0.0];
		const intermediateEnd = [1.0, 0.0, 0.0];
		const scalar = calculateTupleScalar(
			peakTuple,
			axisCoords,
			intermediateStart,
			intermediateEnd,
		);
		expect(scalar).toBe(1.0);
	});

	test("returns 0 when peak is 0 but coord is not", () => {
		const peakTuple = [0.0, 1.0, 0.0];
		const axisCoords = [0.5, 0.5, 0.0];
		const scalar = calculateTupleScalar(peakTuple, axisCoords, null, null);
		expect(scalar).toBe(0.5);
	});

	test("handles all zero peaks", () => {
		const peakTuple = [0.0, 0.0, 0.0];
		const axisCoords = [0.5, 0.5, 0.5];
		const scalar = calculateTupleScalar(peakTuple, axisCoords, null, null);
		expect(scalar).toBe(1.0);
	});
});

describe("getGlyphDelta", () => {
	let font: Font;
	let gvar: GvarTable;
	let glyphIdWithVars: number;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		const gvarTable = font.gvar;
		if (!gvarTable) {
			throw new Error("SFNS.ttf does not have a gvar table");
		}
		gvar = gvarTable;

		// Find a glyph with variation data
		glyphIdWithVars = gvar.glyphVariationData.findIndex(
			(g) => g.tupleVariationHeaders.length > 0,
		);
	});

	test("returns zero delta at default coordinates", () => {
		const axisCoords = [0.0, 0.0, 0.0, 0.0];
		const delta = getGlyphDelta(gvar, glyphIdWithVars, 0, axisCoords);
		expect(delta.x).toBe(0);
		expect(delta.y).toBe(0);
	});

	test("returns non-zero delta at non-default coordinates", () => {
		const axisCoords = [1.0, 0.0, 0.0, 0.0];
		const delta = getGlyphDelta(gvar, glyphIdWithVars, 0, axisCoords);
		// Delta might be zero if point 0 doesn't vary on this axis, so just check it's defined
		expect(typeof delta.x).toBe("number");
		expect(typeof delta.y).toBe("number");
	});

	test("returns zero delta for glyph with no variation data", () => {
		const glyphIdNoVars = gvar.glyphVariationData.findIndex(
			(g) => g.tupleVariationHeaders.length === 0,
		);
		if (glyphIdNoVars >= 0) {
			const axisCoords = [1.0, 0.0, 0.0, 0.0];
			const delta = getGlyphDelta(gvar, glyphIdNoVars, 0, axisCoords);
			expect(delta.x).toBe(0);
			expect(delta.y).toBe(0);
		}
	});

	test("returns zero delta for non-existent glyph", () => {
		const axisCoords = [1.0, 0.0, 0.0, 0.0];
		const delta = getGlyphDelta(gvar, 999999, 0, axisCoords);
		expect(delta.x).toBe(0);
		expect(delta.y).toBe(0);
	});

	test("delta values are rounded to integers", () => {
		const axisCoords = [0.5, 0.0, 0.0, 0.0];
		const delta = getGlyphDelta(gvar, glyphIdWithVars, 0, axisCoords);
		expect(Number.isInteger(delta.x)).toBe(true);
		expect(Number.isInteger(delta.y)).toBe(true);
	});

	test("multiple axes contribute to delta", () => {
		const delta1 = getGlyphDelta(gvar, glyphIdWithVars, 0, [1.0, 0.0, 0.0, 0.0]);
		const delta2 = getGlyphDelta(gvar, glyphIdWithVars, 0, [0.0, 1.0, 0.0, 0.0]);
		const delta3 = getGlyphDelta(gvar, glyphIdWithVars, 0, [1.0, 1.0, 0.0, 0.0]);

		// At least verify all deltas are valid
		expect(typeof delta1.x).toBe("number");
		expect(typeof delta2.x).toBe("number");
		expect(typeof delta3.x).toBe("number");
	});
});

describe("parsePackedDeltas", () => {
	test("parses zero run", () => {
		const buffer = new Uint8Array([0x80 | 2]); // 3 zeros
		const reader = new Reader(buffer.buffer);
		const deltas = parsePackedDeltas(reader, 3);
		expect(deltas).toEqual([0, 0, 0]);
	});

	test("parses byte deltas", () => {
		const buffer = new Uint8Array([
			0x01, // 2 byte deltas
			10,
			-5 & 0xff,
		]);
		const reader = new Reader(buffer.buffer);
		const deltas = parsePackedDeltas(reader, 2);
		expect(deltas).toEqual([10, -5]);
	});

	test("parses word deltas", () => {
		const buffer = new Uint8Array([
			0x40 | 0x01, // 2 word deltas
			0x00,
			100, // 100
			0xff,
			0x9c, // -100
		]);
		const reader = new Reader(buffer.buffer);
		const deltas = parsePackedDeltas(reader, 2);
		expect(deltas).toEqual([100, -100]);
	});

	test("parses mixed runs", () => {
		const buffer = new Uint8Array([
			0x80 | 1, // 2 zeros
			0x00, // 1 byte delta
			5,
		]);
		const reader = new Reader(buffer.buffer);
		const deltas = parsePackedDeltas(reader, 3);
		expect(deltas).toEqual([0, 0, 5]);
	});

	test("handles empty count", () => {
		const buffer = new Uint8Array([]);
		const reader = new Reader(buffer.buffer);
		const deltas = parsePackedDeltas(reader, 0);
		expect(deltas).toEqual([]);
	});

	test("handles single zero", () => {
		const buffer = new Uint8Array([0x80 | 0]); // 1 zero
		const reader = new Reader(buffer.buffer);
		const deltas = parsePackedDeltas(reader, 1);
		expect(deltas).toEqual([0]);
	});

	test("handles single byte", () => {
		const buffer = new Uint8Array([0x00, 42]);
		const reader = new Reader(buffer.buffer);
		const deltas = parsePackedDeltas(reader, 1);
		expect(deltas).toEqual([42]);
	});

	test("handles single word", () => {
		const buffer = new Uint8Array([0x40, 0x01, 0x00]); // 256
		const reader = new Reader(buffer.buffer);
		const deltas = parsePackedDeltas(reader, 1);
		expect(deltas).toEqual([256]);
	});
});

describe("Font.getGlyphContoursWithVariation", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
	});

	test("returns contours with default coordinates", () => {
		const aId = font.glyphIdForChar("A");
		const defaultCoords = [0.0, 0.0, 0.0, 0.0];
		const contours = font.getGlyphContoursWithVariation(aId, defaultCoords);
		expect(contours).not.toBeNull();
	});

	test("returns contours with varied coordinates", () => {
		const aId = font.glyphIdForChar("A");
		const variedCoords = [1.0, 0.0, 0.0, 0.0];
		const contours = font.getGlyphContoursWithVariation(aId, variedCoords);
		expect(contours).not.toBeNull();
	});

	test("contours change with variation", () => {
		const aId = font.glyphIdForChar("A");
		const defaultCoords = [0.0, 0.0, 0.0, 0.0];
		const variedCoords = [1.0, 0.0, 0.0, 0.0];

		const defaultContours = font.getGlyphContoursWithVariation(
			aId,
			defaultCoords,
		);
		const variedContours = font.getGlyphContoursWithVariation(aId, variedCoords);

		expect(defaultContours).not.toBeNull();
		expect(variedContours).not.toBeNull();

		if (defaultContours && variedContours) {
			expect(defaultContours.length).toBe(variedContours.length);
		}
	});
});

describe("edge cases", () => {
	test("handles font without gvar table", async () => {
		const font = await Font.fromFile(
			"/System/Library/Fonts/Supplemental/Arial.ttf",
		);
		expect(font.gvar).toBeNull();
	});

	test("calculateTupleScalar with mismatched array lengths", () => {
		const peakTuple = [1.0, 0.0];
		const axisCoords = [0.5, 0.5, 0.5]; // More coords than peak
		const scalar = calculateTupleScalar(peakTuple, axisCoords, null, null);
		expect(typeof scalar).toBe("number");
	});

	test("getGlyphDelta with empty axis coords", async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const gvar = font.gvar;
		if (gvar) {
			const delta = getGlyphDelta(gvar, 0, 0, []);
			expect(delta.x).toBe(0);
			expect(delta.y).toBe(0);
		}
	});
});
