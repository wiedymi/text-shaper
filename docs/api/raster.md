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
