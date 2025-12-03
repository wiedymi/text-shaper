# Font Tables Reference

This document provides a brief overview of major OpenType and AAT font tables supported by TypeShaper.

## Required Tables

### HeadTable

Font header containing basic metadata.

**Key Fields:**
- `unitsPerEm: number` - Font design units per em
- `flags: number` - Font flags
- `created: Date` - Creation date
- `modified: Date` - Last modified date
- `xMin, yMin, xMax, yMax: number` - Font bounding box
- `indexToLocFormat: number` - Format of loca table (0 or 1)

### MaxpTable

Maximum profile defining resource limits.

**Key Fields:**
- `numGlyphs: number` - Number of glyphs in the font
- `maxPoints: number` - Max points in non-composite glyph
- `maxContours: number` - Max contours in non-composite glyph

### HheaTable

Horizontal header with typographic metrics.

**Key Fields:**
- `ascender: number` - Typographic ascender
- `descender: number` - Typographic descender
- `lineGap: number` - Line gap
- `advanceWidthMax: number` - Maximum advance width
- `numberOfHMetrics: number` - Number of hMetric entries

### HmtxTable

Horizontal metrics for each glyph.

**Access via:**
```typescript
const advance = font.advanceWidth(glyphId);
const lsb = font.leftSideBearing(glyphId);
```

### CmapTable

Character to glyph mapping.

**Access via:**
```typescript
const glyphId = font.glyphId(0x0041); // Unicode codepoint
const glyphId = font.glyphIdForChar("A"); // Character
```

## OpenType Layout Tables

### GdefTable

Glyph definition table classifying glyphs.

**Glyph Classes:**
- Base - Base character
- Ligature - Ligature glyph
- Mark - Non-spacing mark
- Component - Component of ligature

**Features:**
- Glyph class definitions
- Attachment points
- Ligature caret positions
- Mark attachment classes

### GsubTable

Glyph substitution table for character-to-glyph transformations.

**Lookup Types:**
1. Single - One-to-one substitution
2. Multiple - One-to-many substitution
3. Alternate - One-to-one from alternatives
4. Ligature - Many-to-one substitution
5. Context - Context-dependent substitution
6. Chaining Context - Extended context substitution
7. Extension - Extension mechanism
8. Reverse Chaining - Right-to-left substitution

**Common Features:**
- `liga` - Standard ligatures (fi, fl)
- `calt` - Contextual alternates
- `ccmp` - Glyph composition/decomposition
- `smcp` - Small capitals
- `swsh` - Swash forms

### GposTable

Glyph positioning table for layout adjustments.

**Lookup Types:**
1. Single - Adjust single glyph position
2. Pair - Adjust glyph pair (kerning)
3. Cursive - Cursive attachment
4. MarkToBase - Attach mark to base
5. MarkToLigature - Attach mark to ligature
6. MarkToMark - Attach mark to mark
7. Context - Context-dependent positioning
8. Chaining Context - Extended context positioning
9. Extension - Extension mechanism

**Common Features:**
- `kern` - Kerning
- `mark` - Mark positioning
- `mkmk` - Mark-to-mark positioning
- `curs` - Cursive attachment

### KernTable

Legacy kerning table (pre-OpenType).

**Access via:**
```typescript
import { getKernValue } from "typeshaper";

const kern = getKernValue(font.kern, glyph1, glyph2);
```

## Variable Font Tables

### FvarTable

Font variations defining variation axes.

**Key Fields:**
- `axes: VariationAxis[]` - List of variation axes
- `instances: NamedInstance[]` - Named instances

**VariationAxis:**
```typescript
interface VariationAxis {
  tag: Tag;           // Axis tag (e.g., 'wght', 'wdth')
  minValue: number;   // Minimum value
  defaultValue: number; // Default value
  maxValue: number;   // Maximum value
  name: string;       // Axis name
}
```

### GvarTable

Glyph variations for outline adjustments.

**Usage:**
```typescript
const contours = font.getGlyphContoursWithVariation(glyphId, normalizedCoords);
```

### HvarTable

Horizontal metrics variations.

**Features:**
- Advance width deltas
- Left side bearing deltas

**Access via Face:**
```typescript
const face = new Face(font, { wght: 700 });
const advance = face.advanceWidth(glyphId); // Includes HVAR delta
```

### AvarTable

Axis variations for non-linear axis mappings.

Maps user coordinates to normalized coordinates for each axis.

### MvarTable

Metrics variations for font-wide metrics.

**Supported Metrics:**
- Ascender, Descender
- Line gap
- Cap height, x-height
- Subscript/superscript metrics

## Vertical Layout Tables

### VheaTable

Vertical header (vertical writing systems).

**Key Fields:**
- `ascender: number` - Vertical ascender
- `descender: number` - Vertical descender
- `lineGap: number` - Vertical line gap
- `numberOfVMetrics: number` - Number of vMetric entries

### VmtxTable

Vertical metrics for each glyph.

### VorgTable

Vertical origin for CJK fonts.

## Color Font Tables

### ColrTable

Color layered glyphs (COLRv0 and COLRv1).

**Features:**
- Simple color layers (v0)
- Gradient fills (v1)
- Transformations (v1)
- Compositing modes (v1)

**Access:**
```typescript
import { hasColorGlyph, getColorLayers } from "typeshaper";

if (hasColorGlyph(font.colr, glyphId)) {
  const layers = getColorLayers(font.colr, glyphId);
}
```

### CpalTable

Color palettes for COLR table.

**Access:**
```typescript
import { getColor } from "typeshaper";

const color = getColor(font.cpal, paletteIndex, colorIndex);
// Returns { red, green, blue, alpha }
```

### SvgTable

SVG glyphs embedded in font.

**Access:**
```typescript
import { hasSvgGlyph, getSvgDocument } from "typeshaper";

if (hasSvgGlyph(font.svg, glyphId)) {
  const svg = getSvgDocument(font.svg, glyphId);
}
```

### SbixTable

Apple bitmap glyphs with alpha channel.

**Features:**
- PNG, JPEG, TIFF formats
- Multiple PPEM sizes
- Dupe glyph handling

**Access:**
```typescript
import { hasGlyphBitmap, getSbixGlyphBitmap } from "typeshaper";

const bitmap = getSbixGlyphBitmap(font.sbix, glyphId, ppem);
```

### CBDT/CBLC Tables

Google color bitmap format.

**Features:**
- Multiple bitmap formats
- Embedded bitmaps at various sizes

## AAT Tables

### MorxTable

Extended morphing (Apple Advanced Typography).

**Subtable Types:**
- Rearrangement - Reorder glyphs
- Contextual - Context-dependent substitution
- Ligature - Ligature formation
- Non-contextual - Simple substitution
- Insertion - Insert glyphs

**Usage:**
```typescript
// Automatically applied if GSUB not present
const shaped = shape(font, buffer);
```

### KerxTable

Extended kerning (AAT).

**Features:**
- Format 0: Ordered list of kerning pairs
- Format 1: State table kerning
- Format 2: Simple kern array
- Format 4: Control point kerning
- Format 6: Simple index kerning

### TrakTable

Tracking (letter spacing) adjustments.

**Access:**
```typescript
import { applyTracking } from "typeshaper";

const adjustment = applyTracking(font.trak, pointSize, tracking);
```

### FeatTable

Feature names for AAT features.

**Usage:**
```typescript
import { getAllFeatures, getFeature } from "typeshaper";

const features = getAllFeatures(font.feat);
```

## Outline Tables

### LocaTable

Glyph location table for TrueType outlines.

Maps glyph IDs to offsets in the glyf table.

### GlyfTable

Glyph data for TrueType outlines.

**Glyph Types:**
- Simple - Single contour
- Composite - Multiple component glyphs

**Access:**
```typescript
const contours = font.getGlyphContours(glyphId);
const bounds = font.getGlyphBounds(glyphId);
```

### CFF / CFF2 Tables

Compact Font Format (PostScript outlines).

- CFF - Static fonts
- CFF2 - Variable fonts

**Access:**
```typescript
const contours = font.getGlyphContours(glyphId); // Works for both CFF and TrueType
```

## Hinting Tables

### FpgmTable

Font program executed once per font.

### PrepTable

Control value program executed once per size.

### CvtTable

Control value table with values used by instructions.

### GaspTable

Grid-fitting and scan-conversion procedure.

Defines which size ranges use hinting vs. smoothing.

## Other Tables

### Os2Table

OS/2 and Windows metrics.

**Key Fields:**
- Weight class
- Width class
- Type flags
- Strikeout/underline metrics
- Unicode ranges
- Code page ranges

### NameTable

Naming table with human-readable strings.

**Name IDs:**
- 0: Copyright
- 1: Font family
- 2: Subfamily
- 4: Full name
- 6: PostScript name
- 16: Typographic family
- 17: Typographic subfamily

### PostTable

PostScript information.

**Features:**
- Glyph names
- Italic angle
- Underline metrics
- Fixed pitch flag

### StatTable

Style attributes for variable fonts.

**Features:**
- Axis records
- Axis values
- Elidable axis value names

**Usage:**
```typescript
import { getAxisRecord, matchAxisValue } from "typeshaper";

const axis = getAxisRecord(font.stat, 0);
```

## Table Access Pattern

All tables use lazy loading:

```typescript
// Table is parsed on first access
const gdef = font.gdef; // Parses GDEF table

// Subsequent accesses use cached value
const gdef2 = font.gdef; // Returns cached table

// Check for table presence
if (font.hasTable(Tags.GSUB)) {
  const gsub = font.gsub;
}
```
