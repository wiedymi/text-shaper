import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { Font } from "../../src/font/font.ts";
import { transformBitmap2D } from "../../src/raster/bitmap-utils.ts";
import { PixelMode, type Bitmap } from "../../src/raster/types.ts";

function resolveFtDumpBin(): string | null {
	const envBin = process.env.FTDUMP_BIN;
	if (envBin && existsSync(envBin)) return envBin;

	const source = "tools/freetype/ftdump.c";
	if (!existsSync(source)) return null;

	const pkg = spawnSync("pkg-config", ["--cflags", "--libs", "freetype2"], {
		encoding: "utf8",
	});
	if (pkg.status !== 0) return null;

	const outPath = join(tmpdir(), `text-shaper-ftdump-${process.pid}`);
	const args = [
		"-O2",
		"-std=c99",
		source,
		...pkg.stdout.trim().split(/\s+/),
		"-o",
		outPath,
	];
	const build = spawnSync("cc", args, { encoding: "utf8" });
	if (build.status !== 0) return null;

	return outPath;
}

function runFtDump(
	bin: string,
	fontPath: string,
	fontSize: number,
	glyphId: number,
	options?: {
		flags?: string;
		matrix?: [number, number, number, number, number, number];
		delta26?: { x: number; y: number };
	},
) {
	const args = [fontPath, String(fontSize), String(glyphId)];
	if (options?.flags) args.push(options.flags);
	if (options?.matrix) args.push(options.matrix.join(","));
	if (options?.delta26) {
		args.push(`${options.delta26.x},${options.delta26.y}`);
	}
	const res = spawnSync(bin, args, { encoding: "utf8" });
	if (res.status !== 0) {
		throw new Error(res.stderr || res.stdout || "ftdump failed");
	}
	const parsed = JSON.parse(res.stdout) as Array<{
		gid: number;
		width: number;
		rows: number;
		left: number;
		top: number;
		pixels?: number[];
	}>;
	return parsed[0]!;
}

const ftdumpBin = resolveFtDumpBin();
const testFn = ftdumpBin ? test : test.skip;

testFn("transformBitmap2D matches FreeType bitmap transform metrics", async () => {
	const fontPath = "tests/fonts/STIXTwoMath-Regular.otf";
	expect(existsSync(fontPath)).toBe(true);

	const font = await Font.fromFile(fontPath);
	let gid = font.glyphIdForChar("A");
	if (!gid) gid = 1;
	const size = 32;

	const matrix: [number, number, number, number, number, number] = [
		1,
		0,
		0,
		1,
		0.3,
		-0.4,
	];
	const delta26 = { x: 12, y: -8 };

	const src = runFtDump(ftdumpBin!, fontPath, size, gid, {
		flags: "nohint,pixels",
	});
	const transformed = runFtDump(ftdumpBin!, fontPath, size, gid, {
		flags: "nohint,pixels",
		matrix,
		delta26,
	});

	expect(src.pixels).toBeDefined();
	expect(transformed.pixels).toBeDefined();
	if (!src.pixels || !transformed.pixels) return;

	const bitmap: Bitmap = {
		width: src.width,
		rows: src.rows,
		pitch: src.width,
		buffer: Uint8Array.from(src.pixels),
		pixelMode: PixelMode.Gray,
		numGrays: 256,
	};

	const result = transformBitmap2D(bitmap, matrix, {
		bearingX: src.left,
		bearingY: src.top,
		offsetX26: delta26.x,
		offsetY26: delta26.y,
	});

	expect(Math.abs(result.bitmap.width - transformed.width)).toBeLessThanOrEqual(
		1,
	);
	expect(Math.abs(result.bitmap.rows - transformed.rows)).toBeLessThanOrEqual(1);

	if (result.bitmap.width !== transformed.width) return;
	if (result.bitmap.rows !== transformed.rows) return;

	const out = result.bitmap.buffer;
	const ft = transformed.pixels;
	let diff = 0;
	let sum = 0;
	for (let i = 0; i < ft.length; i++) {
		const a = out[i] ?? 0;
		const b = ft[i] ?? 0;
		diff += Math.abs(a - b);
		sum += b;
	}
	const denom = Math.max(1, sum);
	expect(diff / denom).toBeLessThan(0.08);
});
