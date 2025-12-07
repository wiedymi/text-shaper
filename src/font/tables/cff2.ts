import { Reader } from "../binary/reader.ts";

/**
 * CFF2 (Compact Font Format 2) table parser
 * Used by variable fonts with PostScript outlines
 */

export interface Cff2Table {
	version: { major: number; minor: number };
	topDict: Cff2TopDict;
	globalSubrs: Uint8Array[];
	charStrings: Uint8Array[];
	fdArray: Cff2FDDict[];
	fdSelect: Cff2FDSelect | null;
	vstore: ItemVariationStore | null;
}

export interface Cff2TopDict {
	charStrings?: number;
	fdArray?: number;
	fdSelect?: number;
	vstore?: number;
	fontMatrix?: number[];
}

export interface Cff2PrivateDict {
	blueValues?: number[];
	otherBlues?: number[];
	familyBlues?: number[];
	familyOtherBlues?: number[];
	blueScale?: number;
	blueShift?: number;
	blueFuzz?: number;
	stdHW?: number;
	stdVW?: number;
	stemSnapH?: number[];
	stemSnapV?: number[];
	languageGroup?: number;
	expansionFactor?: number;
	subrs?: number;
	vsindex?: number;
	blend?: number[];
}

export interface Cff2FDDict {
	fontName?: string;
	private?: Cff2PrivateDict;
	privateOffset?: number;
	privateSize?: number;
	localSubrs?: Uint8Array[];
}

export interface Cff2FDSelect {
	format: number;
	select: (glyphId: number) => number;
}

export interface ItemVariationStore {
	format: number;
	variationRegionList: VariationRegionList;
	itemVariationData: ItemVariationData[];
}

export interface VariationRegionList {
	axisCount: number;
	regionCount: number;
	regions: VariationRegion[];
}

export interface VariationRegion {
	axes: RegionAxisCoordinates[];
}

export interface RegionAxisCoordinates {
	startCoord: number;
	peakCoord: number;
	endCoord: number;
}

export interface ItemVariationData {
	itemCount: number;
	regionIndexCount: number;
	regionIndexes: number[];
	deltaSets: number[][];
}

// CFF2 Top DICT operators
enum Cff2TopDictOp {
	FontMatrix = 0x0c07,
	CharStrings = 17,
	FDArray = 0x0c24,
	FDSelect = 0x0c25,
	vstore = 24,
}

// CFF2 Private DICT operators
enum Cff2PrivateDictOp {
	BlueValues = 6,
	OtherBlues = 7,
	FamilyBlues = 8,
	FamilyOtherBlues = 9,
	StdHW = 10,
	StdVW = 11,
	Subrs = 19,
	vsindex = 22,
	blend = 23,
	BlueScale = 0x0c09,
	BlueShift = 0x0c0a,
	BlueFuzz = 0x0c0b,
	StemSnapH = 0x0c0c,
	StemSnapV = 0x0c0d,
	LanguageGroup = 0x0c11,
	ExpansionFactor = 0x0c12,
}

/**
 * Parse CFF2 table
 */
export function parseCff2(reader: Reader): Cff2Table {
	const startOffset = reader.offset;

	// Header
	const major = reader.uint8();
	const minor = reader.uint8();
	const headerSize = reader.uint8();
	const topDictLength = reader.uint16();

	// Skip to after header
	reader.seek(startOffset + headerSize);

	// Top DICT (not an INDEX in CFF2, just raw data)
	const topDictReader = reader.slice(
		reader.offset - startOffset,
		topDictLength,
	);
	reader.skip(topDictLength);
	const topDict = parseCff2TopDict(topDictReader);

	// Global Subr INDEX
	const globalSubrs = parseIndex(reader);

	// CharStrings INDEX
	let charStrings: Uint8Array[] = [];
	if (topDict.charStrings !== undefined) {
		reader.seek(startOffset + topDict.charStrings);
		charStrings = parseIndex(reader);
	}

	// FDArray INDEX
	const fdArray: Cff2FDDict[] = [];
	if (topDict.fdArray !== undefined) {
		reader.seek(startOffset + topDict.fdArray);
		const fdDictData = parseIndex(reader);

		for (let i = 0; i < fdDictData.length; i++) {
			const data = fdDictData[i]!;
			const fd = parseCff2FDDict(
				new Reader(
					data.buffer as ArrayBuffer,
					data.byteOffset,
					data.byteLength,
				),
			);

			// Parse local subrs if Private DICT has them
			if (fd.privateOffset !== undefined && fd.privateSize !== undefined) {
				reader.seek(startOffset + fd.privateOffset);
				const privateReader = reader.slice(0, fd.privateSize);
				fd.private = parseCff2PrivateDict(privateReader);

				if (fd.private.subrs !== undefined) {
					reader.seek(startOffset + fd.privateOffset + fd.private.subrs);
					fd.localSubrs = parseIndex(reader);
				}
			}

			fdArray.push(fd);
		}
	}

	// FDSelect
	let fdSelect: Cff2FDSelect | null = null;
	if (topDict.fdSelect !== undefined) {
		reader.seek(startOffset + topDict.fdSelect);
		fdSelect = parseFDSelect(reader, charStrings.length);
	}

	// Variation Store
	let vstore: ItemVariationStore | null = null;
	if (topDict.vstore !== undefined) {
		reader.seek(startOffset + topDict.vstore);
		vstore = parseItemVariationStore(reader);
	}

	return {
		version: { major, minor },
		topDict,
		globalSubrs,
		charStrings,
		fdArray,
		fdSelect,
		vstore,
	};
}

/**
 * Parse CFF2 INDEX structure (uses 32-bit count)
 */
function parseIndex(reader: Reader): Uint8Array[] {
	const count = reader.uint32();
	if (count === 0) return [];

	const offSize = reader.uint8();
	const offsets: number[] = [];

	for (let i = 0; i <= count; i++) {
		offsets.push(readOffset(reader, offSize));
	}

	const result: Uint8Array[] = [];
	for (let i = 0; i < count; i++) {
		const start = offsets[i];
		const end = offsets[i + 1];
		if (start === undefined || end === undefined) continue;
		const length = end - start;
		result.push(reader.bytes(length));
	}

	return result;
}

/**
 * Read offset of given size
 */
function readOffset(reader: Reader, offSize: number): number {
	switch (offSize) {
		case 1:
			return reader.uint8();
		case 2:
			return reader.uint16();
		case 3:
			return reader.uint24();
		case 4:
			return reader.uint32();
		default:
			throw new Error(`Invalid offset size: ${offSize}`);
	}
}

/**
 * Parse a CFF2 DICT structure
 */
function parseDict(reader: Reader): Map<number, number[]> {
	const result = new Map<number, number[]>();
	const operands: number[] = [];

	while (reader.remaining > 0) {
		const b0 = reader.uint8();

		if (b0 <= 21) {
			// Operator
			let op = b0;
			if (b0 === 12) {
				op = 0x0c00 | reader.uint8();
			}
			result.set(op, [...operands]);
			operands.length = 0;
		} else if (b0 === 22) {
			// vsindex operator
			result.set(22, [...operands]);
			operands.length = 0;
		} else if (b0 === 23) {
			// blend operator
			result.set(23, [...operands]);
			operands.length = 0;
		} else if (b0 === 24) {
			// vstore operator
			result.set(24, [...operands]);
			operands.length = 0;
		} else if (b0 === 28) {
			// 16-bit signed integer
			operands.push(reader.int16());
		} else if (b0 === 29) {
			// 32-bit signed integer
			operands.push(reader.int32());
		} else if (b0 === 30) {
			// Real number
			operands.push(parseReal(reader));
		} else if (b0 >= 32 && b0 <= 246) {
			operands.push(b0 - 139);
		} else if (b0 >= 247 && b0 <= 250) {
			const b1 = reader.uint8();
			operands.push((b0 - 247) * 256 + b1 + 108);
		} else if (b0 >= 251 && b0 <= 254) {
			const b1 = reader.uint8();
			operands.push(-(b0 - 251) * 256 - b1 - 108);
		}
	}

	return result;
}

/**
 * Parse real number
 */
function parseReal(reader: Reader): number {
	let str = "";
	const nibbleChars = "0123456789.EE -";
	let done = false;

	while (!done) {
		const byte = reader.uint8();
		for (let i = 0; i < 2; i++) {
			const nibble = i === 0 ? byte >> 4 : byte & 0x0f;
			if (nibble === 0x0f) {
				done = true;
				break;
			}
			if (nibble === 0x0c) {
				str += "E-";
			} else {
				const char = nibbleChars[nibble];
				if (char !== undefined) str += char;
			}
		}
	}

	return parseFloat(str);
}

/**
 * Parse CFF2 Top DICT
 */
function parseCff2TopDict(reader: Reader): Cff2TopDict {
	const dict = parseDict(reader);
	const result: Cff2TopDict = {};

	const dictEntries = Array.from(dict);
	for (let i = 0; i < dictEntries.length; i++) {
		const [op, operands] = dictEntries[i]!;
		switch (op) {
			case Cff2TopDictOp.FontMatrix:
				result.fontMatrix = operands;
				break;
			case Cff2TopDictOp.CharStrings:
				result.charStrings = operands[0];
				break;
			case Cff2TopDictOp.FDArray:
				result.fdArray = operands[0];
				break;
			case Cff2TopDictOp.FDSelect:
				result.fdSelect = operands[0];
				break;
			case Cff2TopDictOp.vstore:
				result.vstore = operands[0];
				break;
		}
	}

	return result;
}

/**
 * Parse CFF2 FD DICT
 */
function parseCff2FDDict(reader: Reader): Cff2FDDict {
	const dict = parseDict(reader);
	const result: Cff2FDDict = {};

	// Private DICT pointer (operator 18)
	const privateOp = dict.get(18);
	if (privateOp && privateOp.length >= 2) {
		result.privateSize = privateOp[0];
		result.privateOffset = privateOp[1];
	}

	return result;
}

/**
 * Parse CFF2 Private DICT
 */
function parseCff2PrivateDict(reader: Reader): Cff2PrivateDict {
	const dict = parseDict(reader);
	const result: Cff2PrivateDict = {};

	const dictEntries = Array.from(dict);
	for (let i = 0; i < dictEntries.length; i++) {
		const [op, operands] = dictEntries[i]!;
		const op0 = operands[0];

		switch (op) {
			case Cff2PrivateDictOp.BlueValues:
				result.blueValues = deltaToAbsolute(operands);
				break;
			case Cff2PrivateDictOp.OtherBlues:
				result.otherBlues = deltaToAbsolute(operands);
				break;
			case Cff2PrivateDictOp.FamilyBlues:
				result.familyBlues = deltaToAbsolute(operands);
				break;
			case Cff2PrivateDictOp.FamilyOtherBlues:
				result.familyOtherBlues = deltaToAbsolute(operands);
				break;
			case Cff2PrivateDictOp.BlueScale:
				result.blueScale = op0;
				break;
			case Cff2PrivateDictOp.BlueShift:
				result.blueShift = op0;
				break;
			case Cff2PrivateDictOp.BlueFuzz:
				result.blueFuzz = op0;
				break;
			case Cff2PrivateDictOp.StdHW:
				result.stdHW = op0;
				break;
			case Cff2PrivateDictOp.StdVW:
				result.stdVW = op0;
				break;
			case Cff2PrivateDictOp.StemSnapH:
				result.stemSnapH = deltaToAbsolute(operands);
				break;
			case Cff2PrivateDictOp.StemSnapV:
				result.stemSnapV = deltaToAbsolute(operands);
				break;
			case Cff2PrivateDictOp.LanguageGroup:
				result.languageGroup = op0;
				break;
			case Cff2PrivateDictOp.ExpansionFactor:
				result.expansionFactor = op0;
				break;
			case Cff2PrivateDictOp.Subrs:
				result.subrs = op0;
				break;
			case Cff2PrivateDictOp.vsindex:
				result.vsindex = op0;
				break;
			case Cff2PrivateDictOp.blend:
				result.blend = operands;
				break;
		}
	}

	return result;
}

/**
 * Convert delta-encoded values to absolute
 */
function deltaToAbsolute(deltas: number[]): number[] {
	const result: number[] = [];
	let value = 0;
	for (let i = 0; i < deltas.length; i++) {
		const delta = deltas[i]!;
		value += delta;
		result.push(value);
	}
	return result;
}

/**
 * Parse FDSelect structure
 */
function parseFDSelect(reader: Reader, numGlyphs: number): Cff2FDSelect {
	const format = reader.uint8();

	if (format === 0) {
		const fds = reader.uint8Array(numGlyphs);
		return {
			format,
			select: (glyphId: number) => fds[glyphId] ?? 0,
		};
	} else if (format === 3) {
		const nRanges = reader.uint16();
		const ranges: Array<{ first: number; fd: number }> = [];

		for (let i = 0; i < nRanges; i++) {
			ranges.push({
				first: reader.uint16(),
				fd: reader.uint8(),
			});
		}
		reader.uint16(); // sentinel

		return {
			format,
			select: (glyphId: number) => {
				let lo = 0;
				let hi = ranges.length - 1;
				while (lo < hi) {
					const mid = Math.ceil((lo + hi) / 2);
					const range = ranges[mid];
					if (range && range.first <= glyphId) {
						lo = mid;
					} else {
						hi = mid - 1;
					}
				}
				const foundRange = ranges[lo];
				return foundRange?.fd ?? 0;
			},
		};
	} else if (format === 4) {
		// CFF2 format 4: 32-bit range records
		const nRanges = reader.uint32();
		const ranges: Array<{ first: number; fd: number }> = [];

		for (let i = 0; i < nRanges; i++) {
			ranges.push({
				first: reader.uint32(),
				fd: reader.uint16(),
			});
		}
		reader.uint32(); // sentinel

		return {
			format,
			select: (glyphId: number) => {
				let lo = 0;
				let hi = ranges.length - 1;
				while (lo < hi) {
					const mid = Math.ceil((lo + hi) / 2);
					const range = ranges[mid];
					if (range && range.first <= glyphId) {
						lo = mid;
					} else {
						hi = mid - 1;
					}
				}
				const foundRange = ranges[lo];
				return foundRange?.fd ?? 0;
			},
		};
	}

	return { format, select: () => 0 };
}

/**
 * Parse ItemVariationStore
 */
function parseItemVariationStore(reader: Reader): ItemVariationStore {
	const startOffset = reader.offset;

	const _length = reader.uint16();
	const format = reader.uint16();
	const variationRegionListOffset = reader.uint32();
	const itemVariationDataCount = reader.uint16();
	const itemVariationDataOffsets: number[] = [];

	for (let i = 0; i < itemVariationDataCount; i++) {
		itemVariationDataOffsets.push(reader.uint32());
	}

	// Parse VariationRegionList
	reader.seek(startOffset + variationRegionListOffset);
	const variationRegionList = parseVariationRegionList(reader);

	// Parse ItemVariationData
	const itemVariationData: ItemVariationData[] = [];
	for (let i = 0; i < itemVariationDataOffsets.length; i++) {
		const offset = itemVariationDataOffsets[i]!;
		reader.seek(startOffset + offset);
		itemVariationData.push(parseItemVariationData(reader));
	}

	return {
		format,
		variationRegionList,
		itemVariationData,
	};
}

/**
 * Parse VariationRegionList
 */
function parseVariationRegionList(reader: Reader): VariationRegionList {
	const axisCount = reader.uint16();
	const regionCount = reader.uint16();
	const regions: VariationRegion[] = [];

	for (let i = 0; i < regionCount; i++) {
		const axes: RegionAxisCoordinates[] = [];
		for (let j = 0; j < axisCount; j++) {
			axes.push({
				startCoord: reader.f2dot14(),
				peakCoord: reader.f2dot14(),
				endCoord: reader.f2dot14(),
			});
		}
		regions.push({ axes });
	}

	return { axisCount, regionCount, regions };
}

/**
 * Parse ItemVariationData
 */
function parseItemVariationData(reader: Reader): ItemVariationData {
	const itemCount = reader.uint16();
	const wordDeltaCount = reader.uint16();
	const regionIndexCount = wordDeltaCount & 0x7fff;
	const longWords = (wordDeltaCount & 0x8000) !== 0;

	const regionIndexes: number[] = [];
	for (let i = 0; i < regionIndexCount; i++) {
		regionIndexes.push(reader.uint16());
	}

	const deltaSets: number[][] = [];
	for (let i = 0; i < itemCount; i++) {
		const deltas: number[] = [];
		for (let j = 0; j < regionIndexCount; j++) {
			if (longWords) {
				deltas.push(reader.int32());
			} else {
				deltas.push(reader.int16());
			}
		}
		deltaSets.push(deltas);
	}

	return {
		itemCount,
		regionIndexCount,
		regionIndexes,
		deltaSets,
	};
}

/**
 * Calculate variation delta for given coordinates
 */
export function calculateVariationDelta(
	vstore: ItemVariationStore,
	outerIndex: number,
	innerIndex: number,
	normalizedCoords: number[],
): number {
	const itemData = vstore.itemVariationData[outerIndex];
	if (!itemData) return 0;

	const deltaSet = itemData.deltaSets[innerIndex];
	if (!deltaSet) return 0;

	let delta = 0;
	for (let i = 0; i < itemData.regionIndexCount; i++) {
		const regionIndex = itemData.regionIndexes[i];
		if (regionIndex === undefined) continue;
		const region = vstore.variationRegionList.regions[regionIndex];
		if (!region) continue;

		// Calculate scalar for this region
		let scalar = 1.0;
		for (let axis = 0; axis < region.axes.length; axis++) {
			const coords = region.axes[axis]!;
			const coord = normalizedCoords[axis] ?? 0;

			if (coords.peakCoord === 0) {
				continue;
			}

			if (coord < coords.startCoord || coord > coords.endCoord) {
				scalar = 0;
				break;
			}

			if (coord === coords.peakCoord) {
				continue;
			}

			if (coord < coords.peakCoord) {
				scalar *=
					(coord - coords.startCoord) / (coords.peakCoord - coords.startCoord);
			} else {
				scalar *=
					(coords.endCoord - coord) / (coords.endCoord - coords.peakCoord);
			}
		}

		delta += scalar * (deltaSet[i] ?? 0);
	}

	return Math.round(delta);
}
