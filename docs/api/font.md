# Font API

## Font Class

The `Font` class represents a loaded font file with lazy-loaded tables.

### Static Methods

#### `Font.load(buffer: ArrayBuffer, options?: FontLoadOptions): Font`

Load a font from an ArrayBuffer.

```typescript
const buffer = await fetch("font.ttf").then(r => r.arrayBuffer());
const font = Font.load(buffer);
```

For TrueType Collections (`.ttc`), pass `collectionIndex` to select a subfont.

#### `Font.fromURL(url: string, options?: FontLoadOptions): Promise<Font>`

Load a font from a URL (works in browser and Bun).

```typescript
const font = await Font.fromURL("https://example.com/font.ttf");
```

#### `Font.fromFile(path: string, options?: FontLoadOptions): Promise<Font>`

Load a font from a file path (Bun only).

```typescript
const font = await Font.fromFile("./fonts/font.ttf");
```

#### `Font.collection(buffer: ArrayBuffer): FontCollection | null`

Create a TTC collection helper if the buffer is a TrueType Collection.

```typescript
const buffer = await fetch("fonts.ttc").then(r => r.arrayBuffer());
const collection = Font.collection(buffer);
if (collection) {
  const names = collection.names();
  const font = collection.get(0);
}
```

### FontLoadOptions

```typescript
interface FontLoadOptions {
  /** Tables to parse eagerly (default: lazy) */
  eagerTables?: Tag[];
  /** TTC collection index (default: 0 when loading a TTC) */
  collectionIndex?: number;
}
```

### FontCollection

```typescript
interface CollectionFaceName {
  index: number;
  fullName?: string;
  family?: string;
  subfamily?: string;
  postScriptName?: string;
}

class FontCollection {
  count: number;
  get(index: number, options?: FontLoadOptions): Font;
  names(): CollectionFaceName[];
}
```

### Properties

#### Basic Metrics

- `numGlyphs: number` - Number of glyphs in the font
- `unitsPerEm: number` - Font units per em
- `ascender: number` - Typographic ascender
- `descender: number` - Typographic descender
- `lineGap: number` - Line gap

#### Font Type Checks

- `isTrueType: boolean` - Is this a TrueType font (vs CFF)?
- `isCFF: boolean` - Is this a CFF font?
- `isVariable: boolean` - Is this a variable font?
- `hasOpenTypeLayout: boolean` - Has OpenType layout tables?
- `hasAATLayout: boolean` - Has AAT layout tables?
- `isColorFont: boolean` - Is this a color font?
- `hasHinting: boolean` - Does this font have TrueType hinting?

### Methods

#### Table Access

**`hasTable(tag: Tag): boolean`**

Check if font has a specific table.

```typescript
if (font.hasTable(Tags.GSUB)) {
  // Font has substitution table
}
```

**`getTableRecord(tag: Tag): TableRecord | undefined`**

Get table record metadata.

**`getTableReader(tag: Tag): Reader | null`**

Get a binary reader for a table.

**`listTables(): string[]`**

List all table tags in the font.

```typescript
const tables = font.listTables();
// ["head", "hhea", "maxp", "cmap", "glyf", "loca", ...]
```

#### Character Mapping

**`glyphId(codepoint: number): GlyphId`**

Get glyph ID for a Unicode codepoint.

```typescript
const glyphId = font.glyphId(0x0041); // 'A'
```

**`glyphIdForChar(char: string): GlyphId`**

Get glyph ID for a character.

```typescript
const glyphId = font.glyphIdForChar("A");
```

#### Metrics

**`advanceWidth(glyphId: GlyphId): number`**

Get advance width for a glyph.

**`leftSideBearing(glyphId: GlyphId): number`**

Get left side bearing for a glyph.

#### Outline Access

**`getGlyph(glyphId: GlyphId): Glyph | null`**

Get raw glyph data (TrueType only, returns simple or composite glyph).

**`getGlyphContours(glyphId: GlyphId): Contour[] | null`**

Get flattened contours for a glyph (resolves composites, works for TrueType and CFF).

```typescript
const contours = font.getGlyphContours(glyphId);
if (contours) {
  for (const contour of contours) {
    for (const point of contour) {
      console.log(point.x, point.y, point.onCurve);
    }
  }
}
```

**`getGlyphBounds(glyphId: GlyphId): {xMin, yMin, xMax, yMax} | null`**

Get bounding box for a glyph.

**`getGlyphContoursWithVariation(glyphId: GlyphId, axisCoords: number[]): Contour[] | null`**

Get contours for a glyph with variation applied. Use normalized axis coordinates (-1 to 1).

```typescript
const coords = [0.5, 0]; // wght=500, wdth=default
const contours = font.getGlyphContoursWithVariation(glyphId, coords);
```

### Table Getters

All table getters are lazy-loaded and cached. Returns `null` if table is not present.

#### Required Tables

- `head: HeadTable` - Font header
- `maxp: MaxpTable` - Maximum profile
- `hhea: HheaTable` - Horizontal header
- `hmtx: HmtxTable` - Horizontal metrics
- `cmap: CmapTable` - Character to glyph mapping

#### OpenType Layout Tables

- `gdef: GdefTable | null` - Glyph definition
- `gsub: GsubTable | null` - Glyph substitution
- `gpos: GposTable | null` - Glyph positioning
- `kern: KernTable | null` - Legacy kerning
- `base: BaseTable | null` - Baseline data
- `jstf: JstfTable | null` - Justification
- `math: MathTable | null` - Math typesetting

#### Variable Font Tables

- `fvar: FvarTable | null` - Font variations
- `hvar: HvarTable | null` - Horizontal metrics variations
- `vvar: VvarTable | null` - Vertical metrics variations
- `gvar: GvarTable | null` - Glyph variations
- `avar: AvarTable | null` - Axis variations
- `mvar: MvarTable | null` - Metrics variations
- `stat: StatTable | null` - Style attributes

#### Vertical Layout Tables

- `vhea: VheaTable | null` - Vertical header
- `vmtx: VmtxTable | null` - Vertical metrics
- `vorg: VorgTable | null` - Vertical origin

#### Color Font Tables

- `colr: ColrTable | null` - Color layered glyphs
- `cpal: CpalTable | null` - Color palettes
- `svg: SvgTable | null` - SVG glyphs
- `sbix: SbixTable | null` - Apple bitmap glyphs
- `cbdt: CbdtTable | null` - Google bitmap data
- `cblc: CblcTable | null` - Google bitmap location

#### AAT Tables

- `morx: MorxTable | null` - Extended morphing
- `kerx: KerxTable | null` - Extended kerning
- `trak: TrakTable | null` - Tracking
- `feat: FeatTable | null` - Feature names

#### Outline Tables

- `loca: LocaTable | null` - Glyph location (TrueType)
- `glyf: GlyfTable | null` - Glyph data (TrueType)
- `cff: CffTable | null` - Compact Font Format
- `cff2: Cff2Table | null` - CFF2 (with variations)

#### Hinting Tables

- `fpgm: FpgmTable | null` - Font program
- `prep: PrepTable | null` - Control value program
- `cvtTable: CvtTable | null` - Control value table
- `gasp: GaspTable | null` - Grid-fitting and scan-conversion

#### Other Tables

- `os2: Os2Table | null` - OS/2 and Windows metrics
- `name: NameTable | null` - Naming table
- `post: PostTable | null` - PostScript information

## Face Class

The `Face` class represents a specific instance of a variable font with applied variation settings. For non-variable fonts, it simply wraps the Font.

### Constructor

```typescript
new Face(font: Font, variations?: Record<string, number> | Variation[])
```

Create a face with optional variation settings.

```typescript
const face = new Face(font, { wght: 700, wdth: 100 });
```

### Methods

**`setVariations(variations: Record<string, number> | Variation[]): void`**

Set variation axis values.

```typescript
face.setVariations({ wght: 600, wdth: 75 });
```

**`getAxisValue(axisTag: Tag | string): number | null`**

Get current value for an axis.

```typescript
const weight = face.getAxisValue("wght");
```

**`advanceWidth(glyphId: GlyphId): number`**

Get advance width for a glyph, including HVAR variation deltas.

**`leftSideBearing(glyphId: GlyphId): number`**

Get left side bearing for a glyph, including variation deltas.

### Properties

- `font: Font` - The underlying font
- `normalizedCoords: number[]` - Normalized axis coordinates (-1 to 1)
- `isVariable: boolean` - Whether this is a variable font instance
- `axes: VariationAxis[]` - Available variation axes

### Delegated Properties

These properties delegate to the underlying font:

- `numGlyphs: number`
- `unitsPerEm: number`
- `ascender: number`
- `descender: number`
- `lineGap: number`
- `glyphId(codepoint: number): GlyphId`
- `glyphIdForChar(char: string): GlyphId`
- `hasTable(tag: Tag): boolean`

Table accessors:
- `gdef`, `gsub`, `gpos`, `kern`, `morx`, `cmap`, `hmtx`, `hhea`

### Helper Function

**`createFace(font: Font, variations?: Record<string, number> | Variation[]): Face`**

Create a face from a font with optional variations.

```typescript
const face = createFace(font, { wght: 700 });
```
