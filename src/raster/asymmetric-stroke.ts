/**
 * Asymmetric Stroke
 *
 * Generates stroked outlines with independent X and Y border widths.
 * This enables effects like directional shadows, stretched borders,
 * and other asymmetric outline effects.
 *
 * The algorithm:
 * 1. Flatten curves to polylines with configurable precision
 * 2. For each segment, compute offset vectors scaled by (xBorder, yBorder)
 * 3. Handle line joins (miter, round, bevel)
 * 4. Generate both inner and outer contours for closed paths
 * 5. Handle caps for open paths
 */

import type { GlyphPath, PathCommand } from "../render/path.ts";

/**
 * Options for asymmetric stroking
 */
export interface AsymmetricStrokeOptions {
	/** X-axis border width (in font units) */
	xBorder: number;
	/** Y-axis border width (in font units) */
	yBorder: number;
	/** Precision for curve flattening (smaller = more accurate, default: 1) */
	eps?: number;
	/** Line join style (default: "round") */
	lineJoin?: "miter" | "round" | "bevel";
	/** Miter limit for miter joins (default: 4) */
	miterLimit?: number;
}

interface Point {
	x: number;
	y: number;
}

interface Normal {
	x: number;
	y: number;
	len: number;
}

/**
 * Compute the asymmetric offset for a direction vector
 * The offset is perpendicular to the direction, scaled by (xBorder, yBorder)
 */
function computeAsymmetricOffset(
	dx: number,
	dy: number,
	xBorder: number,
	yBorder: number,
): Normal {
	// Perpendicular direction (rotated 90° CCW): (-dy, dx)
	// Scale by border widths
	const px = -dy * yBorder;
	const py = dx * xBorder;

	// Length of scaled perpendicular
	const len = Math.sqrt(px * px + py * py);
	if (len < 1e-10) {
		return { x: 0, y: 0, len: 0 };
	}

	// Normalize
	return {
		x: px / len,
		y: py / len,
		len,
	};
}

/**
 * Flatten a quadratic Bézier curve to line segments
 */
function flattenQuadratic(
	p0: Point,
	p1: Point,
	p2: Point,
	eps: number,
	result: Point[],
): void {
	// Check if flat enough using distance from control point to line
	const dx = p2.x - p0.x;
	const dy = p2.y - p0.y;
	const d =
		Math.abs((p1.x - p0.x) * dy - (p1.y - p0.y) * dx) /
		Math.sqrt(dx * dx + dy * dy + 1e-10);

	if (d <= eps) {
		result.push(p2);
		return;
	}

	// Subdivide using de Casteljau
	const p01: Point = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
	const p12: Point = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
	const p012: Point = { x: (p01.x + p12.x) / 2, y: (p01.y + p12.y) / 2 };

	flattenQuadratic(p0, p01, p012, eps, result);
	flattenQuadratic(p012, p12, p2, eps, result);
}

/**
 * Flatten a cubic Bézier curve to line segments
 */
function flattenCubic(
	p0: Point,
	p1: Point,
	p2: Point,
	p3: Point,
	eps: number,
	result: Point[],
): void {
	// Check flatness using max distance of control points from line
	const dx = p3.x - p0.x;
	const dy = p3.y - p0.y;
	const lenSq = dx * dx + dy * dy + 1e-10;
	const d1 =
		Math.abs((p1.x - p0.x) * dy - (p1.y - p0.y) * dx) / Math.sqrt(lenSq);
	const d2 =
		Math.abs((p2.x - p0.x) * dy - (p2.y - p0.y) * dx) / Math.sqrt(lenSq);

	if (d1 <= eps && d2 <= eps) {
		result.push(p3);
		return;
	}

	// Subdivide using de Casteljau
	const p01: Point = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
	const p12: Point = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
	const p23: Point = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
	const p012: Point = { x: (p01.x + p12.x) / 2, y: (p01.y + p12.y) / 2 };
	const p123: Point = { x: (p12.x + p23.x) / 2, y: (p12.y + p23.y) / 2 };
	const p0123: Point = { x: (p012.x + p123.x) / 2, y: (p012.y + p123.y) / 2 };

	flattenCubic(p0, p01, p012, p0123, eps, result);
	flattenCubic(p0123, p123, p23, p3, eps, result);
}

/**
 * Convert path commands to polyline contours
 */
function pathToContours(
	path: GlyphPath,
	eps: number,
): { points: Point[]; closed: boolean }[] {
	const contours: { points: Point[]; closed: boolean }[] = [];
	let current: Point[] = [];
	let curPoint: Point = { x: 0, y: 0 };
	let startPoint: Point = { x: 0, y: 0 };

	for (let i = 0; i < path.commands.length; i++) {
		const cmd = path.commands[i]!;
		switch (cmd.type) {
			case "M":
				if (current.length > 1) {
					contours.push({ points: current, closed: false });
				}
				curPoint = { x: cmd.x, y: cmd.y };
				startPoint = curPoint;
				current = [curPoint];
				break;

			case "L":
				curPoint = { x: cmd.x, y: cmd.y };
				current.push(curPoint);
				break;

			case "Q":
				flattenQuadratic(
					curPoint,
					{ x: cmd.x1, y: cmd.y1 },
					{ x: cmd.x, y: cmd.y },
					eps,
					current,
				);
				curPoint = { x: cmd.x, y: cmd.y };
				break;

			case "C":
				flattenCubic(
					curPoint,
					{ x: cmd.x1, y: cmd.y1 },
					{ x: cmd.x2, y: cmd.y2 },
					{ x: cmd.x, y: cmd.y },
					eps,
					current,
				);
				curPoint = { x: cmd.x, y: cmd.y };
				break;

			case "Z":
				// Close path - connect back to start if needed
				if (current.length > 1) {
					// Check if already closed
					const first = current[0];
					const last = current[current.length - 1];
					if (first && last) {
						const dx = last.x - first.x;
						const dy = last.y - first.y;
						if (dx * dx + dy * dy > eps * eps) {
							current.push({ ...first });
						}
					}
					contours.push({ points: current, closed: true });
				}
				current = [];
				curPoint = startPoint;
				break;
		}
	}

	// Handle unclosed path
	if (current.length > 1) {
		contours.push({ points: current, closed: false });
	}

	return contours;
}

/**
 * Add a round join between two segments
 */
function addRoundJoin(
	result: Point[],
	center: Point,
	normal0: Normal,
	normal1: Normal,
	xBorder: number,
	yBorder: number,
	outer: boolean,
): void {
	// Compute angle between normals
	const dot = normal0.x * normal1.x + normal0.y * normal1.y;
	const cross = normal0.x * normal1.y - normal0.y * normal1.x;
	const angle = Math.atan2(cross, dot);

	// Number of segments for the arc
	const numSegments = Math.max(2, Math.ceil(Math.abs(angle) / (Math.PI / 8)));

	const sign = outer ? 1 : -1;
	const startAngle = Math.atan2(normal0.y, normal0.x);

	for (let i = 1; i <= numSegments; i++) {
		const t = i / numSegments;
		const currentAngle = startAngle + angle * t;
		const nx = Math.cos(currentAngle);
		const ny = Math.sin(currentAngle);
		result.push({
			x: center.x + nx * xBorder * sign,
			y: center.y + ny * yBorder * sign,
		});
	}
}

/**
 * Add a miter join between two segments
 */
function addMiterJoin(
	result: Point[],
	center: Point,
	normal0: Normal,
	normal1: Normal,
	xBorder: number,
	yBorder: number,
	miterLimit: number,
	outer: boolean,
): boolean {
	const sign = outer ? 1 : -1;

	// Compute miter point
	const dot = normal0.x * normal1.x + normal0.y * normal1.y;
	const sinHalfAngle = Math.sqrt((1 - dot) / 2);

	if (sinHalfAngle < 1e-10) {
		return false; // Nearly parallel
	}

	const miterLength = 1 / sinHalfAngle;

	if (miterLength > miterLimit) {
		return false; // Exceeds miter limit, use bevel
	}

	// Miter direction (bisector)
	const mx = normal0.x + normal1.x;
	const my = normal0.y + normal1.y;
	const mlen = Math.sqrt(mx * mx + my * my);

	if (mlen < 1e-10) {
		return false;
	}

	const miterDist =
		(miterLength * Math.sqrt(xBorder * xBorder + yBorder * yBorder)) / 2;

	result.push({
		x: center.x + (mx / mlen) * miterDist * sign,
		y: center.y + (my / mlen) * miterDist * sign,
	});

	return true;
}

/**
 * Stroke a single closed contour with asymmetric borders
 * Returns both outer and inner contours
 */
function strokeClosedContour(
	points: Point[],
	xBorder: number,
	yBorder: number,
	lineJoin: "miter" | "round" | "bevel",
	miterLimit: number,
): { outer: Point[]; inner: Point[] } {
	const n = points.length;
	if (n < 3) {
		return { outer: [], inner: [] };
	}

	// Remove duplicate closing point if present
	const lastIdx = n - 1;
	const first = points[0];
	const last = points[lastIdx];
	let effectiveN = n;
	if (first && last) {
		const dx = last.x - first.x;
		const dy = last.y - first.y;
		if (dx * dx + dy * dy < 1) {
			effectiveN = n - 1;
		}
	}

	if (effectiveN < 3) {
		return { outer: [], inner: [] };
	}

	// Compute normals for each segment
	const normals: Normal[] = [];
	for (let i = 0; i < effectiveN; i++) {
		const p0 = points[i];
		const p1 = points[(i + 1) % effectiveN];
		if (!p0 || !p1) continue;

		const dx = p1.x - p0.x;
		const dy = p1.y - p0.y;
		const len = Math.sqrt(dx * dx + dy * dy);

		if (len < 1e-10) {
			normals.push({ x: 0, y: 0, len: 0 });
		} else {
			normals.push(
				computeAsymmetricOffset(dx / len, dy / len, xBorder, yBorder),
			);
		}
	}

	const outer: Point[] = [];
	const inner: Point[] = [];

	// Generate outer contour
	for (let i = 0; i < effectiveN; i++) {
		const pt = points[i];
		const prevNormal = normals[(i - 1 + effectiveN) % effectiveN];
		const nextNormal = normals[i];
		if (!pt || !prevNormal || !nextNormal) continue;

		// Skip zero-length segments
		if (prevNormal.len < 1e-10 || nextNormal.len < 1e-10) {
			outer.push({
				x: pt.x + (nextNormal.len > 0 ? nextNormal.x * xBorder : 0),
				y: pt.y + (nextNormal.len > 0 ? nextNormal.y * yBorder : 0),
			});
			continue;
		}

		// First point of segment
		const offsetPt: Point = {
			x: pt.x + nextNormal.x * xBorder,
			y: pt.y + nextNormal.y * yBorder,
		};

		// Check if we need a join
		const cross = prevNormal.x * nextNormal.y - prevNormal.y * nextNormal.x;
		const isConvex = cross > 0;

		if (Math.abs(cross) < 0.01) {
			// Nearly parallel
			outer.push(offsetPt);
		} else if (isConvex) {
			// Convex corner - add join
			switch (lineJoin) {
				case "round":
					addRoundJoin(
						outer,
						pt,
						prevNormal,
						nextNormal,
						xBorder,
						yBorder,
						true,
					);
					break;
				case "miter":
					if (
						!addMiterJoin(
							outer,
							pt,
							prevNormal,
							nextNormal,
							xBorder,
							yBorder,
							miterLimit,
							true,
						)
					) {
						outer.push(offsetPt);
					}
					break;
				default:
					outer.push(offsetPt);
					break;
			}
		} else {
			// Concave corner - just add the point
			outer.push(offsetPt);
		}
	}

	// Generate inner contour (reverse direction)
	for (let i = 0; i < effectiveN; i++) {
		const pt = points[i];
		const prevNormal = normals[(i - 1 + effectiveN) % effectiveN];
		const nextNormal = normals[i];
		if (!pt || !prevNormal || !nextNormal) continue;

		if (prevNormal.len < 1e-10 || nextNormal.len < 1e-10) {
			inner.push({
				x: pt.x - (nextNormal.len > 0 ? nextNormal.x * xBorder : 0),
				y: pt.y - (nextNormal.len > 0 ? nextNormal.y * yBorder : 0),
			});
			continue;
		}

		const offsetPt: Point = {
			x: pt.x - nextNormal.x * xBorder,
			y: pt.y - nextNormal.y * yBorder,
		};

		const cross = prevNormal.x * nextNormal.y - prevNormal.y * nextNormal.x;
		const isConvex = cross < 0; // Reversed for inner

		if (Math.abs(cross) < 0.01) {
			inner.push(offsetPt);
		} else if (isConvex) {
			switch (lineJoin) {
				case "round":
					addRoundJoin(
						inner,
						pt,
						prevNormal,
						nextNormal,
						xBorder,
						yBorder,
						false,
					);
					break;
				case "miter":
					if (
						!addMiterJoin(
							inner,
							pt,
							prevNormal,
							nextNormal,
							xBorder,
							yBorder,
							miterLimit,
							false,
						)
					) {
						inner.push(offsetPt);
					}
					break;
				default:
					inner.push(offsetPt);
					break;
			}
		} else {
			inner.push(offsetPt);
		}
	}

	return { outer, inner };
}

/**
 * Convert points back to path commands
 */
function pointsToPath(points: Point[], closed: boolean): PathCommand[] {
	if (points.length === 0) return [];

	const commands: PathCommand[] = [];
	const first = points[0];
	if (!first) return [];

	commands.push({ type: "M", x: first.x, y: first.y });

	for (let i = 1; i < points.length; i++) {
		const pt = points[i];
		if (!pt) continue;
		commands.push({ type: "L", x: pt.x, y: pt.y });
	}

	if (closed) {
		commands.push({ type: "Z" });
	}

	return commands;
}

/**
 * Stroke a path with asymmetric X/Y borders
 *
 * @param path Input path to stroke
 * @param options Stroke options including xBorder and yBorder
 * @returns Two paths: outer (positive offset) and inner (negative offset)
 *
 * For filled text with border:
 * - Combine outer outline with original fill
 * - Or use outer outline alone for hollow border effect
 */
export function strokeAsymmetric(
	path: GlyphPath,
	options: AsymmetricStrokeOptions,
): { outer: GlyphPath; inner: GlyphPath } {
	const {
		xBorder,
		yBorder,
		eps = 1,
		lineJoin = "round",
		miterLimit = 4,
	} = options;

	if (xBorder <= 0 && yBorder <= 0) {
		return {
			outer: { commands: [], bounds: null },
			inner: { commands: [], bounds: null },
		};
	}

	// Flatten path to polylines
	const contours = pathToContours(path, eps);

	const outerCommands: PathCommand[] = [];
	const innerCommands: PathCommand[] = [];

	for (let i = 0; i < contours.length; i++) {
		const contour = contours[i]!;
		if (!contour.closed) {
			// For open paths, we'd need to handle caps
			// For now, treat as closed by connecting ends
			const firstPoint = contour.points[0];
			if (firstPoint) contour.points.push(firstPoint);
			contour.closed = true;
		}

		const { outer, inner } = strokeClosedContour(
			contour.points,
			xBorder,
			yBorder,
			lineJoin,
			miterLimit,
		);

		outerCommands.push(...pointsToPath(outer, true));
		innerCommands.push(...pointsToPath(inner, true));
	}

	// Compute bounds
	let outerBounds = null;
	let innerBounds = null;

	if (path.bounds) {
		outerBounds = {
			xMin: path.bounds.xMin - xBorder,
			yMin: path.bounds.yMin - yBorder,
			xMax: path.bounds.xMax + xBorder,
			yMax: path.bounds.yMax + yBorder,
		};
		innerBounds = {
			xMin: path.bounds.xMin + xBorder,
			yMin: path.bounds.yMin + yBorder,
			xMax: path.bounds.xMax - xBorder,
			yMax: path.bounds.yMax - yBorder,
		};
	}

	return {
		outer: { commands: outerCommands, bounds: outerBounds, flags: path.flags },
		inner: { commands: innerCommands, bounds: innerBounds, flags: path.flags },
	};
}

/**
 * Create a combined stroke path (both inner and outer as single path)
 * This creates a ring/donut shape that can be filled
 */
export function strokeAsymmetricCombined(
	path: GlyphPath,
	options: AsymmetricStrokeOptions,
): GlyphPath {
	const { outer, inner } = strokeAsymmetric(path, options);

	// Combine both paths - outer goes clockwise, inner goes counter-clockwise
	// This creates a fillable ring shape
	const commands: PathCommand[] = [...outer.commands, ...inner.commands];

	const bounds = outer.bounds;

	return { commands, bounds, flags: path.flags };
}

/**
 * Stroke with uniform border (convenience function)
 */
export function strokeUniform(
	path: GlyphPath,
	border: number,
	options?: Omit<AsymmetricStrokeOptions, "xBorder" | "yBorder">,
): { outer: GlyphPath; inner: GlyphPath } {
	return strokeAsymmetric(path, {
		xBorder: border,
		yBorder: border,
		...options,
	});
}
