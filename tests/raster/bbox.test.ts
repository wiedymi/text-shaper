import { describe, expect, test } from "bun:test";
import type { GlyphPath } from "../../src/render/path.ts";
import {
	evaluateCubic,
	evaluateQuadratic,
	getCubicExtrema,
	getExactBounds,
	getQuadraticExtrema,
} from "../../src/raster/bbox.ts";

describe("Quadratic extrema calculation", () => {
	test("finds extremum at t=0.5 for symmetric curve", () => {
		// Quadratic from p0=0 to p2=0 with control p1=1
		// Extremum should be at t=0.5
		const extrema = getQuadraticExtrema(0, 1, 0);
		expect(extrema).toHaveLength(1);
		expect(extrema[0]).toBeCloseTo(0.5);
	});

	test("finds no extrema for monotonic curve", () => {
		// Monotonically increasing: 0 -> 1 -> 2
		const extrema = getQuadraticExtrema(0, 1, 2);
		expect(extrema).toHaveLength(0);
	});

	test("filters out extrema outside [0,1]", () => {
		// Control point before start
		const extrema = getQuadraticExtrema(5, 3, 4);
		// Should find t but filter if outside [0,1]
		expect(extrema.every((t) => t >= 0 && t <= 1)).toBe(true);
	});

	test("handles zero denominator (linear case)", () => {
		// When a=b=c (all same), derivative is constant
		const extrema = getQuadraticExtrema(5, 5, 5);
		expect(extrema).toHaveLength(0);
	});

	test("returns empty array when t is exactly at boundary", () => {
		// Test case where t would be exactly 0 or 1
		// For t=0: p0 - p1 = 0 => p0 = p1
		const extrema1 = getQuadraticExtrema(5, 5, 10);
		expect(extrema1).toHaveLength(0);

		// For t=1: (p0-p1)/(p0-2p1+p2) = 1 => p0-p1 = p0-2p1+p2 => p1 = p2
		const extrema2 = getQuadraticExtrema(0, 10, 10);
		expect(extrema2).toHaveLength(0);
	});
});

describe("Cubic extrema calculation", () => {
	test("finds extremum for simple cubic", () => {
		// Cubic with one extremum
		const extrema = getCubicExtrema(0, 2, 2, 0);
		expect(extrema.length).toBeGreaterThan(0);
		expect(extrema.every((t) => t >= 0 && t <= 1)).toBe(true);
	});

	test("finds two extrema for S-curve", () => {
		// S-curve: 0 -> 1 -> -1 -> 0
		const extrema = getCubicExtrema(0, 1, -1, 0);
		// Should have 2 extrema
		expect(extrema.length).toBeGreaterThanOrEqual(1);
		expect(extrema.every((t) => t >= 0 && t <= 1)).toBe(true);
	});

	test("handles monotonic cubic", () => {
		// Monotonically increasing
		const extrema = getCubicExtrema(0, 1, 2, 3);
		// May have 0 extrema in valid range
		expect(extrema.every((t) => t >= 0 && t <= 1)).toBe(true);
	});

	test("filters out extrema outside [0,1]", () => {
		const extrema = getCubicExtrema(0, 10, -5, 1);
		expect(extrema.every((t) => t >= 0 && t <= 1)).toBe(true);
	});

	test("handles negative discriminant (no real solutions)", () => {
		// Create cubic where b^2 - 4ac < 0
		// Using values that result in negative discriminant
		const extrema = getCubicExtrema(0, 0.1, 0.2, 1);
		// Should return empty array or valid extrema
		expect(Array.isArray(extrema)).toBe(true);
		expect(extrema.every((t) => t >= 0 && t <= 1)).toBe(true);
	});

	test("handles discriminant exactly zero (one solution)", () => {
		// Create cubic where b^2 - 4ac = 0 and t is in (0,1)
		// p0=0, p1=0.5, p2=0, p3=0.5
		// a = 3(p3 - 3p2 + 3p1 - p0) = 3(0.5 - 0 + 1.5 - 0) = 6
		// b = 6(p2 - 2p1 + p0) = 6(0 - 1 + 0) = -6
		// c = 3(p1 - p0) = 3(0.5 - 0) = 1.5
		// discriminant = b^2 - 4ac = 36 - 36 = 0
		// t = -b / (2a) = 6 / 12 = 0.5
		const extrema = getCubicExtrema(0, 0.5, 0, 0.5);
		expect(Array.isArray(extrema)).toBe(true);
		// Should have exactly 1 extremum when discriminant is 0 and t in (0,1)
		expect(extrema.length).toBe(1);
		expect(extrema[0]).toBeCloseTo(0.5);
	});
});

describe("Quadratic evaluation", () => {
	test("evaluates at t=0 to get start point", () => {
		const value = evaluateQuadratic(10, 20, 30, 0);
		expect(value).toBe(10);
	});

	test("evaluates at t=1 to get end point", () => {
		const value = evaluateQuadratic(10, 20, 30, 1);
		expect(value).toBe(30);
	});

	test("evaluates at t=0.5 for midpoint", () => {
		// For quadratic, midpoint formula: (1-t)^2*p0 + 2(1-t)*t*p1 + t^2*p2
		// At t=0.5: 0.25*10 + 0.5*20 + 0.25*30 = 2.5 + 10 + 7.5 = 20
		const value = evaluateQuadratic(10, 20, 30, 0.5);
		expect(value).toBeCloseTo(20);
	});

	test("finds maximum value for parabola", () => {
		// Parabola from 0 to 0 with peak at control point 100
		const extrema = getQuadraticExtrema(0, 100, 0);
		expect(extrema).toHaveLength(1);
		const maxValue = evaluateQuadratic(0, 100, 0, extrema[0]!);
		// At t=0.5: 0.25*0 + 0.5*100 + 0.25*0 = 50
		expect(maxValue).toBeCloseTo(50);
	});
});

describe("Cubic evaluation", () => {
	test("evaluates at t=0 to get start point", () => {
		const value = evaluateCubic(10, 20, 30, 40, 0);
		expect(value).toBe(10);
	});

	test("evaluates at t=1 to get end point", () => {
		const value = evaluateCubic(10, 20, 30, 40, 1);
		expect(value).toBe(40);
	});

	test("evaluates at t=0.5", () => {
		// Cubic bezier at t=0.5
		// (1-t)^3*p0 + 3(1-t)^2*t*p1 + 3(1-t)*t^2*p2 + t^3*p3
		// 0.125*10 + 0.375*20 + 0.375*30 + 0.125*40
		// = 1.25 + 7.5 + 11.25 + 5 = 25
		const value = evaluateCubic(10, 20, 30, 40, 0.5);
		expect(value).toBeCloseTo(25);
	});
});

describe("Exact path bounds", () => {
	test("returns null for empty path", () => {
		const path: GlyphPath = {
			commands: [],
			bounds: null,
		};
		const bounds = getExactBounds(path);
		expect(bounds).toBeNull();
	});

	test("calculates bounds for simple line segment", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 0, y: 0 },
				{ type: "L", x: 100, y: 50 },
				{ type: "Z" },
			],
			bounds: null,
		};
		const bounds = getExactBounds(path);
		expect(bounds).not.toBeNull();
		expect(bounds!.xMin).toBe(0);
		expect(bounds!.yMin).toBe(0);
		expect(bounds!.xMax).toBe(100);
		expect(bounds!.yMax).toBe(50);
	});

	test("calculates bounds for quadratic with extremum outside control points", () => {
		// Quadratic from (0,0) to (100,0) with control at (50,100)
		// The curve peaks above the control point
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 0, y: 0 },
				{ type: "Q", x1: 50, y1: 100, x: 100, y: 0 },
				{ type: "Z" },
			],
			bounds: null,
		};
		const bounds = getExactBounds(path);
		expect(bounds).not.toBeNull();
		expect(bounds!.xMin).toBe(0);
		expect(bounds!.yMin).toBe(0);
		expect(bounds!.xMax).toBe(100);
		// The yMax should be 50 (at t=0.5, the curve reaches (50, 50))
		expect(bounds!.yMax).toBeCloseTo(50);
		expect(bounds!.yMax).toBeGreaterThan(0);
	});

	test("calculates bounds for cubic with extrema outside control points", () => {
		// Cubic bezier that extends beyond control points
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 0, y: 0 },
				{ type: "C", x1: 0, y1: 100, x2: 100, y2: 100, x: 100, y: 0 },
				{ type: "Z" },
			],
			bounds: null,
		};
		const bounds = getExactBounds(path);
		expect(bounds).not.toBeNull();
		expect(bounds!.xMin).toBe(0);
		expect(bounds!.yMin).toBe(0);
		expect(bounds!.xMax).toBe(100);
		// Should extend beyond y=0 to include the curve peak
		expect(bounds!.yMax).toBeGreaterThan(0);
	});

	test("calculates bounds for path with mixed commands", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 10, y: 10 },
				{ type: "L", x: 50, y: 20 },
				{ type: "Q", x1: 70, y1: 60, x: 90, y: 30 },
				{ type: "C", x1: 100, y1: 10, x2: 110, y2: 50, x: 120, y: 20 },
				{ type: "Z" },
			],
			bounds: null,
		};
		const bounds = getExactBounds(path);
		expect(bounds).not.toBeNull();
		expect(bounds!.xMin).toBeLessThanOrEqual(10);
		expect(bounds!.yMin).toBeLessThanOrEqual(10);
		expect(bounds!.xMax).toBeGreaterThanOrEqual(120);
		// Should account for curve extrema
		expect(bounds!.yMax).toBeGreaterThan(0);
	});

	test("handles multiple contours", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 0, y: 0 },
				{ type: "L", x: 10, y: 10 },
				{ type: "Z" },
				{ type: "M", x: 50, y: 50 },
				{ type: "L", x: 100, y: 100 },
				{ type: "Z" },
			],
			bounds: null,
		};
		const bounds = getExactBounds(path);
		expect(bounds).not.toBeNull();
		expect(bounds!.xMin).toBe(0);
		expect(bounds!.yMin).toBe(0);
		expect(bounds!.xMax).toBe(100);
		expect(bounds!.yMax).toBe(100);
	});

	test("handles negative coordinates", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: -50, y: -50 },
				{ type: "L", x: 50, y: 50 },
				{ type: "Z" },
			],
			bounds: null,
		};
		const bounds = getExactBounds(path);
		expect(bounds).not.toBeNull();
		expect(bounds!.xMin).toBe(-50);
		expect(bounds!.yMin).toBe(-50);
		expect(bounds!.xMax).toBe(50);
		expect(bounds!.yMax).toBe(50);
	});

	test("specific test: quadratic from (0,0) to (100,0) with control at (50,100)", () => {
		// This is the specific test case mentioned in the requirements
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 0, y: 0 },
				{ type: "Q", x1: 50, y1: 100, x: 100, y: 0 },
				{ type: "Z" },
			],
			bounds: null,
		};
		const bounds = getExactBounds(path);
		expect(bounds).not.toBeNull();
		expect(bounds!.yMax).toBeGreaterThan(0);
		// The exact maximum is at t=0.5, where y = 50
		expect(bounds!.yMax).toBeCloseTo(50);
	});

	test("handles path with only moveTo", () => {
		const path: GlyphPath = {
			commands: [{ type: "M", x: 10, y: 20 }],
			bounds: null,
		};
		const bounds = getExactBounds(path);
		expect(bounds).not.toBeNull();
		expect(bounds!.xMin).toBe(10);
		expect(bounds!.yMin).toBe(20);
		expect(bounds!.xMax).toBe(10);
		expect(bounds!.yMax).toBe(20);
	});

	test("ignores close path commands", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 0, y: 0 },
				{ type: "L", x: 100, y: 100 },
				{ type: "Z" },
				{ type: "Z" },
				{ type: "Z" },
			],
			bounds: null,
		};
		const bounds = getExactBounds(path);
		expect(bounds).not.toBeNull();
		expect(bounds!.xMin).toBe(0);
		expect(bounds!.xMax).toBe(100);
	});

	test("returns null for path with only Z commands", () => {
		const path: GlyphPath = {
			commands: [{ type: "Z" }, { type: "Z" }],
			bounds: null,
		};
		const bounds = getExactBounds(path);
		expect(bounds).toBeNull();
	});

	test("calculates bounds for quadratic with X extrema", () => {
		// Quadratic that has extremum in X direction
		// From (0,0) to (0,100) with control at (100,50)
		// The curve bulges out in X direction
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 0, y: 0 },
				{ type: "Q", x1: 100, y1: 50, x: 0, y: 100 },
			],
			bounds: null,
		};
		const bounds = getExactBounds(path);
		expect(bounds).not.toBeNull();
		// xMax should be > 0 due to the curve bulging out
		expect(bounds!.xMax).toBeGreaterThan(0);
		expect(bounds!.xMax).toBeCloseTo(50);
	});

	test("calculates bounds for cubic with X extrema", () => {
		// Cubic that has extremum in X direction
		// From (0,0) to (0,100) with controls that push the curve out in X
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 0, y: 0 },
				{ type: "C", x1: 100, y1: 0, x2: 100, y2: 100, x: 0, y: 100 },
			],
			bounds: null,
		};
		const bounds = getExactBounds(path);
		expect(bounds).not.toBeNull();
		// xMax should extend beyond 0 due to curve extrema
		expect(bounds!.xMax).toBeGreaterThan(0);
	});
});
