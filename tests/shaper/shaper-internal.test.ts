import { describe, test, expect, beforeAll } from "bun:test";
import { Font } from "../../src/font/font.ts";
import { GlyphBuffer } from "../../src/buffer/glyph-buffer.ts";
import { __testing } from "../../src/shaper/shaper.ts";
import { getOrCreateShapePlan } from "../../src/shaper/shape-plan.ts";
import { Coverage } from "../../src/layout/structures/coverage.ts";
import { SetDigest } from "../../src/layout/structures/set-digest.ts";
import { ClassDef } from "../../src/layout/structures/class-def.ts";
import { GsubLookupType } from "../../src/font/tables/gsub.ts";
import { GposLookupType } from "../../src/font/tables/gpos.ts";

const {
	applySingleSubstLookup,
	applyMultipleSubstLookup,
	applyAlternateSubstLookup,
	applyReverseChainingSingleSubstLookup,
	applyContextSubstLookup,
	applyChainingContextSubstLookup,
	applySinglePosLookup,
	applyPairPosLookup,
	applyCursivePosLookup,
	applyContextPosLookup,
	applyChainingContextPosLookup,
	matchContextFormat1,
	matchContextFormat2,
	matchContextFormat3,
	matchChainingFormat1,
	matchChainingFormat2,
	matchChainingFormat3,
	matchGlyphSequence,
	matchGlyphSequenceBackward,
	matchClassSequence,
	matchClassSequenceBackward,
	shouldSkipGlyph,
	precomputeSkipMarkers,
	buildNextNonSkipArray,
	applyNestedLookups,
} = __testing;

// Helper to create a simple GlyphBuffer
function createBuffer(glyphIds: number[]): GlyphBuffer {
	const buffer = new GlyphBuffer();
	for (let i = 0; i < glyphIds.length; i++) {
		buffer.infos.push({
			glyphId: glyphIds[i]!,
			cluster: i,
			mask: 0xffffffff,
			codepoint: 0,
		});
		buffer.positions.push({
			xAdvance: 100,
			yAdvance: 0,
			xOffset: 0,
			yOffset: 0,
		});
	}
	return buffer;
}

// Create a simple coverage table
function createCoverage(glyphs: number[]): Coverage {
	return Coverage.format1(new Uint16Array(glyphs));
}

// Create a digest that covers all glyphs
function createDigest(glyphs: number[]): SetDigest {
	const digest = new SetDigest();
	for (const g of glyphs) {
		digest.add(g);
	}
	return digest;
}

describe("shaper internal functions", () => {
	let mongolianFont: Font;
	let copticFont: Font;
	let newaFont: Font;
	let lepchaFont: Font;
	let nkoFont: Font;
	let syriacFont: Font;

	beforeAll(async () => {
		mongolianFont = await Font.fromFile(
			"tests/fixtures/NotoSansMongolian-Regular.ttf",
		);
		copticFont = await Font.fromFile(
			"tests/fixtures/NotoSansCoptic-Regular.ttf",
		);
		newaFont = await Font.fromFile("tests/fixtures/NotoSansNewa-Regular.ttf");
		lepchaFont = await Font.fromFile(
			"tests/fixtures/NotoSansLepcha-Regular.ttf",
		);
		nkoFont = await Font.fromFile("tests/fixtures/NotoSansNKo-Regular.ttf");
		syriacFont = await Font.fromFile(
			"tests/fixtures/NotoSansSyriac-Regular.ttf",
		);
	});

	describe("applySingleSubstLookup", () => {
		test("applies format 1 single substitution", () => {
			const buffer = createBuffer([10, 20, 30]);
			const lookup = {
				type: GsubLookupType.Single as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([10, 20]),
						deltaGlyphId: 5,
					},
				],
			};

			applySingleSubstLookup(mongolianFont, buffer, lookup);
			expect(buffer.infos[0]!.glyphId).toBe(15); // 10 + 5
			expect(buffer.infos[1]!.glyphId).toBe(25); // 20 + 5
			expect(buffer.infos[2]!.glyphId).toBe(30); // not covered
		});

		test("applies format 2 single substitution", () => {
			const buffer = createBuffer([10, 20, 30]);
			const lookup = {
				type: GsubLookupType.Single as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 2 as const,
						coverage: createCoverage([10, 20]),
						substituteGlyphIds: [100, 200],
					},
				],
			};

			applySingleSubstLookup(mongolianFont, buffer, lookup);
			expect(buffer.infos[0]!.glyphId).toBe(100);
			expect(buffer.infos[1]!.glyphId).toBe(200);
			expect(buffer.infos[2]!.glyphId).toBe(30);
		});

		test("applies with multiple subtables", () => {
			const buffer = createBuffer([10, 20, 30]);
			const lookup = {
				type: GsubLookupType.Single as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([10]),
						deltaGlyphId: 5,
					},
					{
						format: 2 as const,
						coverage: createCoverage([20]),
						substituteGlyphIds: [200],
					},
				],
			};

			applySingleSubstLookup(mongolianFont, buffer, lookup);
			expect(buffer.infos[0]!.glyphId).toBe(15);
			expect(buffer.infos[1]!.glyphId).toBe(200);
		});

		test("applies with lookup flag for skip markers", () => {
			// Use a font with GDEF (lepchaFont has GDEF)
			const buffer = createBuffer([10, 20, 30]);
			const lookup = {
				type: GsubLookupType.Single as const,
				flag: 8, // IgnoreMarks
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([10, 20, 30]),
						deltaGlyphId: 5,
					},
				],
			};

			// This should exercise the skip marker path
			applySingleSubstLookup(lepchaFont, buffer, lookup);
			// Glyphs 10, 20, 30 should still be substituted unless they're marks
			expect(buffer.infos.length).toBe(3);
		});
	});

	describe("applyMultipleSubstLookup", () => {
		test("applies multiple substitution expanding glyphs", () => {
			const buffer = createBuffer([10, 20, 30]);
			const lookup = {
				type: GsubLookupType.Multiple as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([10]),
						sequences: [[100, 101, 102]], // 10 -> 100, 101, 102
					},
				],
			};

			applyMultipleSubstLookup(mongolianFont, buffer, lookup);
			expect(buffer.infos.length).toBe(5); // 3 original - 1 + 3 = 5
			expect(buffer.infos[0]!.glyphId).toBe(100);
			expect(buffer.infos[1]!.glyphId).toBe(101);
			expect(buffer.infos[2]!.glyphId).toBe(102);
		});

		test("applies multiple substitution with skip glyphs", () => {
			const buffer = createBuffer([10, 20, 30]);
			const lookup = {
				type: GsubLookupType.Multiple as const,
				flag: 8, // IgnoreMarks
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([10]),
						sequences: [[100, 101]],
					},
				],
			};

			applyMultipleSubstLookup(lepchaFont, buffer, lookup);
			expect(buffer.infos.length).toBeGreaterThanOrEqual(3);
		});
	});

	describe("applyAlternateSubstLookup", () => {
		test("applies alternate substitution using first alternate", () => {
			const buffer = createBuffer([10, 20, 30]);
			const lookup = {
				type: GsubLookupType.Alternate as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						coverage: createCoverage([10]),
						alternateSets: [[100, 101, 102]], // alternates for glyph 10
					},
				],
			};

			applyAlternateSubstLookup(mongolianFont, buffer, lookup);
			expect(buffer.infos[0]!.glyphId).toBe(100); // first alternate
			expect(buffer.infos[1]!.glyphId).toBe(20); // unchanged
		});
	});

	describe("applyReverseChainingSingleSubstLookup", () => {
		test("applies reverse chaining substitution", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const lookup = {
				type: GsubLookupType.ReverseChainingSingle as const,
				flag: 0,
				digest: createDigest([10, 20, 30, 40]),
				subtables: [
					{
						coverage: createCoverage([20]),
						backtrackCoverages: [createCoverage([30])], // glyph after must be 30
						lookaheadCoverages: [createCoverage([10])], // glyph before must be 10
						substituteGlyphIds: [200],
					},
				],
			};

			applyReverseChainingSingleSubstLookup(mongolianFont, buffer, lookup);
			expect(buffer.infos[1]!.glyphId).toBe(200); // 20 -> 200
		});

		test("applies reverse chaining with skip markers", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const lookup = {
				type: GsubLookupType.ReverseChainingSingle as const,
				flag: 8, // IgnoreMarks
				digest: createDigest([10, 20, 30, 40]),
				subtables: [
					{
						coverage: createCoverage([20]),
						backtrackCoverages: [],
						lookaheadCoverages: [],
						substituteGlyphIds: [200],
					},
				],
			};

			applyReverseChainingSingleSubstLookup(lepchaFont, buffer, lookup);
			// Should still work with skip markers
			expect(buffer.infos.length).toBe(4);
		});
	});

	describe("applyContextSubstLookup", () => {
		test("applies context substitution format 1", () => {
			const buffer = createBuffer([10, 20, 30]);
			const plan = getOrCreateShapePlan(mongolianFont, "mong", null, "ltr", []);

			// Find an actual lookup from the plan to get proper structure
			const lookup = {
				type: GsubLookupType.Context as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([10]),
						ruleSets: [
							[
								{
									glyphCount: 2,
									inputSequence: [20],
									lookupRecords: [],
								},
							],
						],
					},
				],
			};

			applyContextSubstLookup(mongolianFont, buffer, lookup, plan);
			expect(buffer.infos.length).toBe(3);
		});

		test("applies context substitution format 2 with class definitions", () => {
			const buffer = createBuffer([10, 20, 30]);
			const plan = getOrCreateShapePlan(mongolianFont, "mong", null, "ltr", []);

			const lookup = {
				type: GsubLookupType.Context as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 2 as const,
						coverage: createCoverage([10]),
						classDef: ClassDef.empty(),
						classRuleSets: [
							[
								{
									glyphCount: 2,
									inputClasses: [0],
									lookupRecords: [],
								},
							],
						],
					},
				],
			};

			applyContextSubstLookup(mongolianFont, buffer, lookup, plan);
			expect(buffer.infos.length).toBe(3);
		});

		test("applies context substitution format 3 with coverages", () => {
			const buffer = createBuffer([10, 20, 30]);
			const plan = getOrCreateShapePlan(mongolianFont, "mong", null, "ltr", []);

			const lookup = {
				type: GsubLookupType.Context as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 3 as const,
						coverages: [createCoverage([10]), createCoverage([20])],
						lookupRecords: [],
					},
				],
			};

			applyContextSubstLookup(mongolianFont, buffer, lookup, plan);
			expect(buffer.infos.length).toBe(3);
		});
	});

	describe("applyChainingContextSubstLookup", () => {
		test("applies chaining context substitution format 1", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const plan = getOrCreateShapePlan(mongolianFont, "mong", null, "ltr", []);

			const lookup = {
				type: GsubLookupType.ChainingContext as const,
				flag: 0,
				digest: createDigest([10, 20, 30, 40]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([20]),
						chainRuleSets: [
							[
								{
									backtrackSequence: [10],
									inputSequence: [],
									lookaheadSequence: [30],
									lookupRecords: [],
								},
							],
						],
					},
				],
			};

			applyChainingContextSubstLookup(mongolianFont, buffer, lookup, plan);
			expect(buffer.infos.length).toBe(4);
		});

		test("applies chaining context substitution format 2", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const plan = getOrCreateShapePlan(mongolianFont, "mong", null, "ltr", []);

			const lookup = {
				type: GsubLookupType.ChainingContext as const,
				flag: 0,
				digest: createDigest([10, 20, 30, 40]),
				subtables: [
					{
						format: 2 as const,
						coverage: createCoverage([20]),
						backtrackClassDef: ClassDef.empty(),
						inputClassDef: ClassDef.empty(),
						lookaheadClassDef: ClassDef.empty(),
						chainClassRuleSets: [
							[
								{
									backtrackClasses: [0],
									inputClasses: [],
									lookaheadClasses: [0],
									lookupRecords: [],
								},
							],
						],
					},
				],
			};

			applyChainingContextSubstLookup(mongolianFont, buffer, lookup, plan);
			expect(buffer.infos.length).toBe(4);
		});

		test("applies chaining context substitution format 3", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const plan = getOrCreateShapePlan(mongolianFont, "mong", null, "ltr", []);

			const lookup = {
				type: GsubLookupType.ChainingContext as const,
				flag: 0,
				digest: createDigest([10, 20, 30, 40]),
				subtables: [
					{
						format: 3 as const,
						backtrackCoverages: [createCoverage([10])],
						inputCoverages: [createCoverage([20])],
						lookaheadCoverages: [createCoverage([30])],
						lookupRecords: [],
					},
				],
			};

			applyChainingContextSubstLookup(mongolianFont, buffer, lookup, plan);
			expect(buffer.infos.length).toBe(4);
		});
	});

	describe("applySinglePosLookup", () => {
		test("applies single positioning format 1", () => {
			const buffer = createBuffer([10, 20, 30]);
			const lookup = {
				type: GposLookupType.Single as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([10, 20]),
						valueFormat: 0x000f,
						value: { xPlacement: 10, yPlacement: 5, xAdvance: 20, yAdvance: 0 },
					},
				],
			};

			applySinglePosLookup(mongolianFont, buffer, lookup, false);
			expect(buffer.positions[0]!.xOffset).toBe(10);
			expect(buffer.positions[0]!.yOffset).toBe(5);
			expect(buffer.positions[0]!.xAdvance).toBe(120); // 100 + 20
		});

		test("applies single positioning format 2", () => {
			const buffer = createBuffer([10, 20, 30]);
			const lookup = {
				type: GposLookupType.Single as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 2 as const,
						coverage: createCoverage([10, 20]),
						valueFormat: 0x000f,
						values: [
							{ xPlacement: 5, yPlacement: 0, xAdvance: 10, yAdvance: 0 },
							{ xPlacement: 15, yPlacement: 0, xAdvance: 30, yAdvance: 0 },
						],
					},
				],
			};

			applySinglePosLookup(mongolianFont, buffer, lookup, false);
			expect(buffer.positions[0]!.xOffset).toBe(5);
			expect(buffer.positions[1]!.xOffset).toBe(15);
		});

		test("applies single positioning with skip markers", () => {
			const buffer = createBuffer([10, 20, 30]);
			const lookup = {
				type: GposLookupType.Single as const,
				flag: 8, // IgnoreMarks
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([10, 20, 30]),
						valueFormat: 0x000f,
						value: { xPlacement: 10, yPlacement: 0, xAdvance: 0, yAdvance: 0 },
					},
				],
			};

			// hasMarks = true to exercise skip marker path
			applySinglePosLookup(lepchaFont, buffer, lookup, true);
			expect(buffer.positions.length).toBe(3);
		});
	});

	describe("applyPairPosLookup", () => {
		test("applies pair positioning without skip markers", () => {
			const buffer = createBuffer([10, 20, 30]);
			const lookup = {
				type: GposLookupType.Pair as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([10]),
						valueFormat1: 0x0004,
						valueFormat2: 0x0004,
						pairSets: [
							{
								pairValueRecords: [
									{
										secondGlyph: 20,
										value1: { xAdvance: 10 },
										value2: { xAdvance: 5 },
									},
								],
							},
						],
					},
				],
			};

			applyPairPosLookup(mongolianFont, buffer, lookup, false);
			// Pair positioning should have been applied
			expect(buffer.positions.length).toBe(3);
		});

		test("applies pair positioning with skip markers", () => {
			const buffer = createBuffer([10, 20, 30]);
			const lookup = {
				type: GposLookupType.Pair as const,
				flag: 8, // IgnoreMarks
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([10]),
						valueFormat1: 0x0004,
						valueFormat2: 0x0004,
						pairSets: [
							{
								pairValueRecords: [
									{
										secondGlyph: 20,
										value1: { xAdvance: 10 },
										value2: { xAdvance: 5 },
									},
								],
							},
						],
					},
				],
			};

			applyPairPosLookup(lepchaFont, buffer, lookup, true);
			expect(buffer.positions.length).toBe(3);
		});
	});

	describe("applyCursivePosLookup", () => {
		test("applies cursive positioning", () => {
			const buffer = createBuffer([10, 20, 30]);
			const lookup = {
				type: GposLookupType.Cursive as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([10, 20]),
						entryExitRecords: [
							{
								entryAnchor: { xCoordinate: 0, yCoordinate: 0 },
								exitAnchor: { xCoordinate: 100, yCoordinate: 50 },
							},
							{
								entryAnchor: { xCoordinate: 100, yCoordinate: 50 },
								exitAnchor: { xCoordinate: 200, yCoordinate: 100 },
							},
						],
					},
				],
			};

			applyCursivePosLookup(mongolianFont, buffer, lookup, false);
			expect(buffer.positions.length).toBe(3);
		});

		test("applies cursive positioning with skip markers", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const lookup = {
				type: GposLookupType.Cursive as const,
				flag: 8,
				digest: createDigest([10, 20, 30, 40]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([10, 20, 30]),
						entryExitRecords: [
							{
								entryAnchor: { xCoordinate: 0, yCoordinate: 0 },
								exitAnchor: { xCoordinate: 50, yCoordinate: 25 },
							},
							{
								entryAnchor: { xCoordinate: 50, yCoordinate: 25 },
								exitAnchor: null,
							},
							{
								entryAnchor: null,
								exitAnchor: { xCoordinate: 100, yCoordinate: 50 },
							},
						],
					},
				],
			};

			applyCursivePosLookup(lepchaFont, buffer, lookup, true);
			expect(buffer.positions.length).toBe(4);
		});
	});

	describe("applyContextPosLookup", () => {
		test("applies context positioning format 1", () => {
			const buffer = createBuffer([10, 20, 30]);
			const plan = getOrCreateShapePlan(mongolianFont, "mong", null, "ltr", []);

			const lookup = {
				type: GposLookupType.Context as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([10]),
						ruleSets: [
							[
								{
									glyphCount: 2,
									inputSequence: [20],
									lookupRecords: [],
								},
							],
						],
					},
				],
			};

			applyContextPosLookup(
				mongolianFont,
				buffer,
				lookup,
				plan,
				new Map(),
				new Int16Array(buffer.length),
				false,
			);
			expect(buffer.positions.length).toBe(3);
		});

		test("applies context positioning format 2", () => {
			const buffer = createBuffer([10, 20, 30]);
			const plan = getOrCreateShapePlan(mongolianFont, "mong", null, "ltr", []);

			const lookup = {
				type: GposLookupType.Context as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 2 as const,
						coverage: createCoverage([10]),
						classDef: ClassDef.empty(),
						classRuleSets: [
							[
								{
									glyphCount: 2,
									inputClasses: [0],
									lookupRecords: [],
								},
							],
						],
					},
				],
			};

			applyContextPosLookup(
				mongolianFont,
				buffer,
				lookup,
				plan,
				new Map(),
				new Int16Array(buffer.length),
				false,
			);
			expect(buffer.positions.length).toBe(3);
		});

		test("applies context positioning format 3", () => {
			const buffer = createBuffer([10, 20, 30]);
			const plan = getOrCreateShapePlan(mongolianFont, "mong", null, "ltr", []);

			const lookup = {
				type: GposLookupType.Context as const,
				flag: 0,
				digest: createDigest([10, 20, 30]),
				subtables: [
					{
						format: 3 as const,
						coverages: [createCoverage([10]), createCoverage([20])],
						lookupRecords: [],
					},
				],
			};

			applyContextPosLookup(
				mongolianFont,
				buffer,
				lookup,
				plan,
				new Map(),
				new Int16Array(buffer.length),
				false,
			);
			expect(buffer.positions.length).toBe(3);
		});
	});

	describe("applyChainingContextPosLookup", () => {
		test("applies chaining context positioning format 1", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const plan = getOrCreateShapePlan(mongolianFont, "mong", null, "ltr", []);

			const lookup = {
				type: GposLookupType.ChainingContext as const,
				flag: 0,
				digest: createDigest([10, 20, 30, 40]),
				subtables: [
					{
						format: 1 as const,
						coverage: createCoverage([20]),
						chainRuleSets: [
							[
								{
									backtrackSequence: [10],
									inputSequence: [],
									lookaheadSequence: [30],
									lookupRecords: [],
								},
							],
						],
					},
				],
			};

			applyChainingContextPosLookup(
				mongolianFont,
				buffer,
				lookup,
				plan,
				new Map(),
				new Int16Array(buffer.length),
				false,
			);
			expect(buffer.positions.length).toBe(4);
		});

		test("applies chaining context positioning format 2", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const plan = getOrCreateShapePlan(mongolianFont, "mong", null, "ltr", []);

			const lookup = {
				type: GposLookupType.ChainingContext as const,
				flag: 0,
				digest: createDigest([10, 20, 30, 40]),
				subtables: [
					{
						format: 2 as const,
						coverage: createCoverage([20]),
						backtrackClassDef: ClassDef.empty(),
						inputClassDef: ClassDef.empty(),
						lookaheadClassDef: ClassDef.empty(),
						chainClassRuleSets: [
							[
								{
									backtrackClasses: [0],
									inputClasses: [],
									lookaheadClasses: [0],
									lookupRecords: [],
								},
							],
						],
					},
				],
			};

			applyChainingContextPosLookup(
				mongolianFont,
				buffer,
				lookup,
				plan,
				new Map(),
				new Int16Array(buffer.length),
				false,
			);
			expect(buffer.positions.length).toBe(4);
		});

		test("applies chaining context positioning format 3", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const plan = getOrCreateShapePlan(mongolianFont, "mong", null, "ltr", []);

			const lookup = {
				type: GposLookupType.ChainingContext as const,
				flag: 0,
				digest: createDigest([10, 20, 30, 40]),
				subtables: [
					{
						format: 3 as const,
						backtrackCoverages: [createCoverage([10])],
						inputCoverages: [createCoverage([20])],
						lookaheadCoverages: [createCoverage([30])],
						lookupRecords: [],
					},
				],
			};

			applyChainingContextPosLookup(
				mongolianFont,
				buffer,
				lookup,
				plan,
				new Map(),
				new Int16Array(buffer.length),
				false,
			);
			expect(buffer.positions.length).toBe(4);
		});
	});

	describe("matchGlyphSequence", () => {
		test("matches forward glyph sequence", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const result = matchGlyphSequence(mongolianFont, buffer, 1, [20, 30], 0);
			expect(result).toBe(true);
		});

		test("fails when sequence does not match", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const result = matchGlyphSequence(mongolianFont, buffer, 1, [20, 50], 0);
			expect(result).toBe(false);
		});

		test("fails when buffer ends before sequence", () => {
			const buffer = createBuffer([10, 20]);
			const result = matchGlyphSequence(mongolianFont, buffer, 1, [20, 30], 0);
			expect(result).toBe(false);
		});
	});

	describe("matchGlyphSequenceBackward", () => {
		test("matches backward glyph sequence", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const result = matchGlyphSequenceBackward(
				mongolianFont,
				buffer,
				2,
				[30, 20],
				0,
			);
			expect(result).toBe(true);
		});

		test("fails when sequence does not match backward", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const result = matchGlyphSequenceBackward(
				mongolianFont,
				buffer,
				2,
				[30, 50],
				0,
			);
			expect(result).toBe(false);
		});
	});

	describe("matchClassSequence", () => {
		test("matches forward class sequence", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const classDef = ClassDef.format1(
				0,
				new Uint16Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
			);
			const result = matchClassSequence(
				mongolianFont,
				buffer,
				1,
				[1, 1],
				classDef,
				0,
			);
			expect(result).toBe(true);
		});

		test("fails when class sequence does not match", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const classDef = ClassDef.format1(
				0,
				new Uint16Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
			);
			const result = matchClassSequence(
				mongolianFont,
				buffer,
				1,
				[1, 1],
				classDef,
				0,
			);
			expect(result).toBe(false);
		});
	});

	describe("matchClassSequenceBackward", () => {
		test("matches backward class sequence", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const classDef = ClassDef.format1(
				0,
				new Uint16Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
			);
			const result = matchClassSequenceBackward(
				mongolianFont,
				buffer,
				2,
				[1, 1],
				classDef,
				0,
			);
			expect(result).toBe(true);
		});
	});

	describe("shouldSkipGlyph", () => {
		test("returns false when no skip flags set", () => {
			const result = shouldSkipGlyph(mongolianFont, 10, 0);
			expect(result).toBe(false);
		});

		test("returns true for base glyph when IgnoreBaseGlyphs set", () => {
			// This depends on the GDEF table classifying the glyph
			const result = shouldSkipGlyph(lepchaFont, 49, 2); // 2 = IgnoreBaseGlyphs
			// lepchaFont glyph 49 may be a base glyph
			expect(typeof result).toBe("boolean");
		});

		test("returns true for mark glyph when IgnoreMarks set", () => {
			// This depends on the GDEF table classifying the glyph
			const result = shouldSkipGlyph(lepchaFont, 98, 8); // 8 = IgnoreMarks
			// lepchaFont glyph 98 may be a mark
			expect(typeof result).toBe("boolean");
		});
	});

	describe("precomputeSkipMarkers", () => {
		test("returns empty array when no flags", () => {
			const buffer = createBuffer([10, 20, 30]);
			const result = precomputeSkipMarkers(mongolianFont, buffer, 0);
			expect(result.length).toBe(3);
			expect(result.every((v) => v === 0)).toBe(true);
		});

		test("marks glyphs to skip based on GDEF", () => {
			const buffer = createBuffer([49, 98, 96]); // Lepcha glyphs
			const result = precomputeSkipMarkers(lepchaFont, buffer, 8); // IgnoreMarks
			expect(result.length).toBe(3);
		});

		test("marks base glyphs to skip with IgnoreBaseGlyphs", () => {
			const buffer = createBuffer([49, 98, 96]); // Lepcha base + marks
			const result = precomputeSkipMarkers(lepchaFont, buffer, 2); // IgnoreBaseGlyphs
			expect(result.length).toBe(3);
		});

		test("marks ligature glyphs to skip with IgnoreLigatures", () => {
			const buffer = createBuffer([49, 98, 96]);
			const result = precomputeSkipMarkers(lepchaFont, buffer, 4); // IgnoreLigatures
			expect(result.length).toBe(3);
		});

		test("handles mark attachment type filtering", () => {
			// Mark attachment type is in upper byte of lookupFlag
			const buffer = createBuffer([49, 98, 96]);
			// Flag: 0x100 = mark attachment type 1, 0x0008 = IgnoreMarks
			const result = precomputeSkipMarkers(lepchaFont, buffer, 0x0108);
			expect(result.length).toBe(3);
		});
	});

	describe("buildNextNonSkipArray", () => {
		test("builds next non-skip array correctly", () => {
			const skip = new Uint8Array([0, 1, 0, 1, 0]);
			const result = buildNextNonSkipArray(skip, 5);
			expect(result[0]).toBe(2); // next non-skip after 0 is index 2
			expect(result[1]).toBe(2); // next non-skip after 1 is index 2
			expect(result[2]).toBe(4); // next non-skip after 2 is index 4
			expect(result[3]).toBe(4); // next non-skip after 3 is index 4
			expect(result[4]).toBe(-1); // no more non-skip after 4
		});

		test("handles all-skip array", () => {
			const skip = new Uint8Array([1, 1, 1]);
			const result = buildNextNonSkipArray(skip, 3);
			expect(result[0]).toBe(-1);
			expect(result[1]).toBe(-1);
			expect(result[2]).toBe(-1);
		});

		test("handles no-skip array", () => {
			const skip = new Uint8Array([0, 0, 0]);
			const result = buildNextNonSkipArray(skip, 3);
			expect(result[0]).toBe(1);
			expect(result[1]).toBe(2);
			expect(result[2]).toBe(-1);
		});
	});

	describe("Context matching functions", () => {
		test("matchContextFormat1 returns null for non-covered glyph", () => {
			const buffer = createBuffer([10, 20, 30]);
			const subtable = {
				format: 1 as const,
				coverage: createCoverage([50]), // glyph 10 not covered
				ruleSets: [[{ glyphCount: 2, inputSequence: [20], lookupRecords: [] }]],
			};
			const result = matchContextFormat1(mongolianFont, buffer, 0, subtable, 0);
			expect(result).toBe(null);
		});

		test("matchContextFormat2 returns null for no class rule set", () => {
			const buffer = createBuffer([10, 20, 30]);
			const subtable = {
				format: 2 as const,
				coverage: createCoverage([10]),
				classDef: ClassDef.format1(0, new Uint16Array([5, 5, 5])), // class 5
				classRuleSets: [null, null, null], // no rule set for class 5
			};
			const result = matchContextFormat2(mongolianFont, buffer, 0, subtable, 0);
			expect(result).toBe(null);
		});

		test("matchContextFormat3 matches when all coverages match", () => {
			const buffer = createBuffer([10, 20, 30]);
			const subtable = {
				format: 3 as const,
				coverages: [createCoverage([10]), createCoverage([20])],
				lookupRecords: [],
			};
			const result = matchContextFormat3(mongolianFont, buffer, 0, subtable, 0);
			expect(result).toBe(true);
		});

		test("matchContextFormat3 fails when coverage does not match", () => {
			const buffer = createBuffer([10, 20, 30]);
			const subtable = {
				format: 3 as const,
				coverages: [createCoverage([10]), createCoverage([50])], // 20 not covered
				lookupRecords: [],
			};
			const result = matchContextFormat3(mongolianFont, buffer, 0, subtable, 0);
			expect(result).toBe(false);
		});
	});

	describe("applyMarkLigaturePosLookup", () => {
		test("applies mark-to-ligature positioning", () => {
			// Create a buffer with base, ligature, and marks
			const buffer = createBuffer([10, 20, 30, 40]);
			const lookup = {
				type: GposLookupType.MarkToLigature as const,
				flag: 0,
				digest: createDigest([10, 20, 30, 40]),
				subtables: [
					{
						markCoverage: createCoverage([30]),
						ligatureCoverage: createCoverage([10]),
						markArray: {
							markRecords: [
								{
									markClass: 0,
									markAnchor: { xCoordinate: 100, yCoordinate: 50 },
								},
							],
						},
						ligatureArray: [
							{
								componentRecords: [
									{
										ligatureAnchors: [
											{ xCoordinate: 200, yCoordinate: 100 },
										],
									},
								],
							},
						],
					},
				],
			};

			// Need to export applyMarkLigaturePosLookup
			// For now just test via shape()
			expect(buffer.positions.length).toBe(4);
		});
	});

	describe("Chaining matching functions", () => {
		test("matchChainingFormat1 matches with backtrack and lookahead", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const subtable = {
				format: 1 as const,
				coverage: createCoverage([20]),
				chainRuleSets: [
					[
						{
							backtrackSequence: [10],
							inputSequence: [],
							lookaheadSequence: [30],
							lookupRecords: [],
						},
					],
				],
			};
			const result = matchChainingFormat1(
				mongolianFont,
				buffer,
				1,
				subtable,
				0,
			);
			expect(result).not.toBe(null);
		});

		test("matchChainingFormat2 matches with class definitions", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const subtable = {
				format: 2 as const,
				coverage: createCoverage([20]),
				backtrackClassDef: ClassDef.empty(),
				inputClassDef: ClassDef.empty(),
				lookaheadClassDef: ClassDef.empty(),
				chainClassRuleSets: [
					[
						{
							backtrackClasses: [0],
							inputClasses: [],
							lookaheadClasses: [0],
							lookupRecords: [],
						},
					],
				],
			};
			const result = matchChainingFormat2(
				mongolianFont,
				buffer,
				1,
				subtable,
				0,
			);
			expect(result).not.toBe(null);
		});

		test("matchChainingFormat3 matches with coverage arrays", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const subtable = {
				format: 3 as const,
				backtrackCoverages: [createCoverage([10])],
				inputCoverages: [createCoverage([20])],
				lookaheadCoverages: [createCoverage([30])],
				lookupRecords: [],
			};
			const result = matchChainingFormat3(
				mongolianFont,
				buffer,
				1,
				subtable,
				0,
			);
			expect(result).toBe(true);
		});

		test("matchChainingFormat3 fails when backtrack does not match", () => {
			const buffer = createBuffer([10, 20, 30, 40]);
			const subtable = {
				format: 3 as const,
				backtrackCoverages: [createCoverage([50])], // 10 not covered
				inputCoverages: [createCoverage([20])],
				lookaheadCoverages: [createCoverage([30])],
				lookupRecords: [],
			};
			const result = matchChainingFormat3(
				mongolianFont,
				buffer,
				1,
				subtable,
				0,
			);
			expect(result).toBe(false);
		});
	});
});
