import { describe, expect, test } from "bun:test";
import { Reader } from "../../../src/font/binary/reader.ts";
import { parseHead } from "../../../src/font/tables/head.ts";
import { parseMaxp } from "../../../src/font/tables/maxp.ts";

describe("Table edge cases", () => {
	test("head table with invalid magic number throws", () => {
		// head table structure: majorVersion(2), minorVersion(2), fontRevision(4), checksumAdjustment(4), magicNumber(4)
		const data = new Uint8Array(54); // minimum head table size
		const view = new DataView(data.buffer);
		view.setUint16(0, 1); // majorVersion
		view.setUint16(2, 0); // minorVersion
		view.setUint32(4, 0x00010000); // fontRevision
		view.setUint32(8, 0); // checksumAdjustment
		view.setUint32(12, 0xDEADBEEF); // invalid magic number (should be 0x5F0F3CF5)

		const reader = new Reader(data.buffer);
		expect(() => parseHead(reader)).toThrow("Invalid head table magic number");
	});

	test("maxp table with unknown version throws", () => {
		// maxp table: version(4) - unknown version should throw
		const data = new Uint8Array(32);
		const view = new DataView(data.buffer);
		view.setUint32(0, 0x00030000); // version 3.0 (doesn't exist, only 0.5 and 1.0)

		const reader = new Reader(data.buffer);
		expect(() => parseMaxp(reader)).toThrow("Unknown maxp version");
	});
});
