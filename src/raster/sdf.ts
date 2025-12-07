/**
 * Signed Distance Field (SDF) rasterizer
 *
 * For each pixel, compute the shortest distance to the outline.
 * Positive values are inside the outline, negative are outside.
 * This allows GPU text rendering at any scale.
 *
 * Algorithm:
 * 1. For each pixel center, find the minimum distance to all outline edges
 * 2. Determine sign based on whether point is inside or outside the outline
 * 3. Normalize and encode to 0-255 (128 = on the edge)
 */

import type { GlyphPath } from "../render/path.ts";
import { type Bitmap, createBitmap, PixelMode } from "./types.ts";

/**
 * Options for SDF rendering
 */
export interface SdfOptions {
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
 * A point in 2D space
 */
interface Point {
	x: number;
	y: number;
}

/**
 * An edge in the outline (line segment or curve)
 */
type Edge =
	| { type: "line"; p0: Point; p1: Point }
	| { type: "quadratic"; p0: Point; p1: Point; p2: Point }
	| { type: "cubic"; p0: Point; p1: Point; p2: Point; p3: Point };

/**
 * Render a glyph path as a signed distance field
 */
export function renderSdf(path: GlyphPath, options: SdfOptions): Bitmap {
	const {
		width,
		height,
		scale,
		offsetX = 0,
		offsetY = 0,
		flipY = false,
		spread = 8,
	} = options;

	// Create bitmap
	const bitmap = createBitmap(width, height, PixelMode.Gray);

	// Convert path commands to edges
	const edges = extractEdges(path, scale, offsetX, offsetY, flipY);

	// If no edges, fill with 0 (maximum negative distance)
	if (edges.length === 0) {
		bitmap.buffer.fill(0);
		return bitmap;
	}

	// For each pixel, compute signed distance
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			// Pixel center
			const px = x + 0.5;
			const py = y + 0.5;

			// Find minimum distance to all edges
			let minDist = Infinity;
			for (let k = 0; k < edges.length; k++) {
				const edge = edges[k]!;
				const dist = distanceToEdge(px, py, edge);
				minDist = Math.min(minDist, dist);
			}

			// Determine if point is inside or outside
			const inside = isPointInside(px, py, edges);

			// Sign: positive inside, negative outside
			const signedDist = inside ? minDist : -minDist;

			// Normalize to 0-255 range
			// spread is the distance in pixels that maps to 0-128 or 128-255
			// 0 = -spread (far outside)
			// 128 = 0 (on edge)
			// 255 = +spread (far inside)
			const normalized = 128 + (signedDist / spread) * 127;
			const clamped = Math.max(0, Math.min(255, Math.round(normalized)));

			bitmap.buffer[y * bitmap.pitch + x] = clamped;
		}
	}

	return bitmap;
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
): Edge[] {
	const edges: Edge[] = [];
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
				currentPoint = transform(cmd.x, cmd.y);
				firstPoint = currentPoint;
				break;

			case "L":
				if (currentPoint) {
					const p1 = transform(cmd.x, cmd.y);
					edges.push({ type: "line", p0: currentPoint, p1 });
					currentPoint = p1;
				}
				break;

			case "Q":
				if (currentPoint) {
					const p1 = transform(cmd.x1, cmd.y1);
					const p2 = transform(cmd.x, cmd.y);
					edges.push({ type: "quadratic", p0: currentPoint, p1, p2 });
					currentPoint = p2;
				}
				break;

			case "C":
				if (currentPoint) {
					const p1 = transform(cmd.x1, cmd.y1);
					const p2 = transform(cmd.x2, cmd.y2);
					const p3 = transform(cmd.x, cmd.y);
					edges.push({ type: "cubic", p0: currentPoint, p1, p2, p3 });
					currentPoint = p3;
				}
				break;

			case "Z":
				// Close path with a line back to start
				if (currentPoint && firstPoint) {
					// Only add closing edge if not already at start
					if (
						Math.abs(currentPoint.x - firstPoint.x) > 0.001 ||
						Math.abs(currentPoint.y - firstPoint.y) > 0.001
					) {
						edges.push({ type: "line", p0: currentPoint, p1: firstPoint });
					}
					currentPoint = firstPoint;
				}
				break;
		}
	}

	return edges;
}

/**
 * Compute distance from point to edge
 */
function distanceToEdge(px: number, py: number, edge: Edge): number {
	switch (edge.type) {
		case "line":
			return distanceToLine(px, py, edge.p0, edge.p1);
		case "quadratic":
			return distanceToQuadratic(px, py, edge.p0, edge.p1, edge.p2);
		case "cubic":
			return distanceToCubic(px, py, edge.p0, edge.p1, edge.p2, edge.p3);
	}
}

/**
 * Distance from point to line segment
 */
function distanceToLine(px: number, py: number, p0: Point, p1: Point): number {
	const dx = p1.x - p0.x;
	const dy = p1.y - p0.y;
	const lenSq = dx * dx + dy * dy;

	if (lenSq < 0.0001) {
		// Degenerate segment - just distance to point
		const dpx = px - p0.x;
		const dpy = py - p0.y;
		return Math.sqrt(dpx * dpx + dpy * dpy);
	}

	// Project point onto line
	let t = ((px - p0.x) * dx + (py - p0.y) * dy) / lenSq;
	t = Math.max(0, Math.min(1, t)); // Clamp to segment

	const closestX = p0.x + t * dx;
	const closestY = p0.y + t * dy;

	const distX = px - closestX;
	const distY = py - closestY;
	return Math.sqrt(distX * distX + distY * distY);
}

/**
 * Distance from point to quadratic bezier curve
 * Uses sampling approximation for simplicity
 */
function distanceToQuadratic(
	px: number,
	py: number,
	p0: Point,
	p1: Point,
	p2: Point,
): number {
	let minDist = Infinity;

	// Sample the curve at multiple points
	const samples = 32;
	for (let i = 0; i <= samples; i++) {
		const t = i / samples;
		const ti = 1 - t;

		// Quadratic bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
		const x = ti * ti * p0.x + 2 * ti * t * p1.x + t * t * p2.x;
		const y = ti * ti * p0.y + 2 * ti * t * p1.y + t * t * p2.y;

		const dx = px - x;
		const dy = py - y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		minDist = Math.min(minDist, dist);
	}

	return minDist;
}

/**
 * Distance from point to cubic bezier curve
 * Uses sampling approximation for simplicity
 */
function distanceToCubic(
	px: number,
	py: number,
	p0: Point,
	p1: Point,
	p2: Point,
	p3: Point,
): number {
	let minDist = Infinity;

	// Sample the curve at multiple points
	const samples = 32;
	for (let i = 0; i <= samples; i++) {
		const t = i / samples;
		const ti = 1 - t;

		// Cubic bezier: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
		const x =
			ti * ti * ti * p0.x +
			3 * ti * ti * t * p1.x +
			3 * ti * t * t * p2.x +
			t * t * t * p3.x;
		const y =
			ti * ti * ti * p0.y +
			3 * ti * ti * t * p1.y +
			3 * ti * t * t * p2.y +
			t * t * t * p3.y;

		const dx = px - x;
		const dy = py - y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		minDist = Math.min(minDist, dist);
	}

	return minDist;
}

/**
 * Determine if a point is inside the outline using ray casting
 * (even-odd rule)
 */
function isPointInside(px: number, py: number, edges: Edge[]): boolean {
	let crossings = 0;

	for (let i = 0; i < edges.length; i++) {
		const edge = edges[i]!;
		// Flatten curves to line segments for inside test
		const points = flattenEdge(edge);

		for (let j = 0; j < points.length - 1; j++) {
			const p0 = points[j];
			const p1 = points[j + 1];
			if (!p0 || !p1) continue;

			// Ray casting: cast horizontal ray to the right from (px, py)
			// Check if it crosses this edge
			if (p0.y > py !== p1.y > py) {
				// Edge crosses the horizontal line at y = py
				const slope = (p1.x - p0.x) / (p1.y - p0.y);
				const x = p0.x + slope * (py - p0.y);

				if (px < x) {
					crossings++;
				}
			}
		}
	}

	// Odd number of crossings = inside
	return (crossings & 1) === 1;
}

/**
 * Flatten an edge to a sequence of points for inside testing
 */
function flattenEdge(edge: Edge): Point[] {
	switch (edge.type) {
		case "line":
			return [edge.p0, edge.p1];

		case "quadratic": {
			const points: Point[] = [edge.p0];
			const samples = 16;
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
			const samples = 16;
			for (let i = 1; i <= samples; i++) {
				const t = i / samples;
				const ti = 1 - t;
				points.push({
					x:
						ti * ti * ti * edge.p0.x +
						3 * ti * ti * t * edge.p1.x +
						3 * ti * t * t * edge.p2.x +
						t * t * t * edge.p3.x,
					y:
						ti * ti * ti * edge.p0.y +
						3 * ti * ti * t * edge.p1.y +
						3 * ti * t * t * edge.p2.y +
						t * t * t * edge.p3.y,
				});
			}
			return points;
		}
	}
}
