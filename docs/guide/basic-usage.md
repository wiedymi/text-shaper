# Basic Usage

## UnicodeBuffer Configuration

The `UnicodeBuffer` class holds input text and configuration for shaping. It supports various options for different text layouts and scripts.

### Adding Text

```typescript
import { UnicodeBuffer } from "text-shaper";

const buffer = new UnicodeBuffer();

// Add string
buffer.addStr("Hello");

// Add codepoints array
buffer.addCodepoints([0x48, 0x65, 0x6C, 0x6C, 0x6F]);

// Chain calls
const buffer2 = new UnicodeBuffer()
	.addStr("Hello ")
	.addStr("World");
```

### Text Direction

Set the text direction for proper layout:

```typescript
import { Direction } from "text-shaper";

// Left-to-right (default)
buffer.setDirection(Direction.LTR);

// Right-to-left (Arabic, Hebrew)
buffer.setDirection(Direction.RTL);

// Top-to-bottom
buffer.setDirection(Direction.TTB);

// Bottom-to-top
buffer.setDirection(Direction.BTT);
```

### Script and Language

Specify the script and language for correct shaping:

```typescript
// Set script (ISO 15924 code)
buffer.setScript("Arab");  // Arabic
buffer.setScript("Latn");  // Latin
buffer.setScript("Deva");  // Devanagari
buffer.setScript("Hans");  // Simplified Chinese

// Set language (BCP 47 code)
buffer.setLanguage("ar");   // Arabic
buffer.setLanguage("en");   // English
buffer.setLanguage("hi");   // Hindi
buffer.setLanguage("zh");   // Chinese
```

### Cluster Level

Control how character clusters are formed:

```typescript
import { ClusterLevel } from "text-shaper";

// Monotone graphemes (default)
buffer.setClusterLevel(ClusterLevel.MonotoneGraphemes);

// Monotone characters
buffer.setClusterLevel(ClusterLevel.MonotoneCharacters);

// Characters
buffer.setClusterLevel(ClusterLevel.Characters);
```

### Shaping Context

Provide surrounding text context for better shaping at boundaries:

```typescript
// Set text before the buffer
buffer.setPreContext("previous ");

// Set text after the buffer
buffer.setPostContext(" next");
```

## Complete Example

### English Text

```typescript
import { Font, shape, UnicodeBuffer, Direction } from "text-shaper";

const font = await Font.fromFile("font.ttf");

const buffer = new UnicodeBuffer()
	.addStr("Hello, World!")
	.setDirection(Direction.LTR)
	.setScript("Latn")
	.setLanguage("en");

const result = shape(font, buffer);
```

### Arabic Text

```typescript
const buffer = new UnicodeBuffer()
	.addStr("مرحبا بك")
	.setDirection(Direction.RTL)
	.setScript("Arab")
	.setLanguage("ar");

const result = shape(font, buffer);
```

### Devanagari Text

```typescript
const buffer = new UnicodeBuffer()
	.addStr("नमस्ते")
	.setDirection(Direction.LTR)
	.setScript("Deva")
	.setLanguage("hi");

const result = shape(font, buffer);
```

## Working with Results

### Iterating Glyphs

```typescript
const result = shape(font, buffer);

for (let i = 0; i < result.length; i++) {
	const info = result.infos[i];
	const pos = result.positions[i];

	console.log(`Glyph ${i}:`);
	console.log(`  ID: ${info.glyphId}`);
	console.log(`  Cluster: ${info.cluster}`);
	console.log(`  X Advance: ${pos.xAdvance}`);
	console.log(`  Y Advance: ${pos.yAdvance}`);
}
```

### Calculating Text Width

```typescript
const result = shape(font, buffer);

let totalWidth = 0;
for (let i = 0; i < result.length; i++) {
	totalWidth += result.positions[i].xAdvance;
}

// Convert to pixels
const pixelSize = 16;
const widthPixels = (totalWidth * pixelSize) / font.unitsPerEm;
```

### Mapping Glyphs to Characters

Use the cluster index to map glyphs back to character positions:

```typescript
const result = shape(font, buffer);
const text = "Hello";

for (let i = 0; i < result.length; i++) {
	const cluster = result.infos[i].cluster;
	const char = text[cluster];
	console.log(`Glyph ${i} corresponds to character '${char}' at position ${cluster}`);
}
```

## Reusing Buffers

For better performance, reuse buffers instead of creating new ones:

```typescript
const buffer = new UnicodeBuffer();

// Shape first text
buffer.addStr("Hello");
const result1 = shape(font, buffer);

// Clear and reuse
buffer.clear();
buffer.addStr("World");
const result2 = shape(font, buffer);
```

## Font Information

Access font metadata:

```typescript
const font = await Font.fromFile("font.ttf");

console.log(`Units per em: ${font.unitsPerEm}`);
console.log(`Ascent: ${font.ascent}`);
console.log(`Descent: ${font.descent}`);
console.log(`Line gap: ${font.lineGap}`);

// Check available tables
console.log(`Has GSUB: ${font.hasTable("GSUB")}`);
console.log(`Has GPOS: ${font.hasTable("GPOS")}`);
```

## Error Handling

```typescript
try {
	const font = await Font.fromFile("font.ttf");
	const buffer = new UnicodeBuffer().addStr("Hello");
	const result = shape(font, buffer);
} catch (error) {
	console.error("Shaping failed:", error);
}
```

## Fluent API

For rendering individual glyphs with transforms and effects, TextShaper provides a fluent API:

```typescript
import { glyph, char } from "text-shaper";

// Render a glyph with transforms
const rgba = glyph(font, glyphId)
  ?.scale(2)
  .rotateDeg(15)
  .rasterizeAuto({ padding: 2 })
  .toRGBA();

// Render from character
const svg = char(font, "A")
  ?.scale(2)
  .italic(12)
  .toSVG();

// With effects
const blurred = glyph(font, glyphId)
  ?.scale(2)
  .rasterizeAuto({ padding: 10 })
  .blur(5)
  .toRGBA();
```

The fluent API supports:
- **Transforms**: `scale()`, `rotate()`, `translate()`, `shear()`, `italic()`, `perspective()`
- **Path effects**: `embolden()`, `condense()`, `oblique()`, `stroke()`
- **Rasterization**: `rasterize()`, `rasterizeAuto()`, `toSdf()`, `toMsdf()`
- **Bitmap effects**: `blur()`, `fastBlur()`, `embolden()`, `composite()`
- **Output**: `toRGBA()`, `toGray()`, `toSVG()`, `toCanvas()`

See the [Fluent API Reference](/api/fluent) for complete documentation.
