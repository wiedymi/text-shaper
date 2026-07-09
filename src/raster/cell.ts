/**
 * Cell management for scanline rasterization
 *
 * Based on FreeType's ftgrays.c cell accumulation approach.
 * Each cell tracks coverage and area for anti-aliased rendering.
 *
 * Uses pool-based allocation with overflow detection for bounded memory.
 *
 * Storage layout: cells live in a single interleaved Int32Array with a
 * stride of 4 (x, area, cover, next). This keeps the hot decompose/sweep
 * accesses monomorphic and packs each cell's four fields into one contiguous
 * 16-byte block (good cache locality for the linked-list walk), while matching
 * FreeType's 32-bit `int` cell semantics and avoiding per-cell object
 * allocation. The `Cell` object interface is kept only for the cold
 * compatibility accessors (getCellsForRow / iterateCells / iterateRowCells)
 * which materialize objects on demand.
 */

import { PIXEL_BITS } from "./fixed-point.ts";

/** Default pool size - larger than FreeType's 2048 to handle big glyphs */
const DEFAULT_POOL_SIZE = 16384;

/** Sentinel X value for null cell */
const CELL_MAX_X = 0x7fffffff;

/** Interleaved cell field stride and offsets */
const CELL_STRIDE = 4;
const OFF_X = 0;
const OFF_AREA = 1;
const OFF_COVER = 2;
const OFF_NEXT = 3;

/** Field stride for interleaved cell storage (x, area, cover, next). */
export const CELL_FIELD_STRIDE = CELL_STRIDE;

/**
 * Pool overflow error - thrown when cell pool is exhausted
 */
export class PoolOverflowError extends Error {
	constructor() {
		super("Cell pool overflow");
		this.name = "PoolOverflowError";
	}
}

/**
 * A cell accumulates coverage information for one pixel.
 * Materialized on demand by the compatibility accessors; the hot path uses
 * the interleaved cell array directly.
 */
export interface Cell {
	/** X coordinate in pixels */
	x: number;
	/** Accumulated signed area */
	area: number;
	/** Accumulated coverage (winding number contribution) */
	cover: number;
	/** Next cell in linked list (index into pool, -1 for end) */
	next: number;
}

/**
 * Cell storage with pool-based allocation and linked lists per scanline.
 * Matches FreeType's approach for bounded memory usage.
 */
export class CellBuffer {
	/** Interleaved cell fields: [x, area, cover, next] per cell */
	private cells: Int32Array;

	/** Pool size (cell count) */
	private poolSize: number;
	/** Next free cell index */
	private freeIndex: number;
	/** Per-scanline linked list heads (index into pool, nullCellIndex = empty) */
	private ycells: Int32Array;
	/** Number of active rows in ycells for the current band */
	private bandHeight: number = 0;

	/** Band bounds (Y range for current render pass) */
	private bandMinY: number = 0;
	private bandMaxY: number = 0;

	/** Bounding box of active cells */
	minY: number = Infinity;
	maxY: number = -Infinity;
	minX: number = Infinity;
	maxX: number = -Infinity;

	/** Current position for incremental cell updates */
	private currentX: number = 0;
	private currentY: number = 0;
	private currentCellIndex: number = -1;

	/** Clip bounds in pixels */
	private clipMinX: number = -Infinity;
	private clipMinY: number = -Infinity;
	private clipMaxX: number = Infinity;
	private clipMaxY: number = Infinity;

	/** Null cell index (sentinel at end of pool) */
	private nullCellIndex: number;

	/** Whether band bounds have been set */
	private bandSet: boolean = false;

	constructor(poolSize: number = DEFAULT_POOL_SIZE) {
		this.poolSize = poolSize;
		this.nullCellIndex = poolSize - 1;

		// Pre-allocate interleaved cell array
		this.cells = new Int32Array(poolSize * CELL_STRIDE);

		// Initialize null cell (sentinel)
		this.cells[this.nullCellIndex * CELL_STRIDE + OFF_X] = CELL_MAX_X;
		this.cells[this.nullCellIndex * CELL_STRIDE + OFF_NEXT] = -1;

		this.ycells = new Int32Array(0);
		this.freeIndex = 0;

		// Default band bounds (large range for backward compatibility)
		this.bandMinY = -10000;
		this.bandMaxY = 10000;
	}

	/**
	 * Set clipping bounds
	 */
	setClip(minX: number, minY: number, maxX: number, maxY: number): void {
		this.clipMinX = minX;
		this.clipMinY = minY;
		this.clipMaxX = maxX;
		this.clipMaxY = maxY;
	}

	/**
	 * Set band bounds for current render pass.
	 * Grows ycells if needed and clears the active rows to the null sentinel so
	 * the buffer is usable even if the caller does not immediately reset().
	 */
	setBandBounds(minY: number, maxY: number): void {
		this.bandMinY = minY;
		this.bandMaxY = maxY;
		this.bandSet = true;

		const height = maxY - minY;
		this.bandHeight = height > 0 ? height : 0;
		if (this.ycells.length < height) {
			this.ycells = new Int32Array(height);
		}
		this.ycells.fill(this.nullCellIndex, 0, this.bandHeight);
		this.freeIndex = 0;
	}

	/**
	 * Clear all cells for new band
	 */
	reset(): void {
		// Reset pool
		this.freeIndex = 0;

		// Reset null cell
		const nullBase = this.nullCellIndex * CELL_STRIDE;
		this.cells[nullBase + OFF_X] = CELL_MAX_X;
		this.cells[nullBase + OFF_AREA] = 0;
		this.cells[nullBase + OFF_COVER] = 0;
		this.cells[nullBase + OFF_NEXT] = -1;

		// Reset ycells to null. In band mode clear only the active rows;
		// otherwise fall back to dynamic expansion mode.
		if (this.bandSet) {
			this.ycells.fill(this.nullCellIndex, 0, this.bandHeight);
		} else {
			// Clear ycells for dynamic mode - will be initialized on first use
			this.ycells = new Int32Array(0);
			this.bandHeight = 0;
			// Use very large bounds to avoid clipping before ensureYCellsCapacity
			this.bandMinY = -100000;
			this.bandMaxY = 100000;
		}

		this.minY = Infinity;
		this.maxY = -Infinity;
		this.minX = Infinity;
		this.maxX = -Infinity;
		this.currentCellIndex = -1;
	}

	/**
	 * Set current position (in subpixel coordinates).
	 * Cold entry (tests, moveTo); the rasterizer hot path calls
	 * setCurrentCellPixel directly to skip the shift round-trip.
	 * @throws PoolOverflowError if pool is exhausted
	 */
	setCurrentCell(x: number, y: number): void {
		this.setCurrentCellPixel(x >> PIXEL_BITS, y >> PIXEL_BITS);
	}

	/**
	 * Find-or-create the current cell at already-truncated pixel coordinates.
	 * Hot-path entry that avoids the subpixel<->pixel shift round-trip the
	 * rasterizer would otherwise pay at every call site. Full body is inlined
	 * here (rather than delegating) so the hot path takes no extra call hop.
	 * @throws PoolOverflowError if pool is exhausted
	 */
	setCurrentCellPixel(px: number, py: number): void {
		// Check if we're already at this cell
		if (
			this.currentCellIndex >= 0 &&
			this.currentX === px &&
			this.currentY === py
		) {
			return;
		}

		// Clip check. The band-Y bound is intentionally NOT tested here: it is
		// exactly equivalent to the rowIndex range check below (invariant
		// bandHeight === bandMaxY - bandMinY), so testing it twice is wasted
		// work on every call.
		if (
			py < this.clipMinY ||
			py >= this.clipMaxY ||
			px < this.clipMinX ||
			px >= this.clipMaxX
		) {
			this.currentCellIndex = this.nullCellIndex;
			this.currentX = px;
			this.currentY = py;
			return;
		}

		this.currentX = px;
		this.currentY = py;

		// --- find-or-create cell for (px, py) ---
		if (!this.bandSet) {
			this.ensureYCellsCapacity(py);
		}

		const rowIndex = py - this.bandMinY;
		if (rowIndex < 0 || rowIndex >= this.bandHeight) {
			this.currentCellIndex = this.nullCellIndex;
			return;
		}

		const nullIndex = this.nullCellIndex;
		const cells = this.cells;

		let prevIndex = -1;
		let cellIndex = this.ycells[rowIndex]!;
		while (cellIndex !== nullIndex) {
			const cx = cells[cellIndex * CELL_STRIDE + OFF_X]!;
			if (cx === px) {
				// Existing cell: (px, py) is already inside [minX,maxX]x[minY,maxY]
				// because the bounds were recorded when this cell was created,
				// so no bounds update is needed here.
				this.currentCellIndex = cellIndex;
				return;
			}
			if (cx > px) break;
			prevIndex = cellIndex;
			cellIndex = cells[cellIndex * CELL_STRIDE + OFF_NEXT]!;
		}

		// Check pool overflow - throw to trigger band bisection
		if (this.freeIndex >= nullIndex) {
			throw new PoolOverflowError();
		}

		const newIndex = this.freeIndex++;
		const newBase = newIndex * CELL_STRIDE;
		cells[newBase + OFF_X] = px;
		cells[newBase + OFF_AREA] = 0;
		cells[newBase + OFF_COVER] = 0;
		cells[newBase + OFF_NEXT] = cellIndex;

		if (prevIndex === -1) {
			this.ycells[rowIndex] = newIndex;
		} else {
			cells[prevIndex * CELL_STRIDE + OFF_NEXT] = newIndex;
		}

		this.currentCellIndex = newIndex;

		// Update bounds
		if (py < this.minY) this.minY = py;
		if (py > this.maxY) this.maxY = py;
		if (px < this.minX) this.minX = px;
		if (px > this.maxX) this.maxX = px;
	}

	/**
	 * Ensure ycells array can accommodate the given Y coordinate
	 * Used for backward compatibility when setBandBounds is not called
	 */
	private ensureYCellsCapacity(y: number): void {
		// Initialize band if first access
		if (this.ycells.length === 0) {
			// Start with a reasonable range centered around y
			this.bandMinY = Math.min(y, 0);
			this.bandMaxY = Math.max(y + 1, 256);
			const height = this.bandMaxY - this.bandMinY;
			this.ycells = new Int32Array(height);
			this.ycells.fill(this.nullCellIndex);
			this.bandHeight = height;
			return;
		}

		// Expand if needed
		if (y < this.bandMinY) {
			const expand = this.bandMinY - y;
			const newYcells = new Int32Array(this.ycells.length + expand);
			newYcells.fill(this.nullCellIndex, 0, expand);
			newYcells.set(this.ycells, expand);
			this.ycells = newYcells;
			this.bandMinY = y;
			this.bandHeight = newYcells.length;
		} else if (y >= this.bandMaxY) {
			const newMaxY = y + 1;
			const oldLen = this.ycells.length;
			const newLen = newMaxY - this.bandMinY;
			if (newLen > oldLen) {
				const newYcells = new Int32Array(newLen);
				newYcells.set(this.ycells, 0);
				newYcells.fill(this.nullCellIndex, oldLen, newLen);
				this.ycells = newYcells;
				this.bandHeight = newLen;
			}
			this.bandMaxY = newMaxY;
		}
	}

	/**
	 * Add area and cover to current cell
	 */
	addArea(area: number, cover: number): void {
		if (this.currentCellIndex >= 0) {
			const base = this.currentCellIndex * CELL_STRIDE;
			this.cells[base + OFF_AREA] += area;
			this.cells[base + OFF_COVER] += cover;
		}
	}

	/**
	 * Get current cell area (for accumulation)
	 */
	getArea(): number {
		if (this.currentCellIndex >= 0) {
			return this.cells[this.currentCellIndex * CELL_STRIDE + OFF_AREA]!;
		}
		return 0;
	}

	/**
	 * Get current cell cover
	 */
	getCover(): number {
		if (this.currentCellIndex >= 0) {
			return this.cells[this.currentCellIndex * CELL_STRIDE + OFF_COVER]!;
		}
		return 0;
	}

	/**
	 * Materialize a Cell object for a pool index (compatibility accessor).
	 */
	private makeCell(index: number): Cell {
		const base = index * CELL_STRIDE;
		return {
			x: this.cells[base + OFF_X]!,
			area: this.cells[base + OFF_AREA]!,
			cover: this.cells[base + OFF_COVER]!,
			next: this.cells[base + OFF_NEXT]!,
		};
	}

	/**
	 * Get all cells for a given Y coordinate, sorted by X
	 */
	getCellsForRow(y: number): Cell[] {
		const rowIndex = y - this.bandMinY;
		if (rowIndex < 0 || rowIndex >= this.ycells.length) {
			return [];
		}

		const cells: Cell[] = [];
		let cellIndex = this.ycells[rowIndex]!;
		while (cellIndex !== this.nullCellIndex) {
			cells.push(this.makeCell(cellIndex));
			cellIndex = this.cells[cellIndex * CELL_STRIDE + OFF_NEXT]!;
		}
		return cells;
	}

	/**
	 * Iterate over all cells in scanline order within band
	 */
	*iterateCells(): Generator<{ y: number; cells: Cell[] }> {
		for (let i = 0; i < this.ycells.length; i++) {
			const y = this.bandMinY + i;
			let cellIndex = this.ycells[i]!;
			if (cellIndex === this.nullCellIndex) continue;

			const cells: Cell[] = [];
			while (cellIndex !== this.nullCellIndex) {
				cells.push(this.makeCell(cellIndex));
				cellIndex = this.cells[cellIndex * CELL_STRIDE + OFF_NEXT]!;
			}
			if (cells.length > 0) {
				yield { y, cells };
			}
		}
	}

	/**
	 * Iterate scanlines directly without allocating cell arrays
	 * Returns first cell index for each row, caller walks linked list via cells
	 */
	*iterateScanlines(): Generator<{ y: number; firstCellIndex: number }> {
		for (let i = 0; i < this.ycells.length; i++) {
			const cellIndex = this.ycells[i]!;
			if (cellIndex !== this.nullCellIndex) {
				yield { y: this.bandMinY + i, firstCellIndex: cellIndex };
			}
		}
	}

	/**
	 * Get the interleaved cell array for direct access during sweep.
	 * Layout per cell index i: [i*4+0]=x, [i*4+1]=area, [i*4+2]=cover, [i*4+3]=next
	 */
	getCells(): Int32Array {
		return this.cells;
	}

	/**
	 * Compatibility accessor: materialize the whole pool as Cell objects.
	 * Cold path (kept for tests / external inspection); the hot path uses
	 * getCells() and the interleaved layout directly.
	 */
	getPool(): Cell[] {
		const out: Cell[] = new Array(this.poolSize);
		for (let i = 0; i < this.poolSize; i++) {
			out[i] = this.makeCell(i);
		}
		return out;
	}

	/**
	 * Get the null cell index (sentinel value)
	 */
	getNullIndex(): number {
		return this.nullCellIndex;
	}

	/**
	 * Get ycells array for direct iteration (avoids generator overhead)
	 */
	getYCells(): Int32Array {
		return this.ycells;
	}

	/**
	 * Get band minimum Y for coordinate calculation
	 */
	getBandMinY(): number {
		return this.bandMinY;
	}

	/**
	 * Number of active scanline rows in the current band
	 */
	getBandHeight(): number {
		return this.bandHeight;
	}

	/**
	 * Iterate cells for a single row (for band sweep)
	 */
	*iterateRowCells(y: number): Generator<Cell> {
		const rowIndex = y - this.bandMinY;
		if (rowIndex < 0 || rowIndex >= this.ycells.length) return;

		let cellIndex = this.ycells[rowIndex]!;
		while (cellIndex !== this.nullCellIndex) {
			yield this.makeCell(cellIndex);
			cellIndex = this.cells[cellIndex * CELL_STRIDE + OFF_NEXT]!;
		}
	}

	/**
	 * Get number of cells currently allocated
	 */
	getCellCount(): number {
		return this.freeIndex;
	}

	/**
	 * Check if pool is near capacity
	 */
	isNearCapacity(): boolean {
		return this.freeIndex > this.poolSize * 0.9;
	}
}

/**
 * Convert cell coverage to 8-bit grayscale value
 *
 * The area is accumulated in 2*PIXEL_BITS precision.
 * We need to shift down to get 0-255 coverage.
 */
export function coverageToGray(area: number): number {
	// Area is in ONE_PIXEL * ONE_PIXEL precision
	// Shift down to 0-255 range
	let coverage = area >> (PIXEL_BITS * 2 - 8);

	// Clamp to 0-255
	if (coverage < 0) coverage = -coverage;
	if (coverage > 255) coverage = 255;

	return coverage;
}

/**
 * Apply non-zero winding fill rule
 */
export function applyNonZeroRule(cover: number): number {
	let c = cover;
	if (c < 0) c = -c;
	if (c > 255) c = 255;
	return c;
}

/**
 * Apply even-odd (alternating) fill rule
 */
export function applyEvenOddRule(cover: number): number {
	let c = cover;
	if (c < 0) c = -c;
	c &= 511; // Mod 512
	if (c > 256) c = 512 - c;
	if (c > 255) c = 255;
	return c;
}
