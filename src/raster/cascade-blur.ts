/**
 * Cascade Blur Algorithm
 *
 * High-performance Gaussian blur for large radii using pyramid scaling.
 *
 * The key insight: to blur with large radius efficiently:
 * 1. Scale down the image by factor of 2 (with smooth kernel)
 * 2. Apply blur with smaller kernel on reduced image
 * 3. Scale back up (with smooth kernel)
 *
 * The shrink/expand kernels [1, 5, 10, 10, 5, 1]/32 provide sufficient
 * smoothness to maintain 8-bit precision through multiple cascade levels.
 *
 * Performance: O(n) per pixel regardless of blur radius
 * Traditional Gaussian: O(r) per pixel where r is radius
 */

import { gaussianBlur } from "./blur.ts";
import { type Bitmap, PixelMode } from "./types.ts";

const PI = Math.PI;

/**
 * Blur method parameters
 */
interface BlurMethod {
	level: number; // Number of cascade levels (shrink/expand)
	radius: number; // Blur kernel radius (4-8)
	coeff: Float32Array; // Kernel coefficients
}

/**
 * Calculate Gaussian distribution values
 */
function calcGauss(res: Float64Array, n: number, r2: number): void {
	const alpha = 0.5 / r2;
	let mul = Math.exp(-alpha);
	const mul2 = mul * mul;
	let cur = Math.sqrt(alpha / PI);

	res[0] = cur;
	cur *= mul;
	res[1] = cur;
	for (let i = 2; i < n; i++) {
		mul *= mul2;
		cur *= mul;
		res[i] = cur;
	}
}

/**
 * Apply coefficient filter (for frequency domain calculations)
 */
function coeffFilter(coeff: Float64Array, n: number, kernel: number[]): void {
	let prev1 = coeff[1];
	let prev2 = coeff[2];
	let prev3 = coeff[3];

	for (let i = 0; i < n; i++) {
		const res =
			coeff[i] * kernel[0] +
			(prev1 + coeff[i + 1]) * kernel[1] +
			(prev2 + coeff[i + 2]) * kernel[2] +
			(prev3 + coeff[i + 3]) * kernel[3];
		prev3 = prev2;
		prev2 = prev1;
		prev1 = coeff[i];
		coeff[i] = res;
	}
}

/**
 * Calculate and invert matrix for least-squares solution
 */
function calcMatrix(
	mat: Float64Array[],
	matFreq: Float64Array,
	n: number,
): void {
	// Build symmetric matrix
	for (let i = 0; i < n; i++) {
		mat[i][i] = matFreq[2 * i + 2] + 3 * matFreq[0] - 4 * matFreq[i + 1];
		for (let j = i + 1; j < n; j++) {
			mat[i][j] = mat[j][i] =
				matFreq[i + j + 2] +
				matFreq[j - i] +
				2 * (matFreq[0] - matFreq[i + 1] - matFreq[j + 1]);
		}
	}

	// Invert using Gauss-Jordan elimination
	for (let k = 0; k < n; k++) {
		const z = 1 / mat[k][k];
		mat[k][k] = 1;
		for (let i = 0; i < n; i++) {
			if (i === k) continue;
			const mul = mat[i][k] * z;
			mat[i][k] = 0;
			for (let j = 0; j < n; j++) {
				mat[i][j] -= mat[k][j] * mul;
			}
		}
		for (let j = 0; j < n; j++) {
			mat[k][j] *= z;
		}
	}
}

/**
 * Calculate optimal blur kernel coefficients
 * Uses least-squares fitting to match desired Gaussian
 */
function calcCoeff(mu: Float64Array, n: number, r2: number, mul: number): void {
	const w = 12096;
	const kernel = [
		(((+3280 / w) * mul + 1092 / w) * mul + 2520 / w) * mul + 5204 / w,
		(((-2460 / w) * mul - 273 / w) * mul - 210 / w) * mul + 2943 / w,
		(((+984 / w) * mul - 546 / w) * mul - 924 / w) * mul + 486 / w,
		(((-164 / w) * mul + 273 / w) * mul - 126 / w) * mul + 17 / w,
	];

	const matFreq = new Float64Array(17);
	matFreq[0] = kernel[0];
	matFreq[1] = kernel[1];
	matFreq[2] = kernel[2];
	matFreq[3] = kernel[3];
	coeffFilter(matFreq, 7, kernel);

	const vecFreq = new Float64Array(12);
	calcGauss(vecFreq, n + 4, r2 * mul);
	coeffFilter(vecFreq, n + 1, kernel);

	const mat: Float64Array[] = [];
	for (let i = 0; i < 8; i++) {
		mat.push(new Float64Array(8));
	}
	calcMatrix(mat, matFreq, n);

	const vec = new Float64Array(8);
	for (let i = 0; i < n; i++) {
		vec[i] = matFreq[0] - matFreq[i + 1] - vecFreq[0] + vecFreq[i + 1];
	}

	for (let i = 0; i < n; i++) {
		let res = 0;
		for (let j = 0; j < n; j++) {
			res += mat[i][j] * vec[j];
		}
		mu[i] = Math.max(0, res);
	}
}

/**
 * Find best blur method for given variance
 */
function findBestMethod(r2: number): BlurMethod {
	const mu = new Float64Array(8);
	let level: number;
	let radius: number;

	if (r2 < 0.5) {
		level = 0;
		radius = 4;
		mu[1] = 0.085 * r2 * r2 * r2;
		mu[0] = 0.5 * r2 - 4 * mu[1];
		mu[2] = mu[3] = 0;
	} else {
		// frexp equivalent: extract exponent
		const sqrtVal = Math.sqrt(0.11569 * r2 + 0.20591047);
		level = Math.floor(Math.log2(sqrtVal)) + 1;
		const frac = sqrtVal / 2 ** (level - 1) - 1; // Fractional part [0, 1)

		const mul = 0.25 ** level;
		radius = 8 - Math.floor((10.1525 + 0.8335 * mul) * (1 - frac));
		radius = Math.max(radius, 4);
		radius = Math.min(radius, 8);
		calcCoeff(mu, radius, r2, mul);
	}

	const coeff = new Float32Array(8);
	for (let i = 0; i < radius; i++) {
		coeff[i] = mu[i];
	}

	return { level, radius, coeff };
}

/**
 * Shrink image horizontally by factor of 2
 * Uses smooth kernel [1, 5, 10, 10, 5, 1]/32
 */
function shrinkHorz(
	dst: Float32Array,
	src: Float32Array,
	w: number,
	h: number,
	srcStride: number,
	dstStride: number,
): void {
	const newW = Math.floor((w + 5) / 2);

	for (let y = 0; y < h; y++) {
		const srcRow = y * srcStride;
		const dstRow = y * dstStride;

		for (let x = 0; x < newW; x++) {
			const sx = x * 2;

			// Kernel: [1, 5, 10, 10, 5, 1]/32
			let sum = 0;
			sum += (src[srcRow + Math.max(0, sx - 2)] ?? 0) * 1;
			sum += (src[srcRow + Math.max(0, sx - 1)] ?? 0) * 5;
			sum += (src[srcRow + Math.min(w - 1, sx)] ?? 0) * 10;
			sum += (src[srcRow + Math.min(w - 1, sx + 1)] ?? 0) * 10;
			sum += (src[srcRow + Math.min(w - 1, sx + 2)] ?? 0) * 5;
			sum += (src[srcRow + Math.min(w - 1, sx + 3)] ?? 0) * 1;

			dst[dstRow + x] = sum / 32;
		}
	}
}

/**
 * Shrink image vertically by factor of 2
 */
function shrinkVert(
	dst: Float32Array,
	src: Float32Array,
	w: number,
	h: number,
	srcStride: number,
	dstStride: number,
): void {
	const newH = Math.floor((h + 5) / 2);

	for (let x = 0; x < w; x++) {
		for (let y = 0; y < newH; y++) {
			const sy = y * 2;

			let sum = 0;
			sum += (src[Math.max(0, sy - 2) * srcStride + x] ?? 0) * 1;
			sum += (src[Math.max(0, sy - 1) * srcStride + x] ?? 0) * 5;
			sum += (src[Math.min(h - 1, sy) * srcStride + x] ?? 0) * 10;
			sum += (src[Math.min(h - 1, sy + 1) * srcStride + x] ?? 0) * 10;
			sum += (src[Math.min(h - 1, sy + 2) * srcStride + x] ?? 0) * 5;
			sum += (src[Math.min(h - 1, sy + 3) * srcStride + x] ?? 0) * 1;

			dst[y * dstStride + x] = sum / 32;
		}
	}
}

/**
 * Expand image horizontally by factor of 2
 */
function expandHorz(
	dst: Float32Array,
	src: Float32Array,
	w: number,
	h: number,
	srcStride: number,
	dstStride: number,
): void {
	const newW = w * 2 + 4;

	for (let y = 0; y < h; y++) {
		const srcRow = y * srcStride;
		const dstRow = y * dstStride;

		for (let x = 0; x < newW; x++) {
			const sx = Math.floor((x - 2) / 2);
			const odd = (x - 2) & 1;

			let sum = 0;
			if (odd === 0) {
				// Even position: [1, 10, 5]/16 from left neighbor, [5, 10, 1]/16 from right
				sum += (src[srcRow + Math.max(0, Math.min(w - 1, sx - 1))] ?? 0) * 1;
				sum += (src[srcRow + Math.max(0, Math.min(w - 1, sx))] ?? 0) * 30;
				sum += (src[srcRow + Math.max(0, Math.min(w - 1, sx + 1))] ?? 0) * 1;
			} else {
				// Odd position: interpolate between neighbors
				sum += (src[srcRow + Math.max(0, Math.min(w - 1, sx))] ?? 0) * 16;
				sum += (src[srcRow + Math.max(0, Math.min(w - 1, sx + 1))] ?? 0) * 16;
			}

			dst[dstRow + x] = sum / 32;
		}
	}
}

/**
 * Expand image vertically by factor of 2
 */
function expandVert(
	dst: Float32Array,
	src: Float32Array,
	w: number,
	h: number,
	srcStride: number,
	dstStride: number,
): void {
	const newH = h * 2 + 4;

	for (let x = 0; x < w; x++) {
		for (let y = 0; y < newH; y++) {
			const sy = Math.floor((y - 2) / 2);
			const odd = (y - 2) & 1;

			let sum = 0;
			if (odd === 0) {
				sum +=
					(src[Math.max(0, Math.min(h - 1, sy - 1)) * srcStride + x] ?? 0) * 1;
				sum +=
					(src[Math.max(0, Math.min(h - 1, sy)) * srcStride + x] ?? 0) * 30;
				sum +=
					(src[Math.max(0, Math.min(h - 1, sy + 1)) * srcStride + x] ?? 0) * 1;
			} else {
				sum +=
					(src[Math.max(0, Math.min(h - 1, sy)) * srcStride + x] ?? 0) * 16;
				sum +=
					(src[Math.max(0, Math.min(h - 1, sy + 1)) * srcStride + x] ?? 0) * 16;
			}

			dst[y * dstStride + x] = sum / 32;
		}
	}
}

/**
 * Apply 1D blur horizontally with computed coefficients
 */
function blurHorz(
	dst: Float32Array,
	src: Float32Array,
	w: number,
	h: number,
	srcStride: number,
	dstStride: number,
	radius: number,
	coeff: Float32Array,
): void {
	const newW = w + 2 * radius;

	for (let y = 0; y < h; y++) {
		const srcRow = y * srcStride;
		const dstRow = y * dstStride;

		for (let x = 0; x < newW; x++) {
			const cx = x - radius;
			let sum = 0;

			// Apply symmetric kernel
			for (let i = 0; i < radius; i++) {
				const left = Math.max(0, Math.min(w - 1, cx - i - 1));
				const right = Math.max(0, Math.min(w - 1, cx + i));
				sum +=
					((src[srcRow + left] ?? 0) + (src[srcRow + right] ?? 0)) * coeff[i];
			}

			dst[dstRow + x] = sum;
		}
	}
}

/**
 * Apply 1D blur vertically with computed coefficients
 */
function blurVert(
	dst: Float32Array,
	src: Float32Array,
	w: number,
	h: number,
	srcStride: number,
	dstStride: number,
	radius: number,
	coeff: Float32Array,
): void {
	const newH = h + 2 * radius;

	for (let x = 0; x < w; x++) {
		for (let y = 0; y < newH; y++) {
			const cy = y - radius;
			let sum = 0;

			for (let i = 0; i < radius; i++) {
				const top = Math.max(0, Math.min(h - 1, cy - i - 1));
				const bottom = Math.max(0, Math.min(h - 1, cy + i));
				sum +=
					((src[top * srcStride + x] ?? 0) +
						(src[bottom * srcStride + x] ?? 0)) *
					coeff[i];
			}

			dst[y * dstStride + x] = sum;
		}
	}
}

/**
 * Cascade blur for RGBA bitmaps - uses gaussianBlur which handles multi-channel
 * For RGBA, we fall back to the standard gaussian blur since cascade is optimized
 * for single-channel grayscale bitmaps.
 */
function cascadeBlurRGBA(
	bitmap: Bitmap,
	radiusX: number,
	radiusY: number,
): Bitmap {
	// For RGBA, use the standard gaussianBlur which handles multi-channel correctly
	// Use average of radiusX and radiusY since gaussianBlur only supports single radius
	const avgRadius = (radiusX + radiusY) / 2;
	return gaussianBlur(bitmap, avgRadius);
}

/**
 * Cascade Gaussian blur with asymmetric X/Y radii
 *
 * @param bitmap Input bitmap
 * @param radiusX Blur radius along X axis
 * @param radiusY Blur radius along Y axis (defaults to radiusX)
 * @returns New bitmap with blur applied (dimensions may change)
 */
export function cascadeBlur(
	bitmap: Bitmap,
	radiusX: number,
	radiusY: number = radiusX,
): Bitmap {
	if (radiusX <= 0 && radiusY <= 0) {
		return bitmap;
	}

	// Handle RGBA bitmaps - fall back to gaussianBlur which handles multi-channel
	if (bitmap.pixelMode === PixelMode.RGBA) {
		return cascadeBlurRGBA(bitmap, radiusX, radiusY);
	}

	// Grayscale cascade blur implementation
	const r2x = radiusX * radiusX;
	const r2y = radiusY * radiusY;

	const blurX = findBestMethod(r2x);
	const blurY = findBestMethod(r2y);

	let w = bitmap.width;
	let h = bitmap.rows;

	// Calculate output dimensions
	const offsetX = ((2 * blurX.radius + 9) << blurX.level) - 5;
	const offsetY = ((2 * blurY.radius + 9) << blurY.level) - 5;
	const endW = ((w + offsetX) & ~((1 << blurX.level) - 1)) - 4;
	const endH = ((h + offsetY) & ~((1 << blurY.level) - 1)) - 4;

	// Allocate working buffers (use Float32 for precision during cascade)
	const maxSize = Math.max(w * h, endW * endH) * 2;
	const buf0 = new Float32Array(maxSize);
	const buf1 = new Float32Array(maxSize);

	// Unpack bitmap to float buffer
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			buf0[y * w + x] = bitmap.buffer[y * bitmap.pitch + x] ?? 0;
		}
	}

	let src = buf0;
	let dst = buf1;
	let stride = w;

	// Cascade down: shrink vertically
	for (let i = 0; i < blurY.level; i++) {
		const newH = Math.floor((h + 5) / 2);
		shrinkVert(dst, src, w, h, stride, w);
		h = newH;
		[src, dst] = [dst, src];
	}

	// Cascade down: shrink horizontally
	for (let i = 0; i < blurX.level; i++) {
		const newW = Math.floor((w + 5) / 2);
		shrinkHorz(dst, src, w, h, stride, newW);
		w = newW;
		stride = newW;
		[src, dst] = [dst, src];
	}

	// Apply horizontal blur
	const blurredW = w + 2 * blurX.radius;
	blurHorz(dst, src, w, h, stride, blurredW, blurX.radius, blurX.coeff);
	w = blurredW;
	stride = blurredW;
	[src, dst] = [dst, src];

	// Apply vertical blur
	const blurredH = h + 2 * blurY.radius;
	blurVert(dst, src, w, h, stride, stride, blurY.radius, blurY.coeff);
	h = blurredH;
	[src, dst] = [dst, src];

	// Cascade up: expand horizontally
	for (let i = 0; i < blurX.level; i++) {
		const newW = w * 2 + 4;
		expandHorz(dst, src, w, h, stride, newW);
		w = newW;
		stride = newW;
		[src, dst] = [dst, src];
	}

	// Cascade up: expand vertically
	for (let i = 0; i < blurY.level; i++) {
		const newH = h * 2 + 4;
		expandVert(dst, src, w, h, stride, stride);
		h = newH;
		[src, dst] = [dst, src];
	}

	// Create output bitmap
	const outWidth = Math.min(w, endW);
	const outHeight = Math.min(h, endH);
	const outBuffer = new Uint8Array(outWidth * outHeight);

	// Pack float buffer back to uint8
	for (let y = 0; y < outHeight; y++) {
		for (let x = 0; x < outWidth; x++) {
			const val = src[y * stride + x] ?? 0;
			outBuffer[y * outWidth + x] = Math.max(0, Math.min(255, Math.round(val)));
		}
	}

	return {
		buffer: outBuffer,
		width: outWidth,
		rows: outHeight,
		pitch: outWidth,
		pixelMode: PixelMode.Gray,
		numGrays: 256,
	};
}

/**
 * Fast Gaussian blur using cascade algorithm
 * This is the recommended blur function for large radii (> 3 pixels)
 *
 * @param bitmap Input bitmap
 * @param radius Blur radius in pixels
 * @returns New bitmap with blur applied (dimensions may change)
 */
export function fastGaussianBlur(bitmap: Bitmap, radius: number): Bitmap {
	return cascadeBlur(bitmap, radius, radius);
}

/**
 * Adaptive blur that chooses the best algorithm based on radius
 * - For small radii (≤ 3): uses simple separable Gaussian (more precise)
 * - For large radii (> 3): uses cascade algorithm (faster)
 *
 * @param bitmap Input bitmap
 * @param radiusX Horizontal blur radius in pixels
 * @param radiusY Vertical blur radius in pixels (defaults to radiusX)
 */
export function adaptiveBlur(
	bitmap: Bitmap,
	radiusX: number,
	radiusY?: number,
): Bitmap {
	const ry = radiusY ?? radiusX;
	const maxRadius = Math.max(radiusX, ry);

	if (maxRadius <= 3) {
		// For small radii, use simple Gaussian (more precise for small kernels)
		// gaussianBlur only supports single radius, use average
		return gaussianBlur(bitmap, (radiusX + ry) / 2);
	}
	return cascadeBlur(bitmap, radiusX, ry);
}
