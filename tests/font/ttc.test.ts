import { describe, expect, test } from "bun:test";
import { Font } from "../../src/font/font.ts";
import { getNameById, NameId } from "../../src/font/tables/name.ts";

const COPTIC_PATH = "tests/fixtures/NotoSansCoptic-Regular.ttf";
const MIAO_PATH = "tests/fixtures/NotoSansMiao-Regular.ttf";

function align4(value: number): number {
	return (value + 3) & ~3;
}

function patchTtcOffsets(buffer: ArrayBuffer, baseOffset: number): Uint8Array {
	const copy = new Uint8Array(buffer.slice(0));
	const view = new DataView(copy.buffer);
	const numTables = view.getUint16(4, false);
	let recordOffset = 12;

	for (let i = 0; i < numTables; i++) {
		const offsetField = recordOffset + 8;
		const tableOffset = view.getUint32(offsetField, false);
		view.setUint32(offsetField, tableOffset + baseOffset, false);
		recordOffset += 16;
	}

	return copy;
}

function makeTtcBuffer(fonts: ArrayBuffer[]): ArrayBuffer {
	const numFonts = fonts.length;
	const headerSize = 12 + numFonts * 4;

	const offsets: number[] = new Array(numFonts);
	let cursor = headerSize;

	for (let i = 0; i < numFonts; i++) {
		cursor = align4(cursor);
		offsets[i] = cursor;
		cursor += fonts[i]!.byteLength;
	}

	const ttcBuffer = new ArrayBuffer(cursor);
	const view = new DataView(ttcBuffer);

	view.setUint32(0, 0x74746366, false); // "ttcf"
	view.setUint32(4, 0x00010000, false); // version 1.0
	view.setUint32(8, numFonts, false);

	let offsetCursor = 12;
	for (let i = 0; i < numFonts; i++) {
		view.setUint32(offsetCursor, offsets[i]!, false);
		offsetCursor += 4;
	}

	const bytes = new Uint8Array(ttcBuffer);
	for (let i = 0; i < numFonts; i++) {
		const patched = patchTtcOffsets(fonts[i]!, offsets[i]!);
		bytes.set(patched, offsets[i]!);
	}

	return ttcBuffer;
}

describe("TTC loading", () => {
	test("loads TTC with default index", async () => {
		const fontBuffer = await Bun.file(COPTIC_PATH).arrayBuffer();
		const ttcBuffer = makeTtcBuffer([fontBuffer]);

		const font = Font.load(ttcBuffer);
		expect(font.numGlyphs).toBeGreaterThan(0);
		expect(font.head.unitsPerEm).toBeGreaterThan(0);
	});

	test("loads TTC with explicit collection index", async () => {
		const copticBuffer = await Bun.file(COPTIC_PATH).arrayBuffer();
		const miaoBuffer = await Bun.file(MIAO_PATH).arrayBuffer();
		const ttcBuffer = makeTtcBuffer([copticBuffer, miaoBuffer]);

		const collection = Font.collection(ttcBuffer);
		expect(collection).not.toBeNull();
		if (collection) {
			expect(collection.count).toBe(2);
		}

		const font0 = Font.load(ttcBuffer, { collectionIndex: 0 });
		const font1 = Font.load(ttcBuffer, { collectionIndex: 1 });

		const name0 = font0.name ? getNameById(font0.name, NameId.FullName) : null;
		const name1 = font1.name ? getNameById(font1.name, NameId.FullName) : null;

		expect(name0).toBe("Noto Sans Coptic Regular");
		expect(name1).toBe("Noto Sans Miao Regular");
	});

	test("Font.collection returns names for TTC faces", async () => {
		const copticBuffer = await Bun.file(COPTIC_PATH).arrayBuffer();
		const miaoBuffer = await Bun.file(MIAO_PATH).arrayBuffer();
		const ttcBuffer = makeTtcBuffer([copticBuffer, miaoBuffer]);

		const collection = Font.collection(ttcBuffer);
		expect(collection).not.toBeNull();
		if (!collection) return;

		const names = collection.names();
		expect(names.length).toBe(2);
		expect(names[0]?.fullName).toBe("Noto Sans Coptic Regular");
		expect(names[1]?.fullName).toBe("Noto Sans Miao Regular");
	});

	test("Font.collection returns null for non-TTC", async () => {
		const buffer = await Bun.file(COPTIC_PATH).arrayBuffer();
		const collection = Font.collection(buffer);
		expect(collection).toBeNull();
	});

	test("throws for out-of-range collection index", async () => {
		const fontBuffer = await Bun.file(COPTIC_PATH).arrayBuffer();
		const ttcBuffer = makeTtcBuffer([fontBuffer]);

		expect(() => Font.load(ttcBuffer, { collectionIndex: 2 })).toThrow(
			"TTC collection index out of range",
		);
	});
});
