/**
 * Synthetic Font Effects
 *
 * Provides transformations for creating synthetic bold, italic, and other effects
 * on glyph outlines. These are useful for fonts that don't have native bold/italic
 * variants.
 */

import type { GlyphPath, PathCommand } from "../render/path.ts";

function computeBounds(commands: PathCommand[]): {
	xMin: number;
	yMin: number;
	xMax: number;
	yMax: number;
} | null {
	let xMin = Infinity;
	let yMin = Infinity;
	let xMax = -Infinity;
	let yMax = -Infinity;

	for (const cmd of commands) {
		switch (cmd.type) {
			case "M":
			case "L":
				xMin = Math.min(xMin, cmd.x);
				xMax = Math.max(xMax, cmd.x);
				yMin = Math.min(yMin, cmd.y);
				yMax = Math.max(yMax, cmd.y);
				break;
			case "Q":
				xMin = Math.min(xMin, cmd.x, cmd.x1);
				xMax = Math.max(xMax, cmd.x, cmd.x1);
				yMin = Math.min(yMin, cmd.y, cmd.y1);
				yMax = Math.max(yMax, cmd.y, cmd.y1);
				break;
			case "C":
				xMin = Math.min(xMin, cmd.x, cmd.x1, cmd.x2);
				xMax = Math.max(xMax, cmd.x, cmd.x1, cmd.x2);
				yMin = Math.min(yMin, cmd.y, cmd.y1, cmd.y2);
				yMax = Math.max(yMax, cmd.y, cmd.y1, cmd.y2);
				break;
			case "Z":
				break;
		}
	}

	if (!Number.isFinite(xMin)) return null;
	return { xMin, yMin, xMax, yMax };
}

/**
 * Apply oblique (slant/italic) transformation to a path
 *
 * @param path - The glyph path to transform
 * @param slant - Tangent of the slant angle (0.2 = ~12 degrees, typical italic)
 * @returns New path with slant applied
 *
 * Transform: x' = x + y * slant, y' = y
 */
export function obliquePath(path: GlyphPath, slant: number): GlyphPath {
	const commands: PathCommand[] = [];

	for (const cmd of path.commands) {
		switch (cmd.type) {
			case "M":
			case "L":
				commands.push({
					type: cmd.type,
					x: cmd.x + cmd.y * slant,
					y: cmd.y,
				});
				break;
			case "Q":
				commands.push({
					type: "Q",
					x1: cmd.x1 + cmd.y1 * slant,
					y1: cmd.y1,
					x: cmd.x + cmd.y * slant,
					y: cmd.y,
				});
				break;
			case "C":
				commands.push({
					type: "C",
					x1: cmd.x1 + cmd.y1 * slant,
					y1: cmd.y1,
					x2: cmd.x2 + cmd.y2 * slant,
					y2: cmd.y2,
					x: cmd.x + cmd.y * slant,
					y: cmd.y,
				});
				break;
			case "Z":
				commands.push({ type: "Z" });
				break;
		}
	}

	// Update bounds
	const bounds = computeBounds(commands);

	return { commands, bounds, flags: path.flags };
}

/**
 * Apply general 2D affine transformation to a path
 *
 * @param path - The glyph path to transform
 * @param matrix - 2D transformation matrix [a, b, c, d, e, f]
 * @returns New path with transformation applied
 *
 * Transform: x' = a*x + c*y + e, y' = b*x + d*y + f
 */
export function transformPath(
	path: GlyphPath,
	matrix: [number, number, number, number, number, number],
): GlyphPath {
	const [a, b, c, d, e, f] = matrix;

	const transformPoint = (x: number, y: number) => ({
		x: a * x + c * y + e,
		y: b * x + d * y + f,
	});

	const commands: PathCommand[] = [];

	for (const cmd of path.commands) {
		switch (cmd.type) {
			case "M":
			case "L": {
				const p = transformPoint(cmd.x, cmd.y);
				commands.push({
					type: cmd.type,
					x: p.x,
					y: p.y,
				});
				break;
			}
			case "Q": {
				const p1 = transformPoint(cmd.x1, cmd.y1);
				const p = transformPoint(cmd.x, cmd.y);
				commands.push({
					type: "Q",
					x1: p1.x,
					y1: p1.y,
					x: p.x,
					y: p.y,
				});
				break;
			}
			case "C": {
				const p1 = transformPoint(cmd.x1, cmd.y1);
				const p2 = transformPoint(cmd.x2, cmd.y2);
				const p = transformPoint(cmd.x, cmd.y);
				commands.push({
					type: "C",
					x1: p1.x,
					y1: p1.y,
					x2: p2.x,
					y2: p2.y,
					x: p.x,
					y: p.y,
				});
				break;
			}
			case "Z":
				commands.push({ type: "Z" });
				break;
		}
	}

	// Update bounds
	const bounds = computeBounds(commands);

	return { commands, bounds, flags: path.flags };
}

/**
 * Apply horizontal scaling (condensing/expanding) to a path
 *
 * @param path - The glyph path to transform
 * @param factor - Horizontal scale factor (< 1 = narrower, > 1 = wider)
 * @returns New path with horizontal scaling applied
 *
 * Transform: x' = x * factor, y' = y
 */
export function condensePath(path: GlyphPath, factor: number): GlyphPath {
	const commands: PathCommand[] = [];

	for (const cmd of path.commands) {
		switch (cmd.type) {
			case "M":
			case "L":
				commands.push({
					type: cmd.type,
					x: cmd.x * factor,
					y: cmd.y,
				});
				break;
			case "Q":
				commands.push({
					type: "Q",
					x1: cmd.x1 * factor,
					y1: cmd.y1,
					x: cmd.x * factor,
					y: cmd.y,
				});
				break;
			case "C":
				commands.push({
					type: "C",
					x1: cmd.x1 * factor,
					y1: cmd.y1,
					x2: cmd.x2 * factor,
					y2: cmd.y2,
					x: cmd.x * factor,
					y: cmd.y,
				});
				break;
			case "Z":
				commands.push({ type: "Z" });
				break;
		}
	}

	// Update bounds
	let bounds = path.bounds;
	if (bounds) {
		bounds = {
			xMin: bounds.xMin * factor,
			yMin: bounds.yMin,
			xMax: bounds.xMax * factor,
			yMax: bounds.yMax,
		};
	}

	return { commands, bounds, flags: path.flags };
}

/**
 * Embolden (make bolder) a path by offsetting the outline
 *
 * This implementation uses a simplified approach that offsets each contour
 * outward by moving points along the normal direction. For production use,
 * a proper stroking algorithm would be more accurate.
 *
 * @param path - The glyph path to embolden
 * @param strength - Offset strength in font units (positive = bolder, negative = thinner)
 * @returns New path with emboldening applied
 */
export function emboldenPath(path: GlyphPath, strength: number): GlyphPath {
	if (strength === 0) {
		// Just return a copy with slightly processed structure
		return { ...path, commands: [...path.commands] };
	}

	// Extract contours from path
	const contours = extractContours(path);
	const commands: PathCommand[] = [];

	for (const contour of contours) {
		if (contour.length < 3) continue;

		// Offset the contour
		const offsetContour = offsetPolygon(contour, strength);

		// Convert back to commands
		if (offsetContour.length > 0) {
			commands.push({
				type: "M",
				x: offsetContour[0].x,
				y: offsetContour[0].y,
			});
			for (let i = 1; i < offsetContour.length; i++) {
				commands.push({
					type: "L",
					x: offsetContour[i].x,
					y: offsetContour[i].y,
				});
			}
			commands.push({ type: "Z" });
		}
	}

	// Calculate new bounds
	let bounds = null;
	if (commands.length > 0) {
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;

		for (const cmd of commands) {
			if (cmd.type === "M" || cmd.type === "L") {
				minX = Math.min(minX, cmd.x);
				minY = Math.min(minY, cmd.y);
				maxX = Math.max(maxX, cmd.x);
				maxY = Math.max(maxY, cmd.y);
			}
		}

		if (Number.isFinite(minX)) {
			bounds = { xMin: minX, yMin: minY, xMax: maxX, yMax: maxY };
		}
	}

	return { commands, bounds, flags: path.flags };
}

/**
 * Point structure for contour processing
 */
interface Point {
	x: number;
	y: number;
}

/**
 * Extract contours from a path as arrays of points
 */
function extractContours(path: GlyphPath): Point[][] {
	const contours: Point[][] = [];
	let currentContour: Point[] = [];

	for (const cmd of path.commands) {
		switch (cmd.type) {
			case "M":
				if (currentContour.length > 0) {
					contours.push(currentContour);
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
					for (let i = 1; i <= steps; i++) {
						const t = i / steps;
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
					for (let i = 1; i <= steps; i++) {
						const t = i / steps;
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
					contours.push(currentContour);
					currentContour = [];
				}
				break;
		}
	}

	if (currentContour.length > 0) {
		contours.push(currentContour);
	}

	return contours;
}

/**
 * Offset a polygon (contour) by a given distance
 *
 * This uses a simple approach of moving each point along the average
 * normal of its adjacent edges. For better quality, a proper polygon
 * offsetting algorithm should be used (e.g., Clipper library approach).
 */
function offsetPolygon(points: Point[], offset: number): Point[] {
	const n = points.length;
	if (n < 3) return points;

	// Determine winding order (clockwise or counter-clockwise)
	let area = 0;
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n;
		const p1 = points[i];
		const p2 = points[j];
		if (p1 && p2) {
			area += (p2.x - p1.x) * (p2.y + p1.y);
		}
	}

	// For counter-clockwise (positive area), positive offset expands
	// For clockwise (negative area), we need to flip the offset
	const sign = area < 0 ? -1 : 1;
	const actualOffset = offset * sign;

	const result: Point[] = [];

	for (let i = 0; i < n; i++) {
		const prev = points[(i - 1 + n) % n];
		const curr = points[i];
		const next = points[(i + 1) % n];

		if (!prev || !curr || !next) continue;

		// Compute edge vectors
		const edge1 = { x: curr.x - prev.x, y: curr.y - prev.y };
		const edge2 = { x: next.x - curr.x, y: next.y - curr.y };

		// Normalize edges
		const len1 = Math.sqrt(edge1.x * edge1.x + edge1.y * edge1.y);
		const len2 = Math.sqrt(edge2.x * edge2.x + edge2.y * edge2.y);

		if (len1 === 0 || len2 === 0) {
			result.push(curr);
			continue;
		}

		edge1.x /= len1;
		edge1.y /= len1;
		edge2.x /= len2;
		edge2.y /= len2;

		// Compute normals (perpendicular, pointing outward for CCW)
		const normal1 = { x: -edge1.y, y: edge1.x };
		const normal2 = { x: -edge2.y, y: edge2.x };

		// Average normal
		let normalX = (normal1.x + normal2.x) / 2;
		let normalY = (normal1.y + normal2.y) / 2;

		// Normalize the average normal
		const normalLen = Math.sqrt(normalX * normalX + normalY * normalY);
		if (normalLen > 0.001) {
			normalX /= normalLen;
			normalY /= normalLen;

			// Compute the offset scaling factor based on the angle
			// For sharp angles, we need to extend the offset
			const dot = normal1.x * normal2.x + normal1.y * normal2.y;
			const scale = dot > -0.999 ? 1 / Math.sqrt((1 + dot) / 2) : 1;

			// Limit the scale to prevent extreme offsets at very sharp angles
			const limitedScale = Math.min(scale, 3);

			result.push({
				x: curr.x + normalX * actualOffset * limitedScale,
				y: curr.y + normalY * actualOffset * limitedScale,
			});
		} else {
			result.push(curr);
		}
	}

	return result;
}
