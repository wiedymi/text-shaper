# Custom Features

TextShaper provides helper functions for working with OpenType features. Features control typographic behavior like ligatures, kerning, small caps, and stylistic alternates.

## Feature Basics

A feature is represented as:

```typescript
interface ShapeFeature {
  tag: Tag;      // 4-byte OpenType tag
  enabled: boolean;
}
```

Create features using the `feature()` helper:

```typescript
import { feature } from "text-shaper";

const liga = feature("liga");           // enabled by default
const dlig = feature("dlig", true);     // explicitly enabled
const kern = feature("kern", false);    // disabled
```

## Using Features

Pass features to the `shape()` function:

```typescript
import { shape, feature } from "text-shaper";

const result = shape(font, buffer, {
  features: [
    feature("liga", false),  // disable standard ligatures
    feature("dlig"),         // enable discretionary ligatures
    feature("smcp"),         // enable small caps
  ]
});
```

## Feature Helper Functions

TextShaper provides semantic helpers for common features.

### Ligatures

```typescript
import {
  standardLigatures,
  discretionaryLigatures,
  historicalLigatures
} from "text-shaper";

shape(font, buffer, {
  features: [
    standardLigatures(false),    // disable fi, fl, ffi
    discretionaryLigatures(),    // enable ct, st, etc.
    historicalLigatures()        // enable long s ligatures
  ]
});
```

### Small Caps

```typescript
import { smallCaps, capsToSmallCaps, allSmallCaps } from "text-shaper";

// Just lowercase to small caps
shape(font, buffer, {
  features: [smallCaps()]
});

// Just uppercase to small caps
shape(font, buffer, {
  features: [capsToSmallCaps()]
});

// Both (returns array)
shape(font, buffer, {
  features: allSmallCaps()
});
```

### Figure Styles

```typescript
import {
  oldstyleFigures,
  liningFigures,
  tabularFigures,
  proportionalFigures
} from "text-shaper";

// Old-style proportional figures
shape(font, buffer, {
  features: [oldstyleFigures(), proportionalFigures()]
});

// Lining tabular figures (for tables)
shape(font, buffer, {
  features: [liningFigures(), tabularFigures()]
});
```

### Number Formatting

```typescript
import {
  fractions,
  ordinals,
  slashedZero,
  superscript,
  subscript
} from "text-shaper";

// Automatic fractions: 1/2 → ½
shape(font, buffer, {
  features: [fractions()]
});

// Ordinals: 1st → 1ˢᵗ
shape(font, buffer, {
  features: [ordinals()]
});

// Slashed zero: 0 → ⌀
shape(font, buffer, {
  features: [slashedZero()]
});
```

### Stylistic Sets

```typescript
import { stylisticSet, stylisticSets } from "text-shaper";

// Single set
shape(font, buffer, {
  features: [stylisticSet(1)]  // ss01
});

// Multiple sets
shape(font, buffer, {
  features: stylisticSets([1, 3, 5])  // ss01, ss03, ss05
});
```

### Character Variants

```typescript
import { characterVariant, characterVariants } from "text-shaper";

// Single variant
shape(font, buffer, {
  features: [characterVariant(1)]  // cv01
});

// Multiple variants
shape(font, buffer, {
  features: characterVariants([1, 2, 3])  // cv01, cv02, cv03
});
```

### Alternates

```typescript
import {
  contextualAlternates,
  stylisticAlternates,
  swash
} from "text-shaper";

// Contextual alternates (enabled by default)
shape(font, buffer, {
  features: [contextualAlternates(false)]  // disable
});

// Stylistic alternates
shape(font, buffer, {
  features: [stylisticAlternates()]
});

// Swash characters
shape(font, buffer, {
  features: [swash()]
});
```

### Kerning

```typescript
import { kerning } from "text-shaper";

// Disable kerning (enabled by default)
shape(font, buffer, {
  features: [kerning(false)]
});
```

### Case-Sensitive Forms

```typescript
import { caseSensitiveForms, capitalSpacing } from "text-shaper";

// Adjust punctuation for uppercase
shape(font, buffer, {
  features: [caseSensitiveForms()]
});

// Add spacing between capitals
shape(font, buffer, {
  features: [capitalSpacing()]
});
```

### Vertical Layout (CJK)

```typescript
import {
  verticalForms,
  verticalAlternatesRotation,
  verticalKanaAlternates,
  verticalLayoutFeatures
} from "text-shaper";

// All vertical features
shape(font, buffer, {
  direction: "ttb",  // top-to-bottom
  features: verticalLayoutFeatures()
});

// Individual control
shape(font, buffer, {
  direction: "ttb",
  features: [
    verticalForms(),
    verticalAlternatesRotation(),
    verticalKanaAlternates()
  ]
});
```

### CJK Width Forms

```typescript
import {
  halfWidthForms,
  fullWidthForms,
  proportionalWidthForms,
  quarterWidthForms,
  thirdWidthForms
} from "text-shaper";

// Full-width for CJK
shape(font, buffer, {
  features: [fullWidthForms()]
});

// Half-width for Latin in CJK context
shape(font, buffer, {
  features: [halfWidthForms()]
});
```

### CJK Historical Forms

```typescript
import {
  jis78Forms,
  jis83Forms,
  jis90Forms,
  jis2004Forms,
  simplifiedForms,
  traditionalForms
} from "text-shaper";

// Japanese JIS standards
shape(font, buffer, {
  features: [jis2004Forms()]
});

// Chinese variant forms
shape(font, buffer, {
  features: [traditionalForms()]
});
```

### Ruby Notation

```typescript
import { ruby } from "text-shaper";

// Smaller glyphs for ruby annotations
shape(font, buffer, {
  features: [ruby()]
});
```

## Combining Features

Use `combineFeatures()` to merge multiple feature sets:

```typescript
import { combineFeatures, allSmallCaps, oldstyleFigures, feature } from "text-shaper";

shape(font, buffer, {
  features: combineFeatures(
    allSmallCaps(),           // returns array: [smcp, c2sc]
    [oldstyleFigures()],      // wrap single feature in array
    feature("dlig")           // or pass directly
  )
});
```

## Creating Multiple Features

Use `features()` to create multiple features from tag strings:

```typescript
import { features } from "text-shaper";

shape(font, buffer, {
  features: features(["dlig", "swsh", "calt"], true)
  // Equivalent to:
  // [
  //   feature("dlig", true),
  //   feature("swsh", true),
  //   feature("calt", true)
  // ]
});
```

## Complete Example

```typescript
import {
  shape,
  combineFeatures,
  feature,
  allSmallCaps,
  oldstyleFigures,
  discretionaryLigatures,
  kerning
} from "text-shaper";

const result = shape(font, buffer, {
  script: "latn",
  language: null,
  direction: "ltr",
  features: combineFeatures(
    // Disable defaults
    kerning(false),

    // Enable typography features
    allSmallCaps(),
    oldstyleFigures(),
    discretionaryLigatures(),

    // Custom stylistic set
    feature("ss03")
  )
});
```

## Feature Priority

User features override defaults. Features are processed in order:

1. Default features are enabled
2. User features are applied (enabling or disabling)
3. Result is passed to shape plan

```typescript
// liga is enabled by default
shape(font, buffer, {
  features: []  // liga still enabled
});

// Explicitly disable liga
shape(font, buffer, {
  features: [feature("liga", false)]  // liga now disabled
});
```

## Finding Available Features

Not all fonts support all features. To check which features a font supports:

```typescript
const gsub = font.gsub;
const gpos = font.gpos;

// Get script and language
const script = gsub?.scriptList.scripts.find(s =>
  tagToString(s.scriptTag) === "latn"
);
const langSys = script?.script.defaultLangSys;

// Get feature list
const features = langSys?.featureIndices.map(i => {
  const record = gsub.featureList.features[i];
  return tagToString(record.featureTag);
});

console.log("Available features:", features);
```

## Common Feature Tags

| Tag | Name | Description |
|-----|------|-------------|
| `ccmp` | Glyph Composition/Decomposition | Precompose/decompose characters |
| `liga` | Standard Ligatures | fi, fl, ffi, ffl, etc. |
| `dlig` | Discretionary Ligatures | ct, st, etc. |
| `calt` | Contextual Alternates | Context-dependent glyph substitution |
| `kern` | Kerning | Adjust spacing between glyphs |
| `mark` | Mark Positioning | Position diacritics |
| `mkmk` | Mark to Mark | Position combining marks |
| `smcp` | Small Capitals | Lowercase to small caps |
| `c2sc` | Capitals to Small Capitals | Uppercase to small caps |
| `onum` | Oldstyle Figures | 0123456789 with descenders |
| `lnum` | Lining Figures | 0123456789 aligned to baseline |
| `tnum` | Tabular Figures | Fixed-width numbers |
| `pnum` | Proportional Figures | Variable-width numbers |
| `ss01-ss20` | Stylistic Sets | Alternate glyph designs |
| `cv01-cv99` | Character Variants | Per-character alternates |
| `swsh` | Swash | Decorative flourishes |
| `cswh` | Contextual Swash | Context-dependent swash |
| `salt` | Stylistic Alternates | General alternates |
| `frac` | Fractions | Automatic fraction formatting |
| `ordn` | Ordinals | 1st, 2nd, 3rd formatting |
| `zero` | Slashed Zero | Distinguish 0 from O |
| `sups` | Superscript | Raised small glyphs |
| `subs` | Subscript | Lowered small glyphs |
| `case` | Case-Sensitive Forms | Punctuation for uppercase |

For a complete list, see the [OpenType Feature Registry](https://learn.microsoft.com/en-us/typography/opentype/spec/featurelist).

## Feature Interactions

Some features interact or conflict:

- `onum`/`lnum` are mutually exclusive
- `tnum`/`pnum` are mutually exclusive
- `smcp` + `c2sc` = all small caps
- `liga` + `dlig` can be used together
- `calt` may affect other features

Generally, enable only one feature from mutually exclusive groups:

```typescript
// Good
shape(font, buffer, {
  features: [oldstyleFigures(), tabularFigures()]
});

// Bad: conflicting features
shape(font, buffer, {
  features: [
    oldstyleFigures(),
    liningFigures(),  // conflicts with onum
  ]
});
```

## Performance

Enabling more features increases shaping time linearly. For best performance:

- Disable unused default features
- Use shape plan caching (automatic)
- Avoid changing features frequently

```typescript
// Fast: reuses cached shape plan
const plan = { script: "latn", features: [oldstyleFigures()] };
shape(font, buffer1, plan);
shape(font, buffer2, plan);

// Slower: creates new plan each time
shape(font, buffer1, { features: [oldstyleFigures()] });
shape(font, buffer2, { features: [liningFigures()] });
```
