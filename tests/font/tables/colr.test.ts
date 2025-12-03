import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseColr,
	getColorLayers,
	getColorPaint,
	hasColorGlyph,
	getClipBox,
	getLayerPaint,
	isColrV1,
	PaintFormat,
	Extend,
	CompositeMode,
	type ColrTable,
	type BaseGlyphRecord,
	type LayerRecord,
	type Paint,
	type PaintSolid,
	type PaintColrLayers,
} from "../../../src/font/tables/colr.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const EMOJI_FONT_PATH = "/System/Library/Fonts/Apple Color Emoji.ttc";

describe("colr table", () => {
	let font: Font | null = null;
	let colr: ColrTable | null = null;

	beforeAll(async () => {
		try {
			font = await Font.fromFile(EMOJI_FONT_PATH);
			if (font.colr) {
				colr = font.colr;
			}
		} catch (e) {
			// Font not available, tests will be skipped
		}
	});

	describe("parseColr", () => {
		test("returns ColrTable with version", () => {
			if (!colr) return;
			expect(typeof colr.version).toBe("number");
			expect(colr.version).toBeGreaterThanOrEqual(0);
		});

		test("has base glyph records array", () => {
			if (!colr) return;
			expect(Array.isArray(colr.baseGlyphRecords)).toBe(true);
		});

		test("has layer records array", () => {
			if (!colr) return;
			expect(Array.isArray(colr.layerRecords)).toBe(true);
		});

		test("base glyph records have required properties", () => {
			if (!colr) return;
			if (colr.baseGlyphRecords.length > 0) {
				const record = colr.baseGlyphRecords[0];
				if (record) {
					expect(typeof record.glyphId).toBe("number");
					expect(typeof record.firstLayerIndex).toBe("number");
					expect(typeof record.numLayers).toBe("number");
					expect(record.numLayers).toBeGreaterThanOrEqual(0);
				}
			}
		});

		test("layer records have required properties", () => {
			if (!colr) return;
			if (colr.layerRecords.length > 0) {
				const layer = colr.layerRecords[0];
				if (layer) {
					expect(typeof layer.glyphId).toBe("number");
					expect(typeof layer.paletteIndex).toBe("number");
				}
			}
		});

		test("base glyph records are sorted by glyph ID", () => {
			if (!colr) return;
			for (let i = 0; i < colr.baseGlyphRecords.length - 1; i++) {
				const curr = colr.baseGlyphRecords[i];
				const next = colr.baseGlyphRecords[i + 1];
				if (curr && next) {
					expect(curr.glyphId).toBeLessThanOrEqual(next.glyphId);
				}
			}
		});

		test("layer indices are valid", () => {
			if (!colr) return;
			for (const record of colr.baseGlyphRecords) {
				expect(record.firstLayerIndex).toBeGreaterThanOrEqual(0);
				expect(record.firstLayerIndex + record.numLayers).toBeLessThanOrEqual(
					colr.layerRecords.length + 1,
				);
			}
		});
	});

	describe("COLR v1 extensions", () => {
		test("version 1 tables have optional v1 properties", () => {
			if (!colr) return;
			if (colr.version >= 1) {
				// v1 tables may have these properties
				if (colr.baseGlyphPaintRecords) {
					expect(Array.isArray(colr.baseGlyphPaintRecords)).toBe(true);
				}
				if (colr.layerList) {
					expect(Array.isArray(colr.layerList)).toBe(true);
				}
				if (colr.clipList) {
					expect(Array.isArray(colr.clipList)).toBe(true);
				}
			}
		});

		test("base glyph paint records have valid structure", () => {
			if (!colr) return;
			if (colr.baseGlyphPaintRecords) {
				for (const record of colr.baseGlyphPaintRecords) {
					expect(typeof record.glyphId).toBe("number");
					expect(record.paint).toBeDefined();
					expect(typeof record.paint.format).toBe("number");
				}
			}
		});

		test("layer list contains valid paint objects", () => {
			if (!colr) return;
			if (colr.layerList) {
				for (const paint of colr.layerList) {
					expect(typeof paint.format).toBe("number");
					expect(paint.format).toBeGreaterThanOrEqual(1);
					expect(paint.format).toBeLessThanOrEqual(32);
				}
			}
		});

		test("clip list has valid clip records", () => {
			if (!colr) return;
			if (colr.clipList) {
				for (const record of colr.clipList) {
					expect(typeof record.startGlyphId).toBe("number");
					expect(typeof record.endGlyphId).toBe("number");
					expect(record.startGlyphId).toBeLessThanOrEqual(record.endGlyphId);
					expect(record.clipBox).toBeDefined();
					expect(typeof record.clipBox.format).toBe("number");
					expect(typeof record.clipBox.xMin).toBe("number");
					expect(typeof record.clipBox.yMin).toBe("number");
					expect(typeof record.clipBox.xMax).toBe("number");
					expect(typeof record.clipBox.yMax).toBe("number");
				}
			}
		});

		test("isColrV1 correctly identifies v1 tables", () => {
			if (!colr) return;
			const result = isColrV1(colr);
			expect(typeof result).toBe("boolean");
			if (colr.version >= 1 && colr.baseGlyphPaintRecords) {
				expect(result).toBe(true);
			}
		});
	});

	describe("paint formats", () => {
		test("PaintFormat enum has correct values", () => {
			expect(PaintFormat.ColrLayers).toBe(1);
			expect(PaintFormat.Solid).toBe(2);
			expect(PaintFormat.VarSolid).toBe(3);
			expect(PaintFormat.LinearGradient).toBe(4);
			expect(PaintFormat.RadialGradient).toBe(6);
			expect(PaintFormat.SweepGradient).toBe(8);
			expect(PaintFormat.Glyph).toBe(10);
			expect(PaintFormat.ColrGlyph).toBe(11);
			expect(PaintFormat.Transform).toBe(12);
			expect(PaintFormat.Composite).toBe(32);
		});

		test("solid paint has palette index and alpha", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (paint.format === PaintFormat.Solid || paint.format === PaintFormat.VarSolid) {
					const solidPaint = paint as PaintSolid;
					expect(typeof solidPaint.paletteIndex).toBe("number");
					expect(typeof solidPaint.alpha).toBe("number");
					expect(solidPaint.alpha).toBeGreaterThanOrEqual(-2);
					expect(solidPaint.alpha).toBeLessThanOrEqual(2);
				}
			}
		});

		test("colr layers paint has valid indices", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (paint.format === PaintFormat.ColrLayers) {
					const layerPaint = paint as PaintColrLayers;
					expect(typeof layerPaint.numLayers).toBe("number");
					expect(typeof layerPaint.firstLayerIndex).toBe("number");
					expect(layerPaint.numLayers).toBeGreaterThanOrEqual(0);
					expect(layerPaint.firstLayerIndex).toBeGreaterThanOrEqual(0);
				}
			}
		});

		test("linear gradient has color line and coordinates", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (
					paint.format === PaintFormat.LinearGradient ||
					paint.format === PaintFormat.VarLinearGradient
				) {
					const gradientPaint = paint as any;
					expect(gradientPaint.colorLine).toBeDefined();
					expect(typeof gradientPaint.x0).toBe("number");
					expect(typeof gradientPaint.y0).toBe("number");
					expect(typeof gradientPaint.x1).toBe("number");
					expect(typeof gradientPaint.y1).toBe("number");
					expect(typeof gradientPaint.x2).toBe("number");
					expect(typeof gradientPaint.y2).toBe("number");
				}
			}
		});

		test("radial gradient has color line and radii", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (
					paint.format === PaintFormat.RadialGradient ||
					paint.format === PaintFormat.VarRadialGradient
				) {
					const gradientPaint = paint as any;
					expect(gradientPaint.colorLine).toBeDefined();
					expect(typeof gradientPaint.x0).toBe("number");
					expect(typeof gradientPaint.y0).toBe("number");
					expect(typeof gradientPaint.radius0).toBe("number");
					expect(typeof gradientPaint.x1).toBe("number");
					expect(typeof gradientPaint.y1).toBe("number");
					expect(typeof gradientPaint.radius1).toBe("number");
				}
			}
		});

		test("sweep gradient has color line and angles", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (
					paint.format === PaintFormat.SweepGradient ||
					paint.format === PaintFormat.VarSweepGradient
				) {
					const gradientPaint = paint as any;
					expect(gradientPaint.colorLine).toBeDefined();
					expect(typeof gradientPaint.centerX).toBe("number");
					expect(typeof gradientPaint.centerY).toBe("number");
					expect(typeof gradientPaint.startAngle).toBe("number");
					expect(typeof gradientPaint.endAngle).toBe("number");
				}
			}
		});
	});

	describe("color line structure", () => {
		test("color line has extend mode and stops", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (
					paint.format === PaintFormat.LinearGradient ||
					paint.format === PaintFormat.RadialGradient ||
					paint.format === PaintFormat.SweepGradient
				) {
					const gradientPaint = paint as any;
					const colorLine = gradientPaint.colorLine;
					expect(typeof colorLine.extend).toBe("number");
					expect(Array.isArray(colorLine.colorStops)).toBe(true);
					expect(colorLine.colorStops.length).toBeGreaterThan(0);
				}
			}
		});

		test("color stops have valid properties", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (
					paint.format === PaintFormat.LinearGradient ||
					paint.format === PaintFormat.RadialGradient ||
					paint.format === PaintFormat.SweepGradient
				) {
					const gradientPaint = paint as any;
					for (const stop of gradientPaint.colorLine.colorStops) {
						expect(typeof stop.stopOffset).toBe("number");
						expect(typeof stop.paletteIndex).toBe("number");
						expect(typeof stop.alpha).toBe("number");
					}
				}
			}
		});

		test("Extend enum has correct values", () => {
			expect(Extend.Pad).toBe(0);
			expect(Extend.Repeat).toBe(1);
			expect(Extend.Reflect).toBe(2);
		});
	});

	describe("getColorLayers", () => {
		test("returns layers for color glyphs", () => {
			if (!colr) return;
			if (colr.baseGlyphRecords.length > 0) {
				const record = colr.baseGlyphRecords[0];
				if (record) {
					const layers = getColorLayers(colr, record.glyphId);
					expect(layers).not.toBeNull();
					if (layers) {
						expect(Array.isArray(layers)).toBe(true);
						expect(layers.length).toBe(record.numLayers);
					}
				}
			}
		});

		test("returns null for non-color glyphs", () => {
			if (!colr) return;
			const layers = getColorLayers(colr, 999999);
			expect(layers).toBeNull();
		});

		test("returned layers match layer records", () => {
			if (!colr) return;
			if (colr.baseGlyphRecords.length > 0) {
				const record = colr.baseGlyphRecords[0];
				if (record) {
					const layers = getColorLayers(colr, record.glyphId);
					if (layers) {
						for (let i = 0; i < layers.length; i++) {
							const layer = layers[i];
							const expected = colr.layerRecords[record.firstLayerIndex + i];
							expect(layer).toEqual(expected);
						}
					}
				}
			}
		});

		test("binary search works for middle glyphs", () => {
			if (!colr) return;
			if (colr.baseGlyphRecords.length > 2) {
				const midIndex = Math.floor(colr.baseGlyphRecords.length / 2);
				const record = colr.baseGlyphRecords[midIndex];
				if (record) {
					const layers = getColorLayers(colr, record.glyphId);
					expect(layers).not.toBeNull();
					if (layers) {
						expect(layers.length).toBe(record.numLayers);
					}
				}
			}
		});

		test("binary search works for first glyph", () => {
			if (!colr) return;
			if (colr.baseGlyphRecords.length > 0) {
				const record = colr.baseGlyphRecords[0];
				if (record) {
					const layers = getColorLayers(colr, record.glyphId);
					expect(layers).not.toBeNull();
				}
			}
		});

		test("binary search works for last glyph", () => {
			if (!colr) return;
			if (colr.baseGlyphRecords.length > 0) {
				const record = colr.baseGlyphRecords[colr.baseGlyphRecords.length - 1];
				if (record) {
					const layers = getColorLayers(colr, record.glyphId);
					expect(layers).not.toBeNull();
				}
			}
		});
	});

	describe("getColorPaint", () => {
		test("returns paint for v1 color glyphs", () => {
			if (!colr || !colr.baseGlyphPaintRecords) return;
			if (colr.baseGlyphPaintRecords.length > 0) {
				const record = colr.baseGlyphPaintRecords[0];
				if (record) {
					const paint = getColorPaint(colr, record.glyphId);
					expect(paint).not.toBeNull();
					if (paint) {
						expect(typeof paint.format).toBe("number");
					}
				}
			}
		});

		test("returns null for v0 tables", () => {
			if (!colr) return;
			if (colr.version === 0) {
				const paint = getColorPaint(colr, 1);
				expect(paint).toBeNull();
			}
		});

		test("returns null for non-color glyphs", () => {
			if (!colr) return;
			const paint = getColorPaint(colr, 999999);
			expect(paint).toBeNull();
		});

		test("binary search works correctly", () => {
			if (!colr || !colr.baseGlyphPaintRecords) return;
			if (colr.baseGlyphPaintRecords.length > 2) {
				const midIndex = Math.floor(colr.baseGlyphPaintRecords.length / 2);
				const record = colr.baseGlyphPaintRecords[midIndex];
				if (record) {
					const paint = getColorPaint(colr, record.glyphId);
					expect(paint).toEqual(record.paint);
				}
			}
		});
	});

	describe("hasColorGlyph", () => {
		test("returns true for v0 color glyphs", () => {
			if (!colr) return;
			if (colr.baseGlyphRecords.length > 0) {
				const record = colr.baseGlyphRecords[0];
				if (record) {
					const hasColor = hasColorGlyph(colr, record.glyphId);
					expect(hasColor).toBe(true);
				}
			}
		});

		test("returns true for v1 color glyphs", () => {
			if (!colr || !colr.baseGlyphPaintRecords) return;
			if (colr.baseGlyphPaintRecords.length > 0) {
				const record = colr.baseGlyphPaintRecords[0];
				if (record) {
					const hasColor = hasColorGlyph(colr, record.glyphId);
					expect(hasColor).toBe(true);
				}
			}
		});

		test("returns false for non-color glyphs", () => {
			if (!colr) return;
			const hasColor = hasColorGlyph(colr, 999999);
			expect(hasColor).toBe(false);
		});
	});

	describe("getClipBox", () => {
		test("returns clip box for glyphs in range", () => {
			if (!colr || !colr.clipList) return;
			if (colr.clipList.length > 0) {
				const record = colr.clipList[0];
				if (record) {
					const clipBox = getClipBox(colr, record.startGlyphId);
					expect(clipBox).not.toBeNull();
					if (clipBox) {
						expect(clipBox).toEqual(record.clipBox);
					}
				}
			}
		});

		test("returns null when no clip list", () => {
			if (!colr) return;
			const testColr: ColrTable = {
				...colr,
				clipList: undefined,
			};
			const clipBox = getClipBox(testColr, 1);
			expect(clipBox).toBeNull();
		});

		test("returns null for glyphs outside clip ranges", () => {
			if (!colr || !colr.clipList) return;
			const clipBox = getClipBox(colr, 999999);
			expect(clipBox).toBeNull();
		});

		test("handles glyphs at range boundaries", () => {
			if (!colr || !colr.clipList) return;
			if (colr.clipList.length > 0) {
				const record = colr.clipList[0];
				if (record) {
					const startBox = getClipBox(colr, record.startGlyphId);
					const endBox = getClipBox(colr, record.endGlyphId);
					expect(startBox).toEqual(record.clipBox);
					expect(endBox).toEqual(record.clipBox);
				}
			}
		});
	});

	describe("getLayerPaint", () => {
		test("returns paint at valid index", () => {
			if (!colr || !colr.layerList) return;
			if (colr.layerList.length > 0) {
				const paint = getLayerPaint(colr, 0);
				expect(paint).not.toBeNull();
				if (paint) {
					expect(paint).toEqual(colr.layerList[0]);
				}
			}
		});

		test("returns null for invalid index", () => {
			if (!colr) return;
			const paint = getLayerPaint(colr, 999999);
			expect(paint).toBeNull();
		});

		test("returns null when no layer list", () => {
			if (!colr) return;
			const testColr: ColrTable = {
				...colr,
				layerList: undefined,
			};
			const paint = getLayerPaint(testColr, 0);
			expect(paint).toBeNull();
		});
	});

	describe("CompositeMode enum", () => {
		test("has correct values", () => {
			expect(CompositeMode.Clear).toBe(0);
			expect(CompositeMode.Src).toBe(1);
			expect(CompositeMode.Dest).toBe(2);
			expect(CompositeMode.SrcOver).toBe(3);
			expect(CompositeMode.DestOver).toBe(4);
			expect(CompositeMode.SrcIn).toBe(5);
			expect(CompositeMode.Multiply).toBe(23);
			expect(CompositeMode.Luminosity).toBe(27);
		});
	});

	describe("transform paints", () => {
		test("transform paint has affine matrix", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (
					paint.format === PaintFormat.Transform ||
					paint.format === PaintFormat.VarTransform
				) {
					const transformPaint = paint as any;
					expect(transformPaint.transform).toBeDefined();
					const t = transformPaint.transform;
					expect(typeof t.xx).toBe("number");
					expect(typeof t.yx).toBe("number");
					expect(typeof t.xy).toBe("number");
					expect(typeof t.yy).toBe("number");
					expect(typeof t.dx).toBe("number");
					expect(typeof t.dy).toBe("number");
					expect(transformPaint.paint).toBeDefined();
				}
			}
		});

		test("translate paint has dx and dy", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (
					paint.format === PaintFormat.Translate ||
					paint.format === PaintFormat.VarTranslate
				) {
					const translatePaint = paint as any;
					expect(typeof translatePaint.dx).toBe("number");
					expect(typeof translatePaint.dy).toBe("number");
					expect(translatePaint.paint).toBeDefined();
				}
			}
		});

		test("scale paint has scale values", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (
					paint.format === PaintFormat.Scale ||
					paint.format === PaintFormat.VarScale
				) {
					const scalePaint = paint as any;
					expect(typeof scalePaint.scaleX).toBe("number");
					expect(typeof scalePaint.scaleY).toBe("number");
					expect(scalePaint.paint).toBeDefined();
				}
			}
		});

		test("rotate paint has angle", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (
					paint.format === PaintFormat.Rotate ||
					paint.format === PaintFormat.VarRotate
				) {
					const rotatePaint = paint as any;
					expect(typeof rotatePaint.angle).toBe("number");
					expect(rotatePaint.paint).toBeDefined();
				}
			}
		});

		test("skew paint has skew angles", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (
					paint.format === PaintFormat.Skew ||
					paint.format === PaintFormat.VarSkew
				) {
					const skewPaint = paint as any;
					expect(typeof skewPaint.xSkewAngle).toBe("number");
					expect(typeof skewPaint.ySkewAngle).toBe("number");
					expect(skewPaint.paint).toBeDefined();
				}
			}
		});
	});

	describe("glyph paints", () => {
		test("paint glyph has glyph ID and paint", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (paint.format === PaintFormat.Glyph) {
					const glyphPaint = paint as any;
					expect(typeof glyphPaint.glyphId).toBe("number");
					expect(glyphPaint.paint).toBeDefined();
				}
			}
		});

		test("colr glyph has glyph ID", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (paint.format === PaintFormat.ColrGlyph) {
					const colrGlyphPaint = paint as any;
					expect(typeof colrGlyphPaint.glyphId).toBe("number");
				}
			}
		});
	});

	describe("composite paint", () => {
		test("composite paint has source, backdrop, and mode", () => {
			if (!colr || !colr.layerList) return;
			for (const paint of colr.layerList) {
				if (paint.format === PaintFormat.Composite) {
					const compositePaint = paint as any;
					expect(compositePaint.sourcePaint).toBeDefined();
					expect(compositePaint.backdropPaint).toBeDefined();
					expect(typeof compositePaint.compositeMode).toBe("number");
					expect(compositePaint.compositeMode).toBeGreaterThanOrEqual(0);
					expect(compositePaint.compositeMode).toBeLessThanOrEqual(27);
				}
			}
		});
	});

	describe("edge cases", () => {
		test("handles empty base glyph records", () => {
			if (!colr) return;
			const emptyColr: ColrTable = {
				version: 0,
				baseGlyphRecords: [],
				layerRecords: [],
			};
			const layers = getColorLayers(emptyColr, 1);
			expect(layers).toBeNull();
		});

		test("handles missing layers gracefully", () => {
			if (!colr) return;
			const testColr: ColrTable = {
				version: 0,
				baseGlyphRecords: [{ glyphId: 1, firstLayerIndex: 0, numLayers: 2 }],
				layerRecords: [],
			};
			const layers = getColorLayers(testColr, 1);
			if (layers) {
				expect(layers.length).toBeLessThanOrEqual(2);
			}
		});
	});
});
