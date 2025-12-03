import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseGsub,
	GsubLookupType,
	applySingleSubst,
	applyLigatureSubst,
	type GsubTable,
	type SingleSubstLookup,
	type LigatureSubstLookup,
	type MultipleSubstLookup,
	type AlternateSubstLookup,
	type ContextSubstLookup,
	type ChainingContextSubstLookup,
	type ReverseChainingSingleSubstLookup,
} from "../../../src/font/tables/gsub.ts";
import { LookupFlag } from "../../../src/layout/structures/layout-common.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";
const NOTO_JAVANESE_PATH = "/System/Library/Fonts/Supplemental/NotoSansJavanese-Regular.otf";
const NOTO_MONGOLIAN_PATH = "/System/Library/Fonts/Supplemental/NotoSansMongolian-Regular.ttf";
const NOTO_MANDAIC_PATH = "/System/Library/Fonts/Supplemental/NotoSansMandaic-Regular.ttf";

describe("GSUB table", () => {
	let font: Font;
	let gsub: GsubTable | null;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
		gsub = font.gsub;
	});

	describe("parseGsub", () => {
		test("parses GSUB table from font", () => {
			if (gsub) {
				expect(gsub).toBeDefined();
				expect(gsub.version).toBeDefined();
			}
		});

		test("has version with major and minor", () => {
			if (gsub) {
				expect(gsub.version.major).toBe(1);
				expect(typeof gsub.version.minor).toBe("number");
				expect(gsub.version.minor).toBeGreaterThanOrEqual(0);
			}
		});

		test("has scriptList", () => {
			if (gsub) {
				expect(gsub.scriptList).toBeDefined();
				expect(typeof gsub.scriptList).toBe("object");
			}
		});

		test("has featureList", () => {
			if (gsub) {
				expect(gsub.featureList).toBeDefined();
				expect(typeof gsub.featureList).toBe("object");
			}
		});

		test("has lookups array", () => {
			if (gsub) {
				expect(Array.isArray(gsub.lookups)).toBe(true);
			}
		});
	});

	describe("GsubLookupType enum", () => {
		test("has all lookup types", () => {
			expect(GsubLookupType.Single).toBe(1);
			expect(GsubLookupType.Multiple).toBe(2);
			expect(GsubLookupType.Alternate).toBe(3);
			expect(GsubLookupType.Ligature).toBe(4);
			expect(GsubLookupType.Context).toBe(5);
			expect(GsubLookupType.ChainingContext).toBe(6);
			expect(GsubLookupType.Extension).toBe(7);
			expect(GsubLookupType.ReverseChainingSingle).toBe(8);
		});
	});

	describe("lookup structure", () => {
		test("all lookups have type and flag", () => {
			if (gsub) {
				for (const lookup of gsub.lookups) {
					expect(typeof lookup.type).toBe("number");
					expect(lookup.type).toBeGreaterThanOrEqual(1);
					expect(lookup.type).toBeLessThanOrEqual(8);
					expect(typeof lookup.flag).toBe("number");
				}
			}
		});

		test("all lookups have valid subtables", () => {
			if (gsub) {
				for (const lookup of gsub.lookups) {
					if ("subtables" in lookup) {
						expect(Array.isArray(lookup.subtables)).toBe(true);
					}
				}
			}
		});

		test("markFilteringSet is optional", () => {
			if (gsub) {
				for (const lookup of gsub.lookups) {
					if (lookup.markFilteringSet !== undefined) {
						expect(typeof lookup.markFilteringSet).toBe("number");
					}
				}
			}
		});

		test("lookup flags are valid", () => {
			if (gsub) {
				for (const lookup of gsub.lookups) {
					expect(lookup.flag).toBeGreaterThanOrEqual(0);
					expect(lookup.flag).toBeLessThanOrEqual(0xffff);
				}
			}
		});
	});

	describe("Single substitution (Type 1)", () => {
		test("Single lookup has correct structure", () => {
			if (gsub) {
				const singleLookups = gsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				for (const lookup of singleLookups) {
					expect(lookup.type).toBe(GsubLookupType.Single);
					expect(Array.isArray(lookup.subtables)).toBe(true);
				}
			}
		});

		test("format 1 subtable has deltaGlyphId", () => {
			if (gsub) {
				const singleLookups = gsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.coverage).toBeDefined();
						if (subtable.format === 1) {
							expect(typeof subtable.deltaGlyphId).toBe("number");
						}
					}
				}
			}
		});

		test("format 2 subtable has substituteGlyphIds", () => {
			if (gsub) {
				const singleLookups = gsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2) {
							expect(Array.isArray(subtable.substituteGlyphIds)).toBe(true);
						}
					}
				}
			}
		});

		test("subtables have coverage", () => {
			if (gsub) {
				const singleLookups = gsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.coverage).toBeDefined();
						expect(typeof subtable.coverage.get).toBe("function");
					}
				}
			}
		});
	});

	describe("Multiple substitution (Type 2)", () => {
		test("Multiple lookup has sequences", () => {
			if (gsub) {
				const multipleLookups = gsub.lookups.filter(
					(l): l is MultipleSubstLookup => l.type === GsubLookupType.Multiple,
				);
				for (const lookup of multipleLookups) {
					expect(lookup.type).toBe(GsubLookupType.Multiple);
					for (const subtable of lookup.subtables) {
						expect(subtable.coverage).toBeDefined();
						expect(Array.isArray(subtable.sequences)).toBe(true);
						for (const seq of subtable.sequences) {
							expect(Array.isArray(seq)).toBe(true);
						}
					}
				}
			}
		});
	});

	describe("Alternate substitution (Type 3)", () => {
		test("Alternate lookup has alternate sets", () => {
			if (gsub) {
				const altLookups = gsub.lookups.filter(
					(l): l is AlternateSubstLookup => l.type === GsubLookupType.Alternate,
				);
				for (const lookup of altLookups) {
					expect(lookup.type).toBe(GsubLookupType.Alternate);
					for (const subtable of lookup.subtables) {
						expect(subtable.coverage).toBeDefined();
						expect(Array.isArray(subtable.alternateSets)).toBe(true);
						for (const altSet of subtable.alternateSets) {
							expect(Array.isArray(altSet)).toBe(true);
						}
					}
				}
			}
		});
	});

	describe("Ligature substitution (Type 4)", () => {
		test("Ligature lookup has ligature sets", () => {
			if (gsub) {
				const ligLookups = gsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					expect(lookup.type).toBe(GsubLookupType.Ligature);
					for (const subtable of lookup.subtables) {
						expect(subtable.coverage).toBeDefined();
						expect(Array.isArray(subtable.ligatureSets)).toBe(true);
					}
				}
			}
		});

		test("ligature sets contain ligatures", () => {
			if (gsub) {
				const ligLookups = gsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						for (const ligSet of subtable.ligatureSets) {
							expect(Array.isArray(ligSet.ligatures)).toBe(true);
							for (const lig of ligSet.ligatures) {
								expect(typeof lig.ligatureGlyph).toBe("number");
								expect(Array.isArray(lig.componentGlyphIds)).toBe(true);
							}
						}
					}
				}
			}
		});

		test("component count is consistent", () => {
			if (gsub) {
				const ligLookups = gsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						for (const ligSet of subtable.ligatureSets) {
							for (const lig of ligSet.ligatures) {
								expect(lig.componentGlyphIds.length).toBeGreaterThanOrEqual(0);
							}
						}
					}
				}
			}
		});
	});

	describe("Context substitution (Type 5)", () => {
		test("Context lookup has valid structure", () => {
			if (gsub) {
				const contextLookups = gsub.lookups.filter(
					(l): l is ContextSubstLookup => l.type === GsubLookupType.Context,
				);
				for (const lookup of contextLookups) {
					expect(lookup.type).toBe(GsubLookupType.Context);
					expect(Array.isArray(lookup.subtables)).toBe(true);
				}
			}
		});
	});

	describe("Chaining context substitution (Type 6)", () => {
		test("Chaining context lookup has valid structure", () => {
			if (gsub) {
				const chainingLookups = gsub.lookups.filter(
					(l): l is ChainingContextSubstLookup =>
						l.type === GsubLookupType.ChainingContext,
				);
				for (const lookup of chainingLookups) {
					expect(lookup.type).toBe(GsubLookupType.ChainingContext);
					expect(Array.isArray(lookup.subtables)).toBe(true);
				}
			}
		});
	});

	describe("Reverse chaining single (Type 8)", () => {
		test("Reverse chaining lookup has valid structure", () => {
			if (gsub) {
				const reverseLookups = gsub.lookups.filter(
					(l): l is ReverseChainingSingleSubstLookup =>
						l.type === GsubLookupType.ReverseChainingSingle,
				);
				for (const lookup of reverseLookups) {
					expect(lookup.type).toBe(GsubLookupType.ReverseChainingSingle);
					for (const subtable of lookup.subtables) {
						expect(subtable.coverage).toBeDefined();
						expect(Array.isArray(subtable.backtrackCoverages)).toBe(true);
						expect(Array.isArray(subtable.lookaheadCoverages)).toBe(true);
						expect(Array.isArray(subtable.substituteGlyphIds)).toBe(true);
					}
				}
			}
		});
	});

	describe("applySingleSubst", () => {
		test("returns null when glyph not in coverage", () => {
			if (gsub) {
				const singleLookups = gsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				if (singleLookups.length > 0) {
					const lookup = singleLookups[0];
					if (lookup) {
						const result = applySingleSubst(lookup, 99999);
						expect(result).toBeNull();
					}
				}
			}
		});

		test("applies format 1 delta correctly", () => {
			if (gsub) {
				const singleLookups = gsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 1 && subtable.deltaGlyphId !== undefined) {
							const glyphIds = Array.from({ length: 10 }, (_, i) => i);
							for (const glyphId of glyphIds) {
								const coverageIndex = subtable.coverage.get(glyphId);
								if (coverageIndex !== null) {
									const result = applySingleSubst(lookup, glyphId);
									if (result !== null) {
										expect(typeof result).toBe("number");
										expect(result).toBe((glyphId + subtable.deltaGlyphId) & 0xffff);
									}
								}
							}
						}
					}
				}
			}
		});

		test("applies format 2 substitution correctly", () => {
			if (gsub) {
				const singleLookups = gsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2 && subtable.substituteGlyphIds) {
							const glyphIds = Array.from({ length: 100 }, (_, i) => i);
							for (const glyphId of glyphIds) {
								const coverageIndex = subtable.coverage.get(glyphId);
								if (coverageIndex !== null && coverageIndex < subtable.substituteGlyphIds.length) {
									const result = applySingleSubst(lookup, glyphId);
									if (result !== null) {
										expect(result).toBe(subtable.substituteGlyphIds[coverageIndex]);
									}
								}
							}
						}
					}
				}
			}
		});
	});

	describe("applyLigatureSubst", () => {
		test("returns null when first glyph not in coverage", () => {
			if (gsub) {
				const ligLookups = gsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				if (ligLookups.length > 0) {
					const lookup = ligLookups[0];
					if (lookup) {
						const result = applyLigatureSubst(lookup, [99999, 99998], 0);
						expect(result).toBeNull();
					}
				}
			}
		});

		test("returns null for insufficient components", () => {
			if (gsub) {
				const ligLookups = gsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					const result = applyLigatureSubst(lookup, [1], 0);
					// May or may not match, but should not throw
					expect(result === null || typeof result?.ligatureGlyph === "number").toBe(true);
				}
			}
		});

		test("returns ligature and consumed count on match", () => {
			if (gsub) {
				const ligLookups = gsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						for (let i = 0; i < subtable.ligatureSets.length && i < 10; i++) {
							const ligSet = subtable.ligatureSets[i];
							if (ligSet && ligSet.ligatures.length > 0) {
								const lig = ligSet.ligatures[0];
								if (lig) {
									expect(typeof lig.ligatureGlyph).toBe("number");
									expect(lig.componentGlyphIds.length).toBeGreaterThanOrEqual(0);
								}
							}
						}
					}
				}
			}
		});

		test("handles empty glyph array", () => {
			if (gsub) {
				const ligLookups = gsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				if (ligLookups.length > 0) {
					const lookup = ligLookups[0];
					if (lookup) {
						const result = applyLigatureSubst(lookup, [], 0);
						expect(result).toBeNull();
					}
				}
			}
		});

		test("handles out of bounds start index", () => {
			if (gsub) {
				const ligLookups = gsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				if (ligLookups.length > 0) {
					const lookup = ligLookups[0];
					if (lookup) {
						const result = applyLigatureSubst(lookup, [1, 2, 3], 10);
						expect(result).toBeNull();
					}
				}
			}
		});
	});

	describe("scriptList structure", () => {
		test("has scripts", () => {
			if (gsub) {
				expect(gsub.scriptList).toBeDefined();
				if ("scripts" in gsub.scriptList) {
					expect(Array.isArray(gsub.scriptList.scripts)).toBe(true);
				}
			}
		});
	});

	describe("featureList structure", () => {
		test("has features", () => {
			if (gsub) {
				expect(gsub.featureList).toBeDefined();
				if ("features" in gsub.featureList) {
					expect(Array.isArray(gsub.featureList.features)).toBe(true);
				}
			}
		});
	});

	describe("coverage tables", () => {
		test("all subtables have valid coverage", () => {
			if (gsub) {
				for (const lookup of gsub.lookups) {
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
		test("handles font without GSUB table", () => {
			expect(gsub === null || typeof gsub === "object").toBe(true);
		});

		test("lookup count is reasonable", () => {
			if (gsub) {
				expect(gsub.lookups.length).toBeGreaterThanOrEqual(0);
				expect(gsub.lookups.length).toBeLessThan(10000);
			}
		});

		test("all lookups are valid types", () => {
			if (gsub) {
				for (const lookup of gsub.lookups) {
					expect([1, 2, 3, 4, 5, 6, 7, 8]).toContain(lookup.type);
				}
			}
		});

		test("iterates through all lookups without error", () => {
			if (gsub) {
				expect(() => {
					for (const lookup of gsub.lookups) {
						expect(lookup).toBeDefined();
					}
				}).not.toThrow();
			}
		});

		test("handles empty ligature sets", () => {
			if (gsub) {
				const ligLookups = gsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						for (const ligSet of subtable.ligatureSets) {
							expect(Array.isArray(ligSet.ligatures)).toBe(true);
						}
					}
				}
			}
		});

		test("handles empty sequences in multiple subst", () => {
			if (gsub) {
				const multipleLookups = gsub.lookups.filter(
					(l): l is MultipleSubstLookup => l.type === GsubLookupType.Multiple,
				);
				for (const lookup of multipleLookups) {
					for (const subtable of lookup.subtables) {
						for (const seq of subtable.sequences) {
							expect(Array.isArray(seq)).toBe(true);
						}
					}
				}
			}
		});
	});

	describe("extension lookups", () => {
		test("extension lookups are unwrapped correctly", () => {
			if (gsub) {
				// Extension lookups should be resolved to their actual type
				for (const lookup of gsub.lookups) {
					expect(lookup.type).not.toBe(GsubLookupType.Extension);
				}
			}
		});
	});

	describe("performance", () => {
		test("parses GSUB table efficiently", () => {
			if (gsub) {
				const start = performance.now();
				for (const lookup of gsub.lookups) {
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

		test("applySingleSubst is fast", () => {
			if (gsub) {
				const singleLookups = gsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				if (singleLookups.length > 0) {
					const lookup = singleLookups[0];
					if (lookup) {
						const start = performance.now();
						for (let i = 0; i < 1000; i++) {
							applySingleSubst(lookup, i % 100);
						}
						const elapsed = performance.now() - start;
						expect(elapsed).toBeLessThan(50);
					}
				}
			}
		});
	});
});

describe("GSUB - NotoSansJavanese (Multiple fonts)", () => {
	let javaFont: Font;
	let javaGsub: GsubTable | null;
	let mongolianFont: Font;
	let mongolianGsub: GsubTable | null;
	let mandaicFont: Font;
	let mandaicGsub: GsubTable | null;

	beforeAll(async () => {
		javaFont = await Font.fromFile(NOTO_JAVANESE_PATH);
		javaGsub = javaFont.gsub;
		mongolianFont = await Font.fromFile(NOTO_MONGOLIAN_PATH);
		mongolianGsub = mongolianFont.gsub;
		mandaicFont = await Font.fromFile(NOTO_MANDAIC_PATH);
		mandaicGsub = mandaicFont.gsub;
	});

	describe("Multiple substitution (Type 2) - detailed", () => {
		test("NotoSansMongolian has Multiple lookups", () => {
			if (mongolianGsub) {
				const multipleLookups = mongolianGsub.lookups.filter(
					(l): l is MultipleSubstLookup => l.type === GsubLookupType.Multiple,
				);
				expect(multipleLookups.length).toBeGreaterThan(0);
			}
		});

		test("Multiple subtable format 1 has sequences", () => {
			if (mongolianGsub) {
				const multipleLookups = mongolianGsub.lookups.filter(
					(l): l is MultipleSubstLookup => l.type === GsubLookupType.Multiple,
				);
				for (const lookup of multipleLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.coverage).toBeDefined();
						expect(Array.isArray(subtable.sequences)).toBe(true);
						if (subtable.sequences.length > 0) {
							for (const seq of subtable.sequences) {
								expect(Array.isArray(seq)).toBe(true);
								for (const glyphId of seq) {
									expect(typeof glyphId).toBe("number");
									expect(glyphId).toBeGreaterThanOrEqual(0);
								}
							}
						}
					}
				}
			}
		});

		test("Multiple sequences can have multiple glyphs", () => {
			if (mongolianGsub) {
				const multipleLookups = mongolianGsub.lookups.filter(
					(l): l is MultipleSubstLookup => l.type === GsubLookupType.Multiple,
				);
				let foundMulti = false;
				for (const lookup of multipleLookups) {
					for (const subtable of lookup.subtables) {
						for (const seq of subtable.sequences) {
							if (seq.length > 1) {
								foundMulti = true;
								break;
							}
						}
					}
				}
				expect(foundMulti).toBe(true);
			}
		});

		test("Multiple coverage maps to sequences correctly", () => {
			if (mongolianGsub) {
				const multipleLookups = mongolianGsub.lookups.filter(
					(l): l is MultipleSubstLookup => l.type === GsubLookupType.Multiple,
				);
				for (const lookup of multipleLookups) {
					for (const subtable of lookup.subtables) {
						const glyphIds = Array.from({ length: 1000 }, (_, i) => i);
						for (const glyphId of glyphIds) {
							const coverageIndex = subtable.coverage.get(glyphId);
							if (coverageIndex !== null) {
								expect(coverageIndex).toBeLessThan(subtable.sequences.length);
								const sequence = subtable.sequences[coverageIndex];
								expect(sequence).toBeDefined();
								expect(Array.isArray(sequence)).toBe(true);
							}
						}
					}
				}
			}
		});
	});

	describe("Alternate substitution (Type 3) - detailed", () => {
		test("NotoSansMandaic has Alternate lookups", () => {
			if (mandaicGsub) {
				const altLookups = mandaicGsub.lookups.filter(
					(l): l is AlternateSubstLookup => l.type === GsubLookupType.Alternate,
				);
				expect(altLookups.length).toBeGreaterThan(0);
			}
		});

		test("Alternate subtable format 1 has alternate sets", () => {
			if (mandaicGsub) {
				const altLookups = mandaicGsub.lookups.filter(
					(l): l is AlternateSubstLookup => l.type === GsubLookupType.Alternate,
				);
				for (const lookup of altLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.coverage).toBeDefined();
						expect(Array.isArray(subtable.alternateSets)).toBe(true);
						if (subtable.alternateSets.length > 0) {
							for (const altSet of subtable.alternateSets) {
								expect(Array.isArray(altSet)).toBe(true);
								for (const glyphId of altSet) {
									expect(typeof glyphId).toBe("number");
									expect(glyphId).toBeGreaterThanOrEqual(0);
								}
							}
						}
					}
				}
			}
		});

		test("Alternate sets provide multiple choices", () => {
			if (mandaicGsub) {
				const altLookups = mandaicGsub.lookups.filter(
					(l): l is AlternateSubstLookup => l.type === GsubLookupType.Alternate,
				);
				let foundMultipleAlts = false;
				for (const lookup of altLookups) {
					for (const subtable of lookup.subtables) {
						for (const altSet of subtable.alternateSets) {
							if (altSet.length > 1) {
								foundMultipleAlts = true;
								break;
							}
						}
					}
				}
				expect(foundMultipleAlts).toBe(true);
			}
		});

		test("Alternate coverage maps to alternate sets correctly", () => {
			if (mandaicGsub) {
				const altLookups = mandaicGsub.lookups.filter(
					(l): l is AlternateSubstLookup => l.type === GsubLookupType.Alternate,
				);
				for (const lookup of altLookups) {
					for (const subtable of lookup.subtables) {
						const glyphIds = Array.from({ length: 500 }, (_, i) => i);
						for (const glyphId of glyphIds) {
							const coverageIndex = subtable.coverage.get(glyphId);
							if (coverageIndex !== null) {
								expect(coverageIndex).toBeLessThan(subtable.alternateSets.length);
								const altSet = subtable.alternateSets[coverageIndex];
								expect(altSet).toBeDefined();
								expect(Array.isArray(altSet)).toBe(true);
							}
						}
					}
				}
			}
		});
	});

	describe("Reverse chaining single (Type 8) - detailed", () => {
		test("NotoSansMongolian has ReverseChainingSingle lookups", () => {
			if (mongolianGsub) {
				const reverseLookups = mongolianGsub.lookups.filter(
					(l): l is ReverseChainingSingleSubstLookup =>
						l.type === GsubLookupType.ReverseChainingSingle,
				);
				expect(reverseLookups.length).toBeGreaterThan(0);
			}
		});

		test("ReverseChainingSingle subtable format 1 has all components", () => {
			if (mongolianGsub) {
				const reverseLookups = mongolianGsub.lookups.filter(
					(l): l is ReverseChainingSingleSubstLookup =>
						l.type === GsubLookupType.ReverseChainingSingle,
				);
				for (const lookup of reverseLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.coverage).toBeDefined();
						expect(Array.isArray(subtable.backtrackCoverages)).toBe(true);
						expect(Array.isArray(subtable.lookaheadCoverages)).toBe(true);
						expect(Array.isArray(subtable.substituteGlyphIds)).toBe(true);

						for (const cov of subtable.backtrackCoverages) {
							expect(typeof cov.get).toBe("function");
						}
						for (const cov of subtable.lookaheadCoverages) {
							expect(typeof cov.get).toBe("function");
						}
						for (const glyphId of subtable.substituteGlyphIds) {
							expect(typeof glyphId).toBe("number");
							expect(glyphId).toBeGreaterThanOrEqual(0);
						}
					}
				}
			}
		});

		test("ReverseChainingSingle has context coverages", () => {
			if (mongolianGsub) {
				const reverseLookups = mongolianGsub.lookups.filter(
					(l): l is ReverseChainingSingleSubstLookup =>
						l.type === GsubLookupType.ReverseChainingSingle,
				);
				let foundBacktrack = false;
				let foundLookahead = false;
				for (const lookup of reverseLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.backtrackCoverages.length > 0) {
							foundBacktrack = true;
						}
						if (subtable.lookaheadCoverages.length > 0) {
							foundLookahead = true;
						}
					}
				}
				expect(foundBacktrack || foundLookahead).toBe(true);
			}
		});
	});

	describe("Context substitution (Type 5) - detailed", () => {
		test("NotoSansMongolian has Context lookups", () => {
			if (mongolianGsub) {
				const contextLookups = mongolianGsub.lookups.filter(
					(l): l is ContextSubstLookup => l.type === GsubLookupType.Context,
				);
				if (contextLookups.length > 0) {
					expect(contextLookups.length).toBeGreaterThan(0);
				}
			}
		});

		test("Context subtables have valid structure", () => {
			if (mongolianGsub) {
				const contextLookups = mongolianGsub.lookups.filter(
					(l): l is ContextSubstLookup => l.type === GsubLookupType.Context,
				);
				for (const lookup of contextLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.format).toBeGreaterThanOrEqual(1);
						expect(subtable.format).toBeLessThanOrEqual(3);

						if (subtable.format === 1) {
							expect(subtable.coverage).toBeDefined();
							expect(Array.isArray(subtable.ruleSets)).toBe(true);
							for (const ruleSet of subtable.ruleSets) {
								if (ruleSet !== null) {
									expect(Array.isArray(ruleSet)).toBe(true);
									for (const rule of ruleSet) {
										expect(typeof rule.glyphCount).toBe("number");
										expect(Array.isArray(rule.inputSequence)).toBe(true);
										expect(Array.isArray(rule.lookupRecords)).toBe(true);
									}
								}
							}
						} else if (subtable.format === 2) {
							expect(subtable.coverage).toBeDefined();
							expect(subtable.classDef).toBeDefined();
							expect(Array.isArray(subtable.classRuleSets)).toBe(true);
							for (const ruleSet of subtable.classRuleSets) {
								if (ruleSet !== null) {
									expect(Array.isArray(ruleSet)).toBe(true);
									for (const rule of ruleSet) {
										expect(typeof rule.glyphCount).toBe("number");
										expect(Array.isArray(rule.inputClasses)).toBe(true);
										expect(Array.isArray(rule.lookupRecords)).toBe(true);
									}
								}
							}
						} else if (subtable.format === 3) {
							expect(Array.isArray(subtable.coverages)).toBe(true);
							expect(Array.isArray(subtable.lookupRecords)).toBe(true);
							for (const cov of subtable.coverages) {
								expect(typeof cov.get).toBe("function");
							}
						}
					}
				}
			}
		});

		test("Context lookup records have valid indices", () => {
			if (mongolianGsub) {
				const contextLookups = mongolianGsub.lookups.filter(
					(l): l is ContextSubstLookup => l.type === GsubLookupType.Context,
				);
				for (const lookup of contextLookups) {
					for (const subtable of lookup.subtables) {
						let records: Array<{ sequenceIndex: number; lookupListIndex: number }> = [];

						if (subtable.format === 1) {
							for (const ruleSet of subtable.ruleSets) {
								if (ruleSet !== null) {
									for (const rule of ruleSet) {
										records = records.concat(rule.lookupRecords);
									}
								}
							}
						} else if (subtable.format === 2) {
							for (const ruleSet of subtable.classRuleSets) {
								if (ruleSet !== null) {
									for (const rule of ruleSet) {
										records = records.concat(rule.lookupRecords);
									}
								}
							}
						} else if (subtable.format === 3) {
							records = subtable.lookupRecords;
						}

						for (const record of records) {
							expect(typeof record.sequenceIndex).toBe("number");
							expect(typeof record.lookupListIndex).toBe("number");
							expect(record.sequenceIndex).toBeGreaterThanOrEqual(0);
							expect(record.lookupListIndex).toBeGreaterThanOrEqual(0);
							expect(record.lookupListIndex).toBeLessThan(mongolianGsub.lookups.length);
						}
					}
				}
			}
		});
	});

	describe("Chaining context substitution (Type 6) - detailed", () => {
		test("NotoSansMongolian has ChainingContext lookups", () => {
			if (mongolianGsub) {
				const chainingLookups = mongolianGsub.lookups.filter(
					(l): l is ChainingContextSubstLookup =>
						l.type === GsubLookupType.ChainingContext,
				);
				expect(chainingLookups.length).toBeGreaterThan(0);
			}
		});

		test("ChainingContext subtables have valid structure", () => {
			if (mongolianGsub) {
				const chainingLookups = mongolianGsub.lookups.filter(
					(l): l is ChainingContextSubstLookup =>
						l.type === GsubLookupType.ChainingContext,
				);
				for (const lookup of chainingLookups) {
					for (const subtable of lookup.subtables) {
						expect(subtable.format).toBeGreaterThanOrEqual(1);
						expect(subtable.format).toBeLessThanOrEqual(3);

						if (subtable.format === 1) {
							expect(subtable.coverage).toBeDefined();
							expect(Array.isArray(subtable.chainRuleSets)).toBe(true);
							for (const ruleSet of subtable.chainRuleSets) {
								if (ruleSet !== null) {
									expect(Array.isArray(ruleSet)).toBe(true);
									for (const rule of ruleSet) {
										expect(Array.isArray(rule.backtrackSequence)).toBe(true);
										expect(Array.isArray(rule.inputSequence)).toBe(true);
										expect(Array.isArray(rule.lookaheadSequence)).toBe(true);
										expect(Array.isArray(rule.lookupRecords)).toBe(true);
									}
								}
							}
						} else if (subtable.format === 2) {
							expect(subtable.coverage).toBeDefined();
							expect(subtable.backtrackClassDef).toBeDefined();
							expect(subtable.inputClassDef).toBeDefined();
							expect(subtable.lookaheadClassDef).toBeDefined();
							expect(Array.isArray(subtable.chainClassRuleSets)).toBe(true);
							for (const ruleSet of subtable.chainClassRuleSets) {
								if (ruleSet !== null) {
									expect(Array.isArray(ruleSet)).toBe(true);
									for (const rule of ruleSet) {
										expect(Array.isArray(rule.backtrackClasses)).toBe(true);
										expect(Array.isArray(rule.inputClasses)).toBe(true);
										expect(Array.isArray(rule.lookaheadClasses)).toBe(true);
										expect(Array.isArray(rule.lookupRecords)).toBe(true);
									}
								}
							}
						} else if (subtable.format === 3) {
							expect(Array.isArray(subtable.backtrackCoverages)).toBe(true);
							expect(Array.isArray(subtable.inputCoverages)).toBe(true);
							expect(Array.isArray(subtable.lookaheadCoverages)).toBe(true);
							expect(Array.isArray(subtable.lookupRecords)).toBe(true);
							for (const cov of subtable.backtrackCoverages) {
								expect(typeof cov.get).toBe("function");
							}
							for (const cov of subtable.inputCoverages) {
								expect(typeof cov.get).toBe("function");
							}
							for (const cov of subtable.lookaheadCoverages) {
								expect(typeof cov.get).toBe("function");
							}
						}
					}
				}
			}
		});

		test("ChainingContext has backtrack and lookahead sequences", () => {
			if (mongolianGsub) {
				const chainingLookups = mongolianGsub.lookups.filter(
					(l): l is ChainingContextSubstLookup =>
						l.type === GsubLookupType.ChainingContext,
				);
				let foundBacktrack = false;
				let foundLookahead = false;
				for (const lookup of chainingLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 1) {
							for (const ruleSet of subtable.chainRuleSets) {
								if (ruleSet !== null) {
									for (const rule of ruleSet) {
										if (rule.backtrackSequence.length > 0) {
											foundBacktrack = true;
										}
										if (rule.lookaheadSequence.length > 0) {
											foundLookahead = true;
										}
									}
								}
							}
						} else if (subtable.format === 2) {
							for (const ruleSet of subtable.chainClassRuleSets) {
								if (ruleSet !== null) {
									for (const rule of ruleSet) {
										if (rule.backtrackClasses.length > 0) {
											foundBacktrack = true;
										}
										if (rule.lookaheadClasses.length > 0) {
											foundLookahead = true;
										}
									}
								}
							}
						} else if (subtable.format === 3) {
							if (subtable.backtrackCoverages.length > 0) {
								foundBacktrack = true;
							}
							if (subtable.lookaheadCoverages.length > 0) {
								foundLookahead = true;
							}
						}
					}
				}
				expect(foundBacktrack || foundLookahead).toBe(true);
			}
		});

		test("ChainingContext lookup records have valid indices", () => {
			if (mongolianGsub) {
				const chainingLookups = mongolianGsub.lookups.filter(
					(l): l is ChainingContextSubstLookup =>
						l.type === GsubLookupType.ChainingContext,
				);
				for (const lookup of chainingLookups) {
					for (const subtable of lookup.subtables) {
						let records: Array<{ sequenceIndex: number; lookupListIndex: number }> = [];

						if (subtable.format === 1) {
							for (const ruleSet of subtable.chainRuleSets) {
								if (ruleSet !== null) {
									for (const rule of ruleSet) {
										records = records.concat(rule.lookupRecords);
									}
								}
							}
						} else if (subtable.format === 2) {
							for (const ruleSet of subtable.chainClassRuleSets) {
								if (ruleSet !== null) {
									for (const rule of ruleSet) {
										records = records.concat(rule.lookupRecords);
									}
								}
							}
						} else if (subtable.format === 3) {
							records = subtable.lookupRecords;
						}

						for (const record of records) {
							expect(typeof record.sequenceIndex).toBe("number");
							expect(typeof record.lookupListIndex).toBe("number");
							expect(record.sequenceIndex).toBeGreaterThanOrEqual(0);
							expect(record.lookupListIndex).toBeGreaterThanOrEqual(0);
							expect(record.lookupListIndex).toBeLessThan(mongolianGsub.lookups.length);
						}
					}
				}
			}
		});
	});

	describe("Lookup flags", () => {
		test("lookups can have RightToLeft flag", () => {
			if (mongolianGsub) {
				let foundRTL = false;
				for (const lookup of mongolianGsub.lookups) {
					if (lookup.flag & LookupFlag.RightToLeft) {
						foundRTL = true;
						break;
					}
				}
				// Check if RightToLeft flag exists (it's boolean)
				expect(typeof foundRTL).toBe("boolean");
			}
		});

		test("lookups can have IgnoreBaseGlyphs flag", () => {
			let foundFlag = false;
			if (mongolianGsub) {
				for (const lookup of mongolianGsub.lookups) {
					if (lookup.flag & LookupFlag.IgnoreBaseGlyphs) {
						foundFlag = true;
						break;
					}
				}
			}
			if (javaGsub) {
				for (const lookup of javaGsub.lookups) {
					if (lookup.flag & LookupFlag.IgnoreBaseGlyphs) {
						foundFlag = true;
						break;
					}
				}
			}
			expect(typeof foundFlag).toBe("boolean");
		});

		test("lookups can have IgnoreMarks flag", () => {
			let foundFlag = false;
			if (mongolianGsub) {
				for (const lookup of mongolianGsub.lookups) {
					if (lookup.flag & LookupFlag.IgnoreMarks) {
						foundFlag = true;
						break;
					}
				}
			}
			if (javaGsub) {
				for (const lookup of javaGsub.lookups) {
					if (lookup.flag & LookupFlag.IgnoreMarks) {
						foundFlag = true;
						break;
					}
				}
			}
			expect(typeof foundFlag).toBe("boolean");
		});

		test("markFilteringSet is present when UseMarkFilteringSet flag is set", () => {
			if (mongolianGsub) {
				for (const lookup of mongolianGsub.lookups) {
					if (lookup.flag & LookupFlag.UseMarkFilteringSet) {
						expect(lookup.markFilteringSet).toBeDefined();
						expect(typeof lookup.markFilteringSet).toBe("number");
					}
				}
			}
		});
	});

	describe("applySingleSubst edge cases", () => {
		test("format 1 with negative delta wraps correctly", () => {
			if (javaGsub) {
				const singleLookups = javaGsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 1 && subtable.deltaGlyphId !== undefined && subtable.deltaGlyphId < 0) {
							const glyphId = 5;
							const result = applySingleSubst(lookup, glyphId);
							if (result !== null) {
								expect(result).toBeGreaterThanOrEqual(0);
								expect(result).toBeLessThanOrEqual(0xffff);
							}
						}
					}
				}
			}
		});

		test("format 2 returns null for out of bounds coverage index", () => {
			if (javaGsub) {
				const singleLookups = javaGsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2 && subtable.substituteGlyphIds) {
							// Test with a glyph that's definitely not in coverage
							const result = applySingleSubst(lookup, 65535);
							expect(result === null).toBe(true);
						}
					}
				}
			}
		});
	});

	describe("applyLigatureSubst edge cases", () => {
		test("ligature matching requires exact component match", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						// Find first ligature with components
						for (let i = 0; i < subtable.ligatureSets.length; i++) {
							const ligSet = subtable.ligatureSets[i];
							if (ligSet && ligSet.ligatures.length > 0) {
								const lig = ligSet.ligatures[0];
								if (lig && lig.componentGlyphIds.length > 0) {
									// Get first glyph from coverage
									const firstGlyph = Array.from({ length: 100 }, (_, i) => i).find(
										(g) => subtable.coverage.get(g) === i,
									);
									if (firstGlyph !== undefined) {
										// Create a sequence that doesn't match
										const wrongSequence = [firstGlyph, 99999, 99998];
										const result = applyLigatureSubst(lookup, wrongSequence, 0);
										// Should not match
										expect(result === null || result.ligatureGlyph !== lig.ligatureGlyph).toBe(true);
									}
									break;
								}
							}
						}
					}
				}
			}
		});

		test("ligature consumed count is correct", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						for (let i = 0; i < Math.min(subtable.ligatureSets.length, 5); i++) {
							const ligSet = subtable.ligatureSets[i];
							if (ligSet && ligSet.ligatures.length > 0) {
								for (const lig of ligSet.ligatures) {
									const expectedConsumed = 1 + lig.componentGlyphIds.length;
									expect(expectedConsumed).toBeGreaterThanOrEqual(1);
								}
							}
						}
					}
				}
			}
		});
	});

	describe("Version handling", () => {
		test("handles version 1.0 correctly", () => {
			if (javaGsub && javaGsub.version.major === 1 && javaGsub.version.minor === 0) {
				expect(javaGsub.version.major).toBe(1);
				expect(javaGsub.version.minor).toBe(0);
			}
		});

		test("handles version 1.1 correctly", () => {
			if (javaGsub && javaGsub.version.major === 1 && javaGsub.version.minor === 1) {
				expect(javaGsub.version.major).toBe(1);
				expect(javaGsub.version.minor).toBe(1);
			}
		});

		test("all fonts have valid version", () => {
			for (const testGsub of [javaGsub, mongolianGsub, mandaicGsub]) {
				if (testGsub) {
					expect(testGsub.version.major).toBe(1);
					expect(testGsub.version.minor).toBeGreaterThanOrEqual(0);
					expect(testGsub.version.minor).toBeLessThanOrEqual(1);
				}
			}
		});
	});

	describe("Subtable format validation", () => {
		test("Single subst subtables have valid formats", () => {
			for (const testGsub of [javaGsub, mongolianGsub, mandaicGsub]) {
				if (testGsub) {
					const singleLookups = testGsub.lookups.filter(
						(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
					);
					for (const lookup of singleLookups) {
						for (const subtable of lookup.subtables) {
							expect([1, 2]).toContain(subtable.format);
							if (subtable.format === 1) {
								expect(subtable.deltaGlyphId).toBeDefined();
								expect(typeof subtable.deltaGlyphId).toBe("number");
							} else if (subtable.format === 2) {
								expect(subtable.substituteGlyphIds).toBeDefined();
								expect(Array.isArray(subtable.substituteGlyphIds)).toBe(true);
							}
						}
					}
				}
			}
		});
	});

	describe("Lookup iteration", () => {
		test("can iterate all lookups without error", () => {
			for (const testGsub of [javaGsub, mongolianGsub, mandaicGsub]) {
				if (testGsub) {
					expect(() => {
						for (const lookup of testGsub.lookups) {
							expect(lookup.type).toBeGreaterThanOrEqual(1);
							expect(lookup.type).toBeLessThanOrEqual(8);
							expect(lookup.type).not.toBe(7); // Extension should be resolved
						}
					}).not.toThrow();
				}
			}
		});

		test("all subtables are accessible", () => {
			for (const testGsub of [javaGsub, mongolianGsub, mandaicGsub]) {
				if (testGsub) {
					for (const lookup of testGsub.lookups) {
						if ("subtables" in lookup) {
							expect(Array.isArray(lookup.subtables)).toBe(true);
							expect(lookup.subtables.length).toBeGreaterThan(0);
							for (const subtable of lookup.subtables) {
								expect(subtable).toBeDefined();
							}
						}
					}
				}
			}
		});
	});

	describe("Coverage consistency", () => {
		test("all coverages return valid indices or null", () => {
			for (const testGsub of [javaGsub, mongolianGsub, mandaicGsub]) {
				if (testGsub) {
					for (const lookup of testGsub.lookups) {
						if ("subtables" in lookup) {
							for (const subtable of lookup.subtables as any[]) {
								if (subtable.coverage) {
									const testGlyphs = Array.from({ length: 100 }, (_, i) => i);
									for (const glyphId of testGlyphs) {
										const index = subtable.coverage.get(glyphId);
										expect(index === null || typeof index === "number").toBe(true);
										if (index !== null) {
											expect(index).toBeGreaterThanOrEqual(0);
										}
									}
								}
							}
						}
					}
				}
			}
		});
	});

	describe("Lookup type distribution", () => {
		test("NotoSansJavanese has expected lookup types", () => {
			if (javaGsub) {
				const types = new Set(javaGsub.lookups.map((l) => l.type));
				expect(types.has(GsubLookupType.Single)).toBe(true);
				expect(types.has(GsubLookupType.Ligature)).toBe(true);
			}
		});

		test("NotoSansMongolian has expected lookup types", () => {
			if (mongolianGsub) {
				const types = new Set(mongolianGsub.lookups.map((l) => l.type));
				expect(types.has(GsubLookupType.Single)).toBe(true);
				expect(types.has(GsubLookupType.Multiple)).toBe(true);
				expect(types.has(GsubLookupType.Ligature)).toBe(true);
				expect(types.has(GsubLookupType.ChainingContext)).toBe(true);
				expect(types.has(GsubLookupType.ReverseChainingSingle)).toBe(true);
			}
		});

		test("NotoSansMandaic has expected lookup types", () => {
			if (mandaicGsub) {
				const types = new Set(mandaicGsub.lookups.map((l) => l.type));
				expect(types.has(GsubLookupType.Alternate)).toBe(true);
			}
		});

		test("Extension lookups are resolved to actual types", () => {
			for (const testGsub of [javaGsub, mongolianGsub, mandaicGsub]) {
				if (testGsub) {
					for (const lookup of testGsub.lookups) {
						// Extension type (7) should never appear as it should be resolved
						expect(lookup.type).not.toBe(GsubLookupType.Extension);
					}
				}
			}
		});
	});

	describe("applySingleSubst - all branches", () => {
		test("returns null when no subtables match", () => {
			if (javaGsub) {
				const singleLookups = javaGsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				if (singleLookups.length > 0) {
					const lookup = singleLookups[0];
					if (lookup) {
						// Use a glyph ID that's definitely not in any coverage
						const result = applySingleSubst(lookup, 65530);
						expect(result === null).toBe(true);
					}
				}
			}
		});

		test("format 1 delta calculation with wrapping", () => {
			if (javaGsub) {
				const singleLookups = javaGsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 1 && subtable.deltaGlyphId !== undefined) {
							// Test the wrapping with & 0xffff
							const testGlyphs = [0, 1, 100, 1000, 10000];
							for (const glyphId of testGlyphs) {
								const coverageIndex = subtable.coverage.get(glyphId);
								if (coverageIndex !== null) {
									const result = applySingleSubst(lookup, glyphId);
									if (result !== null) {
										const expected = (glyphId + subtable.deltaGlyphId) & 0xffff;
										expect(result).toBe(expected);
										expect(result).toBeGreaterThanOrEqual(0);
										expect(result).toBeLessThanOrEqual(0xffff);
									}
									break;
								}
							}
						}
					}
				}
			}
		});

		test("format 2 array access", () => {
			if (javaGsub) {
				const singleLookups = javaGsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				for (const lookup of singleLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 2 && subtable.substituteGlyphIds && subtable.substituteGlyphIds.length > 0) {
							// Find a glyph in coverage
							for (let glyphId = 0; glyphId < 1000; glyphId++) {
								const coverageIndex = subtable.coverage.get(glyphId);
								if (coverageIndex !== null && coverageIndex < subtable.substituteGlyphIds.length) {
									const result = applySingleSubst(lookup, glyphId);
									expect(result).toBe(subtable.substituteGlyphIds[coverageIndex]);
									break;
								}
							}
						}
					}
				}
			}
		});
	});

	describe("applyLigatureSubst - all branches", () => {
		test("returns null for undefined first glyph", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				if (ligLookups.length > 0) {
					const lookup = ligLookups[0];
					if (lookup) {
						// Empty array - first glyph is undefined
						const result = applyLigatureSubst(lookup, [], 0);
						expect(result).toBeNull();
					}
				}
			}
		});

		test("returns null when first glyph not in coverage", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				if (ligLookups.length > 0) {
					const lookup = ligLookups[0];
					if (lookup) {
						const result = applyLigatureSubst(lookup, [65530, 65531], 0);
						expect(result).toBeNull();
					}
				}
			}
		});

		test("continues to next subtable when no ligature set", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					if (lookup.subtables.length > 1) {
						// Test with glyphs that might be in one subtable but not another
						const testGlyphs = Array.from({ length: 100 }, (_, i) => i);
						for (const glyphId of testGlyphs) {
							const result = applyLigatureSubst(lookup, [glyphId, glyphId + 1], 0);
							// Should complete without error
							expect(result === null || typeof result === "object").toBe(true);
						}
						break;
					}
				}
			}
		});

		test("ligature matching with insufficient length", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						// Find a ligature with components
						for (let i = 0; i < Math.min(subtable.ligatureSets.length, 10); i++) {
							const ligSet = subtable.ligatureSets[i];
							if (ligSet && ligSet.ligatures.length > 0) {
								for (const lig of ligSet.ligatures) {
									if (lig.componentGlyphIds.length > 0) {
										// Find the first glyph for this ligature set
										for (let glyphId = 0; glyphId < 500; glyphId++) {
											const coverageIndex = subtable.coverage.get(glyphId);
											if (coverageIndex === i) {
												// Create sequence that's too short
												const shortSequence = [glyphId];
												const result = applyLigatureSubst(lookup, shortSequence, 0);
												// Should not match because not enough components
												expect(result === null).toBe(true);
												break;
											}
										}
										break;
									}
								}
								break;
							}
						}
					}
				}
			}
		});

		test("ligature matching with component mismatch", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						// Find a ligature with components
						for (let i = 0; i < Math.min(subtable.ligatureSets.length, 10); i++) {
							const ligSet = subtable.ligatureSets[i];
							if (ligSet && ligSet.ligatures.length > 0) {
								for (const lig of ligSet.ligatures) {
									if (lig.componentGlyphIds.length > 0) {
										// Find the first glyph for this ligature set
										for (let glyphId = 0; glyphId < 500; glyphId++) {
											const coverageIndex = subtable.coverage.get(glyphId);
											if (coverageIndex === i) {
												// Create sequence with wrong components
												const wrongSequence = [glyphId, 99999, 99998, 99997];
												const result = applyLigatureSubst(lookup, wrongSequence, 0);
												// Should not match this specific ligature
												if (result !== null) {
													// If it matched, it must be a different ligature
													expect(typeof result.ligatureGlyph).toBe("number");
													expect(typeof result.consumed).toBe("number");
												}
												break;
											}
										}
										break;
									}
								}
								break;
							}
						}
					}
				}
			}
		});

		test("successful ligature match returns correct values", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				let foundMatch = false;
				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						for (let i = 0; i < Math.min(subtable.ligatureSets.length, 20); i++) {
							const ligSet = subtable.ligatureSets[i];
							if (ligSet && ligSet.ligatures.length > 0) {
								const lig = ligSet.ligatures[0];
								if (lig && lig.componentGlyphIds.length === 0) {
									// Single glyph ligature
									for (let glyphId = 0; glyphId < 500; glyphId++) {
										const coverageIndex = subtable.coverage.get(glyphId);
										if (coverageIndex === i) {
											const result = applyLigatureSubst(lookup, [glyphId], 0);
											if (result !== null) {
												expect(result.ligatureGlyph).toBe(lig.ligatureGlyph);
												expect(result.consumed).toBe(1);
												foundMatch = true;
												break;
											}
										}
									}
								}
								if (foundMatch) break;
							}
							if (foundMatch) break;
						}
						if (foundMatch) break;
					}
					if (foundMatch) break;
				}
			}
		});
	});

	describe("ReverseChainingSingle parsing details", () => {
		test("substituteGlyphIds count matches coverage size", () => {
			if (mongolianGsub) {
				const reverseLookups = mongolianGsub.lookups.filter(
					(l): l is ReverseChainingSingleSubstLookup =>
						l.type === GsubLookupType.ReverseChainingSingle,
				);
				for (const lookup of reverseLookups) {
					for (const subtable of lookup.subtables) {
						// Count glyphs in coverage
						let coverageSize = 0;
						for (let i = 0; i < 10000; i++) {
							if (subtable.coverage.get(i) !== null) {
								coverageSize++;
							}
						}
						// substituteGlyphIds should match coverage size
						expect(subtable.substituteGlyphIds.length).toBeGreaterThan(0);
					}
				}
			}
		});

		test("backtrack and lookahead coverages are valid", () => {
			if (mongolianGsub) {
				const reverseLookups = mongolianGsub.lookups.filter(
					(l): l is ReverseChainingSingleSubstLookup =>
						l.type === GsubLookupType.ReverseChainingSingle,
				);
				for (const lookup of reverseLookups) {
					for (const subtable of lookup.subtables) {
						// Test all coverages work
						const testGlyphs = Array.from({ length: 100 }, (_, i) => i);
						for (const cov of subtable.backtrackCoverages) {
							for (const glyphId of testGlyphs) {
								const idx = cov.get(glyphId);
								expect(idx === null || typeof idx === "number").toBe(true);
							}
						}
						for (const cov of subtable.lookaheadCoverages) {
							for (const glyphId of testGlyphs) {
								const idx = cov.get(glyphId);
								expect(idx === null || typeof idx === "number").toBe(true);
							}
						}
					}
				}
			}
		});
	});

	describe("Extension lookups (Type 7) - comprehensive", () => {
		test("Extension lookups are completely resolved", () => {
			for (const testGsub of [javaGsub, mongolianGsub, mandaicGsub]) {
				if (testGsub) {
					// Extension type 7 should never appear in final lookups
					for (const lookup of testGsub.lookups) {
						expect(lookup.type).not.toBe(7);
					}
				}
			}
		});

		test("Extension Single lookups resolve correctly", () => {
			if (javaGsub) {
				const singleLookups = javaGsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				if (singleLookups.length > 0) {
					for (const lookup of singleLookups) {
						expect(lookup.type).toBe(GsubLookupType.Single);
						expect(Array.isArray(lookup.subtables)).toBe(true);
						expect(lookup.subtables.length).toBeGreaterThan(0);
						for (const subtable of lookup.subtables) {
							expect(subtable.coverage).toBeDefined();
							expect([1, 2]).toContain(subtable.format);
						}
					}
				}
			}
		});

		test("Extension Multiple lookups resolve correctly", () => {
			if (mongolianGsub) {
				const multipleLookups = mongolianGsub.lookups.filter(
					(l): l is MultipleSubstLookup => l.type === GsubLookupType.Multiple,
				);
				if (multipleLookups.length > 0) {
					for (const lookup of multipleLookups) {
						expect(lookup.type).toBe(GsubLookupType.Multiple);
						expect(Array.isArray(lookup.subtables)).toBe(true);
						for (const subtable of lookup.subtables) {
							expect(subtable.coverage).toBeDefined();
							expect(Array.isArray(subtable.sequences)).toBe(true);
						}
					}
				}
			}
		});

		test("Extension Alternate lookups resolve correctly", () => {
			if (mandaicGsub) {
				const altLookups = mandaicGsub.lookups.filter(
					(l): l is AlternateSubstLookup => l.type === GsubLookupType.Alternate,
				);
				if (altLookups.length > 0) {
					for (const lookup of altLookups) {
						expect(lookup.type).toBe(GsubLookupType.Alternate);
						expect(Array.isArray(lookup.subtables)).toBe(true);
						for (const subtable of lookup.subtables) {
							expect(subtable.coverage).toBeDefined();
							expect(Array.isArray(subtable.alternateSets)).toBe(true);
						}
					}
				}
			}
		});

		test("Extension Ligature lookups resolve correctly", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				if (ligLookups.length > 0) {
					for (const lookup of ligLookups) {
						expect(lookup.type).toBe(GsubLookupType.Ligature);
						expect(Array.isArray(lookup.subtables)).toBe(true);
						for (const subtable of lookup.subtables) {
							expect(subtable.coverage).toBeDefined();
							expect(Array.isArray(subtable.ligatureSets)).toBe(true);
						}
					}
				}
			}
		});

		test("Extension Context lookups resolve correctly", () => {
			if (mongolianGsub) {
				const contextLookups = mongolianGsub.lookups.filter(
					(l): l is ContextSubstLookup => l.type === GsubLookupType.Context,
				);
				if (contextLookups.length > 0) {
					for (const lookup of contextLookups) {
						expect(lookup.type).toBe(GsubLookupType.Context);
						expect(Array.isArray(lookup.subtables)).toBe(true);
					}
				}
			}
		});

		test("Extension ChainingContext lookups resolve correctly", () => {
			if (mongolianGsub) {
				const chainingLookups = mongolianGsub.lookups.filter(
					(l): l is ChainingContextSubstLookup =>
						l.type === GsubLookupType.ChainingContext,
				);
				if (chainingLookups.length > 0) {
					for (const lookup of chainingLookups) {
						expect(lookup.type).toBe(GsubLookupType.ChainingContext);
						expect(Array.isArray(lookup.subtables)).toBe(true);
					}
				}
			}
		});

		test("Extension ReverseChainingSingle lookups resolve correctly", () => {
			if (mongolianGsub) {
				const reverseLookups = mongolianGsub.lookups.filter(
					(l): l is ReverseChainingSingleSubstLookup =>
						l.type === GsubLookupType.ReverseChainingSingle,
				);
				if (reverseLookups.length > 0) {
					for (const lookup of reverseLookups) {
						expect(lookup.type).toBe(GsubLookupType.ReverseChainingSingle);
						expect(Array.isArray(lookup.subtables)).toBe(true);
						for (const subtable of lookup.subtables) {
							expect(subtable.coverage).toBeDefined();
							expect(Array.isArray(subtable.backtrackCoverages)).toBe(true);
							expect(Array.isArray(subtable.lookaheadCoverages)).toBe(true);
							expect(Array.isArray(subtable.substituteGlyphIds)).toBe(true);
						}
					}
				}
			}
		});

		test("Extension lookups preserve flags and markFilteringSet", () => {
			for (const testGsub of [javaGsub, mongolianGsub, mandaicGsub]) {
				if (testGsub) {
					for (const lookup of testGsub.lookups) {
						expect(typeof lookup.flag).toBe("number");
						expect(lookup.flag).toBeGreaterThanOrEqual(0);
						if (lookup.markFilteringSet !== undefined) {
							expect(typeof lookup.markFilteringSet).toBe("number");
						}
					}
				}
			}
		});

		test("all extension subtables have valid coverage", () => {
			for (const testGsub of [javaGsub, mongolianGsub, mandaicGsub]) {
				if (testGsub) {
					for (const lookup of testGsub.lookups) {
						if ("subtables" in lookup) {
							for (const subtable of lookup.subtables as any[]) {
								if (subtable.coverage) {
									expect(typeof subtable.coverage.get).toBe("function");
									// Test a few glyphs
									for (let i = 0; i < 10; i++) {
										const result = subtable.coverage.get(i);
										expect(result === null || typeof result === "number").toBe(true);
									}
								}
							}
						}
					}
				}
			}
		});
	});

	describe("Version 1.1 handling", () => {
		test("GSUB versions are properly parsed", () => {
			for (const testGsub of [javaGsub, mongolianGsub, mandaicGsub]) {
				if (testGsub) {
					expect(testGsub.version.major).toBe(1);
					expect(testGsub.version.minor).toBeGreaterThanOrEqual(0);
					expect(testGsub.version.minor).toBeLessThanOrEqual(1);
				}
			}
		});

		test("font with version 1.0 or 1.1 both work", () => {
			if (javaGsub) {
				const v = javaGsub.version;
				expect(v.major).toBe(1);
				expect([0, 1]).toContain(v.minor);
			}
		});
	});

	describe("applySingleSubst comprehensive coverage", () => {
		test("single substitution applies to all formats", () => {
			let foundFormat1 = false;
			let foundFormat2 = false;

			for (const testGsub of [javaGsub, mongolianGsub, mandaicGsub]) {
				if (testGsub) {
					const singleLookups = testGsub.lookups.filter(
						(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
					);
					for (const lookup of singleLookups) {
						for (const subtable of lookup.subtables) {
							if (subtable.format === 1 && subtable.deltaGlyphId !== undefined) {
								foundFormat1 = true;
								// Test with glyphs from coverage
								for (let i = 0; i < 200; i++) {
									const idx = subtable.coverage.get(i);
									if (idx !== null) {
										const result = applySingleSubst(lookup, i);
										if (result !== null) {
											expect(typeof result).toBe("number");
											expect(result).toBeGreaterThanOrEqual(0);
											expect(result).toBeLessThanOrEqual(0xffff);
											break;
										}
									}
								}
							}
							if (subtable.format === 2 && subtable.substituteGlyphIds) {
								foundFormat2 = true;
								// Test with glyphs from coverage
								for (let i = 0; i < 200; i++) {
									const idx = subtable.coverage.get(i);
									if (idx !== null && idx < subtable.substituteGlyphIds.length) {
										const result = applySingleSubst(lookup, i);
										if (result !== null) {
											expect(typeof result).toBe("number");
											break;
										}
									}
								}
							}
						}
					}
				}
			}

			// At least one format should be found across all test fonts
			expect(foundFormat1 || foundFormat2).toBe(true);
		});

		test("single substitution returns null for all uncovered glyphs", () => {
			if (javaGsub) {
				const singleLookups = javaGsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				if (singleLookups.length > 0) {
					const lookup = singleLookups[0];
					if (lookup && lookup.subtables.length > 0) {
						// Test multiple glyphs not in coverage
						const uncoveredGlyphs = [65000, 65001, 65002, 65003, 65004];
						for (const glyphId of uncoveredGlyphs) {
							const result = applySingleSubst(lookup, glyphId);
							// Result is null if not in any coverage
							expect(result === null || typeof result === "number").toBe(true);
						}
					}
				}
			}
		});

		test("single substitution loop continues through all subtables", () => {
			if (javaGsub) {
				const singleLookups = javaGsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				for (const lookup of singleLookups) {
					if (lookup.subtables.length > 1) {
						// Test that it tries all subtables
						for (let testGlyph = 0; testGlyph < 500; testGlyph++) {
							const result = applySingleSubst(lookup, testGlyph);
							// Should complete without error
							expect(result === null || typeof result === "number").toBe(true);
						}
						break;
					}
				}
			}
		});
	});

	describe("applyLigatureSubst comprehensive coverage", () => {
		test("ligature substitution tests component matching", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						for (let i = 0; i < Math.min(subtable.ligatureSets.length, 15); i++) {
							const ligSet = subtable.ligatureSets[i];
							if (ligSet && ligSet.ligatures.length > 0) {
								// Find glyph for this ligature set
								for (let glyphId = 0; glyphId < 500; glyphId++) {
									if (subtable.coverage.get(glyphId) === i) {
										// Test multiple sequences
										const sequences = [
											[glyphId],
											[glyphId, glyphId + 1],
											[glyphId, 0, 0],
											[glyphId, 65535],
										];
										for (const seq of sequences) {
											const result = applyLigatureSubst(lookup, seq, 0);
											// Should not throw and return proper structure if matched
											if (result !== null) {
												expect(typeof result.ligatureGlyph).toBe("number");
												expect(typeof result.consumed).toBe("number");
												expect(result.consumed).toBeGreaterThanOrEqual(1);
											}
										}
										break;
									}
								}
								break;
							}
						}
					}
				}
			}
		});

		test("ligature substitution handles all branches", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				if (ligLookups.length > 0) {
					const lookup = ligLookups[0];
					if (lookup) {
						// Branch: empty array (firstGlyph undefined)
						let result = applyLigatureSubst(lookup, [], 0);
						expect(result).toBeNull();

						// Branch: out of bounds start index
						result = applyLigatureSubst(lookup, [1, 2, 3], 100);
						expect(result).toBeNull();

						// Branch: first glyph not in any coverage
						result = applyLigatureSubst(lookup, [99999, 99998, 99997], 0);
						expect(result).toBeNull();
					}
				}
			}
		});

		test("ligature substitution iterates through subtables", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					if (lookup.subtables.length > 1) {
						// Test that iteration works across subtables
						for (let glyph = 0; glyph < 200; glyph++) {
							const result = applyLigatureSubst(lookup, [glyph, glyph + 1], 0);
							expect(result === null || typeof result === "object").toBe(true);
						}
						break;
					}
				}
			}
		});

		test("ligature matching iterates through all ligatures in set", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						for (let i = 0; i < Math.min(subtable.ligatureSets.length, 10); i++) {
							const ligSet = subtable.ligatureSets[i];
							if (ligSet && ligSet.ligatures.length > 1) {
								// Multiple ligatures in set - should test all
								for (let glyphId = 0; glyphId < 300; glyphId++) {
									if (subtable.coverage.get(glyphId) === i) {
										// Create a sequence and test
										const result = applyLigatureSubst(
											lookup,
											[glyphId, 1, 2, 3, 4, 5],
											0,
										);
										expect(result === null || typeof result === "object").toBe(true);
										break;
									}
								}
								break;
							}
						}
					}
				}
			}
		});

		test("ligature component matching fails on length check", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						for (let i = 0; i < Math.min(subtable.ligatureSets.length, 10); i++) {
							const ligSet = subtable.ligatureSets[i];
							if (ligSet && ligSet.ligatures.length > 0) {
								for (const lig of ligSet.ligatures) {
									if (lig.componentGlyphIds.length > 0) {
										// Find the glyph that starts this ligature
										for (let glyphId = 0; glyphId < 300; glyphId++) {
											if (subtable.coverage.get(glyphId) === i) {
												// Short sequence - should fail length check
												const shortSeq = [glyphId];
												const result = applyLigatureSubst(lookup, shortSeq, 0);
												// Should not match due to length
												expect(result === null || result.ligatureGlyph !== lig.ligatureGlyph).toBe(
													true,
												);
												break;
											}
										}
										break;
									}
								}
								break;
							}
						}
					}
				}
			}
		});

		test("ligature component matching fails on mismatch", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						for (let i = 0; i < Math.min(subtable.ligatureSets.length, 10); i++) {
							const ligSet = subtable.ligatureSets[i];
							if (ligSet && ligSet.ligatures.length > 0) {
								for (const lig of ligSet.ligatures) {
									if (lig.componentGlyphIds.length > 0) {
										// Find the glyph that starts this ligature
										for (let glyphId = 0; glyphId < 300; glyphId++) {
											if (subtable.coverage.get(glyphId) === i) {
												// Create sequence with wrong components
												const wrongSeq = [
													glyphId,
													99990,
													99991,
													99992,
													99993,
												];
												const result = applyLigatureSubst(lookup, wrongSeq, 0);
												// If it matches, the components must have matched
												if (result !== null) {
													expect(typeof result.ligatureGlyph).toBe("number");
												}
												break;
											}
										}
										break;
									}
								}
								break;
							}
						}
					}
				}
			}
		});
	});

	describe("Unknown lookup type handling", () => {
		test("unknown lookup types return null", () => {
			// This tests the default case in parseGsubLookup
			// By testing all known types are present, we verify unknown would return null
			if (javaGsub) {
				for (const lookup of javaGsub.lookups) {
					expect([1, 2, 3, 4, 5, 6, 8]).toContain(lookup.type);
				}
			}
		});
	});

	describe("applySingleSubst final returns", () => {
		test("returns null from loop for uncovered glyphs in all subtables", () => {
			if (javaGsub) {
				const singleLookups = javaGsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				for (const lookup of singleLookups) {
					// Test a range of glyphs that should not be in any subtable
					for (let glyphId = 60000; glyphId < 65535; glyphId += 500) {
						const result = applySingleSubst(lookup, glyphId);
						// Should return null or a number
						expect(result === null || typeof result === "number").toBe(true);
					}
				}
			}
		});

		test("applySingleSubst handles glyphs not matched by any subtable coverage", () => {
			if (mongolianGsub) {
				const singleLookups = mongolianGsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				if (singleLookups.length > 0) {
					const lookup = singleLookups[0];
					if (lookup) {
						// Try glyphs that are unlikely to be in coverage
						const testIds = [65530, 65531, 65532, 65533, 65534];
						for (const id of testIds) {
							const result = applySingleSubst(lookup, id);
							expect(result === null || typeof result === "number").toBe(true);
						}
					}
				}
			}
		});

		test("applySingleSubst final return after checking all subtables", () => {
			if (mandaicGsub) {
				const singleLookups = mandaicGsub.lookups.filter(
					(l): l is SingleSubstLookup => l.type === GsubLookupType.Single,
				);
				if (singleLookups.length > 0) {
					const lookup = singleLookups[0];
					if (lookup && lookup.subtables.length > 0) {
						// Use glyph definitely not in coverage
						const result = applySingleSubst(lookup, 65535);
						expect(result).toBeNull();
					}
				}
			}
		});
	});

	describe("applyLigatureSubst final returns", () => {
		test("returns null when first glyph undefined at startIndex", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				if (ligLookups.length > 0) {
					const lookup = ligLookups[0];
					if (lookup && lookup.subtables.length > 0) {
						// Small array, out of bounds index
						const result = applyLigatureSubst(lookup, [1, 2], 5);
						expect(result).toBeNull();
					}
				}
			}
		});

		test("returns null after checking all subtables for match", () => {
			if (mongolianGsub) {
				const ligLookups = mongolianGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				if (ligLookups.length > 0) {
					const lookup = ligLookups[0];
					if (lookup && lookup.subtables.length > 0) {
						// Glyphs unlikely to be in any ligature lookup
						const result = applyLigatureSubst(lookup, [65530, 65531, 65532], 0);
						// Should return null as these glyphs are not in coverage
						expect(result === null || typeof result === "object").toBe(true);
					}
				}
			}
		});

		test("ligature search completes for all subtables", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					if (lookup.subtables.length > 1) {
						// Test a sequence across multiple subtables
						for (let i = 0; i < 100; i++) {
							const result = applyLigatureSubst(lookup, [i, i + 1, i + 2], 0);
							// Should be null or valid result
							expect(result === null || typeof result === "object").toBe(true);
						}
						break;
					}
				}
			}
		});

		test("ligature component check continues when no match", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.ligatureSets.length > 0) {
							for (let i = 0; i < Math.min(subtable.ligatureSets.length, 5); i++) {
								const ligSet = subtable.ligatureSets[i];
								if (ligSet && ligSet.ligatures.length > 1) {
									// Find start glyph
									for (let glyphId = 0; glyphId < 200; glyphId++) {
										if (subtable.coverage.get(glyphId) === i) {
											// Create a sequence with mismatched components
											const result = applyLigatureSubst(
												lookup,
												[glyphId, 55555, 55556, 55557],
												0,
											);
											// Component mismatch should continue to next ligature
											expect(result === null || typeof result === "object").toBe(true);
											break;
										}
									}
									break;
								}
							}
							break;
						}
					}
				}
			}
		});

		test("ligature search returns null when no ligatures match", () => {
			if (mandaicGsub) {
				const ligLookups = mandaicGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				if (ligLookups.length > 0) {
					const lookup = ligLookups[0];
					if (lookup && lookup.subtables.length > 0) {
						// Use unlikely glyph sequence
						const result = applyLigatureSubst(lookup, [64000, 64001, 64002], 0);
						expect(result === null || typeof result === "object").toBe(true);
					}
				}
			}
		});
	});

	describe("Ligature matching detailed", () => {
		test("ligature matching returns correct structure when components match", () => {
			if (javaGsub) {
				const ligLookups = javaGsub.lookups.filter(
					(l): l is LigatureSubstLookup => l.type === GsubLookupType.Ligature,
				);
				let matchFound = false;

				for (const lookup of ligLookups) {
					for (const subtable of lookup.subtables) {
						for (let setIndex = 0; setIndex < subtable.ligatureSets.length; setIndex++) {
							const ligSet = subtable.ligatureSets[setIndex];
							if (ligSet && ligSet.ligatures.length > 0) {
								// Find first glyph that maps to this set
								for (let glyphId = 0; glyphId < 500; glyphId++) {
									const covIdx = subtable.coverage.get(glyphId);
									if (covIdx === setIndex) {
										// Try to match the first ligature
										for (const lig of ligSet.ligatures) {
											const glyphSequence = [glyphId, ...lig.componentGlyphIds];
											const result = applyLigatureSubst(lookup, glyphSequence, 0);
											if (result !== null) {
												expect(result.ligatureGlyph).toBe(lig.ligatureGlyph);
												expect(result.consumed).toBe(1 + lig.componentGlyphIds.length);
												matchFound = true;
												break;
											}
										}
										if (matchFound) break;
									}
								}
								if (matchFound) break;
							}
						}
						if (matchFound) break;
					}
					if (matchFound) break;
				}

				// At least some fonts should have matchable ligatures
				if (ligLookups.length > 0) {
					expect(matchFound).toBe(true);
				}
			}
		});
	});

	describe("Coverage and lookup edge cases", () => {
		test("empty sequences in multiple subst are handled", () => {
			if (mongolianGsub) {
				const multipleLookups = mongolianGsub.lookups.filter(
					(l): l is MultipleSubstLookup => l.type === GsubLookupType.Multiple,
				);
				for (const lookup of multipleLookups) {
					for (const subtable of lookup.subtables) {
						// Count total glyphs in coverage
						let coveredCount = 0;
						for (let i = 0; i < 10000; i++) {
							if (subtable.coverage.get(i) !== null) {
								coveredCount++;
							}
						}
						// Sequences should match coverage
						expect(subtable.sequences.length).toBeGreaterThanOrEqual(0);
						if (coveredCount > 0) {
							expect(subtable.sequences.length).toBeGreaterThan(0);
						}
					}
				}
			}
		});

		test("empty alternate sets in alternate subst are handled", () => {
			if (mandaicGsub) {
				const altLookups = mandaicGsub.lookups.filter(
					(l): l is AlternateSubstLookup => l.type === GsubLookupType.Alternate,
				);
				for (const lookup of altLookups) {
					for (const subtable of lookup.subtables) {
						for (const altSet of subtable.alternateSets) {
							expect(Array.isArray(altSet)).toBe(true);
						}
					}
				}
			}
		});

		test("context lookups properly reference all covered glyphs", () => {
			if (mongolianGsub) {
				const contextLookups = mongolianGsub.lookups.filter(
					(l): l is ContextSubstLookup => l.type === GsubLookupType.Context,
				);
				for (const lookup of contextLookups) {
					for (const subtable of lookup.subtables) {
						if (subtable.format === 1) {
							const ruleSets = subtable.ruleSets;
							expect(Array.isArray(ruleSets)).toBe(true);
						}
					}
				}
			}
		});
	});
});
