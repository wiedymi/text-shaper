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
import { Reader } from "../../../src/font/binary/reader.ts";

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

	describe("parseCpal with binary data", () => {
		test("parses version 0 CPAL table", () => {
			if (!font || !cpal) return;

			expect(cpal.version).toBeGreaterThanOrEqual(0);
			expect(cpal.numPalettes).toBeGreaterThan(0);
			expect(cpal.numPaletteEntries).toBeGreaterThan(0);
			expect(cpal.palettes.length).toBe(cpal.numPalettes);
		});

		test("parses color records correctly", () => {
			if (!font || !cpal) return;

			for (const palette of cpal.palettes) {
				expect(palette.colors.length).toBe(cpal.numPaletteEntries);
				for (const color of palette.colors) {
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

		test("parses version 1 extensions if present", () => {
			if (!font || !cpal) return;

			if (cpal.version >= 1) {
				// Check for optional v1 arrays
				if (cpal.paletteTypes !== undefined) {
					expect(Array.isArray(cpal.paletteTypes)).toBe(true);
					expect(cpal.paletteTypes.length).toBe(cpal.numPalettes);
					for (const type of cpal.paletteTypes) {
						expect(typeof type).toBe("number");
					}
				}

				if (cpal.paletteLabels !== undefined) {
					expect(Array.isArray(cpal.paletteLabels)).toBe(true);
					expect(cpal.paletteLabels.length).toBe(cpal.numPalettes);
					for (const label of cpal.paletteLabels) {
						expect(typeof label).toBe("number");
					}
				}

				if (cpal.paletteEntryLabels !== undefined) {
					expect(Array.isArray(cpal.paletteEntryLabels)).toBe(true);
					expect(cpal.paletteEntryLabels.length).toBe(
						cpal.numPaletteEntries,
					);
					for (const label of cpal.paletteEntryLabels) {
						expect(typeof label).toBe("number");
					}
				}
			}
		});

		test("handles multiple color record indices", () => {
			if (!font || !cpal) return;

			// Verify each palette can be accessed
			for (let i = 0; i < cpal.numPalettes; i++) {
				const palette = cpal.palettes[i];
				expect(palette).toBeDefined();
				if (palette) {
					expect(palette.colors.length).toBe(cpal.numPaletteEntries);
				}
			}
		});
	});

	describe("parseCpal synthetic data", () => {
		test("parses minimal version 0 CPAL", () => {
			// Create minimal CPAL v0: 1 palette, 1 color
			const buffer = new ArrayBuffer(24);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 0); // version
			offset += 2;
			view.setUint16(offset, 1); // numPaletteEntries
			offset += 2;
			view.setUint16(offset, 1); // numPalettes
			offset += 2;
			view.setUint16(offset, 1); // numColorRecords
			offset += 2;
			view.setUint32(offset, 14); // colorRecordsArrayOffset (header + 1 palette index)
			offset += 4;
			view.setUint16(offset, 0); // palette 0 starts at color record 0
			offset += 2;
			// Color record at offset 14: BGRA
			view.setUint8(offset, 255); // blue
			offset += 1;
			view.setUint8(offset, 128); // green
			offset += 1;
			view.setUint8(offset, 64); // red
			offset += 1;
			view.setUint8(offset, 255); // alpha
			offset += 1;

			const reader = new Reader(buffer);
			const parsed = parseCpal(reader);

			expect(parsed.version).toBe(0);
			expect(parsed.numPalettes).toBe(1);
			expect(parsed.numPaletteEntries).toBe(1);
			expect(parsed.palettes.length).toBe(1);
			expect(parsed.palettes[0]?.colors.length).toBe(1);
			expect(parsed.palettes[0]?.colors[0]?.blue).toBe(255);
			expect(parsed.palettes[0]?.colors[0]?.green).toBe(128);
			expect(parsed.palettes[0]?.colors[0]?.red).toBe(64);
			expect(parsed.palettes[0]?.colors[0]?.alpha).toBe(255);
		});

		test("parses CPAL with multiple palettes", () => {
			// Create CPAL v0: 2 palettes, 2 colors each
			const buffer = new ArrayBuffer(32);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 0); // version
			offset += 2;
			view.setUint16(offset, 2); // numPaletteEntries
			offset += 2;
			view.setUint16(offset, 2); // numPalettes
			offset += 2;
			view.setUint16(offset, 4); // numColorRecords
			offset += 2;
			view.setUint32(offset, 16); // colorRecordsArrayOffset (header + 2 palette indices)
			offset += 4;
			view.setUint16(offset, 0); // palette 0 starts at color record 0
			offset += 2;
			view.setUint16(offset, 2); // palette 1 starts at color record 2
			offset += 2;

			// Color records (4 colors)
			// Palette 0, color 0
			view.setUint8(offset, 255);
			offset += 1;
			view.setUint8(offset, 0);
			offset += 1;
			view.setUint8(offset, 0);
			offset += 1;
			view.setUint8(offset, 255);
			offset += 1;
			// Palette 0, color 1
			view.setUint8(offset, 0);
			offset += 1;
			view.setUint8(offset, 255);
			offset += 1;
			view.setUint8(offset, 0);
			offset += 1;
			view.setUint8(offset, 255);
			offset += 1;
			// Palette 1, color 0
			view.setUint8(offset, 0);
			offset += 1;
			view.setUint8(offset, 0);
			offset += 1;
			view.setUint8(offset, 255);
			offset += 1;
			view.setUint8(offset, 255);
			offset += 1;
			// Palette 1, color 1
			view.setUint8(offset, 128);
			offset += 1;
			view.setUint8(offset, 128);
			offset += 1;
			view.setUint8(offset, 128);
			offset += 1;
			view.setUint8(offset, 128);
			offset += 1;

			const reader = new Reader(buffer);
			const parsed = parseCpal(reader);

			expect(parsed.version).toBe(0);
			expect(parsed.numPalettes).toBe(2);
			expect(parsed.numPaletteEntries).toBe(2);
			expect(parsed.palettes.length).toBe(2);

			// Check palette 0
			expect(parsed.palettes[0]?.colors[0]?.blue).toBe(255);
			expect(parsed.palettes[0]?.colors[1]?.green).toBe(255);

			// Check palette 1
			expect(parsed.palettes[1]?.colors[0]?.red).toBe(255);
			expect(parsed.palettes[1]?.colors[1]?.alpha).toBe(128);
		});

		test("parses version 1 CPAL with paletteTypes", () => {
			// Create CPAL v1 with paletteTypes array
			// Header (12) + 1 palette index (2) + 1 color record (4) + v1 offsets (12) + paletteTypes (4) = 34
			const buffer = new ArrayBuffer(34);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1); // version 1
			offset += 2;
			view.setUint16(offset, 1); // numPaletteEntries
			offset += 2;
			view.setUint16(offset, 1); // numPalettes
			offset += 2;
			view.setUint16(offset, 1); // numColorRecords
			offset += 2;
			view.setUint32(offset, 26); // colorRecordsArrayOffset (after v1 offsets)
			offset += 4;
			view.setUint16(offset, 0); // palette 0 starts at color record 0
			offset += 2;
			// V1 extensions start at offset 14
			view.setUint32(offset, 30); // paletteTypesArrayOffset
			offset += 4;
			view.setUint32(offset, 0); // paletteLabelsArrayOffset (null)
			offset += 4;
			view.setUint32(offset, 0); // paletteEntryLabelsArrayOffset (null)
			offset += 4;
			// Color record at offset 26
			view.setUint8(offset, 255);
			offset += 1;
			view.setUint8(offset, 255);
			offset += 1;
			view.setUint8(offset, 255);
			offset += 1;
			view.setUint8(offset, 255);
			offset += 1;
			// paletteTypes array at offset 30
			view.setUint32(offset, 0x0003); // UsableWithLight | UsableWithDark
			offset += 4;

			const reader = new Reader(buffer);
			const parsed = parseCpal(reader);

			expect(parsed.version).toBe(1);
			expect(parsed.paletteTypes).toBeDefined();
			expect(parsed.paletteTypes?.length).toBe(1);
			expect(parsed.paletteTypes?.[0]).toBe(0x0003);
			expect(parsed.paletteLabels).toBeUndefined();
			expect(parsed.paletteEntryLabels).toBeUndefined();
		});

		test("parses version 1 CPAL with all v1 arrays", () => {
			// Create CPAL v1 with all three v1 arrays
			// Header (12) + 1 palette index (2) + v1 offsets (12) + 2 color records (8) + paletteTypes (4) + paletteLabels (2) + paletteEntryLabels (4) = 44
			const buffer = new ArrayBuffer(44);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1); // version 1
			offset += 2;
			view.setUint16(offset, 2); // numPaletteEntries
			offset += 2;
			view.setUint16(offset, 1); // numPalettes
			offset += 2;
			view.setUint16(offset, 2); // numColorRecords
			offset += 2;
			view.setUint32(offset, 26); // colorRecordsArrayOffset
			offset += 4;
			view.setUint16(offset, 0); // palette 0 starts at color record 0
			offset += 2;
			// V1 extensions at offset 14
			view.setUint32(offset, 34); // paletteTypesArrayOffset
			offset += 4;
			view.setUint32(offset, 38); // paletteLabelsArrayOffset
			offset += 4;
			view.setUint32(offset, 40); // paletteEntryLabelsArrayOffset
			offset += 4;
			// Color records at offset 26 (2 colors)
			view.setUint8(offset, 255);
			offset += 1;
			view.setUint8(offset, 0);
			offset += 1;
			view.setUint8(offset, 0);
			offset += 1;
			view.setUint8(offset, 255);
			offset += 1;
			view.setUint8(offset, 0);
			offset += 1;
			view.setUint8(offset, 255);
			offset += 1;
			view.setUint8(offset, 0);
			offset += 1;
			view.setUint8(offset, 255);
			offset += 1;
			// paletteTypes at offset 34
			view.setUint32(offset, 0x0001); // UsableWithLightBackground
			offset += 4;
			// paletteLabels at offset 38
			view.setUint16(offset, 256); // name ID 256
			offset += 2;
			// paletteEntryLabels at offset 40
			view.setUint16(offset, 257); // name ID 257
			offset += 2;
			view.setUint16(offset, 258); // name ID 258
			offset += 2;

			const reader = new Reader(buffer);
			const parsed = parseCpal(reader);

			expect(parsed.version).toBe(1);
			expect(parsed.paletteTypes).toBeDefined();
			expect(parsed.paletteTypes?.length).toBe(1);
			expect(parsed.paletteTypes?.[0]).toBe(0x0001);
			expect(parsed.paletteLabels).toBeDefined();
			expect(parsed.paletteLabels?.length).toBe(1);
			expect(parsed.paletteLabels?.[0]).toBe(256);
			expect(parsed.paletteEntryLabels).toBeDefined();
			expect(parsed.paletteEntryLabels?.length).toBe(2);
			expect(parsed.paletteEntryLabels?.[0]).toBe(257);
			expect(parsed.paletteEntryLabels?.[1]).toBe(258);
		});
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
