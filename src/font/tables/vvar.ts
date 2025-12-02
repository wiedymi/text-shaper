import type { GlyphId, uint16, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";
import {
	calculateRegionScalar,
	type DeltaSetIndexMap,
	type ItemVariationStore,
	type VariationRegion,
} from "./hvar.ts";

/**
 * Vertical Metrics Variations table (VVAR)
 * Provides variations for vertical advance heights and side bearings
 */
export interface VvarTable {
	majorVersion: number;
	minorVersion: number;
	itemVariationStore: ItemVariationStore;
	advanceHeightMapping: DeltaSetIndexMap | null;
	tsbMapping: DeltaSetIndexMap | null; // Top side bearing
	bsbMapping: DeltaSetIndexMap | null; // Bottom side bearing
	vOrgMapping: DeltaSetIndexMap | null; // Vertical origin
}

/**
 * Parse VVAR table
 */
export function parseVvar(reader: Reader): VvarTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	const itemVariationStoreOffset = reader.offset32();
	const advanceHeightMappingOffset = reader.offset32();
	const tsbMappingOffset = reader.offset32();
	const bsbMappingOffset = reader.offset32();
	const vOrgMappingOffset = reader.offset32();

	// Parse item variation store
	const itemVariationStore = parseItemVariationStore(
		reader.sliceFrom(itemVariationStoreOffset),
	);

	// Parse mappings
	const advanceHeightMapping =
		advanceHeightMappingOffset !== 0
			? parseDeltaSetIndexMap(reader.sliceFrom(advanceHeightMappingOffset))
			: null;

	const tsbMapping =
		tsbMappingOffset !== 0
			? parseDeltaSetIndexMap(reader.sliceFrom(tsbMappingOffset))
			: null;

	const bsbMapping =
		bsbMappingOffset !== 0
			? parseDeltaSetIndexMap(reader.sliceFrom(bsbMappingOffset))
			: null;

	const vOrgMapping =
		vOrgMappingOffset !== 0
			? parseDeltaSetIndexMap(reader.sliceFrom(vOrgMappingOffset))
			: null;

	return {
		majorVersion,
		minorVersion,
		itemVariationStore,
		advanceHeightMapping,
		tsbMapping,
		bsbMapping,
		vOrgMapping,
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
		const regionAxes: {
			startCoord: number;
			peakCoord: number;
			endCoord: number;
		}[] = [];
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
	const itemVariationData: {
		itemCount: uint16;
		regionIndexes: uint16[];
		deltaSets: number[][];
	}[] = [];
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
 * Get advance height delta for a glyph at given variation coordinates
 */
export function getAdvanceHeightDelta(
	vvar: VvarTable,
	glyphId: GlyphId,
	coords: number[],
): number {
	const mapping = vvar.advanceHeightMapping;

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

	return calculateDelta(vvar.itemVariationStore, outer, inner, coords);
}

/**
 * Get top side bearing delta for a glyph at given variation coordinates
 */
export function getTsbDelta(
	vvar: VvarTable,
	glyphId: GlyphId,
	coords: number[],
): number {
	const mapping = vvar.tsbMapping;
	if (!mapping) return 0;

	if (glyphId >= mapping.mapData.length) return 0;

	const entry = mapping.mapData[glyphId]!;
	return calculateDelta(
		vvar.itemVariationStore,
		entry.outer,
		entry.inner,
		coords,
	);
}

/**
 * Get bottom side bearing delta for a glyph at given variation coordinates
 */
export function getBsbDelta(
	vvar: VvarTable,
	glyphId: GlyphId,
	coords: number[],
): number {
	const mapping = vvar.bsbMapping;
	if (!mapping) return 0;

	if (glyphId >= mapping.mapData.length) return 0;

	const entry = mapping.mapData[glyphId]!;
	return calculateDelta(
		vvar.itemVariationStore,
		entry.outer,
		entry.inner,
		coords,
	);
}

/**
 * Get vertical origin delta for a glyph at given variation coordinates
 */
export function getVorgDelta(
	vvar: VvarTable,
	glyphId: GlyphId,
	coords: number[],
): number {
	const mapping = vvar.vOrgMapping;
	if (!mapping) return 0;

	if (glyphId >= mapping.mapData.length) return 0;

	const entry = mapping.mapData[glyphId]!;
	return calculateDelta(
		vvar.itemVariationStore,
		entry.outer,
		entry.inner,
		coords,
	);
}

/**
 * Calculate delta from variation store
 */
function calculateDelta(
	store: ItemVariationStore,
	outer: number,
	inner: number,
	coords: number[],
): number {
	const varData = store.itemVariationData[outer];
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
		const region = store.variationRegions[regionIndex];
		if (!region) continue;

		const scalar = calculateRegionScalar(region, coords);
		const regionDelta = deltaSet[i] ?? 0;
		delta += scalar * regionDelta;
	}

	return Math.round(delta);
}
