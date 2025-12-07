# Fluent API

The fluent API provides an ergonomic, chainable interface for composing transforms and rendering operations. It offers two styles:

1. **Builder pattern** - Method chaining with `PathBuilder` and `BitmapBuilder` classes
2. **Pipe pattern** - Functional composition with curried operators

## Quick Start

### Builder Style

```typescript
import { glyph } from "text-shaper";

const rgba = glyph(font, glyphId)
  ?.scale(2)
  .rotateDeg(15)
  .rasterizeAuto({ padding: 2 })
  .blur(5)
  .toRGBA();
```

### Pipe Style

```typescript
import { pipe, $scale, $rotate, $rasterize, $blur, $toRGBA, getGlyphPath } from "text-shaper";

const rgba = pipe(
  getGlyphPath(font, glyphId),
  $scale(2, 2),
  $rotate(Math.PI / 4),
  $rasterize({ width: 100, height: 100 }),
  $blur(5),
  $toRGBA
);
```

## Entry Points

### glyph()

Create a `PathBuilder` from a font glyph.

```typescript
function glyph(font: Font, glyphId: GlyphId): PathBuilder | null
```

**Example:**
```typescript
const builder = glyph(font, glyphId);
if (builder) {
  const rgba = builder.scale(2).rasterizeAuto().toRGBA();
}
```

### char()

Create a `PathBuilder` from a character.

```typescript
function char(font: Font, character: string): PathBuilder | null
```

**Example:**
```typescript
const builder = char(font, "A");
const rgba = builder?.scale(2).rasterizeAuto().toRGBA();
```

### glyphVar()

Create a `PathBuilder` from a variable font glyph with axis coordinates.

```typescript
function glyphVar(font: Font, glyphId: GlyphId, axisCoords: number[]): PathBuilder | null
```

**Example:**
```typescript
// Create with weight=700, width=100
const builder = glyphVar(font, glyphId, [700, 100]);
```

### path()

Wrap an existing `GlyphPath` in a `PathBuilder`.

```typescript
function path(p: GlyphPath): PathBuilder
```

**Example:**
```typescript
const existingPath = getGlyphPath(font, glyphId);
if (existingPath) {
  const rgba = path(existingPath).scale(2).rasterizeAuto().toRGBA();
}
```

### bitmap()

Wrap an existing `Bitmap` in a `BitmapBuilder`.

```typescript
function bitmap(b: Bitmap): BitmapBuilder
```

**Example:**
```typescript
const existingBitmap = rasterizePath(path, options);
const rgba = bitmap(existingBitmap).blur(5).toRGBA();
```

### combine()

Combine multiple `PathBuilder` instances into one.

```typescript
function combine(...paths: PathBuilder[]): PathBuilder
```

**Example:**
```typescript
const h = glyph(font, hGlyphId)?.translate(0, 0);
const i = glyph(font, iGlyphId)?.translate(100, 0);

if (h && i) {
  const combined = combine(h, i).scale(2).rasterizeAuto().toRGBA();
}
```

## PathBuilder

The `PathBuilder` class provides fluent methods for path transformations and rendering.

### Static Factory Methods

These are typically accessed via the entry point functions, but can also be called directly.

#### PathBuilder.fromGlyph()

Create from a font glyph.

```typescript
static fromGlyph(font: Font, glyphId: GlyphId): PathBuilder | null
```

#### PathBuilder.fromGlyphWithVariation()

Create from a variable font glyph with axis coordinates.

```typescript
static fromGlyphWithVariation(font: Font, glyphId: GlyphId, axisCoords: number[]): PathBuilder | null
```

#### PathBuilder.fromPath()

Create from an existing GlyphPath.

```typescript
static fromPath(path: GlyphPath): PathBuilder
```

#### PathBuilder.combine()

Combine multiple PathBuilders into one.

```typescript
static combine(...builders: PathBuilder[]): PathBuilder
```

### Lazy Transforms

Transforms are accumulated as a matrix and applied lazily when rendering or when `.apply()` is called.

#### scale()

Scale uniformly or non-uniformly.

```typescript
scale(sx: number, sy?: number): PathBuilder
```

#### translate()

Translate by offset.

```typescript
translate(dx: number, dy: number): PathBuilder
```

#### rotate()

Rotate by angle in radians.

```typescript
rotate(angle: number): PathBuilder
```

#### rotateDeg()

Rotate by angle in degrees.

```typescript
rotateDeg(angleDeg: number): PathBuilder
```

#### shear()

Apply shear/skew transformation.

```typescript
shear(shearX: number, shearY: number): PathBuilder
```

#### italic()

Apply italic slant (angle in degrees, typically 12-15).

```typescript
italic(angleDeg: number): PathBuilder
```

#### matrix()

Apply custom 2D affine matrix.

```typescript
matrix(m: Matrix2D): PathBuilder
```

#### perspective()

Apply 3D perspective matrix.

```typescript
perspective(m: Matrix3x3): PathBuilder
```

#### perspectiveVanish()

Create perspective with vanishing point.

```typescript
perspectiveVanish(vanishingPointX: number, vanishingPointY: number, strength: number): PathBuilder
```

#### resetTransform()

Reset transform to identity.

```typescript
resetTransform(): PathBuilder
```

### Eager Path Effects

These effects apply immediately (force transform application first).

#### apply()

Force application of pending transforms.

```typescript
apply(): PathBuilder
```

**Example:**
```typescript
const path = glyph(font, glyphId)
  ?.scale(2)
  .rotate(Math.PI / 4)
  .apply()       // Apply transforms now
  .embolden(50)  // Then embolden the transformed path
  .toPath();
```

#### embolden()

Synthetic bold effect.

```typescript
embolden(strength: number): PathBuilder
```

#### condense()

Horizontal condensing (factor < 1) or expansion (factor > 1).

```typescript
condense(factor: number): PathBuilder
```

#### oblique()

Apply oblique/slant transformation.

```typescript
oblique(slant: number): PathBuilder
```

#### stroke()

Convert to stroked outline.

```typescript
stroke(options: StrokerOptions): PathBuilder
stroke(width: number, cap?: LineCap, join?: LineJoin): PathBuilder
```

**Example:**
```typescript
const stroked = glyph(font, glyphId)
  ?.stroke({ width: 20, lineCap: "round", lineJoin: "round" })
  .scale(2)
  .rasterizeAuto()
  .toRGBA();
```

### Bounds & Metrics

#### controlBox()

Get bounding box of control points (after transforms).

```typescript
controlBox(): { xMin: number; yMin: number; xMax: number; yMax: number }
```

#### tightBounds()

Get exact bounds considering curve extrema (after transforms).

```typescript
tightBounds(): { xMin: number; yMin: number; xMax: number; yMax: number }
```

#### getTransformMatrix()

Get the accumulated 2D transform matrix.

```typescript
getTransformMatrix(): Matrix2D
```

#### getTransformMatrix3D()

Get the accumulated 3D transform matrix.

```typescript
getTransformMatrix3D(): Matrix3x3 | null
```

### Rasterization

#### rasterize()

Rasterize to bitmap with explicit size.

```typescript
rasterize(options: RasterOptions): BitmapBuilder
```

**Options:**
```typescript
interface RasterOptions {
  width?: number;
  height?: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  padding?: number;
  pixelMode?: PixelMode;
  fillRule?: FillRule;
  flipY?: boolean;
}
```

#### rasterizeAuto()

Rasterize with auto-computed size from bounds.

```typescript
rasterizeAuto(options?: AutoRasterOptions): BitmapBuilder
```

**Options:**
```typescript
interface AutoRasterOptions {
  padding?: number;    // Default: 1
  scale?: number;      // Default: 1
  pixelMode?: PixelMode;
  fillRule?: FillRule;
  flipY?: boolean;
}
```

**Example:**
```typescript
const rgba = glyph(font, glyphId)
  ?.scale(2)
  .rasterizeAuto({ padding: 5 })
  .toRGBA();
```

#### rasterizeWithGradient()

Rasterize with gradient fill.

```typescript
rasterizeWithGradient(gradient: Gradient, options: RasterOptions): BitmapBuilder
```

**Example:**
```typescript
import { glyph, type LinearGradient } from "text-shaper";

const gradient: LinearGradient = {
  type: "linear",
  x0: 0, y0: 0,
  x1: 100, y1: 100,
  stops: [
    { offset: 0, color: [255, 0, 0, 255] },
    { offset: 1, color: [0, 0, 255, 255] }
  ]
};

const rgba = glyph(font, glyphId)
  ?.scale(2)
  .rasterizeWithGradient(gradient, { width: 100, height: 100 })
  .toRGBA();
```

### SDF/MSDF Rendering

#### toSdf()

Render as Signed Distance Field (SDF) for GPU text rendering.

```typescript
toSdf(options: SdfOptions): BitmapBuilder
```

**Options:**
```typescript
interface SdfOptions {
  width: number;
  height: number;
  scale: number;
  offsetX?: number;
  offsetY?: number;
  flipY?: boolean;
  spread?: number;  // Default: 8
}
```

**Example:**
```typescript
const sdf = glyph(font, glyphId)
  ?.toSdf({ width: 64, height: 64, scale: 0.05, spread: 4 })
  .toGray();
```

#### toSdfAuto()

Render as SDF with auto-computed size from bounds.

```typescript
toSdfAuto(options?: {
  padding?: number;
  scale?: number;
  spread?: number;
  flipY?: boolean;
}): BitmapBuilder
```

#### toMsdf()

Render as Multi-channel Signed Distance Field (MSDF) for sharper GPU text.

```typescript
toMsdf(options: MsdfOptions): BitmapBuilder
```

**Example:**
```typescript
const msdf = glyph(font, glyphId)
  ?.toMsdf({ width: 64, height: 64, scale: 0.05, spread: 4 })
  .toRGBA();
```

#### toMsdfAuto()

Render as MSDF with auto-computed size from bounds.

```typescript
toMsdfAuto(options?: {
  padding?: number;
  scale?: number;
  spread?: number;
  flipY?: boolean;
}): BitmapBuilder
```

### Asymmetric Stroke

#### strokeAsymmetric()

Stroke with independent X/Y border widths. Returns both outer and inner paths.

```typescript
strokeAsymmetric(options: AsymmetricStrokeOptions): {
  outer: PathBuilder;
  inner: PathBuilder;
}
```

**Options:**
```typescript
interface AsymmetricStrokeOptions {
  xBorder: number;
  yBorder: number;
  eps?: number;
  lineJoin?: "miter" | "round" | "bevel";
  miterLimit?: number;
}
```

**Example:**
```typescript
const { outer, inner } = glyph(font, glyphId)
  ?.strokeAsymmetric({ xBorder: 10, yBorder: 5 });

// Use outer for border effect
const border = outer?.rasterizeAuto().toRGBA();
```

#### strokeAsymmetricCombined()

Stroke with asymmetric widths, combining inner and outer into one fillable path.

```typescript
strokeAsymmetricCombined(options: AsymmetricStrokeOptions): PathBuilder
```

### Output Methods

#### toSVG()

Convert to SVG path data string.

```typescript
toSVG(options?: SVGOptions): string
```

#### toSVGElement()

Convert to complete SVG element.

```typescript
toSVGElement(options?: SVGElementOptions): string
```

**Options:**
```typescript
interface SVGElementOptions {
  fontSize?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}
```

#### toCanvas()

Render to canvas context.

```typescript
toCanvas(ctx: CanvasRenderingContext2D, options?: CanvasOptions): void
```

**Options:**
```typescript
interface CanvasOptions {
  flipY?: boolean;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}
```

#### toPath2D()

Get `Path2D` object for canvas.

```typescript
toPath2D(options?: { flipY?: boolean; scale?: number }): Path2D
```

#### toPath()

Extract the raw `GlyphPath` (with transforms applied).

```typescript
toPath(): GlyphPath
```

#### clone()

Clone this builder.

```typescript
clone(): PathBuilder
```

## BitmapBuilder

The `BitmapBuilder` class provides fluent methods for bitmap manipulation.

### Static Factory Methods

#### BitmapBuilder.fromBitmap()

Create from existing bitmap.

```typescript
static fromBitmap(bitmap: Bitmap): BitmapBuilder
```

#### BitmapBuilder.fromBitmapWithBearing()

Create from bitmap with bearing info (used for glyph positioning).

```typescript
static fromBitmapWithBearing(bitmap: Bitmap, bearingX: number, bearingY: number): BitmapBuilder
```

#### BitmapBuilder.fromRasterizedGlyph()

Create from a rasterized glyph result.

```typescript
static fromRasterizedGlyph(glyph: RasterizedGlyph): BitmapBuilder
```

**Example:**
```typescript
const glyph = rasterizeGlyph(font, glyphId, options);
const builder = BitmapBuilder.fromRasterizedGlyph(glyph);
const rgba = builder.blur(3).toRGBA();
```

#### BitmapBuilder.create()

Create empty bitmap.

```typescript
static create(width: number, height: number, pixelMode?: PixelMode): BitmapBuilder
```

**Example:**
```typescript
const canvas = BitmapBuilder.create(100, 100, PixelMode.Gray);
```

#### BitmapBuilder.fromGradient()

Create a gradient bitmap.

```typescript
static fromGradient(width: number, height: number, gradient: Gradient): BitmapBuilder
```

**Example:**
```typescript
const gradientBg = BitmapBuilder.fromGradient(100, 100, {
  type: "linear",
  x0: 0, y0: 0,
  x1: 100, y1: 100,
  stops: [
    { offset: 0, color: [255, 0, 0, 255] },
    { offset: 1, color: [0, 0, 255, 255] }
  ]
});
```

### Blur Effects

#### blur()

Gaussian blur.

```typescript
blur(radius: number): BitmapBuilder
```

#### boxBlur()

Box blur (faster, less smooth).

```typescript
boxBlur(radius: number): BitmapBuilder
```

#### cascadeBlur()

Cascade blur (fast for large radii, O(1) per pixel).

```typescript
cascadeBlur(radiusX: number, radiusY?: number): BitmapBuilder
```

#### adaptiveBlur()

Adaptive blur (auto-selects best algorithm).

```typescript
adaptiveBlur(radiusX: number, radiusY?: number): BitmapBuilder
```

#### fastBlur()

Fast Gaussian blur using cascade algorithm. Recommended for large radii (> 3 pixels).

```typescript
fastBlur(radius: number): BitmapBuilder
```

**Example:**
```typescript
// For large blur radii, fastBlur is more efficient
const blurred = glyph(font, glyphId)
  ?.rasterizeAuto({ padding: 50 })
  .fastBlur(20)  // Much faster than blur(20)
  .toRGBA();
```

### Transform Effects

#### embolden()

Embolden (dilate) bitmap.

```typescript
embolden(xStrength: number, yStrength?: number): BitmapBuilder
```

#### shift()

Shift bitmap position.

```typescript
shift(dx: number, dy: number): BitmapBuilder
```

#### resize()

Resize with nearest-neighbor interpolation.

```typescript
resize(width: number, height: number): BitmapBuilder
```

#### resizeBilinear()

Resize with bilinear interpolation.

```typescript
resizeBilinear(width: number, height: number): BitmapBuilder
```

#### pad()

Pad bitmap with empty space.

```typescript
pad(left: number, top: number, right: number, bottom: number): BitmapBuilder
pad(all: number): BitmapBuilder
```

### Compositing

#### blend()

Alpha blend another bitmap at position.

```typescript
blend(other: BitmapBuilder | Bitmap, x: number, y: number, opacity?: number): BitmapBuilder
```

#### composite()

Composite using Porter-Duff "over" operation.

```typescript
composite(other: BitmapBuilder | Bitmap, x?: number, y?: number): BitmapBuilder
```

#### add()

Additive blend.

```typescript
add(other: BitmapBuilder | Bitmap, x?: number, y?: number): BitmapBuilder
```

#### subtract()

Subtractive blend.

```typescript
subtract(other: BitmapBuilder | Bitmap, x?: number, y?: number): BitmapBuilder
```

#### multiply()

Multiplicative blend.

```typescript
multiply(other: BitmapBuilder | Bitmap, x?: number, y?: number): BitmapBuilder
```

#### max()

Maximum blend.

```typescript
max(other: BitmapBuilder | Bitmap, x?: number, y?: number): BitmapBuilder
```

### Output Methods

#### convert()

Convert to different pixel mode.

```typescript
convert(targetMode: PixelMode): BitmapBuilder
```

#### toRGBA()

Get RGBA pixel array.

```typescript
toRGBA(): Uint8Array
```

#### toGray()

Get grayscale array.

```typescript
toGray(): Uint8Array
```

#### toBitmap()

Get raw bitmap (cloned).

```typescript
toBitmap(): Bitmap
```

#### toRasterizedGlyph()

Get bitmap with bearing info.

```typescript
toRasterizedGlyph(): { bitmap: Bitmap; bearingX: number; bearingY: number }
```

#### clone()

Clone this builder.

```typescript
clone(): BitmapBuilder
```

### Accessors

```typescript
get width(): number
get height(): number
get pixelMode(): PixelMode
get bearingX(): number
get bearingY(): number
```

## Pipe Function

The `pipe()` function enables functional composition.

```typescript
function pipe<A>(a: A): A
function pipe<A, B>(a: A, ab: (a: A) => B): B
function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C
// ... up to 8 functions
```

### Pipe Operators

All pipe operators are exported with a `$` prefix from the main module to avoid naming conflicts.

#### Path Source

```typescript
$fromGlyph(font: Font, glyphId: GlyphId): GlyphPath | null
```

**Example:**
```typescript
const path = $fromGlyph(font, glyphId);
if (path) {
  const rgba = pipe(path, $scale(2), $rasterizeAuto(), $toRGBA);
}
```

#### Path Operators

```typescript
$scale(sx: number, sy?: number): (path: GlyphPath) => GlyphPath
$translate(dx: number, dy: number): (path: GlyphPath) => GlyphPath
$rotate(angle: number): (path: GlyphPath) => GlyphPath
$rotateDeg(angleDeg: number): (path: GlyphPath) => GlyphPath
$shear(shearX: number, shearY: number): (path: GlyphPath) => GlyphPath
$italic(angleDeg: number): (path: GlyphPath) => GlyphPath
$matrix(m: Matrix2D): (path: GlyphPath) => GlyphPath
$perspective(m: Matrix3x3): (path: GlyphPath) => GlyphPath
$emboldenPath(strength: number): (path: GlyphPath) => GlyphPath
$condensePath(factor: number): (path: GlyphPath) => GlyphPath
$obliquePath(slant: number): (path: GlyphPath) => GlyphPath
$strokePath(options: StrokerOptions): (path: GlyphPath) => GlyphPath
$strokeAsymmetric(options: AsymmetricStrokeOptions): (path: GlyphPath) => { outer: GlyphPath; inner: GlyphPath }
$strokeAsymmetricCombined(options: AsymmetricStrokeOptions): (path: GlyphPath) => GlyphPath
$clone(): (path: GlyphPath) => GlyphPath
```

#### Rasterization Operators

```typescript
$rasterize(options: RasterizeOptions): (path: GlyphPath) => Bitmap
$rasterizeAuto(options?: AutoRasterOptions): (path: GlyphPath) => Bitmap
$rasterizeWithGradient(gradient: Gradient, options: RasterizeOptions): (path: GlyphPath) => Bitmap
$renderSdf(options: SdfOptions): (path: GlyphPath) => Bitmap
$renderMsdf(options: MsdfOptions): (path: GlyphPath) => Bitmap
```

#### Bitmap Operators

```typescript
$blur(radius: number): (bitmap: Bitmap) => Bitmap
$boxBlur(radius: number): (bitmap: Bitmap) => Bitmap
$cascadeBlur(radiusX: number, radiusY?: number): (bitmap: Bitmap) => Bitmap
$adaptiveBlur(radiusX: number, radiusY?: number): (bitmap: Bitmap) => Bitmap
$fastBlur(radius: number): (bitmap: Bitmap) => Bitmap
$embolden(xStrength: number, yStrength?: number): (bitmap: Bitmap) => Bitmap
$shift(dx: number, dy: number): (bitmap: Bitmap) => Bitmap
$resize(width: number, height: number): (bitmap: Bitmap) => Bitmap
$resizeBilinear(width: number, height: number): (bitmap: Bitmap) => Bitmap
$pad(left: number, top: number, right: number, bottom: number): (bitmap: Bitmap) => Bitmap
$convert(targetMode: PixelMode): (bitmap: Bitmap) => Bitmap
```

#### Output Operators

```typescript
$toRGBA: (bitmap: Bitmap) => Uint8Array
$toGray: (bitmap: Bitmap) => Uint8Array
$toSVG(options?: SVGOptions): (path: GlyphPath) => string
$copy: (bitmap: Bitmap) => Bitmap
```

## Examples

### Basic Glyph Rendering

```typescript
import { glyph } from "text-shaper";

// Simple: glyph -> scale -> rasterize -> RGBA
const rgba = glyph(font, glyphId)
  ?.scale(2)
  .rasterizeAuto({ padding: 2 })
  .toRGBA();

// With rotation and blur
const blurred = glyph(font, glyphId)
  ?.scale(2)
  .rotateDeg(15)
  .rasterizeAuto({ padding: 10 })
  .blur(3)
  .toRGBA();
```

### Text Effects

```typescript
// Synthetic bold italic
const boldItalic = glyph(font, glyphId)
  ?.embolden(50)       // Path-level bold
  .italic(12)          // 12-degree italic
  .scale(2)
  .rasterize({ width: 100, height: 100 })
  .embolden(1, 1)      // Bitmap-level additional bold
  .toRGBA();

// Stroked text
const stroked = glyph(font, glyphId)
  ?.stroke({ width: 20, lineCap: "round", lineJoin: "round" })
  .scale(2)
  .rasterizeAuto()
  .toRGBA();
```

### Shadow/Glow Effect

```typescript
const glyphPath = glyph(font, glyphId)?.scale(2);
if (!glyphPath) throw new Error("Glyph not found");

// Create shadow
const shadow = glyphPath
  .clone()
  .translate(4, 4)
  .rasterizeAuto({ padding: 20 })
  .cascadeBlur(8, 8);

// Create main glyph
const main = glyphPath.rasterizeAuto({ padding: 20 });

// Composite shadow + main
const result = shadow.composite(main).toRGBA();
```

### Canvas Rendering

```typescript
const path = glyph(font, glyphId)?.scale(2);
if (path) {
  path.toCanvas(ctx, {
    offsetX: 100,
    offsetY: 200,
    fill: "black"
  });
}
```

### Combining Multiple Glyphs

```typescript
import { glyph, combine } from "text-shaper";

const h = glyph(font, font.glyphId("H".charCodeAt(0))!)?.translate(0, 0);
const i = glyph(font, font.glyphId("i".charCodeAt(0))!)?.translate(50, 0);

if (h && i) {
  const combined = combine(h, i)
    .scale(2)
    .rasterizeAuto()
    .toRGBA();
}
```

### Using Pipe Style

```typescript
import { pipe, $scale, $rotate, $rasterizeAuto, $blur, $toRGBA, getGlyphPath } from "text-shaper";

const path = getGlyphPath(font, glyphId);
if (path) {
  const rgba = pipe(
    path,
    $scale(2, 2),
    $rotate(Math.PI / 4),
    $rasterizeAuto({ padding: 5 }),
    $blur(3),
    $toRGBA
  );
}
```

### Lazy vs Eager Transforms

```typescript
// Lazy: transforms accumulated, applied at render
const lazy = glyph(font, glyphId)
  ?.scale(2)           // Matrix multiply
  .rotate(0.5)         // Matrix multiply
  .translate(10, 10)   // Matrix multiply
  .rasterizeAuto();    // Apply combined matrix once

// Force immediate application with .apply()
const eager = glyph(font, glyphId)
  ?.scale(2)
  .apply()             // Apply transforms now
  .embolden(50)        // Embolden the scaled path
  .rotate(0.5)         // New lazy transform
  .rasterizeAuto();
```

## Additional Features

### Atlas Building

Build texture atlases for efficient GPU rendering.

```typescript
import { buildAtlas, buildAsciiAtlas, buildStringAtlas, atlasToRGBA, getGlyphUV } from "text-shaper";

// Build atlas for ASCII characters
const atlas = buildAsciiAtlas(font, { fontSize: 32, padding: 2 });

// Build atlas for specific glyphs
const customAtlas = buildAtlas(font, [glyphId1, glyphId2], { fontSize: 32 });

// Build atlas for specific text
const textAtlas = buildStringAtlas(font, "Hello World", { fontSize: 32 });

// Get UV coordinates for rendering
const uv = getGlyphUV(atlas, glyphId);
// { u0, v0, u1, v1 }

// Convert to RGBA for GPU upload
const rgba = atlasToRGBA(atlas);
```

### MSDF Atlas Building

Build multi-channel signed distance field atlases for scalable GPU text.

```typescript
import { buildMsdfAtlas, buildMsdfAsciiAtlas, msdfAtlasToRGBA } from "text-shaper";

// Build MSDF atlas for ASCII
const msdfAtlas = buildMsdfAsciiAtlas(font, { fontSize: 32, spread: 4 });

// Convert to RGBA for GPU upload
const msdfRgba = msdfAtlasToRGBA(msdfAtlas);
```

### Direct Glyph Rasterization

Rasterize glyphs without building a PathBuilder.

```typescript
import { rasterizeGlyph, rasterizeText } from "text-shaper";

// Rasterize single glyph
const result = rasterizeGlyph(font, glyphId, 24);
if (result) {
  const { bitmap, bearingX, bearingY } = result;
}

// Rasterize text string (multiple glyphs)
const textResult = rasterizeText(font, "Hello", 24);
```

### Shaped Text Rendering

Render shaped text to canvas or SVG.

```typescript
import { shape, renderShapedText, shapedTextToSVG, glyphBufferToShapedGlyphs } from "text-shaper";

// Shape text
const buffer = new UnicodeBuffer(text);
shape(font, buffer);

// Convert to shaped glyphs
const shapedGlyphs = glyphBufferToShapedGlyphs(buffer);

// Render to canvas
renderShapedText(ctx, font, shapedGlyphs, {
  fontSize: 24,
  fill: "black"
});

// Convert to SVG
const svg = shapedTextToSVG(font, shapedGlyphs, {
  fontSize: 24,
  fill: "currentColor"
});
```

### SDF/MSDF for GPU Rendering

Generate signed distance fields for scalable GPU text.

```typescript
// Single glyph SDF
const sdf = glyph(font, glyphId)
  ?.toSdfAuto({ spread: 8, scale: 0.1 })
  .toGray();

// Single glyph MSDF (better quality)
const msdf = glyph(font, glyphId)
  ?.toMsdfAuto({ spread: 8, scale: 0.1 })
  .toRGBA();
```

### Asymmetric Stroke Effects

Create directional borders and shadow effects.

```typescript
// Horizontal drop shadow
const { outer } = glyph(font, glyphId)
  ?.strokeAsymmetric({ xBorder: 5, yBorder: 0 });
const shadow = outer?.translate(2, 2).rasterizeAuto().blur(3);

// Vertical stretch effect
const stretched = glyph(font, glyphId)
  ?.strokeAsymmetricCombined({ xBorder: 0, yBorder: 10 })
  .rasterizeAuto()
  .toRGBA();
```
