// Freestanding wasm32 (+SIMD128 for the span memset) port of the FreeType-style
// gray rasterizer's hot kernel: renderLine + renderScanline + cell find/create +
// accumulate + single-band sweep -> 8-bit gray coverage bytes.
//
// Bit-exact with the scalar TS in ../gray-raster.ts + ../cell.ts for the
// single-band `sweep()` path. The input is a pre-flattened command stream
// (op,x,y triples in PIXEL_BITS subpixel coords); bezier subdivision stays in
// JS and is unchanged. All integer math mirrors the JS op-for-op:
//   - division intermediates in i64 (JS doubles are exact for these ranges),
//   - cell area/cover stored as i32 with Int32Array wrap semantics,
//   - `>> 9` applied to ToInt32(value) exactly like JS `x >> 9`.
//
// Build: see build.sh. All pointer args are byte offsets into linear memory.

#include <wasm_simd128.h>
#include <stdint.h>

typedef int32_t  i32;
typedef int64_t  i64;
typedef uint8_t  u8;

#define PIXEL_BITS 8
#define ONE_PIXEL  256
#define PIXEL_MASK 255
#define CELL_MAX_X 0x7fffffff

// Interleaved cell fields (stride 4): x, area, cover, next.
#define OFF_X    0
#define OFF_AREA 1
#define OFF_COVER 2
#define OFF_NEXT 3

// --- rasterizer state (per invocation) ------------------------------------
static i32 *g_cells;    // pool arena, poolSize*4 i32
static i32 *g_ycells;   // height i32 (row heads)
static i32  g_width, g_height;
static i32  g_nullIndex;
static i32  g_freeIndex;

// current-cell tracking (mirrors CellBuffer)
static i32 g_curX, g_curY, g_curIdx;

// bounds of active cells (for sweep tightening; matches JS output regardless)
static i32 g_minY, g_maxY;

// vertical clip bounds (minY=0, maxY=height), set by fill_glyph.
static i32 g_minYclip, g_maxYclip;

static inline i32 iabs(i32 v) { return v < 0 ? -v : v; }

// find-or-create cell at pixel (px,py); mirrors setCurrentCellPixel.
// returns 1 on ok, 0 on pool overflow.
static int setCurrentCellPixel(i32 px, i32 py) {
  if (g_curIdx >= 0 && g_curX == px && g_curY == py) return 1;

  // clip: [0,width) x [0,height)
  if (py < 0 || py >= g_height || px < 0 || px >= g_width) {
    g_curIdx = g_nullIndex;
    g_curX = px; g_curY = py;
    return 1;
  }
  g_curX = px; g_curY = py;

  i32 rowIndex = py; // bandMinY = 0
  i32 *cells = g_cells;
  i32 nullIndex = g_nullIndex;

  i32 prevIndex = -1;
  i32 cellIndex = g_ycells[rowIndex];
  while (cellIndex != nullIndex) {
    i32 cx = cells[cellIndex * 4 + OFF_X];
    if (cx == px) { g_curIdx = cellIndex; return 1; }
    if (cx > px) break;
    prevIndex = cellIndex;
    cellIndex = cells[cellIndex * 4 + OFF_NEXT];
  }

  if (g_freeIndex >= nullIndex) return 0; // overflow

  i32 newIndex = g_freeIndex++;
  i32 nb = newIndex * 4;
  cells[nb + OFF_X] = px;
  cells[nb + OFF_AREA] = 0;
  cells[nb + OFF_COVER] = 0;
  cells[nb + OFF_NEXT] = cellIndex;

  if (prevIndex == -1) g_ycells[rowIndex] = newIndex;
  else cells[prevIndex * 4 + OFF_NEXT] = newIndex;

  g_curIdx = newIndex;
  if (py < g_minY) g_minY = py;
  if (py > g_maxY) g_maxY = py;
  return 1;
}

static inline void addArea(i32 area, i32 cover) {
  if (g_curIdx >= 0) {
    i32 b = g_curIdx * 4;
    g_cells[b + OFF_AREA]  = (i32)((i64)g_cells[b + OFF_AREA] + area);
    g_cells[b + OFF_COVER] = (i32)((i64)g_cells[b + OFF_COVER] + cover);
  }
}

// renderScanline: mirrors gray-raster.ts renderScanline. returns 0 on overflow.
static int renderScanline(i32 ey, i32 x1, i32 y1, i32 x2, i32 y2) {
  i32 ex1 = x1 >> PIXEL_BITS;
  i32 ex2 = x2 >> PIXEL_BITS;

  if (y1 == y2) {
    if (!setCurrentCellPixel(ex2, ey)) return 0;
    return 1;
  }

  i32 fx1 = x1 & PIXEL_MASK;
  i32 fx2 = x2 & PIXEL_MASK;

  if (ex1 == ex2) {
    i32 delta = y2 - y1;
    if (!setCurrentCellPixel(ex1, ey)) return 0;
    addArea(delta * (fx1 + fx2), delta);
    return 1;
  }

  i32 dx = x2 - x1;
  i32 dy = y2 - y1;
  i32 absDx = dx < 0 ? -dx : dx;

  i32 first, incr;
  i64 p;
  if (dx > 0) { first = ONE_PIXEL; incr = 1; p = (i64)(ONE_PIXEL - fx1) * dy; }
  else        { first = 0;         incr = -1; p = (i64)fx1 * dy; }

  i64 delta = p / absDx;
  i64 mod = p - delta * absDx;
  if (mod < 0) { delta--; mod += absDx; }

  if (!setCurrentCellPixel(ex1, ey)) return 0;
  addArea((i32)delta * (fx1 + first), (i32)delta);

  i32 y = y1 + (i32)delta;
  i32 ex = ex1 + incr;
  if (!setCurrentCellPixel(ex, ey)) return 0;

  if (ex != ex2) {
    p = (i64)ONE_PIXEL * dy;
    i64 lift = p / absDx;
    i64 rem = p - lift * absDx;
    if (rem < 0) { lift--; rem += absDx; }

    while (ex != ex2) {
      delta = lift;
      mod += rem;
      if (mod >= absDx) { mod -= absDx; delta++; }
      addArea((i32)delta * ONE_PIXEL, (i32)delta);
      y += (i32)delta;
      ex += incr;
      if (!setCurrentCellPixel(ex, ey)) return 0;
    }
  }

  i32 dlast = y2 - y;
  addArea(dlast * (fx2 + ONE_PIXEL - first), dlast);
  return 1;
}

// renderLine from (fromX,fromY) to (toX,toY). returns 0 on overflow.
static int renderLine(i32 fromX, i32 fromY, i32 toX, i32 toY) {
  i32 ey1 = fromY >> PIXEL_BITS;
  i32 ey2 = toY >> PIXEL_BITS;

  if ((ey1 >= g_maxYclip && ey2 >= g_maxYclip) ||
      (ey1 < g_minYclip && ey2 < g_minYclip)) {
    return 1;
  }

  i32 fy1 = fromY & PIXEL_MASK;
  i32 fy2 = toY & PIXEL_MASK;

  if (ey1 == ey2) {
    return renderScanline(ey1, fromX, fy1, toX, fy2);
  }

  i32 dx = toX - fromX;
  i32 dy = toY - fromY;

  if (dx == 0) {
    i32 exPix = fromX >> PIXEL_BITS;
    i32 twoFx = (fromX & PIXEL_MASK) * 2;
    i32 first, incr;
    if (dy > 0) { first = ONE_PIXEL; incr = 1; }
    else        { first = 0;         incr = -1; }

    i32 delta = first - fy1;
    if (!setCurrentCellPixel(exPix, ey1)) return 0;
    addArea(delta * twoFx, delta);
    ey1 += incr;

    if (!setCurrentCellPixel(exPix, ey1)) return 0;
    delta = first + first - ONE_PIXEL;
    while (ey1 != ey2) {
      addArea(delta * twoFx, delta);
      ey1 += incr;
      if (!setCurrentCellPixel(exPix, ey1)) return 0;
    }
    delta = fy2 - ONE_PIXEL + first;
    addArea(delta * twoFx, delta);
    return 1;
  }

  i32 x = fromX;
  i32 incr, first;
  i64 p;
  i32 absDy = dy < 0 ? -dy : dy;

  if (dy > 0) { first = ONE_PIXEL; incr = 1; p = (i64)(ONE_PIXEL - fy1) * dx; }
  else        { first = 0;         incr = -1; p = (i64)fy1 * dx; }

  i64 delta = p / absDy;
  i64 mod = p - delta * absDy;
  if (mod < 0) { delta--; mod += absDy; }

  i32 x2 = x + (i32)delta;
  if (!renderScanline(ey1, x, fy1, x2, first)) return 0;
  x = x2;
  ey1 += incr;
  if (!setCurrentCellPixel(x >> PIXEL_BITS, ey1)) return 0;

  if (ey1 != ey2) {
    p = (i64)ONE_PIXEL * dx;
    i64 lift = p / absDy;
    i64 rem = p - lift * absDy;
    if (rem < 0) { lift--; rem += absDy; }

    while (ey1 != ey2) {
      delta = lift;
      mod += rem;
      if (mod >= absDy) { mod -= absDy; delta++; }
      x2 = x + (i32)delta;
      if (!renderScanline(ey1, x, ONE_PIXEL - first, x2, first)) return 0;
      x = x2;
      ey1 += incr;
      if (!setCurrentCellPixel(x >> PIXEL_BITS, ey1)) return 0;
    }
  }

  if (!renderScanline(ey1, x, ONE_PIXEL - first, toX, fy2)) return 0;
  return 1;
}

static inline i32 applyFillRule(i32 value, i32 fillRule) {
  i32 v = value;
  if (v < 0) v = -v;
  if (fillRule == 1) { // EvenOdd
    v &= 511;
    if (v > 256) v = 512 - v;
  }
  return v > 255 ? 255 : v;
}

// Fill a contiguous gray span [start,end) in row with value gray (SIMD memset).
static inline void fillSpan(u8 *out, i32 start, i32 end, u8 gray) {
  i32 x = start;
  v128_t g = wasm_i8x16_splat((int8_t)gray);
  for (; x + 16 <= end; x += 16) wasm_v128_store(out + x, g);
  for (; x < end; x++) out[x] = gray;
}

// Sweep single band -> gray bitmap. Mirrors gray-raster.ts sweep() for
// PixelMode.Gray, positive pitch (pitch=width, origin=0).
static void sweepGray(u8 *out, i32 fillRule) {
  i32 *cells = g_cells;
  i32 nullIndex = g_nullIndex;
  i32 w = g_width;
  i32 h = g_height;
  i32 startRow = g_minY < 0 ? 0 : g_minY;
  i32 endRow = g_maxY + 1;
  if (endRow > h) endRow = h;
  if (g_maxY < g_minY) return;

  for (i32 i = startRow; i < endRow; i++) {
    i32 cellIndex = g_ycells[i];
    if (cellIndex == nullIndex) continue;
    i32 y = i;
    if (y < 0 || y >= h) continue;

    i64 cover = 0;
    i32 x = 0;
    i32 row = y * w;

    while (cellIndex != nullIndex) {
      i32 base = cellIndex * 4;
      i32 cx = cells[base + OFF_X];

      if (cx > x && cover != 0) {
        i32 gray = applyFillRule((i32)cover >> (PIXEL_BITS + 1), fillRule);
        if (gray > 0) {
          i32 s = x < 0 ? 0 : x;
          i32 e = cx > w ? w : cx;
          if (e > s) fillSpan(out + row, s, e, (u8)gray);
        }
      }

      cover += (i64)cells[base + OFF_COVER] * (ONE_PIXEL * 2);
      i32 area = (i32)(cover - (i64)cells[base + OFF_AREA]);
      i32 gray = applyFillRule(area >> (PIXEL_BITS + 1), fillRule);
      if (gray > 0 && cx >= 0 && cx < w) out[row + cx] = (u8)gray;

      x = cx + 1;
      cellIndex = cells[base + OFF_NEXT];
    }

    if (x < w && cover != 0) {
      i32 gray = applyFillRule((i32)cover >> (PIXEL_BITS + 1), fillRule);
      if (gray > 0) fillSpan(out + row, x, w, (u8)gray);
    }
  }
}

// --- exported entry --------------------------------------------------------
// cmdOff: i32[cmdCount*3] triples (op,x,y); op 0=move,1=line (subpixel coords)
// cellsOff: i32[poolSize*4] arena; ycellsOff: i32[height]; outOff: u8[width*height]
// returns 1 on success, 0 on pool overflow (caller falls back to scalar JS).
__attribute__((export_name("fill_glyph")))
int fill_glyph(i32 cmdOff, i32 cmdCount, i32 width, i32 height, i32 fillRule,
               i32 cellsOff, i32 ycellsOff, i32 outOff, i32 poolSize) {
  const i32 *cmd = (const i32 *)(uintptr_t)cmdOff;
  g_cells = (i32 *)(uintptr_t)cellsOff;
  g_ycells = (i32 *)(uintptr_t)ycellsOff;
  u8 *out = (u8 *)(uintptr_t)outOff;

  g_width = width;
  g_height = height;
  g_nullIndex = poolSize - 1;
  g_freeIndex = 0;
  g_minYclip = 0;
  g_maxYclip = height;
  g_minY = 0x7fffffff;
  g_maxY = -0x7fffffff;
  g_curX = 0; g_curY = 0; g_curIdx = -1;

  // init ycells to null sentinel
  for (i32 i = 0; i < height; i++) g_ycells[i] = g_nullIndex;
  // init null cell
  i32 nb = g_nullIndex * 4;
  g_cells[nb + OFF_X] = CELL_MAX_X;
  g_cells[nb + OFF_AREA] = 0;
  g_cells[nb + OFF_COVER] = 0;
  g_cells[nb + OFF_NEXT] = -1;

  i32 curX = 0, curY = 0;
  for (i32 c = 0; c < cmdCount; c++) {
    i32 op = cmd[c * 3 + 0];
    i32 px = cmd[c * 3 + 1];
    i32 py = cmd[c * 3 + 2];
    if (op == 0) { // move
      curX = px; curY = py;
      if (!setCurrentCellPixel(px >> PIXEL_BITS, py >> PIXEL_BITS)) return 0;
    } else { // line
      if (!renderLine(curX, curY, px, py)) return 0;
      curX = px; curY = py;
    }
  }

  sweepGray(out, fillRule);
  return 1;
}
