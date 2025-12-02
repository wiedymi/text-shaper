import type { Fixed, Tag } from "../../types.ts";
import { tagToString } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * Font Variations table (fvar)
 * Defines axes of variation in a variable font
 */
export interface FvarTable {
	majorVersion: number;
	minorVersion: number;
	axes: VariationAxis[];
	instances: NamedInstance[];
}

/**
 * Variation axis definition
 */
export interface VariationAxis {
	/** 4-byte axis tag (e.g., 'wght', 'wdth', 'ital') */
	tag: Tag;
	/** Minimum coordinate value */
	minValue: Fixed;
	/** Default coordinate value */
	defaultValue: Fixed;
	/** Maximum coordinate value */
	maxValue: Fixed;
	/** Axis qualifiers (flags) */
	flags: number;
	/** Name ID for this axis */
	axisNameId: number;
}

/**
 * Named instance (predefined variation)
 */
export interface NamedInstance {
	/** Name ID for this instance */
	subfamilyNameId: number;
	/** Flags */
	flags: number;
	/** Coordinate values for each axis */
	coordinates: Fixed[];
	/** PostScript name ID (optional) */
	postScriptNameId?: number;
}

/**
 * Common axis tags
 */
export const AxisTags = {
	/** Weight (100-900, default 400) */
	wght: 0x77676874,
	/** Width (50-200%, default 100) */
	wdth: 0x77647468,
	/** Italic (0-1) */
	ital: 0x6974616c,
	/** Slant (-90 to 90 degrees) */
	slnt: 0x736c6e74,
	/** Optical size (in points) */
	opsz: 0x6f70737a,
} as const;

/**
 * Parse fvar table
 */
export function parseFvar(reader: Reader): FvarTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	const axesArrayOffset = reader.offset16();
	reader.skip(2); // reserved
	const axisCount = reader.uint16();
	const axisSize = reader.uint16();
	const instanceCount = reader.uint16();
	const instanceSize = reader.uint16();

	// Parse axes
	const axes: VariationAxis[] = [];
	reader.seek(axesArrayOffset);

	for (let i = 0; i < axisCount; i++) {
		const axisStart = reader.offset;
		const tag = reader.uint32();
		const minValue = reader.fixed();
		const defaultValue = reader.fixed();
		const maxValue = reader.fixed();
		const flags = reader.uint16();
		const axisNameId = reader.uint16();

		axes.push({
			tag,
			minValue,
			defaultValue,
			maxValue,
			flags,
			axisNameId,
		});

		// Move to next axis (in case axisSize is larger than expected)
		reader.seek(axisStart + axisSize);
	}

	// Parse instances
	const instances: NamedInstance[] = [];
	const hasPostScriptNameId = instanceSize >= 4 + axisCount * 4 + 2;

	for (let i = 0; i < instanceCount; i++) {
		const instanceStart = reader.offset;
		const subfamilyNameId = reader.uint16();
		const flags = reader.uint16();

		const coordinates: Fixed[] = [];
		for (let j = 0; j < axisCount; j++) {
			coordinates.push(reader.fixed());
		}

		const instance: NamedInstance = {
			subfamilyNameId,
			flags,
			coordinates,
		};

		if (hasPostScriptNameId) {
			instance.postScriptNameId = reader.uint16();
		}

		instances.push(instance);

		// Move to next instance
		reader.seek(instanceStart + instanceSize);
	}

	return {
		majorVersion,
		minorVersion,
		axes,
		instances,
	};
}

/**
 * Normalize axis value to range [-1, 1]
 */
export function normalizeAxisValue(axis: VariationAxis, value: number): number {
	if (value < axis.defaultValue) {
		if (value < axis.minValue) value = axis.minValue;
		if (axis.defaultValue === axis.minValue) return 0;
		return (value - axis.defaultValue) / (axis.defaultValue - axis.minValue);
	} else if (value > axis.defaultValue) {
		if (value > axis.maxValue) value = axis.maxValue;
		if (axis.defaultValue === axis.maxValue) return 0;
		return (value - axis.defaultValue) / (axis.maxValue - axis.defaultValue);
	}
	return 0;
}

/**
 * Get axis by tag
 */
export function getAxis(fvar: FvarTable, axisTag: Tag): VariationAxis | null {
	return fvar.axes.find((a) => a.tag === axisTag) ?? null;
}

/**
 * Get axis index by tag
 */
export function getAxisIndex(fvar: FvarTable, axisTag: Tag): number {
	return fvar.axes.findIndex((a) => a.tag === axisTag);
}

/**
 * Debug: Print axis info
 */
export function formatAxis(axis: VariationAxis): string {
	return `${tagToString(axis.tag)}: ${axis.minValue.toFixed(1)}..${axis.defaultValue.toFixed(1)}..${axis.maxValue.toFixed(1)}`;
}
