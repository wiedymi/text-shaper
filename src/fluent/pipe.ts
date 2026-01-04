/**
 * Pipe-style functional utilities for composing transforms and rendering
 *
 * Provides an alternative to the builder pattern for users who prefer
 * functional composition.
 */

import type { Font } from "../font/font.ts";
import {
	type AsymmetricStrokeOptions,
	strokeAsymmetricCombined as strokeAsymmetricCombinedFn,
	strokeAsymmetric as strokeAsymmetricFn,
} from "../raster/asymmetric-stroke.ts";
import {
	convertBitmap,
	copyBitmap,
	emboldenBitmap as emboldenBitmapFn,
	emboldenBitmapWithBearing,
	padBitmap,
	resizeBitmapBilinear as resizeBitmapBilinearFn,
	resizeBitmap as resizeBitmapFn,
	shearBitmapX as shearBitmapXFn,
	shearBitmapY as shearBitmapYFn,
	shiftBitmap,
	transformBitmap2D as transformBitmap2DFn,
	transformBitmap3D as transformBitmap3DFn,
} from "../raster/bitmap-utils.ts";
import { boxBlur as boxBlurFn, gaussianBlur } from "../raster/blur.ts";
import {
	adaptiveBlur as adaptiveBlurFn,
	cascadeBlur as cascadeBlurFn,
	fastGaussianBlur as fastGaussianBlurFn,
} from "../raster/cascade-blur.ts";
import type { Gradient } from "../raster/gradient.ts";
import {
	type MsdfOptions,
	renderMsdf as renderMsdfFn,
} from "../raster/msdf.ts";
import { getPathBounds } from "../raster/outline-decompose.ts";
import {
	bitmapToGray as bitmapToGrayFn,
	bitmapToRGBA as bitmapToRGBAFn,
	rasterizePath as rasterizePathFn,
	rasterizePathWithGradient,
} from "../raster/rasterize.ts";
import { renderSdf as renderSdfFn, type SdfOptions } from "../raster/sdf.ts";
import type { LineCap, LineJoin, StrokerOptions } from "../raster/stroker.ts";
import { strokePath as strokePathFn } from "../raster/stroker.ts";
import {
	condensePath as condensePathFn,
	emboldenPath as emboldenPathFn,
	obliquePath as obliquePathFn,
} from "../raster/synth.ts";
import type {
	Bitmap,
	PixelMode,
	RasterizeOptions,
	RasterizedGlyph,
} from "../raster/types.ts";
import { FillRule, PixelMode as PM } from "../raster/types.ts";
import type { Matrix2D, Matrix3x3 } from "../render/outline-transform.ts";
import {
	clonePath,
	combinePaths as combinePathsFn,
	rotate2D,
	scale2D,
	shear2D,
	transformOutline2D,
	transformOutline3D,
	translate2D,
} from "../render/outline-transform.ts";
import type { GlyphPath } from "../render/path.ts";
import { getGlyphPath, pathToSVG as pathToSVGFn } from "../render/path.ts";
import type { GlyphId } from "../types.ts";

// === Pipe Function ===

/**
 * Compose functions left-to-right
 *
 * @example
 * ```typescript
 * const result = pipe(
 *   getGlyphPath(font, glyphId),
 *   scale(2, 2),
 *   rotate(Math.PI / 4),
 *   rasterize({ width: 100, height: 100 }),
 *   blur(5),
 *   toRGBA
 * );
 * ```
 */
export function pipe<A>(a: A): A;
export function pipe<A, B>(a: A, ab: (a: A) => B): B;
export function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
export function pipe<A, B, C, D>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
): D;
export function pipe<A, B, C, D, E>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
): E;
export function pipe<A, B, C, D, E, F>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
): F;
export function pipe<A, B, C, D, E, F, G>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
): G;
export function pipe<A, B, C, D, E, F, G, H>(
	a: A,
	ab: (a: A) => B,
	bc: (b: B) => C,
	cd: (c: C) => D,
	de: (d: D) => E,
	ef: (e: E) => F,
	fg: (f: F) => G,
	gh: (g: G) => H,
): H;
export function pipe(
	initial: unknown,
	...fns: Array<(x: unknown) => unknown>
): unknown {
	return fns.reduce((acc, fn) => fn(acc), initial);
}

// === Path Source ===

/**
 * Get glyph path from font (for use with pipe)
 */
export function fromGlyph(font: Font, glyphId: GlyphId): GlyphPath | null {
	return getGlyphPath(font, glyphId);
}

// === Path Transform Operators ===

/**
 * Scale path uniformly or non-uniformly
 */
export function scale(sx: number, sy?: number): (path: GlyphPath) => GlyphPath {
	return (path) => transformOutline2D(path, scale2D(sx, sy ?? sx));
}

/**
 * Translate path by offset
 */
export function translate(
	dx: number,
	dy: number,
): (path: GlyphPath) => GlyphPath {
	return (path) => transformOutline2D(path, translate2D(dx, dy));
}

/**
 * Rotate path by angle in radians
 */
export function rotate(angle: number): (path: GlyphPath) => GlyphPath {
	return (path) => transformOutline2D(path, rotate2D(angle));
}

/**
 * Rotate path by angle in degrees
 */
export function rotateDeg(angleDeg: number): (path: GlyphPath) => GlyphPath {
	return (path) =>
		transformOutline2D(path, rotate2D((angleDeg * Math.PI) / 180));
}

/**
 * Shear/skew path
 */
export function shear(
	shearX: number,
	shearY: number,
): (path: GlyphPath) => GlyphPath {
	return (path) => transformOutline2D(path, shear2D(shearX, shearY));
}

/**
 * Apply italic slant (angle in degrees)
 */
export function italic(angleDeg: number): (path: GlyphPath) => GlyphPath {
	const shearX = Math.tan((angleDeg * Math.PI) / 180);
	return (path) => transformOutline2D(path, shear2D(shearX, 0));
}

/**
 * Apply custom 2D affine matrix
 */
export function matrix(m: Matrix2D): (path: GlyphPath) => GlyphPath {
	return (path) => transformOutline2D(path, m);
}

/**
 * Apply 3D perspective matrix
 */
export function perspective(m: Matrix3x3): (path: GlyphPath) => GlyphPath {
	return (path) => transformOutline3D(path, m);
}

// === Path Effects ===

/**
 * Embolden path
 */
export function emboldenPath(strength: number): (path: GlyphPath) => GlyphPath {
	return (path) => emboldenPathFn(path, strength);
}

/**
 * Condense/expand path horizontally
 */
export function condensePath(factor: number): (path: GlyphPath) => GlyphPath {
	return (path) => condensePathFn(path, factor);
}

/**
 * Apply oblique/slant to path
 */
export function obliquePath(slant: number): (path: GlyphPath) => GlyphPath {
	return (path) => obliquePathFn(path, slant);
}

/**
 * Stroke path to create outline
 */
export function strokePath(
	options: StrokerOptions,
): (path: GlyphPath) => GlyphPath;
export function strokePath(
	width: number,
	cap?: LineCap,
	join?: LineJoin,
): (path: GlyphPath) => GlyphPath;
export function strokePath(
	optionsOrWidth: StrokerOptions | number,
	cap?: LineCap,
	join?: LineJoin,
): (path: GlyphPath) => GlyphPath {
	const opts: StrokerOptions =
		typeof optionsOrWidth === "number"
			? { width: optionsOrWidth, lineCap: cap, lineJoin: join }
			: optionsOrWidth;
	return (path) => strokePathFn(path, opts);
}

/**
 * Clone path
 */
export function clone(): (path: GlyphPath) => GlyphPath {
	return (path) => clonePath(path);
}

/**
 * Combine multiple paths
 */
export function combinePaths(paths: GlyphPath[]): GlyphPath {
	return combinePathsFn(paths);
}

/**
 * Asymmetric stroke with independent X/Y border widths
 */
export function strokeAsymmetric(
	options: AsymmetricStrokeOptions,
): (path: GlyphPath) => { outer: GlyphPath; inner: GlyphPath } {
	return (path) => strokeAsymmetricFn(path, options);
}

/**
 * Asymmetric stroke combined (both inner and outer as single fillable path)
 */
export function strokeAsymmetricCombined(
	options: AsymmetricStrokeOptions,
): (path: GlyphPath) => GlyphPath {
	return (path) => strokeAsymmetricCombinedFn(path, options);
}

// === Rasterization (Path -> Bitmap) ===

/**
 * Rasterize path to bitmap
 */
export function rasterize(
	options: RasterizeOptions,
): (path: GlyphPath) => Bitmap {
	return (path) =>
		rasterizePathFn(path, {
			width: options.width ?? 100,
			height: options.height ?? 100,
			scale: options.scale ?? 1,
			offsetX: options.offsetX ?? 0,
			offsetY: options.offsetY ?? 0,
			pixelMode: options.pixelMode ?? PM.Gray,
			fillRule: options.fillRule ?? FillRule.NonZero,
			flipY: options.flipY ?? true,
		});
}

/**
 * Rasterize with auto-computed size from bounds
 */
export function rasterizeAuto(options?: {
	padding?: number;
	scale?: number;
	pixelMode?: PixelMode;
}): (path: GlyphPath) => Bitmap {
	const { padding = 1, scale: s = 1, pixelMode = PM.Gray } = options ?? {};
	return (path) => {
		const bounds = getPathBounds(path, s, true);
		if (!bounds) {
			const { createBitmap } = require("../raster/types.ts");
			return createBitmap(1, 1, pixelMode);
		}

		const width = bounds.maxX - bounds.minX + padding * 2;
		const height = bounds.maxY - bounds.minY + padding * 2;
		const offsetX = -bounds.minX + padding;
		const offsetY = -bounds.minY + padding;

		return rasterizePathFn(path, {
			width,
			height,
			scale: s,
			offsetX,
			offsetY,
			pixelMode,
			fillRule: FillRule.NonZero,
			flipY: true,
		});
	};
}

/**
 * Rasterize with gradient fill
 */
export function rasterizeWithGradient(
	gradient: Gradient,
	options: RasterizeOptions,
): (path: GlyphPath) => Bitmap {
	return (path) =>
		rasterizePathWithGradient(path, gradient, {
			width: options.width ?? 100,
			height: options.height ?? 100,
			scale: options.scale ?? 1,
			offsetX: options.offsetX ?? 0,
			offsetY: options.offsetY ?? 0,
			pixelMode: options.pixelMode ?? PM.Gray,
			fillRule: options.fillRule ?? FillRule.NonZero,
			flipY: options.flipY ?? true,
		});
}

/**
 * Render path as Signed Distance Field
 */
export function renderSdf(options: SdfOptions): (path: GlyphPath) => Bitmap {
	return (path) => renderSdfFn(path, options);
}

/**
 * Render path as Multi-channel Signed Distance Field
 */
export function renderMsdf(options: MsdfOptions): (path: GlyphPath) => Bitmap {
	return (path) => renderMsdfFn(path, options);
}

// === Bitmap Operators ===

/**
 * Gaussian blur bitmap
 */
export function blur(radius: number): (bitmap: Bitmap) => Bitmap {
	return (bitmap) => gaussianBlur(copyBitmap(bitmap), radius);
}

/**
 * Box blur bitmap
 */
export function boxBlur(radius: number): (bitmap: Bitmap) => Bitmap {
	return (bitmap) => boxBlurFn(copyBitmap(bitmap), radius);
}

/**
 * Cascade blur (fast for large radii)
 */
export function cascadeBlur(
	radiusX: number,
	radiusY?: number,
): (bitmap: Bitmap) => Bitmap {
	return (bitmap) =>
		cascadeBlurFn(copyBitmap(bitmap), radiusX, radiusY ?? radiusX);
}

/**
 * Adaptive blur (auto-selects best algorithm)
 */
export function adaptiveBlur(
	radiusX: number,
	radiusY?: number,
): (bitmap: Bitmap) => Bitmap {
	return (bitmap) =>
		adaptiveBlurFn(copyBitmap(bitmap), radiusX, radiusY ?? radiusX);
}

/**
 * Fast Gaussian blur using cascade algorithm
 * Recommended for large radii (> 3 pixels)
 */
export function fastBlur(radius: number): (bitmap: Bitmap) => Bitmap {
	return (bitmap) => fastGaussianBlurFn(copyBitmap(bitmap), radius);
}

/**
 * Embolden bitmap operator
 */
export function embolden(
	xStrength: number,
	yStrength?: number,
): (bitmap: Bitmap) => Bitmap {
	return (bitmap) =>
		emboldenBitmapFn(bitmap, xStrength, yStrength ?? xStrength);
}

/**
 * Embolden bitmap and expand bearings (for rasterized glyphs)
 */
export function emboldenGlyph(
	xStrength: number,
	yStrength?: number,
): (glyph: RasterizedGlyph) => RasterizedGlyph {
	return (glyph) =>
		emboldenBitmapWithBearing(
			glyph.bitmap,
			glyph.bearingX,
			glyph.bearingY,
			xStrength,
			yStrength ?? xStrength,
		);
}

/**
 * Transform bitmap with 2D matrix (origin at top-left)
 */
export function transformBitmap2D(
	matrix: Matrix2D,
	options?: { offsetX26?: number; offsetY26?: number },
): (bitmap: Bitmap) => Bitmap {
	return (bitmap) =>
		transformBitmap2DFn(bitmap, matrix, {
			bearingX: 0,
			bearingY: 0,
			offsetX26: options?.offsetX26,
			offsetY26: options?.offsetY26,
		}).bitmap;
}

/**
 * Transform bitmap with 3D matrix (origin at top-left)
 */
export function transformBitmap3D(
	matrix: Matrix3x3,
	options?: { offsetX26?: number; offsetY26?: number },
): (bitmap: Bitmap) => Bitmap {
	return (bitmap) =>
		transformBitmap3DFn(bitmap, matrix, {
			bearingX: 0,
			bearingY: 0,
			offsetX26: options?.offsetX26,
			offsetY26: options?.offsetY26,
		}).bitmap;
}

/**
 * Transform rasterized glyph with 2D matrix (bearing-aware)
 */
export function transformGlyph2D(
	matrix: Matrix2D,
	options?: { offsetX26?: number; offsetY26?: number },
): (glyph: RasterizedGlyph) => RasterizedGlyph {
	return (glyph) =>
		transformBitmap2DFn(glyph.bitmap, matrix, {
			bearingX: glyph.bearingX,
			bearingY: glyph.bearingY,
			offsetX26: options?.offsetX26,
			offsetY26: options?.offsetY26,
		});
}

/**
 * Transform rasterized glyph with 3D matrix (bearing-aware)
 */
export function transformGlyph3D(
	matrix: Matrix3x3,
	options?: { offsetX26?: number; offsetY26?: number },
): (glyph: RasterizedGlyph) => RasterizedGlyph {
	return (glyph) =>
		transformBitmap3DFn(glyph.bitmap, matrix, {
			bearingX: glyph.bearingX,
			bearingY: glyph.bearingY,
			offsetX26: options?.offsetX26,
			offsetY26: options?.offsetY26,
		});
}

/**
 * Shear bitmap horizontally (origin at top-left)
 */
export function shearBitmapX(
	amount: number,
	options?: { offsetX26?: number; offsetY26?: number },
): (bitmap: Bitmap) => Bitmap {
	return (bitmap) =>
		shearBitmapXFn(bitmap, amount, {
			bearingX: 0,
			bearingY: 0,
			offsetX26: options?.offsetX26,
			offsetY26: options?.offsetY26,
		}).bitmap;
}

/**
 * Shear bitmap vertically (origin at top-left)
 */
export function shearBitmapY(
	amount: number,
	options?: { offsetX26?: number; offsetY26?: number },
): (bitmap: Bitmap) => Bitmap {
	return (bitmap) =>
		shearBitmapYFn(bitmap, amount, {
			bearingX: 0,
			bearingY: 0,
			offsetX26: options?.offsetX26,
			offsetY26: options?.offsetY26,
		}).bitmap;
}

/**
 * Shear rasterized glyph horizontally (bearing-aware)
 */
export function shearGlyphX(
	amount: number,
	options?: { offsetX26?: number; offsetY26?: number },
): (glyph: RasterizedGlyph) => RasterizedGlyph {
	return (glyph) =>
		shearBitmapXFn(glyph.bitmap, amount, {
			bearingX: glyph.bearingX,
			bearingY: glyph.bearingY,
			offsetX26: options?.offsetX26,
			offsetY26: options?.offsetY26,
		});
}

/**
 * Shear rasterized glyph vertically (bearing-aware)
 */
export function shearGlyphY(
	amount: number,
	options?: { offsetX26?: number; offsetY26?: number },
): (glyph: RasterizedGlyph) => RasterizedGlyph {
	return (glyph) =>
		shearBitmapYFn(glyph.bitmap, amount, {
			bearingX: glyph.bearingX,
			bearingY: glyph.bearingY,
			offsetX26: options?.offsetX26,
			offsetY26: options?.offsetY26,
		});
}

/**
 * Shift bitmap position
 */
export function shift(dx: number, dy: number): (bitmap: Bitmap) => Bitmap {
	return (bitmap) => shiftBitmap(bitmap, dx, dy);
}

/**
 * Resize bitmap with nearest-neighbor
 */
export function resize(
	width: number,
	height: number,
): (bitmap: Bitmap) => Bitmap {
	return (bitmap) => resizeBitmapFn(bitmap, width, height);
}

/**
 * Resize bitmap with bilinear interpolation
 */
export function resizeBilinear(
	width: number,
	height: number,
): (bitmap: Bitmap) => Bitmap {
	return (bitmap) => resizeBitmapBilinearFn(bitmap, width, height);
}

/**
 * Pad bitmap
 */
export function pad(
	left: number,
	top: number,
	right: number,
	bottom: number,
): (bitmap: Bitmap) => Bitmap;
export function pad(all: number): (bitmap: Bitmap) => Bitmap;
export function pad(
	leftOrAll: number,
	top?: number,
	right?: number,
	bottom?: number,
): (bitmap: Bitmap) => Bitmap {
	const l = leftOrAll;
	const t = top ?? leftOrAll;
	const r = right ?? leftOrAll;
	const b = bottom ?? leftOrAll;
	return (bitmap) => padBitmap(bitmap, l, t, r, b);
}

/**
 * Convert bitmap to different pixel mode
 */
export function convert(targetMode: PixelMode): (bitmap: Bitmap) => Bitmap {
	return (bitmap) => convertBitmap(bitmap, targetMode);
}

// === Output Operators ===

/**
 * Convert bitmap to RGBA array
 */
export function toRGBA(bitmap: Bitmap): Uint8Array {
	return bitmapToRGBAFn(bitmap);
}

/**
 * Convert bitmap to grayscale array
 */
export function toGray(bitmap: Bitmap): Uint8Array {
	return bitmapToGrayFn(bitmap);
}

/**
 * Convert path to SVG string
 */
export function toSVG(options?: {
	flipY?: boolean;
	scale?: number;
}): (path: GlyphPath) => string {
	return (path) => pathToSVGFn(path, options);
}

/**
 * Copy bitmap
 */
export function copy(bitmap: Bitmap): Bitmap {
	return copyBitmap(bitmap);
}
