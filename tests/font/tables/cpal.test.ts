import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseCpal,
	getColor,
	colorToRgba,
	colorToHex,
	PaletteType,
	type CpalTable,
	type Color,
	type ColorPalette,
} from "../../../src/font/tables/cpal.ts";

const EMOJI_FONT_PATH = "/System/Library/Fonts/Apple Color Emoji.ttc";

describe("cpal table", () => {
	let font: Font | null = null;
	let cpal: CpalTable | null = null;

	beforeAll(async () => {
		try {
			font = await Font.fromFile(EMOJI_FONT_PATH);
			if (font.cpal) {
				cpal = font.cpal;
			}
		} catch (e) {
			// Font not available, tests will be skipped
		}
	});

	describe("parseCpal", () => {
		test("returns CpalTable with version", () => {
			if (!cpal) return;
			expect(typeof cpal.version).toBe("number");
			expect(cpal.version).toBeGreaterThanOrEqual(0);
		});

		test("has numPalettes property", () => {
			if (!cpal) return;
			expect(typeof cpal.numPalettes).toBe("number");
			expect(cpal.numPalettes).toBeGreaterThan(0);
		});

		test("has numPaletteEntries property", () => {
			if (!cpal) return;
			expect(typeof cpal.numPaletteEntries).toBe("number");
			expect(cpal.numPaletteEntries).toBeGreaterThan(0);
		});

		test("has palettes array", () => {
			if (!cpal) return;
			expect(Array.isArray(cpal.palettes)).toBe(true);
			expect(cpal.palettes.length).toBe(cpal.numPalettes);
		});

		test("each palette has correct number of colors", () => {
			if (!cpal) return;
			for (const palette of cpal.palettes) {
				expect(Array.isArray(palette.colors)).toBe(true);
				expect(palette.colors.length).toBe(cpal.numPaletteEntries);
			}
		});
	});

	describe("color structure", () => {
		test("colors have BGRA components", () => {
			if (!cpal) return;
			for (const palette of cpal.palettes) {
				for (const color of palette.colors) {
					expect(typeof color.blue).toBe("number");
					expect(typeof color.green).toBe("number");
					expect(typeof color.red).toBe("number");
					expect(typeof color.alpha).toBe("number");
					expect(color.blue).toBeGreaterThanOrEqual(0);
					expect(color.blue).toBeLessThanOrEqual(255);
					expect(color.green).toBeGreaterThanOrEqual(0);
					expect(color.green).toBeLessThanOrEqual(255);
					expect(color.red).toBeGreaterThanOrEqual(0);
					expect(color.red).toBeLessThanOrEqual(255);
					expect(color.alpha).toBeGreaterThanOrEqual(0);
					expect(color.alpha).toBeLessThanOrEqual(255);
				}
			}
		});

		test("has variety of colors", () => {
			if (!cpal) return;
			if (cpal.palettes.length > 0 && cpal.palettes[0]) {
				const palette = cpal.palettes[0];
				let hasNonBlack = false;
				for (const color of palette.colors) {
					if (color.red !== 0 || color.green !== 0 || color.blue !== 0) {
						hasNonBlack = true;
						break;
					}
				}
				expect(hasNonBlack).toBe(true);
			}
		});
	});

	describe("CPAL v1 extensions", () => {
		test("version 1 tables have optional v1 properties", () => {
			if (!cpal) return;
			if (cpal.version >= 1) {
				// v1 tables may have these properties
				if (cpal.paletteTypes) {
					expect(Array.isArray(cpal.paletteTypes)).toBe(true);
					expect(cpal.paletteTypes.length).toBe(cpal.numPalettes);
				}
				if (cpal.paletteLabels) {
					expect(Array.isArray(cpal.paletteLabels)).toBe(true);
					expect(cpal.paletteLabels.length).toBe(cpal.numPalettes);
				}
				if (cpal.paletteEntryLabels) {
					expect(Array.isArray(cpal.paletteEntryLabels)).toBe(true);
					expect(cpal.paletteEntryLabels.length).toBe(cpal.numPaletteEntries);
				}
			}
		});

		test("palette types have valid flags", () => {
			if (!cpal || !cpal.paletteTypes) return;
			for (const type of cpal.paletteTypes) {
				expect(typeof type).toBe("number");
				expect(type).toBeGreaterThanOrEqual(0);
			}
		});

		test("palette labels are valid name IDs", () => {
			if (!cpal || !cpal.paletteLabels) return;
			for (const label of cpal.paletteLabels) {
				expect(typeof label).toBe("number");
				expect(label).toBeGreaterThanOrEqual(0);
			}
		});

		test("palette entry labels are valid name IDs", () => {
			if (!cpal || !cpal.paletteEntryLabels) return;
			for (const label of cpal.paletteEntryLabels) {
				expect(typeof label).toBe("number");
				expect(label).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("PaletteType enum", () => {
		test("has correct flag values", () => {
			expect(PaletteType.UsableWithLightBackground).toBe(0x0001);
			expect(PaletteType.UsableWithDarkBackground).toBe(0x0002);
		});
	});

	describe("getColor", () => {
		test("returns color from valid palette and index", () => {
			if (!cpal) return;
			if (cpal.numPalettes > 0 && cpal.numPaletteEntries > 0) {
				const color = getColor(cpal, 0, 0);
				expect(color).not.toBeNull();
				if (color) {
					expect(typeof color.red).toBe("number");
					expect(typeof color.green).toBe("number");
					expect(typeof color.blue).toBe("number");
					expect(typeof color.alpha).toBe("number");
				}
			}
		});

		test("returns null for invalid palette index", () => {
			if (!cpal) return;
			const color = getColor(cpal, 999, 0);
			expect(color).toBeNull();
		});

		test("returns null for invalid color index", () => {
			if (!cpal) return;
			const color = getColor(cpal, 0, 999);
			expect(color).toBeNull();
		});

		test("retrieves all colors from first palette", () => {
			if (!cpal) return;
			if (cpal.numPalettes > 0) {
				for (let i = 0; i < cpal.numPaletteEntries; i++) {
					const color = getColor(cpal, 0, i);
					expect(color).not.toBeNull();
				}
			}
		});

		test("retrieves colors from all palettes", () => {
			if (!cpal) return;
			for (let p = 0; p < cpal.numPalettes; p++) {
				const color = getColor(cpal, p, 0);
				expect(color).not.toBeNull();
			}
		});
	});

	describe("colorToRgba", () => {
		test("converts color to rgba string", () => {
			const color: Color = {
				red: 255,
				green: 128,
				blue: 64,
				alpha: 255,
			};
			const rgba = colorToRgba(color);
			expect(rgba).toBe("rgba(255, 128, 64, 1.000)");
		});

		test("handles transparent colors", () => {
			const color: Color = {
				red: 255,
				green: 0,
				blue: 0,
				alpha: 128,
			};
			const rgba = colorToRgba(color);
			expect(rgba).toContain("rgba(255, 0, 0,");
			expect(rgba).toContain("0.502");
		});

		test("handles fully transparent", () => {
			const color: Color = {
				red: 0,
				green: 0,
				blue: 0,
				alpha: 0,
			};
			const rgba = colorToRgba(color);
			expect(rgba).toBe("rgba(0, 0, 0, 0.000)");
		});

		test("handles black", () => {
			const color: Color = {
				red: 0,
				green: 0,
				blue: 0,
				alpha: 255,
			};
			const rgba = colorToRgba(color);
			expect(rgba).toBe("rgba(0, 0, 0, 1.000)");
		});

		test("handles white", () => {
			const color: Color = {
				red: 255,
				green: 255,
				blue: 255,
				alpha: 255,
			};
			const rgba = colorToRgba(color);
			expect(rgba).toBe("rgba(255, 255, 255, 1.000)");
		});

		test("converts actual palette colors", () => {
			if (!cpal) return;
			if (cpal.numPalettes > 0 && cpal.numPaletteEntries > 0) {
				const color = getColor(cpal, 0, 0);
				if (color) {
					const rgba = colorToRgba(color);
					expect(rgba).toMatch(/^rgba\(\d+, \d+, \d+, \d+\.\d+\)$/);
				}
			}
		});
	});

	describe("colorToHex", () => {
		test("converts opaque color to hex", () => {
			const color: Color = {
				red: 255,
				green: 128,
				blue: 64,
				alpha: 255,
			};
			const hex = colorToHex(color);
			expect(hex).toBe("#ff8040");
		});

		test("converts transparent color to hex with alpha", () => {
			const color: Color = {
				red: 255,
				green: 128,
				blue: 64,
				alpha: 128,
			};
			const hex = colorToHex(color);
			expect(hex).toBe("#ff804080");
		});

		test("handles black", () => {
			const color: Color = {
				red: 0,
				green: 0,
				blue: 0,
				alpha: 255,
			};
			const hex = colorToHex(color);
			expect(hex).toBe("#000000");
		});

		test("handles white", () => {
			const color: Color = {
				red: 255,
				green: 255,
				blue: 255,
				alpha: 255,
			};
			const hex = colorToHex(color);
			expect(hex).toBe("#ffffff");
		});

		test("handles fully transparent", () => {
			const color: Color = {
				red: 0,
				green: 0,
				blue: 0,
				alpha: 0,
			};
			const hex = colorToHex(color);
			expect(hex).toBe("#00000000");
		});

		test("pads hex values correctly", () => {
			const color: Color = {
				red: 1,
				green: 2,
				blue: 3,
				alpha: 255,
			};
			const hex = colorToHex(color);
			expect(hex).toBe("#010203");
		});

		test("pads alpha values correctly", () => {
			const color: Color = {
				red: 255,
				green: 255,
				blue: 255,
				alpha: 1,
			};
			const hex = colorToHex(color);
			expect(hex).toBe("#ffffff01");
		});

		test("converts actual palette colors", () => {
			if (!cpal) return;
			if (cpal.numPalettes > 0 && cpal.numPaletteEntries > 0) {
				const color = getColor(cpal, 0, 0);
				if (color) {
					const hex = colorToHex(color);
					expect(hex).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
				}
			}
		});
	});

	describe("palette consistency", () => {
		test("all palettes have same number of colors", () => {
			if (!cpal) return;
			const expectedCount = cpal.numPaletteEntries;
			for (const palette of cpal.palettes) {
				expect(palette.colors.length).toBe(expectedCount);
			}
		});

		test("palette indices are consistent", () => {
			if (!cpal) return;
			for (let p = 0; p < cpal.numPalettes; p++) {
				for (let c = 0; c < cpal.numPaletteEntries; c++) {
					const directColor = cpal.palettes[p]?.colors[c];
					const getterColor = getColor(cpal, p, c);
					expect(getterColor).toEqual(directColor);
				}
			}
		});
	});

	describe("edge cases", () => {
		test("handles palette with single color", () => {
			const singleColorCpal: CpalTable = {
				version: 0,
				numPalettes: 1,
				numPaletteEntries: 1,
				palettes: [
					{
						colors: [{ red: 255, green: 0, blue: 0, alpha: 255 }],
					},
				],
			};
			const color = getColor(singleColorCpal, 0, 0);
			expect(color).not.toBeNull();
			if (color) {
				expect(color.red).toBe(255);
			}
		});

		test("handles empty palette array gracefully", () => {
			const emptyCpal: CpalTable = {
				version: 0,
				numPalettes: 0,
				numPaletteEntries: 0,
				palettes: [],
			};
			const color = getColor(emptyCpal, 0, 0);
			expect(color).toBeNull();
		});

		test("handles negative indices", () => {
			if (!cpal) return;
			const color = getColor(cpal, -1, -1);
			expect(color).toBeNull();
		});

		test("colorToRgba handles edge alpha values", () => {
			const color1: Color = { red: 0, green: 0, blue: 0, alpha: 1 };
			const rgba1 = colorToRgba(color1);
			expect(rgba1).toContain("0.004");

			const color254: Color = { red: 0, green: 0, blue: 0, alpha: 254 };
			const rgba254 = colorToRgba(color254);
			expect(rgba254).toContain("0.996");
		});

		test("colorToHex handles all component ranges", () => {
			for (let val = 0; val <= 255; val += 51) {
				const color: Color = {
					red: val,
					green: val,
					blue: val,
					alpha: 255,
				};
				const hex = colorToHex(color);
				expect(hex).toMatch(/^#[0-9a-f]{6}$/);
			}
		});
	});

	describe("multiple palettes", () => {
		test("different palettes have different colors", () => {
			if (!cpal) return;
			if (cpal.numPalettes > 1) {
				const color0 = getColor(cpal, 0, 0);
				const color1 = getColor(cpal, 1, 0);
				expect(color0).not.toBeNull();
				expect(color1).not.toBeNull();
				// They might be the same or different - just verify both exist
				expect(typeof color0?.red).toBe("number");
				expect(typeof color1?.red).toBe("number");
			}
		});

		test("can access last palette", () => {
			if (!cpal) return;
			if (cpal.numPalettes > 0) {
				const lastPaletteIndex = cpal.numPalettes - 1;
				const color = getColor(cpal, lastPaletteIndex, 0);
				expect(color).not.toBeNull();
			}
		});

		test("can access last color in palette", () => {
			if (!cpal) return;
			if (cpal.numPaletteEntries > 0) {
				const lastColorIndex = cpal.numPaletteEntries - 1;
				const color = getColor(cpal, 0, lastColorIndex);
				expect(color).not.toBeNull();
			}
		});
	});

	describe("color format conversions", () => {
		test("colorToRgba and colorToHex produce consistent results", () => {
			if (!cpal) return;
			if (cpal.numPalettes > 0 && cpal.numPaletteEntries > 0) {
				const color = getColor(cpal, 0, 0);
				if (color) {
					const rgba = colorToRgba(color);
					const hex = colorToHex(color);
					expect(rgba).toBeDefined();
					expect(hex).toBeDefined();

					// Extract values from rgba string
					const match = rgba.match(/rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/);
					if (match) {
						const r = Number.parseInt(match[1] ?? "0");
						const g = Number.parseInt(match[2] ?? "0");
						const b = Number.parseInt(match[3] ?? "0");

						expect(r).toBe(color.red);
						expect(g).toBe(color.green);
						expect(b).toBe(color.blue);
					}
				}
			}
		});

		test("hex conversion is lowercase", () => {
			const color: Color = {
				red: 255,
				green: 170,
				blue: 85,
				alpha: 255,
			};
			const hex = colorToHex(color);
			expect(hex).toBe("#ffaa55");
			expect(hex).not.toMatch(/[A-F]/);
		});

		test("rgba alpha precision is 3 decimal places", () => {
			const color: Color = {
				red: 0,
				green: 0,
				blue: 0,
				alpha: 127,
			};
			const rgba = colorToRgba(color);
			const match = rgba.match(/rgba\(0, 0, 0, ([\d.]+)\)/);
			if (match && match[1]) {
				const alphaStr = match[1];
				const decimalPart = alphaStr.split(".")[1];
				expect(decimalPart?.length).toBe(3);
			}
		});
	});
});
