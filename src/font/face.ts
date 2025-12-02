import type { GlyphId, Tag, Variation } from "../types.ts";
import { tag } from "../types.ts";
import type { Font } from "./font.ts";
import { applyAvar } from "./tables/avar.ts";
import { normalizeAxisValue, type VariationAxis } from "./tables/fvar.ts";
import { getAdvanceWidthDelta, getLsbDelta } from "./tables/hvar.ts";

/**
 * A Face represents a specific instance of a variable font.
 * For non-variable fonts, it simply wraps the Font.
 */
export class Face {
	readonly font: Font;

	/** Normalized axis coordinates [-1, 1] */
	private _coords: number[];

	/** User-space axis values */
	private _variations: Map<Tag, number>;

	constructor(font: Font, variations?: Record<string, number> | Variation[]) {
		this.font = font;
		this._coords = [];
		this._variations = new Map();

		// Initialize to default axis values
		const fvar = font.fvar;
		if (fvar) {
			this._coords = new Array(fvar.axes.length).fill(0);

			// Apply user variations
			if (variations) {
				this.setVariations(variations);
			}
		}
	}

	/**
	 * Set variation axis values
	 * @param variations Object with axis tags as keys (e.g., { wght: 700, wdth: 100 })
	 *                   or array of Variation objects
	 */
	setVariations(variations: Record<string, number> | Variation[]): void {
		const fvar = this.font.fvar;
		if (!fvar) return;

		// Convert to map
		if (Array.isArray(variations)) {
			for (const v of variations) {
				this._variations.set(v.tag, v.value);
			}
		} else {
			for (const [tagStr, value] of Object.entries(variations)) {
				const t = tag(tagStr.padEnd(4, " "));
				this._variations.set(t, value);
			}
		}

		// Normalize coordinates
		for (let i = 0; i < fvar.axes.length; i++) {
			const axis = fvar.axes[i]!;
			const userValue = this._variations.get(axis.tag) ?? axis.defaultValue;
			this._coords[i] = normalizeAxisValue(axis, userValue);
		}

		// Apply avar mapping if present
		const avar = this.font.avar;
		if (avar) {
			this._coords = applyAvar(avar, this._coords);
		}
	}

	/**
	 * Get normalized coordinates for variation processing
	 */
	get normalizedCoords(): number[] {
		return this._coords;
	}

	/**
	 * Check if this is a variable font instance
	 */
	get isVariable(): boolean {
		return this.font.isVariable;
	}

	/**
	 * Get variation axes
	 */
	get axes(): VariationAxis[] {
		return this.font.fvar?.axes ?? [];
	}

	/**
	 * Get current value for an axis
	 */
	getAxisValue(axisTag: Tag | string): number | null {
		const t =
			typeof axisTag === "string" ? tag(axisTag.padEnd(4, " ")) : axisTag;
		const fvar = this.font.fvar;
		if (!fvar) return null;

		const value = this._variations.get(t);
		if (value !== undefined) return value;

		const axis = fvar.axes.find((a) => a.tag === t);
		return axis?.defaultValue ?? null;
	}

	/**
	 * Get advance width for a glyph, including variation deltas
	 */
	advanceWidth(glyphId: GlyphId): number {
		let advance = this.font.advanceWidth(glyphId);

		// Apply HVAR delta if variable
		if (this._coords.length > 0 && this.font.hvar) {
			const delta = getAdvanceWidthDelta(this.font.hvar, glyphId, this._coords);
			advance += delta;
		}

		return advance;
	}

	/**
	 * Get left side bearing for a glyph, including variation deltas
	 */
	leftSideBearing(glyphId: GlyphId): number {
		let lsb = this.font.leftSideBearing(glyphId);

		// Apply HVAR LSB delta if variable
		if (this._coords.length > 0 && this.font.hvar) {
			const delta = getLsbDelta(this.font.hvar, glyphId, this._coords);
			lsb += delta;
		}

		return lsb;
	}

	// Delegate common properties to font

	get numGlyphs(): number {
		return this.font.numGlyphs;
	}

	get unitsPerEm(): number {
		return this.font.unitsPerEm;
	}

	get ascender(): number {
		return this.font.ascender;
	}

	get descender(): number {
		return this.font.descender;
	}

	get lineGap(): number {
		return this.font.lineGap;
	}

	glyphId(codepoint: number): GlyphId {
		return this.font.glyphId(codepoint);
	}

	glyphIdForChar(char: string): GlyphId {
		return this.font.glyphIdForChar(char);
	}

	hasTable(t: Tag): boolean {
		return this.font.hasTable(t);
	}

	// Expose tables
	get gdef() {
		return this.font.gdef;
	}
	get gsub() {
		return this.font.gsub;
	}
	get gpos() {
		return this.font.gpos;
	}
	get kern() {
		return this.font.kern;
	}
	get morx() {
		return this.font.morx;
	}
	get cmap() {
		return this.font.cmap;
	}
	get hmtx() {
		return this.font.hmtx;
	}
	get hhea() {
		return this.font.hhea;
	}
}

/**
 * Create a face from a font with optional variations
 */
export function createFace(
	font: Font,
	variations?: Record<string, number> | Variation[],
): Face {
	return new Face(font, variations);
}
