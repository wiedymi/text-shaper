/**
 * Fixed-point arithmetic utilities for rasterization
 *
 * FreeType uses several fixed-point formats:
 * - F26Dot6: 26.6 format (64 units per pixel) for coordinates
 * - F16Dot16: 16.16 format for high-precision calculations
 * - F2Dot14: 2.14 format for normalized vectors
 */

// Bit shifts for fixed-point formats
export const PIXEL_BITS = 8; // Subpixel precision (256 levels per pixel)
export const ONE_PIXEL = 1 << PIXEL_BITS; // 256
export const PIXEL_MASK = ONE_PIXEL - 1; // 0xFF

// 26.6 fixed-point (FreeType's standard format)
export const F26DOT6_SHIFT = 6;
export const F26DOT6_ONE = 1 << F26DOT6_SHIFT; // 64

// 16.16 fixed-point
export const F16DOT16_SHIFT = 16;
export const F16DOT16_ONE = 1 << F16DOT16_SHIFT; // 65536

/**
 * Convert float to 26.6 fixed-point
 */
export function floatToF26Dot6(x: number): number {
	return Math.round(x * F26DOT6_ONE);
}

/**
 * Convert 26.6 fixed-point to float
 */
export function f26Dot6ToFloat(x: number): number {
	return x / F26DOT6_ONE;
}

/**
 * Convert float to internal raster coordinates (PIXEL_BITS precision)
 * Input is in font units, output has 256 subpixel levels per pixel
 */
export function floatToPixel(x: number, scale: number): number {
	return Math.round(x * scale * ONE_PIXEL);
}

/**
 * Truncate to pixel (floor for positive, ceil for negative)
 */
export function truncPixel(x: number): number {
	return x >> PIXEL_BITS;
}

/**
 * Get fractional part (0 to ONE_PIXEL-1)
 */
export function fracPixel(x: number): number {
	return x & PIXEL_MASK;
}

/**
 * Round to nearest pixel
 */
export function roundPixel(x: number): number {
	return (x + (ONE_PIXEL >> 1)) >> PIXEL_BITS;
}

/**
 * Floor to pixel boundary
 */
export function floorPixel(x: number): number {
	return x & ~PIXEL_MASK;
}

/**
 * Ceiling to pixel boundary
 */
export function ceilPixel(x: number): number {
	return (x + PIXEL_MASK) & ~PIXEL_MASK;
}

/**
 * Upscale from 26.6 to internal PIXEL_BITS format
 * PIXEL_BITS=8 means 2 extra bits of precision vs 26.6
 */
export function upscale(x: number): number {
	return x << (PIXEL_BITS - F26DOT6_SHIFT);
}

/**
 * Downscale from internal format to 26.6
 */
export function downscale(x: number): number {
	return x >> (PIXEL_BITS - F26DOT6_SHIFT);
}

/**
 * Multiply two fixed-point numbers and divide, avoiding overflow
 * Computes (a * b) / c with 64-bit intermediate precision
 */
export function mulDiv(a: number, b: number, c: number): number {
	if (c === 0) return 0;
	// Use BigInt for 64-bit precision
	const result = (BigInt(a) * BigInt(b)) / BigInt(c);
	return Number(result);
}

/**
 * Multiply two 16.16 fixed-point numbers
 */
export function mulFix(a: number, b: number): number {
	return mulDiv(a, b, F16DOT16_ONE);
}

/**
 * Divide two numbers and return 16.16 fixed-point result
 */
export function divFix(a: number, b: number): number {
	if (b === 0) return 0;
	return mulDiv(a, F16DOT16_ONE, b);
}

/**
 * Fast approximation of sqrt(x*x + y*y) using "alpha max plus beta min" algorithm.
 * Uses alpha = 1, beta = 3/8 for max error < 7% vs exact value.
 * From FreeType's FT_HYPOT macro.
 */
export function hypot(x: number, y: number): number {
	x = abs(x);
	y = abs(y);
	return x > y ? x + ((3 * y) >> 3) : y + ((3 * x) >> 3);
}

/**
 * Calculate the length of a 2D vector (integer math)
 * Uses FreeType's "alpha max plus beta min" approximation
 */
export function vectorLength(dx: number, dy: number): number {
	return hypot(dx, dy);
}

/**
 * Normalize a 2D vector to unit length (16.16 fixed-point output)
 */
export function normalizeVector(
	dx: number,
	dy: number,
): { x: number; y: number } {
	const len = Math.sqrt(dx * dx + dy * dy);
	if (len === 0) return { x: F16DOT16_ONE, y: 0 };
	return {
		x: Math.round((dx / len) * F16DOT16_ONE),
		y: Math.round((dy / len) * F16DOT16_ONE),
	};
}

/**
 * Clamp value to range
 */
export function clamp(x: number, min: number, max: number): number {
	return x < min ? min : x > max ? max : x;
}

/**
 * Absolute value
 */
export function abs(x: number): number {
	return x < 0 ? -x : x;
}

/**
 * Sign of value (-1, 0, or 1)
 */
export function sign(x: number): number {
	return x < 0 ? -1 : x > 0 ? 1 : 0;
}
