import { describe, expect, test } from "bun:test";
import { getGlyphPath } from "../../src/render/path.ts";
import { Font } from "../../src/font/font.ts";

describe("WOFF2 composite instructions", () => {
	test("preserves Y after composites with instructions in Archivo Black", async () => {
		// 字体来自 Synvas 字体服务，许可见 tests/fixtures/ArchivoBlack-OFL.txt。
		// 预期坐标由原始 TTF 与 fontTools 独立解码 WOFF2 交叉验证。
		const bytes = await Bun.file(
			new URL("../fixtures/ArchivoBlack-Regular.woff2", import.meta.url),
		).arrayBuffer();
		const font = await Font.loadAsync(bytes);
		const path = getGlyphPath(font, font.glyphId(89));
		expect(path?.commands).toEqual([
			{ type: "M", x: 501, y: 0 },
			{ type: "L", x: 280, y: 0 },
			{ type: "L", x: 280, y: 267 },
			{ type: "L", x: 7, y: 688 },
			{ type: "L", x: 261, y: 688 },
			{ type: "L", x: 393, y: 459 },
			{ type: "L", x: 397, y: 459 },
			{ type: "L", x: 529, y: 688 },
			{ type: "L", x: 770, y: 688 },
			{ type: "L", x: 501, y: 267 },
			{ type: "L", x: 501, y: 0 },
			{ type: "Z" },
		]);
	});
});
