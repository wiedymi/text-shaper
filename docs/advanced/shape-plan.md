# Shape Plans

A shape plan is a pre-computed collection of GSUB and GPOS lookups that will be applied during text shaping. Shape plans are cached and reused for identical shaping configurations.

## What is a Shape Plan?

```typescript
interface ShapePlan {
  script: Tag;
  language: Tag | null;
  direction: "ltr" | "rtl";

  // GSUB lookups to apply, in order
  gsubLookups: Array<{ index: number; lookup: AnyGsubLookup }>;

  // GPOS lookups to apply, in order
  gposLookups: Array<{ index: number; lookup: AnyGposLookup }>;
}
```

A shape plan answers: "Given this script, language, text direction, and set of features, which lookups should be applied and in what order?"

## How Shape Plans are Created

Shape plans are created during the `shape()` call:

```typescript
import { shape } from "text-shaper";

const result = shape(font, buffer, {
  script: "arab",
  language: "ARA",
  direction: "rtl",
  features: [
    { tag: tag("liga"), enabled: true },
    { tag: tag("kern"), enabled: false }
  ]
});
```

Internally:

1. Look up the script in GSUB/GPOS script list
2. Find the language system (or use default)
3. Collect enabled features (defaults + user overrides)
4. For each enabled feature, collect its lookup indices
5. Resolve lookups from the lookup list
6. Handle feature variations for variable fonts
7. Return plan with ordered lookups

## Default Features

### GSUB (Substitution)

```typescript
const DEFAULT_GSUB_FEATURES = [
  "ccmp", // Glyph composition/decomposition
  "locl", // Localized forms
  "rlig", // Required ligatures
  "rclt", // Required contextual alternates
  "calt", // Contextual alternates
  "liga", // Standard ligatures
];
```

### GPOS (Positioning)

```typescript
const DEFAULT_GPOS_FEATURES = [
  "kern", // Kerning
  "mark", // Mark positioning
  "mkmk", // Mark-to-mark positioning
];
```

## Customizing Features

Disable default features:

```typescript
import { shape, feature } from "text-shaper";

shape(font, buffer, {
  features: [
    feature("liga", false),  // disable ligatures
    feature("kern", false),  // disable kerning
  ]
});
```

Enable non-default features:

```typescript
shape(font, buffer, {
  features: [
    feature("dlig"),  // discretionary ligatures
    feature("smcp"),  // small caps
    feature("ss01"),  // stylistic set 1
  ]
});
```

Combine both:

```typescript
shape(font, buffer, {
  features: [
    feature("liga", false),  // disable standard ligatures
    feature("dlig"),         // enable discretionary ligatures
    feature("smcp"),         // enable small caps
  ]
});
```

## Shape Plan Caching

Shape plans are expensive to compute but can be reused. TextShaper caches plans per font using a combination of:

- Script
- Language
- Direction
- Feature set
- Variable font axis coordinates (if applicable)

```typescript
// First call: creates and caches plan
const result1 = shape(font, buffer1, { script: "latn" });

// Second call: reuses cached plan (same font, script, features)
const result2 = shape(font, buffer2, { script: "latn" });
```

Cache key format:

```
"latn|null|ltr|liga:1,kern:1|"
 ^^^^  ^^   ^^^  ^^^^^^^^^^^  ^^
 │     │    │    │            └─ axis coords (if variable font)
 │     │    │    └─ features (sorted)
 │     │    └─ direction
 │     └─ language (null = default)
 └─ script
```

### Cache Size and Eviction

- Cache is per-font (using `WeakMap`)
- Maximum 64 plans per font
- LRU eviction: oldest plan removed when cache is full
- Cache is garbage collected when font is no longer referenced

## Feature Variations (Variable Fonts)

For variable fonts, shape plans can vary based on axis coordinates. Feature variations allow different lookups at different coordinates.

```typescript
const face = new Face(font);
face.setVariations({ wght: 700 }); // Bold

const result = shape(face, buffer, { script: "latn" });
```

When feature variations are present:

1. Find matching condition for current axis coordinates
2. Substitute feature's lookup list with alternate lookups
3. Cache plan with axis coordinates in the key

Example: A font might use different kerning lookups at bold weights.

## Manual Plan Creation

You can create plans manually without caching:

```typescript
import { createShapePlan } from "text-shaper/shaper/shape-plan";

const plan = createShapePlan(
  font,
  "latn",     // script
  null,       // language (null = default)
  "ltr",      // direction
  [           // features
    { tag: tag("liga"), enabled: true },
    { tag: tag("kern"), enabled: true }
  ],
  null        // axis coords (null = no variation)
);

// plan.gsubLookups and plan.gposLookups contain the lookups
```

## Inspecting Shape Plans

```typescript
const plan = createShapePlan(font, "arab", "ARA", "rtl");

console.log("Script:", tagToString(plan.script));
console.log("Language:", plan.language ? tagToString(plan.language) : "default");
console.log("Direction:", plan.direction);
console.log("GSUB lookups:", plan.gsubLookups.length);
console.log("GPOS lookups:", plan.gposLookups.length);

for (const { index, lookup } of plan.gsubLookups) {
  console.log(`  Lookup ${index}: type ${lookup.type}, ${lookup.subtables.length} subtables`);
}
```

## Feature Order

Features are applied in the order they appear in the font's feature list, not in the order specified by the user. User features only enable or disable features, they don't reorder them.

```typescript
// Features will be applied in font's order, not this order
shape(font, buffer, {
  features: [
    feature("kern"),
    feature("liga"),
    feature("calt")
  ]
});
```

To see the order, inspect the shape plan:

```typescript
const plan = createShapePlan(font, "latn", null, "ltr", features);
for (const { index, lookup } of plan.gsubLookups) {
  // Lookups are in application order
  console.log(`Lookup ${index}`);
}
```

## Script and Language Selection

### Script Fallback

If the requested script is not found, TextShaper tries:

1. Requested script (e.g., "arab")
2. "DFLT" script
3. "latn" script

```typescript
// If font doesn't have "khmr" script
shape(font, buffer, { script: "khmr" });
// Falls back to DFLT or latn
```

### Language Fallback

If the requested language is not found under the script:

```typescript
// If script exists but language "KHM" doesn't
shape(font, buffer, { script: "khmr", language: "KHM" });
// Uses script's default language system
```

## Performance Tips

1. **Reuse shape plans**: Same script/language/features = cached plan
2. **Minimize feature changes**: Each unique feature set creates a new plan
3. **Use Face for variable fonts**: Axis coordinates are part of cache key
4. **Avoid per-glyph feature changes**: Not supported, use separate shape calls

Good:

```typescript
// Single plan, cached
for (const paragraph of paragraphs) {
  shape(font, paragraph, { script: "latn" });
}
```

Bad:

```typescript
// New plan for each paragraph
for (const paragraph of paragraphs) {
  shape(font, paragraph, {
    script: "latn",
    features: [feature("ss01", Math.random() > 0.5)]
  });
}
```

## Debugging Shape Plans

Enable verbose logging to see which lookups are applied:

```typescript
const plan = createShapePlan(font, "arab", null, "rtl");

console.log("GSUB lookups:");
for (const { index, lookup } of plan.gsubLookups) {
  const features = getLookupsFeatures(font.gsub, index);
  console.log(`  ${index}: ${lookup.type} (features: ${features.join(", ")})`);
}
```

Compare against expected features:

```typescript
const expectedFeatures = ["ccmp", "locl", "isol", "fina", "medi", "init", "rlig", "liga"];
const actualFeatures = new Set(
  plan.gsubLookups.flatMap(({ index }) => getLookupsFeatures(font.gsub, index))
);

for (const feat of expectedFeatures) {
  if (!actualFeatures.has(feat)) {
    console.warn(`Missing feature: ${feat}`);
  }
}
```
