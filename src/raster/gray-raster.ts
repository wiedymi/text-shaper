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
import {
	abs,
	fracPixel,
	ONE_PIXEL,
	PIXEL_BITS,
	truncPixel,
} from "./fixed-point.ts";
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
	private minX: number = 0;
	private minY: number = 0;
	private maxX: number = 0;
	private maxY: number = 0;

	constructor() {
		this.cells = new CellBuffer();
	}

	/**
	 * Set clip rectangle (in pixels)
	 */
	setClip(minX: number, minY: number, maxX: number, maxY: number): void {
		this.minX = minX;
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
		let ey1 = truncPixel(this.y);
		const ey2 = truncPixel(toY);

		// Vertical clipping
		if (
			(ey1 >= this.maxY && ey2 >= this.maxY) ||
			(ey1 < this.minY && ey2 < this.minY)
		) {
			return;
		}

		const fy1 = fracPixel(this.y);
		const fy2 = fracPixel(toY);

		// Single scanline case
		if (ey1 === ey2) {
			this.renderScanline(ey1, this.x, fy1, toX, fy2);
			return;
		}

		const dx = toX - this.x;
		const dy = toY - this.y;

		// Vertical line - optimized path
		if (dx === 0) {
			const _ex = truncPixel(this.x);
			const twoFx = fracPixel(this.x) * 2;

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
			this.cells.setCurrentCell(this.x, ey1 << PIXEL_BITS);
			this.cells.addArea(delta * twoFx, delta);
			ey1 += incr;

			// Full scanlines
			this.cells.setCurrentCell(this.x, ey1 << PIXEL_BITS);
			delta = first + first - ONE_PIXEL;
			while (ey1 !== ey2) {
				this.cells.addArea(delta * twoFx, delta);
				ey1 += incr;
				this.cells.setCurrentCell(this.x, ey1 << PIXEL_BITS);
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

		if (dy > 0) {
			first = ONE_PIXEL;
			incr = 1;
		} else {
			first = 0;
			incr = -1;
		}

		// First partial scanline
		let delta = first - fy1;
		const xDelta = this.mulDiv(dx, delta, abs(dy));
		let x2 = x + xDelta;

		this.renderScanline(ey1, x, fy1, x2, first);
		x = x2;
		ey1 += incr;

		this.cells.setCurrentCell(x, ey1 << PIXEL_BITS);

		// Full scanlines
		if (ey1 !== ey2) {
			const xLift = this.mulDiv(dx, ONE_PIXEL, abs(dy));
			delta = first + first - ONE_PIXEL;

			while (ey1 !== ey2) {
				x2 = x + xLift;
				this.renderScanline(ey1, x, ONE_PIXEL - first, x2, first);
				x = x2;
				ey1 += incr;
				this.cells.setCurrentCell(x, ey1 << PIXEL_BITS);
			}
		}

		// Last partial scanline
		delta = fy2 - ONE_PIXEL + first;
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
		const ex1 = truncPixel(x1);
		const ex2 = truncPixel(x2);

		// Trivial case: horizontal line
		if (y1 === y2) {
			this.cells.setCurrentCell(x2, ey << PIXEL_BITS);
			return;
		}

		const fx1 = fracPixel(x1);
		const fx2 = fracPixel(x2);

		// Single cell case
		if (ex1 === ex2) {
			const delta = y2 - y1;
			this.cells.setCurrentCell(x1, ey << PIXEL_BITS);
			this.cells.addArea(delta * (fx1 + fx2), delta);
			return;
		}

		// Multiple cells
		const dx = x2 - x1;
		const dy = y2 - y1;

		let first: number;
		let incr: number;

		if (dx > 0) {
			first = ONE_PIXEL;
			incr = 1;
		} else {
			first = 0;
			incr = -1;
		}

		// First cell
		let delta = this.mulDiv(dy, first - fx1, abs(dx));
		this.cells.setCurrentCell(x1, ey << PIXEL_BITS);
		this.cells.addArea(delta * (fx1 + first), delta);

		let y = y1 + delta;
		let ex = ex1 + incr;
		this.cells.setCurrentCell(ex << PIXEL_BITS, ey << PIXEL_BITS);

		// Middle cells (full width)
		if (ex !== ex2) {
			const yLift = this.mulDiv(dy, ONE_PIXEL, abs(dx));

			while (ex !== ex2) {
				delta = yLift;
				this.cells.addArea(delta * ONE_PIXEL, delta);
				y += delta;
				ex += incr;
				this.cells.setCurrentCell(ex << PIXEL_BITS, ey << PIXEL_BITS);
			}
		}

		// Last cell
		delta = y2 - y;
		this.cells.addArea(delta * (fx2 + ONE_PIXEL - first), delta);
	}

	/**
	 * Multiply and divide with 64-bit precision
	 */
	private mulDiv(a: number, b: number, c: number): number {
		if (c === 0) return 0;
		return Math.trunc((a * b) / c);
	}

	/**
	 * Draw a quadratic Bezier curve using simple parametric sampling
	 */
	conicTo(cx: number, cy: number, toX: number, toY: number): void {
		const p0x = this.x;
		const p0y = this.y;

		// Estimate number of segments based on curve length
		const dx1 = cx - p0x;
		const dy1 = cy - p0y;
		const dx2 = toX - cx;
		const dy2 = toY - cy;
		const len =
			Math.sqrt(dx1 * dx1 + dy1 * dy1) + Math.sqrt(dx2 * dx2 + dy2 * dy2);

		// At least 4 segments, more for longer curves
		const numSegments = Math.max(4, Math.ceil(len / (ONE_PIXEL * 4)));

		for (let i = 1; i <= numSegments; i++) {
			const t = i / numSegments;
			const ti = 1 - t;
			// Quadratic bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
			const x = Math.round(ti * ti * p0x + 2 * ti * t * cx + t * t * toX);
			const y = Math.round(ti * ti * p0y + 2 * ti * t * cy + t * t * toY);
			this.renderLine(x, y);
			// Update current position for next segment
			this.x = x;
			this.y = y;
		}

		this.x = toX;
		this.y = toY;
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

		// Flatness test
		const dx = x4 - x1;
		const dy = y4 - y1;
		const d1 = abs((cx1 - x4) * dy - (cy1 - y4) * dx);
		const d2 = abs((cx2 - x4) * dy - (cy2 - y4) * dx);

		if (d1 + d2 <= (ONE_PIXEL >> 1) * (abs(dx) + abs(dy))) {
			this.renderLine(x4, y4);
			this.x = x4;
			this.y = y4;
			return;
		}

		this.subdivCubic(x1, y1, x12, y12, x123, y123, x1234, y1234, level + 1);
		this.subdivCubic(x1234, y1234, x234, y234, x34, y34, x4, y4, level + 1);
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

		for (const { y, cells } of this.cells.iterateCells()) {
			if (y < 0 || y >= bitmap.rows) continue;

			let cover = 0;
			let x = 0;
			// For positive pitch: row = y * pitch (y=0 at top)
			// For negative pitch: row = origin - y * |pitch| (y=0 at bottom)
			const row = pitch < 0 ? origin - y * -pitch : y * pitch;

			for (const cell of cells) {
				// Fill span from previous x to current cell
				if (cell.x > x && cover !== 0) {
					const gray = this.applyFillRule(cover, fillRule);
					if (gray > 0) {
						const start = Math.max(0, x);
						const end = Math.min(bitmap.width, cell.x);
						this.fillSpan(bitmap, row, start, end, gray);
					}
				}

				// Compute anti-aliased coverage for this edge cell
				// FreeType: cover += cell->cover * (ONE_PIXEL * 2)
				//           area = cover - cell->area
				// The area is SUBTRACTED from scaled cover, not added
				const scaledCover = cover * (ONE_PIXEL * 2);
				const area = scaledCover - cell.area;
				const gray = this.applyFillRule(area >> (PIXEL_BITS + 1), fillRule);

				if (gray > 0 && cell.x >= 0 && cell.x < bitmap.width) {
					this.setPixel(bitmap, row, cell.x, gray);
				}

				cover += cell.cover;
				x = cell.x + 1;
			}

			// Fill remaining span
			if (x < bitmap.width && cover !== 0) {
				const gray = this.applyFillRule(cover, fillRule);
				if (gray > 0) {
					this.fillSpan(bitmap, row, x, bitmap.width, gray);
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
			for (let x = start; x < end; x++) {
				bitmap.buffer[row + x] = gray;
			}
		} else if (bitmap.pixelMode === PixelMode.Mono) {
			if (gray >= 128) {
				for (let x = start; x < end; x++) {
					const byteIdx = row + (x >> 3);
					const bitIdx = 7 - (x & 7);
					bitmap.buffer[byteIdx] |= 1 << bitIdx;
				}
			}
		} else if (bitmap.pixelMode === PixelMode.LCD) {
			// LCD mode: 3 bytes per pixel (RGB subpixels)
			// For now, write same coverage to all 3 subpixels
			// A proper implementation would use subpixel positioning
			for (let x = start; x < end; x++) {
				const idx = row + x * 3;
				bitmap.buffer[idx] = gray;
				bitmap.buffer[idx + 1] = gray;
				bitmap.buffer[idx + 2] = gray;
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
		} else if (bitmap.pixelMode === PixelMode.LCD) {
			// LCD mode: 3 bytes per pixel (RGB subpixels)
			const idx = row + x * 3;
			bitmap.buffer[idx] = gray;
			bitmap.buffer[idx + 1] = gray;
			bitmap.buffer[idx + 2] = gray;
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
		for (const { y, cells } of this.cells.iterateCells()) {
			const spans: Span[] = [];
			let cover = 0;
			let spanStart = -1;

			for (const cell of cells) {
				// If we have cover, emit span
				if (cover !== 0 && cell.x > spanStart + 1) {
					const gray = this.applyFillRule(cover, fillRule);
					if (gray > 0) {
						spans.push({
							x: spanStart + 1,
							len: cell.x - spanStart - 1,
							coverage: gray,
						});
					}
				}

				// Edge cell - area is SUBTRACTED from scaled cover
				const scaledCover = cover * (ONE_PIXEL * 2);
				const area = scaledCover - cell.area;
				const gray = this.applyFillRule(area >> (PIXEL_BITS + 1), fillRule);
				if (gray > 0) {
					spans.push({ x: cell.x, len: 1, coverage: gray });
				}

				cover += cell.cover;
				spanStart = cell.x;
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

		for (const { y, cells } of this.cells.iterateCells()) {
			let cover = 0;
			let x = minX;

			for (const cell of cells) {
				// Fill span from previous x to current cell
				if (cover !== 0 && cell.x > x) {
					const gray = this.applyFillRule(cover, fillRule);
					if (gray > 0) {
						spanBuffer.push({ x, len: cell.x - x, coverage: gray });
						if (spanBuffer.length >= MAX_GRAY_SPANS) {
							callback(
								y,
								spanBuffer.splice(0, spanBuffer.length),
								userData as T,
							);
						}
					}
				}

				// Edge cell - area is SUBTRACTED from scaled cover
				const scaledCover = cover * (ONE_PIXEL * 2);
				const area = scaledCover - cell.area;
				const gray = this.applyFillRule(area >> (PIXEL_BITS + 1), fillRule);
				if (gray > 0 && cell.x >= minX && cell.x < maxX) {
					spanBuffer.push({ x: cell.x, len: 1, coverage: gray });
					if (spanBuffer.length >= MAX_GRAY_SPANS) {
						callback(y, spanBuffer.splice(0, spanBuffer.length), userData as T);
					}
				}

				cover += cell.cover;
				x = cell.x + 1;
			}

			// Fill remaining span
			if (cover !== 0 && x < maxX) {
				const gray = this.applyFillRule(cover, fillRule);
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
	 * Supports both Y-dimension (vertical) and X-dimension (horizontal) bisection
	 * like FreeType's ftgrays.c gray_convert_glyph.
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

		// X bounds default to bitmap width
		const xMin = bounds.minX ?? 0;
		const xMax = bounds.maxX ?? bitmap.width;

		// Stack for band bisection (like FreeType's bands[32])
		// Each band has Y bounds and X bounds for 2D bisection
		const bandStack: Array<{
			minY: number;
			maxY: number;
			minX: number;
			maxX: number;
		}> = [];

		// Initial bands (full X range for each Y band)
		for (let y = bounds.minY; y < bounds.maxY; y += bandHeight) {
			bandStack.push({
				minY: y,
				maxY: Math.min(y + bandHeight, bounds.maxY),
				minX: xMin,
				maxX: xMax,
			});
		}

		// Process bands with 2D bisection on overflow
		let depth = 0;
		while (bandStack.length > 0 && depth < MAX_BAND_DEPTH) {
			const band = bandStack.pop()!;

			if (
				this.renderBandWithXClip(
					bitmap,
					decomposeFn,
					band.minY,
					band.maxY,
					band.minX,
					band.maxX,
					fillRule,
				)
			) {
				continue; // Success
			}

			// Overflow - try X bisection first (like FreeType), then Y
			const midX = (band.minX + band.maxX) >> 1;
			if (midX > band.minX) {
				// Bisect in X dimension
				bandStack.push({
					minY: band.minY,
					maxY: band.maxY,
					minX: midX,
					maxX: band.maxX,
				});
				bandStack.push({
					minY: band.minY,
					maxY: band.maxY,
					minX: band.minX,
					maxX: midX,
				});
				depth++;
				continue;
			}

			// X can't be bisected, try Y
			const midY = (band.minY + band.maxY) >> 1;
			if (midY > band.minY) {
				// Bisect in Y dimension
				bandStack.push({
					minY: midY,
					maxY: band.maxY,
					minX: band.minX,
					maxX: band.maxX,
				});
				bandStack.push({
					minY: band.minY,
					maxY: midY,
					minX: band.minX,
					maxX: band.maxX,
				});
				depth++;
				continue;
			}

			// Can't bisect in either dimension - rotten glyph
			console.warn(
				`Rasterizer: band overflow at (${band.minX},${band.minY}), cannot bisect further`,
			);
		}
	}

	/**
	 * Render a single band with X clipping
	 * @returns true on success, false on pool overflow
	 */
	private renderBandWithXClip(
		bitmap: Bitmap,
		decomposeFn: () => void,
		minY: number,
		maxY: number,
		minX: number,
		maxX: number,
		fillRule: FillRule,
	): boolean {
		// Set up band bounds
		this.cells.setBandBounds(minY, maxY);
		this.cells.reset();
		this.minY = minY;
		this.maxY = maxY;

		try {
			// Decompose outline (may throw PoolOverflowError)
			decomposeFn();

			// Sweep and render to bitmap with X clipping
			this.sweepBandWithXClip(bitmap, minY, maxY, minX, maxX, fillRule);
			return true;
		} catch (e) {
			if (e instanceof PoolOverflowError) {
				return false; // Need to bisect
			}
			throw e; // Re-throw other errors
		}
	}

	/**
	 * Sweep a band with X clipping and render to bitmap
	 */
	private sweepBandWithXClip(
		bitmap: Bitmap,
		minY: number,
		maxY: number,
		minX: number,
		maxX: number,
		fillRule: FillRule,
	): void {
		const pitch = bitmap.pitch;
		const origin = pitch < 0 ? (bitmap.rows - 1) * -pitch : 0;

		for (let y = minY; y < maxY; y++) {
			if (y < 0 || y >= bitmap.rows) continue;

			let cover = 0;
			let x = minX;
			const row = pitch < 0 ? origin - y * -pitch : y * pitch;

			for (const cell of this.cells.iterateRowCells(y)) {
				// Skip cells outside X clip
				if (cell.x < minX) {
					cover += cell.cover;
					continue;
				}
				if (cell.x >= maxX) {
					// Fill remaining clipped span
					if (cover !== 0 && x < maxX) {
						const gray = this.applyFillRule(cover, fillRule);
						if (gray > 0) {
							this.fillSpan(
								bitmap,
								row,
								Math.max(0, x),
								Math.min(bitmap.width, maxX),
								gray,
							);
						}
					}
					break;
				}

				// Fill span from previous x to current cell
				if (cell.x > x && cover !== 0) {
					const gray = this.applyFillRule(cover, fillRule);
					if (gray > 0) {
						const start = Math.max(0, x);
						const end = Math.min(bitmap.width, cell.x);
						this.fillSpan(bitmap, row, start, end, gray);
					}
				}

				// Edge cell anti-aliasing - area is SUBTRACTED from scaled cover
				const scaledCover = cover * (ONE_PIXEL * 2);
				const area = scaledCover - cell.area;
				const gray = this.applyFillRule(area >> (PIXEL_BITS + 1), fillRule);

				if (gray > 0 && cell.x >= 0 && cell.x < bitmap.width) {
					this.setPixel(bitmap, row, cell.x, gray);
				}

				cover += cell.cover;
				x = cell.x + 1;
			}

			// Fill remaining span within X clip
			if (x < maxX && x < bitmap.width && cover !== 0) {
				const gray = this.applyFillRule(cover, fillRule);
				if (gray > 0) {
					this.fillSpan(bitmap, row, x, Math.min(bitmap.width, maxX), gray);
				}
			}
		}
	}
}
