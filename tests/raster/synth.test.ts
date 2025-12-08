import { expect, test } from "bun:test";
import type { GlyphPath, PathCommand } from "../../src/render/path.ts";
import {
	condensePath,
	emboldenPath,
	obliquePath,
	transformPath,
} from "../../src/raster/synth.ts";

/**
 * Helper to create a simple rectangular path for testing
 */
function createRectPath(
	x: number,
	y: number,
	width: number,
	height: number,
): GlyphPath {
	return {
		commands: [
			{ type: "M", x, y },
			{ type: "L", x: x + width, y },
			{ type: "L", x: x + width, y: y + height },
			{ type: "L", x, y: y + height },
			{ type: "Z" },
		],
		bounds: { xMin: x, yMin: y, xMax: x + width, yMax: y + height },
	};
}

/**
 * Helper to create a triangle path for testing
 */
function createTrianglePath(): GlyphPath {
	return {
		commands: [
			{ type: "M", x: 0, y: 0 },
			{ type: "L", x: 100, y: 0 },
			{ type: "L", x: 50, y: 100 },
			{ type: "Z" },
		],
		bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
	};
}

/**
 * Helper to create a path with curves
 */
function createCurvePath(): GlyphPath {
	return {
		commands: [
			{ type: "M", x: 0, y: 0 },
			{ type: "Q", x1: 50, y1: -20, x: 100, y: 0 },
			{ type: "C", x1: 120, y1: 20, x2: 120, y2: 80, x: 100, y: 100 },
			{ type: "L", x: 0, y: 100 },
			{ type: "Z" },
		],
		bounds: { xMin: 0, yMin: -20, xMax: 120, yMax: 100 },
	};
}

test("obliquePath - shifts x coordinates proportional to y", () => {
	const path = createRectPath(0, 0, 100, 100);
	const slant = 0.2; // ~12 degrees

	const oblique = obliquePath(path, slant);

	// Check that y coordinates remain unchanged
	const yCoords = oblique.commands
		.filter((cmd) => cmd.type === "M" || cmd.type === "L")
		.map((cmd) => (cmd as { y: number }).y);
	expect(yCoords).toEqual([0, 0, 100, 100]);

	// Check that x coordinates are shifted by y * slant
	const moveTo = oblique.commands[0] as { type: "M"; x: number; y: number };
	expect(moveTo.x).toBe(0 + 0 * slant); // (0, 0) -> (0, 0)

	const secondPoint = oblique.commands[1] as {
		type: "L";
		x: number;
		y: number;
	};
	expect(secondPoint.x).toBe(100 + 0 * slant); // (100, 0) -> (100, 0)

	const thirdPoint = oblique.commands[2] as {
		type: "L";
		x: number;
		y: number;
	};
	expect(thirdPoint.x).toBe(100 + 100 * slant); // (100, 100) -> (120, 100)

	const fourthPoint = oblique.commands[3] as {
		type: "L";
		x: number;
		y: number;
	};
	expect(fourthPoint.x).toBe(0 + 100 * slant); // (0, 100) -> (20, 100)
});

test("obliquePath - handles quadratic and cubic curves", () => {
	const path = createCurvePath();
	const slant = 0.3;

	const oblique = obliquePath(path, slant);

	// Check quadratic curve control point
	const quadCmd = oblique.commands[1] as {
		type: "Q";
		x1: number;
		y1: number;
		x: number;
		y: number;
	};
	expect(quadCmd.x1).toBeCloseTo(50 + -20 * slant);
	expect(quadCmd.y1).toBe(-20);
	expect(quadCmd.x).toBeCloseTo(100 + 0 * slant);
	expect(quadCmd.y).toBe(0);

	// Check cubic curve control points
	const cubicCmd = oblique.commands[2] as {
		type: "C";
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		x: number;
		y: number;
	};
	expect(cubicCmd.x1).toBeCloseTo(120 + 20 * slant);
	expect(cubicCmd.y1).toBe(20);
	expect(cubicCmd.x2).toBeCloseTo(120 + 80 * slant);
	expect(cubicCmd.y2).toBe(80);
	expect(cubicCmd.x).toBeCloseTo(100 + 100 * slant);
	expect(cubicCmd.y).toBe(100);

	// Check that Z command is preserved
	const zCmd = oblique.commands[4];
	expect(zCmd?.type).toBe("Z");
});

test("obliquePath - zero slant returns identical path", () => {
	const path = createTrianglePath();
	const oblique = obliquePath(path, 0);

	expect(oblique.commands).toEqual(path.commands);
});

test("emboldenPath - expands bounds", () => {
	const path = createRectPath(0, 0, 100, 100);
	const strength = 5;

	const emboldened = emboldenPath(path, strength);

	// Bounds should be expanded by approximately strength on all sides
	expect(emboldened.bounds).not.toBeNull();
	if (emboldened.bounds) {
		expect(emboldened.bounds.xMin).toBeLessThan(path.bounds!.xMin);
		expect(emboldened.bounds.yMin).toBeLessThan(path.bounds!.yMin);
		expect(emboldened.bounds.xMax).toBeGreaterThan(path.bounds!.xMax);
		expect(emboldened.bounds.yMax).toBeGreaterThan(path.bounds!.yMax);
	}
});

test("emboldenPath - handles simple paths", () => {
	const path = createTrianglePath();
	const strength = 10;

	const emboldened = emboldenPath(path, strength);

	// Should have commands (structure might change but should have content)
	expect(emboldened.commands.length).toBeGreaterThan(0);
	expect(emboldened.commands[0].type).toBe("M");
});

test("emboldenPath - zero strength returns similar path", () => {
	const path = createTrianglePath();
	const emboldened = emboldenPath(path, 0);

	// With zero strength, the path should be very similar
	// (might have slightly different structure due to offsetting, but bounds should match)
	expect(emboldened.bounds).not.toBeNull();
	if (emboldened.bounds && path.bounds) {
		expect(Math.abs(emboldened.bounds.xMin - path.bounds.xMin)).toBeLessThan(1);
		expect(Math.abs(emboldened.bounds.xMax - path.bounds.xMax)).toBeLessThan(1);
		expect(Math.abs(emboldened.bounds.yMin - path.bounds.yMin)).toBeLessThan(1);
		expect(Math.abs(emboldened.bounds.yMax - path.bounds.yMax)).toBeLessThan(1);
	}
});

test("condensePath - changes width but not height", () => {
	const path = createRectPath(0, 0, 100, 100);
	const factor = 0.5; // Make 50% narrower

	const condensed = condensePath(path, factor);

	// Check y coordinates remain unchanged
	const yCoords = condensed.commands
		.filter((cmd) => cmd.type === "M" || cmd.type === "L")
		.map((cmd) => (cmd as { y: number }).y);
	expect(yCoords).toEqual([0, 0, 100, 100]);

	// Check x coordinates are scaled
	const moveTo = condensed.commands[0] as { type: "M"; x: number; y: number };
	expect(moveTo.x).toBe(0 * factor);

	const secondPoint = condensed.commands[1] as {
		type: "L";
		x: number;
		y: number;
	};
	expect(secondPoint.x).toBe(100 * factor);

	// Bounds should reflect the scaling
	expect(condensed.bounds).not.toBeNull();
	if (condensed.bounds && path.bounds) {
		expect(condensed.bounds.xMin).toBe(path.bounds.xMin * factor);
		expect(condensed.bounds.xMax).toBe(path.bounds.xMax * factor);
		expect(condensed.bounds.yMin).toBe(path.bounds.yMin);
		expect(condensed.bounds.yMax).toBe(path.bounds.yMax);
	}
});

test("condensePath - expands with factor > 1", () => {
	const path = createRectPath(10, 20, 50, 80);
	const factor = 1.5; // Make 50% wider

	const expanded = condensePath(path, factor);

	// Check bounds
	if (expanded.bounds && path.bounds) {
		expect(expanded.bounds.xMin).toBe(path.bounds.xMin * factor);
		expect(expanded.bounds.xMax).toBe(path.bounds.xMax * factor);
		expect(expanded.bounds.yMin).toBe(path.bounds.yMin);
		expect(expanded.bounds.yMax).toBe(path.bounds.yMax);
	}
});

test("condensePath - handles curves", () => {
	const path = createCurvePath();
	const factor = 0.75;

	const condensed = condensePath(path, factor);

	// Check quadratic curve
	const quadCmd = condensed.commands[1] as {
		type: "Q";
		x1: number;
		y1: number;
		x: number;
		y: number;
	};
	expect(quadCmd.x1).toBe(50 * factor);
	expect(quadCmd.y1).toBe(-20); // y unchanged
	expect(quadCmd.x).toBe(100 * factor);
	expect(quadCmd.y).toBe(0);

	// Check cubic curve
	const cubicCmd = condensed.commands[2] as {
		type: "C";
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		x: number;
		y: number;
	};
	expect(cubicCmd.x1).toBe(120 * factor);
	expect(cubicCmd.y1).toBe(20); // y unchanged
	expect(cubicCmd.x2).toBe(120 * factor);
	expect(cubicCmd.y2).toBe(80); // y unchanged

	// Check that Z command is preserved
	const zCmd = condensed.commands[4];
	expect(zCmd?.type).toBe("Z");
});

test("transformPath - applies identity matrix correctly", () => {
	const path = createTrianglePath();
	// Identity: [1, 0, 0, 1, 0, 0]
	const transformed = transformPath(path, [1, 0, 0, 1, 0, 0]);

	expect(transformed.commands).toEqual(path.commands);
	expect(transformed.bounds).toEqual(path.bounds);
});

test("transformPath - applies translation", () => {
	const path = createRectPath(0, 0, 100, 100);
	// Translate by (50, 30): [1, 0, 0, 1, 50, 30]
	const translated = transformPath(path, [1, 0, 0, 1, 50, 30]);

	// Check first point
	const moveTo = translated.commands[0] as { type: "M"; x: number; y: number };
	expect(moveTo.x).toBe(50);
	expect(moveTo.y).toBe(30);

	// Check bounds
	if (translated.bounds && path.bounds) {
		expect(translated.bounds.xMin).toBe(path.bounds.xMin + 50);
		expect(translated.bounds.xMax).toBe(path.bounds.xMax + 50);
		expect(translated.bounds.yMin).toBe(path.bounds.yMin + 30);
		expect(translated.bounds.yMax).toBe(path.bounds.yMax + 30);
	}
});

test("transformPath - applies scaling", () => {
	const path = createRectPath(0, 0, 100, 100);
	// Scale by 2x, 3y: [2, 0, 0, 3, 0, 0]
	const scaled = transformPath(path, [2, 0, 0, 3, 0, 0]);

	// Check second point (100, 0) -> (200, 0)
	const secondPoint = scaled.commands[1] as {
		type: "L";
		x: number;
		y: number;
	};
	expect(secondPoint.x).toBe(200);
	expect(secondPoint.y).toBe(0);

	// Check third point (100, 100) -> (200, 300)
	const thirdPoint = scaled.commands[2] as {
		type: "L";
		x: number;
		y: number;
	};
	expect(thirdPoint.x).toBe(200);
	expect(thirdPoint.y).toBe(300);
});

test("transformPath - applies rotation (90 degrees)", () => {
	const path: GlyphPath = {
		commands: [
			{ type: "M", x: 100, y: 0 },
			{ type: "L", x: 0, y: 0 },
			{ type: "Z" },
		],
		bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 0 },
	};

	// 90 degree counter-clockwise rotation: [0, 1, -1, 0, 0, 0]
	const rotated = transformPath(path, [0, 1, -1, 0, 0, 0]);

	const moveTo = rotated.commands[0] as { type: "M"; x: number; y: number };
	expect(moveTo.x).toBeCloseTo(0);
	expect(moveTo.y).toBeCloseTo(100);

	const lineTo = rotated.commands[1] as { type: "L"; x: number; y: number };
	expect(lineTo.x).toBeCloseTo(0);
	expect(lineTo.y).toBeCloseTo(0);
});

test("transformPath - handles curves", () => {
	const path = createCurvePath();
	// Scale by 0.5 and translate by (10, 20)
	const transformed = transformPath(path, [0.5, 0, 0, 0.5, 10, 20]);

	// Check quadratic curve
	const quadCmd = transformed.commands[1] as {
		type: "Q";
		x1: number;
		y1: number;
		x: number;
		y: number;
	};
	expect(quadCmd.x1).toBe(50 * 0.5 + 10);
	expect(quadCmd.y1).toBe(-20 * 0.5 + 20);
	expect(quadCmd.x).toBe(100 * 0.5 + 10);
	expect(quadCmd.y).toBe(0 * 0.5 + 20);

	// Check cubic curve
	const cubicCmd = transformed.commands[2] as {
		type: "C";
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		x: number;
		y: number;
	};
	expect(cubicCmd.x1).toBe(120 * 0.5 + 10);
	expect(cubicCmd.y1).toBe(20 * 0.5 + 20);

	// Check that Z command is preserved
	const zCmd = transformed.commands[4];
	expect(zCmd?.type).toBe("Z");
});

test("composition of transforms - oblique then condense", () => {
	const path = createRectPath(0, 0, 100, 100);

	// First apply oblique
	const oblique = obliquePath(path, 0.2);
	// Then condense
	const final = condensePath(oblique, 0.8);

	// The combination should apply both effects
	const thirdPoint = final.commands[2] as {
		type: "L";
		x: number;
		y: number;
	};
	// Original (100, 100) -> oblique (120, 100) -> condense (96, 100)
	expect(thirdPoint.x).toBeCloseTo((100 + 100 * 0.2) * 0.8);
	expect(thirdPoint.y).toBe(100);
});

test("composition of transforms - transform then oblique", () => {
	const path = createRectPath(0, 0, 100, 100);

	// First scale by 2
	const scaled = transformPath(path, [2, 0, 0, 2, 0, 0]);
	// Then apply oblique
	const final = obliquePath(scaled, 0.1);

	// Third point: (100, 100) -> scale (200, 200) -> oblique (220, 200)
	const thirdPoint = final.commands[2] as {
		type: "L";
		x: number;
		y: number;
	};
	expect(thirdPoint.x).toBeCloseTo(200 + 200 * 0.1);
	expect(thirdPoint.y).toBe(200);
});

test("emboldenPath - handles negative strength (thinning)", () => {
	const path = createTrianglePath();
	const strength = -5;

	const thinned = emboldenPath(path, strength);

	// Should have commands and bounds
	expect(thinned.commands.length).toBeGreaterThan(0);
	expect(thinned.bounds).not.toBeNull();

	// Bounds should be contracted
	if (thinned.bounds && path.bounds) {
		expect(thinned.bounds.xMin).toBeGreaterThan(path.bounds.xMin);
		expect(thinned.bounds.xMax).toBeLessThan(path.bounds.xMax);
	}
});

test("emboldenPath - handles quadratic curves", () => {
	const path: GlyphPath = {
		commands: [
			{ type: "M", x: 0, y: 0 },
			{ type: "Q", x1: 50, y1: -20, x: 100, y: 0 },
			{ type: "L", x: 100, y: 100 },
			{ type: "L", x: 0, y: 100 },
			{ type: "Z" },
		],
		bounds: { xMin: 0, yMin: -20, xMax: 100, yMax: 100 },
	};

	const emboldened = emboldenPath(path, 5);

	// Should have commands and bounds
	expect(emboldened.commands.length).toBeGreaterThan(0);
	expect(emboldened.bounds).not.toBeNull();
});

test("emboldenPath - handles cubic curves", () => {
	const path: GlyphPath = {
		commands: [
			{ type: "M", x: 0, y: 0 },
			{ type: "C", x1: 20, y1: -10, x2: 80, y2: -10, x: 100, y: 0 },
			{ type: "L", x: 100, y: 100 },
			{ type: "L", x: 0, y: 100 },
			{ type: "Z" },
		],
		bounds: { xMin: 0, yMin: -10, xMax: 100, yMax: 100 },
	};

	const emboldened = emboldenPath(path, 5);

	// Should have commands and bounds
	expect(emboldened.commands.length).toBeGreaterThan(0);
	expect(emboldened.bounds).not.toBeNull();
});

test("emboldenPath - handles multiple contours", () => {
	const path: GlyphPath = {
		commands: [
			// First contour (outer)
			{ type: "M", x: 0, y: 0 },
			{ type: "L", x: 100, y: 0 },
			{ type: "L", x: 100, y: 100 },
			{ type: "L", x: 0, y: 100 },
			{ type: "Z" },
			// Second contour (inner hole)
			{ type: "M", x: 25, y: 25 },
			{ type: "L", x: 75, y: 25 },
			{ type: "L", x: 75, y: 75 },
			{ type: "L", x: 25, y: 75 },
			{ type: "Z" },
		],
		bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
	};

	const emboldened = emboldenPath(path, 5);

	// Should have commands and bounds
	expect(emboldened.commands.length).toBeGreaterThan(0);
	expect(emboldened.bounds).not.toBeNull();
});

test("emboldenPath - handles path without closing Z", () => {
	const path: GlyphPath = {
		commands: [
			{ type: "M", x: 0, y: 0 },
			{ type: "L", x: 100, y: 0 },
			{ type: "L", x: 50, y: 100 },
		],
		bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
	};

	const emboldened = emboldenPath(path, 5);

	// Should still produce output even without Z command
	expect(emboldened.commands.length).toBeGreaterThan(0);
});

test("emboldenPath - handles degenerate edges (zero-length)", () => {
	const path: GlyphPath = {
		commands: [
			{ type: "M", x: 0, y: 0 },
			{ type: "L", x: 100, y: 0 },
			{ type: "L", x: 100, y: 0 }, // Duplicate point (zero-length edge)
			{ type: "L", x: 100, y: 100 },
			{ type: "L", x: 0, y: 100 },
			{ type: "Z" },
		],
		bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
	};

	const emboldened = emboldenPath(path, 5);

	// Should handle degenerate edges gracefully
	expect(emboldened.commands.length).toBeGreaterThan(0);
	expect(emboldened.bounds).not.toBeNull();
});

test("emboldenPath - handles very small contours", () => {
	const path: GlyphPath = {
		commands: [
			{ type: "M", x: 0, y: 0 },
			{ type: "L", x: 1, y: 0 },
			{ type: "Z" },
		],
		bounds: { xMin: 0, yMin: 0, xMax: 1, yMax: 0 },
	};

	const emboldened = emboldenPath(path, 5);

	// Small contours (< 3 points) should be skipped but still return valid structure
	expect(emboldened.commands).toBeDefined();
	expect(emboldened.bounds).toBeDefined();
});

test("emboldenPath - handles multiple contours without Z between them", () => {
	const path: GlyphPath = {
		commands: [
			// First contour (no Z at end)
			{ type: "M", x: 0, y: 0 },
			{ type: "L", x: 50, y: 0 },
			{ type: "L", x: 50, y: 50 },
			{ type: "L", x: 0, y: 50 },
			// Second contour starts immediately with M
			{ type: "M", x: 60, y: 60 },
			{ type: "L", x: 100, y: 60 },
			{ type: "L", x: 100, y: 100 },
			{ type: "L", x: 60, y: 100 },
			{ type: "Z" },
		],
		bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
	};

	const emboldened = emboldenPath(path, 5);

	// Should handle multiple contours even when they don't all have Z
	expect(emboldened.commands.length).toBeGreaterThan(0);
	expect(emboldened.bounds).not.toBeNull();
});

test("emboldenPath - handles malformed path with Q without previous point", () => {
	const path: GlyphPath = {
		commands: [
			{ type: "M", x: 0, y: 0 },
			{ type: "Z" },
			// Q command without a current point (after Z cleared contour)
			{ type: "Q", x1: 50, y1: 50, x: 100, y: 100 },
		],
		bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
	};

	const emboldened = emboldenPath(path, 5);

	// Should handle malformed paths gracefully
	expect(emboldened.commands).toBeDefined();
});

test("emboldenPath - handles malformed path with C without previous point", () => {
	const path: GlyphPath = {
		commands: [
			{ type: "M", x: 0, y: 0 },
			{ type: "Z" },
			// C command without a current point (after Z cleared contour)
			{ type: "C", x1: 30, y1: 30, x2: 70, y2: 70, x: 100, y: 100 },
		],
		bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
	};

	const emboldened = emboldenPath(path, 5);

	// Should handle malformed paths gracefully
	expect(emboldened.commands).toBeDefined();
});

test("obliquePath - handles empty path", () => {
	const path: GlyphPath = {
		commands: [],
		bounds: null,
	};

	const oblique = obliquePath(path, 0.2);

	// Should handle empty paths gracefully
	expect(oblique.commands).toEqual([]);
	expect(oblique.bounds).toBeNull();
});

test("transformPath - handles empty path", () => {
	const path: GlyphPath = {
		commands: [],
		bounds: null,
	};

	const transformed = transformPath(path, [1, 0, 0, 1, 0, 0]);

	// Should handle empty paths gracefully
	expect(transformed.commands).toEqual([]);
	expect(transformed.bounds).toBeNull();
});

test("condensePath - handles empty path", () => {
	const path: GlyphPath = {
		commands: [],
		bounds: null,
	};

	const condensed = condensePath(path, 0.5);

	// Should handle empty paths gracefully
	expect(condensed.commands).toEqual([]);
	expect(condensed.bounds).toBeNull();
});

test("obliquePath - handles path with only Z commands", () => {
	const path: GlyphPath = {
		commands: [{ type: "Z" }, { type: "Z" }],
		bounds: null,
	};

	const oblique = obliquePath(path, 0.2);

	// Should handle paths with only Z commands
	expect(oblique.commands.length).toBe(2);
	expect(oblique.commands[0]?.type).toBe("Z");
	expect(oblique.commands[1]?.type).toBe("Z");
});

test("emboldenPath - handles empty path", () => {
	const path: GlyphPath = {
		commands: [],
		bounds: null,
	};

	const emboldened = emboldenPath(path, 5);

	// Should handle empty paths gracefully
	expect(emboldened.commands).toEqual([]);
	expect(emboldened.bounds).toBeNull();
});

test("emboldenPath - handles sharp angles (near 180 degrees)", () => {
	// Create a path with a very sharp angle (almost 180 degrees)
	// This will trigger the dot <= -0.999 branch in offsetPolygon
	const path: GlyphPath = {
		commands: [
			{ type: "M", x: 0, y: 0 },
			{ type: "L", x: 100, y: 0 },
			{ type: "L", x: 100, y: 1 }, // Very slight turn
			{ type: "L", x: 0, y: 1 }, // Back in almost opposite direction
			{ type: "Z" },
		],
		bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 1 },
	};

	const emboldened = emboldenPath(path, 5);

	// Should handle very sharp angles gracefully
	expect(emboldened.commands.length).toBeGreaterThan(0);
	expect(emboldened.bounds).not.toBeNull();
});

test("emboldenPath - handles very small normal length", () => {
	// Create a path where the average normal might be very small
	// This happens when adjacent edges are parallel or nearly so
	const path: GlyphPath = {
		commands: [
			{ type: "M", x: 0, y: 0 },
			{ type: "L", x: 50, y: 0 },
			{ type: "L", x: 100, y: 0 }, // Collinear points (parallel edges)
			{ type: "L", x: 100, y: 100 },
			{ type: "L", x: 0, y: 100 },
			{ type: "Z" },
		],
		bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
	};

	const emboldened = emboldenPath(path, 5);

	// Should handle collinear points gracefully
	expect(emboldened.commands.length).toBeGreaterThan(0);
	expect(emboldened.bounds).not.toBeNull();
});
