/**
 * Fluent API for transform and rendering operations
 *
 * Provides two styles of composition:
 * 1. Builder pattern: glyph(font, id).scale(2).blur(5).toRGBA()
 * 2. Pipe pattern: pipe(path, scale(2), rasterize(...), blur(5), toRGBA)
 */

import type { Font } from "../font/font.ts";
import {
	atlasToAlpha,
	atlasToRGBA,
	buildAsciiAtlas,
	buildAtlas,
	buildStringAtlas,
	getGlyphUV,
} from "../raster/atlas.ts";
import {
	buildMsdfAsciiAtlas,
	buildMsdfAtlas,
	buildMsdfStringAtlas,
	msdfAtlasToRGB,
	msdfAtlasToRGBA,
} from "../raster/msdf.ts";
import { rasterizeGlyph, rasterizeText } from "../raster/rasterize.ts";
import type {
	AtlasOptions,
	Bitmap,
	GlyphAtlas,
	MsdfAtlasOptions,
} from "../raster/types.ts";
import type { GlyphPath } from "../render/path.ts";
import {
	renderShapedText,
	renderShapedTextWithVariation,
	shapedTextToSVG,
	shapedTextToSVGWithVariation,
} from "../render/path.ts";
import type { GlyphId } from "../types.ts";
import { BitmapBuilder } from "./bitmap-builder.ts";
import { PathBuilder } from "./path-builder.ts";

// === Builder Classes ===

export { BitmapBuilder } from "./bitmap-builder.ts";
export { PathBuilder } from "./path-builder.ts";

// === Types ===

export type {
	AutoRasterOptions,
	CanvasOptions,
	RasterOptions,
	SVGElementOptions,
	SVGOptions,
	TransformState,
} from "./types.ts";

// === Entry Points ===

/**
 * Create PathBuilder from a font glyph
 *
 * @example
 * ```typescript
 * const rgba = glyph(font, glyphId)
 *   ?.scale(2)
 *   .rotateDeg(15)
 *   .rasterizeAuto({ padding: 2 })
 *   .blur(5)
 *   .toRGBA();
 * ```
 */
export function glyph(font: Font, glyphId: GlyphId): PathBuilder | null {
	return PathBuilder.fromGlyph(font, glyphId);
}

/**
 * Create PathBuilder from a character in a font
 *
 * @example
 * ```typescript
 * const rgba = char(font, "A")
 *   ?.scale(2)
 *   .rasterizeAuto()
 *   .toRGBA();
 * ```
 */
export function char(font: Font, character: string): PathBuilder | null {
	const codepoint = character.codePointAt(0);
	if (codepoint === undefined) return null;
	const glyphId = font.glyphId(codepoint);
	if (glyphId === undefined) return null;
	return PathBuilder.fromGlyph(font, glyphId);
}

/**
 * Create PathBuilder from a font glyph with variable font coordinates
 *
 * @example
 * ```typescript
 * const rgba = glyphVar(font, glyphId, [400, 100])  // weight=400, width=100
 *   ?.scale(2)
 *   .rasterizeAuto()
 *   .toRGBA();
 * ```
 */
export function glyphVar(
	font: Font,
	glyphId: GlyphId,
	axisCoords: number[],
): PathBuilder | null {
	return PathBuilder.fromGlyphWithVariation(font, glyphId, axisCoords);
}

/**
 * Wrap an existing GlyphPath in a PathBuilder
 *
 * @example
 * ```typescript
 * const existingPath = getGlyphPath(font, glyphId);
 * const rgba = path(existingPath)
 *   .scale(2)
 *   .rasterizeAuto()
 *   .toRGBA();
 * ```
 */
export function path(p: GlyphPath): PathBuilder {
	return PathBuilder.fromPath(p);
}

/**
 * Wrap an existing Bitmap in a BitmapBuilder
 *
 * @example
 * ```typescript
 * const existingBitmap = rasterizePath(path, options);
 * const rgba = bitmap(existingBitmap)
 *   .blur(5)
 *   .toRGBA();
 * ```
 */
export function bitmap(b: Bitmap): BitmapBuilder {
	return BitmapBuilder.fromBitmap(b);
}

/**
 * Combine multiple PathBuilders into one
 *
 * @example
 * ```typescript
 * const h = glyph(font, hGlyphId)?.translate(0, 0);
 * const i = glyph(font, iGlyphId)?.translate(100, 0);
 * if (h && i) {
 *   const combined = combine(h, i).scale(2).rasterizeAuto().toRGBA();
 * }
 * ```
 */
export function combine(...paths: PathBuilder[]): PathBuilder {
	return PathBuilder.combine(...paths);
}

// === Pipe Function and Operators ===

export {
	adaptiveBlur,
	// Bitmap operators
	blur,
	boxBlur,
	cascadeBlur,
	clone,
	combinePaths,
	condensePath,
	convert,
	copy,
	embolden,
	// Path effects
	emboldenPath,
	// Fast blur
	fastBlur,
	// Path source
	fromGlyph,
	italic,
	matrix,
	obliquePath,
	pad,
	perspective,
	// Core pipe function
	pipe,
	// Rasterization (path -> bitmap)
	rasterize,
	rasterizeAuto,
	rasterizeWithGradient,
	renderMsdf,
	// SDF/MSDF rendering
	renderSdf,
	resize,
	resizeBilinear,
	rotate,
	rotateDeg,
	// Path transform operators
	scale,
	shear,
	shift,
	strokeAsymmetric,
	strokeAsymmetricCombined,
	// Stroke operators
	strokePath,
	toGray,
	// Output operators
	toRGBA,
	toSVG,
	translate,
} from "./pipe.ts";

// === Atlas Building ===

export {
	buildAtlas,
	buildAsciiAtlas,
	buildStringAtlas,
	atlasToRGBA,
	atlasToAlpha,
	getGlyphUV,
};

// === MSDF Atlas Building ===

export {
	buildMsdfAtlas,
	buildMsdfAsciiAtlas,
	buildMsdfStringAtlas,
	msdfAtlasToRGB,
	msdfAtlasToRGBA,
};

// === Direct Glyph Rasterization ===

export { rasterizeGlyph, rasterizeText };

// === Shaped Text Rendering ===

export {
	renderShapedText,
	shapedTextToSVG,
	renderShapedTextWithVariation,
	shapedTextToSVGWithVariation,
};

// === Re-export Types ===

export type { AtlasOptions, GlyphAtlas, MsdfAtlasOptions };
