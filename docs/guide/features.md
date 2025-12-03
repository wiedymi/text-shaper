# OpenType Features

OpenType features control typographic refinements like ligatures, kerning, small caps, and more. TextShaper provides helper functions for common features and a flexible API for custom feature tags.

## Applying Features

Pass features to the `shape()` function:

```typescript
import { Font, shape, UnicodeBuffer, feature } from "text-shaper";

const font = await Font.fromFile("font.ttf");
const buffer = new UnicodeBuffer().addStr("Hello");

const result = shape(font, buffer, {
	features: [
		feature("liga"),  // Standard ligatures
		feature("kern"),  // Kerning
	]
});
```

## Feature Helpers

TextShaper provides helper functions for common OpenType features:

### Ligatures

```typescript
import {
	standardLigatures,
	discretionaryLigatures,
	historicalLigatures,
	contextualAlternates
} from "text-shaper";

const result = shape(font, buffer, {
	features: [
		standardLigatures(),        // liga: fi, fl
		discretionaryLigatures(),   // dlig: ct, st
		historicalLigatures(),      // hlig
		contextualAlternates(),     // calt
	]
});
```

### Small Caps

```typescript
import {
	smallCaps,
	capsToSmallCaps,
	petiteCaps,
	allSmallCaps
} from "text-shaper";

const result = shape(font, buffer, {
	features: [
		smallCaps(),          // smcp: lowercase to small caps
		capsToSmallCaps(),    // c2sc: uppercase to small caps
		petiteCaps(),         // pcap: petite caps
		allSmallCaps(),       // smcp + c2sc
	]
});
```

### Number Styles

```typescript
import {
	oldstyleFigures,
	liningFigures,
	proportionalFigures,
	tabularFigures
} from "text-shaper";

const result = shape(font, buffer, {
	features: [
		oldstyleFigures(),         // onum: 0123
		liningFigures(),           // lnum: 0123
		proportionalFigures(),     // pnum
		tabularFigures(),          // tnum
	]
});
```

### Stylistic Alternates

```typescript
import {
	stylisticAlternates,
	stylisticSet,
	characterVariant,
	swash
} from "text-shaper";

const result = shape(font, buffer, {
	features: [
		stylisticAlternates(),     // salt
		stylisticSet(1),           // ss01
		stylisticSet(2),           // ss02
		characterVariant(1),       // cv01
		swash(),                   // swsh
	]
});
```

### Positioning

```typescript
import {
	superscript,
	subscript,
	scientificInferiors
} from "text-shaper";

const result = shape(font, buffer, {
	features: [
		superscript(),             // sups: H²O
		subscript(),               // subs: H₂O
		scientificInferiors(),     // sinf
	]
});
```

### Fractions

```typescript
import { fractions, ordinals, slashedZero } from "text-shaper";

const result = shape(font, buffer, {
	features: [
		fractions(),               // frac: 1/2 → ½
		ordinals(),                // ordn: 1st, 2nd
		slashedZero(),             // zero: 0 with slash
	]
});
```

### Kerning

```typescript
import { kerning } from "text-shaper";

const result = shape(font, buffer, {
	features: [
		kerning(),                 // kern: adjust spacing
	]
});
```

### Case-Sensitive Forms

```typescript
import { caseSensitiveForms, capitalSpacing } from "text-shaper";

const result = shape(font, buffer, {
	features: [
		caseSensitiveForms(),      // case: adjust punctuation for caps
		capitalSpacing(),          // cpsp: add spacing in all caps
	]
});
```

## CJK Features

### Japanese Forms

```typescript
import {
	jis78Forms,
	jis83Forms,
	jis90Forms,
	jis2004Forms
} from "text-shaper";

const result = shape(font, buffer, {
	features: [
		jis78Forms(),              // jp78
		jis83Forms(),              // jp83
		jis90Forms(),              // jp90
		jis2004Forms(),            // jp04
	]
});
```

### Chinese Forms

```typescript
import { simplifiedForms, traditionalForms } from "text-shaper";

const result = shape(font, buffer, {
	features: [
		simplifiedForms(),         // smpl
		traditionalForms(),        // trad
	]
});
```

### Width Variants

```typescript
import {
	halfWidthForms,
	fullWidthForms,
	proportionalWidthForms,
	quarterWidthForms
} from "text-shaper";

const result = shape(font, buffer, {
	features: [
		halfWidthForms(),          // hwid
		fullWidthForms(),          // fwid
		proportionalWidthForms(),  // pwid
		quarterWidthForms(),       // qwid
	]
});
```

### Vertical Layout

```typescript
import {
	verticalForms,
	verticalAlternatesRotation,
	verticalKanaAlternates,
	verticalLayoutFeatures
} from "text-shaper";

const result = shape(font, buffer, {
	features: [
		verticalForms(),                  // vert
		verticalAlternatesRotation(),     // vrt2
		verticalKanaAlternates(),         // vkna
		verticalLayoutFeatures(),         // all vertical features
	]
});
```

### Ruby

```typescript
import { ruby } from "text-shaper";

const result = shape(font, buffer, {
	features: [
		ruby(),                    // ruby: ruby characters
	]
});
```

## Custom Features

Use the `feature()` function for any OpenType feature tag:

```typescript
import { feature } from "text-shaper";

const result = shape(font, buffer, {
	features: [
		feature("liga"),           // Enable liga
		feature("dlig", true),     // Explicitly enable dlig
		feature("kern", false),    // Disable kern
	]
});
```

## Combining Features

Combine multiple features using the `combineFeatures()` helper or by passing an array:

```typescript
import {
	standardLigatures,
	kerning,
	oldstyleFigures,
	smallCaps,
	combineFeatures
} from "text-shaper";

// Using array
const result = shape(font, buffer, {
	features: [
		standardLigatures(),
		kerning(),
		oldstyleFigures(),
		smallCaps(),
	]
});

// Using combineFeatures
const myFeatures = combineFeatures([
	standardLigatures(),
	kerning(),
	oldstyleFigures(),
]);

const result2 = shape(font, buffer, {
	features: myFeatures
});
```

## Feature Sets

Create reusable feature sets for consistent typography:

```typescript
import {
	standardLigatures,
	kerning,
	contextualAlternates
} from "text-shaper";

// Default text features
const defaultFeatures = [
	standardLigatures(),
	kerning(),
	contextualAlternates(),
];

// Heading features
const headingFeatures = [
	kerning(),
	capitalSpacing(),
	caseSensitiveForms(),
];

// Number features
const numberFeatures = [
	tabularFigures(),
	liningFigures(),
	slashedZero(),
];

// Apply to different text
const bodyResult = shape(font, bodyBuffer, { features: defaultFeatures });
const headingResult = shape(font, headingBuffer, { features: headingFeatures });
const numberResult = shape(font, numberBuffer, { features: numberFeatures });
```

## Feature Values

Some features accept numeric values:

```typescript
import { stylisticSet, characterVariant } from "text-shaper";

const result = shape(font, buffer, {
	features: [
		stylisticSet(1),       // ss01
		stylisticSet(5),       // ss05
		characterVariant(3),   // cv03
	]
});
```

## Checking Available Features

Check which features a font supports:

```typescript
const font = await Font.fromFile("font.ttf");

// Check if font has GSUB or GPOS tables
const hasGSUB = font.hasTable("GSUB");
const hasGPOS = font.hasTable("GPOS");

console.log(`Font supports substitution: ${hasGSUB}`);
console.log(`Font supports positioning: ${hasGPOS}`);
```

## Complete Example

```typescript
import {
	Font,
	shape,
	UnicodeBuffer,
	standardLigatures,
	discretionaryLigatures,
	kerning,
	oldstyleFigures,
	smallCaps
} from "text-shaper";

const font = await Font.fromFile("font.ttf");

const buffer = new UnicodeBuffer()
	.addStr("The Office: 1234")
	.setScript("Latn")
	.setLanguage("en");

const result = shape(font, buffer, {
	features: [
		standardLigatures(),      // fi, fl ligatures
		discretionaryLigatures(), // ct, st ligatures
		kerning(),                // spacing adjustments
		oldstyleFigures(),        // old-style numbers
		smallCaps(),              // small caps
	]
});

// Render glyphs
for (let i = 0; i < result.length; i++) {
	const info = result.infos[i];
	const pos = result.positions[i];

	console.log(`Glyph ${info.glyphId}: advance ${pos.xAdvance}`);
}
```
