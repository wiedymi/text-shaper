import type { uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * Axis Variations table (avar)
 * Maps user-facing axis values to normalized coordinates
 */
export interface AvarTable {
	majorVersion: uint16;
	minorVersion: uint16;
	axisSegmentMaps: AxisSegmentMap[];
}

/**
 * Segment map for an axis
 */
export interface AxisSegmentMap {
	axisValueMaps: AxisValueMap[];
}

/**
 * Single value mapping
 */
export interface AxisValueMap {
	fromCoordinate: number; // F2DOT14
	toCoordinate: number; // F2DOT14
}

/**
 * Parse avar table
 */
export function parseAvar(reader: Reader, axisCount: number): AvarTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	reader.skip(2); // reserved
	const tableAxisCount = reader.uint16();

	const axisSegmentMaps: AxisSegmentMap[] = [];
	const mapCount = Math.min(axisCount, tableAxisCount);
	for (let i = 0; i < mapCount; i++) {
		const positionMapCount = reader.uint16();
		const axisValueMaps: AxisValueMap[] = [];

		for (let j = 0; j < positionMapCount; j++) {
			axisValueMaps.push({
				fromCoordinate: reader.f2dot14(),
				toCoordinate: reader.f2dot14(),
			});
		}

		axisSegmentMaps.push({ axisValueMaps });
	}

	return {
		majorVersion,
		minorVersion,
		axisSegmentMaps,
	};
}

/**
 * Apply avar mapping to a normalized coordinate
 */
export function applyAvarMapping(
	segmentMap: AxisSegmentMap,
	coord: number,
): number {
	const maps = segmentMap.axisValueMaps;

	if (maps.length === 0) return coord;
	if (maps.length < 3) return coord;

	const validMaps: AxisValueMap[] = [];
	for (let i = 0; i < maps.length; i++) {
		const map = maps[i]!;
		const prev = validMaps[validMaps.length - 1];
		if (
			!prev ||
			(map.fromCoordinate > prev.fromCoordinate &&
				map.toCoordinate >= prev.toCoordinate)
		) {
			validMaps.push(map);
		}
	}

	const hasRequiredExtrema =
		validMaps.some(
			(map) => map.fromCoordinate === -1 && map.toCoordinate === -1,
		) &&
		validMaps.some((map) => map.fromCoordinate === 0 && map.toCoordinate === 0) &&
		validMaps.some((map) => map.fromCoordinate === 1 && map.toCoordinate === 1);
	if (!hasRequiredExtrema) {
		return coord;
	}

	// Find the segment containing coord
	for (let i = 0; i < validMaps.length - 1; i++) {
		const map1 = validMaps[i];
		const map2 = validMaps[i + 1];
		if (!map1 || !map2) continue;

		if (coord >= map1.fromCoordinate && coord <= map2.fromCoordinate) {
			// Linear interpolation
			const t =
				(coord - map1.fromCoordinate) /
				(map2.fromCoordinate - map1.fromCoordinate);
			return map1.toCoordinate + t * (map2.toCoordinate - map1.toCoordinate);
		}
	}

	// Clamp to range
	const firstMap = validMaps[0];
	const lastMap = validMaps[validMaps.length - 1];
	if (firstMap && coord <= firstMap.fromCoordinate) {
		return firstMap.toCoordinate;
	}
	return lastMap?.toCoordinate ?? coord;
}

/**
 * Apply avar mappings to all axis coordinates
 */
export function applyAvar(avar: AvarTable, coords: number[]): number[] {
	const result: number[] = [];

	for (let i = 0; i < coords.length; i++) {
		const coord = coords[i]!;
		const segmentMap = avar.axisSegmentMaps[i];
		if (segmentMap) {
			result.push(applyAvarMapping(segmentMap, coord));
		} else {
			result.push(coord);
		}
	}

	return result;
}
