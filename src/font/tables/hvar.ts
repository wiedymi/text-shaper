import type { GlyphId, uint16, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * Horizontal Metrics Variations table (HVAR)
 * Provides variations for horizontal advance widths and LSB
 */
export interface HvarTable {
	majorVersion: number;
	minorVersion: number;
	itemVariationStore: ItemVariationStore;
	advanceWidthMapping: DeltaSetIndexMap | null;
	lsbMapping: DeltaSetIndexMap | null;
	rsbMapping: DeltaSetIndexMap | null;
}

/**
 * Item Variation Store - stores delta values for variations
 */
export interface ItemVariationStore {
	format: number;
	variationRegions: VariationRegion[];
	itemVariationData: ItemVariationData[];
}

/**
 * Variation region defines the space where deltas apply
 */
export interface VariationRegion {
	regionAxes: RegionAxisCoordinates[];
}

/**
 * Axis coordinates for a region
 */
export interface RegionAxisCoordinates {
	startCoord: number; // F2DOT14
	peakCoord: number;
	endCoord: number;
}

/**
 * Item variation data subtable
 */
export interface ItemVariationData {
	itemCount: uint16;
	regionIndexes: uint16[];
	deltaSets: number[][];
}

/**
 * Delta set index map for mapping glyphs to variation data
 */
export interface DeltaSetIndexMap {
	format: number;
	mapCount: uint32;
	entryFormat: number;
	innerIndexBitCount: number;
	mapData: { outer: number; inner: number }[];
}

/**
 * Parse HVAR table
 */
export function parseHvar(reader: Reader): HvarTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	const itemVariationStoreOffset = reader.offset32();
	const advanceWidthMappingOffset = reader.offset32();
	const lsbMappingOffset = reader.offset32();
	const rsbMappingOffset = reader.offset32();

	// Parse item variation store
	const itemVariationStore = parseItemVariationStore(reader.sliceFrom(itemVariationStoreOffset));

	// Parse mappings
	const advanceWidthMapping = advanceWidthMappingOffset !== 0
		? parseDeltaSetIndexMap(reader.sliceFrom(advanceWidthMappingOffset))
		: null;

	const lsbMapping = lsbMappingOffset !== 0
		? parseDeltaSetIndexMap(reader.sliceFrom(lsbMappingOffset))
		: null;

	const rsbMapping = rsbMappingOffset !== 0
		? parseDeltaSetIndexMap(reader.sliceFrom(rsbMappingOffset))
		: null;

	return {
		majorVersion,
		minorVersion,
		itemVariationStore,
		advanceWidthMapping,
		lsbMapping,
		rsbMapping,
	};
}

function parseItemVariationStore(reader: Reader): ItemVariationStore {
	const format = reader.uint16();
	const variationRegionListOffset = reader.offset32();
	const itemVariationDataCount = reader.uint16();

	const itemVariationDataOffsets: uint32[] = [];
	for (let i = 0; i < itemVariationDataCount; i++) {
		itemVariationDataOffsets.push(reader.offset32());
	}

	// Parse variation regions
	const regionReader = reader.sliceFrom(variationRegionListOffset);
	const axisCount = regionReader.uint16();
	const regionCount = regionReader.uint16();

	const variationRegions: VariationRegion[] = [];
	for (let i = 0; i < regionCount; i++) {
		const regionAxes: RegionAxisCoordinates[] = [];
		for (let j = 0; j < axisCount; j++) {
			regionAxes.push({
				startCoord: regionReader.f2dot14(),
				peakCoord: regionReader.f2dot14(),
				endCoord: regionReader.f2dot14(),
			});
		}
		variationRegions.push({ regionAxes });
	}

	// Parse item variation data
	const itemVariationData: ItemVariationData[] = [];
	for (const offset of itemVariationDataOffsets) {
		const dataReader = reader.sliceFrom(offset);
		const itemCount = dataReader.uint16();
		const wordDeltaCount = dataReader.uint16();
		const regionIndexCount = dataReader.uint16();

		const regionIndexes: uint16[] = [];
		for (let i = 0; i < regionIndexCount; i++) {
			regionIndexes.push(dataReader.uint16());
		}

		// Parse delta sets
		const longWords = (wordDeltaCount & 0x8000) !== 0;
		const wordCount = wordDeltaCount & 0x7fff;
		const shortCount = regionIndexCount - wordCount;

		const deltaSets: number[][] = [];
		for (let i = 0; i < itemCount; i++) {
			const deltas: number[] = [];
			// Read word-sized deltas
			for (let j = 0; j < wordCount; j++) {
				if (longWords) {
					deltas.push(dataReader.int32());
				} else {
					deltas.push(dataReader.int16());
				}
			}
			// Read short-sized deltas
			for (let j = 0; j < shortCount; j++) {
				if (longWords) {
					deltas.push(dataReader.int16());
				} else {
					deltas.push(dataReader.int8());
				}
			}
			deltaSets.push(deltas);
		}

		itemVariationData.push({ itemCount, regionIndexes, deltaSets });
	}

	return { format, variationRegions, itemVariationData };
}

function parseDeltaSetIndexMap(reader: Reader): DeltaSetIndexMap {
	const format = reader.uint8();
	const entryFormat = reader.uint8();
	const mapCount = format === 0 ? reader.uint16() : reader.uint32();

	const innerIndexBitCount = (entryFormat & 0x0f) + 1;
	const mapEntrySize = ((entryFormat >> 4) & 0x03) + 1;

	const mapData: { outer: number; inner: number }[] = [];
	for (let i = 0; i < mapCount; i++) {
		let entry = 0;
		for (let j = 0; j < mapEntrySize; j++) {
			entry = (entry << 8) | reader.uint8();
		}

		const inner = entry & ((1 << innerIndexBitCount) - 1);
		const outer = entry >> innerIndexBitCount;
		mapData.push({ outer, inner });
	}

	return { format, mapCount, entryFormat, innerIndexBitCount, mapData };
}

/**
 * Calculate scalar for a variation region given axis coordinates
 */
export function calculateRegionScalar(
	region: VariationRegion,
	coords: number[], // Normalized axis coordinates [-1, 1]
): number {
	let scalar = 1.0;

	for (let i = 0; i < region.regionAxes.length && i < coords.length; i++) {
		const axis = region.regionAxes[i]!;
		const coord = coords[i]!;

		// Outside the region
		if (coord < axis.startCoord || coord > axis.endCoord) {
			return 0;
		}

		// At peak
		if (coord === axis.peakCoord) {
			continue;
		}

		// Interpolate
		if (coord < axis.peakCoord) {
			if (axis.peakCoord === axis.startCoord) {
				continue;
			}
			scalar *= (coord - axis.startCoord) / (axis.peakCoord - axis.startCoord);
		} else {
			if (axis.peakCoord === axis.endCoord) {
				continue;
			}
			scalar *= (axis.endCoord - coord) / (axis.endCoord - axis.peakCoord);
		}
	}

	return scalar;
}

/**
 * Get delta for a glyph from HVAR using a specific mapping
 */
function getDeltaFromMapping(
	hvar: HvarTable,
	glyphId: GlyphId,
	coords: number[],
	mapping: DeltaSetIndexMap | null,
): number {
	// Get outer/inner index
	let outer: number;
	let inner: number;

	if (mapping && glyphId < mapping.mapData.length) {
		const entry = mapping.mapData[glyphId]!;
		outer = entry.outer;
		inner = entry.inner;
	} else {
		// Direct mapping: outer = 0, inner = glyphId
		outer = 0;
		inner = glyphId;
	}

	// Get variation data
	const varData = hvar.itemVariationStore.itemVariationData[outer];
	if (!varData || inner >= varData.itemCount) {
		return 0;
	}

	const deltaSet = varData.deltaSets[inner];
	if (!deltaSet) {
		return 0;
	}

	// Calculate total delta
	let delta = 0;
	for (let i = 0; i < varData.regionIndexes.length; i++) {
		const regionIndex = varData.regionIndexes[i]!;
		const region = hvar.itemVariationStore.variationRegions[regionIndex];
		if (!region) continue;

		const scalar = calculateRegionScalar(region, coords);
		const regionDelta = deltaSet[i] ?? 0;
		delta += scalar * regionDelta;
	}

	return Math.round(delta);
}

/**
 * Get advance width delta for a glyph at given variation coordinates
 */
export function getAdvanceWidthDelta(
	hvar: HvarTable,
	glyphId: GlyphId,
	coords: number[],
): number {
	return getDeltaFromMapping(hvar, glyphId, coords, hvar.advanceWidthMapping);
}

/**
 * Get left side bearing delta for a glyph at given variation coordinates
 */
export function getLsbDelta(
	hvar: HvarTable,
	glyphId: GlyphId,
	coords: number[],
): number {
	if (!hvar.lsbMapping) {
		return 0; // No LSB variations in this font
	}
	return getDeltaFromMapping(hvar, glyphId, coords, hvar.lsbMapping);
}

/**
 * Get right side bearing delta for a glyph at given variation coordinates
 */
export function getRsbDelta(
	hvar: HvarTable,
	glyphId: GlyphId,
	coords: number[],
): number {
	if (!hvar.rsbMapping) {
		return 0; // No RSB variations in this font
	}
	return getDeltaFromMapping(hvar, glyphId, coords, hvar.rsbMapping);
}
