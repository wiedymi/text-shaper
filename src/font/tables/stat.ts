import type { Tag, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * Style Attributes table (STAT)
 * Provides style information for variable fonts
 * Used for font selection and naming
 */
export interface StatTable {
	majorVersion: uint16;
	minorVersion: uint16;
	designAxisCount: uint16;
	designAxes: AxisRecord[];
	axisValueCount: uint16;
	axisValues: AxisValue[];
	elidedFallbackNameID?: uint16;
}

/**
 * Design axis record
 */
export interface AxisRecord {
	axisTag: Tag;
	axisNameID: uint16;
	axisOrdering: uint16;
}

/**
 * Axis value flags
 */
export const AxisValueFlags = {
	OlderSiblingFontAttribute: 0x0001,
	ElidableAxisValueName: 0x0002,
} as const;

/**
 * Base axis value
 */
export interface AxisValueBase {
	format: number;
	axisIndex: uint16;
	flags: uint16;
	valueNameID: uint16;
}

/**
 * Format 1: Single axis value
 */
export interface AxisValueFormat1 extends AxisValueBase {
	format: 1;
	value: number; // Fixed 16.16
}

/**
 * Format 2: Axis value range
 */
export interface AxisValueFormat2 extends AxisValueBase {
	format: 2;
	nominalValue: number;
	rangeMinValue: number;
	rangeMaxValue: number;
}

/**
 * Format 3: Linked axis value
 */
export interface AxisValueFormat3 extends AxisValueBase {
	format: 3;
	value: number;
	linkedValue: number;
}

/**
 * Format 4: Multiple axis values
 */
export interface AxisValueFormat4 {
	format: 4;
	axisCount: uint16;
	flags: uint16;
	valueNameID: uint16;
	axisValues: { axisIndex: uint16; value: number }[];
}

export type AxisValue =
	| AxisValueFormat1
	| AxisValueFormat2
	| AxisValueFormat3
	| AxisValueFormat4;

/**
 * Parse STAT table
 */
export function parseStat(reader: Reader): StatTable {
	const tableStart = reader.offset;
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	const designAxisSize = reader.uint16();
	const designAxisCount = reader.uint16();
	const designAxesOffset = reader.offset32();
	const axisValueCount = reader.uint16();
	const axisValueArrayOffset = reader.offset32();

	let elidedFallbackNameID: uint16 | undefined;
	if (majorVersion >= 1 && minorVersion >= 1) {
		elidedFallbackNameID = reader.uint16();
	}

	// Parse design axes
	const designAxes: AxisRecord[] = [];
	if (designAxesOffset !== 0) {
		const axesReader = reader.sliceFrom(tableStart + designAxesOffset);
		for (let i = 0; i < designAxisCount; i++) {
			designAxes.push({
				axisTag: axesReader.tag(),
				axisNameID: axesReader.uint16(),
				axisOrdering: axesReader.uint16(),
			});
			// Skip any additional bytes if designAxisSize > 8
			if (designAxisSize > 8) {
				axesReader.skip(designAxisSize - 8);
			}
		}
	}

	// Parse axis values
	const axisValues: AxisValue[] = [];
	if (axisValueArrayOffset !== 0 && axisValueCount > 0) {
		const arrayReader = reader.sliceFrom(tableStart + axisValueArrayOffset);

		// Read axis value offsets
		const axisValueOffsets: uint16[] = [];
		for (let i = 0; i < axisValueCount; i++) {
			axisValueOffsets.push(arrayReader.uint16());
		}

		// Parse each axis value
		for (const offset of axisValueOffsets) {
			const valueReader = reader.sliceFrom(
				tableStart + axisValueArrayOffset + offset,
			);
			const axisValue = parseAxisValue(valueReader);
			if (axisValue) {
				axisValues.push(axisValue);
			}
		}
	}

	return {
		majorVersion,
		minorVersion,
		designAxisCount,
		designAxes,
		axisValueCount,
		axisValues,
		elidedFallbackNameID,
	};
}

function parseAxisValue(reader: Reader): AxisValue | null {
	const format = reader.uint16();

	switch (format) {
		case 1: {
			return {
				format: 1,
				axisIndex: reader.uint16(),
				flags: reader.uint16(),
				valueNameID: reader.uint16(),
				value: reader.fixed(),
			};
		}
		case 2: {
			return {
				format: 2,
				axisIndex: reader.uint16(),
				flags: reader.uint16(),
				valueNameID: reader.uint16(),
				nominalValue: reader.fixed(),
				rangeMinValue: reader.fixed(),
				rangeMaxValue: reader.fixed(),
			};
		}
		case 3: {
			return {
				format: 3,
				axisIndex: reader.uint16(),
				flags: reader.uint16(),
				valueNameID: reader.uint16(),
				value: reader.fixed(),
				linkedValue: reader.fixed(),
			};
		}
		case 4: {
			const axisCount = reader.uint16();
			const flags = reader.uint16();
			const valueNameID = reader.uint16();

			const axisValues: { axisIndex: uint16; value: number }[] = [];
			for (let i = 0; i < axisCount; i++) {
				axisValues.push({
					axisIndex: reader.uint16(),
					value: reader.fixed(),
				});
			}

			return {
				format: 4,
				axisCount,
				flags,
				valueNameID,
				axisValues,
			};
		}
		default:
			return null;
	}
}

/**
 * Get axis record by tag
 */
export function getAxisRecord(
	stat: StatTable,
	axisTag: Tag,
): AxisRecord | null {
	return stat.designAxes.find((a) => a.axisTag === axisTag) ?? null;
}

/**
 * Get axis index by tag
 */
export function getAxisIndex(stat: StatTable, axisTag: Tag): number {
	return stat.designAxes.findIndex((a) => a.axisTag === axisTag);
}

/**
 * Get axis values for a specific axis
 */
export function getAxisValuesForAxis(
	stat: StatTable,
	axisIndex: number,
): AxisValue[] {
	return stat.axisValues.filter((v) => {
		if (v.format === 4) {
			return v.axisValues.some((av) => av.axisIndex === axisIndex);
		}
		return v.axisIndex === axisIndex;
	});
}

/**
 * Find axis value by name ID
 */
export function findAxisValueByNameId(
	stat: StatTable,
	nameId: uint16,
): AxisValue | null {
	return stat.axisValues.find((v) => v.valueNameID === nameId) ?? null;
}

/**
 * Check if axis value is elidable
 */
export function isElidableAxisValue(axisValue: AxisValue): boolean {
	return (axisValue.flags & AxisValueFlags.ElidableAxisValueName) !== 0;
}

/**
 * Check if axis value represents an older sibling font
 */
export function isOlderSiblingFont(axisValue: AxisValue): boolean {
	return (axisValue.flags & AxisValueFlags.OlderSiblingFontAttribute) !== 0;
}

/**
 * Get the value for a format 1-3 axis value
 */
export function getAxisValueNumber(axisValue: AxisValue): number | null {
	switch (axisValue.format) {
		case 1:
		case 3:
			return axisValue.value;
		case 2:
			return axisValue.nominalValue;
		case 4:
			return null; // Format 4 has multiple values
	}
}

/**
 * Match axis value to coordinates
 * Returns true if the axis value matches the given coordinates
 */
export function matchAxisValue(
	axisValue: AxisValue,
	coords: Map<number, number>,
): boolean {
	switch (axisValue.format) {
		case 1:
		case 3: {
			const coord = coords.get(axisValue.axisIndex);
			return coord !== undefined && coord === axisValue.value;
		}
		case 2: {
			const coord = coords.get(axisValue.axisIndex);
			return (
				coord !== undefined &&
				coord >= axisValue.rangeMinValue &&
				coord <= axisValue.rangeMaxValue
			);
		}
		case 4: {
			return axisValue.axisValues.every((av) => {
				const coord = coords.get(av.axisIndex);
				return coord !== undefined && coord === av.value;
			});
		}
	}
}
