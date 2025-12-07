import type { Font } from "../font/font.ts";
import {
	Direction,
	type GlyphId,
	type GlyphInfo,
	type GlyphPosition,
} from "../types.ts";

/**
 * Output buffer containing shaped glyphs.
 * Result of the shaping process.
 */
export class GlyphBuffer {
	/** Direction used during shaping */
	direction: Direction = Direction.LTR;

	/** Script used during shaping */
	script: string = "Zyyy";

	/** Language used during shaping */
	language: string | null = null;

	/** Glyph information array */
	infos: GlyphInfo[] = [];

	/** Glyph position array */
	positions: GlyphPosition[] = [];

	/** Deleted glyph markers for deferred removal */
	private _deleted: Uint8Array | null = null;

	/** Count of deleted glyphs pending compaction */
	private _deletedCount = 0;

	/** Pre-allocated info pool for reuse */
	private _infoPool: GlyphInfo[] = [];
	/** Pre-allocated position pool for reuse */
	private _posPool: GlyphPosition[] = [];

	/** Create buffer with pre-allocated capacity */
	static withCapacity(capacity: number): GlyphBuffer {
		const buffer = new GlyphBuffer();
		buffer.infos = new Array(capacity);
		buffer.positions = new Array(capacity);
		// Pre-create pool objects
		buffer._infoPool = new Array(capacity);
		buffer._posPool = new Array(capacity);
		for (let i = 0; i < capacity; i++) {
			buffer._infoPool[i] = { glyphId: 0, cluster: 0, mask: 0, codepoint: 0 };
			buffer._posPool[i] = { xAdvance: 0, yAdvance: 0, xOffset: 0, yOffset: 0 };
		}
		return buffer;
	}

	/** Number of glyphs */
	get length(): number {
		return this.infos.length;
	}

	/** Reset buffer for reuse - reuses existing object pool */
	reset(): void {
		this.infos.length = 0;
		this.positions.length = 0;
		this._deleted = null;
		this._deletedCount = 0;
	}

	/** Initialize from codepoints, reusing pooled objects when possible */
	initFromCodepoints(
		codepoints: ArrayLike<number>,
		clusters: ArrayLike<number>,
		getGlyphId: (codepoint: number) => number,
	): void {
		const len = codepoints.length;
		const poolLen = this._infoPool.length;

		// Expand pools if needed - batch allocate for efficiency
		if (poolLen < len) {
			// Pre-allocate to avoid repeated push calls
			const needed = len - poolLen;
			for (let i = 0; i < needed; i++) {
				this._infoPool.push({ glyphId: 0, cluster: 0, mask: 0, codepoint: 0 });
				this._posPool.push({
					xAdvance: 0,
					yAdvance: 0,
					xOffset: 0,
					yOffset: 0,
				});
			}
		}

		// Reuse pooled objects
		this.infos.length = len;
		this.positions.length = len;

		for (let i = 0; i < len; i++) {
			const codepoint = codepoints[i]!;
			const info = this._infoPool[i]!;
			info.glyphId = getGlyphId(codepoint);
			info.cluster = clusters[i]!;
			info.mask = 0xffffffff;
			info.codepoint = codepoint;
			this.infos[i] = info;

			const pos = this._posPool[i]!;
			pos.xAdvance = 0;
			pos.yAdvance = 0;
			pos.xOffset = 0;
			pos.yOffset = 0;
			this.positions[i] = pos;
		}

		this._deleted = null;
		this._deletedCount = 0;
	}

	/**
	 * Initialize from codepoints with direct font access (no closure).
	 * This is faster than initFromCodepoints for hot paths.
	 */
	initFromCodepointsWithFont(
		codepoints: ArrayLike<number>,
		clusters: ArrayLike<number>,
		font: Font,
	): void {
		const len = codepoints.length;
		const poolLen = this._infoPool.length;

		// Expand pools if needed - batch allocate for efficiency
		if (poolLen < len) {
			const needed = len - poolLen;
			for (let i = 0; i < needed; i++) {
				this._infoPool.push({ glyphId: 0, cluster: 0, mask: 0, codepoint: 0 });
				this._posPool.push({
					xAdvance: 0,
					yAdvance: 0,
					xOffset: 0,
					yOffset: 0,
				});
			}
		}

		// Reuse pooled objects
		this.infos.length = len;
		this.positions.length = len;

		for (let i = 0; i < len; i++) {
			const codepoint = codepoints[i]!;
			const info = this._infoPool[i]!;
			info.glyphId = font.glyphId(codepoint);
			info.cluster = clusters[i]!;
			info.mask = 0xffffffff;
			info.codepoint = codepoint;
			this.infos[i] = info;

			const pos = this._posPool[i]!;
			pos.xAdvance = 0;
			pos.yAdvance = 0;
			pos.xOffset = 0;
			pos.yOffset = 0;
			this.positions[i] = pos;
		}

		this._deleted = null;
		this._deletedCount = 0;
	}

	/** Initialize from glyph infos (positions zeroed) */
	initFromInfos(infos: GlyphInfo[]): void {
		this.infos = infos;
		// Pre-allocate positions array with exact size (avoid map allocation overhead)
		const len = infos.length;
		const positions: GlyphPosition[] = new Array(len);
		for (let i = 0; i < len; i++) {
			positions[i] = { xAdvance: 0, yAdvance: 0, xOffset: 0, yOffset: 0 };
		}
		this.positions = positions;
	}

	/** Set advance width for a glyph */
	setAdvance(index: number, xAdvance: number, yAdvance = 0): void {
		const pos = this.positions[index];
		if (pos) {
			pos.xAdvance = xAdvance;
			pos.yAdvance = yAdvance;
		}
	}

	/** Add offset to a glyph position */
	addOffset(index: number, xOffset: number, yOffset: number): void {
		const pos = this.positions[index];
		if (pos) {
			pos.xOffset += xOffset;
			pos.yOffset += yOffset;
		}
	}

	/** Replace glyph at index */
	replaceGlyph(index: number, glyphId: GlyphId): void {
		const info = this.infos[index];
		if (info) {
			info.glyphId = glyphId;
		}
	}

	/** Insert glyph at index */
	insertGlyph(index: number, info: GlyphInfo, position: GlyphPosition): void {
		this.infos.splice(index, 0, info);
		this.positions.splice(index, 0, position);
		// Expand deleted array if needed
		if (this._deleted) {
			const newDeleted = new Uint8Array(this.infos.length);
			// Copy old values, shifting indices after insertion point
			for (let i = 0; i < index; i++) {
				newDeleted[i] = this._deleted[i];
			}
			newDeleted[index] = 0; // New glyph is not deleted
			for (let i = index; i < this._deleted.length; i++) {
				newDeleted[i + 1] = this._deleted[i];
			}
			this._deleted = newDeleted;
		}
	}

	/** Remove glyphs in range [start, end) */
	removeRange(start: number, end: number): void {
		const count = end - start;
		this.infos.splice(start, count);
		this.positions.splice(start, count);
		// Shrink deleted array if exists
		if (this._deleted && this._deleted.length > this.infos.length) {
			this._deleted = this._deleted.slice(0, this.infos.length);
		}
	}

	/**
	 * Mark a glyph for deferred deletion. Much faster than removeRange for
	 * multiple deletions - call compact() once at end of GSUB phase.
	 */
	markDeleted(index: number): void {
		if (!this._deleted) {
			this._deleted = new Uint8Array(this.infos.length);
		}
		if (!this._deleted[index]) {
			this._deleted[index] = 1;
			this._deletedCount++;
		}
	}

	/** Check if a glyph is marked for deletion */
	isDeleted(index: number): boolean {
		return this._deleted ? this._deleted[index] === 1 : false;
	}

	/** Returns true if there are pending deletions */
	hasPendingDeletions(): boolean {
		return this._deletedCount > 0;
	}

	/**
	 * Compact buffer by removing all marked-for-deletion glyphs in a single O(n) pass.
	 * Call this after GSUB phase.
	 */
	compact(): void {
		if (this._deletedCount === 0 || !this._deleted) return;

		let writeIdx = 0;
		for (let readIdx = 0; readIdx < this.infos.length; readIdx++) {
			if (!this._deleted[readIdx]) {
				if (writeIdx !== readIdx) {
					this.infos[writeIdx] = this.infos[readIdx];
					this.positions[writeIdx] = this.positions[readIdx];
				}
				writeIdx++;
			}
		}

		this.infos.length = writeIdx;
		this.positions.length = writeIdx;
		this._deleted = null;
		this._deletedCount = 0;
	}

	/** Merge clusters from start to end (inclusive) */
	mergeClusters(start: number, end: number): void {
		if (start >= end || start < 0 || end >= this.infos.length) return;

		const cluster = this.infos[start]?.cluster;
		for (let i = start + 1; i <= end; i++) {
			const info = this.infos[i];
			if (info) {
				info.cluster = cluster;
			}
		}
	}

	/** Reverse glyph order (for RTL) */
	reverse(): void {
		this.infos.reverse();
		this.positions.reverse();
	}

	/** Reverse range [start, end) */
	reverseRange(start: number, end: number): void {
		let i = start;
		let j = end - 1;
		while (i < j) {
			// Swap infos
			const tmpInfo = this.infos[i];
			const tmpInfoJ = this.infos[j];
			if (!tmpInfo || !tmpInfoJ) break;
			this.infos[i] = tmpInfoJ;
			this.infos[j] = tmpInfo;

			// Swap positions
			const tmpPos = this.positions[i];
			const tmpPosJ = this.positions[j];
			if (!tmpPos || !tmpPosJ) break;
			this.positions[i] = tmpPosJ;
			this.positions[j] = tmpPos;

			i++;
			j--;
		}
	}

	/** Get total advance width */
	getTotalAdvance(): { x: number; y: number } {
		let x = 0;
		let y = 0;
		const positions = this.positions;
		for (let i = 0; i < positions.length; i++) {
			const pos = positions[i]!;
			x += pos.xAdvance;
			y += pos.yAdvance;
		}
		return { x, y };
	}

	/** Serialize to HarfBuzz-compatible format */
	serialize(): string {
		const parts: string[] = [];
		const infos = this.infos;
		const positions = this.positions;

		for (let i = 0; i < infos.length; i++) {
			const info = infos[i]!;
			const pos = positions[i];
			if (!pos) continue;

			let str = `${info.glyphId}`;

			// Add cluster if not sequential
			if (i === 0 || info.cluster !== infos[i - 1]?.cluster) {
				str += `=${info.cluster}`;
			}

			// Add positioning
			if (pos.xOffset !== 0 || pos.yOffset !== 0) {
				str += `@${pos.xOffset},${pos.yOffset}`;
			}
			if (pos.xAdvance !== 0) {
				str += `+${pos.xAdvance}`;
			}

			parts.push(str);
		}

		return `[${parts.join("|")}]`;
	}

	/** Get glyph IDs as array */
	glyphIds(): GlyphId[] {
		return this.infos.map((info) => info.glyphId);
	}

	/** Get clusters as array */
	clusters(): number[] {
		return this.infos.map((info) => info.cluster);
	}

	/** Iterator for glyph info/position pairs */
	*[Symbol.iterator](): Iterator<{ info: GlyphInfo; position: GlyphPosition }> {
		const infos = this.infos;
		const positions = this.positions;
		for (let i = 0; i < infos.length; i++) {
			const info = infos[i]!;
			const position = positions[i];
			if (!position) continue;
			yield { info, position };
		}
	}
}
