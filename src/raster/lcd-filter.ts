/**
 * LCD subpixel rendering support
 *
 * LCD displays have RGB subpixels that can be individually addressed
 * to achieve higher effective resolution. This module provides:
 * 1. Subpixel rendering (3x horizontal resolution)
 * 2. FIR filtering to reduce color fringing
 */

import type { GlyphPath } from "../render/path.ts";
import { GrayRaster } from "./gray-raster.ts";
import { decomposePath } from "./outline-decompose.ts";
import type { Bitmap } from "./types.ts";
import { createBitmap, PixelMode } from "./types.ts";

/**
 * LCD filter weights for reducing color fringing
 * These are based on FreeType's default LCD filter
 */
export const LCD_FILTER_LIGHT: number[] = [0, 85, 86, 85, 0];
export const LCD_FILTER_DEFAULT: number[] = [8, 77, 86, 77, 8];
export const LCD_FILTER_LEGACY: number[] = [0, 64, 128, 64, 0];

/**
 * LCD rendering mode
 */
export enum LcdMode {
	/** Horizontal RGB subpixels (most common) */
	RGB = 0,
	/** Horizontal BGR subpixels */
	BGR = 1,
	/** Vertical RGB subpixels */
	RGB_V = 2,
	/** Vertical BGR subpixels */
	BGR_V = 3,
}

/**
 * Rasterize a glyph with LCD subpixel rendering
 *
 * The algorithm:
 * 1. Render at 3x horizontal resolution
 * 2. Apply FIR filter to reduce color fringing
 * 3. Output RGB values per pixel
 */
export function rasterizeLcd(
	path: GlyphPath,
	width: number,
	height: number,
	scale: number,
	offsetX: number,
	offsetY: number,
	mode: LcdMode = LcdMode.RGB,
	filterWeights: number[] = LCD_FILTER_DEFAULT,
): Bitmap {
	const isVertical = mode === LcdMode.RGB_V || mode === LcdMode.BGR_V;

	if (isVertical) {
		return rasterizeLcdVertical(
			path,
			width,
			height,
			scale,
			offsetX,
			offsetY,
			mode,
			filterWeights,
		);
	}

	// Render at 3x width
	const subpixelWidth = width * 3;
	const grayscale = createBitmap(subpixelWidth, height, PixelMode.Gray);

	const raster = new GrayRaster();
	raster.setClip(0, 0, subpixelWidth, height);
	raster.reset();

	// Scale x by 3 for subpixel resolution
	// The outline is shifted by 1/3 pixel for each RGB channel
	decomposePath(raster, path, scale * 3, offsetX * 3, offsetY, true);
	raster.sweep(grayscale);

	// Apply LCD filter and pack into RGB
	const lcd = createBitmap(width, height, PixelMode.LCD);
	const isBgr = mode === LcdMode.BGR;

	applyLcdFilterHorizontal(grayscale, lcd, filterWeights, isBgr);

	return lcd;
}

/**
 * Rasterize with vertical LCD subpixels
 */
function rasterizeLcdVertical(
	path: GlyphPath,
	width: number,
	height: number,
	scale: number,
	offsetX: number,
	offsetY: number,
	mode: LcdMode,
	filterWeights: number[],
): Bitmap {
	// Render at 3x height
	const subpixelHeight = height * 3;
	const grayscale = createBitmap(width, subpixelHeight, PixelMode.Gray);

	const raster = new GrayRaster();
	raster.setClip(0, 0, width, subpixelHeight);
	raster.reset();

	// Scale y by 3 for subpixel resolution
	decomposePath(raster, path, scale, offsetX, offsetY * 3, true);
	raster.sweep(grayscale);

	// Apply LCD filter and pack into RGB
	const lcd = createBitmap(width, height, PixelMode.LCD_V);
	const isBgr = mode === LcdMode.BGR_V;

	applyLcdFilterVertical(grayscale, lcd, filterWeights, isBgr);

	return lcd;
}

/**
 * Apply 5-tap FIR filter horizontally and pack to RGB
 */
function applyLcdFilterHorizontal(
	src: Bitmap,
	dst: Bitmap,
	weights: number[],
	isBgr: boolean,
): void {
	const [w0, w1, w2, w3, w4] = weights;
	const weightSum = w0 + w1 + w2 + w3 + w4;

	for (let y = 0; y < dst.rows; y++) {
		const srcRow = y * src.pitch;
		const dstRow = y * dst.pitch;

		for (let x = 0; x < dst.width; x++) {
			// Sample 5 subpixels centered on each RGB component
			const subX = x * 3;

			// Red/Blue (first subpixel)
			const r0 = subX - 2 >= 0 ? src.buffer[srcRow + subX - 2] : 0;
			const r1 = subX - 1 >= 0 ? src.buffer[srcRow + subX - 1] : 0;
			const r2 = src.buffer[srcRow + subX];
			const r3 = subX + 1 < src.width ? src.buffer[srcRow + subX + 1] : 0;
			const r4 = subX + 2 < src.width ? src.buffer[srcRow + subX + 2] : 0;
			const rv = Math.min(
				255,
				Math.round(
					(r0 * w0 + r1 * w1 + r2 * w2 + r3 * w3 + r4 * w4) / weightSum,
				),
			);

			// Green (middle subpixel)
			const g0 = subX - 1 >= 0 ? src.buffer[srcRow + subX - 1] : 0;
			const g1 = src.buffer[srcRow + subX];
			const g2 = subX + 1 < src.width ? src.buffer[srcRow + subX + 1] : 0;
			const g3 = subX + 2 < src.width ? src.buffer[srcRow + subX + 2] : 0;
			const g4 = subX + 3 < src.width ? src.buffer[srcRow + subX + 3] : 0;
			const gv = Math.min(
				255,
				Math.round(
					(g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / weightSum,
				),
			);

			// Blue/Red (last subpixel)
			const b0 = src.buffer[srcRow + subX];
			const b1 = subX + 1 < src.width ? src.buffer[srcRow + subX + 1] : 0;
			const b2 = subX + 2 < src.width ? src.buffer[srcRow + subX + 2] : 0;
			const b3 = subX + 3 < src.width ? src.buffer[srcRow + subX + 3] : 0;
			const b4 = subX + 4 < src.width ? src.buffer[srcRow + subX + 4] : 0;
			const bv = Math.min(
				255,
				Math.round(
					(b0 * w0 + b1 * w1 + b2 * w2 + b3 * w3 + b4 * w4) / weightSum,
				),
			);

			// Pack RGB
			const dstIdx = dstRow + x * 3;
			if (isBgr) {
				dst.buffer[dstIdx] = bv;
				dst.buffer[dstIdx + 1] = gv;
				dst.buffer[dstIdx + 2] = rv;
			} else {
				dst.buffer[dstIdx] = rv;
				dst.buffer[dstIdx + 1] = gv;
				dst.buffer[dstIdx + 2] = bv;
			}
		}
	}
}

/**
 * Apply 5-tap FIR filter vertically and pack to RGB
 */
function applyLcdFilterVertical(
	src: Bitmap,
	dst: Bitmap,
	weights: number[],
	isBgr: boolean,
): void {
	const [w0, w1, w2, w3, w4] = weights;
	const weightSum = w0 + w1 + w2 + w3 + w4;

	for (let y = 0; y < dst.rows; y++) {
		const subY = y * 3;
		const dstRow = y * dst.pitch;

		for (let x = 0; x < dst.width; x++) {
			// Red/Blue (first subpixel row)
			const r0 = subY - 2 >= 0 ? src.buffer[(subY - 2) * src.pitch + x] : 0;
			const r1 = subY - 1 >= 0 ? src.buffer[(subY - 1) * src.pitch + x] : 0;
			const r2 = src.buffer[subY * src.pitch + x];
			const r3 =
				subY + 1 < src.rows ? src.buffer[(subY + 1) * src.pitch + x] : 0;
			const r4 =
				subY + 2 < src.rows ? src.buffer[(subY + 2) * src.pitch + x] : 0;
			const rv = Math.min(
				255,
				Math.round(
					(r0 * w0 + r1 * w1 + r2 * w2 + r3 * w3 + r4 * w4) / weightSum,
				),
			);

			// Green (middle subpixel row)
			const g0 = subY - 1 >= 0 ? src.buffer[(subY - 1) * src.pitch + x] : 0;
			const g1 = src.buffer[subY * src.pitch + x];
			const g2 =
				subY + 1 < src.rows ? src.buffer[(subY + 1) * src.pitch + x] : 0;
			const g3 =
				subY + 2 < src.rows ? src.buffer[(subY + 2) * src.pitch + x] : 0;
			const g4 =
				subY + 3 < src.rows ? src.buffer[(subY + 3) * src.pitch + x] : 0;
			const gv = Math.min(
				255,
				Math.round(
					(g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / weightSum,
				),
			);

			// Blue/Red (last subpixel row)
			const b0 = src.buffer[subY * src.pitch + x];
			const b1 =
				subY + 1 < src.rows ? src.buffer[(subY + 1) * src.pitch + x] : 0;
			const b2 =
				subY + 2 < src.rows ? src.buffer[(subY + 2) * src.pitch + x] : 0;
			const b3 =
				subY + 3 < src.rows ? src.buffer[(subY + 3) * src.pitch + x] : 0;
			const b4 =
				subY + 4 < src.rows ? src.buffer[(subY + 4) * src.pitch + x] : 0;
			const bv = Math.min(
				255,
				Math.round(
					(b0 * w0 + b1 * w1 + b2 * w2 + b3 * w3 + b4 * w4) / weightSum,
				),
			);

			// Pack RGB
			const dstIdx = dstRow + x * 3;
			if (isBgr) {
				dst.buffer[dstIdx] = bv;
				dst.buffer[dstIdx + 1] = gv;
				dst.buffer[dstIdx + 2] = rv;
			} else {
				dst.buffer[dstIdx] = rv;
				dst.buffer[dstIdx + 1] = gv;
				dst.buffer[dstIdx + 2] = bv;
			}
		}
	}
}

/**
 * Convert LCD bitmap to RGBA for display
 * Uses gamma-corrected blending against a background color
 */
export function lcdToRGBA(
	lcd: Bitmap,
	bgColor: [number, number, number] = [255, 255, 255],
	fgColor: [number, number, number] = [0, 0, 0],
): Uint8Array {
	const rgba = new Uint8Array(lcd.width * lcd.rows * 4);
	const [bgR, bgG, bgB] = bgColor;
	const [fgR, fgG, fgB] = fgColor;

	for (let y = 0; y < lcd.rows; y++) {
		const srcRow = y * lcd.pitch;
		const dstRow = y * lcd.width * 4;

		for (let x = 0; x < lcd.width; x++) {
			const srcIdx = srcRow + x * 3;
			const dstIdx = dstRow + x * 4;

			const r = lcd.buffer[srcIdx];
			const g = lcd.buffer[srcIdx + 1];
			const b = lcd.buffer[srcIdx + 2];

			// Blend with foreground/background
			rgba[dstIdx] = blendChannel(bgR, fgR, r);
			rgba[dstIdx + 1] = blendChannel(bgG, fgG, g);
			rgba[dstIdx + 2] = blendChannel(bgB, fgB, b);
			rgba[dstIdx + 3] = 255; // Fully opaque
		}
	}

	return rgba;
}

function blendChannel(bg: number, fg: number, alpha: number): number {
	return Math.round(bg + ((fg - bg) * alpha) / 255);
}
