/**
 * High-level rasterization API
 */

import type { Font } from "../font/font.ts";
import { CompositeFlag } from "../font/tables/glyf.ts";
import { getAdvanceWidthDelta, getLsbDelta } from "../font/tables/hvar.ts";
import {
	createHintingEngine,
	type GlyphOutline,
	type HintedGlyph,
	type HintingEngine,
	hintGlyph,
	loadCVTProgram,
	loadFontProgram,
	setSize,
} from "../hinting/programs.ts";
import { scaleFUnits } from "../hinting/scale.ts";
import type { Matrix2D, Matrix3x3 } from "../render/outline-transform.ts";
import { type GlyphPath, getGlyphPath } from "../render/path.ts";
import type { GlyphId } from "../types.ts";
import {
	ensureAssRasterWasmReady,
	fillAssPathWasm,
	isAssRasterWasmEnabled,
} from "./ass-wasm/index.ts";
import { transformBitmap2D, transformBitmap3D } from "./bitmap-utils.ts";
import { PoolOverflowError } from "./cell.ts";
import {
	ensureFillWasmReady,
	fillGlyphGrayWasm,
	isFillWasmEnabled,
} from "./fill-wasm/index.ts";
import { GrayRaster } from "./gray-raster.ts";
import {
	decomposeContours,
	decomposePath,
	getContourBounds,
	getPathBounds,
} from "./outline-decompose.ts";
import { resolveFontScale, resolveFontSize } from "./size.ts";
import {
	type Bitmap,
	createBitmap,
	FillRule,
	type GlyphRasterizeOptions,
	type HintTarget,
	PixelMode,
	type RasterizedGlyph,
	type RasterizeOptions,
	type TextRasterizeOptions,
} from "./types.ts";

/** Cached hinting engines per font */
const hintingEngineCache = new WeakMap<Font, HintingEngine>();

/** Shared GrayRaster instance for reuse (avoids 2KB allocation per glyph) */
let sharedRaster: GrayRaster | null = null;

/** One-time init of the optional WASM fill fast path (idempotent, self-verifies). */
let fillWasmInitDone = false;
function initFillWasm(): void {
	if (fillWasmInitDone) return;
	fillWasmInitDone = true;
	ensureFillWasmReady();
}

let assRasterWasmInitDone = false;
function initAssRasterWasm(): void {
	if (assRasterWasmInitDone) return;
	assRasterWasmInitDone = true;
	ensureAssRasterWasmReady();
}

// --- optional fill profiler (dev/bench only; default off, one branch when off).
// Accumulates wall time + call count for the single-band gray fill (subdivision
// + wasm/scalar sweep) so callers can report "fill ms/frame".
let fillProfileOn = false;
let fillProfileMs = 0;
let fillProfileCount = 0;
export function setFillProfiling(on: boolean): void {
	fillProfileOn = on;
}
export function resetFillProfile(): void {
	fillProfileMs = 0;
	fillProfileCount = 0;
}
export function getFillProfile(): { ms: number; count: number } {
	return { ms: fillProfileMs, count: fillProfileCount };
}

/** Get or create shared rasterizer */
function getSharedRaster(): GrayRaster {
	if (!sharedRaster) sharedRaster = new GrayRaster();
	return sharedRaster;
}

function resolveHintLightMode(
	hintTarget: HintTarget,
	pixelMode: PixelMode,
): boolean {
	if (hintTarget === "light") return true;
	if (hintTarget === "normal") return false;
	return pixelMode === PixelMode.Gray;
}

/** Shared bitmap buffer for reuse */
let sharedBuffer: Uint8Array | null = null;
let sharedBufferSize = 0;

/** Get or create shared buffer, reusing if possible */
function getSharedBuffer(size: number): Uint8Array {
	if (size <= sharedBufferSize && sharedBuffer) {
		sharedBuffer.fill(0, 0, size);
		return sharedBuffer;
	}
	// Allocate new buffer (with some extra capacity for future reuse)
	const allocSize = Math.max(size, 4096);
	sharedBuffer = new Uint8Array(allocSize);
	sharedBufferSize = allocSize;
	return sharedBuffer;
}

/** Create bitmap with shared buffer */
function createBitmapShared(
	width: number,
	height: number,
	pixelMode: PixelMode,
): Bitmap {
	const bytesPerPixel =
		pixelMode === PixelMode.RGBA
			? 4
			: pixelMode === PixelMode.LCD || pixelMode === PixelMode.LCD_V
				? 3
				: pixelMode === PixelMode.Mono
					? 0.125
					: 1;
	const pitch =
		pixelMode === PixelMode.Mono
			? Math.ceil(width / 8)
			: Math.ceil(width * bytesPerPixel);
	const size = pitch * height;
	const buffer = getSharedBuffer(size);

	return {
		width,
		rows: height,
		pitch,
		buffer: buffer.subarray(0, size),
		pixelMode,
		numGrays: pixelMode === PixelMode.Mono ? 2 : 256,
	};
}

/** Cached hinted glyphs per font */
const hintedGlyphCache = new WeakMap<Font, Map<string, HintedGlyph | null>>();

function shouldScaleComponentOffset(flags: number): boolean {
	if (flags & CompositeFlag.UnscaledComponentOffset) return false;
	if (flags & CompositeFlag.ScaledComponentOffset) return true;
	return false;
}

function roundOffsetToGrid(value26: number): number {
	return Math.round(value26 / 64) * 64;
}

type Points26 = {
	xCoords: number[];
	yCoords: number[];
	flags: Uint8Array;
	contourEnds: number[];
};

function buildGlyphPoints26(
	font: Font,
	glyphId: GlyphId,
	scale: number,
	depth: number = 0,
	options?: { roundCompositeOffsets?: boolean },
): Points26 | null {
	if (depth > 32) return null;
	const glyph = font.getGlyph(glyphId);
	if (!glyph || glyph.type === "empty") return null;
	const roundCompositeOffsets = options?.roundCompositeOffsets ?? true;

	if (glyph.type === "simple") {
		const xCoords: number[] = [];
		const yCoords: number[] = [];
		const flags: number[] = [];
		const contourEnds: number[] = [];
		let pointIndex = 0;
		for (const contour of glyph.contours) {
			for (const point of contour) {
				xCoords.push(Math.round(point.x * scale));
				yCoords.push(Math.round(point.y * scale));
				flags.push(point.onCurve ? 1 : 0);
				pointIndex++;
			}
			contourEnds.push(pointIndex - 1);
		}
		return {
			xCoords,
			yCoords,
			flags: new Uint8Array(flags),
			contourEnds,
		};
	}

	const xCoords: number[] = [];
	const yCoords: number[] = [];
	const flags: number[] = [];
	const contourEnds: number[] = [];
	const parentPoints: { x: number; y: number }[] = [];
	let pointIndex = 0;

	for (const component of glyph.components) {
		const comp = buildGlyphPoints26(font, component.glyphId, scale, depth + 1, {
			roundCompositeOffsets,
		});
		if (!comp || comp.xCoords.length === 0) continue;

		const [a, b, c, d] = component.transform;
		const hasXY = (component.flags & CompositeFlag.ArgsAreXYValues) !== 0;

		const tx: number[] = new Array(comp.xCoords.length);
		const ty: number[] = new Array(comp.yCoords.length);
		for (let i = 0; i < comp.xCoords.length; i++) {
			const cx = comp.xCoords[i]!;
			const cy = comp.yCoords[i]!;
			tx[i] = Math.round(a * cx + c * cy);
			ty[i] = Math.round(b * cx + d * cy);
		}

		let dx26 = 0;
		let dy26 = 0;

		if (hasXY) {
			const rawDx = component.arg1;
			const rawDy = component.arg2;
			if (shouldScaleComponentOffset(component.flags)) {
				const dx = Math.round(rawDx * scale);
				const dy = Math.round(rawDy * scale);
				dx26 = Math.round(a * dx + c * dy);
				dy26 = Math.round(b * dx + d * dy);
			} else {
				dx26 = Math.round(rawDx * scale);
				dy26 = Math.round(rawDy * scale);
			}

			if (
				roundCompositeOffsets &&
				component.flags & CompositeFlag.RoundXYToGrid
			) {
				dx26 = roundOffsetToGrid(dx26);
				dy26 = roundOffsetToGrid(dy26);
			}
		} else {
			const parentIndex = component.arg1;
			const compIndex = component.arg2;
			if (
				parentIndex >= 0 &&
				parentIndex < parentPoints.length &&
				compIndex >= 0 &&
				compIndex < tx.length
			) {
				const parentPoint = parentPoints[parentIndex]!;
				dx26 = parentPoint.x - tx[compIndex]!;
				dy26 = parentPoint.y - ty[compIndex]!;
			}
		}

		for (let i = 0; i < tx.length; i++) {
			const x = tx[i]! + dx26;
			const y = ty[i]! + dy26;
			xCoords.push(x);
			yCoords.push(y);
			flags.push(comp.flags[i] ?? 0);
			parentPoints.push({ x, y });
		}

		for (let i = 0; i < comp.contourEnds.length; i++) {
			contourEnds.push(pointIndex + comp.contourEnds[i]!);
		}
		pointIndex += tx.length;
	}

	if (xCoords.length === 0) return null;
	return {
		xCoords,
		yCoords,
		flags: new Uint8Array(flags),
		contourEnds,
	};
}

function hintCompositeGlyph(
	engine: HintingEngine,
	font: Font,
	glyph: NonNullable<ReturnType<Font["getGlyph"]>>,
	ppem: number,
	depth: number,
): HintedGlyph | null {
	if (glyph.type !== "composite") return null;
	if (depth > 16) return null;

	const xCoords: number[] = [];
	const yCoords: number[] = [];
	const flags: number[] = [];
	const contourEnds: number[] = [];
	const parentPoints: { x: number; y: number }[] = [];
	let pointIndex = 0;

	for (let i = 0; i < glyph.components.length; i++) {
		const component = glyph.components[i]!;
		const hinted = getCachedHintedGlyph(
			engine,
			font,
			component.glyphId,
			ppem,
			depth + 1,
		);
		if (!hinted || hinted.xCoords.length === 0) continue;

		const [a, b, c, d] = component.transform;
		const hasXY = (component.flags & CompositeFlag.ArgsAreXYValues) !== 0;

		let dx26 = 0;
		let dy26 = 0;

		if (hasXY) {
			let dx = component.arg1;
			let dy = component.arg2;
			if (shouldScaleComponentOffset(component.flags)) {
				const scaledX = a * dx + c * dy;
				const scaledY = b * dx + d * dy;
				dx = scaledX;
				dy = scaledY;
			}
			dx26 = scaleFUnits(dx, engine.ctx.scaleFix);
			dy26 = scaleFUnits(dy, engine.ctx.scaleFix);
			if (component.flags & CompositeFlag.RoundXYToGrid) {
				dx26 = roundOffsetToGrid(dx26);
				dy26 = roundOffsetToGrid(dy26);
			}
		} else {
			const parentIndex = component.arg1;
			const compIndex = component.arg2;
			if (
				parentIndex >= 0 &&
				parentIndex < parentPoints.length &&
				compIndex >= 0 &&
				compIndex < hinted.xCoords.length
			) {
				const parentPoint = parentPoints[parentIndex]!;
				const compX =
					a * hinted.xCoords[compIndex]! + c * hinted.yCoords[compIndex]!;
				const compY =
					b * hinted.xCoords[compIndex]! + d * hinted.yCoords[compIndex]!;
				dx26 = Math.round(parentPoint.x - compX);
				dy26 = Math.round(parentPoint.y - compY);
			}
		}

		for (let j = 0; j < hinted.xCoords.length; j++) {
			const hx = hinted.xCoords[j]!;
			const hy = hinted.yCoords[j]!;
			const x = Math.round(a * hx + c * hy + dx26);
			const y = Math.round(b * hx + d * hy + dy26);
			xCoords.push(x);
			yCoords.push(y);
			flags.push(hinted.flags[j] ?? 0);
			parentPoints.push({ x, y });
		}

		for (let j = 0; j < hinted.contourEnds.length; j++) {
			contourEnds.push(pointIndex + hinted.contourEnds[j]!);
		}
		pointIndex += hinted.xCoords.length;
	}

	if (xCoords.length === 0) return null;
	return {
		xCoords,
		yCoords,
		flags: new Uint8Array(flags),
		contourEnds,
		error: null,
	};
}

/** Get cached hinted glyph or compute and cache it */
function getCachedHintedGlyph(
	engine: HintingEngine,
	font: Font,
	glyphId: GlyphId,
	ppem: number,
	pointSize: number,
	depth: number = 0,
): HintedGlyph | null {
	const pointKey = Math.round(pointSize * 64);
	const key = `${glyphId}:${ppem}:${pointKey}:${engine.ctx.lightMode ? "light" : "full"}`;
	let cache = hintedGlyphCache.get(font);
	if (!cache) {
		cache = new Map();
		hintedGlyphCache.set(font, cache);
	}

	const cached = cache.get(key);
	if (cached !== undefined) return cached;

	const glyph = font.getGlyph(glyphId);
	if (!glyph || glyph.type === "empty") {
		cache.set(key, null);
		return null;
	}

	const error = setSize(engine, ppem, pointSize);
	if (error) {
		cache.set(key, null);
		return null;
	}

	if (glyph.type === "composite" && glyph.instructions.length === 0) {
		const compositeHinted = hintCompositeGlyph(
			engine,
			font,
			glyph,
			ppem,
			depth,
		);
		if (compositeHinted && compositeHinted.xCoords.length > 0) {
			cache.set(key, compositeHinted);
			return compositeHinted;
		}
	}

	// Compute hinted glyph from flattened outline
	const outline = glyphToOutline(font, glyphId, engine.ctx.scale);
	if (!outline) {
		cache.set(key, null);
		return null;
	}

	const hinted = hintGlyph(engine, outline);
	if (hinted.error || hinted.xCoords.length === 0) {
		cache.set(key, null);
		return null;
	}

	cache.set(key, hinted);
	return hinted;
}

/** Get or create hinting engine for a font */
function getHintingEngine(font: Font): HintingEngine | null {
	if (!font.isTrueType || !font.hasHinting) return null;

	let engine = hintingEngineCache.get(font);
	if (engine) return engine;

	const cvt = font.cvtTable;
	const cvtValues = cvt ? new Int32Array(cvt.values) : undefined;

	const maxp = font.maxp;
	engine = createHintingEngine(
		font.unitsPerEm,
		"maxStackElements" in maxp ? maxp.maxStackElements : 256,
		"maxStorage" in maxp ? maxp.maxStorage : 64,
		"maxFunctionDefs" in maxp ? maxp.maxFunctionDefs : 64,
		"maxTwilightPoints" in maxp ? maxp.maxTwilightPoints : 16,
		cvtValues,
	);

	const fpgm = font.fpgm;
	if (fpgm) loadFontProgram(engine, fpgm.instructions);

	const prep = font.prep;
	if (prep) loadCVTProgram(engine, prep.instructions);

	hintingEngineCache.set(font, engine);
	return engine;
}

/** Convert TrueType glyph to outline for hinting */
function glyphToOutline(
	font: Font,
	glyphId: GlyphId,
	scale?: number,
): GlyphOutline | null {
	const glyph = font.getGlyph(glyphId);
	if (!glyph || glyph.type === "empty") return null;

	const xCoords: number[] = [];
	const yCoords: number[] = [];
	const flags: number[] = [];
	const contourEnds: number[] = [];

	// Get metrics for phantom points
	const advanceWidth = font.advanceWidth(glyphId);
	const lsb = font.leftSideBearing(glyphId);

	if (glyph.type === "composite" && glyph.instructions.length > 0 && scale) {
		const points26 = buildGlyphPoints26(font, glyphId, scale);
		if (!points26 || points26.xCoords.length === 0) return null;
		const invScale = 1 / scale;
		for (let i = 0; i < points26.xCoords.length; i++) {
			xCoords.push(points26.xCoords[i]! * invScale);
			yCoords.push(points26.yCoords[i]! * invScale);
			flags.push(points26.flags[i] ?? 0);
		}
		for (let i = 0; i < points26.contourEnds.length; i++) {
			contourEnds.push(points26.contourEnds[i]!);
		}
	} else {
		const contours =
			glyph.type === "simple" ? glyph.contours : font.getGlyphContours(glyphId);
		if (!contours || contours.length === 0) return null;

		let pointIndex = 0;
		for (let i = 0; i < contours.length; i++) {
			const contour = contours[i]!;
			for (let j = 0; j < contour.length; j++) {
				const point = contour[j]!;
				xCoords.push(point.x);
				yCoords.push(point.y);
				flags.push(point.onCurve ? 1 : 0);
				pointIndex++;
			}
			contourEnds.push(pointIndex - 1);
		}
	}

	return {
		xCoords,
		yCoords,
		flags: new Uint8Array(flags),
		contourEnds,
		instructions: glyph.instructions,
		lsb,
		advanceWidth,
		isComposite: glyph.type === "composite",
	};
}

function glyphToOutlineWithVariation(
	font: Font,
	glyphId: GlyphId,
	axisCoords: number[],
): GlyphOutline | null {
	const glyph = font.getGlyph(glyphId);
	if (!glyph || glyph.type === "empty") return null;

	const contours = font.getGlyphContoursWithVariation(glyphId, axisCoords);
	if (!contours || contours.length === 0) return null;

	const xCoords: number[] = [];
	const yCoords: number[] = [];
	const flags: number[] = [];
	const contourEnds: number[] = [];

	let advanceWidth = font.advanceWidth(glyphId);
	let lsb = font.leftSideBearing(glyphId);
	if (axisCoords.length > 0 && font.hvar) {
		advanceWidth += getAdvanceWidthDelta(font.hvar, glyphId, axisCoords);
		lsb += getLsbDelta(font.hvar, glyphId, axisCoords);
	}

	let pointIndex = 0;
	for (let i = 0; i < contours.length; i++) {
		const contour = contours[i]!;
		for (let j = 0; j < contour.length; j++) {
			const point = contour[j]!;
			xCoords.push(point.x);
			yCoords.push(point.y);
			flags.push(point.onCurve ? 1 : 0);
			pointIndex++;
		}
		contourEnds.push(pointIndex - 1);
	}

	return {
		xCoords,
		yCoords,
		flags: new Uint8Array(flags),
		contourEnds,
		instructions: glyph.instructions,
		lsb,
		advanceWidth,
		isComposite: glyph.type === "composite",
	};
}

/**
 * Decompose hinted glyph to rasterizer.
 * Mirrors FT_Outline_Decompose: a contour starting with an off-curve point
 * begins at the last point (if on-curve) or at the first/last midpoint
 * (both off-curve), and every contour closes back to its start point so
 * no winding leaks across scanlines.
 */
function decomposeHintedGlyph(
	raster: GrayRaster,
	hinted: HintedGlyph,
	offsetX: number,
	offsetY: number,
): void {
	const { xCoords, yCoords, flags, contourEnds } = hinted;
	const offX = offsetX << 8;
	const offY = offsetY << 8;

	let first = 0;
	for (let c = 0; c < contourEnds.length; c++) {
		const last = contourEnds[c]!;
		if (last < first) {
			first = last + 1;
			continue;
		}

		// Convert 26.6 to rasterizer format (shift left 2 for 26.8), flip Y
		let start = first;
		let limit = last;
		let startX: number;
		let startY: number;

		if ((flags[first]! & 1) !== 0) {
			startX = ((xCoords[first]! << 2) | 0) + offX;
			startY = ((-yCoords[first]! << 2) | 0) + offY;
			start = first + 1;
		} else if ((flags[last]! & 1) !== 0) {
			// First point is off-curve: start at the on-curve last point,
			// which is consumed as the start instead of walked
			startX = ((xCoords[last]! << 2) | 0) + offX;
			startY = ((-yCoords[last]! << 2) | 0) + offY;
			limit = last - 1;
		} else {
			// First and last both off-curve: start at their midpoint
			startX = (((xCoords[first]! + xCoords[last]!) << 1) | 0) + offX;
			startY = (((-yCoords[first]! - yCoords[last]!) << 1) | 0) + offY;
		}

		raster.moveTo(startX, startY);

		let closed = false;
		let i = start;
		while (i <= limit) {
			if ((flags[i]! & 1) !== 0) {
				raster.lineTo(
					((xCoords[i]! << 2) | 0) + offX,
					((-yCoords[i]! << 2) | 0) + offY,
				);
				i++;
				continue;
			}

			// Off-curve conic control: consume following points until an
			// on-curve endpoint; past the contour end, close back to start
			let cx = ((xCoords[i]! << 2) | 0) + offX;
			let cy = ((-yCoords[i]! << 2) | 0) + offY;
			i++;
			for (;;) {
				if (i > limit) {
					raster.conicTo(cx, cy, startX, startY);
					closed = true;
					break;
				}
				const onCurve = (flags[i]! & 1) !== 0;
				const nx = ((xCoords[i]! << 2) | 0) + offX;
				const ny = ((-yCoords[i]! << 2) | 0) + offY;
				i++;
				if (onCurve) {
					raster.conicTo(cx, cy, nx, ny);
					break;
				}
				// Two consecutive off-curve points: split at implicit midpoint
				raster.conicTo(cx, cy, (cx + nx) >> 1, (cy + ny) >> 1);
				cx = nx;
				cy = ny;
			}
			if (closed) break;
		}

		if (!closed) {
			raster.lineTo(startX, startY);
		}

		first = last + 1;
	}
}

/** Threshold for using band processing (height in pixels) */
const BAND_PROCESSING_THRESHOLD = 256;

/**
 * Rasterize a glyph path to a bitmap
 * @param path Glyph path to rasterize
 * @param options Rasterization options including dimensions, scale, and pixel mode
 * @returns Rendered bitmap of the glyph
 */
export function rasterizePath(
	path: GlyphPath,
	options: RasterizeOptions,
): Bitmap {
	const {
		width,
		height,
		scale,
		offsetX = 0,
		offsetY = 0,
		pixelMode = PixelMode.Gray,
		fillRule = FillRule.NonZero,
		flipY = true,
		rasterizer = "freetype",
		out,
	} = options;

	// Create bitmap (non-shared since this is a public API and callers keep
	// references). A caller-owned zeroed `out` buffer of the exact size is
	// reused when supplied, letting hot paths pool transient raster buffers.
	let bitmap: Bitmap;
	if (out !== undefined) {
		const bytesPerPixel =
			pixelMode === PixelMode.RGBA
				? 4
				: pixelMode === PixelMode.LCD || pixelMode === PixelMode.LCD_V
					? 3
					: pixelMode === PixelMode.Mono
						? 0.125
						: 1;
		const pitch =
			pixelMode === PixelMode.Mono
				? Math.ceil(width / 8)
				: Math.ceil(width * bytesPerPixel);
		if (out.length === pitch * height) {
			bitmap = {
				width,
				rows: height,
				pitch,
				buffer: out,
				pixelMode,
				numGrays: pixelMode === PixelMode.Mono ? 2 : 256,
			};
		} else {
			bitmap = createBitmap(width, height, pixelMode);
		}
	} else {
		bitmap = createBitmap(width, height, pixelMode);
	}

	if (
		rasterizer === "libass" &&
		pixelMode === PixelMode.Gray &&
		fillRule === FillRule.NonZero &&
		bitmap.pitch === width
	) {
		const profile = fillProfileOn;
		const start = profile ? performance.now() : 0;
		initAssRasterWasm();
		if (
			isAssRasterWasmEnabled() &&
			fillAssPathWasm(
				path,
				width,
				height,
				scale,
				offsetX,
				offsetY,
				flipY,
				bitmap.buffer,
			)
		) {
			if (profile) {
				fillProfileMs += performance.now() - start;
				fillProfileCount++;
			}
			return bitmap;
		}
	}

	// Reuse shared rasterizer
	const raster = getSharedRaster();
	raster.setClip(0, 0, width, height);

	// Use band processing for large glyphs to ensure bounded memory
	if (height > BAND_PROCESSING_THRESHOLD) {
		const decomposeFn = () =>
			decomposePath(raster, path, scale, offsetX, offsetY, flipY);
		raster.renderWithBands(
			bitmap,
			decomposeFn,
			{ minY: 0, maxY: height },
			fillRule,
		);
	} else {
		// Small glyph - render in single pass with full height band.
		// Optional WASM fast path for the common gray, top-down fill: record the
		// post-flatten polyline (bezier subdivision still runs in JS), then run the
		// self-verified wasm kernel. Any decline falls back to the scalar sweep.
		const profile = fillProfileOn;
		const tp = profile ? performance.now() : 0;
		if (pixelMode === PixelMode.Gray && bitmap.pitch === width) {
			initFillWasm();
			if (isFillWasmEnabled()) {
				raster.beginRecord();
				decomposePath(raster, path, scale, offsetX, offsetY, flipY);
				raster.endRecord();
				if (
					fillGlyphGrayWasm(
						raster.getCmd(),
						raster.getCmdCount(),
						width,
						height,
						fillRule,
						bitmap.buffer,
					)
				) {
					if (profile) {
						fillProfileMs += performance.now() - tp;
						fillProfileCount++;
					}
					return bitmap;
				}
			}
		}
		raster.setBandBounds(0, height);
		raster.reset();
		decomposePath(raster, path, scale, offsetX, offsetY, flipY);
		raster.sweep(bitmap, fillRule);
		if (profile) {
			fillProfileMs += performance.now() - tp;
			fillProfileCount++;
		}
	}

	return bitmap;
}

/**
 * Rasterize a glyph from a font
 * @param font Font containing the glyph
 * @param glyphId ID of the glyph to rasterize
 * @param fontSize Font size in pixels
 * @param options Optional rendering settings (pixel mode, padding, hinting)
 * @returns Rasterized glyph with bitmap and bearing information, or null if glyph is empty
 */
export function rasterizeGlyph(
	font: Font,
	glyphId: GlyphId,
	fontSize: number,
	options?: GlyphRasterizeOptions,
): RasterizedGlyph | null {
	const padding = options?.padding ?? 0;
	const pixelMode = options?.pixelMode ?? PixelMode.Gray;
	const useHinting = options?.hinting ?? false;
	const hintTarget = options?.hintTarget ?? "auto";
	const sizeMode = options?.sizeMode;
	const effectiveSize = resolveFontSize(font, fontSize, sizeMode);

	// Try hinted rendering if requested
	if (useHinting && font.hasHinting) {
		const pointSize = sizeMode === "height" ? fontSize : effectiveSize;
		const result = rasterizeHintedGlyph(
			font,
			glyphId,
			effectiveSize,
			padding,
			pixelMode,
			pointSize,
			hintTarget,
		);
		if (result) return result;
	}

	// Fall back to unhinted rendering
	if (font.isTrueType) {
		const scale26 = (effectiveSize * 64) / font.unitsPerEm;
		const points26 = buildGlyphPoints26(font, glyphId, scale26, 0, {
			roundCompositeOffsets: false,
		});
		if (points26) {
			const raster = rasterizeTrueTypePoints26(points26, padding, pixelMode);
			if (raster) return raster;
		}
	}

	const path = getGlyphPath(font, glyphId);
	if (!path) return null;

	const scale = effectiveSize / font.unitsPerEm;

	// Get bounds
	const bounds = getPathBounds(path, scale, true, true);
	if (!bounds) {
		return {
			bitmap: createBitmap(1, 1, pixelMode),
			bearingX: 0,
			bearingY: 0,
		};
	}

	const width = bounds.maxX - bounds.minX + padding * 2;
	const height = bounds.maxY - bounds.minY + padding * 2;

	if (width <= 0 || height <= 0) {
		return {
			bitmap: createBitmap(1, 1, pixelMode),
			bearingX: 0,
			bearingY: 0,
		};
	}

	const offsetX = -bounds.minX + padding;
	const offsetY = -bounds.minY + padding;

	const bitmap = rasterizePath(path, {
		width,
		height,
		scale,
		offsetX,
		offsetY,
		pixelMode,
		flipY: true,
	});

	return {
		bitmap,
		bearingX: bounds.minX - padding,
		bearingY: -(bounds.minY - padding),
	};
}

export function rasterizeGlyphWithVariation(
	font: Font,
	glyphId: GlyphId,
	fontSize: number,
	axisCoords: number[],
	options?: GlyphRasterizeOptions,
): RasterizedGlyph | null {
	const useHinting = options?.hinting ?? false;
	const hintTarget = options?.hintTarget ?? "auto";
	let hasVariation = false;
	for (let i = 0; i < axisCoords.length; i++) {
		if (axisCoords[i] !== 0) {
			hasVariation = true;
			break;
		}
	}
	if (!hasVariation) {
		return rasterizeGlyph(font, glyphId, fontSize, options);
	}

	const padding = options?.padding ?? 0;
	const pixelMode = options?.pixelMode ?? PixelMode.Gray;
	const sizeMode = options?.sizeMode;
	const effectiveSize = resolveFontSize(font, fontSize, sizeMode);

	if (useHinting && font.hasHinting) {
		const pointSize = sizeMode === "height" ? fontSize : effectiveSize;
		const result = rasterizeHintedGlyphWithVariation(
			font,
			glyphId,
			effectiveSize,
			padding,
			pixelMode,
			axisCoords,
			pointSize,
			hintTarget,
		);
		if (result) return result;
	}

	const contours = font.getGlyphContoursWithVariation(glyphId, axisCoords);
	if (!contours || contours.length === 0) return null;

	const scale = effectiveSize / font.unitsPerEm;
	const bounds = getContourBounds(contours, scale, true, true);
	if (!bounds) {
		return {
			bitmap: createBitmap(1, 1, pixelMode),
			bearingX: 0,
			bearingY: 0,
		};
	}

	const width = bounds.maxX - bounds.minX + padding * 2;
	const height = bounds.maxY - bounds.minY + padding * 2;
	if (width <= 0 || height <= 0) {
		return {
			bitmap: createBitmap(1, 1, pixelMode),
			bearingX: 0,
			bearingY: 0,
		};
	}

	const bitmap = createBitmap(width, height, pixelMode);
	const raster = getSharedRaster();
	raster.setClip(0, 0, width, height);
	const offsetX = -bounds.minX + padding;
	const offsetY = -bounds.minY + padding;

	if (height > BAND_PROCESSING_THRESHOLD) {
		const decomposeFn = () =>
			decomposeContours(raster, contours, scale, offsetX, offsetY, true);
		raster.renderWithBands(
			bitmap,
			decomposeFn,
			{ minY: 0, maxY: height },
			FillRule.NonZero,
		);
	} else {
		raster.setBandBounds(0, height);
		raster.reset();
		decomposeContours(raster, contours, scale, offsetX, offsetY, true);
		raster.sweep(bitmap, FillRule.NonZero);
	}

	return {
		bitmap,
		bearingX: bounds.minX - padding,
		bearingY: -(bounds.minY - padding),
	};
}

/**
 * Rasterize a glyph and apply a bitmap transform (2D or 3D)
 */
export function rasterizeGlyphWithTransform(
	font: Font,
	glyphId: GlyphId,
	fontSize: number,
	matrix: Matrix2D | Matrix3x3,
	options?: GlyphRasterizeOptions & {
		/** Translation offset in 26.6 units (applied after matrix) */
		offsetX26?: number;
		/** Translation offset in 26.6 units (applied after matrix) */
		offsetY26?: number;
	},
): RasterizedGlyph | null {
	const raster = rasterizeGlyph(font, glyphId, fontSize, options);
	if (!raster) return null;

	const transformOptions = {
		bearingX: raster.bearingX,
		bearingY: raster.bearingY,
		offsetX26: options?.offsetX26,
		offsetY26: options?.offsetY26,
	};

	if (Array.isArray(matrix[0])) {
		const result = transformBitmap3D(
			raster.bitmap,
			matrix as Matrix3x3,
			transformOptions,
		);
		return result;
	}

	const result = transformBitmap2D(
		raster.bitmap,
		matrix as Matrix2D,
		transformOptions,
	);
	return result;
}

/** Rasterize a glyph with TrueType hinting */
function rasterizeHintedGlyph(
	font: Font,
	glyphId: GlyphId,
	fontSize: number,
	padding: number,
	pixelMode: PixelMode,
	pointSize: number = fontSize,
	hintTarget: HintTarget = "auto",
): RasterizedGlyph | null {
	const engine = getHintingEngine(font);
	if (!engine) return null;

	const ppem = Math.round(fontSize);
	engine.ctx.lightMode = resolveHintLightMode(hintTarget, pixelMode);
	engine.ctx.renderMode =
		pixelMode === PixelMode.Mono
			? "mono"
			: pixelMode === PixelMode.LCD
				? "lcd"
				: pixelMode === PixelMode.LCD_V
					? "lcd_v"
					: "gray";
	engine.ctx.grayscale =
		engine.ctx.renderMode !== "mono" && !engine.ctx.lightMode;

	// Get cached hinted glyph (includes outline computation and hinting)
	const hinted = getCachedHintedGlyph(engine, font, glyphId, ppem, pointSize);
	if (!hinted) return null;
	const hintedForRaster = hinted;

	// Calculate bounds from hinted coordinates (26.6 fixed point)
	// Keep in 26.6 format, divide once at end (batch conversion)
	const xCoords = hintedForRaster.xCoords;
	const yCoords = hintedForRaster.yCoords;
	let minX26 = xCoords[0];
	let minY26 = yCoords[0];
	let maxX26 = xCoords[0];
	let maxY26 = yCoords[0];
	for (let i = 1; i < xCoords.length; i++) {
		const x = xCoords[i];
		const y = yCoords[i];
		if (x < minX26) minX26 = x;
		if (x > maxX26) maxX26 = x;
		if (y < minY26) minY26 = y;
		if (y > maxY26) maxY26 = y;
	}

	if (!Number.isFinite(minX26)) {
		return { bitmap: createBitmap(1, 1, pixelMode), bearingX: 0, bearingY: 0 };
	}

	const glyphBounds = font.getGlyphBounds(glyphId);
	if (glyphBounds) {
		const scale = fontSize / font.unitsPerEm;
		const unhintedWidth = (glyphBounds.xMax - glyphBounds.xMin) * scale;
		const unhintedHeight = (glyphBounds.yMax - glyphBounds.yMin) * scale;
		const maxWidth = Math.max(
			unhintedWidth * 8,
			fontSize * 8,
			unhintedWidth + 64,
		);
		const maxHeight = Math.max(
			unhintedHeight * 8,
			fontSize * 8,
			unhintedHeight + 64,
		);

		const hintedWidth = (maxX26 - minX26) / 64;
		const hintedHeight = (maxY26 - minY26) / 64;
		if (hintedWidth > maxWidth || hintedHeight > maxHeight) {
			return null;
		}
	}

	const bMinX = Math.floor(minX26 / 64);
	const bMinY = Math.floor(minY26 / 64);
	const bMaxX = Math.floor((maxX26 + 63) / 64);
	const bMaxY = Math.floor((maxY26 + 63) / 64);
	const width = bMaxX - bMinX + padding * 2;
	const height = bMaxY - bMinY + padding * 2;
	if (width <= 0 || height <= 0) {
		return { bitmap: createBitmap(1, 1, pixelMode), bearingX: 0, bearingY: 0 };
	}

	// Render to shared buffer first, then copy to output bitmap
	const tempBitmap = createBitmapShared(width, height, pixelMode);

	// Reuse shared rasterizer
	const raster = getSharedRaster();
	raster.setClip(0, 0, width, height);
	raster.setBandBounds(0, height);
	raster.reset();

	const offsetX = -bMinX + padding;
	const offsetY = bMaxY + padding;

	const decomposeFn = () =>
		decomposeHintedGlyph(raster, hintedForRaster, offsetX, offsetY);

	try {
		decomposeFn();
		raster.sweep(tempBitmap, FillRule.NonZero);
	} catch (e) {
		if (e instanceof PoolOverflowError) {
			raster.reset();
			raster.renderWithBands(
				tempBitmap,
				decomposeFn,
				{ minY: 0, maxY: height, minX: 0, maxX: width },
				FillRule.NonZero,
			);
		} else {
			throw e;
		}
	}

	// Copy to owned buffer (shared buffer will be reused on next call)
	const bitmap = createBitmap(width, height, pixelMode);
	bitmap.buffer.set(tempBitmap.buffer);

	return {
		bitmap,
		bearingX: bMinX - padding,
		bearingY: bMaxY + padding,
	};
}

function rasterizeHintedGlyphWithVariation(
	font: Font,
	glyphId: GlyphId,
	fontSize: number,
	padding: number,
	pixelMode: PixelMode,
	axisCoords: number[],
	pointSize: number = fontSize,
	hintTarget: HintTarget = "auto",
): RasterizedGlyph | null {
	const engine = getHintingEngine(font);
	if (!engine) return null;

	const ppem = Math.round(fontSize);
	engine.ctx.lightMode = resolveHintLightMode(hintTarget, pixelMode);
	engine.ctx.renderMode =
		pixelMode === PixelMode.Mono
			? "mono"
			: pixelMode === PixelMode.LCD
				? "lcd"
				: pixelMode === PixelMode.LCD_V
					? "lcd_v"
					: "gray";
	engine.ctx.grayscale =
		engine.ctx.renderMode !== "mono" && !engine.ctx.lightMode;

	const error = setSize(engine, ppem, pointSize);
	if (error) return null;

	const outline = glyphToOutlineWithVariation(font, glyphId, axisCoords);
	if (!outline) return null;

	const hinted = hintGlyph(engine, outline);
	if (hinted.error || hinted.xCoords.length === 0) return null;

	const xCoords = hinted.xCoords;
	const yCoords = hinted.yCoords;
	let minX26 = xCoords[0];
	let minY26 = yCoords[0];
	let maxX26 = xCoords[0];
	let maxY26 = yCoords[0];
	for (let i = 1; i < xCoords.length; i++) {
		const x = xCoords[i];
		const y = yCoords[i];
		if (x < minX26) minX26 = x;
		if (x > maxX26) maxX26 = x;
		if (y < minY26) minY26 = y;
		if (y > maxY26) maxY26 = y;
	}
	if (!Number.isFinite(minX26)) {
		return { bitmap: createBitmap(1, 1, pixelMode), bearingX: 0, bearingY: 0 };
	}

	const bMinX = Math.floor(minX26 / 64);
	const bMinY = Math.floor(minY26 / 64);
	const bMaxX = Math.floor((maxX26 + 63) / 64);
	const bMaxY = Math.floor((maxY26 + 63) / 64);
	const width = bMaxX - bMinX + padding * 2;
	const height = bMaxY - bMinY + padding * 2;
	if (width <= 0 || height <= 0) {
		return { bitmap: createBitmap(1, 1, pixelMode), bearingX: 0, bearingY: 0 };
	}

	const tempBitmap = createBitmapShared(width, height, pixelMode);
	const raster = getSharedRaster();
	raster.setClip(0, 0, width, height);
	raster.setBandBounds(0, height);
	raster.reset();

	const offsetX = -bMinX + padding;
	const offsetY = bMaxY + padding;
	const decomposeFn = () =>
		decomposeHintedGlyph(raster, hinted, offsetX, offsetY);

	try {
		decomposeFn();
		raster.sweep(tempBitmap, FillRule.NonZero);
	} catch (e) {
		if (e instanceof PoolOverflowError) {
			raster.reset();
			raster.renderWithBands(
				tempBitmap,
				decomposeFn,
				{ minY: 0, maxY: height, minX: 0, maxX: width },
				FillRule.NonZero,
			);
		} else {
			throw e;
		}
	}

	const bitmap = createBitmap(width, height, pixelMode);
	bitmap.buffer.set(tempBitmap.buffer);

	return {
		bitmap,
		bearingX: bMinX - padding,
		bearingY: bMaxY + padding,
	};
}

function rasterizeTrueTypePoints26(
	points: Points26,
	padding: number,
	pixelMode: PixelMode,
): RasterizedGlyph | null {
	const xCoords = points.xCoords;
	const yCoords = points.yCoords;
	if (xCoords.length === 0) return null;

	let minX26 = xCoords[0]!;
	let minY26 = yCoords[0]!;
	let maxX26 = xCoords[0]!;
	let maxY26 = yCoords[0]!;
	for (let i = 1; i < xCoords.length; i++) {
		const x = xCoords[i]!;
		const y = yCoords[i]!;
		if (x < minX26) minX26 = x;
		if (x > maxX26) maxX26 = x;
		if (y < minY26) minY26 = y;
		if (y > maxY26) maxY26 = y;
	}

	if (!Number.isFinite(minX26)) {
		return { bitmap: createBitmap(1, 1, pixelMode), bearingX: 0, bearingY: 0 };
	}

	const bMinX = Math.floor(minX26 / 64);
	const bMinY = Math.floor(minY26 / 64);
	const bMaxX = Math.floor((maxX26 + 63) / 64);
	const bMaxY = Math.floor((maxY26 + 63) / 64);
	const width = bMaxX - bMinX + padding * 2;
	const height = bMaxY - bMinY + padding * 2;
	if (width <= 0 || height <= 0) {
		return { bitmap: createBitmap(1, 1, pixelMode), bearingX: 0, bearingY: 0 };
	}

	const tempBitmap = createBitmapShared(width, height, pixelMode);
	const raster = getSharedRaster();
	raster.setClip(0, 0, width, height);
	raster.setBandBounds(0, height);
	raster.reset();

	const offsetX = -bMinX + padding;
	const offsetY = bMaxY + padding;
	const hinted: HintedGlyph = {
		xCoords: points.xCoords,
		yCoords: points.yCoords,
		flags: points.flags,
		contourEnds: points.contourEnds,
		error: null,
	};

	const decomposeFn = () =>
		decomposeHintedGlyph(raster, hinted, offsetX, offsetY);
	try {
		decomposeFn();
		raster.sweep(tempBitmap, FillRule.NonZero);
	} catch (e) {
		if (e instanceof PoolOverflowError) {
			raster.reset();
			raster.renderWithBands(
				tempBitmap,
				decomposeFn,
				{ minY: 0, maxY: height, minX: 0, maxX: width },
				FillRule.NonZero,
			);
		} else {
			throw e;
		}
	}

	const bitmap = createBitmap(width, height, pixelMode);
	bitmap.buffer.set(tempBitmap.buffer);

	return {
		bitmap,
		bearingX: bMinX - padding,
		bearingY: bMaxY + padding,
	};
}

/**
 * Rasterize text string using shaped glyphs
 * @param font Font to use for rendering
 * @param text Text string to rasterize
 * @param fontSize Font size in pixels
 * @param options Optional rendering settings (pixel mode, padding)
 * @returns Bitmap containing rendered text, or null if no glyphs
 */
export function rasterizeText(
	font: Font,
	text: string,
	fontSize: number,
	options?: TextRasterizeOptions,
): Bitmap | null {
	// This would integrate with the shaper
	// For now, simple glyph-by-glyph rendering

	const scale = resolveFontScale(font, fontSize, options?.sizeMode);
	const padding = options?.padding ?? 0;
	const pixelMode = options?.pixelMode ?? PixelMode.Gray;

	// Get glyphs for text
	const glyphs: { glyphId: GlyphId; advance: number }[] = [];
	let totalAdvance = 0;
	let maxAscent = 0;
	let maxDescent = 0;

	const textArray = [...text];
	for (let i = 0; i < textArray.length; i++) {
		const char = textArray[i]!;
		const codepoint = char.codePointAt(0);
		if (codepoint === undefined) continue;

		const glyphId = font.glyphId(codepoint);
		if (glyphId === undefined) continue;

		const advance = font.advanceWidth(glyphId) * scale;
		const path = getGlyphPath(font, glyphId);

		if (path?.bounds) {
			maxAscent = Math.max(maxAscent, -path.bounds.yMin * scale);
			maxDescent = Math.max(maxDescent, path.bounds.yMax * scale);
		}

		glyphs.push({ glyphId, advance });
		totalAdvance += advance;
	}

	if (glyphs.length === 0) return null;

	// Create bitmap
	const width = Math.ceil(totalAdvance) + padding * 2;
	const height = Math.ceil(maxAscent + maxDescent) + padding * 2;

	const bitmap = createBitmap(width, height, pixelMode);
	const raster = getSharedRaster();
	raster.setClip(0, 0, width, height);
	raster.setBandBounds(0, height);

	// Render each glyph
	let x = padding;
	const baseline = maxDescent + padding;

	for (let i = 0; i < glyphs.length; i++) {
		const glyph = glyphs[i]!;
		const path = getGlyphPath(font, glyph.glyphId);
		if (path) {
			raster.reset();
			decomposePath(raster, path, scale, x, baseline, true);
			raster.sweep(bitmap);
		}
		x += glyph.advance;
	}

	return bitmap;
}

/**
 * Export bitmap to raw RGBA pixels (for WebGL textures, etc.)
 * @param bitmap Source bitmap to convert
 * @returns RGBA pixel array (4 bytes per pixel)
 */
export function bitmapToRGBA(bitmap: Bitmap): Uint8Array {
	// bitmap.width is always the pixel width
	// For LCD mode, pitch = width * 3 (3 bytes per pixel for R, G, B subpixels)
	const isLCD = bitmap.pixelMode === PixelMode.LCD;
	const isLCDV = bitmap.pixelMode === PixelMode.LCD_V;
	const rgba = new Uint8Array(bitmap.width * bitmap.rows * 4);
	const pitch = bitmap.pitch;
	const absPitch = Math.abs(pitch);
	const origin = pitch < 0 ? (bitmap.rows - 1) * absPitch : 0;

	for (let y = 0; y < bitmap.rows; y++) {
		const srcRow = origin + y * pitch;
		for (let x = 0; x < bitmap.width; x++) {
			const dstIdx = (y * bitmap.width + x) * 4;

			if (bitmap.pixelMode === PixelMode.Gray) {
				const srcIdx = srcRow + x;
				const alpha = bitmap.buffer[srcIdx] ?? 0;
				// Black text on white background
				rgba[dstIdx] = 255 - alpha;
				rgba[dstIdx + 1] = 255 - alpha;
				rgba[dstIdx + 2] = 255 - alpha;
				rgba[dstIdx + 3] = 255;
			} else if (bitmap.pixelMode === PixelMode.Mono) {
				const byteIdx = srcRow + (x >> 3);
				const bitIdx = 7 - (x & 7);
				const alpha = ((bitmap.buffer[byteIdx] ?? 0) >> bitIdx) & 1 ? 255 : 0;
				rgba[dstIdx] = 255 - alpha;
				rgba[dstIdx + 1] = 255 - alpha;
				rgba[dstIdx + 2] = 255 - alpha;
				rgba[dstIdx + 3] = 255;
			} else if (isLCD || isLCDV) {
				// LCD/LCD_V: 3 bytes per pixel (R, G, B subpixel coverage)
				const srcIdx = srcRow + x * 3;
				const r = bitmap.buffer[srcIdx] ?? 0;
				const g = bitmap.buffer[srcIdx + 1] ?? 0;
				const b = bitmap.buffer[srcIdx + 2] ?? 0;
				// Black text on white background with subpixel colors
				rgba[dstIdx] = 255 - r;
				rgba[dstIdx + 1] = 255 - g;
				rgba[dstIdx + 2] = 255 - b;
				rgba[dstIdx + 3] = 255;
			} else if (bitmap.pixelMode === PixelMode.RGBA) {
				const srcIdx = srcRow + x * 4;
				rgba[dstIdx] = bitmap.buffer[srcIdx] ?? 0;
				rgba[dstIdx + 1] = bitmap.buffer[srcIdx + 1] ?? 0;
				rgba[dstIdx + 2] = bitmap.buffer[srcIdx + 2] ?? 0;
				rgba[dstIdx + 3] = bitmap.buffer[srcIdx + 3] ?? 0;
			} else {
				// Fallback for other modes (treat as gray mask)
				const srcIdx = srcRow + x;
				const alpha = bitmap.buffer[srcIdx] ?? 0;
				rgba[dstIdx] = 255 - alpha;
				rgba[dstIdx + 1] = 255 - alpha;
				rgba[dstIdx + 2] = 255 - alpha;
				rgba[dstIdx + 3] = 255;
			}
		}
	}

	return rgba;
}

/**
 * Export bitmap to grayscale array
 * @param bitmap Source bitmap to convert
 * @returns Grayscale pixel array (1 byte per pixel)
 */
export function bitmapToGray(bitmap: Bitmap): Uint8Array {
	if (bitmap.pixelMode === PixelMode.Gray && bitmap.pitch === bitmap.width) {
		return bitmap.buffer;
	}

	const gray = new Uint8Array(bitmap.width * bitmap.rows);
	const pitch = bitmap.pitch;
	const absPitch = Math.abs(pitch);
	const origin = pitch < 0 ? (bitmap.rows - 1) * absPitch : 0;

	for (let y = 0; y < bitmap.rows; y++) {
		const srcRow = origin + y * pitch;
		for (let x = 0; x < bitmap.width; x++) {
			const dstIdx = y * bitmap.width + x;

			if (bitmap.pixelMode === PixelMode.Gray) {
				gray[dstIdx] = bitmap.buffer[srcRow + x] ?? 0;
			} else if (bitmap.pixelMode === PixelMode.Mono) {
				const byteIdx = srcRow + (x >> 3);
				const bitIdx = 7 - (x & 7);
				gray[dstIdx] = ((bitmap.buffer[byteIdx] ?? 0) >> bitIdx) & 1 ? 255 : 0;
			} else if (
				bitmap.pixelMode === PixelMode.LCD ||
				bitmap.pixelMode === PixelMode.LCD_V
			) {
				const srcIdx = srcRow + x * 3;
				const r = bitmap.buffer[srcIdx] ?? 0;
				const g = bitmap.buffer[srcIdx + 1] ?? 0;
				const b = bitmap.buffer[srcIdx + 2] ?? 0;
				gray[dstIdx] = Math.round((r + g + b) / 3);
			} else if (bitmap.pixelMode === PixelMode.RGBA) {
				const srcIdx = srcRow + x * 4;
				// Use alpha as coverage
				gray[dstIdx] = bitmap.buffer[srcIdx + 3] ?? 0;
			}
		}
	}

	return gray;
}

// Re-export bbox
export {
	type BBox,
	evaluateCubic,
	evaluateQuadratic,
	getCubicExtrema,
	getExactBounds,
	getQuadraticExtrema,
} from "./bbox.ts";
// Re-export bitmap utilities
export {
	blendBitmap,
	convertBitmap,
	copyBitmap,
	emboldenBitmap,
	resizeBitmap,
	resizeBitmapBilinear,
} from "./bitmap-utils.ts";
// Re-export blur filters
export {
	blurBitmap,
	boxBlur,
	createGaussianKernel,
	gaussianBlur,
} from "./blur.ts";
// Re-export gradient
export {
	type ColorStop,
	createGradientBitmap,
	type Gradient,
	interpolateGradient,
	type LinearGradient,
	type RadialGradient,
	rasterizePathWithGradient,
} from "./gradient.ts";
// Re-export SDF
export { renderSdf, type SdfOptions } from "./sdf.ts";
// Re-export stroker
export {
	type LineCap,
	type LineJoin,
	type StrokerOptions,
	strokePath,
} from "./stroker.ts";
// Re-export synthetic effects
export {
	condensePath,
	emboldenPath,
	obliquePath,
	transformPath,
} from "./synth.ts";
// Re-export types
export {
	type Bitmap,
	clearBitmap,
	createBitmap,
	createBottomUpBitmap,
	FillRule,
	PixelMode,
	type RasterizedGlyph,
	type RasterizeOptions,
	type Span,
} from "./types.ts";
