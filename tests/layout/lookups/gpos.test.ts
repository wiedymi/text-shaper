import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import { GposLookupType } from "../../../src/font/tables/gpos.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("GPOS lookups", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("GposLookupType enum", () => {
		test("has Single value", () => {
			expect(GposLookupType.Single).toBe(1);
		});

		test("has Pair value", () => {
			expect(GposLookupType.Pair).toBe(2);
		});

		test("has Cursive value", () => {
			expect(GposLookupType.Cursive).toBe(3);
		});
	});

	describe("GPOS table parsing", () => {
		test("font has GPOS table", () => {
			const gpos = font.gpos;
			expect(gpos).toBeDefined();
		});

		test("GPOS has version", () => {
			const gpos = font.gpos;
			if (gpos) {
				expect(gpos.version).toBeDefined();
				expect(gpos.version.major).toBe(1);
				expect(gpos.version.minor).toBeGreaterThanOrEqual(0);
			}
		});

		test("GPOS has scriptList object", () => {
			const gpos = font.gpos;
			if (gpos) {
				expect(gpos.scriptList).toBeDefined();
				expect(typeof gpos.scriptList).toBe("object");
			}
		});

		test("GPOS has featureList object", () => {
			const gpos = font.gpos;
			if (gpos) {
				expect(gpos.featureList).toBeDefined();
				expect(typeof gpos.featureList).toBe("object");
			}
		});

		test("GPOS has lookups array", () => {
			const gpos = font.gpos;
			if (gpos) {
				expect(gpos.lookups).toBeDefined();
				expect(Array.isArray(gpos.lookups)).toBe(true);
			}
		});
	});

	describe("lookup structure", () => {
		test("each lookup has type", () => {
			const gpos = font.gpos;
			if (gpos) {
				for (const lookup of gpos.lookups) {
					expect(lookup.type).toBeDefined();
					expect(lookup.type).toBeGreaterThanOrEqual(1);
					expect(lookup.type).toBeLessThanOrEqual(9);
				}
			}
		});

		test("each lookup has flag", () => {
			const gpos = font.gpos;
			if (gpos) {
				for (const lookup of gpos.lookups) {
					expect(typeof lookup.flag).toBe("number");
				}
			}
		});

		test("Pair lookup (type 2) has subtables", () => {
			const gpos = font.gpos;
			if (gpos) {
				const pairLookups = gpos.lookups.filter(
					(l) => l.type === GposLookupType.Pair,
				);
				for (const lookup of pairLookups) {
					if ("subtables" in lookup) {
						expect(Array.isArray(lookup.subtables)).toBe(true);
					}
				}
			}
		});
	});

	describe("Pair adjustment (kerning)", () => {
		test("format 1 pair adjustment has pairSets", () => {
			const gpos = font.gpos;
			if (gpos) {
				for (const lookup of gpos.lookups) {
					if (lookup.type === GposLookupType.Pair && "subtables" in lookup) {
						for (const subtable of lookup.subtables as any[]) {
							if (subtable.format === 1 && subtable.pairSets) {
								expect(Array.isArray(subtable.pairSets)).toBe(true);
							}
						}
					}
				}
			}
		});

		test("format 2 pair adjustment has class definitions", () => {
			const gpos = font.gpos;
			if (gpos) {
				for (const lookup of gpos.lookups) {
					if (lookup.type === GposLookupType.Pair && "subtables" in lookup) {
						for (const subtable of lookup.subtables as any[]) {
							if (subtable.format === 2) {
								expect(subtable.classDef1).toBeDefined();
								expect(subtable.classDef2).toBeDefined();
							}
						}
					}
				}
			}
		});
	});

	describe("coverage tables in lookups", () => {
		test("Single adjustment subtables have coverage", () => {
			const gpos = font.gpos;
			if (gpos) {
				for (const lookup of gpos.lookups) {
					if (
						lookup.type === GposLookupType.Single &&
						"subtables" in lookup
					) {
						for (const subtable of lookup.subtables as any[]) {
							expect(subtable.coverage).toBeDefined();
						}
					}
				}
			}
		});

		test("Pair adjustment subtables have coverage", () => {
			const gpos = font.gpos;
			if (gpos) {
				for (const lookup of gpos.lookups) {
					if (lookup.type === GposLookupType.Pair && "subtables" in lookup) {
						for (const subtable of lookup.subtables as any[]) {
							expect(subtable.coverage).toBeDefined();
						}
					}
				}
			}
		});
	});

	describe("lookup flags", () => {
		test("flag values are valid", () => {
			const gpos = font.gpos;
			if (gpos) {
				for (const lookup of gpos.lookups) {
					expect(lookup.flag).toBeGreaterThanOrEqual(0);
					expect(lookup.flag).toBeLessThanOrEqual(0xffff);
				}
			}
		});

		test("markFilteringSet is optional", () => {
			const gpos = font.gpos;
			if (gpos) {
				for (const lookup of gpos.lookups) {
					if (lookup.markFilteringSet !== undefined) {
						expect(typeof lookup.markFilteringSet).toBe("number");
					}
				}
			}
		});
	});

	describe("edge cases", () => {
		test("handles lookup iteration gracefully", () => {
			const gpos = font.gpos;
			if (gpos) {
				expect(() => {
					for (const _ of gpos.lookups) {
						// Do nothing
					}
				}).not.toThrow();
			}
		});

		test("lookup count is reasonable", () => {
			const gpos = font.gpos;
			if (gpos) {
				expect(gpos.lookups.length).toBeGreaterThanOrEqual(0);
				expect(gpos.lookups.length).toBeLessThan(10000);
			}
		});

		test("handles missing subtables gracefully", () => {
			const gpos = font.gpos;
			if (gpos) {
				expect(() => {
					for (const lookup of gpos.lookups) {
						if ("subtables" in lookup) {
							for (const _ of (lookup as any).subtables) {
								// Do nothing
							}
						}
					}
				}).not.toThrow();
			}
		});
	});
});
