/**
 * Decompose path commands into rasterizer calls
 */

import {
	type Contour,
	type GlyphPoint,
} from "../font/tables/glyf.ts";
import {
	type GlyphPath,
	OutlineFlags,
	type PathCommand,
} from "../render/path.ts";
import { ONE_PIXEL } from "./fixed-point.ts";
import type { GrayRaster } from "./gray-raster.ts";
import { FillRule } from "./types.ts";

/**
 * Outline validation error types (like FreeType's error codes)
 */
export enum OutlineError {
	Ok = 0,
	InvalidOutline = 1,
	InvalidArgument = 2,
	EmptyOutline = 3,
}

/**
 * Validation result with error code and message
 */
export interface ValidationResult {
	error: OutlineError;
	message?: string;
}

/**
 * Validate a GlyphPath before rasterization (like FreeType's outline validation)
 * Checks: path existence, command structure validity, and proper contour closure
 * @param path Glyph path to validate
 * @param allowEmpty Whether empty paths are considered valid (default: true)
 * @returns Validation result with error code and optional message
 */
export function validateOutline(
	path: GlyphPath | null | undefined,
	allowEmpty: boolean = true,
): ValidationResult {
	// Check for null/undefined path
	if (!path) {
		return {
			error: OutlineError.InvalidOutline,
			message: "Path is null or undefined",
		};
	}

	// Check commands array exists
	if (!path.commands) {
		return {
			error: OutlineError.InvalidOutline,
			message: "Path commands array is missing",
		};
	}

	// Check for empty path
	if (path.commands.length === 0) {
		if (allowEmpty) {
			return { error: OutlineError.EmptyOutline };
		}
		return { error: OutlineError.InvalidOutline, message: "Path is empty" };
	}

	// Validate command structure
	let hasMove = false;
	let inContour = false;
	let contourCount = 0;

	for (let i = 0; i < path.commands.length; i++) {
		const cmd = path.commands[i];

		switch (cmd.type) {
			case "M":
				if (inContour) {
					// Implicit close - allowed but noted
				}
				hasMove = true;
				inContour = true;
				contourCount++;
				// Validate coordinates are finite numbers
				if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) {
					return {
						error: OutlineError.InvalidOutline,
						message: `Invalid coordinates at command ${i}: (${cmd.x}, ${cmd.y})`,
					};
				}
				break;

			case "L":
				if (!hasMove) {
					return {
						error: OutlineError.InvalidOutline,
						message: `Line command at ${i} without preceding moveTo`,
					};
				}
				if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) {
					return {
						error: OutlineError.InvalidOutline,
						message: `Invalid coordinates at command ${i}`,
					};
				}
				break;

			case "Q":
				if (!hasMove) {
					return {
						error: OutlineError.InvalidOutline,
						message: `Quadratic curve at ${i} without preceding moveTo`,
					};
				}
				if (
					!Number.isFinite(cmd.x1) ||
					!Number.isFinite(cmd.y1) ||
					!Number.isFinite(cmd.x) ||
					!Number.isFinite(cmd.y)
				) {
					return {
						error: OutlineError.InvalidOutline,
						message: `Invalid coordinates at command ${i}`,
					};
				}
				break;

			case "C":
				if (!hasMove) {
					return {
						error: OutlineError.InvalidOutline,
						message: `Cubic curve at ${i} without preceding moveTo`,
					};
				}
				if (
					!Number.isFinite(cmd.x1) ||
					!Number.isFinite(cmd.y1) ||
					!Number.isFinite(cmd.x2) ||
					!Number.isFinite(cmd.y2) ||
					!Number.isFinite(cmd.x) ||
					!Number.isFinite(cmd.y)
				) {
					return {
						error: OutlineError.InvalidOutline,
						message: `Invalid coordinates at command ${i}`,
					};
				}
				break;

			case "Z":
				inContour = false;
				break;

			default:
				return {
					error: OutlineError.InvalidOutline,
					message: `Unknown command type at ${i}: ${(cmd as PathCommand).type}`,
				};
		}
	}

	// Warn if no contours found (valid but useless)
	if (contourCount === 0 && !allowEmpty) {
		return { error: OutlineError.EmptyOutline, message: "No contours in path" };
	}

	return { error: OutlineError.Ok };
}

/**
 * Convert a GlyphPath to rasterizer commands
 * @param raster The rasterizer instance to receive commands
 * @param path Path commands to decompose
 * @param scale Scale factor (font units to pixels)
 * @param offsetX X offset in pixels (default: 0)
 * @param offsetY Y offset in pixels (default: 0)
 * @param flipY Flip Y axis - font coords are Y-up, bitmap is Y-down (default: true)
 */
export function decomposePath(
	raster: GrayRaster,
	path: GlyphPath,
	scale: number,
	offsetX: number = 0,
	offsetY: number = 0,
	flipY: boolean = true,
): void {
	let startX = 0;
	let startY = 0;
	let inContour = false;

	// Precompute scale factors to avoid per-command branching
	const scaleX = scale * ONE_PIXEL;
	const scaleY = (flipY ? -scale : scale) * ONE_PIXEL;
	const offX = offsetX * ONE_PIXEL;
	const offY = offsetY * ONE_PIXEL;

	for (let i = 0; i < path.commands.length; i++) {
		const cmd = path.commands[i]!;
		switch (cmd.type) {
			case "M": {
				// Close previous contour if open
				if (inContour) {
					raster.lineTo(startX, startY);
				}

				// Convert to subpixel coordinates with precomputed factors
				const x = Math.round(cmd.x * scaleX + offX);
				const y = Math.round(cmd.y * scaleY + offY);

				raster.moveTo(x, y);
				startX = x;
				startY = y;
				inContour = true;
				break;
			}

			case "L": {
				const x = Math.round(cmd.x * scaleX + offX);
				const y = Math.round(cmd.y * scaleY + offY);
				raster.lineTo(x, y);
				break;
			}

			case "Q": {
				const cx = Math.round(cmd.x1 * scaleX + offX);
				const cy = Math.round(cmd.y1 * scaleY + offY);
				const x = Math.round(cmd.x * scaleX + offX);
				const y = Math.round(cmd.y * scaleY + offY);
				raster.conicTo(cx, cy, x, y);
				break;
			}

			case "C": {
				const cx1 = Math.round(cmd.x1 * scaleX + offX);
				const cy1 = Math.round(cmd.y1 * scaleY + offY);
				const cx2 = Math.round(cmd.x2 * scaleX + offX);
				const cy2 = Math.round(cmd.y2 * scaleY + offY);
				const x = Math.round(cmd.x * scaleX + offX);
				const y = Math.round(cmd.y * scaleY + offY);
				raster.cubicTo(cx1, cy1, cx2, cy2, x, y);
				break;
			}

			case "Z": {
				// Close contour
				if (inContour) {
					raster.lineTo(startX, startY);
					inContour = false;
				}
				break;
			}
		}
	}

	// Close final contour if still open
	if (inContour) {
		raster.lineTo(startX, startY);
	}
}

function movePoint(
	raster: GrayRaster,
	point: GlyphPoint,
	scaleX: number,
	scaleY: number,
	offX: number,
	offY: number,
): [number, number] {
	const x = Math.round(point.x * scaleX + offX);
	const y = Math.round(point.y * scaleY + offY);
	raster.moveTo(x, y);
	return [x, y];
}

function linePoint(
	raster: GrayRaster,
	point: GlyphPoint,
	scaleX: number,
	scaleY: number,
	offX: number,
	offY: number,
): [number, number] {
	const x = Math.round(point.x * scaleX + offX);
	const y = Math.round(point.y * scaleY + offY);
	raster.lineTo(x, y);
	return [x, y];
}

function conicPoint(
	raster: GrayRaster,
	control: GlyphPoint,
	endX: number,
	endY: number,
	scaleX: number,
	scaleY: number,
	offX: number,
	offY: number,
): [number, number] {
	const cx = Math.round(control.x * scaleX + offX);
	const cy = Math.round(control.y * scaleY + offY);
	const x = Math.round(endX * scaleX + offX);
	const y = Math.round(endY * scaleY + offY);
	raster.conicTo(cx, cy, x, y);
	return [x, y];
}

function cubicPoint(
	raster: GrayRaster,
	cp1: GlyphPoint,
	cp2: GlyphPoint,
	end: GlyphPoint,
	scaleX: number,
	scaleY: number,
	offX: number,
	offY: number,
): [number, number] {
	const cx1 = Math.round(cp1.x * scaleX + offX);
	const cy1 = Math.round(cp1.y * scaleY + offY);
	const cx2 = Math.round(cp2.x * scaleX + offX);
	const cy2 = Math.round(cp2.y * scaleY + offY);
	const x = Math.round(end.x * scaleX + offX);
	const y = Math.round(end.y * scaleY + offY);
	raster.cubicTo(cx1, cy1, cx2, cy2, x, y);
	return [x, y];
}

function decomposeQuadraticContour(
	raster: GrayRaster,
	contour: Contour,
	scaleX: number,
	scaleY: number,
	offX: number,
	offY: number,
): void {
	let startIndex = 0;
	for (let i = 0; i < contour.length; i++) {
		const point = contour[i]!;
		if (point.onCurve) {
			startIndex = i;
			break;
		}
	}

	const n = contour.length;
	let startPoint: GlyphPoint;
	let allOffCurve = true;
	for (let i = 0; i < n; i++) {
		if (contour[i]!.onCurve) {
			allOffCurve = false;
			break;
		}
	}

	if (allOffCurve) {
		const first = contour[0]!;
		const last = contour[n - 1]!;
		startPoint = {
			x: (first.x + last.x) * 0.5,
			y: (first.y + last.y) * 0.5,
			onCurve: true,
		};
		startIndex = 0;
	} else {
		startPoint = contour[startIndex]!;
	}

	let startX: number;
	let startY: number;
	[startX, startY] = movePoint(raster, startPoint, scaleX, scaleY, offX, offY);

	let currentX = startX;
	let currentY = startY;
	let i = allOffCurve ? 0 : startIndex + 1;
	if (i >= n) i = 0;
	let iterations = 0;

	while (iterations < n) {
		const point = contour[i]!;
		if (point.onCurve) {
			[currentX, currentY] = linePoint(raster, point, scaleX, scaleY, offX, offY);
		} else {
			const nextIndex = i + 1 < n ? i + 1 : 0;
			const nextPoint = contour[nextIndex]!;
			if (nextPoint.onCurve) {
				[currentX, currentY] = conicPoint(
					raster,
					point,
					nextPoint.x,
					nextPoint.y,
					scaleX,
					scaleY,
					offX,
					offY,
				);
				i = nextIndex;
				iterations++;
			} else {
				[currentX, currentY] = conicPoint(
					raster,
					point,
					(point.x + nextPoint.x) * 0.5,
					(point.y + nextPoint.y) * 0.5,
					scaleX,
					scaleY,
					offX,
					offY,
				);
			}
		}

		i++;
		if (i >= n) i = 0;
		iterations++;

		if (currentX === startX && currentY === startY) break;
	}

	raster.lineTo(startX, startY);
}

function decomposeCubicContour(
	raster: GrayRaster,
	contour: Contour,
	scaleX: number,
	scaleY: number,
	offX: number,
	offY: number,
): void {
	const first = contour[0]!;
	const [startX, startY] = movePoint(raster, first, scaleX, scaleY, offX, offY);
	let currentX = startX;
	let currentY = startY;
	let i = 1;

	while (i < contour.length) {
		const point = contour[i]!;
		if (point.onCurve) {
			[currentX, currentY] = linePoint(raster, point, scaleX, scaleY, offX, offY);
			i++;
			continue;
		}
		if (point.cubic) {
			const cp2 = contour[i + 1];
			const end = contour[i + 2];
			if (!cp2 || !end) {
				i++;
				continue;
			}
			[currentX, currentY] = cubicPoint(
				raster,
				point,
				cp2,
				end,
				scaleX,
				scaleY,
				offX,
				offY,
			);
			i += 3;
			continue;
		}
		const next = contour[i + 1];
		if (!next) break;
		if (next.onCurve) {
			[currentX, currentY] = conicPoint(
				raster,
				point,
				next.x,
				next.y,
				scaleX,
				scaleY,
				offX,
				offY,
			);
			i += 2;
		} else {
			[currentX, currentY] = conicPoint(
				raster,
				point,
				(point.x + next.x) * 0.5,
				(point.y + next.y) * 0.5,
				scaleX,
				scaleY,
				offX,
				offY,
			);
			i++;
		}
	}

	if (currentX !== startX || currentY !== startY) {
		raster.lineTo(startX, startY);
	}
}

export function decomposeContours(
	raster: GrayRaster,
	contours: Contour[],
	scale: number,
	offsetX: number = 0,
	offsetY: number = 0,
	flipY: boolean = true,
): void {
	const scaleX = scale * ONE_PIXEL;
	const scaleY = (flipY ? -scale : scale) * ONE_PIXEL;
	const offX = offsetX * ONE_PIXEL;
	const offY = offsetY * ONE_PIXEL;

	for (let i = 0; i < contours.length; i++) {
		const contour = contours[i]!;
		if (contour.length === 0) continue;
		if (contour[0]!.cubic) {
			decomposeCubicContour(raster, contour, scaleX, scaleY, offX, offY);
		} else {
			decomposeQuadraticContour(raster, contour, scaleX, scaleY, offX, offY);
		}
	}
}

export function getContourBounds(
	contours: Contour[],
	scale: number,
	flipY: boolean = true,
	roundToGrid: boolean = false,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	if (roundToGrid) {
		const scale26Fix = Math.round(scale * 64 * 0x10000);
		for (let i = 0; i < contours.length; i++) {
			const contour = contours[i]!;
			for (let j = 0; j < contour.length; j++) {
				const point = contour[j]!;
				const x = mulFix(point.x, scale26Fix);
				const y = mulFix(point.y, scale26Fix);
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}
		}
		if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
		if (flipY) {
			const flippedMinY = -maxY;
			const flippedMaxY = -minY;
			return {
				minX: Math.floor(minX / 64),
				minY: Math.floor(flippedMinY / 64),
				maxX: Math.floor((maxX + 63) / 64),
				maxY: Math.floor((flippedMaxY + 63) / 64),
			};
		}
		return {
			minX: Math.floor(minX / 64),
			minY: Math.floor(minY / 64),
			maxX: Math.floor((maxX + 63) / 64),
			maxY: Math.floor((maxY + 63) / 64),
		};
	}

	for (let i = 0; i < contours.length; i++) {
		const contour = contours[i]!;
		for (let j = 0; j < contour.length; j++) {
			const point = contour[j]!;
			if (point.x < minX) minX = point.x;
			if (point.x > maxX) maxX = point.x;
			if (point.y < minY) minY = point.y;
			if (point.y > maxY) maxY = point.y;
		}
	}
	if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
	if (flipY) {
		return {
			minX: Math.floor(minX * scale),
			minY: Math.floor(-maxY * scale),
			maxX: Math.ceil(maxX * scale),
			maxY: Math.ceil(-minY * scale),
		};
	}
	return {
		minX: Math.floor(minX * scale),
		minY: Math.floor(minY * scale),
		maxX: Math.ceil(maxX * scale),
		maxY: Math.ceil(maxY * scale),
	};
}

/**
 * Calculate bounding box of path in pixel coordinates
 * @param path Glyph path to measure
 * @param scale Scale factor (font units to pixels)
 * @param flipY Flip Y axis for bitmap coordinates (default: true)
 * @returns Bounding box in pixel coordinates, or null if path has no bounds
 */
function mulFix(value: number, scaleFix: number): number {
	if (value === 0 || scaleFix === 0) return 0;
	let sign = 1;
	let a = value;
	let b = scaleFix;
	if (a < 0) {
		a = -a;
		sign = -sign;
	}
	if (b < 0) {
		b = -b;
		sign = -sign;
	}
	const result = Math.floor((a * b + 0x8000) / 0x10000);
	return sign < 0 ? -result : result;
}

export function getPathBounds(
	path: GlyphPath,
	scale: number,
	flipY: boolean = true,
	roundToGrid: boolean = false,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
	if (roundToGrid) {
		const scale26Fix = Math.round(scale * 64 * 0x10000);
		let minX26 = Infinity;
		let minY26 = Infinity;
		let maxX26 = -Infinity;
		let maxY26 = -Infinity;

		const update = (x: number, y: number): void => {
			const rx = mulFix(x, scale26Fix);
			const ry = mulFix(y, scale26Fix);
			if (rx < minX26) minX26 = rx;
			if (rx > maxX26) maxX26 = rx;
			if (ry < minY26) minY26 = ry;
			if (ry > maxY26) maxY26 = ry;
		};

		for (const cmd of path.commands) {
			switch (cmd.type) {
				case "M":
				case "L":
					update(cmd.x, cmd.y);
					break;
				case "Q":
					update(cmd.x1, cmd.y1);
					update(cmd.x, cmd.y);
					break;
				case "C":
					update(cmd.x1, cmd.y1);
					update(cmd.x2, cmd.y2);
					update(cmd.x, cmd.y);
					break;
				default:
					break;
			}
		}

		if (!Number.isFinite(minX26) || !Number.isFinite(minY26)) return null;

		if (flipY) {
			const flippedMinY = -maxY26;
			const flippedMaxY = -minY26;
			return {
				minX: Math.floor(minX26 / 64),
				minY: Math.floor(flippedMinY / 64),
				maxX: Math.floor((maxX26 + 63) / 64),
				maxY: Math.floor((flippedMaxY + 63) / 64),
			};
		}
		return {
			minX: Math.floor(minX26 / 64),
			minY: Math.floor(minY26 / 64),
			maxX: Math.floor((maxX26 + 63) / 64),
			maxY: Math.floor((maxY26 + 63) / 64),
		};
	}

	if (!path.bounds) return null;

	const b = path.bounds;
	if (flipY) {
		return {
			minX: Math.floor(b.xMin * scale),
			minY: Math.floor(-b.yMax * scale),
			maxX: Math.ceil(b.xMax * scale),
			maxY: Math.ceil(-b.yMin * scale),
		};
	} else {
		return {
			minX: Math.floor(b.xMin * scale),
			minY: Math.floor(b.yMin * scale),
			maxX: Math.ceil(b.xMax * scale),
			maxY: Math.ceil(b.yMax * scale),
		};
	}
}

/**
 * Get fill rule from outline flags (like FreeType's FT_OUTLINE_EVEN_ODD_FILL check)
 * @param path Path with optional flags
 * @param defaultRule Default fill rule if flags not set (default: NonZero)
 * @returns Fill rule to use for rendering
 */
export function getFillRuleFromFlags(
	path: GlyphPath | null | undefined,
	defaultRule: FillRule = FillRule.NonZero,
): FillRule {
	if (!path?.flags) return defaultRule;
	return (path.flags & OutlineFlags.EvenOddFill) !== 0
		? FillRule.EvenOdd
		: FillRule.NonZero;
}
