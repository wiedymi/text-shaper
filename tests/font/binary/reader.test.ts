import { describe, expect, test } from "bun:test";
import { Reader } from "../../../src/font/binary/reader.ts";

function createBuffer(...bytes: number[]): ArrayBuffer {
	return new Uint8Array(bytes).buffer;
}

describe("Reader", () => {
	describe("constructor", () => {
		test("creates reader from ArrayBuffer", () => {
			const buffer = createBuffer(0x00, 0x01, 0x02, 0x03);
			const reader = new Reader(buffer);
			expect(reader.length).toBe(4);
			expect(reader.remaining).toBe(4);
			expect(reader.offset).toBe(0);
		});

		test("creates reader with offset", () => {
			const buffer = createBuffer(0x00, 0x01, 0x02, 0x03);
			const reader = new Reader(buffer, 2);
			expect(reader.length).toBe(2);
			expect(reader.offset).toBe(0);
		});

		test("creates reader with offset and length", () => {
			const buffer = createBuffer(0x00, 0x01, 0x02, 0x03, 0x04, 0x05);
			const reader = new Reader(buffer, 1, 3);
			expect(reader.length).toBe(3);
		});

		test("creates reader from DataView", () => {
			const buffer = createBuffer(0x00, 0x01, 0x02, 0x03);
			const dataView = new DataView(buffer);
			const reader = new Reader(dataView);
			expect(reader.length).toBe(4);
		});
	});

	describe("primitive reads (big-endian)", () => {
		test("uint8", () => {
			const reader = new Reader(createBuffer(0x00, 0x7f, 0x80, 0xff));
			expect(reader.uint8()).toBe(0);
			expect(reader.uint8()).toBe(127);
			expect(reader.uint8()).toBe(128);
			expect(reader.uint8()).toBe(255);
		});

		test("int8", () => {
			const reader = new Reader(createBuffer(0x00, 0x7f, 0x80, 0xff));
			expect(reader.int8()).toBe(0);
			expect(reader.int8()).toBe(127);
			expect(reader.int8()).toBe(-128);
			expect(reader.int8()).toBe(-1);
		});

		test("uint16 big-endian", () => {
			const reader = new Reader(createBuffer(0x00, 0x01, 0x12, 0x34, 0xff, 0xff));
			expect(reader.uint16()).toBe(1);
			expect(reader.uint16()).toBe(0x1234);
			expect(reader.uint16()).toBe(0xffff);
		});

		test("int16 big-endian", () => {
			const reader = new Reader(createBuffer(0x00, 0x01, 0x7f, 0xff, 0x80, 0x00, 0xff, 0xff));
			expect(reader.int16()).toBe(1);
			expect(reader.int16()).toBe(32767);
			expect(reader.int16()).toBe(-32768);
			expect(reader.int16()).toBe(-1);
		});

		test("uint32 big-endian", () => {
			const reader = new Reader(createBuffer(0x00, 0x00, 0x00, 0x01, 0x12, 0x34, 0x56, 0x78));
			expect(reader.uint32()).toBe(1);
			expect(reader.uint32()).toBe(0x12345678);
		});

		test("int32 big-endian", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x00, 0x00, 0x01,
				0x7f, 0xff, 0xff, 0xff,
				0x80, 0x00, 0x00, 0x00,
				0xff, 0xff, 0xff, 0xff
			));
			expect(reader.int32()).toBe(1);
			expect(reader.int32()).toBe(2147483647);
			expect(reader.int32()).toBe(-2147483648);
			expect(reader.int32()).toBe(-1);
		});
	});

	describe("OpenType-specific types", () => {
		test("fixed (16.16)", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, 0x00, 0x00, // 1.0
				0x00, 0x01, 0x80, 0x00, // 1.5
				0xff, 0xff, 0x00, 0x00  // -1.0
			));
			expect(reader.fixed()).toBeCloseTo(1.0);
			expect(reader.fixed()).toBeCloseTo(1.5);
			expect(reader.fixed()).toBeCloseTo(-1.0);
		});

		test("f2dot14 (2.14)", () => {
			const reader = new Reader(createBuffer(
				0x40, 0x00, // 1.0
				0x60, 0x00, // 1.5
				0xc0, 0x00  // -1.0
			));
			expect(reader.f2dot14()).toBeCloseTo(1.0);
			expect(reader.f2dot14()).toBeCloseTo(1.5);
			expect(reader.f2dot14()).toBeCloseTo(-1.0);
		});

		test("uint24", () => {
			const reader = new Reader(createBuffer(0x12, 0x34, 0x56, 0xff, 0xff, 0xff));
			expect(reader.uint24()).toBe(0x123456);
			expect(reader.uint24()).toBe(0xffffff);
		});

		test("tag", () => {
			const reader = new Reader(createBuffer(0x68, 0x65, 0x61, 0x64)); // 'head'
			expect(reader.tag()).toBe(0x68656164);
		});

		test("tagString", () => {
			const reader = new Reader(createBuffer(0x68, 0x65, 0x61, 0x64)); // 'head'
			expect(reader.tagString()).toBe("head");
		});

		test("offset16", () => {
			const reader = new Reader(createBuffer(0x00, 0x10));
			expect(reader.offset16()).toBe(16);
		});

		test("offset32", () => {
			const reader = new Reader(createBuffer(0x00, 0x00, 0x01, 0x00));
			expect(reader.offset32()).toBe(256);
		});

		test("longDateTime", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x01
			));
			expect(reader.longDateTime()).toBe(1n);
		});

		test("fword", () => {
			const reader = new Reader(createBuffer(0xff, 0xf6)); // -10
			expect(reader.fword()).toBe(-10);
		});

		test("ufword", () => {
			const reader = new Reader(createBuffer(0x00, 0x64)); // 100
			expect(reader.ufword()).toBe(100);
		});
	});

	describe("array reads", () => {
		test("uint8Array", () => {
			const reader = new Reader(createBuffer(0x01, 0x02, 0x03, 0x04));
			const arr = reader.uint8Array(4);
			expect(arr).toEqual(new Uint8Array([1, 2, 3, 4]));
		});

		test("uint16Array", () => {
			const reader = new Reader(createBuffer(0x00, 0x01, 0x00, 0x02, 0x00, 0x03));
			const arr = reader.uint16Array(3);
			expect(arr).toEqual(new Uint16Array([1, 2, 3]));
		});

		test("int16Array", () => {
			const reader = new Reader(createBuffer(0xff, 0xff, 0x00, 0x01, 0x80, 0x00));
			const arr = reader.int16Array(3);
			expect(arr).toEqual(new Int16Array([-1, 1, -32768]));
		});

		test("uint32Array", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x00, 0x00, 0x01,
				0x00, 0x00, 0x00, 0x02
			));
			const arr = reader.uint32Array(2);
			expect(arr).toEqual(new Uint32Array([1, 2]));
		});

		test("array with custom reader", () => {
			const reader = new Reader(createBuffer(0x00, 0x01, 0x00, 0x02, 0x00, 0x03));
			const arr = reader.array(3, (r) => r.uint16());
			expect(arr).toEqual([1, 2, 3]);
		});
	});

	describe("string reads", () => {
		test("ascii", () => {
			const reader = new Reader(createBuffer(0x68, 0x65, 0x6c, 0x6c, 0x6f)); // 'hello'
			expect(reader.ascii(5)).toBe("hello");
		});

		test("utf16be", () => {
			// 'AB' in UTF-16BE
			const reader = new Reader(createBuffer(0x00, 0x41, 0x00, 0x42));
			expect(reader.utf16be(4)).toBe("AB");
		});

		test("utf16be with non-ASCII", () => {
			// '日本' in UTF-16BE
			const reader = new Reader(createBuffer(0x65, 0xe5, 0x67, 0x2c));
			expect(reader.utf16be(4)).toBe("日本");
		});
	});

	describe("position management", () => {
		test("seek", () => {
			const reader = new Reader(createBuffer(0x01, 0x02, 0x03, 0x04));
			reader.seek(2);
			expect(reader.offset).toBe(2);
			expect(reader.uint8()).toBe(3);
		});

		test("skip", () => {
			const reader = new Reader(createBuffer(0x01, 0x02, 0x03, 0x04));
			reader.skip(2);
			expect(reader.offset).toBe(2);
			expect(reader.uint8()).toBe(3);
		});

		test("remaining updates correctly", () => {
			const reader = new Reader(createBuffer(0x01, 0x02, 0x03, 0x04));
			expect(reader.remaining).toBe(4);
			reader.uint8();
			expect(reader.remaining).toBe(3);
			reader.uint16();
			expect(reader.remaining).toBe(1);
		});
	});

	describe("slicing", () => {
		test("slice creates sub-reader", () => {
			const reader = new Reader(createBuffer(0x00, 0x01, 0x02, 0x03, 0x04, 0x05));
			const sub = reader.slice(2, 3);
			expect(sub.length).toBe(3);
			expect(sub.uint8()).toBe(2);
			expect(sub.uint8()).toBe(3);
			expect(sub.uint8()).toBe(4);
		});

		test("sliceFrom creates sub-reader from offset", () => {
			const reader = new Reader(createBuffer(0x00, 0x01, 0x02, 0x03, 0x04, 0x05));
			const sub = reader.sliceFrom(3);
			expect(sub.length).toBe(3);
			expect(sub.uint8()).toBe(3);
		});

		test("slice is zero-copy", () => {
			const buffer = createBuffer(0x00, 0x01, 0x02, 0x03);
			const reader1 = new Reader(buffer);
			const reader2 = reader1.slice(0, 4);
			// Both readers should read the same data
			expect(reader1.uint8()).toBe(0);
			expect(reader2.uint8()).toBe(0);
		});
	});

	describe("peek and readAt", () => {
		test("peek reads without advancing", () => {
			const reader = new Reader(createBuffer(0x01, 0x02, 0x03));
			const value = reader.peek(() => reader.uint8());
			expect(value).toBe(1);
			expect(reader.offset).toBe(0);
			expect(reader.uint8()).toBe(1); // Can read again
		});

		test("readAt reads at specific offset", () => {
			const reader = new Reader(createBuffer(0x01, 0x02, 0x03, 0x04));
			reader.uint8(); // Advance position
			const value = reader.readAt(2, (r) => r.uint16());
			expect(value).toBe(0x0304);
			expect(reader.offset).toBe(1); // Position unchanged
		});
	});

	describe("boundary checks", () => {
		test("hasRemaining", () => {
			const reader = new Reader(createBuffer(0x01, 0x02));
			expect(reader.hasRemaining(2)).toBe(true);
			expect(reader.hasRemaining(3)).toBe(false);
			reader.uint8();
			expect(reader.hasRemaining(1)).toBe(true);
			expect(reader.hasRemaining(2)).toBe(false);
		});

		test("ensureRemaining throws when insufficient", () => {
			const reader = new Reader(createBuffer(0x01, 0x02));
			expect(() => reader.ensureRemaining(2)).not.toThrow();
			expect(() => reader.ensureRemaining(3)).toThrow();
		});
	});

	describe("bytes", () => {
		test("returns Uint8Array view", () => {
			const reader = new Reader(createBuffer(0x01, 0x02, 0x03, 0x04));
			const bytes = reader.bytes(3);
			expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
			expect(reader.offset).toBe(3);
		});
	});
});
