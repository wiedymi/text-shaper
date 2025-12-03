# Getting Started

TextShaper is a pure TypeScript text shaping engine. It handles OpenType layout, complex text shaping, TrueType hinting, and FreeType-style rasterization. Supports all major scripts including Arabic, Indic, and CJK.

## Installation

```bash
bun add text-shaper
```

Or with npm:

```bash
npm install text-shaper
```

## Quick Start

Here's a minimal example to shape text:

```typescript
import { Font, shape, UnicodeBuffer } from "text-shaper";

// Load a font
const font = await Font.fromFile("path/to/font.ttf");

// Create a buffer with text
const buffer = new UnicodeBuffer().addStr("Hello, world!");

// Shape the text
const result = shape(font, buffer);

// Access shaped glyphs
for (let i = 0; i < result.length; i++) {
	const info = result.infos[i];
	const pos = result.positions[i];

	console.log({
		glyphId: info.glyphId,
		cluster: info.cluster,
		xAdvance: pos.xAdvance,
		yAdvance: pos.yAdvance,
		xOffset: pos.xOffset,
		yOffset: pos.yOffset,
	});
}
```

## Loading Fonts

TextShaper provides three ways to load fonts:

### From File (Bun/Node.js)

```typescript
const font = await Font.fromFile("/path/to/font.ttf");
```

### From URL (Browser/Bun)

```typescript
const font = await Font.fromURL("https://example.com/font.ttf");
```

### From ArrayBuffer

```typescript
const buffer = await fetch("font.ttf").then(r => r.arrayBuffer());
const font = Font.load(buffer);
```

## Understanding the Output

The `shape()` function returns a `GlyphBuffer` with two parallel arrays:

- **infos**: Array of `GlyphInfo` objects containing:
  - `glyphId`: The glyph index in the font
  - `cluster`: Character cluster this glyph belongs to
  - `mask`: Feature application mask
  - `codepoint`: Original Unicode codepoint

- **positions**: Array of `GlyphPosition` objects containing:
  - `xAdvance`: Horizontal advance width
  - `yAdvance`: Vertical advance width (usually 0 for horizontal text)
  - `xOffset`: Horizontal positioning offset
  - `yOffset`: Vertical positioning offset

All position values are in font units. To convert to pixels:

```typescript
const pixelSize = 16;
const unitsPerEm = font.unitsPerEm;
const xAdvancePixels = (pos.xAdvance * pixelSize) / unitsPerEm;
```

## Next Steps

- Learn about [basic usage](./basic-usage.md) including text direction and scripts
- Explore [features](./features.md) to apply OpenType features like ligatures and kerning
