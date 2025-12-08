import { describe, expect, test } from "bun:test";
import { parseGvar, parsePackedDeltas } from "../../../src/font/tables/gvar.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

function createGvarBuffer(options: {
	axisCount: number;
	glyphCount: number;
	use32BitOffsets?: boolean;
	sharedTuples?: number[][];
	glyphs?: Array<{
		tuples: Array<{
			embedPeak?: boolean;
			intermediateRegion?: boolean;
			privatePoints?: boolean;
			peakTuple?: number[];
			intermediateStart?: number[];
			intermediateEnd?: number[];
			pointNumbers?: number[];
			xDeltas?: number[];
			yDeltas?: number[];
		}>;
	}>;
}): Uint8Array {
	const headerSize = 20;
	const offsetSize = options.use32BitOffsets ? 4 : 2;
	const offsetTableSize = (options.glyphCount + 1) * offsetSize;
	const sharedTuplesSize =
		(options.sharedTuples?.length ?? 0) * options.axisCount * 2;

	let dataSize = 0;
	const glyphDataBuffers: Uint8Array[] = [];

	for (let g = 0; g < options.glyphCount; g++) {
		const glyphSpec = options.glyphs?.[g];
		if (!glyphSpec || glyphSpec.tuples.length === 0) {
			glyphDataBuffers.push(new Uint8Array(0));
			continue;
		}

		const tupleCount = glyphSpec.tuples.length;
		let glyphDataSize = 4;

		const tuplesBuffer: number[] = [];
		const serialDataBuffer: number[] = [];

		let hasSharedPoints = false;

		for (const tuple of glyphSpec.tuples) {
			let tupleIndex = 0;
			if (tuple.embedPeak) tupleIndex |= 0x8000;
			if (tuple.intermediateRegion) tupleIndex |= 0x4000;
			if (tuple.privatePoints) tupleIndex |= 0x2000;

			tuplesBuffer.push((tuple.xDeltas?.length ?? 0) >> 8);
			tuplesBuffer.push((tuple.xDeltas?.length ?? 0) & 0xff);
			tuplesBuffer.push(tupleIndex >> 8);
			tuplesBuffer.push(tupleIndex & 0xff);

			if (tuple.embedPeak && tuple.peakTuple) {
				for (const coord of tuple.peakTuple) {
					const f2dot14 = Math.round(coord * 16384);
					tuplesBuffer.push((f2dot14 >> 8) & 0xff);
					tuplesBuffer.push(f2dot14 & 0xff);
				}
			}

			if (tuple.intermediateRegion) {
				if (tuple.intermediateStart) {
					for (const coord of tuple.intermediateStart) {
						const f2dot14 = Math.round(coord * 16384);
						tuplesBuffer.push((f2dot14 >> 8) & 0xff);
						tuplesBuffer.push(f2dot14 & 0xff);
					}
				}
				if (tuple.intermediateEnd) {
					for (const coord of tuple.intermediateEnd) {
						const f2dot14 = Math.round(coord * 16384);
						tuplesBuffer.push((f2dot14 >> 8) & 0xff);
						tuplesBuffer.push(f2dot14 & 0xff);
					}
				}
			}
		}

		for (const tuple of glyphSpec.tuples) {
			if (tuple.privatePoints && tuple.pointNumbers) {
				const count = tuple.pointNumbers.length;
				if (count <= 127) {
					serialDataBuffer.push(count);
				} else {
					serialDataBuffer.push(0x80 | (count >> 8));
					serialDataBuffer.push(count & 0xff);
				}

				let prevPoint = 0;
				for (const point of tuple.pointNumbers) {
					const delta = point - prevPoint;
					prevPoint = point;
					if (delta < 256) {
						serialDataBuffer.push(0x00);
						serialDataBuffer.push(delta);
					} else {
						serialDataBuffer.push(0x80);
						serialDataBuffer.push(delta >> 8);
						serialDataBuffer.push(delta & 0xff);
					}
				}
			}

			if (tuple.xDeltas) {
				for (const delta of tuple.xDeltas) {
					if (delta === 0) {
						serialDataBuffer.push(0x80);
					} else if (delta >= -128 && delta <= 127) {
						serialDataBuffer.push(0x00);
						serialDataBuffer.push(delta & 0xff);
					} else {
						serialDataBuffer.push(0x40);
						serialDataBuffer.push((delta >> 8) & 0xff);
						serialDataBuffer.push(delta & 0xff);
					}
				}
			}

			if (tuple.yDeltas) {
				for (const delta of tuple.yDeltas) {
					if (delta === 0) {
						serialDataBuffer.push(0x80);
					} else if (delta >= -128 && delta <= 127) {
						serialDataBuffer.push(0x00);
						serialDataBuffer.push(delta & 0xff);
					} else {
						serialDataBuffer.push(0x40);
						serialDataBuffer.push((delta >> 8) & 0xff);
						serialDataBuffer.push(delta & 0xff);
					}
				}
			}
		}

		const glyphData = new Uint8Array(
			4 + tuplesBuffer.length + serialDataBuffer.length,
		);
		const dataOffset = 4 + tuplesBuffer.length;

		glyphData[0] = (tupleCount >> 8) & 0xff;
		glyphData[1] = tupleCount & 0xff;
		glyphData[2] = (dataOffset >> 8) & 0xff;
		glyphData[3] = dataOffset & 0xff;

		for (let i = 0; i < tuplesBuffer.length; i++) {
			glyphData[4 + i] = tuplesBuffer[i]!;
		}

		for (let i = 0; i < serialDataBuffer.length; i++) {
			glyphData[dataOffset + i] = serialDataBuffer[i]!;
		}

		glyphDataBuffers.push(glyphData);
		dataSize += glyphData.length;
	}

	const totalSize =
		headerSize + offsetTableSize + sharedTuplesSize + dataSize;
	const buffer = new Uint8Array(totalSize);
	const view = new DataView(buffer.buffer);

	view.setUint16(0, 1);
	view.setUint16(2, 0);
	view.setUint16(4, options.axisCount);
	view.setUint16(6, options.sharedTuples?.length ?? 0);
	view.setUint32(8, headerSize + offsetTableSize);
	view.setUint16(12, options.glyphCount);
	view.setUint16(14, options.use32BitOffsets ? 1 : 0);
	view.setUint32(16, headerSize + offsetTableSize + sharedTuplesSize);

	let offset = 0;
	for (let i = 0; i <= options.glyphCount; i++) {
		if (options.use32BitOffsets) {
			view.setUint32(headerSize + i * 4, offset);
		} else {
			view.setUint16(headerSize + i * 2, offset / 2);
		}
		if (i < options.glyphCount) {
			offset += glyphDataBuffers[i]!.length;
		}
	}

	if (options.sharedTuples) {
		let pos = headerSize + offsetTableSize;
		for (const tuple of options.sharedTuples) {
			for (const coord of tuple) {
				const f2dot14 = Math.round(coord * 16384);
				view.setInt16(pos, f2dot14);
				pos += 2;
			}
		}
	}

	let pos = headerSize + offsetTableSize + sharedTuplesSize;
	for (const glyphData of glyphDataBuffers) {
		buffer.set(glyphData, pos);
		pos += glyphData.length;
	}

	return buffer;
}

describe("gvar synthetic binary tests", () => {
	test("parses gvar with embedded peak tuple", () => {
		const buffer = createGvarBuffer({
			axisCount: 2,
			glyphCount: 1,
			glyphs: [
				{
					tuples: [
						{
							embedPeak: true,
							privatePoints: true,
							peakTuple: [1.0, 0.0],
							pointNumbers: [1, 5],
							xDeltas: [10, 20],
							yDeltas: [5, 15],
						},
					],
				},
			],
		});

		const reader = new Reader(buffer.buffer as ArrayBuffer);
		const gvar = parseGvar(reader, 1);

		expect(gvar.glyphVariationData.length).toBe(1);
		const header = gvar.glyphVariationData[0]?.tupleVariationHeaders[0];
		expect(header).toBeDefined();
		expect(header?.peakTuple).toEqual([1.0, 0.0]);
		expect(header?.pointNumbers).toEqual([1, 5]);
	});

	test("parses gvar with intermediate region", () => {
		const buffer = createGvarBuffer({
			axisCount: 1,
			glyphCount: 1,
			glyphs: [
				{
					tuples: [
						{
							embedPeak: true,
							intermediateRegion: true,
							privatePoints: true,
							peakTuple: [0.5],
							intermediateStart: [0.25],
							intermediateEnd: [1.0],
							pointNumbers: [0],
							xDeltas: [8],
							yDeltas: [4],
						},
					],
				},
			],
		});

		const reader = new Reader(buffer.buffer as ArrayBuffer);
		const gvar = parseGvar(reader, 1);

		const header = gvar.glyphVariationData[0]?.tupleVariationHeaders[0];
		expect(header?.intermediateStartTuple).toEqual([0.25]);
		expect(header?.intermediateEndTuple).toEqual([1.0]);
	});

	test("parses gvar with 16-bit point count", () => {
		const largePointNumbers = Array.from({ length: 300 }, (_, i) => i + 1);
		const buffer = createGvarBuffer({
			axisCount: 1,
			glyphCount: 1,
			glyphs: [
				{
					tuples: [
						{
							embedPeak: true,
							privatePoints: true,
							peakTuple: [1.0],
							pointNumbers: largePointNumbers,
							xDeltas: Array(300).fill(1),
							yDeltas: Array(300).fill(2),
						},
					],
				},
			],
		});

		const reader = new Reader(buffer.buffer as ArrayBuffer);
		const gvar = parseGvar(reader, 1);

		const header = gvar.glyphVariationData[0]?.tupleVariationHeaders[0];
		expect(header?.pointNumbers?.length).toBe(300);
	});

	test("parses gvar with word point deltas", () => {
		const pointNumbers = [10, 500, 1000];
		const buffer = createGvarBuffer({
			axisCount: 1,
			glyphCount: 1,
			glyphs: [
				{
					tuples: [
						{
							embedPeak: true,
							privatePoints: true,
							peakTuple: [1.0],
							pointNumbers,
							xDeltas: [5, 10, 15],
							yDeltas: [3, 6, 9],
						},
					],
				},
			],
		});

		const reader = new Reader(buffer.buffer as ArrayBuffer);
		const gvar = parseGvar(reader, 1);

		const header = gvar.glyphVariationData[0]?.tupleVariationHeaders[0];
		expect(header?.pointNumbers).toEqual(pointNumbers);
	});

	test("parses gvar with no variation data", () => {
		const buffer = new Uint8Array(50);
		const view = new DataView(buffer.buffer);

		view.setUint16(0, 1);
		view.setUint16(2, 0);
		view.setUint16(4, 1);
		view.setUint16(6, 0);
		view.setUint32(8, 24);
		view.setUint16(12, 1);
		view.setUint16(14, 0);
		view.setUint32(16, 24);

		view.setUint16(20, 0);
		view.setUint16(22, 0);

		const reader = new Reader(buffer.buffer);
		const gvar = parseGvar(reader, 1);

		expect(gvar.glyphVariationData.length).toBe(1);
		expect(gvar.glyphVariationData[0]?.tupleVariationHeaders).toEqual([]);
	});

	test("parses gvar with data length 0", () => {
		const buffer = createGvarBuffer({
			axisCount: 1,
			glyphCount: 2,
			glyphs: [
				{ tuples: [] },
				{
					tuples: [
						{
							embedPeak: true,
							privatePoints: true,
							peakTuple: [1.0],
							pointNumbers: [0],
							xDeltas: [5],
							yDeltas: [3],
						},
					],
				},
			],
		});

		const reader = new Reader(buffer.buffer as ArrayBuffer);
		const gvar = parseGvar(reader, 2);

		expect(gvar.glyphVariationData[0]?.tupleVariationHeaders).toEqual([]);
		expect(gvar.glyphVariationData[1]?.tupleVariationHeaders.length).toBe(1);
	});
});

describe("getGlyphDelta with synthetic data", () => {
	test("returns delta for point with private point numbers", async () => {
		const { getGlyphDelta } = await import(
			"../../../src/font/tables/gvar.ts"
		);
		const buffer = createGvarBuffer({
			axisCount: 1,
			glyphCount: 1,
			glyphs: [
				{
					tuples: [
						{
							embedPeak: true,
							privatePoints: true,
							peakTuple: [1.0],
							pointNumbers: [5, 10, 15],
							xDeltas: [100, 200, 300],
							yDeltas: [50, 100, 150],
						},
					],
				},
			],
		});

		const reader = new Reader(buffer.buffer as ArrayBuffer);
		const gvar = parseGvar(reader, 1);

		const delta = getGlyphDelta(gvar, 0, 10, [1.0]);
		expect(delta.x).toBe(200);
		expect(delta.y).toBe(100);
	});

	test("returns zero for point not in variation with private points", async () => {
		const { getGlyphDelta } = await import(
			"../../../src/font/tables/gvar.ts"
		);
		const buffer = createGvarBuffer({
			axisCount: 1,
			glyphCount: 1,
			glyphs: [
				{
					tuples: [
						{
							embedPeak: true,
							privatePoints: true,
							peakTuple: [1.0],
							pointNumbers: [5, 10],
							xDeltas: [100, 200],
							yDeltas: [50, 100],
						},
					],
				},
			],
		});

		const reader = new Reader(buffer.buffer as ArrayBuffer);
		const gvar = parseGvar(reader, 1);

		const delta = getGlyphDelta(gvar, 0, 999, [1.0]);
		expect(delta.x).toBe(0);
		expect(delta.y).toBe(0);
	});
});
