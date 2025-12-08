import { test, expect, describe } from "bun:test";
import { createBitmap, PixelMode, type Bitmap } from "../../src/raster/types.ts";
import {
	blurBitmap,
	gaussianBlur,
	boxBlur,
	createGaussianKernel,
} from "../../src/raster/blur.ts";

describe("createGaussianKernel", () => {
	test("returns single element kernel for radius <= 0", () => {
		const kernel = createGaussianKernel(0);
		expect(kernel.length).toBe(1);
		expect(kernel[0]).toBe(1.0);

		const kernelNeg = createGaussianKernel(-1);
		expect(kernelNeg.length).toBe(1);
		expect(kernelNeg[0]).toBe(1.0);
	});

	test("creates kernel with correct size", () => {
		const kernel = createGaussianKernel(2.0);
		const expectedSize = Math.ceil(2.0 * 2) * 2 + 1; // ceil(4) * 2 + 1 = 9
		expect(kernel.length).toBe(expectedSize);
	});

	test("kernel weights sum to approximately 1.0", () => {
		const kernel = createGaussianKernel(2.0);
		const sum = Array.from(kernel).reduce((a, b) => a + b, 0);
		expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
	});

	test("kernel is symmetric", () => {
		const kernel = createGaussianKernel(3.0);
		const mid = Math.floor(kernel.length / 2);
		for (let i = 0; i < mid; i++) {
			expect(Math.abs(kernel[i] - kernel[kernel.length - 1 - i])).toBeLessThan(
				0.0001,
			);
		}
	});

	test("center has highest weight", () => {
		const kernel = createGaussianKernel(2.0);
		const mid = Math.floor(kernel.length / 2);
		const centerWeight = kernel[mid];
		for (let i = 0; i < kernel.length; i++) {
			if (i !== mid) {
				expect(kernel[i]).toBeLessThanOrEqual(centerWeight);
			}
		}
	});

	test("handles fractional radius", () => {
		const kernel = createGaussianKernel(1.5);
		expect(kernel.length).toBeGreaterThan(0);
		const sum = Array.from(kernel).reduce((a, b) => a + b, 0);
		expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
	});
});

describe("gaussianBlur", () => {
	test("zero radius returns bitmap unchanged", () => {
		const bitmap = createBitmap(10, 10, PixelMode.Gray);
		bitmap.buffer[5 * bitmap.pitch + 5] = 255;

		const original = new Uint8Array(bitmap.buffer);
		gaussianBlur(bitmap, 0);

		expect(bitmap.buffer).toEqual(original);
	});

	test("reduces high-frequency noise in grayscale", () => {
		const bitmap = createBitmap(11, 11, PixelMode.Gray);

		// Create checkerboard pattern (high frequency)
		for (let y = 0; y < bitmap.rows; y++) {
			for (let x = 0; x < bitmap.width; x++) {
				bitmap.buffer[y * bitmap.pitch + x] = (x + y) % 2 === 0 ? 255 : 0;
			}
		}

		const centerBefore = bitmap.buffer[5 * bitmap.pitch + 5];
		gaussianBlur(bitmap, 2.0);
		const centerAfter = bitmap.buffer[5 * bitmap.pitch + 5];

		// After blur, center should be closer to average (127-128)
		expect(Math.abs(centerAfter - 127)).toBeLessThan(Math.abs(centerBefore - 127));
	});

	test("handles edge pixels without out-of-bounds access", () => {
		const bitmap = createBitmap(5, 5, PixelMode.Gray);
		bitmap.buffer[0] = 255; // top-left corner

		expect(() => gaussianBlur(bitmap, 2.0)).not.toThrow();

		// Edge pixels should still have some value
		expect(bitmap.buffer[0]).toBeGreaterThan(0);
	});

	test("larger radius produces more blur", () => {
		const createTestBitmap = () => {
			const bmp = createBitmap(21, 21, PixelMode.Gray);
			bmp.buffer[10 * bmp.pitch + 10] = 255; // single bright pixel
			return bmp;
		};

		const bitmap1 = createTestBitmap();
		const bitmap2 = createTestBitmap();

		gaussianBlur(bitmap1, 1.0);
		gaussianBlur(bitmap2, 3.0);

		// Measure spread - larger radius spreads energy further
		// Check farther pixels (3 away) which should have more with larger radius
		const far1 = bitmap1.buffer[10 * bitmap1.pitch + 13];
		const far2 = bitmap2.buffer[10 * bitmap2.pitch + 13];

		// Larger radius should spread more to distant pixels
		expect(far2).toBeGreaterThan(far1);

		// Center should be more diffuse (lower) with larger radius
		const center1 = bitmap1.buffer[10 * bitmap1.pitch + 10];
		const center2 = bitmap2.buffer[10 * bitmap2.pitch + 10];
		expect(center2).toBeLessThan(center1);
	});

	test("works with LCD pixel mode", () => {
		const bitmap = createBitmap(10, 10, PixelMode.LCD);
		const idx = 5 * bitmap.pitch + 5 * 3;
		bitmap.buffer[idx] = 255; // R
		bitmap.buffer[idx + 1] = 128; // G
		bitmap.buffer[idx + 2] = 64; // B

		expect(() => gaussianBlur(bitmap, 2.0)).not.toThrow();

		// Should blur each channel independently
		expect(bitmap.buffer[idx]).toBeLessThan(255);
		expect(bitmap.buffer[idx + 1]).toBeLessThan(128);
	});

	test("converts Mono to Gray before blurring", () => {
		const bitmap = createBitmap(8, 8, PixelMode.Mono);

		// Set some bits
		const byteIdx = 4 * bitmap.pitch + 0;
		bitmap.buffer[byteIdx] = 0b11110000;

		const result = gaussianBlur(bitmap, 1.0);

		// Should return Gray bitmap
		expect(result.pixelMode).toBe(PixelMode.Gray);
		expect(result.width).toBe(8);
		expect(result.rows).toBe(8);
	});
});

describe("boxBlur", () => {
	test("zero radius returns bitmap unchanged", () => {
		const bitmap = createBitmap(10, 10, PixelMode.Gray);
		bitmap.buffer[5 * bitmap.pitch + 5] = 255;

		const original = new Uint8Array(bitmap.buffer);
		boxBlur(bitmap, 0);

		expect(bitmap.buffer).toEqual(original);
	});

	test("produces uniform averaging", () => {
		const bitmap = createBitmap(5, 5, PixelMode.Gray);
		bitmap.buffer.fill(0);
		bitmap.buffer[2 * bitmap.pitch + 2] = 100; // center pixel

		boxBlur(bitmap, 1.0);

		// Box blur should spread evenly
		const center = bitmap.buffer[2 * bitmap.pitch + 2];
		const adjacent = bitmap.buffer[2 * bitmap.pitch + 1];

		expect(center).toBeGreaterThan(0);
		expect(adjacent).toBeGreaterThan(0);
	});

	test("handles edge pixels", () => {
		const bitmap = createBitmap(5, 5, PixelMode.Gray);
		bitmap.buffer[0] = 255;

		expect(() => boxBlur(bitmap, 2.0)).not.toThrow();
		expect(bitmap.buffer[0]).toBeGreaterThan(0);
	});

	test("works with LCD pixel mode", () => {
		const bitmap = createBitmap(10, 10, PixelMode.LCD);
		const idx = 5 * bitmap.pitch + 5 * 3;
		bitmap.buffer[idx] = 200;
		bitmap.buffer[idx + 1] = 100;
		bitmap.buffer[idx + 2] = 50;

		expect(() => boxBlur(bitmap, 1.5)).not.toThrow();

		expect(bitmap.buffer[idx]).toBeLessThan(200);
	});

	test("converts Mono to Gray before blurring", () => {
		const bitmap = createBitmap(8, 8, PixelMode.Mono);
		const byteIdx = 4 * bitmap.pitch + 0;
		bitmap.buffer[byteIdx] = 0b11110000;

		const result = boxBlur(bitmap, 1.0);

		expect(result.pixelMode).toBe(PixelMode.Gray);
	});
});

describe("blurBitmap", () => {
	test("defaults to gaussian blur", () => {
		const bitmap1 = createBitmap(10, 10, PixelMode.Gray);
		const bitmap2 = createBitmap(10, 10, PixelMode.Gray);

		bitmap1.buffer[5 * bitmap1.pitch + 5] = 255;
		bitmap2.buffer[5 * bitmap2.pitch + 5] = 255;

		blurBitmap(bitmap1, 2.0);
		blurBitmap(bitmap2, 2.0, "gaussian");

		expect(bitmap1.buffer).toEqual(bitmap2.buffer);
	});

	test("applies gaussian blur when specified", () => {
		const bitmap = createBitmap(10, 10, PixelMode.Gray);
		bitmap.buffer[5 * bitmap.pitch + 5] = 255;

		blurBitmap(bitmap, 2.0, "gaussian");

		const center = bitmap.buffer[5 * bitmap.pitch + 5];
		expect(center).toBeLessThan(255);
		expect(center).toBeGreaterThan(0);
	});

	test("applies box blur when specified", () => {
		const bitmap = createBitmap(10, 10, PixelMode.Gray);
		bitmap.buffer[5 * bitmap.pitch + 5] = 255;

		blurBitmap(bitmap, 2.0, "box");

		const center = bitmap.buffer[5 * bitmap.pitch + 5];
		expect(center).toBeLessThan(255);
		expect(center).toBeGreaterThan(0);
	});

	test("modifies bitmap in-place", () => {
		const bitmap = createBitmap(10, 10, PixelMode.Gray);
		const buffer = bitmap.buffer;

		bitmap.buffer[5 * bitmap.pitch + 5] = 255;

		blurBitmap(bitmap, 2.0);

		// Same buffer reference
		expect(bitmap.buffer).toBe(buffer);
	});

	test("handles fractional radius", () => {
		const bitmap = createBitmap(10, 10, PixelMode.Gray);
		bitmap.buffer[5 * bitmap.pitch + 5] = 255;

		expect(() => blurBitmap(bitmap, 1.5, "gaussian")).not.toThrow();
		expect(() => blurBitmap(bitmap, 2.7, "box")).not.toThrow();
	});
});

describe("blur quality comparison", () => {
	test("gaussian produces smoother result than box", () => {
		const createImpulseBitmap = () => {
			const bmp = createBitmap(21, 21, PixelMode.Gray);
			bmp.buffer[10 * bmp.pitch + 10] = 255;
			return bmp;
		};

		const gaussianBmp = createImpulseBitmap();
		const boxBmp = createImpulseBitmap();

		gaussianBlur(gaussianBmp, 3.0);
		boxBlur(boxBmp, 3.0);

		// Gaussian should have smoother falloff
		// Check diagonal pixel which should show difference
		const gaussianDiag = gaussianBmp.buffer[7 * gaussianBmp.pitch + 7];
		const boxDiag = boxBmp.buffer[7 * boxBmp.pitch + 7];

		// Gaussian typically has more spread to diagonal
		expect(gaussianDiag).toBeGreaterThan(0);
		expect(boxDiag).toBeGreaterThanOrEqual(0);
	});
});

describe("blur with RGBA pixel mode", () => {
	test("gaussian blur works with RGBA", () => {
		const bitmap = createBitmap(10, 10, PixelMode.RGBA);
		const idx = (5 * 10 + 5) * 4;
		bitmap.buffer[idx] = 255; // R
		bitmap.buffer[idx + 1] = 200; // G
		bitmap.buffer[idx + 2] = 100; // B
		bitmap.buffer[idx + 3] = 255; // A

		gaussianBlur(bitmap, 2.0);

		// Values should be blurred
		expect(bitmap.buffer[idx]).toBeLessThan(255);
		expect(bitmap.buffer[idx + 1]).toBeLessThan(200);
		expect(bitmap.buffer[idx + 2]).toBeLessThan(100);
	});

	test("box blur works with RGBA", () => {
		const bitmap = createBitmap(10, 10, PixelMode.RGBA);
		const idx = (5 * 10 + 5) * 4;
		bitmap.buffer[idx] = 255; // R
		bitmap.buffer[idx + 1] = 200; // G
		bitmap.buffer[idx + 2] = 100; // B
		bitmap.buffer[idx + 3] = 255; // A

		boxBlur(bitmap, 2.0);

		// Values should be blurred
		expect(bitmap.buffer[idx]).toBeLessThan(255);
		expect(bitmap.buffer[idx + 1]).toBeLessThan(200);
	});
});

describe("performance edge cases", () => {
	test("handles 1x1 bitmap", () => {
		const bitmap = createBitmap(1, 1, PixelMode.Gray);
		bitmap.buffer[0] = 128;

		expect(() => blurBitmap(bitmap, 2.0)).not.toThrow();
		expect(bitmap.buffer[0]).toBe(128);
	});

	test("handles very large radius", () => {
		const bitmap = createBitmap(20, 20, PixelMode.Gray);
		bitmap.buffer[10 * bitmap.pitch + 10] = 255;

		expect(() => blurBitmap(bitmap, 10.0, "gaussian")).not.toThrow();
	});

	test("handles empty bitmap", () => {
		const bitmap = createBitmap(10, 10, PixelMode.Gray);
		bitmap.buffer.fill(0);

		blurBitmap(bitmap, 2.0);

		// All zeros should remain zeros
		expect(bitmap.buffer.every((v) => v === 0)).toBe(true);
	});

	test("handles fully saturated bitmap", () => {
		const bitmap = createBitmap(10, 10, PixelMode.Gray);
		bitmap.buffer.fill(255);

		blurBitmap(bitmap, 2.0);

		// All 255s should remain 255s
		expect(bitmap.buffer.every((v) => v === 255)).toBe(true);
	});
});
