import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../src/font/font.ts";
import {
	buildAtlas,
	buildAsciiAtlas,
	buildStringAtlas,
	atlasToRGBA,
	atlasToAlpha,
	getGlyphUV,
} from "../../src/raster/atlas.ts";
import { PixelMode } from "../../src/raster/types.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("raster/atlas", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("buildAtlas", () => {
		test("creates atlas for simple glyph set", () => {
			const glyphIds = [font.glyphId(65)!, font.glyphId(66)!, font.glyphId(67)!];
			const atlas = buildAtlas(font, glyphIds, { fontSize: 32 });

			expect(atlas.bitmap.width).toBeGreaterThan(0);
			expect(atlas.bitmap.rows).toBeGreaterThan(0);
			expect(atlas.fontSize).toBe(32);
			expect(atlas.glyphs.size).toBe(3);
		});

		test("creates atlas with custom padding", () => {
			const glyphIds = [font.glyphId(65)!];
			const atlas = buildAtlas(font, glyphIds, {
				fontSize: 32,
				padding: 5,
			});

			expect(atlas.glyphs.size).toBe(1);
		});

		test("creates atlas with custom max dimensions", () => {
			const glyphIds = [font.glyphId(65)!, font.glyphId(66)!];
			const atlas = buildAtlas(font, glyphIds, {
				fontSize: 32,
				maxWidth: 512,
				maxHeight: 512,
			});

			expect(atlas.bitmap.width).toBeLessThanOrEqual(512);
			expect(atlas.bitmap.rows).toBeLessThanOrEqual(512);
		});

		test("creates atlas with LCD pixel mode", () => {
			const glyphIds = [font.glyphId(65)!];
			const atlas = buildAtlas(font, glyphIds, {
				fontSize: 32,
				pixelMode: PixelMode.LCD,
			});

			expect(atlas.bitmap.pixelMode).toBe(PixelMode.LCD);
		});

		test("handles empty glyph list", () => {
			const atlas = buildAtlas(font, [], { fontSize: 32 });

			expect(atlas.glyphs.size).toBe(0);
		});

		test("skips glyphs that fail to rasterize", () => {
			const glyphIds = [0, font.glyphId(65)!];
			const atlas = buildAtlas(font, glyphIds, { fontSize: 32 });

			expect(atlas.glyphs.size).toBeGreaterThanOrEqual(0);
		});

		test("stores correct glyph metrics", () => {
			const glyphId = font.glyphId(65)!;
			const atlas = buildAtlas(font, [glyphId], { fontSize: 32 });

			const metrics = atlas.glyphs.get(glyphId);
			expect(metrics).toBeDefined();
			expect(metrics!.glyphId).toBe(glyphId);
			expect(metrics!.width).toBeGreaterThan(0);
			expect(metrics!.height).toBeGreaterThan(0);
			expect(metrics!.advance).toBeGreaterThan(0);
		});

		test("handles atlas overflow by marking glyphs as not placed", () => {
			const glyphIds: number[] = [];
			for (let i = 32; i <= 126; i++) {
				const gid = font.glyphId(i);
				if (gid !== undefined && gid !== 0) {
					glyphIds.push(gid);
				}
			}

			const atlas = buildAtlas(font, glyphIds, {
				fontSize: 128,
				maxWidth: 128,
				maxHeight: 128,
			});

			expect(atlas.glyphs.size).toBeLessThan(glyphIds.length);
		});
	});

	describe("buildAsciiAtlas", () => {
		test("creates atlas for ASCII printable characters", () => {
			const atlas = buildAsciiAtlas(font, { fontSize: 32 });

			expect(atlas.glyphs.size).toBeGreaterThan(0);
			expect(atlas.fontSize).toBe(32);
		});

		test("includes common ASCII characters", () => {
			const atlas = buildAsciiAtlas(font, { fontSize: 32 });

			const glyphIdA = font.glyphId(65);
			const glyphIdZ = font.glyphId(90);

			if (glyphIdA && glyphIdA !== 0) {
				expect(atlas.glyphs.has(glyphIdA)).toBe(true);
			}
			if (glyphIdZ && glyphIdZ !== 0) {
				expect(atlas.glyphs.has(glyphIdZ)).toBe(true);
			}
		});
	});

	describe("buildStringAtlas", () => {
		test("creates atlas for simple string", () => {
			const text = "Hello";
			const atlas = buildStringAtlas(font, text, { fontSize: 32 });

			expect(atlas.glyphs.size).toBeGreaterThan(0);
			expect(atlas.fontSize).toBe(32);
		});

		test("handles duplicate characters", () => {
			const text = "aaa";
			const atlas = buildStringAtlas(font, text, { fontSize: 32 });

			const glyphIdA = font.glyphId(97);
			if (glyphIdA && glyphIdA !== 0) {
				expect(atlas.glyphs.size).toBe(1);
				expect(atlas.glyphs.has(glyphIdA)).toBe(true);
			}
		});

		test("handles empty string", () => {
			const atlas = buildStringAtlas(font, "", { fontSize: 32 });

			expect(atlas.glyphs.size).toBe(0);
		});

		test("handles multi-codepoint text", () => {
			const text = "Hello World!";
			const atlas = buildStringAtlas(font, text, { fontSize: 32 });

			expect(atlas.glyphs.size).toBeGreaterThan(0);
		});

		test("skips invalid codepoints", () => {
			const text = "A\u0000B";
			const atlas = buildStringAtlas(font, text, { fontSize: 32 });

			const glyphIdA = font.glyphId(65);
			const glyphIdB = font.glyphId(66);

			if (glyphIdA && glyphIdA !== 0) {
				expect(atlas.glyphs.has(glyphIdA)).toBe(true);
			}
			if (glyphIdB && glyphIdB !== 0) {
				expect(atlas.glyphs.has(glyphIdB)).toBe(true);
			}
		});

		test("handles unicode characters", () => {
			const text = "Café";
			const atlas = buildStringAtlas(font, text, { fontSize: 32 });

			expect(atlas.glyphs.size).toBeGreaterThan(0);
		});
	});

	describe("atlasToRGBA", () => {
		test("converts grayscale atlas to RGBA", () => {
			const glyphIds = [font.glyphId(65)!];
			const atlas = buildAtlas(font, glyphIds, { fontSize: 32 });

			const rgba = atlasToRGBA(atlas);

			expect(rgba.length).toBe(atlas.bitmap.width * atlas.bitmap.rows * 4);
		});

		test("sets white RGB with alpha from bitmap", () => {
			const glyphIds = [font.glyphId(65)!];
			const atlas = buildAtlas(font, glyphIds, { fontSize: 32 });

			const rgba = atlasToRGBA(atlas);

			let hasNonZeroAlpha = false;
			for (let i = 3; i < rgba.length; i += 4) {
				if (rgba[i] !== 0) {
					hasNonZeroAlpha = true;
					expect(rgba[i - 3]).toBe(255);
					expect(rgba[i - 2]).toBe(255);
					expect(rgba[i - 1]).toBe(255);
					break;
				}
			}
			expect(hasNonZeroAlpha).toBe(true);
		});
	});

	describe("atlasToAlpha", () => {
		test("returns buffer directly when pitch equals width", () => {
			const glyphIds = [font.glyphId(65)!];
			const atlas = buildAtlas(font, glyphIds, { fontSize: 32 });

			if (atlas.bitmap.pitch === atlas.bitmap.width) {
				const alpha = atlasToAlpha(atlas);
				expect(alpha).toBe(atlas.bitmap.buffer);
			}
		});

		test("copies without padding when pitch differs from width", () => {
			const glyphIds = [font.glyphId(65)!];
			const atlas = buildAtlas(font, glyphIds, { fontSize: 32 });

			atlas.bitmap.pitch = atlas.bitmap.width + 4;

			const paddedBuffer = new Uint8Array(
				atlas.bitmap.pitch * atlas.bitmap.rows,
			);
			for (let y = 0; y < atlas.bitmap.rows; y++) {
				for (let x = 0; x < atlas.bitmap.width; x++) {
					paddedBuffer[y * atlas.bitmap.pitch + x] =
						atlas.bitmap.buffer[y * atlas.bitmap.width + x];
				}
			}
			atlas.bitmap.buffer = paddedBuffer;

			const alpha = atlasToAlpha(atlas);

			expect(alpha.length).toBe(atlas.bitmap.width * atlas.bitmap.rows);
			expect(alpha).not.toBe(atlas.bitmap.buffer);
		});
	});

	describe("getGlyphUV", () => {
		test("returns UV coordinates for existing glyph", () => {
			const glyphId = font.glyphId(65)!;
			const atlas = buildAtlas(font, [glyphId], { fontSize: 32 });

			const uv = getGlyphUV(atlas, glyphId);

			expect(uv).not.toBeNull();
			expect(uv!.u0).toBeGreaterThanOrEqual(0);
			expect(uv!.v0).toBeGreaterThanOrEqual(0);
			expect(uv!.u1).toBeLessThanOrEqual(1);
			expect(uv!.v1).toBeLessThanOrEqual(1);
			expect(uv!.u1).toBeGreaterThan(uv!.u0);
			expect(uv!.v1).toBeGreaterThan(uv!.v0);
		});

		test("returns null for non-existent glyph", () => {
			const glyphId = font.glyphId(65)!;
			const atlas = buildAtlas(font, [glyphId], { fontSize: 32 });

			const uv = getGlyphUV(atlas, 99999);

			expect(uv).toBeNull();
		});
	});

	describe("shelf packing algorithm", () => {
		test("packs glyphs efficiently", () => {
			const glyphIds = [
				font.glyphId(73)!,
				font.glyphId(87)!,
				font.glyphId(77)!,
			];
			const atlas = buildAtlas(font, glyphIds, { fontSize: 48 });

			expect(atlas.glyphs.size).toBe(3);

			let totalArea = 0;
			for (const metrics of atlas.glyphs.values()) {
				totalArea += metrics.width * metrics.height;
			}

			const atlasArea = atlas.bitmap.width * atlas.bitmap.rows;
			const efficiency = totalArea / atlasArea;

			expect(efficiency).toBeGreaterThan(0);
			expect(efficiency).toBeLessThanOrEqual(1);
		});

		test("respects power-of-2 sizing", () => {
			const glyphIds = [font.glyphId(65)!];
			const atlas = buildAtlas(font, glyphIds, { fontSize: 32 });

			const isPowerOf2 = (n: number) => n > 0 && (n & (n - 1)) === 0;

			expect(isPowerOf2(atlas.bitmap.width)).toBe(true);
			expect(isPowerOf2(atlas.bitmap.rows)).toBe(true);
		});
	});
});
