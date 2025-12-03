# Unicode

TextShaper provides comprehensive Unicode support following Unicode Standard algorithms for bidirectional text, normalization, line breaking, and text segmentation.

## Bidirectional Text (UAX #9)

The BiDi algorithm handles mixed left-to-right and right-to-left text:

```typescript
import { processBidi, detectDirection, BidiType } from "text-shaper";

const text = "Hello עברית مرحبا world";

// Process bidirectional text
const result = processBidi(text);

// Result contains paragraphs with level information
result.paragraphs.forEach(para => {
  console.log(`Paragraph direction: ${para.direction}`);
  console.log(`Levels: ${para.levels}`);
});

// Detect overall direction
const direction = detectDirection(text);
console.log(direction);  // "ltr" or "rtl"
```

### Reordering Glyphs

After shaping, reorder glyphs for visual display:

```typescript
import { processBidi, reorderGlyphs } from "text-shaper";

const text = "Hello עברית";
const bidiResult = processBidi(text);

// Shape each run...
const glyphs = [...]; // shaped glyphs

// Reorder for visual display
const reordered = reorderGlyphs(glyphs, bidiResult.paragraphs[0].levels);
```

### BiDi Types

Check character bidirectional types:

```typescript
import { getBidiType, BidiType } from "text-shaper";

const type = getBidiType("A".codePointAt(0));
console.log(type === BidiType.L);  // true (Left-to-Right)

const arabicType = getBidiType("م".codePointAt(0));
console.log(arabicType === BidiType.AL);  // true (Arabic Letter)
```

Common BiDi types:
- `L` - Left-to-Right (Latin, etc.)
- `R` - Right-to-Left (Hebrew)
- `AL` - Arabic Letter
- `EN` - European Number
- `AN` - Arabic Number
- `WS` - Whitespace
- `ON` - Other Neutral

## Text Normalization

Unicode normalization ensures equivalent representations:

```typescript
import { normalize, decompose, compose, NormalizationMode } from "text-shaper";

const text = "café";  // é can be single char or e + combining accent

// Normalize to NFD (canonical decomposition)
const nfd = normalize(text.split("").map(c => c.codePointAt(0)), NormalizationMode.NFD);

// Normalize to NFC (canonical composition)
const nfc = normalize(text.split("").map(c => c.codePointAt(0)), NormalizationMode.NFC);

// NFKD (compatibility decomposition)
const nfkd = normalize(codepoints, NormalizationMode.NFKD);

// NFKC (compatibility composition)
const nfkc = normalize(codepoints, NormalizationMode.NFKC);
```

### Decomposition

```typescript
import { decompose, getCombiningClass } from "text-shaper";

// Decompose a character
const decomposed = decompose(0x00E9);  // é
console.log(decomposed);  // [0x0065, 0x0301] (e + combining acute)

// Get combining class
const combiningClass = getCombiningClass(0x0301);
console.log(combiningClass);  // 230 (above)
```

Combining classes determine stacking order:
- 0 - Base character
- 1-9 - Overlays and nuktas
- 200-234 - Below base
- 240 - Above base

## Line Breaking (UAX #14)

Analyze line break opportunities:

```typescript
import { analyzeLineBreaks, findNextBreak, canBreakAt, LineBreakClass } from "text-shaper";

const text = "Hello world! This is a test.";

// Analyze all break opportunities
const analysis = analyzeLineBreaks(text);

// Check if break is allowed at position
const canBreak = canBreakAt(analysis, 5);
console.log(canBreak);  // true (after "Hello")

// Find next break point
const nextBreak = findNextBreak(analysis, 0);
console.log(nextBreak);  // 5
```

### Line Breaking Classes

```typescript
import { getLineBreakClass, LineBreakClass } from "text-shaper";

const char = "A".codePointAt(0);
const lbClass = getLineBreakClass(char);

console.log(lbClass === LineBreakClass.AL);  // true (Alphabetic)
```

Common line break classes:
- `AL` - Alphabetic
- `BA` - Break After
- `BB` - Break Before
- `CM` - Combining Mark
- `CL` - Close Punctuation
- `EX` - Exclamation/Interrogation
- `GL` - Non-breaking Glue
- `OP` - Open Punctuation
- `SP` - Space
- `ZW` - Zero Width Space

### Practical Line Breaking

```typescript
import { analyzeLineBreaks, findNextBreak } from "text-shaper";

function wrapText(text: string, maxWidth: number, measureFunc: (text: string) => number) {
  const analysis = analyzeLineBreaks(text);
  const lines = [];
  let start = 0;

  while (start < text.length) {
    let end = start;
    let lastBreak = start;

    // Find longest substring that fits
    while (end < text.length) {
      const nextBreak = findNextBreak(analysis, end);
      if (nextBreak === -1) break;

      const substr = text.slice(start, nextBreak);
      const width = measureFunc(substr);

      if (width > maxWidth && lastBreak > start) {
        break;
      }

      lastBreak = nextBreak;
      end = nextBreak;

      if (width > maxWidth) break;
    }

    lines.push(text.slice(start, lastBreak));
    start = lastBreak;
  }

  return lines;
}
```

## Text Segmentation (UAX #29)

### Grapheme Clusters

Grapheme clusters are user-perceived characters:

```typescript
import { splitGraphemes, countGraphemes, findGraphemeBoundaries } from "text-shaper";

const text = "👨‍👩‍👧‍👦";  // family emoji (single grapheme, multiple codepoints)

// Split into grapheme clusters
const graphemes = splitGraphemes(text);
console.log(graphemes.length);  // 1

// Count graphemes
const count = countGraphemes(text);
console.log(count);  // 1

// Find boundaries
const boundaries = findGraphemeBoundaries(text);
console.log(boundaries);  // [0, text.length]
```

Examples of grapheme clusters:
- Base + combining marks: `e` + `◌́` = `é`
- Emoji sequences: `👨‍👩‍👧‍👦` (family)
- Hangul syllables: `각` (U+AC01)
- Regional indicators: `🇺🇸` (US flag)

### Word Segmentation

```typescript
import { splitWords, findWordBoundaries } from "text-shaper";

const text = "Hello, world! How are you?";

// Split into words
const words = splitWords(text);
console.log(words);
// ["Hello", ",", " ", "world", "!", " ", "How", " ", "are", " ", "you", "?"]

// Find word boundaries
const boundaries = findWordBoundaries(text);
console.log(boundaries);  // [0, 5, 6, 7, 12, 13, 14, 17, 18, 21, 22, 25, 26]
```

### Sentence Segmentation

```typescript
import { splitSentences, findSentenceBoundaries } from "text-shaper";

const text = "Hello world. How are you? I'm fine.";

// Split into sentences
const sentences = splitSentences(text);
console.log(sentences);
// ["Hello world. ", "How are you? ", "I'm fine."]

// Find sentence boundaries
const boundaries = findSentenceBoundaries(text);
console.log(boundaries);  // [0, 13, 26, 36]
```

## Script Detection

Identify scripts used in text:

```typescript
import { detectScript, getScriptRuns, Script, isComplexScript } from "text-shaper";

// Detect dominant script
const script = detectScript("Hello");
console.log(Script[script]);  // "Latin"

// Get all script runs
const text = "Hello עברית مرحبا";
const runs = getScriptRuns(text);

runs.forEach(run => {
  const scriptName = Script[run.script];
  const substr = text.slice(run.start, run.end);
  console.log(`${scriptName}: "${substr}"`);
});

// Check if script is complex (requires special shaping)
const isComplex = isComplexScript(Script.Arabic);
console.log(isComplex);  // true
```

### Script Enum

```typescript
console.log(Script.Latin);      // 0
console.log(Script.Arabic);     // 1
console.log(Script.Hebrew);     // 2
console.log(Script.Devanagari); // 3
console.log(Script.Thai);       // 4
// ... and many more
```

## Character Properties

### General Category

```typescript
import { getGeneralCategory, GeneralCategory } from "text-shaper";

const category = getGeneralCategory("A".codePointAt(0));
console.log(category === GeneralCategory.Lu);  // true (uppercase letter)
```

Categories:
- `Lu` - Uppercase Letter
- `Ll` - Lowercase Letter
- `Lt` - Titlecase Letter
- `Lm` - Modifier Letter
- `Lo` - Other Letter
- `Mn` - Nonspacing Mark
- `Mc` - Spacing Mark
- `Nd` - Decimal Number
- `Ps` - Open Punctuation
- `Pe` - Close Punctuation

### Case Conversion

```typescript
import { toUpperCase, toLowerCase, toTitleCase } from "text-shaper";

const upper = toUpperCase("hello".split("").map(c => c.codePointAt(0)));
const lower = toLowerCase("HELLO".split("").map(c => c.codePointAt(0)));
const title = toTitleCase("hello world".split("").map(c => c.codePointAt(0)));
```

## Practical Example: Text Analysis

```typescript
import {
  splitGraphemes,
  splitWords,
  splitSentences,
  getScriptRuns,
  detectDirection,
  analyzeLineBreaks,
  Script
} from "text-shaper";

function analyzeText(text: string) {
  return {
    graphemeCount: splitGraphemes(text).length,
    wordCount: splitWords(text).filter(w => /\w/.test(w)).length,
    sentenceCount: splitSentences(text).length,
    direction: detectDirection(text),
    scripts: getScriptRuns(text).map(run => ({
      script: Script[run.script],
      text: text.slice(run.start, run.end)
    })),
    breakOpportunities: analyzeLineBreaks(text).filter(b => b).length
  };
}

const text = "Hello world! مرحبا بك. 123 test.";
const analysis = analyzeText(text);
console.log(JSON.stringify(analysis, null, 2));
```

## Performance Tips

- Use segmentation functions instead of regex for Unicode-aware operations
- Cache script detection results for repeated operations
- Process text in chunks for large documents
- BiDi processing is fast but can be skipped for pure LTR text
- Normalization is expensive - only apply when necessary (e.g., before comparison)
