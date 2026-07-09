import { describe, expect, test } from "bun:test";
import { decomposePath, getPathBounds } from "../../src/raster/outline-decompose.ts";
import { GrayRaster } from "../../src/raster/gray-raster.ts";
import { createBitmap, FillRule, PixelMode } from "../../src/raster/types.ts";
import type { GlyphPath, PathCommand } from "../../src/render/path.ts";

const BEASTARS_EVENT_9287_DRAWING =
	"m 1155.6 875.8 l 1212.81 957.39 1374.44 870.47 1315.48 792.19 m 1130.31 839.72 l 1154.9 874.78 1800.61 537.09 1772.67 506.26 m 1316.59 791.62 l 1375.54 869.88 1864.1 607.16 1801.46 538.03 m 1104.47 802.88 l 1129.6 838.7 1771.82 505.32 1744.51 475.18 m 1079.99 767.95 l 1103.77 801.86 1743.66 474.24 1717.65 445.53 m 1065.08 746.68 l 1079.27 766.92 1716.79 444.58 1701.01 427.17 m 1041.38 712.88 l 1064.36 745.65 1700.15 426.22 1673.83 397.17 m 1017.42 678.7 l 1040.66 711.85 1672.97 396.21 1646.96 367.51 m 993.72 644.9 l 1016.7 677.68 1646.09 366.55 1621.03 338.92 m 980.13 625.52 l 993 643.88 1620.18 337.96 1605.05 321.26 m 956.44 591.73 l 979.42 624.51 1604.19 320.32 1580.09 293.73 m 934.07 559.82 l 955.72 590.7 1579.23 292.77 1554.18 265.12 m 911.71 527.93 l 933.35 558.81 1553.32 264.17 1529.86 238.3 m 898.91 509.69 l 911 526.91 1529.01 237.34 1514.84 221.71 m 877.35 478.92 l 898.21 508.67 1513.98 220.76 1489.88 194.16 m 856.32 448.93 l 876.63 477.91 1489.02 193.22 1465.58 167.34 m 834.22 417.41 l 855.61 447.92 1464.72 166.39 1442.54 141.91 m 813.44 387.77 l 833.49 416.37 1441.37 140.62 1418.23 115.1 m 793.21 358.92 l 812.47 386.38 1417.36 114.13 1395.19 89.66 m 1372.39 64.68 l 772.43 329.28 792.49 357.89 1394.32 88.7 1372.23 64.32 m 753.54 302.34 l 771.82 328.4 771.74 328.24 1371.64 63.67 1350.41 40.25 m 982.28 180.12 l 981.65 180.38 741.29 284.87 752.83 301.32 1349.54 39.28 1337.31 25.78 m 1772.94 504.73 l 1773.05 504.86 1773.06 504.87 1866.07 607.51 1865.37 607.88 1212.42 958.99 1212.11 958.54 626.91 123.86 627.61 123.56 938.84 -3.33 942.08 -3.33 863.77 28.6 890.44 62.53 1049.83 -3.33 1053.04 -3.33 891.23 63.53 918.29 97.95 918.3 97.95 1156.32 -3.33 1159.49 -3.33 919.09 98.96 946.18 133.4 1265.96 -3.33 1269.07 -3.33 946.97 134.4 975.13 170.21 1329.07 16.69 1310.93 -3.33 1312.57 -3.33 1554.47 263.63 1554.48 263.62 1554.51 263.67 1554.52 263.68 m 975.92 171.21 l 982.11 178.85 1336.44 24.82 1329.95 17.66 m 973.96 170.72 l 945.79 134.9 853.99 174.15 881.5 210.82 m 945.01 133.9 l 917.91 99.46 826.99 138.15 853.23 173.14 m 917.12 98.45 l 890.05 64.03 799.46 101.45 826.22 137.13 m 980.86 179.39 l 974.75 171.72 882.26 211.83 881.1 212.34 734.9 275.75 740.58 283.85 m 771.5 66.23 l 628.79 124.41 734.18 274.72 880.35 211.33 m 862.58 29.09 l 772.68 65.75 798.69 100.44 889.26 63.02";

function parseAssDrawing(source: string): GlyphPath {
	const tokens = source.match(/[ml]|[-+]?\d*\.?\d+/g) ?? [];
	const commands: PathCommand[] = [];
	let i = 0;
	let contourStarted = false;

	const closeContour = () => {
		if (!contourStarted) return;
		commands.push({ type: "Z" });
		contourStarted = false;
	};

	while (i < tokens.length) {
		const op = tokens[i++]!;
		const nums: number[] = [];
		while (i < tokens.length && !/^[ml]$/.test(tokens[i]!)) {
			nums.push(Number(tokens[i++]));
		}

		if (op === "m") {
			for (let n = 0; n + 1 < nums.length; n += 2) {
				closeContour();
				commands.push({ type: "M", x: nums[n]!, y: nums[n + 1]! });
				contourStarted = true;
			}
			continue;
		}

		for (let n = 0; n + 1 < nums.length; n += 2) {
			commands.push({ type: "L", x: nums[n]!, y: nums[n + 1]! });
			contourStarted = true;
		}
	}
	closeContour();

	return { commands, bounds: null };
}

function renderSingleBand(path: GlyphPath) {
	const bounds = getPathBounds(path, 1, false, true);
	if (!bounds) throw new Error("empty path");

	const width = bounds.maxX - bounds.minX;
	const height = bounds.maxY - bounds.minY;
	const offsetX = -bounds.minX;
	const offsetY = -bounds.minY;
	const bitmap = createBitmap(width, height, PixelMode.Gray);
	const raster = new GrayRaster(1 << 20);
	raster.setClip(0, 0, width, height);
	raster.setBandBounds(0, height);
	raster.reset();
	decomposePath(raster, path, 1, offsetX, offsetY, false);
	raster.sweep(bitmap, FillRule.NonZero);

	return { bitmap, width, height, offsetX, offsetY };
}

function renderForcedBanded(
	path: GlyphPath,
	width: number,
	height: number,
	offsetX: number,
	offsetY: number,
) {
	const bitmap = createBitmap(width, height, PixelMode.Gray);
	const raster = new GrayRaster(128);
	raster.renderWithBands(
		bitmap,
		() => decomposePath(raster, path, 1, offsetX, offsetY, false),
		{ minY: 0, maxY: height },
		FillRule.NonZero,
	);
	return bitmap;
}

function bitmapDiff(a: Uint8Array, b: Uint8Array): number {
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) diff++;
	}
	return diff;
}

describe("banded gray rasterization", () => {
	test("matches single-band output for Beastars event 9287 sparse drawing", () => {
		const path = parseAssDrawing(BEASTARS_EVENT_9287_DRAWING);
		const single = renderSingleBand(path);
		expect({ width: single.width, height: single.height }).toEqual({
			width: 1241,
			height: 963,
		});

		const banded = renderForcedBanded(
			path,
			single.width,
			single.height,
			single.offsetX,
			single.offsetY,
		);

		expect(bitmapDiff(banded.buffer, single.bitmap.buffer)).toBe(0);
	});
});
