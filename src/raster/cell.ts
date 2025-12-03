/**
 * Cell management for scanline rasterization
 *
 * Based on FreeType's ftgrays.c cell accumulation approach.
 * Each cell tracks coverage and area for anti-aliased rendering.
 *
 * Uses pool-based allocation with overflow detection for bounded memory.
 */

import { truncPixel } from "./fixed-point.ts";

/** Default pool size (matches FreeType's FT_MAX_GRAY_POOL) */
const DEFAULT_POOL_SIZE = 2048;

/** Sentinel X value for null cell */
const CELL_MAX_X = 0x7fffffff;

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
 * A cell accumulates coverage information for one pixel
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
	/** Fixed-size cell pool */
	private pool: Cell[];
	/** Pool size */
	private poolSize: number;
	/** Next free cell index */
	private freeIndex: number;
	/** Per-scanline linked list heads (index into pool, -1 for empty) */
	private ycells: number[];

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

		// Pre-allocate pool
		this.pool = new Array(poolSize);
		for (let i = 0; i < poolSize; i++) {
			this.pool[i] = { x: 0, area: 0, cover: 0, next: -1 };
		}

		// Initialize null cell (sentinel)
		this.pool[this.nullCellIndex]!.x = CELL_MAX_X;
		this.pool[this.nullCellIndex]!.next = -1;

		this.ycells = [];
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
	 * Set band bounds for current render pass
	 */
	setBandBounds(minY: number, maxY: number): void {
		this.bandMinY = minY;
		this.bandMaxY = maxY;
		this.bandSet = true;

		// Resize ycells array for band height
		const height = maxY - minY;
		if (this.ycells.length < height) {
			this.ycells = new Array(height);
		}

		// Initialize all rows to null cell
		for (let i = 0; i < height; i++) {
			this.ycells[i] = this.nullCellIndex;
		}

		// Calculate how many cells we need for ycells pointers
		// Reserve space at start of pool for ycells (like FreeType)
		this.freeIndex = 0;
	}

	/**
	 * Clear all cells for new band
	 */
	reset(): void {
		// Reset pool
		this.freeIndex = 0;

		// Reset null cell
		this.pool[this.nullCellIndex]!.x = CELL_MAX_X;
		this.pool[this.nullCellIndex]!.area = 0;
		this.pool[this.nullCellIndex]!.cover = 0;
		this.pool[this.nullCellIndex]!.next = -1;

		// Reset ycells to null (only if band was set; otherwise leave for dynamic expansion)
		if (this.bandSet) {
			for (let i = 0; i < this.ycells.length; i++) {
				this.ycells[i] = this.nullCellIndex;
			}
		} else {
			// Clear ycells for dynamic mode - will be initialized on first use
			this.ycells = [];
			// Use very large bounds to avoid clipping before ensureYCellsCapacity is called
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
	 * Set current position (in subpixel coordinates)
	 * @throws PoolOverflowError if pool is exhausted
	 */
	setCurrentCell(x: number, y: number): void {
		const px = truncPixel(x);
		const py = truncPixel(y);

		// Check if we're already at this cell
		if (this.currentCellIndex >= 0 && this.currentX === px && this.currentY === py) {
			return;
		}

		// Check clipping (use band bounds for Y)
		if (
			py < this.bandMinY ||
			py >= this.bandMaxY ||
			px < this.clipMinX ||
			px >= this.clipMaxX
		) {
			this.currentCellIndex = this.nullCellIndex;
			this.currentX = px;
			this.currentY = py;
			return;
		}

		// Get or create cell for this position
		this.currentX = px;
		this.currentY = py;
		this.currentCellIndex = this.findOrCreateCell(px, py);

		// Update bounds
		this.minY = Math.min(this.minY, py);
		this.maxY = Math.max(this.maxY, py);
		this.minX = Math.min(this.minX, px);
		this.maxX = Math.max(this.maxX, px);
	}

	/**
	 * Find or create a cell at the given pixel position
	 * @throws PoolOverflowError if pool is exhausted
	 */
	private findOrCreateCell(x: number, y: number): number {
		// Auto-expand band if needed (for backward compatibility when setBandBounds not called)
		if (!this.bandSet) {
			this.ensureYCellsCapacity(y);
		}

		const rowIndex = y - this.bandMinY;
		if (rowIndex < 0 || rowIndex >= this.ycells.length) {
			return this.nullCellIndex;
		}

		// Walk linked list for this row
		let prevIndex = -1;
		let cellIndex = this.ycells[rowIndex]!;

		while (cellIndex !== this.nullCellIndex) {
			const cell = this.pool[cellIndex]!;
			if (cell.x === x) {
				return cellIndex; // Found existing cell
			}
			if (cell.x > x) {
				break; // Insert before this cell
			}
			prevIndex = cellIndex;
			cellIndex = cell.next;
		}

		// Need to allocate new cell
		if (this.freeIndex >= this.nullCellIndex) {
			throw new PoolOverflowError();
		}

		const newIndex = this.freeIndex++;
		const newCell = this.pool[newIndex]!;
		newCell.x = x;
		newCell.area = 0;
		newCell.cover = 0;
		newCell.next = cellIndex;

		// Link into list
		if (prevIndex === -1) {
			this.ycells[rowIndex] = newIndex;
		} else {
			this.pool[prevIndex]!.next = newIndex;
		}

		return newIndex;
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
			this.ycells = new Array(height);
			for (let i = 0; i < height; i++) {
				this.ycells[i] = this.nullCellIndex;
			}
			return;
		}

		// Expand if needed
		if (y < this.bandMinY) {
			const expand = this.bandMinY - y;
			const newYcells = new Array(this.ycells.length + expand);
			for (let i = 0; i < expand; i++) {
				newYcells[i] = this.nullCellIndex;
			}
			for (let i = 0; i < this.ycells.length; i++) {
				newYcells[expand + i] = this.ycells[i];
			}
			this.ycells = newYcells;
			this.bandMinY = y;
		} else if (y >= this.bandMaxY) {
			const newMaxY = y + 1;
			const oldLen = this.ycells.length;
			const newLen = newMaxY - this.bandMinY;
			if (newLen > oldLen) {
				const newYcells = new Array(newLen);
				for (let i = 0; i < oldLen; i++) {
					newYcells[i] = this.ycells[i];
				}
				for (let i = oldLen; i < newLen; i++) {
					newYcells[i] = this.nullCellIndex;
				}
				this.ycells = newYcells;
			}
			this.bandMaxY = newMaxY;
		}
	}

	/**
	 * Add area and cover to current cell
	 */
	addArea(area: number, cover: number): void {
		if (this.currentCellIndex >= 0) {
			const cell = this.pool[this.currentCellIndex]!;
			cell.area += area;
			cell.cover += cover;
		}
	}

	/**
	 * Get current cell area (for accumulation)
	 */
	getArea(): number {
		if (this.currentCellIndex >= 0) {
			return this.pool[this.currentCellIndex]!.area;
		}
		return 0;
	}

	/**
	 * Get current cell cover
	 */
	getCover(): number {
		if (this.currentCellIndex >= 0) {
			return this.pool[this.currentCellIndex]!.cover;
		}
		return 0;
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
			cells.push(this.pool[cellIndex]!);
			cellIndex = this.pool[cellIndex]!.next;
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
				cells.push(this.pool[cellIndex]!);
				cellIndex = this.pool[cellIndex]!.next;
			}
			if (cells.length > 0) {
				yield { y, cells };
			}
		}
	}

	/**
	 * Iterate cells for a single row (for band sweep)
	 */
	*iterateRowCells(y: number): Generator<Cell> {
		const rowIndex = y - this.bandMinY;
		if (rowIndex < 0 || rowIndex >= this.ycells.length) return;

		let cellIndex = this.ycells[rowIndex]!;
		while (cellIndex !== this.nullCellIndex) {
			yield this.pool[cellIndex]!;
			cellIndex = this.pool[cellIndex]!.next;
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
 * Apply even-odd fill rule
 */
export function applyEvenOddRule(cover: number): number {
	let c = cover;
	if (c < 0) c = -c;
	c &= 511; // Mod 512
	if (c > 256) c = 512 - c;
	if (c > 255) c = 255;
	return c;
}
