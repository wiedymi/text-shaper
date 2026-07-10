import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import type { GlyphPath } from "../../src/render/path.ts";
import { rasterizePath } from "../../src/raster/rasterize.ts";
import { FillRule, PixelMode } from "../../src/raster/types.ts";

const WIDTH = 640;
const HEIGHT = 360;

function sha256(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function render(path: GlyphPath): Uint8Array {
	return rasterizePath(path, {
		width: WIDTH,
		height: HEIGHT,
		scale: 1,
		offsetX: 80,
		offsetY: 80,
		flipY: false,
		fillRule: FillRule.NonZero,
		pixelMode: PixelMode.Gray,
		rasterizer: "libass",
	}).buffer;
}

describe("libass raster parity", () => {
	test("straight ASS drawing matches the libass alpha mask", () => {
		const path: GlyphPath = {
			bounds: null,
			commands: [
				{ type: "M", x: 0, y: 0 },
				{ type: "L", x: 100, y: 0 },
				{ type: "L", x: 75, y: 30 },
				{ type: "L", x: 0, y: 30 },
				{ type: "Z" },
			],
		};
		const bitmap = render(path);
		expect(bitmap.reduce((sum, value) => sum + value, 0)).toBe(669395);
		expect(sha256(bitmap)).toBe(
			"c2d7a2abde382b463fb446cf5cb2dda17fd3aa605d6ffcbf69ffeae88e68815b",
		);
	});

	test("cubic ASS drawing matches the libass alpha mask", () => {
		const path: GlyphPath = {
			bounds: null,
			commands: [
				{ type: "M", x: 0, y: 30 },
				{ type: "C", x1: 0, y1: 0, x2: 100, y2: 0, x: 100, y: 30 },
				{ type: "C", x1: 100, y1: 60, x2: 0, y2: 60, x: 0, y: 30 },
				{ type: "Z" },
			],
		};
		const bitmap = render(path);
		expect(bitmap.reduce((sum, value) => sum + value, 0)).toBe(914218);
		expect(sha256(bitmap)).toBe(
			"f5bcd237d51389a56f2b4e5058bc9a99bc1a2985eae8555f1f75eb647b006455",
		);
	});
});
