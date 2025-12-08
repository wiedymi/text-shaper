import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parsePost,
	getGlyphName,
	isMonospaced,
	type PostTable,
} from "../../../src/font/tables/post.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";
const COURIER_PATH = "/System/Library/Fonts/Courier.dfont";

describe("post table", () => {
	let font: Font;
	let post: PostTable | null;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
		post = font.post;
	});

	describe("parsePost", () => {
		test("returns PostTable from Arial", () => {
			expect(post).not.toBeNull();
			if (!post) return;

			expect(typeof post.version).toBe("number");
			expect(typeof post.italicAngle).toBe("number");
			expect(typeof post.underlinePosition).toBe("number");
			expect(typeof post.underlineThickness).toBe("number");
			expect(typeof post.isFixedPitch).toBe("number");
		});

		test("parses common header fields", () => {
			if (!post) return;

			expect(typeof post.minMemType42).toBe("number");
			expect(typeof post.maxMemType42).toBe("number");
			expect(typeof post.minMemType1).toBe("number");
			expect(typeof post.maxMemType1).toBe("number");
		});

		test("italic angle is reasonable", () => {
			if (!post) return;

			expect(post.italicAngle).toBeGreaterThanOrEqual(-90);
			expect(post.italicAngle).toBeLessThanOrEqual(90);
		});

		test("parses version 1.0 format", () => {
			const data = new Uint8Array([
				0x00, 0x01, 0x00, 0x00, // version 1.0
				0x00, 0x00, 0x00, 0x00, // italicAngle (fixed)
				0xff, 0xf0, // underlinePosition
				0x00, 0x32, // underlineThickness
				0x00, 0x00, 0x00, 0x00, // isFixedPitch
				0x00, 0x00, 0x00, 0x00, // minMemType42
				0x00, 0x00, 0x00, 0x00, // maxMemType42
				0x00, 0x00, 0x00, 0x00, // minMemType1
				0x00, 0x00, 0x00, 0x00, // maxMemType1
			]);
			const reader = new Reader(data.buffer);
			const table = parsePost(reader);

			expect(table.version).toBe(1.0);
			expect(table.italicAngle).toBe(0);
			expect(table.numberOfGlyphs).toBeUndefined();
			expect(table.glyphNameIndex).toBeUndefined();
		});

		test("parses version 2.0 format with standard names only", () => {
			const data = new Uint8Array([
				0x00, 0x02, 0x00, 0x00, // version 2.0
				0x00, 0x00, 0x00, 0x00, // italicAngle (fixed)
				0xff, 0xf0, // underlinePosition
				0x00, 0x32, // underlineThickness
				0x00, 0x00, 0x00, 0x00, // isFixedPitch
				0x00, 0x00, 0x00, 0x00, // minMemType42
				0x00, 0x00, 0x00, 0x00, // maxMemType42
				0x00, 0x00, 0x00, 0x00, // minMemType1
				0x00, 0x00, 0x00, 0x00, // maxMemType1
				0x00, 0x03, // numberOfGlyphs: 3
				0x00, 0x00, // glyphNameIndex[0]: 0 (.notdef)
				0x00, 0x41, // glyphNameIndex[1]: 65 (A)
				0x00, 0x61, // glyphNameIndex[2]: 97 (a)
			]);
			const reader = new Reader(data.buffer);
			const table = parsePost(reader);

			expect(table.version).toBe(2.0);
			expect(table.numberOfGlyphs).toBe(3);
			expect(table.glyphNameIndex).toBeDefined();
			expect(table.glyphNameIndex?.length).toBe(3);
			expect(table.glyphNameIndex?.[0]).toBe(0);
			expect(table.glyphNameIndex?.[1]).toBe(65);
			expect(table.glyphNameIndex?.[2]).toBe(97);
		});

		test("parses version 2.0 format with custom names", () => {
			const data = new Uint8Array([
				0x00, 0x02, 0x00, 0x00, // version 2.0
				0x00, 0x00, 0x00, 0x00, // italicAngle (fixed)
				0xff, 0xf0, // underlinePosition
				0x00, 0x32, // underlineThickness
				0x00, 0x00, 0x00, 0x00, // isFixedPitch
				0x00, 0x00, 0x00, 0x00, // minMemType42
				0x00, 0x00, 0x00, 0x00, // maxMemType42
				0x00, 0x00, 0x00, 0x00, // minMemType1
				0x00, 0x00, 0x00, 0x00, // maxMemType1
				0x00, 0x03, // numberOfGlyphs: 3
				0x00, 0x00, // glyphNameIndex[0]: 0 (.notdef)
				0x01, 0x02, // glyphNameIndex[1]: 258 (custom name 0)
				0x01, 0x03, // glyphNameIndex[2]: 259 (custom name 1)
				// Custom names
				0x07, 0x63, 0x75, 0x73, 0x74, 0x6f, 0x6d, 0x31, // "custom1"
				0x07, 0x63, 0x75, 0x73, 0x74, 0x6f, 0x6d, 0x32, // "custom2"
			]);
			const reader = new Reader(data.buffer);
			const table = parsePost(reader);

			expect(table.version).toBe(2.0);
			expect(table.numberOfGlyphs).toBe(3);
			expect(table.names).toBeDefined();
			expect(table.names?.length).toBe(2);
			expect(table.names?.[0]).toBe("custom1");
			expect(table.names?.[1]).toBe("custom2");
		});

		test("parses version 2.5 format", () => {
			const data = new Uint8Array([
				0x00, 0x02, 0x80, 0x00, // version 2.5
				0x00, 0x00, 0x00, 0x00, // italicAngle (fixed)
				0xff, 0xf0, // underlinePosition
				0x00, 0x32, // underlineThickness
				0x00, 0x00, 0x00, 0x00, // isFixedPitch
				0x00, 0x00, 0x00, 0x00, // minMemType42
				0x00, 0x00, 0x00, 0x00, // maxMemType42
				0x00, 0x00, 0x00, 0x00, // minMemType1
				0x00, 0x00, 0x00, 0x00, // maxMemType1
			]);
			const reader = new Reader(data.buffer);
			const table = parsePost(reader);

			expect(table.version).toBeCloseTo(2.5, 2);
			expect(table.numberOfGlyphs).toBeUndefined();
		});

		test("parses version 3.0 format", () => {
			const data = new Uint8Array([
				0x00, 0x03, 0x00, 0x00, // version 3.0
				0x00, 0x00, 0x00, 0x00, // italicAngle (fixed)
				0xff, 0xf0, // underlinePosition
				0x00, 0x32, // underlineThickness
				0x00, 0x00, 0x00, 0x00, // isFixedPitch
				0x00, 0x00, 0x00, 0x00, // minMemType42
				0x00, 0x00, 0x00, 0x00, // maxMemType42
				0x00, 0x00, 0x00, 0x00, // minMemType1
				0x00, 0x00, 0x00, 0x00, // maxMemType1
			]);
			const reader = new Reader(data.buffer);
			const table = parsePost(reader);

			expect(table.version).toBe(3.0);
			expect(table.numberOfGlyphs).toBeUndefined();
		});

		test("parses version 4.0 format", () => {
			const data = new Uint8Array([
				0x00, 0x04, 0x00, 0x00, // version 4.0
				0x00, 0x00, 0x00, 0x00, // italicAngle (fixed)
				0xff, 0xf0, // underlinePosition
				0x00, 0x32, // underlineThickness
				0x00, 0x00, 0x00, 0x00, // isFixedPitch
				0x00, 0x00, 0x00, 0x00, // minMemType42
				0x00, 0x00, 0x00, 0x00, // maxMemType42
				0x00, 0x00, 0x00, 0x00, // minMemType1
				0x00, 0x00, 0x00, 0x00, // maxMemType1
			]);
			const reader = new Reader(data.buffer);
			const table = parsePost(reader);

			expect(table.version).toBe(4.0);
			expect(table.numberOfGlyphs).toBeUndefined();
		});

		test("parses italic angle as fixed-point", () => {
			const data = new Uint8Array([
				0x00, 0x01, 0x00, 0x00, // version 1.0
				0xff, 0xf0, 0x00, 0x00, // italicAngle -16.0 (fixed)
				0xff, 0xf0, // underlinePosition
				0x00, 0x32, // underlineThickness
				0x00, 0x00, 0x00, 0x00, // isFixedPitch
				0x00, 0x00, 0x00, 0x00, // minMemType42
				0x00, 0x00, 0x00, 0x00, // maxMemType42
				0x00, 0x00, 0x00, 0x00, // minMemType1
				0x00, 0x00, 0x00, 0x00, // maxMemType1
			]);
			const reader = new Reader(data.buffer);
			const table = parsePost(reader);

			expect(table.italicAngle).toBeCloseTo(-16.0, 1);
		});

		test("parses isFixedPitch correctly", () => {
			const data = new Uint8Array([
				0x00, 0x01, 0x00, 0x00, // version 1.0
				0x00, 0x00, 0x00, 0x00, // italicAngle (fixed)
				0xff, 0xf0, // underlinePosition
				0x00, 0x32, // underlineThickness
				0x00, 0x00, 0x00, 0x01, // isFixedPitch: 1
				0x00, 0x00, 0x00, 0x00, // minMemType42
				0x00, 0x00, 0x00, 0x00, // maxMemType42
				0x00, 0x00, 0x00, 0x00, // minMemType1
				0x00, 0x00, 0x00, 0x00, // maxMemType1
			]);
			const reader = new Reader(data.buffer);
			const table = parsePost(reader);

			expect(table.isFixedPitch).toBe(1);
		});
	});

	describe("getGlyphName", () => {
		describe("version 1.0", () => {
			test("returns standard names for version 1.0", () => {
				const table: PostTable = {
					version: 1.0,
					italicAngle: 0,
					underlinePosition: -100,
					underlineThickness: 50,
					isFixedPitch: 0,
					minMemType42: 0,
					maxMemType42: 0,
					minMemType1: 0,
					maxMemType1: 0,
				};

				expect(getGlyphName(table, 0)).toBe(".notdef");
				expect(getGlyphName(table, 1)).toBe(".null");
				expect(getGlyphName(table, 3)).toBe("space");
				expect(getGlyphName(table, 4)).toBe("exclam");
				expect(getGlyphName(table, 61)).toBe("Z");
				expect(getGlyphName(table, 93)).toBe("z");
			});

			test("returns null for out of range indices in version 1.0", () => {
				const table: PostTable = {
					version: 1.0,
					italicAngle: 0,
					underlinePosition: -100,
					underlineThickness: 50,
					isFixedPitch: 0,
					minMemType42: 0,
					maxMemType42: 0,
					minMemType1: 0,
					maxMemType1: 0,
				};

				expect(getGlyphName(table, 258)).toBe(null);
				expect(getGlyphName(table, 300)).toBe(null);
				expect(getGlyphName(table, 1000)).toBe(null);
			});

			test("handles boundary case at index 257", () => {
				const table: PostTable = {
					version: 1.0,
					italicAngle: 0,
					underlinePosition: -100,
					underlineThickness: 50,
					isFixedPitch: 0,
					minMemType42: 0,
					maxMemType42: 0,
					minMemType1: 0,
					maxMemType1: 0,
				};

				expect(getGlyphName(table, 257)).toBe("dcroat");
			});
		});

		describe("version 2.0", () => {
			test("returns standard names for version 2.0", () => {
				const table: PostTable = {
					version: 2.0,
					italicAngle: 0,
					underlinePosition: -100,
					underlineThickness: 50,
					isFixedPitch: 0,
					minMemType42: 0,
					maxMemType42: 0,
					minMemType1: 0,
					maxMemType1: 0,
					numberOfGlyphs: 5,
					glyphNameIndex: [0, 4, 61, 93, 257],
					names: [],
				};

				expect(getGlyphName(table, 0)).toBe(".notdef");
				expect(getGlyphName(table, 1)).toBe("exclam");
				expect(getGlyphName(table, 2)).toBe("Z");
				expect(getGlyphName(table, 3)).toBe("z");
				expect(getGlyphName(table, 4)).toBe("dcroat");
			});

			test("returns custom names for version 2.0", () => {
				const table: PostTable = {
					version: 2.0,
					italicAngle: 0,
					underlinePosition: -100,
					underlineThickness: 50,
					isFixedPitch: 0,
					minMemType42: 0,
					maxMemType42: 0,
					minMemType1: 0,
					maxMemType1: 0,
					numberOfGlyphs: 4,
					glyphNameIndex: [0, 258, 259, 260],
					names: ["customA", "customB", "customC"],
				};

				expect(getGlyphName(table, 0)).toBe(".notdef");
				expect(getGlyphName(table, 1)).toBe("customA");
				expect(getGlyphName(table, 2)).toBe("customB");
				expect(getGlyphName(table, 3)).toBe("customC");
			});

			test("returns null for undefined index in version 2.0", () => {
				const table: PostTable = {
					version: 2.0,
					italicAngle: 0,
					underlinePosition: -100,
					underlineThickness: 50,
					isFixedPitch: 0,
					minMemType42: 0,
					maxMemType42: 0,
					minMemType1: 0,
					maxMemType1: 0,
					numberOfGlyphs: 3,
					glyphNameIndex: [0, 4, 37],
					names: [],
				};

				expect(getGlyphName(table, 5)).toBe(null);
				expect(getGlyphName(table, 100)).toBe(null);
			});

			test("returns null for missing custom name", () => {
				const table: PostTable = {
					version: 2.0,
					italicAngle: 0,
					underlinePosition: -100,
					underlineThickness: 50,
					isFixedPitch: 0,
					minMemType42: 0,
					maxMemType42: 0,
					minMemType1: 0,
					maxMemType1: 0,
					numberOfGlyphs: 2,
					glyphNameIndex: [0, 260],
					names: ["custom1"],
				};

				expect(getGlyphName(table, 1)).toBe(null);
			});

			test("handles mixed standard and custom names", () => {
				const table: PostTable = {
					version: 2.0,
					italicAngle: 0,
					underlinePosition: -100,
					underlineThickness: 50,
					isFixedPitch: 0,
					minMemType42: 0,
					maxMemType42: 0,
					minMemType1: 0,
					maxMemType1: 0,
					numberOfGlyphs: 6,
					glyphNameIndex: [0, 61, 258, 93, 259, 4],
					names: ["myGlyph1", "myGlyph2"],
				};

				expect(getGlyphName(table, 0)).toBe(".notdef");
				expect(getGlyphName(table, 1)).toBe("Z");
				expect(getGlyphName(table, 2)).toBe("myGlyph1");
				expect(getGlyphName(table, 3)).toBe("z");
				expect(getGlyphName(table, 4)).toBe("myGlyph2");
				expect(getGlyphName(table, 5)).toBe("exclam");
			});

			test("returns null when glyphNameIndex is undefined", () => {
				const table: PostTable = {
					version: 2.0,
					italicAngle: 0,
					underlinePosition: -100,
					underlineThickness: 50,
					isFixedPitch: 0,
					minMemType42: 0,
					maxMemType42: 0,
					minMemType1: 0,
					maxMemType1: 0,
					numberOfGlyphs: 3,
				};

				expect(getGlyphName(table, 0)).toBe(null);
				expect(getGlyphName(table, 1)).toBe(null);
			});
		});

		describe("version 3.0", () => {
			test("returns null for version 3.0", () => {
				const table: PostTable = {
					version: 3.0,
					italicAngle: 0,
					underlinePosition: -100,
					underlineThickness: 50,
					isFixedPitch: 0,
					minMemType42: 0,
					maxMemType42: 0,
					minMemType1: 0,
					maxMemType1: 0,
				};

				expect(getGlyphName(table, 0)).toBe(null);
				expect(getGlyphName(table, 1)).toBe(null);
				expect(getGlyphName(table, 100)).toBe(null);
			});
		});

		describe("other versions", () => {
			test("returns null for version 2.5", () => {
				const table: PostTable = {
					version: 2.5,
					italicAngle: 0,
					underlinePosition: -100,
					underlineThickness: 50,
					isFixedPitch: 0,
					minMemType42: 0,
					maxMemType42: 0,
					minMemType1: 0,
					maxMemType1: 0,
				};

				expect(getGlyphName(table, 0)).toBe(null);
				expect(getGlyphName(table, 100)).toBe(null);
			});

			test("returns null for version 4.0", () => {
				const table: PostTable = {
					version: 4.0,
					italicAngle: 0,
					underlinePosition: -100,
					underlineThickness: 50,
					isFixedPitch: 0,
					minMemType42: 0,
					maxMemType42: 0,
					minMemType1: 0,
					maxMemType1: 0,
				};

				expect(getGlyphName(table, 0)).toBe(null);
				expect(getGlyphName(table, 100)).toBe(null);
			});
		});
	});

	describe("isMonospaced", () => {
		test("returns false for proportional fonts", () => {
			if (!post) return;

			const result = isMonospaced(post);
			expect(typeof result).toBe("boolean");
		});

		test("returns true when isFixedPitch is non-zero", () => {
			const table: PostTable = {
				version: 1.0,
				italicAngle: 0,
				underlinePosition: -100,
				underlineThickness: 50,
				isFixedPitch: 1,
				minMemType42: 0,
				maxMemType42: 0,
				minMemType1: 0,
				maxMemType1: 0,
			};

			expect(isMonospaced(table)).toBe(true);
		});

		test("returns false when isFixedPitch is zero", () => {
			const table: PostTable = {
				version: 1.0,
				italicAngle: 0,
				underlinePosition: -100,
				underlineThickness: 50,
				isFixedPitch: 0,
				minMemType42: 0,
				maxMemType42: 0,
				minMemType1: 0,
				maxMemType1: 0,
			};

			expect(isMonospaced(table)).toBe(false);
		});

		test("returns true for any non-zero isFixedPitch value", () => {
			const table: PostTable = {
				version: 1.0,
				italicAngle: 0,
				underlinePosition: -100,
				underlineThickness: 50,
				isFixedPitch: 42,
				minMemType42: 0,
				maxMemType42: 0,
				minMemType1: 0,
				maxMemType1: 0,
			};

			expect(isMonospaced(table)).toBe(true);
		});
	});

	describe("edge cases", () => {
		test("handles empty custom names array", () => {
			const table: PostTable = {
				version: 2.0,
				italicAngle: 0,
				underlinePosition: -100,
				underlineThickness: 50,
				isFixedPitch: 0,
				minMemType42: 0,
				maxMemType42: 0,
				minMemType1: 0,
				maxMemType1: 0,
				numberOfGlyphs: 2,
				glyphNameIndex: [0, 4],
				names: [],
			};

			expect(getGlyphName(table, 0)).toBe(".notdef");
			expect(getGlyphName(table, 1)).toBe("exclam");
		});

		test("handles large glyph indices", () => {
			const table: PostTable = {
				version: 1.0,
				italicAngle: 0,
				underlinePosition: -100,
				underlineThickness: 50,
				isFixedPitch: 0,
				minMemType42: 0,
				maxMemType42: 0,
				minMemType1: 0,
				maxMemType1: 0,
			};

			expect(getGlyphName(table, 10000)).toBe(null);
		});

		test("handles negative underline values", () => {
			if (!post) return;

			expect(post.underlinePosition).toBeLessThan(0);
			expect(post.underlineThickness).toBeGreaterThan(0);
		});

		test("version 2.0 with zero glyphs", () => {
			const data = new Uint8Array([
				0x00, 0x02, 0x00, 0x00, // version 2.0
				0x00, 0x00, 0x00, 0x00, // italicAngle (fixed)
				0xff, 0xf0, // underlinePosition
				0x00, 0x32, // underlineThickness
				0x00, 0x00, 0x00, 0x00, // isFixedPitch
				0x00, 0x00, 0x00, 0x00, // minMemType42
				0x00, 0x00, 0x00, 0x00, // maxMemType42
				0x00, 0x00, 0x00, 0x00, // minMemType1
				0x00, 0x00, 0x00, 0x00, // maxMemType1
				0x00, 0x00, // numberOfGlyphs: 0
			]);
			const reader = new Reader(data.buffer);
			const table = parsePost(reader);

			expect(table.numberOfGlyphs).toBe(0);
			expect(table.glyphNameIndex?.length).toBe(0);
		});

		test("version 2.0 with only standard names", () => {
			const table: PostTable = {
				version: 2.0,
				italicAngle: 0,
				underlinePosition: -100,
				underlineThickness: 50,
				isFixedPitch: 0,
				minMemType42: 0,
				maxMemType42: 0,
				minMemType1: 0,
				maxMemType1: 0,
				numberOfGlyphs: 258,
				glyphNameIndex: Array.from({ length: 258 }, (_, i) => i),
				names: [],
			};

			for (let i = 0; i < 258; i++) {
				const name = getGlyphName(table, i);
				expect(name).not.toBe(null);
			}
		});
	});

	describe("integration tests", () => {
		test("Arial post table has correct version", () => {
			if (!post) return;

			expect([1.0, 2.0, 2.5, 3.0, 4.0]).toContain(post.version);
		});

		test("Arial is not monospaced", () => {
			if (!post) return;

			expect(isMonospaced(post)).toBe(false);
			expect(post.isFixedPitch).toBe(0);
		});

		test("glyph names work if version 2.0", () => {
			if (!post || post.version !== 2.0) return;

			const name0 = getGlyphName(post, 0);
			expect(name0).toBe(".notdef");
		});

		test("memory fields are non-negative", () => {
			if (!post) return;

			expect(post.minMemType42).toBeGreaterThanOrEqual(0);
			expect(post.maxMemType42).toBeGreaterThanOrEqual(0);
			expect(post.minMemType1).toBeGreaterThanOrEqual(0);
			expect(post.maxMemType1).toBeGreaterThanOrEqual(0);
		});
	});
});
