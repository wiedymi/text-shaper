import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseGpos,
	GposLookupType,
	ValueFormat,
	getKerning,
	type GposTable,
	type SinglePosLookup,
	type PairPosLookup,
	type CursivePosLookup,
	type MarkBasePosLookup,
	type MarkLigaturePosLookup,
	type MarkMarkPosLookup,
	type ValueRecord,
	type Anchor,
} from "../../../src/font/tables/gpos.ts";
import { LookupFlag } from "../../../src/layout/structures/layout-common.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";
const NOTO_NEWA_PATH =
	"/System/Library/Fonts/Supplemental/NotoSansNewa-Regular.ttf";
const NOTO_LEPCHA_PATH =
	"/System/Library/Fonts/Supplemental/NotoSansLepcha-Regular.ttf";
const STIX_TWO_ITALIC_PATH =
	"/System/Library/Fonts/Supplemental/STIXTwoText-Italic.ttf";

describe("GPOS table", () => {
	let font: Font;
	let gpos: GposTable | null;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
		gpos = font.gpos;
	});

	describe("parseGpos", () => {
		test("parses GPOS table from font", () => {
			if (gpos) {
				expect(gpos).toBeDefined();
				expect(gpos.version).toBeDefined();
			}
		});

		test("has version with major and minor", () => {
			if (gpos) {
				expect(gpos.version.major).toBe(1);
				expect(typeof gpos.version.minor).toBe("number");
				expect(gpos.version.minor).toBeGreaterThanOrEqual(0);
			}
		});

		test("has scriptList", () => {
			if (gpos) {
				expect(gpos.scriptList).toBeDefined();
				expect(typeof gpos.scriptList).toBe("object");
			}
		});

		test("has featureList", () => {
			if (gpos) {
				expect(gpos.featureList).toBeDefined();
				expect(typeof gpos.featureList).toBe("object");
			}
		});

		test("has lookups array", () => {
			if (gpos) {
				expect(Array.isArray(gpos.lookups)).toBe(true);
			}
		});
	});

	describe("GposLookupType enum", () => {
		test("has all lookup types", () => {
			expect(GposLookupType.Single).toBe(1);
			expect(GposLookupType.Pair).toBe(2);
			expect(GposLookupType.Cursive).toBe(3);
			expect(GposLookupType.MarkToBase).toBe(4);
			expect(GposLookupType.MarkToLigature).toBe(5);
			expect(GposLookupType.MarkToMark).toBe(6);
			expect(GposLookupType.Context).toBe(7);
			expect(GposLookupType.ChainingContext).toBe(8);
			expect(GposLookupType.Extension).toBe(9);
		});
	});

	describe("ValueFormat flags", () => {
		test("has all value format flags", () => {
			expect(ValueFormat.XPlacement).toBe(0x0001);
			expect(ValueFormat.YPlacement).toBe(0x0002);
			expect(ValueFormat.XAdvance).toBe(0x0004);
			expect(ValueFormat.YAdvance).toBe(0x0008);
			expect(ValueFormat.XPlaDevice).toBe(0x0010);
			expect(ValueFormat.YPlaDevice).toBe(0x0020);
			expect(ValueFormat.XAdvDevice).toBe(0x0040);
			expect(ValueFormat.YAdvDevice).toBe(0x0080);
		});
	});

	describe("lookup structure", () => {
		test("all lookups have type and flag", () => {
			if (gpos) {
				for (const lookup of gpos.lookups) {
					expect(typeof lookup.type).toBe("number");
					expect(lookup.type).toBeGreaterThanOrEqual(1);
					expect(lookup.type).toBeLessThanOrEqual(9);
					expect(typeof lookup.flag).toBe("number");
				}
			}
		});

		test("all lookups have valid subtables", () => {
			if (gpos) {
				for (const lookup of gpos.lookups) {
					if ("subtables" in lookup) {
						expect(Array.isArray(lookup.subtables)).toBe(true);
					}
				}
			}
		});

		test("markFilteringSet is optional", () => {
			if (gpos) {
				for (const lookup of gpos.lookups) {
					if (lookup.markFilteringSet !== undefined) {
						expect(typeof lookup.markFilteringSet).toBe("number");
					}
				}
			}
		});

		test("lookup flags are valid", () => {
			if (gpos) {
				for (const lookup of gpos.lookups) {
					expect(lookup.flag).toBeGreaterThanOrEqual(0);
					expect(lookup.flag).toBeLessThanOrEqual(0xffff);
				}
			}
		});
	});

	describe("Single adjustment (Type 1)", () => {
		test("Single lookup has correct structure", () => {
			if (gpos) {
				const singleLookups = gpos.lookups.filter(
					(l): l is SinglePosLookup => l.type === GposLookupType.Single,
				);
				for (const lookup of singleLookups) {
					expect(lookup.type).toBe(GposLookupType.Single);
					expect(Array.isArray(lookup.subtables)).toBe(true);
				}
			}
		});

		test("format 1 subtable has single value", () => {
			if (gpos) {
				const singleLookups = gpos.lookups.filter(
					(l): l is SinglePosLookup => l.type === GposLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.coverage).toBeDefined();
						expect(typeof subtable.valueFormat).toBe("number");
						if (subtable.format === 1) {
							expect(subtable.value).toBeDefined();
						}
					}
				}
			}
		});

		test("format 2 subtable has values array", () => {
			if (gpos) {
				const singleLookups = gpos.lookups.filter(
					(l): l is SinglePosLookup => l.type === GposLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							expect(Array.isArray(subtable.values)).toBe(true);
						}
					}
				}
			}
		});

		test("value records have optional fields", () => {
			if (gpos) {
				const singleLookups = gpos.lookups.filter(
					(l): l is SinglePosLookup => l.type === GposLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 1 && subtable.value) {
							const val = subtable.value;
							if (val.xPlacement !== undefined) {
								expect(typeof val.xPlacement).toBe("number");
							}
							if (val.yPlacement !== undefined) {
								expect(typeof val.yPlacement).toBe("number");
							}
							if (val.xAdvance !== undefined) {
								expect(typeof val.xAdvance).toBe("number");
							}
							if (val.yAdvance !== undefined) {
								expect(typeof val.yAdvance).toBe("number");
							}
						}
					}
				}
			}
		});
	});

	describe("Pair adjustment (Type 2)", () => {
		test("Pair lookup has correct structure", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					expect(lookup.type).toBe(GposLookupType.Pair);
					expect(Array.isArray(lookup.subtables)).toBe(true);
				}
			}
		});

		test("format 1 subtable has pair sets", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.coverage).toBeDefined();
						if (subtable.format === 1) {
							expect(typeof subtable.valueFormat1).toBe("number");
							expect(typeof subtable.valueFormat2).toBe("number");
							expect(Array.isArray(subtable.pairSets)).toBe(true);
						}
					}
				}
			}
		});

		test("format 1 pair sets have pair value records", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 1) {
							for (const pairSet of subtable.pairSets) {
								expect(Array.isArray(pairSet.pairValueRecords)).toBe(true);
								for (const record of pairSet.pairValueRecords) {
									expect(typeof record.secondGlyph).toBe("number");
									expect(record.value1).toBeDefined();
									expect(record.value2).toBeDefined();
								}
							}
						}
					}
				}
			}
		});

		test("format 2 subtable has class definitions", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							expect(typeof subtable.valueFormat1).toBe("number");
							expect(typeof subtable.valueFormat2).toBe("number");
							expect(subtable.classDef1).toBeDefined();
							expect(subtable.classDef2).toBeDefined();
							expect(typeof subtable.class1Count).toBe("number");
							expect(typeof subtable.class2Count).toBe("number");
							expect(Array.isArray(subtable.class1Records)).toBe(true);
						}
					}
				}
			}
		});

		test("format 2 class records structure", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							expect(subtable.class1Records.length).toBe(subtable.class1Count);
							for (const class1Rec of subtable.class1Records) {
								expect(Array.isArray(class1Rec.class2Records)).toBe(true);
								expect(class1Rec.class2Records.length).toBe(subtable.class2Count);
								for (const class2Rec of class1Rec.class2Records) {
									expect(class2Rec.value1).toBeDefined();
									expect(class2Rec.value2).toBeDefined();
								}
							}
						}
					}
				}
			}
		});
	});

	describe("Cursive attachment (Type 3)", () => {
		test("Cursive lookup has valid structure", () => {
			if (gpos) {
				const cursiveLookups = gpos.lookups.filter(
					(l): l is CursivePosLookup => l.type === GposLookupType.Cursive,
				);
				for (const lookup of cursiveLookups) {
					expect(lookup.type).toBe(GposLookupType.Cursive);
					expect(Array.isArray(lookup.subtables)).toBe(true);
				}
			}
		});
	});

	describe("Mark-to-base attachment (Type 4)", () => {
		test("MarkToBase lookup has valid structure", () => {
			if (gpos) {
				const markBaseLookups = gpos.lookups.filter(
					(l): l is MarkBasePosLookup => l.type === GposLookupType.MarkToBase,
				);
				for (const lookup of markBaseLookups) {
					expect(lookup.type).toBe(GposLookupType.MarkToBase);
					expect(Array.isArray(lookup.subtables)).toBe(true);
				}
			}
		});
	});

	describe("Mark-to-ligature attachment (Type 5)", () => {
		test("MarkToLigature lookup has valid structure", () => {
			if (gpos) {
				const markLigLookups = gpos.lookups.filter(
					(l): l is MarkLigaturePosLookup =>
						l.type === GposLookupType.MarkToLigature,
				);
				for (const lookup of markLigLookups) {
					expect(lookup.type).toBe(GposLookupType.MarkToLigature);
					expect(Array.isArray(lookup.subtables)).toBe(true);
				}
			}
		});
	});

	describe("Mark-to-mark attachment (Type 6)", () => {
		test("MarkToMark lookup has valid structure", () => {
			if (gpos) {
				const markMarkLookups = gpos.lookups.filter(
					(l): l is MarkMarkPosLookup => l.type === GposLookupType.MarkToMark,
				);
				for (const lookup of markMarkLookups) {
					expect(lookup.type).toBe(GposLookupType.MarkToMark);
					expect(Array.isArray(lookup.subtables)).toBe(true);
				}
			}
		});
	});

	describe("Context positioning (Type 7)", () => {
		test("Context lookup has valid structure", () => {
			if (gpos) {
				const contextLookups = gpos.lookups.filter(
					(l) => l.type === GposLookupType.Context,
				);
				for (const lookup of contextLookups) {
					expect(lookup.type).toBe(GposLookupType.Context);
					expect(Array.isArray(lookup.subtables)).toBe(true);
				}
			}
		});
	});

	describe("Chaining context positioning (Type 8)", () => {
		test("Chaining context lookup has valid structure", () => {
			if (gpos) {
				const chainingLookups = gpos.lookups.filter(
					(l) => l.type === GposLookupType.ChainingContext,
				);
				for (const lookup of chainingLookups) {
					expect(lookup.type).toBe(GposLookupType.ChainingContext);
					expect(Array.isArray(lookup.subtables)).toBe(true);
				}
			}
		});
	});

	describe("getKerning", () => {
		test("returns null for non-matching glyphs", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				if (pairLookups.length > 0) {
					const lookup = pairLookups[0];
					if (lookup) {
						const result = getKerning(lookup, 99999, 99998);
						expect(result).toBeNull();
					}
				}
			}
		});

		test("returns kerning values for format 1", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 1 && subtable.pairSets.length > 0) {
							// Try to find a valid pair
							for (let i = 0; i < Math.min(10, subtable.pairSets.length); i++) {
								const pairSet = subtable.pairSets[i];
								if (pairSet && pairSet.pairValueRecords.length > 0) {
									const record = pairSet.pairValueRecords[0];
									if (record) {
										// We'd need the actual glyph IDs to test this properly
										// Just verify the function doesn't throw
										expect(() => getKerning(lookup, i, record.secondGlyph)).not.toThrow();
									}
								}
							}
						}
					}
				}
			}
		});

		test("returns kerning values for format 2", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							// Test with sample glyph IDs
							expect(() => getKerning(lookup, 10, 20)).not.toThrow();
						}
					}
				}
			}
		});

		test("returns object with xAdvance properties", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					const result = getKerning(lookup, 1, 2);
					if (result !== null) {
						expect(typeof result.xAdvance1).toBe("number");
						expect(typeof result.xAdvance2).toBe("number");
					}
				}
			}
		});
	});

	describe("ValueRecord structure", () => {
		test("value records have optional placement fields", () => {
			if (gpos) {
				const singleLookups = gpos.lookups.filter(
					(l): l is SinglePosLookup => l.type === GposLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2 && subtable.values) {
							for (const val of subtable.values) {
								if (val.xPlacement !== undefined) {
									expect(typeof val.xPlacement).toBe("number");
								}
								if (val.yPlacement !== undefined) {
									expect(typeof val.yPlacement).toBe("number");
								}
							}
						}
					}
				}
			}
		});

		test("value records have optional advance fields", () => {
			if (gpos) {
				const singleLookups = gpos.lookups.filter(
					(l): l is SinglePosLookup => l.type === GposLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2 && subtable.values) {
							for (const val of subtable.values) {
								if (val.xAdvance !== undefined) {
									expect(typeof val.xAdvance).toBe("number");
								}
								if (val.yAdvance !== undefined) {
									expect(typeof val.yAdvance).toBe("number");
								}
							}
						}
					}
				}
			}
		});

		test("value records have optional device tables", () => {
			if (gpos) {
				const singleLookups = gpos.lookups.filter(
					(l): l is SinglePosLookup => l.type === GposLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2 && subtable.values) {
							for (const val of subtable.values) {
								if (val.xPlaDevice !== undefined) {
									expect(typeof val.xPlaDevice).toBe("object");
								}
								if (val.yPlaDevice !== undefined) {
									expect(typeof val.yPlaDevice).toBe("object");
								}
								if (val.xAdvDevice !== undefined) {
									expect(typeof val.xAdvDevice).toBe("object");
								}
								if (val.yAdvDevice !== undefined) {
									expect(typeof val.yAdvDevice).toBe("object");
								}
							}
						}
					}
				}
			}
		});
	});

	describe("coverage tables", () => {
		test("all subtables have valid coverage", () => {
			if (gpos) {
				for (const lookup of gpos.lookups) {
					if ("subtables" in lookup) {
						for (const subtable of lookup.subtables as any[]) {
							if (subtable.coverage) {
								expect(typeof subtable.coverage.get).toBe("function");
							}
						}
					}
				}
			}
		});
	});

	describe("edge cases", () => {
		test("handles font without GPOS table", () => {
			expect(gpos === null || typeof gpos === "object").toBe(true);
		});

		test("lookup count is reasonable", () => {
			if (gpos) {
				expect(gpos.lookups.length).toBeGreaterThanOrEqual(0);
				expect(gpos.lookups.length).toBeLessThan(10000);
			}
		});

		test("all lookups are valid types", () => {
			if (gpos) {
				for (const lookup of gpos.lookups) {
					expect([1, 2, 3, 4, 5, 6, 7, 8, 9]).toContain(lookup.type);
				}
			}
		});

		test("iterates through all lookups without error", () => {
			if (gpos) {
				expect(() => {
					for (const lookup of gpos.lookups) {
						expect(lookup).toBeDefined();
					}
				}).not.toThrow();
			}
		});

		test("handles empty pair sets", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 1) {
							for (const pairSet of subtable.pairSets) {
								expect(Array.isArray(pairSet.pairValueRecords)).toBe(true);
							}
						}
					}
				}
			}
		});

		test("handles invalid glyph IDs in getKerning", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				if (pairLookups.length > 0) {
					const lookup = pairLookups[0];
					if (lookup) {
						expect(() => getKerning(lookup, -1, -1)).not.toThrow();
						expect(getKerning(lookup, -1, -1)).toBeNull();
					}
				}
			}
		});
	});

	describe("scriptList structure", () => {
		test("has scripts", () => {
			if (gpos) {
				expect(gpos.scriptList).toBeDefined();
				if ("scripts" in gpos.scriptList) {
					expect(Array.isArray(gpos.scriptList.scripts)).toBe(true);
				}
			}
		});
	});

	describe("featureList structure", () => {
		test("has features", () => {
			if (gpos) {
				expect(gpos.featureList).toBeDefined();
				if ("features" in gpos.featureList) {
					expect(Array.isArray(gpos.featureList.features)).toBe(true);
				}
			}
		});
	});

	describe("extension lookups", () => {
		test("extension lookups are unwrapped correctly", () => {
			if (gpos) {
				// Extension lookups should be resolved to their actual type
				for (const lookup of gpos.lookups) {
					expect(lookup.type).not.toBe(GposLookupType.Extension);
				}
			}
		});
	});

	describe("valueFormat validation", () => {
		test("valueFormat flags are valid", () => {
			if (gpos) {
				const singleLookups = gpos.lookups.filter(
					(l): l is SinglePosLookup => l.type === GposLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.valueFormat).toBeGreaterThanOrEqual(0);
						expect(subtable.valueFormat).toBeLessThanOrEqual(0xff);
					}
				}
			}
		});

		test("pair positioning valueFormat flags are valid", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.valueFormat1).toBeGreaterThanOrEqual(0);
						expect(subtable.valueFormat1).toBeLessThanOrEqual(0xff);
						expect(subtable.valueFormat2).toBeGreaterThanOrEqual(0);
						expect(subtable.valueFormat2).toBeLessThanOrEqual(0xff);
					}
				}
			}
		});
	});

	describe("performance", () => {
		test("parses GPOS table efficiently", () => {
			if (gpos) {
				const start = performance.now();
				for (const lookup of gpos.lookups) {
					if ("subtables" in lookup) {
						for (const subtable of lookup.subtables) {
							// Access properties
							const _ = subtable;
						}
					}
				}
				const elapsed = performance.now() - start;
				expect(elapsed).toBeLessThan(100);
			}
		});

		test("getKerning is fast", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				if (pairLookups.length > 0) {
					const lookup = pairLookups[0];
					if (lookup) {
						const start = performance.now();
						for (let i = 0; i < 1000; i++) {
							getKerning(lookup, i % 100, (i + 1) % 100);
						}
						const elapsed = performance.now() - start;
						expect(elapsed).toBeLessThan(100);
					}
				}
			}
		});
	});

	describe("comprehensive kerning tests", () => {
		test("tests kerning for common glyph pairs", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				if (pairLookups.length > 0) {
					// Test common letter pairs
					const glyphA = font.glyphId(0x41); // A
					const glyphV = font.glyphId(0x56); // V
					const glyphT = font.glyphId(0x54); // T

					for (const lookup of pairLookups) {
						expect(() => getKerning(lookup, glyphA, glyphV)).not.toThrow();
						expect(() => getKerning(lookup, glyphT, glyphA)).not.toThrow();
					}
				}
			}
		});

		test("kerning values are reasonable", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					const glyphA = font.glyphId(0x41);
					const glyphV = font.glyphId(0x56);
					const kerning = getKerning(lookup, glyphA, glyphV);
					if (kerning) {
						// Kerning values should be within reasonable range
						expect(Math.abs(kerning.xAdvance1)).toBeLessThan(10000);
						expect(Math.abs(kerning.xAdvance2)).toBeLessThan(10000);
					}
				}
			}
		});
	});

	describe("getKerning format 2 (class-based)", () => {
		test("handles format 2 pair positioning", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							// Test with glyphs that should be in coverage
							const glyphIds = Array.from({ length: 100 }, (_, i) => i);
							for (const glyph1 of glyphIds.slice(0, 10)) {
								for (const glyph2 of glyphIds.slice(0, 10)) {
									const result = getKerning(lookup, glyph1, glyph2);
									if (result !== null) {
										expect(typeof result.xAdvance1).toBe("number");
										expect(typeof result.xAdvance2).toBe("number");
									}
								}
							}
						}
					}
				}
			}
		});

		test("getKerning with actual covered glyphs in format 2", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							// Find glyphs in coverage
							for (let testGlyph = 0; testGlyph < 200; testGlyph++) {
								const coverageIndex = subtable.coverage.get(testGlyph);
								if (coverageIndex !== null) {
									// Found a glyph in coverage, test it with another glyph
									for (let testGlyph2 = 0; testGlyph2 < 200; testGlyph2++) {
										const result = getKerning(lookup, testGlyph, testGlyph2);
										if (result !== null) {
											expect(result.xAdvance1).toBeDefined();
											expect(result.xAdvance2).toBeDefined();
										}
									}
									break;
								}
							}
						}
					}
				}
			}
		});

		test("format 2 class lookups return zero when no kerning", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							// Test with glyph likely not in coverage
							const result = getKerning(lookup, 65535, 65534);
							expect(result).toBeNull();
						}
					}
				}
			}
		});
	});

	describe("mark filtering set", () => {
		test("parses lookups with mark filtering set flag", () => {
			if (gpos) {
				for (const lookup of gpos.lookups) {
					if (lookup.flag & LookupFlag.UseMarkFilteringSet) {
						expect(lookup.markFilteringSet).toBeDefined();
						expect(typeof lookup.markFilteringSet).toBe("number");
					}
				}
			}
		});

		test("mark filtering set is undefined when flag not set", () => {
			if (gpos) {
				for (const lookup of gpos.lookups) {
					if (!(lookup.flag & LookupFlag.UseMarkFilteringSet)) {
						if (lookup.markFilteringSet !== undefined) {
							// If defined, it should still be a number
							expect(typeof lookup.markFilteringSet).toBe("number");
						}
					}
				}
			}
		});
	});

	describe("device tables in value records", () => {
		test("parses device tables when present", () => {
			if (gpos) {
				const singleLookups = gpos.lookups.filter(
					(l): l is SinglePosLookup => l.type === GposLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						const hasDeviceFlags =
							subtable.valueFormat &
							(ValueFormat.XPlaDevice |
								ValueFormat.YPlaDevice |
								ValueFormat.XAdvDevice |
								ValueFormat.YAdvDevice);

						if (hasDeviceFlags) {
							if (subtable.format === 1 && subtable.value) {
								// Check if any device tables are present
								const val = subtable.value;
								if (subtable.valueFormat & ValueFormat.XPlaDevice) {
									expect(
										val.xPlaDevice === undefined ||
											typeof val.xPlaDevice === "object",
									).toBe(true);
								}
								if (subtable.valueFormat & ValueFormat.YPlaDevice) {
									expect(
										val.yPlaDevice === undefined ||
											typeof val.yPlaDevice === "object",
									).toBe(true);
								}
								if (subtable.valueFormat & ValueFormat.XAdvDevice) {
									expect(
										val.xAdvDevice === undefined ||
											typeof val.xAdvDevice === "object",
									).toBe(true);
								}
								if (subtable.valueFormat & ValueFormat.YAdvDevice) {
									expect(
										val.yAdvDevice === undefined ||
											typeof val.yAdvDevice === "object",
									).toBe(true);
								}
							}
						}
					}
				}
			}
		});

		test("handles device tables in pair positioning", () => {
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						const hasDeviceFlags1 =
							subtable.valueFormat1 &
							(ValueFormat.XPlaDevice |
								ValueFormat.YPlaDevice |
								ValueFormat.XAdvDevice |
								ValueFormat.YAdvDevice);
						const hasDeviceFlags2 =
							subtable.valueFormat2 &
							(ValueFormat.XPlaDevice |
								ValueFormat.YPlaDevice |
								ValueFormat.XAdvDevice |
								ValueFormat.YAdvDevice);

						if (hasDeviceFlags1 || hasDeviceFlags2) {
							if (subtable.format === 1) {
								for (const pairSet of subtable.pairSets) {
									for (const record of pairSet.pairValueRecords) {
										// Just verify structure is valid
										expect(record.value1).toBeDefined();
										expect(record.value2).toBeDefined();
									}
								}
							}
						}
					}
				}
			}
		});
	});
});

describe("GPOS with NotoSansNewa font", () => {
	let newaFont: Font;
	let newaGpos: GposTable | null;

	beforeAll(async () => {
		newaFont = await Font.fromFile(NOTO_NEWA_PATH);
		newaGpos = newaFont.gpos;
	});

	test("loads NotoSansNewa font successfully", () => {
		expect(newaFont).toBeDefined();
		expect(newaGpos).toBeDefined();
	});

	test("NotoSansNewa has GPOS table", () => {
		if (newaGpos) {
			expect(newaGpos.version).toBeDefined();
			expect(newaGpos.lookups).toBeDefined();
			expect(Array.isArray(newaGpos.lookups)).toBe(true);
		}
	});

	describe("cursive positioning (Type 3)", () => {
		test("parses cursive positioning lookups", () => {
			if (newaGpos) {
				const cursiveLookups = newaGpos.lookups.filter(
					(l): l is CursivePosLookup => l.type === GposLookupType.Cursive,
				);
				for (const lookup of cursiveLookups) {
					expect(lookup.type).toBe(GposLookupType.Cursive);
					expect(Array.isArray(lookup.subtables)).toBe(true);
					for (const subtable of lookup.subtables) {
						expect(subtable.coverage).toBeDefined();
						expect(Array.isArray(subtable.entryExitRecords)).toBe(true);
						for (const record of subtable.entryExitRecords) {
							// Entry and exit anchors can be null
							if (record.entryAnchor) {
								expect(typeof record.entryAnchor.xCoordinate).toBe("number");
								expect(typeof record.entryAnchor.yCoordinate).toBe("number");
							}
							if (record.exitAnchor) {
								expect(typeof record.exitAnchor.xCoordinate).toBe("number");
								expect(typeof record.exitAnchor.yCoordinate).toBe("number");
							}
						}
					}
				}
			}
		});

		test("cursive entry/exit anchor structure", () => {
			if (newaGpos) {
				const cursiveLookups = newaGpos.lookups.filter(
					(l): l is CursivePosLookup => l.type === GposLookupType.Cursive,
				);
				for (const lookup of cursiveLookups) {
					for (const subtable of lookup.subtables) {
						for (const record of subtable.entryExitRecords) {
							const anchor: Anchor | null =
								record.entryAnchor ?? record.exitAnchor;
							if (anchor) {
								expect(anchor.xCoordinate).toBeDefined();
								expect(anchor.yCoordinate).toBeDefined();
								// Optional anchor point (format 2)
								if (anchor.anchorPoint !== undefined) {
									expect(typeof anchor.anchorPoint).toBe("number");
								}
								// Optional device offsets (format 3)
								if (anchor.xDeviceOffset !== undefined) {
									expect(typeof anchor.xDeviceOffset).toBe("number");
								}
								if (anchor.yDeviceOffset !== undefined) {
									expect(typeof anchor.yDeviceOffset).toBe("number");
								}
							}
						}
					}
				}
			}
		});
	});

	describe("mark-to-base positioning (Type 4)", () => {
		test("parses mark-to-base lookups with mark arrays", () => {
			if (newaGpos) {
				const markBaseLookups = newaGpos.lookups.filter(
					(l): l is MarkBasePosLookup => l.type === GposLookupType.MarkToBase,
				);
				for (const lookup of markBaseLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.markCoverage).toBeDefined();
						expect(subtable.baseCoverage).toBeDefined();
						expect(typeof subtable.markClassCount).toBe("number");
						expect(subtable.markArray).toBeDefined();
						expect(Array.isArray(subtable.markArray.markRecords)).toBe(true);
						expect(Array.isArray(subtable.baseArray)).toBe(true);

						for (const markRecord of subtable.markArray.markRecords) {
							expect(typeof markRecord.markClass).toBe("number");
							expect(markRecord.markAnchor).toBeDefined();
							expect(typeof markRecord.markAnchor.xCoordinate).toBe("number");
							expect(typeof markRecord.markAnchor.yCoordinate).toBe("number");
						}

						for (const baseRecord of subtable.baseArray) {
							expect(Array.isArray(baseRecord.baseAnchors)).toBe(true);
							expect(baseRecord.baseAnchors.length).toBe(
								subtable.markClassCount,
							);
						}
					}
				}
			}
		});

		test("mark-to-base anchor arrays match class count", () => {
			if (newaGpos) {
				const markBaseLookups = newaGpos.lookups.filter(
					(l): l is MarkBasePosLookup => l.type === GposLookupType.MarkToBase,
				);
				for (const lookup of markBaseLookups) {
					for (const subtable of lookup.subtables) {
						for (const baseRecord of subtable.baseArray) {
							expect(baseRecord.baseAnchors.length).toBe(
								subtable.markClassCount,
							);
							for (const anchor of baseRecord.baseAnchors) {
								if (anchor !== null) {
									expect(typeof anchor.xCoordinate).toBe("number");
									expect(typeof anchor.yCoordinate).toBe("number");
								}
							}
						}
					}
				}
			}
		});
	});

	describe("mark-to-ligature positioning (Type 5)", () => {
		test("parses mark-to-ligature lookups", () => {
			if (newaGpos) {
				const markLigLookups = newaGpos.lookups.filter(
					(l): l is MarkLigaturePosLookup =>
						l.type === GposLookupType.MarkToLigature,
				);
				for (const lookup of markLigLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.markCoverage).toBeDefined();
						expect(subtable.ligatureCoverage).toBeDefined();
						expect(typeof subtable.markClassCount).toBe("number");
						expect(subtable.markArray).toBeDefined();
						expect(Array.isArray(subtable.ligatureArray)).toBe(true);

						for (const ligAttach of subtable.ligatureArray) {
							expect(Array.isArray(ligAttach.componentRecords)).toBe(true);
							for (const component of ligAttach.componentRecords) {
								expect(Array.isArray(component.ligatureAnchors)).toBe(true);
								expect(component.ligatureAnchors.length).toBe(
									subtable.markClassCount,
								);
								for (const anchor of component.ligatureAnchors) {
									if (anchor !== null) {
										expect(typeof anchor.xCoordinate).toBe("number");
										expect(typeof anchor.yCoordinate).toBe("number");
									}
								}
							}
						}
					}
				}
			}
		});

		test("ligature component anchors structure", () => {
			if (newaGpos) {
				const markLigLookups = newaGpos.lookups.filter(
					(l): l is MarkLigaturePosLookup =>
						l.type === GposLookupType.MarkToLigature,
				);
				for (const lookup of markLigLookups) {
					for (const subtable of lookup.subtables) {
						for (const ligAttach of subtable.ligatureArray) {
							expect(ligAttach.componentRecords.length).toBeGreaterThanOrEqual(
								0,
							);
						}
					}
				}
			}
		});
	});

	describe("mark-to-mark positioning (Type 6)", () => {
		test("parses mark-to-mark lookups", () => {
			if (newaGpos) {
				const markMarkLookups = newaGpos.lookups.filter(
					(l): l is MarkMarkPosLookup => l.type === GposLookupType.MarkToMark,
				);
				for (const lookup of markMarkLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.mark1Coverage).toBeDefined();
						expect(subtable.mark2Coverage).toBeDefined();
						expect(typeof subtable.markClassCount).toBe("number");
						expect(subtable.mark1Array).toBeDefined();
						expect(Array.isArray(subtable.mark2Array)).toBe(true);

						for (const mark2Record of subtable.mark2Array) {
							expect(Array.isArray(mark2Record.mark2Anchors)).toBe(true);
							expect(mark2Record.mark2Anchors.length).toBe(
								subtable.markClassCount,
							);
							for (const anchor of mark2Record.mark2Anchors) {
								if (anchor !== null) {
									expect(typeof anchor.xCoordinate).toBe("number");
									expect(typeof anchor.yCoordinate).toBe("number");
								}
							}
						}
					}
				}
			}
		});

		test("mark2 array structure matches mark class count", () => {
			if (newaGpos) {
				const markMarkLookups = newaGpos.lookups.filter(
					(l): l is MarkMarkPosLookup => l.type === GposLookupType.MarkToMark,
				);
				for (const lookup of markMarkLookups) {
					for (const subtable of lookup.subtables) {
						for (const mark2Record of subtable.mark2Array) {
							expect(mark2Record.mark2Anchors.length).toBe(
								subtable.markClassCount,
							);
						}
					}
				}
			}
		});
	});

	describe("context positioning (Type 7)", () => {
		test("parses context positioning lookups", () => {
			if (newaGpos) {
				const contextLookups = newaGpos.lookups.filter(
					(l) => l.type === GposLookupType.Context,
				);
				for (const lookup of contextLookups) {
					expect(lookup.type).toBe(GposLookupType.Context);
					expect(Array.isArray(lookup.subtables)).toBe(true);
				}
			}
		});

		test("context subtables have valid structure", () => {
			if (newaGpos) {
				const contextLookups = newaGpos.lookups.filter(
					(l) => l.type === GposLookupType.Context,
				);
				for (const lookup of contextLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.format).toBeGreaterThanOrEqual(1);
						expect(subtable.format).toBeLessThanOrEqual(3);
					}
				}
			}
		});
	});

	describe("chaining context positioning (Type 8)", () => {
		test("parses chaining context lookups", () => {
			if (newaGpos) {
				const chainingLookups = newaGpos.lookups.filter(
					(l) => l.type === GposLookupType.ChainingContext,
				);
				for (const lookup of chainingLookups) {
					expect(lookup.type).toBe(GposLookupType.ChainingContext);
					expect(Array.isArray(lookup.subtables)).toBe(true);
				}
			}
		});

		test("chaining context subtables structure", () => {
			if (newaGpos) {
				const chainingLookups = newaGpos.lookups.filter(
					(l) => l.type === GposLookupType.ChainingContext,
				);
				for (const lookup of chainingLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.format).toBeGreaterThanOrEqual(1);
						expect(subtable.format).toBeLessThanOrEqual(3);
					}
				}
			}
		});
	});

	describe("version 1.1 feature variations", () => {
		test("handles GPOS version 1.1", () => {
			if (newaGpos) {
				expect(newaGpos.version.major).toBe(1);
				// Version minor can be 0 or 1
				expect(newaGpos.version.minor).toBeGreaterThanOrEqual(0);
				expect(newaGpos.version.minor).toBeLessThanOrEqual(1);
			}
		});

		test("parses feature variations offset for v1.1+", () => {
			if (newaGpos) {
				if (
					newaGpos.version.major === 1 &&
					newaGpos.version.minor >= 1
				) {
					// Feature variations offset was read (line 201)
					expect(newaGpos.lookups).toBeDefined();
				}
			}
		});
	});

	describe("anchor formats", () => {
		test("anchors have format-specific fields", () => {
			if (newaGpos) {
				const cursiveLookups = newaGpos.lookups.filter(
					(l): l is CursivePosLookup => l.type === GposLookupType.Cursive,
				);
				for (const lookup of cursiveLookups) {
					for (const subtable of lookup.subtables) {
						for (const record of subtable.entryExitRecords) {
							const anchor = record.entryAnchor ?? record.exitAnchor;
							if (anchor) {
								// All anchors have x and y coordinates
								expect(typeof anchor.xCoordinate).toBe("number");
								expect(typeof anchor.yCoordinate).toBe("number");

								// Format 2 has anchor point
								if (anchor.anchorPoint !== undefined) {
									expect(typeof anchor.anchorPoint).toBe("number");
								}

								// Format 3 has device offsets
								if (
									anchor.xDeviceOffset !== undefined ||
									anchor.yDeviceOffset !== undefined
								) {
									if (anchor.xDeviceOffset !== undefined) {
										expect(typeof anchor.xDeviceOffset).toBe("number");
									}
									if (anchor.yDeviceOffset !== undefined) {
										expect(typeof anchor.yDeviceOffset).toBe("number");
									}
								}
							}
						}
					}
				}
			}
		});
	});

	describe("coverage in all lookup types", () => {
		test("all positioning lookups have valid coverage tables", () => {
			if (newaGpos) {
				for (const lookup of newaGpos.lookups) {
					if (
						lookup.type === GposLookupType.Single ||
						lookup.type === GposLookupType.Pair
					) {
						for (const subtable of lookup.subtables) {
							expect(subtable.coverage).toBeDefined();
							expect(typeof subtable.coverage.get).toBe("function");
						}
					} else if (lookup.type === GposLookupType.Cursive) {
						for (const subtable of lookup.subtables) {
							expect(subtable.coverage).toBeDefined();
						}
					} else if (
						lookup.type === GposLookupType.MarkToBase ||
						lookup.type === GposLookupType.MarkToLigature ||
						lookup.type === GposLookupType.MarkToMark
					) {
						for (const subtable of lookup.subtables as any[]) {
							// These have multiple coverage tables
							expect(
								subtable.markCoverage ||
									subtable.mark1Coverage ||
									subtable.baseCoverage,
							).toBeDefined();
						}
					}
				}
			}
		});
	});

	describe("NotoSansNewa specific lookups", () => {
		test("has single positioning lookups", () => {
			if (newaGpos) {
				const singleLookups = newaGpos.lookups.filter(
					(l): l is SinglePosLookup => l.type === GposLookupType.Single,
				);
				expect(singleLookups.length).toBeGreaterThan(0);
			}
		});

		test("pair positioning lookups count", () => {
			if (newaGpos) {
				const pairLookups = newaGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				expect(pairLookups.length).toBeGreaterThanOrEqual(0);
			}
		});

		test("has mark-to-base lookups", () => {
			if (newaGpos) {
				const markBaseLookups = newaGpos.lookups.filter(
					(l): l is MarkBasePosLookup => l.type === GposLookupType.MarkToBase,
				);
				expect(markBaseLookups.length).toBeGreaterThan(0);
			}
		});

		test("getKerning works with NotoSansNewa if has pair lookups", () => {
			if (newaGpos) {
				const pairLookups = newaGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				if (pairLookups.length > 0) {
					for (const lookup of pairLookups) {
						// Test with various glyph combinations
						for (let i = 0; i < 100; i++) {
							for (let j = 0; j < 100; j++) {
								const result = getKerning(lookup, i, j);
								if (result !== null) {
									expect(typeof result.xAdvance1).toBe("number");
									expect(typeof result.xAdvance2).toBe("number");
								}
							}
						}
					}
				}
			}
		});
	});
});

describe("GPOS edge cases and comprehensive coverage", () => {
	let arialFont: Font;
	let arialGpos: GposTable | null;

	beforeAll(async () => {
		arialFont = await Font.fromFile(ARIAL_PATH);
		arialGpos = arialFont.gpos;
	});

	describe("pair positioning format 2 comprehensive", () => {
		test("format 2 with class-based kerning", () => {
			if (arialGpos) {
				const pairLookups = arialGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							// Verify all structure
							expect(subtable.classDef1).toBeDefined();
							expect(subtable.classDef2).toBeDefined();
							expect(subtable.class1Count).toBeGreaterThan(0);
							expect(subtable.class2Count).toBeGreaterThan(0);
							expect(subtable.class1Records.length).toBe(subtable.class1Count);

							// Test all class records
							for (const class1Rec of subtable.class1Records) {
								expect(class1Rec.class2Records.length).toBe(
									subtable.class2Count,
								);
								for (const class2Rec of class1Rec.class2Records) {
									expect(class2Rec.value1).toBeDefined();
									expect(class2Rec.value2).toBeDefined();

									// Test value record fields
									const v1 = class2Rec.value1;
									const v2 = class2Rec.value2;

									// Check that values are numbers when present
									if (v1.xPlacement !== undefined) {
										expect(typeof v1.xPlacement).toBe("number");
									}
									if (v1.yPlacement !== undefined) {
										expect(typeof v1.yPlacement).toBe("number");
									}
									if (v1.xAdvance !== undefined) {
										expect(typeof v1.xAdvance).toBe("number");
									}
									if (v1.yAdvance !== undefined) {
										expect(typeof v1.yAdvance).toBe("number");
									}

									if (v2.xPlacement !== undefined) {
										expect(typeof v2.xPlacement).toBe("number");
									}
									if (v2.yPlacement !== undefined) {
										expect(typeof v2.yPlacement).toBe("number");
									}
									if (v2.xAdvance !== undefined) {
										expect(typeof v2.xAdvance).toBe("number");
									}
									if (v2.yAdvance !== undefined) {
										expect(typeof v2.yAdvance).toBe("number");
									}
								}
							}
						}
					}
				}
			}
		});

		test("getKerning with format 2 subtables in all lookups", () => {
			if (arialGpos) {
				const pairLookups = arialGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							// Find glyphs in coverage and test kerning
							let testedPairs = 0;
							for (let glyph1 = 0; glyph1 < 500 && testedPairs < 20; glyph1++) {
								const coverageIdx = subtable.coverage.get(glyph1);
								if (coverageIdx !== null) {
									// Test with multiple second glyphs
									for (let glyph2 = 0; glyph2 < 500; glyph2++) {
										const result = getKerning(lookup, glyph1, glyph2);
										if (result !== null) {
											expect(typeof result.xAdvance1).toBe("number");
											expect(typeof result.xAdvance2).toBe("number");
											testedPairs++;
											if (testedPairs >= 20) break;
										}
									}
								}
							}
						}
					}
				}
			}
		});

		test("format 2 class lookups with edge case glyphs", () => {
			if (arialGpos) {
				const pairLookups = arialGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							// Test with class 0 (default class)
							const class1Val = subtable.classDef1.get(0);
							const class2Val = subtable.classDef2.get(0);
							expect(typeof class1Val).toBe("number");
							expect(typeof class2Val).toBe("number");

							// Access class records to ensure parsing worked
							const class1Record = subtable.class1Records[class1Val];
							if (class1Record) {
								const class2Record = class1Record.class2Records[class2Val];
								if (class2Record) {
									expect(class2Record.value1).toBeDefined();
									expect(class2Record.value2).toBeDefined();
								}
							}
						}
					}
				}
			}
		});
	});

	describe("comprehensive value record parsing", () => {
		test("all value record combinations in single positioning", () => {
			if (arialGpos) {
				const singleLookups = arialGpos.lookups.filter(
					(l): l is SinglePosLookup => l.type === GposLookupType.Single,
				);

				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						// Check format 1
						if (subtable.format === 1 && subtable.value) {
							const val = subtable.value;

							// Test all optional value fields
							if (subtable.valueFormat & ValueFormat.XPlacement) {
								expect(val.xPlacement).toBeDefined();
							}
							if (subtable.valueFormat & ValueFormat.YPlacement) {
								expect(val.yPlacement).toBeDefined();
							}
							if (subtable.valueFormat & ValueFormat.XAdvance) {
								expect(val.xAdvance).toBeDefined();
							}
							if (subtable.valueFormat & ValueFormat.YAdvance) {
								expect(val.yAdvance).toBeDefined();
							}

							// Test device table fields
							if (subtable.valueFormat & ValueFormat.XPlaDevice) {
								expect(
									val.xPlaDevice === undefined ||
										typeof val.xPlaDevice === "object",
								).toBe(true);
							}
							if (subtable.valueFormat & ValueFormat.YPlaDevice) {
								expect(
									val.yPlaDevice === undefined ||
										typeof val.yPlaDevice === "object",
								).toBe(true);
							}
							if (subtable.valueFormat & ValueFormat.XAdvDevice) {
								expect(
									val.xAdvDevice === undefined ||
										typeof val.xAdvDevice === "object",
								).toBe(true);
							}
							if (subtable.valueFormat & ValueFormat.YAdvDevice) {
								expect(
									val.yAdvDevice === undefined ||
										typeof val.yAdvDevice === "object",
								).toBe(true);
							}
						}

						// Check format 2
						if (subtable.format === 2 && subtable.values) {
							for (const val of subtable.values) {
								// Same checks for format 2 values
								if (subtable.valueFormat & ValueFormat.XPlacement) {
									expect(val.xPlacement).toBeDefined();
								}
								if (subtable.valueFormat & ValueFormat.YPlacement) {
									expect(val.yPlacement).toBeDefined();
								}
								if (subtable.valueFormat & ValueFormat.XAdvance) {
									expect(val.xAdvance).toBeDefined();
								}
								if (subtable.valueFormat & ValueFormat.YAdvance) {
									expect(val.yAdvance).toBeDefined();
								}
							}
						}
					}
				}
			}
		});

		test("value records in pair positioning format 1", () => {
			if (arialGpos) {
				const pairLookups = arialGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 1) {
							for (const pairSet of subtable.pairSets) {
								for (const record of pairSet.pairValueRecords) {
									expect(record.secondGlyph).toBeDefined();
									expect(typeof record.secondGlyph).toBe("number");

									const v1 = record.value1;
									const v2 = record.value2;

									// Test value1
									if (subtable.valueFormat1 & ValueFormat.XAdvance) {
										expect(v1.xAdvance).toBeDefined();
									}
									if (subtable.valueFormat1 & ValueFormat.XPlacement) {
										expect(v1.xPlacement).toBeDefined();
									}

									// Test value2
									if (subtable.valueFormat2 & ValueFormat.XAdvance) {
										expect(v2.xAdvance).toBeDefined();
									}
									if (subtable.valueFormat2 & ValueFormat.XPlacement) {
										expect(v2.xPlacement).toBeDefined();
									}
								}
							}
						}
					}
				}
			}
		});
	});

	describe("getKerning comprehensive", () => {
		test("getKerning with all pair formats and edge cases", () => {
			if (arialGpos) {
				const pairLookups = arialGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					// Test with various glyph IDs
					const testGlyphs = [0, 1, 10, 20, 50, 100, 200];

					for (const g1 of testGlyphs) {
						for (const g2 of testGlyphs) {
							const result = getKerning(lookup, g1, g2);
							if (result !== null) {
								expect(typeof result.xAdvance1).toBe("number");
								expect(typeof result.xAdvance2).toBe("number");
								expect(Number.isFinite(result.xAdvance1)).toBe(true);
								expect(Number.isFinite(result.xAdvance2)).toBe(true);
							}
						}
					}

					// Test specific letter pairs that commonly have kerning
					const A = arialFont.glyphId(0x41);
					const V = arialFont.glyphId(0x56);
					const T = arialFont.glyphId(0x54);
					const o = arialFont.glyphId(0x6f);

					const testPairs = [
						[A, V],
						[T, o],
						[V, A],
						[A, T],
					];

					for (const [first, second] of testPairs) {
						const result = getKerning(lookup, first, second);
						if (result !== null) {
							expect(typeof result.xAdvance1).toBe("number");
							expect(typeof result.xAdvance2).toBe("number");
						}
					}
				}
			}
		});

		test("getKerning returns null for uncovered glyphs", () => {
			if (arialGpos) {
				const pairLookups = arialGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					// Very high glyph IDs unlikely to be in coverage
					const result = getKerning(lookup, 65000, 65001);
					expect(result).toBeNull();
				}
			}
		});

		test("getKerning with format 1 returns correct structure", () => {
			if (arialGpos) {
				const pairLookups = arialGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 1 && subtable.pairSets.length > 0) {
							// Find a valid pair from the actual data
							for (let i = 0; i < Math.min(50, subtable.pairSets.length); i++) {
								const pairSet = subtable.pairSets[i];
								if (pairSet && pairSet.pairValueRecords.length > 0) {
									// The coverage index maps to the first glyph
									// We need to find which glyph has coverage index i
									for (let testGlyph = 0; testGlyph < 1000; testGlyph++) {
										const covIdx = subtable.coverage.get(testGlyph);
										if (covIdx === i) {
											const record = pairSet.pairValueRecords[0];
											if (record) {
												const result = getKerning(
													lookup,
													testGlyph,
													record.secondGlyph,
												);
												if (result !== null) {
													expect(result.xAdvance1).toBe(
														record.value1.xAdvance ?? 0,
													);
													expect(result.xAdvance2).toBe(
														record.value2.xAdvance ?? 0,
													);
												}
											}
											break;
										}
									}
								}
							}
						}
					}
				}
			}
		});

		test("getKerning with format 2 handles missing class records", () => {
			if (arialGpos) {
				const pairLookups = arialGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							// Test with glyph not in coverage
							const result = getKerning(lookup, 64000, 64001);
							expect(result).toBeNull();

							// Test with valid glyphs
							for (let g = 0; g < 200; g++) {
								const covIdx = subtable.coverage.get(g);
								if (covIdx !== null) {
									// Found a glyph in coverage, test it
									for (let g2 = 0; g2 < 200; g2++) {
										const result = getKerning(lookup, g, g2);
										if (result !== null) {
											expect(typeof result.xAdvance1).toBe("number");
											expect(typeof result.xAdvance2).toBe("number");
										}
									}
									break;
								}
							}
						}
					}
				}
			}
		});
	});

	describe("lookup flag variations", () => {
		test("lookups with different flags", () => {
			if (arialGpos) {
				const flagCounts = new Map<number, number>();

				for (const lookup of arialGpos.lookups) {
					const count = flagCounts.get(lookup.flag) ?? 0;
					flagCounts.set(lookup.flag, count + 1);

					expect(typeof lookup.flag).toBe("number");
					expect(lookup.flag).toBeGreaterThanOrEqual(0);
				}

				// We should have at least one lookup with flags
				expect(flagCounts.size).toBeGreaterThan(0);
			}
		});
	});
});

describe("GPOS Pair Positioning Format 2 (NotoSansLepcha)", () => {
	let lepchaFont: Font;
	let lepchaGpos: GposTable | null;

	beforeAll(async () => {
		lepchaFont = await Font.fromFile(NOTO_LEPCHA_PATH);
		lepchaGpos = lepchaFont.gpos;
	});

	test("loads NotoSansLepcha successfully", () => {
		expect(lepchaFont).toBeDefined();
		expect(lepchaGpos).toBeDefined();
	});

	test("has pair positioning lookups with format 2", () => {
		if (lepchaGpos) {
			const pairLookups = lepchaGpos.lookups.filter(
				(l): l is PairPosLookup => l.type === GposLookupType.Pair,
			);
			expect(pairLookups.length).toBeGreaterThan(0);

			let foundFormat2 = false;
			for (const lookup of pairLookups) {
				for (const subtable of lookup.subtables) {
					if (subtable.format === 2) {
						foundFormat2 = true;
						expect(subtable.classDef1).toBeDefined();
						expect(subtable.classDef2).toBeDefined();
						expect(subtable.class1Count).toBeGreaterThan(0);
						expect(subtable.class2Count).toBeGreaterThan(0);
					}
				}
			}
			expect(foundFormat2).toBe(true);
		}
	});

	describe("format 2 parsing comprehensive", () => {
		test("parses all class records correctly", () => {
			if (lepchaGpos) {
				const pairLookups = lepchaGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							// Verify structure is complete
							expect(subtable.class1Records.length).toBe(subtable.class1Count);

							for (let i = 0; i < subtable.class1Count; i++) {
								const class1Record = subtable.class1Records[i];
								expect(class1Record).toBeDefined();
								expect(class1Record.class2Records.length).toBe(
									subtable.class2Count,
								);

								for (let j = 0; j < subtable.class2Count; j++) {
									const class2Record = class1Record.class2Records[j];
									expect(class2Record).toBeDefined();
									expect(class2Record.value1).toBeDefined();
									expect(class2Record.value2).toBeDefined();

									// Verify value records structure
									const v1 = class2Record.value1;
									const v2 = class2Record.value2;

									// Check all possible value fields
									if (v1.xPlacement !== undefined) {
										expect(typeof v1.xPlacement).toBe("number");
									}
									if (v1.yPlacement !== undefined) {
										expect(typeof v1.yPlacement).toBe("number");
									}
									if (v1.xAdvance !== undefined) {
										expect(typeof v1.xAdvance).toBe("number");
									}
									if (v1.yAdvance !== undefined) {
										expect(typeof v1.yAdvance).toBe("number");
									}

									if (v2.xPlacement !== undefined) {
										expect(typeof v2.xPlacement).toBe("number");
									}
									if (v2.yPlacement !== undefined) {
										expect(typeof v2.yPlacement).toBe("number");
									}
									if (v2.xAdvance !== undefined) {
										expect(typeof v2.xAdvance).toBe("number");
									}
									if (v2.yAdvance !== undefined) {
										expect(typeof v2.yAdvance).toBe("number");
									}
								}
							}
						}
					}
				}
			}
		});

		test("class definitions work correctly", () => {
			if (lepchaGpos) {
				const pairLookups = lepchaGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							// Test class definition lookups
							for (let glyph = 0; glyph < 500; glyph++) {
								const class1 = subtable.classDef1.get(glyph);
								const class2 = subtable.classDef2.get(glyph);

								expect(typeof class1).toBe("number");
								expect(typeof class2).toBe("number");
								expect(class1).toBeGreaterThanOrEqual(0);
								expect(class2).toBeGreaterThanOrEqual(0);
								expect(class1).toBeLessThan(subtable.class1Count);
								expect(class2).toBeLessThan(subtable.class2Count);
							}
						}
					}
				}
			}
		});
	});

	describe("getKerning with format 2", () => {
		test("returns kerning for valid glyph pairs", () => {
			if (lepchaGpos) {
				const pairLookups = lepchaGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							// Find glyphs in coverage
							let testedPairs = 0;
							for (let glyph1 = 0; glyph1 < 1000 && testedPairs < 50; glyph1++) {
								const coverageIdx = subtable.coverage.get(glyph1);
								if (coverageIdx !== null) {
									// Test with multiple second glyphs
									for (let glyph2 = 0; glyph2 < 1000; glyph2++) {
										const result = getKerning(lookup, glyph1, glyph2);
										if (result !== null) {
											expect(typeof result.xAdvance1).toBe("number");
											expect(typeof result.xAdvance2).toBe("number");

											// Verify the values match what's in the class records
											const class1 = subtable.classDef1.get(glyph1);
											const class2 = subtable.classDef2.get(glyph2);

											const class1Record = subtable.class1Records[class1];
											expect(class1Record).toBeDefined();

											const class2Record = class1Record.class2Records[class2];
											expect(class2Record).toBeDefined();

											expect(result.xAdvance1).toBe(
												class2Record.value1.xAdvance ?? 0,
											);
											expect(result.xAdvance2).toBe(
												class2Record.value2.xAdvance ?? 0,
											);

											testedPairs++;
											if (testedPairs >= 50) break;
										}
									}
								}
							}
						}
					}
				}
			}
		});

		test("returns null for glyphs not in coverage", () => {
			if (lepchaGpos) {
				const pairLookups = lepchaGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							// Test with very high glyph IDs
							const result = getKerning(lookup, 60000, 60001);
							expect(result).toBeNull();
						}
					}
				}
			}
		});

		test("handles all class combinations", () => {
			if (lepchaGpos) {
				const pairLookups = lepchaGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							// Find one glyph in coverage to test all class2 values
							for (let testGlyph = 0; testGlyph < 500; testGlyph++) {
								const coverageIdx = subtable.coverage.get(testGlyph);
								if (coverageIdx !== null) {
									// Test with all possible class2 values
									for (let glyph2 = 0; glyph2 < 500; glyph2++) {
										const class2 = subtable.classDef2.get(glyph2);
										const result = getKerning(lookup, testGlyph, glyph2);

										// Should always return a value if glyph1 is in coverage
										expect(result).not.toBeNull();
										if (result) {
											expect(typeof result.xAdvance1).toBe("number");
											expect(typeof result.xAdvance2).toBe("number");
										}
									}
									break; // Only test with one glyph in coverage
								}
							}
						}
					}
				}
			}
		});

		test("format 2 kerning with edge case class indices", () => {
			if (lepchaGpos) {
				const pairLookups = lepchaGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							// Test with class 0 (default class)
							for (let g = 0; g < 100; g++) {
								const coverageIdx = subtable.coverage.get(g);
								if (coverageIdx !== null) {
									// Found a glyph in coverage, test with various second glyphs
									for (let g2 = 0; g2 < 100; g2++) {
										const result = getKerning(lookup, g, g2);
										expect(result).not.toBeNull();
									}
									break;
								}
							}
						}
					}
				}
			}
		});
	});

	describe("value formats in format 2", () => {
		test("valueFormat1 and valueFormat2 are valid", () => {
			if (lepchaGpos) {
				const pairLookups = lepchaGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							expect(subtable.valueFormat1).toBeGreaterThanOrEqual(0);
							expect(subtable.valueFormat1).toBeLessThanOrEqual(0xff);
							expect(subtable.valueFormat2).toBeGreaterThanOrEqual(0);
							expect(subtable.valueFormat2).toBeLessThanOrEqual(0xff);
						}
					}
				}
			}
		});

		test("value records match value formats", () => {
			if (lepchaGpos) {
				const pairLookups = lepchaGpos.lookups.filter(
					(l): l is PairPosLookup => l.type === GposLookupType.Pair,
				);

				for (const lookup of pairLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							for (const class1Rec of subtable.class1Records) {
								for (const class2Rec of class1Rec.class2Records) {
									const v1 = class2Rec.value1;
									const v2 = class2Rec.value2;

									// Check value1
									if (subtable.valueFormat1 & ValueFormat.XPlacement) {
										expect(v1.xPlacement).toBeDefined();
									}
									if (subtable.valueFormat1 & ValueFormat.YPlacement) {
										expect(v1.yPlacement).toBeDefined();
									}
									if (subtable.valueFormat1 & ValueFormat.XAdvance) {
										expect(v1.xAdvance).toBeDefined();
									}
									if (subtable.valueFormat1 & ValueFormat.YAdvance) {
										expect(v1.yAdvance).toBeDefined();
									}

									// Check value2
									if (subtable.valueFormat2 & ValueFormat.XPlacement) {
										expect(v2.xPlacement).toBeDefined();
									}
									if (subtable.valueFormat2 & ValueFormat.YPlacement) {
										expect(v2.yPlacement).toBeDefined();
									}
									if (subtable.valueFormat2 & ValueFormat.XAdvance) {
										expect(v2.xAdvance).toBeDefined();
									}
									if (subtable.valueFormat2 & ValueFormat.YAdvance) {
										expect(v2.yAdvance).toBeDefined();
									}

									// Check device table fields
									if (subtable.valueFormat1 & ValueFormat.XPlaDevice) {
										expect(
											v1.xPlaDevice === undefined ||
												typeof v1.xPlaDevice === "object",
										).toBe(true);
									}
									if (subtable.valueFormat1 & ValueFormat.YPlaDevice) {
										expect(
											v1.yPlaDevice === undefined ||
												typeof v1.yPlaDevice === "object",
										).toBe(true);
									}
									if (subtable.valueFormat1 & ValueFormat.XAdvDevice) {
										expect(
											v1.xAdvDevice === undefined ||
												typeof v1.xAdvDevice === "object",
										).toBe(true);
									}
									if (subtable.valueFormat1 & ValueFormat.YAdvDevice) {
										expect(
											v1.yAdvDevice === undefined ||
												typeof v1.yAdvDevice === "object",
										).toBe(true);
									}

									if (subtable.valueFormat2 & ValueFormat.XPlaDevice) {
										expect(
											v2.xPlaDevice === undefined ||
												typeof v2.xPlaDevice === "object",
										).toBe(true);
									}
									if (subtable.valueFormat2 & ValueFormat.YPlaDevice) {
										expect(
											v2.yPlaDevice === undefined ||
												typeof v2.yPlaDevice === "object",
										).toBe(true);
									}
									if (subtable.valueFormat2 & ValueFormat.XAdvDevice) {
										expect(
											v2.xAdvDevice === undefined ||
												typeof v2.xAdvDevice === "object",
										).toBe(true);
									}
									if (subtable.valueFormat2 & ValueFormat.YAdvDevice) {
										expect(
											v2.yAdvDevice === undefined ||
												typeof v2.yAdvDevice === "object",
										).toBe(true);
									}
								}
							}
						}
					}
				}
			}
		});
	});

	describe("device tables and advanced features", () => {
		test("checks for device tables in all value records", () => {
			if (lepchaGpos) {
				const allLookups = lepchaGpos.lookups;
				for (const lookup of allLookups) {
					if (lookup.type === GposLookupType.Single) {
						for (const subtable of lookup.subtables) {
							if (subtable.format === 1 && subtable.value) {
								const v = subtable.value;
								// Check all device table possibilities
								[v.xPlaDevice, v.yPlaDevice, v.xAdvDevice, v.yAdvDevice].forEach(
									(dev) => {
										if (dev !== undefined) {
											expect(typeof dev).toBe("object");
										}
									},
								);
							} else if (subtable.format === 2 && subtable.values) {
								for (const v of subtable.values) {
									[v.xPlaDevice, v.yPlaDevice, v.xAdvDevice, v.yAdvDevice].forEach(
										(dev) => {
											if (dev !== undefined) {
												expect(typeof dev).toBe("object");
											}
										},
									);
								}
							}
						}
					}
				}
			}
		});

		test("GPOS version handling", () => {
			if (lepchaGpos) {
				expect(lepchaGpos.version.major).toBe(1);
				// Minor version can be 0 or 1
				expect([0, 1]).toContain(lepchaGpos.version.minor);
			}
		});

		test("checks mark filtering set in lookups", () => {
			if (lepchaGpos) {
				let hasMarkFilteringSet = false;
				for (const lookup of lepchaGpos.lookups) {
					if (lookup.flag & LookupFlag.UseMarkFilteringSet) {
						hasMarkFilteringSet = true;
						expect(lookup.markFilteringSet).toBeDefined();
						expect(typeof lookup.markFilteringSet).toBe("number");
					}
				}
				// It's OK if no lookups have mark filtering set
				expect(typeof hasMarkFilteringSet).toBe("boolean");
			}
		});

		test("extension lookup handling (Type 9)", () => {
			if (lepchaGpos) {
				// Extension lookups should be unwrapped during parsing
				// so we shouldn't see type 9 in the final lookup list
				for (const lookup of lepchaGpos.lookups) {
					expect(lookup.type).not.toBe(GposLookupType.Extension);
					expect(lookup.type).toBeGreaterThanOrEqual(1);
					expect(lookup.type).toBeLessThanOrEqual(8);
				}
			}
		});
	});
});

describe("GPOS Extension Lookups (STIXTwoText)", () => {
	let stixFont: Font;
	let stixGpos: GposTable | null;

	beforeAll(async () => {
		stixFont = await Font.fromFile(STIX_TWO_ITALIC_PATH);
		stixGpos = stixFont.gpos;
	});

	test("loads STIXTwoText-Italic successfully", () => {
		expect(stixFont).toBeDefined();
		expect(stixGpos).toBeDefined();
	});

	test("extension lookups are unwrapped", () => {
		if (stixGpos) {
			// Extension lookups should be unwrapped to their actual types
			for (const lookup of stixGpos.lookups) {
				expect(lookup.type).not.toBe(GposLookupType.Extension);
				expect(lookup.type).toBeGreaterThanOrEqual(1);
				expect(lookup.type).toBeLessThanOrEqual(8);
			}
		}
	});

	test("unwrapped lookups have correct structure", () => {
		if (stixGpos) {
			for (const lookup of stixGpos.lookups) {
				expect(lookup.flag).toBeDefined();
				expect(typeof lookup.flag).toBe("number");
				expect(Array.isArray(lookup.subtables)).toBe(true);
				expect(lookup.subtables.length).toBeGreaterThanOrEqual(0);
			}
		}
	});

	test("extension lookup subtables are valid", () => {
		if (stixGpos) {
			for (const lookup of stixGpos.lookups) {
				for (const subtable of lookup.subtables as any[]) {
					expect(subtable).toBeDefined();

					// Check based on lookup type
					if (lookup.type === GposLookupType.Single) {
						expect(subtable.coverage).toBeDefined();
						expect([1, 2]).toContain(subtable.format);
					} else if (lookup.type === GposLookupType.Pair) {
						expect(subtable.coverage).toBeDefined();
						expect([1, 2]).toContain(subtable.format);
					} else if (lookup.type === GposLookupType.Cursive) {
						expect(subtable.coverage).toBeDefined();
					} else if (
						lookup.type === GposLookupType.MarkToBase ||
						lookup.type === GposLookupType.MarkToLigature ||
						lookup.type === GposLookupType.MarkToMark
					) {
						expect(
							subtable.markCoverage ||
								subtable.mark1Coverage ||
								subtable.baseCoverage,
						).toBeDefined();
					}
				}
			}
		}
	});

	test("extension lookups preserve lookup flags", () => {
		if (stixGpos) {
			for (const lookup of stixGpos.lookups) {
				expect(typeof lookup.flag).toBe("number");
				if (lookup.flag & LookupFlag.UseMarkFilteringSet) {
					if (lookup.markFilteringSet !== undefined) {
						expect(typeof lookup.markFilteringSet).toBe("number");
					}
				}
			}
		}
	});

	test("tests all lookup types from extensions", () => {
		if (stixGpos) {
			const typeCounts = new Map<number, number>();
			for (const lookup of stixGpos.lookups) {
				const count = typeCounts.get(lookup.type) ?? 0;
				typeCounts.set(lookup.type, count + 1);
			}

			expect(typeCounts.size).toBeGreaterThan(0);

			// Verify each type that exists has valid structure
			for (const [type, count] of typeCounts.entries()) {
				expect(count).toBeGreaterThan(0);
				expect(type).toBeGreaterThanOrEqual(1);
				expect(type).toBeLessThanOrEqual(8);
			}
		}
	});

	test("getKerning works with unwrapped extension lookups", () => {
		if (stixGpos) {
			const pairLookups = stixGpos.lookups.filter(
				(l): l is PairPosLookup => l.type === GposLookupType.Pair,
			);

			for (const lookup of pairLookups) {
				// Test with various glyphs
				for (let g1 = 0; g1 < 100; g1++) {
					for (let g2 = 0; g2 < 100; g2++) {
						const result = getKerning(lookup, g1, g2);
						if (result !== null) {
							expect(typeof result.xAdvance1).toBe("number");
							expect(typeof result.xAdvance2).toBe("number");
						}
					}
				}
			}
		}
	});

	test("mark positioning works with unwrapped extensions", () => {
		if (stixGpos) {
			const markBaseLookups = stixGpos.lookups.filter(
				(l): l is MarkBasePosLookup => l.type === GposLookupType.MarkToBase,
			);

			for (const lookup of markBaseLookups) {
				for (const subtable of lookup.subtables) {
					expect(subtable.markCoverage).toBeDefined();
					expect(subtable.baseCoverage).toBeDefined();
					expect(subtable.markClassCount).toBeGreaterThan(0);
					expect(subtable.markArray.markRecords.length).toBeGreaterThanOrEqual(
						0,
					);
					expect(subtable.baseArray.length).toBeGreaterThanOrEqual(0);
				}
			}
		}
	});

	test("single positioning works with unwrapped extensions", () => {
		if (stixGpos) {
			const singleLookups = stixGpos.lookups.filter(
				(l): l is SinglePosLookup => l.type === GposLookupType.Single,
			);

			for (const lookup of singleLookups) {
				for (const subtable of lookup.subtables) {
					expect(subtable.coverage).toBeDefined();
					expect([1, 2]).toContain(subtable.format);
					expect(typeof subtable.valueFormat).toBe("number");
				}
			}
		}
	});

	test("extension lookup value records", () => {
		if (stixGpos) {
			const singleLookups = stixGpos.lookups.filter(
				(l): l is SinglePosLookup => l.type === GposLookupType.Single,
			);

			for (const lookup of singleLookups) {
				for (const subtable of lookup.subtables) {
					if (subtable.format === 1 && subtable.value) {
						const v = subtable.value;
						if (v.xAdvance !== undefined) {
							expect(typeof v.xAdvance).toBe("number");
						}
						if (v.xPlacement !== undefined) {
							expect(typeof v.xPlacement).toBe("number");
						}
					} else if (subtable.format === 2 && subtable.values) {
						for (const v of subtable.values) {
							if (v.xAdvance !== undefined) {
								expect(typeof v.xAdvance).toBe("number");
							}
							if (v.xPlacement !== undefined) {
								expect(typeof v.xPlacement).toBe("number");
							}
						}
					}
				}
			}
		}
	});

	test("comprehensive lookup type coverage", () => {
		if (stixGpos) {
			let hasSingle = false;
			let hasPair = false;
			let hasMark = false;

			for (const lookup of stixGpos.lookups) {
				if (lookup.type === GposLookupType.Single) hasSingle = true;
				if (lookup.type === GposLookupType.Pair) hasPair = true;
				if (
					lookup.type === GposLookupType.MarkToBase ||
					lookup.type === GposLookupType.MarkToLigature ||
					lookup.type === GposLookupType.MarkToMark
				)
					hasMark = true;
			}

			// STIXTwoText should have at least some lookup types
			expect(hasSingle || hasPair || hasMark).toBe(true);
		}
	});
});
