# Raster API

## Types

### PixelMode

```typescript
enum PixelMode {
  Mono = 0,    // 1-bit per pixel, 8 pixels per byte
  Gray = 1,    // 8-bit grayscale, 1 byte per pixel
  LCD = 2,     // 24-bit LCD subpixel RGB, 3 bytes per pixel
  LCD_V = 3,   // 24-bit LCD subpixel vertical RGB
}
```

### FillRule

```typescript
enum FillRule {
  NonZero = 0,  // Non-zero winding rule (default)
  EvenOdd = 1,  // Even-odd alternating fill rule
}
```

### LcdMode

```typescript
enum LcdMode {
  RGB = 0,    // Horizontal RGB subpixels
  BGR = 1,    // Horizontal BGR subpixels
  RGB_V = 2,  // Vertical RGB subpixels
  BGR_V = 3,  // Vertical BGR subpixels
}
```

### Bitmap

```typescript
interface Bitmap {
  buffer: Uint8Array;   // Pixel data
  width: number;        // Width in pixels
  height: number;       // Height in pixels
  pitch: number;        // Bytes per row
  pixelMode: PixelMode; // Pixel format
}
```

### RasterizedGlyph

```typescript
interface RasterizedGlyph {
  bitmap: Bitmap;     // Rasterized pixels
  bearingX: number;   // Horizontal bearing (left side)
  bearingY: number;   // Vertical bearing (top side)
  advance: number;    // Horizontal advance width
}
```

### GlyphMetrics

```typescript
interface GlyphMetrics {
  x: number;        // X position in atlas
  y: number;        // Y position in atlas
  width: number;    // Glyph bitmap width
  height: number;   // Glyph bitmap height
  bearingX: number; // Horizontal bearing
  bearingY: number; // Vertical bearing
  advance: number;  // Horizontal advance
}
```

### GlyphAtlas

```typescript
interface GlyphAtlas {
  bitmap: Bitmap;                    // Atlas texture
  glyphs: Map<number, GlyphMetrics>; // Per-glyph metrics
  fontSize: number;                  // Font size used
}
```

### AtlasOptions

```typescript
interface AtlasOptions {
  fontSize: number;        // Target font size in pixels
  padding?: number;        // Padding between glyphs (default: 1)
  maxWidth?: number;       // Max atlas width (default: 2048)
  maxHeight?: number;      // Max atlas height (default: 2048)
  pixelMode?: PixelMode;   // Pixel format (default: Gray)
  hinting?: boolean;       // Use TrueType hinting (default: false)
}
```

### RasterizeOptions

```typescript
interface RasterizeOptions {
  width: number;           // Bitmap width
  height: number;          // Bitmap height
  scale: number;           // Scale factor (fontSize / unitsPerEm)
  offsetX?: number;        // X offset in pixels
  offsetY?: number;        // Y offset in pixels (baseline)
  flipY?: boolean;         // Flip Y axis (default: true)
  pixelMode?: PixelMode;   // Pixel format (default: Gray)
  fillRule?: FillRule;     // Fill rule (default: NonZero)
}
```

### OutlineError

```typescript
enum OutlineError {
  Ok = 0,
  InvalidOutline = 1,
  InvalidArgument = 2,
  EmptyOutline = 3,
}
```

### ValidationResult

```typescript
interface ValidationResult {
  error: OutlineError;
  message?: string;
}
```

## Glyph Rasterization

### rasterizeGlyph

Rasterize a single glyph.

```typescript
function rasterizeGlyph(
  font: Font,
  glyphId: GlyphId,
  fontSize: number,
  options?: {
    pixelMode?: PixelMode;
    padding?: number;
    hinting?: boolean;
  }
): RasterizedGlyph | null
```

### rasterizeText

Rasterize a text string.

```typescript
function rasterizeText(
  font: Font,
  text: string,
  fontSize: number,
  options?: {
    pixelMode?: PixelMode;
    padding?: number;
  }
): Bitmap | null
```

### rasterizePath

Low-level path rasterization.

```typescript
function rasterizePath(
  path: GlyphPath,
  options: RasterizeOptions
): Bitmap
```

## Atlas Building

### buildAtlas

Build atlas from specific glyph IDs.

```typescript
function buildAtlas(
  font: Font,
  glyphIds: number[],
  options: AtlasOptions
): GlyphAtlas
```

### buildAsciiAtlas

Build atlas for ASCII printable characters (32-126).

```typescript
function buildAsciiAtlas(
  font: Font,
  options: AtlasOptions
): GlyphAtlas
```

### buildStringAtlas

Build atlas for glyphs in a specific string.

```typescript
function buildStringAtlas(
  font: Font,
  text: string,
  options: AtlasOptions
): GlyphAtlas
```

### getGlyphUV

Get normalized UV coordinates for a glyph in the atlas.

```typescript
function getGlyphUV(
  atlas: GlyphAtlas,
  glyphId: number
): { u0: number; v0: number; u1: number; v1: number } | null
```

### atlasToRGBA

Convert atlas to RGBA format (white text on transparent).

```typescript
function atlasToRGBA(atlas: GlyphAtlas): Uint8Array
```

### atlasToAlpha

Convert atlas to single-channel alpha.

```typescript
function atlasToAlpha(atlas: GlyphAtlas): Uint8Array
```

## Bitmap Conversion

### bitmapToRGBA

Convert any bitmap to RGBA format.

```typescript
function bitmapToRGBA(bitmap: Bitmap): Uint8Array
```

### bitmapToGray

Convert any bitmap to grayscale.

```typescript
function bitmapToGray(bitmap: Bitmap): Uint8Array
```

## LCD Subpixel Rendering

### rasterizeLcd

Rasterize with LCD subpixel rendering.

```typescript
function rasterizeLcd(
  path: GlyphPath,
  width: number,
  height: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  mode?: LcdMode,
  filterWeights?: number[]
): Bitmap
```

### lcdToRGBA

Convert LCD bitmap to RGBA with custom colors.

```typescript
function lcdToRGBA(
  lcd: Bitmap,
  bgColor?: [number, number, number],  // Background RGB (default: white)
  fgColor?: [number, number, number]   // Foreground RGB (default: black)
): Uint8Array
```

### LCD Filter Presets

```typescript
const LCD_FILTER_LIGHT: number[]   // [0, 85, 86, 85, 0]
const LCD_FILTER_DEFAULT: number[] // [8, 77, 86, 77, 8]
const LCD_FILTER_LEGACY: number[]  // [0, 64, 128, 64, 0]
```

## Path Validation

### validateOutline

Validate a glyph path before rasterization.

```typescript
function validateOutline(
  path: GlyphPath | null | undefined,
  allowEmpty?: boolean
): ValidationResult
```

### getFillRuleFromFlags

Get fill rule from path flags.

```typescript
function getFillRuleFromFlags(
  path: GlyphPath | null | undefined,
  defaultRule?: FillRule
): FillRule
```

### getPathBounds

Calculate pixel bounds of a scaled path.

```typescript
function getPathBounds(
  path: GlyphPath,
  scale: number,
  flipY?: boolean
): { minX: number; minY: number; maxX: number; maxY: number } | null
```

## Fixed-Point Constants

```typescript
const PIXEL_BITS = 8;          // Subpixel precision bits
const ONE_PIXEL = 256;         // One pixel in fixed-point
const F26DOT6_ONE = 64;        // FreeType 26.6 format unit
const F16DOT16_ONE = 65536;    // 16.16 fixed-point unit
```

## Hinting

### HintingEngine

```typescript
interface HintingEngine {
  ctx: ExecContext;
  unitsPerEM: number;
  fpgmExecuted: boolean;
  currentPpem: number;
}
```

### createHintingEngine

Create a TrueType hinting engine.

```typescript
function createHintingEngine(
  unitsPerEM: number,
  maxStack?: number,
  maxStorage?: number,
  maxFDefs?: number,
  maxTwilightPoints?: number,
  cvtValues?: Int32Array
): HintingEngine
```

### loadFontProgram

Load and execute font program (fpgm).

```typescript
function loadFontProgram(engine: HintingEngine, fpgm: Uint8Array): void
```

### loadCVTProgram

Load and execute CVT program (prep).

```typescript
function loadCVTProgram(engine: HintingEngine, prep: Uint8Array): void
```

### hintGlyph

Apply hinting to a glyph outline.

```typescript
function hintGlyph(engine: HintingEngine, outline: GlyphOutline): HintedGlyph
```

## Stroke Support

### LineCap

```typescript
type LineCap = "butt" | "round" | "square"
```

Line cap styles for path stroking:
- `butt`: Flat cap at the endpoint (default)
- `round`: Rounded semicircular cap
- `square`: Square cap extending beyond the endpoint

### LineJoin

```typescript
type LineJoin = "miter" | "round" | "bevel"
```

Line join styles for path stroking:
- `miter`: Sharp corner extending to a point (default)
- `round`: Rounded arc at the join
- `bevel`: Flat diagonal corner

### StrokerOptions

```typescript
interface StrokerOptions {
  width: number;        // Stroke width in font units
  lineCap?: LineCap;    // Line cap style (default: "butt")
  lineJoin?: LineJoin;  // Line join style (default: "miter")
  miterLimit?: number;  // Miter limit for miter joins (default: 4)
}
```

### strokePath

Convert a path outline into a stroked outline that can be filled.

```typescript
function strokePath(path: GlyphPath, options: StrokerOptions): GlyphPath
```

Generates two borders (inside and outside) by offsetting the original path by half the stroke width in both directions. Based on FreeType's stroking algorithm.

## SDF Rendering

### SdfOptions

```typescript
interface SdfOptions {
  width: number;     // Width in pixels
  height: number;    // Height in pixels
  scale: number;     // Scale factor (font units to pixels)
  offsetX?: number;  // X offset in pixels
  offsetY?: number;  // Y offset in pixels
  flipY?: boolean;   // Flip Y axis (default: false)
  spread?: number;   // Distance field radius in pixels (default: 8)
}
```

### renderSdf

Render a glyph path as a signed distance field (SDF).

```typescript
function renderSdf(path: GlyphPath, options: SdfOptions): Bitmap
```

For each pixel, computes the shortest distance to the outline. Positive values are inside the outline, negative are outside. Values are normalized to 0-255 range where:
- `0` = `-spread` (far outside)
- `128` = edge boundary
- `255` = `+spread` (far inside)

SDF textures enable GPU text rendering at any scale with smooth edges and effects like outlines, shadows, and glows.

## Bitmap Utilities

### emboldenBitmap

Make a bitmap bolder by dilating pixel values.

```typescript
function emboldenBitmap(
  bitmap: Bitmap,
  xStrength: number,
  yStrength: number
): Bitmap
```

Spreads coverage in horizontal and vertical directions to make text appear bolder. Works with all pixel modes (Mono, Gray, LCD).

### convertBitmap

Convert bitmap between pixel modes.

```typescript
function convertBitmap(bitmap: Bitmap, targetMode: PixelMode): Bitmap
```

Supported conversions:
- Gray ↔ Mono (threshold at 128)
- Gray → LCD / LCD_V
- Mono → LCD / LCD_V
- LCD → Gray (average RGB channels)

### blendBitmap

Alpha blend source bitmap onto destination bitmap.

```typescript
function blendBitmap(
  dst: Bitmap,
  src: Bitmap,
  x: number,
  y: number,
  opacity: number
): void
```

Blends `src` onto `dst` at position `(x, y)` with specified opacity (0-1). Only works with grayscale bitmaps. Modifies `dst` in place.

### copyBitmap

Create a deep copy of a bitmap.

```typescript
function copyBitmap(bitmap: Bitmap): Bitmap
```

### resizeBitmap

Resize bitmap using nearest-neighbor interpolation.

```typescript
function resizeBitmap(
  bitmap: Bitmap,
  newWidth: number,
  newHeight: number
): Bitmap
```

## Blur Filters

### blurBitmap

Apply blur filter to a bitmap in-place.

```typescript
function blurBitmap(
  bitmap: Bitmap,
  radius: number,
  type?: "gaussian" | "box"
): Bitmap
```

Modifies the bitmap in-place and returns it. Default type is `"gaussian"`. Works with all pixel modes (Mono is converted to Gray first).

### gaussianBlur

Gaussian blur using separable 2-pass algorithm.

```typescript
function gaussianBlur(bitmap: Bitmap, radius: number): Bitmap
```

High-quality blur that uses a Gaussian kernel. The separable implementation performs horizontal pass followed by vertical pass for efficiency. Modifies bitmap in-place.

### boxBlur

Box blur using running sum for O(1) per pixel.

```typescript
function boxBlur(bitmap: Bitmap, radius: number): Bitmap
```

Fast blur using uniform kernel weights. Uses running sum technique for constant-time per-pixel performance regardless of radius. Modifies bitmap in-place.

### createGaussianKernel

Generate 1D Gaussian kernel weights.

```typescript
function createGaussianKernel(radius: number): Float32Array
```

Creates a normalized Gaussian kernel using the function `exp(-x²/(2σ²))` where σ = radius. Kernel extends to 2*radius on each side, capturing >99% of the Gaussian distribution. Weights are normalized to sum to 1.0.

## Gradient Fill

### Types

```typescript
interface ColorStop {
  offset: number;  // 0.0 to 1.0
  color: [number, number, number, number];  // RGBA 0-255
}

interface LinearGradient {
  type: "linear";
  x0: number;      // Start X coordinate
  y0: number;      // Start Y coordinate
  x1: number;      // End X coordinate
  y1: number;      // End Y coordinate
  stops: ColorStop[];
}

interface RadialGradient {
  type: "radial";
  cx: number;      // Center X coordinate
  cy: number;      // Center Y coordinate
  radius: number;  // Gradient radius
  stops: ColorStop[];
}

type Gradient = LinearGradient | RadialGradient;
```

### rasterizePathWithGradient

Rasterize a path with gradient fill.

```typescript
function rasterizePathWithGradient(
  path: GlyphPath,
  gradient: Gradient,
  options: RasterizeOptions
): Bitmap
```

Rasterizes the path to get a coverage mask, then fills it with the specified gradient. Returns an RGBA bitmap where the alpha channel is modulated by the coverage and gradient opacity.

### createGradientBitmap

Create a bitmap filled with gradient.

```typescript
function createGradientBitmap(
  width: number,
  height: number,
  gradient: Gradient
): Bitmap
```

Creates an RGBA bitmap filled with the specified gradient pattern (no path mask).

### interpolateGradient

Get interpolated color at position in gradient.

```typescript
function interpolateGradient(
  gradient: Gradient,
  x: number,
  y: number
): [number, number, number, number]
```

Computes the RGBA color at pixel coordinates `(x, y)` within the gradient. For linear gradients, projects the point onto the gradient line. For radial gradients, computes distance from center. Clamps to [0,1] range and interpolates between color stops.

## Synthetic Effects

### obliquePath

Apply oblique (slant/italic) transformation to a path.

```typescript
function obliquePath(path: GlyphPath, slant: number): GlyphPath
```

Creates fake italic by slanting the glyph. The `slant` parameter is the tangent of the slant angle (0.2 ≈ 12 degrees, typical italic).

Transform: `x' = x + y * slant`, `y' = y`

### emboldenPath

Embolden (make bolder) a path by offsetting the outline.

```typescript
function emboldenPath(path: GlyphPath, strength: number): GlyphPath
```

Creates fake bold by offsetting each contour outward. The `strength` parameter is the offset in font units (positive = bolder, negative = thinner).

### condensePath

Apply horizontal scaling to a path.

```typescript
function condensePath(path: GlyphPath, factor: number): GlyphPath
```

Scales the glyph horizontally. Use `factor < 1` for narrower (condensed) glyphs, `factor > 1` for wider (expanded) glyphs.

Transform: `x' = x * factor`, `y' = y`

### transformPath

Apply general 2D affine transformation to a path.

```typescript
function transformPath(
  path: GlyphPath,
  matrix: [number, number, number, number, number, number]
): GlyphPath
```

Applies a 2D transformation matrix `[a, b, c, d, e, f]` to the path.

Transform: `x' = a*x + c*y + e`, `y' = b*x + d*y + f`

## Exact Bounding Box

### BBox

```typescript
interface BBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}
```

### getExactBounds

Calculate exact bounding box for a path including bezier extrema.

```typescript
function getExactBounds(path: GlyphPath): BBox | null
```

Unlike simple bounds that only consider control points, this finds the actual extrema of bezier curves by solving for where the derivative equals zero.

### getQuadraticExtrema

Find t values where a quadratic bezier has extrema.

```typescript
function getQuadraticExtrema(
  p0: number,
  p1: number,
  p2: number
): number[]
```

Returns array of t values in [0,1] where the quadratic bezier curve has minimum or maximum values.

### getCubicExtrema

Find t values where a cubic bezier has extrema.

```typescript
function getCubicExtrema(
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number[]
```

Returns array of t values in [0,1] where the cubic bezier curve has minimum or maximum values.

### evaluateQuadratic

Evaluate quadratic bezier at parameter t.

```typescript
function evaluateQuadratic(
  p0: number,
  p1: number,
  p2: number,
  t: number
): number
```

Evaluates `B(t) = (1-t)²p0 + 2(1-t)t*p1 + t²p2` for a single dimension.

### evaluateCubic

Evaluate cubic bezier at parameter t.

```typescript
function evaluateCubic(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number
): number
```

Evaluates `B(t) = (1-t)³p0 + 3(1-t)²t*p1 + 3(1-t)t²p2 + t³p3` for a single dimension.

## Cascade Blur

High-performance blur for large radii using pyramid scaling algorithm.

### cascadeBlur

Apply blur with independent X and Y radii using cascade algorithm.

```typescript
function cascadeBlur(
  bitmap: Bitmap,
  radiusX: number,
  radiusY: number
): Bitmap
```

Uses scale-down/blur/scale-up pyramid approach for O(1) per-pixel performance regardless of blur radius. Ideal for radii > 3 pixels.

### fastGaussianBlur

Gaussian blur using cascade algorithm.

```typescript
function fastGaussianBlur(bitmap: Bitmap, radius: number): Bitmap
```

Convenience wrapper for cascadeBlur with equal X/Y radii.

### adaptiveBlur

Automatically choose optimal blur algorithm based on radius.

```typescript
function adaptiveBlur(
  bitmap: Bitmap,
  radiusX: number,
  radiusY?: number  // defaults to radiusX
): Bitmap
```

Uses simple separable Gaussian for small radii (≤ 3) and cascade algorithm for large radii (> 3). If `radiusY` is omitted, uses `radiusX` for both dimensions.

## Asymmetric Stroke

Generate stroked outlines with independent X and Y border widths.

### AsymmetricStrokeOptions

```typescript
interface AsymmetricStrokeOptions {
  xBorder: number;     // Horizontal stroke width in font units
  yBorder: number;     // Vertical stroke width in font units
  lineJoin?: LineJoin; // Join style: "miter" | "round" | "bevel"
  miterLimit?: number; // Miter limit for miter joins (default: 4)
}
```

### strokeAsymmetric

Generate separate outer and inner stroked paths.

```typescript
function strokeAsymmetric(
  path: GlyphPath,
  options: AsymmetricStrokeOptions
): { outer: GlyphPath; inner: GlyphPath }
```

Returns two paths: outer border (expanded outward) and inner border (contracted inward). Useful for outline effects where you need separate control over each border.

### strokeAsymmetricCombined

Generate combined stroked path (outer - inner hole).

```typescript
function strokeAsymmetricCombined(
  path: GlyphPath,
  options: AsymmetricStrokeOptions
): GlyphPath
```

Returns a single path representing the stroke region (outer contour with inner as a hole). When filled, produces a hollow stroke effect.

### strokeUniform

Convenience function for uniform stroke width.

```typescript
function strokeUniform(
  path: GlyphPath,
  width: number,
  lineJoin?: LineJoin,
  miterLimit?: number
): GlyphPath
```

Strokes with equal X and Y border widths.

## Bitmap Compositing

Operations for combining and manipulating bitmaps.

### addBitmaps

Add source bitmap values to destination (additive blend).

```typescript
function addBitmaps(
  dst: Bitmap,
  src: Bitmap,
  srcX: number,
  srcY: number
): void
```

Result: `dst = clamp(dst + src, 0, 255)`. Modifies dst in place.

### mulBitmaps

Multiply source and destination bitmap values.

```typescript
function mulBitmaps(
  dst: Bitmap,
  src: Bitmap,
  srcX: number,
  srcY: number
): void
```

Result: `dst = (dst * src) / 255`. Used for masking operations.

### subBitmaps

Subtract source from destination (subtractive blend).

```typescript
function subBitmaps(
  dst: Bitmap,
  src: Bitmap,
  srcX: number,
  srcY: number
): void
```

Result: `dst = clamp(dst - src, 0, 255)`. Used for outline effects.

### compositeBitmaps

Porter-Duff "over" compositing.

```typescript
function compositeBitmaps(
  dst: Bitmap,
  src: Bitmap,
  srcX: number,
  srcY: number
): void
```

Result: `dst = src + dst * (1 - src_alpha)`. Standard alpha blending.

### maxBitmaps

Maximum of source and destination values.

```typescript
function maxBitmaps(
  dst: Bitmap,
  src: Bitmap,
  srcX: number,
  srcY: number
): void
```

Result: `dst = max(dst, src)`. Useful for combining coverage masks.

### shiftBitmap

Shift bitmap by integer pixel offset.

```typescript
function shiftBitmap(
  bitmap: Bitmap,
  dx: number,
  dy: number
): Bitmap
```

Returns new bitmap shifted by (dx, dy) pixels.

### padBitmap

Add padding around a bitmap.

```typescript
function padBitmap(
  bitmap: Bitmap,
  padLeft: number,
  padRight: number,
  padTop: number,
  padBottom: number
): Bitmap
```

Returns new bitmap with specified padding on each side.

### expandToFit

Expand bitmap to fit both source and destination at given offset.

```typescript
function expandToFit(
  dst: Bitmap,
  src: Bitmap,
  srcX: number,
  srcY: number
): {
  expanded: Bitmap;
  dstOffsetX: number;
  dstOffsetY: number;
  srcOffsetX: number;
  srcOffsetY: number;
}
```

Creates a new bitmap large enough to contain both dst and src at the specified position, returning offsets for positioning both.

### fixOutline

Clean up outline artifacts from subtractive operations.

```typescript
function fixOutline(bitmap: Bitmap): void
```

Removes isolated bright pixels that can appear after subtracting inner from outer stroke bitmaps.
