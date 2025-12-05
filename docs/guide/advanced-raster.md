# Advanced Rasterization

Beyond basic bitmap rasterization, TextShaper provides advanced features for GPU rendering, synthetic effects, and bitmap post-processing.

## Signed Distance Fields (SDF)

Signed distance fields enable smooth GPU text rendering at any scale. Instead of storing binary coverage, each pixel stores the signed distance to the nearest outline edge. Values are normalized to 0-255, where 128 represents the edge, values above are inside, and values below are outside.

GPU shaders can sample this distance field with anti-aliasing at any scale, unlike traditional bitmaps which become pixelated when scaled.

```typescript
import { Font, getGlyphPath, renderSdf, PixelMode } from "text-shaper";

const font = await Font.fromFile("font.ttf");
const glyphId = font.cmap.map("A".codePointAt(0));
const path = getGlyphPath(font, glyphId);

// Render as signed distance field
const sdf = renderSdf(path, {
  width: 64,
  height: 64,
  scale: 0.05,      // Font units to pixels
  spread: 8,        // Distance range in pixels
  offsetX: 8,
  offsetY: 56,
  flipY: true,
});

// Use sdf.buffer for GPU texture upload
// In shader: smoothstep(0.45, 0.55, texture(sdf, uv).r)
```

The `spread` parameter controls the distance range. A spread of 8 means:
- 0 = 8 pixels outside the outline
- 128 = on the outline edge
- 255 = 8 pixels inside the outline

Larger spread values provide smoother gradients but require larger textures.

## Synthetic Effects

Create fake bold, italic, and condensed variants when native font styles are unavailable.

### Fake Italic (Oblique)

```typescript
import { getGlyphPath, obliquePath, rasterizePath } from "text-shaper";

const path = getGlyphPath(font, glyphId);

// Apply slant transformation
const italic = obliquePath(path, 0.2); // 0.2 = ~12 degrees (typical italic)

// Rasterize the slanted path
const bitmap = rasterizePath(italic, {
  width: 64,
  height: 64,
  scale: fontSize / font.unitsPerEm,
  offsetX: 8,
  offsetY: 56,
  flipY: true,
});
```

### Fake Bold (Emboldening)

```typescript
import { emboldenPath } from "text-shaper";

const path = getGlyphPath(font, glyphId);

// Make path bolder by offsetting outline
const bold = emboldenPath(path, 20); // Strength in font units

const bitmap = rasterizePath(bold, {
  width: 64,
  height: 64,
  scale: fontSize / font.unitsPerEm,
  offsetX: 8,
  offsetY: 56,
  flipY: true,
});
```

The emboldening algorithm flattens bezier curves to polygons and offsets them outward. For production use with curves preserved, use the stroker.

### Condensed/Extended

```typescript
import { condensePath } from "text-shaper";

const path = getGlyphPath(font, glyphId);

// Horizontal scaling
const narrow = condensePath(path, 0.8);  // 80% width
const wide = condensePath(path, 1.2);    // 120% width
```

### Combining Effects

```typescript
// Bold italic
const boldItalic = obliquePath(emboldenPath(path, 20), 0.2);

// Condensed italic
const condensedItalic = obliquePath(condensePath(path, 0.85), 0.18);
```

## Path Stroking

Convert outlines into stroked paths for outlined text effects.

```typescript
import { strokePath, rasterizePath } from "text-shaper";

const path = getGlyphPath(font, glyphId);

// Create stroked outline
const stroked = strokePath(path, {
  width: 10,          // Stroke width in font units
  lineCap: "round",   // "butt" | "round" | "square"
  lineJoin: "round",  // "miter" | "round" | "bevel"
  miterLimit: 4,      // Miter limit for sharp corners
});

// Rasterize the stroked path
const bitmap = rasterizePath(stroked, {
  width: 64,
  height: 64,
  scale: fontSize / font.unitsPerEm,
  offsetX: 8,
  offsetY: 56,
  flipY: true,
});
```

Line cap styles:
- `butt` - Flat cap at endpoints (default)
- `round` - Semicircular cap at endpoints
- `square` - Square cap extending half the stroke width

Line join styles:
- `miter` - Sharp corner (limited by miterLimit)
- `round` - Rounded corner
- `bevel` - Beveled corner

## Bitmap Manipulation

Post-process bitmaps after rasterization.

### Emboldening Bitmaps

```typescript
import { rasterizeGlyph, emboldenBitmap } from "text-shaper";

const result = rasterizeGlyph(font, glyphId, 48, {
  pixelMode: PixelMode.Gray,
});

if (result) {
  // Make bitmap bolder by dilation
  const bolder = emboldenBitmap(result.bitmap, 1, 1); // xStrength, yStrength

  // Higher strength = bolder
  const extraBold = emboldenBitmap(result.bitmap, 2, 2);
}
```

Emboldening spreads pixel coverage by taking the maximum value in a neighborhood. Use small values (1-2) for subtle effects.

### Bitmap Format Conversion

```typescript
import { convertBitmap, PixelMode } from "text-shaper";

// Grayscale to monochrome (thresholded at 128)
const mono = convertBitmap(grayBitmap, PixelMode.Mono);

// Monochrome to grayscale
const gray = convertBitmap(monoBitmap, PixelMode.Gray);

// Grayscale to LCD subpixel
const lcd = convertBitmap(grayBitmap, PixelMode.LCD);
```

### Bitmap Blending

```typescript
import { blendBitmap, createBitmap, PixelMode } from "text-shaper";

// Create background bitmap
const background = createBitmap(128, 128, PixelMode.Gray);

// Rasterize some glyphs
const glyph1 = rasterizeGlyph(font, glyphId1, 48);
const glyph2 = rasterizeGlyph(font, glyphId2, 48);

if (glyph1 && glyph2) {
  // Blend glyphs onto background
  blendBitmap(background, glyph1.bitmap, 10, 50, 1.0);   // Full opacity
  blendBitmap(background, glyph2.bitmap, 60, 50, 0.5);   // 50% opacity
}
```

Blending uses additive alpha blending for grayscale bitmaps.

### Other Bitmap Operations

```typescript
import { copyBitmap, resizeBitmap } from "text-shaper";

// Deep copy
const copy = copyBitmap(bitmap);

// Resize using nearest-neighbor interpolation
const resized = resizeBitmap(bitmap, 128, 128);
```

## Blur Effects

Post-process bitmaps with blur for effects like glow and soft shadows.

```typescript
import { rasterizeGlyph, blurBitmap, copyBitmap, blendBitmap } from "text-shaper";

// Rasterize glyph
const result = rasterizeGlyph(font, glyphId, 48);

if (result) {
  // Create glow effect
  const glow = copyBitmap(result.bitmap);
  blurBitmap(glow, 8, "gaussian"); // Soft blur

  // Composite: glow behind original
  blendBitmap(output, glow, x - 4, y - 4, 0.5);      // Offset glow
  blendBitmap(output, result.bitmap, x, y, 1.0);     // Sharp text on top
}
```

### Gaussian vs Box Blur

- **Gaussian**: Smooth, natural falloff. Best for shadows and glow effects.
- **Box**: Uniform averaging, faster. Good for motion blur or when speed matters.

```typescript
import { blurBitmap } from "text-shaper";

// Gaussian blur - smooth and natural
blurBitmap(bitmap, 5, "gaussian");

// Box blur - faster but less smooth
blurBitmap(bitmap, 5, "box");
```

The blur radius controls the spread. Higher values create softer, more diffuse effects but require more computation.

## Gradient Text

Fill glyphs with gradients instead of solid colors.

```typescript
import { getGlyphPath, rasterizePathWithGradient } from "text-shaper";

const path = getGlyphPath(font, glyphId);

// Rainbow gradient
const gradient = {
  type: "linear",
  x0: 0,
  y0: 0,
  x1: 100,
  y1: 0,
  stops: [
    { offset: 0.0, color: [255, 0, 0, 255] },   // Red
    { offset: 0.5, color: [0, 255, 0, 255] },   // Green
    { offset: 1.0, color: [0, 0, 255, 255] },   // Blue
  ],
};

const bitmap = rasterizePathWithGradient(path, gradient, {
  width: 100,
  height: 100,
  scale: 0.1,
  offsetX: 10,
  offsetY: 80,
});
```

### Radial Gradient

```typescript
const radial = {
  type: "radial",
  cx: 50,
  cy: 50,
  radius: 50,
  stops: [
    { offset: 0, color: [255, 255, 255, 255] }, // White center
    { offset: 1, color: [0, 0, 0, 0] },         // Transparent edge
  ],
};

const bitmap = rasterizePathWithGradient(path, radial, {
  width: 100,
  height: 100,
  scale: 0.1,
  offsetX: 10,
  offsetY: 80,
});
```

Gradient coordinates are in pixel space relative to the bitmap. Color stops define the gradient transition, with offset values from 0.0 to 1.0.

## Exact Bounding Boxes

Standard bounding boxes only consider control points, which can overestimate the actual glyph bounds. Exact bounds include bezier curve extrema for tighter bounds.

```typescript
import { getGlyphPath, getExactBounds } from "text-shaper";

const path = getGlyphPath(font, glyphId);

// Approximate bounds (from control points)
const approxBounds = path.bounds;

// Exact bounds (includes curve extrema)
const exactBounds = getExactBounds(path);

if (approxBounds && exactBounds) {
  console.log("Approximate:", approxBounds);
  // { xMin: 100, yMin: 0, xMax: 900, yMax: 700 }

  console.log("Exact:", exactBounds);
  // { xMin: 120, yMin: 10, xMax: 880, yMax: 680 }

  // Exact bounds are often smaller, saving memory
  const approxArea = (approxBounds.xMax - approxBounds.xMin) *
                     (approxBounds.yMax - approxBounds.yMin);
  const exactArea = (exactBounds.xMax - exactBounds.xMin) *
                    (exactBounds.yMax - exactBounds.yMin);

  console.log(`Area reduction: ${((1 - exactArea / approxArea) * 100).toFixed(1)}%`);
}
```

Use exact bounds when:
- Allocating rasterization buffers (saves memory)
- Computing tight bounding rectangles for hit testing
- Optimizing atlas packing

The algorithm solves for parameter t where the bezier derivative equals zero, then evaluates the curve at those extrema points.

## Practical Examples

### Outlined Text Effect

```typescript
import { getGlyphPath, strokePath, rasterizePath, PixelMode } from "text-shaper";

const path = getGlyphPath(font, glyphId);
const scale = fontSize / font.unitsPerEm;

// Create outline
const outline = strokePath(path, {
  width: 30,
  lineCap: "round",
  lineJoin: "round",
});

// Rasterize outline
const outlineBitmap = rasterizePath(outline, {
  width: 80,
  height: 80,
  scale,
  offsetX: 10,
  offsetY: 70,
  flipY: true,
  pixelMode: PixelMode.Gray,
});

// Rasterize fill
const fillBitmap = rasterizePath(path, {
  width: 80,
  height: 80,
  scale,
  offsetX: 10,
  offsetY: 70,
  flipY: true,
  pixelMode: PixelMode.Gray,
});

// Composite: outline as border, fill on top
```

### GPU SDF Text Rendering

```typescript
import { Font, shape, UnicodeBuffer, getGlyphPath, renderSdf } from "text-shaper";

const font = await Font.fromFile("font.ttf");
const buffer = new UnicodeBuffer().addStr("Hello");
const shaped = shape(font, buffer);

// Generate SDF atlas
const sdfAtlas = new Map();
const atlasSize = 512;
const glyphSize = 64;
const cols = Math.floor(atlasSize / glyphSize);

for (let i = 0; i < shaped.length; i++) {
  const glyphId = shaped.infos[i].glyphId;

  if (!sdfAtlas.has(glyphId)) {
    const path = getGlyphPath(font, glyphId);
    const sdf = renderSdf(path, {
      width: glyphSize,
      height: glyphSize,
      scale: glyphSize / font.unitsPerEm,
      spread: 8,
      offsetX: 8,
      offsetY: glyphSize - 8,
      flipY: true,
    });

    sdfAtlas.set(glyphId, sdf);
  }
}

// Upload to GPU texture and render with SDF shader
```

### Bold Weight Adjustment

```typescript
import { rasterizeGlyph, emboldenBitmap, PixelMode } from "text-shaper";

function rasterizeWithWeight(
  font: Font,
  glyphId: number,
  fontSize: number,
  weight: number, // 100-900
): Bitmap | null {
  // Base rasterization
  const result = rasterizeGlyph(font, glyphId, fontSize, {
    pixelMode: PixelMode.Gray,
  });

  if (!result) return null;

  // Apply emboldening based on weight
  // 400 = normal (no change)
  // 700 = bold (strength ~2)
  const strength = Math.max(0, (weight - 400) / 150);

  if (strength > 0) {
    return emboldenBitmap(result.bitmap, strength, strength);
  }

  return result.bitmap;
}

const normalBitmap = rasterizeWithWeight(font, glyphId, 48, 400);
const boldBitmap = rasterizeWithWeight(font, glyphId, 48, 700);
```

## Performance Considerations

- SDF rendering is slower than regular rasterization but produces resolution-independent results
- Cache SDF textures and reuse them at different scales
- Synthetic effects (oblique, embolden) modify paths before rasterization for best quality
- Bitmap emboldening is fast but lower quality than path emboldening
- Use exact bounds for atlas packing to maximize texture utilization
- Stroking is expensive - cache stroked paths when possible

## Next Steps

- See [Rasterization](./rasterization.md) for basic rasterization and atlas building
- See [Rendering](./rendering.md) for vector path rendering to SVG/Canvas
- See [Variable Fonts](./variable-fonts.md) for combining synthetic effects with variable fonts
