/**
 * Bitmap manipulation utilities
 */

import { createBitmap, PixelMode, type Bitmap } from "./types.ts";

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

				for (let dy = -Math.floor(yStrength); dy <= Math.ceil(yStrength); dy++) {
					for (let dx = -Math.floor(xStrength); dx <= Math.ceil(xStrength); dx++) {
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

				for (let dy = -Math.floor(yStrength); dy <= Math.ceil(yStrength); dy++) {
					for (let dx = -Math.floor(xStrength); dx <= Math.ceil(xStrength); dx++) {
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
	} else if (bitmap.pixelMode === PixelMode.LCD || bitmap.pixelMode === PixelMode.LCD_V) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				let maxR = 0, maxG = 0, maxB = 0;

				for (let dy = -Math.floor(yStrength); dy <= Math.ceil(yStrength); dy++) {
					for (let dx = -Math.floor(xStrength); dx <= Math.ceil(xStrength); dx++) {
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
	} else if (bitmap.pixelMode === PixelMode.Mono && targetMode === PixelMode.Gray) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				const byteIdx = y * bitmap.pitch + (x >> 3);
				const bitIdx = 7 - (x & 7);
				const bit = ((bitmap.buffer[byteIdx] ?? 0) >> bitIdx) & 1;
				result.buffer[y * result.pitch + x] = bit ? 255 : 0;
			}
		}
	} else if (bitmap.pixelMode === PixelMode.Gray && targetMode === PixelMode.LCD) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				const gray = bitmap.buffer[y * bitmap.pitch + x] ?? 0;
				const dstIdx = y * result.pitch + x * 3;
				result.buffer[dstIdx] = gray;
				result.buffer[dstIdx + 1] = gray;
				result.buffer[dstIdx + 2] = gray;
			}
		}
	} else if (bitmap.pixelMode === PixelMode.Mono && targetMode === PixelMode.LCD) {
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
	} else if (bitmap.pixelMode === PixelMode.Gray && targetMode === PixelMode.LCD_V) {
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				const gray = bitmap.buffer[y * bitmap.pitch + x] ?? 0;
				const dstIdx = y * result.pitch + x * 3;
				result.buffer[dstIdx] = gray;
				result.buffer[dstIdx + 1] = gray;
				result.buffer[dstIdx + 2] = gray;
			}
		}
	} else if (bitmap.pixelMode === PixelMode.LCD && targetMode === PixelMode.Gray) {
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
				result.buffer[y * result.pitch + x] = bitmap.buffer[sy * bitmap.pitch + sx] ?? 0;
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
	} else if (bitmap.pixelMode === PixelMode.LCD || bitmap.pixelMode === PixelMode.LCD_V) {
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
