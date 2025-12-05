/**
 * Outline Transform Operations
 *
 * Provides geometric transformations for glyph outlines:
 * - 90° rotation
 * - Power-of-2 scaling
 * - 2D affine transforms (translate, rotate, scale, shear)
 * - 3D perspective transforms
 * - Bounding box computation
 */

import type { GlyphPath, PathCommand } from "./path.ts";

/**
 * 2D affine transformation matrix [a, b, c, d, tx, ty]
 * Transforms point (x, y) to:
 *   x' = a*x + c*y + tx
 *   y' = b*x + d*y + ty
 */
export type Matrix2D = [number, number, number, number, number, number];

/**
 * 3x3 transformation matrix for 2D homogeneous coordinates
 * | m00 m01 m02 |   | x |   | x' |
 * | m10 m11 m12 | × | y | = | y' |
 * | m20 m21 m22 |   | 1 |   | w  |
 *
 * Final coordinates: (x'/w, y'/w)
 */
export type Matrix3x3 = [
	[number, number, number],
	[number, number, number],
	[number, number, number],
];

/**
 * Axis-aligned bounding box
 */
export interface BoundingBox {
	xMin: number;
	yMin: number;
	xMax: number;
	yMax: number;
}

/**
 * Control box (bounding box of control points, not tight bounds)
 */
export interface ControlBox extends BoundingBox {}

/**
 * Create identity 2D matrix
 */
export function identity2D(): Matrix2D {
	return [1, 0, 0, 1, 0, 0];
}

/**
 * Create identity 3x3 matrix
 */
export function identity3x3(): Matrix3x3 {
	return [
		[1, 0, 0],
		[0, 1, 0],
		[0, 0, 1],
	];
}

/**
 * Create translation matrix
 */
export function translate2D(tx: number, ty: number): Matrix2D {
	return [1, 0, 0, 1, tx, ty];
}

/**
 * Create scale matrix
 */
export function scale2D(sx: number, sy: number): Matrix2D {
	return [sx, 0, 0, sy, 0, 0];
}

/**
 * Create rotation matrix (angle in radians)
 */
export function rotate2D(angle: number): Matrix2D {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return [cos, sin, -sin, cos, 0, 0];
}

/**
 * Create shear/skew matrix
 */
export function shear2D(shearX: number, shearY: number): Matrix2D {
	return [1, shearY, shearX, 1, 0, 0];
}

/**
 * Multiply two 2D matrices: result = a × b
 */
export function multiply2D(a: Matrix2D, b: Matrix2D): Matrix2D {
	return [
		a[0] * b[0] + a[2] * b[1],
		a[1] * b[0] + a[3] * b[1],
		a[0] * b[2] + a[2] * b[3],
		a[1] * b[2] + a[3] * b[3],
		a[0] * b[4] + a[2] * b[5] + a[4],
		a[1] * b[4] + a[3] * b[5] + a[5],
	];
}

/**
 * Multiply two 3x3 matrices: result = a × b
 */
export function multiply3x3(a: Matrix3x3, b: Matrix3x3): Matrix3x3 {
	const result: Matrix3x3 = [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0],
	];
	for (let i = 0; i < 3; i++) {
		for (let j = 0; j < 3; j++) {
			result[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
		}
	}
	return result;
}

/**
 * Transform a point using 2D matrix
 */
export function transformPoint2D(
	x: number,
	y: number,
	m: Matrix2D,
): { x: number; y: number } {
	return {
		x: m[0] * x + m[2] * y + m[4],
		y: m[1] * x + m[3] * y + m[5],
	};
}

/**
 * Transform a point using 3x3 matrix (with perspective division)
 */
export function transformPoint3x3(
	x: number,
	y: number,
	m: Matrix3x3,
): { x: number; y: number } {
	const w = m[2][0] * x + m[2][1] * y + m[2][2];
	if (Math.abs(w) < 1e-10) {
		// Point at infinity
		return { x: 0, y: 0 };
	}
	return {
		x: (m[0][0] * x + m[0][1] * y + m[0][2]) / w,
		y: (m[1][0] * x + m[1][1] * y + m[1][2]) / w,
	};
}

/**
 * Rotate outline by 90 degrees counter-clockwise around origin
 * Optionally apply offset after rotation
 */
export function rotateOutline90(
	path: GlyphPath,
	offsetX: number = 0,
	offsetY: number = 0,
): GlyphPath {
	// 90° CCW rotation: (x, y) -> (-y, x)
	const commands = path.commands.map((cmd): PathCommand => {
		switch (cmd.type) {
			case "M":
			case "L":
				return {
					type: cmd.type,
					x: -cmd.y + offsetX,
					y: cmd.x + offsetY,
				};
			case "Q":
				return {
					type: "Q",
					x1: -cmd.y1 + offsetX,
					y1: cmd.x1 + offsetY,
					x: -cmd.y + offsetX,
					y: cmd.x + offsetY,
				};
			case "C":
				return {
					type: "C",
					x1: -cmd.y1 + offsetX,
					y1: cmd.x1 + offsetY,
					x2: -cmd.y2 + offsetX,
					y2: cmd.x2 + offsetY,
					x: -cmd.y + offsetX,
					y: cmd.x + offsetY,
				};
			case "Z":
				return { type: "Z" };
			default:
				return cmd;
		}
	});

	// Rotate bounds
	let bounds: BoundingBox | null = null;
	if (path.bounds) {
		const b = path.bounds;
		bounds = {
			xMin: -b.yMax + offsetX,
			yMin: b.xMin + offsetY,
			xMax: -b.yMin + offsetX,
			yMax: b.xMax + offsetY,
		};
		// Normalize (ensure min < max)
		if (bounds.xMin > bounds.xMax) {
			[bounds.xMin, bounds.xMax] = [bounds.xMax, bounds.xMin];
		}
		if (bounds.yMin > bounds.yMax) {
			[bounds.yMin, bounds.yMax] = [bounds.yMax, bounds.yMin];
		}
	}

	return { commands, bounds, flags: path.flags };
}

/**
 * Scale outline by power of 2
 * scaleOrdX/Y: shift amount (positive = enlarge, negative = shrink)
 * e.g., scaleOrdX=1 means multiply x by 2, scaleOrdX=-1 means divide by 2
 */
export function scaleOutlinePow2(
	path: GlyphPath,
	scaleOrdX: number,
	scaleOrdY: number,
): GlyphPath {
	const scaleX = scaleOrdX >= 0 ? 1 << scaleOrdX : 1 / (1 << -scaleOrdX);
	const scaleY = scaleOrdY >= 0 ? 1 << scaleOrdY : 1 / (1 << -scaleOrdY);

	const commands = path.commands.map((cmd): PathCommand => {
		switch (cmd.type) {
			case "M":
			case "L":
				return {
					type: cmd.type,
					x: cmd.x * scaleX,
					y: cmd.y * scaleY,
				};
			case "Q":
				return {
					type: "Q",
					x1: cmd.x1 * scaleX,
					y1: cmd.y1 * scaleY,
					x: cmd.x * scaleX,
					y: cmd.y * scaleY,
				};
			case "C":
				return {
					type: "C",
					x1: cmd.x1 * scaleX,
					y1: cmd.y1 * scaleY,
					x2: cmd.x2 * scaleX,
					y2: cmd.y2 * scaleY,
					x: cmd.x * scaleX,
					y: cmd.y * scaleY,
				};
			case "Z":
				return { type: "Z" };
			default:
				return cmd;
		}
	});

	let bounds: BoundingBox | null = null;
	if (path.bounds) {
		bounds = {
			xMin: path.bounds.xMin * scaleX,
			yMin: path.bounds.yMin * scaleY,
			xMax: path.bounds.xMax * scaleX,
			yMax: path.bounds.yMax * scaleY,
		};
	}

	return { commands, bounds, flags: path.flags };
}

/**
 * Apply 2D affine transformation to outline
 */
export function transformOutline2D(path: GlyphPath, m: Matrix2D): GlyphPath {
	const commands = path.commands.map((cmd): PathCommand => {
		switch (cmd.type) {
			case "M":
			case "L": {
				const p = transformPoint2D(cmd.x, cmd.y, m);
				return { type: cmd.type, x: p.x, y: p.y };
			}
			case "Q": {
				const p1 = transformPoint2D(cmd.x1, cmd.y1, m);
				const p = transformPoint2D(cmd.x, cmd.y, m);
				return { type: "Q", x1: p1.x, y1: p1.y, x: p.x, y: p.y };
			}
			case "C": {
				const cp1 = transformPoint2D(cmd.x1, cmd.y1, m);
				const cp2 = transformPoint2D(cmd.x2, cmd.y2, m);
				const p = transformPoint2D(cmd.x, cmd.y, m);
				return {
					type: "C",
					x1: cp1.x,
					y1: cp1.y,
					x2: cp2.x,
					y2: cp2.y,
					x: p.x,
					y: p.y,
				};
			}
			case "Z":
				return { type: "Z" };
			default:
				return cmd;
		}
	});

	// Compute new bounds by transforming corners
	let bounds: BoundingBox | null = null;
	if (path.bounds) {
		const b = path.bounds;
		const corners = [
			transformPoint2D(b.xMin, b.yMin, m),
			transformPoint2D(b.xMax, b.yMin, m),
			transformPoint2D(b.xMin, b.yMax, m),
			transformPoint2D(b.xMax, b.yMax, m),
		];
		bounds = {
			xMin: Math.min(...corners.map((c) => c.x)),
			yMin: Math.min(...corners.map((c) => c.y)),
			xMax: Math.max(...corners.map((c) => c.x)),
			yMax: Math.max(...corners.map((c) => c.y)),
		};
	}

	return { commands, bounds, flags: path.flags };
}

/**
 * Apply 3D perspective transformation to outline
 * Uses homogeneous coordinates for perspective projection
 */
export function transformOutline3D(path: GlyphPath, m: Matrix3x3): GlyphPath {
	const commands = path.commands.map((cmd): PathCommand => {
		switch (cmd.type) {
			case "M":
			case "L": {
				const p = transformPoint3x3(cmd.x, cmd.y, m);
				return { type: cmd.type, x: p.x, y: p.y };
			}
			case "Q": {
				// For perspective transforms, we need to subdivide curves
				// because Bézier curves don't preserve under perspective
				// For now, transform control points (approximation)
				const p1 = transformPoint3x3(cmd.x1, cmd.y1, m);
				const p = transformPoint3x3(cmd.x, cmd.y, m);
				return { type: "Q", x1: p1.x, y1: p1.y, x: p.x, y: p.y };
			}
			case "C": {
				const p1 = transformPoint3x3(cmd.x1, cmd.y1, m);
				const p2 = transformPoint3x3(cmd.x2, cmd.y2, m);
				const p = transformPoint3x3(cmd.x, cmd.y, m);
				return {
					type: "C",
					x1: p1.x,
					y1: p1.y,
					x2: p2.x,
					y2: p2.y,
					x: p.x,
					y: p.y,
				};
			}
			case "Z":
				return { type: "Z" };
			default:
				return cmd;
		}
	});

	// Compute new bounds
	let bounds: BoundingBox | null = null;
	if (path.bounds) {
		const b = path.bounds;
		const corners = [
			transformPoint3x3(b.xMin, b.yMin, m),
			transformPoint3x3(b.xMax, b.yMin, m),
			transformPoint3x3(b.xMin, b.yMax, m),
			transformPoint3x3(b.xMax, b.yMax, m),
		];
		bounds = {
			xMin: Math.min(...corners.map((c) => c.x)),
			yMin: Math.min(...corners.map((c) => c.y)),
			xMax: Math.max(...corners.map((c) => c.x)),
			yMax: Math.max(...corners.map((c) => c.y)),
		};
	}

	return { commands, bounds, flags: path.flags };
}

/**
 * Compute control box (bounding box of all control points)
 * This is faster than computing tight bounds but may be larger
 */
export function computeControlBox(path: GlyphPath): ControlBox {
	let xMin = Infinity;
	let yMin = Infinity;
	let xMax = -Infinity;
	let yMax = -Infinity;

	for (const cmd of path.commands) {
		switch (cmd.type) {
			case "M":
			case "L":
				xMin = Math.min(xMin, cmd.x);
				yMin = Math.min(yMin, cmd.y);
				xMax = Math.max(xMax, cmd.x);
				yMax = Math.max(yMax, cmd.y);
				break;
			case "Q":
				xMin = Math.min(xMin, cmd.x1, cmd.x);
				yMin = Math.min(yMin, cmd.y1, cmd.y);
				xMax = Math.max(xMax, cmd.x1, cmd.x);
				yMax = Math.max(yMax, cmd.y1, cmd.y);
				break;
			case "C":
				xMin = Math.min(xMin, cmd.x1, cmd.x2, cmd.x);
				yMin = Math.min(yMin, cmd.y1, cmd.y2, cmd.y);
				xMax = Math.max(xMax, cmd.x1, cmd.x2, cmd.x);
				yMax = Math.max(yMax, cmd.y1, cmd.y2, cmd.y);
				break;
		}
	}

	if (!Number.isFinite(xMin)) {
		return { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
	}

	return { xMin, yMin, xMax, yMax };
}

/**
 * Find extrema of a quadratic Bézier curve
 * Returns t values in [0, 1] where extrema occur
 */
function quadraticExtrema(p0: number, p1: number, p2: number): number[] {
	// Derivative: 2(1-t)(p1-p0) + 2t(p2-p1) = 0
	// => t = (p0-p1) / (p0 - 2p1 + p2)
	const denom = p0 - 2 * p1 + p2;
	if (Math.abs(denom) < 1e-10) return [];
	const t = (p0 - p1) / denom;
	if (t > 0 && t < 1) return [t];
	return [];
}

/**
 * Find extrema of a cubic Bézier curve
 * Returns t values in [0, 1] where extrema occur
 */
function cubicExtrema(
	p0: number,
	p1: number,
	p2: number,
	p3: number,
): number[] {
	// Derivative coefficients
	const a = -p0 + 3 * p1 - 3 * p2 + p3;
	const b = 2 * (p0 - 2 * p1 + p2);
	const c = -p0 + p1;

	const result: number[] = [];

	if (Math.abs(a) < 1e-10) {
		// Linear: b*t + c = 0
		if (Math.abs(b) > 1e-10) {
			const t = -c / b;
			if (t > 0 && t < 1) result.push(t);
		}
	} else {
		// Quadratic: a*t² + b*t + c = 0
		const disc = b * b - 4 * a * c;
		if (disc >= 0) {
			const sqrtDisc = Math.sqrt(disc);
			const t1 = (-b + sqrtDisc) / (2 * a);
			const t2 = (-b - sqrtDisc) / (2 * a);
			if (t1 > 0 && t1 < 1) result.push(t1);
			if (t2 > 0 && t2 < 1) result.push(t2);
		}
	}

	return result;
}

/**
 * Evaluate quadratic Bézier at t
 */
function evalQuadratic(p0: number, p1: number, p2: number, t: number): number {
	const ti = 1 - t;
	return ti * ti * p0 + 2 * ti * t * p1 + t * t * p2;
}

/**
 * Evaluate cubic Bézier at t
 */
function evalCubic(
	p0: number,
	p1: number,
	p2: number,
	p3: number,
	t: number,
): number {
	const ti = 1 - t;
	return (
		ti * ti * ti * p0 +
		3 * ti * ti * t * p1 +
		3 * ti * t * t * p2 +
		t * t * t * p3
	);
}

/**
 * Compute tight bounding box (exact bounds considering curve extrema)
 */
export function computeTightBounds(path: GlyphPath): BoundingBox {
	let xMin = Infinity;
	let yMin = Infinity;
	let xMax = -Infinity;
	let yMax = -Infinity;

	let curX = 0;
	let curY = 0;

	for (const cmd of path.commands) {
		switch (cmd.type) {
			case "M":
				curX = cmd.x;
				curY = cmd.y;
				xMin = Math.min(xMin, curX);
				yMin = Math.min(yMin, curY);
				xMax = Math.max(xMax, curX);
				yMax = Math.max(yMax, curY);
				break;
			case "L":
				curX = cmd.x;
				curY = cmd.y;
				xMin = Math.min(xMin, curX);
				yMin = Math.min(yMin, curY);
				xMax = Math.max(xMax, curX);
				yMax = Math.max(yMax, curY);
				break;
			case "Q": {
				// Endpoints
				xMin = Math.min(xMin, cmd.x);
				yMin = Math.min(yMin, cmd.y);
				xMax = Math.max(xMax, cmd.x);
				yMax = Math.max(yMax, cmd.y);
				// Extrema
				for (const t of quadraticExtrema(curX, cmd.x1, cmd.x)) {
					const x = evalQuadratic(curX, cmd.x1, cmd.x, t);
					xMin = Math.min(xMin, x);
					xMax = Math.max(xMax, x);
				}
				for (const t of quadraticExtrema(curY, cmd.y1, cmd.y)) {
					const y = evalQuadratic(curY, cmd.y1, cmd.y, t);
					yMin = Math.min(yMin, y);
					yMax = Math.max(yMax, y);
				}
				curX = cmd.x;
				curY = cmd.y;
				break;
			}
			case "C": {
				// Endpoints
				xMin = Math.min(xMin, cmd.x);
				yMin = Math.min(yMin, cmd.y);
				xMax = Math.max(xMax, cmd.x);
				yMax = Math.max(yMax, cmd.y);
				// Extrema
				for (const t of cubicExtrema(curX, cmd.x1, cmd.x2, cmd.x)) {
					const x = evalCubic(curX, cmd.x1, cmd.x2, cmd.x, t);
					xMin = Math.min(xMin, x);
					xMax = Math.max(xMax, x);
				}
				for (const t of cubicExtrema(curY, cmd.y1, cmd.y2, cmd.y)) {
					const y = evalCubic(curY, cmd.y1, cmd.y2, cmd.y, t);
					yMin = Math.min(yMin, y);
					yMax = Math.max(yMax, y);
				}
				curX = cmd.x;
				curY = cmd.y;
				break;
			}
		}
	}

	if (!Number.isFinite(xMin)) {
		return { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
	}

	return { xMin, yMin, xMax, yMax };
}

/**
 * Update control box with transformed outline
 * Used for finding minimum X after 3D transform (like libass)
 */
export function updateMinTransformedX(
	path: GlyphPath,
	m: Matrix3x3,
	currentMinX: number,
): number {
	let minX = currentMinX;

	for (const cmd of path.commands) {
		switch (cmd.type) {
			case "M":
			case "L": {
				const p = transformPoint3x3(cmd.x, cmd.y, m);
				minX = Math.min(minX, p.x);
				break;
			}
			case "Q": {
				const p1 = transformPoint3x3(cmd.x1, cmd.y1, m);
				const p = transformPoint3x3(cmd.x, cmd.y, m);
				minX = Math.min(minX, p1.x, p.x);
				break;
			}
			case "C": {
				const p1 = transformPoint3x3(cmd.x1, cmd.y1, m);
				const p2 = transformPoint3x3(cmd.x2, cmd.y2, m);
				const p = transformPoint3x3(cmd.x, cmd.y, m);
				minX = Math.min(minX, p1.x, p2.x, p.x);
				break;
			}
		}
	}

	return minX;
}

/**
 * Translate outline by offset
 */
export function translateOutline(
	path: GlyphPath,
	dx: number,
	dy: number,
): GlyphPath {
	return transformOutline2D(path, translate2D(dx, dy));
}

/**
 * Scale outline uniformly
 */
export function scaleOutline(
	path: GlyphPath,
	sx: number,
	sy: number = sx,
): GlyphPath {
	return transformOutline2D(path, scale2D(sx, sy));
}

/**
 * Rotate outline by angle (in radians) around origin
 */
export function rotateOutline(path: GlyphPath, angle: number): GlyphPath {
	return transformOutline2D(path, rotate2D(angle));
}

/**
 * Apply italic/oblique shear to outline
 * @param angle Italic angle in degrees (typically 12-15 for italic)
 */
export function italicizeOutline(path: GlyphPath, angle: number): GlyphPath {
	const shearX = Math.tan((angle * Math.PI) / 180);
	return transformOutline2D(path, shear2D(shearX, 0));
}

/**
 * Create 3x3 perspective matrix
 * @param vanishingPointX X coordinate of vanishing point
 * @param vanishingPointY Y coordinate of vanishing point
 * @param strength Perspective strength (0 = none, larger = more perspective)
 */
export function perspectiveMatrix(
	vanishingPointX: number,
	vanishingPointY: number,
	strength: number,
): Matrix3x3 {
	return [
		[1, 0, -vanishingPointX * strength],
		[0, 1, -vanishingPointY * strength],
		[0, 0, 1],
	];
}

/**
 * Combine multiple paths into one
 */
export function combinePaths(paths: GlyphPath[]): GlyphPath {
	const commands: PathCommand[] = [];
	let xMin = Infinity;
	let yMin = Infinity;
	let xMax = -Infinity;
	let yMax = -Infinity;

	for (const path of paths) {
		commands.push(...path.commands);
		if (path.bounds) {
			xMin = Math.min(xMin, path.bounds.xMin);
			yMin = Math.min(yMin, path.bounds.yMin);
			xMax = Math.max(xMax, path.bounds.xMax);
			yMax = Math.max(yMax, path.bounds.yMax);
		}
	}

	const bounds = Number.isFinite(xMin) ? { xMin, yMin, xMax, yMax } : null;
	return { commands, bounds };
}

/**
 * Clone a path
 */
export function clonePath(path: GlyphPath): GlyphPath {
	return {
		commands: path.commands.map((cmd) => ({ ...cmd })),
		bounds: path.bounds ? { ...path.bounds } : null,
		flags: path.flags,
	};
}
