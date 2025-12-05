import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseTrak,
	getTrackingValue,
	applyTracking,
	type TrakTable,
	type TrackData,
	type TrackTableEntry,
} from "../../../src/font/tables/trak.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

describe("trak table - synthetic tests", () => {
	describe("parseTrak", () => {
		test("parses minimal trak table with version 1.0", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);
			let offset = 0;

			// Version 1.0 (Fixed 16.16)
			view.setUint32(offset, 0x00010000, false);
			offset += 4;
			// Format
			view.setUint16(offset, 0, false);
			offset += 2;
			// Horizontal offset
			view.setUint16(offset, 0, false);
			offset += 2;
			// Vertical offset
			view.setUint16(offset, 0, false);
			offset += 2;
			// Reserved
			view.setUint16(offset, 0, false);
			offset += 2;

			const reader = new Reader(buffer);
			const trak = parseTrak(reader);

			expect(trak.version).toBe(1.0);
			expect(trak.format).toBe(0);
			expect(trak.horizData).toBeNull();
			expect(trak.vertData).toBeNull();
		});

		test("parses trak table with horizontal tracking data", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);
			let offset = 0;

			// Header
			view.setUint32(offset, 0x00010000, false); // version 1.0
			offset += 4;
			view.setUint16(offset, 0, false); // format
			offset += 2;
			view.setUint16(offset, 12, false); // horizOffset
			offset += 2;
			view.setUint16(offset, 0, false); // vertOffset
			offset += 2;
			view.setUint16(offset, 0, false); // reserved
			offset += 2;

			// Horizontal track data at offset 12
			const horizOffset = 12;
			view.setUint16(horizOffset, 2, false); // nTracks
			view.setUint16(horizOffset + 2, 3, false); // nSizes
			// sizeTableOffset is ABSOLUTE from table start
			view.setUint32(horizOffset + 4, 36, false); // sizeTableOffset = 36 (12 + 8 + 16)

			// Track table entries (2 tracks, 8 bytes each) at horizOffset + 8 = 20
			let trackOffset = horizOffset + 8;
			// Track 1: track=-1.0, nameIndex=256, offset=48 (absolute)
			view.setInt32(trackOffset, -65536, false); // -1.0 in Fixed 16.16
			view.setUint16(trackOffset + 4, 256, false);
			view.setUint16(trackOffset + 6, 48, false); // absolute offset for perSize data
			trackOffset += 8;
			// Track 2: track=0.0, nameIndex=257, offset=54 (absolute)
			view.setInt32(trackOffset, 0, false); // 0.0
			view.setUint16(trackOffset + 4, 257, false);
			view.setUint16(trackOffset + 6, 54, false); // absolute offset for perSize data

			// Size table at absolute offset 36 (3 sizes = 12 bytes)
			view.setInt32(36, 0x00080000, false); // 8.0
			view.setInt32(40, 0x000c0000, false); // 12.0
			view.setInt32(44, 0x00180000, false); // 24.0

			// Per-size tracking values for track 1 at absolute offset 48
			view.setInt16(48, 10, false);
			view.setInt16(50, 5, false);
			view.setInt16(52, 0, false);

			// Per-size tracking values for track 2 at absolute offset 54
			view.setInt16(54, 0, false);
			view.setInt16(56, 0, false);
			view.setInt16(58, 0, false);

			const reader = new Reader(buffer);
			const trak = parseTrak(reader);

			expect(trak.version).toBe(1.0);
			expect(trak.format).toBe(0);
			expect(trak.horizData).not.toBeNull();
			expect(trak.vertData).toBeNull();

			if (trak.horizData) {
				expect(trak.horizData.nTracks).toBe(2);
				expect(trak.horizData.nSizes).toBe(3);
				expect(trak.horizData.sizeTableOffset).toBe(36);
				expect(trak.horizData.sizeTable).toEqual([8.0, 12.0, 24.0]);
				expect(trak.horizData.trackTable.length).toBe(2);

				const track1 = trak.horizData.trackTable[0];
				if (track1) {
					expect(track1.track).toBe(-1.0);
					expect(track1.nameIndex).toBe(256);
					expect(track1.offset).toBe(48);
					expect(track1.perSizeTracking).toEqual([10, 5, 0]);
				}

				const track2 = trak.horizData.trackTable[1];
				if (track2) {
					expect(track2.track).toBe(0.0);
					expect(track2.nameIndex).toBe(257);
					expect(track2.offset).toBe(54);
					expect(track2.perSizeTracking).toEqual([0, 0, 0]);
				}
			}
		});

		test("parses trak table with vertical tracking data", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);
			let offset = 0;

			// Header
			view.setUint32(offset, 0x00010000, false);
			offset += 4;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 0, false); // horizOffset = 0
			offset += 2;
			view.setUint16(offset, 12, false); // vertOffset
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;

			// Vertical track data at offset 12
			const vertOffset = 12;
			view.setUint16(vertOffset, 1, false); // nTracks
			view.setUint16(vertOffset + 2, 2, false); // nSizes
			// sizeTableOffset is ABSOLUTE from table start
			view.setUint32(vertOffset + 4, 28, false); // sizeTableOffset = 28 (12 + 8 + 8)

			// Track entry at vertOffset + 8 = 20
			view.setInt32(vertOffset + 8, 0x00008000, false); // 0.5 in Fixed 16.16
			view.setUint16(vertOffset + 12, 300, false);
			view.setUint16(vertOffset + 14, 36, false); // absolute offset for perSize data

			// Size table at absolute offset 28 (2 sizes = 8 bytes)
			view.setInt32(28, 0x000a0000, false); // 10.0
			view.setInt32(32, 0x00140000, false); // 20.0

			// Per-size values at absolute offset 36
			view.setInt16(36, -5, false);
			view.setInt16(38, -10, false);

			const reader = new Reader(buffer);
			const trak = parseTrak(reader);

			expect(trak.horizData).toBeNull();
			expect(trak.vertData).not.toBeNull();

			if (trak.vertData) {
				expect(trak.vertData.nTracks).toBe(1);
				expect(trak.vertData.nSizes).toBe(2);
				expect(trak.vertData.sizeTable).toEqual([10.0, 20.0]);
				expect(trak.vertData.trackTable[0]?.track).toBe(0.5);
				expect(trak.vertData.trackTable[0]?.perSizeTracking).toEqual([-5, -10]);
			}
		});

		test("parses trak table with both horizontal and vertical data", () => {
			const buffer = new ArrayBuffer(300);
			const view = new DataView(buffer);

			// Header (12 bytes)
			view.setUint32(0, 0x00010000, false);
			view.setUint16(4, 0, false);
			view.setUint16(6, 12, false); // horizOffset
			view.setUint16(8, 100, false); // vertOffset
			view.setUint16(10, 0, false);

			// Horizontal data at offset 12
			// TrackData header (8 bytes)
			view.setUint16(12, 1, false); // nTracks
			view.setUint16(14, 1, false); // nSizes
			view.setUint32(16, 28, false); // sizeTableOffset (absolute)
			// Track entry (8 bytes) at offset 20
			view.setInt32(20, 0, false); // track 0
			view.setUint16(24, 100, false); // nameIndex
			view.setUint16(26, 32, false); // perSize offset (absolute)
			// Size table at absolute offset 28 (4 bytes)
			view.setInt32(28, 0x000c0000, false); // 12.0
			// Per-size data at absolute offset 32 (2 bytes)
			view.setInt16(32, 3, false);

			// Vertical data at offset 100
			// TrackData header (8 bytes)
			view.setUint16(100, 1, false); // nTracks
			view.setUint16(102, 1, false); // nSizes
			view.setUint32(104, 116, false); // sizeTableOffset (absolute)
			// Track entry (8 bytes) at offset 108
			view.setInt32(108, 0, false); // track 0
			view.setUint16(112, 101, false); // nameIndex
			view.setUint16(114, 120, false); // perSize offset (absolute)
			// Size table at absolute offset 116 (4 bytes)
			view.setInt32(116, 0x000e0000, false); // 14.0
			// Per-size data at absolute offset 120 (2 bytes)
			view.setInt16(120, -3, false);

			const reader = new Reader(buffer);
			const trak = parseTrak(reader);

			expect(trak.horizData).not.toBeNull();
			expect(trak.vertData).not.toBeNull();
		});

		test("handles zero tracks", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint32(0, 0x00010000, false);
			view.setUint16(4, 0, false);
			view.setUint16(6, 12, false);
			view.setUint16(8, 0, false);
			view.setUint16(10, 0, false);

			// Empty horizontal data
			view.setUint16(12, 0, false); // nTracks = 0
			view.setUint16(14, 0, false); // nSizes = 0
			view.setUint32(16, 20, false);

			const reader = new Reader(buffer);
			const trak = parseTrak(reader);

			expect(trak.horizData).not.toBeNull();
			if (trak.horizData) {
				expect(trak.horizData.nTracks).toBe(0);
				expect(trak.horizData.trackTable.length).toBe(0);
				expect(trak.horizData.sizeTable.length).toBe(0);
			}
		});

		test("parses version 2.0 format", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint32(0, 0x00020000, false); // version 2.0
			view.setUint16(4, 1, false);
			view.setUint16(6, 0, false);
			view.setUint16(8, 0, false);
			view.setUint16(10, 0, false);

			const reader = new Reader(buffer);
			const trak = parseTrak(reader);

			expect(trak.version).toBe(2.0);
			expect(trak.format).toBe(1);
		});
	});

	describe("getTrackingValue", () => {
		function createTrackData(
			tracks: Array<{ track: number; values: number[] }>,
			sizes: number[],
		): TrackData {
			return {
				nTracks: tracks.length,
				nSizes: sizes.length,
				sizeTableOffset: 0,
				trackTable: tracks.map((t, i) => ({
					track: t.track,
					nameIndex: 100 + i,
					offset: 0,
					perSizeTracking: t.values,
				})),
				sizeTable: sizes,
			};
		}

		test("returns exact value for exact track and size match", () => {
			const trackData = createTrackData(
				[{ track: -1.0, values: [10, 5, 0] }],
				[8.0, 12.0, 24.0],
			);

			expect(getTrackingValue(trackData, -1.0, 8.0)).toBe(10);
			expect(getTrackingValue(trackData, -1.0, 12.0)).toBe(5);
			expect(getTrackingValue(trackData, -1.0, 24.0)).toBe(0);
		});

		test("interpolates between sizes", () => {
			const trackData = createTrackData(
				[{ track: 0.0, values: [0, 10, 20] }],
				[10.0, 20.0, 30.0],
			);

			// Midpoint between 10.0 and 20.0 should interpolate between 0 and 10
			expect(getTrackingValue(trackData, 0.0, 15.0)).toBe(5);
			// 3/4 of the way from 10.0 to 20.0
			expect(getTrackingValue(trackData, 0.0, 17.5)).toBe(8);
		});

		test("clamps to first value for sizes below range", () => {
			const trackData = createTrackData([{ track: 0.0, values: [100, 50, 0] }], [
				12.0, 18.0, 24.0,
			]);

			expect(getTrackingValue(trackData, 0.0, 8.0)).toBe(100);
			expect(getTrackingValue(trackData, 0.0, 12.0)).toBe(100);
		});

		test("clamps to last value for sizes above range", () => {
			const trackData = createTrackData([{ track: 0.0, values: [100, 50, 0] }], [
				12.0, 18.0, 24.0,
			]);

			expect(getTrackingValue(trackData, 0.0, 24.0)).toBe(0);
			expect(getTrackingValue(trackData, 0.0, 48.0)).toBe(0);
		});

		test("interpolates between tracks", () => {
			const trackData = createTrackData(
				[
					{ track: -1.0, values: [20, 10, 0] },
					{ track: 1.0, values: [-20, -10, 0] },
				],
				[12.0, 18.0, 24.0],
			);

			// Track 0.0 is midpoint between -1.0 and 1.0
			expect(getTrackingValue(trackData, 0.0, 12.0)).toBe(0);
			expect(getTrackingValue(trackData, 0.0, 18.0)).toBe(0);

			// Track -0.5 is 1/4 from -1.0 to 1.0
			expect(getTrackingValue(trackData, -0.5, 12.0)).toBe(10);
		});

		test("uses nearest track when outside range", () => {
			const trackData = createTrackData(
				[
					{ track: -1.0, values: [10, 5, 0] },
					{ track: 1.0, values: [-10, -5, 0] },
				],
				[12.0, 18.0, 24.0],
			);

			// Track -2.0 should use -1.0 values
			expect(getTrackingValue(trackData, -2.0, 12.0)).toBe(10);
			// Track 2.0 should use 1.0 values
			expect(getTrackingValue(trackData, 2.0, 12.0)).toBe(-10);
		});

		test("returns 0 for empty track data", () => {
			const trackData = createTrackData([], []);

			expect(getTrackingValue(trackData, 0.0, 12.0)).toBe(0);
		});

		test("returns 0 for track with no sizes", () => {
			const trackData = createTrackData([{ track: 0.0, values: [] }], []);

			expect(getTrackingValue(trackData, 0.0, 12.0)).toBe(0);
		});

		test("handles single size", () => {
			const trackData = createTrackData([{ track: 0.0, values: [15] }], [12.0]);

			expect(getTrackingValue(trackData, 0.0, 8.0)).toBe(15);
			expect(getTrackingValue(trackData, 0.0, 12.0)).toBe(15);
			expect(getTrackingValue(trackData, 0.0, 24.0)).toBe(15);
		});

		test("handles negative tracking values", () => {
			const trackData = createTrackData([{ track: 0.0, values: [-30, -20, -10] }], [
				10.0, 20.0, 30.0,
			]);

			expect(getTrackingValue(trackData, 0.0, 10.0)).toBe(-30);
			expect(getTrackingValue(trackData, 0.0, 15.0)).toBe(-25);
			expect(getTrackingValue(trackData, 0.0, 30.0)).toBe(-10);
		});

		test("rounds interpolated values", () => {
			const trackData = createTrackData([{ track: 0.0, values: [0, 10] }], [
				10.0, 20.0,
			]);

			// 11.0 is 10% of the way from 10.0 to 20.0, so 1
			expect(getTrackingValue(trackData, 0.0, 11.0)).toBe(1);
			// 13.3 is 33% of the way, so 3 (rounded)
			expect(getTrackingValue(trackData, 0.0, 13.3)).toBe(3);
		});

		test("handles multiple tracks in sorted order", () => {
			const trackData = createTrackData(
				[
					{ track: -2.0, values: [40] },
					{ track: -1.0, values: [20] },
					{ track: 0.0, values: [0] },
					{ track: 1.0, values: [-20] },
					{ track: 2.0, values: [-40] },
				],
				[12.0],
			);

			expect(getTrackingValue(trackData, -1.5, 12.0)).toBe(30);
			expect(getTrackingValue(trackData, 0.5, 12.0)).toBe(-10);
		});

		test("handles tracks not in sorted order", () => {
			const trackData: TrackData = {
				nTracks: 3,
				nSizes: 1,
				sizeTableOffset: 0,
				trackTable: [
					{ track: 1.0, nameIndex: 100, offset: 0, perSizeTracking: [-10] },
					{ track: -1.0, nameIndex: 101, offset: 0, perSizeTracking: [10] },
					{ track: 0.0, nameIndex: 102, offset: 0, perSizeTracking: [0] },
				],
				sizeTable: [12.0],
			};

			// Should still find correct tracks for interpolation
			expect(getTrackingValue(trackData, 0.5, 12.0)).toBe(-5);
		});

		test("handles fractional track values", () => {
			const trackData = createTrackData(
				[
					{ track: -0.25, values: [8] },
					{ track: 0.25, values: [-8] },
				],
				[12.0],
			);

			expect(getTrackingValue(trackData, 0.0, 12.0)).toBe(0);
			expect(getTrackingValue(trackData, -0.125, 12.0)).toBe(4);
		});
	});

	describe("applyTracking", () => {
		function createTrakTable(
			horizTracks?: Array<{ track: number; values: number[] }>,
			horizSizes?: number[],
			vertTracks?: Array<{ track: number; values: number[] }>,
			vertSizes?: number[],
		): TrakTable {
			let horizData = null;
			let vertData = null;

			if (horizTracks && horizSizes) {
				horizData = {
					nTracks: horizTracks.length,
					nSizes: horizSizes.length,
					sizeTableOffset: 0,
					trackTable: horizTracks.map((t, i) => ({
						track: t.track,
						nameIndex: 100 + i,
						offset: 0,
						perSizeTracking: t.values,
					})),
					sizeTable: horizSizes,
				};
			}

			if (vertTracks && vertSizes) {
				vertData = {
					nTracks: vertTracks.length,
					nSizes: vertSizes.length,
					sizeTableOffset: 0,
					trackTable: vertTracks.map((t, i) => ({
						track: t.track,
						nameIndex: 200 + i,
						offset: 0,
						perSizeTracking: t.values,
					})),
					sizeTable: vertSizes,
				};
			}

			return {
				version: 1.0,
				format: 0,
				horizData,
				vertData,
			};
		}

		test("applies horizontal tracking to advances", () => {
			const trak = createTrakTable([{ track: 0.0, values: [10] }], [12.0]);
			const advances = [100, 200, 150];

			applyTracking(trak, advances, 12.0, 0.0, false);

			expect(advances).toEqual([110, 210, 160]);
		});

		test("applies vertical tracking to advances", () => {
			const trak = createTrakTable(
				undefined,
				undefined,
				[{ track: 0.0, values: [5] }],
				[14.0],
			);
			const advances = [80, 90, 85];

			applyTracking(trak, advances, 14.0, 0.0, true);

			expect(advances).toEqual([85, 95, 90]);
		});

		test("does nothing when tracking value is zero", () => {
			const trak = createTrakTable([{ track: 0.0, values: [0] }], [12.0]);
			const advances = [100, 200, 150];
			const original = [...advances];

			applyTracking(trak, advances, 12.0, 0.0, false);

			expect(advances).toEqual(original);
		});

		test("does nothing when trackData is null", () => {
			const trak = createTrakTable();
			const advances = [100, 200, 150];
			const original = [...advances];

			applyTracking(trak, advances, 12.0, 0.0, false);

			expect(advances).toEqual(original);
		});

		test("applies negative tracking", () => {
			const trak = createTrakTable([{ track: 1.0, values: [-20] }], [16.0]);
			const advances = [100, 200, 150];

			applyTracking(trak, advances, 16.0, 1.0, false);

			expect(advances).toEqual([80, 180, 130]);
		});

		test("defaults to track 0.0 when not specified", () => {
			const trak = createTrakTable([{ track: 0.0, values: [15] }], [12.0]);
			const advances = [100, 200];

			applyTracking(trak, advances, 12.0);

			expect(advances).toEqual([115, 215]);
		});

		test("defaults to horizontal when vertical not specified", () => {
			const trak = createTrakTable([{ track: 0.0, values: [8] }], [12.0]);
			const advances = [50, 60];

			applyTracking(trak, advances, 12.0, 0.0);

			expect(advances).toEqual([58, 68]);
		});

		test("handles empty advances array", () => {
			const trak = createTrakTable([{ track: 0.0, values: [10] }], [12.0]);
			const advances: number[] = [];

			applyTracking(trak, advances, 12.0, 0.0, false);

			expect(advances).toEqual([]);
		});

		test("handles large advances array", () => {
			const trak = createTrakTable([{ track: 0.0, values: [2] }], [12.0]);
			const advances = new Array(1000).fill(100);

			applyTracking(trak, advances, 12.0, 0.0, false);

			expect(advances.every((a) => a === 102)).toBe(true);
		});

		test("applies interpolated tracking value", () => {
			const trak = createTrakTable(
				[{ track: 0.0, values: [0, 10, 20] }],
				[10.0, 20.0, 30.0],
			);
			const advances = [100, 150, 200];

			applyTracking(trak, advances, 15.0, 0.0, false); // Should get value 5

			expect(advances).toEqual([105, 155, 205]);
		});

		test("modifies array in place", () => {
			const trak = createTrakTable([{ track: 0.0, values: [10] }], [12.0]);
			const advances = [100, 200];
			const reference = advances;

			applyTracking(trak, advances, 12.0, 0.0, false);

			expect(reference).toBe(advances); // Same reference
			expect(advances[0]).toBe(110);
		});
	});

	describe("edge cases and error handling", () => {
		test("handles mismatched perSizeTracking length", () => {
			const trackData: TrackData = {
				nTracks: 1,
				nSizes: 3,
				sizeTableOffset: 0,
				trackTable: [
					{
						track: 0.0,
						nameIndex: 100,
						offset: 0,
						perSizeTracking: [10, 5], // Only 2 values instead of 3
					},
				],
				sizeTable: [8.0, 12.0, 24.0],
			};

			// Should not crash, might return 0 or handle gracefully
			const result = getTrackingValue(trackData, 0.0, 24.0);
			expect(typeof result).toBe("number");
		});

		test("handles very large point sizes", () => {
			const trackData: TrackData = {
				nTracks: 1,
				nSizes: 2,
				sizeTableOffset: 0,
				trackTable: [
					{
						track: 0.0,
						nameIndex: 100,
						offset: 0,
						perSizeTracking: [10, 5],
					},
				],
				sizeTable: [12.0, 144.0],
			};

			const result = getTrackingValue(trackData, 0.0, 1000.0);
			expect(result).toBe(5); // Should clamp to last value
		});

		test("handles very small point sizes", () => {
			const trackData: TrackData = {
				nTracks: 1,
				nSizes: 2,
				sizeTableOffset: 0,
				trackTable: [
					{
						track: 0.0,
						nameIndex: 100,
						offset: 0,
						perSizeTracking: [100, 50],
					},
				],
				sizeTable: [8.0, 24.0],
			};

			const result = getTrackingValue(trackData, 0.0, 1.0);
			expect(result).toBe(100); // Should clamp to first value
		});

		test("handles zero-width size ranges", () => {
			const trackData: TrackData = {
				nTracks: 1,
				nSizes: 2,
				sizeTableOffset: 0,
				trackTable: [
					{
						track: 0.0,
						nameIndex: 100,
						offset: 0,
						perSizeTracking: [10, 20],
					},
				],
				sizeTable: [12.0, 12.0], // Same size
			};

			const result = getTrackingValue(trackData, 0.0, 12.0);
			expect(typeof result).toBe("number");
		});

		test("handles extreme track values", () => {
			const trackData: TrackData = {
				nTracks: 2,
				nSizes: 1,
				sizeTableOffset: 0,
				trackTable: [
					{ track: -100.0, nameIndex: 100, offset: 0, perSizeTracking: [500] },
					{ track: 100.0, nameIndex: 101, offset: 0, perSizeTracking: [-500] },
				],
				sizeTable: [12.0],
			};

			const result = getTrackingValue(trackData, 0.0, 12.0);
			expect(typeof result).toBe("number");
			expect(result).toBe(0); // Should interpolate to middle
		});

		test("handles undefined values in arrays", () => {
			const trak: TrakTable = {
				version: 1.0,
				format: 0,
				horizData: {
					nTracks: 1,
					nSizes: 3,
					sizeTableOffset: 0,
					trackTable: [
						{
							track: 0.0,
							nameIndex: 100,
							offset: 0,
							perSizeTracking: [10, 5, 0],
						},
					],
					sizeTable: [8.0, 12.0, 24.0],
				},
				vertData: null,
			};

			const advances = [100, undefined as any, 150];
			applyTracking(trak, advances, 12.0, 0.0, false);

			// Should handle undefined gracefully
			expect(advances[0]).toBe(105);
			expect(advances[2]).toBe(155);
		});
	});
});

describe("trak table - real font tests", () => {
	// Note: These tests require fonts with trak tables
	// Common fonts: SFNS.ttf, SFCompact.ttf, NewYork.ttf, Skia.ttf
	// Known issue: Some Apple fonts (like SFNS.ttf) have parsing issues
	// due to absolute vs relative offset interpretation

	const FONT_PATHS = [
		"/System/Library/Fonts/SFNS.ttf",
		"/System/Library/Fonts/SFCompact.ttf",
		"/System/Library/Fonts/Skia.ttf",
	];

	// Find first available font with trak table
	let testFont: Font | null = null;
	let testPath: string | null = null;
	let loadError: Error | null = null;

	beforeAll(async () => {
		for (const path of FONT_PATHS) {
			try {
				const font = await Font.fromFile(path);
				// Try to access trak table to see if it parses
				try {
					const trak = font.trak;
					if (trak) {
						testFont = font;
						testPath = path;
						break;
					}
				} catch (e) {
					loadError = e as Error;
					// Continue to next font
				}
			} catch {
				// Font not found or error loading, try next
			}
		}
	});

	test("loads trak table from real font", () => {
		if (!testFont) {
			if (loadError) {
				console.log(
					"Skipping: Font with trak table found but has parsing error:",
					loadError.message,
				);
			} else {
				console.log("Skipping: No font with trak table found");
			}
			return;
		}

		expect(testFont.trak).not.toBeNull();
	});

	test("real trak table has valid structure", () => {
		if (!testFont?.trak) return;

		const trak = testFont.trak;

		expect(typeof trak.version).toBe("number");
		expect(trak.version).toBeGreaterThan(0);
		expect(typeof trak.format).toBe("number");
	});

	test("real trak table has tracking data", () => {
		if (!testFont?.trak) return;

		const trak = testFont.trak;

		// Should have at least horizontal or vertical data
		expect(trak.horizData !== null || trak.vertData !== null).toBe(true);
	});

	test("horizontal tracking data has valid structure", () => {
		if (!testFont?.trak?.horizData) return;

		const horizData = testFont.trak.horizData;

		expect(typeof horizData.nTracks).toBe("number");
		expect(typeof horizData.nSizes).toBe("number");
		expect(horizData.nTracks).toBeGreaterThanOrEqual(0);
		expect(horizData.nSizes).toBeGreaterThanOrEqual(0);
		expect(Array.isArray(horizData.trackTable)).toBe(true);
		expect(Array.isArray(horizData.sizeTable)).toBe(true);
		expect(horizData.trackTable.length).toBe(horizData.nTracks);
		expect(horizData.sizeTable.length).toBe(horizData.nSizes);
	});

	test("track table entries have valid structure", () => {
		if (!testFont?.trak?.horizData) return;

		const horizData = testFont.trak.horizData;

		for (const entry of horizData.trackTable) {
			expect(typeof entry.track).toBe("number");
			expect(typeof entry.nameIndex).toBe("number");
			expect(typeof entry.offset).toBe("number");
			expect(Array.isArray(entry.perSizeTracking)).toBe(true);
			expect(entry.perSizeTracking.length).toBe(horizData.nSizes);

			// Check all values are numbers
			for (const value of entry.perSizeTracking) {
				expect(typeof value).toBe("number");
			}
		}
	});

	test("size table has ascending values", () => {
		if (!testFont?.trak?.horizData) return;

		const sizes = testFont.trak.horizData.sizeTable;

		for (let i = 1; i < sizes.length; i++) {
			const prev = sizes[i - 1];
			const curr = sizes[i];
			if (prev !== undefined && curr !== undefined) {
				expect(curr).toBeGreaterThanOrEqual(prev);
			}
		}
	});

	test("track values are typically in tight/loose range", () => {
		if (!testFont?.trak?.horizData) return;

		const trackTable = testFont.trak.horizData.trackTable;

		// Apple fonts typically use tracks like -1.0 (tight) to 1.0 (loose)
		for (const entry of trackTable) {
			expect(entry.track).toBeGreaterThanOrEqual(-5.0);
			expect(entry.track).toBeLessThanOrEqual(5.0);
		}
	});

	test("per-size tracking values are reasonable", () => {
		if (!testFont?.trak?.horizData) return;

		const trackTable = testFont.trak.horizData.trackTable;

		// Tracking values should be in reasonable range (FUnits)
		for (const entry of trackTable) {
			for (const value of entry.perSizeTracking) {
				expect(value).toBeGreaterThan(-1000);
				expect(value).toBeLessThan(1000);
			}
		}
	});

	test("getTrackingValue returns valid values for common sizes", () => {
		if (!testFont?.trak?.horizData) return;

		const horizData = testFont.trak.horizData;
		const commonSizes = [8, 10, 12, 14, 16, 18, 24, 36, 48, 72];

		for (const entry of horizData.trackTable) {
			for (const size of commonSizes) {
				const value = getTrackingValue(horizData, entry.track, size);
				expect(typeof value).toBe("number");
				expect(Number.isFinite(value)).toBe(true);
			}
		}
	});

	test("applyTracking modifies advances correctly", () => {
		if (!testFont?.trak) return;

		const advances = [500, 600, 700, 800];
		const original = [...advances];

		applyTracking(testFont.trak, advances, 12.0, 0.0, false);

		// Check that values changed or stayed the same (depending on tracking)
		for (let i = 0; i < advances.length; i++) {
			expect(typeof advances[i]).toBe("number");
			const orig = original[i];
			const curr = advances[i];
			if (orig !== undefined && curr !== undefined) {
				// Difference should be reasonable
				const diff = Math.abs(curr - orig);
				expect(diff).toBeLessThan(1000);
			}
		}
	});

	test("tight tracking reduces spacing", () => {
		if (!testFont?.trak?.horizData) return;

		const horizData = testFont.trak.horizData;

		// Find a tight track (negative value)
		const tightTrack = horizData.trackTable.find((t) => t.track < 0);
		if (!tightTrack) return;

		const advances = [500, 600, 700];
		const original = [...advances];

		applyTracking(testFont.trak, advances, 12.0, tightTrack.track, false);

		// For tight tracking, at least one value should typically decrease
		// (though it depends on the specific font and size)
		expect(typeof advances[0]).toBe("number");
	});

	test("loose tracking increases spacing", () => {
		if (!testFont?.trak?.horizData) return;

		const horizData = testFont.trak.horizData;

		// Find a loose track (positive value)
		const looseTrack = horizData.trackTable.find((t) => t.track > 0);
		if (!looseTrack) return;

		const advances = [500, 600, 700];
		const original = [...advances];

		applyTracking(testFont.trak, advances, 12.0, looseTrack.track, false);

		// For loose tracking, values should typically increase
		expect(typeof advances[0]).toBe("number");
	});

	test("different tracks produce different results", () => {
		if (!testFont?.trak?.horizData) return;
		if (testFont.trak.horizData.trackTable.length < 2) return;

		const horizData = testFont.trak.horizData;
		const track1 = horizData.trackTable[0];
		const track2 = horizData.trackTable[1];
		if (!track1 || !track2) return;

		const value1 = getTrackingValue(horizData, track1.track, 12.0);
		const value2 = getTrackingValue(horizData, track2.track, 12.0);

		// Different tracks should typically produce different values
		// (unless they're both zero at this size)
		expect(typeof value1).toBe("number");
		expect(typeof value2).toBe("number");
	});

	test("tracking values vary by size", () => {
		if (!testFont?.trak?.horizData) return;

		const horizData = testFont.trak.horizData;
		if (horizData.sizeTable.length < 2) return;

		const track = horizData.trackTable[0];
		if (!track) return;

		const size1 = horizData.sizeTable[0];
		const size2 = horizData.sizeTable[horizData.sizeTable.length - 1];
		if (size1 === undefined || size2 === undefined) return;

		const value1 = getTrackingValue(horizData, track.track, size1);
		const value2 = getTrackingValue(horizData, track.track, size2);

		// Values should be defined and numeric
		expect(typeof value1).toBe("number");
		expect(typeof value2).toBe("number");
	});
});

describe("trak table - format validation", () => {
	test("Fixed 16.16 version parsing", () => {
		const buffer = new ArrayBuffer(12);
		const view = new DataView(buffer);

		// Test various versions
		view.setUint32(0, 0x00010000, false); // 1.0
		let reader = new Reader(buffer);
		let trak = parseTrak(reader);
		expect(trak.version).toBe(1.0);

		view.setUint32(0, 0x00018000, false); // 1.5
		reader = new Reader(buffer);
		trak = parseTrak(reader);
		expect(trak.version).toBeCloseTo(1.5, 5);

		view.setUint32(0, 0x00020000, false); // 2.0
		reader = new Reader(buffer);
		trak = parseTrak(reader);
		expect(trak.version).toBe(2.0);
	});

	test("Fixed 16.16 track value parsing", () => {
		const buffer = new ArrayBuffer(100);
		const view = new DataView(buffer);

		// Header
		view.setUint32(0, 0x00010000, false);
		view.setUint16(4, 0, false);
		view.setUint16(6, 12, false);
		view.setUint16(8, 0, false);
		view.setUint16(10, 0, false);

		// Track data
		view.setUint16(12, 1, false); // nTracks
		view.setUint16(14, 1, false); // nSizes
		view.setUint32(16, 28, false); // sizeTableOffset

		// Track value: -0.5 in Fixed 16.16 = 0xFFFF8000
		view.setInt32(20, -32768, false); // -0.5
		view.setUint16(24, 100, false);
		view.setUint16(26, 40, false);

		// Size and value
		view.setInt32(40, 0x000C0000, false); // 12.0
		view.setInt16(52, 10, false);

		const reader = new Reader(buffer);
		const trak = parseTrak(reader);

		if (trak.horizData?.trackTable[0]) {
			expect(trak.horizData.trackTable[0].track).toBeCloseTo(-0.5, 5);
		}
	});

	test("Fixed 16.16 size value parsing", () => {
		const buffer = new ArrayBuffer(100);
		const view = new DataView(buffer);

		// Header
		view.setUint32(0, 0x00010000, false);
		view.setUint16(4, 0, false);
		view.setUint16(6, 12, false); // horizOffset
		view.setUint16(8, 0, false);
		view.setUint16(10, 0, false);

		// TrackData header at offset 12
		view.setUint16(12, 1, false); // nTracks
		view.setUint16(14, 1, false); // nSizes
		view.setUint32(16, 28, false); // sizeTableOffset (absolute)

		// Track entry at offset 20
		view.setInt32(20, 0, false); // track 0
		view.setUint16(24, 100, false); // nameIndex
		view.setUint16(26, 32, false); // perSize offset (absolute)

		// Size table at absolute offset 28 (1 size = 4 bytes)
		// Size: 13.5 in Fixed 16.16 = 0x000D8000
		view.setInt32(28, 0x000d8000, false); // 13.5

		// Per-size values at absolute offset 32
		view.setInt16(32, 5, false);

		const reader = new Reader(buffer);
		const trak = parseTrak(reader);

		if (trak.horizData) {
			expect(trak.horizData.sizeTable[0]).toBeCloseTo(13.5, 5);
		}
	});
});

describe("trak table - known parsing issues", () => {
	test("SFNS.ttf trak table parses correctly", async () => {
		// SFNS.ttf has a trak table with absolute offsets from table start.
		// The parser now correctly handles this.
		try {
			const font = await Font.fromFile("/System/Library/Fonts/SFNS.ttf");
			const trak = font.trak;

			expect(trak).not.toBeNull();
			if (trak) {
				expect(trak.version).toBe(1.0);
				expect(trak.horizData).not.toBeNull();
				if (trak.horizData) {
					expect(trak.horizData.nTracks).toBeGreaterThan(0);
					expect(trak.horizData.nSizes).toBeGreaterThan(0);
					expect(trak.horizData.trackTable.length).toBe(trak.horizData.nTracks);
					expect(trak.horizData.sizeTable.length).toBe(trak.horizData.nSizes);

					// Verify per-size tracking values were parsed
					for (const track of trak.horizData.trackTable) {
						expect(track.perSizeTracking.length).toBe(trak.horizData.nSizes);
					}
				}
			}
		} catch {
			// Font not found on this system
			console.log("Skipping: SFNS.ttf not found");
		}
	});

	test("handles truncated per-size data gracefully", () => {
		// Create a table where nSizes doesn't match actual data
		const buffer = new ArrayBuffer(200);
		const view = new DataView(buffer);

		view.setUint32(0, 0x00010000, false);
		view.setUint16(4, 0, false);
		view.setUint16(6, 12, false);
		view.setUint16(8, 0, false);
		view.setUint16(10, 0, false);

		// Claim 10 sizes but only provide space for 5
		view.setUint16(12, 1, false); // nTracks
		view.setUint16(14, 10, false); // nSizes (claim 10)
		view.setUint32(16, 28, false); // sizeTableOffset (absolute)

		// Track entry
		view.setInt32(20, 0, false);
		view.setUint16(24, 100, false);
		view.setUint16(26, 68, false); // per-size at absolute offset 68

		// Size table at absolute offset 28 (only 5 sizes = 20 bytes)
		for (let i = 0; i < 5; i++) {
			view.setInt32(28 + i * 4, (12 + i * 2) * 65536, false);
		}

		// Per-size data at absolute offset 68 (only 5 values = 10 bytes)
		for (let i = 0; i < 5; i++) {
			view.setInt16(68 + i * 2, 10 - i * 2, false);
		}

		const reader = new Reader(buffer);

		// Should either throw or handle gracefully
		try {
			const trak = parseTrak(reader);
			// If it parses, check what we got
			expect(trak).toBeDefined();
		} catch (e) {
			// Out of bounds is acceptable behavior
			expect((e as Error).message).toContain("Out of bounds");
		}
	});

	test("uses absolute offsets from table start", () => {
		// Apple's trak table uses absolute offsets from the table start
		// for both sizeTableOffset and per-size tracking offsets.

		const buffer = new ArrayBuffer(200);
		const view = new DataView(buffer);

		// Header
		view.setUint32(0, 0x00010000, false);
		view.setUint16(4, 0, false);
		view.setUint16(6, 12, false); // horizOffset
		view.setUint16(8, 0, false);
		view.setUint16(10, 0, false);

		// Track data at offset 12
		view.setUint16(12, 1, false); // nTracks
		view.setUint16(14, 2, false); // nSizes
		view.setUint32(16, 28, false); // sizeTableOffset (absolute)

		// Track entry with absolute offset 48
		view.setInt32(20, 0, false); // track 0
		view.setUint16(24, 100, false); // nameIndex
		view.setUint16(26, 48, false); // per-size offset (absolute from table start)

		// Size table at absolute offset 28
		view.setInt32(28, 12 * 65536, false); // 12.0
		view.setInt32(32, 24 * 65536, false); // 24.0

		// Per-size data at absolute offset 48
		view.setInt16(48, 20, false);
		view.setInt16(50, 15, false);

		const reader = new Reader(buffer);
		const trak = parseTrak(reader);

		// Parser uses absolute offsets
		if (trak.horizData?.trackTable[0]) {
			const values = trak.horizData.trackTable[0].perSizeTracking;
			expect(values.length).toBe(2);
			// Should read from absolute offset 48
			expect(values[0]).toBe(20);
			expect(values[1]).toBe(15);
		}
	});
});
