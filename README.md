# text-shaper

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-vivy--company-ea4aaa)](https://github.com/sponsors/vivy-company)

Pure TypeScript text shaping engine with OpenType layout, TrueType hinting, and FreeType-style rasterization. Works in browsers and Bun/Node.js with zero dependencies.

## Features

- **OpenType Layout**: Full GSUB (substitution) and GPOS (positioning) support
- **Complex Scripts**: Arabic, Indic, USE (Universal Shaping Engine) shapers
- **Variable Fonts**: fvar, gvar, avar, HVAR, VVAR, MVAR tables
- **AAT Support**: morx, kerx, trak tables for Apple fonts
- **Color Fonts**: SVG, sbix, CBDT/CBLC tables
- **BiDi**: UAX #9 bidirectional text algorithm
- **Rasterization**: FreeType-style grayscale, LCD subpixel, and monochrome rendering
- **TrueType Hinting**: Full bytecode interpreter (150+ opcodes)
- **Texture Atlas**: GPU-ready glyph atlas generation with shelf packing
- **Zero Dependencies**: Pure TypeScript, works in browser and Node.js

## Installation

```bash
npm install text-shaper
# or
bun add text-shaper
```

## Usage

```typescript
import { Font, shape, UnicodeBuffer } from "text-shaper";

// Load a font
const fontData = await Bun.file("path/to/font.ttf").arrayBuffer();
const font = new Font(fontData);

// Create a buffer with text
const buffer = new UnicodeBuffer();
buffer.addString("Hello, World!");

// Shape the text
const glyphBuffer = shape(font, buffer);

// Access shaped glyphs
for (let i = 0; i < glyphBuffer.length; i++) {
  const info = glyphBuffer.info[i];
  const pos = glyphBuffer.pos[i];
  console.log(`Glyph ${info.glyphId}: advance=${pos.xAdvance}, offset=(${pos.xOffset}, ${pos.yOffset})`);
}
```

### With Features

```typescript
import { Font, shape, UnicodeBuffer, feature, features } from "text-shaper";

const glyphBuffer = shape(font, buffer, {
  features: features(
    feature("smcp", 1),  // Small caps
    feature("liga", 1),  // Ligatures
    feature("kern", 1),  // Kerning
  ),
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
import { Font, shape, UnicodeBuffer, shapedTextToSVG } from "text-shaper";

const buffer = new UnicodeBuffer();
buffer.addString("Hello");

const glyphBuffer = shape(font, buffer);
const svg = shapedTextToSVG(font, glyphBuffer, { fontSize: 48 });
```

## API

### Core Classes

- `Font` - Load and parse OpenType/TrueType fonts
- `Face` - Font face with variation coordinates applied
- `UnicodeBuffer` - Input buffer for text to shape
- `GlyphBuffer` - Output buffer containing shaped glyphs

### Shaping

- `shape(font, buffer, options?)` - Shape text in a buffer
- `createShapePlan(font, options)` - Create a reusable shape plan

### Rendering

- `getGlyphPath(font, glyphId)` - Get glyph outline as path commands
- `shapedTextToSVG(font, buffer, options)` - Render shaped text to SVG
- `renderShapedText(ctx, font, buffer, options)` - Render to Canvas 2D context

### Rasterization

```typescript
import { Font, rasterizeGlyph, buildAtlas, PixelMode } from "text-shaper";

// Rasterize a single glyph
const glyph = rasterizeGlyph(font, glyphId, 48, {
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

// And many more...
```

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
morx, kerx, kern, trak

### Color
COLR, CPAL, SVG, sbix, CBDT, CBLC

### Vertical
vhea, vmtx, VORG

### Hinting
fpgm, prep, cvt, gasp

## License

[MIT](LICENSE)

