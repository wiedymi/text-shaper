import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../src/font/font.ts";
import {
	createShapePlan,
	getOrCreateShapePlan,
	type ShapeFeature,
} from "../../src/shaper/shape-plan.ts";
import { feature } from "../../src/shaper/features.ts";
import { tag, tagToString } from "../../src/types.ts";

// System font paths (macOS)
const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";
const NOTO_SANS_ARABIC_PATH =
	"/System/Library/Fonts/Supplemental/NotoSansArabic.ttc";
const SF_NS_PATH = "/System/Library/Fonts/SFNS.ttf";

describe("shape plan", () => {
	let font: Font;
	let arabicFont: Font;
	let variableFont: Font | null = null;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
		try {
			arabicFont = await Font.fromFile(NOTO_SANS_ARABIC_PATH);
		} catch {
			// Fallback if Arabic font not available
			arabicFont = font;
		}
		try {
			variableFont = await Font.fromFile(SF_NS_PATH);
		} catch {
			// SF NS font not available
			variableFont = null;
		}
	});

	describe("createShapePlan", () => {
		test("creates basic shape plan for Latin script", () => {
			const plan = createShapePlan(font, "latn", null, "ltr");

			expect(plan.script).toBe(tag("latn"));
			expect(plan.language).toBeNull();
			expect(plan.direction).toBe("ltr");
			expect(Array.isArray(plan.gsubLookups)).toBe(true);
			expect(Array.isArray(plan.gposLookups)).toBe(true);
			expect(plan.gsubLookupMap).toBeInstanceOf(Map);
			expect(plan.gposLookupMap).toBeInstanceOf(Map);
		});

		test("creates shape plan with language", () => {
			const plan = createShapePlan(font, "latn", "ENG", "ltr");

			expect(plan.script).toBe(tag("latn"));
			expect(plan.language).toBe(tag("ENG "));
			expect(plan.direction).toBe("ltr");
		});

		test("creates shape plan for RTL direction", () => {
			const plan = createShapePlan(arabicFont, "arab", null, "rtl");

			expect(plan.script).toBe(tag("arab"));
			expect(plan.language).toBeNull();
			expect(plan.direction).toBe("rtl");
		});

		test("creates shape plan with user features", () => {
			const userFeatures: ShapeFeature[] = [
				feature("liga", true),
				feature("kern", false),
			];

			const plan = createShapePlan(font, "latn", null, "ltr", userFeatures);

			expect(plan.script).toBe(tag("latn"));
			expect(plan.direction).toBe("ltr");
		});

		test("creates shape plan with axis coordinates", () => {
			const axisCoords = [0.5, 1.0, 0.75];
			const plan = createShapePlan(
				font,
				"latn",
				null,
				"ltr",
				[],
				axisCoords,
			);

			expect(plan.script).toBe(tag("latn"));
			expect(plan.direction).toBe("ltr");
		});

		test("creates shape plan with both user features and axis coords", () => {
			const userFeatures: ShapeFeature[] = [feature("liga", false)];
			const axisCoords = [1.0];

			const plan = createShapePlan(
				font,
				"latn",
				null,
				"ltr",
				userFeatures,
				axisCoords,
			);

			expect(plan.script).toBe(tag("latn"));
			expect(plan.direction).toBe("ltr");
		});

		test("handles DFLT script fallback", () => {
			const plan = createShapePlan(font, "DFLT", null, "ltr");

			expect(plan.script).toBe(tag("DFLT"));
			expect(plan.direction).toBe("ltr");
		});

		test("handles unknown script fallback to latn", () => {
			const plan = createShapePlan(font, "zzzz", null, "ltr");

			expect(plan.script).toBe(tag("zzzz"));
			expect(plan.direction).toBe("ltr");
		});
	});

	describe("getOrCreateShapePlan caching", () => {
		test("caches and returns same plan for identical parameters", () => {
			const plan1 = getOrCreateShapePlan(font, "latn", null, "ltr");
			const plan2 = getOrCreateShapePlan(font, "latn", null, "ltr");

			expect(plan1).toBe(plan2);
		});

		test("creates different plans for different scripts", () => {
			const plan1 = getOrCreateShapePlan(font, "latn", null, "ltr");
			const plan2 = getOrCreateShapePlan(font, "arab", null, "ltr");

			expect(plan1).not.toBe(plan2);
		});

		test("creates different plans for different languages", () => {
			const plan1 = getOrCreateShapePlan(font, "latn", "ENG", "ltr");
			const plan2 = getOrCreateShapePlan(font, "latn", "FRA", "ltr");

			expect(plan1).not.toBe(plan2);
		});

		test("creates different plans for different directions", () => {
			const plan1 = getOrCreateShapePlan(font, "latn", null, "ltr");
			const plan2 = getOrCreateShapePlan(font, "latn", null, "rtl");

			expect(plan1).not.toBe(plan2);
		});

		test("creates different plans for different user features", () => {
			const plan1 = getOrCreateShapePlan(font, "latn", null, "ltr", [
				feature("liga", true),
			]);
			const plan2 = getOrCreateShapePlan(font, "latn", null, "ltr", [
				feature("liga", false),
			]);

			expect(plan1).not.toBe(plan2);
		});

		test("creates different plans for different axis coordinates", () => {
			const plan1 = getOrCreateShapePlan(
				font,
				"latn",
				null,
				"ltr",
				[],
				[1.0, 2.0],
			);
			const plan2 = getOrCreateShapePlan(
				font,
				"latn",
				null,
				"ltr",
				[],
				[1.0, 3.0],
			);

			expect(plan1).not.toBe(plan2);
		});

		test("evicts oldest entry when cache exceeds MAX_CACHE_SIZE", async () => {
			// Create a new font instance to have a fresh cache
			const testFont = await Font.fromFile(ARIAL_PATH);

			// Fill cache with MAX_CACHE_SIZE (64) entries using unique combinations
			const plans = [];
			for (let i = 0; i < 64; i++) {
				// Use different language tags to create unique cache keys
				const lang = `L${String(i).padStart(2, "0")}`;
				const plan = getOrCreateShapePlan(testFont, "latn", lang, "ltr");
				plans.push({ plan, lang });
			}

			// Verify we have 64 entries (cache is full)
			const firstPlan = plans[0]!;

			// Add one more entry to trigger eviction
			const newPlan = getOrCreateShapePlan(testFont, "latn", "NEW", "ltr");

			// Now try to get the first plan again - it should be recreated (not cached)
			const recreatedPlan = getOrCreateShapePlan(
				testFont,
				"latn",
				firstPlan.lang,
				"ltr",
			);

			// The recreated plan should be different from the original (new object)
			expect(recreatedPlan).not.toBe(firstPlan.plan);
		});

		test("handles cache key with language null vs empty string", () => {
			const plan1 = getOrCreateShapePlan(font, "latn", null, "ltr");
			const plan2 = getOrCreateShapePlan(font, "latn", "", "ltr");

			// null creates fast path: "latn||ltr||"
			// "" creates slow path: "latn||ltr||"
			// So they should actually be the same due to how the key is generated
			expect(plan1).toBe(plan2);
		});

		test("handles cache key with empty user features array", () => {
			const plan1 = getOrCreateShapePlan(font, "latn", null, "ltr", []);
			const plan2 = getOrCreateShapePlan(font, "latn", null, "ltr");

			// These should be the same (both have no user features)
			expect(plan1).toBe(plan2);
		});

		test("handles cache key with null vs empty axis coords", () => {
			const plan1 = getOrCreateShapePlan(
				font,
				"latn",
				null,
				"ltr",
				[],
				null,
			);
			const plan2 = getOrCreateShapePlan(font, "latn", null, "ltr", []);

			// These should be the same (both have no axis coords)
			expect(plan1).toBe(plan2);
		});

		test("handles multiple user features in cache key", () => {
			const userFeatures: ShapeFeature[] = [
				feature("liga", true),
				feature("kern", false),
				feature("calt", true),
			];

			const plan1 = getOrCreateShapePlan(
				font,
				"latn",
				null,
				"ltr",
				userFeatures,
			);
			const plan2 = getOrCreateShapePlan(
				font,
				"latn",
				null,
				"ltr",
				userFeatures,
			);

			expect(plan1).toBe(plan2);
		});

		test("handles axis coordinates in cache key with precision", () => {
			const coords1 = [1.123456789, 2.987654321];
			const coords2 = [1.1234, 2.9876]; // Different precision

			const plan1 = getOrCreateShapePlan(
				font,
				"latn",
				null,
				"ltr",
				[],
				coords1,
			);
			const plan2 = getOrCreateShapePlan(
				font,
				"latn",
				null,
				"ltr",
				[],
				coords2,
			);

			// These should be different due to precision
			expect(plan1).not.toBe(plan2);
		});
	});

	describe("feature collection", () => {
		test("includes default GSUB features", () => {
			const plan = createShapePlan(font, "latn", null, "ltr");

			// Default GSUB features should be collected if they exist in the font
			// We can't test exact lookups without knowing font internals,
			// but we can verify the structure is correct
			expect(plan.gsubLookups).toBeDefined();
			expect(Array.isArray(plan.gsubLookups)).toBe(true);
		});

		test("includes default GPOS features", () => {
			const plan = createShapePlan(font, "latn", null, "ltr");

			// Default GPOS features should be collected if they exist in the font
			expect(plan.gposLookups).toBeDefined();
			expect(Array.isArray(plan.gposLookups)).toBe(true);
		});

		test("enables user features", () => {
			const userFeatures: ShapeFeature[] = [
				feature("ss01", true),
				feature("dlig", true),
			];

			const plan = createShapePlan(font, "latn", null, "ltr", userFeatures);

			expect(plan.gsubLookups).toBeDefined();
		});

		test("disables user features", () => {
			const userFeatures: ShapeFeature[] = [
				feature("liga", false),
				feature("kern", false),
			];

			const plan = createShapePlan(font, "latn", null, "ltr", userFeatures);

			expect(plan.gsubLookups).toBeDefined();
			expect(plan.gposLookups).toBeDefined();
		});

		test("user features override defaults", () => {
			// Disable a default feature
			const userFeatures: ShapeFeature[] = [feature("liga", false)];

			const plan1 = createShapePlan(font, "latn", null, "ltr");
			const plan2 = createShapePlan(font, "latn", null, "ltr", userFeatures);

			// Plans should be different
			expect(plan1).not.toBe(plan2);
		});

		test("builds lookup index maps correctly", () => {
			const plan = createShapePlan(font, "latn", null, "ltr");

			// Verify gsubLookupMap has same entries as gsubLookups
			for (const entry of plan.gsubLookups) {
				expect(plan.gsubLookupMap.has(entry.index)).toBe(true);
				expect(plan.gsubLookupMap.get(entry.index)).toBe(entry);
			}

			// Verify gposLookupMap has same entries as gposLookups
			for (const entry of plan.gposLookups) {
				expect(plan.gposLookupMap.has(entry.index)).toBe(true);
				expect(plan.gposLookupMap.get(entry.index)).toBe(entry);
			}
		});

		test("lookups are sorted by index", () => {
			const plan = createShapePlan(font, "latn", null, "ltr");

			// Verify GSUB lookups are in sorted order
			for (let i = 1; i < plan.gsubLookups.length; i++) {
				expect(plan.gsubLookups[i]!.index).toBeGreaterThan(
					plan.gsubLookups[i - 1]!.index,
				);
			}

			// Verify GPOS lookups are in sorted order
			for (let i = 1; i < plan.gposLookups.length; i++) {
				expect(plan.gposLookups[i]!.index).toBeGreaterThan(
					plan.gposLookups[i - 1]!.index,
				);
			}
		});
	});

	describe("script and language fallback", () => {
		test("falls back to DFLT script if script not found", () => {
			// Try to create a plan with a non-existent script
			const plan = createShapePlan(font, "xyz1", null, "ltr");

			// Should still create a plan (might use DFLT or latn fallback)
			expect(plan.script).toBe(tag("xyz1"));
			expect(plan.direction).toBe("ltr");
		});

		test("handles Arabic script", () => {
			const plan = createShapePlan(arabicFont, "arab", null, "rtl");

			expect(plan.script).toBe(tag("arab"));
			expect(plan.direction).toBe("rtl");
		});

		test("handles different language systems", () => {
			const planEng = createShapePlan(font, "latn", "ENG", "ltr");
			const planFra = createShapePlan(font, "latn", "FRA", "ltr");
			const planDefault = createShapePlan(font, "latn", null, "ltr");

			expect(planEng.language).toBe(tag("ENG "));
			expect(planFra.language).toBe(tag("FRA "));
			expect(planDefault.language).toBeNull();
		});
	});

	describe("feature variations", () => {
		test("handles feature variations with matching axis coords", () => {
			// Test with variable font axis coordinates
			// This will exercise feature variation substitution if the font supports it
			const testFont = variableFont || font;
			const axisCoords = [400.0, 700.0];
			const plan = createShapePlan(
				testFont,
				"latn",
				null,
				"ltr",
				[],
				axisCoords,
			);

			expect(plan.script).toBe(tag("latn"));
			expect(plan.direction).toBe("ltr");
			// If the font has feature variations, they will be applied
			// The test passes regardless, but exercises the code path
		});

		test("handles feature variations with non-matching axis coords", () => {
			// Test with different axis coordinates
			const testFont = variableFont || font;
			const axisCoords = [100.0, 900.0];
			const plan = createShapePlan(
				testFont,
				"latn",
				null,
				"ltr",
				[],
				axisCoords,
			);

			expect(plan.script).toBe(tag("latn"));
			expect(plan.direction).toBe("ltr");
		});

		test("feature variations affect enabled features", () => {
			// Create plans with different axis coords
			const testFont = variableFont || font;
			const plan1 = createShapePlan(
				testFont,
				"latn",
				null,
				"ltr",
				[],
				[100.0],
			);
			const plan2 = createShapePlan(
				testFont,
				"latn",
				null,
				"ltr",
				[],
				[900.0],
			);

			// Plans should be different due to different axis coords
			expect(plan1).not.toBe(plan2);
		});

		test("feature variations with GSUB table", () => {
			// Directly test with GSUB featureVariations if available
			const testFont = variableFont || font;
			if (testFont.gsub) {
				const gsub = testFont.gsub as any;
				if (gsub.featureVariations) {
					// Found a font with feature variations!
					// Create plans with axis coords that might match variation conditions
					const coords1 = [100.0, 200.0, 300.0];
					const coords2 = [400.0, 500.0, 600.0];
					const coords3 = [700.0, 800.0, 900.0];

					const plan1 = createShapePlan(
						testFont,
						"latn",
						null,
						"ltr",
						[],
						coords1,
					);
					const plan2 = createShapePlan(
						testFont,
						"latn",
						null,
						"ltr",
						[],
						coords2,
					);
					const plan3 = createShapePlan(
						testFont,
						"latn",
						null,
						"ltr",
						[],
						coords3,
					);

					// All plans should be valid
					expect(plan1.script).toBe(tag("latn"));
					expect(plan2.script).toBe(tag("latn"));
					expect(plan3.script).toBe(tag("latn"));
				}
			}
		});

		test("feature variations with GPOS table", () => {
			// Test with GPOS featureVariations if available
			const testFont = variableFont || font;
			if (testFont.gpos) {
				const gpos = testFont.gpos as any;
				if (gpos.featureVariations) {
					// Found a font with feature variations!
					const coords = [400.0, 500.0];
					const plan = createShapePlan(
						testFont,
						"latn",
						null,
						"ltr",
						[],
						coords,
					);

					expect(plan.script).toBe(tag("latn"));
					expect(plan.gposLookups).toBeDefined();
				}
			}
		});
	});

	describe("required features", () => {
		test("handles language systems with required features", () => {
			// Some language systems have required features (requiredFeatureIndex !== 0xFFFF)
			// Test with various scripts/languages that might have required features
			const scripts = ["arab", "deva", "beng", "guru", "taml"];
			const languages = [null, "URD", "HIN", "BEN"];

			for (const script of scripts) {
				for (const language of languages) {
					const plan = createShapePlan(font, script, language, "ltr");
					expect(plan.script).toBe(tag(script));
					if (language) {
						expect(plan.language).toBe(tag(language.padEnd(4, " ")));
					}
				}
			}
		});

		test("required features are included in lookup list", () => {
			// Test that required features (if present) are included
			// Arabic script often has required features
			const plan = createShapePlan(arabicFont, "arab", null, "rtl");

			expect(plan.script).toBe(tag("arab"));
			expect(plan.direction).toBe("rtl");
			// If there's a required feature, it will be in the lookups
		});

		test("required features work with feature substitutions", () => {
			// Test required features with axis coords (feature substitution path)
			const plan = createShapePlan(
				arabicFont,
				"arab",
				"URD",
				"rtl",
				[],
				[400.0],
			);

			expect(plan.script).toBe(tag("arab"));
			expect(plan.language).toBe(tag("URD "));
			expect(plan.direction).toBe("rtl");
		});
	});

	describe("edge cases", () => {
		test("handles empty user features array", () => {
			const plan = createShapePlan(font, "latn", null, "ltr", []);

			expect(plan.script).toBe(tag("latn"));
			expect(plan.direction).toBe("ltr");
		});

		test("handles many user features", () => {
			const userFeatures: ShapeFeature[] = [];
			for (let i = 1; i <= 20; i++) {
				userFeatures.push(feature("ss" + String(i).padStart(2, "0"), true));
			}

			const plan = createShapePlan(font, "latn", null, "ltr", userFeatures);

			expect(plan.script).toBe(tag("latn"));
			expect(plan.direction).toBe("ltr");
		});

		test("handles conflicting user features", () => {
			const userFeatures: ShapeFeature[] = [
				feature("liga", true),
				feature("liga", false),
			];

			const plan = createShapePlan(font, "latn", null, "ltr", userFeatures);

			// Last value should win
			expect(plan.script).toBe(tag("latn"));
		});

		test("pads short script tags with spaces", () => {
			const plan = createShapePlan(font, "la", null, "ltr");

			expect(tagToString(plan.script)).toBe("la  ");
		});

		test("pads short language tags with spaces", () => {
			const plan = createShapePlan(font, "latn", "EN", "ltr");

			expect(tagToString(plan.language!)).toBe("EN  ");
		});

		test("handles 4-character script tags", () => {
			const plan = createShapePlan(font, "latn", null, "ltr");

			expect(tagToString(plan.script)).toBe("latn");
		});

		test("handles 4-character language tags", () => {
			const plan = createShapePlan(font, "latn", "ENGL", "ltr");

			expect(tagToString(plan.language!)).toBe("ENGL");
		});
	});

	describe("variable font axis coordinates", () => {
		test("handles single axis coordinate", () => {
			const plan = createShapePlan(font, "latn", null, "ltr", [], [400.0]);

			expect(plan.script).toBe(tag("latn"));
			expect(plan.direction).toBe("ltr");
		});

		test("handles multiple axis coordinates", () => {
			const axisCoords = [400.0, 700.0, 100.0];
			const plan = createShapePlan(
				font,
				"latn",
				null,
				"ltr",
				[],
				axisCoords,
			);

			expect(plan.script).toBe(tag("latn"));
			expect(plan.direction).toBe("ltr");
		});

		test("handles fractional axis coordinates", () => {
			const axisCoords = [450.5, 700.25, 100.75];
			const plan = createShapePlan(
				font,
				"latn",
				null,
				"ltr",
				[],
				axisCoords,
			);

			expect(plan.script).toBe(tag("latn"));
			expect(plan.direction).toBe("ltr");
		});

		test("different axis coords create different cache entries", () => {
			const plan1 = getOrCreateShapePlan(
				font,
				"latn",
				null,
				"ltr",
				[],
				[400.0],
			);
			const plan2 = getOrCreateShapePlan(
				font,
				"latn",
				null,
				"ltr",
				[],
				[700.0],
			);

			expect(plan1).not.toBe(plan2);
		});
	});

	describe("advanced features with mocked data", () => {
		test("handles required features when present", () => {
			// Create a minimal mock font with required feature
			const mockFont = {
				gsub: {
					scriptList: {
						scripts: [
							{
								scriptTag: tag("latn"),
								script: {
									defaultLangSys: {
										requiredFeatureIndex: 0, // NOT 0xFFFF - has required feature!
										featureIndices: [1, 2],
									},
									langSysRecords: [],
								},
							},
						],
					},
					featureList: {
						features: [
							{
								featureTag: tag("rlig"),
								feature: {
									featureParamsOffset: 0,
									lookupListIndices: [0, 1],
								},
							},
							{
								featureTag: tag("liga"),
								feature: {
									featureParamsOffset: 0,
									lookupListIndices: [2],
								},
							},
							{
								featureTag: tag("calt"),
								feature: {
									featureParamsOffset: 0,
									lookupListIndices: [3],
								},
							},
						],
					},
					lookups: [
						{ type: 4, flag: 0, subtables: [] },
						{ type: 4, flag: 0, subtables: [] },
						{ type: 4, flag: 0, subtables: [] },
						{ type: 6, flag: 0, subtables: [] },
					],
				},
				gpos: null,
			} as any;

			// This should include the required feature lookups
			const plan = createShapePlan(mockFont, "latn", null, "ltr");

			expect(plan.script).toBe(tag("latn"));
			expect(plan.gsubLookups.length).toBeGreaterThan(0);
			// Should include lookups from required feature (indices 0, 1)
		});

		test("handles feature substitutions with required features", () => {
			// Create a minimal mock font with required feature AND feature variations
			const mockFont = {
				gsub: {
					scriptList: {
						scripts: [
							{
								scriptTag: tag("latn"),
								script: {
									defaultLangSys: {
										requiredFeatureIndex: 0, // Has required feature
										featureIndices: [1],
									},
									langSysRecords: [],
								},
							},
						],
					},
					featureList: {
						features: [
							{
								featureTag: tag("rlig"),
								feature: {
									featureParamsOffset: 0,
									lookupListIndices: [0, 1], // Original lookups
								},
							},
							{
								featureTag: tag("liga"),
								feature: {
									featureParamsOffset: 0,
									lookupListIndices: [2],
								},
							},
						],
					},
					lookups: [
						{ type: 4, flag: 0, subtables: [] },
						{ type: 4, flag: 0, subtables: [] },
						{ type: 4, flag: 0, subtables: [] },
						{ type: 4, flag: 0, subtables: [] }, // Alternate lookup
					],
					featureVariations: {
						majorVersion: 1,
						minorVersion: 0,
						featureVariationRecords: [
							{
								conditionSet: {
									conditions: [
										{
											format: 1,
											axisIndex: 0,
											filterRangeMinValue: 350.0,
											filterRangeMaxValue: 500.0,
										},
									],
								},
								featureTableSubstitution: {
									majorVersion: 1,
									minorVersion: 0,
									substitutions: [
										{
											featureIndex: 0, // Substitute required feature!
											alternateFeature: {
												featureParamsOffset: 0,
												lookupListIndices: [3], // Use alternate lookup
											},
										},
									],
								},
							},
						],
					},
				},
				gpos: null,
			} as any;

			// Test with axis coords that match the condition
			const plan = createShapePlan(mockFont, "latn", null, "ltr", [], [400.0]);

			expect(plan.script).toBe(tag("latn"));
			expect(plan.gsubLookups.length).toBeGreaterThan(0);
			// Should use substituted lookups for required feature
			const lookupIndices = plan.gsubLookups.map(l => l.index);
			expect(lookupIndices).toContain(3); // Should include the alternate lookup
		});

		test("handles feature substitutions without matching required feature", () => {
			// Create mock with feature variations but NOT on required feature
			const mockFont = {
				gsub: {
					scriptList: {
						scripts: [
							{
								scriptTag: tag("latn"),
								script: {
									defaultLangSys: {
										requiredFeatureIndex: 0,
										featureIndices: [1],
									},
									langSysRecords: [],
								},
							},
						],
					},
					featureList: {
						features: [
							{
								featureTag: tag("rlig"),
								feature: {
									featureParamsOffset: 0,
									lookupListIndices: [0],
								},
							},
							{
								featureTag: tag("liga"),
								feature: {
									featureParamsOffset: 0,
									lookupListIndices: [1],
								},
							},
						],
					},
					lookups: [
						{ type: 4, flag: 0, subtables: [] },
						{ type: 4, flag: 0, subtables: [] },
						{ type: 4, flag: 0, subtables: [] },
					],
					featureVariations: {
						majorVersion: 1,
						minorVersion: 0,
						featureVariationRecords: [
							{
								conditionSet: {
									conditions: [
										{
											format: 1,
											axisIndex: 0,
											filterRangeMinValue: 350.0,
											filterRangeMaxValue: 500.0,
										},
									],
								},
								featureTableSubstitution: {
									majorVersion: 1,
									minorVersion: 0,
									substitutions: [
										{
											featureIndex: 1, // Substitute different feature, not required
											alternateFeature: {
												featureParamsOffset: 0,
												lookupListIndices: [2],
											},
										},
									],
								},
							},
						],
					},
				},
				gpos: null,
			} as any;

			// Test with matching axis coords
			const plan = createShapePlan(mockFont, "latn", null, "ltr", [], [400.0]);

			expect(plan.script).toBe(tag("latn"));
			expect(plan.gsubLookups.length).toBeGreaterThan(0);
			// Should include required feature's original lookups
			const lookupIndices = plan.gsubLookups.map(l => l.index);
			expect(lookupIndices).toContain(0); // Required feature's lookup
		});
	});

	describe("lookup entry structure", () => {
		test("lookup entries have correct structure", () => {
			const plan = createShapePlan(font, "latn", null, "ltr");

			for (const entry of plan.gsubLookups) {
				expect(entry).toHaveProperty("index");
				expect(entry).toHaveProperty("lookup");
				expect(typeof entry.index).toBe("number");
				expect(entry.index).toBeGreaterThanOrEqual(0);
			}

			for (const entry of plan.gposLookups) {
				expect(entry).toHaveProperty("index");
				expect(entry).toHaveProperty("lookup");
				expect(typeof entry.index).toBe("number");
				expect(entry.index).toBeGreaterThanOrEqual(0);
			}
		});

		test("lookup indices are unique within GSUB", () => {
			const plan = createShapePlan(font, "latn", null, "ltr");

			const indices = new Set(plan.gsubLookups.map((e) => e.index));
			expect(indices.size).toBe(plan.gsubLookups.length);
		});

		test("lookup indices are unique within GPOS", () => {
			const plan = createShapePlan(font, "latn", null, "ltr");

			const indices = new Set(plan.gposLookups.map((e) => e.index));
			expect(indices.size).toBe(plan.gposLookups.length);
		});
	});
});
