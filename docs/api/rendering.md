# Rendering API

## Path Types

### GlyphPath

```typescript
interface GlyphPath {
  commands: PathCommand[];
  bounds: { xMin: number; yMin: number; xMax: number; yMax: number } | null;
  flags?: OutlineFlags;
}
```

### PathCommand

```typescript
type PathCommand =
  | { type: "M"; x: number; y: number }              // Move to
  | { type: "L"; x: number; y: number }              // Line to
  | { type: "Q"; x1: number; y1: number; x: number; y: number }  // Quadratic curve
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }  // Cubic curve
  | { type: "Z" }                                    // Close path
```

### ShapedGlyph

```typescript
interface ShapedGlyph {
  glyphId: GlyphId;
  xOffset: number;
  yOffset: number;
  xAdvance: number;
  yAdvance: number;
}
```

## Path Functions

### getGlyphPath()

Get path commands for a single glyph.

```typescript
function getGlyphPath(font: Font, glyphId: GlyphId): GlyphPath | null
```

**Example:**
```typescript
import { Font, getGlyphPath } from "typeshaper";

const font = await Font.fromFile("font.ttf");
const glyphId = font.glyphIdForChar("A");
const path = getGlyphPath(font, glyphId);

if (path) {
  console.log(`Glyph has ${path.commands.length} commands`);
  console.log(`Bounds:`, path.bounds);
}
```

### getGlyphPathWithVariation()

Get path with variable font variation applied.

```typescript
function getGlyphPathWithVariation(
  font: Font,
  glyphId: GlyphId,
  axisCoords: number[]
): GlyphPath | null
```

**Example:**
```typescript
const coords = [0.5, 0]; // Normalized coordinates
const path = getGlyphPathWithVariation(font, glyphId, coords);
```

### contourToPath()

Convert TrueType contours to path commands.

```typescript
function contourToPath(contour: Contour): PathCommand[]
```

**Example:**
```typescript
const contours = font.getGlyphContours(glyphId);
if (contours) {
  for (const contour of contours) {
    const commands = contourToPath(contour);
    // Process commands
  }
}
```

## SVG Rendering

### pathToSVG()

Convert path commands to SVG path data string.

```typescript
function pathToSVG(
  path: GlyphPath,
  options?: { flipY?: boolean; scale?: number }
): string
```

**Example:**
```typescript
const path = getGlyphPath(font, glyphId);
if (path) {
  const svgPath = pathToSVG(path, { flipY: true, scale: 1 });
  console.log(`<path d="${svgPath}" />`);
}
```

### glyphToSVG()

Generate a complete SVG element for a glyph.

```typescript
function glyphToSVG(
  font: Font,
  glyphId: GlyphId,
  options?: { fontSize?: number; fill?: string }
): string | null
```

**Example:**
```typescript
const svg = glyphToSVG(font, glyphId, {
  fontSize: 100,
  fill: "black"
});
console.log(svg);
// <svg xmlns="http://www.w3.org/2000/svg" width="..." height="...">
//   <path d="..." fill="black"/>
// </svg>
```

### pathToSVGWithMatrix()

Convert path to SVG with 2D affine matrix transformation applied to coordinates.

```typescript
function pathToSVGWithMatrix(
  path: GlyphPath,
  matrix: Matrix2D,
  options?: { flipY?: boolean }
): string
```

**Example:**
```typescript
import { getGlyphPath, pathToSVGWithMatrix, rotate2D, scale2D, multiply2D } from "typeshaper";

const path = getGlyphPath(font, glyphId);
if (path) {
  const matrix = multiply2D(rotate2D(Math.PI / 4), scale2D(0.1, 0.1));
  const svgPath = pathToSVGWithMatrix(path, matrix);
  console.log(`<path d="${svgPath}" />`);
}
```

### pathToSVGWithMatrix3D()

Convert path to SVG with 3D perspective matrix transformation.

```typescript
function pathToSVGWithMatrix3D(
  path: GlyphPath,
  matrix: Matrix3x3,
  options?: { flipY?: boolean }
): string
```

**Example:**
```typescript
const perspective: Matrix3x3 = [
  [0.1, 0, 100],
  [0, 0.1, 100],
  [0.0001, 0, 1]  // Slight perspective effect
];
const svgPath = pathToSVGWithMatrix3D(path, perspective);
```

### matrixToSVGTransform()

Convert 2D affine matrix to SVG transform attribute string.

```typescript
function matrixToSVGTransform(matrix: Matrix2D): string
```

**Example:**
```typescript
const matrix = multiply2D(rotate2D(0.5), scale2D(2, 2));
const attr = matrixToSVGTransform(matrix);
// "matrix(1.755 0.958 -0.958 1.755 0 0)"
console.log(`<path d="..." transform="${attr}" />`);
```

### shapedTextToSVG()

Generate SVG for shaped text.

```typescript
function shapedTextToSVG(
  font: Font,
  glyphs: ShapedGlyph[],
  options?: {
    fontSize?: number;
    fill?: string;
    matrix?: Matrix2D;       // 2D transform (path data)
    matrix3D?: Matrix3x3;    // 3D perspective (path data)
    useNativeTransform?: boolean; // Use SVG transform attr instead
  }
): string
```

**Example:**
```typescript
import { Font, UnicodeBuffer, shape, glyphBufferToShapedGlyphs, shapedTextToSVG } from "typeshaper";

const font = await Font.fromFile("font.ttf");
const buffer = new UnicodeBuffer();
buffer.addStr("Hello");

const shaped = shape(font, buffer);
const glyphs = glyphBufferToShapedGlyphs(shaped);
const svg = shapedTextToSVG(font, glyphs, { fontSize: 48 });

document.body.innerHTML = svg;
```

### shapedTextToSVGWithVariation()

Generate SVG for shaped text with variable font support.

```typescript
function shapedTextToSVGWithVariation(
  font: Font,
  glyphs: ShapedGlyph[],
  axisCoords: number[],
  options?: { fontSize?: number; fill?: string }
): string
```

## Canvas Rendering

### pathToCanvas()

Render path commands to a Canvas 2D context or Path2D.

```typescript
function pathToCanvas(
  ctx: CanvasRenderingContext2D | Path2D,
  path: GlyphPath,
  options?: {
    flipY?: boolean;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
  }
): void
```

**Example:**
```typescript
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

const path = getGlyphPath(font, glyphId);
if (path && ctx) {
  ctx.beginPath();
  pathToCanvas(ctx, path, {
    scale: 0.1,
    flipY: true,
    offsetX: 100,
    offsetY: 100
  });
  ctx.fill();
}
```

### createPath2D()

Create a Path2D object from glyph path.

```typescript
function createPath2D(
  path: GlyphPath,
  options?: {
    flipY?: boolean;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
  }
): Path2D
```

**Example:**
```typescript
const path = getGlyphPath(font, glyphId);
if (path) {
  const path2d = createPath2D(path, { scale: 0.1, flipY: true });
  ctx.fill(path2d);
}
```

### pathToCanvasWithMatrix()

Render path to canvas with 2D affine matrix transformation applied to coordinates.

```typescript
function pathToCanvasWithMatrix(
  ctx: CanvasRenderingContext2D | Path2D,
  path: GlyphPath,
  matrix: Matrix2D,
  options?: { flipY?: boolean }
): void
```

**Example:**
```typescript
import { getGlyphPath, pathToCanvasWithMatrix, rotate2D, scale2D, multiply2D } from "typeshaper";

const path = getGlyphPath(font, glyphId);
if (path && ctx) {
  const matrix = multiply2D(
    multiply2D(rotate2D(Math.PI / 4), scale2D(0.1, 0.1)),
    translate2D(100, 100)
  );
  ctx.beginPath();
  pathToCanvasWithMatrix(ctx, path, matrix);
  ctx.fill();
}
```

### pathToCanvasWithMatrix3D()

Render path to canvas with 3D perspective matrix transformation.

```typescript
function pathToCanvasWithMatrix3D(
  ctx: CanvasRenderingContext2D | Path2D,
  path: GlyphPath,
  matrix: Matrix3x3,
  options?: { flipY?: boolean }
): void
```

**Example:**
```typescript
const perspective: Matrix3x3 = [
  [0.1, 0, 100],
  [0, 0.1, 100],
  [0.001, 0, 1]  // Perspective effect
];
ctx.beginPath();
pathToCanvasWithMatrix3D(ctx, path, perspective);
ctx.fill();
```

### applyMatrixToContext()

Apply 2D affine matrix to canvas context using native transform.

```typescript
function applyMatrixToContext(
  ctx: CanvasRenderingContext2D,
  matrix: Matrix2D
): void
```

**Example:**
```typescript
ctx.save();
applyMatrixToContext(ctx, rotate2D(Math.PI / 6));
pathToCanvas(ctx, path);  // Rendered with rotation
ctx.fill();
ctx.restore();
```

### renderShapedText()

Render shaped text to Canvas.

```typescript
function renderShapedText(
  ctx: CanvasRenderingContext2D,
  font: Font,
  glyphs: ShapedGlyph[],
  options?: {
    fontSize?: number;
    x?: number;
    y?: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    matrix?: Matrix2D;     // 2D transform for glyph coordinates
    matrix3D?: Matrix3x3;  // 3D perspective (takes precedence over matrix)
  }
): void
```

**Example:**
```typescript
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

const buffer = new UnicodeBuffer();
buffer.addStr("Hello World");
const shaped = shape(font, buffer);
const glyphs = glyphBufferToShapedGlyphs(shaped);

if (ctx) {
  renderShapedText(ctx, font, glyphs, {
    fontSize: 48,
    x: 50,
    y: 100,
    fill: "black"
  });
}
```

### renderShapedTextWithVariation()

Render shaped text with variable font support.

```typescript
function renderShapedTextWithVariation(
  ctx: CanvasRenderingContext2D,
  font: Font,
  glyphs: ShapedGlyph[],
  axisCoords: number[],
  options?: { fontSize?: number; x?: number; y?: number; fill?: string }
): void
```

## Utility Functions

### glyphBufferToShapedGlyphs()

Convert GlyphBuffer output to ShapedGlyph array.

```typescript
function glyphBufferToShapedGlyphs(buffer: GlyphBuffer): ShapedGlyph[]
```

**Example:**
```typescript
const shaped = shape(font, buffer);
const glyphs = glyphBufferToShapedGlyphs(shaped);
```

### getTextWidth()

Calculate the total advance width of shaped text.

```typescript
function getTextWidth(
  glyphs: ShapedGlyph[],
  font: Font,
  fontSize: number
): number
```

**Example:**
```typescript
const glyphs = glyphBufferToShapedGlyphs(shaped);
const width = getTextWidth(glyphs, font, 48);
console.log(`Text width: ${width}px`);
```

## Complete Example

```typescript
import {
  Font,
  UnicodeBuffer,
  shape,
  glyphBufferToShapedGlyphs,
  renderShapedText,
  shapedTextToSVG
} from "typeshaper";

async function renderText() {
  // Load font
  const font = await Font.fromFile("font.ttf");

  // Create buffer and add text
  const buffer = new UnicodeBuffer();
  buffer.addStr("Hello, TypeShaper!");

  // Shape the text
  const shaped = shape(font, buffer);
  const glyphs = glyphBufferToShapedGlyphs(shaped);

  // Render to Canvas
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 200;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    renderShapedText(ctx, font, glyphs, {
      fontSize: 48,
      x: 50,
      y: 100,
      fill: "navy"
    });
  }

  // Or get as SVG
  const svg = shapedTextToSVG(font, glyphs, {
    fontSize: 48,
    fill: "navy"
  });

  document.body.appendChild(canvas);
  document.body.innerHTML += svg;
}

renderText();
```

## Variable Font Example

```typescript
import {
  Font,
  Face,
  UnicodeBuffer,
  shape,
  glyphBufferToShapedGlyphs,
  renderShapedText
} from "typeshaper";

async function renderVariableText() {
  const font = await Font.fromFile("variable.ttf");

  // Create face with weight=700
  const face = new Face(font, { wght: 700 });

  const buffer = new UnicodeBuffer();
  buffer.addStr("Variable");

  const shaped = shape(face, buffer);
  const glyphs = glyphBufferToShapedGlyphs(shaped);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (ctx) {
    renderShapedText(ctx, font, glyphs, {
      fontSize: 72,
      x: 50,
      y: 100
    });
  }
}
```

## Outline Transforms

Geometric transformations for glyph paths.

### Matrix Types

```typescript
// 2D affine transform: [a, b, c, d, tx, ty]
// Transforms point (x, y) to:
//   x' = a*x + c*y + tx
//   y' = b*x + d*y + ty
type Matrix2D = [number, number, number, number, number, number];

// 3D homogeneous transform (3x3 for perspective effects)
// | m00  m01  m02 |   | x |   | x' |
// | m10  m11  m12 | × | y | = | y' |
// | m20  m21  m22 |   | 1 |   | w  |
// Final coordinates: (x'/w, y'/w)
type Matrix3x3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

interface BoundingBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

interface ControlBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}
```

### Matrix Creation

```typescript
// Identity matrices
function identity2D(): Matrix2D
function identity3x3(): Matrix3x3

// 2D transforms
function translate2D(tx: number, ty: number): Matrix2D
function scale2D(sx: number, sy: number): Matrix2D
function rotate2D(angle: number): Matrix2D
function shear2D(shx: number, shy: number): Matrix2D

// 3D perspective
function perspectiveMatrix(
  fov: number,
  aspect: number,
  near: number,
  far: number
): Matrix3x3

// Matrix multiplication
function multiply2D(a: Matrix2D, b: Matrix2D): Matrix2D
function multiply3x3(a: Matrix3x3, b: Matrix3x3): Matrix3x3
```

### Point Transforms

```typescript
function transformPoint2D(
  x: number,
  y: number,
  m: Matrix2D
): { x: number; y: number }

function transformPoint3x3(
  x: number,
  y: number,
  m: Matrix3x3
): { x: number; y: number }
```

### Outline Transforms

```typescript
// Scale outline by factors
function scaleOutline(
  path: GlyphPath,
  scaleX: number,
  scaleY: number
): GlyphPath

// Scale by power of 2 (optimized)
function scaleOutlinePow2(path: GlyphPath, level: number): GlyphPath

// Rotate 90° counter-clockwise
function rotateOutline90(path: GlyphPath): GlyphPath

// General rotation
function rotateOutline(path: GlyphPath, angle: number): GlyphPath

// Translate
function translateOutline(
  path: GlyphPath,
  dx: number,
  dy: number
): GlyphPath

// 2D affine transform
function transformOutline2D(path: GlyphPath, m: Matrix2D): GlyphPath

// 3D perspective transform
function transformOutline3D(path: GlyphPath, m: Matrix3x3): GlyphPath

// Italicize (shear transform)
function italicizeOutline(path: GlyphPath, slant: number): GlyphPath
```

### Bounds Computation

```typescript
// Control box (bounds of control points only)
function computeControlBox(path: GlyphPath): ControlBox

// Tight bounds (actual curve extrema)
function computeTightBounds(path: GlyphPath): BoundingBox
```

### Path Utilities

```typescript
// Deep clone a path
function clonePath(path: GlyphPath): GlyphPath

// Combine multiple paths into one
function combinePaths(...paths: GlyphPath[]): GlyphPath
```

### Example: Text Effects

```typescript
import {
  getGlyphPath,
  transformOutline2D,
  scale2D,
  rotate2D,
  multiply2D,
  rasterizePath
} from "typeshaper";

// Rotate and scale a glyph
const path = getGlyphPath(font, glyphId);
if (path) {
  const transform = multiply2D(
    rotate2D(Math.PI / 6),  // 30 degree rotation
    scale2D(1.5, 1.5)       // 150% scale
  );

  const transformed = transformOutline2D(path, transform);
  const bitmap = rasterizePath(transformed, {
    width: 200,
    height: 200,
    scale: 0.1
  });
}
```

### Example: Canvas Transform Methods

```typescript
import {
  getGlyphPath,
  pathToCanvasWithMatrix,
  pathToCanvasWithMatrix3D,
  applyMatrixToContext,
  rotate2D,
  scale2D,
  translate2D,
  multiply2D,
  type Matrix3x3
} from "typeshaper";

const canvas = document.createElement("canvas");
canvas.width = 400;
canvas.height = 200;
const ctx = canvas.getContext("2d");

const path = getGlyphPath(font, glyphId);
if (path && ctx) {
  // Method 1: Transform path data directly (2D)
  const matrix = multiply2D(
    translate2D(100, 100),
    multiply2D(rotate2D(Math.PI / 4), scale2D(0.1, 0.1))
  );
  ctx.beginPath();
  pathToCanvasWithMatrix(ctx, path, matrix);
  ctx.fillStyle = "blue";
  ctx.fill();

  // Method 2: Transform path data with 3D perspective
  const perspective: Matrix3x3 = [
    [0.1, 0, 250],      // Scale X + translate X
    [0, 0.1, 100],      // Scale Y + translate Y
    [0.0005, 0, 1]      // Perspective effect
  ];
  ctx.beginPath();
  pathToCanvasWithMatrix3D(ctx, path, perspective);
  ctx.fillStyle = "red";
  ctx.fill();

  // Method 3: Use native canvas transform (2D only)
  ctx.save();
  applyMatrixToContext(ctx, multiply2D(translate2D(350, 100), scale2D(0.1, 0.1)));
  ctx.beginPath();
  pathToCanvas(ctx, path);
  ctx.fillStyle = "green";
  ctx.fill();
  ctx.restore();
}
```

### Example: SVG Transform Methods

```typescript
import {
  getGlyphPath,
  pathToSVG,
  pathToSVGWithMatrix,
  pathToSVGWithMatrix3D,
  matrixToSVGTransform,
  rotate2D,
  scale2D,
  multiply2D,
  type Matrix3x3
} from "typeshaper";

const path = getGlyphPath(font, glyphId);
if (path) {
  const scale = scale2D(0.1, 0.1);

  // Method 1: Transform path coordinates directly (2D)
  const rotated = pathToSVGWithMatrix(path, multiply2D(rotate2D(0.3), scale));

  // Method 2: Transform with 3D perspective
  const perspective: Matrix3x3 = [
    [0.1, 0, 0],
    [0, 0.1, 0],
    [0.001, 0, 1]  // Slight perspective
  ];
  const perspectivePath = pathToSVGWithMatrix3D(path, perspective);

  // Method 3: Use native SVG transform attribute
  const pathData = pathToSVG(path);
  const transformAttr = matrixToSVGTransform(scale);

  // Generate SVG
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -200 400 400">
      <path d="${rotated}" fill="blue" />
      <path d="${perspectivePath}" fill="red" transform="translate(100, 0)" />
      <path d="${pathData}" fill="green" transform="${transformAttr}" />
    </svg>
  `;
}
```

### Example: Shaped Text with Transforms

```typescript
import {
  Font,
  UnicodeBuffer,
  shape,
  glyphBufferToShapedGlyphs,
  renderShapedText,
  shapedTextToSVG,
  rotate2D,
  scale2D,
  multiply2D,
  type Matrix3x3
} from "typeshaper";

const font = await Font.fromFile("font.ttf");
const buffer = new UnicodeBuffer();
buffer.addStr("Hello");

const shaped = shape(font, buffer);
const glyphs = glyphBufferToShapedGlyphs(shaped);

// Canvas with 2D rotation
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
if (ctx) {
  renderShapedText(ctx, font, glyphs, {
    fontSize: 48,
    x: 100,
    y: 100,
    fill: "navy",
    matrix: rotate2D(Math.PI / 12)  // 15° rotation
  });

  // Canvas with 3D perspective
  const perspective: Matrix3x3 = [
    [1, 0, 0],
    [0, 1, 0],
    [0.002, 0, 1]
  ];
  renderShapedText(ctx, font, glyphs, {
    fontSize: 48,
    x: 100,
    y: 200,
    fill: "crimson",
    matrix3D: perspective
  });
}

// SVG with matrix transform in path data
const svg1 = shapedTextToSVG(font, glyphs, {
  fontSize: 48,
  fill: "navy",
  matrix: multiply2D(rotate2D(Math.PI / 12), scale2D(1, 1))
});

// SVG with native transform attribute
const svg2 = shapedTextToSVG(font, glyphs, {
  fontSize: 48,
  fill: "navy",
  matrix: rotate2D(Math.PI / 12),
  useNativeTransform: true  // Uses SVG transform attr instead
});
```
