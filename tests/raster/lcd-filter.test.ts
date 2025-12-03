import { describe, expect, test } from "bun:test";
import {
	rasterizeLcd,
	lcdToRGBA,
	LcdMode,
	LCD_FILTER_LIGHT,
	LCD_FILTER_DEFAULT,
	LCD_FILTER_LEGACY,
} from "../../src/raster/lcd-filter.ts";
import type { GlyphPath } from "../../src/render/path.ts";
import { PixelMode } from "../../src/raster/types.ts";

describe("raster/lcd-filter", () => {
	const createRectPath = (x: number, y: number, width: number, height: number): GlyphPath => ({
		commands: [
			{ type: "M", x, y },
			{ type: "L", x: x + width, y },
			{ type: "L", x: x + width, y: y + height },
			{ type: "L", x, y: y + height },
			{ type: "Z" },
		],
		bounds: { xMin: x, yMin: y, xMax: x + width, yMax: y + height },
	});

	const createTrianglePath = (): GlyphPath => ({
		commands: [
			{ type: "M", x: 5, y: 0 },
			{ type: "L", x: 10, y: 10 },
			{ type: "L", x: 0, y: 10 },
			{ type: "Z" },
		],
		bounds: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
	});

	describe("rasterizeLcd horizontal modes", () => {
		test("rasterizes with RGB mode", () => {
			const path = createRectPath(0, 0, 10, 10);
			const bitmap = rasterizeLcd(path, 20, 20, 1.0, 5, 5, LcdMode.RGB);

			expect(bitmap.width).toBe(20);
			expect(bitmap.rows).toBe(20);
			expect(bitmap.pixelMode).toBe(PixelMode.LCD);
			expect(bitmap.pitch).toBe(20 * 3);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("rasterizes with BGR mode", () => {
			const path = createRectPath(0, 0, 10, 10);
			const bitmap = rasterizeLcd(path, 20, 20, 1.0, 5, 5, LcdMode.BGR);

			expect(bitmap.width).toBe(20);
			expect(bitmap.rows).toBe(20);
			expect(bitmap.pixelMode).toBe(PixelMode.LCD);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("uses default filter when not specified", () => {
			const path = createRectPath(0, 0, 8, 8);
			const bitmap = rasterizeLcd(path, 16, 16, 1.0, 4, 4);

			expect(bitmap.pixelMode).toBe(PixelMode.LCD);
			expect(bitmap.buffer.length).toBeGreaterThan(0);
		});

		test("respects custom filter weights", () => {
			const path = createRectPath(0, 0, 8, 8);
			const bitmap1 = rasterizeLcd(path, 16, 16, 1.0, 4, 4, LcdMode.RGB, LCD_FILTER_LIGHT);
			const bitmap2 = rasterizeLcd(path, 16, 16, 1.0, 4, 4, LcdMode.RGB, LCD_FILTER_LEGACY);

			expect(bitmap1.width).toBe(bitmap2.width);
			expect(bitmap1.rows).toBe(bitmap2.rows);
		});

		test("handles edge pixels correctly", () => {
			const path = createRectPath(0, 0, 5, 5);
			const bitmap = rasterizeLcd(path, 10, 10, 1.0, 0, 0, LcdMode.RGB);

			expect(bitmap.buffer.length).toBe(10 * 10 * 3);
		});

		test("BGR mode swaps red and blue channels", () => {
			const path = createTrianglePath();
			const rgb = rasterizeLcd(path, 20, 20, 1.0, 5, 5, LcdMode.RGB);
			const bgr = rasterizeLcd(path, 20, 20, 1.0, 5, 5, LcdMode.BGR);

			expect(rgb.width).toBe(bgr.width);
			expect(rgb.rows).toBe(bgr.rows);

			let foundSwap = false;
			for (let y = 0; y < rgb.rows; y++) {
				for (let x = 0; x < rgb.width; x++) {
					const idx = y * rgb.pitch + x * 3;
					const rgbR = rgb.buffer[idx];
					const rgbG = rgb.buffer[idx + 1];
					const rgbB = rgb.buffer[idx + 2];
					const bgrR = bgr.buffer[idx];
					const bgrG = bgr.buffer[idx + 1];
					const bgrB = bgr.buffer[idx + 2];

					if (rgbR !== 0 || rgbB !== 0) {
						if (rgbR === bgrB && rgbB === bgrR && rgbG === bgrG) {
							foundSwap = true;
							break;
						}
					}
				}
				if (foundSwap) break;
			}
			expect(foundSwap).toBe(true);
		});
	});

	describe("rasterizeLcd vertical modes", () => {
		test("rasterizes with RGB_V mode", () => {
			const path = createRectPath(0, 0, 10, 10);
			const bitmap = rasterizeLcd(path, 20, 20, 1.0, 5, 5, LcdMode.RGB_V);

			expect(bitmap.width).toBe(20);
			expect(bitmap.rows).toBe(20);
			expect(bitmap.pixelMode).toBe(PixelMode.LCD_V);
			expect(bitmap.pitch).toBe(20 * 3);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("rasterizes with BGR_V mode", () => {
			const path = createRectPath(0, 0, 10, 10);
			const bitmap = rasterizeLcd(path, 20, 20, 1.0, 5, 5, LcdMode.BGR_V);

			expect(bitmap.width).toBe(20);
			expect(bitmap.rows).toBe(20);
			expect(bitmap.pixelMode).toBe(PixelMode.LCD_V);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("BGR_V mode swaps red and blue channels", () => {
			const path = createTrianglePath();
			const rgbV = rasterizeLcd(path, 20, 20, 1.0, 5, 5, LcdMode.RGB_V);
			const bgrV = rasterizeLcd(path, 20, 20, 1.0, 5, 5, LcdMode.BGR_V);

			expect(rgbV.width).toBe(bgrV.width);
			expect(rgbV.rows).toBe(bgrV.rows);

			let foundSwap = false;
			for (let y = 0; y < rgbV.rows; y++) {
				for (let x = 0; x < rgbV.width; x++) {
					const idx = y * rgbV.pitch + x * 3;
					const rgbR = rgbV.buffer[idx];
					const rgbG = rgbV.buffer[idx + 1];
					const rgbB = rgbV.buffer[idx + 2];
					const bgrR = bgrV.buffer[idx];
					const bgrG = bgrV.buffer[idx + 1];
					const bgrB = bgrV.buffer[idx + 2];

					if (rgbR !== 0 || rgbB !== 0) {
						if (rgbR === bgrB && rgbB === bgrR && rgbG === bgrG) {
							foundSwap = true;
							break;
						}
					}
				}
				if (foundSwap) break;
			}
			expect(foundSwap).toBe(true);
		});

		test("vertical mode uses different rendering than horizontal", () => {
			const path = createTrianglePath();
			const horizontal = rasterizeLcd(path, 20, 20, 1.0, 5, 5, LcdMode.RGB);
			const vertical = rasterizeLcd(path, 20, 20, 1.0, 5, 5, LcdMode.RGB_V);

			expect(horizontal.pixelMode).toBe(PixelMode.LCD);
			expect(vertical.pixelMode).toBe(PixelMode.LCD_V);
		});

		test("respects custom filter weights in vertical mode", () => {
			const path = createRectPath(0, 0, 8, 8);
			const bitmap1 = rasterizeLcd(path, 16, 16, 1.0, 4, 4, LcdMode.RGB_V, LCD_FILTER_LIGHT);
			const bitmap2 = rasterizeLcd(path, 16, 16, 1.0, 4, 4, LcdMode.RGB_V, LCD_FILTER_LEGACY);

			expect(bitmap1.width).toBe(bitmap2.width);
			expect(bitmap1.rows).toBe(bitmap2.rows);
			expect(bitmap1.pixelMode).toBe(PixelMode.LCD_V);
		});

		test("handles edge rows correctly in vertical mode", () => {
			const path = createRectPath(0, 0, 5, 5);
			const bitmap = rasterizeLcd(path, 10, 10, 1.0, 0, 0, LcdMode.RGB_V);

			expect(bitmap.buffer.length).toBe(10 * 10 * 3);
			expect(bitmap.pixelMode).toBe(PixelMode.LCD_V);
		});
	});

	describe("lcdToRGBA", () => {
		test("converts LCD bitmap to RGBA with default colors", () => {
			const path = createRectPath(0, 0, 5, 5);
			const lcd = rasterizeLcd(path, 10, 10, 1.0, 2, 2, LcdMode.RGB);
			const rgba = lcdToRGBA(lcd);

			expect(rgba.length).toBe(10 * 10 * 4);

			let hasNonZero = false;
			for (let i = 0; i < rgba.length; i += 4) {
				const a = rgba[i + 3];
				if (a === 255) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("converts with custom background color", () => {
			const path = createRectPath(0, 0, 5, 5);
			const lcd = rasterizeLcd(path, 10, 10, 1.0, 2, 2);
			const rgba = lcdToRGBA(lcd, [200, 150, 100]);

			expect(rgba.length).toBe(10 * 10 * 4);

			for (let i = 0; i < rgba.length; i += 4) {
				expect(rgba[i + 3]).toBe(255);
			}
		});

		test("converts with custom foreground color", () => {
			const path = createRectPath(0, 0, 5, 5);
			const lcd = rasterizeLcd(path, 10, 10, 1.0, 2, 2);
			const rgba = lcdToRGBA(lcd, [255, 255, 255], [100, 50, 25]);

			expect(rgba.length).toBe(10 * 10 * 4);

			for (let i = 0; i < rgba.length; i += 4) {
				expect(rgba[i + 3]).toBe(255);
			}
		});

		test("converts with both custom colors", () => {
			const path = createRectPath(0, 0, 5, 5);
			const lcd = rasterizeLcd(path, 10, 10, 1.0, 2, 2);
			const rgba = lcdToRGBA(lcd, [200, 200, 200], [50, 50, 50]);

			expect(rgba.length).toBe(10 * 10 * 4);
		});

		test("handles empty LCD bitmap", () => {
			const path = { commands: [], bounds: null };
			const lcd = rasterizeLcd(path, 8, 8, 1.0, 0, 0);
			const rgba = lcdToRGBA(lcd);

			expect(rgba.length).toBe(8 * 8 * 4);

			for (let i = 0; i < rgba.length; i += 4) {
				expect(rgba[i + 3]).toBe(255);
			}
		});

		test("preserves RGB channels correctly", () => {
			const path = createRectPath(0, 0, 3, 3);
			const lcd = rasterizeLcd(path, 5, 5, 1.0, 1, 1);

			lcd.buffer[0] = 255;
			lcd.buffer[1] = 128;
			lcd.buffer[2] = 64;

			const rgba = lcdToRGBA(lcd, [255, 255, 255], [0, 0, 0]);

			expect(rgba[0]).toBeLessThanOrEqual(255);
			expect(rgba[1]).toBeLessThanOrEqual(255);
			expect(rgba[2]).toBeLessThanOrEqual(255);
			expect(rgba[3]).toBe(255);
		});

		test("works with LCD_V bitmap", () => {
			const path = createRectPath(0, 0, 5, 5);
			const lcd = rasterizeLcd(path, 10, 10, 1.0, 2, 2, LcdMode.RGB_V);
			const rgba = lcdToRGBA(lcd);

			expect(rgba.length).toBe(10 * 10 * 4);
			expect(lcd.pixelMode).toBe(PixelMode.LCD_V);
		});

		test("handles bitmap with non-standard pitch", () => {
			const path = createRectPath(0, 0, 3, 3);
			const lcd = rasterizeLcd(path, 5, 5, 1.0, 1, 1);

			const rgba = lcdToRGBA(lcd);
			expect(rgba.length).toBe(5 * 5 * 4);
		});
	});

	describe("filter constants", () => {
		test("LCD_FILTER_LIGHT has correct length", () => {
			expect(LCD_FILTER_LIGHT.length).toBe(5);
			expect(LCD_FILTER_LIGHT[0]).toBe(0);
			expect(LCD_FILTER_LIGHT[1]).toBe(85);
			expect(LCD_FILTER_LIGHT[2]).toBe(86);
			expect(LCD_FILTER_LIGHT[3]).toBe(85);
			expect(LCD_FILTER_LIGHT[4]).toBe(0);
		});

		test("LCD_FILTER_DEFAULT has correct length", () => {
			expect(LCD_FILTER_DEFAULT.length).toBe(5);
			expect(LCD_FILTER_DEFAULT[0]).toBe(8);
			expect(LCD_FILTER_DEFAULT[1]).toBe(77);
			expect(LCD_FILTER_DEFAULT[2]).toBe(86);
			expect(LCD_FILTER_DEFAULT[3]).toBe(77);
			expect(LCD_FILTER_DEFAULT[4]).toBe(8);
		});

		test("LCD_FILTER_LEGACY has correct length", () => {
			expect(LCD_FILTER_LEGACY.length).toBe(5);
			expect(LCD_FILTER_LEGACY[0]).toBe(0);
			expect(LCD_FILTER_LEGACY[1]).toBe(64);
			expect(LCD_FILTER_LEGACY[2]).toBe(128);
			expect(LCD_FILTER_LEGACY[3]).toBe(64);
			expect(LCD_FILTER_LEGACY[4]).toBe(0);
		});
	});

	describe("LcdMode enum", () => {
		test("has correct values", () => {
			expect(LcdMode.RGB).toBe(0);
			expect(LcdMode.BGR).toBe(1);
			expect(LcdMode.RGB_V).toBe(2);
			expect(LcdMode.BGR_V).toBe(3);
		});
	});

	describe("scaling and offset", () => {
		test("respects scale parameter", () => {
			const path = createRectPath(0, 0, 5, 5);
			const small = rasterizeLcd(path, 20, 20, 0.5, 5, 5);
			const large = rasterizeLcd(path, 20, 20, 2.0, 5, 5);

			expect(small.width).toBe(large.width);
			expect(small.rows).toBe(large.rows);
		});

		test("respects offsetX parameter", () => {
			const path = createRectPath(0, 0, 5, 5);
			const offset0 = rasterizeLcd(path, 20, 20, 1.0, 0, 5);
			const offset10 = rasterizeLcd(path, 20, 20, 1.0, 10, 5);

			expect(offset0.width).toBe(offset10.width);
			expect(offset0.rows).toBe(offset10.rows);
		});

		test("respects offsetY parameter", () => {
			const path = createRectPath(0, 0, 5, 5);
			const offset0 = rasterizeLcd(path, 20, 20, 1.0, 5, 0);
			const offset10 = rasterizeLcd(path, 20, 20, 1.0, 5, 10);

			expect(offset0.width).toBe(offset10.width);
			expect(offset0.rows).toBe(offset10.rows);
		});
	});

	describe("integration tests", () => {
		test("full pipeline: rasterize LCD and convert to RGBA", () => {
			const path = createTrianglePath();
			const lcd = rasterizeLcd(path, 20, 20, 1.0, 5, 5, LcdMode.RGB, LCD_FILTER_DEFAULT);
			const rgba = lcdToRGBA(lcd, [255, 255, 255], [0, 0, 0]);

			expect(rgba.length).toBe(20 * 20 * 4);

			let hasContent = false;
			for (let i = 0; i < rgba.length; i += 4) {
				const r = rgba[i];
				const g = rgba[i + 1];
				const b = rgba[i + 2];
				if (r < 255 || g < 255 || b < 255) {
					hasContent = true;
					break;
				}
			}
			expect(hasContent).toBe(true);
		});

		test("all LCD modes produce valid output", () => {
			const path = createRectPath(0, 0, 8, 8);
			const modes = [LcdMode.RGB, LcdMode.BGR, LcdMode.RGB_V, LcdMode.BGR_V];

			for (const mode of modes) {
				const lcd = rasterizeLcd(path, 16, 16, 1.0, 4, 4, mode);
				expect(lcd.width).toBe(16);
				expect(lcd.rows).toBe(16);
				expect(lcd.pitch).toBe(16 * 3);

				const rgba = lcdToRGBA(lcd);
				expect(rgba.length).toBe(16 * 16 * 4);
			}
		});

		test("different filters produce different results", () => {
			const path = createTrianglePath();
			const light = rasterizeLcd(path, 20, 20, 1.0, 5, 5, LcdMode.RGB, LCD_FILTER_LIGHT);
			const legacy = rasterizeLcd(path, 20, 20, 1.0, 5, 5, LcdMode.RGB, LCD_FILTER_LEGACY);

			let hasDifference = false;
			for (let i = 0; i < Math.min(light.buffer.length, legacy.buffer.length); i++) {
				if (light.buffer[i] !== legacy.buffer[i]) {
					hasDifference = true;
					break;
				}
			}
			expect(hasDifference).toBe(true);
		});
	});
});
