/**
 * Bitmap manipulation utilities
 */

import { type Bitmap, createBitmap, PixelMode } from "./types.ts";
import type { Matrix2D, Matrix3x3 } from "../render/outline-transform.ts";

export interface BitmapTransformOptions {
	/** Glyph bearing X (left edge from origin) */
	bearingX?: number;
	/** Glyph bearing Y (top edge from origin) */
	bearingY?: number;
	/** Optional translation in 26.6 units (applied after matrix) */
	offsetX26?: number;
	/** Optional translation in 26.6 units (applied after matrix) */
	offsetY26?: number;
}

export interface RasterMetrics {
	width: number;
	height: number;
	bearingX: number;
	bearingY: number;
	ascent: number;
	descent: number;
}

export interface RasterEffectOptions {
	blur?: number;
	be?: number;
	border?: number;
	shadowX?: number;
	shadowY?: number;
}

/**
 * Embolden a bitmap by dilating pixel values
 * Makes text bolder by spreading coverage in x and y directions
 * @param bitmap Source bitmap to embolden
 * @param xStrength Horizontal dilation strength in pixels
 * @param yStrength Vertical dilation strength in pixels
 * @returns New bitmap with emboldened content
 */
export function emboldenBitmap(
	bitmap: Bitmap,
	xStrength: number,
	yStrength: number,
): Bitmap {
	if (xStrength === 0 && yStrength === 0) {
		return copyBitmap(bitmap);
	}

	const result = createBitmap(bitmap.width, bitmap.rows, bitmap.pixelMode);

	if (bitmap.pixelMode === PixelMode.Gray) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				let maxVal = 0;

				for (
					let dy = -Math.floor(yStrength);
					dy <= Math.ceil(yStrength);
					dy++
				) {
					for (
						let dx = -Math.floor(xStrength);
						dx <= Math.ceil(xStrength);
						dx++
					) {
						const sx = x + dx;
						const sy = y + dy;

						if (sx >= 0 && sx < bitmap.width && sy >= 0 && sy < bitmap.rows) {
							const val = bitmap.buffer[sy * bitmap.pitch + sx] ?? 0;
							maxVal = Math.max(maxVal, val);
						}
					}
				}

				result.buffer[y * result.pitch + x] = maxVal;
			}
		}
	} else if (bitmap.pixelMode === PixelMode.Mono) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				let hasSet = false;

				for (
					let dy = -Math.floor(yStrength);
					dy <= Math.ceil(yStrength);
					dy++
				) {
					for (
						let dx = -Math.floor(xStrength);
						dx <= Math.ceil(xStrength);
						dx++
					) {
						const sx = x + dx;
						const sy = y + dy;

						if (sx >= 0 && sx < bitmap.width && sy >= 0 && sy < bitmap.rows) {
							const byteIdx = sy * bitmap.pitch + (sx >> 3);
							const bitIdx = 7 - (sx & 7);
							const bit = ((bitmap.buffer[byteIdx] ?? 0) >> bitIdx) & 1;
							if (bit) {
								hasSet = true;
								break;
							}
						}
					}
					if (hasSet) break;
				}

				if (hasSet) {
					const dstByteIdx = y * result.pitch + (x >> 3);
					const dstBitIdx = 7 - (x & 7);
					result.buffer[dstByteIdx] |= 1 << dstBitIdx;
				}
			}
		}
	} else if (
		bitmap.pixelMode === PixelMode.LCD ||
		bitmap.pixelMode === PixelMode.LCD_V
	) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				let maxR = 0,
					maxG = 0,
					maxB = 0;

				for (
					let dy = -Math.floor(yStrength);
					dy <= Math.ceil(yStrength);
					dy++
				) {
					for (
						let dx = -Math.floor(xStrength);
						dx <= Math.ceil(xStrength);
						dx++
					) {
						const sx = x + dx;
						const sy = y + dy;

						if (sx >= 0 && sx < bitmap.width && sy >= 0 && sy < bitmap.rows) {
							const idx = sy * bitmap.pitch + sx * 3;
							maxR = Math.max(maxR, bitmap.buffer[idx] ?? 0);
							maxG = Math.max(maxG, bitmap.buffer[idx + 1] ?? 0);
							maxB = Math.max(maxB, bitmap.buffer[idx + 2] ?? 0);
						}
					}
				}

				const dstIdx = y * result.pitch + x * 3;
				result.buffer[dstIdx] = maxR;
				result.buffer[dstIdx + 1] = maxG;
				result.buffer[dstIdx + 2] = maxB;
			}
		}
	}

	return result;
}

/**
 * Convert bitmap between pixel modes
 * @param bitmap Source bitmap to convert
 * @param targetMode Target pixel format
 * @returns New bitmap in the target format
 */
export function convertBitmap(bitmap: Bitmap, targetMode: PixelMode): Bitmap {
	if (bitmap.pixelMode === targetMode) {
		return bitmap;
	}

	const result = createBitmap(bitmap.width, bitmap.rows, targetMode);

	if (bitmap.pixelMode === PixelMode.Gray && targetMode === PixelMode.Mono) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				const gray = bitmap.buffer[y * bitmap.pitch + x] ?? 0;
				if (gray >= 128) {
					const byteIdx = y * result.pitch + (x >> 3);
					const bitIdx = 7 - (x & 7);
					result.buffer[byteIdx] |= 1 << bitIdx;
				}
			}
		}
	} else if (
		bitmap.pixelMode === PixelMode.Mono &&
		targetMode === PixelMode.Gray
	) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				const byteIdx = y * bitmap.pitch + (x >> 3);
				const bitIdx = 7 - (x & 7);
				const bit = ((bitmap.buffer[byteIdx] ?? 0) >> bitIdx) & 1;
				result.buffer[y * result.pitch + x] = bit ? 255 : 0;
			}
		}
	} else if (
		bitmap.pixelMode === PixelMode.Gray &&
		targetMode === PixelMode.LCD
	) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				const gray = bitmap.buffer[y * bitmap.pitch + x] ?? 0;
				const dstIdx = y * result.pitch + x * 3;
				result.buffer[dstIdx] = gray;
				result.buffer[dstIdx + 1] = gray;
				result.buffer[dstIdx + 2] = gray;
			}
		}
	} else if (
		bitmap.pixelMode === PixelMode.Mono &&
		targetMode === PixelMode.LCD
	) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				const byteIdx = y * bitmap.pitch + (x >> 3);
				const bitIdx = 7 - (x & 7);
				const bit = ((bitmap.buffer[byteIdx] ?? 0) >> bitIdx) & 1;
				const val = bit ? 255 : 0;
				const dstIdx = y * result.pitch + x * 3;
				result.buffer[dstIdx] = val;
				result.buffer[dstIdx + 1] = val;
				result.buffer[dstIdx + 2] = val;
			}
		}
	} else if (
		bitmap.pixelMode === PixelMode.Gray &&
		targetMode === PixelMode.LCD_V
	) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				const gray = bitmap.buffer[y * bitmap.pitch + x] ?? 0;
				const dstIdx = y * result.pitch + x * 3;
				result.buffer[dstIdx] = gray;
				result.buffer[dstIdx + 1] = gray;
				result.buffer[dstIdx + 2] = gray;
			}
		}
	} else if (
		bitmap.pixelMode === PixelMode.LCD &&
		targetMode === PixelMode.Gray
	) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				const srcIdx = y * bitmap.pitch + x * 3;
				const r = bitmap.buffer[srcIdx] ?? 0;
				const g = bitmap.buffer[srcIdx + 1] ?? 0;
				const b = bitmap.buffer[srcIdx + 2] ?? 0;
				result.buffer[y * result.pitch + x] = Math.floor((r + g + b) / 3);
			}
		}
	}

	return result;
}

/**
 * Alpha blend src bitmap onto dst bitmap at position (x, y)
 * @param dst Destination bitmap to blend onto (modified in place)
 * @param src Source bitmap to blend
 * @param x X position in destination
 * @param y Y position in destination
 * @param opacity Blend opacity from 0 to 1
 */
export function blendBitmap(
	dst: Bitmap,
	src: Bitmap,
	x: number,
	y: number,
	opacity: number,
): void {
	if (dst.pixelMode !== PixelMode.Gray || src.pixelMode !== PixelMode.Gray) {
		return;
	}

	opacity = Math.max(0, Math.min(1, opacity));

	const startX = Math.max(0, -x);
	const startY = Math.max(0, -y);
	const endX = Math.min(src.width, dst.width - x);
	const endY = Math.min(src.rows, dst.rows - y);

	for (let sy = startY; sy < endY; sy++) {
		for (let sx = startX; sx < endX; sx++) {
			const dx = x + sx;
			const dy = y + sy;

			if (dx >= 0 && dx < dst.width && dy >= 0 && dy < dst.rows) {
				const srcVal = src.buffer[sy * src.pitch + sx] ?? 0;
				const dstVal = dst.buffer[dy * dst.pitch + dx] ?? 0;

				const blended = dstVal + srcVal * opacity;
				dst.buffer[dy * dst.pitch + dx] = Math.min(255, Math.floor(blended));
			}
		}
	}
}

/**
 * Create a deep copy of a bitmap
 * @param bitmap Bitmap to copy
 * @returns New bitmap with copied data
 */
export function copyBitmap(bitmap: Bitmap): Bitmap {
	return {
		buffer: new Uint8Array(bitmap.buffer),
		width: bitmap.width,
		rows: bitmap.rows,
		pitch: bitmap.pitch,
		pixelMode: bitmap.pixelMode,
		numGrays: bitmap.numGrays,
	};
}

/**
 * Resize bitmap using nearest-neighbor interpolation
 * @param bitmap Source bitmap to resize
 * @param newWidth Target width in pixels
 * @param newHeight Target height in pixels
 * @returns New bitmap resized to target dimensions
 */
export function resizeBitmap(
	bitmap: Bitmap,
	newWidth: number,
	newHeight: number,
): Bitmap {
	const result = createBitmap(newWidth, newHeight, bitmap.pixelMode);

	const xRatio = bitmap.width / newWidth;
	const yRatio = bitmap.rows / newHeight;

	if (bitmap.pixelMode === PixelMode.Gray) {
		for (let y = 0; y < newHeight; y++) {
			for (let x = 0; x < newWidth; x++) {
				const sx = Math.floor(x * xRatio);
				const sy = Math.floor(y * yRatio);
				result.buffer[y * result.pitch + x] =
					bitmap.buffer[sy * bitmap.pitch + sx] ?? 0;
			}
		}
	} else if (bitmap.pixelMode === PixelMode.Mono) {
		for (let y = 0; y < newHeight; y++) {
			for (let x = 0; x < newWidth; x++) {
				const sx = Math.floor(x * xRatio);
				const sy = Math.floor(y * yRatio);

				const srcByteIdx = sy * bitmap.pitch + (sx >> 3);
				const srcBitIdx = 7 - (sx & 7);
				const bit = ((bitmap.buffer[srcByteIdx] ?? 0) >> srcBitIdx) & 1;

				if (bit) {
					const dstByteIdx = y * result.pitch + (x >> 3);
					const dstBitIdx = 7 - (x & 7);
					result.buffer[dstByteIdx] |= 1 << dstBitIdx;
				}
			}
		}
	} else if (
		bitmap.pixelMode === PixelMode.LCD ||
		bitmap.pixelMode === PixelMode.LCD_V
	) {
		for (let y = 0; y < newHeight; y++) {
			for (let x = 0; x < newWidth; x++) {
				const sx = Math.floor(x * xRatio);
				const sy = Math.floor(y * yRatio);

				const srcIdx = sy * bitmap.pitch + sx * 3;
				const dstIdx = y * result.pitch + x * 3;

				result.buffer[dstIdx] = bitmap.buffer[srcIdx] ?? 0;
				result.buffer[dstIdx + 1] = bitmap.buffer[srcIdx + 1] ?? 0;
				result.buffer[dstIdx + 2] = bitmap.buffer[srcIdx + 2] ?? 0;
			}
		}
	}

	return result;
}

/**
 * Resize bitmap using bilinear interpolation
 * Produces smoother results than nearest-neighbor, ideal for downsampling
 * @param bitmap Source bitmap to resize
 * @param newWidth Target width in pixels
 * @param newHeight Target height in pixels
 * @returns New bitmap resized with smooth interpolation
 */
export function resizeBitmapBilinear(
	bitmap: Bitmap,
	newWidth: number,
	newHeight: number,
): Bitmap {
	const result = createBitmap(newWidth, newHeight, bitmap.pixelMode);

	const xRatio = (bitmap.width - 1) / Math.max(1, newWidth - 1);
	const yRatio = (bitmap.rows - 1) / Math.max(1, newHeight - 1);

	if (bitmap.pixelMode === PixelMode.Gray) {
		for (let y = 0; y < newHeight; y++) {
			const srcY = y * yRatio;
			const y0 = Math.floor(srcY);
			const y1 = Math.min(y0 + 1, bitmap.rows - 1);
			const yFrac = srcY - y0;

			for (let x = 0; x < newWidth; x++) {
				const srcX = x * xRatio;
				const x0 = Math.floor(srcX);
				const x1 = Math.min(x0 + 1, bitmap.width - 1);
				const xFrac = srcX - x0;

				const p00 = bitmap.buffer[y0 * bitmap.pitch + x0] ?? 0;
				const p10 = bitmap.buffer[y0 * bitmap.pitch + x1] ?? 0;
				const p01 = bitmap.buffer[y1 * bitmap.pitch + x0] ?? 0;
				const p11 = bitmap.buffer[y1 * bitmap.pitch + x1] ?? 0;

				const top = p00 + (p10 - p00) * xFrac;
				const bottom = p01 + (p11 - p01) * xFrac;
				const value = top + (bottom - top) * yFrac;

				result.buffer[y * result.pitch + x] = Math.round(value);
			}
		}
	} else if (bitmap.pixelMode === PixelMode.Mono) {
		// For mono, fall back to nearest-neighbor (bilinear doesn't make sense for 1-bit)
		return resizeBitmap(bitmap, newWidth, newHeight);
	} else if (
		bitmap.pixelMode === PixelMode.LCD ||
		bitmap.pixelMode === PixelMode.LCD_V
	) {
		for (let y = 0; y < newHeight; y++) {
			const srcY = y * yRatio;
			const y0 = Math.floor(srcY);
			const y1 = Math.min(y0 + 1, bitmap.rows - 1);
			const yFrac = srcY - y0;

			for (let x = 0; x < newWidth; x++) {
				const srcX = x * xRatio;
				const x0 = Math.floor(srcX);
				const x1 = Math.min(x0 + 1, bitmap.width - 1);
				const xFrac = srcX - x0;

				const idx00 = y0 * bitmap.pitch + x0 * 3;
				const idx10 = y0 * bitmap.pitch + x1 * 3;
				const idx01 = y1 * bitmap.pitch + x0 * 3;
				const idx11 = y1 * bitmap.pitch + x1 * 3;

				for (let c = 0; c < 3; c++) {
					const p00 = bitmap.buffer[idx00 + c] ?? 0;
					const p10 = bitmap.buffer[idx10 + c] ?? 0;
					const p01 = bitmap.buffer[idx01 + c] ?? 0;
					const p11 = bitmap.buffer[idx11 + c] ?? 0;

					const top = p00 + (p10 - p00) * xFrac;
					const bottom = p01 + (p11 - p01) * xFrac;
					const value = top + (bottom - top) * yFrac;

					result.buffer[y * result.pitch + x * 3 + c] = Math.round(value);
				}
			}
		}
	}

	return result;
}

/**
 * Add two bitmaps together (additive blend)
 * Result: dst = clamp(dst + src, 0, 255)
 * Used for combining glyph with shadow/glow
 * @param dst Destination bitmap (modified in place)
 * @param src Source bitmap to add
 * @param srcX X offset of source in destination (default: 0)
 * @param srcY Y offset of source in destination (default: 0)
 */
export function addBitmaps(
	dst: Bitmap,
	src: Bitmap,
	srcX: number = 0,
	srcY: number = 0,
): void {
	if (dst.pixelMode !== PixelMode.Gray || src.pixelMode !== PixelMode.Gray) {
		return;
	}

	const startX = Math.max(0, -srcX);
	const startY = Math.max(0, -srcY);
	const endX = Math.min(src.width, dst.width - srcX);
	const endY = Math.min(src.rows, dst.rows - srcY);

	for (let sy = startY; sy < endY; sy++) {
		const dy = srcY + sy;
		if (dy < 0 || dy >= dst.rows) continue;

		for (let sx = startX; sx < endX; sx++) {
			const dx = srcX + sx;
			if (dx < 0 || dx >= dst.width) continue;

			const srcVal = src.buffer[sy * src.pitch + sx] ?? 0;
			const dstVal = dst.buffer[dy * dst.pitch + dx] ?? 0;
			dst.buffer[dy * dst.pitch + dx] = Math.min(255, srcVal + dstVal);
		}
	}
}

/**
 * Multiply two bitmaps (multiplicative blend)
 * Result: dst = (dst * src) / 255
 * Used for masking operations
 * @param dst Destination bitmap (modified in place)
 * @param src Source bitmap to multiply
 * @param srcX X offset of source in destination (default: 0)
 * @param srcY Y offset of source in destination (default: 0)
 */
export function mulBitmaps(
	dst: Bitmap,
	src: Bitmap,
	srcX: number = 0,
	srcY: number = 0,
): void {
	if (dst.pixelMode !== PixelMode.Gray || src.pixelMode !== PixelMode.Gray) {
		return;
	}

	const startX = Math.max(0, -srcX);
	const startY = Math.max(0, -srcY);
	const endX = Math.min(src.width, dst.width - srcX);
	const endY = Math.min(src.rows, dst.rows - srcY);

	for (let sy = startY; sy < endY; sy++) {
		const dy = srcY + sy;
		if (dy < 0 || dy >= dst.rows) continue;

		for (let sx = startX; sx < endX; sx++) {
			const dx = srcX + sx;
			if (dx < 0 || dx >= dst.width) continue;

			const srcVal = src.buffer[sy * src.pitch + sx] ?? 0;
			const dstVal = dst.buffer[dy * dst.pitch + dx] ?? 0;
			// Use integer math for speed: (a * b + 127) / 255 ≈ (a * b) >> 8
			dst.buffer[dy * dst.pitch + dx] = Math.floor(
				(srcVal * dstVal + 127) / 255,
			);
		}
	}
}

/**
 * Subtract src from dst (subtractive blend)
 * Result: dst = clamp(dst - src, 0, 255)
 * Used for outline effects
 * @param dst Destination bitmap (modified in place)
 * @param src Source bitmap to subtract
 * @param srcX X offset of source in destination (default: 0)
 * @param srcY Y offset of source in destination (default: 0)
 */
export function subBitmaps(
	dst: Bitmap,
	src: Bitmap,
	srcX: number = 0,
	srcY: number = 0,
): void {
	if (dst.pixelMode !== PixelMode.Gray || src.pixelMode !== PixelMode.Gray) {
		return;
	}

	const startX = Math.max(0, -srcX);
	const startY = Math.max(0, -srcY);
	const endX = Math.min(src.width, dst.width - srcX);
	const endY = Math.min(src.rows, dst.rows - srcY);

	for (let sy = startY; sy < endY; sy++) {
		const dy = srcY + sy;
		if (dy < 0 || dy >= dst.rows) continue;

		for (let sx = startX; sx < endX; sx++) {
			const dx = srcX + sx;
			if (dx < 0 || dx >= dst.width) continue;

			const srcVal = src.buffer[sy * src.pitch + sx] ?? 0;
			const dstVal = dst.buffer[dy * dst.pitch + dx] ?? 0;
			dst.buffer[dy * dst.pitch + dx] = Math.max(0, dstVal - srcVal);
		}
	}
}

/**
 * Alpha composite src over dst using src as alpha
 * Result: dst = src + dst * (1 - src/255)
 * Standard Porter-Duff "over" operation
 * @param dst Destination bitmap (modified in place)
 * @param src Source bitmap to composite
 * @param srcX X offset of source in destination (default: 0)
 * @param srcY Y offset of source in destination (default: 0)
 */
export function compositeBitmaps(
	dst: Bitmap,
	src: Bitmap,
	srcX: number = 0,
	srcY: number = 0,
): void {
	if (dst.pixelMode !== PixelMode.Gray || src.pixelMode !== PixelMode.Gray) {
		return;
	}

	const startX = Math.max(0, -srcX);
	const startY = Math.max(0, -srcY);
	const endX = Math.min(src.width, dst.width - srcX);
	const endY = Math.min(src.rows, dst.rows - srcY);

	for (let sy = startY; sy < endY; sy++) {
		const dy = srcY + sy;
		if (dy < 0 || dy >= dst.rows) continue;

		for (let sx = startX; sx < endX; sx++) {
			const dx = srcX + sx;
			if (dx < 0 || dx >= dst.width) continue;

			const srcVal = src.buffer[sy * src.pitch + sx] ?? 0;
			const dstVal = dst.buffer[dy * dst.pitch + dx] ?? 0;
			// src + dst * (255 - src) / 255
			const result = srcVal + Math.floor((dstVal * (255 - srcVal) + 127) / 255);
			dst.buffer[dy * dst.pitch + dx] = Math.min(255, result);
		}
	}
}

/**
 * Shift bitmap position by integer offset
 * Creates a new bitmap with the content shifted
 * @param bitmap Source bitmap to shift
 * @param shiftX Horizontal shift in pixels
 * @param shiftY Vertical shift in pixels
 * @returns New bitmap with shifted content
 */
export function shiftBitmap(
	bitmap: Bitmap,
	shiftX: number,
	shiftY: number,
): Bitmap {
	const result = createBitmap(bitmap.width, bitmap.rows, bitmap.pixelMode);

	if (bitmap.pixelMode === PixelMode.Gray) {
		for (let y = 0; y < bitmap.rows; y++) {
			const sy = y - shiftY;
			if (sy < 0 || sy >= bitmap.rows) continue;

			for (let x = 0; x < bitmap.width; x++) {
				const sx = x - shiftX;
				if (sx < 0 || sx >= bitmap.width) continue;

				result.buffer[y * result.pitch + x] =
					bitmap.buffer[sy * bitmap.pitch + sx] ?? 0;
			}
		}
	} else if (bitmap.pixelMode === PixelMode.Mono) {
		for (let y = 0; y < bitmap.rows; y++) {
			const sy = y - shiftY;
			if (sy < 0 || sy >= bitmap.rows) continue;

			for (let x = 0; x < bitmap.width; x++) {
				const sx = x - shiftX;
				if (sx < 0 || sx >= bitmap.width) continue;

				const srcByteIdx = sy * bitmap.pitch + (sx >> 3);
				const srcBitIdx = 7 - (sx & 7);
				const bit = ((bitmap.buffer[srcByteIdx] ?? 0) >> srcBitIdx) & 1;

				if (bit) {
					const dstByteIdx = y * result.pitch + (x >> 3);
					const dstBitIdx = 7 - (x & 7);
					result.buffer[dstByteIdx] |= 1 << dstBitIdx;
				}
			}
		}
	} else if (
		bitmap.pixelMode === PixelMode.LCD ||
		bitmap.pixelMode === PixelMode.LCD_V
	) {
		for (let y = 0; y < bitmap.rows; y++) {
			const sy = y - shiftY;
			if (sy < 0 || sy >= bitmap.rows) continue;

			for (let x = 0; x < bitmap.width; x++) {
				const sx = x - shiftX;
				if (sx < 0 || sx >= bitmap.width) continue;

				const srcIdx = sy * bitmap.pitch + sx * 3;
				const dstIdx = y * result.pitch + x * 3;

				result.buffer[dstIdx] = bitmap.buffer[srcIdx] ?? 0;
				result.buffer[dstIdx + 1] = bitmap.buffer[srcIdx + 1] ?? 0;
				result.buffer[dstIdx + 2] = bitmap.buffer[srcIdx + 2] ?? 0;
			}
		}
	}

	return result;
}

/**
 * Fix outline bitmap by removing glyph interior
 * Used when you want only the border, not the filled shape
 * Result: outline = outline - glyph (where glyph coverage > threshold)
 * @param outlineBitmap Outline bitmap to fix (modified in place)
 * @param glyphBitmap Glyph bitmap containing filled shape
 * @param glyphX X position of glyph in outline (default: 0)
 * @param glyphY Y position of glyph in outline (default: 0)
 * @param threshold Coverage threshold for removal (default: 128)
 */
export function fixOutline(
	outlineBitmap: Bitmap,
	glyphBitmap: Bitmap,
	glyphX: number = 0,
	glyphY: number = 0,
	threshold: number = 128,
): void {
	if (
		outlineBitmap.pixelMode !== PixelMode.Gray ||
		glyphBitmap.pixelMode !== PixelMode.Gray
	) {
		return;
	}

	const startX = Math.max(0, -glyphX);
	const startY = Math.max(0, -glyphY);
	const endX = Math.min(glyphBitmap.width, outlineBitmap.width - glyphX);
	const endY = Math.min(glyphBitmap.rows, outlineBitmap.rows - glyphY);

	for (let gy = startY; gy < endY; gy++) {
		const oy = glyphY + gy;
		if (oy < 0 || oy >= outlineBitmap.rows) continue;

		for (let gx = startX; gx < endX; gx++) {
			const ox = glyphX + gx;
			if (ox < 0 || ox >= outlineBitmap.width) continue;

			const glyphVal = glyphBitmap.buffer[gy * glyphBitmap.pitch + gx] ?? 0;
			if (glyphVal >= threshold) {
				// Zero out outline where glyph is solid
				outlineBitmap.buffer[oy * outlineBitmap.pitch + ox] = 0;
			}
		}
	}
}

/**
 * Maximum blend: take the maximum of two bitmaps
 * Result: dst = max(dst, src)
 * Used for combining multiple layers
 * @param dst Destination bitmap (modified in place)
 * @param src Source bitmap to compare
 * @param srcX X offset of source in destination (default: 0)
 * @param srcY Y offset of source in destination (default: 0)
 */
export function maxBitmaps(
	dst: Bitmap,
	src: Bitmap,
	srcX: number = 0,
	srcY: number = 0,
): void {
	if (dst.pixelMode !== PixelMode.Gray || src.pixelMode !== PixelMode.Gray) {
		return;
	}

	const startX = Math.max(0, -srcX);
	const startY = Math.max(0, -srcY);
	const endX = Math.min(src.width, dst.width - srcX);
	const endY = Math.min(src.rows, dst.rows - srcY);

	for (let sy = startY; sy < endY; sy++) {
		const dy = srcY + sy;
		if (dy < 0 || dy >= dst.rows) continue;

		for (let sx = startX; sx < endX; sx++) {
			const dx = srcX + sx;
			if (dx < 0 || dx >= dst.width) continue;

			const srcVal = src.buffer[sy * src.pitch + sx] ?? 0;
			const dstVal = dst.buffer[dy * dst.pitch + dx] ?? 0;
			dst.buffer[dy * dst.pitch + dx] = Math.max(srcVal, dstVal);
		}
	}
}

/**
 * Create a padded copy of a bitmap with extra space around edges
 * Useful before blur operations to prevent edge artifacts
 * @param bitmap Source bitmap to pad
 * @param padLeft Left padding in pixels
 * @param padTop Top padding in pixels
 * @param padRight Right padding in pixels
 * @param padBottom Bottom padding in pixels
 * @returns New bitmap with padding added
 */
export function padBitmap(
	bitmap: Bitmap,
	padLeft: number,
	padTop: number,
	padRight: number,
	padBottom: number,
): Bitmap {
	const newWidth = bitmap.width + padLeft + padRight;
	const newHeight = bitmap.rows + padTop + padBottom;
	const result = createBitmap(newWidth, newHeight, bitmap.pixelMode);

	if (bitmap.pixelMode === PixelMode.Gray) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				result.buffer[(y + padTop) * result.pitch + (x + padLeft)] =
					bitmap.buffer[y * bitmap.pitch + x] ?? 0;
			}
		}
	} else if (
		bitmap.pixelMode === PixelMode.LCD ||
		bitmap.pixelMode === PixelMode.LCD_V
	) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				const srcIdx = y * bitmap.pitch + x * 3;
				const dstIdx = (y + padTop) * result.pitch + (x + padLeft) * 3;
				result.buffer[dstIdx] = bitmap.buffer[srcIdx] ?? 0;
				result.buffer[dstIdx + 1] = bitmap.buffer[srcIdx + 1] ?? 0;
				result.buffer[dstIdx + 2] = bitmap.buffer[srcIdx + 2] ?? 0;
			}
		}
	}

	return result;
}

/**
 * Create an expanded bitmap that can contain both dst and src
 * Returns the expanded bitmap and the offsets for both original bitmaps
 * @param dst Destination bitmap
 * @param src Source bitmap to fit
 * @param srcX X position of source relative to destination
 * @param srcY Y position of source relative to destination
 * @returns Expanded bitmap and offset positions for both original bitmaps
 */
export function expandToFit(
	dst: Bitmap,
	src: Bitmap,
	srcX: number,
	srcY: number,
): {
	expanded: Bitmap;
	dstOffsetX: number;
	dstOffsetY: number;
	srcOffsetX: number;
	srcOffsetY: number;
} {
	// Calculate bounds
	const dstLeft = 0;
	const dstTop = 0;
	const dstRight = dst.width;
	const dstBottom = dst.rows;

	const srcLeft = srcX;
	const srcTop = srcY;
	const srcRight = srcX + src.width;
	const srcBottom = srcY + src.rows;

	const left = Math.min(dstLeft, srcLeft);
	const top = Math.min(dstTop, srcTop);
	const right = Math.max(dstRight, srcRight);
	const bottom = Math.max(dstBottom, srcBottom);

	const newWidth = right - left;
	const newHeight = bottom - top;

	const expanded = createBitmap(newWidth, newHeight, dst.pixelMode);

	const dstOffsetX = dstLeft - left;
	const dstOffsetY = dstTop - top;
	const srcOffsetX = srcLeft - left;
	const srcOffsetY = srcTop - top;

	// Copy dst to expanded
	if (dst.pixelMode === PixelMode.Gray) {
		for (let y = 0; y < dst.rows; y++) {
			for (let x = 0; x < dst.width; x++) {
				expanded.buffer[(y + dstOffsetY) * expanded.pitch + (x + dstOffsetX)] =
					dst.buffer[y * dst.pitch + x] ?? 0;
			}
		}
	}

	return { expanded, dstOffsetX, dstOffsetY, srcOffsetX, srcOffsetY };
}

function getRowOffset(bitmap: Bitmap, y: number): number {
	const pitch = bitmap.pitch;
	const absPitch = Math.abs(pitch);
	const origin = pitch < 0 ? (bitmap.rows - 1) * absPitch : 0;
	return origin + y * pitch;
}

function getPixelChannel(
	bitmap: Bitmap,
	x: number,
	y: number,
	channel: number,
): number {
	if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.rows) return 0;
	const row = getRowOffset(bitmap, y);
	switch (bitmap.pixelMode) {
		case PixelMode.Gray:
			return bitmap.buffer[row + x] ?? 0;
		case PixelMode.Mono: {
			const byteIdx = row + (x >> 3);
			const bitIdx = 7 - (x & 7);
			const bit = ((bitmap.buffer[byteIdx] ?? 0) >> bitIdx) & 1;
			return bit ? 255 : 0;
		}
		case PixelMode.LCD:
		case PixelMode.LCD_V: {
			const idx = row + x * 3 + channel;
			return bitmap.buffer[idx] ?? 0;
		}
		case PixelMode.RGBA: {
			const idx = row + x * 4 + channel;
			return bitmap.buffer[idx] ?? 0;
		}
	}
}

function sampleBilinear(
	bitmap: Bitmap,
	x: number,
	y: number,
	channels: number,
	out: number[],
): void {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const x1 = x0 + 1;
	const y1 = y0 + 1;

	const wx = x - x0;
	const wy = y - y0;
	const w00 = (1 - wx) * (1 - wy);
	const w10 = wx * (1 - wy);
	const w01 = (1 - wx) * wy;
	const w11 = wx * wy;

	for (let c = 0; c < channels; c++) {
		const p00 = getPixelChannel(bitmap, x0, y0, c);
		const p10 = getPixelChannel(bitmap, x1, y0, c);
		const p01 = getPixelChannel(bitmap, x0, y1, c);
		const p11 = getPixelChannel(bitmap, x1, y1, c);
		const value = p00 * w00 + p10 * w10 + p01 * w01 + p11 * w11;
		out[c] = Math.min(255, Math.max(0, Math.round(value)));
	}
}

function invert2D(
	matrix: Matrix2D,
): { inv: Matrix2D; det: number } | null {
	const [a, b, c, d, e, f] = matrix;
	const det = a * d - b * c;
	if (det === 0) return null;
	const invA = d / det;
	const invB = -b / det;
	const invC = -c / det;
	const invD = a / det;
	const invE = (c * f - d * e) / det;
	const invF = (b * e - a * f) / det;
	return { inv: [invA, invB, invC, invD, invE, invF], det };
}

function invert3x3(matrix: Matrix3x3): Matrix3x3 | null {
	const a = matrix[0][0];
	const b = matrix[0][1];
	const c = matrix[0][2];
	const d = matrix[1][0];
	const e = matrix[1][1];
	const f = matrix[1][2];
	const g = matrix[2][0];
	const h = matrix[2][1];
	const i = matrix[2][2];

	const a00 = e * i - f * h;
	const a01 = c * h - b * i;
	const a02 = b * f - c * e;
	const a10 = f * g - d * i;
	const a11 = a * i - c * g;
	const a12 = c * d - a * f;
	const a20 = d * h - e * g;
	const a21 = b * g - a * h;
	const a22 = a * e - b * d;

	const det = a * a00 + b * a10 + c * a20;
	if (det === 0) return null;
	const invDet = 1 / det;

	return [
		[a00 * invDet, a01 * invDet, a02 * invDet],
		[a10 * invDet, a11 * invDet, a12 * invDet],
		[a20 * invDet, a21 * invDet, a22 * invDet],
	];
}

function transformPoint3x3Safe(
	x: number,
	y: number,
	matrix: Matrix3x3,
): { x: number; y: number } {
	const w = matrix[2][0] * x + matrix[2][1] * y + matrix[2][2];
	const minW = 1e-6;
	const safeW = Math.abs(w) < minW ? (w < 0 ? -minW : minW) : w;
	return {
		x: (matrix[0][0] * x + matrix[0][1] * y + matrix[0][2]) / safeW,
		y: (matrix[1][0] * x + matrix[1][1] * y + matrix[1][2]) / safeW,
	};
}

/**
 * Subtract src from dst (alias for subBitmaps)
 */
export function subtractBitmap(
	dst: Bitmap,
	src: Bitmap,
	srcX: number = 0,
	srcY: number = 0,
): void {
	subBitmaps(dst, src, srcX, srcY);
}

/**
 * Fix outline bitmap by removing glyph interior (alias for fixOutline)
 */
export function fixOutlineBitmap(
	outlineBitmap: Bitmap,
	glyphBitmap: Bitmap,
	glyphX: number = 0,
	glyphY: number = 0,
	threshold: number = 128,
): void {
	fixOutline(outlineBitmap, glyphBitmap, glyphX, glyphY, threshold);
}

/**
 * Measure rasterized glyph ascent/descent from bitmap coverage
 */
export function measureRasterGlyph(
	bitmap: Bitmap,
	bearingX: number,
	bearingY: number,
): { ascent: number; descent: number } {
	void bearingX;
	let topRow = Infinity;
	let bottomRow = -Infinity;

	for (let y = 0; y < bitmap.rows; y++) {
		for (let x = 0; x < bitmap.width; x++) {
			let covered = false;
			switch (bitmap.pixelMode) {
				case PixelMode.Gray: {
					const row = getRowOffset(bitmap, y);
					covered = (bitmap.buffer[row + x] ?? 0) > 0;
					break;
				}
				case PixelMode.Mono: {
					const row = getRowOffset(bitmap, y);
					const byteIdx = row + (x >> 3);
					const bitIdx = 7 - (x & 7);
					const bit = ((bitmap.buffer[byteIdx] ?? 0) >> bitIdx) & 1;
					covered = bit === 1;
					break;
				}
				case PixelMode.LCD:
				case PixelMode.LCD_V: {
					const row = getRowOffset(bitmap, y);
					const idx = row + x * 3;
					covered =
						(bitmap.buffer[idx] ?? 0) > 0 ||
						(bitmap.buffer[idx + 1] ?? 0) > 0 ||
						(bitmap.buffer[idx + 2] ?? 0) > 0;
					break;
				}
				case PixelMode.RGBA: {
					const row = getRowOffset(bitmap, y);
					const idx = row + x * 4;
					covered = (bitmap.buffer[idx + 3] ?? 0) > 0;
					break;
				}
			}

			if (covered) {
				topRow = Math.min(topRow, y);
				bottomRow = Math.max(bottomRow, y);
			}
		}
	}

	if (!Number.isFinite(topRow) || !Number.isFinite(bottomRow)) {
		return { ascent: 0, descent: 0 };
	}

	const ascent = bearingY - topRow;
	const descent = bottomRow + 1 - bearingY;
	return { ascent, descent };
}

/**
 * Expand raster metrics to account for blur/border/shadow padding
 */
export function expandRasterMetrics(
	metrics: RasterMetrics,
	options: RasterEffectOptions,
): RasterMetrics & {
	padLeft: number;
	padRight: number;
	padTop: number;
	padBottom: number;
} {
	const blur = options.blur ?? 0;
	const be = options.be ?? 0;
	const border = options.border ?? 0;
	const shadowX = options.shadowX ?? 0;
	const shadowY = options.shadowY ?? 0;

	const basePad = Math.ceil(blur + be + border);
	const padLeft = basePad + Math.max(0, -shadowX);
	const padRight = basePad + Math.max(0, shadowX);
	const padTop = basePad + Math.max(0, -shadowY);
	const padBottom = basePad + Math.max(0, shadowY);

	return {
		width: metrics.width + padLeft + padRight,
		height: metrics.height + padTop + padBottom,
		bearingX: metrics.bearingX - padLeft,
		bearingY: metrics.bearingY + padTop,
		ascent: metrics.ascent + padTop,
		descent: metrics.descent + padBottom,
		padLeft,
		padRight,
		padTop,
		padBottom,
	};
}

/**
 * Embolden bitmap and adjust bearing by padding to avoid clipping
 */
export function emboldenBitmapWithBearing(
	bitmap: Bitmap,
	bearingX: number,
	bearingY: number,
	xStrength: number,
	yStrength: number,
): { bitmap: Bitmap; bearingX: number; bearingY: number } {
	const padX = Math.max(0, Math.ceil(xStrength));
	const padY = Math.max(0, Math.ceil(yStrength));
	const padded = padBitmap(bitmap, padX, padY, padX, padY);
	const emboldened = emboldenBitmap(padded, xStrength, yStrength);
	return {
		bitmap: emboldened,
		bearingX: bearingX - padX,
		bearingY: bearingY + padY,
	};
}

/**
 * Transform bitmap using 2D affine matrix with bilinear resampling
 */
export function transformBitmap2D(
	bitmap: Bitmap,
	matrix: Matrix2D,
	options: BitmapTransformOptions = {},
): { bitmap: Bitmap; bearingX: number; bearingY: number } {
	const bearingX = options.bearingX ?? 0;
	const bearingY = options.bearingY ?? 0;
	const offsetX = (options.offsetX26 ?? 0) / 64;
	const offsetY = (options.offsetY26 ?? 0) / 64;
	const [a, b, c, d, e, f] = matrix;
	const adjusted: Matrix2D = [a, b, c, d, e + offsetX, f + offsetY];

	const left = bearingX;
	const top = bearingY;
	const right = left + bitmap.width;
	const bottom = top - bitmap.rows;

	const corners = [
		{
			x: adjusted[0] * left + adjusted[2] * top + adjusted[4],
			y: adjusted[1] * left + adjusted[3] * top + adjusted[5],
		},
		{
			x: adjusted[0] * right + adjusted[2] * top + adjusted[4],
			y: adjusted[1] * right + adjusted[3] * top + adjusted[5],
		},
		{
			x: adjusted[0] * left + adjusted[2] * bottom + adjusted[4],
			y: adjusted[1] * left + adjusted[3] * bottom + adjusted[5],
		},
		{
			x: adjusted[0] * right + adjusted[2] * bottom + adjusted[4],
			y: adjusted[1] * right + adjusted[3] * bottom + adjusted[5],
		},
	];

	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const p of corners) {
		minX = Math.min(minX, p.x);
		maxX = Math.max(maxX, p.x);
		minY = Math.min(minY, p.y);
		maxY = Math.max(maxY, p.y);
	}

	if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
		return {
			bitmap: createBitmap(1, 1, bitmap.pixelMode),
			bearingX: 0,
			bearingY: 0,
		};
	}

	const outMinX = Math.floor(minX);
	const outMaxX = Math.ceil(maxX);
	const outMinY = Math.floor(minY);
	const outMaxY = Math.ceil(maxY);

	const outWidth = Math.max(1, outMaxX - outMinX);
	const outHeight = Math.max(1, outMaxY - outMinY);

	const result = createBitmap(outWidth, outHeight, bitmap.pixelMode);
	const inverse = invert2D(adjusted);
	if (!inverse) {
		return { bitmap: result, bearingX: outMinX, bearingY: outMaxY };
	}
	const inv = inverse.inv;

	const channels =
		bitmap.pixelMode === PixelMode.LCD || bitmap.pixelMode === PixelMode.LCD_V
			? 3
			: bitmap.pixelMode === PixelMode.RGBA
				? 4
				: 1;
	const sampleBuffer = new Array<number>(channels).fill(0);

	for (let y = 0; y < outHeight; y++) {
		for (let x = 0; x < outWidth; x++) {
			const gx = outMinX + x + 0.5;
			const gy = outMaxY - y - 0.5;

			const sxg = inv[0] * gx + inv[2] * gy + inv[4];
			const syg = inv[1] * gx + inv[3] * gy + inv[5];

			const sx = sxg - bearingX - 0.5;
			const sy = bearingY - syg - 0.5;

			sampleBilinear(bitmap, sx, sy, channels, sampleBuffer);

			if (bitmap.pixelMode === PixelMode.Mono) {
				const val = sampleBuffer[0] ?? 0;
				if (val >= 128) {
					const byteIdx = y * result.pitch + (x >> 3);
					const bitIdx = 7 - (x & 7);
					result.buffer[byteIdx] |= 1 << bitIdx;
				}
			} else if (bitmap.pixelMode === PixelMode.Gray) {
				result.buffer[y * result.pitch + x] = sampleBuffer[0] ?? 0;
			} else if (
				bitmap.pixelMode === PixelMode.LCD ||
				bitmap.pixelMode === PixelMode.LCD_V
			) {
				const idx = y * result.pitch + x * 3;
				result.buffer[idx] = sampleBuffer[0] ?? 0;
				result.buffer[idx + 1] = sampleBuffer[1] ?? 0;
				result.buffer[idx + 2] = sampleBuffer[2] ?? 0;
			} else if (bitmap.pixelMode === PixelMode.RGBA) {
				const idx = y * result.pitch + x * 4;
				result.buffer[idx] = sampleBuffer[0] ?? 0;
				result.buffer[idx + 1] = sampleBuffer[1] ?? 0;
				result.buffer[idx + 2] = sampleBuffer[2] ?? 0;
				result.buffer[idx + 3] = sampleBuffer[3] ?? 0;
			}
		}
	}

	return { bitmap: result, bearingX: outMinX, bearingY: outMaxY };
}

/**
 * Transform bitmap using 3x3 matrix with perspective and bilinear resampling
 */
export function transformBitmap3D(
	bitmap: Bitmap,
	matrix: Matrix3x3,
	options: BitmapTransformOptions = {},
): { bitmap: Bitmap; bearingX: number; bearingY: number } {
	const bearingX = options.bearingX ?? 0;
	const bearingY = options.bearingY ?? 0;
	const offsetX = (options.offsetX26 ?? 0) / 64;
	const offsetY = (options.offsetY26 ?? 0) / 64;

	const adjusted: Matrix3x3 = [
		[matrix[0][0], matrix[0][1], matrix[0][2] + offsetX],
		[matrix[1][0], matrix[1][1], matrix[1][2] + offsetY],
		[matrix[2][0], matrix[2][1], matrix[2][2]],
	];

	const left = bearingX;
	const top = bearingY;
	const right = left + bitmap.width;
	const bottom = top - bitmap.rows;

	const corners = [
		transformPoint3x3Safe(left, top, adjusted),
		transformPoint3x3Safe(right, top, adjusted),
		transformPoint3x3Safe(left, bottom, adjusted),
		transformPoint3x3Safe(right, bottom, adjusted),
	];

	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const p of corners) {
		minX = Math.min(minX, p.x);
		maxX = Math.max(maxX, p.x);
		minY = Math.min(minY, p.y);
		maxY = Math.max(maxY, p.y);
	}

	if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
		return {
			bitmap: createBitmap(1, 1, bitmap.pixelMode),
			bearingX: 0,
			bearingY: 0,
		};
	}

	const outMinX = Math.floor(minX);
	const outMaxX = Math.ceil(maxX);
	const outMinY = Math.floor(minY);
	const outMaxY = Math.ceil(maxY);

	const outWidth = Math.max(1, outMaxX - outMinX);
	const outHeight = Math.max(1, outMaxY - outMinY);
	const result = createBitmap(outWidth, outHeight, bitmap.pixelMode);

	const inverse = invert3x3(adjusted);
	if (!inverse) {
		return { bitmap: result, bearingX: outMinX, bearingY: outMaxY };
	}

	const channels =
		bitmap.pixelMode === PixelMode.LCD || bitmap.pixelMode === PixelMode.LCD_V
			? 3
			: bitmap.pixelMode === PixelMode.RGBA
				? 4
				: 1;
	const sampleBuffer = new Array<number>(channels).fill(0);

	for (let y = 0; y < outHeight; y++) {
		for (let x = 0; x < outWidth; x++) {
			const gx = outMinX + x + 0.5;
			const gy = outMaxY - y - 0.5;

			const src = transformPoint3x3Safe(gx, gy, inverse);
			const sx = src.x - bearingX - 0.5;
			const sy = bearingY - src.y - 0.5;

			sampleBilinear(bitmap, sx, sy, channels, sampleBuffer);

			if (bitmap.pixelMode === PixelMode.Mono) {
				const val = sampleBuffer[0] ?? 0;
				if (val >= 128) {
					const byteIdx = y * result.pitch + (x >> 3);
					const bitIdx = 7 - (x & 7);
					result.buffer[byteIdx] |= 1 << bitIdx;
				}
			} else if (bitmap.pixelMode === PixelMode.Gray) {
				result.buffer[y * result.pitch + x] = sampleBuffer[0] ?? 0;
			} else if (
				bitmap.pixelMode === PixelMode.LCD ||
				bitmap.pixelMode === PixelMode.LCD_V
			) {
				const idx = y * result.pitch + x * 3;
				result.buffer[idx] = sampleBuffer[0] ?? 0;
				result.buffer[idx + 1] = sampleBuffer[1] ?? 0;
				result.buffer[idx + 2] = sampleBuffer[2] ?? 0;
			} else if (bitmap.pixelMode === PixelMode.RGBA) {
				const idx = y * result.pitch + x * 4;
				result.buffer[idx] = sampleBuffer[0] ?? 0;
				result.buffer[idx + 1] = sampleBuffer[1] ?? 0;
				result.buffer[idx + 2] = sampleBuffer[2] ?? 0;
				result.buffer[idx + 3] = sampleBuffer[3] ?? 0;
			}
		}
	}

	return { bitmap: result, bearingX: outMinX, bearingY: outMaxY };
}

/**
 * Shear bitmap horizontally (synthetic italic)
 */
export function shearBitmapX(
	bitmap: Bitmap,
	amount: number,
	options: BitmapTransformOptions = {},
): { bitmap: Bitmap; bearingX: number; bearingY: number } {
	return transformBitmap2D(bitmap, [1, 0, amount, 1, 0, 0], options);
}

/**
 * Shear bitmap vertically
 */
export function shearBitmapY(
	bitmap: Bitmap,
	amount: number,
	options: BitmapTransformOptions = {},
): { bitmap: Bitmap; bearingX: number; bearingY: number } {
	return transformBitmap2D(bitmap, [1, amount, 0, 1, 0, 0], options);
}
