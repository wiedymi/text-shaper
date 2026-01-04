import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test, expect } from "bun:test";
import { Font } from "../src/font/font.ts";
import { rasterizeGlyph } from "../src/raster/rasterize.ts";
import { PixelMode } from "../src/raster/types.ts";

const DEFAULT_FONT_DIRS = [
	"reference/rustybuzz/benches/fonts",
	"tests/fixtures",
	"tests/fonts",
];

const SYSTEM_FONT_DIRS = [
	"/System/Library/Fonts",
	"/System/Library/Fonts/Supplemental",
	"/Library/Fonts",
	"/Library/Fonts/Supplemental",
	"/Users/uyakauleu/Library/Fonts",
];

const fontExts = new Set([".ttf", ".otf", ".ttc", ".woff2"]);

function shouldSkipFtDumpFont(fontPath: string): boolean {
	return fontPath.toLowerCase().endsWith(".woff2");
}

function collectFonts(dirs: string[]): string[] {
	const fonts: string[] = [];
	function walk(dir: string): void {
		let entries: ReturnType<typeof readdirSync>;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(fullPath);
				continue;
			}
			if (!entry.isFile()) continue;
			const name = entry.name.toLowerCase();
			const ext = name.slice(name.lastIndexOf("."));
			if (!fontExts.has(ext)) continue;
			fonts.push(fullPath);
		}
	}

	for (const dir of dirs) {
		if (!existsSync(dir)) continue;
		walk(dir);
	}
	return fonts.sort();
}

function getFontList(): string[] {
	const envDirs = process.env.HINTING_PARITY_FONT_DIRS;
	if (envDirs) {
		return collectFonts(
			envDirs
				.split(",")
				.map((dir) => dir.trim())
				.filter(Boolean),
		);
	}

	let dirs = [...DEFAULT_FONT_DIRS];
	if (process.env.HINTING_PARITY_INCLUDE_SYSTEM === "1") {
		dirs = dirs.concat(SYSTEM_FONT_DIRS);
	}

	const fonts = collectFonts(dirs);
	const maxFonts = Number.parseInt(
		process.env.HINTING_PARITY_MAX_FONTS ?? "",
		10,
	);
	if (Number.isFinite(maxFonts) && maxFonts > 0) {
		return fonts.slice(0, maxFonts);
	}
	return fonts;
}

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

const ftdumpBin = resolveFtDumpBin();
const testFn = ftdumpBin ? test : test.skip;
const debug = process.env.HINTING_PARITY_DEBUG === "1";
const testTimeout = Number.parseInt(
	process.env.HINTING_PARITY_TIMEOUT ?? "60000",
	10,
);

function runFtDump(
	bin: string,
	fontPath: string,
	fontSize: number,
	glyphIds: number[],
	options?: {
		hinting?: boolean;
		renderMode?: "normal" | "mono";
		target?: "normal" | "light" | "mono";
		sizeMode?: "em" | "real";
		pixels?: boolean;
	},
) {
	const flags: string[] = [];
	if (options?.hinting === false) flags.push("nohint");
	if (options?.target === "light") flags.push("light");
	if (options?.target === "mono") flags.push("mono");
	if (options?.renderMode === "mono") flags.push("mono");
	if (options?.sizeMode === "real") flags.push("real");
	if (options?.pixels) flags.push("pixels");

	const args = [fontPath, String(fontSize), glyphIds.join(",")];
	if (flags.length > 0) args.push(flags.join(","));
	const res = spawnSync(bin, args, { encoding: "utf8" });
	if (res.status !== 0) {
		throw new Error(res.stderr || res.stdout || "ftdump failed");
	}
	return JSON.parse(res.stdout) as Array<{
		gid: number;
		width: number;
		rows: number;
		left: number;
		top: number;
		advanceX: number;
		pixels?: number[];
	}>;
}

function getSizes(): number[] {
	const sizesEnv = process.env.HINTING_PARITY_SIZES;
	if (!sizesEnv) return [16, 24, 32];
	const sizes = sizesEnv
		.split(",")
		.map((size) => Number.parseInt(size.trim(), 10))
		.filter((size) => Number.isFinite(size) && size > 0);
	return sizes.length > 0 ? sizes : [16, 24, 32];
}

function pickGlyphs(font: Font, maxCount: number): number[] {
	const glyphs: number[] = [];
	const seen = new Set<number>();

	const chars = ["A", "e", "é", "Å", "ß", "Ж", "म", "ก", "م", "你"];
	for (const ch of chars) {
		const gid = font.glyphIdForChar(ch);
		if (gid !== 0 && !seen.has(gid)) {
			seen.add(gid);
			glyphs.push(gid);
			if (glyphs.length >= maxCount) return glyphs;
		}
	}

	for (let gid = 1; gid < font.numGlyphs; gid++) {
		const glyph = font.getGlyph(gid);
		if (!glyph || glyph.type !== "composite") continue;
		if (!seen.has(gid)) {
			seen.add(gid);
			glyphs.push(gid);
			if (glyphs.length >= maxCount) break;
		}
	}

	return glyphs;
}

function pickGlyphsByPredicate(
	font: Font,
	maxCount: number,
	predicate: (gid: number) => boolean,
): number[] {
	const glyphs: number[] = [];
	for (let gid = 1; gid < font.numGlyphs; gid++) {
		if (!predicate(gid)) continue;
		glyphs.push(gid);
		if (glyphs.length >= maxCount) break;
	}
	return glyphs;
}

function glyphHasInstructions(
	font: Font,
	glyphId: number,
	depth: number = 0,
): boolean {
	if (depth > 16) return true;
	const glyph = font.getGlyph(glyphId);
	if (!glyph || glyph.type === "empty") return false;
	if (glyph.instructions.length > 0) return true;
	if (glyph.type === "composite") {
		for (const comp of glyph.components) {
			if (glyphHasInstructions(font, comp.glyphId, depth + 1)) return true;
		}
	}
	return false;
}

testFn(
	"hinted raster metrics match FreeType across sizes",
	{ timeout: testTimeout },
	async () => {
	const fontPaths = getFontList();
	if (fontPaths.length === 0) {
		console.warn("hinting parity: no candidate fonts found");
		return;
	}
	if (!ftdumpBin) {
		console.warn("hinting parity: ftdump binary not available");
		return;
	}

	const sizes = getSizes();
	const strict = process.env.HINTING_PARITY_STRICT === "1";
	const includeInstructions =
		process.env.HINTING_PARITY_INCLUDE_INSTRUCTIONS === "1";

	const padding = Number.parseInt(
		process.env.HINTING_PARITY_PADDING ?? "0",
		10,
	);
	const tolerance = Number.parseInt(
		process.env.HINTING_PARITY_TOLERANCE ?? "1",
		10,
	);
	const glyphCount = Number.parseInt(
		process.env.HINTING_PARITY_GLYPHS ?? "12",
		10,
	);
	const instrCount = Number.parseInt(
		process.env.HINTING_PARITY_GLYPHS_INSTR ?? "4",
		10,
	);

	for (const fontPath of fontPaths) {
		if (shouldSkipFtDumpFont(fontPath)) continue;
		let font: Font;
		try {
			font = await Font.fromFile(fontPath);
		} catch {
			continue;
		}
		if (!font.hasHinting) continue;

		let glyphIds = pickGlyphs(font, glyphCount);
		if (!strict) {
			glyphIds = glyphIds.filter((gid) => !glyphHasInstructions(font, gid));
		}

		if ((strict || includeInstructions) && instrCount > 0) {
			const instructionGlyphs = pickGlyphsByPredicate(
				font,
				instrCount,
				(gid) => glyphHasInstructions(font, gid),
			);
			glyphIds = Array.from(new Set([...glyphIds, ...instructionGlyphs]));
		}

		if (glyphIds.length === 0) continue;

		for (const fontSize of sizes) {
			let ft: ReturnType<typeof runFtDump>;
			try {
				ft = runFtDump(ftdumpBin, fontPath, fontSize, glyphIds, {
					target: "light",
				});
			} catch (err) {
				if (debug) {
					console.warn(
						`ftdump failed font=${fontPath} size=${fontSize}: ${String(err)}`,
					);
				}
				continue;
			}
			const ftMap = new Map(ft.map((entry) => [entry.gid, entry]));

			for (const gid of glyphIds) {
				const ftEntry = ftMap.get(gid);
				if (!ftEntry) continue;
				if (ftEntry.width === 0 || ftEntry.rows === 0) continue;

				const ours = rasterizeGlyph(font, gid, fontSize, {
					hinting: true,
					padding,
					pixelMode: PixelMode.Gray,
				});
				expect(ours).not.toBeNull();
				if (!ours) continue;

				const widthDelta = Math.abs(ours.bitmap.width - ftEntry.width);
				const heightDelta = Math.abs(ours.bitmap.rows - ftEntry.rows);
				const leftDelta = Math.abs(ours.bearingX - ftEntry.left);
				const topDelta = Math.abs(ours.bearingY - ftEntry.top);
				if (
					debug &&
					(widthDelta > tolerance ||
						heightDelta > tolerance ||
						leftDelta > tolerance ||
						topDelta > tolerance)
				) {
					console.warn(
						`hinted mismatch size=${fontSize} font=${fontPath} gid=${gid} ` +
							`ours=${ours.bitmap.width}x${ours.bitmap.rows} ` +
							`b=${ours.bearingX},${ours.bearingY} ` +
							`ft=${ftEntry.width}x${ftEntry.rows} ` +
							`b=${ftEntry.left},${ftEntry.top}`,
					);
				}
				expect(widthDelta).toBeLessThanOrEqual(tolerance);
				expect(heightDelta).toBeLessThanOrEqual(tolerance);
				expect(leftDelta).toBeLessThanOrEqual(tolerance);
				expect(topDelta).toBeLessThanOrEqual(tolerance);
			}
		}
	}
	},
);

testFn(
	"unhinted raster metrics match FreeType",
	{ timeout: testTimeout },
	async () => {
	const fontPaths = getFontList();
	if (fontPaths.length === 0) {
		console.warn("hinting parity: no candidate fonts found");
		return;
	}
	if (!ftdumpBin) {
		console.warn("hinting parity: ftdump binary not available");
		return;
	}

	const sizes = getSizes();
	const padding = Number.parseInt(
		process.env.HINTING_PARITY_PADDING ?? "0",
		10,
	);
	const tolerance = Number.parseInt(
		process.env.HINTING_PARITY_TOLERANCE ?? "1",
		10,
	);
	const glyphCount = Number.parseInt(
		process.env.HINTING_PARITY_GLYPHS ?? "12",
		10,
	);

	for (const fontPath of fontPaths) {
		if (shouldSkipFtDumpFont(fontPath)) continue;
		let font: Font;
		try {
			font = await Font.fromFile(fontPath);
		} catch {
			continue;
		}
		if (font.isColorFont) continue;
		if (font.isCFF && font.isVariable) continue;

		const glyphIds = pickGlyphs(font, glyphCount);
		if (glyphIds.length === 0) continue;

		for (const fontSize of sizes) {
			let ft: ReturnType<typeof runFtDump>;
			try {
				ft = runFtDump(ftdumpBin, fontPath, fontSize, glyphIds, {
					hinting: false,
				});
			} catch (err) {
				if (debug) {
					console.warn(
						`ftdump failed font=${fontPath} size=${fontSize}: ${String(err)}`,
					);
				}
				continue;
			}
			const ftMap = new Map(ft.map((entry) => [entry.gid, entry]));

			for (const gid of glyphIds) {
				const ftEntry = ftMap.get(gid);
				if (!ftEntry) continue;
				if (ftEntry.width === 0 || ftEntry.rows === 0) continue;

				const ours = rasterizeGlyph(font, gid, fontSize, {
					hinting: false,
					padding,
					pixelMode: PixelMode.Gray,
				});
				if (!ours) {
					if (debug) {
						console.warn(
							`unhinted skip size=${fontSize} font=${fontPath} gid=${gid} (no outline)`,
						);
					}
					continue;
				}

				const widthDelta = Math.abs(ours.bitmap.width - ftEntry.width);
				const heightDelta = Math.abs(ours.bitmap.rows - ftEntry.rows);
				const leftDelta = Math.abs(ours.bearingX - ftEntry.left);
				const topDelta = Math.abs(ours.bearingY - ftEntry.top);
				if (
					debug &&
					(widthDelta > tolerance ||
						heightDelta > tolerance ||
						leftDelta > tolerance ||
						topDelta > tolerance)
				) {
					console.warn(
						`unhinted mismatch size=${fontSize} font=${fontPath} gid=${gid} ` +
							`ours=${ours.bitmap.width}x${ours.bitmap.rows} ` +
							`b=${ours.bearingX},${ours.bearingY} ` +
							`ft=${ftEntry.width}x${ftEntry.rows} ` +
							`b=${ftEntry.left},${ftEntry.top}`,
					);
				}
				expect(widthDelta).toBeLessThanOrEqual(tolerance);
				expect(heightDelta).toBeLessThanOrEqual(tolerance);
				expect(leftDelta).toBeLessThanOrEqual(tolerance);
				expect(topDelta).toBeLessThanOrEqual(tolerance);
			}
		}
	}
	},
);

testFn(
	"real-dim raster metrics match FreeType (unhinted)",
	{ timeout: testTimeout },
	async () => {
		const fontPaths = getFontList();
		if (fontPaths.length === 0) {
			console.warn("hinting parity: no candidate fonts found");
			return;
		}
		if (!ftdumpBin) {
			console.warn("hinting parity: ftdump binary not available");
			return;
		}

		const sizes = getSizes().slice(0, 1);
		const padding = Number.parseInt(
			process.env.HINTING_PARITY_PADDING ?? "0",
			10,
		);
		const tolerance = Number.parseInt(
			process.env.HINTING_PARITY_TOLERANCE ?? "1",
			10,
		);
		const glyphCount = Number.parseInt(
			process.env.HINTING_PARITY_GLYPHS_REAL ?? "6",
			10,
		);

		for (const fontPath of fontPaths) {
			if (shouldSkipFtDumpFont(fontPath)) continue;
			let font: Font;
			try {
				font = await Font.fromFile(fontPath);
			} catch {
				continue;
			}
			if (font.isColorFont) continue;
			if (font.isCFF && font.isVariable) continue;

			const glyphIds = pickGlyphs(font, glyphCount);
			if (glyphIds.length === 0) continue;

			for (const fontSize of sizes) {
				let ft: ReturnType<typeof runFtDump>;
				try {
					ft = runFtDump(ftdumpBin, fontPath, fontSize, glyphIds, {
						hinting: false,
						target: "normal",
						sizeMode: "real",
					});
				} catch (err) {
					if (debug) {
						console.warn(
							`ftdump failed font=${fontPath} size=${fontSize}: ${String(err)}`,
						);
					}
					continue;
				}
				const ftMap = new Map(ft.map((entry) => [entry.gid, entry]));

				for (const gid of glyphIds) {
					const ftEntry = ftMap.get(gid);
					if (!ftEntry) continue;
					if (ftEntry.width === 0 || ftEntry.rows === 0) continue;

					const ours = rasterizeGlyph(font, gid, fontSize, {
						hinting: false,
						padding,
						pixelMode: PixelMode.Gray,
						sizeMode: "height",
					});
					expect(ours).not.toBeNull();
					if (!ours) continue;

					const widthDelta = Math.abs(ours.bitmap.width - ftEntry.width);
					const heightDelta = Math.abs(ours.bitmap.rows - ftEntry.rows);
					const leftDelta = Math.abs(ours.bearingX - ftEntry.left);
					const topDelta = Math.abs(ours.bearingY - ftEntry.top);
					if (
						debug &&
						(widthDelta > tolerance ||
							heightDelta > tolerance ||
							leftDelta > tolerance ||
							topDelta > tolerance)
					) {
						console.warn(
							`real-dim mismatch size=${fontSize} font=${fontPath} gid=${gid} ` +
								`ours=${ours.bitmap.width}x${ours.bitmap.rows} ` +
								`b=${ours.bearingX},${ours.bearingY} ` +
								`ft=${ftEntry.width}x${ftEntry.rows} ` +
								`b=${ftEntry.left},${ftEntry.top}`,
						);
					}
					expect(widthDelta).toBeLessThanOrEqual(tolerance);
					expect(heightDelta).toBeLessThanOrEqual(tolerance);
					expect(leftDelta).toBeLessThanOrEqual(tolerance);
					expect(topDelta).toBeLessThanOrEqual(tolerance);
				}
			}
		}
	},
);

testFn(
	"light hinting pixels match FreeType for Arial X",
	{ timeout: testTimeout },
	async () => {
		if (!ftdumpBin) {
			console.warn("hinting parity: ftdump binary not available");
			return;
		}

		const preferredArial =
			process.env.HINTING_PARITY_ARIAL_PATH ??
			(existsSync("/Users/uyakauleu/Downloads/aria.ttf")
				? "/Users/uyakauleu/Downloads/aria.ttf"
				: "/System/Library/Fonts/Supplemental/Arial.ttf");
		const arialPath = preferredArial;
		if (!existsSync(arialPath)) {
			console.warn("hinting parity: Arial.ttf not available");
			return;
		}

		const font = await Font.fromFile(arialPath);
		if (!font.hasHinting) return;

		const gid = font.glyphId("X".codePointAt(0)!);
		if (!gid) return;

		const fontSize = 72;
		const ft = runFtDump(ftdumpBin, arialPath, fontSize, [gid], {
			target: "light",
			pixels: true,
		});
		const ftEntry = ft[0];
		if (!ftEntry || !ftEntry.pixels) return;

		const ours = rasterizeGlyph(font, gid, fontSize, {
			hinting: true,
			padding: 0,
			pixelMode: PixelMode.Gray,
		});
		expect(ours).not.toBeNull();
		if (!ours) return;

		expect(ours.bitmap.width).toBe(ftEntry.width);
		expect(ours.bitmap.rows).toBe(ftEntry.rows);

		const oursBuf = ours.bitmap.buffer;
		const ftBuf = ftEntry.pixels;
		const total = ours.bitmap.width * ours.bitmap.rows;
		const tol = Number.parseInt(
			process.env.HINTING_PARITY_PIXEL_TOLERANCE ?? "8",
			10,
		);
		const maxRatio = Number.parseFloat(
			process.env.HINTING_PARITY_PIXEL_MAX_RATIO ?? "0.02",
		);

		let diffCount = 0;
		let maxDiff = 0;
		for (let i = 0; i < total; i++) {
			const d = Math.abs((oursBuf[i] ?? 0) - (ftBuf[i] ?? 0));
			if (d > tol) diffCount++;
			if (d > maxDiff) maxDiff = d;
		}

		const ratio = total > 0 ? diffCount / total : 0;
		if (debug && ratio > maxRatio) {
			console.warn(
				`Arial X pixel diff ratio=${ratio.toFixed(4)} maxDiff=${maxDiff}`,
			);
		}
		expect(ratio).toBeLessThanOrEqual(maxRatio);
	},
);

testFn(
	"hinted raster metrics match FreeType for composite glyphs",
	{ timeout: testTimeout },
	async () => {
	const fontPaths = getFontList();
	if (fontPaths.length === 0) {
		console.warn("hinting parity: no candidate fonts found");
		return;
	}
	if (!ftdumpBin) {
		console.warn("hinting parity: ftdump binary not available");
		return;
	}

	const strict = process.env.HINTING_PARITY_STRICT === "1";
	const fontSize = Number.parseInt(
		process.env.HINTING_PARITY_FONT_SIZE ?? "64",
		10,
	);
	const padding = Number.parseInt(
		process.env.HINTING_PARITY_PADDING ?? "0",
		10,
	);
	const tolerance = Number.parseInt(
		process.env.HINTING_PARITY_TOLERANCE ?? "1",
		10,
	);
	const glyphCount = Number.parseInt(
		process.env.HINTING_PARITY_GLYPHS ?? "12",
		10,
	);

	for (const fontPath of fontPaths) {
		if (shouldSkipFtDumpFont(fontPath)) continue;
		let font: Font;
		try {
			font = await Font.fromFile(fontPath);
		} catch {
			continue;
		}
		if (!font.hasHinting) continue;

	let glyphIds = pickGlyphs(font, glyphCount);
	if (!strict) {
		glyphIds = glyphIds.filter((gid) => !glyphHasInstructions(font, gid));
	}
	if (glyphIds.length === 0) continue;

		let ft: ReturnType<typeof runFtDump>;
		try {
			ft = runFtDump(ftdumpBin, fontPath, fontSize, glyphIds, {
				target: "light",
			});
		} catch (err) {
			if (debug) {
				console.warn(
					`ftdump failed font=${fontPath} size=${fontSize}: ${String(err)}`,
				);
			}
			continue;
		}
		const ftMap = new Map(ft.map((entry) => [entry.gid, entry]));

		for (const gid of glyphIds) {
			const ftEntry = ftMap.get(gid);
			if (!ftEntry) continue;
			if (ftEntry.width === 0 || ftEntry.rows === 0) continue;

			const ours = rasterizeGlyph(font, gid, fontSize, {
				hinting: true,
				padding,
				pixelMode: PixelMode.Gray,
			});
			expect(ours).not.toBeNull();
			if (!ours) continue;

			const widthDelta = Math.abs(ours.bitmap.width - ftEntry.width);
			const heightDelta = Math.abs(ours.bitmap.rows - ftEntry.rows);
			const leftDelta = Math.abs(ours.bearingX - ftEntry.left);
			const topDelta = Math.abs(ours.bearingY - ftEntry.top);
			if (
				debug &&
				(widthDelta > tolerance ||
					heightDelta > tolerance ||
					leftDelta > tolerance ||
					topDelta > tolerance)
			) {
				console.warn(
					`composite mismatch size=${fontSize} font=${fontPath} gid=${gid} ` +
						`ours=${ours.bitmap.width}x${ours.bitmap.rows} ` +
						`b=${ours.bearingX},${ours.bearingY} ` +
						`ft=${ftEntry.width}x${ftEntry.rows} ` +
						`b=${ftEntry.left},${ftEntry.top}`,
				);
			}
			expect(widthDelta).toBeLessThanOrEqual(tolerance);
			expect(heightDelta).toBeLessThanOrEqual(tolerance);
			expect(leftDelta).toBeLessThanOrEqual(tolerance);
			expect(topDelta).toBeLessThanOrEqual(tolerance);
		}
	}
	},
);

testFn(
	"Geneva hinted metrics match FreeType (strict)",
	{ timeout: testTimeout },
	async () => {
	if (!ftdumpBin) {
		console.warn("hinting parity: ftdump binary not available");
		return;
	}

	const genevaPath =
		process.env.HINTING_PARITY_GENEVA_PATH ??
		"/System/Library/Fonts/Geneva.ttf";
	if (!existsSync(genevaPath)) {
		console.warn(`hinting parity: Geneva font not found at ${genevaPath}`);
		return;
	}

	const sizesEnv = process.env.HINTING_PARITY_GENEVA_SIZES;
	const sizes = sizesEnv
		? sizesEnv
				.split(",")
				.map((size) => Number.parseInt(size.trim(), 10))
				.filter((size) => Number.isFinite(size) && size > 0)
		: [32];

	const glyphId = Number.parseInt(
		process.env.HINTING_PARITY_GENEVA_GID ?? "5",
		10,
	);
	const padding = Number.parseInt(
		process.env.HINTING_PARITY_PADDING ?? "0",
		10,
	);
	const tolerance = Number.parseInt(
		process.env.HINTING_PARITY_TOLERANCE ?? "1",
		10,
	);

	const font = await Font.fromFile(genevaPath);
	if (!font.hasHinting) {
		console.warn("hinting parity: Geneva has no hinting");
		return;
	}

	for (const fontSize of sizes) {
		let ft: ReturnType<typeof runFtDump>;
		try {
			ft = runFtDump(ftdumpBin, genevaPath, fontSize, [glyphId], {
				target: "light",
			});
		} catch (err) {
			if (debug) {
				console.warn(
					`ftdump failed font=${genevaPath} size=${fontSize}: ${String(err)}`,
				);
			}
			continue;
		}
		const ftEntry = ft[0];
		if (!ftEntry || ftEntry.width === 0 || ftEntry.rows === 0) continue;

		const ours = rasterizeGlyph(font, glyphId, fontSize, {
			hinting: true,
			padding,
			pixelMode: PixelMode.Gray,
		});
		expect(ours).not.toBeNull();
		if (!ours) continue;

		const widthDelta = Math.abs(ours.bitmap.width - ftEntry.width);
		const heightDelta = Math.abs(ours.bitmap.rows - ftEntry.rows);
		const leftDelta = Math.abs(ours.bearingX - ftEntry.left);
		const topDelta = Math.abs(ours.bearingY - ftEntry.top);

		expect(widthDelta).toBeLessThanOrEqual(tolerance);
		expect(heightDelta).toBeLessThanOrEqual(tolerance);
		expect(leftDelta).toBeLessThanOrEqual(tolerance);
		expect(topDelta).toBeLessThanOrEqual(tolerance);
	}
	},
);
