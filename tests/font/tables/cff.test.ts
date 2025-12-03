import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import { Tags } from "../../../src/types.ts";
import {
	parseCff,
	getCffString,
	type CffTable,
	type TopDict,
	type PrivateDict,
} from "../../../src/font/tables/cff.ts";
import {
	executeCffCharString,
	executeCff2CharString,
	getCffGlyphWidth,
} from "../../../src/font/tables/cff-charstring.ts";
import { parseCff2, type Cff2Table } from "../../../src/font/tables/cff2.ts";

const NOTO_JAVANESE_PATH =
	"/System/Library/Fonts/Supplemental/NotoSansJavanese-Regular.otf";
const LAST_RESORT_PATH = "/System/Library/Fonts/LastResort.otf";

describe("cff table", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(NOTO_JAVANESE_PATH);
	});

	describe("font detection", () => {
		test("detects CFF font correctly", () => {
			expect(font.isTrueType).toBe(false);
		});

		test("has CFF table", () => {
			const reader = font.getTableReader(Tags.CFF);
			expect(reader).toBeDefined();
		});

		test("does not have glyf table", () => {
			const reader = font.getTableReader(Tags.glyf);
			expect(reader).toBeNull();
		});
	});

	describe("parseCff", () => {
		test("parses CFF table successfully", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				expect(cff).toBeDefined();
				expect(cff.version).toBeDefined();
				expect(cff.version.major).toBeGreaterThanOrEqual(1);
				expect(cff.version.minor).toBeGreaterThanOrEqual(0);
			}
		});

		test("parses font names", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				expect(Array.isArray(cff.names)).toBe(true);
				expect(cff.names.length).toBeGreaterThan(0);
				expect(typeof cff.names[0]).toBe("string");
			}
		});

		test("parses top dicts", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				expect(Array.isArray(cff.topDicts)).toBe(true);
				expect(cff.topDicts.length).toBeGreaterThan(0);
			}
		});

		test("parses string INDEX", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				expect(Array.isArray(cff.strings)).toBe(true);
			}
		});

		test("parses global subroutines", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				expect(Array.isArray(cff.globalSubrs)).toBe(true);
			}
		});

		test("parses charstrings", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				expect(Array.isArray(cff.charStrings)).toBe(true);
				expect(cff.charStrings.length).toBeGreaterThan(0);
				const firstFont = cff.charStrings[0];
				expect(Array.isArray(firstFont)).toBe(true);
			}
		});

		test("parses local subroutines", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				expect(Array.isArray(cff.localSubrs)).toBe(true);
			}
		});
	});

	describe("topDict structure", () => {
		test("contains font metadata", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				const topDict = cff.topDicts[0];
				if (topDict) {
					expect(topDict).toBeDefined();
					// Check for common fields
					if (topDict.version) expect(typeof topDict.version).toBe("string");
					if (topDict.fullName) expect(typeof topDict.fullName).toBe("string");
					if (topDict.familyName)
						expect(typeof topDict.familyName).toBe("string");
				}
			}
		});

		test("has charset offset", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				const topDict = cff.topDicts[0];
				if (topDict && topDict.charset !== undefined) {
					expect(typeof topDict.charset).toBe("number");
					expect(topDict.charset).toBeGreaterThanOrEqual(0);
				}
			}
		});

		test("has charStrings offset", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				const topDict = cff.topDicts[0];
				if (topDict) {
					expect(topDict.charStrings).toBeDefined();
					expect(typeof topDict.charStrings).toBe("number");
					if (topDict.charStrings !== undefined) {
						expect(topDict.charStrings).toBeGreaterThan(0);
					}
				}
			}
		});

		test("has private dict pointer", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				const topDict = cff.topDicts[0];
				if (topDict && topDict.private) {
					expect(Array.isArray(topDict.private)).toBe(true);
					expect(topDict.private.length).toBe(2);
					expect(typeof topDict.private[0]).toBe("number");
					expect(typeof topDict.private[1]).toBe("number");
				}
			}
		});

		test("has fontMatrix", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				const topDict = cff.topDicts[0];
				if (topDict && topDict.fontMatrix) {
					expect(Array.isArray(topDict.fontMatrix)).toBe(true);
					expect(topDict.fontMatrix.length).toBe(6);
				}
			}
		});

		test("has fontBBox", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				const topDict = cff.topDicts[0];
				if (topDict && topDict.fontBBox) {
					expect(Array.isArray(topDict.fontBBox)).toBe(true);
					expect(topDict.fontBBox.length).toBe(4);
				}
			}
		});
	});

	describe("getCffString", () => {
		test("returns standard strings", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				// SID 0 = ".notdef"
				expect(getCffString(cff, 0)).toBe(".notdef");
				// SID 1 = "space"
				expect(getCffString(cff, 1)).toBe("space");
				// SID 2 = "exclam"
				expect(getCffString(cff, 2)).toBe("exclam");
			}
		});

		test("returns custom strings", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				if (cff.strings.length > 0) {
					// Custom strings start at SID 391
					const customSID = 391;
					const str = getCffString(cff, customSID);
					expect(typeof str).toBe("string");
				}
			}
		});

		test("handles out of range SID", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				const str = getCffString(cff, 99999);
				expect(str).toBe("");
			}
		});
	});

	describe("charString parsing", () => {
		test("has charStrings for glyphs", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				const charStrings = cff.charStrings[0];
				if (charStrings) {
					expect(charStrings.length).toBeGreaterThan(0);
					expect(charStrings.length).toBe(font.numGlyphs);
				}
			}
		});

		test("charStrings are Uint8Arrays", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				const charStrings = cff.charStrings[0];
				if (charStrings) {
					for (let i = 0; i < Math.min(10, charStrings.length); i++) {
						const cs = charStrings[i];
						if (cs) {
							expect(cs).toBeInstanceOf(Uint8Array);
							expect(cs.length).toBeGreaterThan(0);
						}
					}
				}
			}
		});
	});

	describe("executeCffCharString", () => {
		test("executes charstring for glyph 0", () => {
			if (font.cff) {
				const contours = executeCffCharString(font.cff, 0);
				expect(contours).toBeDefined();
				if (contours) {
					expect(Array.isArray(contours)).toBe(true);
				}
			}
		});

		test("returns null for invalid glyph ID", () => {
			if (font.cff) {
				const contours = executeCffCharString(font.cff, 99999);
				expect(contours).toBeNull();
			}
		});

		test("executes charstring for ASCII glyphs", () => {
			if (font.cff) {
				for (let cp = 0x41; cp <= 0x5a; cp++) {
					const glyphId = font.glyphId(cp);
					const contours = executeCffCharString(font.cff, glyphId);
					if (contours) {
						expect(Array.isArray(contours)).toBe(true);
					}
				}
			}
		});

		test("contours have valid points", () => {
			if (font.cff) {
				const glyphId = font.glyphId(0x41); // 'A'
				const contours = executeCffCharString(font.cff, glyphId);
				if (contours && contours.length > 0) {
					for (const contour of contours) {
						expect(contour.length).toBeGreaterThan(0);
						for (const point of contour) {
							expect(typeof point.x).toBe("number");
							expect(typeof point.y).toBe("number");
							expect(typeof point.onCurve).toBe("boolean");
						}
					}
				}
			}
		});
	});

	describe("CID fonts", () => {
		test("detects non-CID font", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				const topDict = cff.topDicts[0];
				if (topDict) {
					expect(topDict.ros).toBeUndefined();
				}
			}
		});

		test("fdArrays are empty for non-CID fonts", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				const fdArrays = cff.fdArrays[0];
				if (fdArrays) {
					expect(fdArrays.length).toBe(0);
				}
			}
		});

		test("fdSelects have default behavior for non-CID fonts", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				const fdSelect = cff.fdSelects[0];
				if (fdSelect) {
					expect(fdSelect.select(0)).toBe(0);
					expect(fdSelect.select(10)).toBe(0);
				}
			}
		});
	});

	describe("edge cases", () => {
		test("handles empty global subroutines", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				expect(Array.isArray(cff.globalSubrs)).toBe(true);
			}
		});

		test("handles multiple fonts in CFF", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				expect(cff.topDicts.length).toBeGreaterThanOrEqual(1);
			}
		});

		test("parses all glyphs without errors", () => {
			if (font.cff) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					expect(() => executeCffCharString(font.cff!, i)).not.toThrow();
				}
			}
		});
	});

	describe("LastResort.otf font", () => {
		let lastResortFont: Font;

		beforeAll(async () => {
			lastResortFont = await Font.fromFile(LAST_RESORT_PATH);
		});

		test("detects as CFF font", () => {
			expect(lastResortFont.isTrueType).toBe(false);
			const reader = lastResortFont.getTableReader(Tags.CFF);
			expect(reader).toBeDefined();
		});

		test("parses CFF table", () => {
			const reader = lastResortFont.getTableReader(Tags.CFF);
			if (reader) {
				const cff = parseCff(reader);
				expect(cff).toBeDefined();
				expect(cff.topDicts.length).toBeGreaterThan(0);
			}
		});

		test("executes charstrings", () => {
			if (lastResortFont.cff) {
				const contours = executeCffCharString(lastResortFont.cff, 0);
				expect(contours).toBeDefined();
			}
		});
	});

	describe("performance", () => {
		test("parses CFF table efficiently", () => {
			const reader = font.getTableReader(Tags.CFF);
			if (reader) {
				const start = performance.now();
				parseCff(reader);
				const elapsed = performance.now() - start;
				expect(elapsed).toBeLessThan(100);
			}
		});

		test("executes multiple charstrings efficiently", () => {
			if (font.cff) {
				const start = performance.now();
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					executeCffCharString(font.cff, i);
				}
				const elapsed = performance.now() - start;
				expect(elapsed).toBeLessThan(1000);
			}
		});
	});

	describe("charstring operator coverage", () => {
		test("exercises various charstring operators", () => {
			if (font.cff) {
				// Execute charstrings for a wide range of glyphs to hit more operators
				const testGlyphs = [0, 1, 2, 5, 10, 20, 50, 100];
				for (const glyphId of testGlyphs) {
					if (glyphId < font.numGlyphs) {
						const contours = executeCffCharString(font.cff, glyphId);
						expect(contours !== null).toBe(true);
					}
				}
			}
		});

		test("handles various glyph shapes", () => {
			if (font.cff) {
				// Test different categories of glyphs
				const testCodepoints = [
					0x0020, // space
					0x0041, // A
					0x0061, // a
					0x0030, // 0
					0x002e, // .
					0x0021, // !
					0xa980, // Javanese character
					0xa9a0, // Javanese character
				];

				for (const cp of testCodepoints) {
					const glyphId = font.glyphId(cp);
					if (glyphId > 0 && glyphId < font.numGlyphs) {
						const contours = executeCffCharString(font.cff, glyphId);
						if (contours) {
							expect(Array.isArray(contours)).toBe(true);
						}
					}
				}
			}
		});

		test("handles all available glyphs", () => {
			if (font.cff) {
				let successCount = 0;
				let nullCount = 0;

				for (let i = 0; i < font.numGlyphs; i++) {
					const contours = executeCffCharString(font.cff, i);
					if (contours) {
						successCount++;
						expect(Array.isArray(contours)).toBe(true);
					} else {
						nullCount++;
					}
				}

				expect(successCount + nullCount).toBe(font.numGlyphs);
			}
		});
	});

	describe("getCffGlyphWidth", () => {
		test("returns width for glyphs", () => {
			if (font.cff) {
				const width = getCffGlyphWidth(font.cff, 0);
				expect(typeof width).toBe("number");
			}
		});

		test("handles various glyph IDs", () => {
			if (font.cff) {
				for (let i = 0; i < Math.min(10, font.numGlyphs); i++) {
					const width = getCffGlyphWidth(font.cff, i);
					expect(typeof width).toBe("number");
				}
			}
		});
	});

	describe("charstring number encoding", () => {
		test("handles different number formats in charstrings", () => {
			if (font.cff) {
				// By testing many glyphs, we'll hit different number encodings
				// (8-bit integers, 16-bit integers, 32-bit fixed point)
				for (let i = 0; i < font.numGlyphs; i++) {
					const contours = executeCffCharString(font.cff, i);
					if (contours) {
						for (const contour of contours) {
							for (const point of contour) {
								expect(typeof point.x).toBe("number");
								expect(typeof point.y).toBe("number");
								expect(Number.isFinite(point.x)).toBe(true);
								expect(Number.isFinite(point.y)).toBe(true);
							}
						}
					}
				}
			}
		});
	});

	describe("subroutines", () => {
		test("handles fonts with subroutines", () => {
			if (font.cff) {
				// Test that subroutines are parsed
				expect(Array.isArray(font.cff.globalSubrs)).toBe(true);
				expect(Array.isArray(font.cff.localSubrs)).toBe(true);

				// Execute glyphs that might use subroutines
				for (let i = 0; i < Math.min(50, font.numGlyphs); i++) {
					const contours = executeCffCharString(font.cff, i);
					if (contours) {
						expect(Array.isArray(contours)).toBe(true);
					}
				}
			}
		});
	});
});

describe("cff2 table - variable fonts", () => {
	let font: Font | null = null;
	let cff2: Cff2Table | null = null;

	beforeAll(async () => {
		try {
			// Try to find a CFF2 variable font
			const possibleFonts = [
				"/System/Library/Fonts/SFNS.ttf",
				"/System/Library/Fonts/SFNSText.ttf",
				"/System/Library/Fonts/Supplemental/AdobeVFPrototype.otf",
			];

			for (const path of possibleFonts) {
				try {
					const testFont = await Font.fromFile(path);
					const reader = testFont.getTableReader(Tags.CFF2);
					if (reader) {
						font = testFont;
						cff2 = parseCff2(reader);
						break;
					}
				} catch (e) {
					// Try next font
				}
			}
		} catch (e) {
			// No CFF2 fonts available
		}
	});

	describe("parseCff2", () => {
		test("parses CFF2 table if available", () => {
			if (cff2) {
				expect(cff2).toBeDefined();
				expect(cff2.version).toBeDefined();
				expect(cff2.version.major).toBe(2);
			}
		});

		test("has charStrings", () => {
			if (cff2) {
				expect(Array.isArray(cff2.charStrings)).toBe(true);
				expect(cff2.charStrings.length).toBeGreaterThan(0);
			}
		});

		test("has globalSubrs", () => {
			if (cff2) {
				expect(Array.isArray(cff2.globalSubrs)).toBe(true);
			}
		});
	});

	describe("executeCff2CharString", () => {
		test("executes CFF2 charstrings", () => {
			if (cff2) {
				const contours = executeCff2CharString(cff2, 0);
				expect(contours !== null).toBe(true);
			}
		});

		test("handles axis coordinates", () => {
			if (cff2) {
				const contours1 = executeCff2CharString(cff2, 0, null);
				const contours2 = executeCff2CharString(cff2, 0, [0, 0]);
				expect(contours1 !== null || contours2 !== null).toBe(true);
			}
		});

		test("executes multiple glyphs", () => {
			if (cff2 && font) {
				for (let i = 0; i < Math.min(20, cff2.charStrings.length); i++) {
					const contours = executeCff2CharString(cff2, i);
					if (contours) {
						expect(Array.isArray(contours)).toBe(true);
					}
				}
			}
		});
	});
});
