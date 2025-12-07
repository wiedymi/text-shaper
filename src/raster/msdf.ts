/**
 * Multi-channel Signed Distance Field (MSDF) rasterizer
 *
 * MSDF uses three channels (RGB) to encode distance information,
 * allowing sharp corners to be preserved when scaling.
 *
 * Algorithm:
 * 1. Decompose glyph outline into edges (lines, quadratics, cubics)
 * 2. Color edges so adjacent edges at sharp corners have different colors
 * 3. For each pixel, compute signed distance to nearest edge of each color
 * 4. Store R, G, B distances in output bitmap
 * 5. Shader reconstructs using: median(r, g, b)
 *
 * Reference: https://github.com/Chlumsky/msdfgen
 */

import type { Font } from "../font/font.ts";
import type { GlyphPath } from "../render/path.ts";
import { getGlyphPath } from "../render/path.ts";
import {
	type Bitmap,
	createBitmap,
	type GlyphAtlas,
	type GlyphMetrics,
	type MsdfAtlasOptions,
	PixelMode,
} from "./types.ts";

/**
 * A 2D point
 */
export interface Point {
	x: number;
	y: number;
}

/**
 * Edge color channels for MSDF
 * 0 = red, 1 = green, 2 = blue
 */
export type EdgeColor = 0 | 1 | 2;

/**
 * Bounding box for edge culling
 */
interface EdgeBounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

/**
 * An edge with color assignment and bounding box
 */
export type MsdfEdge =
	| { type: "line"; p0: Point; p1: Point; color: EdgeColor } & EdgeBounds
	| { type: "quadratic"; p0: Point; p1: Point; p2: Point; color: EdgeColor } & EdgeBounds
	| {
			type: "cubic";
			p0: Point;
			p1: Point;
			p2: Point;
			p3: Point;
			color: EdgeColor;
	  } & EdgeBounds;

/**
 * Signed distance result with parameter t
 */
export interface SignedDistanceResult {
	distance: number;
	t: number; // Parameter on curve [0, 1] of closest point
}

/**
 * Options for MSDF rendering
 */
export interface MsdfOptions {
	/** Width in pixels */
	width: number;
	/** Height in pixels */
	height: number;
	/** Scale factor (font units to pixels) */
	scale: number;
	/** X offset in pixels */
	offsetX?: number;
	/** Y offset in pixels */
	offsetY?: number;
	/** Flip Y axis (font coords are Y-up, bitmap is Y-down) */
	flipY?: boolean;
	/** Spread/radius - how far the distance field extends in pixels (default: 8) */
	spread?: number;
}

/**
 * Return the median of three numbers
 */
export function median(a: number, b: number, c: number): number {
	return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
}

/**
 * Compute signed distance from point to line segment
 */
export function signedDistanceToLine(
	px: number,
	py: number,
	p0: Point,
	p1: Point,
): SignedDistanceResult {
	const dx = p1.x - p0.x;
	const dy = p1.y - p0.y;
	const lenSq = dx * dx + dy * dy;

	if (lenSq < 1e-10) {
		// Degenerate segment
		const dist = Math.sqrt((px - p0.x) ** 2 + (py - p0.y) ** 2);
		return { distance: dist, t: 0 };
	}

	// Project point onto line
	let t = ((px - p0.x) * dx + (py - p0.y) * dy) / lenSq;
	t = Math.max(0, Math.min(1, t));

	// Unsigned distance
	const dist = Math.sqrt((px - p0.x - t * dx) ** 2 + (py - p0.y - t * dy) ** 2);

	// Sign: use cross product to determine which side of line
	// Cross product: (p1 - p0) x (point - p0) = dx * (py - p0.y) - dy * (px - p0.x)
	const cross = dx * (py - p0.y) - dy * (px - p0.x);
	const sign = cross >= 0 ? 1 : -1;

	return { distance: sign * dist, t };
}

/**
 * Compute unsigned distance from point to line segment (faster version)
 */
function unsignedDistanceToLine(
	px: number,
	py: number,
	p0: Point,
	p1: Point,
): number {
	const dx = p1.x - p0.x;
	const dy = p1.y - p0.y;
	const lenSq = dx * dx + dy * dy;
	if (lenSq < 1e-10) return Math.sqrt((px - p0.x) ** 2 + (py - p0.y) ** 2);
	let t = ((px - p0.x) * dx + (py - p0.y) * dy) / lenSq;
	t = Math.max(0, Math.min(1, t));
	return Math.sqrt((px - p0.x - t * dx) ** 2 + (py - p0.y - t * dy) ** 2);
}

/**
 * Compute signed distance from point to quadratic bezier curve
 * Uses Newton-Raphson iteration to find closest point
 */
export function signedDistanceToQuadratic(
	px: number,
	py: number,
	p0: Point,
	p1: Point,
	p2: Point,
): SignedDistanceResult {
	// Quadratic bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
	// We need to find t that minimizes |B(t) - P|²

	// Coefficients for the quadratic bezier
	const ax = p0.x - 2 * p1.x + p2.x;
	const ay = p0.y - 2 * p1.y + p2.y;

	let minDist = Math.min(
		Math.sqrt((p0.x - px) ** 2 + (p0.y - py) ** 2),
		Math.sqrt((p2.x - px) ** 2 + (p2.y - py) ** 2),
	);
	let minT = minDist === Math.sqrt((p0.x - px) ** 2 + (p0.y - py) ** 2) ? 0 : 1;

	// Sample and refine with Newton-Raphson (reduced samples and iterations)
	for (let i = 1; i < 6; i++) {
		let t = i / 6;

		// Newton-Raphson iterations
		for (let iter = 0; iter < 3; iter++) {
			const ti = 1 - t;

			// B(t)
			const bx_t = ti * ti * p0.x + 2 * ti * t * p1.x + t * t * p2.x;
			const by_t = ti * ti * p0.y + 2 * ti * t * p1.y + t * t * p2.y;

			// B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1) = 2((1-t)(P1-P0) + t(P2-P1))
			const dx = 2 * (ti * (p1.x - p0.x) + t * (p2.x - p1.x));
			const dy = 2 * (ti * (p1.y - p0.y) + t * (p2.y - p1.y));

			// f(t) = (B(t) - P) · B'(t)
			const vx = bx_t - px;
			const vy = by_t - py;
			const f = vx * dx + vy * dy;

			// f'(t) = B'(t) · B'(t) + (B(t) - P) · B''(t)
			const df = dx * dx + dy * dy + vx * 2 * ax + vy * 2 * ay;

			if (Math.abs(df) < 1e-10) break;

			t = Math.max(0, Math.min(1, t - f / df));
		}

		// Evaluate distance at this t
		const ti = 1 - t;
		const bx_t = ti * ti * p0.x + 2 * ti * t * p1.x + t * t * p2.x;
		const by_t = ti * ti * p0.y + 2 * ti * t * p1.y + t * t * p2.y;
		const dist = Math.sqrt((bx_t - px) ** 2 + (by_t - py) ** 2);

		if (dist < minDist) {
			minDist = dist;
			minT = t;
		}
	}

	// Compute sign using the tangent at closest point
	const ti = 1 - minT;
	const tangentX = 2 * (ti * (p1.x - p0.x) + minT * (p2.x - p1.x));
	const tangentY = 2 * (ti * (p1.y - p0.y) + minT * (p2.y - p1.y));

	const bx_t = ti * ti * p0.x + 2 * ti * minT * p1.x + minT * minT * p2.x;
	const by_t = ti * ti * p0.y + 2 * ti * minT * p1.y + minT * minT * p2.y;

	// Cross product of tangent and (point - curve)
	const cross = tangentX * (py - by_t) - tangentY * (px - bx_t);
	const minSign = cross >= 0 ? 1 : -1;

	return { distance: minSign * minDist, t: minT };
}

/**
 * Compute unsigned distance from point to quadratic bezier curve (faster version)
 */
function unsignedDistanceToQuadratic(
	px: number,
	py: number,
	p0: Point,
	p1: Point,
	p2: Point,
): number {
	const ax = p0.x - 2 * p1.x + p2.x;
	const ay = p0.y - 2 * p1.y + p2.y;

	let minDist = Math.min(
		Math.sqrt((p0.x - px) ** 2 + (p0.y - py) ** 2),
		Math.sqrt((p2.x - px) ** 2 + (p2.y - py) ** 2),
	);

	for (let i = 1; i < 6; i++) {
		let t = i / 6;
		for (let iter = 0; iter < 3; iter++) {
			const ti = 1 - t;
			const bx = ti * ti * p0.x + 2 * ti * t * p1.x + t * t * p2.x;
			const by = ti * ti * p0.y + 2 * ti * t * p1.y + t * t * p2.y;
			const dx = 2 * (ti * (p1.x - p0.x) + t * (p2.x - p1.x));
			const dy = 2 * (ti * (p1.y - p0.y) + t * (p2.y - p1.y));
			const vx = bx - px;
			const vy = by - py;
			const df = dx * dx + dy * dy + vx * 2 * ax + vy * 2 * ay;
			if (Math.abs(df) < 1e-10) break;
			t = Math.max(0, Math.min(1, t - (vx * dx + vy * dy) / df));
		}
		const ti = 1 - t;
		const dist = Math.sqrt(
			(ti * ti * p0.x + 2 * ti * t * p1.x + t * t * p2.x - px) ** 2 +
				(ti * ti * p0.y + 2 * ti * t * p1.y + t * t * p2.y - py) ** 2,
		);
		if (dist < minDist) minDist = dist;
	}
	return minDist;
}

/**
 * Compute signed distance from point to cubic bezier curve
 * Uses Newton-Raphson iteration with multiple starting points
 */
export function signedDistanceToCubic(
	px: number,
	py: number,
	p0: Point,
	p1: Point,
	p2: Point,
	p3: Point,
): SignedDistanceResult {
	// Cubic bezier: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3

	let minDist = Math.min(
		Math.sqrt((p0.x - px) ** 2 + (p0.y - py) ** 2),
		Math.sqrt((p3.x - px) ** 2 + (p3.y - py) ** 2),
	);
	let minT = minDist === Math.sqrt((p0.x - px) ** 2 + (p0.y - py) ** 2) ? 0 : 1;

	// Sample and refine with Newton-Raphson (reduced samples and iterations)
	for (let i = 1; i < 6; i++) {
		let t = i / 6;

		// Newton-Raphson iterations
		for (let iter = 0; iter < 3; iter++) {
			const ti = 1 - t;
			const ti2 = ti * ti;
			const ti3 = ti2 * ti;
			const t2 = t * t;
			const t3 = t2 * t;

			// B(t)
			const bx_t =
				ti3 * p0.x + 3 * ti2 * t * p1.x + 3 * ti * t2 * p2.x + t3 * p3.x;
			const by_t =
				ti3 * p0.y + 3 * ti2 * t * p1.y + 3 * ti * t2 * p2.y + t3 * p3.y;

			// B'(t) = 3(1-t)²(P1-P0) + 6(1-t)t(P2-P1) + 3t²(P3-P2)
			const dx =
				3 * ti2 * (p1.x - p0.x) +
				6 * ti * t * (p2.x - p1.x) +
				3 * t2 * (p3.x - p2.x);
			const dy =
				3 * ti2 * (p1.y - p0.y) +
				6 * ti * t * (p2.y - p1.y) +
				3 * t2 * (p3.y - p2.y);

			// B''(t) = 6(1-t)(P2-2P1+P0) + 6t(P3-2P2+P1)
			const ddx =
				6 * ti * (p2.x - 2 * p1.x + p0.x) + 6 * t * (p3.x - 2 * p2.x + p1.x);
			const ddy =
				6 * ti * (p2.y - 2 * p1.y + p0.y) + 6 * t * (p3.y - 2 * p2.y + p1.y);

			// f(t) = (B(t) - P) · B'(t)
			const vx = bx_t - px;
			const vy = by_t - py;
			const f = vx * dx + vy * dy;

			// f'(t) = B'(t) · B'(t) + (B(t) - P) · B''(t)
			const df = dx * dx + dy * dy + vx * ddx + vy * ddy;

			if (Math.abs(df) < 1e-10) break;

			t = Math.max(0, Math.min(1, t - f / df));
		}

		// Evaluate distance at this t
		const ti = 1 - t;
		const ti2 = ti * ti;
		const ti3 = ti2 * ti;
		const t2 = t * t;
		const t3 = t2 * t;

		const bx_t =
			ti3 * p0.x + 3 * ti2 * t * p1.x + 3 * ti * t2 * p2.x + t3 * p3.x;
		const by_t =
			ti3 * p0.y + 3 * ti2 * t * p1.y + 3 * ti * t2 * p2.y + t3 * p3.y;
		const dist = Math.sqrt((bx_t - px) ** 2 + (by_t - py) ** 2);

		if (dist < minDist) {
			minDist = dist;
			minT = t;
		}
	}

	// Compute sign using the tangent at closest point
	const ti = 1 - minT;
	const ti2 = ti * ti;
	const t2 = minT * minT;

	const tangentX =
		3 * ti2 * (p1.x - p0.x) +
		6 * ti * minT * (p2.x - p1.x) +
		3 * t2 * (p3.x - p2.x);
	const tangentY =
		3 * ti2 * (p1.y - p0.y) +
		6 * ti * minT * (p2.y - p1.y) +
		3 * t2 * (p3.y - p2.y);

	const ti3 = ti2 * ti;
	const t3 = t2 * minT;
	const bx_t =
		ti3 * p0.x + 3 * ti2 * minT * p1.x + 3 * ti * t2 * p2.x + t3 * p3.x;
	const by_t =
		ti3 * p0.y + 3 * ti2 * minT * p1.y + 3 * ti * t2 * p2.y + t3 * p3.y;

	// Cross product of tangent and (point - curve)
	const cross = tangentX * (py - by_t) - tangentY * (px - bx_t);
	const minSign = cross >= 0 ? 1 : -1;

	return { distance: minSign * minDist, t: minT };
}

/**
 * Compute unsigned distance from point to cubic bezier curve (faster version)
 */
function unsignedDistanceToCubic(
	px: number,
	py: number,
	p0: Point,
	p1: Point,
	p2: Point,
	p3: Point,
): number {
	let minDist = Math.min(
		Math.sqrt((p0.x - px) ** 2 + (p0.y - py) ** 2),
		Math.sqrt((p3.x - px) ** 2 + (p3.y - py) ** 2),
	);

	for (let i = 1; i < 6; i++) {
		let t = i / 6;
		for (let iter = 0; iter < 3; iter++) {
			const ti = 1 - t;
			const ti2 = ti * ti;
			const ti3 = ti2 * ti;
			const t2 = t * t;
			const t3 = t2 * t;
			const bx = ti3 * p0.x + 3 * ti2 * t * p1.x + 3 * ti * t2 * p2.x + t3 * p3.x;
			const by = ti3 * p0.y + 3 * ti2 * t * p1.y + 3 * ti * t2 * p2.y + t3 * p3.y;
			const dx =
				3 * ti2 * (p1.x - p0.x) +
				6 * ti * t * (p2.x - p1.x) +
				3 * t2 * (p3.x - p2.x);
			const dy =
				3 * ti2 * (p1.y - p0.y) +
				6 * ti * t * (p2.y - p1.y) +
				3 * t2 * (p3.y - p2.y);
			const ddx =
				6 * ti * (p2.x - 2 * p1.x + p0.x) + 6 * t * (p3.x - 2 * p2.x + p1.x);
			const ddy =
				6 * ti * (p2.y - 2 * p1.y + p0.y) + 6 * t * (p3.y - 2 * p2.y + p1.y);
			const vx = bx - px;
			const vy = by - py;
			const df = dx * dx + dy * dy + vx * ddx + vy * ddy;
			if (Math.abs(df) < 1e-10) break;
			t = Math.max(0, Math.min(1, t - (vx * dx + vy * dy) / df));
		}
		const ti = 1 - t;
		const ti2 = ti * ti;
		const ti3 = ti2 * ti;
		const t2 = t * t;
		const t3 = t2 * t;
		const dist = Math.sqrt(
			(ti3 * p0.x + 3 * ti2 * t * p1.x + 3 * ti * t2 * p2.x + t3 * p3.x - px) ** 2 +
				(ti3 * p0.y + 3 * ti2 * t * p1.y + 3 * ti * t2 * p2.y + t3 * p3.y - py) ** 2,
		);
		if (dist < minDist) minDist = dist;
	}
	return minDist;
}

/**
 * Get the direction vector at the start of an edge
 */
function getEdgeStartDirection(edge: MsdfEdge): Point {
	switch (edge.type) {
		case "line":
			return { x: edge.p1.x - edge.p0.x, y: edge.p1.y - edge.p0.y };
		case "quadratic":
			// Tangent at t=0: 2(P1 - P0)
			return { x: 2 * (edge.p1.x - edge.p0.x), y: 2 * (edge.p1.y - edge.p0.y) };
		case "cubic":
			// Tangent at t=0: 3(P1 - P0)
			return { x: 3 * (edge.p1.x - edge.p0.x), y: 3 * (edge.p1.y - edge.p0.y) };
	}
}

/**
 * Get the direction vector at the end of an edge
 */
function getEdgeEndDirection(edge: MsdfEdge): Point {
	switch (edge.type) {
		case "line":
			return { x: edge.p1.x - edge.p0.x, y: edge.p1.y - edge.p0.y };
		case "quadratic":
			// Tangent at t=1: 2(P2 - P1)
			return { x: 2 * (edge.p2.x - edge.p1.x), y: 2 * (edge.p2.y - edge.p1.y) };
		case "cubic":
			// Tangent at t=1: 3(P3 - P2)
			return { x: 3 * (edge.p3.x - edge.p2.x), y: 3 * (edge.p3.y - edge.p2.y) };
	}
}

/**
 * Normalize a vector
 */
function normalize(v: Point): Point {
	const len = Math.sqrt(v.x * v.x + v.y * v.y);
	if (len < 1e-10) return { x: 0, y: 0 };
	return { x: v.x / len, y: v.y / len };
}

/**
 * Dot product
 */
function dot(a: Point, b: Point): number {
	return a.x * b.x + a.y * b.y;
}

/**
 * Check if the angle between two vectors is sharp (< threshold)
 */
function isSharpCorner(
	dir1: Point,
	dir2: Point,
	threshold = Math.PI / 3,
): boolean {
	const n1 = normalize(dir1);
	const n2 = normalize(dir2);
	const cosAngle = dot(n1, n2);
	// Angle between directions
	const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
	// If directions are similar (angle near 0 or PI), it's smooth
	// If they're different, it's sharp
	return angle > threshold && angle < Math.PI - threshold;
}

/**
 * Assign colors to edges based on corner angles
 * At sharp corners, adjacent edges get different colors
 */
export function assignEdgeColors(contours: MsdfEdge[][]): void {
	const CORNER_THRESHOLD = Math.PI / 4; // 45 degrees

	for (let i = 0; i < contours.length; i++) {
		const contour = contours[i]!;
		if (contour.length === 0) continue;

		if (contour.length === 1) {
			// Single edge gets any color
			contour[0]!.color = 0;
			continue;
		}

		// Start with color 0
		let currentColor: EdgeColor = 0;

		for (let j = 0; j < contour.length; j++) {
			const edge = contour[j]!;
			const prevEdge = contour[(j - 1 + contour.length) % contour.length]!;

			if (j === 0) {
				// First edge starts with color 0
				edge.color = currentColor;
			} else {
				// Check angle between previous edge's end and this edge's start
				const prevDir = getEdgeEndDirection(prevEdge);
				const currDir = getEdgeStartDirection(edge);

				if (isSharpCorner(prevDir, currDir, CORNER_THRESHOLD)) {
					// Sharp corner - switch to different color
					currentColor = ((currentColor + 1) % 3) as EdgeColor;
				}

				edge.color = currentColor;
			}
		}

		// Check if last-to-first transition needs different colors
		if (contour.length >= 2) {
			const lastEdge = contour[contour.length - 1]!;
			const firstEdge = contour[0]!;

			const lastDir = getEdgeEndDirection(lastEdge);
			const firstDir = getEdgeStartDirection(firstEdge);

			if (isSharpCorner(lastDir, firstDir, CORNER_THRESHOLD)) {
				// Need different colors at this corner
				if (lastEdge.color === firstEdge.color) {
					// Reassign colors to ensure difference
					// Try to find a color different from both neighbors
					const prevColor = contour[contour.length - 2]?.color ?? 0;
					const _nextColor = contour[1]?.color ?? 0;

					// Find a color different from prevColor for lastEdge
					for (let c = 0; c < 3; c++) {
						if (c !== firstEdge.color && c !== prevColor) {
							lastEdge.color = c as EdgeColor;
							break;
						}
					}
				}
			}
		}
	}
}

/**
 * Extract edges from path commands
 */
function extractEdges(
	path: GlyphPath,
	scale: number,
	offsetX: number,
	offsetY: number,
	flipY: boolean,
): MsdfEdge[][] {
	const contours: MsdfEdge[][] = [];
	let currentContour: MsdfEdge[] = [];
	let currentPoint: Point | null = null;
	let firstPoint: Point | null = null;

	const transform = (x: number, y: number): Point => ({
		x: x * scale + offsetX,
		y: flipY ? -(y * scale) + offsetY : y * scale + offsetY,
	});

	for (let i = 0; i < path.commands.length; i++) {
		const cmd = path.commands[i]!;
		switch (cmd.type) {
			case "M":
				// Start new contour
				if (currentContour.length > 0) {
					contours.push(currentContour);
					currentContour = [];
				}
				currentPoint = transform(cmd.x, cmd.y);
				firstPoint = currentPoint;
				break;

			case "L":
				if (currentPoint) {
					const p1 = transform(cmd.x, cmd.y);
					// Skip degenerate edges
					if (
						Math.abs(p1.x - currentPoint.x) > 1e-6 ||
						Math.abs(p1.y - currentPoint.y) > 1e-6
					) {
						currentContour.push({
							type: "line",
							p0: currentPoint,
							p1,
							color: 0,
							minX: Math.min(currentPoint.x, p1.x),
							maxX: Math.max(currentPoint.x, p1.x),
							minY: Math.min(currentPoint.y, p1.y),
							maxY: Math.max(currentPoint.y, p1.y),
						});
					}
					currentPoint = p1;
				}
				break;

			case "Q":
				if (currentPoint) {
					const p1 = transform(cmd.x1, cmd.y1);
					const p2 = transform(cmd.x, cmd.y);
					currentContour.push({
						type: "quadratic",
						p0: currentPoint,
						p1,
						p2,
						color: 0,
						minX: Math.min(currentPoint.x, p1.x, p2.x),
						maxX: Math.max(currentPoint.x, p1.x, p2.x),
						minY: Math.min(currentPoint.y, p1.y, p2.y),
						maxY: Math.max(currentPoint.y, p1.y, p2.y),
					});
					currentPoint = p2;
				}
				break;

			case "C":
				if (currentPoint) {
					const p1 = transform(cmd.x1, cmd.y1);
					const p2 = transform(cmd.x2, cmd.y2);
					const p3 = transform(cmd.x, cmd.y);
					currentContour.push({
						type: "cubic",
						p0: currentPoint,
						p1,
						p2,
						p3,
						color: 0,
						minX: Math.min(currentPoint.x, p1.x, p2.x, p3.x),
						maxX: Math.max(currentPoint.x, p1.x, p2.x, p3.x),
						minY: Math.min(currentPoint.y, p1.y, p2.y, p3.y),
						maxY: Math.max(currentPoint.y, p1.y, p2.y, p3.y),
					});
					currentPoint = p3;
				}
				break;

			case "Z":
				if (currentPoint && firstPoint) {
					// Close with line if needed
					if (
						Math.abs(currentPoint.x - firstPoint.x) > 1e-6 ||
						Math.abs(currentPoint.y - firstPoint.y) > 1e-6
					) {
						currentContour.push({
							type: "line",
							p0: currentPoint,
							p1: firstPoint,
							color: 0,
						});
					}
					currentPoint = firstPoint;
				}
				if (currentContour.length > 0) {
					contours.push(currentContour);
					currentContour = [];
				}
				break;
		}
	}

	// Push any remaining contour
	if (currentContour.length > 0) {
		contours.push(currentContour);
	}

	return contours;
}

/**
 * Compute signed distance from point to edge
 */
function signedDistanceToEdge(
	px: number,
	py: number,
	edge: MsdfEdge,
): SignedDistanceResult {
	switch (edge.type) {
		case "line":
			return signedDistanceToLine(px, py, edge.p0, edge.p1);
		case "quadratic":
			return signedDistanceToQuadratic(px, py, edge.p0, edge.p1, edge.p2);
		case "cubic":
			return signedDistanceToCubic(px, py, edge.p0, edge.p1, edge.p2, edge.p3);
	}
}

/**
 * Determine if a point is inside using ray casting (even-odd rule)
 */
function isPointInside(
	px: number,
	py: number,
	contours: MsdfEdge[][],
): boolean {
	let crossings = 0;

	for (let i = 0; i < contours.length; i++) {
		const contour = contours[i]!;
		for (let j = 0; j < contour.length; j++) {
			const edge = contour[j]!;
			// Flatten curves to line segments for inside test
			const points = flattenEdge(edge);

			for (let k = 0; k < points.length - 1; k++) {
				const p0 = points[k]!;
				const p1 = points[k + 1]!;

				// Ray casting: horizontal ray to the right
				if (p0.y > py !== p1.y > py) {
					const slope = (p1.x - p0.x) / (p1.y - p0.y);
					const x = p0.x + slope * (py - p0.y);

					if (px < x) {
						crossings++;
					}
				}
			}
		}
	}

	return (crossings & 1) === 1;
}

/**
 * Flatten an edge to points for inside testing
 */
function flattenEdge(edge: MsdfEdge): Point[] {
	switch (edge.type) {
		case "line":
			return [edge.p0, edge.p1];

		case "quadratic": {
			const points: Point[] = [edge.p0];
			const samples = 8;
			for (let i = 1; i <= samples; i++) {
				const t = i / samples;
				const ti = 1 - t;
				points.push({
					x: ti * ti * edge.p0.x + 2 * ti * t * edge.p1.x + t * t * edge.p2.x,
					y: ti * ti * edge.p0.y + 2 * ti * t * edge.p1.y + t * t * edge.p2.y,
				});
			}
			return points;
		}

		case "cubic": {
			const points: Point[] = [edge.p0];
			const samples = 8;
			for (let i = 1; i <= samples; i++) {
				const t = i / samples;
				const ti = 1 - t;
				const ti2 = ti * ti;
				const ti3 = ti2 * ti;
				const t2 = t * t;
				const t3 = t2 * t;
				points.push({
					x:
						ti3 * edge.p0.x +
						3 * ti2 * t * edge.p1.x +
						3 * ti * t2 * edge.p2.x +
						t3 * edge.p3.x,
					y:
						ti3 * edge.p0.y +
						3 * ti2 * t * edge.p1.y +
						3 * ti * t2 * edge.p2.y +
						t3 * edge.p3.y,
				});
			}
			return points;
		}
	}
}

/**
 * Render a glyph path as a multi-channel signed distance field
 */
export function renderMsdf(path: GlyphPath, options: MsdfOptions): Bitmap {
	const {
		width,
		height,
		scale,
		offsetX = 0,
		offsetY = 0,
		flipY = false,
		spread = 8,
	} = options;

	// Create RGB bitmap (3 bytes per pixel)
	const bitmap = createBitmap(width, height, PixelMode.LCD);

	// Extract and color edges
	const contours = extractEdges(path, scale, offsetX, offsetY, flipY);

	// If no edges, fill with minimum distance
	if (contours.length === 0 || contours.every((c) => c.length === 0)) {
		bitmap.buffer.fill(0);
		return bitmap;
	}

	// Assign colors to edges
	assignEdgeColors(contours);

	// Flatten all edges for quick access
	const allEdges: MsdfEdge[] = contours.flat();

	// Group edges by color
	const redEdges = allEdges.filter((e) => e.color === 0);
	const greenEdges = allEdges.filter((e) => e.color === 1);
	const blueEdges = allEdges.filter((e) => e.color === 2);

	// If any color has no edges, duplicate from another
	const ensureEdges = (edges: MsdfEdge[]): MsdfEdge[] => {
		if (edges.length > 0) return edges;
		return allEdges;
	};

	const rEdges = ensureEdges(redEdges);
	const gEdges = ensureEdges(greenEdges);
	const bEdges = ensureEdges(blueEdges);

	// For each pixel
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const px = x + 0.5;
			const py = y + 0.5;

			// Find minimum distance to each color channel
			let minR = Infinity;
			let minG = Infinity;
			let minB = Infinity;

			for (let k = 0; k < rEdges.length; k++) {
				const edge = rEdges[k]!;
				const result = signedDistanceToEdge(px, py, edge);
				if (Math.abs(result.distance) < Math.abs(minR)) {
					minR = result.distance;
				}
			}

			for (let k = 0; k < gEdges.length; k++) {
				const edge = gEdges[k]!;
				const result = signedDistanceToEdge(px, py, edge);
				if (Math.abs(result.distance) < Math.abs(minG)) {
					minG = result.distance;
				}
			}

			for (let k = 0; k < bEdges.length; k++) {
				const edge = bEdges[k]!;
				const result = signedDistanceToEdge(px, py, edge);
				if (Math.abs(result.distance) < Math.abs(minB)) {
					minB = result.distance;
				}
			}

			// Determine inside/outside using median
			const _medDist = median(minR, minG, minB);
			const inside = isPointInside(px, py, contours);

			// Correct signs based on inside/outside
			// All distances should be positive inside, negative outside
			const signCorrection = inside ? 1 : -1;
			const rDist = Math.abs(minR) * signCorrection;
			const gDist = Math.abs(minG) * signCorrection;
			const bDist = Math.abs(minB) * signCorrection;

			// Encode to 0-255
			const encode = (d: number): number => {
				const normalized = 128 + (d / spread) * 127;
				return Math.max(0, Math.min(255, Math.round(normalized)));
			};

			const idx = y * bitmap.pitch + x * 3;
			bitmap.buffer[idx] = encode(rDist);
			bitmap.buffer[idx + 1] = encode(gDist);
			bitmap.buffer[idx + 2] = encode(bDist);
		}
	}

	return bitmap;
}

/**
 * Shelf packing node for atlas building
 */
interface Shelf {
	y: number;
	height: number;
	width: number;
}

/**
 * Placement result for a glyph
 */
interface Placement {
	x: number;
	y: number;
	placed: boolean;
}

/**
 * Pack rectangles using shelf algorithm
 */
function packGlyphs(
	sizes: Array<{ width: number; height: number }>,
	maxWidth: number,
	maxHeight: number,
): { width: number; height: number; placements: Placement[] } {
	const shelves: Shelf[] = [];
	const placements: Placement[] = [];

	let atlasWidth = 0;
	let atlasHeight = 0;

	for (let i = 0; i < sizes.length; i++) {
		const size = sizes[i]!;
		let placed = false;
		let bestShelf = -1;
		let bestY = maxHeight;

		// Try to find an existing shelf
		for (let j = 0; j < shelves.length; j++) {
			const shelf = shelves[j]!;

			// Check if glyph fits in this shelf
			if (shelf.width + size.width <= maxWidth && size.height <= shelf.height) {
				if (shelf.y < bestY) {
					bestShelf = j;
					bestY = shelf.y;
				}
			}
		}

		if (bestShelf >= 0) {
			// Place in existing shelf
			const shelf = shelves[bestShelf]!;
			placements.push({
				x: shelf.width,
				y: shelf.y,
				placed: true,
			});
			shelf.width += size.width;
			atlasWidth = Math.max(atlasWidth, shelf.width);
			placed = true;
		} else {
			// Create new shelf
			const newY = atlasHeight;

			if (newY + size.height <= maxHeight && size.width <= maxWidth) {
				shelves.push({
					y: newY,
					height: size.height,
					width: size.width,
				});
				placements.push({
					x: 0,
					y: newY,
					placed: true,
				});
				atlasHeight = newY + size.height;
				atlasWidth = Math.max(atlasWidth, size.width);
				placed = true;
			}
		}

		if (!placed) {
			placements.push({ x: 0, y: 0, placed: false });
		}
	}

	// Round up to power of 2 for GPU compatibility
	const finalWidth = nextPowerOf2(atlasWidth);
	const finalHeight = nextPowerOf2(atlasHeight);

	return {
		width: Math.min(finalWidth, maxWidth),
		height: Math.min(finalHeight, maxHeight),
		placements,
	};
}

/**
 * Get next power of 2 >= n
 */
function nextPowerOf2(n: number): number {
	if (n <= 0) return 1;
	n--;
	n |= n >> 1;
	n |= n >> 2;
	n |= n >> 4;
	n |= n >> 8;
	n |= n >> 16;
	return n + 1;
}

/**
 * Copy source bitmap into destination at specified position
 */
function copyBitmapRgb(
	src: Bitmap,
	dst: Bitmap,
	dstX: number,
	dstY: number,
): void {
	for (let y = 0; y < src.rows; y++) {
		const srcRow = y * src.pitch;
		const dstRow = (dstY + y) * dst.pitch + dstX * 3;

		for (let x = 0; x < src.width * 3; x++) {
			dst.buffer[dstRow + x] = src.buffer[srcRow + x];
		}
	}
}

/**
 * Build an MSDF texture atlas from a set of glyphs
 */
export function buildMsdfAtlas(
	font: Font,
	glyphIds: number[],
	options: MsdfAtlasOptions,
): GlyphAtlas {
	const {
		fontSize,
		padding = 2,
		maxWidth = 2048,
		maxHeight = 2048,
		spread = 4,
	} = options;

	const scale = fontSize / font.unitsPerEm;

	// First pass: render all MSDF glyphs and collect sizes
	const glyphData: Array<{
		glyphId: number;
		bitmap: Bitmap;
		bearingX: number;
		bearingY: number;
		advance: number;
	}> = [];

	for (let i = 0; i < glyphIds.length; i++) {
		const glyphId = glyphIds[i]!;
		const path = getGlyphPath(font, glyphId);
		if (!path || !path.bounds) continue;

		const bounds = path.bounds;

		// Calculate bitmap size with spread padding
		const glyphWidth =
			Math.ceil((bounds.xMax - bounds.xMin) * scale) + spread * 2;
		const glyphHeight =
			Math.ceil((bounds.yMax - bounds.yMin) * scale) + spread * 2;

		if (glyphWidth <= 0 || glyphHeight <= 0) continue;

		// Render MSDF
		const bitmap = renderMsdf(path, {
			width: glyphWidth,
			height: glyphHeight,
			scale,
			offsetX: -bounds.xMin * scale + spread,
			offsetY: bounds.yMax * scale + spread,
			flipY: true,
			spread,
		});

		const advance = font.advanceWidth(glyphId) * scale;
		const bearingX = bounds.xMin * scale - spread;
		const bearingY = bounds.yMax * scale + spread;

		glyphData.push({
			glyphId,
			bitmap,
			bearingX,
			bearingY,
			advance,
		});
	}

	// Sort by height (descending) for better packing
	glyphData.sort((a, b) => b.bitmap.rows - a.bitmap.rows);

	// Calculate required atlas size
	const {
		width: atlasWidth,
		height: atlasHeight,
		placements,
	} = packGlyphs(
		glyphData.map((g) => ({
			width: g.bitmap.width + padding * 2,
			height: g.bitmap.rows + padding * 2,
		})),
		maxWidth,
		maxHeight,
	);

	// Create atlas bitmap (RGB for MSDF)
	const atlas = createBitmap(atlasWidth, atlasHeight, PixelMode.LCD);

	// Copy glyphs into atlas and build metrics map
	const glyphMetrics = new Map<number, GlyphMetrics>();

	for (let i = 0; i < glyphData.length; i++) {
		const glyph = glyphData[i];
		const placement = placements[i];

		if (!placement.placed) continue;

		// Copy glyph bitmap into atlas
		copyBitmapRgb(
			glyph.bitmap,
			atlas,
			placement.x + padding,
			placement.y + padding,
		);

		// Store metrics
		glyphMetrics.set(glyph.glyphId, {
			glyphId: glyph.glyphId,
			atlasX: placement.x + padding,
			atlasY: placement.y + padding,
			width: glyph.bitmap.width,
			height: glyph.bitmap.rows,
			bearingX: glyph.bearingX,
			bearingY: glyph.bearingY,
			advance: glyph.advance,
		});
	}

	return {
		bitmap: atlas,
		glyphs: glyphMetrics,
		fontSize,
	};
}

/**
 * Build MSDF atlas for ASCII printable characters (32-126)
 */
export function buildMsdfAsciiAtlas(
	font: Font,
	options: MsdfAtlasOptions,
): GlyphAtlas {
	const glyphIds: number[] = [];

	for (let codepoint = 32; codepoint <= 126; codepoint++) {
		const glyphId = font.glyphId(codepoint);
		if (glyphId !== undefined && glyphId !== 0) {
			glyphIds.push(glyphId);
		}
	}

	return buildMsdfAtlas(font, glyphIds, options);
}

/**
 * Build MSDF atlas for a specific string (including all unique glyphs)
 */
export function buildMsdfStringAtlas(
	font: Font,
	text: string,
	options: MsdfAtlasOptions,
): GlyphAtlas {
	const glyphIdSet = new Set<number>();

	const textArray = Array.from(text);
	for (let i = 0; i < textArray.length; i++) {
		const char = textArray[i]!;
		const codepoint = char.codePointAt(0);
		if (codepoint === undefined) continue;

		const glyphId = font.glyphId(codepoint);
		if (glyphId !== undefined && glyphId !== 0) {
			glyphIdSet.add(glyphId);
		}
	}

	return buildMsdfAtlas(font, Array.from(glyphIdSet), options);
}

/**
 * Export MSDF atlas as RGB texture data
 */
export function msdfAtlasToRGB(atlas: GlyphAtlas): Uint8Array {
	const { bitmap } = atlas;

	if (bitmap.pitch === bitmap.width * 3) {
		return bitmap.buffer;
	}

	// Copy without row padding
	const rgb = new Uint8Array(bitmap.width * bitmap.rows * 3);
	for (let y = 0; y < bitmap.rows; y++) {
		for (let x = 0; x < bitmap.width * 3; x++) {
			rgb[y * bitmap.width * 3 + x] = bitmap.buffer[y * bitmap.pitch + x];
		}
	}

	return rgb;
}

/**
 * Export MSDF atlas as RGBA texture data
 */
export function msdfAtlasToRGBA(atlas: GlyphAtlas): Uint8Array {
	const { bitmap } = atlas;
	const rgba = new Uint8Array(bitmap.width * bitmap.rows * 4);

	for (let y = 0; y < bitmap.rows; y++) {
		for (let x = 0; x < bitmap.width; x++) {
			const srcIdx = y * bitmap.pitch + x * 3;
			const dstIdx = (y * bitmap.width + x) * 4;

			rgba[dstIdx] = bitmap.buffer[srcIdx];
			rgba[dstIdx + 1] = bitmap.buffer[srcIdx + 1];
			rgba[dstIdx + 2] = bitmap.buffer[srcIdx + 2];
			rgba[dstIdx + 3] = 255; // Full alpha
		}
	}

	return rgba;
}
