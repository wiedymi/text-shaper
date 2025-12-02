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

	/** Create buffer with pre-allocated capacity */
	static withCapacity(capacity: number): GlyphBuffer {
		const buffer = new GlyphBuffer();
		buffer.infos = new Array(capacity);
		buffer.positions = new Array(capacity);
		return buffer;
	}

	/** Number of glyphs */
	get length(): number {
		return this.infos.length;
	}

	/** Initialize from glyph infos (positions zeroed) */
	initFromInfos(infos: GlyphInfo[]): void {
		this.infos = infos;
		this.positions = infos.map(() => ({
			xAdvance: 0,
			yAdvance: 0,
			xOffset: 0,
			yOffset: 0,
		}));
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
	}

	/** Remove glyphs in range [start, end) */
	removeRange(start: number, end: number): void {
		const count = end - start;
		this.infos.splice(start, count);
		this.positions.splice(start, count);
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
		for (const pos of this.positions) {
			x += pos.xAdvance;
			y += pos.yAdvance;
		}
		return { x, y };
	}

	/** Serialize to HarfBuzz-compatible format */
	serialize(): string {
		const parts: string[] = [];

		for (const [i, info] of this.infos.entries()) {
			const pos = this.positions[i];
			if (!pos) continue;

			let str = `${info.glyphId}`;

			// Add cluster if not sequential
			if (i === 0 || info.cluster !== this.infos[i - 1]?.cluster) {
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
		for (const [i, info] of this.infos.entries()) {
			const position = this.positions[i];
			if (!position) continue;
			yield { info, position };
		}
	}
}
