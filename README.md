# text-shaper

[![GitHub](https://img.shields.io/badge/-GitHub-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/wiedymi)
[![Twitter](https://img.shields.io/badge/-Twitter-1DA1F2?style=flat-square&logo=twitter&logoColor=white)](https://x.com/wiedymi)
[![Email](https://img.shields.io/badge/-Email-EA4335?style=flat-square&logo=gmail&logoColor=white)](mailto:contact@wiedymi.com)
[![Discord](https://img.shields.io/badge/-Discord-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/eKW7GNesuS)
[![Support me](https://img.shields.io/badge/-Support%20me-ff69b4?style=flat-square&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/vivy-company)

Pure TypeScript text shaping engine with OpenType layout, TrueType hinting, and FreeType-style rasterization. Works in browsers and Bun/Node.js with zero dependencies.

## Performance

text-shaper outperforms harfbuzzjs (WebAssembly) and opentype.js across all benchmarks:

| Category | vs harfbuzzjs | vs opentype.js |
|----------|---------------|----------------|
| Path Extraction | 16x faster | 10x faster |
| Text to SVG | 1.2-1.5x faster | 4-6x faster |
| Latin Shaping | 1.5x faster | 22x faster |
| Arabic Shaping | 1.2x faster | 86x faster |
| Hebrew Shaping | 1.6x faster | 33x faster |
| Hindi Shaping | 3.6x faster | 11x faster |
| Myanmar Shaping | 10.5x faster | 17x faster |
| CJK Shaping | 1.3-1.5x faster | 11-13x faster |

## Features

- **OpenType Layout**: Full GSUB (substitution) and GPOS (positioning) support
- **Complex Scripts**: Arabic, Indic, USE (Universal Shaping Engine) shapers
- **Variable Fonts**: fvar, gvar, avar, HVAR, VVAR, MVAR tables
- **AAT Support**: morx, kerx, trak tables for Apple fonts
- **Color Fonts**: SVG, sbix, CBDT/CBLC, COLR/CPAL tables
- **BiDi**: UAX #9 bidirectional text algorithm
- **Rasterization**: FreeType-style grayscale, LCD subpixel, and monochrome rendering
- **TrueType Hinting**: Full bytecode interpreter (150+ opcodes)
- **Texture Atlas**: GPU-ready glyph atlas generation with shelf packing
- **SDF/MSDF**: Signed distance field rendering for scalable text
- **Zero Dependencies**: Pure TypeScript, works in browser and Node.js

## Installation

```bash
npm install text-shaper
# or
bun add text-shaper
```

## Usage

### Basic Shaping

```typescript
import { Font, shape, UnicodeBuffer } from "text-shaper";

// Load a font
const fontData = await fetch("path/to/font.ttf").then(r => r.arrayBuffer());
const font = Font.load(fontData);

// Create a buffer with text
const buffer = new UnicodeBuffer();
buffer.addStr("Hello, World!");

// Shape the text
const glyphBuffer = shape(font, buffer);

// Access shaped glyphs
for (let i = 0; i < glyphBuffer.length; i++) {
  const info = glyphBuffer.info[i];
  const pos = glyphBuffer.pos[i];
  console.log(`Glyph ${info.glyphId}: advance=${pos.xAdvance}`);
}
```

### High-Performance Shaping

For best performance, reuse buffers with `shapeInto`:

```typescript
import { Font, shapeInto, UnicodeBuffer, GlyphBuffer } from "text-shaper";

const font = Font.load(fontData);
const uBuffer = new UnicodeBuffer();
const gBuffer = GlyphBuffer.withCapacity(128);

// Shape multiple strings efficiently
for (const text of texts) {
  uBuffer.clear();
  uBuffer.addStr(text);
  gBuffer.reset();
  shapeInto(font, uBuffer, gBuffer);
  // Process gBuffer...
}
```

### With Features

```typescript
import { Font, shape, UnicodeBuffer, feature } from "text-shaper";

const glyphBuffer = shape(font, buffer, {
  features: [
    feature("smcp"),      // Small caps
    feature("liga"),      // Ligatures
    feature("kern"),      // Kerning
  ],
});

// Or use convenience helpers
import { smallCaps, standardLigatures, kerning, combineFeatures } from "text-shaper";

const glyphBuffer = shape(font, buffer, {
  features: combineFeatures(smallCaps(), standardLigatures(), kerning()),
});
```

### Variable Fonts

```typescript
import { Font, shape, UnicodeBuffer, tag } from "text-shaper";

const glyphBuffer = shape(font, buffer, {
  variations: [
    { tag: tag("wght"), value: 700 },  // Bold
    { tag: tag("wdth"), value: 75 },   // Condensed
  ],
});
```

### Rendering to SVG

```typescript
import {
  Font, shape, UnicodeBuffer,
  glyphBufferToShapedGlyphs, shapedTextToSVG
} from "text-shaper";

const buffer = new UnicodeBuffer();
buffer.addStr("Hello");

const glyphBuffer = shape(font, buffer);
const shapedGlyphs = glyphBufferToShapedGlyphs(glyphBuffer);
const svg = shapedTextToSVG(font, shapedGlyphs, { fontSize: 48 });
```

### Rasterization

```typescript
import { Font, rasterizeGlyph, buildAtlas, PixelMode } from "text-shaper";

// Rasterize a single glyph
const bitmap = rasterizeGlyph(font, glyphId, 48, {
  pixelMode: PixelMode.Gray,  // Gray, Mono, or LCD
  hinting: true,              // Enable TrueType hinting
});

// Build a texture atlas for GPU rendering
const atlas = buildAtlas(font, glyphIds, {
  fontSize: 32,
  padding: 1,
  pixelMode: PixelMode.Gray,
  hinting: true,
});
```

### SDF/MSDF Rendering

```typescript
import {
  Font, getGlyphPath, renderSdf, renderMsdf, buildMsdfAtlas
} from "text-shaper";

// Single glyph SDF
const path = getGlyphPath(font, glyphId);
if (path) {
  const sdf = renderSdf(path, {
    width: 64,
    height: 64,
    scale: 1,
    spread: 8,
  });
}

// MSDF atlas for GPU text rendering (handles font internally)
const msdfAtlas = buildMsdfAtlas(font, glyphIds, {
  fontSize: 32,
  spread: 4,
});
```

### Fluent API

Two composition styles for glyph manipulation and rendering:

#### Builder Pattern (Method Chaining)

```typescript
import { Font, glyph, char, glyphVar, combine, PixelMode } from "text-shaper";

// From glyph ID
const rgba = glyph(font, glyphId)
  ?.scale(2)
  .rotateDeg(15)
  .rasterizeAuto({ padding: 2 })
  .blur(5)
  .toRGBA();

// From character
const svg = char(font, "A")
  ?.scale(3)
  .italic(12)
  .toSVG({ width: 100, height: 100 });

// Variable fonts
const bitmap = glyphVar(font, glyphId, [700, 100])  // wght=700, wdth=100
  ?.embolden(50)
  .rasterize({ pixelMode: PixelMode.Gray, scale: 2 })
  .toBitmap();

// Combine multiple glyphs
const h = glyph(font, hGlyphId)?.translate(0, 0);
const i = glyph(font, iGlyphId)?.translate(100, 0);
if (h && i) {
  const combined = combine(h, i).scale(2).rasterizeAuto().toRGBA();
}
```

#### PathBuilder Methods

```typescript
// Transforms (lazy - accumulated as matrix)
.scale(sx, sy?)           // Scale uniformly or non-uniformly
.translate(dx, dy)        // Translate by offset
.rotate(radians)          // Rotate by angle in radians
.rotateDeg(degrees)       // Rotate by angle in degrees
.shear(shearX, shearY)    // Shear transform
.italic(degrees)          // Italic slant (convenience for shear)
.matrix(m)                // Apply custom 2D matrix
.perspective(m)           // Apply 3D perspective matrix
.resetTransform()         // Reset accumulated transforms
.apply()                  // Apply accumulated transforms to path

// Path effects (immediate - modifies path)
.embolden(strength)       // Make strokes thicker
.condense(factor)         // Horizontal compression
.oblique(slant)           // Oblique slant effect
.stroke(width, cap?, join?)  // Convert to stroked outline
.strokeAsymmetric(opts)   // Independent x/y stroke widths

// Output
.rasterize(options)       // Rasterize to BitmapBuilder
.rasterizeAuto(options?)  // Auto-sized rasterization
.toSdf(options)           // Render to SDF bitmap
.toMsdf(options)          // Render to MSDF bitmap
.toSVG(options?)          // Export as SVG string
.toSVGElement(options?)   // Export as SVG path element
.toCanvas(ctx, options?)  // Draw to Canvas 2D context
.toPath()                 // Get raw GlyphPath
.clone()                  // Clone the builder
```

#### BitmapBuilder Methods

```typescript
// Blur effects
.blur(radius)             // Gaussian blur
.boxBlur(radius)          // Box blur (faster)
.fastBlur(radius)         // Fast approximated blur
.cascadeBlur(rx, ry?)     // Cascade blur for large radii
.adaptiveBlur(rx, ry?)    // Adaptive quality blur

// Modifications
.embolden(xStrength, yStrength?)  // Expand bitmap
.shift(dx, dy)            // Shift bitmap contents
.resize(width, height)    // Resize (nearest neighbor)
.resizeBilinear(w, h)     // Resize with bilinear filtering
.pad(left, top, right, bottom)  // Add padding
.convert(pixelMode)       // Convert pixel format

// Output
.toRGBA()                 // Export as RGBA Uint8Array
.toGray()                 // Export as grayscale Uint8Array
.toBitmap()               // Get Bitmap object
.toRasterizedGlyph()      // Get RasterizedGlyph with metrics
.clone()                  // Clone the builder
```

#### Pipe Pattern (Functional)

```typescript
import {
  pipe, glyph,
  $scale, $rotate, $embolden,
  $rasterize, $blur, $toRGBA
} from "text-shaper";

// Compose operations functionally
const rgba = pipe(
  glyph(font, glyphId),
  $scale(2),
  $rotate(Math.PI / 12),
  $embolden(30),
  $rasterize({ pixelMode: PixelMode.Gray }),
  $blur(3),
  $toRGBA()
);
```

### Line Breaking & Justification

```typescript
import { breakIntoLines, justify, JustifyMode } from "text-shaper";

// Break text into lines
const lines = breakIntoLines(glyphBuffer, font, maxWidth);

// Justify a line
const justified = justify(line, targetWidth, {
  mode: JustifyMode.Distribute,
});
```

### Text Segmentation

```typescript
import { countGraphemes, splitGraphemes, splitWords } from "text-shaper";

// Count grapheme clusters (visual characters)
const count = countGraphemes("👨‍👩‍👧‍👦Hello"); // 6 (family emoji = 1)

// Split into graphemes
const graphemes = splitGraphemes("नमस्ते"); // Devanagari clusters

// Split into words
const words = splitWords("Hello World"); // ["Hello", " ", "World"]
```

### Canvas Rendering

```typescript
import {
  Font, shape, UnicodeBuffer,
  glyphBufferToShapedGlyphs, renderShapedText
} from "text-shaper";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const buffer = new UnicodeBuffer();
buffer.addStr("Hello Canvas!");

const glyphBuffer = shape(font, buffer);
const shapedGlyphs = glyphBufferToShapedGlyphs(glyphBuffer);

renderShapedText(ctx, font, shapedGlyphs, {
  x: 50,
  y: 100,
  fontSize: 48,
});
```

### BiDi & RTL Text

```typescript
import {
  Font, shape, UnicodeBuffer,
  processBidi, reorderGlyphs, detectDirection
} from "text-shaper";

// Automatic RTL detection and reordering
const buffer = new UnicodeBuffer();
buffer.addStr("Hello שלום World");  // Mixed LTR/RTL

const glyphBuffer = shape(font, buffer);
// Glyphs are automatically reordered for visual display

// Manual BiDi processing
const bidiResult = processBidi("مرحبا Hello");
console.log(bidiResult.direction);  // "rtl"
console.log(bidiResult.levels);     // Embedding levels per character

// Detect text direction
const dir = detectDirection("שלום");  // "rtl"
```

### Color Fonts

```typescript
import {
  Font,
  hasColorGlyph, getColorPaint, getColorLayers,  // COLR
  hasSvgGlyph, getSvgDocument,                     // SVG
  hasColorBitmap, getBitmapGlyph,                  // CBDT/sbix
} from "text-shaper";

// Check for color glyph support
const glyphId = font.glyphId("😀".codePointAt(0)!);

// COLR/CPAL (vector color)
if (hasColorGlyph(font, glyphId)) {
  const paint = getColorPaint(font, glyphId);
  // Render paint tree...
}

// SVG color glyphs
if (hasSvgGlyph(font, glyphId)) {
  const svgDoc = getSvgDocument(font, glyphId);
  // Use SVG document directly
}

// Bitmap color glyphs (sbix, CBDT)
if (hasColorBitmap(font, glyphId)) {
  const bitmap = getBitmapGlyph(font, glyphId, 128);  // ppem=128
  // bitmap.data contains PNG/JPEG data
}
```

### Texture Atlas (WebGL/GPU)

```typescript
import {
  Font, buildAtlas, buildStringAtlas, buildMsdfAtlas,
  atlasToRGBA, getGlyphUV, PixelMode
} from "text-shaper";

// Build atlas from glyph IDs
const atlas = buildAtlas(font, glyphIds, {
  fontSize: 32,
  padding: 2,
  pixelMode: PixelMode.Gray,
});

// Build atlas from string (auto-extracts unique glyphs)
const textAtlas = buildStringAtlas(font, "Hello World!", {
  fontSize: 48,
  padding: 1,
});

// Convert to RGBA for WebGL texture
const rgba = atlasToRGBA(atlas);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlas.width, atlas.height,
              0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);

// Get UV coordinates for rendering
const uv = getGlyphUV(atlas, glyphId);
// uv = { u0, v0, u1, v1, ... }

// MSDF atlas for scalable GPU text
const msdfAtlas = buildMsdfAtlas(font, glyphIds, {
  fontSize: 32,
  spread: 4,
});
```

### Browser Usage

```typescript
// Fetch font from URL
const fontData = await fetch("/fonts/MyFont.ttf").then(r => r.arrayBuffer());
const font = Font.load(fontData);

// Or from File input
const file = input.files[0];
const buffer = await file.arrayBuffer();
const font = Font.load(buffer);

// Works with any ArrayBuffer source
```

## API Reference

### Core Classes

| Class | Description |
|-------|-------------|
| `Font` | Load and parse OpenType/TrueType fonts |
| `Face` | Font face with variation coordinates applied |
| `UnicodeBuffer` | Input buffer for text to shape |
| `GlyphBuffer` | Output buffer containing shaped glyphs |

### Shaping Functions

| Function | Description |
|----------|-------------|
| `shape(font, buffer, options?)` | Shape text, returns new GlyphBuffer |
| `shapeInto(font, buffer, glyphBuffer, options?)` | Shape into existing buffer (faster) |
| `createShapePlan(font, options)` | Create reusable shape plan |
| `getOrCreateShapePlan(font, options)` | Get cached or create shape plan |

### Rendering Functions

| Function | Description |
|----------|-------------|
| `getGlyphPath(font, glyphId)` | Get glyph outline as path commands |
| `shapedTextToSVG(font, shapedGlyphs, options)` | Render shaped text to SVG string |
| `renderShapedText(ctx, font, shapedGlyphs, options)` | Render to Canvas 2D context |
| `glyphBufferToShapedGlyphs(buffer)` | Convert GlyphBuffer to ShapedGlyph[] |
| `rasterizeGlyph(font, glyphId, size, options)` | Rasterize glyph to bitmap |
| `rasterizePath(path, options)` | Rasterize path commands to bitmap |
| `buildAtlas(font, glyphIds, options)` | Build texture atlas |

### Feature Helpers

```typescript
// Ligatures
standardLigatures()      // liga
discretionaryLigatures() // dlig
contextualAlternates()   // calt

// Caps
smallCaps()              // smcp
capsToSmallCaps()        // c2sc
allSmallCaps()           // smcp + c2sc

// Figures
oldstyleFigures()        // onum
liningFigures()          // lnum
tabularFigures()         // tnum
proportionalFigures()    // pnum

// Stylistic
stylisticSet(n)          // ss01-ss20
characterVariant(n)      // cv01-cv99
swash()                  // swsh
```

### Unicode Utilities

| Function | Description |
|----------|-------------|
| `processBidi(text)` | Process bidirectional text (UAX #9) |
| `getScript(codepoint)` | Get Unicode script for codepoint |
| `getScriptRuns(text)` | Split text into script runs |
| `countGraphemes(text)` | Count grapheme clusters |
| `splitGraphemes(text)` | Split into grapheme clusters |
| `analyzeLineBreaks(text)` | Find line break opportunities (UAX #14) |

## Supported Tables

### Required
head, hhea, hmtx, maxp, cmap, loca, glyf, name, OS/2, post

### OpenType Layout
GDEF, GSUB, GPOS, BASE

### CFF
CFF, CFF2

### Variable Fonts
fvar, gvar, avar, HVAR, VVAR, MVAR, STAT

### AAT (Apple)
morx, kerx, kern, trak, feat

### Color
COLR, CPAL, SVG, sbix, CBDT, CBLC

### Vertical
vhea, vmtx, VORG

### Hinting
fpgm, prep, cvt, gasp

## License

[MIT](LICENSE)
