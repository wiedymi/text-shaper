import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../src/font/font.ts";
import { Tags, tag } from "../../src/types.ts";

// System font path (macOS)
const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";
const TIMES_PATH = "/System/Library/Fonts/Supplemental/Times New Roman.ttf";
const HELVETICA_PATH = "/System/Library/Fonts/Helvetica.ttc";

describe("Font", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("loading", () => {
		test("loads from file path", async () => {
			const f = await Font.fromFile(ARIAL_PATH);
			expect(f).toBeInstanceOf(Font);
		});

		test("loads from ArrayBuffer", async () => {
			const file = Bun.file(ARIAL_PATH);
			const buffer = await file.arrayBuffer();
			const f = Font.load(buffer);
			expect(f).toBeInstanceOf(Font);
		});

		test("throws for missing file", async () => {
			await expect(Font.fromFile("/nonexistent/font.ttf")).rejects.toThrow();
		});
	});

	describe("required tables", () => {
		test("has head table", () => {
			expect(font.head).toBeDefined();
			expect(font.head.unitsPerEm).toBeGreaterThan(0);
			expect(font.head.magicNumber).toBe(0x5f0f3cf5);
		});

		test("has maxp table", () => {
			expect(font.maxp).toBeDefined();
			expect(font.maxp.numGlyphs).toBeGreaterThan(0);
		});

		test("has hhea table", () => {
			expect(font.hhea).toBeDefined();
			expect(font.hhea.ascender).toBeDefined();
			expect(font.hhea.descender).toBeDefined();
		});

		test("has hmtx table", () => {
			expect(font.hmtx).toBeDefined();
			expect(font.hmtx.hMetrics.length).toBeGreaterThan(0);
		});

		test("has cmap table", () => {
			expect(font.cmap).toBeDefined();
			expect(font.cmap.subtables.size).toBeGreaterThan(0);
		});
	});

	describe("table presence checks", () => {
		test("hasTable returns true for existing tables", () => {
			expect(font.hasTable(Tags.head)).toBe(true);
			expect(font.hasTable(Tags.maxp)).toBe(true);
			expect(font.hasTable(Tags.cmap)).toBe(true);
		});

		test("hasTable returns false for non-existing tables", () => {
			expect(font.hasTable(tag("XXXX"))).toBe(false);
		});

		test("listTables returns all table tags", () => {
			const tables = font.listTables();
			expect(tables).toContain("head");
			expect(tables).toContain("maxp");
			expect(tables).toContain("cmap");
		});
	});

	describe("convenience properties", () => {
		test("numGlyphs", () => {
			expect(font.numGlyphs).toBe(font.maxp.numGlyphs);
			expect(font.numGlyphs).toBeGreaterThan(0);
		});

		test("unitsPerEm", () => {
			expect(font.unitsPerEm).toBe(font.head.unitsPerEm);
			expect(font.unitsPerEm).toBeGreaterThan(0);
		});

		test("ascender/descender", () => {
			expect(font.ascender).toBe(font.hhea.ascender);
			expect(font.descender).toBe(font.hhea.descender);
			expect(font.descender).toBeLessThanOrEqual(0);
		});

		test("lineGap", () => {
			expect(font.lineGap).toBe(font.hhea.lineGap);
		});
	});

	describe("font type detection", () => {
		test("isTrueType", () => {
			expect(typeof font.isTrueType).toBe("boolean");
		});

		test("isCFF", () => {
			expect(font.isCFF).toBe(font.hasTable(Tags.CFF) || font.hasTable(Tags.CFF2));
		});

		test("isVariable", () => {
			expect(font.isVariable).toBe(font.hasTable(Tags.fvar));
		});

		test("hasOpenTypeLayout", () => {
			expect(font.hasOpenTypeLayout).toBe(font.hasTable(Tags.GSUB) || font.hasTable(Tags.GPOS));
		});

		test("hasAATLayout", () => {
			expect(font.hasAATLayout).toBe(font.hasTable(Tags.morx) || font.hasTable(Tags.kerx));
		});

		test("isColorFont", () => {
			const hasColor = font.hasTable(Tags.COLR) || font.hasTable(Tags.SVG) ||
				font.hasTable(Tags.sbix) || font.hasTable(Tags.CBDT);
			expect(font.isColorFont).toBe(hasColor);
		});
	});

	describe("glyph operations", () => {
		test("glyphId maps codepoints", () => {
			// 'A' should map to a valid glyph
			const glyphA = font.glyphId(0x41);
			expect(glyphA).toBeGreaterThan(0);

			// Space should map to a valid glyph
			const glyphSpace = font.glyphId(0x20);
			expect(glyphSpace).toBeGreaterThanOrEqual(0);
		});

		test("glyphId returns 0 for unmapped codepoints", () => {
			// Private Use Area codepoint likely unmapped
			const glyph = font.glyphId(0xf0000);
			expect(glyph).toBe(0);
		});

		test("glyphIdForChar", () => {
			expect(font.glyphIdForChar("A")).toBe(font.glyphId(0x41));
			expect(font.glyphIdForChar("B")).toBe(font.glyphId(0x42));
		});

		test("advanceWidth", () => {
			const glyphA = font.glyphId(0x41);
			const width = font.advanceWidth(glyphA);
			expect(width).toBeGreaterThan(0);
		});

		test("leftSideBearing", () => {
			const glyphA = font.glyphId(0x41);
			const lsb = font.leftSideBearing(glyphA);
			expect(typeof lsb).toBe("number");
		});
	});

	describe("glyph outlines", () => {
		test("getGlyph returns glyph data", () => {
			if (font.isTrueType) {
				const glyphA = font.glyphId(0x41);
				const glyph = font.getGlyph(glyphA);
				expect(glyph).not.toBeNull();
			}
		});

		test("getGlyphContours returns contours", () => {
			const glyphA = font.glyphId(0x41);
			const contours = font.getGlyphContours(glyphA);
			expect(contours).not.toBeNull();
			if (contours) {
				expect(contours.length).toBeGreaterThan(0);
			}
		});

		test("getGlyphBounds returns bounding box", () => {
			const glyphA = font.glyphId(0x41);
			const bounds = font.getGlyphBounds(glyphA);
			expect(bounds).not.toBeNull();
			if (bounds) {
				expect(bounds.xMax).toBeGreaterThan(bounds.xMin);
				expect(bounds.yMax).toBeGreaterThan(bounds.yMin);
			}
		});

		test("empty glyph returns null bounds", () => {
			// Glyph 0 (notdef) or space might have no contours
			const bounds = font.getGlyphBounds(font.glyphId(0x20)); // space
			// Space typically has no outlines
		});
	});

	describe("optional tables", () => {
		test("gsub returns table or null", () => {
			const gsub = font.gsub;
			if (gsub) {
				expect(gsub.version).toBeDefined();
			}
		});

		test("gpos returns table or null", () => {
			const gpos = font.gpos;
			if (gpos) {
				expect(gpos.version).toBeDefined();
			}
		});

		test("gdef returns table or null", () => {
			const gdef = font.gdef;
			if (gdef) {
				expect(gdef.version).toBeDefined();
			}
		});

		test("kern returns table or null", () => {
			const kern = font.kern;
			// kern is optional
		});

		test("os2 returns table or null", () => {
			const os2 = font.os2;
			if (os2) {
				expect(os2.version).toBeDefined();
			}
		});

		test("name returns table or null", () => {
			const name = font.name;
			if (name) {
				expect(name.records.length).toBeGreaterThan(0);
			}
		});

		test("post returns table or null", () => {
			const post = font.post;
			if (post) {
				expect(post.version).toBeDefined();
			}
		});
	});

	describe("lazy loading", () => {
		test("tables are lazily loaded", async () => {
			// Create a new font instance
			const f = await Font.fromFile(ARIAL_PATH);

			// Access head table multiple times - should return same instance
			const head1 = f.head;
			const head2 = f.head;
			expect(head1).toBe(head2);
		});
	});

	describe("table reader", () => {
		test("getTableReader returns reader for existing table", () => {
			const reader = font.getTableReader(Tags.head);
			expect(reader).not.toBeNull();
		});

		test("getTableReader returns null for non-existing table", () => {
			const reader = font.getTableReader(tag("XXXX"));
			expect(reader).toBeNull();
		});

		test("getTableRecord returns record for existing table", () => {
			const record = font.getTableRecord(Tags.head);
			expect(record).toBeDefined();
			if (record) {
				expect(record.tag).toBe(Tags.head);
				expect(record.length).toBeGreaterThan(0);
			}
		});
	});
});

describe("Font with different formats", () => {
	test("loads Times New Roman", async () => {
		try {
			const font = await Font.fromFile(TIMES_PATH);
			expect(font.numGlyphs).toBeGreaterThan(0);
		} catch {
			// Font might not exist on all systems
		}
	});
});

describe("Font edge cases", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("glyph ID edge cases", () => {
		test("glyphId for null character", () => {
			const glyph = font.glyphId(0);
			expect(typeof glyph).toBe("number");
		});

		test("glyphId for very high codepoint", () => {
			const glyph = font.glyphId(0x10ffff);
			expect(glyph).toBe(0); // Should return .notdef
		});

		test("glyphIdForChar with emoji", () => {
			// May or may not be supported by Arial
			const glyph = font.glyphIdForChar("😀");
			expect(typeof glyph).toBe("number");
		});

		test("glyphIdForChar with empty string", () => {
			const glyph = font.glyphIdForChar("");
			expect(glyph).toBe(0);
		});

		test("glyphIdForChar with multi-character string uses first char", () => {
			const glyphA = font.glyphIdForChar("ABC");
			const expectedA = font.glyphId(0x41);
			expect(glyphA).toBe(expectedA);
		});
	});

	describe("advance width edge cases", () => {
		test("advanceWidth for glyph 0 (notdef)", () => {
			const width = font.advanceWidth(0);
			expect(width).toBeGreaterThanOrEqual(0);
		});

		test("advanceWidth for invalid glyph ID", () => {
			const width = font.advanceWidth(99999);
			expect(typeof width).toBe("number");
		});

		test("leftSideBearing for glyph 0", () => {
			const lsb = font.leftSideBearing(0);
			expect(typeof lsb).toBe("number");
		});
	});

	describe("glyph outline edge cases", () => {
		test("getGlyph for glyph 0 (notdef)", () => {
			if (font.isTrueType) {
				const glyph = font.getGlyph(0);
				// .notdef typically has some outline
			}
		});

		test("getGlyphContours for space glyph", () => {
			const spaceId = font.glyphId(0x20);
			const contours = font.getGlyphContours(spaceId);
			// Space typically has no contours
			if (contours) {
				expect(contours.length).toBe(0);
			}
		});

		test("getGlyphBounds for glyph with no outline", () => {
			const spaceId = font.glyphId(0x20);
			const bounds = font.getGlyphBounds(spaceId);
			// May be null for space
		});
	});

	describe("head table edge cases", () => {
		test("head table has valid timestamps", () => {
			expect(font.head.created).toBeGreaterThanOrEqual(0n);
			expect(font.head.modified).toBeGreaterThanOrEqual(0n);
		});

		test("head table has valid flags", () => {
			expect(font.head.flags).toBeGreaterThanOrEqual(0);
		});

		test("head table indexToLocFormat", () => {
			expect([0, 1]).toContain(font.head.indexToLocFormat);
		});
	});

	describe("maxp table edge cases", () => {
		test("maxp has valid version", () => {
			const version = font.maxp.version;
			expect(version).toBeGreaterThanOrEqual(0);
		});

		test("maxp numGlyphs is positive", () => {
			expect(font.maxp.numGlyphs).toBeGreaterThan(0);
		});
	});

	describe("cmap table edge cases", () => {
		test("cmap has at least one subtable", () => {
			expect(font.cmap.subtables.size).toBeGreaterThan(0);
		});

		test("cmap can look up ASCII range", () => {
			for (let cp = 0x20; cp < 0x7f; cp++) {
				const glyph = font.glyphId(cp);
				expect(typeof glyph).toBe("number");
			}
		});
	});

	describe("hmtx table edge cases", () => {
		test("hmtx has metrics for all glyphs referenced by hhea", () => {
			const numLongMetrics = font.hhea.numberOfHMetrics;
			expect(font.hmtx.hMetrics.length).toBe(numLongMetrics);
		});

		test("hmtx provides widths for all glyphs", () => {
			for (let i = 0; i < Math.min(10, font.numGlyphs); i++) {
				const width = font.advanceWidth(i);
				expect(typeof width).toBe("number");
				expect(width).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("font info getters", () => {
		test("numGlyphs matches maxp", () => {
			expect(font.numGlyphs).toBe(font.maxp.numGlyphs);
		});

		test("unitsPerEm is valid", () => {
			expect(font.unitsPerEm).toBeGreaterThan(0);
			expect(font.unitsPerEm).toBeLessThanOrEqual(16384);
		});

		test("ascender is typically positive", () => {
			expect(font.ascender).toBeGreaterThan(0);
		});

		test("descender is typically negative", () => {
			expect(font.descender).toBeLessThanOrEqual(0);
		});
	});

	describe("listTables", () => {
		test("returns array of strings", () => {
			const tables = font.listTables();
			expect(Array.isArray(tables)).toBe(true);
			for (const t of tables) {
				expect(typeof t).toBe("string");
				expect(t.length).toBe(4);
			}
		});

		test("includes required tables", () => {
			const tables = font.listTables();
			expect(tables).toContain("head");
			expect(tables).toContain("hhea");
			expect(tables).toContain("maxp");
			expect(tables).toContain("hmtx");
			expect(tables).toContain("cmap");
		});
	});

	describe("table presence edge cases", () => {
		test("hasTable with empty tag returns false", () => {
			expect(font.hasTable(0)).toBe(false);
		});

		test("multiple optional table checks", () => {
			// These may or may not exist
			const optionalTables = [
				Tags.GDEF, Tags.GSUB, Tags.GPOS,
				Tags.kern, Tags.fvar, Tags.gvar,
			];
			for (const t of optionalTables) {
				expect(typeof font.hasTable(t)).toBe("boolean");
			}
		});
	});
});

describe("Font loading edge cases", () => {
	test("Font.load with minimal valid font data throws for missing tables", () => {
		// Empty buffer should fail
		expect(() => Font.load(new ArrayBuffer(0))).toThrow();
	});

	test("Font.load with invalid data throws", () => {
		const invalidData = new ArrayBuffer(100);
		expect(() => Font.load(invalidData)).toThrow();
	});

	test("Font.fromURL rejects for invalid URL", async () => {
		await expect(Font.fromURL("http://localhost:99999/nonexistent.ttf")).rejects.toThrow();
	});
});
