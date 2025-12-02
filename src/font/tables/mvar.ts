import type { Tag, uint16, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";
import {
	type ItemVariationStore,
	type VariationRegion,
	calculateRegionScalar,
} from "./hvar.ts";
import { tag } from "../../types.ts";

/**
 * Metrics Variations table (MVAR)
 * Provides variations for global font metrics
 */
export interface MvarTable {
	majorVersion: number;
	minorVersion: number;
	itemVariationStore: ItemVariationStore;
	valueRecords: MvarValueRecord[];
}

export interface MvarValueRecord {
	valueTag: Tag;
	deltaSetOuterIndex: number;
	deltaSetInnerIndex: number;
}

/**
 * Common MVAR value tags
 */
export const MvarTags = {
	// Horizontal metrics
	hasc: tag("hasc"), // horizontal ascender
	hdsc: tag("hdsc"), // horizontal descender
	hlgp: tag("hlgp"), // horizontal line gap
	hcla: tag("hcla"), // horizontal clipping ascent
	hcld: tag("hcld"), // horizontal clipping descent
	hcof: tag("hcof"), // horizontal caret offset
	hcrn: tag("hcrn"), // horizontal caret run
	hcrs: tag("hcrs"), // horizontal caret rise

	// Vertical metrics
	vasc: tag("vasc"), // vertical ascender
	vdsc: tag("vdsc"), // vertical descender
	vlgp: tag("vlgp"), // vertical line gap
	vcof: tag("vcof"), // vertical caret offset
	vcrn: tag("vcrn"), // vertical caret run
	vcrs: tag("vcrs"), // vertical caret rise

	// OS/2 table values
	xhgt: tag("xhgt"), // x height
	cpht: tag("cpht"), // cap height
	sbxs: tag("sbxs"), // subscript x size
	sbys: tag("sbys"), // subscript y size
	sbxo: tag("sbxo"), // subscript x offset
	sbyo: tag("sbyo"), // subscript y offset
	spxs: tag("spxs"), // superscript x size
	spys: tag("spys"), // superscript y size
	spxo: tag("spxo"), // superscript x offset
	spyo: tag("spyo"), // superscript y offset
	strs: tag("strs"), // strikeout size
	stro: tag("stro"), // strikeout offset
	undo: tag("undo"), // underline offset
	unds: tag("unds"), // underline size

	// Glyph bounds
	gsp0: tag("gsp0"), // glyph bounding box x min
	gsp1: tag("gsp1"), // glyph bounding box y min
	gsp2: tag("gsp2"), // glyph bounding box x max
	gsp3: tag("gsp3"), // glyph bounding box y max
} as const;

/**
 * Parse MVAR table
 */
export function parseMvar(reader: Reader): MvarTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	reader.uint16(); // reserved
	const valueRecordSize = reader.uint16();
	const valueRecordCount = reader.uint16();
	const itemVariationStoreOffset = reader.offset16();

	// Parse value records
	const valueRecords: MvarValueRecord[] = [];
	for (let i = 0; i < valueRecordCount; i++) {
		valueRecords.push({
			valueTag: reader.tag(),
			deltaSetOuterIndex: reader.uint16(),
			deltaSetInnerIndex: reader.uint16(),
		});
		// Skip any additional bytes if valueRecordSize > 8
		if (valueRecordSize > 8) {
			reader.skip(valueRecordSize - 8);
		}
	}

	// Parse item variation store
	const itemVariationStore = parseItemVariationStore(reader.sliceFrom(itemVariationStoreOffset));

	return {
		majorVersion,
		minorVersion,
		itemVariationStore,
		valueRecords,
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
		const regionAxes: { startCoord: number; peakCoord: number; endCoord: number }[] = [];
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
	const itemVariationData: { itemCount: uint16; regionIndexes: uint16[]; deltaSets: number[][] }[] = [];
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

/**
 * Get metric delta by tag
 */
export function getMetricDelta(
	mvar: MvarTable,
	valueTag: Tag,
	coords: number[],
): number {
	// Find value record for this tag
	const record = mvar.valueRecords.find(r => r.valueTag === valueTag);
	if (!record) return 0;

	const outer = record.deltaSetOuterIndex;
	const inner = record.deltaSetInnerIndex;

	const varData = mvar.itemVariationStore.itemVariationData[outer];
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
		const region = mvar.itemVariationStore.variationRegions[regionIndex];
		if (!region) continue;

		const scalar = calculateRegionScalar(region, coords);
		const regionDelta = deltaSet[i] ?? 0;
		delta += scalar * regionDelta;
	}

	return Math.round(delta);
}

/**
 * Get horizontal ascender delta
 */
export function getHAscenderDelta(mvar: MvarTable, coords: number[]): number {
	return getMetricDelta(mvar, MvarTags.hasc, coords);
}

/**
 * Get horizontal descender delta
 */
export function getHDescenderDelta(mvar: MvarTable, coords: number[]): number {
	return getMetricDelta(mvar, MvarTags.hdsc, coords);
}

/**
 * Get horizontal line gap delta
 */
export function getHLineGapDelta(mvar: MvarTable, coords: number[]): number {
	return getMetricDelta(mvar, MvarTags.hlgp, coords);
}

/**
 * Get x-height delta
 */
export function getXHeightDelta(mvar: MvarTable, coords: number[]): number {
	return getMetricDelta(mvar, MvarTags.xhgt, coords);
}

/**
 * Get cap height delta
 */
export function getCapHeightDelta(mvar: MvarTable, coords: number[]): number {
	return getMetricDelta(mvar, MvarTags.cpht, coords);
}

/**
 * Get underline offset delta
 */
export function getUnderlineOffsetDelta(mvar: MvarTable, coords: number[]): number {
	return getMetricDelta(mvar, MvarTags.undo, coords);
}

/**
 * Get underline size delta
 */
export function getUnderlineSizeDelta(mvar: MvarTable, coords: number[]): number {
	return getMetricDelta(mvar, MvarTags.unds, coords);
}

/**
 * Get strikeout offset delta
 */
export function getStrikeoutOffsetDelta(mvar: MvarTable, coords: number[]): number {
	return getMetricDelta(mvar, MvarTags.stro, coords);
}

/**
 * Get strikeout size delta
 */
export function getStrikeoutSizeDelta(mvar: MvarTable, coords: number[]): number {
	return getMetricDelta(mvar, MvarTags.strs, coords);
}
