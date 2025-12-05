/**
 * Bitmap blur filters - Gaussian and Box blur
 */

import { convertBitmap } from "./bitmap-utils.ts";
import { type Bitmap, PixelMode } from "./types.ts";

/**
 * Generate 1D Gaussian kernel
 * Uses Gaussian function: exp(-x²/(2σ²))
 */
export function createGaussianKernel(radius: number): Float32Array {
	if (radius <= 0) {
		return new Float32Array([1.0]);
	}

	// sigma = radius, kernel extends to 3*sigma on each side
	// This captures >99% of the Gaussian
	const sigma = radius;
	const size = Math.ceil(radius * 2) * 2 + 1;
	const kernel = new Float32Array(size);
	const center = Math.floor(size / 2);

	let sum = 0;

	// Calculate kernel weights
	for (let i = 0; i < size; i++) {
		const x = i - center;
		const weight = Math.exp(-(x * x) / (2 * sigma * sigma));
		kernel[i] = weight;
		sum += weight;
	}

	// Normalize to sum to 1.0
	for (let i = 0; i < size; i++) {
		kernel[i] /= sum;
	}

	return kernel;
}

/**
 * Apply 1D convolution along a row (horizontal)
 */
function convolveHorizontal(
	src: Uint8Array,
	dst: Uint8Array,
	width: number,
	height: number,
	srcPitch: number,
	dstPitch: number,
	kernel: Float32Array,
	channels: number,
): void {
	const radius = Math.floor(kernel.length / 2);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			for (let c = 0; c < channels; c++) {
				let sum = 0;

				for (let k = 0; k < kernel.length; k++) {
					const sx = x + k - radius;

					// Clamp to edges
					const clampedX = Math.max(0, Math.min(width - 1, sx));
					const srcIdx = y * srcPitch + clampedX * channels + c;
					sum += (src[srcIdx] ?? 0) * kernel[k];
				}

				const dstIdx = y * dstPitch + x * channels + c;
				dst[dstIdx] = Math.min(255, Math.max(0, Math.round(sum)));
			}
		}
	}
}

/**
 * Apply 1D convolution along a column (vertical)
 */
function convolveVertical(
	src: Uint8Array,
	dst: Uint8Array,
	width: number,
	height: number,
	srcPitch: number,
	dstPitch: number,
	kernel: Float32Array,
	channels: number,
): void {
	const radius = Math.floor(kernel.length / 2);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			for (let c = 0; c < channels; c++) {
				let sum = 0;

				for (let k = 0; k < kernel.length; k++) {
					const sy = y + k - radius;

					// Clamp to edges
					const clampedY = Math.max(0, Math.min(height - 1, sy));
					const srcIdx = clampedY * srcPitch + x * channels + c;
					sum += (src[srcIdx] ?? 0) * kernel[k];
				}

				const dstIdx = y * dstPitch + x * channels + c;
				dst[dstIdx] = Math.min(255, Math.max(0, Math.round(sum)));
			}
		}
	}
}

/**
 * Gaussian blur implementation using separable 2-pass algorithm
 * Modifies bitmap in-place and returns it
 */
export function gaussianBlur(bitmap: Bitmap, radius: number): Bitmap {
	// Handle Mono by converting to Gray first
	if (bitmap.pixelMode === PixelMode.Mono) {
		const converted = convertBitmap(bitmap, PixelMode.Gray);
		return gaussianBlur(converted, radius);
	}

	if (radius <= 0) {
		return bitmap;
	}

	const kernel = createGaussianKernel(radius);

	// Determine channels based on pixel mode
	let channels = 1;
	if (
		bitmap.pixelMode === PixelMode.LCD ||
		bitmap.pixelMode === PixelMode.LCD_V
	) {
		channels = 3;
	} else if (bitmap.pixelMode === PixelMode.RGBA) {
		channels = 4;
	}

	// Create temporary buffer for intermediate results
	const temp = new Uint8Array(bitmap.buffer.length);

	// Pass 1: Horizontal blur (src -> temp)
	convolveHorizontal(
		bitmap.buffer,
		temp,
		bitmap.width,
		bitmap.rows,
		bitmap.pitch,
		bitmap.pitch,
		kernel,
		channels,
	);

	// Pass 2: Vertical blur (temp -> bitmap.buffer)
	convolveVertical(
		temp,
		bitmap.buffer,
		bitmap.width,
		bitmap.rows,
		bitmap.pitch,
		bitmap.pitch,
		kernel,
		channels,
	);

	return bitmap;
}

/**
 * Box blur using running sum for O(1) per pixel
 * Modifies bitmap in-place and returns it
 */
export function boxBlur(bitmap: Bitmap, radius: number): Bitmap {
	// Handle Mono by converting to Gray first
	if (bitmap.pixelMode === PixelMode.Mono) {
		const converted = convertBitmap(bitmap, PixelMode.Gray);
		return boxBlur(converted, radius);
	}

	if (radius <= 0) {
		return bitmap;
	}

	// Determine channels based on pixel mode
	let channels = 1;
	if (
		bitmap.pixelMode === PixelMode.LCD ||
		bitmap.pixelMode === PixelMode.LCD_V
	) {
		channels = 3;
	} else if (bitmap.pixelMode === PixelMode.RGBA) {
		channels = 4;
	}

	const iRadius = Math.floor(radius);
	const _kernelSize = iRadius * 2 + 1;

	// Create temporary buffer
	const temp = new Uint8Array(bitmap.buffer.length);

	// Pass 1: Horizontal box blur using running sum
	for (let y = 0; y < bitmap.rows; y++) {
		for (let c = 0; c < channels; c++) {
			// Initialize running sum
			let sum = 0;
			let count = 0;

			// Initialize sum with first window
			for (let x = -iRadius; x <= iRadius; x++) {
				if (x >= 0 && x < bitmap.width) {
					const idx = y * bitmap.pitch + x * channels + c;
					sum += bitmap.buffer[idx] ?? 0;
					count++;
				}
			}

			// First pixel
			const dstIdx0 = y * bitmap.pitch + 0 * channels + c;
			temp[dstIdx0] = Math.round(sum / count);

			// Slide window across row
			for (let x = 1; x < bitmap.width; x++) {
				// Remove left pixel from sum
				const leftX = x - iRadius - 1;
				if (leftX >= 0) {
					const leftIdx = y * bitmap.pitch + leftX * channels + c;
					sum -= bitmap.buffer[leftIdx] ?? 0;
					count--;
				}

				// Add right pixel to sum
				const rightX = x + iRadius;
				if (rightX < bitmap.width) {
					const rightIdx = y * bitmap.pitch + rightX * channels + c;
					sum += bitmap.buffer[rightIdx] ?? 0;
					count++;
				}

				const dstIdx = y * bitmap.pitch + x * channels + c;
				temp[dstIdx] = Math.round(sum / count);
			}
		}
	}

	// Pass 2: Vertical box blur using running sum
	for (let x = 0; x < bitmap.width; x++) {
		for (let c = 0; c < channels; c++) {
			// Initialize running sum
			let sum = 0;
			let count = 0;

			// Initialize sum with first window
			for (let y = -iRadius; y <= iRadius; y++) {
				if (y >= 0 && y < bitmap.rows) {
					const idx = y * bitmap.pitch + x * channels + c;
					sum += temp[idx] ?? 0;
					count++;
				}
			}

			// First pixel
			const dstIdx0 = 0 * bitmap.pitch + x * channels + c;
			bitmap.buffer[dstIdx0] = Math.round(sum / count);

			// Slide window down column
			for (let y = 1; y < bitmap.rows; y++) {
				// Remove top pixel from sum
				const topY = y - iRadius - 1;
				if (topY >= 0) {
					const topIdx = topY * bitmap.pitch + x * channels + c;
					sum -= temp[topIdx] ?? 0;
					count--;
				}

				// Add bottom pixel to sum
				const bottomY = y + iRadius;
				if (bottomY < bitmap.rows) {
					const bottomIdx = bottomY * bitmap.pitch + x * channels + c;
					sum += temp[bottomIdx] ?? 0;
					count++;
				}

				const dstIdx = y * bitmap.pitch + x * channels + c;
				bitmap.buffer[dstIdx] = Math.round(sum / count);
			}
		}
	}

	return bitmap;
}

/**
 * Apply blur filter to a bitmap in-place
 * @param bitmap - Bitmap to blur (modified in-place)
 * @param radius - Blur radius in pixels (can be fractional)
 * @param type - Blur type: 'gaussian' (default) or 'box'
 * @returns The modified bitmap
 */
export function blurBitmap(
	bitmap: Bitmap,
	radius: number,
	type: "gaussian" | "box" = "gaussian",
): Bitmap {
	if (type === "box") {
		return boxBlur(bitmap, radius);
	} else {
		return gaussianBlur(bitmap, radius);
	}
}
