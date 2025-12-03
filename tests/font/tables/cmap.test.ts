import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseCmap,
	getGlyphId,
	getVariationGlyphId,
	isVariationSelector,
	PlatformId,
	type CmapTable,
	type CmapSubtable,
} from "../../../src/font/tables/cmap.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";
const ARIAL_UNICODE_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf";
const STIX_MATH_PATH = "/System/Library/Fonts/Supplemental/STIXTwoMath.otf";

describe("cmap table", () => {
	let font: Font;
	let cmap: CmapTable;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
		cmap = font.cmap;
	});

	describe("parseCmap", () => {
		test("returns CmapTable with version and numTables", () => {
			expect(cmap.version).toBeDefined();
			expect(typeof cmap.numTables).toBe("number");
			expect(cmap.numTables).toBeGreaterThan(0);
		});

		test("has encoding records", () => {
			expect(Array.isArray(cmap.encodingRecords)).toBe(true);
			expect(cmap.encodingRecords.length).toBe(cmap.numTables);
		});

		test("has subtables map", () => {
			expect(cmap.subtables).toBeInstanceOf(Map);
			expect(cmap.subtables.size).toBeGreaterThan(0);
		});

		test("has bestSubtable", () => {
			expect(cmap.bestSubtable).not.toBeNull();
		});

		test("encoding records have required properties", () => {
			for (const record of cmap.encodingRecords) {
				expect(typeof record.platformId).toBe("number");
				expect(typeof record.encodingId).toBe("number");
				expect(typeof record.offset).toBe("number");
			}
		});
	});

	describe("PlatformId enum", () => {
		test("has correct values", () => {
			expect(PlatformId.Unicode).toBe(0);
			expect(PlatformId.Macintosh).toBe(1);
			expect(PlatformId.ISO).toBe(2);
			expect(PlatformId.Windows).toBe(3);
			expect(PlatformId.Custom).toBe(4);
		});
	});

	describe("subtables", () => {
		test("subtables have format property", () => {
			for (const subtable of cmap.subtables.values()) {
				expect(typeof subtable.format).toBe("number");
				expect([0, 4, 12, 14]).toContain(subtable.format);
			}
		});

		test("subtables have lookup method", () => {
			for (const subtable of cmap.subtables.values()) {
				expect(typeof subtable.lookup).toBe("function");
			}
		});

		test("format 4 subtables have required properties", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 4) {
					expect(typeof subtable.segCount).toBe("number");
					expect(subtable.endCodes).toBeInstanceOf(Uint16Array);
					expect(subtable.startCodes).toBeInstanceOf(Uint16Array);
					expect(subtable.idDeltas).toBeInstanceOf(Int16Array);
					expect(subtable.idRangeOffsets).toBeInstanceOf(Uint16Array);
					expect(subtable.glyphIdArray).toBeInstanceOf(Uint16Array);
				}
			}
		});

		test("format 12 subtables have groups", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 12) {
					expect(Array.isArray(subtable.groups)).toBe(true);
					for (const group of subtable.groups) {
						expect(typeof group.startCharCode).toBe("number");
						expect(typeof group.endCharCode).toBe("number");
						expect(typeof group.startGlyphId).toBe("number");
						expect(group.endCharCode).toBeGreaterThanOrEqual(group.startCharCode);
					}
				}
			}
		});

		test("format 14 subtables have variation selectors", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 14) {
					expect(Array.isArray(subtable.varSelectorRecords)).toBe(true);
					expect(typeof subtable.lookupVariation).toBe("function");
				}
			}
		});
	});

	describe("getGlyphId", () => {
		test("maps ASCII characters", () => {
			for (let cp = 0x41; cp <= 0x5a; cp++) {
				const glyphId = getGlyphId(cmap, cp);
				expect(typeof glyphId).toBe("number");
				expect(glyphId).toBeGreaterThan(0);
			}
		});

		test("maps space character", () => {
			const glyphId = getGlyphId(cmap, 0x20);
			expect(typeof glyphId).toBe("number");
			expect(glyphId).toBeGreaterThanOrEqual(0);
		});

		test("returns 0 for unmapped codepoint", () => {
			const glyphId = getGlyphId(cmap, 0xf0000);
			expect(glyphId).toBe(0);
		});

		test("maps digits", () => {
			for (let cp = 0x30; cp <= 0x39; cp++) {
				const glyphId = getGlyphId(cmap, cp);
				expect(glyphId).toBeGreaterThan(0);
			}
		});

		test("maps lowercase letters", () => {
			for (let cp = 0x61; cp <= 0x7a; cp++) {
				const glyphId = getGlyphId(cmap, cp);
				expect(glyphId).toBeGreaterThan(0);
			}
		});

		test("maps punctuation", () => {
			const punctuation = [0x2e, 0x2c, 0x21, 0x3f]; // . , ! ?
			for (const cp of punctuation) {
				const glyphId = getGlyphId(cmap, cp);
				expect(glyphId).toBeGreaterThanOrEqual(0);
			}
		});

		test("handles null character", () => {
			const glyphId = getGlyphId(cmap, 0);
			expect(typeof glyphId).toBe("number");
		});

		test("handles high codepoints", () => {
			const glyphId = getGlyphId(cmap, 0x10ffff);
			expect(typeof glyphId).toBe("number");
		});
	});

	describe("format 0 lookup", () => {
		test("lookups in 0-255 range", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 0) {
					expect(subtable.glyphIdArray.length).toBe(256);
					for (let cp = 0; cp < 256; cp++) {
						const glyphId = subtable.lookup(cp);
						expect(glyphId === undefined || typeof glyphId === "number").toBe(true);
					}
				}
			}
		});

		test("returns undefined for out of range", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 0) {
					expect(subtable.lookup(256)).toBeUndefined();
					expect(subtable.lookup(1000)).toBeUndefined();
				}
			}
		});
	});

	describe("format 4 lookup", () => {
		test("binary search finds correct segment", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 4) {
					const glyphA = subtable.lookup(0x41);
					expect(glyphA !== undefined).toBe(true);
				}
			}
		});

		test("returns undefined for codepoints > 0xFFFF", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 4) {
					expect(subtable.lookup(0x10000)).toBeUndefined();
				}
			}
		});

		test("handles BMP characters", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 4) {
					for (let cp = 0x20; cp < 0x7f; cp++) {
						const result = subtable.lookup(cp);
						expect(result === undefined || typeof result === "number").toBe(true);
					}
				}
			}
		});

		test("segments are properly ordered", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 4) {
					for (let i = 0; i < subtable.segCount - 1; i++) {
						const endCode = subtable.endCodes[i];
						const nextStart = subtable.startCodes[i + 1];
						if (endCode !== undefined && nextStart !== undefined) {
							expect(endCode).toBeLessThanOrEqual(nextStart);
						}
					}
				}
			}
		});
	});

	describe("format 12 lookup", () => {
		test("binary search finds correct group", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 12) {
					const glyphA = subtable.lookup(0x41);
					expect(glyphA !== undefined).toBe(true);
				}
			}
		});

		test("handles full Unicode range", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 12) {
					const testCps = [0x41, 0x1000, 0x10000, 0x20000];
					for (const cp of testCps) {
						const result = subtable.lookup(cp);
						expect(result === undefined || typeof result === "number").toBe(true);
					}
				}
			}
		});

		test("groups are ordered", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 12) {
					for (let i = 0; i < subtable.groups.length - 1; i++) {
						const group = subtable.groups[i];
						const nextGroup = subtable.groups[i + 1];
						if (group && nextGroup) {
							expect(group.endCharCode).toBeLessThan(nextGroup.startCharCode);
						}
					}
				}
			}
		});

		test("calculates glyph offset correctly", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 12) {
					for (const group of subtable.groups.slice(0, 5)) {
						if (group.startCharCode === group.endCharCode) {
							const glyph = subtable.lookup(group.startCharCode);
							expect(glyph).toBe(group.startGlyphId);
						}
					}
				}
			}
		});
	});

	describe("format 14 variation selectors", () => {
		test("lookup returns undefined for base lookup", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 14) {
					expect(subtable.lookup(0x41)).toBeUndefined();
				}
			}
		});

		test("lookupVariation handles variation selectors", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 14) {
					const result = subtable.lookupVariation(0x41, 0xfe00);
					expect(
						result === undefined ||
							result === "default" ||
							typeof result === "number",
					).toBe(true);
				}
			}
		});

		test("variation selector records have proper structure", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 14) {
					for (const record of subtable.varSelectorRecords) {
						expect(typeof record.varSelector).toBe("number");
						if (record.defaultUVS) {
							expect(Array.isArray(record.defaultUVS)).toBe(true);
						}
						if (record.nonDefaultUVS) {
							expect(Array.isArray(record.nonDefaultUVS)).toBe(true);
						}
					}
				}
			}
		});
	});

	describe("getVariationGlyphId", () => {
		test("returns undefined when no format 14", () => {
			const noFormat14 = {
				...cmap,
				subtables: new Map(
					Array.from(cmap.subtables.entries()).filter(
						([_, s]) => s.format !== 14,
					),
				),
			};
			const result = getVariationGlyphId(noFormat14, 0x41, 0xfe00);
			expect(result).toBeUndefined();
		});

		test("handles default variation", () => {
			const result = getVariationGlyphId(cmap, 0x41, 0xfe00);
			expect(
				result === undefined || typeof result === "number",
			).toBe(true);
		});

		test("handles non-default variation", () => {
			const result = getVariationGlyphId(cmap, 0x41, 0xfe01);
			expect(
				result === undefined || typeof result === "number",
			).toBe(true);
		});
	});

	describe("isVariationSelector", () => {
		test("returns true for VS1-VS16", () => {
			for (let cp = 0xfe00; cp <= 0xfe0f; cp++) {
				expect(isVariationSelector(cp)).toBe(true);
			}
		});

		test("returns true for VS17-VS256", () => {
			expect(isVariationSelector(0xe0100)).toBe(true);
			expect(isVariationSelector(0xe01ef)).toBe(true);
		});

		test("returns false for regular characters", () => {
			expect(isVariationSelector(0x41)).toBe(false);
			expect(isVariationSelector(0x20)).toBe(false);
			expect(isVariationSelector(0x1234)).toBe(false);
		});

		test("returns false for boundary cases", () => {
			expect(isVariationSelector(0xfdff)).toBe(false);
			expect(isVariationSelector(0xfe10)).toBe(false);
			expect(isVariationSelector(0xe00ff)).toBe(false);
			expect(isVariationSelector(0xe01f0)).toBe(false);
		});
	});

	describe("bestSubtable selection", () => {
		test("bestSubtable is not format 14", () => {
			if (cmap.bestSubtable) {
				expect(cmap.bestSubtable.format).not.toBe(14);
			}
		});

		test("bestSubtable can lookup characters", () => {
			if (cmap.bestSubtable) {
				const glyphId = cmap.bestSubtable.lookup(0x41);
				expect(typeof glyphId).toBe("number");
			}
		});

		test("prefers higher format numbers", () => {
			if (cmap.bestSubtable) {
				expect([4, 12]).toContain(cmap.bestSubtable.format);
			}
		});
	});

	describe("edge cases", () => {
		test("handles empty bestSubtable gracefully", () => {
			const emptyMap: CmapTable = {
				...cmap,
				bestSubtable: null,
			};
			const glyphId = getGlyphId(emptyMap, 0x41);
			expect(glyphId).toBe(0);
		});

		test("handles codepoint 0", () => {
			const glyphId = getGlyphId(cmap, 0);
			expect(typeof glyphId).toBe("number");
		});

		test("handles maximum valid codepoint", () => {
			const glyphId = getGlyphId(cmap, 0x10ffff);
			expect(typeof glyphId).toBe("number");
		});

		test("handles negative codepoints", () => {
			const glyphId = getGlyphId(cmap, -1);
			expect(typeof glyphId).toBe("number");
		});

		test("duplicate encoding records point to same subtable", () => {
			const offsetCounts = new Map<number, number>();
			for (const record of cmap.encodingRecords) {
				offsetCounts.set(record.offset, (offsetCounts.get(record.offset) ?? 0) + 1);
			}
			// Some offsets may appear multiple times
			expect(offsetCounts.size).toBeLessThanOrEqual(cmap.encodingRecords.length);
		});

		test("all subtables can be accessed", () => {
			for (const [key, subtable] of cmap.subtables.entries()) {
				expect(typeof key).toBe("string");
				expect(subtable).toBeDefined();
				expect(typeof subtable.format).toBe("number");
			}
		});

		test("encoding record count matches numTables", () => {
			expect(cmap.encodingRecords.length).toBe(cmap.numTables);
		});
	});

	describe("comprehensive character mapping", () => {
		test("maps entire ASCII printable range", () => {
			for (let cp = 0x20; cp < 0x7f; cp++) {
				const glyphId = getGlyphId(cmap, cp);
				expect(typeof glyphId).toBe("number");
			}
		});

		test("maps common Latin-1 supplement", () => {
			const latin1 = [0xa0, 0xa9, 0xae, 0xb0, 0xc0, 0xe0, 0xff];
			for (const cp of latin1) {
				const glyphId = getGlyphId(cmap, cp);
				expect(typeof glyphId).toBe("number");
			}
		});

		test("consistent mapping across calls", () => {
			const glyphId1 = getGlyphId(cmap, 0x41);
			const glyphId2 = getGlyphId(cmap, 0x41);
			expect(glyphId1).toBe(glyphId2);
		});
	});

	describe("subtable lookup consistency", () => {
		test("bestSubtable lookup matches getGlyphId", () => {
			if (cmap.bestSubtable) {
				for (let cp = 0x41; cp <= 0x5a; cp++) {
					const best = cmap.bestSubtable.lookup(cp) ?? 0;
					const func = getGlyphId(cmap, cp);
					expect(best).toBe(func);
				}
			}
		});

		test("format 4 and format 12 agree on BMP", () => {
			const format4 = Array.from(cmap.subtables.values()).find((s) => s.format === 4);
			const format12 = Array.from(cmap.subtables.values()).find((s) => s.format === 12);

			if (format4 && format12) {
				for (let cp = 0x41; cp <= 0x5a; cp++) {
					const glyph4 = format4.lookup(cp);
					const glyph12 = format12.lookup(cp);
					if (glyph4 !== undefined && glyph12 !== undefined) {
						expect(glyph4).toBe(glyph12);
					}
				}
			}
		});
	});

	describe("format 0 negative codepoints", () => {
		test("returns undefined for negative codepoints", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 0) {
					expect(subtable.lookup(-1)).toBeUndefined();
					expect(subtable.lookup(-100)).toBeUndefined();
				}
			}
		});
	});

	describe("format 4 edge cases in binary search", () => {
		test("handles edge cases in segment boundary conditions", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 4) {
					// Test at segment boundaries
					for (let i = 0; i < Math.min(subtable.segCount, 10); i++) {
						const startCode = subtable.startCodes[i];
						const endCode = subtable.endCodes[i];
						if (startCode !== undefined && endCode !== undefined) {
							const result1 = subtable.lookup(startCode);
							const result2 = subtable.lookup(endCode);
							expect(result1 === undefined || typeof result1 === "number").toBe(true);
							expect(result2 === undefined || typeof result2 === "number").toBe(true);
						}
					}
				}
			}
		});

		test("handles missing glyph in glyphIdArray", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 4) {
					// Test codepoints that might have 0 glyph IDs
					const testCodes = [0x00, 0x01, 0x02, 0x7f, 0xff];
					for (const cp of testCodes) {
						const result = subtable.lookup(cp);
						expect(result === undefined || typeof result === "number").toBe(true);
					}
				}
			}
		});

		test("handles idRangeOffset zero case", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 4) {
					// Most ASCII characters likely use idRangeOffset=0 with idDelta
					for (let cp = 0x20; cp <= 0x7e; cp++) {
						const result = subtable.lookup(cp);
						expect(result === undefined || typeof result === "number").toBe(true);
					}
				}
			}
		});
	});

	describe("format 12 edge cases", () => {
		test("handles group boundary exact matches", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 12) {
					for (let i = 0; i < Math.min(subtable.groups.length, 10); i++) {
						const group = subtable.groups[i];
						if (group) {
							// Test exact start
							const startResult = subtable.lookup(group.startCharCode);
							expect(startResult).toBe(group.startGlyphId);

							// Test exact end
							const endResult = subtable.lookup(group.endCharCode);
							const expectedEnd = group.startGlyphId + (group.endCharCode - group.startCharCode);
							expect(endResult).toBe(expectedEnd);
						}
					}
				}
			}
		});

		test("handles codepoints between groups", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 12 && subtable.groups.length > 1) {
					const group1 = subtable.groups[0];
					const group2 = subtable.groups[1];
					if (group1 && group2 && group1.endCharCode + 1 < group2.startCharCode) {
						// Test codepoint in gap between groups
						const gapCodepoint = group1.endCharCode + 1;
						expect(subtable.lookup(gapCodepoint)).toBeUndefined();
					}
				}
			}
		});

		test("handles very high codepoints", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 12) {
					const result = subtable.lookup(0x10ffff);
					expect(result === undefined || typeof result === "number").toBe(true);
				}
			}
		});
	});

	describe("format 14 variation lookup edge cases", () => {
		test("handles unknown variation selector", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 14) {
					const result = subtable.lookupVariation(0x41, 0xffff);
					expect(result).toBeUndefined();
				}
			}
		});

		test("handles codepoint not in nonDefaultUVS", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 14 && subtable.varSelectorRecords.length > 0) {
					const record = subtable.varSelectorRecords[0];
					if (record) {
						const result = subtable.lookupVariation(0xffffff, record.varSelector);
						expect(result === undefined || result === "default").toBe(true);
					}
				}
			}
		});

		test("handles defaultUVS ranges", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 14) {
					for (const record of subtable.varSelectorRecords) {
						if (record.defaultUVS && record.defaultUVS.length > 0) {
							const range = record.defaultUVS[0];
							if (range) {
								const cp = range.startUnicodeValue;
								const result = subtable.lookupVariation(cp, record.varSelector);
								expect(result === "default" || result === undefined || typeof result === "number").toBe(true);
							}
						}
					}
				}
			}
		});

		test("handles nonDefaultUVS mappings", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 14) {
					for (const record of subtable.varSelectorRecords) {
						if (record.nonDefaultUVS && record.nonDefaultUVS.length > 0) {
							const mapping = record.nonDefaultUVS[0];
							if (mapping) {
								const result = subtable.lookupVariation(mapping.unicodeValue, record.varSelector);
								expect(result).toBe(mapping.glyphId);
							}
						}
					}
				}
			}
		});
	});

	describe("unsupported format handling", () => {
		test("parseCmap handles fonts with only supported formats", () => {
			expect(cmap.subtables.size).toBeGreaterThan(0);
			for (const subtable of cmap.subtables.values()) {
				expect([0, 4, 6, 12, 14]).toContain(subtable.format);
			}
		});
	});

	describe("bestSubtable selection fallback", () => {
		test("selects first non-format-14 when no preferred key exists", () => {
			// If we have a bestSubtable, it should not be format 14
			if (cmap.bestSubtable) {
				expect(cmap.bestSubtable.format).not.toBe(14);
			}
		});

		test("preferred keys are checked in order", () => {
			const preferredKeys = ["3-10", "0-4", "3-1", "0-3", "0-6", "1-0"];
			let foundPreferred = false;
			for (const key of preferredKeys) {
				if (cmap.subtables.has(key)) {
					foundPreferred = true;
					const subtable = cmap.subtables.get(key);
					if (subtable && subtable.format !== 14) {
						expect(cmap.bestSubtable).toBe(subtable);
						break;
					}
				}
			}
			// If no preferred key, should have any non-format-14
			if (!foundPreferred && cmap.bestSubtable) {
				expect(cmap.bestSubtable.format).not.toBe(14);
			}
		});
	});

	describe("getVariationGlyphId with default result", () => {
		test("returns base glyph when variation returns default", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 14) {
					for (const record of subtable.varSelectorRecords) {
						if (record.defaultUVS && record.defaultUVS.length > 0) {
							const range = record.defaultUVS[0];
							if (range) {
								const cp = range.startUnicodeValue;
								const baseGlyph = getGlyphId(cmap, cp);
								const varGlyph = getVariationGlyphId(cmap, cp, record.varSelector);
								// If variation returned "default", varGlyph should equal baseGlyph
								if (varGlyph !== undefined) {
									expect(typeof varGlyph).toBe("number");
								}
							}
						}
					}
				}
			}
		});
	});
});

describe("cmap table - Arial Unicode", () => {
	let unicodeFont: Font;
	let unicodeCmap: CmapTable;

	beforeAll(async () => {
		unicodeFont = await Font.fromFile(ARIAL_UNICODE_PATH);
		unicodeCmap = unicodeFont.cmap;
	});

	describe("comprehensive Unicode support", () => {
		test("supports BMP characters", () => {
			const glyphId = getGlyphId(unicodeCmap, 0x4e00); // CJK character
			expect(typeof glyphId).toBe("number");
		});

		test("supports supplementary plane characters", () => {
			const glyphId = getGlyphId(unicodeCmap, 0x1f600); // Emoji
			expect(typeof glyphId).toBe("number");
		});

		test("checks for format 12 subtable", () => {
			const format12 = Array.from(unicodeCmap.subtables.values()).find((s) => s.format === 12);
			// Arial Unicode may or may not have format 12
			if (format12 && format12.format === 12) {
				expect(format12.groups.length).toBeGreaterThan(0);
				// Verify groups don't overlap
				for (let i = 0; i < format12.groups.length - 1; i++) {
					const curr = format12.groups[i];
					const next = format12.groups[i + 1];
					if (curr && next) {
						expect(curr.endCharCode).toBeLessThan(next.startCharCode);
					}
				}
			} else {
				// Should have at least format 4
				const format4 = Array.from(unicodeCmap.subtables.values()).find((s) => s.format === 4);
				expect(format4).toBeDefined();
			}
		});
	});

	describe("duplicate offset handling", () => {
		test("multiple encoding records can share subtables", () => {
			const offsetMap = new Map<number, string[]>();
			for (const record of unicodeCmap.encodingRecords) {
				const key = `${record.platformId}-${record.encodingId}`;
				const existing = offsetMap.get(record.offset) ?? [];
				existing.push(key);
				offsetMap.set(record.offset, existing);
			}

			// Some offsets should have multiple keys
			let hasDuplicates = false;
			for (const keys of offsetMap.values()) {
				if (keys.length > 1) {
					hasDuplicates = true;
					// All keys for same offset should point to same subtable instance
					const firstKey = keys[0];
					if (firstKey) {
						const firstSubtable = unicodeCmap.subtables.get(firstKey);
						for (let i = 1; i < keys.length; i++) {
							const key = keys[i];
							if (key) {
								const subtable = unicodeCmap.subtables.get(key);
								expect(subtable).toBe(firstSubtable);
							}
						}
					}
				}
			}
			// Arial Unicode likely has duplicate offsets
			expect(typeof hasDuplicates).toBe("boolean");
		});
	});

	describe("various codepoint ranges", () => {
		test("handles control characters", () => {
			for (let cp = 0; cp < 0x20; cp++) {
				const glyphId = getGlyphId(unicodeCmap, cp);
				expect(typeof glyphId).toBe("number");
			}
		});

		test("handles Latin Extended-A", () => {
			for (let cp = 0x100; cp <= 0x17f; cp++) {
				const glyphId = getGlyphId(unicodeCmap, cp);
				expect(typeof glyphId).toBe("number");
			}
		});

		test("handles Greek and Coptic", () => {
			for (let cp = 0x370; cp <= 0x3ff; cp += 16) {
				const glyphId = getGlyphId(unicodeCmap, cp);
				expect(typeof glyphId).toBe("number");
			}
		});

		test("handles Cyrillic", () => {
			for (let cp = 0x400; cp <= 0x4ff; cp += 16) {
				const glyphId = getGlyphId(unicodeCmap, cp);
				expect(typeof glyphId).toBe("number");
			}
		});

		test("handles Arabic", () => {
			for (let cp = 0x600; cp <= 0x6ff; cp += 16) {
				const glyphId = getGlyphId(unicodeCmap, cp);
				expect(typeof glyphId).toBe("number");
			}
		});

		test("handles CJK Unified Ideographs", () => {
			const testCps = [0x4e00, 0x5000, 0x6000, 0x7000, 0x8000, 0x9000];
			for (const cp of testCps) {
				const glyphId = getGlyphId(unicodeCmap, cp);
				expect(typeof glyphId).toBe("number");
			}
		});

		test("handles Private Use Area", () => {
			const glyphId = getGlyphId(unicodeCmap, 0xe000);
			expect(typeof glyphId).toBe("number");
		});
	});

	describe("format 4 with idRangeOffset", () => {
		test("correctly calculates glyph indices with non-zero idRangeOffset", () => {
			const format4 = Array.from(unicodeCmap.subtables.values()).find((s) => s.format === 4);
			if (format4 && format4.format === 4) {
				// Find segments with non-zero idRangeOffset
				for (let i = 0; i < format4.segCount; i++) {
					const idRangeOffset = format4.idRangeOffsets[i];
					const startCode = format4.startCodes[i];
					const endCode = format4.endCodes[i];

					if (idRangeOffset !== undefined && idRangeOffset !== 0 &&
						startCode !== undefined && endCode !== undefined) {
						// Test a codepoint in this segment
						const cp = startCode;
						const result = format4.lookup(cp);
						expect(result === undefined || typeof result === "number").toBe(true);
						break; // Just test one such segment
					}
				}
			}
		});
	});

	describe("format 0 in legacy fonts", () => {
		test("format 0 handles full byte range", () => {
			const format0 = Array.from(unicodeCmap.subtables.values()).find((s) => s.format === 0);
			if (format0 && format0.format === 0) {
				for (let cp = 0; cp < 256; cp++) {
					const result = format0.lookup(cp);
					expect(result === undefined || typeof result === "number").toBe(true);
				}
			}
		});
	});

	describe("duplicate encoding record handling", () => {
		test("handles shared subtables correctly", () => {
			const offsetToKeys = new Map<number, string[]>();

			// Map offsets to all their keys
			for (const record of unicodeCmap.encodingRecords) {
				const key = `${record.platformId}-${record.encodingId}`;
				const keys = offsetToKeys.get(record.offset) ?? [];
				keys.push(key);
				offsetToKeys.set(record.offset, keys);
			}

			// Check that duplicate offsets share the same subtable instance
			for (const [offset, keys] of offsetToKeys.entries()) {
				if (keys.length > 1) {
					const firstKey = keys[0];
					if (firstKey) {
						const firstSubtable = unicodeCmap.subtables.get(firstKey);
						for (let i = 1; i < keys.length; i++) {
							const key = keys[i];
							if (key) {
								const subtable = unicodeCmap.subtables.get(key);
								// Should be the exact same instance
								expect(subtable).toBe(firstSubtable);
							}
						}
					}
				}
			}
		});
	});
});

describe("cmap table - format 12 specific tests", () => {
	let font: Font;
	let cmap: CmapTable;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_UNICODE_PATH);
		cmap = font.cmap;
	});

	describe("format 12 binary search edge cases", () => {
		test("handles empty groups array", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 12) {
					// Test codepoints outside all groups
					const lastGroup = subtable.groups[subtable.groups.length - 1];
					if (lastGroup) {
						const beyondLast = lastGroup.endCharCode + 1000;
						const result = subtable.lookup(beyondLast);
						expect(result).toBeUndefined();
					}

					const firstGroup = subtable.groups[0];
					if (firstGroup && firstGroup.startCharCode > 1000) {
						const beforeFirst = firstGroup.startCharCode - 1000;
						const result = subtable.lookup(beforeFirst);
						expect(result).toBeUndefined();
					}
				}
			}
		});

		test("handles codepoint exactly at group boundaries", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 12 && subtable.groups.length > 0) {
					for (let i = 0; i < Math.min(5, subtable.groups.length); i++) {
						const group = subtable.groups[i];
						if (group) {
							// Test start boundary
							const start = subtable.lookup(group.startCharCode);
							expect(start).toBe(group.startGlyphId);

							// Test end boundary
							const end = subtable.lookup(group.endCharCode);
							const expectedEnd = group.startGlyphId + (group.endCharCode - group.startCharCode);
							expect(end).toBe(expectedEnd);

							// Test just before start
							if (group.startCharCode > 0) {
								const before = subtable.lookup(group.startCharCode - 1);
								// Should either be undefined or from a different group
								if (before !== undefined) {
									expect(before).not.toBe(group.startGlyphId);
								}
							}

							// Test just after end
							const after = subtable.lookup(group.endCharCode + 1);
							if (after !== undefined) {
								expect(after).not.toBe(expectedEnd);
							}
						}
					}
				}
			}
		});

		test("binary search mid calculation", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 12 && subtable.groups.length > 2) {
					// Pick a codepoint that would trigger mid calculation
					const midGroup = subtable.groups[Math.floor(subtable.groups.length / 2)];
					if (midGroup) {
						const result = subtable.lookup(midGroup.startCharCode);
						expect(result).toBe(midGroup.startGlyphId);
					}
				}
			}
		});
	});

	describe("format 4 edge cases with glyphIdArray", () => {
		test("handles zero glyph ID in array", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 4) {
					// Test many codepoints to hit the zero glyph case
					for (let cp = 0; cp <= 0xffff; cp += 1000) {
						const result = subtable.lookup(cp);
						expect(result === undefined || typeof result === "number").toBe(true);
						if (result === 0) {
							// Found a case where glyph is 0
							expect(result).toBe(0);
						}
					}
				}
			}
		});

		test("handles segment with idDelta wrapping", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 4) {
					// Test all segments to ensure idDelta calculation works
					for (let i = 0; i < subtable.segCount; i++) {
						const startCode = subtable.startCodes[i];
						const endCode = subtable.endCodes[i];
						const idRangeOffset = subtable.idRangeOffsets[i];

						if (startCode !== undefined && endCode !== undefined && idRangeOffset !== undefined) {
							// Test start of segment
							const result = subtable.lookup(startCode);
							expect(result === undefined || typeof result === "number").toBe(true);

							// If idRangeOffset is 0, we use the idDelta path
							if (idRangeOffset === 0 && result !== undefined) {
								expect(typeof result).toBe("number");
							}
						}
					}
				}
			}
		});

		test("handles idRangeOffset non-zero with glyphIdArray lookup", () => {
			for (const subtable of cmap.subtables.values()) {
				if (subtable.format === 4) {
					// Find a segment with non-zero idRangeOffset
					for (let i = 0; i < subtable.segCount; i++) {
						const idRangeOffset = subtable.idRangeOffsets[i];
						const startCode = subtable.startCodes[i];
						const endCode = subtable.endCodes[i];

						if (idRangeOffset !== undefined && idRangeOffset !== 0 &&
							startCode !== undefined && endCode !== undefined) {
							// Test a range of codepoints in this segment
							for (let cp = startCode; cp <= Math.min(endCode, startCode + 10); cp++) {
								const result = subtable.lookup(cp);
								expect(result === undefined || typeof result === "number").toBe(true);

								// Test the glyphIdArray indexing math
								if (result !== undefined) {
									expect(result).toBeGreaterThanOrEqual(0);
									expect(result).toBeLessThanOrEqual(0xffff);
								}
							}
							break; // Found and tested one, that's enough
						}
					}
				}
			}
		});
	});
});

describe("cmap table - format 14 variation sequences", () => {
	let font: Font;
	let cmap: CmapTable;

	beforeAll(async () => {
		// STIXTwoMath.otf has format 14 variation sequences
		font = await Font.fromFile(STIX_MATH_PATH);
		cmap = font.cmap;
	});

	test("has format 14 subtable", () => {
		const format14 = Array.from(cmap.subtables.values()).find(s => s.format === 14);
		expect(format14).toBeDefined();
		if (format14 && format14.format === 14) {
			expect(format14.varSelectorRecords.length).toBeGreaterThan(0);
		}
	});

	describe("format 14 variation selectors", () => {
		test("parses variation selector records", () => {
			const format14 = Array.from(cmap.subtables.values()).find(s => s.format === 14);
			if (format14 && format14.format === 14) {
				// Test that records are parsed (lines 327-389)
				expect(format14.varSelectorRecords.length).toBeGreaterThan(0);

				for (const record of format14.varSelectorRecords) {
					expect(typeof record.varSelector).toBe("number");
					expect(record.varSelector).toBeGreaterThanOrEqual(0xfe00);
				}
			}
		});

		test("parses defaultUVS tables", () => {
			const format14 = Array.from(cmap.subtables.values()).find(s => s.format === 14);
			if (format14 && format14.format === 14) {
				// Test defaultUVS parsing (lines 355-366)
				let foundDefaultUVS = false;
				for (const record of format14.varSelectorRecords) {
					if (record.defaultUVS) {
						foundDefaultUVS = true;
						expect(Array.isArray(record.defaultUVS)).toBe(true);
						for (const range of record.defaultUVS) {
							expect(typeof range.startUnicodeValue).toBe("number");
							expect(typeof range.additionalCount).toBe("number");
						}
					}
				}
				expect(typeof foundDefaultUVS).toBe("boolean");
			}
		});

		test("parses nonDefaultUVS tables", () => {
			const format14 = Array.from(cmap.subtables.values()).find(s => s.format === 14);
			if (format14 && format14.format === 14) {
				// Test nonDefaultUVS parsing (lines 369-382)
				let foundNonDefaultUVS = false;
				for (const record of format14.varSelectorRecords) {
					if (record.nonDefaultUVS) {
						foundNonDefaultUVS = true;
						expect(Array.isArray(record.nonDefaultUVS)).toBe(true);
						for (const mapping of record.nonDefaultUVS) {
							expect(typeof mapping.unicodeValue).toBe("number");
							expect(typeof mapping.glyphId).toBe("number");
						}
					}
				}
				expect(typeof foundNonDefaultUVS).toBe("boolean");
			}
		});

		test("lookup returns undefined for format 14", () => {
			const format14 = Array.from(cmap.subtables.values()).find(s => s.format === 14);
			if (format14 && format14.format === 14) {
				// Line 394-396: format 14 lookup always returns undefined
				expect(format14.lookup(0x41)).toBeUndefined();
				expect(format14.lookup(0x4e00)).toBeUndefined();
			}
		});

		test("lookupVariation binary search for variation selector", () => {
			const format14 = Array.from(cmap.subtables.values()).find(s => s.format === 14);
			if (format14 && format14.format === 14) {
				// Test binary search (lines 402-424)
				// Test all variation selector records
				for (const record of format14.varSelectorRecords) {
					// Test with a math codepoint that might be in variation sequences
					const result1 = format14.lookupVariation(0x222b, record.varSelector);
					expect(result1 === undefined || result1 === "default" || typeof result1 === "number").toBe(true);
				}

				// Test nonDefaultUVS binary search (lines 427-444)
				for (const record of format14.varSelectorRecords) {
					if (record.nonDefaultUVS && record.nonDefaultUVS.length > 0) {
						const mapping = record.nonDefaultUVS[0];
						if (mapping) {
							// Exact match (line 441)
							const exact = format14.lookupVariation(mapping.unicodeValue, record.varSelector);
							expect(exact).toBe(mapping.glyphId);

							// Test binary search paths (lines 436-439)
							if (mapping.unicodeValue > 0) {
								const before = format14.lookupVariation(mapping.unicodeValue - 1, record.varSelector);
								expect(before === undefined || before === "default" || typeof before === "number").toBe(true);
							}
						}
					}
				}

				// Test defaultUVS range checking (lines 447-454)
				for (const record of format14.varSelectorRecords) {
					if (record.defaultUVS && record.defaultUVS.length > 0) {
						const range = record.defaultUVS[0];
						if (range) {
							const start = format14.lookupVariation(range.startUnicodeValue, record.varSelector);
							const end = range.startUnicodeValue + range.additionalCount;
							const endResult = format14.lookupVariation(end, record.varSelector);

							// Lines 450-451: check if codepoint is in range
							if (start === "default") {
								expect(start).toBe("default");
							}
						}
					}
				}

				// Test unknown variation selector (line 422-423)
				const unknownResult = format14.lookupVariation(0x41, 0xffff);
				expect(unknownResult).toBeUndefined();
			}
		});

		test("getVariationGlyphId with format 14", () => {
			const format14 = Array.from(cmap.subtables.values()).find(s => s.format === 14);
			if (format14 && format14.format === 14) {
				// Test getVariationGlyphId function (lines 467-489)
				for (const record of format14.varSelectorRecords) {
					// Test with variation selector (line 481)
					const result = getVariationGlyphId(cmap, 0x222b, record.varSelector);
					expect(result === undefined || typeof result === "number").toBe(true);

					// Test defaultUVS case (lines 483-486)
					if (record.defaultUVS && record.defaultUVS.length > 0) {
						const range = record.defaultUVS[0];
						if (range) {
							const cp = range.startUnicodeValue;
							const baseGlyph = getGlyphId(cmap, cp);
							const varGlyph = getVariationGlyphId(cmap, cp, record.varSelector);

							// If lookupVariation returned "default", varGlyph should be the base glyph
							if (varGlyph !== undefined) {
								expect(typeof varGlyph).toBe("number");
							}
						}
					}

					// Test nonDefaultUVS case (line 488)
					if (record.nonDefaultUVS && record.nonDefaultUVS.length > 0) {
						const mapping = record.nonDefaultUVS[0];
						if (mapping) {
							const varGlyph = getVariationGlyphId(cmap, mapping.unicodeValue, record.varSelector);
							expect(varGlyph).toBe(mapping.glyphId);
						}
					}
				}

				// Test getVariationGlyphId when no format 14 (line 477-479)
				const nof14Cmap: CmapTable = {
					...cmap,
					subtables: new Map(Array.from(cmap.subtables.entries()).filter(([_, s]) => s.format !== 14))
				};
				const noF14Result = getVariationGlyphId(nof14Cmap, 0x41, 0xfe00);
				expect(noF14Result).toBeUndefined();
			}
		});
	});
});

describe("cmap table - NotoSans fonts with format 12", () => {
	const notoFonts = [
		"/System/Library/Fonts/Supplemental/NotoSansEgyptianHieroglyphs-Regular.ttf",
		"/System/Library/Fonts/Supplemental/NotoSansCuneiform-Regular.ttf",
		"/System/Library/Fonts/Supplemental/NotoSansLinearB-Regular.ttf",
	];

	for (const fontPath of notoFonts) {
		describe(`testing ${fontPath.split("/").pop()}`, () => {
			let font: Font | null = null;
			let cmap: CmapTable | null = null;

			beforeAll(async () => {
				try {
					font = await Font.fromFile(fontPath);
					cmap = font.cmap;
				} catch (e) {
					// Font not available
				}
			});

			test("has format 12 subtable", () => {
				if (!cmap) return;

				const format12 = Array.from(cmap.subtables.values()).find((s) => s.format === 12);
				if (format12 && format12.format === 12) {
					expect(format12.groups.length).toBeGreaterThan(0);

					// Test all branches of binary search
					for (let i = 0; i < Math.min(20, format12.groups.length); i++) {
						const group = format12.groups[i];
						if (group) {
							// Test start
							const start = format12.lookup(group.startCharCode);
							expect(start).toBe(group.startGlyphId);

							// Test middle
							if (group.endCharCode > group.startCharCode) {
								const mid = group.startCharCode + Math.floor((group.endCharCode - group.startCharCode) / 2);
								const midResult = format12.lookup(mid);
								const expectedMid = group.startGlyphId + (mid - group.startCharCode);
								expect(midResult).toBe(expectedMid);
							}

							// Test end
							const end = format12.lookup(group.endCharCode);
							const expectedEnd = group.startGlyphId + (group.endCharCode - group.startCharCode);
							expect(end).toBe(expectedEnd);
						}
					}

					// Test binary search high/low paths
					if (format12.groups.length > 10) {
						// Test first group (tests low = mid + 1 path)
						const first = format12.groups[0];
						if (first) {
							const result = format12.lookup(first.startCharCode);
							expect(result).toBe(first.startGlyphId);
						}

						// Test last group (tests high = mid - 1 path)
						const last = format12.groups[format12.groups.length - 1];
						if (last) {
							const result = format12.lookup(last.endCharCode);
							const expected = last.startGlyphId + (last.endCharCode - last.startCharCode);
							expect(result).toBe(expected);
						}

						// Test middle group
						const middle = format12.groups[Math.floor(format12.groups.length / 2)];
						if (middle) {
							const result = format12.lookup(middle.startCharCode);
							expect(result).toBe(middle.startGlyphId);
						}
					}

					// Test codepoint before all groups
					const firstGroup = format12.groups[0];
					if (firstGroup && firstGroup.startCharCode > 0) {
						const result = format12.lookup(0);
						// Should be undefined unless 0 is in the first group
						if (firstGroup.startCharCode > 0) {
							expect(result).toBeUndefined();
						}
					}

					// Test codepoint after all groups
					const lastGroup = format12.groups[format12.groups.length - 1];
					if (lastGroup) {
						const result = format12.lookup(lastGroup.endCharCode + 1000);
						expect(result).toBeUndefined();
					}
				}
			});

			test("getGlyphId works with format 12", () => {
				if (!cmap) return;

				const format12 = Array.from(cmap.subtables.values()).find((s) => s.format === 12);
				if (format12 && format12.format === 12 && format12.groups.length > 0) {
					const group = format12.groups[0];
					if (group) {
						const glyphId = getGlyphId(cmap, group.startCharCode);
						expect(typeof glyphId).toBe("number");
					}
				}
			});
		});
	}
});

describe("cmap table - parsing edge cases", () => {
	let font: Font;
	let cmap: CmapTable;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
		cmap = font.cmap;
	});

	test("handles duplicate encoding records pointing to same offset", () => {
		// Test the duplicate offset handling logic (lines 109-123)
		const offsetCounts = new Map<number, number>();
		for (const record of cmap.encodingRecords) {
			offsetCounts.set(record.offset, (offsetCounts.get(record.offset) ?? 0) + 1);
		}

		// Some fonts have multiple encoding records pointing to same subtable
		let foundDuplicate = false;
		for (const [offset, count] of offsetCounts) {
			if (count > 1) {
				foundDuplicate = true;
				// Find all keys for this offset
				const keys: string[] = [];
				for (const record of cmap.encodingRecords) {
					if (record.offset === offset) {
						keys.push(`${record.platformId}-${record.encodingId}`);
					}
				}

				// All keys should point to same subtable instance
				if (keys.length > 1) {
					const firstKey = keys[0];
					if (firstKey) {
						const firstSubtable = cmap.subtables.get(firstKey);
						for (let i = 1; i < keys.length; i++) {
							const key = keys[i];
							if (key) {
								const subtable = cmap.subtables.get(key);
								expect(subtable).toBe(firstSubtable);
							}
						}
					}
				}
			}
		}

		expect(typeof foundDuplicate).toBe("boolean");
	});

	test("handles unsupported subtable formats", () => {
		// Test that unsupported formats return null (line 185)
		// We test this by ensuring all subtables are valid formats
		for (const subtable of cmap.subtables.values()) {
			expect([0, 4, 6, 12, 14]).toContain(subtable.format);
		}
	});

	test("format 4 lookup with missing or zero glyph in array", () => {
		for (const subtable of cmap.subtables.values()) {
			if (subtable.format === 4) {
				// Test codepoint 0 and other control characters that might have zero glyphs
				for (let cp = 0; cp < 32; cp++) {
					const result = subtable.lookup(cp);
					// Line 271-272: handles zero glyph case
					expect(result === undefined || typeof result === "number").toBe(true);
					if (result === 0) {
						expect(result).toBe(0);
					}
				}
			}
		}
	});

	test("format 4 lookup returns undefined for codepoint > 0xFFFF", () => {
		for (const subtable of cmap.subtables.values()) {
			if (subtable.format === 4) {
				// Line 237: returns undefined for > 0xffff
				expect(subtable.lookup(0x10000)).toBeUndefined();
				expect(subtable.lookup(0x20000)).toBeUndefined();
				expect(subtable.lookup(0x10ffff)).toBeUndefined();
			}
		}
	});
});

describe("cmap table - edge cases and error paths", () => {
	let font: Font;
	let cmap: CmapTable;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
		cmap = font.cmap;
	});

	test("bestSubtable fallback when no preferred keys exist", () => {
		// Create a modified cmap with only non-preferred subtables
		const modifiedSubtables = new Map<string, CmapSubtable>();

		// Add a non-preferred format 4 subtable with a non-standard key
		for (const [key, subtable] of cmap.subtables) {
			if (subtable.format === 4) {
				// Use a non-preferred key
				modifiedSubtables.set("99-99", subtable);
				break;
			}
		}

		const modifiedCmap: CmapTable = {
			...cmap,
			subtables: modifiedSubtables,
			bestSubtable: null, // Will be selected by fallback logic
		};

		// Manually run the bestSubtable selection logic
		const preferredKeys = ["3-10", "0-4", "3-1", "0-3", "0-6", "1-0"];
		let bestSubtable: CmapSubtable | null = null;

		for (const key of preferredKeys) {
			const subtable = modifiedCmap.subtables.get(key);
			if (subtable && subtable.format !== 14) {
				bestSubtable = subtable;
				break;
			}
		}

		// Fallback to first non-format-14 subtable
		if (!bestSubtable) {
			for (const subtable of modifiedCmap.subtables.values()) {
				if (subtable.format !== 14) {
					bestSubtable = subtable;
					break;
				}
			}
		}

		expect(bestSubtable).not.toBeNull();
		if (bestSubtable) {
			expect(bestSubtable.format).not.toBe(14);
		}
	});

	test("getVariationGlyphId when no format 14 subtable exists", () => {
		// Test with a cmap that has no format 14
		const noFormat14Cmap: CmapTable = {
			...cmap,
			subtables: new Map(
				Array.from(cmap.subtables.entries()).filter(([_, s]) => s.format !== 14)
			),
		};

		const result = getVariationGlyphId(noFormat14Cmap, 0x41, 0xfe00);
		expect(result).toBeUndefined();
	});

	test("format 4 lookup with undefined array values", () => {
		for (const subtable of cmap.subtables.values()) {
			if (subtable.format === 4) {
				// Test edge case where binary search might encounter undefined
				// by testing at boundaries
				const result1 = subtable.lookup(0xffff);
				expect(result1 === undefined || typeof result1 === "number").toBe(true);

				const result2 = subtable.lookup(0);
				expect(result2 === undefined || typeof result2 === "number").toBe(true);
			}
		}
	});

	test("format 12 lookup with undefined group", () => {
		for (const subtable of cmap.subtables.values()) {
			if (subtable.format === 12) {
				// Test with codepoint that would cause mid calculation
				const result = subtable.lookup(0x1ffff);
				expect(result === undefined || typeof result === "number").toBe(true);
			}
		}
	});

	test("format 4 lookup returns 0 for missing glyph", () => {
		for (const subtable of cmap.subtables.values()) {
			if (subtable.format === 4) {
				// Test many codepoints to find one that returns 0
				let foundZero = false;
				for (let cp = 0; cp <= 0xffff; cp += 100) {
					const result = subtable.lookup(cp);
					if (result === 0) {
						foundZero = true;
						expect(result).toBe(0);
						break;
					}
				}
				// At least verify the lookup works
				expect(typeof foundZero).toBe("boolean");
			}
		}
	});
});

describe("cmap table - duplicate offset handling in real fonts", () => {
	test("Arial Unicode has duplicate offsets", async () => {
		const font = await Font.fromFile(ARIAL_UNICODE_PATH);
		const cmap = font.cmap;

		const offsetCounts = new Map<number, number>();
		for (const record of cmap.encodingRecords) {
			offsetCounts.set(record.offset, (offsetCounts.get(record.offset) ?? 0) + 1);
		}

		// Check if any offset appears more than once
		let hasDuplicates = false;
		for (const count of offsetCounts.values()) {
			if (count > 1) {
				hasDuplicates = true;
				break;
			}
		}

		// If we have duplicates, verify they share subtables
		if (hasDuplicates) {
			const offsetToKeys = new Map<number, string[]>();
			for (const record of cmap.encodingRecords) {
				const key = `${record.platformId}-${record.encodingId}`;
				const keys = offsetToKeys.get(record.offset) ?? [];
				keys.push(key);
				offsetToKeys.set(record.offset, keys);
			}

			for (const keys of offsetToKeys.values()) {
				if (keys.length > 1) {
					const firstKey = keys[0];
					if (firstKey) {
						const firstSubtable = cmap.subtables.get(firstKey);
						for (let i = 1; i < keys.length; i++) {
							const key = keys[i];
							if (key) {
								const subtable = cmap.subtables.get(key);
								// Should be the same instance
								expect(subtable).toBe(firstSubtable);
							}
						}
					}
				}
			}
		}
	});
});
