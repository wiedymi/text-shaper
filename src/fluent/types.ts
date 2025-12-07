/**
 * Shared types for the fluent API
 */

import type { FillRule, PixelMode } from "../raster/types.ts";
import type { Matrix2D, Matrix3x3 } from "../render/outline-transform.ts";

/**
 * Accumulated transform state for lazy evaluation
 */
export interface TransformState {
	/** 2D affine transform matrix */
	matrix2D: Matrix2D;
	/** 3D perspective matrix (takes precedence over matrix2D if set) */
	matrix3D: Matrix3x3 | null;
}

/**
 * Options for rasterization
 */
export interface RasterOptions {
	/** Bitmap width in pixels */
	width?: number;
	/** Bitmap height in pixels */
	height?: number;
	/** Scale factor applied during rasterization */
	scale?: number;
	/** X offset for rasterization */
	offsetX?: number;
	/** Y offset for rasterization */
	offsetY?: number;
	/** Padding around the glyph */
	padding?: number;
	/** Pixel mode (Gray, Mono, LCD, etc.) */
	pixelMode?: PixelMode;
	/** Fill rule for path filling */
	fillRule?: FillRule;
	/** Flip Y axis (default true for screen coordinates) */
	flipY?: boolean;
}

/**
 * Options for auto-sized rasterization
 */
export interface AutoRasterOptions {
	/** Padding around the glyph (default: 1) */
	padding?: number;
	/** Scale factor (default: 1) */
	scale?: number;
	/** Pixel mode (default: Gray) */
	pixelMode?: PixelMode;
	/** Fill rule (default: NonZero) */
	fillRule?: FillRule;
	/** Flip Y axis (default: true) */
	flipY?: boolean;
}

/**
 * Options for SVG output
 */
export interface SVGOptions {
	/** Flip Y axis (default: true) */
	flipY?: boolean;
	/** Scale factor */
	scale?: number;
}

/**
 * Options for SVG element output
 */
export interface SVGElementOptions {
	/** Font size for scaling */
	fontSize?: number;
	/** Fill color */
	fill?: string;
	/** Stroke color */
	stroke?: string;
	/** Stroke width */
	strokeWidth?: number;
}

/**
 * Options for canvas rendering
 */
export interface CanvasOptions {
	/** Flip Y axis (default: true) */
	flipY?: boolean;
	/** Scale factor */
	scale?: number;
	/** X offset */
	offsetX?: number;
	/** Y offset */
	offsetY?: number;
	/** Fill color (set to "none" to skip fill) */
	fill?: string;
	/** Stroke color */
	stroke?: string;
	/** Stroke width */
	strokeWidth?: number;
}
