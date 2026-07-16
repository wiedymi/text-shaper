import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { UnicodeBuffer } from "../../src/buffer/unicode-buffer.ts";
import { Font } from "../../src/font/font.ts";
import { releaseBuffer, shape } from "../../src/shaper/shaper.ts";
import type { GlyphInfo } from "../../src/types.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";
const APPLE_COLOR_EMOJI_PATH = "/System/Library/Fonts/Apple Color Emoji.ttc";
const HIRAGINO_GB_PATH = "/System/Library/Fonts/Hiragino Sans GB.ttc";

function loadCollectionFace(path: string): Font {
	const raw = readFileSync(path);
	const buffer = raw.buffer.slice(
		raw.byteOffset,
		raw.byteOffset + raw.byteLength,
	) as ArrayBuffer;
	const collection = Font.collection(buffer);
	if (!collection) throw new Error(`not a font collection: ${path}`);
	return collection.get(0);
}

function shapeText(font: Font, text: string): GlyphInfo[] {
	const unicodeBuffer = new UnicodeBuffer();
	unicodeBuffer.addStr(text);
	const glyphBuffer = shape(font, unicodeBuffer);
	const infos = glyphBuffer.infos.map((info) => ({ ...info }));
	releaseBuffer(glyphBuffer);
	return infos;
}

const describeEmoji = existsSync(APPLE_COLOR_EMOJI_PATH)
	? describe
	: describe.skip;

describeEmoji("VS16 emoji-presentation sequences (Apple Color Emoji)", () => {
	let font: Font;

	beforeAll(() => {
		font = loadCollectionFace(APPLE_COLOR_EMOJI_PATH);
	});

	test("U+2764 U+FE0F shapes to the bare heart glyph only", () => {
		const bare = shapeText(font, "❤");
		const vs16 = shapeText(font, "❤️");
		expect(bare.length).toBe(1);
		expect(vs16.length).toBe(1);
		expect(vs16[0]?.glyphId).toBe(bare[0]?.glyphId ?? -1);
	});

	test("the dropped selector merges into the base cluster", () => {
		const infos = shapeText(font, "x⚠️");
		expect(infos.length).toBe(2);
		expect(infos[1]?.glyphId).toBe(font.glyphId(0x26a0));
		expect(infos[1]?.cluster).toBe(1);
	});

	test("plain emoji text is unaffected", () => {
		const infos = shapeText(font, "✅\u{1F525}");
		expect(infos.length).toBe(2);
		expect(infos[0]?.glyphId).toBe(font.glyphId(0x2705));
	});
});

const describeIvs = existsSync(HIRAGINO_GB_PATH) ? describe : describe.skip;

describeIvs("cmap format 14 variation glyphs (Hiragino Sans GB)", () => {
	let font: Font;

	beforeAll(() => {
		font = loadCollectionFace(HIRAGINO_GB_PATH);
	});

	test("U+793C U+FE00 selects the non-default variation glyph", () => {
		const defaultGlyph = font.glyphId(0x793c);
		const infos = shapeText(font, "礼︀");
		expect(infos.length).toBe(1);
		expect(infos[0]?.glyphId).not.toBe(0);
		expect(infos[0]?.glyphId).not.toBe(defaultGlyph);
	});

	test("a base without a variation mapping keeps its default glyph", () => {
		const defaultGlyph = font.glyphId(0x4e00);
		const infos = shapeText(font, "一︀");
		expect(infos.length).toBe(1);
		expect(infos[0]?.glyphId).toBe(defaultGlyph);
	});
});

const describeArial = existsSync(ARIAL_PATH) ? describe : describe.skip;

describeArial("selectors without format 14 coverage (Arial)", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	test("U+FE0F after a base is dropped instead of shaping as .notdef", () => {
		const infos = shapeText(font, "a️");
		expect(infos.length).toBe(1);
		expect(infos[0]?.glyphId).toBe(font.glyphId(0x61));
	});

	test("text without selectors is unaffected", () => {
		const infos = shapeText(font, "ab");
		expect(infos.length).toBe(2);
	});
});
