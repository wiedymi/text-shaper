import type { Reader } from "../../font/binary/reader.ts";
import type { Tag, uint16, uint32 } from "../../types.ts";

/**
 * FeatureVariations table
 * Allows different feature substitutions based on variation axis coordinates
 * Used in GSUB/GPOS for variable fonts
 */
export interface FeatureVariations {
	majorVersion: number;
	minorVersion: number;
	featureVariationRecords: FeatureVariationRecord[];
}

/**
 * Feature variation record
 * Contains a condition set and feature substitutions to apply when conditions are met
 */
export interface FeatureVariationRecord {
	conditionSet: ConditionSet;
	featureTableSubstitution: FeatureTableSubstitution;
}

/**
 * Condition set - all conditions must be met
 */
export interface ConditionSet {
	conditions: Condition[];
}

/**
 * Single axis condition
 */
export interface Condition {
	format: number;
	axisIndex: uint16;
	filterRangeMinValue: number; // F2DOT14
	filterRangeMaxValue: number; // F2DOT14
}

/**
 * Feature table substitution
 * Maps feature indices to replacement feature tables
 */
export interface FeatureTableSubstitution {
	majorVersion: number;
	minorVersion: number;
	substitutions: FeatureSubstitutionRecord[];
}

/**
 * Single feature substitution record
 */
export interface FeatureSubstitutionRecord {
	featureIndex: uint16;
	alternateFeature: AlternateFeature;
}

/**
 * Alternate feature table
 */
export interface AlternateFeature {
	featureParamsOffset: uint16;
	lookupListIndices: uint16[];
}

/**
 * Parse FeatureVariations table
 */
export function parseFeatureVariations(reader: Reader): FeatureVariations {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	const featureVariationRecordCount = reader.uint32();

	const recordOffsets: {
		conditionSetOffset: uint32;
		featureSubstOffset: uint32;
	}[] = [];
	for (let i = 0; i < featureVariationRecordCount; i++) {
		recordOffsets.push({
			conditionSetOffset: reader.offset32(),
			featureSubstOffset: reader.offset32(),
		});
	}

	const featureVariationRecords: FeatureVariationRecord[] = [];
	for (let i = 0; i < recordOffsets.length; i++) {
		const offsets = recordOffsets[i]!;
		const conditionSet = parseConditionSet(
			reader.sliceFrom(offsets.conditionSetOffset),
		);
		const featureTableSubstitution = parseFeatureTableSubstitution(
			reader.sliceFrom(offsets.featureSubstOffset),
		);

		featureVariationRecords.push({
			conditionSet,
			featureTableSubstitution,
		});
	}

	return {
		majorVersion,
		minorVersion,
		featureVariationRecords,
	};
}

/**
 * Parse condition set from binary data
 * @param reader - Binary reader positioned at condition set start
 * @returns Parsed condition set containing all axis conditions
 */
function parseConditionSet(reader: Reader): ConditionSet {
	const conditionCount = reader.uint16();
	const conditionOffsets: uint32[] = [];
	for (let i = 0; i < conditionCount; i++) {
		conditionOffsets.push(reader.offset32());
	}

	const conditions: Condition[] = [];
	for (let i = 0; i < conditionOffsets.length; i++) {
		const offset = conditionOffsets[i]!;
		const condReader = reader.sliceFrom(offset);
		const format = condReader.uint16();

		if (format === 1) {
			conditions.push({
				format,
				axisIndex: condReader.uint16(),
				filterRangeMinValue: condReader.f2dot14(),
				filterRangeMaxValue: condReader.f2dot14(),
			});
		}
	}

	return { conditions };
}

/**
 * Parse feature table substitution from binary data
 * @param reader - Binary reader positioned at feature table substitution start
 * @returns Parsed feature table substitution containing all feature substitution records
 */
function parseFeatureTableSubstitution(
	reader: Reader,
): FeatureTableSubstitution {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	const substitutionCount = reader.uint16();

	const substitutionRecords: { featureIndex: uint16; offset: uint32 }[] = [];
	for (let i = 0; i < substitutionCount; i++) {
		substitutionRecords.push({
			featureIndex: reader.uint16(),
			offset: reader.offset32(),
		});
	}

	const substitutions: FeatureSubstitutionRecord[] = [];
	for (let i = 0; i < substitutionRecords.length; i++) {
		const record = substitutionRecords[i]!;
		const featureReader = reader.sliceFrom(record.offset);
		const featureParamsOffset = featureReader.offset16();
		const lookupIndexCount = featureReader.uint16();
		const uint16Array = featureReader.uint16Array(lookupIndexCount);
		const lookupListIndices: uint16[] = new Array(lookupIndexCount);
		for (let j = 0; j < lookupIndexCount; j++) {
			lookupListIndices[j] = uint16Array[j]!;
		}

		substitutions.push({
			featureIndex: record.featureIndex,
			alternateFeature: {
				featureParamsOffset,
				lookupListIndices,
			},
		});
	}

	return {
		majorVersion,
		minorVersion,
		substitutions,
	};
}

/**
 * Evaluate condition set against axis coordinates
 * Returns true if all conditions are met
 */
export function evaluateConditionSet(
	conditionSet: ConditionSet,
	axisCoords: number[],
): boolean {
	for (let i = 0; i < conditionSet.conditions.length; i++) {
		const condition = conditionSet.conditions[i]!;
		const axisValue = axisCoords[condition.axisIndex] ?? 0;
		if (
			axisValue < condition.filterRangeMinValue ||
			axisValue > condition.filterRangeMaxValue
		) {
			return false;
		}
	}
	return true;
}

/**
 * Find matching feature variation record for given axis coordinates
 * Returns the first matching record, or null if none match
 */
export function findMatchingFeatureVariation(
	featureVariations: FeatureVariations,
	axisCoords: number[],
): FeatureVariationRecord | null {
	for (let i = 0; i < featureVariations.featureVariationRecords.length; i++) {
		const record = featureVariations.featureVariationRecords[i]!;
		if (evaluateConditionSet(record.conditionSet, axisCoords)) {
			return record;
		}
	}
	return null;
}

/**
 * Get substituted lookup list indices for a feature
 * Returns the original lookups if no substitution applies
 */
export function getSubstitutedLookups(
	featureVariations: FeatureVariations | null,
	featureIndex: number,
	originalLookups: uint16[],
	axisCoords: number[] | null,
): uint16[] {
	if (!featureVariations || !axisCoords) {
		return originalLookups;
	}

	const matchingRecord = findMatchingFeatureVariation(
		featureVariations,
		axisCoords,
	);
	if (!matchingRecord) {
		return originalLookups;
	}

	// Check if this feature has a substitution
	const substitution =
		matchingRecord.featureTableSubstitution.substitutions.find(
			(s) => s.featureIndex === featureIndex,
		);

	if (substitution) {
		return substitution.alternateFeature.lookupListIndices;
	}

	return originalLookups;
}

/**
 * Apply feature variations to a feature list
 * Returns a modified feature list with substituted lookup indices
 */
export function applyFeatureVariations(
	featureVariations: FeatureVariations | null,
	featureLookups: Map<Tag, uint16[]>,
	featureIndices: Map<Tag, number>,
	axisCoords: number[] | null,
): Map<Tag, uint16[]> {
	if (!featureVariations || !axisCoords) {
		return featureLookups;
	}

	const matchingRecord = findMatchingFeatureVariation(
		featureVariations,
		axisCoords,
	);
	if (!matchingRecord) {
		return featureLookups;
	}

	// Create a new map with substituted lookups
	const result = new Map(featureLookups);

	const substitutions = matchingRecord.featureTableSubstitution.substitutions;
	for (let i = 0; i < substitutions.length; i++) {
		const substitution = substitutions[i]!;
		// Find the feature tag for this index
		const entries = [...featureIndices.entries()];
		for (let j = 0; j < entries.length; j++) {
			const [tag, index] = entries[j]!;
			if (index === substitution.featureIndex) {
				result.set(tag, substitution.alternateFeature.lookupListIndices);
				break;
			}
		}
	}

	return result;
}
