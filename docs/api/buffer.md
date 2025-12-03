# Buffer API

## UnicodeBuffer

Input buffer for text to be shaped. Holds Unicode codepoints with associated properties.

### Constructor

```typescript
const buffer = new UnicodeBuffer();
```

### Methods

#### Adding Text

**`addStr(text: string, startCluster?: number): this`**

Add a string to the buffer.

```typescript
buffer.addStr("Hello World");
```

**`addCodepoints(codepoints: number[], startCluster?: number): this`**

Add codepoints directly.

```typescript
buffer.addCodepoints([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
```

**`addCodepoint(codepoint: number, cluster?: number): this`**

Add a single codepoint.

```typescript
buffer.addCodepoint(0x0041); // 'A'
```

#### Configuration

**`setDirection(direction: Direction): this`**

Set text direction.

```typescript
import { Direction } from "typeshaper";

buffer.setDirection(Direction.RTL); // Right-to-left
buffer.setDirection(Direction.LTR); // Left-to-right (default)
```

**`setScript(script: string): this`**

Set script (ISO 15924 tag, e.g., 'Latn', 'Arab').

```typescript
buffer.setScript("arab");
```

**`setLanguage(language: string | null): this`**

Set language (BCP 47 tag, e.g., 'en', 'ar').

```typescript
buffer.setLanguage("en");
```

**`setClusterLevel(level: ClusterLevel): this`**

Set cluster level for glyph-character mapping.

```typescript
import { ClusterLevel } from "typeshaper";

buffer.setClusterLevel(ClusterLevel.MonotoneGraphemes);
```

**`setFlags(flags: BufferFlags): this`**

Set buffer flags.

```typescript
import { BufferFlags } from "typeshaper";

buffer.setFlags(BufferFlags.BeginningOfText | BufferFlags.EndOfText);
```

**`setPreContext(text: string): this`**

Set pre-context string (text before the buffer for contextual shaping).

```typescript
buffer.setPreContext("pre");
```

**`setPostContext(text: string): this`**

Set post-context string (text after the buffer for contextual shaping).

```typescript
buffer.setPostContext("post");
```

#### Buffer Management

**`clear(): this`**

Clear the buffer.

```typescript
buffer.clear();
```

**`toGlyphInfos(): GlyphInfo[]`**

Convert to initial glyph infos (internal use).

### Properties

- `codepoints: number[]` - Codepoints to shape
- `clusters: number[]` - Cluster indices
- `preContext: number[]` - Pre-context codepoints
- `postContext: number[]` - Post-context codepoints
- `length: number` - Number of codepoints
- `direction: Direction` - Text direction
- `script: string` - Script tag
- `language: string | null` - Language tag
- `clusterLevel: ClusterLevel` - Cluster level
- `flags: BufferFlags` - Buffer flags

### Enums

**Direction**

```typescript
enum Direction {
  Invalid = 0,
  LTR = 4,      // Left-to-right
  RTL = 5,      // Right-to-left
  TTB = 6,      // Top-to-bottom
  BTT = 7       // Bottom-to-top
}
```

**ClusterLevel**

```typescript
enum ClusterLevel {
  MonotoneGraphemes = 0,
  MonotoneCharacters = 1,
  Characters = 2
}
```

**BufferFlags**

```typescript
enum BufferFlags {
  Default = 0x0,
  BeginningOfText = 0x1,
  EndOfText = 0x2,
  PreserveDefaultIgnorables = 0x4,
  RemoveDefaultIgnorables = 0x8,
  DoNotInsertDottedCircle = 0x10
}
```

## GlyphBuffer

Output buffer containing shaped glyphs. Result of the shaping process.

### Static Methods

**`GlyphBuffer.withCapacity(capacity: number): GlyphBuffer`**

Create buffer with pre-allocated capacity.

```typescript
const buffer = GlyphBuffer.withCapacity(100);
```

### Properties

- `infos: GlyphInfo[]` - Glyph information array
- `positions: GlyphPosition[]` - Glyph position array
- `direction: Direction` - Direction used during shaping
- `script: string` - Script used during shaping
- `language: string | null` - Language used during shaping
- `length: number` - Number of glyphs

### Methods

#### Buffer Initialization

**`initFromInfos(infos: GlyphInfo[]): void`**

Initialize from glyph infos (positions zeroed).

#### Glyph Manipulation

**`setAdvance(index: number, xAdvance: number, yAdvance?: number): void`**

Set advance width for a glyph.

**`addOffset(index: number, xOffset: number, yOffset: number): void`**

Add offset to a glyph position.

**`replaceGlyph(index: number, glyphId: GlyphId): void`**

Replace glyph at index.

**`insertGlyph(index: number, info: GlyphInfo, position: GlyphPosition): void`**

Insert glyph at index.

**`removeRange(start: number, end: number): void`**

Remove glyphs in range [start, end).

**`mergeClusters(start: number, end: number): void`**

Merge clusters from start to end (inclusive).

#### Buffer Transformation

**`reverse(): void`**

Reverse glyph order (for RTL).

**`reverseRange(start: number, end: number): void`**

Reverse range [start, end).

#### Output

**`getTotalAdvance(): {x: number, y: number}`**

Get total advance width and height.

```typescript
const advance = buffer.getTotalAdvance();
console.log(`Width: ${advance.x}, Height: ${advance.y}`);
```

**`serialize(): string`**

Serialize to HarfBuzz-compatible format.

```typescript
const str = buffer.serialize();
// "[65=0+640|66=1+600|67=2+580]"
```

**`glyphIds(): GlyphId[]`**

Get glyph IDs as array.

**`clusters(): number[]`**

Get clusters as array.

#### Iteration

The buffer is iterable:

```typescript
for (const { info, position } of buffer) {
  console.log(info.glyphId, position.xAdvance);
}
```

### Types

**GlyphInfo**

```typescript
interface GlyphInfo {
  glyphId: GlyphId;
  cluster: number;
  mask: number;
  codepoint: number; // Original Unicode codepoint
}
```

**GlyphPosition**

```typescript
interface GlyphPosition {
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
}
```
