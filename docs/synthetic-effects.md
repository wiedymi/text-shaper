# Synthetic Font Effects

The `src/raster/synth.ts` module provides functions for applying synthetic transformations to glyph outlines. These are useful when a font doesn't have native bold, italic, or condensed variants.

<script setup>
import { ref } from 'vue'
import FontPicker from './.vitepress/components/FontPicker.vue'
import SyntheticEffects from './.vitepress/components/SyntheticEffects.vue'

const selectedFont = ref(null)
const fontName = ref('')

function handleFontChange({ font, name }) {
  selectedFont.value = font
  fontName.value = name
}
</script>

<FontPicker @font-change="handleFontChange" />
<SyntheticEffects :font="selectedFont" :fontName="fontName" />

## Functions

### `obliquePath(path: GlyphPath, slant: number): GlyphPath`

Applies an oblique (slant/italic) transformation to a path.

**Parameters:**
- `path` - The glyph path to transform
- `slant` - Tangent of the slant angle (0.2 ≈ 12°, typical for italic)

**Transform:**
```
x' = x + y * slant
y' = y
```

**Example:**
```typescript
import { obliquePath } from "./src/raster/synth.ts";

const italicPath = obliquePath(originalPath, 0.2); // ~12° slant
```

### `emboldenPath(path: GlyphPath, strength: number): GlyphPath`

Makes outlines bolder by offsetting contours outward.

**Parameters:**
- `path` - The glyph path to embolden
- `strength` - Offset strength in font units (positive = bolder, negative = thinner)

**Algorithm:**
- Extracts contours from the path
- Flattens curves into line segments
- Offsets each point along the normal direction
- Handles winding order automatically

**Example:**
```typescript
import { emboldenPath } from "./src/raster/synth.ts";

const boldPath = emboldenPath(originalPath, 30); // Offset by 30 font units
```

**Note:** This is a simplified emboldening algorithm. For production-quality results, consider using proper stroke-based emboldening or fonts with native bold variants.

### `condensePath(path: GlyphPath, factor: number): GlyphPath`

Applies horizontal scaling to a path.

**Parameters:**
- `path` - The glyph path to scale
- `factor` - Horizontal scale factor (< 1 = narrower, > 1 = wider)

**Transform:**
```
x' = x * factor
y' = y
```

**Example:**
```typescript
import { condensePath } from "./src/raster/synth.ts";

const condensedPath = condensePath(originalPath, 0.75); // 75% width
const expandedPath = condensePath(originalPath, 1.3);   // 130% width
```

### `transformPath(path: GlyphPath, matrix: [a, b, c, d, e, f]): GlyphPath`

Applies a general 2D affine transformation to a path.

**Parameters:**
- `path` - The glyph path to transform
- `matrix` - 2D transformation matrix `[a, b, c, d, e, f]`

**Transform:**
```
x' = a*x + c*y + e
y' = b*x + d*y + f
```

**Common transformations:**

**Identity (no change):**
```typescript
transformPath(path, [1, 0, 0, 1, 0, 0]);
```

**Translation:**
```typescript
// Translate by (tx, ty)
transformPath(path, [1, 0, 0, 1, tx, ty]);
```

**Scaling:**
```typescript
// Scale by (sx, sy)
transformPath(path, [sx, 0, 0, sy, 0, 0]);
```

**Rotation:**
```typescript
// Rotate by angle θ (counter-clockwise)
const cos = Math.cos(angle);
const sin = Math.sin(angle);
transformPath(path, [cos, sin, -sin, cos, 0, 0]);
```

**Horizontal mirror:**
```typescript
transformPath(path, [-1, 0, 0, 1, width, 0]);
```

**Vertical flip:**
```typescript
transformPath(path, [1, 0, 0, -1, 0, height]);
```

## Composition

Effects can be composed by chaining function calls:

```typescript
import { obliquePath, emboldenPath, condensePath } from "./src/raster/synth.ts";

// Bold Italic
const boldItalic = emboldenPath(obliquePath(path, 0.2), 25);

// Condensed Italic
const condensedItalic = condensePath(obliquePath(path, 0.2), 0.75);

// Custom: Scale, rotate, then translate
const transformed = transformPath(
	transformPath(
		transformPath(path, [2, 0, 0, 2, 0, 0]),     // Scale 2x
		[Math.cos(0.5), Math.sin(0.5), -Math.sin(0.5), Math.cos(0.5), 0, 0]
	),
	[1, 0, 0, 1, 50, 100]  // Translate
);
```

## Practical Use Cases

### Creating a synthetic font family

When a font only has a Regular variant, you can create synthetic variants:

```typescript
const regular = getGlyphPath(font, glyphId);
const italic = obliquePath(regular, 0.2);
const bold = emboldenPath(regular, 30);
const boldItalic = emboldenPath(obliquePath(regular, 0.2), 25);
const condensed = condensePath(regular, 0.75);
const condensedItalic = condensePath(obliquePath(regular, 0.2), 0.75);
```

### Fallback rendering

Use synthetic effects when the requested font style is not available:

```typescript
function getGlyphWithStyle(font, glyphId, style) {
	const path = getGlyphPath(font, glyphId);

	if (style.italic && !font.hasItalicVariant) {
		path = obliquePath(path, 0.2);
	}

	if (style.bold && !font.hasBoldVariant) {
		path = emboldenPath(path, 30);
	}

	if (style.condensed && !font.hasCondensedVariant) {
		path = condensePath(path, 0.75);
	}

	return path;
}
```

### Text effects

Create special text effects for headings, logos, etc:

```typescript
// Perspective effect
const perspective = transformPath(path, [1, 0, 0.2, 1, 0, 0]);

// Squash and stretch
const squashed = transformPath(path, [1.2, 0, 0, 0.8, 0, 0]);

// Mirror for palindromes
const mirrored = transformPath(path, [-1, 0, 0, 1, width, 0]);
```

## Implementation Notes

### Bounds Calculation

All functions update the `bounds` property of the returned path:
- `obliquePath`: Adjusts x bounds based on y values and slant
- `emboldenPath`: Calculates new bounds from transformed points
- `condensePath`: Scales x bounds by the factor
- `transformPath`: Transforms all four corners and finds min/max

### Curve Handling

- `obliquePath`, `condensePath`, and `transformPath` preserve curve types (Q, C)
- `emboldenPath` flattens curves into line segments for simplicity
  - Quadratic curves: 8 steps
  - Cubic curves: 12 steps

### Winding Order

`emboldenPath` automatically detects winding order:
- Counter-clockwise (positive area): positive offset expands
- Clockwise (negative area): offset direction is flipped

## Performance

- `obliquePath`: O(n) where n is the number of commands
- `condensePath`: O(n) where n is the number of commands
- `transformPath`: O(n) where n is the number of commands
- `emboldenPath`: O(m) where m is the number of points after curve flattening

## Limitations

1. **Quality**: Synthetic effects are not as high-quality as native font variants
2. **Emboldening**: The current emboldening algorithm is simplified; it may produce artifacts at sharp corners
3. **Hinting**: Synthetic transformations don't preserve TrueType hinting
4. **Metrics**: Advance widths and side bearings are not automatically adjusted

## Best Practices

1. **Prefer native variants**: Always use native bold/italic/condensed variants when available
2. **Consistent parameters**: Use consistent slant/strength values across a document for visual harmony
3. **Test combinations**: Not all effect combinations work well together
4. **Monitor performance**: Avoid applying effects repeatedly; cache transformed paths when possible
5. **Adjust metrics**: Update advance widths after condensing/expanding

## See Also

- `src/raster/stroker.ts` - Path stroking for outline fonts
- `src/render/path.ts` - Path command types and rendering
- `tests/raster/synth.test.ts` - Comprehensive test suite
- `examples/synthetic-effects.ts` - Usage examples
