# Variable Fonts

Variable fonts allow a single font file to contain multiple stylistic variations along design axes like weight, width, slant, and optical size.

## Checking for Variable Font Support

```typescript
import { Font } from "text-shaper";

const font = await Font.fromFile("inter-variable.ttf");

if (font.isVariable) {
  console.log("Variable font detected");
  console.log("Axes:", font.fvar?.axes);
}
```

## Available Axes

Each axis has a tag (4-byte identifier) and a value range:

```typescript
// Get all axes
const axes = font.fvar?.axes;

axes?.forEach(axis => {
  console.log(`${axis.tag}: ${axis.minValue} - ${axis.maxValue} (default: ${axis.defaultValue})`);
  console.log(`  Name: ${axis.name}`);
});

// Example output:
// wght: 100 - 900 (default: 400)
//   Name: Weight
// wdth: 75 - 125 (default: 100)
//   Name: Width
```

Common registered axes:
- `wght` - Weight (thin to black)
- `wdth` - Width (condensed to expanded)
- `ital` - Italic
- `slnt` - Slant angle
- `opsz` - Optical size

## Creating Faces with Variations

Use the `Face` class to create an instance with specific axis values:

```typescript
import { Font, Face, tag } from "text-shaper";

const font = await Font.fromFile("variable.ttf");

// Using object notation (simpler)
const boldFace = new Face(font, { wght: 700 });
const boldCondensedFace = new Face(font, { wght: 700, wdth: 75 });

// Using array notation (explicit)
const face = new Face(font, [
  { tag: tag("wght"), value: 700 },
  { tag: tag("wdth"), value: 100 },
  { tag: tag("opsz"), value: 14 }
]);
```

## Shaping with Variable Fonts

```typescript
import { Font, Face, UnicodeBuffer, shape } from "text-shaper";

const font = await Font.fromFile("roboto-flex.ttf");

// Create different weight variations
const lightFace = new Face(font, { wght: 300 });
const regularFace = new Face(font, { wght: 400 });
const boldFace = new Face(font, { wght: 700 });

const buffer = new UnicodeBuffer().addStr("Hello");

// Shape with different weights
const lightResult = shape(lightFace, buffer);
const regularResult = shape(regularFace, buffer);
const boldResult = shape(boldFace, buffer);
```

## Reading Face Properties

```typescript
const face = new Face(font, { wght: 600, wdth: 90 });

// Get all axes
console.log(face.axes);  // VariationAxis[]

// Get normalized coordinates (in range [-1, 1])
console.log(face.normalizedCoords);  // number[]

// Get specific axis value
const weight = face.getAxisValue("wght");  // 600
const width = face.getAxisValue("wdth");   // 90

// Get glyph advance width (includes HVAR delta)
const glyphId = font.cmap.map("H".codePointAt(0));
const advance = face.advanceWidth(glyphId);
```

## Advanced Variations

Variable fonts use HVAR (Horizontal Metrics Variations) and GVAR (Glyph Variations) tables to interpolate metrics and outlines:

```typescript
const font = await Font.fromFile("variable.ttf");

// Check for variation tables
console.log("HVAR:", font.HVAR ? "present" : "absent");
console.log("GVAR:", font.gvar ? "present" : "absent");

// Create face with multiple axes
const face = new Face(font, {
  wght: 650,
  wdth: 95,
  opsz: 18,
  slnt: -5
});

// The face automatically applies:
// 1. HVAR deltas to advance widths
// 2. GVAR deltas to glyph outlines
// 3. Axis normalization to [-1, 1] range

const glyphId = font.cmap.map("g".codePointAt(0));
const advance = face.advanceWidth(glyphId);  // adjusted by HVAR
```

## Practical Example: Dynamic Typography

```typescript
import { Font, Face, UnicodeBuffer, shape } from "text-shaper";

const font = await Font.fromFile("inter-variable.ttf");

// Function to shape text at different weights
function shapeAtWeight(text: string, weight: number) {
  const face = new Face(font, { wght: weight });
  const buffer = new UnicodeBuffer().addStr(text);
  return shape(face, buffer);
}

// Generate headings at different weights
const heading1 = shapeAtWeight("Main Title", 800);
const heading2 = shapeAtWeight("Subtitle", 600);
const body = shapeAtWeight("Body text", 400);

// Responsive typography: adjust weight based on size
function getOptimalWeight(fontSize: number): number {
  // Lighter weights for larger sizes
  if (fontSize >= 48) return 500;
  if (fontSize >= 24) return 600;
  return 400;
}

const dynamicFace = new Face(font, {
  wght: getOptimalWeight(72),
  opsz: 72  // optical size matches font size
});
```

## Animation Example

```typescript
// Animate weight from 300 to 800
async function animateWeight(text: string, duration: number) {
  const font = await Font.fromFile("variable.ttf");
  const buffer = new UnicodeBuffer().addStr(text);

  const startWeight = 300;
  const endWeight = 800;
  const steps = 60;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const weight = startWeight + (endWeight - startWeight) * t;

    const face = new Face(font, { wght: weight });
    const result = shape(face, buffer);

    // Render result...
    await Bun.sleep(duration / steps);
  }
}
```

## Performance Notes

- Creating a `Face` is lightweight - it only stores axis values and calculates normalized coordinates
- Shaping caches lookups, so repeated shaping with the same face is fast
- HVAR/GVAR interpolation happens on-demand during glyph metric and outline queries
- Reuse `Face` instances when possible to benefit from internal caching
