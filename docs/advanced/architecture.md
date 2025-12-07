# Architecture

TextShaper follows a modular pipeline architecture that transforms Unicode codepoints into positioned glyphs ready for rendering.

## Shaping Pipeline

The core shaping process flows through these stages:

```
UnicodeBuffer (input text)
    ↓
shape() function
    ├→ Convert codepoints to glyph IDs (font.glyphId())
    ├→ preShape() [Script-specific preprocessing]
    │   ├→ setupArabicMasks() / setupIndicMasks() / setupUseMasks()
    │   └→ reorderIndic() / reorderThaiLao() etc.
    ├→ createShapePlan() [Collect GSUB/GPOS lookups]
    ├→ applyGsub() [Substitutions: ligatures, contextual]
    ├→ initializePositions() [Set advance widths]
    ├→ applyGpos() [Positioning: kerning, marks]
    │   └→ Fallback: applyFallbackKerning(), applyFallbackMarkPositioning()
    ├→ applyMorx() [AAT if no GSUB]
    └→ Reverse for RTL
    ↓
GlyphBuffer (output glyphs + positions)
```

## Design Principles

### 1. Lazy Table Parsing

Font tables are only parsed when accessed. This reduces memory usage and improves startup time.

```typescript
class Font {
  private _gsub: GsubTable | null | undefined = undefined;

  get gsub(): GsubTable | null {
    if (this._gsub === undefined) {
      this._gsub = this.parseGsub();
    }
    return this._gsub;
  }
}
```

### 2. Zero-Copy Binary Reading

The `Reader` class uses `DataView` slices that share the underlying `ArrayBuffer`, avoiding unnecessary copies.

```typescript
class Reader {
  slice(offset: number, length: number): Reader {
    // Returns new Reader with same buffer, different view
    return new Reader(this.buffer, this.baseOffset + offset);
  }
}
```

### 3. Big-Endian Data

All font data follows the OpenType specification and is stored in big-endian format. The `Reader` class handles endianness conversion automatically.

```typescript
readUint16(): number {
  const value = this.view.getUint16(this.offset, false); // false = big-endian
  this.offset += 2;
  return value;
}
```

### 4. Shape Plan Caching

Shape plans are computed once per font/script/language/features combination and cached for reuse.

```typescript
const plan = getOrCreateShapePlan(font, script, language, direction, features);
// Subsequent calls with same parameters return cached plan
```

See [Shape Plans](./shape-plan.md) for details.

### 5. Fallback Graceful Degradation

When GPOS tables are unavailable, the shaper falls back to:
- `kern` table for kerning
- Unicode combining classes for mark positioning

```typescript
const hasGpos = font.gpos !== null && plan.gposLookups.length > 0;
if (hasGpos) {
  applyGpos(font, glyphBuffer, plan);
} else {
  applyFallbackKerning(font, glyphBuffer.infos, glyphBuffer.positions);
  applyFallbackMarkPositioning(font, glyphBuffer.infos, glyphBuffer.positions);
}
```

## Module Structure

### Font Module (`src/font/`)

Handles font file parsing and table access.

```
font/
  binary/
    reader.ts          # DataView-based binary parser
  tables/
    head.ts, maxp.ts   # Metadata tables
    cmap.ts            # Unicode to glyph mapping
    glyf.ts, cff.ts    # Glyph outlines
    gsub.ts, gpos.ts   # Layout tables
    gvar.ts, fvar.ts   # Variable font tables
  font.ts              # Main Font class
  face.ts              # Variable font instance
```

### Buffer Module (`src/buffer/`)

Manages input and output glyph sequences.

```typescript
// Input
class UnicodeBuffer {
  codepoints: number[];
  clusters: number[];
  script?: string;
  language?: string;
}

// Output
class GlyphBuffer {
  infos: GlyphInfo[];     // glyphId, cluster, mask
  positions: GlyphPosition[]; // xAdvance, yAdvance, xOffset, yOffset
}
```

### Layout Module (`src/layout/`)

OpenType layout data structures shared by GSUB and GPOS.

```
layout/
  structures/
    coverage.ts        # Glyph coverage tables
    class-def.ts       # Glyph class definitions
    feature-variations.ts  # Variable font feature variations
```

### Shaper Module (`src/shaper/`)

The core shaping engine and complex script shapers.

```
shaper/
  shaper.ts            # Main shape() function
  shape-plan.ts        # Lookup collection and caching
  features.ts          # Feature helper functions
  fallback.ts          # Kern and mark fallbacks
  complex/
    arabic.ts          # Arabic joining
    indic.ts           # Devanagari, Bengali, etc.
    hangul.ts          # Korean Jamo normalization
    use.ts             # Universal Shaping Engine
```

### Unicode Module (`src/unicode/`)

Unicode property lookups and BiDi analysis.

```
unicode/
  script.ts            # Script detection
  bidi.ts              # Bidirectional algorithm
  properties.ts        # General categories, combining classes
```

### Raster Module (`src/raster/`)

TrueType hinting and rasterization.

```
raster/
  outline/
    decompose.ts       # Glyph outline decomposition
  hinting/
    interpreter.ts     # TrueType instruction interpreter
  rasterizer.ts        # Scanline rasterizer
  blur.ts, cascade-blur.ts  # Blur algorithms
  sdf.ts, msdf.ts      # Signed distance field rendering
  atlas.ts             # Texture atlas generation
  stroker.ts           # Path stroking
```

### Fluent Module (`src/fluent/`)

Ergonomic API for composing transforms and rendering operations.

```
fluent/
  path-builder.ts      # PathBuilder class with lazy transforms
  bitmap-builder.ts    # BitmapBuilder class for raster effects
  pipe.ts              # Functional pipe utilities and operators
  types.ts             # TransformState, RasterOptions, etc.
  index.ts             # Entry points (glyph, char, path, bitmap, combine)
```

The fluent module provides two composition styles:

1. **Builder pattern**: Method chaining with `PathBuilder` and `BitmapBuilder`
2. **Pipe pattern**: Functional composition with curried operators

```typescript
// Builder style
const rgba = glyph(font, glyphId)
  ?.scale(2)
  .rasterizeAuto()
  .blur(5)
  .toRGBA();

// Pipe style
const rgba = pipe(
  getGlyphPath(font, glyphId),
  $scale(2),
  $rasterizeAuto(),
  $blur(5),
  $toRGBA
);
```

**Design decisions:**
- Transforms are lazy (accumulated as matrices) until `.apply()` or rendering
- Path effects (embolden, stroke) are eager and force transform application
- Bitmap operations are always eager (applied immediately)
- All methods return new instances (immutable)

## Type System

Core types defined in `src/types.ts`:

```typescript
// 4-byte OpenType tag
type Tag = number & { __tag: true };

// Glyph identifier
type GlyphId = number & { __glyphId: true };

// Glyph information
interface GlyphInfo {
  glyphId: GlyphId;
  cluster: number;    // Index into original text
  mask: number;       // Feature mask
  codepoint: number;  // Original Unicode codepoint
}

// Glyph positioning
interface GlyphPosition {
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
}
```

## Complex Script Support

TextShaper implements dedicated shapers for complex scripts that require reordering and contextual analysis:

| Script | Implementation |
|--------|---------------|
| Arabic | Joining type analysis, init/medi/fina/isol forms |
| Hebrew | RTL with combining marks |
| Indic | Syllable analysis, vowel reordering (Devanagari, Bengali, etc.) |
| Thai/Lao | Leading vowel reordering |
| Khmer | Subscript consonants, pre-base vowels |
| Myanmar | Medial consonants, pre-base vowels, stacking |
| Hangul | Jamo sequence normalization |
| USE | Universal Shaping Engine for 40+ scripts |

Each shaper follows a three-step pattern:

1. **Setup masks**: Mark glyph types (base, mark, etc.)
2. **Reorder**: Move glyphs to logical order for GSUB
3. **Apply features**: Use script-specific GSUB/GPOS features

## Variable Font Support

Variable fonts are handled through the `Face` class, which wraps a `Font` with specific axis coordinates.

```typescript
const face = new Face(font);
face.setVariations({ wght: 700, wdth: 125 });

// Uses variable metrics (HVAR/VVAR) and glyph deltas (gvar)
const result = shape(face, buffer);
```

Internally:
- Axis coordinates are normalized using `fvar` axis ranges
- Feature variations select alternate lookups via `FeatureVariations`
- Metric deltas applied from `HVAR`/`VVAR` tables
- Glyph outline deltas applied from `gvar` table

## AAT Layout Support

For Apple Advanced Typography fonts (primarily used on macOS), TextShaper supports `morx` table substitutions when GSUB is unavailable:

- Type 0: Rearrangement (glyph reordering)
- Type 1: Contextual (context-dependent substitution)
- Type 2: Ligature
- Type 4: Non-contextual (simple substitution)
- Type 5: Insertion

## Performance Characteristics

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Font loading | O(1) | Lazy parsing, only parses table directory |
| Table access | O(1) | Parsed on first access, cached |
| Shape plan creation | O(n * m) | n = features, m = lookups per feature |
| Shape plan cache lookup | O(1) | WeakMap + string key |
| GSUB application | O(n * l) | n = glyphs, l = lookups |
| GPOS application | O(n * l) | n = glyphs, l = lookups |
| Complex script preprocessing | O(n) | n = glyphs |

Typical shaping performance: 10,000-100,000 glyphs/second depending on script complexity and feature count.
