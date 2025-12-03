# Complex Scripts

TextShaper provides full support for complex script shaping, including contextual glyph substitution, reordering, and mark positioning required by scripts like Arabic, Devanagari, Thai, and many others.

## Arabic

Arabic requires joining forms based on context (isolated, initial, medial, final):

```typescript
import { Font, UnicodeBuffer, shape, Direction } from "text-shaper";

const font = await Font.fromFile("noto-sans-arabic.ttf");

const buffer = new UnicodeBuffer()
  .addStr("مرحبا")  // "Hello" in Arabic
  .setScript("Arab")
  .setDirection(Direction.RTL);

const result = shape(font, buffer);
```

The Arabic shaper automatically:
1. Applies joining logic to select correct glyph forms
2. Handles contextual substitutions via GSUB
3. Positions marks (diacritics) via GPOS
4. Processes ligatures (lam-alef combinations)

```typescript
// Example with diacritics
const textWithMarks = new UnicodeBuffer()
  .addStr("مَرْحَبًا")  // with vowel marks
  .setScript("Arab")
  .setDirection(Direction.RTL);

const shaped = shape(font, textWithMarks);

// Access shaped glyphs
for (const glyph of shaped.glyphs) {
  console.log(`Glyph ${glyph.id} at position (${glyph.xOffset}, ${glyph.yOffset})`);
}
```

## Hebrew

Hebrew is RTL with combining marks positioned above and below base characters:

```typescript
const buffer = new UnicodeBuffer()
  .addStr("שלום")  // "Shalom"
  .setScript("Hebr")
  .setDirection(Direction.RTL);

const result = shape(font, buffer);
```

## Indic Scripts

Indic scripts (Devanagari, Bengali, Tamil, Telugu, etc.) require complex reordering:

```typescript
// Devanagari
const devanagari = new UnicodeBuffer()
  .addStr("नमस्ते")  // "Namaste"
  .setScript("Deva")
  .setDirection(Direction.LTR);

const result = shape(font, devanagari);

// Bengali
const bengali = new UnicodeBuffer()
  .addStr("হ্যালো")  // "Hello"
  .setScript("Beng")
  .setDirection(Direction.LTR);

// Tamil
const tamil = new UnicodeBuffer()
  .addStr("வணக்கம்")  // "Vanakkam"
  .setScript("Taml")
  .setDirection(Direction.LTR);
```

The Indic shaper handles:
- Syllable clustering
- Vowel and consonant reordering
- Reph and pre-base matra positioning
- Half-form and conjunct substitutions
- Mark positioning (above, below, before, after)

## Thai and Lao

Thai and Lao require vowel and tone mark reordering:

```typescript
const thai = new UnicodeBuffer()
  .addStr("สวัสดี")  // "Hello" in Thai
  .setScript("Thai")
  .setDirection(Direction.LTR);

const lao = new UnicodeBuffer()
  .addStr("ສະບາຍດີ")  // "Hello" in Lao
  .setScript("Laoo")
  .setDirection(Direction.LTR);

const thaiResult = shape(font, thai);
const laoResult = shape(font, lao);
```

## Khmer

Khmer requires complex coeng (subscript) reordering:

```typescript
const khmer = new UnicodeBuffer()
  .addStr("ជំរាបសួរ")  // "Hello" in Khmer
  .setScript("Khmr")
  .setDirection(Direction.LTR);

const result = shape(font, khmer);
```

## Myanmar (Burmese)

Myanmar uses complex kinzi and medial reordering:

```typescript
const myanmar = new UnicodeBuffer()
  .addStr("မင်္ဂလာပါ")  // "Hello" in Burmese
  .setScript("Mymr")
  .setDirection(Direction.LTR);

const result = shape(font, myanmar);
```

## Hangul (Korean)

Hangul characters can be composed from Jamo components:

```typescript
const hangul = new UnicodeBuffer()
  .addStr("안녕하세요")  // "Hello" in Korean
  .setScript("Hang")
  .setDirection(Direction.LTR);

const result = shape(font, hangul);
```

TextShaper normalizes Hangul syllables and applies OpenType features for proper spacing.

## Universal Shaping Engine (USE)

For scripts not covered by specialized shapers, TextShaper uses the Universal Shaping Engine (USE), which supports 40+ scripts:

- Javanese, Balinese, Sundanese
- Tibetan, Mongolian
- New Tai Lue, Tai Tham
- Chakma, Sharada
- And many more

```typescript
const javanese = new UnicodeBuffer()
  .addStr("ꦲꦭꦺꦴ")  // Javanese text
  .setScript("Java")
  .setDirection(Direction.LTR);

const result = shape(font, javanese);
```

USE automatically:
1. Identifies syllable boundaries
2. Reorders characters based on category
3. Applies substitutions and positioning
4. Handles marks and modifiers

## Script Detection

TextShaper can automatically detect scripts:

```typescript
import { detectScript, getScriptRuns, Script } from "text-shaper";

// Detect dominant script
const script = detectScript("مرحبا");
console.log(script);  // Script.Arabic

// Get all script runs in mixed text
const text = "Hello مرحبا שלום";
const runs = getScriptRuns(text);

runs.forEach(run => {
  console.log(`${Script[run.script]}: "${text.slice(run.start, run.end)}"`);
});

// Output:
// Latin: "Hello "
// Arabic: "مرحبا "
// Hebrew: "שלום"
```

## Mixed Direction Text

Handle bidirectional text with explicit direction:

```typescript
import { processBidi, Direction } from "text-shaper";

const mixedText = "Hello עברית مرحبا world";

// Process BiDi algorithm
const bidiResult = processBidi(mixedText);

// Shape each run with correct direction
bidiResult.paragraphs[0].runs.forEach(run => {
  const text = mixedText.slice(run.start, run.end);
  const buffer = new UnicodeBuffer()
    .addStr(text)
    .setDirection(run.direction);

  const shaped = shape(font, buffer);
  // Render shaped output...
});
```

## Complex Features

Access OpenType features explicitly:

```typescript
// Enable specific features
const buffer = new UnicodeBuffer()
  .addStr("مرحبا")
  .setScript("Arab")
  .setDirection(Direction.RTL)
  .addFeature("liga", 1)  // ligatures
  .addFeature("calt", 1)  // contextual alternates
  .addFeature("mset", 1); // mark positioning sets

const result = shape(font, buffer);
```

Common features by script:

Arabic: `init`, `medi`, `fina`, `isol`, `liga`, `calt`, `mset`
Indic: `nukt`, `akhn`, `rphf`, `blwf`, `half`, `pstf`, `vatu`, `cjct`
Thai: `ccmp`, `liga`
Hangul: `ljmo`, `vjmo`, `tjmo`

## Practical Example: Multi-Script Document

```typescript
import { Font, UnicodeBuffer, shape, getScriptRuns, Direction } from "text-shaper";

async function shapeMultiScriptText(text: string, fontPath: string) {
  const font = await Font.fromFile(fontPath);
  const runs = getScriptRuns(text);
  const results = [];

  for (const run of runs) {
    const runText = text.slice(run.start, run.end);

    // Determine direction based on script
    const direction = run.script === Script.Arabic || run.script === Script.Hebrew
      ? Direction.RTL
      : Direction.LTR;

    const buffer = new UnicodeBuffer()
      .addStr(runText)
      .setScript(Script[run.script])
      .setDirection(direction);

    const shaped = shape(font, buffer);
    results.push({ shaped, direction });
  }

  return results;
}

// Usage
const text = "Hello مرحبا नमस्ते";
const results = await shapeMultiScriptText(text, "noto-sans.ttf");
```

## Debugging Complex Shaping

Enable verbose output to understand shaping decisions:

```typescript
// Check which features are applied
const buffer = new UnicodeBuffer()
  .addStr("नमस्ते")
  .setScript("Deva");

const result = shape(font, buffer);

// Inspect glyph clusters
for (let i = 0; i < result.glyphs.length; i++) {
  const glyph = result.glyphs[i];
  const cluster = result.clusters[i];
  console.log(`Cluster ${cluster}: Glyph ${glyph.id} (${glyph.xAdvance}, ${glyph.yAdvance})`);
}
```

## Performance Considerations

- Script detection is fast and cached
- Complex shapers use specialized reordering algorithms optimized for each script
- Shape plan caching makes repeated shaping of the same script/language combination efficient
- For long documents, process text in paragraphs rather than entire document at once
