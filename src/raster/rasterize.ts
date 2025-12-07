/**
 * High-level rasterization API
 */

import type { Font } from "../font/font.ts";
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
import { type GlyphPath, getGlyphPath } from "../render/path.ts";
import type { GlyphId } from "../types.ts";
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
function glyphToOutline(font: Font, glyphId: GlyphId): GlyphOutline | null {
	const glyph = font.getGlyph(glyphId);
	if (!glyph || glyph.type === "empty") return null;

	const xCoords: number[] = [];
	const yCoords: number[] = [];
	const flags: number[] = [];
	const contourEnds: number[] = [];

	// Get metrics for phantom points
	const advanceWidth = font.advanceWidth(glyphId);
	const lsb = font.leftSideBearing(glyphId);

	if (glyph.type === "simple") {
		let pointIndex = 0;
		for (const contour of glyph.contours) {
			for (const point of contour) {
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
		};
	} else {
		// Composite - flatten components
		for (const component of glyph.components) {
			const compGlyph = font.getGlyph(component.glyphId);
			if (!compGlyph || compGlyph.type !== "simple") continue;

			const [a, b, c, d] = component.transform;
			const ox = component.arg1,
				oy = component.arg2;
			let pointOffset = xCoords.length;

			for (const contour of compGlyph.contours) {
				for (const point of contour) {
					xCoords.push(point.x * a + point.y * c + ox);
					yCoords.push(point.x * b + point.y * d + oy);
					flags.push(point.onCurve ? 1 : 0);
					pointOffset++;
				}
				contourEnds.push(pointOffset - 1);
			}
		}
		if (xCoords.length === 0) return null;
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

	// Create bitmap
	const bitmap = createBitmap(width, height, pixelMode);

	// Create rasterizer
	const raster = new GrayRaster();
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

	const outline = glyphToOutline(font, glyphId);
	if (!outline) return null;

	const ppem = Math.round(fontSize);
	const error = setSize(engine, ppem, ppem);
	if (error) return null;

	const hinted = hintGlyph(engine, outline);
	if (hinted.error || hinted.xCoords.length === 0) return null;

	// Calculate bounds from hinted coordinates (26.6 fixed point)
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;
	for (let i = 0; i < hinted.xCoords.length; i++) {
		const x = hinted.xCoords[i] / 64;
		const y = hinted.yCoords[i] / 64;
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
	}

	if (!Number.isFinite(minX)) {
		return { bitmap: createBitmap(1, 1, pixelMode), bearingX: 0, bearingY: 0 };
	}

	const bMinX = Math.floor(minX),
		bMinY = Math.floor(minY);
	const bMaxX = Math.ceil(maxX),
		bMaxY = Math.ceil(maxY);
	const width = bMaxX - bMinX + padding * 2;
	const height = bMaxY - bMinY + padding * 2;

	if (width <= 0 || height <= 0) {
		return { bitmap: createBitmap(1, 1, pixelMode), bearingX: 0, bearingY: 0 };
	}

	const bitmap = createBitmap(width, height, pixelMode);
	const raster = new GrayRaster();
	raster.setClip(0, 0, width, height);
	raster.reset();

	const offsetX = -bMinX + padding;
	const offsetY = height - 1 + bMinY - padding;

	decomposeHintedGlyph(raster, hinted, offsetX, offsetY);
	raster.sweep(bitmap, FillRule.NonZero);

	return {
		bitmap,
		bearingX: bMinX - padding,
		bearingY: bMaxY + padding,
	};
}

/**
 * Rasterize text string using shaped glyphs
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

	for (const char of text) {
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
	const raster = new GrayRaster();
	raster.setClip(0, 0, width, height);

	// Render each glyph
	let x = padding;
	const baseline = maxDescent + padding;

	for (const { glyphId, advance } of glyphs) {
		const path = getGlyphPath(font, glyphId);
		if (path) {
			raster.reset();
			decomposePath(raster, path, scale, x, baseline, true);
			raster.sweep(bitmap);
		}
		x += advance;
	}

	return bitmap;
}

/**
 * Export bitmap to raw RGBA pixels (for WebGL textures, etc.)
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
