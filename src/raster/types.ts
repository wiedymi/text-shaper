/**
 * Rasterizer types - FreeType-style bitmap rendering
 */

import type { GlyphPath } from "../render/path.ts";

/**
 * Pixel modes for bitmap output
 */
export enum PixelMode {
	/** 1-bit per pixel, 8 pixels per byte */
	Mono = 0,
	/** 8-bit grayscale, 1 byte per pixel */
	Gray = 1,
	/** 24-bit LCD subpixel RGB, 3 bytes per pixel */
	LCD = 2,
	/** 24-bit LCD subpixel vertical RGB */
	LCD_V = 3,
	/** 32-bit RGBA, 4 bytes per pixel */
	RGBA = 4,
}

/**
 * Fill rule for outline rendering
 */
export enum FillRule {
	/** Non-zero winding rule (default) */
	NonZero = 0,
	/** Even-odd (alternating) fill rule */
	EvenOdd = 1,
}

/**
 * Bitmap buffer for rasterized glyphs
 */
export interface Bitmap {
	/** Pixel buffer */
	buffer: Uint8Array;
	/** Width in pixels */
	width: number;
	/** Height in pixels */
	rows: number;
	/** Bytes per row (may include padding) */
	pitch: number;
	/** Pixel format */
	pixelMode: PixelMode;
	/** Number of gray levels (256 for 8-bit) */
	numGrays: number;
}

/**
 * A single horizontal span of pixels (for direct rendering)
 */
export interface Span {
	/** X position of span start */
	x: number;
	/** Length in pixels */
	len: number;
	/** Coverage value 0-255 */
	coverage: number;
}

/**
 * Callback for span-based rendering
 * @template T User data type passed through from render call
 */
export type SpanFunc<T = void> = (
	y: number,
	spans: Span[],
	userData: T,
) => void;

/**
 * Rasterization parameters
 */
export interface RasterParams {
	/** Target bitmap (null for span callback mode) */
	target?: Bitmap;
	/** Source outline path */
	source: GlyphPath;
	/** Fill rule */
	fillRule?: FillRule;
	/** Span callback for direct rendering */
	spanFunc?: SpanFunc;
	/** Clip box (in pixels) */
	clipBox?: {
		xMin: number;
		yMin: number;
		xMax: number;
		yMax: number;
	};
}

/**
 * Options for rasterizing a glyph
 */
export interface RasterizeOptions {
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
	/** Pixel mode */
	pixelMode?: PixelMode;
	/** Fill rule */
	fillRule?: FillRule;
	/** Flip Y axis (font coords are Y-up, bitmap is Y-down) */
	flipY?: boolean;
}

/**
 * Result of glyph rasterization
 */
export interface RasterizedGlyph {
	/** Pixel data */
	bitmap: Bitmap;
	/** Bearing X (offset from origin to left edge) */
	bearingX: number;
	/** Bearing Y (offset from origin to top edge) */
	bearingY: number;
}

/**
 * Glyph metrics for atlas building
 */
export interface GlyphMetrics {
	/** Glyph ID */
	glyphId: number;
	/** X position in atlas */
	atlasX: number;
	/** Y position in atlas */
	atlasY: number;
	/** Width in atlas */
	width: number;
	/** Height in atlas */
	height: number;
	/** Bearing X */
	bearingX: number;
	/** Bearing Y */
	bearingY: number;
	/** Horizontal advance */
	advance: number;
}

/**
 * Texture atlas containing multiple glyphs
 */
export interface GlyphAtlas {
	/** Atlas bitmap */
	bitmap: Bitmap;
	/** Glyph metrics indexed by glyph ID */
	glyphs: Map<number, GlyphMetrics>;
	/** Font size used for rendering */
	fontSize: number;
}

/**
 * Options for building a glyph atlas
 */
export interface AtlasOptions {
	/** Font size in pixels */
	fontSize: number;
	/** Padding between glyphs */
	padding?: number;
	/** Maximum atlas width */
	maxWidth?: number;
	/** Maximum atlas height */
	maxHeight?: number;
	/** Pixel mode */
	pixelMode?: PixelMode;
	/** Enable hinting */
	hinting?: boolean;
}

/**
 * Create an empty bitmap
 */
export function createBitmap(
	width: number,
	height: number,
	pixelMode: PixelMode = PixelMode.Gray,
): Bitmap {
	let bytesPerPixel: number;
	switch (pixelMode) {
		case PixelMode.Mono:
			bytesPerPixel = 1 / 8; // 8 pixels per byte
			break;
		case PixelMode.Gray:
			bytesPerPixel = 1;
			break;
		case PixelMode.LCD:
		case PixelMode.LCD_V:
			bytesPerPixel = 3;
			break;
		case PixelMode.RGBA:
			bytesPerPixel = 4;
			break;
	}

	const pitch =
		pixelMode === PixelMode.Mono ? Math.ceil(width / 8) : width * bytesPerPixel;

	return {
		buffer: new Uint8Array(pitch * height),
		width,
		rows: height,
		pitch,
		pixelMode,
		numGrays: pixelMode === PixelMode.Mono ? 2 : 256,
	};
}

/**
 * Clear a bitmap to zero
 */
export function clearBitmap(bitmap: Bitmap): void {
	bitmap.buffer.fill(0);
}

/**
 * Create a bottom-up bitmap (negative pitch)
 * Bottom-up bitmaps have row 0 at the bottom of the image,
 * which matches some graphics APIs (e.g., Windows DIB, OpenGL textures)
 */
export function createBottomUpBitmap(
	width: number,
	height: number,
	pixelMode: PixelMode = PixelMode.Gray,
): Bitmap {
	const bitmap = createBitmap(width, height, pixelMode);
	// Negative pitch indicates bottom-up storage
	bitmap.pitch = -bitmap.pitch;
	return bitmap;
}
