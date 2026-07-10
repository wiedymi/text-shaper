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

/** Font-size interpretation used when extracting a scaled glyph outline. */
export type GlyphPathSizeMode = "em" | "height" | "freetype-real-dim";

function freeTypeRealDimension(font: Font): number {
	const os2 = font.os2;
	if (os2) {
		const winHeight = os2.usWinAscent + os2.usWinDescent;
		if (winHeight !== 0) return winHeight;
	}
	const faceHeight = font.ascender - font.descender;
	if (faceHeight !== 0 && font.height !== 0) return faceHeight;
	if (os2) {
		const typoHeight = os2.sTypoAscender - os2.sTypoDescender;
		if (typoHeight !== 0) return typoHeight;
	}
	const boundsHeight = font.head.yMax - font.head.yMin;
	return boundsHeight || font.unitsPerEm;
}

function glyphPathScaleDenominator(
	font: Font,
	mode: GlyphPathSizeMode,
): number {
	if (mode === "em") return font.unitsPerEm;
	if (mode === "height") return font.height || font.unitsPerEm;
	return freeTypeRealDimension(font);
}

// FreeType's FT_MulFix: multiply an integer font coordinate by a 16.16 scale
// and round to the nearest integer 26.6 coordinate.
function freeTypeMulFix(value: number, scale16: number): number {
	const product = value * scale16;
	if (product >= 0) return Math.floor((product + 0x8000) / 0x10000);
	return -Math.floor((-product + 0x8000) / 0x10000);
}

function midpointFloor(a: number, b: number): number {
	return Math.floor((a + b) / 2);
}

// ass_outline_convert flips Y before calculating implied conic points. For a
// positive-Y public path that is flipped later at raster time, the equivalent
// midpoint is ceil((a + b) / 2), not floor((a + b) / 2).
function midpointFlippedY(a: number, b: number): number {
	return Math.ceil((a + b) / 2);
}

function scaledFreeTypeContourToPath(contour: Contour): PathCommand[] {
	if (contour.length === 0) return [];
	let cubic = false;
	for (let i = 0; i < contour.length; i++) {
		if (!contour[i]!.onCurve && contour[i]!.cubic) {
			cubic = true;
			break;
		}
	}
	if (cubic) {
		const pixelContour: Contour = new Array(contour.length);
		for (let i = 0; i < contour.length; i++) {
			const point = contour[i]!;
			pixelContour[i] = {
				...point,
				x: point.x / 64,
				y: point.y / 64,
			};
		}
		return contourToPathCubic(pixelContour);
	}

	const commands: PathCommand[] = [];
	const count = contour.length;
	let startIndex = -1;
	for (let i = 0; i < count; i++) {
		if (contour[i]!.onCurve) {
			startIndex = i;
			break;
		}
	}

	let startX: number;
	let startY: number;
	let index: number;
	if (startIndex >= 0) {
		const start = contour[startIndex]!;
		startX = start.x;
		startY = start.y;
		index = startIndex + 1;
		if (index === count) index = 0;
	} else {
		const first = contour[0]!;
		const last = contour[count - 1]!;
		startX = midpointFloor(first.x, last.x);
		startY = midpointFlippedY(first.y, last.y);
		index = 0;
	}
	commands.push({ type: "M", x: startX / 64, y: startY / 64 });

	let currentX = startX;
	let currentY = startY;
	let visited = 0;
	while (visited < count) {
		const point = contour[index]!;
		if (point.onCurve) {
			commands.push({ type: "L", x: point.x / 64, y: point.y / 64 });
			currentX = point.x;
			currentY = point.y;
		} else {
			const nextIndex = index + 1 === count ? 0 : index + 1;
			const next = contour[nextIndex]!;
			let endX: number;
			let endY: number;
			if (next.onCurve) {
				endX = next.x;
				endY = next.y;
				index = nextIndex;
				visited++;
			} else {
				endX = midpointFloor(point.x, next.x);
				endY = midpointFlippedY(point.y, next.y);
			}
			commands.push({
				type: "Q",
				x1: point.x / 64,
				y1: point.y / 64,
				x: endX / 64,
				y: endY / 64,
			});
			currentX = endX;
			currentY = endY;
		}
		index++;
		if (index === count) index = 0;
		visited++;
		if (currentX === startX && currentY === startY) break;
	}
	commands.push({ type: "Z" });
	return commands;
}

/**
 * Convert contours to path commands
 * Handles both TrueType (quadratic Béziers) and CFF (cubic Béziers)
 */
export function contourToPath(contour: Contour): PathCommand[] {
	if (contour.length === 0) return [];

	// Fast check: if first off-curve point is cubic, use cubic path
	// CFF glyphs always have cubic control points, TrueType never does
	for (let i = 0; i < contour.length; i++) {
		const p = contour[i]!;
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
	for (let i = 0; i < contour.length; i++) {
		const point = contour[i]!;
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
	let i = allOffCurve ? 0 : startIndex + 1;
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
const sizedPathCache = new WeakMap<
	Font,
	Map<string, GlyphPath | null>
>();

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
	for (let i = 0; i < result.contours.length; i++) {
		const contour = result.contours[i]!;
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
 * Extract a glyph at a concrete size using FreeType-compatible 26.6 point
 * rounding before implied TrueType conic points are created.
 *
 * `freetype-real-dim` mirrors FT_SIZE_REQUEST_TYPE_REAL_DIM and libass's face
 * metric selection. It is useful when exact compatibility matters; normal UI
 * rendering should generally keep using `getGlyphPath` plus a transform.
 */
export function getGlyphPathAtSize(
	font: Font,
	glyphId: GlyphId,
	sizePx: number,
	mode: GlyphPathSizeMode = "em",
): GlyphPath | null {
	if (!Number.isFinite(sizePx) || sizePx <= 0) return null;
	const key = `${glyphId}|${sizePx}|${mode}`;
	let fontCache = sizedPathCache.get(font);
	if (fontCache?.has(key)) return fontCache.get(key) ?? null;

	const result = font.getGlyphContoursAndBounds(glyphId);
	if (!result) {
		if (!fontCache) {
			fontCache = new Map();
			sizedPathCache.set(font, fontCache);
		}
		fontCache.set(key, null);
		return null;
	}

	const denominator = glyphPathScaleDenominator(font, mode);
	const scale16 = Math.round((sizePx * 64 * 0x10000) / denominator);
	const commands: PathCommand[] = [];
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (let i = 0; i < result.contours.length; i++) {
		const source = result.contours[i]!;
		const scaled: Contour = new Array(source.length);
		for (let j = 0; j < source.length; j++) {
			const point = source[j]!;
			const x26 = freeTypeMulFix(point.x, scale16);
			const y26 = freeTypeMulFix(point.y, scale16);
			scaled[j] = { ...point, x: x26, y: y26 };
			if (x26 < minX) minX = x26;
			if (x26 > maxX) maxX = x26;
			if (y26 < minY) minY = y26;
			if (y26 > maxY) maxY = y26;
		}
		commands.push(...scaledFreeTypeContourToPath(scaled));
	}
	const bounds =
		minX === Number.POSITIVE_INFINITY
			? null
			: {
					xMin: minX / 64,
					yMin: minY / 64,
					xMax: maxX / 64,
					yMax: maxY / 64,
				};
	const path: GlyphPath = { commands, bounds };
	if (!fontCache) {
		fontCache = new Map();
		sizedPathCache.set(font, fontCache);
	}
	fontCache.set(key, path);
	return path;
}

/**
 * SVG coordinate scaling factor for sub-pixel precision.
 * Path data is output at 10x scale with integer coordinates,
 * viewBox is scaled to match, giving 0.1px precision with integer performance.
 */
export const SVG_SCALE = 10;

// Cache for default SVG strings (flipY=true, scale=1)
const svgCache = new WeakMap<GlyphPath, string>();

/**
 * Convert path commands to SVG path data string
 * Outputs at SVG_SCALE (10x) with integer coordinates for performance
 * Caches results for default options (flipY=true, scale=1)
 */
export function pathToSVG(
	path: GlyphPath,
	options?: { flipY?: boolean; scale?: number },
): string {
	const scale = options?.scale ?? 1;
	const flipY = options?.flipY ?? true;

	// Use cache for default options
	if (scale === 1 && flipY) {
		const cached = svgCache.get(path);
		if (cached) return cached;
	}

	const s = scale * SVG_SCALE;
	const ys = flipY ? -s : s;

	let result = "";

	for (let i = 0; i < path.commands.length; i++) {
		const cmd = path.commands[i]!;
		if (i > 0) result += " ";
		switch (cmd.type) {
			case "M":
				result += "M " + Math.round(cmd.x * s) + " " + Math.round(cmd.y * ys);
				break;
			case "L":
				result += "L " + Math.round(cmd.x * s) + " " + Math.round(cmd.y * ys);
				break;
			case "Q":
				result +=
					"Q " +
					Math.round(cmd.x1 * s) +
					" " +
					Math.round(cmd.y1 * ys) +
					" " +
					Math.round(cmd.x * s) +
					" " +
					Math.round(cmd.y * ys);
				break;
			case "C":
				result +=
					"C " +
					Math.round(cmd.x1 * s) +
					" " +
					Math.round(cmd.y1 * ys) +
					" " +
					Math.round(cmd.x2 * s) +
					" " +
					Math.round(cmd.y2 * ys) +
					" " +
					Math.round(cmd.x * s) +
					" " +
					Math.round(cmd.y * ys);
				break;
			case "Z":
				result += "Z";
				break;
		}
	}

	// Cache for default options
	if (scale === 1 && flipY) {
		svgCache.set(path, result);
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

	for (let i = 0; i < path.commands.length; i++) {
		const cmd = path.commands[i]!;
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
	// ViewBox is scaled by SVG_SCALE to match path coordinates
	const vbX = Math.round((bounds.xMin - strokePadding) * SVG_SCALE);
	const vbY = Math.round((-bounds.yMax - strokePadding) * SVG_SCALE);
	const vbW = Math.round(
		(bounds.xMax - bounds.xMin + strokePadding * 2) * SVG_SCALE,
	);
	const vbH = Math.round(
		(bounds.yMax - bounds.yMin + strokePadding * 2) * SVG_SCALE,
	);
	const viewBox = `${vbX} ${vbY} ${vbW} ${vbH}`;

	const pathData = pathToSVG(path, { flipY: true, scale: 1 });

	const strokeAttr = stroke
		? ` stroke="${stroke}" stroke-width="${strokeWidth * SVG_SCALE}"`
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

	for (let i = 0; i < glyphs.length; i++) {
		const glyph = glyphs[i]!;
		const path = getGlyphPath(font, glyph.glyphId);
		if (path) {
			ctx.beginPath();

			if (matrix3D) {
				// Build combined matrix: translate to position, scale, then apply 3D
				const posX = x + glyph.xOffset * scale;
				const posY = y - glyph.yOffset * scale;
				// Create combined 3x3 matrix with scale and position baked in
				const combined: Matrix3x3 = [
					[
						matrix3D[0][0] * scale,
						matrix3D[0][1] * scale,
						matrix3D[0][0] * posX + matrix3D[0][1] * posY + matrix3D[0][2],
					],
					[
						matrix3D[1][0] * scale,
						matrix3D[1][1] * scale,
						matrix3D[1][0] * posX + matrix3D[1][1] * posY + matrix3D[1][2],
					],
					[
						matrix3D[2][0] * scale,
						matrix3D[2][1] * scale,
						matrix3D[2][0] * posX + matrix3D[2][1] * posY + matrix3D[2][2],
					],
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

	let pathsStr = "";
	let x = 0;
	let y = 0;
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;

	for (let i = 0; i < glyphs.length; i++) {
		const glyph = glyphs[i]!;
		const path = getGlyphPath(font, glyph.glyphId);
		if (path?.bounds) {
			const offsetX = x + glyph.xOffset * scale;
			const offsetY = y - glyph.yOffset * scale;

			let pathStr: string;

			if (matrix3D && !useNativeTransform) {
				// Apply 3D matrix to path coordinates
				const combined: Matrix3x3 = [
					[
						matrix3D[0][0] * scale,
						matrix3D[0][1] * scale,
						matrix3D[0][0] * offsetX +
							matrix3D[0][1] * offsetY +
							matrix3D[0][2],
					],
					[
						matrix3D[1][0] * scale,
						matrix3D[1][1] * scale,
						matrix3D[1][0] * offsetX +
							matrix3D[1][1] * offsetY +
							matrix3D[1][2],
					],
					[
						matrix3D[2][0] * scale,
						matrix3D[2][1] * scale,
						matrix3D[2][0] * offsetX +
							matrix3D[2][1] * offsetY +
							matrix3D[2][2],
					],
				];
				pathStr = pathToSVGWithMatrix3D(path, combined);

				// Update bounds with transformed corners
				const b = path.bounds;
				const corners = [
					transformPoint3x3(
						b.xMin * scale + offsetX,
						-b.yMax * scale + offsetY,
						matrix3D,
					),
					transformPoint3x3(
						b.xMax * scale + offsetX,
						-b.yMax * scale + offsetY,
						matrix3D,
					),
					transformPoint3x3(
						b.xMin * scale + offsetX,
						-b.yMin * scale + offsetY,
						matrix3D,
					),
					transformPoint3x3(
						b.xMax * scale + offsetX,
						-b.yMin * scale + offsetY,
						matrix3D,
					),
				];
				for (let j = 0; j < corners.length; j++) {
					const c = corners[j]!;
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
					transformPoint2D(
						b.xMin * scale + offsetX,
						-b.yMax * scale + offsetY,
						matrix,
					),
					transformPoint2D(
						b.xMax * scale + offsetX,
						-b.yMax * scale + offsetY,
						matrix,
					),
					transformPoint2D(
						b.xMin * scale + offsetX,
						-b.yMin * scale + offsetY,
						matrix,
					),
					transformPoint2D(
						b.xMax * scale + offsetX,
						-b.yMin * scale + offsetY,
						matrix,
					),
				];
				for (let j = 0; j < corners.length; j++) {
					const c = corners[j]!;
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

			if (pathsStr) pathsStr += " ";
			pathsStr += pathStr;
		}

		x += glyph.xAdvance * scale;
		y += glyph.yAdvance * scale;
	}

	if (!pathsStr) {
		return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
	}

	// Add stroke padding to bounds
	const strokePadding = stroke ? strokeWidth / 2 : 0;
	const width = Math.ceil(maxX - minX + strokePadding * 2);
	const height = Math.ceil(maxY - minY + strokePadding * 2);
	// ViewBox is scaled by SVG_SCALE to match path coordinates
	const vbX = Math.floor((minX - strokePadding) * SVG_SCALE);
	const vbY = Math.floor((minY - strokePadding) * SVG_SCALE);
	const vbW = Math.ceil(width * SVG_SCALE);
	const vbH = Math.ceil(height * SVG_SCALE);
	const viewBox = `${vbX} ${vbY} ${vbW} ${vbH}`;

	const strokeAttr = stroke
		? ` stroke="${stroke}" stroke-width="${strokeWidth * SVG_SCALE}"${options?.lineCap ? ` stroke-linecap="${options.lineCap}"` : ""}${options?.lineJoin ? ` stroke-linejoin="${options.lineJoin}"` : ""}`
		: "";

	// Use native transform attribute if requested (only for 2D matrix)
	const transformAttr =
		useNativeTransform && matrix
			? ` transform="${matrixToSVGTransform(matrix)}"`
			: "";

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
  <path d="${pathsStr}" fill="${fill}"${strokeAttr}${transformAttr}/>
</svg>`;
}

/**
 * Convert GlyphBuffer output to ShapedGlyph array
 */
export function glyphBufferToShapedGlyphs(buffer: GlyphBuffer): ShapedGlyph[] {
	const result: ShapedGlyph[] = [];
	for (let i = 0; i < buffer.infos.length; i++) {
		const info = buffer.infos[i]!;
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
	for (let i = 0; i < contours.length; i++) {
		const contour = contours[i]!;
		commands.push(...contourToPath(contour));
	}

	let xMin = Infinity;
	let yMin = Infinity;
	let xMax = -Infinity;
	let yMax = -Infinity;
	for (let i = 0; i < contours.length; i++) {
		const contour = contours[i]!;
		for (let j = 0; j < contour.length; j++) {
			const point = contour[j]!;
			if (point.x < xMin) xMin = point.x;
			if (point.y < yMin) yMin = point.y;
			if (point.x > xMax) xMax = point.x;
			if (point.y > yMax) yMax = point.y;
		}
	}
	const bounds = xMin === Infinity ? null : { xMin, yMin, xMax, yMax };

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

	for (let i = 0; i < glyphs.length; i++) {
		const glyph = glyphs[i]!;
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

	let pathsStr = "";
	let x = 0;
	let y = 0;
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;

	for (let i = 0; i < glyphs.length; i++) {
		const glyph = glyphs[i]!;
		const path = getGlyphPathWithVariation(font, glyph.glyphId, axisCoords);
		if (path?.bounds) {
			const offsetX = x + glyph.xOffset * scale;
			const offsetY = y - glyph.yOffset * scale;

			// Direct SVG serialization - no intermediate array allocation
			const pathStr = pathToSVGDirect(path, scale, offsetX, offsetY);
			if (pathsStr) pathsStr += " ";
			pathsStr += pathStr;

			const b = path.bounds;
			minX = Math.min(minX, offsetX + b.xMin * scale);
			maxX = Math.max(maxX, offsetX + b.xMax * scale);
			minY = Math.min(minY, offsetY - b.yMax * scale);
			maxY = Math.max(maxY, offsetY - b.yMin * scale);
		}

		x += glyph.xAdvance * scale;
		y += glyph.yAdvance * scale;
	}

	if (!pathsStr) {
		return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
	}

	// Add stroke padding to bounds
	const strokePadding = stroke ? strokeWidth / 2 : 0;
	const width = Math.ceil(maxX - minX + strokePadding * 2);
	const height = Math.ceil(maxY - minY + strokePadding * 2);
	// ViewBox is scaled by SVG_SCALE to match path coordinates
	const vbX = Math.floor((minX - strokePadding) * SVG_SCALE);
	const vbY = Math.floor((minY - strokePadding) * SVG_SCALE);
	const vbW = Math.ceil(width * SVG_SCALE);
	const vbH = Math.ceil(height * SVG_SCALE);
	const viewBox = `${vbX} ${vbY} ${vbW} ${vbH}`;

	const strokeAttr = stroke
		? ` stroke="${stroke}" stroke-width="${strokeWidth * SVG_SCALE}"${options?.lineCap ? ` stroke-linecap="${options.lineCap}"` : ""}${options?.lineJoin ? ` stroke-linejoin="${options.lineJoin}"` : ""}`
		: "";

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
  <path d="${pathsStr}" fill="${fill}"${strokeAttr}/>
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
	for (let i = 0; i < glyphs.length; i++) {
		const glyph = glyphs[i]!;
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

	for (let i = 0; i < path.commands.length; i++) {
		const cmd = path.commands[i]!;
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
	let result = "";

	for (let i = 0; i < path.commands.length; i++) {
		const cmd = path.commands[i]!;
		if (i > 0) result += " ";
		switch (cmd.type) {
			case "M": {
				const p = transformPoint2D(cmd.x, cmd.y * ySign, matrix);
				result += "M " + p.x + " " + p.y;
				break;
			}
			case "L": {
				const p = transformPoint2D(cmd.x, cmd.y * ySign, matrix);
				result += "L " + p.x + " " + p.y;
				break;
			}
			case "Q": {
				const p1 = transformPoint2D(cmd.x1, cmd.y1 * ySign, matrix);
				const p = transformPoint2D(cmd.x, cmd.y * ySign, matrix);
				result += "Q " + p1.x + " " + p1.y + " " + p.x + " " + p.y;
				break;
			}
			case "C": {
				const p1 = transformPoint2D(cmd.x1, cmd.y1 * ySign, matrix);
				const p2 = transformPoint2D(cmd.x2, cmd.y2 * ySign, matrix);
				const p = transformPoint2D(cmd.x, cmd.y * ySign, matrix);
				result +=
					"C " +
					p1.x +
					" " +
					p1.y +
					" " +
					p2.x +
					" " +
					p2.y +
					" " +
					p.x +
					" " +
					p.y;
				break;
			}
			case "Z":
				result += "Z";
				break;
		}
	}

	return result;
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

	for (let i = 0; i < path.commands.length; i++) {
		const cmd = path.commands[i]!;
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
	let result = "";

	for (let i = 0; i < path.commands.length; i++) {
		const cmd = path.commands[i]!;
		if (i > 0) result += " ";
		switch (cmd.type) {
			case "M": {
				const p = transformPoint3x3(cmd.x, cmd.y * ySign, matrix);
				result += "M " + p.x + " " + p.y;
				break;
			}
			case "L": {
				const p = transformPoint3x3(cmd.x, cmd.y * ySign, matrix);
				result += "L " + p.x + " " + p.y;
				break;
			}
			case "Q": {
				const p1 = transformPoint3x3(cmd.x1, cmd.y1 * ySign, matrix);
				const p = transformPoint3x3(cmd.x, cmd.y * ySign, matrix);
				result += "Q " + p1.x + " " + p1.y + " " + p.x + " " + p.y;
				break;
			}
			case "C": {
				const p1 = transformPoint3x3(cmd.x1, cmd.y1 * ySign, matrix);
				const p2 = transformPoint3x3(cmd.x2, cmd.y2 * ySign, matrix);
				const p = transformPoint3x3(cmd.x, cmd.y * ySign, matrix);
				result +=
					"C " +
					p1.x +
					" " +
					p1.y +
					" " +
					p2.x +
					" " +
					p2.y +
					" " +
					p.x +
					" " +
					p.y;
				break;
			}
			case "Z":
				result += "Z";
				break;
		}
	}

	return result;
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
	ctx.transform(
		matrix[0],
		matrix[1],
		matrix[2],
		matrix[3],
		matrix[4],
		matrix[5],
	);
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
 * Outputs at SVG_SCALE (10x) with integer coordinates for performance
 */
export function pathToSVGDirect(
	path: GlyphPath,
	scale: number,
	offsetX: number,
	offsetY: number,
): string {
	let result = "";
	const s = scale * SVG_SCALE;
	const ns = -scale * SVG_SCALE;
	const ox = offsetX * SVG_SCALE;
	const oy = offsetY * SVG_SCALE;

	for (let i = 0; i < path.commands.length; i++) {
		const cmd = path.commands[i]!;
		if (i > 0) result += " ";
		switch (cmd.type) {
			case "M":
				result +=
					"M " + Math.round(cmd.x * s + ox) + " " + Math.round(cmd.y * ns + oy);
				break;
			case "L":
				result +=
					"L " + Math.round(cmd.x * s + ox) + " " + Math.round(cmd.y * ns + oy);
				break;
			case "Q":
				result +=
					"Q " +
					Math.round(cmd.x1 * s + ox) +
					" " +
					Math.round(cmd.y1 * ns + oy) +
					" " +
					Math.round(cmd.x * s + ox) +
					" " +
					Math.round(cmd.y * ns + oy);
				break;
			case "C":
				result +=
					"C " +
					Math.round(cmd.x1 * s + ox) +
					" " +
					Math.round(cmd.y1 * ns + oy) +
					" " +
					Math.round(cmd.x2 * s + ox) +
					" " +
					Math.round(cmd.y2 * ns + oy) +
					" " +
					Math.round(cmd.x * s + ox) +
					" " +
					Math.round(cmd.y * ns + oy);
				break;
			case "Z":
				result += "Z";
				break;
		}
	}

	return result;
}
