import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import { GsubLookupType } from "../../../src/font/tables/gsub.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("GSUB lookups", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("GsubLookupType enum", () => {
		test("has correct values", () => {
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

	describe("GSUB table parsing", () => {
		test("font has GSUB table", () => {
			const gsub = font.gsub;
			expect(gsub).toBeDefined();
		});

		test("GSUB has version", () => {
			const gsub = font.gsub;
			if (gsub) {
				expect(gsub.version).toBeDefined();
				expect(gsub.version.major).toBe(1);
				expect(gsub.version.minor).toBeGreaterThanOrEqual(0);
			}
		});

		test("GSUB has scriptList object", () => {
			const gsub = font.gsub;
			if (gsub) {
				expect(gsub.scriptList).toBeDefined();
				expect(typeof gsub.scriptList).toBe("object");
			}
		});

		test("GSUB has featureList object", () => {
			const gsub = font.gsub;
			if (gsub) {
				expect(gsub.featureList).toBeDefined();
				expect(typeof gsub.featureList).toBe("object");
			}
		});

		test("GSUB has lookups array", () => {
			const gsub = font.gsub;
			if (gsub) {
				expect(gsub.lookups).toBeDefined();
				expect(Array.isArray(gsub.lookups)).toBe(true);
			}
		});
	});

	describe("lookup structure", () => {
		test("each lookup has type", () => {
			const gsub = font.gsub;
			if (gsub) {
				for (const lookup of gsub.lookups) {
					expect(lookup.type).toBeDefined();
					expect(lookup.type).toBeGreaterThanOrEqual(1);
					expect(lookup.type).toBeLessThanOrEqual(8);
				}
			}
		});

		test("each lookup has flag", () => {
			const gsub = font.gsub;
			if (gsub) {
				for (const lookup of gsub.lookups) {
					expect(typeof lookup.flag).toBe("number");
				}
			}
		});

		test("Single lookup (type 1) has subtables", () => {
			const gsub = font.gsub;
			if (gsub) {
				const singleLookups = gsub.lookups.filter(
					(l) => l.type === GsubLookupType.Single,
				);
				for (const lookup of singleLookups) {
					if ("subtables" in lookup) {
						expect(Array.isArray(lookup.subtables)).toBe(true);
					}
				}
			}
		});

		test("Ligature lookup (type 4) has subtables with ligature sets", () => {
			const gsub = font.gsub;
			if (gsub) {
				const ligLookups = gsub.lookups.filter(
					(l) => l.type === GsubLookupType.Ligature,
				);
				for (const lookup of ligLookups) {
					if ("subtables" in lookup) {
						expect(Array.isArray(lookup.subtables)).toBe(true);
						for (const subtable of lookup.subtables as any[]) {
							if (subtable.ligatureSets) {
								expect(Array.isArray(subtable.ligatureSets)).toBe(true);
							}
						}
					}
				}
			}
		});
	});

	describe("coverage tables in lookups", () => {
		test("Single subst subtables have coverage", () => {
			const gsub = font.gsub;
			if (gsub) {
				for (const lookup of gsub.lookups) {
					if (
						lookup.type === GsubLookupType.Single &&
						"subtables" in lookup
					) {
						for (const subtable of lookup.subtables as any[]) {
							expect(subtable.coverage).toBeDefined();
						}
					}
				}
			}
		});

		test("Ligature subst subtables have coverage", () => {
			const gsub = font.gsub;
			if (gsub) {
				for (const lookup of gsub.lookups) {
					if (
						lookup.type === GsubLookupType.Ligature &&
						"subtables" in lookup
					) {
						for (const subtable of lookup.subtables as any[]) {
							expect(subtable.coverage).toBeDefined();
						}
					}
				}
			}
		});
	});

	describe("Single substitution formats", () => {
		test("format 1 has deltaGlyphId", () => {
			const gsub = font.gsub;
			if (gsub) {
				for (const lookup of gsub.lookups) {
					if (
						lookup.type === GsubLookupType.Single &&
						"subtables" in lookup
					) {
						for (const subtable of lookup.subtables as any[]) {
							if (subtable.format === 1) {
								expect(typeof subtable.deltaGlyphId).toBe("number");
							}
						}
					}
				}
			}
		});

		test("format 2 has substituteGlyphIds array", () => {
			const gsub = font.gsub;
			if (gsub) {
				for (const lookup of gsub.lookups) {
					if (
						lookup.type === GsubLookupType.Single &&
						"subtables" in lookup
					) {
						for (const subtable of lookup.subtables as any[]) {
							if (subtable.format === 2) {
								expect(Array.isArray(subtable.substituteGlyphIds)).toBe(true);
							}
						}
					}
				}
			}
		});
	});

	describe("Ligature structure", () => {
		test("ligatures have ligatureGlyph", () => {
			const gsub = font.gsub;
			if (gsub) {
				for (const lookup of gsub.lookups) {
					if (
						lookup.type === GsubLookupType.Ligature &&
						"subtables" in lookup
					) {
						for (const subtable of lookup.subtables as any[]) {
							if (subtable.ligatureSets) {
								for (const ligSet of subtable.ligatureSets) {
									for (const lig of ligSet.ligatures || []) {
										expect(typeof lig.ligatureGlyph).toBe("number");
									}
								}
							}
						}
					}
				}
			}
		});

		test("ligatures have componentGlyphIds", () => {
			const gsub = font.gsub;
			if (gsub) {
				for (const lookup of gsub.lookups) {
					if (
						lookup.type === GsubLookupType.Ligature &&
						"subtables" in lookup
					) {
						for (const subtable of lookup.subtables as any[]) {
							if (subtable.ligatureSets) {
								for (const ligSet of subtable.ligatureSets) {
									for (const lig of ligSet.ligatures || []) {
										expect(Array.isArray(lig.componentGlyphIds)).toBe(true);
									}
								}
							}
						}
					}
				}
			}
		});
	});

	describe("lookup flags", () => {
		test("flag values are valid", () => {
			const gsub = font.gsub;
			if (gsub) {
				for (const lookup of gsub.lookups) {
					expect(lookup.flag).toBeGreaterThanOrEqual(0);
					expect(lookup.flag).toBeLessThanOrEqual(0xffff);
				}
			}
		});

		test("markFilteringSet is optional", () => {
			const gsub = font.gsub;
			if (gsub) {
				for (const lookup of gsub.lookups) {
					if (lookup.markFilteringSet !== undefined) {
						expect(typeof lookup.markFilteringSet).toBe("number");
					}
				}
			}
		});
	});

	describe("edge cases", () => {
		test("handles lookup iteration gracefully", () => {
			const gsub = font.gsub;
			if (gsub) {
				expect(() => {
					for (const _ of gsub.lookups) {
						// Do nothing
					}
				}).not.toThrow();
			}
		});

		test("lookup count is reasonable", () => {
			const gsub = font.gsub;
			if (gsub) {
				expect(gsub.lookups.length).toBeGreaterThanOrEqual(0);
				expect(gsub.lookups.length).toBeLessThan(10000);
			}
		});
	});
});
