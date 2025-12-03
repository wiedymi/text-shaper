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
	getColorVariationDelta,
	PaintFormat,
	Extend,
	CompositeMode,
	type ColrTable,
	type BaseGlyphRecord,
	type LayerRecord,
	type Paint,
	type PaintSolid,
	type PaintColrLayers,
	type PaintLinearGradient,
	type PaintRadialGradient,
	type PaintSweepGradient,
	type PaintGlyph,
	type PaintColrGlyph,
	type PaintTransform,
	type PaintTranslate,
	type PaintScale,
	type PaintRotate,
	type PaintSkew,
	type PaintComposite,
} from "../../../src/font/tables/colr.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const EMOJI_FONT_PATH = "/System/Library/Fonts/Apple Color Emoji.ttc";

/**
 * Create a binary COLR v0 table for testing
 */
function createColrV0Binary(): ArrayBuffer {
	const buffer = new ArrayBuffer(1024);
	const view = new DataView(buffer);
	let offset = 0;

	// Version 0
	view.setUint16(offset, 0);
	offset += 2;

	// numBaseGlyphRecords
	view.setUint16(offset, 2);
	offset += 2;

	// baseGlyphRecordsOffset
	view.setUint32(offset, 14);
	offset += 4;

	// layerRecordsOffset
	view.setUint32(offset, 26);
	offset += 4;

	// numLayerRecords
	view.setUint16(offset, 4);
	offset += 2;

	// Base glyph records (at offset 14)
	// Record 1: glyph 10, layers [0, 1]
	view.setUint16(14, 10);
	view.setUint16(16, 0);
	view.setUint16(18, 2);

	// Record 2: glyph 20, layers [2, 3]
	view.setUint16(20, 20);
	view.setUint16(22, 2);
	view.setUint16(24, 2);

	// Layer records (at offset 26)
	// Layer 0
	view.setUint16(26, 100);
	view.setUint16(28, 0);

	// Layer 1
	view.setUint16(30, 101);
	view.setUint16(32, 1);

	// Layer 2
	view.setUint16(34, 102);
	view.setUint16(36, 2);

	// Layer 3
	view.setUint16(38, 103);
	view.setUint16(40, 3);

	return buffer.slice(0, 42);
}

/**
 * Create a binary COLR v1 table with various paint formats
 */
function createColrV1Binary(): ArrayBuffer {
	const buffer = new ArrayBuffer(4096);
	const view = new DataView(buffer);
	let offset = 0;

	// Version 1
	view.setUint16(offset, 1);
	offset += 2;

	// numBaseGlyphRecords (v0 data)
	view.setUint16(offset, 0);
	offset += 2;

	// baseGlyphRecordsOffset
	view.setUint32(offset, 0);
	offset += 4;

	// layerRecordsOffset
	view.setUint32(offset, 0);
	offset += 4;

	// numLayerRecords
	view.setUint16(offset, 0);
	offset += 2;

	// V1 offsets
	const baseGlyphListOffset = 34;
	const layerListOffset = 200;
	const clipListOffset = 500;

	// baseGlyphListOffset
	view.setUint32(offset, baseGlyphListOffset);
	offset += 4;

	// layerListOffset
	view.setUint32(offset, layerListOffset);
	offset += 4;

	// clipListOffset
	view.setUint32(offset, clipListOffset);
	offset += 4;

	// varIdxMapOffset (0 = none)
	view.setUint32(offset, 0);
	offset += 4;

	// itemVariationStoreOffset (0 = none)
	view.setUint32(offset, 0);
	offset += 4;

	// BaseGlyphList (at offset 34)
	offset = baseGlyphListOffset;

	// numRecords
	view.setUint32(offset, 1);
	offset += 4;

	// BaseGlyphPaintRecord: glyph 50, paint offset 6
	view.setUint16(offset, 50);
	offset += 2;
	view.setUint32(offset, 6);
	offset += 4;

	// Paint at offset 34 + 4 + 6 = 44 (PaintSolid)
	offset = 44;
	view.setUint8(offset, PaintFormat.Solid);
	offset += 1;
	view.setUint16(offset, 5);
	offset += 2;
	// alpha as f2dot14 (1.0 = 16384)
	view.setInt16(offset, 16384);
	offset += 2;

	// LayerList (at offset 200)
	offset = layerListOffset;

	// numLayers
	view.setUint32(offset, 10);
	offset += 4;

	// Paint offsets
	const paintOffsets = [
		24, // ColrLayers
		28, // Solid
		34, // VarSolid
		44, // LinearGradient
		68, // RadialGradient
		92, // SweepGradient
		112, // Glyph
		120, // ColrGlyph
		124, // Transform
		154, // Composite
	];

	for (const po of paintOffsets) {
		view.setUint32(offset, po);
		offset += 4;
	}

	// Paint 0: ColrLayers (at 200 + 24 = 224)
	offset = 224;
	view.setUint8(offset, PaintFormat.ColrLayers);
	offset += 1;
	view.setUint8(offset, 2);
	offset += 1;
	view.setUint32(offset, 1);
	offset += 4;

	// Paint 1: Solid (at 200 + 28 = 228)
	offset = 228;
	view.setUint8(offset, PaintFormat.Solid);
	offset += 1;
	view.setUint16(offset, 3);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	// Paint 2: VarSolid (at 200 + 34 = 234)
	offset = 234;
	view.setUint8(offset, PaintFormat.VarSolid);
	offset += 1;
	view.setUint16(offset, 4);
	offset += 2;
	view.setInt16(offset, 8192);
	offset += 2;
	view.setUint32(offset, 123);
	offset += 4;

	// Paint 3: LinearGradient (at 200 + 44 = 244)
	offset = 244;
	view.setUint8(offset, PaintFormat.LinearGradient);
	offset += 1;
	// colorLineOffset (3 bytes)
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 19);
	offset += 3;
	// x0, y0, x1, y1, x2, y2 (6 FWORDs)
	view.setInt16(offset, 0);
	offset += 2;
	view.setInt16(offset, 0);
	offset += 2;
	view.setInt16(offset, 100);
	offset += 2;
	view.setInt16(offset, 0);
	offset += 2;
	view.setInt16(offset, 100);
	offset += 2;
	view.setInt16(offset, 100);
	offset += 2;

	// ColorLine at 244 + 19 = 263
	offset = 263;
	view.setUint8(offset, Extend.Pad);
	offset += 1;
	view.setUint16(offset, 2);
	offset += 2;
	// Stop 1
	view.setInt16(offset, 0);
	offset += 2;
	view.setUint16(offset, 0);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;
	// Stop 2
	view.setInt16(offset, 16384);
	offset += 2;
	view.setUint16(offset, 1);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	// Paint 4: RadialGradient (at 200 + 68 = 268)
	offset = 268;
	view.setUint8(offset, PaintFormat.RadialGradient);
	offset += 1;
	// colorLineOffset
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 19);
	offset += 3;
	// x0, y0, radius0, x1, y1, radius1
	view.setInt16(offset, 50);
	offset += 2;
	view.setInt16(offset, 50);
	offset += 2;
	view.setUint16(offset, 10);
	offset += 2;
	view.setInt16(offset, 50);
	offset += 2;
	view.setInt16(offset, 50);
	offset += 2;
	view.setUint16(offset, 100);
	offset += 2;

	// ColorLine at 268 + 19 = 287
	offset = 287;
	view.setUint8(offset, Extend.Repeat);
	offset += 1;
	view.setUint16(offset, 1);
	offset += 2;
	view.setInt16(offset, 8192);
	offset += 2;
	view.setUint16(offset, 2);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	// Paint 5: SweepGradient (at 200 + 92 = 292)
	offset = 292;
	view.setUint8(offset, PaintFormat.SweepGradient);
	offset += 1;
	// colorLineOffset
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 11);
	offset += 3;
	// centerX, centerY, startAngle, endAngle
	view.setInt16(offset, 50);
	offset += 2;
	view.setInt16(offset, 50);
	offset += 2;
	view.setInt16(offset, 0);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	// ColorLine at 292 + 11 = 303
	offset = 303;
	view.setUint8(offset, Extend.Reflect);
	offset += 1;
	view.setUint16(offset, 1);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;
	view.setUint16(offset, 0);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	// Paint 6: Glyph (at 200 + 112 = 312)
	offset = 312;
	view.setUint8(offset, PaintFormat.Glyph);
	offset += 1;
	// paintOffset
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 5);
	offset += 3;
	view.setUint16(offset, 99);
	offset += 2;

	// Paint for Glyph at 312 + 5 = 317 (Solid)
	offset = 317;
	view.setUint8(offset, PaintFormat.Solid);
	offset += 1;
	view.setUint16(offset, 1);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	// Paint 7: ColrGlyph (at 200 + 120 = 320)
	offset = 320;
	view.setUint8(offset, PaintFormat.ColrGlyph);
	offset += 1;
	view.setUint16(offset, 88);
	offset += 2;

	// Paint 8: Transform (at 200 + 124 = 324)
	offset = 324;
	view.setUint8(offset, PaintFormat.Transform);
	offset += 1;
	// paintOffset
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 6);
	offset += 3;
	// transformOffset
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 11);
	offset += 3;

	// Paint at 324 + 6 = 330 (Solid)
	offset = 330;
	view.setUint8(offset, PaintFormat.Solid);
	offset += 1;
	view.setUint16(offset, 0);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	// Affine2x3 at 324 + 11 = 335
	offset = 335;
	view.setInt32(offset, 65536);
	offset += 4; // xx = 1.0
	view.setInt32(offset, 0);
	offset += 4; // yx = 0.0
	view.setInt32(offset, 0);
	offset += 4; // xy = 0.0
	view.setInt32(offset, 65536);
	offset += 4; // yy = 1.0
	view.setInt32(offset, 10 << 16);
	offset += 4; // dx = 10
	view.setInt32(offset, 20 << 16);
	offset += 4; // dy = 20

	// Paint 9: Composite (at 200 + 154 = 354)
	offset = 354;
	view.setUint8(offset, PaintFormat.Composite);
	offset += 1;
	// sourcePaintOffset
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 7);
	offset += 3;
	// compositeMode
	view.setUint8(offset, CompositeMode.SrcOver);
	offset += 1;
	// backdropPaintOffset
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 12);
	offset += 3;

	// Source paint at 354 + 7 = 361 (Solid)
	offset = 361;
	view.setUint8(offset, PaintFormat.Solid);
	offset += 1;
	view.setUint16(offset, 1);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	// Backdrop paint at 354 + 12 = 366 (Solid)
	offset = 366;
	view.setUint8(offset, PaintFormat.Solid);
	offset += 1;
	view.setUint16(offset, 2);
	offset += 2;
	view.setInt16(offset, 8192);
	offset += 2;

	// ClipList (at offset 500)
	offset = clipListOffset;

	// format
	view.setUint8(offset, 1);
	offset += 1;

	// numClips
	view.setUint32(offset, 1);
	offset += 4;

	// ClipRecord
	view.setUint16(offset, 50);
	offset += 2; // startGlyphId
	view.setUint16(offset, 55);
	offset += 2; // endGlyphId
	// clipBoxOffset
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 7);
	offset += 3;

	// ClipBox at 500 + 5 + 7 = 512
	offset = 512;
	view.setUint8(offset, 1);
	offset += 1; // format
	view.setInt16(offset, 0);
	offset += 2; // xMin
	view.setInt16(offset, 0);
	offset += 2; // yMin
	view.setInt16(offset, 1000);
	offset += 2; // xMax
	view.setInt16(offset, 1000);
	offset += 2; // yMax

	return buffer.slice(0, 600);
}

/**
 * Create a COLR v1 table with additional paint formats
 */
function createColrV1Extended(): ArrayBuffer {
	const buffer = new ArrayBuffer(2048);
	const view = new DataView(buffer);
	let offset = 0;

	// Version 1
	view.setUint16(offset, 1);
	offset += 2;

	// V0 header (minimal)
	view.setUint16(offset, 0);
	offset += 2;
	view.setUint32(offset, 0);
	offset += 4;
	view.setUint32(offset, 0);
	offset += 4;
	view.setUint16(offset, 0);
	offset += 2;

	// V1 offsets
	const layerListOffset = 34;

	view.setUint32(offset, 0);
	offset += 4; // baseGlyphListOffset
	view.setUint32(offset, layerListOffset);
	offset += 4;
	view.setUint32(offset, 0);
	offset += 4; // clipListOffset
	view.setUint32(offset, 0);
	offset += 4; // varIdxMapOffset
	view.setUint32(offset, 0);
	offset += 4; // itemVariationStoreOffset

	// LayerList
	offset = layerListOffset;

	// numLayers
	view.setUint32(offset, 7);
	offset += 4;

	// Paint offsets
	const paintOffsets = [
		32, // Translate
		44, // Scale
		56, // ScaleAroundCenter
		72, // Rotate
		84, // RotateAroundCenter
		100, // Skew
		112, // SkewAroundCenter
	];

	for (const po of paintOffsets) {
		view.setUint32(offset, po);
		offset += 4;
	}

	// Paint 0: Translate (at 34 + 32 = 66)
	offset = 66;
	view.setUint8(offset, PaintFormat.Translate);
	offset += 1;
	// paintOffset
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 7);
	offset += 3;
	// dx, dy
	view.setInt16(offset, 10);
	offset += 2;
	view.setInt16(offset, 20);
	offset += 2;

	// Inner paint at 66 + 7 = 73 (Solid)
	offset = 73;
	view.setUint8(offset, PaintFormat.Solid);
	offset += 1;
	view.setUint16(offset, 0);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	// Paint 1: Scale (at 34 + 44 = 78)
	offset = 78;
	view.setUint8(offset, PaintFormat.Scale);
	offset += 1;
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 7);
	offset += 3;
	view.setInt16(offset, 8192);
	offset += 2; // scaleX = 0.5
	view.setInt16(offset, 16384);
	offset += 2; // scaleY = 1.0

	offset = 85;
	view.setUint8(offset, PaintFormat.Solid);
	offset += 1;
	view.setUint16(offset, 1);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	// Paint 2: ScaleAroundCenter (at 34 + 56 = 90)
	offset = 90;
	view.setUint8(offset, PaintFormat.ScaleAroundCenter);
	offset += 1;
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 11);
	offset += 3;
	view.setInt16(offset, 16384);
	offset += 2; // scaleX
	view.setInt16(offset, 16384);
	offset += 2; // scaleY
	view.setInt16(offset, 50);
	offset += 2; // centerX
	view.setInt16(offset, 50);
	offset += 2; // centerY

	offset = 101;
	view.setUint8(offset, PaintFormat.Solid);
	offset += 1;
	view.setUint16(offset, 2);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	// Paint 3: Rotate (at 34 + 72 = 106)
	offset = 106;
	view.setUint8(offset, PaintFormat.Rotate);
	offset += 1;
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 5);
	offset += 3;
	view.setInt16(offset, 4096);
	offset += 2; // angle

	offset = 111;
	view.setUint8(offset, PaintFormat.Solid);
	offset += 1;
	view.setUint16(offset, 3);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	// Paint 4: RotateAroundCenter (at 34 + 84 = 118)
	offset = 118;
	view.setUint8(offset, PaintFormat.RotateAroundCenter);
	offset += 1;
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 9);
	offset += 3;
	view.setInt16(offset, 8192);
	offset += 2; // angle
	view.setInt16(offset, 100);
	offset += 2; // centerX
	view.setInt16(offset, 100);
	offset += 2; // centerY

	offset = 127;
	view.setUint8(offset, PaintFormat.Solid);
	offset += 1;
	view.setUint16(offset, 4);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	// Paint 5: Skew (at 34 + 100 = 134)
	offset = 134;
	view.setUint8(offset, PaintFormat.Skew);
	offset += 1;
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 7);
	offset += 3;
	view.setInt16(offset, 2048);
	offset += 2; // xSkewAngle
	view.setInt16(offset, 1024);
	offset += 2; // ySkewAngle

	offset = 141;
	view.setUint8(offset, PaintFormat.Solid);
	offset += 1;
	view.setUint16(offset, 5);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	// Paint 6: SkewAroundCenter (at 34 + 112 = 146)
	offset = 146;
	view.setUint8(offset, PaintFormat.SkewAroundCenter);
	offset += 1;
	view.setUint8(offset, 0);
	view.setUint16(offset + 1, 11);
	offset += 3;
	view.setInt16(offset, 1024);
	offset += 2; // xSkewAngle
	view.setInt16(offset, 2048);
	offset += 2; // ySkewAngle
	view.setInt16(offset, 75);
	offset += 2; // centerX
	view.setInt16(offset, 75);
	offset += 2; // centerY

	offset = 157;
	view.setUint8(offset, PaintFormat.Solid);
	offset += 1;
	view.setUint16(offset, 6);
	offset += 2;
	view.setInt16(offset, 16384);
	offset += 2;

	return buffer.slice(0, 200);
}

/**
 * Create a COLR v1 table with variable font support
 */
function createColrV1WithVariations(): ArrayBuffer {
	const buffer = new ArrayBuffer(2048);
	const view = new DataView(buffer);
	let offset = 0;

	// Version 1
	view.setUint16(offset, 1);
	offset += 2;

	// V0 header
	view.setUint16(offset, 0);
	offset += 2;
	view.setUint32(offset, 0);
	offset += 4;
	view.setUint32(offset, 0);
	offset += 4;
	view.setUint16(offset, 0);
	offset += 2;

	// V1 offsets
	const varIdxMapOffset = 34;
	const itemVariationStoreOffset = 100;

	view.setUint32(offset, 0);
	offset += 4; // baseGlyphListOffset
	view.setUint32(offset, 0);
	offset += 4; // layerListOffset
	view.setUint32(offset, 0);
	offset += 4; // clipListOffset
	view.setUint32(offset, varIdxMapOffset);
	offset += 4;
	view.setUint32(offset, itemVariationStoreOffset);
	offset += 4;

	// DeltaSetIndexMap (at offset 34)
	offset = varIdxMapOffset;

	// format 0
	view.setUint8(offset, 0);
	offset += 1;

	// entryFormat (4 inner bits, 4 outer bits = 0x33)
	view.setUint8(offset, 0x33);
	offset += 1;

	// mapCount
	view.setUint16(offset, 2);
	offset += 2;

	// Entry 0: outer=1, inner=2 -> (1 << 4) | 2 = 0x12
	view.setUint8(offset, 0x12);
	offset += 1;

	// Entry 1: outer=0, inner=3 -> (0 << 4) | 3 = 0x03
	view.setUint8(offset, 0x03);
	offset += 1;

	// ItemVariationStore (at offset 100)
	offset = itemVariationStoreOffset;

	// format
	view.setUint16(offset, 1);
	offset += 2;

	// variationRegionListOffset
	view.setUint32(offset, 8);
	offset += 4;

	// itemVariationDataCount
	view.setUint16(offset, 2);
	offset += 2;

	// itemVariationDataOffsets
	view.setUint32(offset, 50);
	offset += 4;
	view.setUint32(offset, 80);
	offset += 4;

	// VariationRegionList (at 100 + 8 = 108)
	offset = 108;

	// axisCount
	view.setUint16(offset, 1);
	offset += 2;

	// regionCount
	view.setUint16(offset, 2);
	offset += 2;

	// Region 0: axis 0
	view.setInt16(offset, 0);
	offset += 2; // startCoord
	view.setInt16(offset, 16384);
	offset += 2; // peakCoord = 1.0
	view.setInt16(offset, 16384);
	offset += 2; // endCoord

	// Region 1: axis 0
	view.setInt16(offset, -16384);
	offset += 2; // startCoord = -1.0
	view.setInt16(offset, 0);
	offset += 2; // peakCoord
	view.setInt16(offset, 0);
	offset += 2; // endCoord

	// ItemVariationData 0 (at 100 + 50 = 150)
	offset = 150;

	// itemCount
	view.setUint16(offset, 2);
	offset += 2;

	// wordDeltaCount
	view.setUint16(offset, 1);
	offset += 2;

	// regionIndexCount
	view.setUint16(offset, 2);
	offset += 2;

	// regionIndexes
	view.setUint16(offset, 0);
	offset += 2;
	view.setUint16(offset, 1);
	offset += 2;

	// deltaSets for item 0
	view.setInt16(offset, 100);
	offset += 2;
	view.setInt8(offset, 50);
	offset += 1;

	// deltaSets for item 1
	view.setInt16(offset, -100);
	offset += 2;
	view.setInt8(offset, -50);
	offset += 1;

	// ItemVariationData 1 (at 100 + 80 = 180)
	offset = 180;

	view.setUint16(offset, 1);
	offset += 2;
	view.setUint16(offset, 1);
	offset += 2;
	view.setUint16(offset, 1);
	offset += 2;
	view.setUint16(offset, 0);
	offset += 2;

	// deltaSets
	view.setInt16(offset, 200);
	offset += 2;

	return buffer.slice(0, 200);
}

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

	describe("synthetic COLR v0 parsing", () => {
		test("parses COLR v0 table correctly", () => {
			const binary = createColrV0Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			expect(table.version).toBe(0);
			expect(table.baseGlyphRecords.length).toBe(2);
			expect(table.layerRecords.length).toBe(4);

			expect(table.baseGlyphRecords[0]?.glyphId).toBe(10);
			expect(table.baseGlyphRecords[0]?.firstLayerIndex).toBe(0);
			expect(table.baseGlyphRecords[0]?.numLayers).toBe(2);

			expect(table.layerRecords[0]?.glyphId).toBe(100);
			expect(table.layerRecords[0]?.paletteIndex).toBe(0);
		});

		test("getColorLayers works with synthetic v0 table", () => {
			const binary = createColrV0Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const layers = getColorLayers(table, 10);
			expect(layers).not.toBeNull();
			expect(layers?.length).toBe(2);
			expect(layers?.[0]?.glyphId).toBe(100);
			expect(layers?.[1]?.glyphId).toBe(101);
		});
	});

	describe("synthetic COLR v1 parsing", () => {
		test("parses COLR v1 table with all paint formats", () => {
			const binary = createColrV1Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			expect(table.version).toBe(1);
			expect(table.baseGlyphPaintRecords?.length).toBe(1);
			expect(table.layerList?.length).toBe(10);
			expect(table.clipList?.length).toBe(1);
		});

		test("parses ColrLayers paint", () => {
			const binary = createColrV1Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintColrLayers;
			expect(paint.format).toBe(PaintFormat.ColrLayers);
			expect(paint.numLayers).toBe(2);
			expect(paint.firstLayerIndex).toBe(1);
		});

		test("parses Solid paint", () => {
			const binary = createColrV1Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[1] as PaintSolid;
			expect(paint.format).toBe(PaintFormat.Solid);
			expect(paint.paletteIndex).toBe(3);
			expect(paint.alpha).toBeCloseTo(1.0, 1);
		});

		test("parses VarSolid paint", () => {
			const binary = createColrV1Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[2] as PaintSolid;
			expect(paint.format).toBe(PaintFormat.VarSolid);
			expect(paint.paletteIndex).toBe(4);
			expect(paint.varIndexBase).toBe(123);
		});

		test("parses LinearGradient paint", () => {
			const binary = createColrV1Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[3] as PaintLinearGradient;
			expect(paint.format).toBe(PaintFormat.LinearGradient);
			expect(paint.x0).toBe(0);
			expect(paint.y0).toBe(0);
			expect(paint.x1).toBe(100);
			expect(paint.y1).toBe(0);
			expect(paint.x2).toBe(100);
			expect(paint.y2).toBe(100);
			expect(paint.colorLine.extend).toBe(Extend.Pad);
			expect(paint.colorLine.colorStops.length).toBe(2);
		});

		test("parses RadialGradient paint", () => {
			const binary = createColrV1Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[4] as PaintRadialGradient;
			expect(paint.format).toBe(PaintFormat.RadialGradient);
			expect(paint.x0).toBe(50);
			expect(paint.y0).toBe(50);
			expect(paint.radius0).toBe(10);
			expect(paint.x1).toBe(50);
			expect(paint.y1).toBe(50);
			expect(paint.radius1).toBe(100);
			expect(paint.colorLine.extend).toBe(Extend.Repeat);
		});

		test("parses SweepGradient paint", () => {
			const binary = createColrV1Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[5] as PaintSweepGradient;
			expect(paint.format).toBe(PaintFormat.SweepGradient);
			expect(paint.centerX).toBe(50);
			expect(paint.centerY).toBe(50);
			expect(paint.colorLine.extend).toBe(Extend.Reflect);
		});

		test("parses Glyph paint", () => {
			const binary = createColrV1Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[6] as PaintGlyph;
			expect(paint.format).toBe(PaintFormat.Glyph);
			expect(paint.glyphId).toBe(99);
			expect(paint.paint).toBeDefined();
			expect(paint.paint.format).toBe(PaintFormat.Solid);
		});

		test("parses ColrGlyph paint", () => {
			const binary = createColrV1Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[7] as PaintColrGlyph;
			expect(paint.format).toBe(PaintFormat.ColrGlyph);
			expect(paint.glyphId).toBe(88);
		});

		test("parses Transform paint", () => {
			const binary = createColrV1Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[8] as PaintTransform;
			expect(paint.format).toBe(PaintFormat.Transform);
			expect(paint.paint).toBeDefined();
			expect(paint.transform).toBeDefined();
			expect(paint.transform.xx).toBeCloseTo(1.0, 1);
			expect(paint.transform.yy).toBeCloseTo(1.0, 1);
			expect(paint.transform.dx).toBeCloseTo(10, 1);
			expect(paint.transform.dy).toBeCloseTo(20, 1);
		});

		test("parses Composite paint", () => {
			const binary = createColrV1Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[9] as PaintComposite;
			expect(paint.format).toBe(PaintFormat.Composite);
			expect(paint.compositeMode).toBe(CompositeMode.SrcOver);
			expect(paint.sourcePaint).toBeDefined();
			expect(paint.backdropPaint).toBeDefined();
		});

		test("parses clip list", () => {
			const binary = createColrV1Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			expect(table.clipList?.length).toBe(1);
			const clip = table.clipList?.[0];
			expect(clip?.startGlyphId).toBe(50);
			expect(clip?.endGlyphId).toBe(55);
			expect(clip?.clipBox.xMin).toBe(0);
			expect(clip?.clipBox.xMax).toBe(1000);
		});

		test("getColorPaint works with synthetic v1 table", () => {
			const binary = createColrV1Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = getColorPaint(table, 50);
			expect(paint).not.toBeNull();
			expect(paint?.format).toBe(PaintFormat.Solid);
		});

		test("getClipBox works with synthetic v1 table", () => {
			const binary = createColrV1Binary();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const clipBox = getClipBox(table, 52);
			expect(clipBox).not.toBeNull();
			expect(clipBox?.xMax).toBe(1000);
		});
	});

	describe("synthetic COLR v1 extended paint formats", () => {
		test("parses Translate paint", () => {
			const binary = createColrV1Extended();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintTranslate;
			expect(paint.format).toBe(PaintFormat.Translate);
			expect(paint.dx).toBe(10);
			expect(paint.dy).toBe(20);
			expect(paint.paint).toBeDefined();
		});

		test("parses Scale paint", () => {
			const binary = createColrV1Extended();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[1] as PaintScale;
			expect(paint.format).toBe(PaintFormat.Scale);
			expect(paint.scaleX).toBeCloseTo(0.5, 1);
			expect(paint.scaleY).toBeCloseTo(1.0, 1);
			expect(paint.paint).toBeDefined();
		});

		test("parses ScaleAroundCenter paint", () => {
			const binary = createColrV1Extended();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[2] as PaintScale;
			expect(paint.format).toBe(PaintFormat.ScaleAroundCenter);
			expect(paint.scaleX).toBeCloseTo(1.0, 1);
			expect(paint.scaleY).toBeCloseTo(1.0, 1);
			expect(paint.centerX).toBe(50);
			expect(paint.centerY).toBe(50);
			expect(paint.paint).toBeDefined();
		});

		test("parses Rotate paint", () => {
			const binary = createColrV1Extended();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[3] as PaintRotate;
			expect(paint.format).toBe(PaintFormat.Rotate);
			expect(paint.angle).toBeCloseTo(0.25, 1);
			expect(paint.paint).toBeDefined();
		});

		test("parses RotateAroundCenter paint", () => {
			const binary = createColrV1Extended();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[4] as PaintRotate;
			expect(paint.format).toBe(PaintFormat.RotateAroundCenter);
			expect(paint.angle).toBeCloseTo(0.5, 1);
			expect(paint.centerX).toBe(100);
			expect(paint.centerY).toBe(100);
			expect(paint.paint).toBeDefined();
		});

		test("parses Skew paint", () => {
			const binary = createColrV1Extended();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[5] as PaintSkew;
			expect(paint.format).toBe(PaintFormat.Skew);
			expect(paint.xSkewAngle).toBeCloseTo(0.125, 1);
			expect(paint.ySkewAngle).toBeCloseTo(0.0625, 1);
			expect(paint.paint).toBeDefined();
		});

		test("parses SkewAroundCenter paint", () => {
			const binary = createColrV1Extended();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const paint = table.layerList?.[6] as PaintSkew;
			expect(paint.format).toBe(PaintFormat.SkewAroundCenter);
			expect(paint.xSkewAngle).toBeCloseTo(0.0625, 1);
			expect(paint.ySkewAngle).toBeCloseTo(0.125, 1);
			expect(paint.centerX).toBe(75);
			expect(paint.centerY).toBe(75);
			expect(paint.paint).toBeDefined();
		});
	});

	describe("synthetic COLR v1 with variations", () => {
		test("parses DeltaSetIndexMap", () => {
			const binary = createColrV1WithVariations();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			expect(table.varIdxMap).toBeDefined();
			expect(table.varIdxMap?.length).toBe(2);

			const entry0 = table.varIdxMap?.[0];
			const entry1 = table.varIdxMap?.[1];

			expect(entry0).toBe((1 << 16) | 2);
			expect(entry1).toBe((0 << 16) | 3);
		});

		test("parses ItemVariationStore", () => {
			const binary = createColrV1WithVariations();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			expect(table.itemVariationStore).toBeDefined();
			const store = table.itemVariationStore;

			expect(store?.format).toBe(1);
			expect(store?.itemVariationDataCount).toBe(2);
			expect(store?.variationRegions.length).toBe(2);
			expect(store?.itemVariationData.length).toBe(2);
		});

		test("parses variation regions", () => {
			const binary = createColrV1WithVariations();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const region0 = table.itemVariationStore?.variationRegions[0];
			expect(region0?.regionAxes.length).toBe(1);
			expect(region0?.regionAxes[0]?.startCoord).toBeCloseTo(0, 1);
			expect(region0?.regionAxes[0]?.peakCoord).toBeCloseTo(1.0, 1);
			expect(region0?.regionAxes[0]?.endCoord).toBeCloseTo(1.0, 1);
		});

		test("parses item variation data", () => {
			const binary = createColrV1WithVariations();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const data0 = table.itemVariationStore?.itemVariationData[0];
			expect(data0?.itemCount).toBe(2);
			expect(data0?.regionIndexCount).toBe(2);
			expect(data0?.deltaSets.length).toBe(2);
			expect(data0?.deltaSets[0]?.[0]).toBe(100);
			expect(data0?.deltaSets[0]?.[1]).toBe(50);
		});

		test("getColorVariationDelta calculates deltas", () => {
			const binary = createColrV1WithVariations();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const delta = getColorVariationDelta(table, 0, [1.0]);

			expect(delta).toBeGreaterThan(0);
		});

		test("getColorVariationDelta returns 0 for invalid index", () => {
			const binary = createColrV1WithVariations();
			const reader = new Reader(binary);
			const table = parseColr(reader);

			const delta = getColorVariationDelta(table, 999, [1.0]);
			expect(delta).toBe(0);
		});

		test("getColorVariationDelta returns 0 without store", () => {
			const table: ColrTable = {
				version: 1,
				baseGlyphRecords: [],
				layerRecords: [],
			};

			const delta = getColorVariationDelta(table, 0, [1.0]);
			expect(delta).toBe(0);
		});
	});

	describe("additional paint format variations", () => {
		test("parses ScaleUniform paint", () => {
			const buffer = new ArrayBuffer(256);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.ScaleUniform);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 5);
			offset += 3;
			view.setInt16(offset, 8192);
			offset += 2;

			offset = 47;
			view.setUint8(offset, PaintFormat.Solid);
			offset += 1;
			view.setUint16(offset, 0);
			offset += 2;
			view.setInt16(offset, 16384);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintScale;
			expect(paint.format).toBe(PaintFormat.ScaleUniform);
			expect(paint.scaleX).toBeCloseTo(0.5, 1);
			expect(paint.scaleY).toBeCloseTo(0.5, 1);
		});

		test("parses ScaleUniformAroundCenter paint", () => {
			const buffer = new ArrayBuffer(256);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.ScaleUniformAroundCenter);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 9);
			offset += 3;
			view.setInt16(offset, 16384);
			offset += 2;
			view.setInt16(offset, 60);
			offset += 2;
			view.setInt16(offset, 70);
			offset += 2;

			offset = 51;
			view.setUint8(offset, PaintFormat.Solid);
			offset += 1;
			view.setUint16(offset, 1);
			offset += 2;
			view.setInt16(offset, 16384);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintScale;
			expect(paint.format).toBe(PaintFormat.ScaleUniformAroundCenter);
			expect(paint.scaleX).toBeCloseTo(1.0, 1);
			expect(paint.scaleY).toBeCloseTo(1.0, 1);
			expect(paint.centerX).toBe(60);
			expect(paint.centerY).toBe(70);
		});

		test("parses VarLinearGradient paint", () => {
			const buffer = new ArrayBuffer(512);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.VarLinearGradient);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 19);
			offset += 3;
			view.setInt16(offset, 0);
			offset += 2;
			view.setInt16(offset, 0);
			offset += 2;
			view.setInt16(offset, 200);
			offset += 2;
			view.setInt16(offset, 0);
			offset += 2;
			view.setInt16(offset, 200);
			offset += 2;
			view.setInt16(offset, 200);
			offset += 2;

			offset = 61;
			view.setUint8(offset, Extend.Pad);
			offset += 1;
			view.setUint16(offset, 1);
			offset += 2;
			view.setInt16(offset, 8192);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setInt16(offset, 16384);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintLinearGradient;
			expect(paint.format).toBe(PaintFormat.VarLinearGradient);
			expect(paint.x1).toBe(200);
		});

		test("parses VarRadialGradient paint", () => {
			const buffer = new ArrayBuffer(512);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.VarRadialGradient);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 19);
			offset += 3;
			view.setInt16(offset, 40);
			offset += 2;
			view.setInt16(offset, 40);
			offset += 2;
			view.setUint16(offset, 5);
			offset += 2;
			view.setInt16(offset, 40);
			offset += 2;
			view.setInt16(offset, 40);
			offset += 2;
			view.setUint16(offset, 80);
			offset += 2;

			offset = 61;
			view.setUint8(offset, Extend.Repeat);
			offset += 1;
			view.setUint16(offset, 1);
			offset += 2;
			view.setInt16(offset, 0);
			offset += 2;
			view.setUint16(offset, 1);
			offset += 2;
			view.setInt16(offset, 16384);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintRadialGradient;
			expect(paint.format).toBe(PaintFormat.VarRadialGradient);
			expect(paint.radius1).toBe(80);
		});

		test("parses VarSweepGradient paint", () => {
			const buffer = new ArrayBuffer(512);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.VarSweepGradient);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 11);
			offset += 3;
			view.setInt16(offset, 60);
			offset += 2;
			view.setInt16(offset, 60);
			offset += 2;
			view.setInt16(offset, 4096);
			offset += 2;
			view.setInt16(offset, 12288);
			offset += 2;

			offset = 53;
			view.setUint8(offset, Extend.Reflect);
			offset += 1;
			view.setUint16(offset, 1);
			offset += 2;
			view.setInt16(offset, 0);
			offset += 2;
			view.setUint16(offset, 2);
			offset += 2;
			view.setInt16(offset, 16384);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintSweepGradient;
			expect(paint.format).toBe(PaintFormat.VarSweepGradient);
			expect(paint.centerX).toBe(60);
		});

		test("parses VarTransform paint", () => {
			const buffer = new ArrayBuffer(512);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.VarTransform);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 6);
			offset += 3;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 11);
			offset += 3;

			offset = 48;
			view.setUint8(offset, PaintFormat.Solid);
			offset += 1;
			view.setUint16(offset, 0);
			offset += 2;
			view.setInt16(offset, 16384);

			offset = 53;
			view.setInt32(offset, 32768);
			offset += 4;
			view.setInt32(offset, 0);
			offset += 4;
			view.setInt32(offset, 0);
			offset += 4;
			view.setInt32(offset, 32768);
			offset += 4;
			view.setInt32(offset, 0);
			offset += 4;
			view.setInt32(offset, 0);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintTransform;
			expect(paint.format).toBe(PaintFormat.VarTransform);
			expect(paint.transform.xx).toBeCloseTo(0.5, 1);
		});

		test("parses VarTranslate paint", () => {
			const buffer = new ArrayBuffer(256);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.VarTranslate);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 7);
			offset += 3;
			view.setInt16(offset, 15);
			offset += 2;
			view.setInt16(offset, 25);
			offset += 2;

			offset = 49;
			view.setUint8(offset, PaintFormat.Solid);
			offset += 1;
			view.setUint16(offset, 0);
			offset += 2;
			view.setInt16(offset, 16384);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintTranslate;
			expect(paint.format).toBe(PaintFormat.VarTranslate);
			expect(paint.dx).toBe(15);
			expect(paint.dy).toBe(25);
		});

		test("parses VarScale paint", () => {
			const buffer = new ArrayBuffer(256);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.VarScale);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 7);
			offset += 3;
			view.setInt16(offset, 12288);
			offset += 2;
			view.setInt16(offset, 20480);
			offset += 2;

			offset = 49;
			view.setUint8(offset, PaintFormat.Solid);
			offset += 1;
			view.setUint16(offset, 1);
			offset += 2;
			view.setInt16(offset, 16384);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintScale;
			expect(paint.format).toBe(PaintFormat.VarScale);
			expect(paint.scaleX).toBeCloseTo(0.75, 1);
			expect(paint.scaleY).toBeCloseTo(1.25, 1);
		});

		test("parses VarScaleAroundCenter paint", () => {
			const buffer = new ArrayBuffer(256);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.VarScaleAroundCenter);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 11);
			offset += 3;
			view.setInt16(offset, 24576);
			offset += 2;
			view.setInt16(offset, 8192);
			offset += 2;
			view.setInt16(offset, 80);
			offset += 2;
			view.setInt16(offset, 90);
			offset += 2;

			offset = 53;
			view.setUint8(offset, PaintFormat.Solid);
			offset += 1;
			view.setUint16(offset, 2);
			offset += 2;
			view.setInt16(offset, 16384);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintScale;
			expect(paint.format).toBe(PaintFormat.VarScaleAroundCenter);
			expect(paint.scaleX).toBeCloseTo(1.5, 1);
			expect(paint.scaleY).toBeCloseTo(0.5, 1);
			expect(paint.centerX).toBe(80);
			expect(paint.centerY).toBe(90);
		});

		test("parses VarScaleUniform paint", () => {
			const buffer = new ArrayBuffer(256);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.VarScaleUniform);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 5);
			offset += 3;
			view.setInt16(offset, 24576);
			offset += 2;

			offset = 47;
			view.setUint8(offset, PaintFormat.Solid);
			offset += 1;
			view.setUint16(offset, 3);
			offset += 2;
			view.setInt16(offset, 16384);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintScale;
			expect(paint.format).toBe(PaintFormat.VarScaleUniform);
			expect(paint.scaleX).toBeCloseTo(1.5, 1);
			expect(paint.scaleY).toBeCloseTo(1.5, 1);
		});

		test("parses VarScaleUniformAroundCenter paint", () => {
			const buffer = new ArrayBuffer(256);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.VarScaleUniformAroundCenter);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 9);
			offset += 3;
			view.setInt16(offset, 32768);
			offset += 2;
			view.setInt16(offset, 110);
			offset += 2;
			view.setInt16(offset, 120);
			offset += 2;

			offset = 51;
			view.setUint8(offset, PaintFormat.Solid);
			offset += 1;
			view.setUint16(offset, 4);
			offset += 2;
			view.setInt16(offset, 16384);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintScale;
			expect(paint.format).toBe(PaintFormat.VarScaleUniformAroundCenter);
			expect(paint.scaleX).toBeCloseTo(2.0, 1);
			expect(paint.scaleY).toBeCloseTo(2.0, 1);
			expect(paint.centerX).toBe(110);
			expect(paint.centerY).toBe(120);
		});

		test("parses VarRotate paint", () => {
			const buffer = new ArrayBuffer(256);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.VarRotate);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 5);
			offset += 3;
			view.setInt16(offset, 6144);
			offset += 2;

			offset = 47;
			view.setUint8(offset, PaintFormat.Solid);
			offset += 1;
			view.setUint16(offset, 5);
			offset += 2;
			view.setInt16(offset, 16384);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintRotate;
			expect(paint.format).toBe(PaintFormat.VarRotate);
			expect(paint.angle).toBeCloseTo(0.375, 1);
		});

		test("parses VarRotateAroundCenter paint", () => {
			const buffer = new ArrayBuffer(256);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.VarRotateAroundCenter);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 9);
			offset += 3;
			view.setInt16(offset, 10240);
			offset += 2;
			view.setInt16(offset, 130);
			offset += 2;
			view.setInt16(offset, 140);
			offset += 2;

			offset = 51;
			view.setUint8(offset, PaintFormat.Solid);
			offset += 1;
			view.setUint16(offset, 6);
			offset += 2;
			view.setInt16(offset, 16384);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintRotate;
			expect(paint.format).toBe(PaintFormat.VarRotateAroundCenter);
			expect(paint.angle).toBeCloseTo(0.625, 1);
			expect(paint.centerX).toBe(130);
			expect(paint.centerY).toBe(140);
		});

		test("parses VarSkew paint", () => {
			const buffer = new ArrayBuffer(256);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.VarSkew);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 7);
			offset += 3;
			view.setInt16(offset, 3072);
			offset += 2;
			view.setInt16(offset, 1536);
			offset += 2;

			offset = 49;
			view.setUint8(offset, PaintFormat.Solid);
			offset += 1;
			view.setUint16(offset, 7);
			offset += 2;
			view.setInt16(offset, 16384);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintSkew;
			expect(paint.format).toBe(PaintFormat.VarSkew);
			expect(paint.xSkewAngle).toBeCloseTo(0.1875, 1);
			expect(paint.ySkewAngle).toBeCloseTo(0.09375, 1);
		});

		test("parses VarSkewAroundCenter paint", () => {
			const buffer = new ArrayBuffer(256);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const layerListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, layerListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = layerListOffset;
			view.setUint32(offset, 1);
			offset += 4;
			view.setUint32(offset, 8);
			offset += 4;

			offset = 42;
			view.setUint8(offset, PaintFormat.VarSkewAroundCenter);
			offset += 1;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 11);
			offset += 3;
			view.setInt16(offset, 512);
			offset += 2;
			view.setInt16(offset, 4096);
			offset += 2;
			view.setInt16(offset, 150);
			offset += 2;
			view.setInt16(offset, 160);
			offset += 2;

			offset = 53;
			view.setUint8(offset, PaintFormat.Solid);
			offset += 1;
			view.setUint16(offset, 8);
			offset += 2;
			view.setInt16(offset, 16384);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const paint = table.layerList?.[0] as PaintSkew;
			expect(paint.format).toBe(PaintFormat.VarSkewAroundCenter);
			expect(paint.xSkewAngle).toBeCloseTo(0.03125, 1);
			expect(paint.ySkewAngle).toBeCloseTo(0.25, 1);
			expect(paint.centerX).toBe(150);
			expect(paint.centerY).toBe(160);
		});

		test("handles ClipBox format 2 with varIndexBase", () => {
			const buffer = new ArrayBuffer(1024);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const clipListOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, clipListOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = clipListOffset;
			view.setUint8(offset, 1);
			offset += 1;
			view.setUint32(offset, 1);
			offset += 4;

			view.setUint16(offset, 100);
			offset += 2;
			view.setUint16(offset, 105);
			offset += 2;
			view.setUint8(offset, 0);
			view.setUint16(offset + 1, 7);
			offset += 3;

			offset = 48;
			view.setUint8(offset, 2);
			offset += 1;
			view.setInt16(offset, -50);
			offset += 2;
			view.setInt16(offset, -100);
			offset += 2;
			view.setInt16(offset, 500);
			offset += 2;
			view.setInt16(offset, 800);
			offset += 2;
			view.setUint32(offset, 999);

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			const clipBox = getClipBox(table, 102);
			expect(clipBox).not.toBeNull();
			expect(clipBox?.format).toBe(2);
			expect(clipBox?.varIndexBase).toBe(999);
		});

		test("handles DeltaSetIndexMap format 1", () => {
			const buffer = new ArrayBuffer(1024);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1);
			offset += 2;
			view.setUint16(offset, 0);
			offset += 2;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint16(offset, 0);
			offset += 2;

			const varIdxMapOffset = 34;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;
			view.setUint32(offset, varIdxMapOffset);
			offset += 4;
			view.setUint32(offset, 0);
			offset += 4;

			offset = varIdxMapOffset;
			view.setUint8(offset, 1);
			offset += 1;
			view.setUint8(offset, 0x22);
			offset += 1;
			view.setUint32(offset, 3);
			offset += 4;

			view.setUint8(offset, 0x01);
			offset += 1;
			view.setUint8(offset, 0x23);
			offset += 1;
			view.setUint8(offset, 0x45);
			offset += 1;

			const reader = new Reader(buffer.slice(0, 100));
			const table = parseColr(reader);

			expect(table.varIdxMap?.length).toBe(3);
		});
	});
});
