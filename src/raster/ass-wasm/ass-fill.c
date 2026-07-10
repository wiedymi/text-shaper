/*
 * Copyright (C) 2014-2022 libass contributors
 *
 * Permission to use, copy, modify, and distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Freestanding wasm32 scalar port of libass ass_rasterizer.c and the 16x16 C
 * rasterizer template. Input path coordinates are signed 26.6 fixed point.
 */

#include <stdint.h>
#include <stddef.h>

typedef int32_t i32;
typedef int64_t i64;
typedef uint8_t u8;

#define TILE_SIZE 16
#define TILE_ORDER 4
#define FULL_VALUE (1 << (14 - TILE_ORDER))
#define OUTLINE_ERROR 16

#define SEGFLAG_DN 1
#define SEGFLAG_UL_DR 2
#define SEGFLAG_EXACT_LEFT 4
#define SEGFLAG_EXACT_RIGHT 8
#define SEGFLAG_EXACT_TOP 16
#define SEGFLAG_EXACT_BOTTOM 32

#define FLAG_SOLID 1
#define FLAG_COMPLEX 2
#define FLAG_REVERSE 4
#define FLAG_GENERIC 8

typedef struct { i32 x, y; } Point;
typedef struct {
  i64 c;
  i32 a, b, scale, flags;
  i32 x_min, x_max, y_min, y_max;
} Segment;

static Segment *g_line[2];
static i32 g_size[2];
static i32 g_capacity;
static u8 *g_tile;
static Segment *g_arena;
static i32 g_arena_used;
static i32 g_arena_capacity;
static i32 g_x_min, g_y_min, g_x_max, g_y_max;

static inline i32 imin(i32 a, i32 b) { return a < b ? a : b; }
static inline i32 imax(i32 a, i32 b) { return a > b ? a : b; }
static inline i32 iabs(i32 a) { return a < 0 ? -a : a; }
static inline i32 clamp(i32 v, i32 lo, i32 hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

static i32 ilog2_u32(uint32_t n) {
  i32 r = 0;
  while (n >>= 1) r++;
  return r;
}

static int reserve(i32 index, i32 count) {
  return count >= 0 && g_size[index] <= g_capacity - count;
}

static int add_line(Point p0, Point p1) {
  i32 x = p1.x - p0.x;
  i32 y = p1.y - p0.y;
  if (!x && !y) return 1;
  if (!reserve(0, 1)) return 0;

  Segment *line = g_line[0] + g_size[0]++;
  line->flags = SEGFLAG_EXACT_LEFT | SEGFLAG_EXACT_RIGHT |
    SEGFLAG_EXACT_TOP | SEGFLAG_EXACT_BOTTOM;
  if (x < 0) line->flags ^= SEGFLAG_UL_DR;
  if (y >= 0) line->flags ^= SEGFLAG_DN | SEGFLAG_UL_DR;
  line->x_min = imin(p0.x, p1.x);
  line->x_max = imax(p0.x, p1.x);
  line->y_min = imin(p0.y, p1.y);
  line->y_max = imax(p0.y, p1.y);
  g_x_min = imin(g_x_min, line->x_min);
  g_x_max = imax(g_x_max, line->x_max);
  g_y_min = imin(g_y_min, line->y_min);
  g_y_max = imax(g_y_max, line->y_max);
  line->a = y;
  line->b = -x;
  line->c = (i64)y * p0.x - (i64)x * p0.y;

  uint32_t max_ab = (uint32_t)imax(iabs(x), iabs(y));
  i32 shift = 30 - ilog2_u32(max_ab);
  max_ab <<= shift + 1;
  line->a <<= shift;
  line->b <<= shift;
  line->c <<= shift;
  line->scale = (uint64_t)0x53333333 *
    (uint32_t)((uint64_t)max_ab * max_ab >> 32) >> 32;
  line->scale += 0x8810624D -
    ((uint64_t)0xBBC6A7EF * max_ab >> 32);
  return 1;
}

typedef struct { Point r; i64 r2, er; } CurveCheck;

static void curve_init(CurveCheck *s, Point begin, Point end) {
  i32 x = end.x - begin.x;
  i32 y = end.y - begin.y;
  s->r.x = x;
  s->r.y = y;
  s->r2 = (i64)x * x + (i64)y * y;
  s->er = (i64)OUTLINE_ERROR * imax(iabs(x), iabs(y));
}

static int curve_subdivide(const CurveCheck *s, Point begin, Point p) {
  i32 x = p.x - begin.x;
  i32 y = p.y - begin.y;
  i64 dot = (i64)s->r.x * x + (i64)s->r.y * y;
  i64 cross = (i64)s->r.x * y - (i64)s->r.y * x;
  return dot < -s->er || dot > s->r2 + s->er ||
    (cross < 0 ? -cross : cross) > s->er;
}

static int add_quadratic(Point p0, Point p1, Point p2, i32 depth) {
  CurveCheck s;
  curve_init(&s, p0, p2);
  if (depth >= 32 || !curve_subdivide(&s, p0, p1))
    return add_line(p0, p2);

  Point a = { (p0.x + p1.x) >> 1, (p0.y + p1.y) >> 1 };
  Point b = { (p1.x + p2.x) >> 1, (p1.y + p2.y) >> 1 };
  Point center = {
    (p0.x + 2 * p1.x + p2.x + 2) >> 2,
    (p0.y + 2 * p1.y + p2.y + 2) >> 2,
  };
  return add_quadratic(p0, a, center, depth + 1) &&
    add_quadratic(center, b, p2, depth + 1);
}

static int add_cubic(Point p0, Point p1, Point p2, Point p3, i32 depth) {
  CurveCheck s;
  curve_init(&s, p0, p3);
  if (depth >= 32 ||
      (!curve_subdivide(&s, p0, p1) && !curve_subdivide(&s, p0, p2)))
    return add_line(p0, p3);

  Point p01 = { (p0.x + p1.x) >> 1, (p0.y + p1.y) >> 1 };
  Point p23 = { (p2.x + p3.x) >> 1, (p2.y + p3.y) >> 1 };
  Point p012 = {
    (p0.x + 2 * p1.x + p2.x + 2) >> 2,
    (p0.y + 2 * p1.y + p2.y + 2) >> 2,
  };
  Point p123 = {
    (p1.x + 2 * p2.x + p3.x + 2) >> 2,
    (p1.y + 2 * p2.y + p3.y + 2) >> 2,
  };
  Point center = {
    (p0.x + 3 * p1.x + 3 * p2.x + p3.x + 3) >> 3,
    (p0.y + 3 * p1.y + 3 * p2.y + p3.y + 3) >> 3,
  };
  return add_cubic(p0, p01, p012, center, depth + 1) &&
    add_cubic(center, p123, p23, p3, depth + 1);
}

static void move_x(Segment *line, i32 x) {
  line->x_min = imax(line->x_min - x, 0);
  line->x_max -= x;
  line->c -= (i64)line->a * x;
  if (!line->x_min &&
      (line->flags & (SEGFLAG_EXACT_LEFT | SEGFLAG_UL_DR)) ==
        (SEGFLAG_EXACT_LEFT | SEGFLAG_UL_DR))
    line->flags &= ~SEGFLAG_EXACT_TOP;
}

static void move_y(Segment *line, i32 y) {
  line->y_min = imax(line->y_min - y, 0);
  line->y_max -= y;
  line->c -= (i64)line->b * y;
  if (!line->y_min &&
      (line->flags & (SEGFLAG_EXACT_TOP | SEGFLAG_UL_DR)) ==
        (SEGFLAG_EXACT_TOP | SEGFLAG_UL_DR))
    line->flags &= ~SEGFLAG_EXACT_LEFT;
}

static void split_horz_line(Segment *left, Segment *right, i32 x) {
  *right = *left;
  right->c -= (i64)left->a * x;
  right->x_min = 0;
  right->x_max -= x;
  left->x_max = x;
  left->flags &= ~SEGFLAG_EXACT_TOP;
  right->flags &= ~SEGFLAG_EXACT_BOTTOM;
  if (left->flags & SEGFLAG_UL_DR) {
    i32 f = left->flags; left->flags = right->flags; right->flags = f;
  }
  left->flags |= SEGFLAG_EXACT_RIGHT;
  right->flags |= SEGFLAG_EXACT_LEFT;
}

static void split_vert_line(Segment *top, Segment *bottom, i32 y) {
  *bottom = *top;
  bottom->c -= (i64)top->b * y;
  bottom->y_min = 0;
  bottom->y_max -= y;
  top->y_max = y;
  top->flags &= ~SEGFLAG_EXACT_LEFT;
  bottom->flags &= ~SEGFLAG_EXACT_RIGHT;
  if (top->flags & SEGFLAG_UL_DR) {
    i32 f = top->flags; top->flags = bottom->flags; bottom->flags = f;
  }
  top->flags |= SEGFLAG_EXACT_BOTTOM;
  bottom->flags |= SEGFLAG_EXACT_TOP;
}

static int check_left(const Segment *line, i32 x) {
  if (line->flags & SEGFLAG_EXACT_LEFT) return line->x_min >= x;
  i64 cc = line->c - (i64)line->a * x - (i64)line->b *
    (line->flags & SEGFLAG_UL_DR ? line->y_min : line->y_max);
  if (line->a < 0) cc = -cc;
  return cc >= 0;
}

static int check_right(const Segment *line, i32 x) {
  if (line->flags & SEGFLAG_EXACT_RIGHT) return line->x_max <= x;
  i64 cc = line->c - (i64)line->a * x - (i64)line->b *
    (line->flags & SEGFLAG_UL_DR ? line->y_max : line->y_min);
  if (line->a > 0) cc = -cc;
  return cc >= 0;
}

static int check_top(const Segment *line, i32 y) {
  if (line->flags & SEGFLAG_EXACT_TOP) return line->y_min >= y;
  i64 cc = line->c - (i64)line->b * y - (i64)line->a *
    (line->flags & SEGFLAG_UL_DR ? line->x_min : line->x_max);
  if (line->b < 0) cc = -cc;
  return cc >= 0;
}

static int check_bottom(const Segment *line, i32 y) {
  if (line->flags & SEGFLAG_EXACT_BOTTOM) return line->y_max <= y;
  i64 cc = line->c - (i64)line->b * y - (i64)line->a *
    (line->flags & SEGFLAG_UL_DR ? line->x_max : line->x_min);
  if (line->b > 0) cc = -cc;
  return cc >= 0;
}

static int poly_split_horz(const Segment *src, i32 n_src,
                           Segment *left, i32 *n_left,
                           Segment *right, i32 *n_right,
                           i32 *winding, i32 x) {
  *n_left = *n_right = 0;
  for (i32 i = 0; i < n_src; i++) {
    const Segment *s = src + i;
    i32 delta = 0;
    if (!s->y_min && (s->flags & SEGFLAG_EXACT_TOP))
      delta = s->a < 0 ? 1 : -1;
    if (check_right(s, x)) {
      *winding += delta;
      if (s->x_min >= x) continue;
      if (*n_left >= g_capacity) return 0;
      left[*n_left] = *s;
      left[*n_left].x_max = imin(left[*n_left].x_max, x);
      (*n_left)++;
    } else if (check_left(s, x)) {
      if (*n_right >= g_capacity) return 0;
      right[*n_right] = *s;
      move_x(right + *n_right, x);
      (*n_right)++;
    } else {
      if (s->flags & SEGFLAG_UL_DR) *winding += delta;
      if (*n_left >= g_capacity || *n_right >= g_capacity) return 0;
      left[*n_left] = *s;
      split_horz_line(left + *n_left, right + *n_right, x);
      (*n_left)++;
      (*n_right)++;
    }
  }
  return 1;
}

static int poly_split_vert(const Segment *src, i32 n_src,
                           Segment *top, i32 *n_top,
                           Segment *bottom, i32 *n_bottom,
                           i32 *winding, i32 y) {
  *n_top = *n_bottom = 0;
  for (i32 i = 0; i < n_src; i++) {
    const Segment *s = src + i;
    i32 delta = 0;
    if (!s->x_min && (s->flags & SEGFLAG_EXACT_LEFT))
      delta = s->b < 0 ? 1 : -1;
    if (check_bottom(s, y)) {
      *winding += delta;
      if (s->y_min >= y) continue;
      if (*n_top >= g_capacity) return 0;
      top[*n_top] = *s;
      top[*n_top].y_max = imin(top[*n_top].y_max, y);
      (*n_top)++;
    } else if (check_top(s, y)) {
      if (*n_bottom >= g_capacity) return 0;
      bottom[*n_bottom] = *s;
      move_y(bottom + *n_bottom, y);
      (*n_bottom)++;
    } else {
      if (s->flags & SEGFLAG_UL_DR) *winding += delta;
      if (*n_top >= g_capacity || *n_bottom >= g_capacity) return 0;
      top[*n_top] = *s;
      split_vert_line(top + *n_top, bottom + *n_bottom, y);
      (*n_top)++;
      (*n_bottom)++;
    }
  }
  return 1;
}

static i32 fill_flags(const Segment *line, i32 count, i32 winding) {
  if (!count) return winding ? FLAG_SOLID : 0;
  if (count > 1) return FLAG_COMPLEX | FLAG_GENERIC;
  if (((line->flags & (SEGFLAG_UL_DR | SEGFLAG_EXACT_LEFT)) !=
       (SEGFLAG_UL_DR | SEGFLAG_EXACT_LEFT)) ==
      !(line->flags & SEGFLAG_DN))
    winding++;
  if (winding == 0) return FLAG_COMPLEX | FLAG_REVERSE;
  if (winding == 1) return FLAG_COMPLEX;
  return FLAG_SOLID;
}

static void fill_solid(u8 *buf, i32 stride, i32 width, i32 height, i32 set) {
  u8 value = set ? 255 : 0;
  for (i32 y = 0; y < height; y++) {
    for (i32 x = 0; x < width; x++) buf[x] = value;
    buf += stride;
  }
}

#define RESCALE_AB(ab, scale) \
  (((ab) * (i64)(scale) + ((i64)1 << (45 + TILE_ORDER))) >> (46 + TILE_ORDER))
#define RESCALE_C(c, scale) \
  (((i32)((c) >> (7 + TILE_ORDER)) * (i64)(scale) + ((i64)1 << 44)) >> 45)

static void fill_halfplane_tile(u8 *buf, i32 stride,
                                i32 a, i32 b, i64 c, i32 scale) {
  int16_t aa = RESCALE_AB(a, scale);
  int16_t bb = RESCALE_AB(b, scale);
  int16_t cc = RESCALE_C(c, scale) + FULL_VALUE / 2 - ((aa + bb) >> 1);
  int16_t abs_a = iabs(aa), abs_b = iabs(bb);
  int16_t delta = (imin(abs_a, abs_b) + 2) >> 2;
  int16_t va1[TILE_SIZE], va2[TILE_SIZE];
  for (i32 x = 0; x < TILE_SIZE; x++) {
    va1[x] = aa * x - delta;
    va2[x] = aa * x + delta;
  }
  for (i32 y = 0; y < TILE_SIZE; y++) {
    for (i32 x = 0; x < TILE_SIZE; x++) {
      int16_t c1 = clamp(cc - va1[x], 0, FULL_VALUE);
      int16_t c2 = clamp(cc - va2[x], 0, FULL_VALUE);
      i32 result = (c1 + c2) >> (7 - TILE_ORDER);
      buf[x] = imin(result, 255);
    }
    buf += stride;
    cc -= bb;
  }
}

static void fill_halfplane(u8 *buf, i32 stride, i32 width, i32 height,
                           const Segment *line, i32 reverse) {
  i32 scale = reverse ? -line->scale : line->scale;
  if (width == TILE_SIZE && height == TILE_SIZE) {
    fill_halfplane_tile(buf, stride, line->a, line->b, line->c, scale);
    return;
  }

  uint32_t abs_a = line->a < 0 ? -line->a : line->a;
  uint32_t abs_b = line->b < 0 ? -line->b : line->b;
  i64 size = (i64)(abs_a + abs_b) << (TILE_ORDER + 5);
  i64 offs = ((i64)line->a + line->b) << (TILE_ORDER + 5);
  for (i32 y = 0; y < height; y += TILE_SIZE) {
    for (i32 x = 0; x < width; x += TILE_SIZE) {
      i64 c = line->c -
        (((i64)line->a * (x >> TILE_ORDER) +
          (i64)line->b * (y >> TILE_ORDER)) << (TILE_ORDER + 6));
      i64 offs_c = offs - c;
      i64 abs_c = offs_c < 0 ? -offs_c : offs_c;
      u8 *tile = buf + y * stride + x;
      if (abs_c < size) {
        fill_halfplane_tile(tile, stride, line->a, line->b, c, scale);
      } else {
        fill_solid(tile, stride, TILE_SIZE, TILE_SIZE,
          (((uint32_t)(offs_c >> 32) ^ (uint32_t)scale) & 0x80000000u) != 0);
      }
    }
  }
}

static void update_border_line(int16_t *res, i32 row, int16_t abs_a,
                               const int16_t *va, int16_t b, int16_t abs_b,
                               int16_t c, i32 up, i32 down) {
  int16_t size = down - up;
  int16_t w = FULL_VALUE + (size << (8 - TILE_ORDER)) - abs_a;
  w = imin(w, FULL_VALUE) << (2 * TILE_ORDER - 5);
  int16_t dc_b = abs_b * (i32)size >> 6;
  int16_t dc = (imin(abs_a, dc_b) + 2) >> 2;
  int16_t base = (i32)b * (up + down) >> 7;
  int16_t offs1 = size - ((base + dc) * (i32)w >> 16);
  int16_t offs2 = size - ((base - dc) * (i32)w >> 16);
  size <<= 1;
  res += row * TILE_SIZE;
  for (i32 x = 0; x < TILE_SIZE; x++) {
    int16_t cw = (c - va[x]) * (i32)w >> 16;
    int16_t c1 = clamp(cw + offs1, 0, size);
    int16_t c2 = clamp(cw + offs2, 0, size);
    res[x] += c1 + c2;
  }
}

static void fill_generic_tile(u8 *buf, i32 stride,
                              const Segment *line, i32 count, i32 winding) {
  int16_t res[TILE_SIZE * TILE_SIZE] = {0};
  int16_t delta[TILE_SIZE + 2] = {0};
  for (i32 li = 0; li < count; li++, line++) {
    int16_t up_delta = line->flags & SEGFLAG_DN ? 4 : 0;
    int16_t down_delta = up_delta;
    if (!line->x_min && (line->flags & SEGFLAG_EXACT_LEFT)) down_delta ^= 4;
    if (line->flags & SEGFLAG_UL_DR) {
      int16_t t = up_delta; up_delta = down_delta; down_delta = t;
    }
    i32 up = line->y_min >> 6;
    i32 down = line->y_max >> 6;
    int16_t up_pos = line->y_min & 63;
    int16_t down_pos = line->y_max & 63;
    int16_t up_delta1 = up_delta * up_pos;
    int16_t down_delta1 = down_delta * down_pos;
    delta[up + 1] -= up_delta1;
    delta[up] -= (up_delta << 6) - up_delta1;
    delta[down + 1] += down_delta1;
    delta[down] += (down_delta << 6) - down_delta1;
    if (line->y_min == line->y_max) continue;

    int16_t a = RESCALE_AB(line->a, line->scale);
    int16_t b = RESCALE_AB(line->b, line->scale);
    int16_t c = RESCALE_C(line->c, line->scale) - (a >> 1) - b * up;
    int16_t va[TILE_SIZE];
    for (i32 x = 0; x < TILE_SIZE; x++) va[x] = a * x;
    int16_t abs_a = iabs(a), abs_b = iabs(b);
    int16_t dc = (imin(abs_a, abs_b) + 2) >> 2;
    int16_t base = FULL_VALUE / 2 - (b >> 1);
    int16_t dc1 = base + dc, dc2 = base - dc;
    if (up_pos) {
      if (down == up) {
        update_border_line(res, up, abs_a, va, b, abs_b, c, up_pos, down_pos);
        continue;
      }
      update_border_line(res, up, abs_a, va, b, abs_b, c, up_pos, 64);
      up++; c -= b;
    }
    for (i32 y = up; y < down; y++) {
      for (i32 x = 0; x < TILE_SIZE; x++) {
        int16_t c1 = clamp(c - va[x] + dc1, 0, FULL_VALUE);
        int16_t c2 = clamp(c - va[x] + dc2, 0, FULL_VALUE);
        res[y * TILE_SIZE + x] += (c1 + c2) >> (7 - TILE_ORDER);
      }
      c -= b;
    }
    if (down_pos)
      update_border_line(res, down, abs_a, va, b, abs_b, c, 0, down_pos);
  }

  int16_t current = 256 * (int8_t)winding;
  for (i32 y = 0; y < TILE_SIZE; y++) {
    current += delta[y];
    for (i32 x = 0; x < TILE_SIZE; x++) {
      int16_t value = res[y * TILE_SIZE + x] + current;
      value = iabs(value);
      buf[x] = imin(value, 255);
    }
    buf += stride;
  }
}

static void merge_tile(u8 *buf, i32 stride, const u8 *tile) {
  for (i32 y = 0; y < TILE_SIZE; y++) {
    for (i32 x = 0; x < TILE_SIZE; x++) buf[x] = imax(buf[x], tile[x]);
    buf += stride; tile += TILE_SIZE;
  }
}

static Segment *arena_alloc(i32 count) {
  if (count < 0 || g_arena_used > g_arena_capacity - count) return NULL;
  Segment *result = g_arena + g_arena_used;
  g_arena_used += count;
  return result;
}

static int fill_level(u8 *buf, i32 stride, i32 width, i32 height,
                      i32 index, i32 count, i32 winding) {
  i32 offset = g_size[index] - count;
  Segment *lines = g_line[index] + offset;
  i32 line_flags = fill_flags(lines, count, winding);
  i32 flags = line_flags ^ FLAG_COMPLEX;
  if (flags & (FLAG_SOLID | FLAG_COMPLEX)) {
    fill_solid(buf, stride, width, height, flags & FLAG_SOLID);
    g_size[index] = offset;
    return 1;
  }
  if (!(flags & FLAG_GENERIC) && (line_flags & FLAG_COMPLEX)) {
    fill_halfplane(buf, stride, width, height, lines, flags & FLAG_REVERSE);
    g_size[index] = offset;
    return 1;
  }
  if (width == TILE_SIZE && height == TILE_SIZE) {
    fill_generic_tile(buf, stride, lines, count, winding);
    g_size[index] = offset;
    return 1;
  }

  i32 other = index ^ 1;
  i32 other_offset = g_size[other];
  if (other_offset > g_arena_capacity - count) return 0;
  Segment *first = lines;
  Segment *second = g_line[other] + other_offset;
  i32 n_first = 0, n_second = 0;
  i32 second_winding = winding;
  int ok;
  if (width > height) {
    i32 first_width = 1 << ilog2_u32((uint32_t)(width - 1));
    ok = poly_split_horz(lines, count, first, &n_first,
                         second, &n_second, &second_winding,
                         first_width << 6);
    g_size[index] = offset + n_first;
    g_size[other] = other_offset + n_second;
    if (ok)
      ok = fill_level(buf, stride, first_width, height,
                      index, n_first, winding);
    if (ok)
      ok = fill_level(buf + first_width, stride, width - first_width, height,
                      other, n_second, second_winding);
  } else {
    i32 first_height = 1 << ilog2_u32((uint32_t)(height - 1));
    ok = poly_split_vert(lines, count, first, &n_first,
                         second, &n_second, &second_winding,
                         first_height << 6);
    g_size[index] = offset + n_first;
    g_size[other] = other_offset + n_second;
    if (ok)
      ok = fill_level(buf, stride, width, first_height,
                      index, n_first, winding);
    if (ok)
      ok = fill_level(buf + first_height * stride, stride,
                      width, height - first_height,
                      other, n_second, second_winding);
  }
  return ok;
}

static int clip_horz(const Segment **lines, i32 *count, i32 *winding,
                     i32 x, i32 keep_second) {
  i32 mark = g_arena_used;
  Segment *first = arena_alloc(*count);
  Segment *second = arena_alloc(*count);
  if ((!first && *count) || (!second && *count)) return 0;
  i32 n_first = 0, n_second = 0;
  i32 second_winding = *winding;
  if (!poly_split_horz(*lines, *count, first, &n_first,
                       second, &n_second, &second_winding, x))
    return 0;
  if (keep_second) {
    *lines = second; *count = n_second; *winding = second_winding;
    g_arena_used = mark + *count;
    for (i32 i = 0; i < *count; i++) g_arena[mark + i] = second[i];
    *lines = g_arena + mark;
  } else {
    *lines = first; *count = n_first;
    g_arena_used = mark + *count;
  }
  return 1;
}

static int clip_vert(const Segment **lines, i32 *count, i32 *winding,
                     i32 y, i32 keep_second) {
  i32 mark = g_arena_used;
  Segment *first = arena_alloc(*count);
  Segment *second = arena_alloc(*count);
  if ((!first && *count) || (!second && *count)) return 0;
  i32 n_first = 0, n_second = 0;
  i32 second_winding = *winding;
  if (!poly_split_vert(*lines, *count, first, &n_first,
                       second, &n_second, &second_winding, y))
    return 0;
  if (keep_second) {
    *lines = second; *count = n_second; *winding = second_winding;
    g_arena_used = mark + *count;
    for (i32 i = 0; i < *count; i++) g_arena[mark + i] = second[i];
    *lines = g_arena + mark;
  } else {
    *lines = first; *count = n_first;
    g_arena_used = mark + *count;
  }
  return 1;
}

/*
 * Commands are i32[8]: op, x1, y1, x2, y2, x, y, unused.
 * op: 0 move, 1 line, 2 quadratic, 3 cubic, 4 close.
 */
__attribute__((export_name("ass_fill_path")))
int ass_fill_path(i32 cmd_off, i32 cmd_count, i32 width, i32 height,
                  i32 line_off, i32 line_capacity,
                  i32 arena_off, i32 arena_capacity,
                  i32 tile_off, i32 out_off) {
  const i32 *cmd = (const i32 *)(uintptr_t)cmd_off;
  g_line[0] = (Segment *)(uintptr_t)line_off;
  g_line[1] = (Segment *)(uintptr_t)arena_off;
  g_size[0] = g_size[1] = 0;
  g_capacity = line_capacity;
  g_arena = (Segment *)(uintptr_t)arena_off;
  g_arena_used = 0;
  g_arena_capacity = arena_capacity;
  g_tile = (u8 *)(uintptr_t)tile_off;
  g_x_min = g_y_min = 0x7fffffff;
  g_x_max = g_y_max = -0x7fffffff;

  Point current = {0, 0};
  Point start = {0, 0};
  i32 have_current = 0;
  for (i32 i = 0; i < cmd_count; i++, cmd += 8) {
    i32 op = cmd[0];
    if (op == 0) {
      current.x = cmd[1]; current.y = cmd[2];
      start = current; have_current = 1;
    } else if (op == 1 && have_current) {
      Point end = { cmd[1], cmd[2] };
      if (!add_line(current, end)) return 0;
      current = end;
    } else if (op == 2 && have_current) {
      Point control = { cmd[1], cmd[2] };
      Point end = { cmd[3], cmd[4] };
      if (!add_quadratic(current, control, end, 0)) return 0;
      current = end;
    } else if (op == 3 && have_current) {
      Point c1 = { cmd[1], cmd[2] };
      Point c2 = { cmd[3], cmd[4] };
      Point end = { cmd[5], cmd[6] };
      if (!add_cubic(current, c1, c2, end, 0)) return 0;
      current = end;
    } else if (op == 4 && have_current) {
      if (!add_line(current, start)) return 0;
      current = start;
    }
  }

  u8 *out = (u8 *)(uintptr_t)out_off;
  for (i32 i = 0; i < width * height; i++) out[i] = 0;
  if (!g_size[0]) return 1;

  const Segment *lines = g_line[0];
  i32 count = g_size[0];
  i32 winding = 0;
  i32 unused = 0;
  if (g_x_max >= (width << 6)) {
    if (!poly_split_horz(lines, count, g_line[0], &count,
                         g_line[1], &unused, &winding, width << 6)) return 0;
    winding = 0;
    lines = g_line[0];
  }
  if (g_y_max >= (height << 6)) {
    if (!poly_split_vert(lines, count, g_line[0], &count,
                         g_line[1], &unused, &winding, height << 6)) return 0;
    winding = 0;
    lines = g_line[0];
  }
  if (g_x_min <= 0) {
    if (!poly_split_horz(lines, count, g_line[1], &unused,
                         g_line[0], &count, &winding, 0)) return 0;
    lines = g_line[0];
  }
  if (g_y_min <= 0) {
    if (!poly_split_vert(lines, count, g_line[1], &unused,
                         g_line[0], &count, &winding, 0)) return 0;
  }
  g_size[0] = count;
  g_size[1] = 0;
  return fill_level(out, width, width, height, 0, count, winding);
}
