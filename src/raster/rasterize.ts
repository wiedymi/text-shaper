/**
 * High-level rasterization API
 */

import type { Font } from "../font/font.ts";
import { CompositeFlag } from "../font/tables/glyf.ts";
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
import { type GlyphPath, getGlyphPath } from "../render/path.ts";
import type { GlyphId } from "../types.ts";
import { PoolOverflowError } from "./cell.ts";
import { GrayRaster } from "./gray-raster.ts";
import { decomposePath, getPathBounds } from "./outline-decompose.ts";
import {
	type Bitmap,
	createBitmap,
	FillRule,
	PixelMode,
	type RasterizedGlyph,
	type RasterizeOptions,
} from "./types.ts";

/** Cached hinting engines per font */
const hintingEngineCache = new WeakMap<Font, HintingEngine>();

/** Shared GrayRaster instance for reuse (avoids 2KB allocation per glyph) */
let sharedRaster: GrayRaster | null = null;

/** Get or create shared rasterizer */
function getSharedRaster(): GrayRaster {
	if (!sharedRaster) sharedRaster = new GrayRaster();
	return sharedRaster;
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
): Points26 | null {
	if (depth > 32) return null;
	const glyph = font.getGlyph(glyphId);
	if (!glyph || glyph.type === "empty") return null;

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
		const comp = buildGlyphPoints26(
			font,
			component.glyphId,
			scale,
			depth + 1,
		);
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
				const compX = a * hinted.xCoords[compIndex]! + c * hinted.yCoords[compIndex]!;
				const compY = b * hinted.xCoords[compIndex]! + d * hinted.yCoords[compIndex]!;
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
	depth: number = 0,
): HintedGlyph | null {
	const key = `${glyphId}:${ppem}`;
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

	const error = setSize(engine, ppem, ppem);
	if (error) {
		cache.set(key, null);
		return null;
	}

	if (glyph.type === "composite" && glyph.instructions.length === 0) {
		const compositeHinted = hintCompositeGlyph(engine, font, glyph, ppem, depth);
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
			glyph.type === "simple"
				? glyph.contours
				: font.getGlyphContours(glyphId);
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
	};
}

/** Decompose hinted glyph to rasterizer */
function decomposeHintedGlyph(
	raster: GrayRaster,
	hinted: HintedGlyph,
	offsetX: number,
	offsetY: number,
): void {
	const { xCoords, yCoords, flags, contourEnds } = hinted;
	let contourIdx = 0,
		contourStart = 0;

	for (let i = 0; i < xCoords.length; i++) {
		const isEnd = i === contourEnds[contourIdx];
		// Convert 26.6 to rasterizer format (shift left 2 for 26.8)
		const x = ((xCoords[i] << 2) | 0) + (offsetX << 8);
		const y = ((-yCoords[i] << 2) | 0) + (offsetY << 8); // Flip Y
		const onCurve = (flags[i] & 1) !== 0;

		if (i === contourStart) {
			raster.moveTo(x, y);
		} else if (onCurve) {
			raster.lineTo(x, y);
		} else {
			const nextIdx = isEnd ? contourStart : i + 1;
			const nx = ((xCoords[nextIdx] << 2) | 0) + (offsetX << 8);
			const ny = ((-yCoords[nextIdx] << 2) | 0) + (offsetY << 8);
			const nextOn = (flags[nextIdx] & 1) !== 0;

			if (nextOn) {
				raster.conicTo(x, y, nx, ny);
				if (!isEnd) i++;
			} else {
				raster.conicTo(x, y, (x + nx) >> 1, (y + ny) >> 1);
			}
		}

		if (isEnd) {
			const sx = ((xCoords[contourStart] << 2) | 0) + (offsetX << 8);
			const sy = ((-yCoords[contourStart] << 2) | 0) + (offsetY << 8);
			if (onCurve && i !== contourStart) raster.lineTo(sx, sy);
			contourIdx++;
			contourStart = i + 1;
		}
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
	} = options;

	// Create bitmap (non-shared since this is a public API and callers keep references)
	const bitmap = createBitmap(width, height, pixelMode);

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
		// Small glyph - render in single pass with full height band
		raster.setBandBounds(0, height);
		raster.reset();
		decomposePath(raster, path, scale, offsetX, offsetY, flipY);
		raster.sweep(bitmap, fillRule);
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
	options?: {
		pixelMode?: PixelMode;
		padding?: number;
		/** Use TrueType hinting if available */
		hinting?: boolean;
	},
): RasterizedGlyph | null {
	const padding = options?.padding ?? 1;
	const pixelMode = options?.pixelMode ?? PixelMode.Gray;
	const useHinting = options?.hinting ?? false;

	// Try hinted rendering if requested
	if (useHinting && font.hasHinting) {
		const result = rasterizeHintedGlyph(
			font,
			glyphId,
			fontSize,
			padding,
			pixelMode,
		);
		if (result) return result;
	}

	// Fall back to unhinted rendering
	const path = getGlyphPath(font, glyphId);
	if (!path) return null;

	const scale = fontSize / font.unitsPerEm;

	// Get bounds
	const bounds = getPathBounds(path, scale, true);
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

/** Rasterize a glyph with TrueType hinting */
function rasterizeHintedGlyph(
	font: Font,
	glyphId: GlyphId,
	fontSize: number,
	padding: number,
	pixelMode: PixelMode,
): RasterizedGlyph | null {
	const engine = getHintingEngine(font);
	if (!engine) return null;

	const ppem = Math.round(fontSize);

	// Get cached hinted glyph (includes outline computation and hinting)
	const hinted = getCachedHintedGlyph(engine, font, glyphId, ppem);
	if (!hinted) return null;
	let hintedForRaster = hinted;
	if (pixelMode === PixelMode.Gray) {
		// Match FreeType light hinting: keep original X positions, hint Y only.
		const baseScale = (ppem * 64) / font.unitsPerEm;
		const base = buildGlyphPoints26(font, glyphId, baseScale);
		if (base && base.xCoords.length === hinted.xCoords.length) {
			hintedForRaster = { ...hinted, xCoords: base.xCoords };
		}
	}

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
		const maxWidth = Math.max(unhintedWidth * 8, fontSize * 8, unhintedWidth + 64);
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
	if (process.env.HINT_TRACE_GLYPH === String(glyphId)) {
		console.log("trace hinted bounds", {
			glyphId,
			minX26,
			maxX26,
			minY26,
			maxY26,
			bMinX,
			bMaxX,
			bMinY,
			bMaxY,
			width,
			height,
		});
	}

	if (width <= 0 || height <= 0) {
		return { bitmap: createBitmap(1, 1, pixelMode), bearingX: 0, bearingY: 0 };
	}

	// Render to shared buffer first, then copy to output bitmap
	const tempBitmap = createBitmapShared(width, height, pixelMode);

	// Reuse shared rasterizer
	const raster = getSharedRaster();
	raster.setClip(0, 0, width, height);
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
	options?: {
		pixelMode?: PixelMode;
		padding?: number;
	},
): Bitmap | null {
	// This would integrate with the shaper
	// For now, simple glyph-by-glyph rendering

	const scale = fontSize / font.unitsPerEm;
	const padding = options?.padding ?? 2;
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
