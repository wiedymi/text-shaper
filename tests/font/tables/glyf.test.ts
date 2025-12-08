import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import { Tags } from "../../../src/types.ts";
import {
	parseGlyf,
	parseGlyph,
	getGlyphContours,
	getGlyphBounds,
	getGlyphContoursAndBounds,
	flattenCompositeGlyph,
	getGlyphDeltas,
	applyVariationDeltas,
	getGlyphContoursWithVariation,
	PointFlag,
	CompositeFlag,
	type Glyph,
	type SimpleGlyph,
	type CompositeGlyph,
	type GlyfTable,
	type Contour,
} from "../../../src/font/tables/glyf.ts";
import type {
	GvarTable,
	GlyphVariationData,
	TupleVariationHeader,
	PointDelta,
} from "../../../src/font/tables/gvar.ts";
import { getGlyphLocation, hasGlyphOutline } from "../../../src/font/tables/loca.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

/** Helper to create a mock TupleVariationHeader */
function createMockTupleHeader(
	opts: Partial<TupleVariationHeader> & { deltas: PointDelta[] },
): TupleVariationHeader {
	return {
		variationDataSize: 0,
		tupleIndex: 0,
		serializedData: new Uint8Array(0),
		peakTuple: "peakTuple" in opts ? opts.peakTuple! : [1.0],
		intermediateStartTuple: opts.intermediateStartTuple ?? null,
		intermediateEndTuple: opts.intermediateEndTuple ?? null,
		pointNumbers: opts.pointNumbers ?? null,
		deltas: opts.deltas,
	};
}

/** Helper to create a mock GvarTable for tests */
function createMockGvar(
	glyphVariationData: GlyphVariationData[] = [],
): GvarTable {
	return {
		majorVersion: 1,
		minorVersion: 0,
		axisCount: 1,
		sharedTupleCount: 0,
		sharedTuples: [],
		glyphVariationData,
	};
}

/** Helper to create a simple glyph with numberOfContours = 0 */
function createSimpleGlyphWithZeroContours(): ArrayBuffer {
	const buffer = new ArrayBuffer(10);
	const view = new DataView(buffer);
	view.setInt16(0, 0); // numberOfContours = 0
	view.setInt16(2, 0); // xMin
	view.setInt16(4, 0); // yMin
	view.setInt16(6, 100); // xMax
	view.setInt16(8, 100); // yMax
	return buffer;
}

/** Helper to create a simple glyph with endPtsOfContours issue */
function createSimpleGlyphWithMissingEndPts(): ArrayBuffer {
	const buffer = new ArrayBuffer(12);
	const view = new DataView(buffer);
	view.setInt16(0, 1); // numberOfContours = 1
	view.setInt16(2, 0); // xMin
	view.setInt16(4, 0); // yMin
	view.setInt16(6, 100); // xMax
	view.setInt16(8, 100); // yMax
	// No endPtsOfContours data - reader will return undefined
	return buffer;
}

/** Helper to create composite glyph with specific flags */
function createCompositeGlyphWithFlags(
	flags: number,
	includeInstructions: boolean = false,
): ArrayBuffer {
	const buffer = new ArrayBuffer(24);
	const view = new DataView(buffer);
	view.setInt16(0, -1); // numberOfContours = -1 (composite)
	view.setInt16(2, 0); // xMin
	view.setInt16(4, 0); // yMin
	view.setInt16(6, 100); // xMax
	view.setInt16(8, 100); // yMax
	view.setUint16(10, flags); // component flags (without MoreComponents)
	view.setUint16(12, 1); // glyphIndex

	let offset = 14;
	// Add args based on flags
	if (flags & CompositeFlag.Arg1And2AreWords) {
		if (flags & CompositeFlag.ArgsAreXYValues) {
			view.setInt16(offset, 10);
			offset += 2;
			view.setInt16(offset, 20);
			offset += 2;
		} else {
			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 2);
			offset += 2;
		}
	}

	if (includeInstructions && offset < 24) {
		view.setUint16(offset, 0); // instruction length
	}

	return buffer;
}

/** Helper to create composite glyph with byte args */
function createCompositeGlyphWithByteArgs(argsAreXY: boolean): ArrayBuffer {
	const buffer = new ArrayBuffer(16);
	const view = new DataView(buffer);
	view.setInt16(0, -1); // numberOfContours = -1 (composite)
	view.setInt16(2, 0); // xMin
	view.setInt16(4, 0); // yMin
	view.setInt16(6, 100); // xMax
	view.setInt16(8, 100); // yMax

	// Flags without Arg1And2AreWords (byte args)
	const flags = argsAreXY ? CompositeFlag.ArgsAreXYValues : 0;
	view.setUint16(10, flags); // component flags (no MoreComponents)
	view.setUint16(12, 1); // glyphIndex

	if (argsAreXY) {
		view.setInt8(14, 5); // arg1 (int8)
		view.setInt8(15, 10); // arg2 (int8)
	} else {
		view.setUint8(14, 1); // arg1 (uint8, point number)
		view.setUint8(15, 2); // arg2 (uint8, point number)
	}

	return buffer;
}

/** Helper to create composite glyph with transformation */
function createCompositeGlyphWithTransform(transformType: "scale" | "xyscale" | "2x2"): ArrayBuffer {
	const buffer = new ArrayBuffer(32);
	const view = new DataView(buffer);
	view.setInt16(0, -1); // numberOfContours = -1 (composite)
	view.setInt16(2, 0); // xMin
	view.setInt16(4, 0); // yMin
	view.setInt16(6, 100); // xMax
	view.setInt16(8, 100); // yMax

	let flags = CompositeFlag.Arg1And2AreWords | CompositeFlag.ArgsAreXYValues;
	let offset = 10;

	if (transformType === "scale") {
		flags |= CompositeFlag.WeHaveAScale;
	} else if (transformType === "xyscale") {
		flags |= CompositeFlag.WeHaveAnXAndYScale;
	} else if (transformType === "2x2") {
		flags |= CompositeFlag.WeHaveATwoByTwo;
	}

	view.setUint16(offset, flags);
	offset += 2;
	view.setUint16(offset, 1); // glyphIndex
	offset += 2;
	view.setInt16(offset, 10); // arg1
	offset += 2;
	view.setInt16(offset, 20); // arg2
	offset += 2;

	// F2DOT14 format: value * 16384
	if (transformType === "scale") {
		view.setInt16(offset, 8192); // 0.5 in F2DOT14
	} else if (transformType === "xyscale") {
		view.setInt16(offset, 8192); // a = 0.5
		offset += 2;
		view.setInt16(offset, 12288); // d = 0.75
	} else if (transformType === "2x2") {
		view.setInt16(offset, 8192); // a = 0.5
		offset += 2;
		view.setInt16(offset, 4096); // b = 0.25
		offset += 2;
		view.setInt16(offset, 4096); // c = 0.25
		offset += 2;
		view.setInt16(offset, 8192); // d = 0.5
	}

	return buffer;
}

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("glyf table", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("parseGlyf", () => {
		test("returns GlyfTable with reader", () => {
			if (font.isTrueType) {
				const reader = font.getTableReader(Tags.glyf);
				if (reader) {
					const glyf = parseGlyf(reader);
					expect(glyf).toBeDefined();
					expect(glyf.reader).toBeDefined();
				}
			}
		});
	});

	describe("parseGlyph", () => {
		test("parses simple glyph for 'A'", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const glyph = parseGlyph(font.glyf, font.loca, glyphId);
				expect(glyph).toBeDefined();
				expect(["simple", "composite", "empty"]).toContain(glyph.type);
			}
		});

		test("parses glyph 0 (notdef)", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyph = parseGlyph(font.glyf, font.loca, 0);
				expect(glyph).toBeDefined();
			}
		});

		test("returns empty glyph for space", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const spaceId = font.glyphId(0x20);
				const glyph = parseGlyph(font.glyf, font.loca, spaceId);
				expect(glyph).toBeDefined();
				if (glyph.type === "empty") {
					expect(glyph.type).toBe("empty");
				}
			}
		});

		test("returns empty for invalid glyph ID", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyph = parseGlyph(font.glyf, font.loca, 99999);
				expect(glyph.type).toBe("empty");
			}
		});

		test("simple glyph has required properties", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const glyph = parseGlyph(font.glyf, font.loca, glyphId);
				if (glyph.type === "simple") {
					expect(glyph.numberOfContours).toBeGreaterThanOrEqual(0);
					expect(typeof glyph.xMin).toBe("number");
					expect(typeof glyph.yMin).toBe("number");
					expect(typeof glyph.xMax).toBe("number");
					expect(typeof glyph.yMax).toBe("number");
					expect(Array.isArray(glyph.contours)).toBe(true);
					expect(glyph.instructions).toBeInstanceOf(Uint8Array);
				}
			}
		});

		test("composite glyph has required properties", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				// Find a composite glyph by iterating
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						expect(glyph.numberOfContours).toBeLessThan(0);
						expect(Array.isArray(glyph.components)).toBe(true);
						expect(glyph.components.length).toBeGreaterThan(0);
						expect(glyph.instructions).toBeInstanceOf(Uint8Array);
						break;
					}
				}
			}
		});
	});

	describe("PointFlag constants", () => {
		test("has correct values", () => {
			expect(PointFlag.OnCurve).toBe(0x01);
			expect(PointFlag.XShortVector).toBe(0x02);
			expect(PointFlag.YShortVector).toBe(0x04);
			expect(PointFlag.Repeat).toBe(0x08);
			expect(PointFlag.XIsSameOrPositive).toBe(0x10);
			expect(PointFlag.YIsSameOrPositive).toBe(0x20);
			expect(PointFlag.OverlapSimple).toBe(0x40);
		});
	});

	describe("CompositeFlag constants", () => {
		test("has correct values", () => {
			expect(CompositeFlag.Arg1And2AreWords).toBe(0x0001);
			expect(CompositeFlag.ArgsAreXYValues).toBe(0x0002);
			expect(CompositeFlag.RoundXYToGrid).toBe(0x0004);
			expect(CompositeFlag.WeHaveAScale).toBe(0x0008);
			expect(CompositeFlag.MoreComponents).toBe(0x0020);
			expect(CompositeFlag.WeHaveAnXAndYScale).toBe(0x0040);
			expect(CompositeFlag.WeHaveATwoByTwo).toBe(0x0080);
			expect(CompositeFlag.WeHaveInstructions).toBe(0x0100);
			expect(CompositeFlag.UseMyMetrics).toBe(0x0200);
			expect(CompositeFlag.OverlapCompound).toBe(0x0400);
			expect(CompositeFlag.ScaledComponentOffset).toBe(0x0800);
			expect(CompositeFlag.UnscaledComponentOffset).toBe(0x1000);
		});
	});

	describe("simple glyph edge cases with synthetic data", () => {
		test("handles simple glyph with numberOfContours = 0", () => {
			const buffer = createSimpleGlyphWithZeroContours();
			const reader = new Reader(buffer);
			const glyf: GlyfTable = { reader };
			const mockLoca = {
				format: 0 as const,
				offsets: [0, 10],
			};
			const glyph = parseGlyph(glyf, mockLoca, 0);
			expect(glyph.type).toBe("simple");
			if (glyph.type === "simple") {
				expect(glyph.numberOfContours).toBe(0);
				expect(glyph.contours).toEqual([]);
				expect(glyph.instructions.length).toBe(0);
			}
		});
	});

	describe("composite glyph argument parsing with synthetic data", () => {
		test("parses composite with word args and point numbers (not XY)", () => {
			const buffer = createCompositeGlyphWithFlags(
				CompositeFlag.Arg1And2AreWords,
				false,
			);
			const reader = new Reader(buffer);
			const glyf: GlyfTable = { reader };
			const mockLoca = {
				format: 0 as const,
				offsets: [0, 24],
			};
			const glyph = parseGlyph(glyf, mockLoca, 0);
			expect(glyph.type).toBe("composite");
			if (glyph.type === "composite") {
				expect(glyph.components[0]?.arg1).toBeDefined();
				expect(glyph.components[0]?.arg2).toBeDefined();
			}
		});

		test("parses composite with byte args and XY values", () => {
			const buffer = createCompositeGlyphWithByteArgs(true);
			const reader = new Reader(buffer);
			const glyf: GlyfTable = { reader };
			const mockLoca = {
				format: 0 as const,
				offsets: [0, 16],
			};
			const glyph = parseGlyph(glyf, mockLoca, 0);
			expect(glyph.type).toBe("composite");
			if (glyph.type === "composite") {
				expect(glyph.components[0]?.arg1).toBe(5);
				expect(glyph.components[0]?.arg2).toBe(10);
			}
		});

		test("parses composite with byte args and point numbers", () => {
			const buffer = createCompositeGlyphWithByteArgs(false);
			const reader = new Reader(buffer);
			const glyf: GlyfTable = { reader };
			const mockLoca = {
				format: 0 as const,
				offsets: [0, 16],
			};
			const glyph = parseGlyph(glyf, mockLoca, 0);
			expect(glyph.type).toBe("composite");
			if (glyph.type === "composite") {
				expect(glyph.components[0]?.arg1).toBe(1);
				expect(glyph.components[0]?.arg2).toBe(2);
			}
		});
	});

	describe("composite glyph transformation parsing with synthetic data", () => {
		test("parses composite with WeHaveAScale", () => {
			const buffer = createCompositeGlyphWithTransform("scale");
			const reader = new Reader(buffer);
			const glyf: GlyfTable = { reader };
			const mockLoca = {
				format: 0 as const,
				offsets: [0, 32],
			};
			const glyph = parseGlyph(glyf, mockLoca, 0);
			expect(glyph.type).toBe("composite");
			if (glyph.type === "composite") {
				const [a, b, c, d] = glyph.components[0]!.transform;
				expect(a).toBeCloseTo(0.5, 2);
				expect(a).toBe(d); // Scale applies to both a and d
				expect(b).toBe(0);
				expect(c).toBe(0);
			}
		});

		test("parses composite with WeHaveAnXAndYScale", () => {
			const buffer = createCompositeGlyphWithTransform("xyscale");
			const reader = new Reader(buffer);
			const glyf: GlyfTable = { reader };
			const mockLoca = {
				format: 0 as const,
				offsets: [0, 32],
			};
			const glyph = parseGlyph(glyf, mockLoca, 0);
			expect(glyph.type).toBe("composite");
			if (glyph.type === "composite") {
				const [a, b, c, d] = glyph.components[0]!.transform;
				expect(a).toBeCloseTo(0.5, 2);
				expect(d).toBeCloseTo(0.75, 2);
				expect(b).toBe(0);
				expect(c).toBe(0);
			}
		});

		test("parses composite with WeHaveATwoByTwo", () => {
			const buffer = createCompositeGlyphWithTransform("2x2");
			const reader = new Reader(buffer);
			const glyf: GlyfTable = { reader };
			const mockLoca = {
				format: 0 as const,
				offsets: [0, 32],
			};
			const glyph = parseGlyph(glyf, mockLoca, 0);
			expect(glyph.type).toBe("composite");
			if (glyph.type === "composite") {
				const [a, b, c, d] = glyph.components[0]!.transform;
				expect(a).toBeCloseTo(0.5, 2);
				expect(b).toBeCloseTo(0.25, 2);
				expect(c).toBeCloseTo(0.25, 2);
				expect(d).toBeCloseTo(0.5, 2);
			}
		});
	});

	describe("flattenCompositeGlyph with empty components", () => {
		test("skips empty component glyphs", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				// Create a mock composite glyph pointing to an empty glyph
				const mockComposite: CompositeGlyph = {
					type: "composite",
					numberOfContours: -1,
					xMin: 0,
					yMin: 0,
					xMax: 100,
					yMax: 100,
					components: [
						{
							glyphId: 99999, // Invalid glyph ID that returns empty
							flags: CompositeFlag.ArgsAreXYValues,
							arg1: 0,
							arg2: 0,
							transform: [1, 0, 0, 1],
						},
					],
					instructions: new Uint8Array(0),
				};

				const contours = flattenCompositeGlyph(font.glyf, font.loca, mockComposite);
				expect(Array.isArray(contours)).toBe(true);
			}
		});
	});

	describe("composite cache LRU eviction", () => {
		test("evicts oldest entry when cache is full", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				// Find 257 composite glyphs to exceed the cache size of 256
				const compositeIds: number[] = [];
				for (let i = 0; i < font.numGlyphs && compositeIds.length < 257; i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						compositeIds.push(i);
					}
				}

				if (compositeIds.length >= 257) {
					// Fill cache with 256 entries
					for (let i = 0; i < 256; i++) {
						getGlyphContours(font.glyf, font.loca, compositeIds[i]!);
					}

					// Add one more to trigger eviction
					const contours = getGlyphContours(font.glyf, font.loca, compositeIds[256]!);
					expect(Array.isArray(contours)).toBe(true);
				}
			}
		});
	});

	describe("getGlyphContoursAndBounds", () => {
		test("returns contours and bounds for simple glyph", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const result = getGlyphContoursAndBounds(font.glyf, font.loca, glyphId);
				expect(Array.isArray(result.contours)).toBe(true);
				if (result.bounds) {
					expect(typeof result.bounds.xMin).toBe("number");
					expect(typeof result.bounds.yMin).toBe("number");
					expect(typeof result.bounds.xMax).toBe("number");
					expect(typeof result.bounds.yMax).toBe("number");
				}
			}
		});

		test("returns empty contours and null bounds for empty glyph", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const spaceId = font.glyphId(0x20);
				const result = getGlyphContoursAndBounds(font.glyf, font.loca, spaceId);
				expect(result.contours).toEqual([]);
				expect(result.bounds).toBeNull();
			}
		});

		test("returns cached contours for composite glyph", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				// Find a composite glyph
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						// First call populates cache
						const result1 = getGlyphContoursAndBounds(font.glyf, font.loca, i);
						// Second call uses cache
						const result2 = getGlyphContoursAndBounds(font.glyf, font.loca, i);
						expect(result1.contours).toBe(result2.contours); // Same reference from cache
						expect(result1.bounds).toBeDefined();
						expect(result2.bounds).toBeDefined();
						break;
					}
				}
			}
		});

		test("handles composite glyph cache eviction in getGlyphContoursAndBounds", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const compositeIds: number[] = [];
				for (let i = 0; i < font.numGlyphs && compositeIds.length < 257; i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						compositeIds.push(i);
					}
				}

				if (compositeIds.length >= 257) {
					// Fill cache
					for (let i = 0; i < 256; i++) {
						getGlyphContoursAndBounds(font.glyf, font.loca, compositeIds[i]!);
					}

					// Trigger eviction
					const result = getGlyphContoursAndBounds(font.glyf, font.loca, compositeIds[256]!);
					expect(Array.isArray(result.contours)).toBe(true);
					expect(result.bounds).toBeDefined();
				}
			}
		});
	});

	describe("flattenCompositeGlyphWithVariation depth limit", () => {
		test("returns empty array when depth exceeds 32", () => {
			// Create a chain of 35 nested composite glyphs to test depth limit
			// Each glyph points to the next one, creating deep nesting
			const numGlyphs = 35;
			const buffers: ArrayBuffer[] = [];

			// Create simple glyph at the end of the chain (glyph 0)
			const simpleBuffer = new ArrayBuffer(10);
			const simpleView = new DataView(simpleBuffer);
			simpleView.setInt16(0, 1); // numberOfContours = 1
			simpleView.setInt16(2, 0); // xMin
			simpleView.setInt16(4, 0); // yMin
			simpleView.setInt16(6, 10); // xMax
			simpleView.setInt16(8, 10); // yMax
			buffers.push(simpleBuffer);

			// Create composite glyphs that point to each other
			for (let i = 1; i < numGlyphs; i++) {
				const buffer = new ArrayBuffer(20);
				const view = new DataView(buffer);
				view.setInt16(0, -1); // numberOfContours = -1 (composite)
				view.setInt16(2, 0); // xMin
				view.setInt16(4, 0); // yMin
				view.setInt16(6, 10); // xMax
				view.setInt16(8, 10); // yMax
				view.setUint16(10, CompositeFlag.ArgsAreXYValues); // flags (no MoreComponents)
				view.setUint16(12, i - 1); // glyphIndex points to previous glyph
				view.setInt8(14, 0); // arg1
				view.setInt8(15, 0); // arg2
				buffers.push(buffer);
			}

			// Concatenate all buffers
			const totalSize = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
			const combined = new ArrayBuffer(totalSize);
			const combinedView = new Uint8Array(combined);
			const offsets: number[] = [0];
			let offset = 0;

			for (const buffer of buffers) {
				combinedView.set(new Uint8Array(buffer), offset);
				offset += buffer.byteLength;
				offsets.push(offset);
			}

			const reader = new Reader(combined);
			const glyf: GlyfTable = { reader };
			const mockLoca = {
				format: 0 as const,
				offsets,
			};
			const mockGvar = createMockGvar([]);

			// Get the deepest composite glyph (last one in chain)
			const contours = getGlyphContoursWithVariation(
				glyf,
				mockLoca,
				mockGvar,
				numGlyphs - 1,
				[0.5],
			);

			// Should return empty array due to depth limit
			expect(contours).toEqual([]);
		});
	});

	describe("simple glyph structure", () => {
		test("contours contain points with x, y, onCurve", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const glyph = parseGlyph(font.glyf, font.loca, glyphId);
				if (glyph.type === "simple") {
					for (const contour of glyph.contours) {
						for (const point of contour) {
							expect(typeof point.x).toBe("number");
							expect(typeof point.y).toBe("number");
							expect(typeof point.onCurve).toBe("boolean");
						}
					}
				}
			}
		});

		test("numberOfContours matches contours array length", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const glyph = parseGlyph(font.glyf, font.loca, glyphId);
				if (glyph.type === "simple") {
					expect(glyph.contours.length).toBe(glyph.numberOfContours);
				}
			}
		});

		test("bounding box is valid", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const glyph = parseGlyph(font.glyf, font.loca, glyphId);
				if (glyph.type === "simple") {
					expect(glyph.xMax).toBeGreaterThanOrEqual(glyph.xMin);
					expect(glyph.yMax).toBeGreaterThanOrEqual(glyph.yMin);
				}
			}
		});
	});

	describe("composite glyph structure", () => {
		test("components have required properties", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							expect(typeof comp.glyphId).toBe("number");
							expect(typeof comp.flags).toBe("number");
							expect(typeof comp.arg1).toBe("number");
							expect(typeof comp.arg2).toBe("number");
							expect(Array.isArray(comp.transform)).toBe(true);
							expect(comp.transform.length).toBe(4);
						}
						break;
					}
				}
			}
		});

		test("transform matrix has valid values", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							for (const val of comp.transform) {
								expect(typeof val).toBe("number");
							}
						}
						break;
					}
				}
			}
		});
	});

	describe("getGlyphContours", () => {
		test("returns contours for simple glyph", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const contours = getGlyphContours(font.glyf, font.loca, glyphId);
				expect(Array.isArray(contours)).toBe(true);
			}
		});

		test("returns empty array for empty glyph", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const spaceId = font.glyphId(0x20);
				const contours = getGlyphContours(font.glyf, font.loca, spaceId);
				expect(contours).toEqual([]);
			}
		});

		test("returns contours for glyph 0", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const contours = getGlyphContours(font.glyf, font.loca, 0);
				expect(Array.isArray(contours)).toBe(true);
			}
		});

		test("flattens composite glyphs", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						const contours = getGlyphContours(font.glyf, font.loca, i);
						expect(Array.isArray(contours)).toBe(true);
						break;
					}
				}
			}
		});

		test("contours have valid points", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const contours = getGlyphContours(font.glyf, font.loca, glyphId);
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
	});

	describe("getGlyphBounds", () => {
		test("returns bounds for glyph with outline", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const bounds = getGlyphBounds(font.glyf, font.loca, glyphId);
				if (bounds) {
					expect(typeof bounds.xMin).toBe("number");
					expect(typeof bounds.yMin).toBe("number");
					expect(typeof bounds.xMax).toBe("number");
					expect(typeof bounds.yMax).toBe("number");
					expect(bounds.xMax).toBeGreaterThanOrEqual(bounds.xMin);
					expect(bounds.yMax).toBeGreaterThanOrEqual(bounds.yMin);
				}
			}
		});

		test("returns null for empty glyph", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const spaceId = font.glyphId(0x20);
				const bounds = getGlyphBounds(font.glyf, font.loca, spaceId);
				expect(bounds).toBeNull();
			}
		});

		test("returns null for invalid glyph ID", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const bounds = getGlyphBounds(font.glyf, font.loca, 99999);
				expect(bounds).toBeNull();
			}
		});

		test("bounds for multiple glyphs", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let cp = 0x41; cp <= 0x5a; cp++) {
					const glyphId = font.glyphId(cp);
					const bounds = getGlyphBounds(font.glyf, font.loca, glyphId);
					if (bounds) {
						expect(bounds.xMax).toBeGreaterThanOrEqual(bounds.xMin);
					}
				}
			}
		});
	});

	describe("flattenCompositeGlyph", () => {
		test("returns contours for composite glyph", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						const contours = flattenCompositeGlyph(font.glyf, font.loca, glyph);
						expect(Array.isArray(contours)).toBe(true);
						break;
					}
				}
			}
		});

		test("prevents infinite recursion with depth limit", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						const contours = flattenCompositeGlyph(font.glyf, font.loca, glyph, 35);
						expect(contours).toEqual([]);
						break;
					}
				}
			}
		});

		test("applies transformations to components", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						const contours = flattenCompositeGlyph(font.glyf, font.loca, glyph);
						for (const contour of contours) {
							for (const point of contour) {
								expect(Number.isInteger(point.x)).toBe(true);
								expect(Number.isInteger(point.y)).toBe(true);
							}
						}
						break;
					}
				}
			}
		});
	});

	describe("applyVariationDeltas", () => {
		test("applies deltas to contours", () => {
			const contours: Contour[] = [
				[
					{ x: 0, y: 0, onCurve: true },
					{ x: 100, y: 0, onCurve: true },
					{ x: 100, y: 100, onCurve: true },
				],
			];
			const deltas = [
				{ x: 10, y: 20 },
				{ x: 5, y: -5 },
				{ x: 0, y: 0 },
			];
			const result = applyVariationDeltas(contours, deltas);
			expect(result[0]?.[0]?.x).toBe(10);
			expect(result[0]?.[0]?.y).toBe(20);
			expect(result[0]?.[1]?.x).toBe(105);
			expect(result[0]?.[1]?.y).toBe(-5);
		});

		test("handles empty contours", () => {
			const result = applyVariationDeltas([], []);
			expect(result).toEqual([]);
		});

		test("handles missing deltas", () => {
			const contours: Contour[] = [
				[
					{ x: 0, y: 0, onCurve: true },
					{ x: 100, y: 0, onCurve: true },
				],
			];
			const deltas = [{ x: 10, y: 20 }];
			const result = applyVariationDeltas(contours, deltas);
			expect(result[0]?.[1]?.x).toBe(100);
			expect(result[0]?.[1]?.y).toBe(0);
		});

		test("preserves onCurve flag", () => {
			const contours: Contour[] = [
				[
					{ x: 0, y: 0, onCurve: true },
					{ x: 50, y: 50, onCurve: false },
				],
			];
			const deltas = [
				{ x: 1, y: 1 },
				{ x: 1, y: 1 },
			];
			const result = applyVariationDeltas(contours, deltas);
			expect(result[0]?.[0]?.onCurve).toBe(true);
			expect(result[0]?.[1]?.onCurve).toBe(false);
		});
	});

	describe("getGlyphContoursWithVariation", () => {
		test("returns contours without variation for null gvar", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const contours = getGlyphContoursWithVariation(
					font.glyf,
					font.loca,
					null,
					glyphId,
				);
				expect(Array.isArray(contours)).toBe(true);
			}
		});

		test("returns contours without coords", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const contours = getGlyphContoursWithVariation(
					font.glyf,
					font.loca,
					null,
					glyphId,
					undefined,
				);
				expect(Array.isArray(contours)).toBe(true);
			}
		});

		test("handles empty axis coords", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const contours = getGlyphContoursWithVariation(
					font.glyf,
					font.loca,
					null,
					glyphId,
					[],
				);
				expect(Array.isArray(contours)).toBe(true);
			}
		});
	});

	describe("edge cases", () => {
		test("parseGlyph with glyph at boundary", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyf = font.glyf;
				const loca = font.loca;
				const lastGlyph = font.numGlyphs - 1;
				expect(() => parseGlyph(glyf, loca, lastGlyph)).not.toThrow();
			}
		});

		test("parseGlyph with negative glyph ID", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyph = parseGlyph(font.glyf, font.loca, -1);
				expect(glyph.type).toBe("empty");
			}
		});

		test("getGlyphBounds with negative ID", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const bounds = getGlyphBounds(font.glyf, font.loca, -1);
				expect(bounds).toBeNull();
			}
		});

		test("getGlyphContours with out of range ID", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const contours = getGlyphContours(font.glyf, font.loca, 99999);
				expect(contours).toEqual([]);
			}
		});

		test("handles all ASCII printable characters", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyf = font.glyf;
				const loca = font.loca;
				for (let cp = 0x20; cp < 0x7f; cp++) {
					const glyphId = font.glyphId(cp);
					expect(() => parseGlyph(glyf, loca, glyphId)).not.toThrow();
				}
			}
		});
	});

	describe("performance", () => {
		test("parses multiple glyphs efficiently", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const start = performance.now();
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					parseGlyph(font.glyf, font.loca, i);
				}
				const elapsed = performance.now() - start;
				expect(elapsed).toBeLessThan(1000);
			}
		});
	});

	describe("getGlyphDeltas function", () => {
		test("returns zero deltas when gvar has no data for glyph", () => {
			const mockGvar = createMockGvar([]);
			const deltas = getGlyphDeltas(mockGvar, 10, 5, [0.5]);
			expect(deltas.length).toBe(5);
			expect(deltas[0]?.x).toBe(0);
			expect(deltas[0]?.y).toBe(0);
		});

		test("returns zero deltas when glyphData exists but tupleVariationHeaders is empty", () => {
			const mockGvar = createMockGvar([{ tupleVariationHeaders: [] }]);
			const deltas = getGlyphDeltas(mockGvar, 0, 5, [0.5]);
			expect(deltas.length).toBe(5);
		});

		test("rounds final delta values", () => {
			const mockGvar = createMockGvar([
				{
					tupleVariationHeaders: [
						createMockTupleHeader({
							deltas: [
								{ x: 10.6, y: 20.4 },
								{ x: 5.2, y: -5.8 },
							],
						}),
					],
				},
			]);
			const deltas = getGlyphDeltas(mockGvar, 0, 2, [1.0]);
			expect(deltas[0]?.x).toBe(11);
			expect(deltas[0]?.y).toBe(20);
			expect(deltas[1]?.x).toBe(5);
			expect(deltas[1]?.y).toBe(-6);
		});

		test("handles sparse point deltas", () => {
			const mockGvar = createMockGvar([
				{
					tupleVariationHeaders: [
						createMockTupleHeader({
							pointNumbers: [0, 2],
							deltas: [
								{ x: 10, y: 20 },
								{ x: 5, y: -5 },
							],
						}),
					],
				},
			]);
			const deltas = getGlyphDeltas(mockGvar, 0, 5, [1.0]);
			expect(deltas[0]?.x).toBe(10);
			expect(deltas[0]?.y).toBe(20);
			expect(deltas[1]?.x).toBe(0);
			expect(deltas[1]?.y).toBe(0);
			expect(deltas[2]?.x).toBe(5);
			expect(deltas[2]?.y).toBe(-5);
		});

		test("handles pointNumbers out of range", () => {
			const mockGvar = createMockGvar([
				{
					tupleVariationHeaders: [
						createMockTupleHeader({
							pointNumbers: [0, 10],
							deltas: [
								{ x: 10, y: 20 },
								{ x: 5, y: -5 },
							],
						}),
					],
				},
			]);
			const deltas = getGlyphDeltas(mockGvar, 0, 5, [1.0]);
			expect(deltas[0]?.x).toBe(10);
			expect(deltas.length).toBe(5);
		});

		test("handles deltas length exceeding numPoints", () => {
			const mockGvar = createMockGvar([
				{
					tupleVariationHeaders: [
						createMockTupleHeader({
							deltas: [
								{ x: 10, y: 20 },
								{ x: 5, y: -5 },
								{ x: 3, y: -3 },
							],
						}),
					],
				},
			]);
			const deltas = getGlyphDeltas(mockGvar, 0, 2, [1.0]);
			expect(deltas.length).toBe(2);
			expect(deltas[0]?.x).toBe(10);
			expect(deltas[1]?.x).toBe(5);
		});

		test("skips tuples with no peakTuple", () => {
			const mockGvar = createMockGvar([
				{
					tupleVariationHeaders: [
						createMockTupleHeader({
							peakTuple: null,
							deltas: [{ x: 10, y: 20 }],
						}),
					],
				},
			]);
			const deltas = getGlyphDeltas(mockGvar, 0, 1, [1.0]);
			expect(deltas[0]?.x).toBe(0);
			expect(deltas[0]?.y).toBe(0);
		});
	});

	describe("getGlyphContoursWithVariation function", () => {
		test("returns empty array for empty glyph", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const spaceId = font.glyphId(0x20);
				const contours = getGlyphContoursWithVariation(
					font.glyf,
					font.loca,
					null,
					spaceId,
				);
				expect(contours).toEqual([]);
			}
		});

		test("returns simple glyph contours without variation", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const glyph = parseGlyph(font.glyf, font.loca, glyphId);
				if (glyph.type === "simple") {
					const contours = getGlyphContoursWithVariation(
						font.glyf,
						font.loca,
						null,
						glyphId,
					);
					expect(contours).toEqual(glyph.contours);
				}
			}
		});

		test("returns composite glyph contours with variation", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						const mockGvar = createMockGvar([]);
						const contours = getGlyphContoursWithVariation(
							font.glyf,
							font.loca,
							mockGvar,
							i,
							[0.5],
						);
						expect(Array.isArray(contours)).toBe(true);
						break;
					}
				}
			}
		});

		test("applies variation to simple glyph with gvar and coords", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const mockGvar = createMockGvar([]);
				const contours = getGlyphContoursWithVariation(
					font.glyf,
					font.loca,
					mockGvar,
					glyphId,
					[0.5],
				);
				expect(Array.isArray(contours)).toBe(true);
			}
		});

		test("handles empty axis coordinates", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const mockGvar = createMockGvar([]);
				const contours = getGlyphContoursWithVariation(
					font.glyf,
					font.loca,
					mockGvar,
					glyphId,
					[],
				);
				expect(Array.isArray(contours)).toBe(true);
			}
		});

		test("handles nested composite glyphs with variation", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				// Find a composite glyph with composite components
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							const componentGlyph = parseGlyph(font.glyf, font.loca, comp.glyphId);
							if (componentGlyph.type === "composite") {
								const mockGvar = createMockGvar([]);
								const contours = getGlyphContoursWithVariation(
									font.glyf,
									font.loca,
									mockGvar,
									i,
									[0.5],
								);
								expect(Array.isArray(contours)).toBe(true);
								return;
							}
						}
					}
				}
			}
		});
	});

	describe("loca table - short format", () => {
		let lepchaFont: Font;

		beforeAll(async () => {
			// NotoSansLepcha uses short loca format (indexToLocFormat = 0)
			lepchaFont = await Font.fromFile("tests/fixtures/NotoSansLepcha-Regular.ttf");
		});

		test("parses font with short loca format", () => {
			expect(lepchaFont.loca).toBeDefined();
			if (lepchaFont.loca) {
				expect(lepchaFont.loca.isShort).toBe(true);
				expect(lepchaFont.loca.offsets.length).toBeGreaterThan(0);
			}
		});

		test("short format offsets are multiplied by 2", () => {
			if (lepchaFont.loca && lepchaFont.loca.isShort) {
				// All offsets in short format should be even (since raw uint16 values are multiplied by 2)
				for (const offset of lepchaFont.loca.offsets) {
					expect(offset % 2).toBe(0);
				}
			}
		});

		test("can parse glyphs using short loca format", () => {
			if (lepchaFont.isTrueType && lepchaFont.glyf && lepchaFont.loca) {
				// Parse glyph 0 (notdef)
				const notdef = parseGlyph(lepchaFont.glyf, lepchaFont.loca, 0);
				expect(notdef).toBeDefined();
				expect(["simple", "composite", "empty"]).toContain(notdef.type);

				// Parse a few more glyphs
				for (let i = 1; i < Math.min(10, lepchaFont.numGlyphs); i++) {
					const glyph = parseGlyph(lepchaFont.glyf, lepchaFont.loca, i);
					expect(glyph).toBeDefined();
				}
			}
		});

		test("getGlyphContours works with short loca format", () => {
			if (lepchaFont.isTrueType && lepchaFont.glyf && lepchaFont.loca) {
				for (let i = 0; i < Math.min(10, lepchaFont.numGlyphs); i++) {
					const contours = getGlyphContours(lepchaFont.glyf, lepchaFont.loca, i);
					expect(Array.isArray(contours)).toBe(true);
				}
			}
		});

		test("getGlyphLocation works with short loca format", () => {
			if (lepchaFont.loca) {
				// Glyph 0 should have a location
				const loc0 = getGlyphLocation(lepchaFont.loca, 0);
				expect(loc0).not.toBeNull();
				if (loc0) {
					expect(loc0.offset).toBeGreaterThanOrEqual(0);
					expect(loc0.length).toBeGreaterThan(0);
				}
			}
		});
	});

	describe("loca table - edge cases", () => {
		test("getGlyphLocation returns null for out of range glyph ID", () => {
			if (font.loca) {
				const loc = getGlyphLocation(font.loca, 99999);
				expect(loc).toBeNull();
			}
		});

		test("getGlyphLocation returns null for negative glyph ID", () => {
			if (font.loca) {
				const loc = getGlyphLocation(font.loca, -1);
				expect(loc).toBeNull();
			}
		});

		test("getGlyphLocation handles glyph at boundary", () => {
			if (font.loca) {
				const lastGlyphId = font.loca.offsets.length - 2; // -1 for array index, -1 because loca has numGlyphs+1 entries
				const loc = getGlyphLocation(font.loca, lastGlyphId);
				// May or may not have outline data, but shouldn't throw
				expect(loc === null || (typeof loc.offset === "number" && typeof loc.length === "number")).toBe(true);
			}
		});

		test("getGlyphLocation returns null for undefined offsets", () => {
			// Create a mock loca table with sparse offsets array
			const mockLoca = {
				offsets: [0, 100], // Only 2 entries, so glyph 1 (needs index 1 and 2) will have undefined nextOffset
				isShort: false,
			};
			// Glyph 1 tries to access offsets[1] and offsets[2], but offsets[2] is undefined
			const loc = getGlyphLocation(mockLoca, 1);
			expect(loc).toBeNull();
		});

		test("getGlyphLocation returns null when offset is undefined", () => {
			// Create a loca table with explicit undefined via sparse array
			const sparseArray: number[] = [];
			sparseArray[0] = 0;
			// sparseArray[1] is undefined
			sparseArray[2] = 200;
			const mockLoca = {
				offsets: sparseArray,
				isShort: false,
			};
			// Glyph 1 tries to access offsets[1] (undefined) and offsets[2] (200)
			const loc = getGlyphLocation(mockLoca, 1);
			expect(loc).toBeNull();
		});

		test("hasGlyphOutline returns true for glyph with outline", () => {
			if (font.loca) {
				// Glyph 0 (notdef) typically has an outline
				const hasOutline = hasGlyphOutline(font.loca, 0);
				expect(typeof hasOutline).toBe("boolean");
				// Most fonts have notdef with outline
				expect(hasOutline).toBe(true);
			}
		});

		test("hasGlyphOutline returns false for space glyph", () => {
			if (font.loca) {
				// Space typically has no outline
				const spaceId = font.glyphId(0x20);
				const hasOutline = hasGlyphOutline(font.loca, spaceId);
				expect(hasOutline).toBe(false);
			}
		});

		test("hasGlyphOutline returns false for invalid glyph", () => {
			if (font.loca) {
				const hasOutline = hasGlyphOutline(font.loca, 99999);
				expect(hasOutline).toBe(false);
			}
		});
	});
});
