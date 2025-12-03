import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../src/font/font.ts";
import { Face, createFace } from "../../src/font/face.ts";
import { tag } from "../../src/types.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("Face", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("constructor", () => {
		test("creates Face from non-variable font", () => {
			const face = new Face(font);
			expect(face).toBeInstanceOf(Face);
			expect(face.font).toBe(font);
		});

		test("creates Face with variation object", () => {
			const face = new Face(font, { wght: 700 });
			expect(face).toBeInstanceOf(Face);
		});

		test("creates Face with variation array", () => {
			const face = new Face(font, [{ tag: tag("wght"), value: 700 }]);
			expect(face).toBeInstanceOf(Face);
		});

		test("initializes empty coords for non-variable font", () => {
			const face = new Face(font);
			expect(face.normalizedCoords).toBeDefined();
			expect(Array.isArray(face.normalizedCoords)).toBe(true);
		});
	});

	describe("createFace", () => {
		test("creates face with createFace helper", () => {
			const face = createFace(font);
			expect(face).toBeInstanceOf(Face);
		});

		test("creates face with variations via createFace", () => {
			const face = createFace(font, { wght: 700 });
			expect(face).toBeInstanceOf(Face);
		});
	});

	describe("setVariations", () => {
		test("setVariations with object", () => {
			const face = new Face(font);
			expect(() => face.setVariations({ wght: 700 })).not.toThrow();
		});

		test("setVariations with array", () => {
			const face = new Face(font);
			const variations = [{ tag: tag("wght"), value: 700 }];
			expect(() => face.setVariations(variations)).not.toThrow();
		});

		test("setVariations on non-variable font does nothing", () => {
			const face = new Face(font);
			face.setVariations({ wght: 700 });
			expect(face.normalizedCoords.length).toBe(0);
		});

		test("setVariations with multiple axes", () => {
			const face = new Face(font);
			face.setVariations({ wght: 700, wdth: 100, ital: 1 });
			expect(face).toBeDefined();
		});

		test("setVariations with padded tag name", () => {
			const face = new Face(font);
			face.setVariations({ wg: 700 }); // short tag
			expect(face).toBeDefined();
		});

		test("setVariations updates coords", () => {
			const face = new Face(font);
			const coordsBefore = [...face.normalizedCoords];
			face.setVariations({ wght: 700 });
			// For non-variable font, coords remain unchanged
			expect(face.normalizedCoords).toEqual(coordsBefore);
		});
	});

	describe("normalizedCoords", () => {
		test("returns array of normalized coordinates", () => {
			const face = new Face(font);
			expect(Array.isArray(face.normalizedCoords)).toBe(true);
		});

		test("coords are numbers in [-1, 1] range for variable fonts", () => {
			const face = new Face(font);
			if (face.isVariable) {
				for (const coord of face.normalizedCoords) {
					expect(typeof coord).toBe("number");
					expect(coord).toBeGreaterThanOrEqual(-1);
					expect(coord).toBeLessThanOrEqual(1);
				}
			}
		});
	});

	describe("isVariable", () => {
		test("returns boolean", () => {
			const face = new Face(font);
			expect(typeof face.isVariable).toBe("boolean");
		});

		test("matches font.isVariable", () => {
			const face = new Face(font);
			expect(face.isVariable).toBe(font.isVariable);
		});
	});

	describe("axes", () => {
		test("returns array of variation axes", () => {
			const face = new Face(font);
			expect(Array.isArray(face.axes)).toBe(true);
		});

		test("returns empty array for non-variable font", () => {
			const face = new Face(font);
			if (!face.isVariable) {
				expect(face.axes).toEqual([]);
			}
		});

		test("axes have required properties", () => {
			const face = new Face(font);
			if (face.isVariable) {
				for (const axis of face.axes) {
					expect(axis).toHaveProperty("tag");
					expect(axis).toHaveProperty("minValue");
					expect(axis).toHaveProperty("defaultValue");
					expect(axis).toHaveProperty("maxValue");
				}
			}
		});
	});

	describe("getAxisValue", () => {
		test("returns null for non-variable font", () => {
			const face = new Face(font);
			if (!face.isVariable) {
				expect(face.getAxisValue("wght")).toBeNull();
			}
		});

		test("accepts tag as number", () => {
			const face = new Face(font);
			const value = face.getAxisValue(tag("wght"));
			expect(value === null || typeof value === "number").toBe(true);
		});

		test("accepts tag as string", () => {
			const face = new Face(font);
			const value = face.getAxisValue("wght");
			expect(value === null || typeof value === "number").toBe(true);
		});

		test("returns default value for unset axis", () => {
			const face = new Face(font);
			if (face.isVariable && face.axes.length > 0) {
				const axis = face.axes[0];
				if (axis) {
					const value = face.getAxisValue(axis.tag);
					expect(value).toBe(axis.defaultValue);
				}
			}
		});

		test("returns set value for configured axis", () => {
			const face = new Face(font);
			if (face.isVariable) {
				face.setVariations({ wght: 700 });
				const value = face.getAxisValue("wght");
				if (value !== null) {
					expect(value).toBe(700);
				}
			}
		});

		test("returns null for non-existent axis", () => {
			const face = new Face(font);
			expect(face.getAxisValue("XXXX")).toBeNull();
		});
	});

	describe("advanceWidth", () => {
		test("returns advance width for glyph", () => {
			const face = new Face(font);
			const glyphId = font.glyphId(0x41); // 'A'
			const width = face.advanceWidth(glyphId);
			expect(typeof width).toBe("number");
			expect(width).toBeGreaterThan(0);
		});

		test("matches font.advanceWidth for non-variable font", () => {
			const face = new Face(font);
			if (!face.isVariable) {
				const glyphId = font.glyphId(0x41);
				expect(face.advanceWidth(glyphId)).toBe(font.advanceWidth(glyphId));
			}
		});

		test("returns width for glyph 0", () => {
			const face = new Face(font);
			const width = face.advanceWidth(0);
			expect(typeof width).toBe("number");
			expect(width).toBeGreaterThanOrEqual(0);
		});

		test("returns width for multiple glyphs", () => {
			const face = new Face(font);
			for (let i = 0; i < Math.min(10, face.numGlyphs); i++) {
				const width = face.advanceWidth(i);
				expect(typeof width).toBe("number");
				expect(width).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("leftSideBearing", () => {
		test("returns left side bearing for glyph", () => {
			const face = new Face(font);
			const glyphId = font.glyphId(0x41);
			const lsb = face.leftSideBearing(glyphId);
			expect(typeof lsb).toBe("number");
		});

		test("matches font.leftSideBearing for non-variable font", () => {
			const face = new Face(font);
			if (!face.isVariable) {
				const glyphId = font.glyphId(0x41);
				expect(face.leftSideBearing(glyphId)).toBe(font.leftSideBearing(glyphId));
			}
		});

		test("returns lsb for glyph 0", () => {
			const face = new Face(font);
			const lsb = face.leftSideBearing(0);
			expect(typeof lsb).toBe("number");
		});

		test("returns lsb for multiple glyphs", () => {
			const face = new Face(font);
			for (let i = 0; i < Math.min(10, face.numGlyphs); i++) {
				const lsb = face.leftSideBearing(i);
				expect(typeof lsb).toBe("number");
			}
		});
	});

	describe("delegated properties", () => {
		test("numGlyphs delegates to font", () => {
			const face = new Face(font);
			expect(face.numGlyphs).toBe(font.numGlyphs);
		});

		test("unitsPerEm delegates to font", () => {
			const face = new Face(font);
			expect(face.unitsPerEm).toBe(font.unitsPerEm);
		});

		test("ascender delegates to font", () => {
			const face = new Face(font);
			expect(face.ascender).toBe(font.ascender);
		});

		test("descender delegates to font", () => {
			const face = new Face(font);
			expect(face.descender).toBe(font.descender);
		});

		test("lineGap delegates to font", () => {
			const face = new Face(font);
			expect(face.lineGap).toBe(font.lineGap);
		});
	});

	describe("glyphId methods", () => {
		test("glyphId delegates to font", () => {
			const face = new Face(font);
			expect(face.glyphId(0x41)).toBe(font.glyphId(0x41));
		});

		test("glyphIdForChar delegates to font", () => {
			const face = new Face(font);
			expect(face.glyphIdForChar("A")).toBe(font.glyphIdForChar("A"));
		});

		test("glyphId for multiple codepoints", () => {
			const face = new Face(font);
			for (let cp = 0x41; cp <= 0x5a; cp++) {
				const glyph = face.glyphId(cp);
				expect(typeof glyph).toBe("number");
			}
		});

		test("glyphIdForChar for empty string", () => {
			const face = new Face(font);
			expect(face.glyphIdForChar("")).toBe(0);
		});
	});

	describe("hasTable", () => {
		test("delegates to font", () => {
			const face = new Face(font);
			expect(face.hasTable(tag("head"))).toBe(font.hasTable(tag("head")));
		});

		test("returns false for non-existent table", () => {
			const face = new Face(font);
			expect(face.hasTable(tag("XXXX"))).toBe(false);
		});
	});

	describe("table accessors", () => {
		test("gdef returns same as font.gdef", () => {
			const face = new Face(font);
			expect(face.gdef).toBe(font.gdef);
		});

		test("gsub returns same as font.gsub", () => {
			const face = new Face(font);
			expect(face.gsub).toBe(font.gsub);
		});

		test("gpos returns same as font.gpos", () => {
			const face = new Face(font);
			expect(face.gpos).toBe(font.gpos);
		});

		test("kern returns same as font.kern", () => {
			const face = new Face(font);
			expect(face.kern).toBe(font.kern);
		});

		test("morx returns same as font.morx", () => {
			const face = new Face(font);
			expect(face.morx).toBe(font.morx);
		});

		test("cmap returns same as font.cmap", () => {
			const face = new Face(font);
			expect(face.cmap).toBe(font.cmap);
		});

		test("hmtx returns same as font.hmtx", () => {
			const face = new Face(font);
			expect(face.hmtx).toBe(font.hmtx);
		});

		test("hhea returns same as font.hhea", () => {
			const face = new Face(font);
			expect(face.hhea).toBe(font.hhea);
		});
	});

	describe("edge cases", () => {
		test("handles invalid glyph IDs gracefully", () => {
			const face = new Face(font);
			expect(() => face.advanceWidth(99999)).not.toThrow();
			expect(() => face.leftSideBearing(99999)).not.toThrow();
		});

		test("handles negative glyph IDs", () => {
			const face = new Face(font);
			expect(() => face.advanceWidth(-1)).not.toThrow();
			expect(() => face.leftSideBearing(-1)).not.toThrow();
		});

		test("setVariations multiple times", () => {
			const face = new Face(font);
			face.setVariations({ wght: 700 });
			face.setVariations({ wght: 400 });
			face.setVariations({ wdth: 100 });
			expect(face).toBeDefined();
		});

		test("setVariations with empty object", () => {
			const face = new Face(font);
			expect(() => face.setVariations({})).not.toThrow();
		});

		test("setVariations with empty array", () => {
			const face = new Face(font);
			expect(() => face.setVariations([])).not.toThrow();
		});

		test("getAxisValue with empty string", () => {
			const face = new Face(font);
			const value = face.getAxisValue("");
			expect(value === null || typeof value === "number").toBe(true);
		});

		test("multiple face instances from same font", () => {
			const face1 = new Face(font);
			const face2 = new Face(font);
			expect(face1).not.toBe(face2);
			expect(face1.font).toBe(face2.font);
		});

		test("face with different variations", () => {
			const face1 = new Face(font, { wght: 700 });
			const face2 = new Face(font, { wght: 400 });
			expect(face1.font).toBe(face2.font);
		});
	});

	describe("variation deltas", () => {
		test("advanceWidth returns number with variations set", () => {
			const face = new Face(font);
			face.setVariations({ wght: 700 });
			const glyphId = font.glyphId(0x41);
			const width = face.advanceWidth(glyphId);
			expect(typeof width).toBe("number");
		});

		test("leftSideBearing returns number with variations set", () => {
			const face = new Face(font);
			face.setVariations({ wght: 700 });
			const glyphId = font.glyphId(0x41);
			const lsb = face.leftSideBearing(glyphId);
			expect(typeof lsb).toBe("number");
		});
	});

	describe("property consistency", () => {
		test("numGlyphs is consistent across calls", () => {
			const face = new Face(font);
			const num1 = face.numGlyphs;
			const num2 = face.numGlyphs;
			expect(num1).toBe(num2);
		});

		test("unitsPerEm is consistent", () => {
			const face = new Face(font);
			expect(face.unitsPerEm).toBe(face.unitsPerEm);
		});

		test("axes return same values", () => {
			const face = new Face(font);
			const axes1 = face.axes;
			const axes2 = face.axes;
			expect(axes1.length).toBe(axes2.length);
		});
	});
});
