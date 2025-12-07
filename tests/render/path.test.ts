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

	describe("pathToCanvasWithMatrix", () => {
		const {
			pathToCanvasWithMatrix,
		} = require("../../src/render/path.ts");
		const {
			identity2D,
			rotate2D,
			scale2D,
			translate2D,
			shear2D,
			multiply2D,
		} = require("../../src/render/outline-transform.ts");

		function createMockCtx() {
			const calls: Array<{ method: string; args: number[] }> = [];
			return {
				calls,
				moveTo: (x: number, y: number) => calls.push({ method: "moveTo", args: [x, y] }),
				lineTo: (x: number, y: number) => calls.push({ method: "lineTo", args: [x, y] }),
				quadraticCurveTo: (x1: number, y1: number, x: number, y: number) =>
					calls.push({ method: "quadraticCurveTo", args: [x1, y1, x, y] }),
				bezierCurveTo: (x1: number, y1: number, x2: number, y2: number, x: number, y: number) =>
					calls.push({ method: "bezierCurveTo", args: [x1, y1, x2, y2, x, y] }),
				closePath: () => calls.push({ method: "closePath", args: [] }),
			};
		}

		test("identity matrix produces same coordinates", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 10, y: 20 },
					{ type: "L", x: 100, y: 50 },
				],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, identity2D(), { flipY: false });

			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [10, 20] });
			expect(ctx.calls[1]).toEqual({ method: "lineTo", args: [100, 50] });
		});

		test("scale matrix multiplies coordinates", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, scale2D(2, 3), { flipY: false });

			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [20, 60] });
		});

		test("translation matrix adds offset", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, translate2D(5, 10), { flipY: false });

			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [15, 30] });
		});

		test("rotation matrix rotates coordinates", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 100, y: 0 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, rotate2D(Math.PI / 2), { flipY: false });

			// 90° rotation: (100, 0) -> (0, 100)
			expect(ctx.calls[0]!.args[0]).toBeCloseTo(0, 5);
			expect(ctx.calls[0]!.args[1]).toBeCloseTo(100, 5);
		});

		test("shear matrix skews coordinates", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 100 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, shear2D(0.5, 0), { flipY: false });

			// Shear X: x' = x + 0.5*y = 0 + 50 = 50
			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [50, 100] });
		});

		test("combined matrix transformation", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 0 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			// Scale by 2, then translate by (5, 10)
			const matrix = multiply2D(translate2D(5, 10), scale2D(2, 2));
			pathToCanvasWithMatrix(ctx, path, matrix, { flipY: false });

			// (10, 0) * 2 = (20, 0), then + (5, 10) = (25, 10)
			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [25, 10] });
		});

		test("flipY inverts y coordinates before transform", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, identity2D(), { flipY: true });

			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [10, -20] });
		});

		test("handles quadratic curves", () => {
			const path: GlyphPath = {
				commands: [{ type: "Q", x1: 50, y1: 100, x: 100, y: 0 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, scale2D(2, 2), { flipY: false });

			expect(ctx.calls[0]).toEqual({
				method: "quadraticCurveTo",
				args: [100, 200, 200, 0],
			});
		});

		test("handles cubic curves", () => {
			const path: GlyphPath = {
				commands: [{ type: "C", x1: 25, y1: 50, x2: 75, y2: 50, x: 100, y: 0 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, scale2D(2, 2), { flipY: false });

			expect(ctx.calls[0]).toEqual({
				method: "bezierCurveTo",
				args: [50, 100, 150, 100, 200, 0],
			});
		});

		test("handles Z (closePath) command", () => {
			const path: GlyphPath = {
				commands: [{ type: "Z" }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, identity2D());

			expect(ctx.calls[0]).toEqual({ method: "closePath", args: [] });
		});

		test("empty path produces no calls", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, identity2D());

			expect(ctx.calls.length).toBe(0);
		});

		test("negative scale flips coordinates", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, scale2D(-1, -1), { flipY: false });

			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [-10, -20] });
		});

		test("zero scale collapses to origin", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 100, y: 200 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, scale2D(0, 0), { flipY: false });

			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [0, 0] });
		});

		test("very large scale values", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 1, y: 1 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, scale2D(1e6, 1e6), { flipY: false });

			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [1e6, 1e6] });
		});

		test("very small scale values", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 1000000, y: 1000000 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, scale2D(1e-6, 1e-6), { flipY: false });

			expect(ctx.calls[0]!.args[0]).toBeCloseTo(1, 5);
			expect(ctx.calls[0]!.args[1]).toBeCloseTo(1, 5);
		});
	});

	describe("pathToSVGWithMatrix", () => {
		const {
			pathToSVGWithMatrix,
		} = require("../../src/render/path.ts");
		const {
			identity2D,
			rotate2D,
			scale2D,
			translate2D,
			shear2D,
			multiply2D,
		} = require("../../src/render/outline-transform.ts");

		test("identity matrix produces same coordinates", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 10, y: 20 },
					{ type: "L", x: 100, y: 50 },
				],
				bounds: null,
			};
			const result = pathToSVGWithMatrix(path, identity2D(), { flipY: false });
			expect(result).toBe("M 10 20 L 100 50");
		});

		test("scale matrix multiplies coordinates", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const result = pathToSVGWithMatrix(path, scale2D(2, 3), { flipY: false });
			expect(result).toBe("M 20 60");
		});

		test("translation matrix adds offset", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const result = pathToSVGWithMatrix(path, translate2D(5, 10), { flipY: false });
			expect(result).toBe("M 15 30");
		});

		test("rotation matrix rotates coordinates", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 100, y: 0 }],
				bounds: null,
			};
			const result = pathToSVGWithMatrix(path, rotate2D(Math.PI / 2), { flipY: false });
			// 90° rotation: (100, 0) -> approximately (0, 100)
			const parts = result.split(" ");
			expect(parseFloat(parts[1]!)).toBeCloseTo(0, 5);
			expect(parseFloat(parts[2]!)).toBeCloseTo(100, 5);
		});

		test("shear matrix skews coordinates", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 100 }],
				bounds: null,
			};
			const result = pathToSVGWithMatrix(path, shear2D(0.5, 0), { flipY: false });
			expect(result).toBe("M 50 100");
		});

		test("flipY inverts y coordinates", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const result = pathToSVGWithMatrix(path, identity2D(), { flipY: true });
			expect(result).toBe("M 10 -20");
		});

		test("handles quadratic curves", () => {
			const path: GlyphPath = {
				commands: [{ type: "Q", x1: 50, y1: 100, x: 100, y: 0 }],
				bounds: null,
			};
			const result = pathToSVGWithMatrix(path, scale2D(2, 2), { flipY: false });
			expect(result).toBe("Q 100 200 200 0");
		});

		test("handles cubic curves", () => {
			const path: GlyphPath = {
				commands: [{ type: "C", x1: 25, y1: 50, x2: 75, y2: 50, x: 100, y: 0 }],
				bounds: null,
			};
			const result = pathToSVGWithMatrix(path, scale2D(2, 2), { flipY: false });
			expect(result).toBe("C 50 100 150 100 200 0");
		});

		test("handles Z command", () => {
			const path: GlyphPath = {
				commands: [{ type: "Z" }],
				bounds: null,
			};
			const result = pathToSVGWithMatrix(path, identity2D());
			expect(result).toBe("Z");
		});

		test("empty path produces empty string", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
			};
			const result = pathToSVGWithMatrix(path, identity2D());
			expect(result).toBe("");
		});

		test("complete path with multiple command types", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 0 },
					{ type: "Q", x1: 150, y1: 50, x: 100, y: 100 },
					{ type: "C", x1: 50, y1: 150, x2: 0, y2: 150, x: 0, y: 100 },
					{ type: "Z" },
				],
				bounds: null,
			};
			const result = pathToSVGWithMatrix(path, identity2D(), { flipY: false });
			expect(result).toBe("M 0 0 L 100 0 Q 150 50 100 100 C 50 150 0 150 0 100 Z");
		});
	});

	describe("pathToCanvasWithMatrix3D", () => {
		const {
			pathToCanvasWithMatrix3D,
		} = require("../../src/render/path.ts");
		const {
			identity3x3,
		} = require("../../src/render/outline-transform.ts");

		function createMockCtx() {
			const calls: Array<{ method: string; args: number[] }> = [];
			return {
				calls,
				moveTo: (x: number, y: number) => calls.push({ method: "moveTo", args: [x, y] }),
				lineTo: (x: number, y: number) => calls.push({ method: "lineTo", args: [x, y] }),
				quadraticCurveTo: (x1: number, y1: number, x: number, y: number) =>
					calls.push({ method: "quadraticCurveTo", args: [x1, y1, x, y] }),
				bezierCurveTo: (x1: number, y1: number, x2: number, y2: number, x: number, y: number) =>
					calls.push({ method: "bezierCurveTo", args: [x1, y1, x2, y2, x, y] }),
				closePath: () => calls.push({ method: "closePath", args: [] }),
			};
		}

		test("identity 3x3 matrix produces same coordinates", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 10, y: 20 },
					{ type: "L", x: 100, y: 50 },
				],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix3D(ctx, path, identity3x3(), { flipY: false });

			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [10, 20] });
			expect(ctx.calls[1]).toEqual({ method: "lineTo", args: [100, 50] });
		});

		test("scale using 3x3 matrix", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			const scaleMatrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[2, 0, 0],
				[0, 3, 0],
				[0, 0, 1],
			];
			pathToCanvasWithMatrix3D(ctx, path, scaleMatrix, { flipY: false });

			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [20, 60] });
		});

		test("translation using 3x3 matrix", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			const translateMatrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 5],
				[0, 1, 10],
				[0, 0, 1],
			];
			pathToCanvasWithMatrix3D(ctx, path, translateMatrix, { flipY: false });

			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [15, 30] });
		});

		test("perspective transformation", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 100, y: 0 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			// Perspective matrix: w = 0.001 * x + 1
			const perspectiveMatrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[0.001, 0, 1],
			];
			pathToCanvasWithMatrix3D(ctx, path, perspectiveMatrix, { flipY: false });

			// x' = 100 / (0.001 * 100 + 1) = 100 / 1.1 ≈ 90.909
			expect(ctx.calls[0]!.args[0]).toBeCloseTo(90.909, 2);
			expect(ctx.calls[0]!.args[1]).toBeCloseTo(0, 5);
		});

		test("flipY inverts y coordinates before transform", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix3D(ctx, path, identity3x3(), { flipY: true });

			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [10, -20] });
		});

		test("handles quadratic curves", () => {
			const path: GlyphPath = {
				commands: [{ type: "Q", x1: 50, y1: 100, x: 100, y: 0 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			const scaleMatrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[2, 0, 0],
				[0, 2, 0],
				[0, 0, 1],
			];
			pathToCanvasWithMatrix3D(ctx, path, scaleMatrix, { flipY: false });

			expect(ctx.calls[0]).toEqual({
				method: "quadraticCurveTo",
				args: [100, 200, 200, 0],
			});
		});

		test("handles cubic curves", () => {
			const path: GlyphPath = {
				commands: [{ type: "C", x1: 25, y1: 50, x2: 75, y2: 50, x: 100, y: 0 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			const scaleMatrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[2, 0, 0],
				[0, 2, 0],
				[0, 0, 1],
			];
			pathToCanvasWithMatrix3D(ctx, path, scaleMatrix, { flipY: false });

			expect(ctx.calls[0]).toEqual({
				method: "bezierCurveTo",
				args: [50, 100, 150, 100, 200, 0],
			});
		});

		test("handles Z command", () => {
			const path: GlyphPath = {
				commands: [{ type: "Z" }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix3D(ctx, path, identity3x3());

			expect(ctx.calls[0]).toEqual({ method: "closePath", args: [] });
		});

		test("empty path produces no calls", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix3D(ctx, path, identity3x3());

			expect(ctx.calls.length).toBe(0);
		});

		test("point at infinity handled gracefully", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 100, y: 0 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			// Matrix that would cause division by near-zero
			const badMatrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[-0.01, 0, 1], // w = -0.01 * 100 + 1 = 0 (nearly)
			];
			pathToCanvasWithMatrix3D(ctx, path, badMatrix, { flipY: false });

			// Should not throw, returns clamped coordinates
			expect(ctx.calls.length).toBe(1);
		});
	});

	describe("3D perspective edge cases", () => {
		const {
			pathToCanvasWithMatrix3D,
			pathToSVGWithMatrix3D,
		} = require("../../src/render/path.ts");
		const {
			transformPoint3x3,
		} = require("../../src/render/outline-transform.ts");

		function createMockCtx() {
			const calls: Array<{ method: string; args: number[] }> = [];
			return {
				calls,
				moveTo: (x: number, y: number) => calls.push({ method: "moveTo", args: [x, y] }),
				lineTo: (x: number, y: number) => calls.push({ method: "lineTo", args: [x, y] }),
				quadraticCurveTo: (x1: number, y1: number, x: number, y: number) =>
					calls.push({ method: "quadraticCurveTo", args: [x1, y1, x, y] }),
				bezierCurveTo: (x1: number, y1: number, x2: number, y2: number, x: number, y: number) =>
					calls.push({ method: "bezierCurveTo", args: [x1, y1, x2, y2, x, y] }),
				closePath: () => calls.push({ method: "closePath", args: [] }),
			};
		}

		test("negative perspective X does not cause coordinate explosion", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 0 },
					{ type: "L", x: 100, y: 100 },
					{ type: "Z" },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
			};
			const ctx = createMockCtx();
			// Negative perspective that would cause w < 0 for x > 0
			const matrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[-0.02, 0, 1], // w = -0.02 * x + 1, so w < 0 when x > 50
			];
			pathToCanvasWithMatrix3D(ctx, path, matrix, { flipY: false });

			// All coordinates should be finite and reasonable (not exploded)
			for (const call of ctx.calls) {
				for (const arg of call.args) {
					expect(Number.isFinite(arg)).toBe(true);
					expect(Math.abs(arg)).toBeLessThan(100000); // Not exploded
				}
			}
		});

		test("negative perspective Y does not cause coordinate explosion", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 0, y: 100 },
					{ type: "L", x: 100, y: 100 },
					{ type: "Z" },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
			};
			const ctx = createMockCtx();
			// Negative perspective on Y axis
			const matrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[0, -0.02, 1], // w = -0.02 * y + 1, so w < 0 when y > 50
			];
			pathToCanvasWithMatrix3D(ctx, path, matrix, { flipY: false });

			for (const call of ctx.calls) {
				for (const arg of call.args) {
					expect(Number.isFinite(arg)).toBe(true);
					expect(Math.abs(arg)).toBeLessThan(100000);
				}
			}
		});

		test("w approaching zero clamps coordinates", () => {
			// When w is very small but positive, coordinates should be clamped
			const matrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[-0.0099, 0, 1], // w = -0.0099 * 100 + 1 = 0.01 (at threshold)
			];
			const result = transformPoint3x3(100, 0, matrix);

			expect(Number.isFinite(result.x)).toBe(true);
			expect(Number.isFinite(result.y)).toBe(true);
			// Should be clamped, not exploded to huge values
			expect(Math.abs(result.x)).toBeLessThan(100000);
		});

		test("w exactly zero is handled", () => {
			const matrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[-0.01, 0, 1], // w = -0.01 * 100 + 1 = 0
			];
			const result = transformPoint3x3(100, 0, matrix);

			expect(Number.isFinite(result.x)).toBe(true);
			expect(Number.isFinite(result.y)).toBe(true);
		});

		test("w negative is clamped to positive", () => {
			const matrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[-0.02, 0, 1], // w = -0.02 * 100 + 1 = -1 (negative!)
			];
			const result = transformPoint3x3(100, 0, matrix);

			expect(Number.isFinite(result.x)).toBe(true);
			expect(Number.isFinite(result.y)).toBe(true);
			// Coordinates should not be inverted (which would happen with negative w)
			// x' = 100 / clamped_w should be positive
			expect(result.x).toBeGreaterThan(0);
		});

		test("extreme negative perspective still produces finite coordinates", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 500, y: 500 },
					{ type: "L", x: 1000, y: 0 },
					{ type: "Q", x1: 750, y1: 250, x: 500, y: 0 },
					{ type: "C", x1: 250, y1: 250, x2: 250, y2: 750, x: 500, y: 1000 },
					{ type: "Z" },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 1000, yMax: 1000 },
			};
			const ctx = createMockCtx();
			// Very extreme negative perspective
			const matrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[-0.1, -0.1, 1], // w goes very negative for large x,y
			];
			pathToCanvasWithMatrix3D(ctx, path, matrix, { flipY: false });

			// Should not crash and all values should be finite
			expect(ctx.calls.length).toBe(5); // M, L, Q, C, Z
			for (const call of ctx.calls) {
				for (const arg of call.args) {
					expect(Number.isFinite(arg)).toBe(true);
				}
			}
		});

		test("SVG output with negative perspective is valid", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 100, y: 100 },
					{ type: "L", x: 200, y: 100 },
					{ type: "Z" },
				],
				bounds: null,
			};
			const matrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[-0.02, 0, 1],
			];
			const result = pathToSVGWithMatrix3D(path, matrix, { flipY: false });

			// Should produce valid SVG path string
			expect(result).toContain("M ");
			expect(result).toContain("L ");
			expect(result).toContain("Z");
			// Should not contain NaN or Infinity
			expect(result).not.toContain("NaN");
			expect(result).not.toContain("Infinity");
		});

		test("combined negative X and Y perspective", () => {
			const matrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[-0.005, -0.005, 1], // Both X and Y contribute to w
			];
			// Point where w = -0.005*100 - 0.005*100 + 1 = 0 (at threshold)
			const result = transformPoint3x3(100, 100, matrix);

			expect(Number.isFinite(result.x)).toBe(true);
			expect(Number.isFinite(result.y)).toBe(true);
		});

		test("positive perspective works normally", () => {
			const matrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[0.001, 0, 1], // Positive perspective, w = 0.001 * x + 1 > 1 always
			];
			const result = transformPoint3x3(100, 0, matrix);

			// w = 0.001 * 100 + 1 = 1.1
			// x' = 100 / 1.1 ≈ 90.909
			expect(result.x).toBeCloseTo(90.909, 2);
			expect(result.y).toBeCloseTo(0, 5);
		});
	});

	describe("pathToSVGWithMatrix3D", () => {
		const {
			pathToSVGWithMatrix3D,
		} = require("../../src/render/path.ts");
		const {
			identity3x3,
		} = require("../../src/render/outline-transform.ts");

		test("identity 3x3 matrix produces same coordinates", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 10, y: 20 },
					{ type: "L", x: 100, y: 50 },
				],
				bounds: null,
			};
			const result = pathToSVGWithMatrix3D(path, identity3x3(), { flipY: false });
			expect(result).toBe("M 10 20 L 100 50");
		});

		test("scale using 3x3 matrix", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const scaleMatrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[2, 0, 0],
				[0, 3, 0],
				[0, 0, 1],
			];
			const result = pathToSVGWithMatrix3D(path, scaleMatrix, { flipY: false });
			expect(result).toBe("M 20 60");
		});

		test("translation using 3x3 matrix", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const translateMatrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 5],
				[0, 1, 10],
				[0, 0, 1],
			];
			const result = pathToSVGWithMatrix3D(path, translateMatrix, { flipY: false });
			expect(result).toBe("M 15 30");
		});

		test("perspective transformation", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 100, y: 0 }],
				bounds: null,
			};
			const perspectiveMatrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[0.001, 0, 1],
			];
			const result = pathToSVGWithMatrix3D(path, perspectiveMatrix, { flipY: false });
			const parts = result.split(" ");
			expect(parseFloat(parts[1]!)).toBeCloseTo(90.909, 2);
			expect(parseFloat(parts[2]!)).toBeCloseTo(0, 5);
		});

		test("flipY inverts y coordinates", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const result = pathToSVGWithMatrix3D(path, identity3x3(), { flipY: true });
			expect(result).toBe("M 10 -20");
		});

		test("handles quadratic curves", () => {
			const path: GlyphPath = {
				commands: [{ type: "Q", x1: 50, y1: 100, x: 100, y: 0 }],
				bounds: null,
			};
			const scaleMatrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[2, 0, 0],
				[0, 2, 0],
				[0, 0, 1],
			];
			const result = pathToSVGWithMatrix3D(path, scaleMatrix, { flipY: false });
			expect(result).toBe("Q 100 200 200 0");
		});

		test("handles cubic curves", () => {
			const path: GlyphPath = {
				commands: [{ type: "C", x1: 25, y1: 50, x2: 75, y2: 50, x: 100, y: 0 }],
				bounds: null,
			};
			const scaleMatrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[2, 0, 0],
				[0, 2, 0],
				[0, 0, 1],
			];
			const result = pathToSVGWithMatrix3D(path, scaleMatrix, { flipY: false });
			expect(result).toBe("C 50 100 150 100 200 0");
		});

		test("handles Z command", () => {
			const path: GlyphPath = {
				commands: [{ type: "Z" }],
				bounds: null,
			};
			const result = pathToSVGWithMatrix3D(path, identity3x3());
			expect(result).toBe("Z");
		});

		test("empty path produces empty string", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
			};
			const result = pathToSVGWithMatrix3D(path, identity3x3());
			expect(result).toBe("");
		});
	});

	describe("applyMatrixToContext", () => {
		const {
			applyMatrixToContext,
		} = require("../../src/render/path.ts");
		const {
			identity2D,
			rotate2D,
			scale2D,
			translate2D,
			multiply2D,
		} = require("../../src/render/outline-transform.ts");

		test("applies identity matrix", () => {
			let capturedArgs: number[] = [];
			const mockCtx = {
				transform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
					capturedArgs = [a, b, c, d, e, f];
				},
			};

			applyMatrixToContext(mockCtx, identity2D());
			expect(capturedArgs).toEqual([1, 0, 0, 1, 0, 0]);
		});

		test("applies scale matrix", () => {
			let capturedArgs: number[] = [];
			const mockCtx = {
				transform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
					capturedArgs = [a, b, c, d, e, f];
				},
			};

			applyMatrixToContext(mockCtx, scale2D(2, 3));
			expect(capturedArgs).toEqual([2, 0, 0, 3, 0, 0]);
		});

		test("applies translation matrix", () => {
			let capturedArgs: number[] = [];
			const mockCtx = {
				transform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
					capturedArgs = [a, b, c, d, e, f];
				},
			};

			applyMatrixToContext(mockCtx, translate2D(10, 20));
			expect(capturedArgs).toEqual([1, 0, 0, 1, 10, 20]);
		});

		test("applies rotation matrix", () => {
			let capturedArgs: number[] = [];
			const mockCtx = {
				transform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
					capturedArgs = [a, b, c, d, e, f];
				},
			};

			applyMatrixToContext(mockCtx, rotate2D(Math.PI / 2));
			expect(capturedArgs[0]).toBeCloseTo(0, 5); // cos(90°)
			expect(capturedArgs[1]).toBeCloseTo(1, 5); // sin(90°)
			expect(capturedArgs[2]).toBeCloseTo(-1, 5); // -sin(90°)
			expect(capturedArgs[3]).toBeCloseTo(0, 5); // cos(90°)
		});

		test("applies combined matrix", () => {
			let capturedArgs: number[] = [];
			const mockCtx = {
				transform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
					capturedArgs = [a, b, c, d, e, f];
				},
			};

			const combined = multiply2D(translate2D(10, 20), scale2D(2, 3));
			applyMatrixToContext(mockCtx, combined);
			expect(capturedArgs).toEqual([2, 0, 0, 3, 10, 20]);
		});
	});

	describe("matrixToSVGTransform", () => {
		const {
			matrixToSVGTransform,
		} = require("../../src/render/path.ts");
		const {
			identity2D,
			rotate2D,
			scale2D,
			translate2D,
			shear2D,
		} = require("../../src/render/outline-transform.ts");

		test("identity matrix produces correct SVG transform", () => {
			const result = matrixToSVGTransform(identity2D());
			expect(result).toBe("matrix(1 0 0 1 0 0)");
		});

		test("scale matrix produces correct SVG transform", () => {
			const result = matrixToSVGTransform(scale2D(2, 3));
			expect(result).toBe("matrix(2 0 0 3 0 0)");
		});

		test("translation matrix produces correct SVG transform", () => {
			const result = matrixToSVGTransform(translate2D(10, 20));
			expect(result).toBe("matrix(1 0 0 1 10 20)");
		});

		test("rotation matrix produces correct SVG transform", () => {
			const matrix = rotate2D(Math.PI / 4); // 45°
			const result = matrixToSVGTransform(matrix);
			// matrix(cos sin -sin cos 0 0)
			const match = result.match(/matrix\(([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)\)/);
			expect(match).not.toBeNull();
			if (match) {
				expect(parseFloat(match[1]!)).toBeCloseTo(Math.cos(Math.PI / 4), 5);
				expect(parseFloat(match[2]!)).toBeCloseTo(Math.sin(Math.PI / 4), 5);
				expect(parseFloat(match[3]!)).toBeCloseTo(-Math.sin(Math.PI / 4), 5);
				expect(parseFloat(match[4]!)).toBeCloseTo(Math.cos(Math.PI / 4), 5);
			}
		});

		test("shear matrix produces correct SVG transform", () => {
			const result = matrixToSVGTransform(shear2D(0.5, 0.25));
			expect(result).toBe("matrix(1 0.25 0.5 1 0 0)");
		});

		test("negative values handled correctly", () => {
			const result = matrixToSVGTransform(scale2D(-1, -2));
			expect(result).toBe("matrix(-1 0 0 -2 0 0)");
		});

		test("floating point values handled correctly", () => {
			const result = matrixToSVGTransform(scale2D(1.5, 2.75));
			expect(result).toBe("matrix(1.5 0 0 2.75 0 0)");
		});
	});

	describe("renderShapedText with matrix options", () => {
		const {
			renderShapedText,
		} = require("../../src/render/path.ts");
		const {
			scale2D,
			rotate2D,
		} = require("../../src/render/outline-transform.ts");

		test("renders with 2D matrix transform", () => {
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
				strokeStyle: "",
				lineWidth: 1,
				lineCap: "butt" as CanvasLineCap,
				lineJoin: "miter" as CanvasLineJoin,
				beginPath: () => {},
				moveTo: () => {},
				lineTo: () => {},
				quadraticCurveTo: () => {},
				bezierCurveTo: () => {},
				closePath: () => {},
				fill: () => { fillCount++; },
				stroke: () => {},
			};

			renderShapedText(mockCtx, font, glyphs, {
				fontSize: 16,
				matrix: scale2D(2, 2),
			});

			expect(fillCount).toBeGreaterThan(0);
		});

		test("renders with 3D matrix transform", () => {
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
				strokeStyle: "",
				lineWidth: 1,
				lineCap: "butt" as CanvasLineCap,
				lineJoin: "miter" as CanvasLineJoin,
				beginPath: () => {},
				moveTo: () => {},
				lineTo: () => {},
				quadraticCurveTo: () => {},
				bezierCurveTo: () => {},
				closePath: () => {},
				fill: () => { fillCount++; },
				stroke: () => {},
			};

			const matrix3D: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[0.0001, 0, 1],
			];

			renderShapedText(mockCtx, font, glyphs, {
				fontSize: 16,
				matrix3D,
			});

			expect(fillCount).toBeGreaterThan(0);
		});
	});

	describe("shapedTextToSVG with matrix options", () => {
		test("generates SVG with 2D matrix transform applied to path", () => {
			const glyphIdA = font.glyphId("A".codePointAt(0)!);
			if (!glyphIdA) return;

			const glyphs: ShapedGlyph[] = [
				{
					glyphId: glyphIdA,
					xOffset: 0,
					yOffset: 0,
					xAdvance: font.advanceWidth(glyphIdA) ?? 0,
					yAdvance: 0,
				},
			];

			const { scale2D } = require("../../src/render/outline-transform.ts");
			const result = shapedTextToSVG(font, glyphs, {
				matrix: scale2D(2, 2),
			});

			expect(result).toContain("<svg");
			expect(result).toContain("<path");
		});

		test("generates SVG with 3D matrix transform applied to path", () => {
			const glyphIdA = font.glyphId("A".codePointAt(0)!);
			if (!glyphIdA) return;

			const glyphs: ShapedGlyph[] = [
				{
					glyphId: glyphIdA,
					xOffset: 0,
					yOffset: 0,
					xAdvance: font.advanceWidth(glyphIdA) ?? 0,
					yAdvance: 0,
				},
			];

			const matrix3D: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[0.0001, 0, 1],
			];

			const result = shapedTextToSVG(font, glyphs, {
				matrix3D,
			});

			expect(result).toContain("<svg");
			expect(result).toContain("<path");
		});

		test("generates SVG with native transform attribute", () => {
			const glyphIdA = font.glyphId("A".codePointAt(0)!);
			if (!glyphIdA) return;

			const glyphs: ShapedGlyph[] = [
				{
					glyphId: glyphIdA,
					xOffset: 0,
					yOffset: 0,
					xAdvance: font.advanceWidth(glyphIdA) ?? 0,
					yAdvance: 0,
				},
			];

			const { scale2D } = require("../../src/render/outline-transform.ts");
			const result = shapedTextToSVG(font, glyphs, {
				matrix: scale2D(2, 2),
				useNativeTransform: true,
			});

			expect(result).toContain('transform="matrix(');
		});
	});

	describe("edge cases for matrix transforms", () => {
		const {
			pathToCanvasWithMatrix,
			pathToSVGWithMatrix,
			pathToCanvasWithMatrix3D,
			pathToSVGWithMatrix3D,
		} = require("../../src/render/path.ts");
		const {
			identity2D,
			identity3x3,
		} = require("../../src/render/outline-transform.ts");

		function createMockCtx() {
			const calls: Array<{ method: string; args: number[] }> = [];
			return {
				calls,
				moveTo: (x: number, y: number) => calls.push({ method: "moveTo", args: [x, y] }),
				lineTo: (x: number, y: number) => calls.push({ method: "lineTo", args: [x, y] }),
				quadraticCurveTo: (x1: number, y1: number, x: number, y: number) =>
					calls.push({ method: "quadraticCurveTo", args: [x1, y1, x, y] }),
				bezierCurveTo: (x1: number, y1: number, x2: number, y2: number, x: number, y: number) =>
					calls.push({ method: "bezierCurveTo", args: [x1, y1, x2, y2, x, y] }),
				closePath: () => calls.push({ method: "closePath", args: [] }),
			};
		}

		test("path with only Z command", () => {
			const path: GlyphPath = {
				commands: [{ type: "Z" }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, identity2D());
			expect(ctx.calls.length).toBe(1);
			expect(ctx.calls[0]!.method).toBe("closePath");
		});

		test("path with many M commands (multiple subpaths)", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 0 },
					{ type: "Z" },
					{ type: "M", x: 20, y: 20 },
					{ type: "L", x: 30, y: 20 },
					{ type: "Z" },
				],
				bounds: null,
			};
			const result = pathToSVGWithMatrix(path, identity2D(), { flipY: false });
			expect(result).toBe("M 0 0 L 10 0 Z M 20 20 L 30 20 Z");
		});

		test("coordinates at origin", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 0, y: 0 },
				],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, identity2D(), { flipY: false });
			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [0, 0] });
			expect(ctx.calls[1]).toEqual({ method: "lineTo", args: [0, 0] });
		});

		test("negative coordinates", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: -100, y: -200 }],
				bounds: null,
			};
			const result = pathToSVGWithMatrix(path, identity2D(), { flipY: false });
			expect(result).toBe("M -100 -200");
		});

		test("very large coordinates", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 1e10, y: 1e10 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, identity2D(), { flipY: false });
			expect(ctx.calls[0]).toEqual({ method: "moveTo", args: [1e10, 1e10] });
		});

		test("fractional coordinates", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0.123456789, y: 0.987654321 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, identity2D(), { flipY: false });
			expect(ctx.calls[0]!.args[0]).toBeCloseTo(0.123456789, 8);
			expect(ctx.calls[0]!.args[1]).toBeCloseTo(0.987654321, 8);
		});

		test("NaN coordinates produce NaN output", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: NaN, y: 0 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, identity2D(), { flipY: false });
			expect(Number.isNaN(ctx.calls[0]!.args[0])).toBe(true);
		});

		test("Infinity coordinates handled gracefully", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: Infinity, y: -Infinity }],
				bounds: null,
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, identity2D(), { flipY: false });
			// Matrix multiplication with Infinity produces NaN due to 0 * Infinity
			expect(ctx.calls.length).toBe(1);
		});

		test("3D near-singular matrix (w approaching zero)", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 1000, y: 0 }],
				bounds: null,
			};
			const ctx = createMockCtx();
			// w = -0.001 * 1000 + 1 = 0 (singular)
			const singularMatrix: [[number, number, number], [number, number, number], [number, number, number]] = [
				[1, 0, 0],
				[0, 1, 0],
				[-0.001, 0, 1],
			];
			pathToCanvasWithMatrix3D(ctx, path, singularMatrix, { flipY: false });
			// Should handle gracefully - returns (0, 0) for point at infinity
			expect(ctx.calls.length).toBe(1);
		});

		test("complex path with all command types", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 0 },
					{ type: "Q", x1: 150, y1: 50, x: 100, y: 100 },
					{ type: "C", x1: 75, y1: 125, x2: 25, y2: 125, x: 0, y: 100 },
					{ type: "L", x: 0, y: 0 },
					{ type: "Z" },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 150, yMax: 125 },
			};
			const ctx = createMockCtx();
			pathToCanvasWithMatrix(ctx, path, identity2D(), { flipY: false });
			expect(ctx.calls.length).toBe(6);
			expect(ctx.calls[0]!.method).toBe("moveTo");
			expect(ctx.calls[1]!.method).toBe("lineTo");
			expect(ctx.calls[2]!.method).toBe("quadraticCurveTo");
			expect(ctx.calls[3]!.method).toBe("bezierCurveTo");
			expect(ctx.calls[4]!.method).toBe("lineTo");
			expect(ctx.calls[5]!.method).toBe("closePath");
		});
	});
});
