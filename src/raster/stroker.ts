/**
 * Path Stroker
 *
 * Converts a path outline into a stroked outline that can be filled.
 * Based on FreeType's ftstroke.c algorithm.
 *
 * The stroker generates two borders (inside and outside) by offsetting
 * the original path by half the stroke width in both directions.
 */

import type { GlyphPath, PathCommand } from "../render/path.ts";

/** Line cap styles */
export type LineCap = "butt" | "round" | "square";

/** Line join styles */
export type LineJoin = "miter" | "round" | "bevel";

/** Stroker options */
export interface StrokerOptions {
	/** Stroke width in font units */
	width: number;
	/** Line cap style (default: "butt") */
	lineCap?: LineCap;
	/** Line join style (default: "miter") */
	lineJoin?: LineJoin;
	/** Miter limit for miter joins (default: 4) */
	miterLimit?: number;
}

interface Point {
	x: number;
	y: number;
}

interface Vector {
	x: number;
	y: number;
}

/**
 * Normalize a vector to unit length
 */
function normalize(v: Vector): Vector {
	const len = Math.sqrt(v.x * v.x + v.y * v.y);
	if (len === 0) return { x: 0, y: 0 };
	return { x: v.x / len, y: v.y / len };
}

/**
 * Get perpendicular vector (rotate 90 degrees counter-clockwise)
 */
function perp(v: Vector): Vector {
	return { x: -v.y, y: v.x };
}

/**
 * Compute angle between two vectors (in radians)
 */
function angleBetween(v1: Vector, v2: Vector): number {
	const dot = v1.x * v2.x + v1.y * v2.y;
	const cross = v1.x * v2.y - v1.y * v2.x;
	return Math.atan2(cross, dot);
}

/**
 * Add round cap at a point
 */
function addRoundCap(
	commands: PathCommand[],
	center: Point,
	direction: Vector,
	radius: number,
	clockwise: boolean,
): void {
	// Perpendicular direction
	const perpDir = perp(direction);

	// Start and end points of the arc
	const start: Point = {
		x: center.x + perpDir.x * radius * (clockwise ? 1 : -1),
		y: center.y + perpDir.y * radius * (clockwise ? 1 : -1),
	};
	const end: Point = {
		x: center.x - perpDir.x * radius * (clockwise ? 1 : -1),
		y: center.y - perpDir.y * radius * (clockwise ? 1 : -1),
	};

	// Approximate semicircle with two quadratic curves
	const mid: Point = {
		x: center.x + direction.x * radius,
		y: center.y + direction.y * radius,
	};

	// Control points for the two quadratic curves
	const ctrl1: Point = {
		x: start.x + direction.x * radius * 0.5523,
		y: start.y + direction.y * radius * 0.5523,
	};
	const ctrl2: Point = {
		x: end.x + direction.x * radius * 0.5523,
		y: end.y + direction.y * radius * 0.5523,
	};

	commands.push({ type: "Q", x1: ctrl1.x, y1: ctrl1.y, x: mid.x, y: mid.y });
	commands.push({ type: "Q", x1: ctrl2.x, y1: ctrl2.y, x: end.x, y: end.y });
}

/**
 * Add square cap at a point
 */
function addSquareCap(
	commands: PathCommand[],
	center: Point,
	direction: Vector,
	radius: number,
): void {
	const perpDir = perp(direction);

	// Extend by half width in the direction
	const extended: Point = {
		x: center.x + direction.x * radius,
		y: center.y + direction.y * radius,
	};

	// Corner points
	const corner1: Point = {
		x: extended.x + perpDir.x * radius,
		y: extended.y + perpDir.y * radius,
	};
	const corner2: Point = {
		x: extended.x - perpDir.x * radius,
		y: extended.y - perpDir.y * radius,
	};

	commands.push({ type: "L", x: corner1.x, y: corner1.y });
	commands.push({ type: "L", x: corner2.x, y: corner2.y });
}

/**
 * Add a line join between two segments
 */
function addJoin(
	commands: PathCommand[],
	point: Point,
	prevDir: Vector,
	nextDir: Vector,
	radius: number,
	lineJoin: LineJoin,
	miterLimit: number,
	outer: boolean,
): void {
	const angle = angleBetween(prevDir, nextDir);
	const isConvex = outer ? angle < 0 : angle > 0;

	if (Math.abs(angle) < 0.01) {
		// Nearly straight - just continue
		return;
	}

	const prevPerp = perp(prevDir);
	const nextPerp = perp(nextDir);
	const sign = outer ? 1 : -1;

	const _prevOffset: Point = {
		x: point.x + prevPerp.x * radius * sign,
		y: point.y + prevPerp.y * radius * sign,
	};
	const nextOffset: Point = {
		x: point.x + nextPerp.x * radius * sign,
		y: point.y + nextPerp.y * radius * sign,
	};

	if (!isConvex) {
		// Inner join - just connect with line
		commands.push({ type: "L", x: nextOffset.x, y: nextOffset.y });
		return;
	}

	// Outer join
	switch (lineJoin) {
		case "round": {
			// Arc from prevOffset to nextOffset
			const arcAngle = Math.abs(angle);
			const numSegments = Math.max(2, Math.ceil(arcAngle / (Math.PI / 4)));

			for (let i = 1; i <= numSegments; i++) {
				const t = i / numSegments;
				const currentAngle =
					Math.atan2(prevPerp.y, prevPerp.x) + angle * t * sign;
				const px = point.x + Math.cos(currentAngle) * radius * sign;
				const py = point.y + Math.sin(currentAngle) * radius * sign;
				commands.push({ type: "L", x: px, y: py });
			}
			break;
		}
		case "miter": {
			// Check miter limit
			const miterLength = 1 / Math.sin(Math.abs(angle) / 2);
			if (miterLength <= miterLimit) {
				// Compute miter point
				const halfAngle = angle / 2;
				const miterDir = normalize({
					x: prevDir.x + nextDir.x,
					y: prevDir.y + nextDir.y,
				});
				const miterDist = radius / Math.cos(halfAngle);
				const miterPoint: Point = {
					x: point.x + miterDir.x * miterDist * sign,
					y: point.y + miterDir.y * miterDist * sign,
				};
				commands.push({ type: "L", x: miterPoint.x, y: miterPoint.y });
				commands.push({ type: "L", x: nextOffset.x, y: nextOffset.y });
			} else {
				// Fall back to bevel
				commands.push({ type: "L", x: nextOffset.x, y: nextOffset.y });
			}
			break;
		}
		default:
			commands.push({ type: "L", x: nextOffset.x, y: nextOffset.y });
			break;
	}
}

/**
 * Stroke a single contour (closed path)
 */
function strokeContour(
	points: Point[],
	options: Required<StrokerOptions>,
): PathCommand[] {
	if (points.length < 2) return [];

	const { width, lineJoin, miterLimit } = options;
	const radius = width / 2;

	const commands: PathCommand[] = [];
	const n = points.length;

	// Compute directions for each segment
	const directions: Vector[] = [];
	for (let i = 0; i < n; i++) {
		const p1 = points[i];
		const p2 = points[(i + 1) % n];
		if (!p1 || !p2) continue;
		directions.push(normalize({ x: p2.x - p1.x, y: p2.y - p1.y }));
	}

	// Generate outer border (going forward)
	const firstDir = directions[0];
	const firstPoint = points[0];
	if (!firstDir || !firstPoint) return [];

	const firstPerp = perp(firstDir);
	commands.push({
		type: "M",
		x: firstPoint.x + firstPerp.x * radius,
		y: firstPoint.y + firstPerp.y * radius,
	});

	for (let i = 0; i < n; i++) {
		const p1 = points[i];
		const p2 = points[(i + 1) % n];
		const dir = directions[i];
		const nextDir = directions[(i + 1) % n];
		if (!p1 || !p2 || !dir || !nextDir) continue;

		const perpDir = perp(dir);

		// Line to end of current segment
		commands.push({
			type: "L",
			x: p2.x + perpDir.x * radius,
			y: p2.y + perpDir.y * radius,
		});

		// Add join
		addJoin(commands, p2, dir, nextDir, radius, lineJoin, miterLimit, true);
	}

	commands.push({ type: "Z" });

	// Generate inner border (going backward)
	const lastIdx = n - 1;
	const lastDir = directions[lastIdx];
	const lastPoint = points[0];
	if (!lastDir || !lastPoint) return commands;

	const lastPerp = perp(firstDir);
	commands.push({
		type: "M",
		x: firstPoint.x - lastPerp.x * radius,
		y: firstPoint.y - lastPerp.y * radius,
	});

	for (let i = 0; i < n; i++) {
		const p1 = points[i];
		const p2 = points[(i + 1) % n];
		const dir = directions[i];
		const nextDir = directions[(i + 1) % n];
		if (!p1 || !p2 || !dir || !nextDir) continue;

		const perpDir = perp(dir);

		// Line to end of current segment (inner side)
		commands.push({
			type: "L",
			x: p2.x - perpDir.x * radius,
			y: p2.y - perpDir.y * radius,
		});

		// Add join (inner)
		addJoin(commands, p2, dir, nextDir, radius, lineJoin, miterLimit, false);
	}

	commands.push({ type: "Z" });

	return commands;
}

/**
 * Stroke an open path (with caps)
 */
function strokeOpenPath(
	points: Point[],
	options: Required<StrokerOptions>,
): PathCommand[] {
	if (points.length < 2) return [];

	const { width, lineCap, lineJoin, miterLimit } = options;
	const radius = width / 2;

	const commands: PathCommand[] = [];
	const n = points.length;

	// Compute directions for each segment
	const directions: Vector[] = [];
	for (let i = 0; i < n - 1; i++) {
		const p1 = points[i];
		const p2 = points[i + 1];
		if (!p1 || !p2) continue;
		directions.push(normalize({ x: p2.x - p1.x, y: p2.y - p1.y }));
	}

	const firstPoint = points[0];
	const lastPoint = points[n - 1];
	const firstDir = directions[0];
	const lastDir = directions[directions.length - 1];
	if (!firstPoint || !lastPoint || !firstDir || !lastDir) return [];

	// Start with cap at beginning
	const firstPerp = perp(firstDir);

	// Start at the right side of the first point
	commands.push({
		type: "M",
		x: firstPoint.x + firstPerp.x * radius,
		y: firstPoint.y + firstPerp.y * radius,
	});

	// Forward pass (right side)
	for (let i = 0; i < n - 1; i++) {
		const p2 = points[i + 1];
		const dir = directions[i];
		const nextDir = directions[i + 1];
		if (!p2 || !dir) continue;

		const perpDir = perp(dir);
		commands.push({
			type: "L",
			x: p2.x + perpDir.x * radius,
			y: p2.y + perpDir.y * radius,
		});

		if (nextDir) {
			addJoin(commands, p2, dir, nextDir, radius, lineJoin, miterLimit, true);
		}
	}

	// End cap
	const _negLastDir: Vector = { x: -lastDir.x, y: -lastDir.y };
	switch (lineCap) {
		case "round":
			addRoundCap(commands, lastPoint, lastDir, radius, true);
			break;
		case "square":
			addSquareCap(commands, lastPoint, lastDir, radius);
			break;
		default: {
			const lastPerp = perp(lastDir);
			commands.push({
				type: "L",
				x: lastPoint.x - lastPerp.x * radius,
				y: lastPoint.y - lastPerp.y * radius,
			});
			break;
		}
	}

	// Backward pass (left side)
	for (let i = n - 2; i >= 0; i--) {
		const p1 = points[i];
		const dir = directions[i];
		const prevDir = directions[i - 1];
		if (!p1 || !dir) continue;

		const perpDir = perp(dir);
		commands.push({
			type: "L",
			x: p1.x - perpDir.x * radius,
			y: p1.y - perpDir.y * radius,
		});

		if (prevDir) {
			addJoin(
				commands,
				p1,
				{ x: -dir.x, y: -dir.y },
				{ x: -prevDir.x, y: -prevDir.y },
				radius,
				lineJoin,
				miterLimit,
				true,
			);
		}
	}

	// Start cap
	const negFirstDir: Vector = { x: -firstDir.x, y: -firstDir.y };
	switch (lineCap) {
		case "round":
			addRoundCap(commands, firstPoint, negFirstDir, radius, true);
			break;
		case "square":
			addSquareCap(commands, firstPoint, negFirstDir, radius);
			break;
		default:
			// Already at the right position, close the path
			break;
	}

	commands.push({ type: "Z" });

	return commands;
}

/**
 * Extract points from path commands
 * Returns an array of contours, each contour is an array of points
 */
function extractContours(
	path: GlyphPath,
): { points: Point[]; closed: boolean }[] {
	const contours: { points: Point[]; closed: boolean }[] = [];
	let currentContour: Point[] = [];

	for (let i = 0; i < path.commands.length; i++) {
		const cmd = path.commands[i]!;
		switch (cmd.type) {
			case "M":
				if (currentContour.length > 0) {
					contours.push({ points: currentContour, closed: false });
				}
				currentContour = [{ x: cmd.x, y: cmd.y }];
				break;
			case "L":
				currentContour.push({ x: cmd.x, y: cmd.y });
				break;
			case "Q": {
				// Flatten quadratic bezier
				const last = currentContour[currentContour.length - 1];
				if (last) {
					const steps = 8;
					for (let j = 1; j <= steps; j++) {
						const t = j / steps;
						const ti = 1 - t;
						const x = ti * ti * last.x + 2 * ti * t * cmd.x1 + t * t * cmd.x;
						const y = ti * ti * last.y + 2 * ti * t * cmd.y1 + t * t * cmd.y;
						currentContour.push({ x, y });
					}
				}
				break;
			}
			case "C": {
				// Flatten cubic bezier
				const last = currentContour[currentContour.length - 1];
				if (last) {
					const steps = 12;
					for (let j = 1; j <= steps; j++) {
						const t = j / steps;
						const ti = 1 - t;
						const x =
							ti * ti * ti * last.x +
							3 * ti * ti * t * cmd.x1 +
							3 * ti * t * t * cmd.x2 +
							t * t * t * cmd.x;
						const y =
							ti * ti * ti * last.y +
							3 * ti * ti * t * cmd.y1 +
							3 * ti * t * t * cmd.y2 +
							t * t * t * cmd.y;
						currentContour.push({ x, y });
					}
				}
				break;
			}
			case "Z":
				if (currentContour.length > 0) {
					contours.push({ points: currentContour, closed: true });
					currentContour = [];
				}
				break;
		}
	}

	if (currentContour.length > 0) {
		contours.push({ points: currentContour, closed: false });
	}

	return contours;
}

/**
 * Stroke a glyph path, producing a new path that represents the stroked outline
 */
export function strokePath(
	path: GlyphPath,
	options: StrokerOptions,
): GlyphPath {
	const opts: Required<StrokerOptions> = {
		width: options.width,
		lineCap: options.lineCap ?? "butt",
		lineJoin: options.lineJoin ?? "miter",
		miterLimit: options.miterLimit ?? 4,
	};

	const contours = extractContours(path);
	const commands: PathCommand[] = [];

	for (let i = 0; i < contours.length; i++) {
		const contour = contours[i]!;
		if (contour.points.length < 2) continue;

		const contourCommands = contour.closed
			? strokeContour(contour.points, opts)
			: strokeOpenPath(contour.points, opts);

		commands.push(...contourCommands);
	}

	// Calculate new bounds (original bounds + stroke width)
	let bounds = path.bounds;
	if (bounds) {
		const padding = opts.width / 2;
		bounds = {
			xMin: bounds.xMin - padding,
			yMin: bounds.yMin - padding,
			xMax: bounds.xMax + padding,
			yMax: bounds.yMax + padding,
		};
	}

	return { commands, bounds };
}
