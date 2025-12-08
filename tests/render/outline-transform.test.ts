import { describe, expect, test } from "bun:test";
import type { GlyphPath } from "../../src/render/path.ts";
import {
	identity2D,
	identity3x3,
	translate2D,
	scale2D,
	rotate2D,
	shear2D,
	multiply2D,
	multiply3x3,
	transformPoint2D,
	transformPoint3x3,
	rotateOutline90,
	scaleOutlinePow2,
	transformOutline2D,
	transformOutline3D,
	computeControlBox,
	computeTightBounds,
	updateMinTransformedX,
	translateOutline,
	scaleOutline,
	rotateOutline,
	italicizeOutline,
	perspectiveMatrix,
	combinePaths,
	clonePath,
	type Matrix2D,
	type Matrix3x3,
	type BoundingBox,
} from "../../src/render/outline-transform.ts";

describe("render/outline-transform", () => {
	describe("Matrix creation", () => {
		test("identity2D creates identity matrix", () => {
			const m = identity2D();
			expect(m).toEqual([1, 0, 0, 1, 0, 0]);
		});

		test("identity3x3 creates identity matrix", () => {
			const m = identity3x3();
			expect(m).toEqual([
				[1, 0, 0],
				[0, 1, 0],
				[0, 0, 1],
			]);
		});

		test("translate2D creates translation matrix", () => {
			const m = translate2D(10, 20);
			expect(m).toEqual([1, 0, 0, 1, 10, 20]);
		});

		test("scale2D creates scale matrix", () => {
			const m = scale2D(2, 3);
			expect(m).toEqual([2, 0, 0, 3, 0, 0]);
		});

		test("rotate2D creates rotation matrix", () => {
			const m = rotate2D(Math.PI / 2); // 90 degrees
			expect(m[0]).toBeCloseTo(0, 5);
			expect(m[1]).toBeCloseTo(1, 5);
			expect(m[2]).toBeCloseTo(-1, 5);
			expect(m[3]).toBeCloseTo(0, 5);
			expect(m[4]).toBe(0);
			expect(m[5]).toBe(0);
		});

		test("shear2D creates shear matrix", () => {
			const m = shear2D(0.5, 0.25);
			expect(m).toEqual([1, 0.25, 0.5, 1, 0, 0]);
		});
	});

	describe("Matrix multiplication", () => {
		test("multiply2D multiplies two 2D matrices", () => {
			const a = scale2D(2, 2);
			const b = translate2D(10, 20);
			const result = multiply2D(a, b);
			// Expect scale(2,2) * translate(10,20) = [2,0,0,2,20,40]
			expect(result).toEqual([2, 0, 0, 2, 20, 40]);
		});

		test("multiply3x3 multiplies two 3x3 matrices", () => {
			const a: Matrix3x3 = [
				[2, 0, 0],
				[0, 2, 0],
				[0, 0, 1],
			];
			const b: Matrix3x3 = [
				[1, 0, 10],
				[0, 1, 20],
				[0, 0, 1],
			];
			const result = multiply3x3(a, b);
			expect(result).toEqual([
				[2, 0, 20],
				[0, 2, 40],
				[0, 0, 1],
			]);
		});

		test("multiply3x3 handles complex matrices", () => {
			const a: Matrix3x3 = [
				[1, 2, 3],
				[4, 5, 6],
				[7, 8, 9],
			];
			const b: Matrix3x3 = [
				[9, 8, 7],
				[6, 5, 4],
				[3, 2, 1],
			];
			const result = multiply3x3(a, b);
			// Row 0: [1*9+2*6+3*3, 1*8+2*5+3*2, 1*7+2*4+3*1] = [30, 24, 18]
			// Row 1: [4*9+5*6+6*3, 4*8+5*5+6*2, 4*7+5*4+6*1] = [84, 69, 54]
			// Row 2: [7*9+8*6+9*3, 7*8+8*5+9*2, 7*7+8*4+9*1] = [138, 114, 90]
			expect(result).toEqual([
				[30, 24, 18],
				[84, 69, 54],
				[138, 114, 90],
			]);
		});
	});

	describe("Point transformation", () => {
		test("transformPoint2D with identity", () => {
			const p = transformPoint2D(10, 20, identity2D());
			expect(p).toEqual({ x: 10, y: 20 });
		});

		test("transformPoint2D with scale", () => {
			const p = transformPoint2D(10, 20, scale2D(2, 3));
			expect(p).toEqual({ x: 20, y: 60 });
		});

		test("transformPoint2D with translation", () => {
			const p = transformPoint2D(10, 20, translate2D(5, 10));
			expect(p).toEqual({ x: 15, y: 30 });
		});

		test("transformPoint3x3 with identity", () => {
			const p = transformPoint3x3(10, 20, identity3x3());
			expect(p).toEqual({ x: 10, y: 20 });
		});

		test("transformPoint3x3 with scale", () => {
			const m: Matrix3x3 = [
				[2, 0, 0],
				[0, 3, 0],
				[0, 0, 1],
			];
			const p = transformPoint3x3(10, 20, m);
			expect(p).toEqual({ x: 20, y: 60 });
		});

		test("transformPoint3x3 with perspective", () => {
			const m: Matrix3x3 = [
				[1, 0, 0],
				[0, 1, 0],
				[0.001, 0, 1], // w = 0.001*x + 1
			];
			const p = transformPoint3x3(100, 0, m);
			// w = 0.001*100 + 1 = 1.1
			// x' = 100/1.1 ≈ 90.909
			expect(p.x).toBeCloseTo(90.909, 2);
			expect(p.y).toBeCloseTo(0, 5);
		});

		test("transformPoint3x3 clamps when w < minW", () => {
			const m: Matrix3x3 = [
				[1, 0, 0],
				[0, 1, 0],
				[-0.02, 0, 1], // w = -0.02*100 + 1 = -1 (negative!)
			];
			const p = transformPoint3x3(100, 0, m);
			// Should clamp w to 0.01 and divide by that
			expect(Number.isFinite(p.x)).toBe(true);
			expect(Number.isFinite(p.y)).toBe(true);
		});

		test("transformPoint3x3 handles w approaching zero", () => {
			const m: Matrix3x3 = [
				[1, 0, 0],
				[0, 1, 0],
				[-0.0099, 0, 1], // w = -0.0099*100 + 1 = 0.01 (at threshold)
			];
			const p = transformPoint3x3(100, 0, m);
			expect(Number.isFinite(p.x)).toBe(true);
			expect(Number.isFinite(p.y)).toBe(true);
		});

		test("transformPoint3x3 normal w uses standard division", () => {
			const m: Matrix3x3 = [
				[2, 0, 5],
				[0, 3, 10],
				[0, 0, 2], // w = 2
			];
			const p = transformPoint3x3(10, 20, m);
			// x' = (2*10 + 0*20 + 5) / 2 = 25/2 = 12.5
			// y' = (0*10 + 3*20 + 10) / 2 = 70/2 = 35
			expect(p.x).toBeCloseTo(12.5, 5);
			expect(p.y).toBeCloseTo(35, 5);
		});
	});

	describe("rotateOutline90", () => {
		test("rotates M command 90 degrees", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 100, y: 0 }],
				bounds: null,
			};
			const result = rotateOutline90(path);
			// 90° CCW: (100, 0) -> (0, 100)
			expect(result.commands[0]).toEqual({ type: "M", x: 0, y: 100 });
		});

		test("rotates L command 90 degrees", () => {
			const path: GlyphPath = {
				commands: [{ type: "L", x: 100, y: 50 }],
				bounds: null,
			};
			const result = rotateOutline90(path);
			// 90° CCW: (100, 50) -> (-50, 100)
			expect(result.commands[0]).toEqual({ type: "L", x: -50, y: 100 });
		});

		test("rotates Q command 90 degrees", () => {
			const path: GlyphPath = {
				commands: [{ type: "Q", x1: 50, y1: 0, x: 100, y: 50 }],
				bounds: null,
			};
			const result = rotateOutline90(path);
			// 90° CCW: (50, 0) -> (0, 50), (100, 50) -> (-50, 100)
			expect(result.commands[0]).toEqual({
				type: "Q",
				x1: 0,
				y1: 50,
				x: -50,
				y: 100,
			});
		});

		test("rotates C command 90 degrees", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "C", x1: 25, y1: 0, x2: 75, y2: 0, x: 100, y: 50 },
				],
				bounds: null,
			};
			const result = rotateOutline90(path);
			// 90° CCW: (25,0)->( 0,25), (75,0)->(0,75), (100,50)->(-50,100)
			expect(result.commands[0]).toEqual({
				type: "C",
				x1: 0,
				y1: 25,
				x2: 0,
				y2: 75,
				x: -50,
				y: 100,
			});
		});

		test("handles Z command", () => {
			const path: GlyphPath = {
				commands: [{ type: "Z" }],
				bounds: null,
			};
			const result = rotateOutline90(path);
			expect(result.commands[0]).toEqual({ type: "Z" });
		});

		test("applies offset after rotation", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 100, y: 0 }],
				bounds: null,
			};
			const result = rotateOutline90(path, 10, 20);
			// 90° CCW: (100, 0) -> (0, 100), then + (10, 20) = (10, 120)
			expect(result.commands[0]).toEqual({ type: "M", x: 10, y: 120 });
		});

		test("rotates bounds", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 0 }],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 50 },
			};
			const result = rotateOutline90(path);
			// Bounds: (0,0)-(100,50) rotates to (-50,0)-(0,100)
			// After normalization: xMin=-50, yMin=0, xMax=0, yMax=100
			expect(result.bounds).toEqual({
				xMin: -50,
				yMin: 0,
				xMax: 0,
				yMax: 100,
			});
		});

		test("normalizes bounds when xMin > xMax", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 0 }],
				bounds: { xMin: 50, yMin: 0, xMax: -50, yMax: 100 },
			};
			const result = rotateOutline90(path);
			// Rotation: xMin=-100, yMin=50, xMax=0, yMax=-50
			// After swap: should ensure min < max
			expect(result.bounds!.xMin).toBeLessThanOrEqual(result.bounds!.xMax);
		});

		test("normalizes bounds when yMin > yMax", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 0 }],
				bounds: { xMin: 0, yMin: 100, xMax: 50, yMax: -100 },
			};
			const result = rotateOutline90(path);
			// Should swap to ensure min < max
			expect(result.bounds!.yMin).toBeLessThanOrEqual(result.bounds!.yMax);
		});

		test("preserves flags", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 0 }],
				bounds: null,
				flags: 3,
			};
			const result = rotateOutline90(path);
			expect(result.flags).toBe(3);
		});

		test("handles unknown command type via default case", () => {
			// Create object with unknown type at runtime to bypass TypeScript checks
			const unknownCmd = { type: "UNKNOWN" };
			const path = {
				commands: [unknownCmd],
				bounds: null,
			} as any as GlyphPath;
			const result = rotateOutline90(path);
			// Default case should pass through unknown command unchanged
			expect(result.commands[0]).toBe(unknownCmd);
		});
	});

	describe("scaleOutlinePow2", () => {
		test("scales with positive orders (enlarge)", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const result = scaleOutlinePow2(path, 1, 2); // x*2, y*4
			expect(result.commands[0]).toEqual({ type: "M", x: 20, y: 80 });
		});

		test("scales with negative orders (shrink)", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 100, y: 200 }],
				bounds: null,
			};
			const result = scaleOutlinePow2(path, -1, -2); // x/2, y/4
			expect(result.commands[0]).toEqual({ type: "M", x: 50, y: 50 });
		});

		test("scales L command", () => {
			const path: GlyphPath = {
				commands: [{ type: "L", x: 10, y: 20 }],
				bounds: null,
			};
			const result = scaleOutlinePow2(path, 1, 1); // x*2, y*2
			expect(result.commands[0]).toEqual({ type: "L", x: 20, y: 40 });
		});

		test("scales Q command", () => {
			const path: GlyphPath = {
				commands: [{ type: "Q", x1: 10, y1: 20, x: 30, y: 40 }],
				bounds: null,
			};
			const result = scaleOutlinePow2(path, 1, 1); // x*2, y*2
			expect(result.commands[0]).toEqual({
				type: "Q",
				x1: 20,
				y1: 40,
				x: 60,
				y: 80,
			});
		});

		test("scales C command", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "C", x1: 10, y1: 20, x2: 30, y2: 40, x: 50, y: 60 },
				],
				bounds: null,
			};
			const result = scaleOutlinePow2(path, 1, 1); // x*2, y*2
			expect(result.commands[0]).toEqual({
				type: "C",
				x1: 20,
				y1: 40,
				x2: 60,
				y2: 80,
				x: 100,
				y: 120,
			});
		});

		test("handles Z command", () => {
			const path: GlyphPath = {
				commands: [{ type: "Z" }],
				bounds: null,
			};
			const result = scaleOutlinePow2(path, 1, 1);
			expect(result.commands[0]).toEqual({ type: "Z" });
		});

		test("scales bounds", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: 10, yMin: 20, xMax: 30, yMax: 40 },
			};
			const result = scaleOutlinePow2(path, 1, 1); // x*2, y*2
			expect(result.bounds).toEqual({
				xMin: 20,
				yMin: 40,
				xMax: 60,
				yMax: 80,
			});
		});

		test("preserves flags", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 0 }],
				bounds: null,
				flags: 5,
			};
			const result = scaleOutlinePow2(path, 0, 0);
			expect(result.flags).toBe(5);
		});

		test("handles unknown command type via default case", () => {
			// Create object with unknown type at runtime to bypass TypeScript checks
			const unknownCmd = { type: "UNKNOWN" };
			const path = {
				commands: [unknownCmd],
				bounds: null,
			} as any as GlyphPath;
			const result = scaleOutlinePow2(path, 1, 1);
			// Default case should pass through unknown command unchanged
			expect(result.commands[0]).toBe(unknownCmd);
		});
	});

	describe("transformOutline2D", () => {
		test("transforms M command", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const result = transformOutline2D(path, scale2D(2, 3));
			expect(result.commands[0]).toEqual({ type: "M", x: 20, y: 60 });
		});

		test("transforms L command", () => {
			const path: GlyphPath = {
				commands: [{ type: "L", x: 10, y: 20 }],
				bounds: null,
			};
			const result = transformOutline2D(path, translate2D(5, 10));
			expect(result.commands[0]).toEqual({ type: "L", x: 15, y: 30 });
		});

		test("transforms Q command", () => {
			const path: GlyphPath = {
				commands: [{ type: "Q", x1: 10, y1: 20, x: 30, y: 40 }],
				bounds: null,
			};
			const result = transformOutline2D(path, scale2D(2, 2));
			expect(result.commands[0]).toEqual({
				type: "Q",
				x1: 20,
				y1: 40,
				x: 60,
				y: 80,
			});
		});

		test("transforms C command", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "C", x1: 10, y1: 20, x2: 30, y2: 40, x: 50, y: 60 },
				],
				bounds: null,
			};
			const result = transformOutline2D(path, scale2D(2, 2));
			expect(result.commands[0]).toEqual({
				type: "C",
				x1: 20,
				y1: 40,
				x2: 60,
				y2: 80,
				x: 100,
				y: 120,
			});
		});

		test("handles Z command", () => {
			const path: GlyphPath = {
				commands: [{ type: "Z" }],
				bounds: null,
			};
			const result = transformOutline2D(path, identity2D());
			expect(result.commands[0]).toEqual({ type: "Z" });
		});

		test("transforms bounds by transforming all corners", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 50 },
			};
			const result = transformOutline2D(path, scale2D(2, 2));
			expect(result.bounds).toEqual({
				xMin: 0,
				yMin: 0,
				xMax: 200,
				yMax: 100,
			});
		});

		test("preserves null bounds", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 0 }],
				bounds: null,
			};
			const result = transformOutline2D(path, identity2D());
			expect(result.bounds).toBeNull();
		});

		test("preserves flags", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 0 }],
				bounds: null,
				flags: 7,
			};
			const result = transformOutline2D(path, identity2D());
			expect(result.flags).toBe(7);
		});

		test("handles unknown command type via default case", () => {
			// Create object with unknown type at runtime to bypass TypeScript checks
			const unknownCmd = { type: "UNKNOWN" };
			const path = {
				commands: [unknownCmd],
				bounds: null,
			} as any as GlyphPath;
			const result = transformOutline2D(path, identity2D());
			// Default case should pass through unknown command unchanged
			expect(result.commands[0]).toBe(unknownCmd);
		});
	});

	describe("transformOutline3D", () => {
		test("transforms M command", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const m: Matrix3x3 = [
				[2, 0, 0],
				[0, 3, 0],
				[0, 0, 1],
			];
			const result = transformOutline3D(path, m);
			expect(result.commands[0]).toEqual({ type: "M", x: 20, y: 60 });
		});

		test("transforms L command", () => {
			const path: GlyphPath = {
				commands: [{ type: "L", x: 10, y: 20 }],
				bounds: null,
			};
			const m: Matrix3x3 = [
				[1, 0, 5],
				[0, 1, 10],
				[0, 0, 1],
			];
			const result = transformOutline3D(path, m);
			expect(result.commands[0]).toEqual({ type: "L", x: 15, y: 30 });
		});

		test("transforms Q command", () => {
			const path: GlyphPath = {
				commands: [{ type: "Q", x1: 10, y1: 20, x: 30, y: 40 }],
				bounds: null,
			};
			const m: Matrix3x3 = [
				[2, 0, 0],
				[0, 2, 0],
				[0, 0, 1],
			];
			const result = transformOutline3D(path, m);
			expect(result.commands[0]).toEqual({
				type: "Q",
				x1: 20,
				y1: 40,
				x: 60,
				y: 80,
			});
		});

		test("transforms C command", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "C", x1: 10, y1: 20, x2: 30, y2: 40, x: 50, y: 60 },
				],
				bounds: null,
			};
			const m: Matrix3x3 = [
				[2, 0, 0],
				[0, 2, 0],
				[0, 0, 1],
			];
			const result = transformOutline3D(path, m);
			expect(result.commands[0]).toEqual({
				type: "C",
				x1: 20,
				y1: 40,
				x2: 60,
				y2: 80,
				x: 100,
				y: 120,
			});
		});

		test("handles Z command", () => {
			const path: GlyphPath = {
				commands: [{ type: "Z" }],
				bounds: null,
			};
			const result = transformOutline3D(path, identity3x3());
			expect(result.commands[0]).toEqual({ type: "Z" });
		});

		test("transforms bounds", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 50 },
			};
			const m: Matrix3x3 = [
				[2, 0, 0],
				[0, 2, 0],
				[0, 0, 1],
			];
			const result = transformOutline3D(path, m);
			expect(result.bounds).toEqual({
				xMin: 0,
				yMin: 0,
				xMax: 200,
				yMax: 100,
			});
		});

		test("preserves null bounds", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 0 }],
				bounds: null,
			};
			const result = transformOutline3D(path, identity3x3());
			expect(result.bounds).toBeNull();
		});

		test("preserves flags", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 0 }],
				bounds: null,
				flags: 2,
			};
			const result = transformOutline3D(path, identity3x3());
			expect(result.flags).toBe(2);
		});

		test("handles unknown command type via default case", () => {
			// Create object with unknown type at runtime to bypass TypeScript checks
			const unknownCmd = { type: "UNKNOWN" };
			const path = {
				commands: [unknownCmd],
				bounds: null,
			} as any as GlyphPath;
			const result = transformOutline3D(path, identity3x3());
			// Default case should pass through unknown command unchanged
			expect(result.commands[0]).toBe(unknownCmd);
		});
	});

	describe("computeControlBox", () => {
		test("handles empty path", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
			};
			const box = computeControlBox(path);
			expect(box).toEqual({ xMin: 0, yMin: 0, xMax: 0, yMax: 0 });
		});

		test("computes bounds for M command", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const box = computeControlBox(path);
			expect(box).toEqual({ xMin: 10, yMin: 20, xMax: 10, yMax: 20 });
		});

		test("computes bounds for L command", () => {
			const path: GlyphPath = {
				commands: [{ type: "L", x: 100, y: 50 }],
				bounds: null,
			};
			const box = computeControlBox(path);
			expect(box).toEqual({ xMin: 100, yMin: 50, xMax: 100, yMax: 50 });
		});

		test("computes bounds for Q command", () => {
			const path: GlyphPath = {
				commands: [{ type: "Q", x1: 50, y1: 100, x: 100, y: 0 }],
				bounds: null,
			};
			const box = computeControlBox(path);
			// Min/max of control point (50,100) and endpoint (100,0)
			expect(box).toEqual({ xMin: 50, yMin: 0, xMax: 100, yMax: 100 });
		});

		test("computes bounds for C command", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "C", x1: 25, y1: 50, x2: 75, y2: 50, x: 100, y: 0 },
				],
				bounds: null,
			};
			const box = computeControlBox(path);
			// Min/max of all control points and endpoint
			expect(box).toEqual({ xMin: 25, yMin: 0, xMax: 100, yMax: 50 });
		});

		test("computes bounds for multiple commands", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 0 },
					{ type: "Q", x1: 150, y1: 50, x: 100, y: 100 },
					{ type: "Z" },
				],
				bounds: null,
			};
			const box = computeControlBox(path);
			expect(box).toEqual({ xMin: 0, yMin: 0, xMax: 150, yMax: 100 });
		});

		test("ignores Z command", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 10 }, { type: "Z" }],
				bounds: null,
			};
			const box = computeControlBox(path);
			expect(box).toEqual({ xMin: 10, yMin: 10, xMax: 10, yMax: 10 });
		});
	});

	describe("computeTightBounds", () => {
		test("handles empty path", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
			};
			const box = computeTightBounds(path);
			expect(box).toEqual({ xMin: 0, yMin: 0, xMax: 0, yMax: 0 });
		});

		test("computes bounds for M command", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const box = computeTightBounds(path);
			expect(box).toEqual({ xMin: 10, yMin: 20, xMax: 10, yMax: 20 });
		});

		test("computes bounds for L command", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 50 },
				],
				bounds: null,
			};
			const box = computeTightBounds(path);
			expect(box).toEqual({ xMin: 0, yMin: 0, xMax: 100, yMax: 50 });
		});

		test("computes bounds for Q command with extrema", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "Q", x1: 50, y1: 100, x: 100, y: 0 },
				],
				bounds: null,
			};
			const box = computeTightBounds(path);
			// Quadratic from (0,0) via (50,100) to (100,0)
			// Y extremum at t=0.5, y=50
			expect(box.xMin).toBe(0);
			expect(box.xMax).toBe(100);
			expect(box.yMin).toBe(0);
			expect(box.yMax).toBeCloseTo(50, 0); // Peak at midpoint
		});

		test("computes bounds for Q command without extrema", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "Q", x1: 50, y1: -10, x: 100, y: 0 },
				],
				bounds: null,
			};
			const box = computeTightBounds(path);
			// No extrema in valid range, just endpoints
			expect(box.xMin).toBe(0);
			expect(box.xMax).toBe(100);
			expect(box.yMin).toBeLessThan(0);
			expect(box.yMax).toBe(0);
		});

		test("computes bounds for C command with extrema", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "C", x1: 0, y1: 100, x2: 100, y2: 100, x: 100, y: 0 },
				],
				bounds: null,
			};
			const box = computeTightBounds(path);
			// Cubic has extrema
			expect(box.xMin).toBe(0);
			expect(box.xMax).toBe(100);
			expect(box.yMin).toBe(0);
			expect(box.yMax).toBeGreaterThan(0);
		});

		test("computes bounds for C command without extrema", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "C", x1: 25, y1: -5, x2: 75, y2: -5, x: 100, y: 0 },
				],
				bounds: null,
			};
			const box = computeTightBounds(path);
			expect(box.xMin).toBe(0);
			expect(box.xMax).toBe(100);
			expect(box.yMin).toBeLessThan(0);
			expect(box.yMax).toBe(0);
		});

		test("handles Z command", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 0 },
					{ type: "Z" },
				],
				bounds: null,
			};
			const box = computeTightBounds(path);
			expect(box).toEqual({ xMin: 0, yMin: 0, xMax: 100, yMax: 0 });
		});

		test("quadratic with no extrema in valid range", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 50 },
					{ type: "Q", x1: 50, y1: 50, x: 100, y: 50 },
				],
				bounds: null,
			};
			const box = computeTightBounds(path);
			// Horizontal line, no extrema
			expect(box.yMin).toBe(50);
			expect(box.yMax).toBe(50);
		});

		test("quadratic with X extrema", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "Q", x1: 100, y1: 0, x: 0, y: 100 },
				],
				bounds: null,
			};
			const box = computeTightBounds(path);
			// Has X extremum in the middle
			expect(box.xMin).toBe(0);
			expect(box.xMax).toBeGreaterThan(0);
		});

		test("quadratic with Y extrema", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "Q", x1: 0, y1: 100, x: 100, y: 0 },
				],
				bounds: null,
			};
			const box = computeTightBounds(path);
			// Has Y extremum in the middle
			expect(box.yMin).toBe(0);
			expect(box.yMax).toBeGreaterThan(0);
		});

		test("cubic with no extrema", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "C", x1: 30, y1: 10, x2: 70, y2: -10, x: 100, y: 0 },
				],
				bounds: null,
			};
			const box = computeTightBounds(path);
			// Curve that goes slightly below y=0
			expect(box.xMin).toBe(0);
			expect(box.xMax).toBe(100);
		});

		test("cubic with X extrema", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "C", x1: 150, y1: 0, x2: 150, y2: 100, x: 0, y: 100 },
				],
				bounds: null,
			};
			const box = computeTightBounds(path);
			// Has X extremum beyond endpoints
			expect(box.xMin).toBe(0);
			expect(box.xMax).toBeGreaterThan(0);
		});

		test("cubic with Y extrema", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "C", x1: 0, y1: 150, x2: 100, y2: 150, x: 100, y: 0 },
				],
				bounds: null,
			};
			const box = computeTightBounds(path);
			// Has Y extremum beyond endpoints
			expect(box.yMin).toBe(0);
			expect(box.yMax).toBeGreaterThan(0);
		});
	});

	describe("updateMinTransformedX", () => {
		test("finds minimum X from M command", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 50, y: 0 }],
				bounds: null,
			};
			const minX = updateMinTransformedX(path, identity3x3(), 100);
			expect(minX).toBe(50);
		});

		test("finds minimum X from L command", () => {
			const path: GlyphPath = {
				commands: [{ type: "L", x: 30, y: 0 }],
				bounds: null,
			};
			const minX = updateMinTransformedX(path, identity3x3(), 100);
			expect(minX).toBe(30);
		});

		test("finds minimum X from Q command", () => {
			const path: GlyphPath = {
				commands: [{ type: "Q", x1: 40, y1: 0, x: 80, y: 0 }],
				bounds: null,
			};
			const minX = updateMinTransformedX(path, identity3x3(), 100);
			expect(minX).toBe(40);
		});

		test("finds minimum X from C command", () => {
			const path: GlyphPath = {
				commands: [{ type: "C", x1: 20, y1: 0, x2: 60, y2: 0, x: 100, y: 0 }],
				bounds: null,
			};
			const minX = updateMinTransformedX(path, identity3x3(), 100);
			expect(minX).toBe(20);
		});

		test("keeps current minimum if all X values are larger", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 100, y: 0 }],
				bounds: null,
			};
			const minX = updateMinTransformedX(path, identity3x3(), 50);
			expect(minX).toBe(50);
		});

		test("applies 3D transformation", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 100, y: 0 }],
				bounds: null,
			};
			const m: Matrix3x3 = [
				[0.5, 0, 0],
				[0, 1, 0],
				[0, 0, 1],
			];
			const minX = updateMinTransformedX(path, m, 1000);
			expect(minX).toBe(50); // 100 * 0.5
		});

		test("ignores Z command", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 50, y: 0 }, { type: "Z" }],
				bounds: null,
			};
			const minX = updateMinTransformedX(path, identity3x3(), 100);
			expect(minX).toBe(50);
		});
	});

	describe("Helper functions", () => {
		test("translateOutline", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const result = translateOutline(path, 5, 10);
			expect(result.commands[0]).toEqual({ type: "M", x: 15, y: 30 });
		});

		test("scaleOutline uniform", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const result = scaleOutline(path, 2);
			expect(result.commands[0]).toEqual({ type: "M", x: 20, y: 40 });
		});

		test("scaleOutline non-uniform", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: null,
			};
			const result = scaleOutline(path, 2, 3);
			expect(result.commands[0]).toEqual({ type: "M", x: 20, y: 60 });
		});

		test("rotateOutline", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 100, y: 0 }],
				bounds: null,
			};
			const result = rotateOutline(path, Math.PI / 2);
			// 90° rotation: (100, 0) -> (0, 100)
			expect(result.commands[0]!.x).toBeCloseTo(0, 5);
			expect(result.commands[0]!.y).toBeCloseTo(100, 5);
		});

		test("italicizeOutline", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 100 }],
				bounds: null,
			};
			const result = italicizeOutline(path, 15); // 15 degree italic
			// Shear X = tan(15°) ≈ 0.268
			// x' = x + shearX * y = 0 + 0.268 * 100 ≈ 26.8
			expect(result.commands[0]!.x).toBeCloseTo(26.8, 0);
			expect(result.commands[0]!.y).toBe(100);
		});

		test("perspectiveMatrix creates perspective transform", () => {
			const m = perspectiveMatrix(100, 100, 0.01);
			expect(m).toEqual([
				[1, 0, -1],
				[0, 1, -1],
				[0, 0, 1],
			]);
		});
	});

	describe("combinePaths", () => {
		test("combines empty paths", () => {
			const result = combinePaths([]);
			expect(result.commands).toEqual([]);
			expect(result.bounds).toBeNull();
		});

		test("combines single path", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: { xMin: 10, yMin: 20, xMax: 10, yMax: 20 },
			};
			const result = combinePaths([path]);
			expect(result.commands).toEqual([{ type: "M", x: 10, y: 20 }]);
			expect(result.bounds).toEqual({ xMin: 10, yMin: 20, xMax: 10, yMax: 20 });
		});

		test("combines multiple paths", () => {
			const path1: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 0 }],
				bounds: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
			};
			const path2: GlyphPath = {
				commands: [{ type: "M", x: 20, y: 20 }],
				bounds: { xMin: 20, yMin: 20, xMax: 30, yMax: 30 },
			};
			const result = combinePaths([path1, path2]);
			expect(result.commands).toEqual([
				{ type: "M", x: 0, y: 0 },
				{ type: "M", x: 20, y: 20 },
			]);
			expect(result.bounds).toEqual({ xMin: 0, yMin: 0, xMax: 30, yMax: 30 });
		});

		test("handles paths with null bounds", () => {
			const path1: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 0 }],
				bounds: null,
			};
			const path2: GlyphPath = {
				commands: [{ type: "M", x: 20, y: 20 }],
				bounds: { xMin: 20, yMin: 20, xMax: 30, yMax: 30 },
			};
			const result = combinePaths([path1, path2]);
			expect(result.bounds).toEqual({ xMin: 20, yMin: 20, xMax: 30, yMax: 30 });
		});

		test("returns null bounds when all paths have null bounds", () => {
			const path1: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 0 }],
				bounds: null,
			};
			const path2: GlyphPath = {
				commands: [{ type: "M", x: 20, y: 20 }],
				bounds: null,
			};
			const result = combinePaths([path1, path2]);
			expect(result.bounds).toBeNull();
		});
	});

	describe("clonePath", () => {
		test("clones commands", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 10, y: 20 },
					{ type: "L", x: 30, y: 40 },
				],
				bounds: null,
			};
			const clone = clonePath(path);
			expect(clone.commands).toEqual(path.commands);
			expect(clone.commands).not.toBe(path.commands);
			expect(clone.commands[0]).not.toBe(path.commands[0]);
		});

		test("clones bounds", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 50 },
			};
			const clone = clonePath(path);
			expect(clone.bounds).toEqual(path.bounds);
			expect(clone.bounds).not.toBe(path.bounds);
		});

		test("handles null bounds", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
			};
			const clone = clonePath(path);
			expect(clone.bounds).toBeNull();
		});

		test("clones flags", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
				flags: 5,
			};
			const clone = clonePath(path);
			expect(clone.flags).toBe(5);
		});

		test("modifications to clone don't affect original", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 10, y: 20 }],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 50 },
			};
			const clone = clonePath(path);
			clone.commands[0]!.x = 999;
			clone.bounds!.xMin = -100;
			expect(path.commands[0]!.x).toBe(10);
			expect(path.bounds!.xMin).toBe(0);
		});
	});
});
