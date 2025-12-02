import { Reader } from "../binary/reader.ts";
import type { GlyphId } from "../../types.ts";

/**
 * COLR (Color) table parser
 * Defines color glyph layers
 */

export interface ColrTable {
	version: number;
	// v0 data
	baseGlyphRecords: BaseGlyphRecord[];
	layerRecords: LayerRecord[];
	// v1 data
	baseGlyphPaintRecords?: BaseGlyphPaintRecord[];
	layerList?: Paint[];
	clipList?: ClipRecord[];
	varIdxMap?: number[];
	itemVariationStore?: ItemVariationStore;
}

// v0 structures
export interface BaseGlyphRecord {
	glyphId: GlyphId;
	firstLayerIndex: number;
	numLayers: number;
}

export interface LayerRecord {
	glyphId: GlyphId;
	paletteIndex: number;
}

// v1 structures
export interface BaseGlyphPaintRecord {
	glyphId: GlyphId;
	paint: Paint;
}

// Paint types for COLR v1
export const enum PaintFormat {
	ColrLayers = 1,
	Solid = 2,
	VarSolid = 3,
	LinearGradient = 4,
	VarLinearGradient = 5,
	RadialGradient = 6,
	VarRadialGradient = 7,
	SweepGradient = 8,
	VarSweepGradient = 9,
	Glyph = 10,
	ColrGlyph = 11,
	Transform = 12,
	VarTransform = 13,
	Translate = 14,
	VarTranslate = 15,
	Scale = 16,
	VarScale = 17,
	ScaleAroundCenter = 18,
	VarScaleAroundCenter = 19,
	ScaleUniform = 20,
	VarScaleUniform = 21,
	ScaleUniformAroundCenter = 22,
	VarScaleUniformAroundCenter = 23,
	Rotate = 24,
	VarRotate = 25,
	RotateAroundCenter = 26,
	VarRotateAroundCenter = 27,
	Skew = 28,
	VarSkew = 29,
	SkewAroundCenter = 30,
	VarSkewAroundCenter = 31,
	Composite = 32,
}

export type Paint =
	| PaintColrLayers
	| PaintSolid
	| PaintLinearGradient
	| PaintRadialGradient
	| PaintSweepGradient
	| PaintGlyph
	| PaintColrGlyph
	| PaintTransform
	| PaintTranslate
	| PaintScale
	| PaintRotate
	| PaintSkew
	| PaintComposite;

export interface PaintColrLayers {
	format: PaintFormat.ColrLayers;
	numLayers: number;
	firstLayerIndex: number;
}

export interface PaintSolid {
	format: PaintFormat.Solid | PaintFormat.VarSolid;
	paletteIndex: number;
	alpha: number;
	varIndexBase?: number;
}

export interface PaintLinearGradient {
	format: PaintFormat.LinearGradient | PaintFormat.VarLinearGradient;
	colorLine: ColorLine;
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface PaintRadialGradient {
	format: PaintFormat.RadialGradient | PaintFormat.VarRadialGradient;
	colorLine: ColorLine;
	x0: number;
	y0: number;
	radius0: number;
	x1: number;
	y1: number;
	radius1: number;
}

export interface PaintSweepGradient {
	format: PaintFormat.SweepGradient | PaintFormat.VarSweepGradient;
	colorLine: ColorLine;
	centerX: number;
	centerY: number;
	startAngle: number;
	endAngle: number;
}

export interface PaintGlyph {
	format: PaintFormat.Glyph;
	paint: Paint;
	glyphId: GlyphId;
}

export interface PaintColrGlyph {
	format: PaintFormat.ColrGlyph;
	glyphId: GlyphId;
}

export interface PaintTransform {
	format: PaintFormat.Transform | PaintFormat.VarTransform;
	paint: Paint;
	transform: Affine2x3;
}

export interface PaintTranslate {
	format: PaintFormat.Translate | PaintFormat.VarTranslate;
	paint: Paint;
	dx: number;
	dy: number;
}

export interface PaintScale {
	format:
		| PaintFormat.Scale
		| PaintFormat.VarScale
		| PaintFormat.ScaleAroundCenter
		| PaintFormat.VarScaleAroundCenter
		| PaintFormat.ScaleUniform
		| PaintFormat.VarScaleUniform
		| PaintFormat.ScaleUniformAroundCenter
		| PaintFormat.VarScaleUniformAroundCenter;
	paint: Paint;
	scaleX: number;
	scaleY: number;
	centerX?: number;
	centerY?: number;
}

export interface PaintRotate {
	format:
		| PaintFormat.Rotate
		| PaintFormat.VarRotate
		| PaintFormat.RotateAroundCenter
		| PaintFormat.VarRotateAroundCenter;
	paint: Paint;
	angle: number;
	centerX?: number;
	centerY?: number;
}

export interface PaintSkew {
	format:
		| PaintFormat.Skew
		| PaintFormat.VarSkew
		| PaintFormat.SkewAroundCenter
		| PaintFormat.VarSkewAroundCenter;
	paint: Paint;
	xSkewAngle: number;
	ySkewAngle: number;
	centerX?: number;
	centerY?: number;
}

export interface PaintComposite {
	format: PaintFormat.Composite;
	sourcePaint: Paint;
	compositeMode: CompositeMode;
	backdropPaint: Paint;
}

export interface ColorLine {
	extend: Extend;
	colorStops: ColorStop[];
}

export interface ColorStop {
	stopOffset: number;
	paletteIndex: number;
	alpha: number;
}

export const enum Extend {
	Pad = 0,
	Repeat = 1,
	Reflect = 2,
}

export const enum CompositeMode {
	Clear = 0,
	Src = 1,
	Dest = 2,
	SrcOver = 3,
	DestOver = 4,
	SrcIn = 5,
	DestIn = 6,
	SrcOut = 7,
	DestOut = 8,
	SrcAtop = 9,
	DestAtop = 10,
	Xor = 11,
	Plus = 12,
	Screen = 13,
	Overlay = 14,
	Darken = 15,
	Lighten = 16,
	ColorDodge = 17,
	ColorBurn = 18,
	HardLight = 19,
	SoftLight = 20,
	Difference = 21,
	Exclusion = 22,
	Multiply = 23,
	Hue = 24,
	Saturation = 25,
	Color = 26,
	Luminosity = 27,
}

export interface Affine2x3 {
	xx: number;
	yx: number;
	xy: number;
	yy: number;
	dx: number;
	dy: number;
}

export interface ClipRecord {
	startGlyphId: GlyphId;
	endGlyphId: GlyphId;
	clipBox: ClipBox;
}

export interface ClipBox {
	format: number;
	xMin: number;
	yMin: number;
	xMax: number;
	yMax: number;
	varIndexBase?: number;
}

export interface ItemVariationStore {
	format: number;
	axisCount: number;
	itemVariationDataCount: number;
}

/**
 * Parse COLR table
 */
export function parseColr(reader: Reader): ColrTable {
	const startOffset = reader.offset;

	const version = reader.uint16();
	const numBaseGlyphRecords = reader.uint16();
	const baseGlyphRecordsOffset = reader.uint32();
	const layerRecordsOffset = reader.uint32();
	const numLayerRecords = reader.uint16();

	// Parse v0 base glyph records
	const baseGlyphRecords: BaseGlyphRecord[] = [];
	if (baseGlyphRecordsOffset !== 0 && numBaseGlyphRecords > 0) {
		reader.seek(startOffset + baseGlyphRecordsOffset);
		for (let i = 0; i < numBaseGlyphRecords; i++) {
			baseGlyphRecords.push({
				glyphId: reader.uint16(),
				firstLayerIndex: reader.uint16(),
				numLayers: reader.uint16(),
			});
		}
	}

	// Parse v0 layer records
	const layerRecords: LayerRecord[] = [];
	if (layerRecordsOffset !== 0 && numLayerRecords > 0) {
		reader.seek(startOffset + layerRecordsOffset);
		for (let i = 0; i < numLayerRecords; i++) {
			layerRecords.push({
				glyphId: reader.uint16(),
				paletteIndex: reader.uint16(),
			});
		}
	}

	const result: ColrTable = {
		version,
		baseGlyphRecords,
		layerRecords,
	};

	// Parse v1 extensions
	if (version >= 1) {
		reader.seek(startOffset + 14); // After v0 header

		const baseGlyphListOffset = reader.uint32();
		const layerListOffset = reader.uint32();
		const clipListOffset = reader.uint32();
		const varIdxMapOffset = reader.uint32();
		const itemVariationStoreOffset = reader.uint32();

		// Parse base glyph paint records
		if (baseGlyphListOffset !== 0) {
			reader.seek(startOffset + baseGlyphListOffset);
			const numRecords = reader.uint32();
			result.baseGlyphPaintRecords = [];

			for (let i = 0; i < numRecords; i++) {
				const glyphId = reader.uint16();
				const paintOffset = reader.uint32();

				// Parse paint at offset
				const savedPos = reader.offset;
				reader.seek(startOffset + baseGlyphListOffset + 4 + i * 6 + 2 + paintOffset - 4);
				const paint = parsePaint(reader, startOffset);
				reader.seek(savedPos);

				result.baseGlyphPaintRecords.push({ glyphId, paint });
			}
		}

		// Parse layer list
		if (layerListOffset !== 0) {
			reader.seek(startOffset + layerListOffset);
			const numLayers = reader.uint32();
			const paintOffsets: number[] = [];

			for (let i = 0; i < numLayers; i++) {
				paintOffsets.push(reader.uint32());
			}

			result.layerList = [];
			for (const offset of paintOffsets) {
				reader.seek(startOffset + layerListOffset + offset);
				result.layerList.push(parsePaint(reader, startOffset));
			}
		}

		// Parse clip list
		if (clipListOffset !== 0) {
			reader.seek(startOffset + clipListOffset);
			result.clipList = parseClipList(reader, startOffset);
		}
	}

	return result;
}

/**
 * Parse a Paint structure
 */
function parsePaint(reader: Reader, tableOffset: number): Paint {
	const format = reader.uint8();

	switch (format) {
		case PaintFormat.ColrLayers:
			return {
				format,
				numLayers: reader.uint8(),
				firstLayerIndex: reader.uint32(),
			};

		case PaintFormat.Solid:
			return {
				format,
				paletteIndex: reader.uint16(),
				alpha: reader.f2dot14(),
			};

		case PaintFormat.VarSolid:
			return {
				format,
				paletteIndex: reader.uint16(),
				alpha: reader.f2dot14(),
				varIndexBase: reader.uint32(),
			};

		case PaintFormat.LinearGradient:
		case PaintFormat.VarLinearGradient: {
			const colorLineOffset = reader.uint24();
			const x0 = reader.fword();
			const y0 = reader.fword();
			const x1 = reader.fword();
			const y1 = reader.fword();
			const x2 = reader.fword();
			const y2 = reader.fword();

			const savedPos = reader.offset;
			reader.seek(reader.offset - 18 + colorLineOffset);
			const colorLine = parseColorLine(reader);
			reader.seek(savedPos);

			return { format, colorLine, x0, y0, x1, y1, x2, y2 };
		}

		case PaintFormat.RadialGradient:
		case PaintFormat.VarRadialGradient: {
			const colorLineOffset = reader.uint24();
			const x0 = reader.fword();
			const y0 = reader.fword();
			const radius0 = reader.ufword();
			const x1 = reader.fword();
			const y1 = reader.fword();
			const radius1 = reader.ufword();

			const savedPos = reader.offset;
			reader.seek(reader.offset - 18 + colorLineOffset);
			const colorLine = parseColorLine(reader);
			reader.seek(savedPos);

			return { format, colorLine, x0, y0, radius0, x1, y1, radius1 };
		}

		case PaintFormat.SweepGradient:
		case PaintFormat.VarSweepGradient: {
			const colorLineOffset = reader.uint24();
			const centerX = reader.fword();
			const centerY = reader.fword();
			const startAngle = reader.f2dot14();
			const endAngle = reader.f2dot14();

			const savedPos = reader.offset;
			reader.seek(reader.offset - 12 + colorLineOffset);
			const colorLine = parseColorLine(reader);
			reader.seek(savedPos);

			return { format, colorLine, centerX, centerY, startAngle, endAngle };
		}

		case PaintFormat.Glyph: {
			const paintOffset = reader.uint24();
			const glyphId = reader.uint16();

			const savedPos = reader.offset;
			reader.seek(reader.offset - 5 + paintOffset);
			const paint = parsePaint(reader, tableOffset);
			reader.seek(savedPos);

			return { format, paint, glyphId };
		}

		case PaintFormat.ColrGlyph:
			return {
				format,
				glyphId: reader.uint16(),
			};

		case PaintFormat.Transform:
		case PaintFormat.VarTransform: {
			const paintOffset = reader.uint24();
			const transformOffset = reader.uint24();

			const paintPos = reader.offset - 6 + paintOffset;
			const transformPos = reader.offset - 3 + transformOffset;

			reader.seek(transformPos);
			const transform: Affine2x3 = {
				xx: reader.fixed(),
				yx: reader.fixed(),
				xy: reader.fixed(),
				yy: reader.fixed(),
				dx: reader.fixed(),
				dy: reader.fixed(),
			};

			reader.seek(paintPos);
			const paint = parsePaint(reader, tableOffset);

			return { format, paint, transform };
		}

		case PaintFormat.Translate:
		case PaintFormat.VarTranslate: {
			const paintOffset = reader.uint24();
			const dx = reader.fword();
			const dy = reader.fword();

			const savedPos = reader.offset;
			reader.seek(reader.offset - 7 + paintOffset);
			const paint = parsePaint(reader, tableOffset);
			reader.seek(savedPos);

			return { format, paint, dx, dy };
		}

		case PaintFormat.Scale:
		case PaintFormat.VarScale: {
			const paintOffset = reader.uint24();
			const scaleX = reader.f2dot14();
			const scaleY = reader.f2dot14();

			const savedPos = reader.offset;
			reader.seek(reader.offset - 7 + paintOffset);
			const paint = parsePaint(reader, tableOffset);
			reader.seek(savedPos);

			return { format, paint, scaleX, scaleY };
		}

		case PaintFormat.ScaleAroundCenter:
		case PaintFormat.VarScaleAroundCenter: {
			const paintOffset = reader.uint24();
			const scaleX = reader.f2dot14();
			const scaleY = reader.f2dot14();
			const centerX = reader.fword();
			const centerY = reader.fword();

			const savedPos = reader.offset;
			reader.seek(reader.offset - 11 + paintOffset);
			const paint = parsePaint(reader, tableOffset);
			reader.seek(savedPos);

			return { format, paint, scaleX, scaleY, centerX, centerY };
		}

		case PaintFormat.ScaleUniform:
		case PaintFormat.VarScaleUniform: {
			const paintOffset = reader.uint24();
			const scale = reader.f2dot14();

			const savedPos = reader.offset;
			reader.seek(reader.offset - 5 + paintOffset);
			const paint = parsePaint(reader, tableOffset);
			reader.seek(savedPos);

			return { format, paint, scaleX: scale, scaleY: scale };
		}

		case PaintFormat.ScaleUniformAroundCenter:
		case PaintFormat.VarScaleUniformAroundCenter: {
			const paintOffset = reader.uint24();
			const scale = reader.f2dot14();
			const centerX = reader.fword();
			const centerY = reader.fword();

			const savedPos = reader.offset;
			reader.seek(reader.offset - 9 + paintOffset);
			const paint = parsePaint(reader, tableOffset);
			reader.seek(savedPos);

			return { format, paint, scaleX: scale, scaleY: scale, centerX, centerY };
		}

		case PaintFormat.Rotate:
		case PaintFormat.VarRotate: {
			const paintOffset = reader.uint24();
			const angle = reader.f2dot14();

			const savedPos = reader.offset;
			reader.seek(reader.offset - 5 + paintOffset);
			const paint = parsePaint(reader, tableOffset);
			reader.seek(savedPos);

			return { format, paint, angle };
		}

		case PaintFormat.RotateAroundCenter:
		case PaintFormat.VarRotateAroundCenter: {
			const paintOffset = reader.uint24();
			const angle = reader.f2dot14();
			const centerX = reader.fword();
			const centerY = reader.fword();

			const savedPos = reader.offset;
			reader.seek(reader.offset - 9 + paintOffset);
			const paint = parsePaint(reader, tableOffset);
			reader.seek(savedPos);

			return { format, paint, angle, centerX, centerY };
		}

		case PaintFormat.Skew:
		case PaintFormat.VarSkew: {
			const paintOffset = reader.uint24();
			const xSkewAngle = reader.f2dot14();
			const ySkewAngle = reader.f2dot14();

			const savedPos = reader.offset;
			reader.seek(reader.offset - 7 + paintOffset);
			const paint = parsePaint(reader, tableOffset);
			reader.seek(savedPos);

			return { format, paint, xSkewAngle, ySkewAngle };
		}

		case PaintFormat.SkewAroundCenter:
		case PaintFormat.VarSkewAroundCenter: {
			const paintOffset = reader.uint24();
			const xSkewAngle = reader.f2dot14();
			const ySkewAngle = reader.f2dot14();
			const centerX = reader.fword();
			const centerY = reader.fword();

			const savedPos = reader.offset;
			reader.seek(reader.offset - 11 + paintOffset);
			const paint = parsePaint(reader, tableOffset);
			reader.seek(savedPos);

			return { format, paint, xSkewAngle, ySkewAngle, centerX, centerY };
		}

		case PaintFormat.Composite: {
			const sourcePaintOffset = reader.uint24();
			const compositeMode = reader.uint8() as CompositeMode;
			const backdropPaintOffset = reader.uint24();

			const sourcePos = reader.offset - 7 + sourcePaintOffset;
			const backdropPos = reader.offset - 3 + backdropPaintOffset;

			reader.seek(sourcePos);
			const sourcePaint = parsePaint(reader, tableOffset);

			reader.seek(backdropPos);
			const backdropPaint = parsePaint(reader, tableOffset);

			return { format, sourcePaint, compositeMode, backdropPaint };
		}

		default:
			throw new Error(`Unknown paint format: ${format}`);
	}
}

/**
 * Parse ColorLine structure
 */
function parseColorLine(reader: Reader): ColorLine {
	const extend = reader.uint8() as Extend;
	const numStops = reader.uint16();
	const colorStops: ColorStop[] = [];

	for (let i = 0; i < numStops; i++) {
		colorStops.push({
			stopOffset: reader.f2dot14(),
			paletteIndex: reader.uint16(),
			alpha: reader.f2dot14(),
		});
	}

	return { extend, colorStops };
}

/**
 * Parse ClipList structure
 */
function parseClipList(reader: Reader, tableOffset: number): ClipRecord[] {
	const format = reader.uint8();
	const numClips = reader.uint32();
	const records: ClipRecord[] = [];

	for (let i = 0; i < numClips; i++) {
		const startGlyphId = reader.uint16();
		const endGlyphId = reader.uint16();
		const clipBoxOffset = reader.uint24();

		const savedPos = reader.offset;
		reader.seek(reader.offset - 7 + clipBoxOffset);

		const boxFormat = reader.uint8();
		const clipBox: ClipBox = {
			format: boxFormat,
			xMin: reader.fword(),
			yMin: reader.fword(),
			xMax: reader.fword(),
			yMax: reader.fword(),
		};

		if (boxFormat === 2) {
			clipBox.varIndexBase = reader.uint32();
		}

		reader.seek(savedPos);

		records.push({ startGlyphId, endGlyphId, clipBox });
	}

	return records;
}

/**
 * Get color layers for a glyph (v0)
 */
export function getColorLayers(colr: ColrTable, glyphId: GlyphId): LayerRecord[] | null {
	// Binary search for base glyph record
	const records = colr.baseGlyphRecords;
	let lo = 0;
	let hi = records.length - 1;

	while (lo <= hi) {
		const mid = (lo + hi) >>> 1;
		const record = records[mid]!;

		if (record.glyphId === glyphId) {
			const layers: LayerRecord[] = [];
			for (let i = 0; i < record.numLayers; i++) {
				layers.push(colr.layerRecords[record.firstLayerIndex + i]!);
			}
			return layers;
		} else if (record.glyphId < glyphId) {
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}

	return null;
}

/**
 * Get paint for a glyph (v1)
 */
export function getColorPaint(colr: ColrTable, glyphId: GlyphId): Paint | null {
	if (!colr.baseGlyphPaintRecords) return null;

	// Binary search
	const records = colr.baseGlyphPaintRecords;
	let lo = 0;
	let hi = records.length - 1;

	while (lo <= hi) {
		const mid = (lo + hi) >>> 1;
		const record = records[mid]!;

		if (record.glyphId === glyphId) {
			return record.paint;
		} else if (record.glyphId < glyphId) {
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}

	return null;
}

/**
 * Check if glyph has color data
 */
export function hasColorGlyph(colr: ColrTable, glyphId: GlyphId): boolean {
	return getColorLayers(colr, glyphId) !== null || getColorPaint(colr, glyphId) !== null;
}
