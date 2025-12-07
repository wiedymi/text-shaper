/**
 * PathBuilder: Fluent builder for vector path operations
 *
 * Transforms are lazy by default - accumulated as matrix until rasterization or .apply()
 */

import type { Font } from "../font/font.ts";
import {
	type AsymmetricStrokeOptions,
	strokeAsymmetric,
	strokeAsymmetricCombined,
} from "../raster/asymmetric-stroke.ts";
import type { Gradient } from "../raster/gradient.ts";
import { type MsdfOptions, renderMsdf } from "../raster/msdf.ts";
import { getPathBounds } from "../raster/outline-decompose.ts";
import {
	rasterizePath,
	rasterizePathWithGradient,
} from "../raster/rasterize.ts";
import { renderSdf, type SdfOptions } from "../raster/sdf.ts";
import {
	type LineCap,
	type LineJoin,
	type StrokerOptions,
	strokePath,
} from "../raster/stroker.ts";
import { condensePath, emboldenPath, obliquePath } from "../raster/synth.ts";
import { FillRule, PixelMode } from "../raster/types.ts";
import {
	clonePath,
	combinePaths,
	computeControlBox,
	computeTightBounds,
	identity2D,
	identity3x3,
	type Matrix2D,
	type Matrix3x3,
	multiply2D,
	multiply3x3,
	perspectiveMatrix,
	rotate2D,
	scale2D,
	shear2D,
	transformOutline2D,
	transformOutline3D,
	translate2D,
} from "../render/outline-transform.ts";
import {
	createPath2D,
	type GlyphPath,
	getGlyphPath,
	getGlyphPathWithVariation,
	pathToCanvas,
	pathToCanvasWithMatrix,
	pathToCanvasWithMatrix3D,
	pathToSVG,
} from "../render/path.ts";
import type { GlyphId } from "../types.ts";
import { BitmapBuilder } from "./bitmap-builder.ts";
import type {
	AutoRasterOptions,
	CanvasOptions,
	RasterOptions,
	SVGElementOptions,
	SVGOptions,
	TransformState,
} from "./types.ts";

/**
 * PathBuilder provides a fluent interface for path transformations and rendering
 */
export class PathBuilder {
	private constructor(
		private readonly _path: GlyphPath,
		private readonly _transform: TransformState,
		private readonly _font: Font | null,
	) {}

	// === Static Factory Methods ===

	/**
	 * Create PathBuilder from a font glyph
	 */
	static fromGlyph(font: Font, glyphId: GlyphId): PathBuilder | null {
		const path = getGlyphPath(font, glyphId);
		if (!path) return null;
		return new PathBuilder(
			path,
			{ matrix2D: identity2D(), matrix3D: null },
			font,
		);
	}

	/**
	 * Create PathBuilder from a font glyph with variable font coordinates
	 */
	static fromGlyphWithVariation(
		font: Font,
		glyphId: GlyphId,
		axisCoords: number[],
	): PathBuilder | null {
		const path = getGlyphPathWithVariation(font, glyphId, axisCoords);
		if (!path) return null;
		return new PathBuilder(
			path,
			{ matrix2D: identity2D(), matrix3D: null },
			font,
		);
	}

	/**
	 * Create PathBuilder from an existing GlyphPath
	 */
	static fromPath(path: GlyphPath): PathBuilder {
		return new PathBuilder(
			clonePath(path),
			{ matrix2D: identity2D(), matrix3D: null },
			null,
		);
	}

	/**
	 * Combine multiple PathBuilders into one
	 */
	static combine(...builders: PathBuilder[]): PathBuilder {
		const paths = builders.map((b) => b.toPath());
		const combined = combinePaths(paths);
		return new PathBuilder(
			combined,
			{ matrix2D: identity2D(), matrix3D: null },
			null,
		);
	}

	// === 2D Affine Transforms (Lazy - accumulates matrix) ===

	/**
	 * Scale uniformly or non-uniformly
	 */
	scale(sx: number, sy: number = sx): PathBuilder {
		const newMatrix = multiply2D(this._transform.matrix2D, scale2D(sx, sy));
		return new PathBuilder(
			this._path,
			{ ...this._transform, matrix2D: newMatrix },
			this._font,
		);
	}

	/**
	 * Translate by offset
	 */
	translate(dx: number, dy: number): PathBuilder {
		const newMatrix = multiply2D(this._transform.matrix2D, translate2D(dx, dy));
		return new PathBuilder(
			this._path,
			{ ...this._transform, matrix2D: newMatrix },
			this._font,
		);
	}

	/**
	 * Rotate by angle in radians around origin
	 */
	rotate(angle: number): PathBuilder {
		const newMatrix = multiply2D(this._transform.matrix2D, rotate2D(angle));
		return new PathBuilder(
			this._path,
			{ ...this._transform, matrix2D: newMatrix },
			this._font,
		);
	}

	/**
	 * Rotate by angle in degrees around origin
	 */
	rotateDeg(angleDeg: number): PathBuilder {
		return this.rotate((angleDeg * Math.PI) / 180);
	}

	/**
	 * Shear/skew transformation
	 */
	shear(shearX: number, shearY: number): PathBuilder {
		const newMatrix = multiply2D(
			this._transform.matrix2D,
			shear2D(shearX, shearY),
		);
		return new PathBuilder(
			this._path,
			{ ...this._transform, matrix2D: newMatrix },
			this._font,
		);
	}

	/**
	 * Apply italic slant (angle in degrees, typically 12-15 for italic)
	 */
	italic(angleDeg: number): PathBuilder {
		const shearX = Math.tan((angleDeg * Math.PI) / 180);
		return this.shear(shearX, 0);
	}

	/**
	 * Apply custom 2D affine matrix
	 */
	matrix(m: Matrix2D): PathBuilder {
		const newMatrix = multiply2D(this._transform.matrix2D, m);
		return new PathBuilder(
			this._path,
			{ ...this._transform, matrix2D: newMatrix },
			this._font,
		);
	}

	/**
	 * Reset transform to identity
	 */
	resetTransform(): PathBuilder {
		return new PathBuilder(
			this._path,
			{ matrix2D: identity2D(), matrix3D: null },
			this._font,
		);
	}

	// === 3D Perspective Transforms (Lazy) ===

	/**
	 * Apply 3x3 perspective matrix
	 */
	perspective(m: Matrix3x3): PathBuilder {
		const newMatrix3D = this._transform.matrix3D
			? multiply3x3(this._transform.matrix3D, m)
			: m;
		return new PathBuilder(
			this._path,
			{ ...this._transform, matrix3D: newMatrix3D },
			this._font,
		);
	}

	/**
	 * Create perspective with vanishing point
	 */
	perspectiveVanish(
		vanishingPointX: number,
		vanishingPointY: number,
		strength: number,
	): PathBuilder {
		const m = perspectiveMatrix(vanishingPointX, vanishingPointY, strength);
		return this.perspective(m);
	}

	// === Path Effects (Eager - applies transform first, modifies path) ===

	/**
	 * Force application of pending transforms
	 * Returns new PathBuilder with transforms applied and reset
	 */
	apply(): PathBuilder {
		const transformed = this.applyTransformToPath();
		return new PathBuilder(
			transformed,
			{ matrix2D: identity2D(), matrix3D: null },
			this._font,
		);
	}

	/**
	 * Synthetic bold/embolden
	 */
	embolden(strength: number): PathBuilder {
		const transformed = this.applyTransformToPath();
		const emboldened = emboldenPath(transformed, strength);
		return new PathBuilder(
			emboldened,
			{ matrix2D: identity2D(), matrix3D: null },
			this._font,
		);
	}

	/**
	 * Horizontal condensing (factor < 1) or expansion (factor > 1)
	 */
	condense(factor: number): PathBuilder {
		const transformed = this.applyTransformToPath();
		const condensed = condensePath(transformed, factor);
		return new PathBuilder(
			condensed,
			{ matrix2D: identity2D(), matrix3D: null },
			this._font,
		);
	}

	/**
	 * Oblique/slant transformation
	 */
	oblique(slant: number): PathBuilder {
		const transformed = this.applyTransformToPath();
		const obliqued = obliquePath(transformed, slant);
		return new PathBuilder(
			obliqued,
			{ matrix2D: identity2D(), matrix3D: null },
			this._font,
		);
	}

	/**
	 * Convert to stroked outline
	 */
	stroke(options: StrokerOptions): PathBuilder;
	stroke(width: number, cap?: LineCap, join?: LineJoin): PathBuilder;
	stroke(
		optionsOrWidth: StrokerOptions | number,
		cap?: LineCap,
		join?: LineJoin,
	): PathBuilder {
		const transformed = this.applyTransformToPath();
		const opts: StrokerOptions =
			typeof optionsOrWidth === "number"
				? { width: optionsOrWidth, lineCap: cap, lineJoin: join }
				: optionsOrWidth;
		const stroked = strokePath(transformed, opts);
		return new PathBuilder(
			stroked,
			{ matrix2D: identity2D(), matrix3D: null },
			this._font,
		);
	}

	/**
	 * Asymmetric stroke with independent X/Y border widths
	 * Returns outer and inner paths
	 */
	strokeAsymmetric(options: AsymmetricStrokeOptions): {
		outer: PathBuilder;
		inner: PathBuilder;
	} {
		const transformed = this.applyTransformToPath();
		const { outer, inner } = strokeAsymmetric(transformed, options);
		return {
			outer: new PathBuilder(
				outer,
				{ matrix2D: identity2D(), matrix3D: null },
				this._font,
			),
			inner: new PathBuilder(
				inner,
				{ matrix2D: identity2D(), matrix3D: null },
				this._font,
			),
		};
	}

	/**
	 * Asymmetric stroke combined (both inner and outer as single fillable path)
	 */
	strokeAsymmetricCombined(options: AsymmetricStrokeOptions): PathBuilder {
		const transformed = this.applyTransformToPath();
		const combined = strokeAsymmetricCombined(transformed, options);
		return new PathBuilder(
			combined,
			{ matrix2D: identity2D(), matrix3D: null },
			this._font,
		);
	}

	// === Bounds & Metrics ===

	/**
	 * Get control box (bounding box of control points)
	 * Note: Returns bounds AFTER applying transforms
	 */
	controlBox(): { xMin: number; yMin: number; xMax: number; yMax: number } {
		const transformed = this.applyTransformToPath();
		return computeControlBox(transformed);
	}

	/**
	 * Get tight bounds (exact bounds considering curve extrema)
	 * Note: Returns bounds AFTER applying transforms
	 */
	tightBounds(): { xMin: number; yMin: number; xMax: number; yMax: number } {
		const transformed = this.applyTransformToPath();
		return computeTightBounds(transformed);
	}

	/**
	 * Get the accumulated 2D transform matrix
	 */
	getTransformMatrix(): Matrix2D {
		return [...this._transform.matrix2D] as Matrix2D;
	}

	/**
	 * Get the accumulated 3D transform matrix (if any)
	 */
	getTransformMatrix3D(): Matrix3x3 | null {
		if (!this._transform.matrix3D) return null;
		return this._transform.matrix3D.map((row) => [...row]) as Matrix3x3;
	}

	// === Rasterization (Transition to BitmapBuilder) ===

	/**
	 * Rasterize to bitmap with explicit size
	 */
	rasterize(options: RasterOptions): BitmapBuilder {
		const transformedPath = this.applyTransformToPath();
		const {
			width = 100,
			height = 100,
			scale = 1,
			offsetX = 0,
			offsetY = 0,
			pixelMode = PixelMode.Gray,
			fillRule = FillRule.NonZero,
			flipY = true,
		} = options;

		const bitmap = rasterizePath(transformedPath, {
			width,
			height,
			scale,
			offsetX,
			offsetY,
			pixelMode,
			fillRule,
			flipY,
		});

		return BitmapBuilder.fromBitmap(bitmap);
	}

	/**
	 * Rasterize with auto-computed size from bounds
	 */
	rasterizeAuto(options?: AutoRasterOptions): BitmapBuilder {
		const transformedPath = this.applyTransformToPath();
		const {
			padding = 1,
			scale = 1,
			pixelMode = PixelMode.Gray,
			fillRule = FillRule.NonZero,
			flipY = true,
		} = options ?? {};

		const bounds = getPathBounds(transformedPath, scale, flipY);
		if (!bounds) {
			// Empty path - return 1x1 empty bitmap
			const { createBitmap } = require("../raster/types.ts");
			return BitmapBuilder.fromBitmap(createBitmap(1, 1, pixelMode));
		}

		const width = bounds.maxX - bounds.minX + padding * 2;
		const height = bounds.maxY - bounds.minY + padding * 2;
		const offsetX = -bounds.minX + padding;
		const offsetY = -bounds.minY + padding;

		const bitmap = rasterizePath(transformedPath, {
			width,
			height,
			scale,
			offsetX,
			offsetY,
			pixelMode,
			fillRule,
			flipY,
		});

		return BitmapBuilder.fromBitmapWithBearing(
			bitmap,
			bounds.minX - padding,
			-(bounds.minY - padding),
		);
	}

	/**
	 * Rasterize with gradient fill
	 */
	rasterizeWithGradient(
		gradient: Gradient,
		options: RasterOptions,
	): BitmapBuilder {
		const transformedPath = this.applyTransformToPath();
		const {
			width = 100,
			height = 100,
			scale = 1,
			offsetX = 0,
			offsetY = 0,
			pixelMode = PixelMode.Gray,
			fillRule = FillRule.NonZero,
			flipY = true,
		} = options;

		const bitmap = rasterizePathWithGradient(transformedPath, gradient, {
			width,
			height,
			scale,
			offsetX,
			offsetY,
			pixelMode,
			fillRule,
			flipY,
		});

		return BitmapBuilder.fromBitmap(bitmap);
	}

	/**
	 * Render as Signed Distance Field (SDF)
	 * Useful for GPU text rendering at any scale
	 */
	toSdf(options: SdfOptions): BitmapBuilder {
		const transformedPath = this.applyTransformToPath();
		const bitmap = renderSdf(transformedPath, options);
		return BitmapBuilder.fromBitmap(bitmap);
	}

	/**
	 * Render as SDF with auto-computed size from bounds
	 */
	toSdfAuto(options?: {
		padding?: number;
		scale?: number;
		spread?: number;
		flipY?: boolean;
	}): BitmapBuilder {
		const transformedPath = this.applyTransformToPath();
		const { padding = 1, scale = 1, spread = 8, flipY = true } = options ?? {};

		const bounds = getPathBounds(transformedPath, scale, flipY);
		if (!bounds) {
			const { createBitmap } = require("../raster/types.ts");
			return BitmapBuilder.fromBitmap(createBitmap(1, 1, PixelMode.Gray));
		}

		const width = bounds.maxX - bounds.minX + padding * 2 + spread * 2;
		const height = bounds.maxY - bounds.minY + padding * 2 + spread * 2;
		const offsetX = -bounds.minX + padding + spread;
		const offsetY = flipY
			? bounds.maxY + padding + spread
			: -bounds.minY + padding + spread;

		const bitmap = renderSdf(transformedPath, {
			width,
			height,
			scale,
			offsetX,
			offsetY,
			flipY,
			spread,
		});

		return BitmapBuilder.fromBitmapWithBearing(
			bitmap,
			bounds.minX - padding - spread,
			-(bounds.minY - padding - spread),
		);
	}

	/**
	 * Render as Multi-channel Signed Distance Field (MSDF)
	 * Better quality than SDF for sharp corners
	 */
	toMsdf(options: MsdfOptions): BitmapBuilder {
		const transformedPath = this.applyTransformToPath();
		const bitmap = renderMsdf(transformedPath, options);
		return BitmapBuilder.fromBitmap(bitmap);
	}

	/**
	 * Render as MSDF with auto-computed size from bounds
	 */
	toMsdfAuto(options?: {
		padding?: number;
		scale?: number;
		spread?: number;
		flipY?: boolean;
	}): BitmapBuilder {
		const transformedPath = this.applyTransformToPath();
		const { padding = 1, scale = 1, spread = 8, flipY = true } = options ?? {};

		const bounds = getPathBounds(transformedPath, scale, flipY);
		if (!bounds) {
			const { createBitmap } = require("../raster/types.ts");
			return BitmapBuilder.fromBitmap(createBitmap(1, 1, PixelMode.LCD));
		}

		const width = bounds.maxX - bounds.minX + padding * 2 + spread * 2;
		const height = bounds.maxY - bounds.minY + padding * 2 + spread * 2;
		const offsetX = -bounds.minX + padding + spread;
		const offsetY = flipY
			? bounds.maxY + padding + spread
			: -bounds.minY + padding + spread;

		const bitmap = renderMsdf(transformedPath, {
			width,
			height,
			scale,
			offsetX,
			offsetY,
			flipY,
			spread,
		});

		return BitmapBuilder.fromBitmapWithBearing(
			bitmap,
			bounds.minX - padding - spread,
			-(bounds.minY - padding - spread),
		);
	}

	// === Direct Output (applies transforms) ===

	/**
	 * Convert to SVG path data string
	 */
	toSVG(options?: SVGOptions): string {
		const { flipY = true, scale = 1 } = options ?? {};

		if (this.hasTransform()) {
			// Apply transform to path coordinates
			const transformed = this.applyTransformToPath();
			return pathToSVG(transformed, { flipY, scale });
		}

		return pathToSVG(this._path, { flipY, scale });
	}

	/**
	 * Convert to full SVG element string
	 */
	toSVGElement(options?: SVGElementOptions): string {
		const {
			fontSize = 100,
			fill = "currentColor",
			stroke,
			strokeWidth = 1,
		} = options ?? {};

		const transformed = this.applyTransformToPath();
		const bounds = computeTightBounds(transformed);

		const scale = this._font ? fontSize / this._font.unitsPerEm : 1;
		const scaledPath =
			scale !== 1
				? transformOutline2D(transformed, scale2D(scale, scale))
				: transformed;
		const scaledBounds =
			scale !== 1
				? {
						xMin: bounds.xMin * scale,
						yMin: bounds.yMin * scale,
						xMax: bounds.xMax * scale,
						yMax: bounds.yMax * scale,
					}
				: bounds;

		const strokePadding = stroke ? strokeWidth / 2 : 0;
		const width = Math.ceil(
			scaledBounds.xMax - scaledBounds.xMin + strokePadding * 2,
		);
		const height = Math.ceil(
			scaledBounds.yMax - scaledBounds.yMin + strokePadding * 2,
		);
		const viewBox = `${scaledBounds.xMin - strokePadding} ${-scaledBounds.yMax - strokePadding} ${scaledBounds.xMax - scaledBounds.xMin + strokePadding * 2} ${scaledBounds.yMax - scaledBounds.yMin + strokePadding * 2}`;

		const pathData = pathToSVG(scaledPath, { flipY: true, scale: 1 });
		const strokeAttr = stroke
			? ` stroke="${stroke}" stroke-width="${strokeWidth}"`
			: "";

		return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
  <path d="${pathData}" fill="${fill}"${strokeAttr}/>
</svg>`;
	}

	/**
	 * Render to canvas context
	 */
	toCanvas(ctx: CanvasRenderingContext2D, options?: CanvasOptions): void {
		const {
			flipY = true,
			scale = 1,
			offsetX = 0,
			offsetY = 0,
			fill = "black",
			stroke,
			strokeWidth = 1,
		} = options ?? {};

		ctx.beginPath();

		if (this._transform.matrix3D) {
			// Use 3D matrix rendering
			const combined = this.combinedMatrix3D(scale, offsetX, offsetY);
			pathToCanvasWithMatrix3D(ctx, this._path, combined, { flipY });
		} else if (this.hasTransform2D()) {
			// Use 2D matrix rendering
			const combined = this.combinedMatrix2D(scale, offsetX, offsetY);
			pathToCanvasWithMatrix(ctx, this._path, combined, { flipY });
		} else {
			// No transform - use simple rendering
			pathToCanvas(ctx, this._path, { flipY, scale, offsetX, offsetY });
		}

		if (fill !== "none") {
			ctx.fillStyle = fill;
			ctx.fill();
		}
		if (stroke) {
			ctx.strokeStyle = stroke;
			ctx.lineWidth = strokeWidth;
			ctx.stroke();
		}
	}

	/**
	 * Get Path2D object for canvas
	 */
	toPath2D(options?: { flipY?: boolean; scale?: number }): Path2D {
		const transformed = this.applyTransformToPath();
		return createPath2D(transformed, options);
	}

	/**
	 * Extract the raw GlyphPath (with transforms applied)
	 */
	toPath(): GlyphPath {
		return this.applyTransformToPath();
	}

	/**
	 * Clone this builder
	 */
	clone(): PathBuilder {
		return new PathBuilder(
			clonePath(this._path),
			{
				matrix2D: [...this._transform.matrix2D] as Matrix2D,
				matrix3D: this._transform.matrix3D
					? (this._transform.matrix3D.map((row) => [...row]) as Matrix3x3)
					: null,
			},
			this._font,
		);
	}

	// === Private Helpers ===

	/**
	 * Apply accumulated transforms to path
	 */
	private applyTransformToPath(): GlyphPath {
		if (this._transform.matrix3D) {
			// Convert 2D matrix to 3x3 and combine with perspective
			const m2d = this._transform.matrix2D;
			const affine3x3: Matrix3x3 = [
				[m2d[0], m2d[2], m2d[4]],
				[m2d[1], m2d[3], m2d[5]],
				[0, 0, 1],
			];
			const combined = multiply3x3(this._transform.matrix3D, affine3x3);
			return transformOutline3D(this._path, combined);
		}
		return transformOutline2D(this._path, this._transform.matrix2D);
	}

	/**
	 * Check if there's any non-identity transform
	 */
	private hasTransform(): boolean {
		return this.hasTransform2D() || this._transform.matrix3D !== null;
	}

	/**
	 * Check if 2D matrix is non-identity
	 */
	private hasTransform2D(): boolean {
		const m = this._transform.matrix2D;
		return (
			m[0] !== 1 ||
			m[1] !== 0 ||
			m[2] !== 0 ||
			m[3] !== 1 ||
			m[4] !== 0 ||
			m[5] !== 0
		);
	}

	/**
	 * Combine accumulated 2D transform with render options
	 */
	private combinedMatrix2D(
		scale: number,
		offsetX: number,
		offsetY: number,
	): Matrix2D {
		const m = this._transform.matrix2D;
		return [
			m[0] * scale,
			m[1] * scale,
			m[2] * scale,
			m[3] * scale,
			m[0] * offsetX + m[2] * offsetY + m[4] * scale,
			m[1] * offsetX + m[3] * offsetY + m[5] * scale,
		];
	}

	/**
	 * Combine accumulated transforms into 3x3 matrix with render options
	 */
	private combinedMatrix3D(
		scale: number,
		offsetX: number,
		offsetY: number,
	): Matrix3x3 {
		const m2d = this._transform.matrix2D;
		const m3d = this._transform.matrix3D ?? identity3x3();

		// Combine: scale -> 2D transform -> 3D perspective -> offset
		const affine3x3: Matrix3x3 = [
			[m2d[0] * scale, m2d[2] * scale, m2d[4] * scale + offsetX],
			[m2d[1] * scale, m2d[3] * scale, m2d[5] * scale + offsetY],
			[0, 0, 1],
		];

		return multiply3x3(m3d, affine3x3);
	}
}
