import {
	type Coverage,
	parseCoverageAt,
} from "../../layout/structures/coverage.ts";
import type { int16, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";
import type { GposLookup } from "./gpos.ts";

/** Anchor point for attachment */
export interface Anchor {
	xCoordinate: int16;
	yCoordinate: int16;
	/** Contour point index (format 2) */
	anchorPoint?: uint16;
	/** Device table offsets (format 3) */
	xDeviceOffset?: uint16;
	yDeviceOffset?: uint16;
}

/** Mark record */
export interface MarkRecord {
	markClass: uint16;
	markAnchor: Anchor;
}

/** Mark array */
export interface MarkArray {
	markRecords: MarkRecord[];
}

/** Base record for mark-to-base */
export interface BaseRecord {
	baseAnchors: (Anchor | null)[]; // One per mark class
}

/** Ligature attach record */
export interface LigatureAttach {
	componentRecords: ComponentRecord[];
}

/** Component record for ligature */
export interface ComponentRecord {
	ligatureAnchors: (Anchor | null)[]; // One per mark class
}

/** Mark2 record for mark-to-mark */
export interface Mark2Record {
	mark2Anchors: (Anchor | null)[]; // One per mark1 class
}

/** Cursive attachment lookup (Type 3) */
export interface CursivePosLookup extends GposLookup {
	type: 3;
	subtables: CursivePosSubtable[];
}

export interface CursivePosSubtable {
	coverage: Coverage;
	entryExitRecords: EntryExitRecord[];
}

export interface EntryExitRecord {
	entryAnchor: Anchor | null;
	exitAnchor: Anchor | null;
}

/** Mark-to-base attachment lookup (Type 4) */
export interface MarkBasePosLookup extends GposLookup {
	type: 4;
	subtables: MarkBasePosSubtable[];
}

export interface MarkBasePosSubtable {
	markCoverage: Coverage;
	baseCoverage: Coverage;
	markClassCount: uint16;
	markArray: MarkArray;
	baseArray: BaseRecord[];
}

/** Mark-to-ligature attachment lookup (Type 5) */
export interface MarkLigaturePosLookup extends GposLookup {
	type: 5;
	subtables: MarkLigaturePosSubtable[];
}

export interface MarkLigaturePosSubtable {
	markCoverage: Coverage;
	ligatureCoverage: Coverage;
	markClassCount: uint16;
	markArray: MarkArray;
	ligatureArray: LigatureAttach[];
}

/** Mark-to-mark attachment lookup (Type 6) */
export interface MarkMarkPosLookup extends GposLookup {
	type: 6;
	subtables: MarkMarkPosSubtable[];
}

export interface MarkMarkPosSubtable {
	mark1Coverage: Coverage;
	mark2Coverage: Coverage;
	markClassCount: uint16;
	mark1Array: MarkArray;
	mark2Array: Mark2Record[];
}

// Parsing functions

export function parseAnchor(reader: Reader): Anchor {
	const format = reader.uint16();
	const xCoordinate = reader.int16();
	const yCoordinate = reader.int16();

	const anchor: Anchor = { xCoordinate, yCoordinate };

	if (format === 2) {
		anchor.anchorPoint = reader.uint16();
	} else if (format === 3) {
		anchor.xDeviceOffset = reader.uint16();
		anchor.yDeviceOffset = reader.uint16();
	}

	return anchor;
}

export function parseAnchorAt(reader: Reader, offset: number): Anchor | null {
	if (offset === 0) return null;
	return parseAnchor(reader.sliceFrom(offset));
}

export function parseMarkArray(reader: Reader): MarkArray {
	const markCount = reader.uint16();
	const markRecords: MarkRecord[] = [];

	const recordData: Array<{ markClass: uint16; anchorOffset: uint16 }> = [];
	for (let i = 0; i < markCount; i++) {
		recordData.push({
			markClass: reader.uint16(),
			anchorOffset: reader.uint16(),
		});
	}

	for (const data of recordData) {
		const markAnchor = parseAnchor(reader.sliceFrom(data.anchorOffset));
		markRecords.push({
			markClass: data.markClass,
			markAnchor,
		});
	}

	return { markRecords };
}

export function parseCursivePos(
	reader: Reader,
	subtableOffsets: number[],
): CursivePosSubtable[] {
	const subtables: CursivePosSubtable[] = [];

	for (const offset of subtableOffsets) {
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			const coverageOffset = r.offset16();
			const entryExitCount = r.uint16();

			const entryExitData: Array<{ entryOffset: uint16; exitOffset: uint16 }> =
				[];
			for (let i = 0; i < entryExitCount; i++) {
				entryExitData.push({
					entryOffset: r.uint16(),
					exitOffset: r.uint16(),
				});
			}

			const coverage = parseCoverageAt(r, coverageOffset);
			const entryExitRecords: EntryExitRecord[] = [];

			for (const data of entryExitData) {
				entryExitRecords.push({
					entryAnchor: parseAnchorAt(r, data.entryOffset),
					exitAnchor: parseAnchorAt(r, data.exitOffset),
				});
			}

			subtables.push({ coverage, entryExitRecords });
		}
	}

	return subtables;
}

export function parseMarkBasePos(
	reader: Reader,
	subtableOffsets: number[],
): MarkBasePosSubtable[] {
	const subtables: MarkBasePosSubtable[] = [];

	for (const offset of subtableOffsets) {
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			const markCoverageOffset = r.offset16();
			const baseCoverageOffset = r.offset16();
			const markClassCount = r.uint16();
			const markArrayOffset = r.offset16();
			const baseArrayOffset = r.offset16();

			const markCoverage = parseCoverageAt(r, markCoverageOffset);
			const baseCoverage = parseCoverageAt(r, baseCoverageOffset);
			const markArray = parseMarkArray(r.sliceFrom(markArrayOffset));

			// Parse base array
			const baseArrayReader = r.sliceFrom(baseArrayOffset);
			const baseCount = baseArrayReader.uint16();
			const baseArray: BaseRecord[] = [];

			// Read anchor offsets first
			const baseRecordData: Array<uint16[]> = [];
			for (let i = 0; i < baseCount; i++) {
				const anchorOffsets: uint16[] = [];
				for (let j = 0; j < markClassCount; j++) {
					anchorOffsets.push(baseArrayReader.uint16());
				}
				baseRecordData.push(anchorOffsets);
			}

			// Parse anchors
			for (const anchorOffsets of baseRecordData) {
				const baseAnchors: (Anchor | null)[] = [];
				for (const anchorOffset of anchorOffsets) {
					baseAnchors.push(parseAnchorAt(baseArrayReader, anchorOffset));
				}
				baseArray.push({ baseAnchors });
			}

			subtables.push({
				markCoverage,
				baseCoverage,
				markClassCount,
				markArray,
				baseArray,
			});
		}
	}

	return subtables;
}

export function parseMarkLigaturePos(
	reader: Reader,
	subtableOffsets: number[],
): MarkLigaturePosSubtable[] {
	const subtables: MarkLigaturePosSubtable[] = [];

	for (const offset of subtableOffsets) {
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			const markCoverageOffset = r.offset16();
			const ligatureCoverageOffset = r.offset16();
			const markClassCount = r.uint16();
			const markArrayOffset = r.offset16();
			const ligatureArrayOffset = r.offset16();

			const markCoverage = parseCoverageAt(r, markCoverageOffset);
			const ligatureCoverage = parseCoverageAt(r, ligatureCoverageOffset);
			const markArray = parseMarkArray(r.sliceFrom(markArrayOffset));

			// Parse ligature array
			const ligArrayReader = r.sliceFrom(ligatureArrayOffset);
			const ligatureCount = ligArrayReader.uint16();
			const ligatureAttachOffsets = ligArrayReader.uint16Array(ligatureCount);

			const ligatureArray: LigatureAttach[] = [];
			for (const ligAttachOffset of ligatureAttachOffsets) {
				const ligAttachReader = ligArrayReader.sliceFrom(ligAttachOffset);
				const componentCount = ligAttachReader.uint16();

				const componentRecords: ComponentRecord[] = [];
				// Read all anchor offsets first
				const componentData: Array<uint16[]> = [];
				for (let i = 0; i < componentCount; i++) {
					const anchorOffsets: uint16[] = [];
					for (let j = 0; j < markClassCount; j++) {
						anchorOffsets.push(ligAttachReader.uint16());
					}
					componentData.push(anchorOffsets);
				}

				// Parse anchors
				for (const anchorOffsets of componentData) {
					const ligatureAnchors: (Anchor | null)[] = [];
					for (const anchorOffset of anchorOffsets) {
						ligatureAnchors.push(parseAnchorAt(ligAttachReader, anchorOffset));
					}
					componentRecords.push({ ligatureAnchors });
				}

				ligatureArray.push({ componentRecords });
			}

			subtables.push({
				markCoverage,
				ligatureCoverage,
				markClassCount,
				markArray,
				ligatureArray,
			});
		}
	}

	return subtables;
}

export function parseMarkMarkPos(
	reader: Reader,
	subtableOffsets: number[],
): MarkMarkPosSubtable[] {
	const subtables: MarkMarkPosSubtable[] = [];

	for (const offset of subtableOffsets) {
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			const mark1CoverageOffset = r.offset16();
			const mark2CoverageOffset = r.offset16();
			const markClassCount = r.uint16();
			const mark1ArrayOffset = r.offset16();
			const mark2ArrayOffset = r.offset16();

			const mark1Coverage = parseCoverageAt(r, mark1CoverageOffset);
			const mark2Coverage = parseCoverageAt(r, mark2CoverageOffset);
			const mark1Array = parseMarkArray(r.sliceFrom(mark1ArrayOffset));

			// Parse mark2 array
			const mark2ArrayReader = r.sliceFrom(mark2ArrayOffset);
			const mark2Count = mark2ArrayReader.uint16();
			const mark2Array: Mark2Record[] = [];

			// Read anchor offsets
			const mark2Data: Array<uint16[]> = [];
			for (let i = 0; i < mark2Count; i++) {
				const anchorOffsets: uint16[] = [];
				for (let j = 0; j < markClassCount; j++) {
					anchorOffsets.push(mark2ArrayReader.uint16());
				}
				mark2Data.push(anchorOffsets);
			}

			// Parse anchors
			for (const anchorOffsets of mark2Data) {
				const mark2Anchors: (Anchor | null)[] = [];
				for (const anchorOffset of anchorOffsets) {
					mark2Anchors.push(parseAnchorAt(mark2ArrayReader, anchorOffset));
				}
				mark2Array.push({ mark2Anchors });
			}

			subtables.push({
				mark1Coverage,
				mark2Coverage,
				markClassCount,
				mark1Array,
				mark2Array,
			});
		}
	}

	return subtables;
}
