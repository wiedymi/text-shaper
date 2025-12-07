import type { GlyphBuffer } from "../buffer/glyph-buffer.ts";
import type { Font } from "../font/font.ts";
import type { Contour, GlyphPoint } from "../font/tables/glyf.ts";
import type { GlyphId } from "../types.ts";
import {
	type Matrix2D,
	type Matrix3x3,
	transformPoint2D,
	transformPoint3x3,
} from "./outline-transform.ts";

/**
 * Path command types for glyph rendering
 */
export type PathCommand =
	| { type: "M"; x: number; y: number }
	| { type: "L"; x: number; y: number }
	| { type: "Q"; x1: number; y1: number; x: number; y: number }
	| {
			type: "C";
			x1: number;
			y1: number;
			x2: number;
			y2: number;
			x: number;
			y: number;
	  }
	| { type: "Z" };

/**
 * Outline flags (like FreeType's FT_OUTLINE_* flags)
 */
export enum OutlineFlags {
	/** No flags */
	None = 0,
	/** Use even-odd fill rule instead of non-zero winding */
	EvenOddFill = 1 << 0,
	/** Outline has been hinted */
	HighPrecision = 1 << 1,
	/** Outline is a single stroke (not filled) */
	SinglePass = 1 << 2,
}

/**
 * A glyph path is a series of drawing commands
 */
export interface GlyphPath {
	commands: PathCommand[];
	bounds: { xMin: number; yMin: number; xMax: number; yMax: number } | null;
	/** Outline flags (like FreeType's FT_OUTLINE_* flags) */
	flags?: OutlineFlags;
}

/**
 * Convert contours to path commands
 * Handles both TrueType (quadratic Béziers) and CFF (cubic Béziers)
 */
export function contourToPath(contour: Contour): PathCommand[] {
	if (contour.length === 0) return [];

	// Fast check: if first off-curve point is cubic, use cubic path
	// CFF glyphs always have cubic control points, TrueType never does
	for (const p of contour) {
		if (!p.onCurve) {
			return p.cubic
				? contourToPathCubic(contour)
				: contourToPathQuadratic(contour);
		}
	}

	// All points on-curve (rare, but possible) - use quadratic
	return contourToPathQuadratic(contour);
}

/**
 * Convert CFF contour (cubic beziers) to path commands
 */
function contourToPathCubic(contour: Contour): PathCommand[] {
	if (contour.length === 0) return [];

	const commands: PathCommand[] = [];
	let i = 0;

	// First point should be on-curve (moveto)
	const first = contour[0];
	if (!first) return [];

	commands.push({ type: "M", x: first.x, y: first.y });
	i = 1;

	while (i < contour.length) {
		const point = contour[i];
		if (!point) break;

		if (point.onCurve) {
			// Line to
			commands.push({ type: "L", x: point.x, y: point.y });
			i++;
		} else if (point.cubic) {
			// Cubic bezier: expect cp1, cp2, endpoint
			const cp1 = point;
			const cp2 = contour[i + 1];
			const end = contour[i + 2];

			if (!cp2 || !end) {
				// Malformed, skip
				i++;
				continue;
			}

			commands.push({
				type: "C",
				x1: cp1.x,
				y1: cp1.y,
				x2: cp2.x,
				y2: cp2.y,
				x: end.x,
				y: end.y,
			});
			i += 3;
		} else {
			// Quadratic bezier (shouldn't happen in CFF but handle anyway)
			const cp = point;
			const next = contour[i + 1];
			if (!next) {
				i++;
				continue;
			}

			let endPoint: GlyphPoint;
			if (next.onCurve) {
				endPoint = next;
				i += 2;
			} else {
				endPoint = {
					x: (cp.x + next.x) / 2,
					y: (cp.y + next.y) / 2,
					onCurve: true,
				};
				i++;
			}

			commands.push({
				type: "Q",
				x1: cp.x,
				y1: cp.y,
				x: endPoint.x,
				y: endPoint.y,
			});
		}
	}

	commands.push({ type: "Z" });
	return commands;
}

/**
 * Convert TrueType contour (quadratic beziers) to path commands
 */
function contourToPathQuadratic(contour: Contour): PathCommand[] {
	if (contour.length === 0) return [];

	const commands: PathCommand[] = [];

	// Find the first on-curve point to start
	let startIndex = 0;
	for (const [i, point] of contour.entries()) {
		if (point.onCurve) {
			startIndex = i;
			break;
		}
	}

	// If all points are off-curve, calculate implied on-curve point
	const allOffCurve = contour.every((p) => !p.onCurve);
	let startPoint: GlyphPoint;

	if (allOffCurve) {
		// Start at midpoint between first and last off-curve points
		const first = contour[0];
		const last = contour[contour.length - 1];
		if (!first || !last) return [];
		startPoint = {
			x: (first.x + last.x) / 2,
			y: (first.y + last.y) / 2,
			onCurve: true,
		};
		startIndex = 0;
	} else {
		const point = contour[startIndex];
		if (!point) return [];
		startPoint = point;
	}

	commands.push({ type: "M", x: startPoint.x, y: startPoint.y });

	const n = contour.length;
	// Replace modulo with conditional increment for better performance
	let i = allOffCurve ? 0 : (startIndex + 1);
	if (i >= n) i = 0;
	let current = startPoint;
	let iterations = 0;

	while (iterations < n) {
		const point = contour[i];
		if (!point) break;

		if (point.onCurve) {
			// Line to on-curve point
			commands.push({ type: "L", x: point.x, y: point.y });
			current = point;
		} else {
			// Off-curve point - need to find the end point
			const nextIndex = i + 1 < n ? i + 1 : 0;
			const nextPoint = contour[nextIndex];
			if (!nextPoint) break;

			let endPoint: GlyphPoint;
			if (nextPoint.onCurve) {
				// Next point is on-curve, use it directly
				endPoint = nextPoint;
				i = nextIndex;
				iterations++;
			} else {
				// Next point is also off-curve, calculate implied on-curve point
				endPoint = {
					x: (point.x + nextPoint.x) / 2,
					y: (point.y + nextPoint.y) / 2,
					onCurve: true,
				};
			}

			// Quadratic Bézier curve
			commands.push({
				type: "Q",
				x1: point.x,
				y1: point.y,
				x: endPoint.x,
				y: endPoint.y,
			});
			current = endPoint;
		}

		// Replace modulo with conditional increment
		i++;
		if (i >= n) i = 0;
		iterations++;

		// Check if we've returned to start
		if (current.x === startPoint.x && current.y === startPoint.y) {
			break;
		}
	}

	// Close the path
	commands.push({ type: "Z" });

	return commands;
}

/**
 * Get path commands for a glyph
 */
// Path cache: WeakMap allows garbage collection when Font is no longer referenced
const pathCache = new WeakMap<Font, Map<GlyphId, GlyphPath | null>>();

/**
 * Get cached glyph path, computing and caching if not already cached
 */
export function getGlyphPath(font: Font, glyphId: GlyphId): GlyphPath | null {
	// Check cache first
	let fontCache = pathCache.get(font);
	if (fontCache) {
		const cached = fontCache.get(glyphId);
		if (cached !== undefined) return cached;
	}

	// Compute path
	const result = font.getGlyphContoursAndBounds(glyphId);
	if (!result) {
		// Cache null result too to avoid recomputing
		if (!fontCache) {
			fontCache = new Map();
			pathCache.set(font, fontCache);
		}
		fontCache.set(glyphId, null);
		return null;
	}

	const commands: PathCommand[] = [];
	for (const contour of result.contours) {
		commands.push(...contourToPath(contour));
	}

	const path: GlyphPath = { commands, bounds: result.bounds };

	// Cache and return
	if (!fontCache) {
		fontCache = new Map();
		pathCache.set(font, fontCache);
	}
	fontCache.set(glyphId, path);
	return path;
}

/**
 * Convert path commands to SVG path data string
 */
export function pathToSVG(
	path: GlyphPath,
	options?: { flipY?: boolean; scale?: number },
): string {
	const scale = options?.scale ?? 1;
	const flipY = options?.flipY ?? true;
	const ySign = flipY ? -1 : 1;

	// Direct string concatenation is faster than array.join for small strings
	let result = "";

	for (const cmd of path.commands) {
		if (result) result += " ";
		switch (cmd.type) {
			case "M":
				result += `M ${cmd.x * scale} ${cmd.y * scale * ySign}`;
				break;
			case "L":
				result += `L ${cmd.x * scale} ${cmd.y * scale * ySign}`;
				break;
			case "Q":
				result += `Q ${cmd.x1 * scale} ${cmd.y1 * scale * ySign} ${cmd.x * scale} ${cmd.y * scale * ySign}`;
				break;
			case "C":
				result += `C ${cmd.x1 * scale} ${cmd.y1 * scale * ySign} ${cmd.x2 * scale} ${cmd.y2 * scale * ySign} ${cmd.x * scale} ${cmd.y * scale * ySign}`;
				break;
			case "Z":
				result += "Z";
				break;
		}
	}

	return result;
}

/**
 * Render options for stroke/fill
 */
export interface RenderOptions {
	flipY?: boolean;
	scale?: number;
	offsetX?: number;
	offsetY?: number;
	fill?: string;
	stroke?: string;
	strokeWidth?: number;
	lineCap?: CanvasLineCap;
	lineJoin?: CanvasLineJoin;
	miterLimit?: number;
}

/**
 * Render path commands to a Canvas 2D context
 */
export function pathToCanvas(
	ctx: CanvasRenderingContext2D | Path2D,
	path: GlyphPath,
	options?: {
		flipY?: boolean;
		scale?: number;
		offsetX?: number;
		offsetY?: number;
	},
): void {
	const scale = options?.scale ?? 1;
	const flipY = options?.flipY ?? true;
	const offsetX = options?.offsetX ?? 0;
	const offsetY = options?.offsetY ?? 0;

	for (const cmd of path.commands) {
		switch (cmd.type) {
			case "M":
				ctx.moveTo(
					cmd.x * scale + offsetX,
					(flipY ? -cmd.y : cmd.y) * scale + offsetY,
				);
				break;
			case "L":
				ctx.lineTo(
					cmd.x * scale + offsetX,
					(flipY ? -cmd.y : cmd.y) * scale + offsetY,
				);
				break;
			case "Q":
				ctx.quadraticCurveTo(
					cmd.x1 * scale + offsetX,
					(flipY ? -cmd.y1 : cmd.y1) * scale + offsetY,
					cmd.x * scale + offsetX,
					(flipY ? -cmd.y : cmd.y) * scale + offsetY,
				);
				break;
			case "C":
				ctx.bezierCurveTo(
					cmd.x1 * scale + offsetX,
					(flipY ? -cmd.y1 : cmd.y1) * scale + offsetY,
					cmd.x2 * scale + offsetX,
					(flipY ? -cmd.y2 : cmd.y2) * scale + offsetY,
					cmd.x * scale + offsetX,
					(flipY ? -cmd.y : cmd.y) * scale + offsetY,
				);
				break;
			case "Z":
				ctx.closePath();
				break;
		}
	}
}

/**
 * Generate an SVG element for a glyph
 */
export function glyphToSVG(
	font: Font,
	glyphId: GlyphId,
	options?: {
		fontSize?: number;
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
	},
): string | null {
	const path = getGlyphPath(font, glyphId);
	if (!path) return null;

	const fontSize = options?.fontSize ?? 100;
	const fill = options?.fill ?? "currentColor";
	const stroke = options?.stroke;
	const strokeWidth = options?.strokeWidth ?? 1;
	const scale = fontSize / font.unitsPerEm;

	const bounds = path.bounds;
	if (!bounds) return null;

	// Add stroke width to bounds for proper sizing
	const strokePadding = stroke ? strokeWidth / 2 : 0;
	const width = Math.ceil(
		(bounds.xMax - bounds.xMin) * scale + strokePadding * 2,
	);
	const height = Math.ceil(
		(bounds.yMax - bounds.yMin) * scale + strokePadding * 2,
	);
	const viewBox = `${bounds.xMin - strokePadding} ${-bounds.yMax - strokePadding} ${bounds.xMax - bounds.xMin + strokePadding * 2} ${bounds.yMax - bounds.yMin + strokePadding * 2}`;

	const pathData = pathToSVG(path, { flipY: true, scale: 1 });

	const strokeAttr = stroke
		? ` stroke="${stroke}" stroke-width="${strokeWidth}"`
		: "";

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
  <path d="${pathData}" fill="${fill}"${strokeAttr}/>
</svg>`;
}

/**
 * Render shaped text to Canvas
 */
export interface ShapedGlyph {
	glyphId: GlyphId;
	xOffset: number;
	yOffset: number;
	xAdvance: number;
	yAdvance: number;
}

export function renderShapedText(
	ctx: CanvasRenderingContext2D,
	font: Font,
	glyphs: ShapedGlyph[],
	options?: {
		fontSize?: number;
		x?: number;
		y?: number;
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		lineCap?: CanvasLineCap;
		lineJoin?: CanvasLineJoin;
		/** 2D affine matrix to apply to glyph coordinates */
		matrix?: Matrix2D;
		/** 3D perspective matrix to apply to glyph coordinates (takes precedence over matrix) */
		matrix3D?: Matrix3x3;
	},
): void {
	const fontSize = options?.fontSize ?? 16;
	const startX = options?.x ?? 0;
	const startY = options?.y ?? 0;
	const fill = options?.fill ?? "black";
	const stroke = options?.stroke;
	const strokeWidth = options?.strokeWidth ?? 1;
	const matrix = options?.matrix;
	const matrix3D = options?.matrix3D;

	const scale = fontSize / font.unitsPerEm;

	ctx.fillStyle = fill;
	if (stroke) {
		ctx.strokeStyle = stroke;
		ctx.lineWidth = strokeWidth * scale;
		if (options?.lineCap) ctx.lineCap = options.lineCap;
		if (options?.lineJoin) ctx.lineJoin = options.lineJoin;
	}

	let x = startX;
	let y = startY;

	for (const glyph of glyphs) {
		const path = getGlyphPath(font, glyph.glyphId);
		if (path) {
			ctx.beginPath();

			if (matrix3D) {
				// Build combined matrix: translate to position, scale, then apply 3D
				const posX = x + glyph.xOffset * scale;
				const posY = y - glyph.yOffset * scale;
				// Create combined 3x3 matrix with scale and position baked in
				const combined: Matrix3x3 = [
					[matrix3D[0][0] * scale, matrix3D[0][1] * scale, matrix3D[0][0] * posX + matrix3D[0][1] * posY + matrix3D[0][2]],
					[matrix3D[1][0] * scale, matrix3D[1][1] * scale, matrix3D[1][0] * posX + matrix3D[1][1] * posY + matrix3D[1][2]],
					[matrix3D[2][0] * scale, matrix3D[2][1] * scale, matrix3D[2][0] * posX + matrix3D[2][1] * posY + matrix3D[2][2]],
				];
				pathToCanvasWithMatrix3D(ctx, path, combined);
			} else if (matrix) {
				// Build combined 2D matrix: translate to position, scale, then apply matrix
				const posX = x + glyph.xOffset * scale;
				const posY = y - glyph.yOffset * scale;
				// Combined: matrix * [scale, 0, 0, scale, posX, posY]
				const combined: Matrix2D = [
					matrix[0] * scale,
					matrix[1] * scale,
					matrix[2] * scale,
					matrix[3] * scale,
					matrix[0] * posX + matrix[2] * posY + matrix[4],
					matrix[1] * posX + matrix[3] * posY + matrix[5],
				];
				pathToCanvasWithMatrix(ctx, path, combined);
			} else {
				pathToCanvas(ctx, path, {
					scale,
					flipY: true,
					offsetX: x + glyph.xOffset * scale,
					offsetY: y - glyph.yOffset * scale,
				});
			}

			if (fill !== "none") ctx.fill();
			if (stroke) ctx.stroke();
		}

		x += glyph.xAdvance * scale;
		y += glyph.yAdvance * scale;
	}
}

/**
 * Generate SVG for shaped text
 */
export function shapedTextToSVG(
	font: Font,
	glyphs: ShapedGlyph[],
	options?: {
		fontSize?: number;
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		lineCap?: "butt" | "round" | "square";
		lineJoin?: "miter" | "round" | "bevel";
		/** 2D affine matrix to apply to glyph coordinates */
		matrix?: Matrix2D;
		/** 3D perspective matrix to apply to glyph coordinates (takes precedence over matrix) */
		matrix3D?: Matrix3x3;
		/** If true, use native SVG transform attribute instead of transforming path data (2D only) */
		useNativeTransform?: boolean;
	},
): string {
	const fontSize = options?.fontSize ?? 100;
	const fill = options?.fill ?? "currentColor";
	const stroke = options?.stroke;
	const strokeWidth = options?.strokeWidth ?? 1;
	const matrix = options?.matrix;
	const matrix3D = options?.matrix3D;
	const useNativeTransform = options?.useNativeTransform ?? false;
	const scale = fontSize / font.unitsPerEm;

	const paths: string[] = [];
	let x = 0;
	let y = 0;
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;

	for (const glyph of glyphs) {
		const path = getGlyphPath(font, glyph.glyphId);
		if (path?.bounds) {
			const offsetX = x + glyph.xOffset * scale;
			const offsetY = y - glyph.yOffset * scale;

			let pathStr: string;

			if (matrix3D && !useNativeTransform) {
				// Apply 3D matrix to path coordinates
				const combined: Matrix3x3 = [
					[matrix3D[0][0] * scale, matrix3D[0][1] * scale, matrix3D[0][0] * offsetX + matrix3D[0][1] * offsetY + matrix3D[0][2]],
					[matrix3D[1][0] * scale, matrix3D[1][1] * scale, matrix3D[1][0] * offsetX + matrix3D[1][1] * offsetY + matrix3D[1][2]],
					[matrix3D[2][0] * scale, matrix3D[2][1] * scale, matrix3D[2][0] * offsetX + matrix3D[2][1] * offsetY + matrix3D[2][2]],
				];
				pathStr = pathToSVGWithMatrix3D(path, combined);

				// Update bounds with transformed corners
				const b = path.bounds;
				const corners = [
					transformPoint3x3(b.xMin * scale + offsetX, -b.yMax * scale + offsetY, matrix3D),
					transformPoint3x3(b.xMax * scale + offsetX, -b.yMax * scale + offsetY, matrix3D),
					transformPoint3x3(b.xMin * scale + offsetX, -b.yMin * scale + offsetY, matrix3D),
					transformPoint3x3(b.xMax * scale + offsetX, -b.yMin * scale + offsetY, matrix3D),
				];
				for (const c of corners) {
					minX = Math.min(minX, c.x);
					maxX = Math.max(maxX, c.x);
					minY = Math.min(minY, c.y);
					maxY = Math.max(maxY, c.y);
				}
			} else if (matrix && !useNativeTransform) {
				// Apply 2D matrix to path coordinates
				const combined: Matrix2D = [
					matrix[0] * scale,
					matrix[1] * scale,
					matrix[2] * scale,
					matrix[3] * scale,
					matrix[0] * offsetX + matrix[2] * offsetY + matrix[4],
					matrix[1] * offsetX + matrix[3] * offsetY + matrix[5],
				];
				pathStr = pathToSVGWithMatrix(path, combined);

				// Update bounds with transformed corners
				const b = path.bounds;
				const corners = [
					transformPoint2D(b.xMin * scale + offsetX, -b.yMax * scale + offsetY, matrix),
					transformPoint2D(b.xMax * scale + offsetX, -b.yMax * scale + offsetY, matrix),
					transformPoint2D(b.xMin * scale + offsetX, -b.yMin * scale + offsetY, matrix),
					transformPoint2D(b.xMax * scale + offsetX, -b.yMin * scale + offsetY, matrix),
				];
				for (const c of corners) {
					minX = Math.min(minX, c.x);
					maxX = Math.max(maxX, c.x);
					minY = Math.min(minY, c.y);
					maxY = Math.max(maxY, c.y);
				}
			} else {
				// Direct SVG serialization - no intermediate array allocation
				pathStr = pathToSVGDirect(path, scale, offsetX, offsetY);

				// Update bounds
				const b = path.bounds;
				minX = Math.min(minX, offsetX + b.xMin * scale);
				maxX = Math.max(maxX, offsetX + b.xMax * scale);
				minY = Math.min(minY, offsetY - b.yMax * scale);
				maxY = Math.max(maxY, offsetY - b.yMin * scale);
			}

			paths.push(pathStr);
		}

		x += glyph.xAdvance * scale;
		y += glyph.yAdvance * scale;
	}

	if (paths.length === 0) {
		return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
	}

	// Add stroke padding to bounds
	const strokePadding = stroke ? strokeWidth / 2 : 0;
	const width = Math.ceil(maxX - minX + strokePadding * 2);
	const height = Math.ceil(maxY - minY + strokePadding * 2);
	const viewBox = `${Math.floor(minX - strokePadding)} ${Math.floor(minY - strokePadding)} ${width} ${height}`;

	const strokeAttr = stroke
		? ` stroke="${stroke}" stroke-width="${strokeWidth}"${options?.lineCap ? ` stroke-linecap="${options.lineCap}"` : ""}${options?.lineJoin ? ` stroke-linejoin="${options.lineJoin}"` : ""}`
		: "";

	// Use native transform attribute if requested (only for 2D matrix)
	const transformAttr = useNativeTransform && matrix ? ` transform="${matrixToSVGTransform(matrix)}"` : "";

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
  <path d="${paths.join(" ")}" fill="${fill}"${strokeAttr}${transformAttr}/>
</svg>`;
}

/**
 * Convert GlyphBuffer output to ShapedGlyph array
 */
export function glyphBufferToShapedGlyphs(buffer: GlyphBuffer): ShapedGlyph[] {
	const result: ShapedGlyph[] = [];
	for (const [i, info] of buffer.infos.entries()) {
		const pos = buffer.positions[i];
		if (!pos) continue;
		result.push({
			glyphId: info.glyphId,
			xOffset: pos.xOffset,
			yOffset: pos.yOffset,
			xAdvance: pos.xAdvance,
			yAdvance: pos.yAdvance,
		});
	}
	return result;
}

/**
 * Get glyph path with variable font variation applied
 */
export function getGlyphPathWithVariation(
	font: Font,
	glyphId: GlyphId,
	axisCoords: number[],
): GlyphPath | null {
	const contours = font.getGlyphContoursWithVariation(glyphId, axisCoords);
	if (!contours) return null;

	const commands: PathCommand[] = [];
	for (const contour of contours) {
		commands.push(...contourToPath(contour));
	}

	const bounds = font.getGlyphBounds(glyphId);

	return { commands, bounds };
}

/**
 * Render shaped text with variable font support
 */
export function renderShapedTextWithVariation(
	ctx: CanvasRenderingContext2D,
	font: Font,
	glyphs: ShapedGlyph[],
	axisCoords: number[],
	options?: {
		fontSize?: number;
		x?: number;
		y?: number;
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		lineCap?: CanvasLineCap;
		lineJoin?: CanvasLineJoin;
	},
): void {
	const fontSize = options?.fontSize ?? 16;
	const startX = options?.x ?? 0;
	const startY = options?.y ?? 0;
	const fill = options?.fill ?? "black";
	const stroke = options?.stroke;
	const strokeWidth = options?.strokeWidth ?? 1;

	const scale = fontSize / font.unitsPerEm;

	ctx.fillStyle = fill;
	if (stroke) {
		ctx.strokeStyle = stroke;
		ctx.lineWidth = strokeWidth * scale;
		if (options?.lineCap) ctx.lineCap = options.lineCap;
		if (options?.lineJoin) ctx.lineJoin = options.lineJoin;
	}

	let x = startX;
	let y = startY;

	for (const glyph of glyphs) {
		const path = getGlyphPathWithVariation(font, glyph.glyphId, axisCoords);
		if (path) {
			ctx.beginPath();
			pathToCanvas(ctx, path, {
				scale,
				flipY: true,
				offsetX: x + glyph.xOffset * scale,
				offsetY: y - glyph.yOffset * scale,
			});
			if (fill !== "none") ctx.fill();
			if (stroke) ctx.stroke();
		}

		x += glyph.xAdvance * scale;
		y += glyph.yAdvance * scale;
	}
}

/**
 * Generate SVG for shaped text with variable font support
 */
export function shapedTextToSVGWithVariation(
	font: Font,
	glyphs: ShapedGlyph[],
	axisCoords: number[],
	options?: {
		fontSize?: number;
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		lineCap?: "butt" | "round" | "square";
		lineJoin?: "miter" | "round" | "bevel";
	},
): string {
	const fontSize = options?.fontSize ?? 100;
	const fill = options?.fill ?? "currentColor";
	const stroke = options?.stroke;
	const strokeWidth = options?.strokeWidth ?? 1;
	const scale = fontSize / font.unitsPerEm;

	const paths: string[] = [];
	let x = 0;
	let y = 0;
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;

	for (const glyph of glyphs) {
		const path = getGlyphPathWithVariation(font, glyph.glyphId, axisCoords);
		if (path?.bounds) {
			const offsetX = x + glyph.xOffset * scale;
			const offsetY = y - glyph.yOffset * scale;

			// Direct SVG serialization - no intermediate array allocation
			const pathStr = pathToSVGDirect(path, scale, offsetX, offsetY);
			paths.push(pathStr);

			const b = path.bounds;
			minX = Math.min(minX, offsetX + b.xMin * scale);
			maxX = Math.max(maxX, offsetX + b.xMax * scale);
			minY = Math.min(minY, offsetY - b.yMax * scale);
			maxY = Math.max(maxY, offsetY - b.yMin * scale);
		}

		x += glyph.xAdvance * scale;
		y += glyph.yAdvance * scale;
	}

	if (paths.length === 0) {
		return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
	}

	// Add stroke padding to bounds
	const strokePadding = stroke ? strokeWidth / 2 : 0;
	const width = Math.ceil(maxX - minX + strokePadding * 2);
	const height = Math.ceil(maxY - minY + strokePadding * 2);
	const viewBox = `${Math.floor(minX - strokePadding)} ${Math.floor(minY - strokePadding)} ${width} ${height}`;

	const strokeAttr = stroke
		? ` stroke="${stroke}" stroke-width="${strokeWidth}"${options?.lineCap ? ` stroke-linecap="${options.lineCap}"` : ""}${options?.lineJoin ? ` stroke-linejoin="${options.lineJoin}"` : ""}`
		: "";

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
  <path d="${paths.join(" ")}" fill="${fill}"${strokeAttr}/>
</svg>`;
}

/**
 * Calculate the total advance width of shaped text
 */
export function getTextWidth(
	glyphs: ShapedGlyph[],
	font: Font,
	fontSize: number,
): number {
	const scale = fontSize / font.unitsPerEm;
	let width = 0;
	for (const glyph of glyphs) {
		width += glyph.xAdvance;
	}
	return width * scale;
}

/**
 * Create a Path2D object from glyph path
 */
export function createPath2D(
	path: GlyphPath,
	options?: {
		flipY?: boolean;
		scale?: number;
		offsetX?: number;
		offsetY?: number;
	},
): Path2D {
	const p = new Path2D();
	pathToCanvas(p, path, options);
	return p;
}

/**
 * Render path to canvas with 2D affine matrix transformation applied to coordinates
 * The matrix transforms each point before drawing
 */
export function pathToCanvasWithMatrix(
	ctx: CanvasRenderingContext2D | Path2D,
	path: GlyphPath,
	matrix: Matrix2D,
	options?: { flipY?: boolean },
): void {
	const flipY = options?.flipY ?? true;
	const ySign = flipY ? -1 : 1;

	for (const cmd of path.commands) {
		switch (cmd.type) {
			case "M": {
				const p = transformPoint2D(cmd.x, cmd.y * ySign, matrix);
				ctx.moveTo(p.x, p.y);
				break;
			}
			case "L": {
				const p = transformPoint2D(cmd.x, cmd.y * ySign, matrix);
				ctx.lineTo(p.x, p.y);
				break;
			}
			case "Q": {
				const p1 = transformPoint2D(cmd.x1, cmd.y1 * ySign, matrix);
				const p = transformPoint2D(cmd.x, cmd.y * ySign, matrix);
				ctx.quadraticCurveTo(p1.x, p1.y, p.x, p.y);
				break;
			}
			case "C": {
				const p1 = transformPoint2D(cmd.x1, cmd.y1 * ySign, matrix);
				const p2 = transformPoint2D(cmd.x2, cmd.y2 * ySign, matrix);
				const p = transformPoint2D(cmd.x, cmd.y * ySign, matrix);
				ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p.x, p.y);
				break;
			}
			case "Z":
				ctx.closePath();
				break;
		}
	}
}

/**
 * Convert path to SVG with 2D affine matrix transformation applied to coordinates
 */
export function pathToSVGWithMatrix(
	path: GlyphPath,
	matrix: Matrix2D,
	options?: { flipY?: boolean },
): string {
	const flipY = options?.flipY ?? true;
	const ySign = flipY ? -1 : 1;
	const parts: string[] = [];

	for (const cmd of path.commands) {
		switch (cmd.type) {
			case "M": {
				const p = transformPoint2D(cmd.x, cmd.y * ySign, matrix);
				parts.push(`M ${p.x} ${p.y}`);
				break;
			}
			case "L": {
				const p = transformPoint2D(cmd.x, cmd.y * ySign, matrix);
				parts.push(`L ${p.x} ${p.y}`);
				break;
			}
			case "Q": {
				const p1 = transformPoint2D(cmd.x1, cmd.y1 * ySign, matrix);
				const p = transformPoint2D(cmd.x, cmd.y * ySign, matrix);
				parts.push(`Q ${p1.x} ${p1.y} ${p.x} ${p.y}`);
				break;
			}
			case "C": {
				const p1 = transformPoint2D(cmd.x1, cmd.y1 * ySign, matrix);
				const p2 = transformPoint2D(cmd.x2, cmd.y2 * ySign, matrix);
				const p = transformPoint2D(cmd.x, cmd.y * ySign, matrix);
				parts.push(`C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p.x} ${p.y}`);
				break;
			}
			case "Z":
				parts.push("Z");
				break;
		}
	}

	return parts.join(" ");
}

/**
 * Render path to canvas with 3D perspective matrix transformation
 * Uses homogeneous coordinates for perspective projection
 */
export function pathToCanvasWithMatrix3D(
	ctx: CanvasRenderingContext2D | Path2D,
	path: GlyphPath,
	matrix: Matrix3x3,
	options?: { flipY?: boolean },
): void {
	const flipY = options?.flipY ?? true;
	const ySign = flipY ? -1 : 1;

	for (const cmd of path.commands) {
		switch (cmd.type) {
			case "M": {
				const p = transformPoint3x3(cmd.x, cmd.y * ySign, matrix);
				ctx.moveTo(p.x, p.y);
				break;
			}
			case "L": {
				const p = transformPoint3x3(cmd.x, cmd.y * ySign, matrix);
				ctx.lineTo(p.x, p.y);
				break;
			}
			case "Q": {
				const p1 = transformPoint3x3(cmd.x1, cmd.y1 * ySign, matrix);
				const p = transformPoint3x3(cmd.x, cmd.y * ySign, matrix);
				ctx.quadraticCurveTo(p1.x, p1.y, p.x, p.y);
				break;
			}
			case "C": {
				const p1 = transformPoint3x3(cmd.x1, cmd.y1 * ySign, matrix);
				const p2 = transformPoint3x3(cmd.x2, cmd.y2 * ySign, matrix);
				const p = transformPoint3x3(cmd.x, cmd.y * ySign, matrix);
				ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p.x, p.y);
				break;
			}
			case "Z":
				ctx.closePath();
				break;
		}
	}
}

/**
 * Convert path to SVG with 3D perspective matrix transformation
 * Uses homogeneous coordinates for perspective projection
 */
export function pathToSVGWithMatrix3D(
	path: GlyphPath,
	matrix: Matrix3x3,
	options?: { flipY?: boolean },
): string {
	const flipY = options?.flipY ?? true;
	const ySign = flipY ? -1 : 1;
	const parts: string[] = [];

	for (const cmd of path.commands) {
		switch (cmd.type) {
			case "M": {
				const p = transformPoint3x3(cmd.x, cmd.y * ySign, matrix);
				parts.push(`M ${p.x} ${p.y}`);
				break;
			}
			case "L": {
				const p = transformPoint3x3(cmd.x, cmd.y * ySign, matrix);
				parts.push(`L ${p.x} ${p.y}`);
				break;
			}
			case "Q": {
				const p1 = transformPoint3x3(cmd.x1, cmd.y1 * ySign, matrix);
				const p = transformPoint3x3(cmd.x, cmd.y * ySign, matrix);
				parts.push(`Q ${p1.x} ${p1.y} ${p.x} ${p.y}`);
				break;
			}
			case "C": {
				const p1 = transformPoint3x3(cmd.x1, cmd.y1 * ySign, matrix);
				const p2 = transformPoint3x3(cmd.x2, cmd.y2 * ySign, matrix);
				const p = transformPoint3x3(cmd.x, cmd.y * ySign, matrix);
				parts.push(`C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p.x} ${p.y}`);
				break;
			}
			case "Z":
				parts.push("Z");
				break;
		}
	}

	return parts.join(" ");
}

/**
 * Apply 2D affine matrix to canvas context using native transform
 * Use ctx.save() before and ctx.restore() after to preserve context state
 */
export function applyMatrixToContext(
	ctx: CanvasRenderingContext2D,
	matrix: Matrix2D,
): void {
	// Canvas transform: (a, b, c, d, e, f)
	// Matrix2D: [a, b, c, d, tx, ty]
	// Canvas expects: [a, b, c, d, e, f] where e=tx, f=ty
	ctx.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
}

/**
 * Convert 2D affine matrix to SVG transform attribute string
 * Returns a string like "matrix(a, b, c, d, tx, ty)"
 */
export function matrixToSVGTransform(matrix: Matrix2D): string {
	return `matrix(${matrix[0]} ${matrix[1]} ${matrix[2]} ${matrix[3]} ${matrix[4]} ${matrix[5]})`;
}

/**
 * Direct SVG serialization with transform applied in single pass
 * Avoids creating intermediate PathCommand arrays
 */
export function pathToSVGDirect(
	path: GlyphPath,
	scale: number,
	offsetX: number,
	offsetY: number,
): string {
	let result = "";

	for (const cmd of path.commands) {
		if (result) result += " ";
		switch (cmd.type) {
			case "M":
				result += `M ${cmd.x * scale + offsetX} ${-cmd.y * scale + offsetY}`;
				break;
			case "L":
				result += `L ${cmd.x * scale + offsetX} ${-cmd.y * scale + offsetY}`;
				break;
			case "Q":
				result += `Q ${cmd.x1 * scale + offsetX} ${-cmd.y1 * scale + offsetY} ${cmd.x * scale + offsetX} ${-cmd.y * scale + offsetY}`;
				break;
			case "C":
				result += `C ${cmd.x1 * scale + offsetX} ${-cmd.y1 * scale + offsetY} ${cmd.x2 * scale + offsetX} ${-cmd.y2 * scale + offsetY} ${cmd.x * scale + offsetX} ${-cmd.y * scale + offsetY}`;
				break;
			case "Z":
				result += "Z";
				break;
		}
	}

	return result;
}
