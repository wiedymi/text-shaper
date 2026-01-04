# Rasterization

TextShaper includes a complete FreeType-style rasterization engine for converting glyph outlines into bitmaps. This enables server-side rendering, texture atlas generation for GPU rendering, and TrueType hinting support.

## Basic Glyph Rasterization

Rasterize a single glyph to a bitmap:

```typescript
import { Font, rasterizeGlyph, PixelMode } from "text-shaper";

const font = await Font.fromFile("font.ttf");
const glyphId = font.glyphId(0x41); // 'A'

const result = rasterizeGlyph(font, glyphId, 48, {
  pixelMode: PixelMode.Gray,
  padding: 1,
  hinting: true,
  // sizeMode: "em", // default
});

if (result) {
  console.log({
    width: result.bitmap.width,
    height: result.bitmap.height,
    bearingX: result.bearingX,
    bearingY: result.bearingY,
    advance: result.advance,
  });

  // Access pixel data
  const pixels = result.bitmap.buffer; // Uint8Array
}
```

### Font Size Modes

By default, `fontSize` is treated as the **em size** (CSS-like). Some pipelines
(e.g. FreeType `REAL_DIM`) interpret `fontSize` as the full font height
(`ascender - descender + lineGap`). You can switch behavior with `sizeMode`:

```typescript
const emSized = rasterizeGlyph(font, glyphId, 48, {
  sizeMode: "em", // default
});

const heightSized = rasterizeGlyph(font, glyphId, 48, {
  sizeMode: "height", // FreeType REAL_DIM-style sizing
});
```

Note: for CFF fonts, `sizeMode: "height"` ignores `lineGap` to match FreeType's
REAL_DIM behavior.

Rasterize a glyph and apply a raster-only transform:

```typescript
import { rasterizeGlyphWithTransform } from "text-shaper";

const transformed = rasterizeGlyphWithTransform(
  font,
  glyphId,
  48,
  [1, 0, 0, 1, 0.3, -0.4], // Matrix2D
  { offsetX26: 12, offsetY26: -8 }
);
```

## Pixel Modes

TextShaper supports multiple pixel formats:

```typescript
import { PixelMode } from "text-shaper";

// 8-bit grayscale (default)
PixelMode.Gray    // 1 byte per pixel, values 0-255

// 1-bit monochrome
PixelMode.Mono    // 1 bit per pixel, 8 pixels per byte

// LCD subpixel rendering
PixelMode.LCD     // 3 bytes per pixel (RGB), horizontal subpixels
PixelMode.LCD_V   // 3 bytes per pixel (RGB), vertical subpixels
```

## Text Rasterization

Rasterize an entire text string:

```typescript
import { Font, rasterizeText, PixelMode } from "text-shaper";

const font = await Font.fromFile("font.ttf");
const bitmap = rasterizeText(font, "Hello", 32, {
  pixelMode: PixelMode.Gray,
  padding: 2,
  // sizeMode: "height",
});

if (bitmap) {
  console.log(`${bitmap.width}x${bitmap.height}`);
}
```

## Glyph Atlases

For GPU rendering, build a texture atlas containing multiple glyphs:

```typescript
import {
  Font, buildAtlas, buildAsciiAtlas, buildStringAtlas,
  atlasToRGBA, atlasToAlpha, getGlyphUV
} from "text-shaper";

const font = await Font.fromFile("font.ttf");

// Build atlas from specific glyph IDs
const atlas = buildAtlas(font, [65, 66, 67], {
  fontSize: 32,
  // sizeMode: "height",
  padding: 1,
  pixelMode: PixelMode.Gray,
  hinting: true,
});

// Or build atlas for ASCII printable characters (32-126)
const asciiAtlas = buildAsciiAtlas(font, {
  fontSize: 32,
  padding: 1,
});

// Or build atlas for specific text
const textAtlas = buildStringAtlas(font, "Hello World!", {
  fontSize: 32,
});

// Access atlas data
console.log({
  width: atlas.bitmap.width,
  height: atlas.bitmap.height,
  glyphCount: atlas.glyphs.size,
});

// Get UV coordinates for a glyph
const uv = getGlyphUV(atlas, 65); // 'A'
if (uv) {
  console.log({ u0: uv.u0, v0: uv.v0, u1: uv.u1, v1: uv.v1 });
}

// Convert to GPU-ready formats
const rgba = atlasToRGBA(atlas);  // RGBA with white text
const alpha = atlasToAlpha(atlas); // Single-channel alpha
```

## Atlas Options

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

## Glyph Metrics

Each glyph in the atlas includes positioning metrics:

```typescript
interface GlyphMetrics {
  x: number;        // X position in atlas
  y: number;        // Y position in atlas
  width: number;    // Glyph bitmap width
  height: number;   // Glyph bitmap height
  bearingX: number; // Horizontal bearing (left side)
  bearingY: number; // Vertical bearing (top side)
  advance: number;  // Horizontal advance width
}

// Access metrics for a glyph
const metrics = atlas.glyphs.get(glyphId);
```

## TrueType Hinting

Enable TrueType hinting for sharper rendering at small sizes:

```typescript
const result = rasterizeGlyph(font, glyphId, 12, {
  hinting: true,
});

// Check if font has hinting
if (font.hasHinting) {
  console.log("Font has TrueType hinting instructions");
}
```

Hinting adjusts glyph outlines to align with the pixel grid, improving readability at small sizes.

## LCD Subpixel Rendering

For LCD displays, use subpixel rendering for sharper text:

```typescript
import { rasterizeLcd, lcdToRGBA, LcdMode } from "text-shaper";

const path = getGlyphPath(font, glyphId);
const scale = fontSize / font.unitsPerEm;

const lcd = rasterizeLcd(path, width, height, scale, offsetX, offsetY, LcdMode.RGB);

// Convert to RGBA for display
const rgba = lcdToRGBA(lcd, [255, 255, 255], [0, 0, 0]); // bg, fg colors
```

LCD modes:
- `LcdMode.RGB` - Horizontal RGB subpixels
- `LcdMode.BGR` - Horizontal BGR subpixels
- `LcdMode.RGB_V` - Vertical RGB subpixels
- `LcdMode.BGR_V` - Vertical BGR subpixels

## Low-Level Path Rasterization

Rasterize arbitrary paths:

```typescript
import { rasterizePath, getGlyphPath } from "text-shaper";

const path = getGlyphPath(font, glyphId);
const scale = 48 / font.unitsPerEm;

const bitmap = rasterizePath(path, {
  width: 64,
  height: 64,
  scale,
  offsetX: 0,
  offsetY: 48, // baseline offset
  flipY: true,
  pixelMode: PixelMode.Gray,
});
```

## Bitmap Conversion

Convert bitmaps between formats:

```typescript
import { bitmapToRGBA, bitmapToGray } from "text-shaper";

// Grayscale bitmap to RGBA (white text on transparent)
const rgba = bitmapToRGBA(bitmap);

// Any bitmap to grayscale
const gray = bitmapToGray(bitmap);
```

## Path Validation

Validate glyph paths before rasterization:

```typescript
import { validateOutline, OutlineError } from "text-shaper";

const path = getGlyphPath(font, glyphId);
const result = validateOutline(path);

if (result.error !== OutlineError.Ok) {
  console.error("Invalid outline:", result.message);
}
```

## Fill Rules

Control how overlapping paths are filled:

```typescript
import { FillRule, getFillRuleFromFlags } from "text-shaper";

// Get fill rule from path flags
const rule = getFillRuleFromFlags(path, FillRule.NonZero);

// FillRule.NonZero - Non-zero winding (default)
// FillRule.EvenOdd - Even-odd alternating fill
```

## Fluent API for Rasterization

The fluent API provides a more ergonomic way to rasterize glyphs with transforms and effects:

### Basic Rasterization

```typescript
import { glyph, char } from "text-shaper";

// Rasterize with auto-computed bounds
const rgba = glyph(font, glyphId)
  ?.scale(2)
  .rasterizeAuto({ padding: 2 })
  .toRGBA();

// From character
const bitmap = char(font, "A")
  ?.scale(3)
  .rasterizeAuto()
  .toBitmap();
```

### Bitmap Effects

```typescript
// Blur effects
const blurred = glyph(font, glyphId)
  ?.rasterizeAuto({ padding: 20 })
  .blur(5)              // Gaussian blur
  .toRGBA();

// Fast blur for large radii
const fastBlurred = glyph(font, glyphId)
  ?.rasterizeAuto({ padding: 50 })
  .fastBlur(20)         // O(1) cascade blur
  .toRGBA();

// Bitmap emboldening
const bold = glyph(font, glyphId)
  ?.rasterizeAuto()
  .embolden(2, 2)
  .toRGBA();
```

### Compositing

```typescript
// Shadow effect
const glyphPath = glyph(font, glyphId)?.scale(2);
const shadow = glyphPath?.clone()
  .translate(4, 4)
  .rasterizeAuto({ padding: 20 })
  .cascadeBlur(8);
const main = glyphPath?.rasterizeAuto({ padding: 20 });
const result = shadow?.composite(main!).toRGBA();

// Additive blending
const glow = shadow?.add(main!).toRGBA();
```

### SDF/MSDF for GPU Rendering

```typescript
// Signed Distance Field
const sdf = glyph(font, glyphId)
  ?.toSdfAuto({ spread: 8, scale: 0.1 })
  .toGray();

// Multi-channel SDF (better quality)
const msdf = glyph(font, glyphId)
  ?.toMsdfAuto({ spread: 8, scale: 0.1 })
  .toRGBA();
```

### Pipe Style

```typescript
import { pipe, $scale, $rasterizeAuto, $blur, $toRGBA, getGlyphPath } from "text-shaper";

const path = getGlyphPath(font, glyphId);
if (path) {
  const rgba = pipe(
    path,
    $scale(2, 2),
    $rasterizeAuto({ padding: 5 }),
    $blur(3),
    $toRGBA
  );
}
```

See the [Fluent API Reference](/api/fluent) for complete documentation.

## Performance Tips

1. **Reuse atlases**: Build atlases once and reuse for rendering
2. **Enable hinting selectively**: Hinting improves small sizes but adds overhead
3. **Use appropriate pixel mode**: Gray is faster than LCD
4. **Batch atlas building**: Build atlases with all needed glyphs upfront
5. **Power-of-2 textures**: Atlas dimensions are automatically rounded to power-of-2 for GPU compatibility

## Example: Canvas Rendering with Atlas

```typescript
import { Font, buildAsciiAtlas, shape, UnicodeBuffer } from "text-shaper";

const font = await Font.fromFile("font.ttf");
const atlas = buildAsciiAtlas(font, { fontSize: 32, hinting: true });

// Shape text
const buffer = new UnicodeBuffer().addStr("Hello");
const shaped = shape(font, buffer);

// Render to canvas
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

let x = 0;
for (let i = 0; i < shaped.length; i++) {
  const info = shaped.infos[i];
  const pos = shaped.positions[i];
  const metrics = atlas.glyphs.get(info.glyphId);

  if (metrics) {
    // Draw glyph from atlas
    const scale = 32 / font.unitsPerEm;
    ctx.drawImage(
      atlasCanvas, // Atlas as canvas/image
      metrics.x, metrics.y, metrics.width, metrics.height,
      x + metrics.bearingX, baseline - metrics.bearingY,
      metrics.width, metrics.height
    );
  }

  x += pos.xAdvance * scale;
}
```
