import { describe, expect, test } from "bun:test";
import {
	PIXEL_BITS,
	ONE_PIXEL,
	PIXEL_MASK,
	F26DOT6_SHIFT,
	F26DOT6_ONE,
	F16DOT16_SHIFT,
	F16DOT16_ONE,
	floatToF26Dot6,
	f26Dot6ToFloat,
	floatToPixel,
	truncPixel,
	fracPixel,
	roundPixel,
	floorPixel,
	ceilPixel,
	upscale,
	downscale,
	mulDiv,
	mulFix,
	divFix,
	vectorLength,
	normalizeVector,
	clamp,
	abs,
	sign,
} from "../../src/raster/fixed-point.ts";

describe("raster/fixed-point", () => {
	describe("constants", () => {
		test("PIXEL_BITS is 8", () => {
			expect(PIXEL_BITS).toBe(8);
		});

		test("ONE_PIXEL is 256", () => {
			expect(ONE_PIXEL).toBe(256);
			expect(ONE_PIXEL).toBe(1 << PIXEL_BITS);
		});

		test("PIXEL_MASK is 0xFF", () => {
			expect(PIXEL_MASK).toBe(0xff);
			expect(PIXEL_MASK).toBe(ONE_PIXEL - 1);
		});

		test("F26DOT6_SHIFT is 6", () => {
			expect(F26DOT6_SHIFT).toBe(6);
		});

		test("F26DOT6_ONE is 64", () => {
			expect(F26DOT6_ONE).toBe(64);
			expect(F26DOT6_ONE).toBe(1 << F26DOT6_SHIFT);
		});

		test("F16DOT16_SHIFT is 16", () => {
			expect(F16DOT16_SHIFT).toBe(16);
		});

		test("F16DOT16_ONE is 65536", () => {
			expect(F16DOT16_ONE).toBe(65536);
			expect(F16DOT16_ONE).toBe(1 << F16DOT16_SHIFT);
		});
	});

	describe("floatToF26Dot6", () => {
		test("converts 1.0 to 64", () => {
			expect(floatToF26Dot6(1.0)).toBe(64);
		});

		test("converts 0.5 to 32", () => {
			expect(floatToF26Dot6(0.5)).toBe(32);
		});

		test("converts 0 to 0", () => {
			expect(floatToF26Dot6(0)).toBe(0);
		});

		test("converts 10.25 to 656", () => {
			expect(floatToF26Dot6(10.25)).toBe(656);
		});

		test("converts negative values", () => {
			expect(floatToF26Dot6(-1.0)).toBe(-64);
		});

		test("rounds to nearest integer", () => {
			const result = floatToF26Dot6(0.51);
			expect(result).toBe(33); // 0.51 * 64 = 32.64, rounds to 33
		});
	});

	describe("f26Dot6ToFloat", () => {
		test("converts 64 to 1.0", () => {
			expect(f26Dot6ToFloat(64)).toBe(1.0);
		});

		test("converts 32 to 0.5", () => {
			expect(f26Dot6ToFloat(32)).toBe(0.5);
		});

		test("converts 0 to 0", () => {
			expect(f26Dot6ToFloat(0)).toBe(0);
		});

		test("converts 656 to 10.25", () => {
			expect(f26Dot6ToFloat(656)).toBe(10.25);
		});

		test("converts negative values", () => {
			expect(f26Dot6ToFloat(-64)).toBe(-1.0);
		});

		test("roundtrip conversion preserves value", () => {
			const original = 5.5;
			const fixed = floatToF26Dot6(original);
			const back = f26Dot6ToFloat(fixed);
			expect(back).toBeCloseTo(original, 2);
		});
	});

	describe("floatToPixel", () => {
		test("converts with scale 1.0", () => {
			expect(floatToPixel(10, 1.0)).toBe(10 * 256);
		});

		test("converts with scale 0.5", () => {
			expect(floatToPixel(10, 0.5)).toBe(5 * 256);
		});

		test("converts 0", () => {
			expect(floatToPixel(0, 1.0)).toBe(0);
		});

		test("handles fractional pixels", () => {
			const result = floatToPixel(0.5, 1.0);
			expect(result).toBe(128); // 0.5 * 256
		});

		test("handles negative values", () => {
			expect(floatToPixel(-10, 1.0)).toBe(-10 * 256);
		});

		test("rounds to nearest subpixel", () => {
			const result = floatToPixel(1.001, 1.0);
			expect(result).toBeCloseTo(256, 1);
		});
	});

	describe("truncPixel", () => {
		test("truncates 256 to 1", () => {
			expect(truncPixel(256)).toBe(1);
		});

		test("truncates 512 to 2", () => {
			expect(truncPixel(512)).toBe(2);
		});

		test("truncates fractional part", () => {
			expect(truncPixel(256 + 128)).toBe(1);
		});

		test("truncates 0 to 0", () => {
			expect(truncPixel(0)).toBe(0);
		});

		test("handles negative values", () => {
			expect(truncPixel(-256)).toBe(-1);
		});

		test("removes subpixel precision", () => {
			expect(truncPixel(255)).toBe(0); // Less than one pixel
			expect(truncPixel(256)).toBe(1); // Exactly one pixel
			expect(truncPixel(257)).toBe(1); // Just over one pixel
		});
	});

	describe("fracPixel", () => {
		test("extracts fractional part", () => {
			expect(fracPixel(256 + 128)).toBe(128);
		});

		test("returns 0 for whole pixel", () => {
			expect(fracPixel(256)).toBe(0);
		});

		test("returns value for subpixel only", () => {
			expect(fracPixel(128)).toBe(128);
		});

		test("masks upper bits", () => {
			expect(fracPixel(512 + 64)).toBe(64);
		});

		test("range is 0 to 255", () => {
			for (let i = 0; i < 1000; i += 10) {
				const frac = fracPixel(i);
				expect(frac).toBeGreaterThanOrEqual(0);
				expect(frac).toBeLessThan(256);
			}
		});
	});

	describe("roundPixel", () => {
		test("rounds up from 0.5", () => {
			expect(roundPixel(256 + 128)).toBe(2);
		});

		test("rounds down below 0.5", () => {
			expect(roundPixel(256 + 127)).toBe(1);
		});

		test("rounds exact pixel values", () => {
			expect(roundPixel(256)).toBe(1);
		});

		test("rounds 0 to 0", () => {
			expect(roundPixel(0)).toBe(0);
		});

		test("handles negative values", () => {
			expect(roundPixel(-256 - 128)).toBe(-1);
		});
	});

	describe("floorPixel", () => {
		test("floors to pixel boundary", () => {
			expect(floorPixel(256 + 128)).toBe(256);
		});

		test("keeps exact boundaries", () => {
			expect(floorPixel(512)).toBe(512);
		});

		test("removes fractional part", () => {
			expect(floorPixel(255)).toBe(0);
			expect(floorPixel(256)).toBe(256);
			expect(floorPixel(257)).toBe(256);
		});

		test("floors 0 to 0", () => {
			expect(floorPixel(0)).toBe(0);
		});
	});

	describe("ceilPixel", () => {
		test("ceils to next pixel boundary", () => {
			expect(ceilPixel(256 + 1)).toBe(512);
		});

		test("keeps exact boundaries", () => {
			expect(ceilPixel(256)).toBe(256);
		});

		test("rounds up any fractional part", () => {
			expect(ceilPixel(1)).toBe(256);
			expect(ceilPixel(255)).toBe(256);
			expect(ceilPixel(256)).toBe(256);
			expect(ceilPixel(257)).toBe(512);
		});

		test("ceils 0 to 0", () => {
			expect(ceilPixel(0)).toBe(0);
		});

		test("floor and ceil bounds integer pixels", () => {
			const val = 256 + 128;
			expect(floorPixel(val)).toBe(256);
			expect(ceilPixel(val)).toBe(512);
		});
	});

	describe("upscale", () => {
		test("upscales from 26.6 to PIXEL_BITS", () => {
			const fixed26dot6 = 64; // 1.0 in 26.6
			const result = upscale(fixed26dot6);
			expect(result).toBe(256); // 1.0 in 8-bit subpixel
		});

		test("upscales 0", () => {
			expect(upscale(0)).toBe(0);
		});

		test("shift difference is 2 bits", () => {
			const shift = PIXEL_BITS - F26DOT6_SHIFT;
			expect(shift).toBe(2);
		});

		test("upscale multiplies by 4", () => {
			expect(upscale(32)).toBe(128);
		});
	});

	describe("downscale", () => {
		test("downscales from PIXEL_BITS to 26.6", () => {
			const subpixel = 256; // 1.0 in 8-bit subpixel
			const result = downscale(subpixel);
			expect(result).toBe(64); // 1.0 in 26.6
		});

		test("downscales 0", () => {
			expect(downscale(0)).toBe(0);
		});

		test("downscale divides by 4", () => {
			expect(downscale(128)).toBe(32);
		});

		test("upscale and downscale roundtrip", () => {
			const original = 128;
			const up = upscale(original);
			const down = downscale(up);
			expect(down).toBe(original);
		});
	});

	describe("mulDiv", () => {
		test("computes (a * b) / c", () => {
			expect(mulDiv(10, 5, 2)).toBe(25);
		});

		test("handles division by zero", () => {
			expect(mulDiv(10, 5, 0)).toBe(0);
		});

		test("handles large numbers without overflow", () => {
			const result = mulDiv(100000, 100000, 1000);
			expect(result).toBe(10000000);
		});

		test("handles negative values", () => {
			expect(mulDiv(-10, 5, 2)).toBe(-25);
			expect(mulDiv(10, -5, 2)).toBe(-25);
			expect(mulDiv(10, 5, -2)).toBe(-25);
		});

		test("preserves precision with BigInt", () => {
			const a = 1000000;
			const b = 1000000;
			const c = 3;
			const result = mulDiv(a, b, c);
			expect(result).toBe(333333333333);
		});
	});

	describe("mulFix", () => {
		test("multiplies two 16.16 fixed-point numbers", () => {
			const a = F16DOT16_ONE; // 1.0
			const b = F16DOT16_ONE * 2; // 2.0
			expect(mulFix(a, b)).toBe(F16DOT16_ONE * 2);
		});

		test("multiplies fractional values", () => {
			const a = F16DOT16_ONE / 2; // 0.5
			const b = F16DOT16_ONE / 4; // 0.25
			const result = mulFix(a, b);
			expect(result).toBe(F16DOT16_ONE / 8); // 0.125
		});

		test("multiplies by zero", () => {
			expect(mulFix(F16DOT16_ONE, 0)).toBe(0);
		});

		test("identity multiplication", () => {
			const val = F16DOT16_ONE * 5;
			expect(mulFix(val, F16DOT16_ONE)).toBe(val);
		});
	});

	describe("divFix", () => {
		test("divides and returns 16.16 result", () => {
			const result = divFix(F16DOT16_ONE * 2, 2);
			expect(result).toBe(4294967296);
		});

		test("handles division by zero", () => {
			expect(divFix(100, 0)).toBe(0);
		});

		test("divides fractional values", () => {
			const a = F16DOT16_ONE; // 1.0
			const b = 4;
			const result = divFix(a, b);
			expect(result).toBe(1073741824);
		});

		test("inverse of mulFix", () => {
			const original = F16DOT16_ONE * 3;
			const multiplier = F16DOT16_ONE * 2;
			const multiplied = mulFix(original, multiplier);
			const divided = divFix(multiplied, multiplier);
			expect(divided).toBeCloseTo(original, -2);
		});
	});

	describe("vectorLength", () => {
		test("calculates length of unit vector", () => {
			expect(vectorLength(1, 0)).toBe(1);
			expect(vectorLength(0, 1)).toBe(1);
		});

		test("calculates length of 3-4-5 triangle", () => {
			expect(vectorLength(3, 4)).toBe(5);
		});

		test("calculates length of zero vector", () => {
			expect(vectorLength(0, 0)).toBe(0);
		});

		test("handles negative components", () => {
			expect(vectorLength(-3, -4)).toBe(5);
		});

		test("calculates diagonal length", () => {
			const result = vectorLength(100, 100);
			// sqrt(100^2 + 100^2) = sqrt(20000) ≈ 141.42
			// Allow for fixed-point precision variance
			expect(result).toBeGreaterThanOrEqual(137);
			expect(result).toBeLessThanOrEqual(145);
		});

		test("symmetric in dx and dy", () => {
			expect(vectorLength(10, 20)).toBe(vectorLength(20, 10));
		});
	});

	describe("normalizeVector", () => {
		test("normalizes unit X vector", () => {
			const result = normalizeVector(1, 0);
			expect(result.x).toBe(F16DOT16_ONE);
			expect(result.y).toBe(0);
		});

		test("normalizes unit Y vector", () => {
			const result = normalizeVector(0, 1);
			expect(result.x).toBe(0);
			expect(result.y).toBe(F16DOT16_ONE);
		});

		test("normalizes zero vector to unit X", () => {
			const result = normalizeVector(0, 0);
			expect(result.x).toBe(F16DOT16_ONE);
			expect(result.y).toBe(0);
		});

		test("normalizes 3-4 vector", () => {
			const result = normalizeVector(3, 4);
			const expectedX = Math.round((3 / 5) * F16DOT16_ONE);
			const expectedY = Math.round((4 / 5) * F16DOT16_ONE);
			expect(result.x).toBeCloseTo(expectedX, -2);
			expect(result.y).toBeCloseTo(expectedY, -2);
		});

		test("normalized vector has unit length", () => {
			const result = normalizeVector(100, 50);
			const length = Math.sqrt(
				(result.x / F16DOT16_ONE) ** 2 + (result.y / F16DOT16_ONE) ** 2,
			);
			expect(length).toBeCloseTo(1.0, 2);
		});

		test("handles negative components", () => {
			const result = normalizeVector(-3, -4);
			expect(result.x).toBeLessThan(0);
			expect(result.y).toBeLessThan(0);
		});
	});

	describe("clamp", () => {
		test("clamps value below min", () => {
			expect(clamp(5, 10, 20)).toBe(10);
		});

		test("clamps value above max", () => {
			expect(clamp(25, 10, 20)).toBe(20);
		});

		test("keeps value in range", () => {
			expect(clamp(15, 10, 20)).toBe(15);
		});

		test("handles edge cases", () => {
			expect(clamp(10, 10, 20)).toBe(10);
			expect(clamp(20, 10, 20)).toBe(20);
		});

		test("works with negative ranges", () => {
			expect(clamp(-5, -10, 0)).toBe(-5);
			expect(clamp(-15, -10, 0)).toBe(-10);
		});
	});

	describe("abs", () => {
		test("returns absolute value of positive", () => {
			expect(abs(10)).toBe(10);
		});

		test("returns absolute value of negative", () => {
			expect(abs(-10)).toBe(10);
		});

		test("returns 0 for 0", () => {
			expect(abs(0)).toBe(0);
		});

		test("handles large values", () => {
			expect(abs(-1000000)).toBe(1000000);
		});
	});

	describe("sign", () => {
		test("returns 1 for positive", () => {
			expect(sign(10)).toBe(1);
		});

		test("returns -1 for negative", () => {
			expect(sign(-10)).toBe(-1);
		});

		test("returns 0 for zero", () => {
			expect(sign(0)).toBe(0);
		});

		test("returns 1 for very small positive", () => {
			expect(sign(0.0001)).toBe(1);
		});

		test("returns -1 for very small negative", () => {
			expect(sign(-0.0001)).toBe(-1);
		});
	});

	describe("integration tests", () => {
		test("convert pixel coordinates through multiple formats", () => {
			const pixelValue = 10.5;
			const scale = 1.0;

			const subpixel = floatToPixel(pixelValue, scale);
			expect(subpixel).toBe(Math.round(10.5 * 256));

			const truncated = truncPixel(subpixel);
			expect(truncated).toBe(10);

			const fractional = fracPixel(subpixel);
			expect(fractional).toBe(128); // 0.5 * 256

			const rounded = roundPixel(subpixel);
			expect(rounded).toBe(11); // rounds up from 0.5
		});

		test("26.6 to internal format roundtrip", () => {
			const f26dot6 = 100; // Some fixed-point value
			const internal = upscale(f26dot6);
			const back = downscale(internal);
			expect(back).toBe(f26dot6);
		});

		test("fixed-point arithmetic maintains precision", () => {
			const a = F16DOT16_ONE * 1.5; // 1.5
			const b = F16DOT16_ONE * 2.0; // 2.0

			const product = mulFix(a, b); // Should be 3.0
			expect(product).toBe(F16DOT16_ONE * 3);

			const quotient = divFix(product, b); // Should be back to 1.5
			expect(quotient).toBeCloseTo(a, -2);
		});

		test("vector operations preserve direction", () => {
			const dx = 100;
			const dy = 200;

			const length = vectorLength(dx, dy);
			expect(length).toBeGreaterThan(0);

			const normalized = normalizeVector(dx, dy);

			// Check that direction is preserved (same sign)
			expect(Math.sign(normalized.x)).toBe(Math.sign(dx));
			expect(Math.sign(normalized.y)).toBe(Math.sign(dy));

			// Check that ratio is preserved
			const ratio = dy / dx;
			const normalizedRatio = normalized.y / normalized.x;
			expect(normalizedRatio).toBeCloseTo(ratio, 1);
		});
	});
});
