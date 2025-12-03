import { describe, expect, test } from "bun:test";
import { Reader } from "../../../src/font/binary/reader.ts";
import {
	parseFeatureVariations,
	evaluateConditionSet,
	findMatchingFeatureVariation,
	getSubstitutedLookups,
	applyFeatureVariations,
	type FeatureVariations,
	type ConditionSet,
	type Condition,
	type FeatureTableSubstitution,
	type FeatureVariationRecord,
} from "../../../src/layout/structures/feature-variations.ts";

function createBuffer(...bytes: number[]): ArrayBuffer {
	return new Uint8Array(bytes).buffer;
}

describe("FeatureVariations", () => {
	describe("parseFeatureVariations", () => {
		test("parses empty feature variations", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // majorVersion = 1
				0x00, 0x00, // minorVersion = 0
				0x00, 0x00, 0x00, 0x00, // featureVariationRecordCount = 0
			));
			const fv = parseFeatureVariations(reader);

			expect(fv.majorVersion).toBe(1);
			expect(fv.minorVersion).toBe(0);
			expect(fv.featureVariationRecords.length).toBe(0);
		});

		test("parses single feature variation record", () => {
			// Build a minimal feature variation with one record
			const reader = new Reader(createBuffer(
				0x00, 0x01, // majorVersion = 1
				0x00, 0x00, // minorVersion = 0
				0x00, 0x00, 0x00, 0x01, // featureVariationRecordCount = 1
				// Record 0 offsets (relative to table start):
				0x00, 0x00, 0x00, 0x10, // conditionSetOffset = 16
				0x00, 0x00, 0x00, 0x14, // featureSubstOffset = 20
				// ConditionSet at offset 16:
				0x00, 0x00, // conditionCount = 0
				0x00, 0x00, // padding to align to offset 20
				// FeatureTableSubstitution at offset 20:
				0x00, 0x01, // majorVersion = 1
				0x00, 0x00, // minorVersion = 0
				0x00, 0x00, // substitutionCount = 0
			));
			const fv = parseFeatureVariations(reader);

			expect(fv.featureVariationRecords.length).toBe(1);
			expect(fv.featureVariationRecords[0].conditionSet.conditions.length).toBe(0);
			expect(fv.featureVariationRecords[0].featureTableSubstitution.substitutions.length).toBe(0);
		});

		test("parses condition set with single condition", () => {
			// F2DOT14 encoding: multiply by 16384
			// 0.5 = 0x2000, 1.0 = 0x4000
			const reader = new Reader(createBuffer(
				0x00, 0x01, // majorVersion = 1
				0x00, 0x00, // minorVersion = 0
				0x00, 0x00, 0x00, 0x01, // featureVariationRecordCount = 1
				// Record 0 offsets:
				0x00, 0x00, 0x00, 0x10, // conditionSetOffset = 16
				0x00, 0x00, 0x00, 0x20, // featureSubstOffset = 32
				// ConditionSet at offset 16:
				0x00, 0x01, // conditionCount = 1
				0x00, 0x00, 0x00, 0x06, // condition[0] offset = 6 (relative to ConditionSet)
				// Condition at offset 22 (16 + 6):
				0x00, 0x01, // format = 1
				0x00, 0x00, // axisIndex = 0
				0x20, 0x00, // filterRangeMinValue = 0.5 (F2DOT14)
				0x40, 0x00, // filterRangeMaxValue = 1.0 (F2DOT14)
				0x00, 0x00, // padding to align to offset 32
				// FeatureTableSubstitution at offset 32:
				0x00, 0x01, // majorVersion = 1
				0x00, 0x00, // minorVersion = 0
				0x00, 0x00, // substitutionCount = 0
			));
			const fv = parseFeatureVariations(reader);

			expect(fv.featureVariationRecords.length).toBe(1);
			const conditions = fv.featureVariationRecords[0].conditionSet.conditions;
			expect(conditions.length).toBe(1);
			expect(conditions[0].format).toBe(1);
			expect(conditions[0].axisIndex).toBe(0);
			expect(conditions[0].filterRangeMinValue).toBeCloseTo(0.5, 2);
			expect(conditions[0].filterRangeMaxValue).toBeCloseTo(1.0, 2);
		});

		test("parses feature table substitution with lookups", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // majorVersion = 1
				0x00, 0x00, // minorVersion = 0
				0x00, 0x00, 0x00, 0x01, // featureVariationRecordCount = 1
				// Record 0 offsets:
				0x00, 0x00, 0x00, 0x10, // conditionSetOffset = 16
				0x00, 0x00, 0x00, 0x14, // featureSubstOffset = 20
				// ConditionSet at offset 16 (empty):
				0x00, 0x00, // conditionCount = 0
				// Padding to align:
				0x00, 0x00,
				// FeatureTableSubstitution at offset 20:
				0x00, 0x01, // majorVersion = 1
				0x00, 0x00, // minorVersion = 0
				0x00, 0x01, // substitutionCount = 1
				// SubstitutionRecord[0]:
				0x00, 0x02, // featureIndex = 2
				0x00, 0x00, 0x00, 0x0c, // alternateFeature offset = 12 (relative to FeatureTableSubstitution at 20)
				// AlternateFeature at offset 32 (20 + 12):
				0x00, 0x00, // featureParamsOffset = 0 (null)
				0x00, 0x02, // lookupIndexCount = 2
				0x00, 0x0a, // lookupListIndices[0] = 10
				0x00, 0x0f, // lookupListIndices[1] = 15
			));
			const fv = parseFeatureVariations(reader);

			expect(fv.featureVariationRecords.length).toBe(1);
			const substitutions = fv.featureVariationRecords[0].featureTableSubstitution.substitutions;
			expect(substitutions.length).toBe(1);
			expect(substitutions[0].featureIndex).toBe(2);
			expect(substitutions[0].alternateFeature.lookupListIndices).toEqual([10, 15]);
		});

		test("parses multiple feature variation records", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // majorVersion = 1
				0x00, 0x00, // minorVersion = 0
				0x00, 0x00, 0x00, 0x02, // featureVariationRecordCount = 2
				// Record 0 offsets:
				0x00, 0x00, 0x00, 0x18, // conditionSetOffset = 24
				0x00, 0x00, 0x00, 0x1c, // featureSubstOffset = 28
				// Record 1 offsets:
				0x00, 0x00, 0x00, 0x22, // conditionSetOffset = 34
				0x00, 0x00, 0x00, 0x26, // featureSubstOffset = 38
				// ConditionSet 0 at offset 24 (empty):
				0x00, 0x00,
				0x00, 0x00, // padding
				// FeatureTableSubstitution 0 at offset 28:
				0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
				// ConditionSet 1 at offset 34 (empty):
				0x00, 0x00,
				0x00, 0x00, // padding
				// FeatureTableSubstitution 1 at offset 38:
				0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
			));
			const fv = parseFeatureVariations(reader);

			expect(fv.featureVariationRecords.length).toBe(2);
		});

		test("parses multiple conditions in condition set", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // majorVersion = 1
				0x00, 0x00, // minorVersion = 0
				0x00, 0x00, 0x00, 0x01, // featureVariationRecordCount = 1
				// Record 0 offsets:
				0x00, 0x00, 0x00, 0x10, // conditionSetOffset = 16
				0x00, 0x00, 0x00, 0x30, // featureSubstOffset = 48
				// ConditionSet at offset 16:
				0x00, 0x02, // conditionCount = 2
				0x00, 0x00, 0x00, 0x0a, // condition[0] offset = 10 (relative)
				0x00, 0x00, 0x00, 0x14, // condition[1] offset = 20 (relative)
				// Condition 0 at offset 26 (16 + 10):
				0x00, 0x01, // format = 1
				0x00, 0x00, // axisIndex = 0
				0x00, 0x00, // filterRangeMinValue = 0.0
				0x20, 0x00, // filterRangeMaxValue = 0.5
				0x00, 0x00, // padding
				// Condition 1 at offset 36 (16 + 20):
				0x00, 0x01, // format = 1
				0x00, 0x01, // axisIndex = 1
				0x30, 0x00, // filterRangeMinValue = 0.75
				0x40, 0x00, // filterRangeMaxValue = 1.0
				0x00, 0x00, 0x00, 0x00, // padding to align to 48
				// FeatureTableSubstitution at offset 48:
				0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
			));
			const fv = parseFeatureVariations(reader);

			const conditions = fv.featureVariationRecords[0].conditionSet.conditions;
			expect(conditions.length).toBe(2);
			expect(conditions[0].axisIndex).toBe(0);
			expect(conditions[1].axisIndex).toBe(1);
		});

		test("parses multiple substitutions", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // majorVersion = 1
				0x00, 0x00, // minorVersion = 0
				0x00, 0x00, 0x00, 0x01, // featureVariationRecordCount = 1
				// Record 0 offsets:
				0x00, 0x00, 0x00, 0x10, // conditionSetOffset = 16
				0x00, 0x00, 0x00, 0x14, // featureSubstOffset = 20
				// ConditionSet at offset 16 (empty):
				0x00, 0x00,
				0x00, 0x00, // padding
				// FeatureTableSubstitution at offset 20:
				0x00, 0x01, // majorVersion = 1
				0x00, 0x00, // minorVersion = 0
				0x00, 0x02, // substitutionCount = 2
				// SubstitutionRecord[0]:
				0x00, 0x00, // featureIndex = 0
				0x00, 0x00, 0x00, 0x12, // alternateFeature offset = 18 (relative to FeatureTableSubstitution at 20)
				// SubstitutionRecord[1]:
				0x00, 0x01, // featureIndex = 1
				0x00, 0x00, 0x00, 0x18, // alternateFeature offset = 24 (relative)
				// AlternateFeature 0 at offset 38 (20 + 18):
				0x00, 0x00, // featureParamsOffset = 0
				0x00, 0x01, // lookupIndexCount = 1
				0x00, 0x05, // lookupListIndices[0] = 5
				// AlternateFeature 1 at offset 44 (20 + 24):
				0x00, 0x00, // featureParamsOffset = 0
				0x00, 0x01, // lookupIndexCount = 1
				0x00, 0x07, // lookupListIndices[0] = 7
			));
			const fv = parseFeatureVariations(reader);

			const substitutions = fv.featureVariationRecords[0].featureTableSubstitution.substitutions;
			expect(substitutions.length).toBe(2);
			expect(substitutions[0].featureIndex).toBe(0);
			expect(substitutions[0].alternateFeature.lookupListIndices).toEqual([5]);
			expect(substitutions[1].featureIndex).toBe(1);
			expect(substitutions[1].alternateFeature.lookupListIndices).toEqual([7]);
		});
	});

	describe("evaluateConditionSet", () => {
		test("returns true for empty condition set", () => {
			const conditionSet: ConditionSet = {
				conditions: [],
			};

			expect(evaluateConditionSet(conditionSet, [])).toBe(true);
			expect(evaluateConditionSet(conditionSet, [0.5])).toBe(true);
		});

		test("returns true when single condition is met", () => {
			const conditionSet: ConditionSet = {
				conditions: [{
					format: 1,
					axisIndex: 0,
					filterRangeMinValue: 0.5,
					filterRangeMaxValue: 1.0,
				}],
			};

			expect(evaluateConditionSet(conditionSet, [0.5])).toBe(true);
			expect(evaluateConditionSet(conditionSet, [0.75])).toBe(true);
			expect(evaluateConditionSet(conditionSet, [1.0])).toBe(true);
		});

		test("returns false when single condition is not met", () => {
			const conditionSet: ConditionSet = {
				conditions: [{
					format: 1,
					axisIndex: 0,
					filterRangeMinValue: 0.5,
					filterRangeMaxValue: 1.0,
				}],
			};

			expect(evaluateConditionSet(conditionSet, [0.4])).toBe(false);
			expect(evaluateConditionSet(conditionSet, [1.1])).toBe(false);
			expect(evaluateConditionSet(conditionSet, [0.0])).toBe(false);
		});

		test("returns true when all conditions are met", () => {
			const conditionSet: ConditionSet = {
				conditions: [
					{
						format: 1,
						axisIndex: 0,
						filterRangeMinValue: 0.5,
						filterRangeMaxValue: 1.0,
					},
					{
						format: 1,
						axisIndex: 1,
						filterRangeMinValue: 0.0,
						filterRangeMaxValue: 0.5,
					},
				],
			};

			expect(evaluateConditionSet(conditionSet, [0.75, 0.25])).toBe(true);
			expect(evaluateConditionSet(conditionSet, [0.5, 0.0])).toBe(true);
			expect(evaluateConditionSet(conditionSet, [1.0, 0.5])).toBe(true);
		});

		test("returns false when any condition is not met", () => {
			const conditionSet: ConditionSet = {
				conditions: [
					{
						format: 1,
						axisIndex: 0,
						filterRangeMinValue: 0.5,
						filterRangeMaxValue: 1.0,
					},
					{
						format: 1,
						axisIndex: 1,
						filterRangeMinValue: 0.0,
						filterRangeMaxValue: 0.5,
					},
				],
			};

			// First condition fails
			expect(evaluateConditionSet(conditionSet, [0.4, 0.25])).toBe(false);
			// Second condition fails
			expect(evaluateConditionSet(conditionSet, [0.75, 0.6])).toBe(false);
			// Both fail
			expect(evaluateConditionSet(conditionSet, [0.4, 0.6])).toBe(false);
		});

		test("handles missing axis coordinates (defaults to 0)", () => {
			const conditionSet: ConditionSet = {
				conditions: [{
					format: 1,
					axisIndex: 5, // axis not present in coords
					filterRangeMinValue: -1.0,
					filterRangeMaxValue: 1.0,
				}],
			};

			// Missing axis should default to 0, which is in range
			expect(evaluateConditionSet(conditionSet, [0.5])).toBe(true);
			expect(evaluateConditionSet(conditionSet, [])).toBe(true);
		});

		test("handles boundary values exactly", () => {
			const conditionSet: ConditionSet = {
				conditions: [{
					format: 1,
					axisIndex: 0,
					filterRangeMinValue: 0.5,
					filterRangeMaxValue: 1.0,
				}],
			};

			// Boundaries should be inclusive
			expect(evaluateConditionSet(conditionSet, [0.5])).toBe(true);
			expect(evaluateConditionSet(conditionSet, [1.0])).toBe(true);
		});

		test("handles negative axis ranges", () => {
			const conditionSet: ConditionSet = {
				conditions: [{
					format: 1,
					axisIndex: 0,
					filterRangeMinValue: -1.0,
					filterRangeMaxValue: -0.5,
				}],
			};

			expect(evaluateConditionSet(conditionSet, [-0.75])).toBe(true);
			expect(evaluateConditionSet(conditionSet, [-1.0])).toBe(true);
			expect(evaluateConditionSet(conditionSet, [-0.4])).toBe(false);
			expect(evaluateConditionSet(conditionSet, [0.0])).toBe(false);
		});
	});

	describe("findMatchingFeatureVariation", () => {
		test("returns null for empty feature variations", () => {
			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [],
			};

			expect(findMatchingFeatureVariation(fv, [0.5])).toBeNull();
		});

		test("returns null when no conditions match", () => {
			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [{
					conditionSet: {
						conditions: [{
							format: 1,
							axisIndex: 0,
							filterRangeMinValue: 0.5,
							filterRangeMaxValue: 1.0,
						}],
					},
					featureTableSubstitution: {
						majorVersion: 1,
						minorVersion: 0,
						substitutions: [],
					},
				}],
			};

			expect(findMatchingFeatureVariation(fv, [0.3])).toBeNull();
		});

		test("returns first matching record", () => {
			const record0: FeatureVariationRecord = {
				conditionSet: {
					conditions: [{
						format: 1,
						axisIndex: 0,
						filterRangeMinValue: 0.5,
						filterRangeMaxValue: 1.0,
					}],
				},
				featureTableSubstitution: {
					majorVersion: 1,
					minorVersion: 0,
					substitutions: [],
				},
			};

			const record1: FeatureVariationRecord = {
				conditionSet: {
					conditions: [{
						format: 1,
						axisIndex: 0,
						filterRangeMinValue: 0.0,
						filterRangeMaxValue: 0.5,
					}],
				},
				featureTableSubstitution: {
					majorVersion: 1,
					minorVersion: 0,
					substitutions: [],
				},
			};

			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [record0, record1],
			};

			expect(findMatchingFeatureVariation(fv, [0.75])).toBe(record0);
			expect(findMatchingFeatureVariation(fv, [0.25])).toBe(record1);
		});

		test("returns first match when multiple records match", () => {
			// Both records have overlapping conditions
			const record0: FeatureVariationRecord = {
				conditionSet: {
					conditions: [{
						format: 1,
						axisIndex: 0,
						filterRangeMinValue: 0.0,
						filterRangeMaxValue: 1.0,
					}],
				},
				featureTableSubstitution: {
					majorVersion: 1,
					minorVersion: 0,
					substitutions: [],
				},
			};

			const record1: FeatureVariationRecord = {
				conditionSet: {
					conditions: [{
						format: 1,
						axisIndex: 0,
						filterRangeMinValue: 0.5,
						filterRangeMaxValue: 1.0,
					}],
				},
				featureTableSubstitution: {
					majorVersion: 1,
					minorVersion: 0,
					substitutions: [],
				},
			};

			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [record0, record1],
			};

			// Both match, but should return first
			expect(findMatchingFeatureVariation(fv, [0.75])).toBe(record0);
		});
	});

	describe("getSubstitutedLookups", () => {
		test("returns original lookups when feature variations is null", () => {
			const originalLookups = [1, 2, 3];
			expect(getSubstitutedLookups(null, 0, originalLookups, [0.5])).toEqual(originalLookups);
		});

		test("returns original lookups when axis coords is null", () => {
			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [],
			};
			const originalLookups = [1, 2, 3];

			expect(getSubstitutedLookups(fv, 0, originalLookups, null)).toEqual(originalLookups);
		});

		test("returns original lookups when no variation matches", () => {
			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [{
					conditionSet: {
						conditions: [{
							format: 1,
							axisIndex: 0,
							filterRangeMinValue: 0.5,
							filterRangeMaxValue: 1.0,
						}],
					},
					featureTableSubstitution: {
						majorVersion: 1,
						minorVersion: 0,
						substitutions: [],
					},
				}],
			};
			const originalLookups = [1, 2, 3];

			expect(getSubstitutedLookups(fv, 0, originalLookups, [0.3])).toEqual(originalLookups);
		});

		test("returns original lookups when feature has no substitution", () => {
			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [{
					conditionSet: {
						conditions: [{
							format: 1,
							axisIndex: 0,
							filterRangeMinValue: 0.5,
							filterRangeMaxValue: 1.0,
						}],
					},
					featureTableSubstitution: {
						majorVersion: 1,
						minorVersion: 0,
						substitutions: [{
							featureIndex: 5, // different feature
							alternateFeature: {
								featureParamsOffset: 0,
								lookupListIndices: [10, 11],
							},
						}],
					},
				}],
			};
			const originalLookups = [1, 2, 3];

			expect(getSubstitutedLookups(fv, 0, originalLookups, [0.75])).toEqual(originalLookups);
		});

		test("returns substituted lookups when feature matches", () => {
			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [{
					conditionSet: {
						conditions: [{
							format: 1,
							axisIndex: 0,
							filterRangeMinValue: 0.5,
							filterRangeMaxValue: 1.0,
						}],
					},
					featureTableSubstitution: {
						majorVersion: 1,
						minorVersion: 0,
						substitutions: [{
							featureIndex: 2,
							alternateFeature: {
								featureParamsOffset: 0,
								lookupListIndices: [10, 11, 12],
							},
						}],
					},
				}],
			};
			const originalLookups = [1, 2, 3];

			expect(getSubstitutedLookups(fv, 2, originalLookups, [0.75])).toEqual([10, 11, 12]);
		});
	});

	describe("applyFeatureVariations", () => {
		test("returns original map when feature variations is null", () => {
			const featureLookups = new Map([
				[0x6b657266, [1, 2, 3]], // "frek" in reverse
			]);
			const featureIndices = new Map([[0x6b657266, 0]]);

			const result = applyFeatureVariations(null, featureLookups, featureIndices, [0.5]);

			expect(result).toBe(featureLookups);
		});

		test("returns original map when axis coords is null", () => {
			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [],
			};
			const featureLookups = new Map([
				[0x6b657266, [1, 2, 3]],
			]);
			const featureIndices = new Map([[0x6b657266, 0]]);

			const result = applyFeatureVariations(fv, featureLookups, featureIndices, null);

			expect(result).toBe(featureLookups);
		});

		test("returns original map when no variation matches", () => {
			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [{
					conditionSet: {
						conditions: [{
							format: 1,
							axisIndex: 0,
							filterRangeMinValue: 0.5,
							filterRangeMaxValue: 1.0,
						}],
					},
					featureTableSubstitution: {
						majorVersion: 1,
						minorVersion: 0,
						substitutions: [],
					},
				}],
			};
			const featureLookups = new Map([
				[0x6b657266, [1, 2, 3]],
			]);
			const featureIndices = new Map([[0x6b657266, 0]]);

			const result = applyFeatureVariations(fv, featureLookups, featureIndices, [0.3]);

			expect(result).toBe(featureLookups);
		});

		test("returns new map with substituted lookups", () => {
			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [{
					conditionSet: {
						conditions: [{
							format: 1,
							axisIndex: 0,
							filterRangeMinValue: 0.5,
							filterRangeMaxValue: 1.0,
						}],
					},
					featureTableSubstitution: {
						majorVersion: 1,
						minorVersion: 0,
						substitutions: [{
							featureIndex: 0,
							alternateFeature: {
								featureParamsOffset: 0,
								lookupListIndices: [10, 11],
							},
						}],
					},
				}],
			};

			const tag = 0x6b657266; // some tag
			const featureLookups = new Map([
				[tag, [1, 2, 3]],
			]);
			const featureIndices = new Map([[tag, 0]]);

			const result = applyFeatureVariations(fv, featureLookups, featureIndices, [0.75]);

			expect(result).not.toBe(featureLookups); // new map
			expect(result.get(tag)).toEqual([10, 11]);
		});

		test("substitutes multiple features", () => {
			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [{
					conditionSet: {
						conditions: [],
					},
					featureTableSubstitution: {
						majorVersion: 1,
						minorVersion: 0,
						substitutions: [
							{
								featureIndex: 0,
								alternateFeature: {
									featureParamsOffset: 0,
									lookupListIndices: [10],
								},
							},
							{
								featureIndex: 1,
								alternateFeature: {
									featureParamsOffset: 0,
									lookupListIndices: [20, 21],
								},
							},
						],
					},
				}],
			};

			const tag1 = 0x31676174; // "tag1"
			const tag2 = 0x32676174; // "tag2"
			const tag3 = 0x33676174; // "tag3"
			const featureLookups = new Map([
				[tag1, [1]],
				[tag2, [2]],
				[tag3, [3]], // not substituted
			]);
			const featureIndices = new Map([
				[tag1, 0],
				[tag2, 1],
				[tag3, 2],
			]);

			const result = applyFeatureVariations(fv, featureLookups, featureIndices, [0.5]);

			expect(result.get(tag1)).toEqual([10]);
			expect(result.get(tag2)).toEqual([20, 21]);
			expect(result.get(tag3)).toEqual([3]); // unchanged
		});

		test("does not modify features without substitutions", () => {
			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [{
					conditionSet: {
						conditions: [],
					},
					featureTableSubstitution: {
						majorVersion: 1,
						minorVersion: 0,
						substitutions: [{
							featureIndex: 0,
							alternateFeature: {
								featureParamsOffset: 0,
								lookupListIndices: [10],
							},
						}],
					},
				}],
			};

			const tag1 = 0x31676174;
			const tag2 = 0x32676174;
			const featureLookups = new Map([
				[tag1, [1]],
				[tag2, [2, 3]],
			]);
			const featureIndices = new Map([
				[tag1, 0],
				[tag2, 1], // no substitution for index 1
			]);

			const result = applyFeatureVariations(fv, featureLookups, featureIndices, [0.5]);

			expect(result.get(tag1)).toEqual([10]); // substituted
			expect(result.get(tag2)).toEqual([2, 3]); // unchanged
		});

		test("handles feature indices not found in feature lookups", () => {
			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [{
					conditionSet: {
						conditions: [],
					},
					featureTableSubstitution: {
						majorVersion: 1,
						minorVersion: 0,
						substitutions: [{
							featureIndex: 99, // no matching tag
							alternateFeature: {
								featureParamsOffset: 0,
								lookupListIndices: [100],
							},
						}],
					},
				}],
			};

			const tag = 0x31676174;
			const featureLookups = new Map([[tag, [1]]]);
			const featureIndices = new Map([[tag, 0]]);

			const result = applyFeatureVariations(fv, featureLookups, featureIndices, [0.5]);

			// Should not crash, just return unchanged lookups
			expect(result.get(tag)).toEqual([1]);
		});
	});

	describe("edge cases", () => {
		test("handles condition with zero axis index", () => {
			const conditionSet: ConditionSet = {
				conditions: [{
					format: 1,
					axisIndex: 0,
					filterRangeMinValue: 0.0,
					filterRangeMaxValue: 1.0,
				}],
			};

			expect(evaluateConditionSet(conditionSet, [0.5])).toBe(true);
		});

		test("handles conditions across many axes", () => {
			const conditionSet: ConditionSet = {
				conditions: [
					{ format: 1, axisIndex: 0, filterRangeMinValue: 0.0, filterRangeMaxValue: 1.0 },
					{ format: 1, axisIndex: 1, filterRangeMinValue: 0.0, filterRangeMaxValue: 1.0 },
					{ format: 1, axisIndex: 2, filterRangeMinValue: 0.0, filterRangeMaxValue: 1.0 },
					{ format: 1, axisIndex: 3, filterRangeMinValue: 0.0, filterRangeMaxValue: 1.0 },
				],
			};

			expect(evaluateConditionSet(conditionSet, [0.5, 0.5, 0.5, 0.5])).toBe(true);
			expect(evaluateConditionSet(conditionSet, [0.5, 0.5, 1.5, 0.5])).toBe(false); // axis 2 out of range
		});

		test("handles empty lookups array in substitution", () => {
			const fv: FeatureVariations = {
				majorVersion: 1,
				minorVersion: 0,
				featureVariationRecords: [{
					conditionSet: {
						conditions: [],
					},
					featureTableSubstitution: {
						majorVersion: 1,
						minorVersion: 0,
						substitutions: [{
							featureIndex: 0,
							alternateFeature: {
								featureParamsOffset: 0,
								lookupListIndices: [], // empty
							},
						}],
					},
				}],
			};

			const tag = 0x31676174;
			const featureLookups = new Map([[tag, [1, 2]]]);
			const featureIndices = new Map([[tag, 0]]);

			const result = applyFeatureVariations(fv, featureLookups, featureIndices, [0.5]);

			expect(result.get(tag)).toEqual([]);
		});
	});
});
