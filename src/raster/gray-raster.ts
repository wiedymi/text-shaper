/**
 * Gray-scale anti-aliased rasterizer
 *
 * Based on FreeType's ftgrays.c - a coverage-based scanline rasterizer
 * that produces high-quality anti-aliased output.
 *
 * Algorithm overview:
 * 1. Convert outline to line segments (flatten curves)
 * 2. For each line segment, compute coverage contribution to cells
 * 3. Sweep scanlines, accumulating coverage
 * 4. Convert coverage to grayscale pixels
 *
 * Key concepts:
 * - cover: accumulated vertical change (winding contribution)
 * - area: accumulated (y-delta * x-position) for edge anti-aliasing
 *
 * Band processing:
 * - Large glyphs are divided into vertical bands
 * - Each band is rendered with bounded memory pool
 * - On overflow, band is bisected and retried
 */

import { CellBuffer, PoolOverflowError } from "./cell.ts";
import { abs, ONE_PIXEL, PIXEL_BITS, PIXEL_MASK } from "./fixed-point.ts";
import type { Bitmap, FillRule, Span } from "./types.ts";
import { FillRule as FillRuleEnum, PixelMode } from "./types.ts";

/** Maximum band bisection depth (like FreeType's 32 bands stack) */
const MAX_BAND_DEPTH = 32;

/** Span buffer size for direct rendering */
const MAX_GRAY_SPANS = 16;

/**
 * Rasterizer state
 */
export class GrayRaster {
	private cells: CellBuffer;

	// Current position in subpixel coordinates
	private x: number = 0;
	private y: number = 0;

	// Clip bounds in pixels
	private minY: number = 0;
	private maxX: number = 0;
	private maxY: number = 0;

	// --- optional command recording (fill-wasm fast path) ------------------
	// When recording, moveTo/renderLine append (op,x,y) triples to `cmd` instead
	// of touching the cell buffer; bezier subdivision (subdivConic/subdivCubic)
	// still runs in JS and funnels through renderLine, so the recorded stream is
	// exactly the post-flatten polyline the scalar sweep would rasterize.
	private recording = false;
	private cmd: Int32Array = new Int32Array(3072);
	private cmdLen = 0;

	constructor(cellPoolSize?: number) {
		this.cells = new CellBuffer(cellPoolSize);
	}

	beginRecord(): void {
		this.recording = true;
		this.cmdLen = 0;
		this.x = 0;
		this.y = 0;
	}

	endRecord(): void {
		this.recording = false;
	}

	getCmd(): Int32Array {
		return this.cmd;
	}

	/** Number of (op,x,y) triples recorded. */
	getCmdCount(): number {
		return (this.cmdLen / 3) | 0;
	}

	private pushCmd(op: number, x: number, y: number): void {
		const n = this.cmdLen;
		if (n + 3 > this.cmd.length) {
			const grown = new Int32Array(this.cmd.length * 2);
			grown.set(this.cmd);
			this.cmd = grown;
		}
		this.cmd[n] = op;
		this.cmd[n + 1] = x;
		this.cmd[n + 2] = y;
		this.cmdLen = n + 3;
	}

	/**
	 * Set clip rectangle (in pixels)
	 */
	setClip(minX: number, minY: number, maxX: number, maxY: number): void {
		this.minY = minY;
		this.maxX = maxX;
		this.maxY = maxY;
		this.cells.setClip(minX, minY, maxX, maxY);
	}

	/**
	 * Set band bounds for current render pass
	 */
	setBandBounds(minY: number, maxY: number): void {
		this.cells.setBandBounds(minY, maxY);
	}

	/**
	 * Reset rasterizer state
	 */
	reset(): void {
		this.cells.reset();
		this.x = 0;
		this.y = 0;
	}

	/**
	 * Move to a new position (start new contour)
	 * Coordinates are in subpixel units (ONE_PIXEL per pixel)
	 */
	moveTo(x: number, y: number): void {
		this.x = x;
		this.y = y;
		if (this.recording) {
			this.pushCmd(0, x, y);
			return;
		}
		this.cells.setCurrentCell(x, y);
	}

	/**
	 * Draw line to position
	 */
	lineTo(toX: number, toY: number): void {
		this.renderLine(toX, toY);
		this.x = toX;
		this.y = toY;
	}

	/**
	 * Render a line from current position to (toX, toY)
	 * This is the core rasterization algorithm.
	 */
	private renderLine(toX: number, toY: number): void {
		if (this.recording) {
			this.pushCmd(1, toX, toY);
			return;
		}
		let ey1 = this.y >> PIXEL_BITS;
		const ey2 = toY >> PIXEL_BITS;

		// Vertical clipping
		if (
			(ey1 >= this.maxY && ey2 >= this.maxY) ||
			(ey1 < this.minY && ey2 < this.minY)
		) {
			return;
		}

		const fy1 = this.y & PIXEL_MASK;
		const fy2 = toY & PIXEL_MASK;

		// Single scanline case
		if (ey1 === ey2) {
			this.renderScanline(ey1, this.x, fy1, toX, fy2);
			return;
		}

		const dx = toX - this.x;
		const dy = toY - this.y;

		// Vertical line - optimized path
		if (dx === 0) {
			const exPix = this.x >> PIXEL_BITS;
			const twoFx = (this.x & PIXEL_MASK) * 2;

			let first: number;
			let incr: number;

			if (dy > 0) {
				first = ONE_PIXEL;
				incr = 1;
			} else {
				first = 0;
				incr = -1;
			}

			// First partial scanline
			let delta = first - fy1;
			this.cells.setCurrentCellPixel(exPix, ey1);
			this.cells.addArea(delta * twoFx, delta);
			ey1 += incr;

			// Full scanlines
			this.cells.setCurrentCellPixel(exPix, ey1);
			delta = first + first - ONE_PIXEL;
			while (ey1 !== ey2) {
				this.cells.addArea(delta * twoFx, delta);
				ey1 += incr;
				this.cells.setCurrentCellPixel(exPix, ey1);
			}

			// Last partial scanline
			delta = fy2 - ONE_PIXEL + first;
			this.cells.addArea(delta * twoFx, delta);
			return;
		}

		// General case: line crosses multiple scanlines
		let x = this.x;
		let incr: number;
		let first: number;
		let p: number;
		const absDy = dy < 0 ? -dy : dy;

		if (dy > 0) {
			first = ONE_PIXEL;
			incr = 1;
			p = (ONE_PIXEL - fy1) * dx;
		} else {
			first = 0;
			incr = -1;
			p = fy1 * dx;
		}

		// First partial scanline - use FT_DIV_MOD style for accuracy.
		// mod = p - delta*absDy is bit-identical to (p % absDy) by the
		// ECMAScript definition of %, and saves a second division.
		let delta = Math.trunc(p / absDy);
		let mod = p - delta * absDy;
		if (mod < 0) {
			delta--;
			mod += absDy;
		}

		let x2 = x + delta;
		this.renderScanline(ey1, x, fy1, x2, first);
		x = x2;
		ey1 += incr;

		this.cells.setCurrentCellPixel(x >> PIXEL_BITS, ey1);

		// Full scanlines - use modular arithmetic to accumulate remainder
		if (ey1 !== ey2) {
			p = ONE_PIXEL * dx;
			let lift = Math.trunc(p / absDy);
			let rem = p - lift * absDy;
			// FT_DIV_MOD: ensure non-negative remainder (floored division)
			if (rem < 0) {
				lift--;
				rem += absDy;
			}

			while (ey1 !== ey2) {
				delta = lift;
				mod += rem;
				if (mod >= absDy) {
					mod -= absDy;
					delta++;
				}

				x2 = x + delta;
				this.renderScanline(ey1, x, ONE_PIXEL - first, x2, first);
				x = x2;
				ey1 += incr;
				this.cells.setCurrentCellPixel(x >> PIXEL_BITS, ey1);
			}
		}

		// Last partial scanline
		this.renderScanline(ey1, x, ONE_PIXEL - first, toX, fy2);
	}

	/**
	 * Render a line segment within a single scanline
	 */
	private renderScanline(
		ey: number,
		x1: number,
		y1: number,
		x2: number,
		y2: number,
	): void {
		const ex1 = x1 >> PIXEL_BITS;
		const ex2 = x2 >> PIXEL_BITS;

		// Trivial case: horizontal line
		if (y1 === y2) {
			this.cells.setCurrentCellPixel(ex2, ey);
			return;
		}

		const fx1 = x1 & PIXEL_MASK;
		const fx2 = x2 & PIXEL_MASK;

		// Single cell case
		if (ex1 === ex2) {
			const delta = y2 - y1;
			this.cells.setCurrentCellPixel(ex1, ey);
			this.cells.addArea(delta * (fx1 + fx2), delta);
			return;
		}

		// Multiple cells
		const dx = x2 - x1;
		const dy = y2 - y1;
		const absDx = dx < 0 ? -dx : dx;

		let first: number;
		let incr: number;
		let p: number; // x distance to cell boundary * dy (FreeType formula)

		if (dx > 0) {
			first = ONE_PIXEL;
			incr = 1;
			p = (ONE_PIXEL - fx1) * dy; // Distance from fx1 to right edge
		} else {
			first = 0;
			incr = -1;
			p = fx1 * dy; // Distance from fx1 to left edge
		}

		// First cell - use FT_DIV_MOD style for accuracy.
		// mod = p - delta*absDx is bit-identical to (p % absDx) and saves a div.
		let delta = Math.trunc(p / absDx);
		let mod = p - delta * absDx;
		if (mod < 0) {
			delta--;
			mod += absDx;
		}
		this.cells.setCurrentCellPixel(ex1, ey);
		this.cells.addArea(delta * (fx1 + first), delta);

		let y = y1 + delta;
		let ex = ex1 + incr;
		this.cells.setCurrentCellPixel(ex, ey);

		// Middle cells (full width) - use modular arithmetic
		if (ex !== ex2) {
			p = ONE_PIXEL * dy;
			let lift = Math.trunc(p / absDx);
			let rem = p - lift * absDx;
			// FT_DIV_MOD: ensure non-negative remainder (floored division)
			if (rem < 0) {
				lift--;
				rem += absDx;
			}

			while (ex !== ex2) {
				delta = lift;
				mod += rem;
				if (mod >= absDx) {
					mod -= absDx;
					delta++;
				}
				this.cells.addArea(delta * ONE_PIXEL, delta);
				y += delta;
				ex += incr;
				this.cells.setCurrentCellPixel(ex, ey);
			}
		}

		// Last cell
		delta = y2 - y;
		this.cells.addArea(delta * (fx2 + ONE_PIXEL - first), delta);
	}

	/**
	 * Draw a quadratic Bezier curve using adaptive subdivision
	 * Uses flatness test to minimize line segments at small font sizes
	 */
	conicTo(cx: number, cy: number, toX: number, toY: number): void {
		this.subdivConic(this.x, this.y, cx, cy, toX, toY, 0);
		this.x = toX;
		this.y = toY;
	}

	/**
	 * Recursive quadratic subdivision with flatness test
	 * Uses FreeType's exact flatness metric: |P0 + P2 - 2*P1| (second derivative)
	 */
	private subdivConic(
		x1: number,
		y1: number,
		cx: number,
		cy: number,
		x3: number,
		y3: number,
		level: number,
	): void {
		// Max recursion depth
		if (level > 16) {
			this.renderLine(x3, y3);
			this.x = x3;
			this.y = y3;
			return;
		}

		// FreeType flatness test: |P0 + P2 - 2*P1| <= ONE_PIXEL/4
		// This measures the second derivative (how curved the quadratic is)
		let dx = abs(x1 + x3 - 2 * cx);
		const dy = abs(y1 + y3 - 2 * cy);
		if (dx < dy) dx = dy;

		if (dx <= ONE_PIXEL >> 2) {
			// Flat enough - render as line
			this.renderLine(x3, y3);
			this.x = x3;
			this.y = y3;
			return;
		}

		// De Casteljau subdivision at t=0.5
		const x12 = (x1 + cx) >> 1;
		const y12 = (y1 + cy) >> 1;
		const x23 = (cx + x3) >> 1;
		const y23 = (cy + y3) >> 1;
		const x123 = (x12 + x23) >> 1;
		const y123 = (y12 + y23) >> 1;

		// Recurse on both halves
		this.subdivConic(x1, y1, x12, y12, x123, y123, level + 1);
		this.subdivConic(x123, y123, x23, y23, x3, y3, level + 1);
	}

	/**
	 * Draw a cubic Bezier curve
	 */
	cubicTo(
		cx1: number,
		cy1: number,
		cx2: number,
		cy2: number,
		x: number,
		y: number,
	): void {
		this.subdivCubic(this.x, this.y, cx1, cy1, cx2, cy2, x, y, 0);
		this.x = x;
		this.y = y;
	}

	private subdivCubic(
		x1: number,
		y1: number,
		cx1: number,
		cy1: number,
		cx2: number,
		cy2: number,
		x4: number,
		y4: number,
		level: number,
	): void {
		if (level > 16) {
			this.renderLine(x4, y4);
			this.x = x4;
			this.y = y4;
			return;
		}

		// FreeType flatness test: check if control points are close to
		// chord trisection points. Uses ONE_PIXEL/2 threshold.
		// |2*P3 - 3*P2 + P0| and |P3 - 3*P1 + 2*P0| for each axis
		if (
			abs(2 * x4 - 3 * cx2 + x1) > ONE_PIXEL >> 1 ||
			abs(2 * y4 - 3 * cy2 + y1) > ONE_PIXEL >> 1 ||
			abs(x4 - 3 * cx1 + 2 * x1) > ONE_PIXEL >> 1 ||
			abs(y4 - 3 * cy1 + 2 * y1) > ONE_PIXEL >> 1
		) {
			// Need to subdivide
			// De Casteljau midpoints
			const x12 = (x1 + cx1) >> 1;
			const y12 = (y1 + cy1) >> 1;
			const x23 = (cx1 + cx2) >> 1;
			const y23 = (cy1 + cy2) >> 1;
			const x34 = (cx2 + x4) >> 1;
			const y34 = (cy2 + y4) >> 1;
			const x123 = (x12 + x23) >> 1;
			const y123 = (y12 + y23) >> 1;
			const x234 = (x23 + x34) >> 1;
			const y234 = (y23 + y34) >> 1;
			const x1234 = (x123 + x234) >> 1;
			const y1234 = (y123 + y234) >> 1;

			this.subdivCubic(x1, y1, x12, y12, x123, y123, x1234, y1234, level + 1);
			this.subdivCubic(x1234, y1234, x234, y234, x34, y34, x4, y4, level + 1);
			return;
		}

		// Flat enough - render as line
		this.renderLine(x4, y4);
		this.x = x4;
		this.y = y4;
	}

	/**
	 * Sweep all cells and render to bitmap
	 *
	 * Supports both top-down (positive pitch) and bottom-up (negative pitch) bitmaps.
	 * For positive pitch: y=0 is at top of image (first row in buffer)
	 * For negative pitch: y=0 is at bottom of image (last row in buffer)
	 */
	sweep(bitmap: Bitmap, fillRule: FillRule = FillRuleEnum.NonZero): void {
		// Calculate origin offset for pitch direction
		// Positive pitch (top-down): origin at start of buffer
		// Negative pitch (bottom-up): origin at (rows-1)*|pitch| for y=0 to be at bottom
		const pitch = bitmap.pitch;
		const origin = pitch < 0 ? (bitmap.rows - 1) * -pitch : 0;
		const bitmapWidth = bitmap.width;
		const bitmapRows = bitmap.rows;

		// Get interleaved cell array and ycells for direct iteration (avoids
		// generator overhead and object property access). Cell layout per index
		// i: [i*4]=x, [i*4+1]=area, [i*4+2]=cover, [i*4+3]=next.
		const cells = this.cells.getCells();
		const nullIndex = this.cells.getNullIndex();
		const ycells = this.cells.getYCells();
		const bandMinY = this.cells.getBandMinY();

		// Tighten the sweep to the non-empty cell row range. Cells are only ever
		// created inside [minY, maxY]; every row outside that is guaranteed null,
		// so skipping it is bit-identical to walking the full band.
		const cMinY = this.cells.minY;
		const cMaxY = this.cells.maxY;
		if (cMaxY < cMinY) return; // no cells
		const bandHeight = this.cells.getBandHeight();
		let startRow = cMinY - bandMinY;
		if (startRow < 0) startRow = 0;
		let endRow = cMaxY - bandMinY + 1;
		if (endRow > bandHeight) endRow = bandHeight;

		for (let i = startRow; i < endRow; i++) {
			const firstCellIndex = ycells[i]!;
			if (firstCellIndex === nullIndex) continue;

			const y = bandMinY + i;
			if (y < 0 || y >= bitmapRows) continue;

			let cover = 0;
			let x = 0;
			// For positive pitch: row = y * pitch (y=0 at top)
			// For negative pitch: row = origin - y * |pitch| (y=0 at bottom)
			const row = pitch < 0 ? origin - y * -pitch : y * pitch;

			// Walk linked list directly through the interleaved cell array
			let cellIndex = firstCellIndex;
			while (cellIndex !== nullIndex) {
				const base = cellIndex << 2;
				const cx = cells[base]!;

				// Fill span from previous x to current cell
				// FreeType: coverage = area >> (PIXEL_BITS * 2 + 1 - 8) = >> 9
				if (cx > x && cover !== 0) {
					const gray = this.applyFillRule(cover >> (PIXEL_BITS + 1), fillRule);
					if (gray > 0) {
						// Inline Math.max/min with ternary
						const start = x < 0 ? 0 : x;
						const end = cx > bitmapWidth ? bitmapWidth : cx;
						this.fillSpan(bitmap, row, start, end, gray);
					}
				}

				// Compute anti-aliased coverage for this edge cell
				// FreeType: cover += cell->cover * (ONE_PIXEL * 2)
				//           area = cover - cell->area
				// IMPORTANT: Update cover BEFORE calculating area (FreeType order)
				cover += cells[base + 2]! * (ONE_PIXEL * 2);
				const area = cover - cells[base + 1]!;
				const gray = this.applyFillRule(area >> (PIXEL_BITS + 1), fillRule);

				if (gray > 0 && cx >= 0 && cx < bitmapWidth) {
					this.setPixel(bitmap, row, cx, gray);
				}

				x = cx + 1;
				cellIndex = cells[base + 3]!;
			}

			// Fill remaining span
			if (x < bitmapWidth && cover !== 0) {
				const gray = this.applyFillRule(cover >> (PIXEL_BITS + 1), fillRule);
				if (gray > 0) {
					this.fillSpan(bitmap, row, x, bitmapWidth, gray);
				}
			}
		}
	}

	private applyFillRule(value: number, fillRule: FillRule): number {
		let v = value;
		if (v < 0) v = -v;

		if (fillRule === FillRuleEnum.EvenOdd) {
			v &= 511;
			if (v > 256) v = 512 - v;
		}

		return v > 255 ? 255 : v;
	}

	private fillSpan(
		bitmap: Bitmap,
		row: number,
		start: number,
		end: number,
		gray: number,
	): void {
		if (bitmap.pixelMode === PixelMode.Gray) {
			// Use native TypedArray.fill() for contiguous spans
			bitmap.buffer.fill(gray, row + start, row + end);
		} else if (bitmap.pixelMode === PixelMode.Mono) {
			if (gray >= 128) {
				for (let x = start; x < end; x++) {
					const byteIdx = row + (x >> 3);
					const bitIdx = 7 - (x & 7);
					bitmap.buffer[byteIdx] |= 1 << bitIdx;
				}
			}
		} else if (
			bitmap.pixelMode === PixelMode.LCD ||
			bitmap.pixelMode === PixelMode.LCD_V
		) {
			// LCD/LCD_V: 3 bytes per pixel (RGB subpixels)
			// For now, write same coverage to all 3 subpixels
			// A proper implementation would use subpixel positioning/orientation
			for (let x = start; x < end; x++) {
				const idx = row + x * 3;
				bitmap.buffer[idx] = gray;
				bitmap.buffer[idx + 1] = gray;
				bitmap.buffer[idx + 2] = gray;
			}
		} else if (bitmap.pixelMode === PixelMode.RGBA) {
			// RGBA: encode coverage in alpha, leave RGB black (mask texture)
			for (let x = start; x < end; x++) {
				const idx = row + x * 4;
				bitmap.buffer[idx] = 0;
				bitmap.buffer[idx + 1] = 0;
				bitmap.buffer[idx + 2] = 0;
				bitmap.buffer[idx + 3] = gray;
			}
		}
	}

	private setPixel(bitmap: Bitmap, row: number, x: number, gray: number): void {
		if (bitmap.pixelMode === PixelMode.Gray) {
			bitmap.buffer[row + x] = gray;
		} else if (bitmap.pixelMode === PixelMode.Mono) {
			if (gray >= 128) {
				const byteIdx = row + (x >> 3);
				const bitIdx = 7 - (x & 7);
				bitmap.buffer[byteIdx] |= 1 << bitIdx;
			}
		} else if (
			bitmap.pixelMode === PixelMode.LCD ||
			bitmap.pixelMode === PixelMode.LCD_V
		) {
			// LCD/LCD_V: 3 bytes per pixel (RGB subpixels)
			const idx = row + x * 3;
			bitmap.buffer[idx] = gray;
			bitmap.buffer[idx + 1] = gray;
			bitmap.buffer[idx + 2] = gray;
		} else if (bitmap.pixelMode === PixelMode.RGBA) {
			const idx = row + x * 4;
			bitmap.buffer[idx] = 0;
			bitmap.buffer[idx + 1] = 0;
			bitmap.buffer[idx + 2] = 0;
			bitmap.buffer[idx + 3] = gray;
		}
	}

	/**
	 * Sweep and call span callback (unbuffered)
	 * @param callback Span callback function
	 * @param fillRule Fill rule to apply
	 * @param userData User data passed to callback (like FreeType's render_span_data)
	 */
	sweepSpans<T = void>(
		callback: (y: number, spans: Span[], userData: T) => void,
		fillRule: FillRule = FillRuleEnum.NonZero,
		userData?: T,
	): void {
		const ycells = this.cells.getYCells();
		const cells = this.cells.getCells();
		const nullIndex = this.cells.getNullIndex();
		const bandMinY = this.cells.getBandMinY();

		for (let i = 0; i < ycells.length; i++) {
			let cellIndex = ycells[i]!;
			if (cellIndex === nullIndex) continue;

			const y = bandMinY + i;
			const spans: Span[] = [];
			let cover = 0;
			let spanStart = -1;

			while (cellIndex !== nullIndex) {
				const base = cellIndex << 2;
				const cx = cells[base]!;
				// If we have cover, emit span
				if (cover !== 0 && cx > spanStart + 1) {
					const gray = this.applyFillRule(cover >> (PIXEL_BITS + 1), fillRule);
					if (gray > 0) {
						spans.push({
							x: spanStart + 1,
							len: cx - spanStart - 1,
							coverage: gray,
						});
					}
				}

				// Edge cell - update cover BEFORE calculating area (FreeType order)
				cover += cells[base + 2]! * (ONE_PIXEL * 2);
				const area = cover - cells[base + 1]!;
				const gray = this.applyFillRule(area >> (PIXEL_BITS + 1), fillRule);
				if (gray > 0) {
					spans.push({ x: cx, len: 1, coverage: gray });
				}

				spanStart = cx;
				cellIndex = cells[base + 3]!;
			}

			if (spans.length > 0) {
				callback(y, spans, userData as T);
			}
		}
	}

	/**
	 * Sweep with span buffering (like FreeType's gray_sweep_direct)
	 * Buffers up to 16 spans before flushing for better performance
	 * @param callback Span callback function
	 * @param fillRule Fill rule to apply
	 * @param minX Minimum X clip bound
	 * @param maxX Maximum X clip bound
	 * @param userData User data passed to callback (like FreeType's render_span_data)
	 */
	sweepDirect<T = void>(
		callback: (y: number, spans: Span[], userData: T) => void,
		fillRule: FillRule = FillRuleEnum.NonZero,
		minX: number = 0,
		maxX: number = Infinity,
		userData?: T,
	): void {
		const spanBuffer: Span[] = [];
		const ycells = this.cells.getYCells();
		const cells = this.cells.getCells();
		const nullIndex = this.cells.getNullIndex();
		const bandMinY = this.cells.getBandMinY();

		for (let i = 0; i < ycells.length; i++) {
			let cellIndex = ycells[i]!;
			if (cellIndex === nullIndex) continue;

			const y = bandMinY + i;
			let cover = 0;
			let x = minX;

			while (cellIndex !== nullIndex) {
				const base = cellIndex << 2;
				const cx = cells[base]!;
				// Fill span from previous x to current cell
				if (cover !== 0 && cx > x) {
					const gray = this.applyFillRule(cover >> (PIXEL_BITS + 1), fillRule);
					if (gray > 0) {
						spanBuffer.push({ x, len: cx - x, coverage: gray });
						if (spanBuffer.length >= MAX_GRAY_SPANS) {
							callback(
								y,
								spanBuffer.splice(0, spanBuffer.length),
								userData as T,
							);
						}
					}
				}

				// Edge cell - update cover BEFORE calculating area (FreeType order)
				cover += cells[base + 2]! * (ONE_PIXEL * 2);
				const area = cover - cells[base + 1]!;
				const gray = this.applyFillRule(area >> (PIXEL_BITS + 1), fillRule);
				if (gray > 0 && cx >= minX && cx < maxX) {
					spanBuffer.push({ x: cx, len: 1, coverage: gray });
					if (spanBuffer.length >= MAX_GRAY_SPANS) {
						callback(y, spanBuffer.splice(0, spanBuffer.length), userData as T);
					}
				}

				x = cx + 1;
				cellIndex = cells[base + 3]!;
			}

			// Fill remaining span
			if (cover !== 0 && x < maxX) {
				const gray = this.applyFillRule(cover >> (PIXEL_BITS + 1), fillRule);
				if (gray > 0) {
					spanBuffer.push({
						x,
						len: Math.min(maxX, this.maxX + 1) - x,
						coverage: gray,
					});
				}
			}

			// Flush remaining spans for this row
			if (spanBuffer.length > 0) {
				callback(y, spanBuffer.splice(0, spanBuffer.length), userData as T);
			}
		}
	}

	/**
	 * Render with band processing for bounded memory.
	 * Divides large glyphs into bands, retries with bisection on overflow.
	 * This implementation only bisects in Y. FreeType can also retry narrower X
	 * bands because its edge conversion preserves the winding state at the X clip
	 * edges. Here CellBuffer clipping drops out-of-slice cells, which leaves sweep
	 * without the left-side cover needed to close spans correctly.
	 *
	 * @param bitmap Target bitmap
	 * @param decomposeFn Function that decomposes outline to rasterizer commands
	 * @param bounds Glyph bounds (minY, maxY, optionally minX, maxX)
	 * @param fillRule Fill rule to apply
	 */
	renderWithBands(
		bitmap: Bitmap,
		decomposeFn: () => void,
		bounds: { minY: number; maxY: number; minX?: number; maxX?: number },
		fillRule: FillRule = FillRuleEnum.NonZero,
	): void {
		// Calculate initial band height based on pool size
		// Aim for bands that use ~1/8 of pool to leave room for overflow
		const poolSize = 2048;
		const height = bounds.maxY - bounds.minY;
		let bandHeight = Math.max(1, Math.floor(poolSize / 8));

		// Adjust if glyph is small enough for single band
		if (height <= bandHeight) {
			bandHeight = height;
		}

		// Stack for vertical band bisection.
		const bandStack: Array<{
			minY: number;
			maxY: number;
			depth: number;
		}> = [];

		// Initial bands.
		for (let y = bounds.minY; y < bounds.maxY; y += bandHeight) {
			bandStack.push({
				minY: y,
				maxY: Math.min(y + bandHeight, bounds.maxY),
				depth: 0,
			});
		}

		// Process bands with Y bisection on overflow.
		while (bandStack.length > 0) {
			const band = bandStack.pop();
			if (!band) break;

			if (
				this.renderBand(bitmap, decomposeFn, band.minY, band.maxY, fillRule)
			) {
				continue; // Success
			}

			// Overflow - retry with a shorter vertical band.
			const bandDepth = band.depth;
			if (bandDepth >= MAX_BAND_DEPTH) {
				console.warn(
					`Rasterizer: band overflow at y=${band.minY}, depth limit reached`,
				);
				continue;
			}

			const childDepth = bandDepth + 1;
			const midY = (band.minY + band.maxY) >> 1;
			if (midY > band.minY) {
				bandStack.push({
					minY: midY,
					maxY: band.maxY,
					depth: childDepth,
				});
				bandStack.push({
					minY: band.minY,
					maxY: midY,
					depth: childDepth,
				});
				continue;
			}

			console.warn(
				`Rasterizer: band overflow at y=${band.minY}, cannot bisect further`,
			);
		}
	}

	/**
	 * Render a single vertical band.
	 * @returns true on success, false on pool overflow
	 */
	private renderBand(
		bitmap: Bitmap,
		decomposeFn: () => void,
		minY: number,
		maxY: number,
		fillRule: FillRule,
	): boolean {
		this.setClip(0, minY, bitmap.width, maxY);

		// Set up band bounds
		this.cells.setBandBounds(minY, maxY);
		this.cells.reset();
		this.minY = minY;
		this.maxY = maxY;

		try {
			// Decompose outline (may throw PoolOverflowError)
			decomposeFn();

			// Sweep and render to bitmap.
			this.sweep(bitmap, fillRule);
			return true;
		} catch (e) {
			if (e instanceof PoolOverflowError) {
				return false; // Need to bisect
			}
			throw e; // Re-throw other errors
		}
	}
}
