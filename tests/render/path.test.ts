import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../src/font/font.ts";
import {
	contourToPath,
	getGlyphPath,
	pathToSVG,
	glyphToSVG,
	glyphBufferToShapedGlyphs,
	getTextWidth,
	type PathCommand,
	type GlyphPath,
	type ShapedGlyph,
	shapedTextToSVG,
} from "../../src/render/path.ts";
import type { Contour, GlyphPoint } from "../../src/font/tables/glyf.ts";
import { GlyphBuffer } from "../../src/buffer/glyph-buffer.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("render/path", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("contourToPath", () => {
		test("empty contour returns empty array", () => {
			const result = contourToPath([]);
			expect(result).toEqual([]);
		});

		test("single on-curve point creates move and close", () => {
			const contour: Contour = [{ x: 100, y: 200, onCurve: true }];
			const result = contourToPath(contour);
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]!.type).toBe("M");
			expect(result[result.length - 1]!.type).toBe("Z");
		});

		test("two on-curve points creates line", () => {
			const contour: Contour = [
				{ x: 0, y: 0, onCurve: true },
				{ x: 100, y: 100, onCurve: true },
			];
			const result = contourToPath(contour);
			expect(result[0]).toEqual({ type: "M", x: 0, y: 0 });
			expect(result[1]).toEqual({ type: "L", x: 100, y: 100 });
			expect(result[result.length - 1]!.type).toBe("Z");
		});

		test("on-curve off-curve on-curve creates quadratic", () => {
			const contour: Contour = [
				{ x: 0, y: 0, onCurve: true },
				{ x: 50, y: 100, onCurve: false }, // Control point
				{ x: 100, y: 0, onCurve: true },
			];
			const result = contourToPath(contour);
			const quadCmd = result.find((c) => c.type === "Q");
			expect(quadCmd).toBeDefined();
			if (quadCmd && quadCmd.type === "Q") {
				expect(quadCmd.x1).toBe(50);
				expect(quadCmd.y1).toBe(100);
				expect(quadCmd.x).toBe(100);
				expect(quadCmd.y).toBe(0);
			}
		});

		test("consecutive off-curve points create implied on-curve", () => {
			// Two consecutive off-curve points should create implied midpoint
			const contour: Contour = [
				{ x: 0, y: 0, onCurve: true },
				{ x: 30, y: 50, onCurve: false },
				{ x: 70, y: 50, onCurve: false },
				{ x: 100, y: 0, onCurve: true },
			];
			const result = contourToPath(contour);
			// Should have quadratic curves
			const quadCmds = result.filter((c) => c.type === "Q");
			expect(quadCmds.length).toBeGreaterThan(0);
		});

		test("all off-curve points still produces valid path", () => {
			const contour: Contour = [
				{ x: 0, y: 50, onCurve: false },
				{ x: 50, y: 100, onCurve: false },
				{ x: 100, y: 50, onCurve: false },
				{ x: 50, y: 0, onCurve: false },
			];
			const result = contourToPath(contour);
			// Should start with implied on-curve point at midpoint
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]!.type).toBe("M");
			expect(result[result.length - 1]!.type).toBe("Z");
		});

		test("contour always closes with Z command", () => {
			const contour: Contour = [
				{ x: 0, y: 0, onCurve: true },
				{ x: 100, y: 0, onCurve: true },
				{ x: 50, y: 100, onCurve: true },
			];
			const result = contourToPath(contour);
			expect(result[result.length - 1]).toEqual({ type: "Z" });
		});
	});

	describe("getGlyphPath", () => {
		test("returns empty path for invalid glyph ID", () => {
			const result = getGlyphPath(font, 99999);
			// Invalid glyph returns empty path, not null
			expect(result).not.toBeNull();
			expect(result!.commands.length).toBe(0);
		});

		test("returns path for valid glyph", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (glyphId) {
				const result = getGlyphPath(font, glyphId);
				expect(result).not.toBeNull();
				expect(result!.commands.length).toBeGreaterThan(0);
			}
		});

		test("path starts with M command", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (glyphId) {
				const result = getGlyphPath(font, glyphId);
				if (result && result.commands.length > 0) {
					expect(result.commands[0]!.type).toBe("M");
				}
			}
		});

		test("path includes bounds", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (glyphId) {
				const result = getGlyphPath(font, glyphId);
				if (result) {
					// Bounds may be null for empty glyphs, but should exist for 'A'
					expect(result.bounds).toBeDefined();
				}
			}
		});

		test("space glyph may have no contours", () => {
			const glyphId = font.glyphId(" ".codePointAt(0)!);
			if (glyphId) {
				const result = getGlyphPath(font, glyphId);
				// Space typically has no outline commands
				expect(result).toBeDefined();
			}
		});
	});

	describe("pathToSVG", () => {
		test("empty path produces empty string", () => {
			const path: GlyphPath = { commands: [], bounds: null };
			const result = pathToSVG(path);
			expect(result).toBe("");
		});

		test("move command produces M", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const result = pathToSVG(path);
			// Default flipY is true, so y becomes -20
			expect(result).toContain("M 10 -20");
		});

		test("line command produces L", () => {
			const path: GlyphPath = {
				commands: [{ type: "L", x: 100, y: 50 }],
				bounds: null,
			};
			const result = pathToSVG(path);
			expect(result).toContain("L 100 -50");
		});

		test("quadratic command produces Q", () => {
			const path: GlyphPath = {
				commands: [{ type: "Q", x1: 50, y1: 100, x: 100, y: 0 }],
				bounds: null,
			};
			const result = pathToSVG(path);
			expect(result).toContain("Q 50 -100 100 0");
		});

		test("cubic command produces C", () => {
			const path: GlyphPath = {
				commands: [{ type: "C", x1: 25, y1: 50, x2: 75, y2: 50, x: 100, y: 0 }],
				bounds: null,
			};
			const result = pathToSVG(path);
			expect(result).toContain("C 25 -50 75 -50 100 0");
		});

		test("close command produces Z", () => {
			const path: GlyphPath = {
				commands: [{ type: "Z" }],
				bounds: null,
			};
			const result = pathToSVG(path);
			expect(result).toBe("Z");
		});

		test("flipY=false keeps coordinates as-is", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const result = pathToSVG(path, { flipY: false });
			expect(result).toContain("M 10 20");
		});

		test("scale option multiplies coordinates", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const result = pathToSVG(path, { scale: 2, flipY: false });
			expect(result).toContain("M 20 40");
		});

		test("multiple commands joined by spaces", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 0 },
					{ type: "Z" },
				],
				bounds: null,
			};
			const result = pathToSVG(path, { flipY: false });
			expect(result).toBe("M 0 0 L 100 0 Z");
		});
	});

	describe("glyphToSVG", () => {
		test("returns null for invalid glyph without bounds", () => {
			// Invalid glyph has no bounds, so returns null
			const result = glyphToSVG(font, 99999);
			expect(result).toBeNull();
		});

		test("returns SVG string for valid glyph", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (glyphId) {
				const result = glyphToSVG(font, glyphId);
				if (result) {
					expect(result).toContain("<svg");
					expect(result).toContain("</svg>");
					expect(result).toContain("<path");
				}
			}
		});

		test("respects fontSize option", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (glyphId) {
				const result = glyphToSVG(font, glyphId, { fontSize: 50 });
				if (result) {
					expect(result).toContain("<svg");
				}
			}
		});

		test("respects fill option", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (glyphId) {
				const result = glyphToSVG(font, glyphId, { fill: "red" });
				if (result) {
					expect(result).toContain('fill="red"');
				}
			}
		});

		test("SVG includes viewBox", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (glyphId) {
				const result = glyphToSVG(font, glyphId);
				if (result) {
					expect(result).toContain("viewBox=");
				}
			}
		});
	});

	describe("glyphBufferToShapedGlyphs", () => {
		test("empty buffer returns empty array", () => {
			const buffer = new GlyphBuffer();
			const result = glyphBufferToShapedGlyphs(buffer);
			expect(result).toEqual([]);
		});

		test("converts buffer to shaped glyphs", () => {
			const buffer = new GlyphBuffer();
			// Initialize with glyph infos
			buffer.initFromInfos([
				{ glyphId: 1, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 2, cluster: 1, mask: 0, codepoint: 66 },
			]);
			// Set advances
			buffer.setAdvance(0, 500, 0);
			buffer.setAdvance(1, 600, 0);

			const result = glyphBufferToShapedGlyphs(buffer);
			expect(result.length).toBe(2);
			expect(result[0]!.glyphId).toBe(1);
			expect(result[0]!.xAdvance).toBe(500);
			expect(result[1]!.glyphId).toBe(2);
			expect(result[1]!.xAdvance).toBe(600);
		});

		test("includes offset values", () => {
			const buffer = new GlyphBuffer();
			buffer.initFromInfos([{ glyphId: 1, cluster: 0, mask: 0, codepoint: 65 }]);
			buffer.setAdvance(0, 500, 0);
			buffer.addOffset(0, 10, 20);

			const result = glyphBufferToShapedGlyphs(buffer);
			expect(result[0]!.xOffset).toBe(10);
			expect(result[0]!.yOffset).toBe(20);
		});
	});

	describe("getTextWidth", () => {
		test("empty array returns 0", () => {
			const result = getTextWidth([], font, 16);
			expect(result).toBe(0);
		});

		test("calculates width from advances", () => {
			const glyphs: ShapedGlyph[] = [
				{ glyphId: 1, xOffset: 0, yOffset: 0, xAdvance: 500, yAdvance: 0 },
				{ glyphId: 2, xOffset: 0, yOffset: 0, xAdvance: 600, yAdvance: 0 },
			];
			const result = getTextWidth(glyphs, font, font.unitsPerEm);
			// At unitsPerEm scale, width = sum of advances
			expect(result).toBe(1100);
		});

		test("scales width by fontSize", () => {
			const glyphs: ShapedGlyph[] = [
				{ glyphId: 1, xOffset: 0, yOffset: 0, xAdvance: 1000, yAdvance: 0 },
			];
			// At half unitsPerEm, should be half width
			const result = getTextWidth(glyphs, font, font.unitsPerEm / 2);
			expect(result).toBe(500);
		});
	});

	describe("shapedTextToSVG", () => {
		test("empty glyphs returns minimal SVG", () => {
			const result = shapedTextToSVG(font, []);
			expect(result).toContain("<svg");
			expect(result).toContain("</svg>");
		});

		test("generates SVG with path for shaped text", () => {
			const glyphIdA = font.glyphId("A".codePointAt(0)!);
			if (glyphIdA) {
				const glyphs: ShapedGlyph[] = [
					{
						glyphId: glyphIdA,
						xOffset: 0,
						yOffset: 0,
						xAdvance: font.advanceWidth(glyphIdA) ?? 0,
						yAdvance: 0,
					},
				];
				const result = shapedTextToSVG(font, glyphs);
				expect(result).toContain("<svg");
				expect(result).toContain("<path");
				expect(result).toContain("d=");
			}
		});

		test("respects fill option", () => {
			const glyphIdA = font.glyphId("A".codePointAt(0)!);
			if (glyphIdA) {
				const glyphs: ShapedGlyph[] = [
					{
						glyphId: glyphIdA,
						xOffset: 0,
						yOffset: 0,
						xAdvance: font.advanceWidth(glyphIdA) ?? 0,
						yAdvance: 0,
					},
				];
				const result = shapedTextToSVG(font, glyphs, { fill: "blue" });
				expect(result).toContain('fill="blue"');
			}
		});
	});

	describe("PathCommand types", () => {
		test("M command has x and y", () => {
			const cmd: PathCommand = { type: "M", x: 10, y: 20 };
			expect(cmd.type).toBe("M");
			expect(cmd.x).toBe(10);
			expect(cmd.y).toBe(20);
		});

		test("L command has x and y", () => {
			const cmd: PathCommand = { type: "L", x: 30, y: 40 };
			expect(cmd.type).toBe("L");
			expect(cmd.x).toBe(30);
			expect(cmd.y).toBe(40);
		});

		test("Q command has control and end points", () => {
			const cmd: PathCommand = { type: "Q", x1: 50, y1: 60, x: 70, y: 80 };
			expect(cmd.type).toBe("Q");
			expect(cmd.x1).toBe(50);
			expect(cmd.y1).toBe(60);
			expect(cmd.x).toBe(70);
			expect(cmd.y).toBe(80);
		});

		test("C command has two control points and end point", () => {
			const cmd: PathCommand = {
				type: "C",
				x1: 10,
				y1: 20,
				x2: 30,
				y2: 40,
				x: 50,
				y: 60,
			};
			expect(cmd.type).toBe("C");
			expect(cmd.x1).toBe(10);
			expect(cmd.y1).toBe(20);
			expect(cmd.x2).toBe(30);
			expect(cmd.y2).toBe(40);
			expect(cmd.x).toBe(50);
			expect(cmd.y).toBe(60);
		});

		test("Z command has only type", () => {
			const cmd: PathCommand = { type: "Z" };
			expect(cmd.type).toBe("Z");
		});
	});

	describe("GlyphPath interface", () => {
		test("has commands array", () => {
			const path: GlyphPath = { commands: [], bounds: null };
			expect(Array.isArray(path.commands)).toBe(true);
		});

		test("bounds can be null", () => {
			const path: GlyphPath = { commands: [], bounds: null };
			expect(path.bounds).toBeNull();
		});

		test("bounds can have min/max values", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 200 },
			};
			expect(path.bounds!.xMin).toBe(0);
			expect(path.bounds!.yMin).toBe(0);
			expect(path.bounds!.xMax).toBe(100);
			expect(path.bounds!.yMax).toBe(200);
		});
	});

	describe("ShapedGlyph interface", () => {
		test("has all required fields", () => {
			const glyph: ShapedGlyph = {
				glyphId: 42,
				xOffset: 5,
				yOffset: 10,
				xAdvance: 500,
				yAdvance: 0,
			};
			expect(glyph.glyphId).toBe(42);
			expect(glyph.xOffset).toBe(5);
			expect(glyph.yOffset).toBe(10);
			expect(glyph.xAdvance).toBe(500);
			expect(glyph.yAdvance).toBe(0);
		});
	});

	describe("integration with Font", () => {
		test("can get and render multiple glyphs", () => {
			const text = "ABC";
			const glyphs: ShapedGlyph[] = [];

			for (const char of text) {
				const cp = char.codePointAt(0);
				if (!cp) continue;
				const glyphId = font.glyphId(cp);
				if (!glyphId) continue;

				glyphs.push({
					glyphId,
					xOffset: 0,
					yOffset: 0,
					xAdvance: font.advanceWidth(glyphId) ?? 0,
					yAdvance: 0,
				});
			}

			expect(glyphs.length).toBe(3);
			const width = getTextWidth(glyphs, font, 16);
			expect(width).toBeGreaterThan(0);
		});

		test("different glyphs have different paths", () => {
			const glyphIdA = font.glyphId("A".codePointAt(0)!);
			const glyphIdO = font.glyphId("O".codePointAt(0)!);

			if (glyphIdA && glyphIdO) {
				const pathA = getGlyphPath(font, glyphIdA);
				const pathO = getGlyphPath(font, glyphIdO);

				if (pathA && pathO) {
					// Different glyphs should produce different paths
					const svgA = pathToSVG(pathA);
					const svgO = pathToSVG(pathO);
					expect(svgA).not.toBe(svgO);
				}
			}
		});

		test("numeric glyphs produce valid paths", () => {
			for (let digit = 0; digit <= 9; digit++) {
				const glyphId = font.glyphId(String(digit).codePointAt(0)!);
				if (glyphId) {
					const path = getGlyphPath(font, glyphId);
					expect(path).not.toBeNull();
					if (path) {
						expect(path.commands.length).toBeGreaterThan(0);
					}
				}
			}
		});
	});

	describe("pathToCanvas", () => {
		test("renders path commands to canvas context", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 0 },
					{ type: "L", x: 100, y: 100 },
					{ type: "Z" },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
			};

			const mockCtx = {
				moveTo: (x: number, y: number) => {},
				lineTo: (x: number, y: number) => {},
				quadraticCurveTo: (x1: number, y1: number, x: number, y: number) => {},
				bezierCurveTo: (
					x1: number,
					y1: number,
					x2: number,
					y2: number,
					x: number,
					y: number,
				) => {},
				closePath: () => {},
			};

			let moveCount = 0;
			let lineCount = 0;
			let closeCount = 0;

			mockCtx.moveTo = () => moveCount++;
			mockCtx.lineTo = () => lineCount++;
			mockCtx.closePath = () => closeCount++;

			const { pathToCanvas } = require("../../src/render/path.ts");
			pathToCanvas(mockCtx, path, { flipY: false });

			expect(moveCount).toBe(1);
			expect(lineCount).toBe(2);
			expect(closeCount).toBe(1);
		});

		test("applies scale option", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};

			let capturedX = 0;
			let capturedY = 0;

			const mockCtx = {
				moveTo: (x: number, y: number) => {
					capturedX = x;
					capturedY = y;
				},
				lineTo: () => {},
				quadraticCurveTo: () => {},
				bezierCurveTo: () => {},
				closePath: () => {},
			};

			const { pathToCanvas } = require("../../src/render/path.ts");
			pathToCanvas(mockCtx, path, { scale: 2, flipY: false });

			expect(capturedX).toBe(20);
			expect(capturedY).toBe(40);
		});

		test("applies offset options", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};

			let capturedX = 0;
			let capturedY = 0;

			const mockCtx = {
				moveTo: (x: number, y: number) => {
					capturedX = x;
					capturedY = y;
				},
				lineTo: () => {},
				quadraticCurveTo: () => {},
				bezierCurveTo: () => {},
				closePath: () => {},
			};

			const { pathToCanvas } = require("../../src/render/path.ts");
			pathToCanvas(mockCtx, path, {
				offsetX: 5,
				offsetY: 10,
				flipY: false,
			});

			expect(capturedX).toBe(15);
			expect(capturedY).toBe(30);
		});

		test("handles quadratic curves", () => {
			const path: GlyphPath = {
				commands: [{ type: "Q", x1: 50, y1: 100, x: 100, y: 0 }],
				bounds: null,
			};

			let quadCount = 0;
			const mockCtx = {
				moveTo: () => {},
				lineTo: () => {},
				quadraticCurveTo: () => {
					quadCount++;
				},
				bezierCurveTo: () => {},
				closePath: () => {},
			};

			const { pathToCanvas } = require("../../src/render/path.ts");
			pathToCanvas(mockCtx, path);

			expect(quadCount).toBe(1);
		});

		test("handles cubic curves", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "C", x1: 25, y1: 50, x2: 75, y2: 50, x: 100, y: 0 },
				],
				bounds: null,
			};

			let cubicCount = 0;
			const mockCtx = {
				moveTo: () => {},
				lineTo: () => {},
				quadraticCurveTo: () => {},
				bezierCurveTo: () => {
					cubicCount++;
				},
				closePath: () => {},
			};

			const { pathToCanvas } = require("../../src/render/path.ts");
			pathToCanvas(mockCtx, path);

			expect(cubicCount).toBe(1);
		});
	});

	describe("renderShapedText", () => {
		test("renders glyphs to canvas", () => {
			const glyphIdA = font.glyphId("A".codePointAt(0)!);
			if (!glyphIdA) return;

			const glyphs: ShapedGlyph[] = [
				{
					glyphId: glyphIdA,
					xOffset: 0,
					yOffset: 0,
					xAdvance: 600,
					yAdvance: 0,
				},
			];

			let fillCount = 0;
			const mockCtx = {
				fillStyle: "",
				beginPath: () => {},
				moveTo: () => {},
				lineTo: () => {},
				quadraticCurveTo: () => {},
				bezierCurveTo: () => {},
				closePath: () => {},
				fill: () => {
					fillCount++;
				},
			};

			const { renderShapedText } = require("../../src/render/path.ts");
			renderShapedText(mockCtx, font, glyphs, { fontSize: 16 });

			expect(fillCount).toBeGreaterThan(0);
		});

		test("respects fill color option", () => {
			const glyphIdA = font.glyphId("A".codePointAt(0)!);
			if (!glyphIdA) return;

			const glyphs: ShapedGlyph[] = [
				{
					glyphId: glyphIdA,
					xOffset: 0,
					yOffset: 0,
					xAdvance: 600,
					yAdvance: 0,
				},
			];

			const mockCtx = {
				fillStyle: "",
				beginPath: () => {},
				moveTo: () => {},
				lineTo: () => {},
				quadraticCurveTo: () => {},
				bezierCurveTo: () => {},
				closePath: () => {},
				fill: () => {},
			};

			const { renderShapedText } = require("../../src/render/path.ts");
			renderShapedText(mockCtx, font, glyphs, { fill: "red" });

			expect(mockCtx.fillStyle).toBe("red");
		});
	});

	describe("createPath2D", () => {
		test("creates Path2D from glyph path", () => {
			// Skip in Bun test environment where Path2D may not be available
			if (typeof Path2D === "undefined") {
				return;
			}

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 0 },
					{ type: "Z" },
				],
				bounds: null,
			};

			const { createPath2D } = require("../../src/render/path.ts");
			const path2d = createPath2D(path, { flipY: false });

			expect(path2d).toBeInstanceOf(Path2D);
		});

		test("Path2D respects options", () => {
			// Skip in Bun test environment where Path2D may not be available
			if (typeof Path2D === "undefined") {
				return;
			}

			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};

			const { createPath2D } = require("../../src/render/path.ts");
			const path2d = createPath2D(path, { scale: 2, offsetX: 5 });

			expect(path2d).toBeInstanceOf(Path2D);
		});
	});

	describe("getGlyphPathWithVariation", () => {
		test("returns path with variation applied", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const { getGlyphPathWithVariation } = require("../../src/render/path.ts");
			const path = getGlyphPathWithVariation(font, glyphId, []);

			expect(path).toBeDefined();
			if (path) {
				expect(path.commands).toBeDefined();
				expect(path.bounds).toBeDefined();
			}
		});

		test("returns path for invalid glyph (may be empty)", () => {
			const { getGlyphPathWithVariation } = require("../../src/render/path.ts");
			const path = getGlyphPathWithVariation(font, 99999, []);

			// Invalid glyphs may return empty path rather than null
			expect(path).toBeDefined();
			if (path) {
				expect(path.commands).toBeDefined();
			}
		});
	});

	describe("renderShapedTextWithVariation", () => {
		test("renders glyphs with variation", () => {
			const glyphIdA = font.glyphId("A".codePointAt(0)!);
			if (!glyphIdA) return;

			const glyphs: ShapedGlyph[] = [
				{
					glyphId: glyphIdA,
					xOffset: 0,
					yOffset: 0,
					xAdvance: 600,
					yAdvance: 0,
				},
			];

			let fillCount = 0;
			const mockCtx = {
				fillStyle: "",
				beginPath: () => {},
				moveTo: () => {},
				lineTo: () => {},
				quadraticCurveTo: () => {},
				bezierCurveTo: () => {},
				closePath: () => {},
				fill: () => {
					fillCount++;
				},
			};

			const { renderShapedTextWithVariation } =
				require("../../src/render/path.ts");
			renderShapedTextWithVariation(mockCtx, font, glyphs, [], {
				fontSize: 16,
			});

			expect(fillCount).toBeGreaterThan(0);
		});
	});

	describe("shapedTextToSVGWithVariation", () => {
		test("generates SVG with variation", () => {
			const glyphIdA = font.glyphId("A".codePointAt(0)!);
			if (!glyphIdA) return;

			const glyphs: ShapedGlyph[] = [
				{
					glyphId: glyphIdA,
					xOffset: 0,
					yOffset: 0,
					xAdvance: 600,
					yAdvance: 0,
				},
			];

			const { shapedTextToSVGWithVariation } =
				require("../../src/render/path.ts");
			const svg = shapedTextToSVGWithVariation(font, glyphs, []);

			expect(svg).toContain("<svg");
			expect(svg).toContain("</svg>");
		});

		test("empty glyphs returns minimal SVG", () => {
			const { shapedTextToSVGWithVariation } =
				require("../../src/render/path.ts");
			const svg = shapedTextToSVGWithVariation(font, [], []);

			expect(svg).toContain("<svg");
			expect(svg).toContain("</svg>");
		});
	});
});
