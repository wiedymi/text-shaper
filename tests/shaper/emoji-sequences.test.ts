import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { UnicodeBuffer } from "../../src/buffer/unicode-buffer.ts";
import { Font } from "../../src/font/font.ts";
import { releaseBuffer, shape } from "../../src/shaper/shaper.ts";
import type { GlyphInfo } from "../../src/types.ts";

const APPLE_COLOR_EMOJI_PATH = "/System/Library/Fonts/Apple Color Emoji.ttc";

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

describeEmoji("emoji sequence composition via morx (Apple Color Emoji)", () => {
	let font: Font;

	beforeAll(() => {
		font = loadCollectionFace(APPLE_COLOR_EMOJI_PATH);
	});

	function expectSingleComposedGlyph(text: string, componentCp: number) {
		const infos = shapeText(font, text);
		expect(infos.length).toBe(1);
		expect(infos[0]?.glyphId).toBeGreaterThan(0);
		expect(infos[0]?.glyphId).not.toBe(font.glyphId(componentCp));
	}

	test("regional-indicator pairs compose into flag glyphs", () => {
		expectSingleComposedGlyph("🇺🇸", 0x1f1fa);
		expectSingleComposedGlyph("🇨🇳", 0x1f1e8);
	});

	test("distinct flags produce distinct glyphs", () => {
		const us = shapeText(font, "🇺🇸");
		const cn = shapeText(font, "🇨🇳");
		expect(us[0]?.glyphId).not.toBe(cn[0]?.glyphId);
	});

	test("keycap sequences compose (digit + VS16 + U+20E3)", () => {
		expectSingleComposedGlyph("1️⃣", 0x31);
		expectSingleComposedGlyph("#️⃣", 0x23);
	});

	test("ZWJ sequences compose", () => {
		expectSingleComposedGlyph("👨‍👩‍👦", 0x1f468);
	});

	test("VS16 + ZWJ sequences compose (rainbow flag)", () => {
		expectSingleComposedGlyph("🏳️‍🌈", 0x1f3f3);
	});

	test("skin-tone modifier sequences compose", () => {
		expectSingleComposedGlyph("👍🏽", 0x1f44d);
	});

	test("independent emoji stay separate", () => {
		const infos = shapeText(font, "😀🔥");
		expect(infos.length).toBe(2);
		expect(infos[0]?.glyphId).toBe(font.glyphId(0x1f600));
		expect(infos[1]?.glyphId).toBe(font.glyphId(0x1f525));
	});

	test("sequences compose inside a longer run", () => {
		const infos = shapeText(font, "🔥🇯🇵1️⃣🔥");
		expect(infos.length).toBe(4);
		expect(infos[0]?.glyphId).toBe(font.glyphId(0x1f525));
		expect(infos[3]?.glyphId).toBe(font.glyphId(0x1f525));
	});
});
