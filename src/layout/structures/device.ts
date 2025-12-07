import type { Reader } from "../../font/binary/reader.ts";
import type { int16, uint16 } from "../../types.ts";

/**
 * Device table - pixel-level adjustments for different PPEM sizes
 * Used in GPOS for fine-tuning positioning at specific sizes
 */

export interface DeviceTable {
	startSize: uint16;
	endSize: uint16;
	deltaFormat: uint16;
	/** Delta values indexed by (ppem - startSize) */
	deltaValues: int16[];
}

/** VariationIndex table for variable fonts (shares format with Device) */
export interface VariationIndexTable {
	deltaSetOuterIndex: uint16;
	deltaSetInnerIndex: uint16;
}

/** Combined type - can be either Device or VariationIndex */
export type DeviceOrVariationIndex = DeviceTable | VariationIndexTable;

/**
 * Check if this is a VariationIndex table
 * @param table - The device or variation index table to check
 * @returns True if the table is a VariationIndex table, false if it's a Device table
 */
export function isVariationIndexTable(
	table: DeviceOrVariationIndex,
): table is VariationIndexTable {
	return "deltaSetOuterIndex" in table;
}

/**
 * Parse Device or VariationIndex table at offset
 * @param reader - Binary reader positioned at the parent table
 * @param offset - Offset from reader's current position to the device table
 * @returns Parsed device or variation index table, or null if offset is 0
 */
export function parseDeviceAt(
	reader: Reader,
	offset: number,
): DeviceOrVariationIndex | null {
	if (offset === 0) return null;
	return parseDevice(reader.sliceFrom(offset));
}

/**
 * Parse Device or VariationIndex table
 * @param reader - Binary reader positioned at the device table start
 * @returns Parsed device or variation index table
 */
export function parseDevice(reader: Reader): DeviceOrVariationIndex {
	const startSize = reader.uint16();
	const endSize = reader.uint16();
	const deltaFormat = reader.uint16();

	// Format 0x8000 indicates VariationIndex table
	if (deltaFormat === 0x8000) {
		return {
			deltaSetOuterIndex: startSize,
			deltaSetInnerIndex: endSize,
		};
	}

	const deltaValues: int16[] = [];

	if (deltaFormat >= 1 && deltaFormat <= 3) {
		const count = endSize - startSize + 1;
		const bitsPerValue = 1 << deltaFormat; // 2, 4, or 8 bits
		const valuesPerWord = 16 / bitsPerValue;
		const mask = (1 << bitsPerValue) - 1;
		const signBit = 1 << (bitsPerValue - 1);

		const wordCount = Math.ceil(count / valuesPerWord);
		let valueIndex = 0;

		for (let w = 0; w < wordCount; w++) {
			const word = reader.uint16();

			for (
				let v = 0;
				v < valuesPerWord && valueIndex < count;
				v++, valueIndex++
			) {
				const shift = 16 - bitsPerValue * (v + 1);
				let delta = (word >> shift) & mask;

				// Sign extend
				if (delta & signBit) {
					delta = delta - (1 << bitsPerValue);
				}

				deltaValues.push(delta);
			}
		}
	}

	return {
		startSize,
		endSize,
		deltaFormat,
		deltaValues,
	};
}

/**
 * Get delta adjustment for a specific PPEM size
 * @param device - The device table to query
 * @param ppem - Pixels per em size to get delta for
 * @returns Delta adjustment value, or 0 if PPEM is outside the table's range
 */
export function getDeviceDelta(device: DeviceTable, ppem: number): int16 {
	if (ppem < device.startSize || ppem > device.endSize) {
		return 0;
	}
	const index = ppem - device.startSize;
	return device.deltaValues[index] ?? 0;
}

/**
 * Apply Device table adjustment to a value
 * @param device - The device or variation index table, or null
 * @param value - The base value to adjust
 * @param ppem - Pixels per em size for device table lookup
 * @returns Adjusted value (for Device tables) or unchanged value (for VariationIndex tables or null)
 */
export function applyDeviceAdjustment(
	device: DeviceOrVariationIndex | null,
	value: number,
	ppem: number,
): number {
	if (!device) return value;

	if (isVariationIndexTable(device)) {
		// VariationIndex tables need ItemVariationStore to resolve
		// For now, return value unchanged (proper support requires fvar integration)
		return value;
	}

	return value + getDeviceDelta(device, ppem);
}

/**
 * Parsed value record with resolved Device tables
 */
export interface ResolvedValueRecord {
	xPlacement: number;
	yPlacement: number;
	xAdvance: number;
	yAdvance: number;
	xPlaDevice: DeviceOrVariationIndex | null;
	yPlaDevice: DeviceOrVariationIndex | null;
	xAdvDevice: DeviceOrVariationIndex | null;
	yAdvDevice: DeviceOrVariationIndex | null;
}

/**
 * Apply all Device adjustments to a resolved value record
 * @param record - The value record containing placement and advance values with device tables
 * @param ppem - Pixels per em size for device table lookups
 * @returns Object containing adjusted xPlacement, yPlacement, xAdvance, and yAdvance values
 */
export function applyDeviceAdjustments(
	record: ResolvedValueRecord,
	ppem: number,
): {
	xPlacement: number;
	yPlacement: number;
	xAdvance: number;
	yAdvance: number;
} {
	return {
		xPlacement: applyDeviceAdjustment(
			record.xPlaDevice,
			record.xPlacement,
			ppem,
		),
		yPlacement: applyDeviceAdjustment(
			record.yPlaDevice,
			record.yPlacement,
			ppem,
		),
		xAdvance: applyDeviceAdjustment(record.xAdvDevice, record.xAdvance, ppem),
		yAdvance: applyDeviceAdjustment(record.yAdvDevice, record.yAdvance, ppem),
	};
}
