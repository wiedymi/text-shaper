import type { GlyphBuffer } from "../buffer/glyph-buffer.ts";
import type { Font } from "../font/font.ts";
import type { Contour, GlyphPoint } from "../font/tables/glyf.ts";
import type { GlyphId } from "../types.ts";

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

	const commands: PathCommand[] = [];

	// Check if this contour uses cubic beziers (CFF font)
	const hasCubic = contour.some((p) => p.cubic);

	if (hasCubic) {
		// CFF-style contour with cubic beziers
		return contourToPathCubic(contour);
	}

	// TrueType-style contour with quadratic beziers
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
	let i = allOffCurve ? 0 : (startIndex + 1) % n;
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
			const nextIndex = (i + 1) % n;
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

		i = (i + 1) % n;
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
export function getGlyphPath(font: Font, glyphId: GlyphId): GlyphPath | null {
	const contours = font.getGlyphContours(glyphId);
	if (!contours) return null;

	const commands: PathCommand[] = [];
	for (const contour of contours) {
		commands.push(...contourToPath(contour));
	}

	const bounds = font.getGlyphBounds(glyphId);

	return { commands, bounds };
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

	const parts: string[] = [];

	for (const cmd of path.commands) {
		switch (cmd.type) {
			case "M":
				parts.push(
					`M ${cmd.x * scale} ${flipY ? -cmd.y * scale : cmd.y * scale}`,
				);
				break;
			case "L":
				parts.push(
					`L ${cmd.x * scale} ${flipY ? -cmd.y * scale : cmd.y * scale}`,
				);
				break;
			case "Q":
				parts.push(
					`Q ${cmd.x1 * scale} ${flipY ? -cmd.y1 * scale : cmd.y1 * scale} ${cmd.x * scale} ${flipY ? -cmd.y * scale : cmd.y * scale}`,
				);
				break;
			case "C":
				parts.push(
					`C ${cmd.x1 * scale} ${flipY ? -cmd.y1 * scale : cmd.y1 * scale} ${cmd.x2 * scale} ${flipY ? -cmd.y2 * scale : cmd.y2 * scale} ${cmd.x * scale} ${flipY ? -cmd.y * scale : cmd.y * scale}`,
				);
				break;
			case "Z":
				parts.push("Z");
				break;
		}
	}

	return parts.join(" ");
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
	options?: { fontSize?: number; fill?: string },
): string | null {
	const path = getGlyphPath(font, glyphId);
	if (!path) return null;

	const fontSize = options?.fontSize ?? 100;
	const fill = options?.fill ?? "currentColor";
	const scale = fontSize / font.unitsPerEm;

	const bounds = path.bounds;
	if (!bounds) return null;

	const width = Math.ceil((bounds.xMax - bounds.xMin) * scale);
	const height = Math.ceil((bounds.yMax - bounds.yMin) * scale);
	const viewBox = `${bounds.xMin} ${-bounds.yMax} ${bounds.xMax - bounds.xMin} ${bounds.yMax - bounds.yMin}`;

	const pathData = pathToSVG(path, { flipY: true, scale: 1 });

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
  <path d="${pathData}" fill="${fill}"/>
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
	options?: { fontSize?: number; x?: number; y?: number; fill?: string },
): void {
	const fontSize = options?.fontSize ?? 16;
	const startX = options?.x ?? 0;
	const startY = options?.y ?? 0;
	const fill = options?.fill ?? "black";

	const scale = fontSize / font.unitsPerEm;

	ctx.fillStyle = fill;

	let x = startX;
	let y = startY;

	for (const glyph of glyphs) {
		const path = getGlyphPath(font, glyph.glyphId);
		if (path) {
			ctx.beginPath();
			pathToCanvas(ctx, path, {
				scale,
				flipY: true,
				offsetX: x + glyph.xOffset * scale,
				offsetY: y - glyph.yOffset * scale,
			});
			ctx.fill();
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
	options?: { fontSize?: number; fill?: string },
): string {
	const fontSize = options?.fontSize ?? 100;
	const fill = options?.fill ?? "currentColor";
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

			// Transform commands with offset
			const transformedCommands = path.commands.map((cmd): PathCommand => {
				switch (cmd.type) {
					case "M":
					case "L":
						return {
							type: cmd.type,
							x: cmd.x * scale + offsetX,
							y: -cmd.y * scale + offsetY,
						};
					case "Q":
						return {
							type: "Q",
							x1: cmd.x1 * scale + offsetX,
							y1: -cmd.y1 * scale + offsetY,
							x: cmd.x * scale + offsetX,
							y: -cmd.y * scale + offsetY,
						};
					case "C":
						return {
							type: "C",
							x1: cmd.x1 * scale + offsetX,
							y1: -cmd.y1 * scale + offsetY,
							x2: cmd.x2 * scale + offsetX,
							y2: -cmd.y2 * scale + offsetY,
							x: cmd.x * scale + offsetX,
							y: -cmd.y * scale + offsetY,
						};
					case "Z":
						return { type: "Z" };
					default:
						return cmd;
				}
			});

			const pathStr = pathToSVG(
				{ commands: transformedCommands, bounds: null },
				{ flipY: false, scale: 1 },
			);
			paths.push(pathStr);

			// Update bounds
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

	const width = Math.ceil(maxX - minX);
	const height = Math.ceil(maxY - minY);
	const viewBox = `${Math.floor(minX)} ${Math.floor(minY)} ${width} ${height}`;

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
  <path d="${paths.join(" ")}" fill="${fill}"/>
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
	options?: { fontSize?: number; x?: number; y?: number; fill?: string },
): void {
	const fontSize = options?.fontSize ?? 16;
	const startX = options?.x ?? 0;
	const startY = options?.y ?? 0;
	const fill = options?.fill ?? "black";

	const scale = fontSize / font.unitsPerEm;

	ctx.fillStyle = fill;

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
			ctx.fill();
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
	options?: { fontSize?: number; fill?: string },
): string {
	const fontSize = options?.fontSize ?? 100;
	const fill = options?.fill ?? "currentColor";
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

			const transformedCommands = path.commands.map((cmd): PathCommand => {
				switch (cmd.type) {
					case "M":
					case "L":
						return {
							type: cmd.type,
							x: cmd.x * scale + offsetX,
							y: -cmd.y * scale + offsetY,
						};
					case "Q":
						return {
							type: "Q",
							x1: cmd.x1 * scale + offsetX,
							y1: -cmd.y1 * scale + offsetY,
							x: cmd.x * scale + offsetX,
							y: -cmd.y * scale + offsetY,
						};
					case "C":
						return {
							type: "C",
							x1: cmd.x1 * scale + offsetX,
							y1: -cmd.y1 * scale + offsetY,
							x2: cmd.x2 * scale + offsetX,
							y2: -cmd.y2 * scale + offsetY,
							x: cmd.x * scale + offsetX,
							y: -cmd.y * scale + offsetY,
						};
					case "Z":
						return { type: "Z" };
					default:
						return cmd;
				}
			});

			const pathStr = pathToSVG(
				{ commands: transformedCommands, bounds: null },
				{ flipY: false, scale: 1 },
			);
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

	const width = Math.ceil(maxX - minX);
	const height = Math.ceil(maxY - minY);
	const viewBox = `${Math.floor(minX)} ${Math.floor(minY)} ${width} ${height}`;

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
  <path d="${paths.join(" ")}" fill="${fill}"/>
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
