import type { GlyphId, int16, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * Glyph Variations table (gvar)
 * Contains variation data for TrueType glyph outlines
 */
export interface GvarTable {
	majorVersion: uint16;
	minorVersion: uint16;
	axisCount: uint16;
	sharedTupleCount: uint16;
	sharedTuples: number[][]; // [tupleIndex][axisIndex]
	glyphVariationData: GlyphVariationData[];
}

/**
 * Variation data for a single glyph
 */
export interface GlyphVariationData {
	tupleVariationHeaders: TupleVariationHeader[];
}

/**
 * Tuple variation header
 */
export interface TupleVariationHeader {
	variationDataSize: uint16;
	tupleIndex: uint16;
	peakTuple: number[] | null; // null if embedded in shared tuples
	intermediateStartTuple: number[] | null;
	intermediateEndTuple: number[] | null;
	serializedData: Uint8Array;
	pointNumbers: number[] | null; // null means all points
	deltas: PointDelta[];
}

/**
 * Delta values for a point
 */
export interface PointDelta {
	x: int16;
	y: int16;
}

// Tuple flags
const EMBEDDED_PEAK_TUPLE = 0x8000;
const INTERMEDIATE_REGION = 0x4000;
const PRIVATE_POINT_NUMBERS = 0x2000;
const TUPLE_INDEX_MASK = 0x0fff;

/**
 * Parse gvar table - glyph variations for TrueType outlines in variable fonts
 * @param reader - Reader positioned at start of gvar table
 * @param _numGlyphs - Number of glyphs (currently unused)
 * @returns Parsed gvar table with per-glyph variation data
 */
export function parseGvar(reader: Reader, _numGlyphs: number): GvarTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	const axisCount = reader.uint16();
	const sharedTupleCount = reader.uint16();
	const sharedTuplesOffset = reader.offset32();
	const glyphCount = reader.uint16();
	const flags = reader.uint16();
	const glyphVariationDataArrayOffset = reader.offset32();

	const offsetSize = flags & 1 ? 4 : 2;

	// Read glyph offsets
	const offsets: number[] = [];
	for (let i = 0; i <= glyphCount; i++) {
		const offset = offsetSize === 4 ? reader.uint32() : reader.uint16() * 2;
		offsets.push(offset);
	}

	// Parse shared tuples
	const sharedTuples: number[][] = [];
	if (sharedTupleCount > 0) {
		const tupleReader = reader.sliceFrom(sharedTuplesOffset);
		for (let i = 0; i < sharedTupleCount; i++) {
			const tuple: number[] = [];
			for (let a = 0; a < axisCount; a++) {
				tuple.push(tupleReader.f2dot14());
			}
			sharedTuples.push(tuple);
		}
	}

	// Parse glyph variation data
	const glyphVariationData: GlyphVariationData[] = [];
	for (let g = 0; g < glyphCount; g++) {
		const startOffset = offsets[g];
		const endOffset = offsets[g + 1];
		if (startOffset === undefined || endOffset === undefined) {
			glyphVariationData.push({ tupleVariationHeaders: [] });
			continue;
		}

		const dataStart = glyphVariationDataArrayOffset + startOffset;
		const dataEnd = glyphVariationDataArrayOffset + endOffset;

		if (dataStart === dataEnd) {
			// No variation data for this glyph
			glyphVariationData.push({ tupleVariationHeaders: [] });
			continue;
		}

		const dataReader = reader.sliceFrom(dataStart);
		const variationData = parseGlyphVariationData(
			dataReader,
			dataEnd - dataStart,
			axisCount,
			sharedTuples,
		);
		glyphVariationData.push(variationData);
	}

	return {
		majorVersion,
		minorVersion,
		axisCount,
		sharedTupleCount,
		sharedTuples,
		glyphVariationData,
	};
}

function parseGlyphVariationData(
	reader: Reader,
	dataLength: number,
	axisCount: number,
	sharedTuples: number[][],
): GlyphVariationData {
	if (dataLength === 0) {
		return { tupleVariationHeaders: [] };
	}

	const startOffset = reader.offset;
	const tupleVariationCount = reader.uint16();
	const dataOffset = reader.offset16();

	const tupleCount = tupleVariationCount & 0x0fff;
	const hasSharedPointNumbers = (tupleVariationCount & 0x8000) !== 0;

	// Read tuple variation headers first
	const headerData: Array<{
		variationDataSize: uint16;
		tupleIndex: uint16;
		peakTuple: number[] | null;
		intermediateStartTuple: number[] | null;
		intermediateEndTuple: number[] | null;
	}> = [];

	for (let i = 0; i < tupleCount; i++) {
		const variationDataSize = reader.uint16();
		const tupleIndex = reader.uint16();

		let peakTuple: number[] | null = null;
		let intermediateStartTuple: number[] | null = null;
		let intermediateEndTuple: number[] | null = null;

		if (tupleIndex & EMBEDDED_PEAK_TUPLE) {
			peakTuple = [];
			for (let a = 0; a < axisCount; a++) {
				peakTuple.push(reader.f2dot14());
			}
		} else {
			const sharedIndex = tupleIndex & TUPLE_INDEX_MASK;
			peakTuple = sharedTuples[sharedIndex] || null;
		}

		if (tupleIndex & INTERMEDIATE_REGION) {
			intermediateStartTuple = [];
			intermediateEndTuple = [];
			for (let a = 0; a < axisCount; a++) {
				intermediateStartTuple.push(reader.f2dot14());
			}
			for (let a = 0; a < axisCount; a++) {
				intermediateEndTuple.push(reader.f2dot14());
			}
		}

		headerData.push({
			variationDataSize,
			tupleIndex,
			peakTuple,
			intermediateStartTuple,
			intermediateEndTuple,
		});
	}

	// Now parse serialized data starting at dataOffset
	const dataReader = reader.sliceFrom(startOffset + dataOffset);

	// Parse shared point numbers if present
	let sharedPoints: number[] | null = null;
	if (hasSharedPointNumbers) {
		sharedPoints = parsePackedPoints(dataReader);
	}

	// Parse each tuple's deltas
	const headers: TupleVariationHeader[] = [];
	for (let i = 0; i < headerData.length; i++) {
		const hd = headerData[i]!;
		const hasPrivatePoints = (hd.tupleIndex & PRIVATE_POINT_NUMBERS) !== 0;

		let pointNumbers: number[] | null;
		if (hasPrivatePoints) {
			pointNumbers = parsePackedPoints(dataReader);
		} else {
			pointNumbers = sharedPoints;
		}

		// Calculate number of points to read deltas for
		const numPoints = pointNumbers ? pointNumbers.length : 0;

		// Parse x deltas then y deltas
		const xDeltas =
			numPoints > 0 ? parsePackedDeltas(dataReader, numPoints) : [];
		const yDeltas =
			numPoints > 0 ? parsePackedDeltas(dataReader, numPoints) : [];

		const deltas: PointDelta[] = [];
		for (let p = 0; p < xDeltas.length; p++) {
			const xDelta = xDeltas[p];
			const yDelta = yDeltas[p];
			deltas.push({
				x: xDelta ?? 0,
				y: yDelta ?? 0,
			});
		}

		headers.push({
			variationDataSize: hd.variationDataSize,
			tupleIndex: hd.tupleIndex,
			peakTuple: hd.peakTuple,
			intermediateStartTuple: hd.intermediateStartTuple,
			intermediateEndTuple: hd.intermediateEndTuple,
			serializedData: new Uint8Array(0),
			pointNumbers,
			deltas,
		});
	}

	return { tupleVariationHeaders: headers };
}

/**
 * Parse packed point numbers
 */
function parsePackedPoints(reader: Reader): number[] {
	const count = reader.uint8();
	const totalPoints =
		count === 0
			? 0
			: count & 0x80
				? ((count & 0x7f) << 8) | reader.uint8()
				: count;

	if (totalPoints === 0) {
		return []; // All points
	}

	const points: number[] = [];
	let pointIdx = 0;

	while (points.length < totalPoints) {
		const runHeader = reader.uint8();
		const runCount = (runHeader & 0x7f) + 1;
		const pointsAreWords = (runHeader & 0x80) !== 0;

		for (let i = 0; i < runCount && points.length < totalPoints; i++) {
			const delta = pointsAreWords ? reader.uint16() : reader.uint8();
			pointIdx += delta;
			points.push(pointIdx);
		}
	}

	return points;
}

/**
 * Parse packed deltas
 */
export function parsePackedDeltas(reader: Reader, count: number): number[] {
	const deltas: number[] = [];

	while (deltas.length < count) {
		const runHeader = reader.uint8();
		const runCount = (runHeader & 0x3f) + 1;
		const deltasAreZero = (runHeader & 0x80) !== 0;
		const deltasAreWords = (runHeader & 0x40) !== 0;

		for (let i = 0; i < runCount && deltas.length < count; i++) {
			if (deltasAreZero) {
				deltas.push(0);
			} else if (deltasAreWords) {
				deltas.push(reader.int16());
			} else {
				deltas.push(reader.int8());
			}
		}
	}

	return deltas;
}

/**
 * Calculate the scalar for a tuple given axis coordinates
 * Determines how much a variation tuple contributes based on current axis values
 * @param peakTuple - Peak coordinates for each axis where variation is at maximum
 * @param axisCoords - Current normalized axis coordinates
 * @param intermediateStart - Start of intermediate region (null if not used)
 * @param intermediateEnd - End of intermediate region (null if not used)
 * @returns Scalar value between 0 and 1 indicating variation contribution
 */
export function calculateTupleScalar(
	peakTuple: number[],
	axisCoords: number[],
	intermediateStart: number[] | null,
	intermediateEnd: number[] | null,
): number {
	let scalar = 1.0;

	for (let i = 0; i < peakTuple.length; i++) {
		const peak = peakTuple[i]!;
		const coord = axisCoords[i] ?? 0;

		if (peak === 0 || coord === 0) {
			if (peak !== 0) scalar = 0;
			continue;
		}

		if (intermediateStart && intermediateEnd) {
			const start = intermediateStart[i];
			const end = intermediateEnd[i];
			if (start === undefined || end === undefined) continue;

			if (coord < start || coord > end) {
				scalar = 0;
				break;
			}

			if (coord < peak) {
				scalar *= (coord - start) / (peak - start);
			} else if (coord > peak) {
				scalar *= (end - coord) / (end - peak);
			}
		} else {
			// Simple case
			if ((peak > 0 && coord < 0) || (peak < 0 && coord > 0)) {
				scalar = 0;
				break;
			}

			if (Math.abs(coord) < Math.abs(peak)) {
				scalar *= coord / peak;
			}
		}
	}

	return scalar;
}

/**
 * Get delta for a glyph point at given variation coordinates
 */
export function getGlyphDelta(
	gvar: GvarTable,
	glyphId: GlyphId,
	pointIndex: number,
	axisCoords: number[],
): PointDelta {
	const glyphData = gvar.glyphVariationData[glyphId];
	if (!glyphData) return { x: 0, y: 0 };

	let totalX = 0;
	let totalY = 0;

	for (let i = 0; i < glyphData.tupleVariationHeaders.length; i++) {
		const header = glyphData.tupleVariationHeaders[i]!;
		if (!header.peakTuple) continue;

		const scalar = calculateTupleScalar(
			header.peakTuple,
			axisCoords,
			header.intermediateStartTuple,
			header.intermediateEndTuple,
		);

		if (scalar === 0) continue;

		// Check if point is in the variation
		if (header.pointNumbers !== null) {
			const pointIdx = header.pointNumbers.indexOf(pointIndex);
			if (pointIdx < 0) continue;

			const delta = header.deltas[pointIdx];
			if (delta) {
				totalX += delta.x * scalar;
				totalY += delta.y * scalar;
			}
		} else {
			// All points
			const delta = header.deltas[pointIndex];
			if (delta) {
				totalX += delta.x * scalar;
				totalY += delta.y * scalar;
			}
		}
	}

	return { x: Math.round(totalX), y: Math.round(totalY) };
}
