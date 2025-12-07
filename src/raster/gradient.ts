/**
 * Gradient fill rendering for paths
 */

import type { GlyphPath } from "../render/path.ts";
import { rasterizePath } from "./rasterize.ts";
import {
	type Bitmap,
	createBitmap,
	PixelMode,
	type RasterizeOptions,
} from "./types.ts";

/**
 * Color stop in a gradient (RGBA, 0-255 each)
 */
export interface ColorStop {
	/** Position along gradient, 0.0 to 1.0 */
	offset: number;
	/** RGBA color values, 0-255 each */
	color: [number, number, number, number];
}

/**
 * Linear gradient from point (x0,y0) to (x1,y1)
 */
export interface LinearGradient {
	type: "linear";
	/** Start X coordinate */
	x0: number;
	/** Start Y coordinate */
	y0: number;
	/** End X coordinate */
	x1: number;
	/** End Y coordinate */
	y1: number;
	/** Color stops */
	stops: ColorStop[];
}

/**
 * Radial gradient from center point with radius
 */
export interface RadialGradient {
	type: "radial";
	/** Center X coordinate */
	cx: number;
	/** Center Y coordinate */
	cy: number;
	/** Gradient radius */
	radius: number;
	/** Color stops */
	stops: ColorStop[];
}

/**
 * Gradient type union
 */
export type Gradient = LinearGradient | RadialGradient;

/**
 * Interpolate color between two stops
 */
function lerpColor(
	color1: [number, number, number, number],
	color2: [number, number, number, number],
	t: number,
): [number, number, number, number] {
	return [
		Math.round(color1[0] + (color2[0] - color1[0]) * t),
		Math.round(color1[1] + (color2[1] - color1[1]) * t),
		Math.round(color1[2] + (color2[2] - color1[2]) * t),
		Math.round(color1[3] + (color2[3] - color1[3]) * t),
	];
}

/**
 * Get color at position in gradient
 *
 * @param gradient Linear or radial gradient definition
 * @param x X coordinate
 * @param y Y coordinate
 * @returns RGBA color at position (0-255 each)
 */
export function interpolateGradient(
	gradient: Gradient,
	x: number,
	y: number,
): [number, number, number, number] {
	if (gradient.stops.length === 0) {
		return [0, 0, 0, 0];
	}

	if (gradient.stops.length === 1) {
		return gradient.stops[0].color;
	}

	let t: number;

	if (gradient.type === "linear") {
		const dx = gradient.x1 - gradient.x0;
		const dy = gradient.y1 - gradient.y0;
		const lengthSq = dx * dx + dy * dy;

		if (lengthSq === 0) {
			return gradient.stops[0].color;
		}

		const px = x - gradient.x0;
		const py = y - gradient.y0;
		t = (px * dx + py * dy) / lengthSq;
	} else {
		const dx = x - gradient.cx;
		const dy = y - gradient.cy;
		const distance = Math.sqrt(dx * dx + dy * dy);
		t = gradient.radius > 0 ? distance / gradient.radius : 0;
	}

	t = Math.max(0, Math.min(1, t));

	const sortedStops = [...gradient.stops].sort((a, b) => a.offset - b.offset);

	if (t <= sortedStops[0].offset) {
		return sortedStops[0].color;
	}

	if (t >= sortedStops[sortedStops.length - 1].offset) {
		return sortedStops[sortedStops.length - 1].color;
	}

	for (let i = 0; i < sortedStops.length - 1; i++) {
		const stop1 = sortedStops[i];
		const stop2 = sortedStops[i + 1];

		if (t >= stop1.offset && t <= stop2.offset) {
			const range = stop2.offset - stop1.offset;
			if (range === 0) {
				return stop2.color;
			}
			const localT = (t - stop1.offset) / range;
			return lerpColor(stop1.color, stop2.color, localT);
		}
	}

	return sortedStops[sortedStops.length - 1].color;
}

/**
 * Create a bitmap filled with gradient (no path)
 *
 * @param width Width in pixels
 * @param height Height in pixels
 * @param gradient Linear or radial gradient definition
 * @returns RGBA bitmap filled with gradient
 */
export function createGradientBitmap(
	width: number,
	height: number,
	gradient: Gradient,
): Bitmap {
	const bitmap = createBitmap(width, height, PixelMode.RGBA);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const color = interpolateGradient(gradient, x, y);
			const idx = (y * width + x) * 4;
			bitmap.buffer[idx] = color[0];
			bitmap.buffer[idx + 1] = color[1];
			bitmap.buffer[idx + 2] = color[2];
			bitmap.buffer[idx + 3] = color[3];
		}
	}

	return bitmap;
}

/**
 * Rasterize path with gradient fill
 * First rasterizes path to get coverage mask, then fills with gradient
 *
 * @param path Glyph path to rasterize
 * @param gradient Linear or radial gradient definition
 * @param options Rasterization options (width, height, scale, etc.)
 * @returns RGBA bitmap with gradient-filled path
 */
export function rasterizePathWithGradient(
	path: GlyphPath,
	gradient: Gradient,
	options: RasterizeOptions,
): Bitmap {
	const { width, height } = options;

	const coverageBitmap = rasterizePath(path, {
		...options,
		pixelMode: PixelMode.Gray,
		flipY: options.flipY ?? false,
	});

	const resultBitmap = createBitmap(width, height, PixelMode.RGBA);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const coverage = coverageBitmap.buffer[y * coverageBitmap.pitch + x] ?? 0;

			if (coverage > 0) {
				const color = interpolateGradient(gradient, x, y);
				const idx = (y * width + x) * 4;

				const alpha = (color[3] * coverage) / 255;

				resultBitmap.buffer[idx] = color[0];
				resultBitmap.buffer[idx + 1] = color[1];
				resultBitmap.buffer[idx + 2] = color[2];
				resultBitmap.buffer[idx + 3] = Math.round(alpha);
			}
		}
	}

	return resultBitmap;
}
