import type { int16, uint16, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * Tracking table (trak)
 * Apple Advanced Typography tracking
 */
export interface TrakTable {
	version: number;
	format: uint16;
	horizData: TrackData | null;
	vertData: TrackData | null;
}

/**
 * Track data for one direction
 */
export interface TrackData {
	nTracks: uint16;
	nSizes: uint16;
	sizeTableOffset: uint32;
	trackTable: TrackTableEntry[];
	sizeTable: number[]; // Fixed point sizes
}

/**
 * Track table entry
 */
export interface TrackTableEntry {
	track: number; // Fixed 16.16
	nameIndex: uint16;
	offset: uint16;
	perSizeTracking: int16[];
}

/**
 * Parse trak table
 */
export function parseTrak(reader: Reader): TrakTable {
	const version = reader.uint32() / 65536; // Fixed 16.16
	const format = reader.uint16();
	const horizOffset = reader.offset16();
	const vertOffset = reader.offset16();
	reader.skip(2); // reserved

	let horizData: TrackData | null = null;
	let vertData: TrackData | null = null;

	if (horizOffset !== 0) {
		horizData = parseTrackData(reader.sliceFrom(horizOffset));
	}

	if (vertOffset !== 0) {
		vertData = parseTrackData(reader.sliceFrom(vertOffset));
	}

	return {
		version,
		format,
		horizData,
		vertData,
	};
}

function parseTrackData(reader: Reader): TrackData {
	const nTracks = reader.uint16();
	const nSizes = reader.uint16();
	const sizeTableOffset = reader.offset32();

	const trackTable: TrackTableEntry[] = [];

	// Read track entries
	for (let i = 0; i < nTracks; i++) {
		const track = reader.int32() / 65536; // Fixed 16.16
		const nameIndex = reader.uint16();
		const offset = reader.uint16();

		trackTable.push({
			track,
			nameIndex,
			offset,
			perSizeTracking: [],
		});
	}

	// Read per-size tracking values for each track
	for (const entry of trackTable) {
		const trackReader = reader.sliceFrom(entry.offset);
		entry.perSizeTracking = [];
		for (let i = 0; i < nSizes; i++) {
			entry.perSizeTracking.push(trackReader.int16());
		}
	}

	// Read size table
	const sizeReader = reader.sliceFrom(sizeTableOffset);
	const sizeTable: number[] = [];
	for (let i = 0; i < nSizes; i++) {
		sizeTable.push(sizeReader.int32() / 65536); // Fixed 16.16
	}

	return {
		nTracks,
		nSizes,
		sizeTableOffset,
		trackTable,
		sizeTable,
	};
}

/**
 * Get tracking value for a given track and point size
 */
export function getTrackingValue(
	trackData: TrackData,
	track: number,
	pointSize: number,
): number {
	// Find the track entry
	let trackEntry: TrackTableEntry | null = null;

	for (const entry of trackData.trackTable) {
		if (entry.track === track) {
			trackEntry = entry;
			break;
		}
	}

	// If exact track not found, interpolate between nearest
	if (!trackEntry) {
		let lower: TrackTableEntry | null = null;
		let upper: TrackTableEntry | null = null;

		for (const entry of trackData.trackTable) {
			if (entry.track <= track && (!lower || entry.track > lower.track)) {
				lower = entry;
			}
			if (entry.track >= track && (!upper || entry.track < upper.track)) {
				upper = entry;
			}
		}

		if (lower && upper && lower !== upper) {
			// Interpolate between tracks
			const t = (track - lower.track) / (upper.track - lower.track);
			const lowerValue = getSizeValue(trackData, lower, pointSize);
			const upperValue = getSizeValue(trackData, upper, pointSize);
			return Math.round(lowerValue + t * (upperValue - lowerValue));
		} else if (lower) {
			trackEntry = lower;
		} else if (upper) {
			trackEntry = upper;
		} else {
			return 0;
		}
	}

	if (!trackEntry) return 0;

	return getSizeValue(trackData, trackEntry, pointSize);
}

function getSizeValue(
	trackData: TrackData,
	entry: TrackTableEntry,
	pointSize: number,
): number {
	const sizes = trackData.sizeTable;
	const values = entry.perSizeTracking;

	if (sizes.length === 0 || values.length === 0) return 0;

	const firstSize = sizes[0];
	const firstValue = values[0];
	if (firstSize === undefined || firstValue === undefined) return 0;

	// Find size range
	if (pointSize <= firstSize) {
		return firstValue;
	}

	const lastSize = sizes[sizes.length - 1];
	const lastValue = values[values.length - 1];
	if (lastSize === undefined || lastValue === undefined) return 0;

	if (pointSize >= lastSize) {
		return lastValue;
	}

	// Interpolate
	for (let i = 0; i < sizes.length - 1; i++) {
		const size1 = sizes[i];
		const size2 = sizes[i + 1];
		const value1 = values[i];
		const value2 = values[i + 1];
		if (
			size1 === undefined ||
			size2 === undefined ||
			value1 === undefined ||
			value2 === undefined
		)
			continue;

		if (pointSize >= size1 && pointSize <= size2) {
			const t = (pointSize - size1) / (size2 - size1);
			return Math.round(value1 + t * (value2 - value1));
		}
	}

	return 0;
}

/**
 * Apply tracking to advance widths
 */
export function applyTracking(
	trak: TrakTable,
	advances: number[],
	pointSize: number,
	track: number = 0,
	vertical: boolean = false,
): void {
	const trackData = vertical ? trak.vertData : trak.horizData;
	if (!trackData) return;

	const trackingValue = getTrackingValue(trackData, track, pointSize);
	if (trackingValue === 0) return;

	// Add tracking to each advance
	for (const [i, advance] of advances.entries()) {
		advances[i] = (advance ?? 0) + trackingValue;
	}
}
