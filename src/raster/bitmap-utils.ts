/**
 * Bitmap manipulation utilities
 */

import { type Bitmap, createBitmap, PixelMode } from "./types.ts";

/**
 * Embolden a bitmap by dilating pixel values
 * Makes text bolder by spreading coverage in x and y directions
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
