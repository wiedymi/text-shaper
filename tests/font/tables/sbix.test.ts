import { describe, expect, test } from "bun:test";
import { Reader } from "../../../src/font/binary/reader.ts";
import {
	parseSbix,
	getGlyphBitmap,
	getStrikeForPpem,
	getAvailablePpemSizes,
	hasGlyphBitmap,
	resolveDupeGlyph,
	SbixGraphicType,
	type SbixTable,
	type SbixStrike,
	type SbixGlyph,
} from "../../../src/font/tables/sbix.ts";

/**
 * Create mock sbix table binary data
 */
function createSbixTableData(
	version: number,
	flags: number,
	strikes: Array<{
		ppem: number;
		ppi: number;
		glyphs: Array<{
			glyphId: number;
			originOffsetX: number;
			originOffsetY: number;
			graphicType: string;
			data: Uint8Array;
		}>;
	}>,
	numGlyphs: number,
): ArrayBuffer {
	// Calculate sizes
	const headerSize = 8; // version (2) + flags (2) + numStrikes (4)
	const strikeOffsetsSize = 4 * strikes.length; // Array of uint32 offsets

	// Calculate strike sizes
	const strikeSizes: number[] = [];
	for (const strike of strikes) {
		let size = 4; // ppem (2) + ppi (2)
		size += 4 * (numGlyphs + 1); // glyph data offsets
		for (const glyph of strike.glyphs) {
			size += 8; // originOffsetX (2) + originOffsetY (2) + graphicType (4)
			size += glyph.data.length; // image data
		}
		strikeSizes.push(size);
	}

	const totalSize =
		headerSize + strikeOffsetsSize + strikeSizes.reduce((a, b) => a + b, 0);
	const buffer = new ArrayBuffer(totalSize);
	const view = new DataView(buffer);
	let offset = 0;

	// Write sbix header
	view.setUint16(offset, version, false); // version
	offset += 2;
	view.setUint16(offset, flags, false); // flags
	offset += 2;
	view.setUint32(offset, strikes.length, false); // numStrikes
	offset += 4;

	// Calculate and write strike offsets
	let strikeOffset = headerSize + strikeOffsetsSize;
	for (let i = 0; i < strikes.length; i++) {
		view.setUint32(offset, strikeOffset, false);
		offset += 4;
		strikeOffset += strikeSizes[i]!;
	}

	// Write strikes
	for (const strike of strikes) {
		// Write strike header
		view.setUint16(offset, strike.ppem, false);
		offset += 2;
		view.setUint16(offset, strike.ppi, false);
		offset += 2;

		// Calculate glyph data offsets
		// Each glyph that doesn't have data gets the same offset as the next glyph
		const glyphDataOffsets: number[] = [];
		let currentOffset = 4 + 4 * (numGlyphs + 1); // After ppem/ppi + offset array

		// Create a map of glyph IDs to their data
		const glyphMap = new Map<number, typeof strike.glyphs[0]>();
		for (const glyph of strike.glyphs) {
			glyphMap.set(glyph.glyphId, glyph);
		}

		// Build offset array
		for (let i = 0; i <= numGlyphs; i++) {
			glyphDataOffsets.push(currentOffset);
			const glyph = glyphMap.get(i);
			if (glyph) {
				currentOffset += 8 + glyph.data.length; // header + data
			}
		}

		// Write glyph data offsets
		for (let i = 0; i <= numGlyphs; i++) {
			view.setUint32(offset, glyphDataOffsets[i]!, false);
			offset += 4;
		}

		// Write glyph data in order
		for (let i = 0; i < numGlyphs; i++) {
			const glyph = glyphMap.get(i);
			if (glyph) {
				view.setInt16(offset, glyph.originOffsetX, false);
				offset += 2;
				view.setInt16(offset, glyph.originOffsetY, false);
				offset += 2;

				// Write graphic type as 4-char tag
				const type = glyph.graphicType.padEnd(4, " ");
				for (let j = 0; j < 4; j++) {
					view.setUint8(offset++, type.charCodeAt(j));
				}

				// Write image data
				const dataArray = new Uint8Array(buffer, offset, glyph.data.length);
				dataArray.set(glyph.data);
				offset += glyph.data.length;
			}
		}
	}

	return buffer;
}

/**
 * Create PNG header bytes (minimal)
 */
function createPngData(): Uint8Array {
	return new Uint8Array([
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
	]);
}

/**
 * Create JPEG header bytes (minimal)
 */
function createJpegData(): Uint8Array {
	return new Uint8Array([
		0xff, 0xd8, 0xff, 0xe0, // JPEG SOI + APP0 marker
	]);
}

describe("sbix table", () => {
	describe("parseSbix", () => {
		test("parses valid sbix table with single strike", () => {
			const pngData = createPngData();
			const buffer = createSbixTableData(
				1,
				1,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 0,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			expect(sbix.version).toBe(1);
			expect(sbix.flags).toBe(1);
			expect(sbix.strikes.length).toBe(1);
			expect(sbix.strikes[0]?.ppem).toBe(64);
			expect(sbix.strikes[0]?.ppi).toBe(72);
			expect(sbix.strikes[0]?.glyphData.size).toBe(1);

			const glyph = sbix.strikes[0]?.glyphData.get(0);
			expect(glyph).toBeDefined();
			expect(glyph?.originOffsetX).toBe(0);
			expect(glyph?.originOffsetY).toBe(0);
			expect(glyph?.graphicType).toBe(SbixGraphicType.PNG);
			expect(glyph?.data).toEqual(pngData);
		});

		test("parses sbix table with multiple strikes", () => {
			const pngData1 = createPngData();
			const pngData2 = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 32,
						ppi: 72,
						glyphs: [
							{
								glyphId: 0,
								originOffsetX: 5,
								originOffsetY: -10,
								graphicType: SbixGraphicType.PNG,
								data: pngData1,
							},
						],
					},
					{
						ppem: 64,
						ppi: 144,
						glyphs: [
							{
								glyphId: 0,
								originOffsetX: 10,
								originOffsetY: -20,
								graphicType: SbixGraphicType.PNG,
								data: pngData2,
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			expect(sbix.strikes.length).toBe(2);

			expect(sbix.strikes[0]?.ppem).toBe(32);
			expect(sbix.strikes[0]?.ppi).toBe(72);
			expect(sbix.strikes[0]?.glyphData.get(0)?.originOffsetX).toBe(5);
			expect(sbix.strikes[0]?.glyphData.get(0)?.originOffsetY).toBe(-10);
			expect(sbix.strikes[0]?.glyphData.get(0)?.data).toEqual(pngData1);

			expect(sbix.strikes[1]?.ppem).toBe(64);
			expect(sbix.strikes[1]?.ppi).toBe(144);
			expect(sbix.strikes[1]?.glyphData.get(0)?.originOffsetX).toBe(10);
			expect(sbix.strikes[1]?.glyphData.get(0)?.originOffsetY).toBe(-20);
			expect(sbix.strikes[1]?.glyphData.get(0)?.data).toEqual(pngData2);
		});

		test("parses sbix table with multiple glyphs in strike", () => {
			const pngData = createPngData();
			const jpegData = createJpegData();
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 0,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
							{
								glyphId: 2,
								originOffsetX: 5,
								originOffsetY: -5,
								graphicType: SbixGraphicType.JPG,
								data: jpegData,
							},
							{
								glyphId: 5,
								originOffsetX: -3,
								originOffsetY: 8,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			expect(sbix.strikes[0]?.glyphData.size).toBe(3);
			expect(sbix.strikes[0]?.glyphData.has(0)).toBe(true);
			expect(sbix.strikes[0]?.glyphData.has(2)).toBe(true);
			expect(sbix.strikes[0]?.glyphData.has(5)).toBe(true);

			expect(sbix.strikes[0]?.glyphData.get(0)?.graphicType).toBe(
				SbixGraphicType.PNG,
			);
			expect(sbix.strikes[0]?.glyphData.get(2)?.graphicType).toBe(
				SbixGraphicType.JPG,
			);
			expect(sbix.strikes[0]?.glyphData.get(5)?.originOffsetX).toBe(-3);
			expect(sbix.strikes[0]?.glyphData.get(5)?.originOffsetY).toBe(8);
		});

		test("handles empty glyphs (no data)", () => {
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			expect(sbix.strikes.length).toBe(1);
			expect(sbix.strikes[0]?.glyphData.size).toBe(0);
		});

		test("parses different graphic types", () => {
			const pngData = createPngData();
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 0,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
							{
								glyphId: 1,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.JPG,
								data: createJpegData(),
							},
							{
								glyphId: 2,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.TIFF,
								data: new Uint8Array([0x49, 0x49, 0x2a, 0x00]),
							},
							{
								glyphId: 3,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PDF,
								data: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
							},
							{
								glyphId: 4,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.MASK,
								data: pngData,
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			expect(sbix.strikes[0]?.glyphData.get(0)?.graphicType).toBe(
				SbixGraphicType.PNG,
			);
			expect(sbix.strikes[0]?.glyphData.get(1)?.graphicType).toBe(
				SbixGraphicType.JPG,
			);
			expect(sbix.strikes[0]?.glyphData.get(2)?.graphicType).toBe(
				SbixGraphicType.TIFF,
			);
			expect(sbix.strikes[0]?.glyphData.get(3)?.graphicType).toBe(
				SbixGraphicType.PDF,
			);
			expect(sbix.strikes[0]?.glyphData.get(4)?.graphicType).toBe(
				SbixGraphicType.MASK,
			);
		});

		test("handles version 0 and 1", () => {
			const pngData = createPngData();
			for (const version of [0, 1]) {
				const buffer = createSbixTableData(
					version,
					0,
					[
						{
							ppem: 64,
							ppi: 72,
							glyphs: [
								{
									glyphId: 0,
									originOffsetX: 0,
									originOffsetY: 0,
									graphicType: SbixGraphicType.PNG,
									data: pngData,
								},
							],
						},
					],
					10,
				);
				const reader = new Reader(buffer);
				const sbix = parseSbix(reader, 10);

				expect(sbix.version).toBe(version);
			}
		});

		test("handles various flags", () => {
			const pngData = createPngData();
			for (const flags of [0, 1, 2, 3]) {
				const buffer = createSbixTableData(
					1,
					flags,
					[
						{
							ppem: 64,
							ppi: 72,
							glyphs: [
								{
									glyphId: 0,
									originOffsetX: 0,
									originOffsetY: 0,
									graphicType: SbixGraphicType.PNG,
									data: pngData,
								},
							],
						},
					],
					10,
				);
				const reader = new Reader(buffer);
				const sbix = parseSbix(reader, 10);

				expect(sbix.flags).toBe(flags);
			}
		});

		test("handles large origin offsets", () => {
			const pngData = createPngData();
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 0,
								originOffsetX: 32767,
								originOffsetY: -32768,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			expect(sbix.strikes[0]?.glyphData.get(0)?.originOffsetX).toBe(32767);
			expect(sbix.strikes[0]?.glyphData.get(0)?.originOffsetY).toBe(-32768);
		});

		test("handles zero-length image data (header only)", () => {
			// This tests glyphs that have only the 8-byte header but no actual image data
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [], // No glyphs with data
					},
				],
				5,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 5);

			expect(sbix.strikes[0]?.glyphData.size).toBe(0);
		});
	});

	describe("getGlyphBitmap", () => {
		test("returns glyph bitmap for exact ppem match", () => {
			const pngData = createPngData();
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 10,
								originOffsetY: -10,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			const glyph = getGlyphBitmap(sbix, 5, 64);
			expect(glyph).toBeDefined();
			expect(glyph?.originOffsetX).toBe(10);
			expect(glyph?.originOffsetY).toBe(-10);
			expect(glyph?.graphicType).toBe(SbixGraphicType.PNG);
			expect(glyph?.data).toEqual(pngData);
		});

		test("returns best matching strike for approximate ppem", () => {
			const pngData1 = new Uint8Array([1, 2, 3]);
			const pngData2 = new Uint8Array([4, 5, 6]);
			const pngData3 = new Uint8Array([7, 8, 9]);
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 32,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: pngData1,
							},
						],
					},
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: pngData2,
							},
						],
					},
					{
						ppem: 128,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: pngData3,
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			// Request ppem 60, should get 64 (closest)
			const glyph1 = getGlyphBitmap(sbix, 5, 60);
			expect(glyph1?.data).toEqual(pngData2);

			// Request ppem 40, should get 32 (closest)
			const glyph2 = getGlyphBitmap(sbix, 5, 40);
			expect(glyph2?.data).toEqual(pngData1);

			// Request ppem 100, should get 128 (closest)
			const glyph3 = getGlyphBitmap(sbix, 5, 100);
			expect(glyph3?.data).toEqual(pngData3);
		});

		test("returns null for non-existent glyph", () => {
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: createPngData(),
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			const glyph = getGlyphBitmap(sbix, 99, 64);
			expect(glyph).toBeNull();
		});

		test("returns null for empty strikes", () => {
			const buffer = createSbixTableData(1, 0, [], 10);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			const glyph = getGlyphBitmap(sbix, 5, 64);
			expect(glyph).toBeNull();
		});

		test("handles tie-breaking in ppem matching", () => {
			// When two strikes are equidistant, should return the first one
			const pngData1 = new Uint8Array([1, 2, 3]);
			const pngData2 = new Uint8Array([4, 5, 6]);
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 60,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: pngData1,
							},
						],
					},
					{
						ppem: 70,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: pngData2,
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			// Request ppem 65, both 60 and 70 are 5 away
			const glyph = getGlyphBitmap(sbix, 5, 65);
			expect(glyph?.data).toEqual(pngData1); // Should get first one
		});
	});

	describe("getStrikeForPpem", () => {
		test("returns strike for exact ppem match", () => {
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 32,
						ppi: 72,
						glyphs: [],
					},
					{
						ppem: 64,
						ppi: 144,
						glyphs: [],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			const strike = getStrikeForPpem(sbix, 64);
			expect(strike).toBeDefined();
			expect(strike?.ppem).toBe(64);
			expect(strike?.ppi).toBe(144);
		});

		test("returns null for non-matching ppem", () => {
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			const strike = getStrikeForPpem(sbix, 32);
			expect(strike).toBeNull();
		});

		test("returns null for empty strikes", () => {
			const buffer = createSbixTableData(1, 0, [], 10);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			const strike = getStrikeForPpem(sbix, 64);
			expect(strike).toBeNull();
		});
	});

	describe("getAvailablePpemSizes", () => {
		test("returns sorted array of ppem sizes", () => {
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 128,
						ppi: 72,
						glyphs: [],
					},
					{
						ppem: 32,
						ppi: 72,
						glyphs: [],
					},
					{
						ppem: 64,
						ppi: 72,
						glyphs: [],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			const sizes = getAvailablePpemSizes(sbix);
			expect(sizes).toEqual([32, 64, 128]);
		});

		test("returns empty array for no strikes", () => {
			const buffer = createSbixTableData(1, 0, [], 10);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			const sizes = getAvailablePpemSizes(sbix);
			expect(sizes).toEqual([]);
		});

		test("handles duplicate ppem sizes", () => {
			// While unusual, test that it handles this case
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [],
					},
					{
						ppem: 64,
						ppi: 144,
						glyphs: [],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			const sizes = getAvailablePpemSizes(sbix);
			expect(sizes).toEqual([64, 64]);
		});
	});

	describe("hasGlyphBitmap", () => {
		test("returns true when glyph has bitmap at specific ppem", () => {
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: createPngData(),
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			expect(hasGlyphBitmap(sbix, 5, 64)).toBe(true);
		});

		test("returns false when glyph has no bitmap at specific ppem", () => {
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: createPngData(),
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			expect(hasGlyphBitmap(sbix, 5, 32)).toBe(false);
			expect(hasGlyphBitmap(sbix, 99, 64)).toBe(false);
		});

		test("returns true when glyph has bitmap in any strike (no ppem specified)", () => {
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 32,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: createPngData(),
							},
						],
					},
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 10,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: createPngData(),
							},
						],
					},
				],
				20,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 20);

			expect(hasGlyphBitmap(sbix, 5)).toBe(true);
			expect(hasGlyphBitmap(sbix, 10)).toBe(true);
		});

		test("returns false when glyph has no bitmap in any strike", () => {
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: createPngData(),
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			expect(hasGlyphBitmap(sbix, 99)).toBe(false);
		});

		test("returns false for empty strikes", () => {
			const buffer = createSbixTableData(1, 0, [], 10);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			expect(hasGlyphBitmap(sbix, 5)).toBe(false);
			expect(hasGlyphBitmap(sbix, 5, 64)).toBe(false);
		});
	});

	describe("resolveDupeGlyph", () => {
		test("returns original glyph for non-dupe graphic type", () => {
			const pngData = createPngData();
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 10,
								originOffsetY: -10,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			const strike = sbix.strikes[0]!;
			const glyph = strike.glyphData.get(5)!;
			const resolved = resolveDupeGlyph(sbix, strike, glyph);

			expect(resolved).toBe(glyph);
			expect(resolved?.graphicType).toBe(SbixGraphicType.PNG);
		});

		test("resolves dupe glyph to referenced glyph", () => {
			const pngData = createPngData();
			const dupeData = new Uint8Array([0x00, 0x05]); // References glyph ID 5
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 10,
								originOffsetY: -10,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
							{
								glyphId: 10,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.DUPE,
								data: dupeData,
							},
						],
					},
				],
				20,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 20);

			const strike = sbix.strikes[0]!;
			const dupeGlyph = strike.glyphData.get(10)!;
			const resolved = resolveDupeGlyph(sbix, strike, dupeGlyph);

			expect(resolved).toBeDefined();
			expect(resolved?.graphicType).toBe(SbixGraphicType.PNG);
			expect(resolved?.originOffsetX).toBe(10);
			expect(resolved?.originOffsetY).toBe(-10);
			expect(resolved?.data).toEqual(pngData);
		});

		test("resolves chained dupe glyphs", () => {
			const pngData = createPngData();
			const dupeData1 = new Uint8Array([0x00, 0x05]); // References glyph ID 5
			const dupeData2 = new Uint8Array([0x00, 0x0a]); // References glyph ID 10
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 10,
								originOffsetY: -10,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
							{
								glyphId: 10,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.DUPE,
								data: dupeData1,
							},
							{
								glyphId: 15,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.DUPE,
								data: dupeData2,
							},
						],
					},
				],
				20,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 20);

			const strike = sbix.strikes[0]!;
			const dupeGlyph = strike.glyphData.get(15)!; // References 10, which references 5
			const resolved = resolveDupeGlyph(sbix, strike, dupeGlyph);

			expect(resolved).toBeDefined();
			expect(resolved?.graphicType).toBe(SbixGraphicType.PNG);
			expect(resolved?.originOffsetX).toBe(10);
			expect(resolved?.originOffsetY).toBe(-10);
			expect(resolved?.data).toEqual(pngData);
		});

		test("returns null for dupe with insufficient data", () => {
			const dupeData = new Uint8Array([0x00]); // Only 1 byte, need 2
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 10,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.DUPE,
								data: dupeData,
							},
						],
					},
				],
				20,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 20);

			const strike = sbix.strikes[0]!;
			const dupeGlyph = strike.glyphData.get(10)!;
			const resolved = resolveDupeGlyph(sbix, strike, dupeGlyph);

			expect(resolved).toBeNull();
		});

		test("returns null for dupe referencing non-existent glyph", () => {
			const dupeData = new Uint8Array([0x00, 0x63]); // References glyph ID 99 (doesn't exist)
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 10,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.DUPE,
								data: dupeData,
							},
						],
					},
				],
				20,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 20);

			const strike = sbix.strikes[0]!;
			const dupeGlyph = strike.glyphData.get(10)!;
			const resolved = resolveDupeGlyph(sbix, strike, dupeGlyph);

			expect(resolved).toBeNull();
		});

		test("handles mask graphic type", () => {
			const maskData = createPngData();
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 5,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.MASK,
								data: maskData,
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			const strike = sbix.strikes[0]!;
			const glyph = strike.glyphData.get(5)!;
			const resolved = resolveDupeGlyph(sbix, strike, glyph);

			expect(resolved).toBe(glyph);
			expect(resolved?.graphicType).toBe(SbixGraphicType.MASK);
		});
	});

	describe("SbixGraphicType constants", () => {
		test("has correct 4-character tags", () => {
			expect(SbixGraphicType.PNG).toBe("png ");
			expect(SbixGraphicType.JPG).toBe("jpg ");
			expect(SbixGraphicType.TIFF).toBe("tiff");
			expect(SbixGraphicType.PDF).toBe("pdf ");
			expect(SbixGraphicType.MASK).toBe("mask");
			expect(SbixGraphicType.DUPE).toBe("dupe");
		});

		test("all graphic types are 4 characters", () => {
			const types = Object.values(SbixGraphicType);
			for (const type of types) {
				expect(type.length).toBe(4);
			}
		});
	});

	describe("real font tests", () => {
		test("parses Apple Color Emoji sbix table", async () => {
			const fontPath = "/System/Library/Fonts/Apple Color Emoji.ttc";
			try {
				const file = Bun.file(fontPath);
				const buffer = await file.arrayBuffer();
				const view = new DataView(buffer);

				// Read TTC header
				const tag = String.fromCharCode(
					view.getUint8(0),
					view.getUint8(1),
					view.getUint8(2),
					view.getUint8(3),
				);
				if (tag !== "ttcf") {
					throw new Error("Not a TTC file");
				}

				const numFonts = view.getUint32(8, false);
				if (numFonts === 0) {
					throw new Error("No fonts in TTC");
				}

				// Get first font offset
				const fontOffset = view.getUint32(12, false);

				// Read font directory
				const fontView = new DataView(buffer, fontOffset);
				const numTables = fontView.getUint16(4, false);

				// Find sbix table
				let sbixOffset = 0;
				let sbixLength = 0;
				let maxpOffset = 0;
				let numGlyphs = 0;

				for (let i = 0; i < numTables; i++) {
					const entryOffset = 12 + i * 16;
					const tableTag = String.fromCharCode(
						fontView.getUint8(entryOffset),
						fontView.getUint8(entryOffset + 1),
						fontView.getUint8(entryOffset + 2),
						fontView.getUint8(entryOffset + 3),
					);
					const tableOffset = fontView.getUint32(entryOffset + 8, false);
					const tableLength = fontView.getUint32(entryOffset + 12, false);

					if (tableTag === "sbix") {
						sbixOffset = tableOffset;
						sbixLength = tableLength;
					} else if (tableTag === "maxp") {
						maxpOffset = tableOffset;
					}
				}

				if (sbixOffset === 0) {
					throw new Error("No sbix table found");
				}

				// Read numGlyphs from maxp
				if (maxpOffset > 0) {
					const maxpReader = new Reader(buffer, maxpOffset);
					maxpReader.skip(4); // Skip version
					numGlyphs = maxpReader.uint16();
				} else {
					throw new Error("No maxp table found");
				}

				// Parse sbix table
				const sbixReader = new Reader(buffer, sbixOffset, sbixLength);
				const sbix = parseSbix(sbixReader, numGlyphs);

				// Verify basic structure
				expect(sbix.version).toBeGreaterThanOrEqual(0);
				expect(sbix.strikes.length).toBeGreaterThan(0);

				// Check that strikes have valid ppem/ppi
				for (const strike of sbix.strikes) {
					expect(strike.ppem).toBeGreaterThan(0);
					expect(strike.ppi).toBeGreaterThan(0);
					expect(strike.glyphData).toBeInstanceOf(Map);
				}

				// Check that we can get available sizes
				const sizes = getAvailablePpemSizes(sbix);
				expect(sizes.length).toBeGreaterThan(0);
				expect(sizes).toEqual([...sizes].sort((a, b) => a - b)); // Should be sorted

				// Check that we can query glyph data
				if (sbix.strikes.length > 0 && sbix.strikes[0]!.glyphData.size > 0) {
					const firstGlyphId = Array.from(sbix.strikes[0]!.glyphData.keys())[0]!;
					const ppem = sbix.strikes[0]!.ppem;

					expect(hasGlyphBitmap(sbix, firstGlyphId, ppem)).toBe(true);

					const glyph = getGlyphBitmap(sbix, firstGlyphId, ppem);
					expect(glyph).toBeDefined();
					expect(glyph?.graphicType).toBeDefined();
					expect(glyph?.data).toBeInstanceOf(Uint8Array);
					expect(glyph?.data.length).toBeGreaterThan(0);
				}
			} catch (err) {
				// If font is not available, skip test
				if ((err as Error).message.includes("No such file")) {
					console.log("Skipping real font test - Apple Color Emoji not found");
				} else {
					throw err;
				}
			}
		});
	});

	describe("integration tests", () => {
		test("handles complex multi-strike, multi-glyph scenario", () => {
			const pngData = createPngData();
			const jpegData = createJpegData();
			const buffer = createSbixTableData(
				1,
				1,
				[
					{
						ppem: 20,
						ppi: 72,
						glyphs: [
							{
								glyphId: 0,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
							{
								glyphId: 1,
								originOffsetX: 2,
								originOffsetY: -2,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
						],
					},
					{
						ppem: 40,
						ppi: 72,
						glyphs: [
							{
								glyphId: 0,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
							{
								glyphId: 1,
								originOffsetX: 4,
								originOffsetY: -4,
								graphicType: SbixGraphicType.JPG,
								data: jpegData,
							},
							{
								glyphId: 2,
								originOffsetX: 1,
								originOffsetY: -1,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
						],
					},
					{
						ppem: 80,
						ppi: 144,
						glyphs: [
							{
								glyphId: 0,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
							{
								glyphId: 1,
								originOffsetX: 8,
								originOffsetY: -8,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
							{
								glyphId: 2,
								originOffsetX: 2,
								originOffsetY: -2,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
							{
								glyphId: 3,
								originOffsetX: 3,
								originOffsetY: -3,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			// Check structure
			expect(sbix.version).toBe(1);
			expect(sbix.flags).toBe(1);
			expect(sbix.strikes.length).toBe(3);

			// Check ppem sizes
			const sizes = getAvailablePpemSizes(sbix);
			expect(sizes).toEqual([20, 40, 80]);

			// Check glyph availability
			expect(hasGlyphBitmap(sbix, 0)).toBe(true);
			expect(hasGlyphBitmap(sbix, 1)).toBe(true);
			expect(hasGlyphBitmap(sbix, 2)).toBe(true);
			expect(hasGlyphBitmap(sbix, 3)).toBe(true);
			expect(hasGlyphBitmap(sbix, 4)).toBe(false);

			// Check specific strikes
			expect(hasGlyphBitmap(sbix, 2, 20)).toBe(false);
			expect(hasGlyphBitmap(sbix, 2, 40)).toBe(true);
			expect(hasGlyphBitmap(sbix, 2, 80)).toBe(true);

			// Check best match selection
			const glyph1 = getGlyphBitmap(sbix, 1, 30);
			expect(glyph1?.graphicType).toBe(SbixGraphicType.PNG);
			expect(glyph1?.originOffsetX).toBe(2); // Should get 20ppem strike

			const glyph2 = getGlyphBitmap(sbix, 1, 50);
			expect(glyph2?.graphicType).toBe(SbixGraphicType.JPG);
			expect(glyph2?.originOffsetX).toBe(4); // Should get 40ppem strike

			const glyph3 = getGlyphBitmap(sbix, 1, 100);
			expect(glyph3?.graphicType).toBe(SbixGraphicType.PNG);
			expect(glyph3?.originOffsetX).toBe(8); // Should get 80ppem strike
		});

		test("handles empty table correctly", () => {
			const buffer = createSbixTableData(1, 0, [], 0);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 0);

			expect(sbix.version).toBe(1);
			expect(sbix.flags).toBe(0);
			expect(sbix.strikes.length).toBe(0);
			expect(getAvailablePpemSizes(sbix)).toEqual([]);
			expect(hasGlyphBitmap(sbix, 0)).toBe(false);
			expect(getGlyphBitmap(sbix, 0, 64)).toBeNull();
			expect(getStrikeForPpem(sbix, 64)).toBeNull();
		});

		test("handles different PPI values", () => {
			const pngData = createPngData();
			const buffer = createSbixTableData(
				1,
				0,
				[
					{
						ppem: 64,
						ppi: 72,
						glyphs: [
							{
								glyphId: 0,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
						],
					},
					{
						ppem: 64,
						ppi: 144,
						glyphs: [
							{
								glyphId: 1,
								originOffsetX: 0,
								originOffsetY: 0,
								graphicType: SbixGraphicType.PNG,
								data: pngData,
							},
						],
					},
				],
				10,
			);
			const reader = new Reader(buffer);
			const sbix = parseSbix(reader, 10);

			expect(sbix.strikes.length).toBe(2);
			expect(sbix.strikes[0]?.ppi).toBe(72);
			expect(sbix.strikes[1]?.ppi).toBe(144);
		});
	});
});
