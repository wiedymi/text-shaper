# Shaping API

## shape()

The main text shaping function. Converts text to positioned glyphs using OpenType and AAT features.

```typescript
function shape(
  fontLike: Font | Face,
  buffer: UnicodeBuffer,
  options?: ShapeOptions
): GlyphBuffer
```

### Parameters

- `fontLike` - Either a `Font` or `Face` instance. Use `Face` for variable fonts.
- `buffer` - `UnicodeBuffer` containing the text to shape
- `options` - Optional shaping options

### ShapeOptions

```typescript
interface ShapeOptions {
  /** Script tag (e.g., "arab", "latn") */
  script?: string;

  /** Language tag (BCP 47, e.g., "en", "ar") */
  language?: string | null;

  /** Text direction: "ltr" or "rtl" */
  direction?: "ltr" | "rtl";

  /** OpenType features to enable/disable */
  features?: ShapeFeature[];
}
```

### ShapeFeature

```typescript
interface ShapeFeature {
  tag: Tag;      // Feature tag (e.g., Tags.liga)
  enabled: boolean;  // true to enable, false to disable
}
```

### Basic Usage

```typescript
import { Font, UnicodeBuffer, shape } from "typeshaper";

const font = await Font.fromFile("font.ttf");
const buffer = new UnicodeBuffer();
buffer.addStr("Hello World");

const shaped = shape(font, buffer);

for (const { info, position } of shaped) {
  console.log(`Glyph ${info.glyphId}: advance ${position.xAdvance}`);
}
```

### With Options

```typescript
const shaped = shape(font, buffer, {
  script: "arab",
  language: "ar",
  direction: "rtl",
  features: [
    { tag: Tags.liga, enabled: false }, // Disable ligatures
    { tag: Tags.calt, enabled: true }   // Enable contextual alternates
  ]
});
```

### Variable Fonts

Use `Face` for variable font instances:

```typescript
import { Font, Face, UnicodeBuffer, shape } from "typeshaper";

const font = await Font.fromFile("variable.ttf");
const face = new Face(font, { wght: 700, wdth: 100 });

const buffer = new UnicodeBuffer();
buffer.addStr("Variable");

const shaped = shape(face, buffer);
```

### Complex Scripts

The shaper automatically detects and handles complex scripts:

**Arabic**
```typescript
buffer.addStr("مرحبا");
buffer.setScript("arab");
buffer.setDirection(Direction.RTL);
const shaped = shape(font, buffer, { direction: "rtl" });
```

**Indic (Devanagari)**
```typescript
buffer.addStr("नमस्ते");
buffer.setScript("deva");
const shaped = shape(font, buffer, { script: "deva" });
```

**Thai**
```typescript
buffer.addStr("สวัสดี");
buffer.setScript("thai");
const shaped = shape(font, buffer, { script: "thai" });
```

**Korean (Hangul)**
```typescript
buffer.addStr("안녕하세요");
buffer.setScript("hang");
const shaped = shape(font, buffer, { script: "hang" });
```

## Shape Plan

The shape plan determines which lookups to apply during shaping. Plans are cached for performance.

### ShapePlan Interface

```typescript
interface ShapePlan {
  script: Tag;
  language: Tag | null;
  direction: "ltr" | "rtl";
  gsubLookups: Array<{ index: number; lookup: AnyGsubLookup }>;
  gposLookups: Array<{ index: number; lookup: AnyGposLookup }>;
}
```

### createShapePlan()

Manually create a shape plan (usually not needed, as `shape()` handles this).

```typescript
function createShapePlan(
  font: Font,
  script: string,
  language: string | null,
  direction: "ltr" | "rtl",
  features: ShapeFeature[],
  axisCoords: number[] | null
): ShapePlan
```

### getOrCreateShapePlan()

Get or create a cached shape plan.

```typescript
function getOrCreateShapePlan(
  font: Font,
  script: string,
  language: string | null,
  direction: "ltr" | "rtl",
  userFeatures?: ShapeFeature[],
  axisCoords?: number[] | null
): ShapePlan
```

## Feature Helpers

Convenient functions for common OpenType features.

### Ligatures

```typescript
import { standardLigatures, discretionaryLigatures } from "typeshaper";

const shaped = shape(font, buffer, {
  features: standardLigatures(true) // Enable standard ligatures
});
```

### Small Caps

```typescript
import { smallCaps } from "typeshaper";

const shaped = shape(font, buffer, {
  features: smallCaps(true)
});
```

### Kerning

```typescript
import { kerning } from "typeshaper";

const shaped = shape(font, buffer, {
  features: kerning(false) // Disable kerning
});
```

### Number Styles

```typescript
import { oldstyleFigures, tabularFigures } from "typeshaper";

const shaped = shape(font, buffer, {
  features: [...oldstyleFigures(true), ...tabularFigures(true)]
});
```

### Stylistic Sets

```typescript
import { stylisticSet } from "typeshaper";

const shaped = shape(font, buffer, {
  features: stylisticSet(1, true) // Enable stylistic set 1
});
```

### Combining Features

```typescript
import { combineFeatures, smallCaps, kerning, standardLigatures } from "typeshaper";

const shaped = shape(font, buffer, {
  features: combineFeatures(
    smallCaps(true),
    kerning(true),
    standardLigatures(true)
  )
});
```

## Default Features

The shaper applies these features by default:

**GSUB (Substitution)**
- `ccmp` - Glyph composition/decomposition
- `locl` - Localized forms
- `rlig` - Required ligatures
- `rclt` - Required contextual alternates
- `calt` - Contextual alternates
- `liga` - Standard ligatures

**GPOS (Positioning)**
- `kern` - Kerning
- `mark` - Mark positioning
- `mkmk` - Mark-to-mark positioning

## AAT Morphing

For fonts with Apple Advanced Typography (AAT) tables, the shaper automatically falls back to `morx` if no OpenType layout is present.

```typescript
// Automatically uses morx if available and GSUB/GPOS not present
const shaped = shape(font, buffer);
```

## Fallback Positioning

When GPOS is not available, the shaper applies fallback positioning:

1. **Fallback Kerning** - Uses legacy `kern` table if present
2. **Fallback Mark Positioning** - Uses Unicode combining classes for basic mark attachment

```typescript
import { applyFallbackKerning, applyFallbackMarkPositioning } from "typeshaper";

// These are called automatically when GPOS is not available
// Can also be called manually for custom workflows
applyFallbackKerning(font, infos, positions);
applyFallbackMarkPositioning(font, infos, positions);
```
