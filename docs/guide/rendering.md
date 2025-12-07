# Rendering

TextShaper provides utilities to convert shaped glyphs into renderable paths for SVG, Canvas, and other graphics APIs.

## Glyph Paths

Extract vector paths from glyphs:

```typescript
import { getGlyphPath } from "text-shaper";

const font = await Font.fromFile("font.ttf");
const glyphId = font.cmap.map("A".codePointAt(0));

const path = getGlyphPath(font, glyphId);

// Path contains commands and bounds
console.log(path.commands);  // PathCommand[]
console.log(path.bounds);    // { xMin, yMin, xMax, yMax }
```

### Path Commands

Path commands follow standard vector graphics operations:

```typescript
type PathCommand =
  | { type: "M"; x: number; y: number }           // moveTo
  | { type: "L"; x: number; y: number }           // lineTo
  | { type: "Q"; x1: number; y1: number; x: number; y: number }  // quadratic bezier
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }  // cubic bezier
  | { type: "Z" };                                 // closePath

// Example path for letter "A"
const commands = [
  { type: "M", x: 100, y: 0 },
  { type: "L", x: 200, y: 600 },
  { type: "L", x: 300, y: 0 },
  { type: "L", x: 250, y: 0 },
  { type: "L", x: 200, y: 400 },
  { type: "L", x: 150, y: 0 },
  { type: "Z" }
];
```

TrueType fonts use quadratic bezier curves (Q), while PostScript/CFF fonts use cubic bezier curves (C).

## SVG Rendering

### Path to SVG String

```typescript
import { pathToSVG } from "text-shaper";

const path = getGlyphPath(font, glyphId);
const svgPath = pathToSVG(path);

console.log(svgPath);
// "M100 200 L150 200 Q175 200 175 225 L175 300 Z"
```

### Single Glyph SVG

```typescript
import { glyphToSVG } from "text-shaper";

const svg = glyphToSVG(font, glyphId, {
  fontSize: 48,
  color: "#000000"
});

console.log(svg);
// <svg xmlns="http://www.w3.org/2000/svg" viewBox="...">
//   <path d="..." fill="#000000"/>
// </svg>

// Write to file
await Bun.write("glyph.svg", svg);
```

### Shaped Text SVG

Render complete shaped text:

```typescript
import { shapedTextToSVG, shape, UnicodeBuffer } from "text-shaper";

const buffer = new UnicodeBuffer().addStr("Hello World");
const glyphBuffer = shape(font, buffer);

const svg = shapedTextToSVG(font, glyphBuffer, {
  fontSize: 48,
  color: "#000000",
  x: 0,
  y: 0
});

await Bun.write("text.svg", svg);
```

Advanced options:

```typescript
const svg = shapedTextToSVG(font, glyphBuffer, {
  fontSize: 48,
  color: "#000000",
  x: 100,
  y: 200,
  letterSpacing: 2,        // additional spacing between glyphs
  features: {
    liga: 1,               // enable ligatures
    kern: 1                // enable kerning
  },
  rtl: false               // right-to-left rendering
});
```

## Canvas Rendering

### Path2D API

Modern browsers support Path2D for efficient canvas rendering:

```typescript
import { createPath2D } from "text-shaper";

const path = getGlyphPath(font, glyphId);
const path2d = createPath2D(path);

// Render on canvas
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

ctx.fillStyle = "#000000";
ctx.fill(path2d);
```

### Manual Canvas Rendering

For environments without Path2D:

```typescript
import { pathToCanvas } from "text-shaper";

const ctx = canvas.getContext("2d");
const path = getGlyphPath(font, glyphId);

pathToCanvas(ctx, path);

ctx.fillStyle = "#000000";
ctx.fill();
```

### Rendering Shaped Text

```typescript
import { renderShapedText, shape, UnicodeBuffer } from "text-shaper";

const buffer = new UnicodeBuffer().addStr("Hello");
const glyphBuffer = shape(font, buffer);

const ctx = canvas.getContext("2d");

renderShapedText(ctx, font, glyphBuffer, {
  x: 0,
  y: 100,
  fontSize: 48,
  color: "#000000"
});
```

## Text Metrics

### Measure Text Width

```typescript
import { getTextWidth } from "text-shaper";

const buffer = new UnicodeBuffer().addStr("Hello World");
const glyphBuffer = shape(font, buffer);

const width = getTextWidth(font, glyphBuffer);
console.log(`Text width: ${width} font units`);

// Convert to pixels at specific font size
const fontSize = 48;
const unitsPerEm = font.head.unitsPerEm;
const widthPx = (width / unitsPerEm) * fontSize;
console.log(`Text width: ${widthPx}px`);
```

### Glyph Bounds

```typescript
const glyphId = font.cmap.map("A".codePointAt(0));
const path = getGlyphPath(font, glyphId);

console.log(path.bounds);
// { xMin: 50, yMin: 0, xMax: 450, yMax: 700 }

// Calculate glyph dimensions
const width = path.bounds.xMax - path.bounds.xMin;
const height = path.bounds.yMax - path.bounds.yMin;
```

### Font Metrics

```typescript
// Global font metrics
const unitsPerEm = font.head.unitsPerEm;        // typically 1000 or 2048
const ascender = font.hhea.ascender;             // height above baseline
const descender = font.hhea.descender;           // depth below baseline (negative)
const lineGap = font.hhea.lineGap;               // spacing between lines

// Calculate line height in pixels
const fontSize = 48;
const lineHeight = ((ascender - descender + lineGap) / unitsPerEm) * fontSize;

console.log(`Line height: ${lineHeight}px`);
```

## Advanced Rendering

### Color Fonts (COLR/CPAL)

```typescript
import { getColorGlyphLayers } from "text-shaper";

const glyphId = font.cmap.map("🎨".codePointAt(0));

if (font.COLR) {
  const layers = getColorGlyphLayers(font, glyphId);

  layers.forEach(layer => {
    const path = getGlyphPath(font, layer.glyphId);
    const color = layer.paletteIndex !== undefined
      ? font.CPAL.colors[layer.paletteIndex]
      : "#000000";

    // Render each layer with its color
    const svgPath = pathToSVG(path);
    console.log(`<path d="${svgPath}" fill="${color}"/>`);
  });
}
```

### Bitmap Glyphs (EBDT/CBLC)

Some fonts include embedded bitmaps for specific sizes:

```typescript
import { getBitmapGlyph } from "text-shaper";

if (font.CBLC && font.EBDT) {
  const bitmap = getBitmapGlyph(font, glyphId, fontSize);

  if (bitmap) {
    console.log(`Bitmap size: ${bitmap.width}x${bitmap.height}`);
    console.log(`Data: ${bitmap.data}`);  // pixel data
  }
}
```

### Hinting

TrueType hinting instructions improve rendering at small sizes:

```typescript
// Most rasterizers apply hinting automatically
// For manual control:
const path = getGlyphPath(font, glyphId, {
  hinting: true,
  ppem: 16  // pixels per em (font size)
});
```

## Practical Examples

### Text to SVG File

```typescript
import { Font, UnicodeBuffer, shape, shapedTextToSVG } from "text-shaper";

async function textToSVG(text: string, fontPath: string, outputPath: string) {
  const font = await Font.fromFile(fontPath);
  const buffer = new UnicodeBuffer().addStr(text);
  const glyphBuffer = shape(font, buffer);

  const svg = shapedTextToSVG(font, glyphBuffer, {
    fontSize: 64,
    color: "#000000"
  });

  await Bun.write(outputPath, svg);
}

await textToSVG("Hello World", "font.ttf", "output.svg");
```

### Canvas Text Renderer

```typescript
import { Font, UnicodeBuffer, shape, getGlyphPath, pathToCanvas } from "text-shaper";

class TextRenderer {
  constructor(private font: Font, private ctx: CanvasRenderingContext2D) {}

  render(text: string, x: number, y: number, fontSize: number) {
    const buffer = new UnicodeBuffer().addStr(text);
    const glyphBuffer = shape(this.font, buffer);

    const scale = fontSize / this.font.head.unitsPerEm;
    let cursorX = x;

    for (let i = 0; i < glyphBuffer.glyphs.length; i++) {
      const glyph = glyphBuffer.glyphs[i];
      const path = getGlyphPath(this.font, glyph.id);

      this.ctx.save();
      this.ctx.translate(
        cursorX + glyph.xOffset * scale,
        y - glyph.yOffset * scale
      );
      this.ctx.scale(scale, -scale);  // flip Y axis

      pathToCanvas(this.ctx, path);
      this.ctx.fill();

      this.ctx.restore();

      cursorX += glyph.xAdvance * scale;
    }
  }
}

// Usage
const font = await Font.fromFile("font.ttf");
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

const renderer = new TextRenderer(font, ctx);
renderer.render("Hello World", 10, 100, 48);
```

### Multi-line Text

```typescript
import { Font, UnicodeBuffer, shape, getTextWidth, analyzeLineBreaks } from "text-shaper";

async function renderMultilineText(
  text: string,
  font: Font,
  maxWidth: number,
  fontSize: number
) {
  const lines = [];
  const words = text.split(/\s+/);
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const buffer = new UnicodeBuffer().addStr(testLine);
    const shaped = shape(font, buffer);
    const width = (getTextWidth(font, shaped) / font.head.unitsPerEm) * fontSize;

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

const font = await Font.fromFile("font.ttf");
const lines = await renderMultilineText(
  "The quick brown fox jumps over the lazy dog",
  font,
  300,
  16
);

console.log(lines);
// ["The quick brown", "fox jumps over", "the lazy dog"]
```

## Fluent API

For a more ergonomic approach, use the fluent API which provides method chaining:

### Builder Style

```typescript
import { glyph, char, combine } from "text-shaper";

// Single glyph rendering
const rgba = glyph(font, glyphId)
  ?.scale(2)
  .rotateDeg(15)
  .rasterizeAuto({ padding: 2 })
  .blur(5)
  .toRGBA();

// From character
const svg = char(font, "A")
  ?.scale(2)
  .italic(12)
  .toSVG();

// Canvas rendering
const path = glyph(font, glyphId)?.scale(2);
path?.toCanvas(ctx, {
  offsetX: 100,
  offsetY: 200,
  fill: "black"
});

// Combining multiple glyphs
const h = glyph(font, font.glyphId("H".charCodeAt(0))!)?.translate(0, 0);
const i = glyph(font, font.glyphId("i".charCodeAt(0))!)?.translate(50, 0);
if (h && i) {
  const combined = combine(h, i).scale(2).toSVG();
}
```

### Pipe Style

```typescript
import { pipe, $scale, $rotate, $toSVG, getGlyphPath } from "text-shaper";

const path = getGlyphPath(font, glyphId);
if (path) {
  const svg = pipe(
    path,
    $scale(2, 2),
    $rotate(Math.PI / 4),
    $toSVG()
  );
}
```

### Text Effects with Fluent API

```typescript
// Synthetic bold italic
const boldItalic = glyph(font, glyphId)
  ?.embolden(50)
  .italic(12)
  .scale(2)
  .toSVG();

// Stroked text
const stroked = glyph(font, glyphId)
  ?.stroke({ width: 20, lineCap: "round", lineJoin: "round" })
  .scale(2)
  .toSVG();

// Shadow effect
const glyphPath = glyph(font, glyphId)?.scale(2);
const shadow = glyphPath?.clone()
  .translate(4, 4)
  .rasterizeAuto({ padding: 20 })
  .cascadeBlur(8);
const main = glyphPath?.rasterizeAuto({ padding: 20 });
const result = shadow?.composite(main!).toRGBA();
```

See the [Fluent API Reference](/api/fluent) for complete documentation.

## Performance Optimization

- Cache Path2D objects for frequently used glyphs
- Reuse canvas contexts instead of creating new ones
- Batch glyph rendering operations
- Use web workers for heavy path generation
- Pre-generate SVGs for static text

```typescript
// Glyph cache example
class GlyphCache {
  private cache = new Map<number, Path2D>();

  getPath2D(font: Font, glyphId: number): Path2D {
    if (!this.cache.has(glyphId)) {
      const path = getGlyphPath(font, glyphId);
      const path2d = createPath2D(path);
      this.cache.set(glyphId, path2d);
    }
    return this.cache.get(glyphId)!;
  }
}
```

## Coordinate Systems

TextShaper uses font units (typically 1000 or 2048 per em):

```typescript
// Convert font units to pixels
function fontUnitsToPixels(units: number, fontSize: number, unitsPerEm: number): number {
  return (units / unitsPerEm) * fontSize;
}

// Convert pixels to font units
function pixelsToFontUnits(pixels: number, fontSize: number, unitsPerEm: number): number {
  return (pixels / fontSize) * unitsPerEm;
}

// Example
const glyphWidth = 600;  // font units
const fontSize = 48;
const unitsPerEm = 1000;

const widthPx = fontUnitsToPixels(glyphWidth, fontSize, unitsPerEm);
console.log(`${widthPx}px`);  // 28.8px
```
