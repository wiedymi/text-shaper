import type {
	F2Dot14,
	Fixed,
	Offset16,
	Offset32,
	Tag,
	int16,
	int32,
	uint16,
	uint32,
	uint8,
} from "../../types.ts";

/**
 * Zero-copy binary reader for OpenType font data.
 * All multi-byte values are big-endian per OpenType spec.
 */
export class Reader {
	private readonly data: DataView;
	private readonly start: number;
	private readonly end: number;
	private pos: number;

	constructor(buffer: ArrayBuffer | DataView, offset = 0, length?: number) {
		if (buffer instanceof ArrayBuffer) {
			this.data = new DataView(buffer);
			this.start = offset;
			this.end = length !== undefined ? offset + length : buffer.byteLength;
		} else {
			this.data = buffer;
			this.start = buffer.byteOffset + offset;
			this.end =
				length !== undefined
					? this.start + length
					: buffer.byteOffset + buffer.byteLength;
		}
		this.pos = this.start;
	}

	/** Current read position relative to start */
	get offset(): number {
		return this.pos - this.start;
	}

	/** Bytes remaining to read */
	get remaining(): number {
		return this.end - this.pos;
	}

	/** Total length of this reader's view */
	get length(): number {
		return this.end - this.start;
	}

	/** Seek to absolute offset (relative to this reader's start) */
	seek(offset: number): void {
		this.pos = this.start + offset;
	}

	/** Skip bytes */
	skip(bytes: number): void {
		this.pos += bytes;
	}

	/** Create a sub-reader (zero-copy slice) */
	slice(offset: number, length: number): Reader {
		return new Reader(this.data, this.start + offset, length);
	}

	/** Create a sub-reader from current position */
	sliceFrom(offset: number): Reader {
		return new Reader(this.data, this.start + offset, this.end - this.start - offset);
	}

	/** Peek at a value without advancing position */
	peek<T>(fn: () => T): T {
		const savedPos = this.pos;
		const result = fn();
		this.pos = savedPos;
		return result;
	}

	// Primitive readers (big-endian)

	uint8(): uint8 {
		const value = this.data.getUint8(this.pos);
		this.pos += 1;
		return value;
	}

	int8(): number {
		const value = this.data.getInt8(this.pos);
		this.pos += 1;
		return value;
	}

	uint16(): uint16 {
		const value = this.data.getUint16(this.pos, false);
		this.pos += 2;
		return value;
	}

	int16(): int16 {
		const value = this.data.getInt16(this.pos, false);
		this.pos += 2;
		return value;
	}

	uint32(): uint32 {
		const value = this.data.getUint32(this.pos, false);
		this.pos += 4;
		return value;
	}

	int32(): int32 {
		const value = this.data.getInt32(this.pos, false);
		this.pos += 4;
		return value;
	}

	// OpenType-specific types

	/** 16.16 fixed-point number */
	fixed(): Fixed {
		return this.int32() / 65536;
	}

	/** 2.14 fixed-point number */
	f2dot14(): F2Dot14 {
		return this.int16() / 16384;
	}

	/** Signed 16-bit integer in font design units */
	fword(): int16 {
		return this.int16();
	}

	/** Unsigned 16-bit integer in font design units */
	ufword(): uint16 {
		return this.uint16();
	}

	/** 64-bit signed integer (seconds since 1904-01-01) */
	longDateTime(): bigint {
		const high = this.uint32();
		const low = this.uint32();
		return (BigInt(high) << 32n) | BigInt(low);
	}

	/** 4-byte ASCII tag as packed uint32 */
	tag(): Tag {
		return this.uint32();
	}

	/** 4-byte ASCII tag as string */
	tagString(): string {
		const t = this.uint32();
		return String.fromCharCode(
			(t >> 24) & 0xff,
			(t >> 16) & 0xff,
			(t >> 8) & 0xff,
			t & 0xff,
		);
	}

	/** 16-bit offset */
	offset16(): Offset16 {
		return this.uint16();
	}

	/** 32-bit offset */
	offset32(): Offset32 {
		return this.uint32();
	}

	/** 24-bit unsigned integer */
	uint24(): number {
		const b0 = this.data.getUint8(this.pos);
		const b1 = this.data.getUint8(this.pos + 1);
		const b2 = this.data.getUint8(this.pos + 2);
		this.pos += 3;
		return (b0 << 16) | (b1 << 8) | b2;
	}

	// Array readers

	uint8Array(count: number): Uint8Array {
		const result = new Uint8Array(count);
		for (let i = 0; i < count; i++) {
			result[i] = this.uint8();
		}
		return result;
	}

	uint16Array(count: number): Uint16Array {
		const result = new Uint16Array(count);
		for (let i = 0; i < count; i++) {
			result[i] = this.uint16();
		}
		return result;
	}

	int16Array(count: number): Int16Array {
		const result = new Int16Array(count);
		for (let i = 0; i < count; i++) {
			result[i] = this.int16();
		}
		return result;
	}

	uint32Array(count: number): Uint32Array {
		const result = new Uint32Array(count);
		for (let i = 0; i < count; i++) {
			result[i] = this.uint32();
		}
		return result;
	}

	/** Read array using custom reader function */
	array<T>(count: number, readFn: (reader: Reader) => T): T[] {
		const result: T[] = new Array(count);
		for (let i = 0; i < count; i++) {
			result[i] = readFn(this);
		}
		return result;
	}

	// String readers

	/** Read ASCII string of given length */
	ascii(length: number): string {
		let result = "";
		for (let i = 0; i < length; i++) {
			result += String.fromCharCode(this.uint8());
		}
		return result;
	}

	/** Read UTF-16BE string (used in 'name' table) */
	utf16be(length: number): string {
		const chars: number[] = [];
		const charCount = length / 2;
		for (let i = 0; i < charCount; i++) {
			chars.push(this.uint16());
		}
		return String.fromCharCode(...chars);
	}

	// Utility methods

	/** Check if there are enough bytes remaining */
	hasRemaining(bytes: number): boolean {
		return this.remaining >= bytes;
	}

	/** Throw if not enough bytes remaining */
	ensureRemaining(bytes: number): void {
		if (this.remaining < bytes) {
			throw new Error(
				`Unexpected end of data: need ${bytes} bytes, have ${this.remaining}`,
			);
		}
	}

	/** Get raw bytes as Uint8Array (zero-copy view) */
	bytes(length: number): Uint8Array {
		const result = new Uint8Array(
			this.data.buffer,
			this.data.byteOffset + this.pos,
			length,
		);
		this.pos += length;
		return result;
	}

	/** Read value at specific offset without moving position */
	readAt<T>(offset: number, fn: (reader: Reader) => T): T {
		const savedPos = this.pos;
		this.pos = this.start + offset;
		const result = fn(this);
		this.pos = savedPos;
		return result;
	}
}
