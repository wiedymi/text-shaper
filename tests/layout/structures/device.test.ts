import { describe, expect, test } from "bun:test";
import { Reader } from "../../../src/font/binary/reader.ts";
import {
	parseDeviceAt,
	parseDevice,
	getDeviceDelta,
	applyDeviceAdjustment,
	applyDeviceAdjustments,
	isVariationIndexTable,
	type DeviceTable,
	type VariationIndexTable,
	type DeviceOrVariationIndex,
	type ResolvedValueRecord,
} from "../../../src/layout/structures/device.ts";

function createBuffer(...bytes: number[]): ArrayBuffer {
	return new Uint8Array(bytes).buffer;
}

describe("Device", () => {
	describe("parseDeviceAt", () => {
		test("returns null for offset 0", () => {
			const reader = new Reader(createBuffer(0x00, 0x00));
			expect(parseDeviceAt(reader, 0)).toBeNull();
		});

		test("parses device at non-zero offset", () => {
			const reader = new Reader(createBuffer(
				0xaa, 0xbb, // padding
				0x00, 0x0a, // startSize = 10
				0x00, 0x0c, // endSize = 12
				0x00, 0x01, // format = 1 (2-bit deltas)
				0x50, 0x00, // deltas
			));
			const device = parseDeviceAt(reader, 2) as DeviceTable;

			expect(device).not.toBeNull();
			expect(device.startSize).toBe(10);
			expect(device.endSize).toBe(12);
		});
	});

	describe("parseDevice - Format 1 (2-bit deltas)", () => {
		test("parses 2-bit delta values", () => {
			// Format 1: 2 bits per value, 8 values per word
			// ppem 10-12 (3 values): +1, -1, +0
			// Binary: 01 11 00 (then 5 more padding values)
			// 01=+1, 11=-1, 00=0
			// 0111_0000_0000_0000 = 0x7000
			const reader = new Reader(createBuffer(
				0x00, 0x0a, // startSize = 10
				0x00, 0x0c, // endSize = 12
				0x00, 0x01, // format = 1
				0x70, 0x00, // word with 2-bit deltas
			));
			const device = parseDevice(reader) as DeviceTable;

			expect(device.startSize).toBe(10);
			expect(device.endSize).toBe(12);
			expect(device.deltaFormat).toBe(1);
			expect(device.deltaValues.length).toBe(3);
			expect(device.deltaValues[0]).toBe(1); // 01 = +1
			expect(device.deltaValues[1]).toBe(-1); // 11 = -1
			expect(device.deltaValues[2]).toBe(0); // 00 = 0
		});

		test("handles multiple words for 2-bit deltas", () => {
			// 9 values need 2 words (8 + 1)
			// First word: 8 values
			// Second word: 1 value + padding
			const reader = new Reader(createBuffer(
				0x00, 0x14, // startSize = 20
				0x00, 0x1c, // endSize = 28 (9 values)
				0x00, 0x01, // format = 1
				0x55, 0x55, // first word: 0101_0101_0101_0101 = all +1s
				0x80, 0x00, // second word: 10 = -2, rest padding
			));
			const device = parseDevice(reader) as DeviceTable;

			expect(device.deltaValues.length).toBe(9);
			for (let i = 0; i < 8; i++) {
				expect(device.deltaValues[i]).toBe(1);
			}
			expect(device.deltaValues[8]).toBe(-2); // 10 = -2
		});

		test("handles negative 2-bit values", () => {
			// 2-bit signed: 00=0, 01=+1, 10=-2, 11=-1
			// 0x_AA_AA = 1010_1010_1010_1010
			const reader = new Reader(createBuffer(
				0x00, 0x08, // startSize = 8
				0x00, 0x0f, // endSize = 15 (8 values)
				0x00, 0x01, // format = 1
				0xaa, 0xaa, // alternating -2 and -2
			));
			const device = parseDevice(reader) as DeviceTable;

			expect(device.deltaValues.length).toBe(8);
			// 10 = -2 in 2-bit signed
			for (let i = 0; i < 8; i++) {
				expect(device.deltaValues[i]).toBe(-2);
			}
		});
	});

	describe("parseDevice - Format 2 (4-bit deltas)", () => {
		test("parses 4-bit delta values", () => {
			// Format 2: 4 bits per value, 4 values per word
			// ppem 10-12 (3 values): +1, -1, +7
			// Binary: 0001 1111 0111 0000 = 0x1F70
			// 0001=+1, 1111=-1, 0111=+7
			const reader = new Reader(createBuffer(
				0x00, 0x0a, // startSize = 10
				0x00, 0x0c, // endSize = 12
				0x00, 0x02, // format = 2
				0x1f, 0x70, // word with 4-bit deltas
			));
			const device = parseDevice(reader) as DeviceTable;

			expect(device.startSize).toBe(10);
			expect(device.endSize).toBe(12);
			expect(device.deltaFormat).toBe(2);
			expect(device.deltaValues.length).toBe(3);
			expect(device.deltaValues[0]).toBe(1);
			expect(device.deltaValues[1]).toBe(-1);
			expect(device.deltaValues[2]).toBe(7);
		});

		test("handles multiple words for 4-bit deltas", () => {
			// 5 values need 2 words (4 + 1)
			const reader = new Reader(createBuffer(
				0x00, 0x14, // startSize = 20
				0x00, 0x18, // endSize = 24 (5 values)
				0x00, 0x02, // format = 2
				0x12, 0x34, // first word: +1, +2, +3, +4
				0x50, 0x00, // second word: +5, padding
			));
			const device = parseDevice(reader) as DeviceTable;

			expect(device.deltaValues.length).toBe(5);
			expect(device.deltaValues[0]).toBe(1);
			expect(device.deltaValues[1]).toBe(2);
			expect(device.deltaValues[2]).toBe(3);
			expect(device.deltaValues[3]).toBe(4);
			expect(device.deltaValues[4]).toBe(5);
		});

		test("handles negative 4-bit values", () => {
			// 4-bit signed: 0111=+7, 1000=-8, 1111=-1
			// 0x78F0 = 0111_1000_1111_0000
			const reader = new Reader(createBuffer(
				0x00, 0x08, // startSize = 8
				0x00, 0x0b, // endSize = 11 (4 values)
				0x00, 0x02, // format = 2
				0x78, 0xf0, // +7, -8, -1, 0
			));
			const device = parseDevice(reader) as DeviceTable;

			expect(device.deltaValues.length).toBe(4);
			expect(device.deltaValues[0]).toBe(7);
			expect(device.deltaValues[1]).toBe(-8);
			expect(device.deltaValues[2]).toBe(-1);
			expect(device.deltaValues[3]).toBe(0);
		});
	});

	describe("parseDevice - Format 3 (8-bit deltas)", () => {
		test("parses 8-bit delta values", () => {
			// Format 3: 8 bits per value, 2 values per word
			// ppem 10-12 (3 values): +10, -20, +127
			const reader = new Reader(createBuffer(
				0x00, 0x0a, // startSize = 10
				0x00, 0x0c, // endSize = 12
				0x00, 0x03, // format = 3
				0x0a, 0xec, // word 1: +10, -20 (0xec = 236 = -20 signed)
				0x7f, 0x00, // word 2: +127, padding
			));
			const device = parseDevice(reader) as DeviceTable;

			expect(device.startSize).toBe(10);
			expect(device.endSize).toBe(12);
			expect(device.deltaFormat).toBe(3);
			expect(device.deltaValues.length).toBe(3);
			expect(device.deltaValues[0]).toBe(10);
			expect(device.deltaValues[1]).toBe(-20);
			expect(device.deltaValues[2]).toBe(127);
		});

		test("handles negative 8-bit values", () => {
			// 8-bit signed: 0x7F=+127, 0x80=-128, 0xFF=-1
			const reader = new Reader(createBuffer(
				0x00, 0x08, // startSize = 8
				0x00, 0x09, // endSize = 9 (2 values)
				0x00, 0x03, // format = 3
				0x80, 0xff, // -128, -1
			));
			const device = parseDevice(reader) as DeviceTable;

			expect(device.deltaValues.length).toBe(2);
			expect(device.deltaValues[0]).toBe(-128);
			expect(device.deltaValues[1]).toBe(-1);
		});

		test("handles single value", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x0c, // startSize = 12
				0x00, 0x0c, // endSize = 12 (1 value)
				0x00, 0x03, // format = 3
				0x2a, 0x00, // +42, padding
			));
			const device = parseDevice(reader) as DeviceTable;

			expect(device.deltaValues.length).toBe(1);
			expect(device.deltaValues[0]).toBe(42);
		});
	});

	describe("parseDevice - VariationIndex table", () => {
		test("parses VariationIndex table (format 0x8000)", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x0a, // outer index
				0x00, 0x05, // inner index
				0x80, 0x00, // format = 0x8000
			));
			const table = parseDevice(reader) as VariationIndexTable;

			expect(isVariationIndexTable(table)).toBe(true);
			expect(table.deltaSetOuterIndex).toBe(10);
			expect(table.deltaSetInnerIndex).toBe(5);
		});

		test("isVariationIndexTable correctly identifies table type", () => {
			const variationIndex: VariationIndexTable = {
				deltaSetOuterIndex: 1,
				deltaSetInnerIndex: 2,
			};

			const deviceTable: DeviceTable = {
				startSize: 10,
				endSize: 12,
				deltaFormat: 1,
				deltaValues: [1, -1, 0],
			};

			expect(isVariationIndexTable(variationIndex)).toBe(true);
			expect(isVariationIndexTable(deviceTable)).toBe(false);
		});
	});

	describe("parseDevice - invalid formats", () => {
		test("handles format 0 (no deltas)", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x0a, // startSize = 10
				0x00, 0x0c, // endSize = 12
				0x00, 0x00, // format = 0 (invalid)
			));
			const device = parseDevice(reader) as DeviceTable;

			expect(device.deltaValues).toEqual([]);
		});

		test("handles format 4+ (invalid)", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x0a, // startSize = 10
				0x00, 0x0c, // endSize = 12
				0x00, 0x04, // format = 4 (invalid)
			));
			const device = parseDevice(reader) as DeviceTable;

			expect(device.deltaValues).toEqual([]);
		});
	});

	describe("getDeviceDelta", () => {
		test("returns correct delta for ppem in range", () => {
			const device: DeviceTable = {
				startSize: 10,
				endSize: 12,
				deltaFormat: 1,
				deltaValues: [1, -1, 2],
			};

			expect(getDeviceDelta(device, 10)).toBe(1);
			expect(getDeviceDelta(device, 11)).toBe(-1);
			expect(getDeviceDelta(device, 12)).toBe(2);
		});

		test("returns 0 for ppem below range", () => {
			const device: DeviceTable = {
				startSize: 10,
				endSize: 12,
				deltaFormat: 1,
				deltaValues: [1, -1, 2],
			};

			expect(getDeviceDelta(device, 9)).toBe(0);
			expect(getDeviceDelta(device, 5)).toBe(0);
		});

		test("returns 0 for ppem above range", () => {
			const device: DeviceTable = {
				startSize: 10,
				endSize: 12,
				deltaFormat: 1,
				deltaValues: [1, -1, 2],
			};

			expect(getDeviceDelta(device, 13)).toBe(0);
			expect(getDeviceDelta(device, 100)).toBe(0);
		});

		test("returns 0 for missing delta value", () => {
			const device: DeviceTable = {
				startSize: 10,
				endSize: 15,
				deltaFormat: 1,
				deltaValues: [1, -1], // only 2 values but range suggests 6
			};

			expect(getDeviceDelta(device, 12)).toBe(0);
		});
	});

	describe("applyDeviceAdjustment", () => {
		test("returns original value when device is null", () => {
			expect(applyDeviceAdjustment(null, 100, 12)).toBe(100);
		});

		test("applies delta for Device table", () => {
			const device: DeviceTable = {
				startSize: 10,
				endSize: 12,
				deltaFormat: 1,
				deltaValues: [5, -3, 10],
			};

			expect(applyDeviceAdjustment(device, 100, 10)).toBe(105);
			expect(applyDeviceAdjustment(device, 100, 11)).toBe(97);
			expect(applyDeviceAdjustment(device, 100, 12)).toBe(110);
		});

		test("returns original value for ppem outside range", () => {
			const device: DeviceTable = {
				startSize: 10,
				endSize: 12,
				deltaFormat: 1,
				deltaValues: [5, -3, 10],
			};

			expect(applyDeviceAdjustment(device, 100, 9)).toBe(100);
			expect(applyDeviceAdjustment(device, 100, 13)).toBe(100);
		});

		test("returns original value for VariationIndex table", () => {
			const variationIndex: VariationIndexTable = {
				deltaSetOuterIndex: 1,
				deltaSetInnerIndex: 2,
			};

			// VariationIndex needs ItemVariationStore, so returns unchanged
			expect(applyDeviceAdjustment(variationIndex, 100, 12)).toBe(100);
		});
	});

	describe("applyDeviceAdjustments", () => {
		test("applies all device adjustments to value record", () => {
			const xPlaDevice: DeviceTable = {
				startSize: 12,
				endSize: 12,
				deltaFormat: 1,
				deltaValues: [5],
			};

			const yPlaDevice: DeviceTable = {
				startSize: 12,
				endSize: 12,
				deltaFormat: 1,
				deltaValues: [-3],
			};

			const record: ResolvedValueRecord = {
				xPlacement: 100,
				yPlacement: 200,
				xAdvance: 500,
				yAdvance: 0,
				xPlaDevice,
				yPlaDevice,
				xAdvDevice: null,
				yAdvDevice: null,
			};

			const result = applyDeviceAdjustments(record, 12);

			expect(result.xPlacement).toBe(105);
			expect(result.yPlacement).toBe(197);
			expect(result.xAdvance).toBe(500);
			expect(result.yAdvance).toBe(0);
		});

		test("applies advance device adjustments", () => {
			const xAdvDevice: DeviceTable = {
				startSize: 16,
				endSize: 16,
				deltaFormat: 1,
				deltaValues: [2],
			};

			const yAdvDevice: DeviceTable = {
				startSize: 16,
				endSize: 16,
				deltaFormat: 1,
				deltaValues: [-1],
			};

			const record: ResolvedValueRecord = {
				xPlacement: 0,
				yPlacement: 0,
				xAdvance: 600,
				yAdvance: 0,
				xPlaDevice: null,
				yPlaDevice: null,
				xAdvDevice,
				yAdvDevice,
			};

			const result = applyDeviceAdjustments(record, 16);

			expect(result.xPlacement).toBe(0);
			expect(result.yPlacement).toBe(0);
			expect(result.xAdvance).toBe(602);
			expect(result.yAdvance).toBe(-1);
		});

		test("handles null devices", () => {
			const record: ResolvedValueRecord = {
				xPlacement: 10,
				yPlacement: 20,
				xAdvance: 500,
				yAdvance: 0,
				xPlaDevice: null,
				yPlaDevice: null,
				xAdvDevice: null,
				yAdvDevice: null,
			};

			const result = applyDeviceAdjustments(record, 12);

			expect(result.xPlacement).toBe(10);
			expect(result.yPlacement).toBe(20);
			expect(result.xAdvance).toBe(500);
			expect(result.yAdvance).toBe(0);
		});

		test("handles mixed null and present devices", () => {
			const xPlaDevice: DeviceTable = {
				startSize: 12,
				endSize: 12,
				deltaFormat: 1,
				deltaValues: [8],
			};

			const record: ResolvedValueRecord = {
				xPlacement: 50,
				yPlacement: 100,
				xAdvance: 600,
				yAdvance: 0,
				xPlaDevice,
				yPlaDevice: null,
				xAdvDevice: null,
				yAdvDevice: null,
			};

			const result = applyDeviceAdjustments(record, 12);

			expect(result.xPlacement).toBe(58);
			expect(result.yPlacement).toBe(100);
			expect(result.xAdvance).toBe(600);
			expect(result.yAdvance).toBe(0);
		});

		test("handles ppem outside all device ranges", () => {
			const device: DeviceTable = {
				startSize: 10,
				endSize: 12,
				deltaFormat: 1,
				deltaValues: [5, -3, 10],
			};

			const record: ResolvedValueRecord = {
				xPlacement: 100,
				yPlacement: 200,
				xAdvance: 500,
				yAdvance: 0,
				xPlaDevice: device,
				yPlaDevice: device,
				xAdvDevice: device,
				yAdvDevice: device,
			};

			const result = applyDeviceAdjustments(record, 20); // ppem outside range

			expect(result.xPlacement).toBe(100);
			expect(result.yPlacement).toBe(200);
			expect(result.xAdvance).toBe(500);
			expect(result.yAdvance).toBe(0);
		});

		test("handles VariationIndex tables in record", () => {
			const variationIndex: VariationIndexTable = {
				deltaSetOuterIndex: 1,
				deltaSetInnerIndex: 2,
			};

			const record: ResolvedValueRecord = {
				xPlacement: 100,
				yPlacement: 200,
				xAdvance: 500,
				yAdvance: 0,
				xPlaDevice: variationIndex,
				yPlaDevice: variationIndex,
				xAdvDevice: variationIndex,
				yAdvDevice: variationIndex,
			};

			const result = applyDeviceAdjustments(record, 12);

			// VariationIndex tables are not applied without ItemVariationStore
			expect(result.xPlacement).toBe(100);
			expect(result.yPlacement).toBe(200);
			expect(result.xAdvance).toBe(500);
			expect(result.yAdvance).toBe(0);
		});
	});

	describe("edge cases", () => {
		test("handles zero-length range", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x0c, // startSize = 12
				0x00, 0x0c, // endSize = 12 (same)
				0x00, 0x01, // format = 1
				0x40, 0x00, // one 2-bit delta
			));
			const device = parseDevice(reader) as DeviceTable;

			expect(device.deltaValues.length).toBe(1);
			expect(getDeviceDelta(device, 12)).toBe(1);
		});

		test("handles large ppem range", () => {
			// 16 values = 2 words in format 1
			const reader = new Reader(createBuffer(
				0x00, 0x08, // startSize = 8
				0x00, 0x17, // endSize = 23 (16 values)
				0x00, 0x01, // format = 1
				0x55, 0x55, // word 1: all 01s (+1)
				0x55, 0x55, // word 2: all 01s (+1)
			));
			const device = parseDevice(reader) as DeviceTable;

			expect(device.deltaValues.length).toBe(16);
			for (let ppem = 8; ppem <= 23; ppem++) {
				expect(getDeviceDelta(device, ppem)).toBe(1);
			}
		});

		test("handles extreme delta values in format 3", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x10, // startSize = 16
				0x00, 0x11, // endSize = 17 (2 values)
				0x00, 0x03, // format = 3
				0x7f, 0x80, // +127, -128
			));
			const device = parseDevice(reader) as DeviceTable;

			expect(device.deltaValues[0]).toBe(127);
			expect(device.deltaValues[1]).toBe(-128);
		});
	});
});
