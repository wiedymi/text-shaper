/**
 * BitmapBuilder: Fluent builder for raster bitmap operations
 *
 * All operations are eager (applied immediately) and return new builder instances
 */

import {
	addBitmaps,
	blendBitmap,
	compositeBitmaps,
	convertBitmap,
	copyBitmap,
	emboldenBitmap,
	maxBitmaps,
	mulBitmaps,
	padBitmap,
	resizeBitmap,
	resizeBitmapBilinear,
	shiftBitmap,
	subBitmaps,
} from "../raster/bitmap-utils.ts";
import { boxBlur, gaussianBlur } from "../raster/blur.ts";
import {
	adaptiveBlur,
	cascadeBlur,
	fastGaussianBlur,
} from "../raster/cascade-blur.ts";
import { createGradientBitmap, type Gradient } from "../raster/gradient.ts";
import { bitmapToGray, bitmapToRGBA } from "../raster/rasterize.ts";
import {
	type Bitmap,
	createBitmap,
	PixelMode,
	type RasterizedGlyph,
} from "../raster/types.ts";

/**
 * BitmapBuilder provides a fluent interface for bitmap manipulations
 */
export class BitmapBuilder {
	private constructor(
		private readonly _bitmap: Bitmap,
		private readonly _bearingX: number = 0,
		private readonly _bearingY: number = 0,
	) {}

	// === Static Factory Methods ===

	/**
	 * Create from existing bitmap
	 */
	static fromBitmap(bitmap: Bitmap): BitmapBuilder {
		return new BitmapBuilder(copyBitmap(bitmap));
	}

	/**
	 * Create from existing bitmap with bearing info
	 */
	static fromBitmapWithBearing(
		bitmap: Bitmap,
		bearingX: number,
		bearingY: number,
	): BitmapBuilder {
		return new BitmapBuilder(copyBitmap(bitmap), bearingX, bearingY);
	}

	/**
	 * Create from rasterized glyph result
	 */
	static fromRasterizedGlyph(glyph: RasterizedGlyph): BitmapBuilder {
		return new BitmapBuilder(
			copyBitmap(glyph.bitmap),
			glyph.bearingX,
			glyph.bearingY,
		);
	}

	/**
	 * Create empty bitmap
	 */
	static create(
		width: number,
		height: number,
		pixelMode: PixelMode = PixelMode.Gray,
	): BitmapBuilder {
		return new BitmapBuilder(createBitmap(width, height, pixelMode));
	}

	/**
	 * Create gradient bitmap
	 */
	static fromGradient(
		width: number,
		height: number,
		gradient: Gradient,
	): BitmapBuilder {
		return new BitmapBuilder(createGradientBitmap(width, height, gradient));
	}

	// === Blur Effects ===

	/**
	 * Gaussian blur
	 */
	blur(radius: number): BitmapBuilder {
		const blurred = gaussianBlur(copyBitmap(this._bitmap), radius);
		return new BitmapBuilder(blurred, this._bearingX, this._bearingY);
	}

	/**
	 * Box blur (faster, less smooth)
	 */
	boxBlur(radius: number): BitmapBuilder {
		const blurred = boxBlur(copyBitmap(this._bitmap), radius);
		return new BitmapBuilder(blurred, this._bearingX, this._bearingY);
	}

	/**
	 * Cascade blur (fast for large radii, O(1) per pixel)
	 */
	cascadeBlur(radiusX: number, radiusY?: number): BitmapBuilder {
		const blurred = cascadeBlur(
			copyBitmap(this._bitmap),
			radiusX,
			radiusY ?? radiusX,
		);
		return new BitmapBuilder(blurred, this._bearingX, this._bearingY);
	}

	/**
	 * Adaptive blur (auto-selects best algorithm based on radius)
	 */
	adaptiveBlur(radiusX: number, radiusY?: number): BitmapBuilder {
		const blurred = adaptiveBlur(
			copyBitmap(this._bitmap),
			radiusX,
			radiusY ?? radiusX,
		);
		return new BitmapBuilder(blurred, this._bearingX, this._bearingY);
	}

	/**
	 * Fast Gaussian blur using cascade algorithm
	 * Recommended for large radii (> 3 pixels)
	 */
	fastBlur(radius: number): BitmapBuilder {
		const blurred = fastGaussianBlur(copyBitmap(this._bitmap), radius);
		return new BitmapBuilder(blurred, this._bearingX, this._bearingY);
	}

	// === Transform Effects ===

	/**
	 * Embolden (dilate) bitmap
	 */
	embolden(xStrength: number, yStrength?: number): BitmapBuilder {
		const emboldened = emboldenBitmap(
			this._bitmap,
			xStrength,
			yStrength ?? xStrength,
		);
		return new BitmapBuilder(emboldened, this._bearingX, this._bearingY);
	}

	/**
	 * Shift bitmap position
	 */
	shift(dx: number, dy: number): BitmapBuilder {
		const shifted = shiftBitmap(this._bitmap, dx, dy);
		return new BitmapBuilder(shifted, this._bearingX + dx, this._bearingY - dy);
	}

	/**
	 * Resize with nearest-neighbor interpolation
	 */
	resize(width: number, height: number): BitmapBuilder {
		const resized = resizeBitmap(this._bitmap, width, height);
		return new BitmapBuilder(resized, this._bearingX, this._bearingY);
	}

	/**
	 * Resize with bilinear interpolation (smoother, better for downsampling)
	 */
	resizeBilinear(width: number, height: number): BitmapBuilder {
		const resized = resizeBitmapBilinear(this._bitmap, width, height);
		return new BitmapBuilder(resized, this._bearingX, this._bearingY);
	}

	/**
	 * Pad bitmap with empty space
	 */
	pad(left: number, top: number, right: number, bottom: number): BitmapBuilder;
	pad(all: number): BitmapBuilder;
	pad(
		leftOrAll: number,
		top?: number,
		right?: number,
		bottom?: number,
	): BitmapBuilder {
		const l = leftOrAll;
		const t = top ?? leftOrAll;
		const r = right ?? leftOrAll;
		const b = bottom ?? leftOrAll;
		const padded = padBitmap(this._bitmap, l, t, r, b);
		return new BitmapBuilder(padded, this._bearingX - l, this._bearingY + t);
	}

	// === Compositing ===

	/**
	 * Alpha blend another bitmap onto this one at position
	 */
	blend(
		other: BitmapBuilder | Bitmap,
		x: number,
		y: number,
		opacity: number = 1,
	): BitmapBuilder {
		const src = other instanceof BitmapBuilder ? other._bitmap : other;
		const dst = copyBitmap(this._bitmap);
		blendBitmap(dst, src, x, y, opacity);
		return new BitmapBuilder(dst, this._bearingX, this._bearingY);
	}

	/**
	 * Composite another bitmap using Porter-Duff "over" operation
	 */
	composite(
		other: BitmapBuilder | Bitmap,
		x: number = 0,
		y: number = 0,
	): BitmapBuilder {
		const src = other instanceof BitmapBuilder ? other._bitmap : other;
		const dst = copyBitmap(this._bitmap);
		compositeBitmaps(dst, src, x, y);
		return new BitmapBuilder(dst, this._bearingX, this._bearingY);
	}

	/**
	 * Additive blend: result = clamp(this + other, 0, 255)
	 */
	add(
		other: BitmapBuilder | Bitmap,
		x: number = 0,
		y: number = 0,
	): BitmapBuilder {
		const src = other instanceof BitmapBuilder ? other._bitmap : other;
		const dst = copyBitmap(this._bitmap);
		addBitmaps(dst, src, x, y);
		return new BitmapBuilder(dst, this._bearingX, this._bearingY);
	}

	/**
	 * Subtractive blend: result = clamp(this - other, 0, 255)
	 */
	subtract(
		other: BitmapBuilder | Bitmap,
		x: number = 0,
		y: number = 0,
	): BitmapBuilder {
		const src = other instanceof BitmapBuilder ? other._bitmap : other;
		const dst = copyBitmap(this._bitmap);
		subBitmaps(dst, src, x, y);
		return new BitmapBuilder(dst, this._bearingX, this._bearingY);
	}

	/**
	 * Multiplicative blend: result = (this * other) / 255
	 */
	multiply(
		other: BitmapBuilder | Bitmap,
		x: number = 0,
		y: number = 0,
	): BitmapBuilder {
		const src = other instanceof BitmapBuilder ? other._bitmap : other;
		const dst = copyBitmap(this._bitmap);
		mulBitmaps(dst, src, x, y);
		return new BitmapBuilder(dst, this._bearingX, this._bearingY);
	}

	/**
	 * Maximum blend: result = max(this, other)
	 */
	max(
		other: BitmapBuilder | Bitmap,
		x: number = 0,
		y: number = 0,
	): BitmapBuilder {
		const src = other instanceof BitmapBuilder ? other._bitmap : other;
		const dst = copyBitmap(this._bitmap);
		maxBitmaps(dst, src, x, y);
		return new BitmapBuilder(dst, this._bearingX, this._bearingY);
	}

	// === Conversion ===

	/**
	 * Convert to different pixel mode
	 */
	convert(targetMode: PixelMode): BitmapBuilder {
		const converted = convertBitmap(this._bitmap, targetMode);
		return new BitmapBuilder(converted, this._bearingX, this._bearingY);
	}

	// === Output ===

	/**
	 * Get RGBA pixel array (for canvas ImageData, WebGL textures)
	 */
	toRGBA(): Uint8Array {
		return bitmapToRGBA(this._bitmap);
	}

	/**
	 * Get grayscale array
	 */
	toGray(): Uint8Array {
		return bitmapToGray(this._bitmap);
	}

	/**
	 * Get raw bitmap (cloned)
	 */
	toBitmap(): Bitmap {
		return copyBitmap(this._bitmap);
	}

	/**
	 * Get bitmap with bearing info
	 */
	toRasterizedGlyph(): RasterizedGlyph {
		return {
			bitmap: copyBitmap(this._bitmap),
			bearingX: this._bearingX,
			bearingY: this._bearingY,
		};
	}

	/**
	 * Clone this builder
	 */
	clone(): BitmapBuilder {
		return new BitmapBuilder(
			copyBitmap(this._bitmap),
			this._bearingX,
			this._bearingY,
		);
	}

	// === Accessors ===

	/**
	 * Get bitmap width
	 */
	get width(): number {
		return this._bitmap.width;
	}

	/**
	 * Get bitmap height (rows)
	 */
	get height(): number {
		return this._bitmap.rows;
	}

	/**
	 * Get pixel mode
	 */
	get pixelMode(): PixelMode {
		return this._bitmap.pixelMode;
	}

	/**
	 * Get horizontal bearing
	 */
	get bearingX(): number {
		return this._bearingX;
	}

	/**
	 * Get vertical bearing
	 */
	get bearingY(): number {
		return this._bearingY;
	}
}
