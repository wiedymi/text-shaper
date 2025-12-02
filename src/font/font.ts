import type { GlyphId, TableRecord, Tag } from "../types.ts";
import { Tags, tagToString } from "../types.ts";
import { Reader } from "./binary/reader.ts";
import { type CmapTable, getGlyphId, parseCmap } from "./tables/cmap.ts";
import { type HeadTable, parseHead } from "./tables/head.ts";
import { type HheaTable, parseHhea } from "./tables/hhea.ts";
import {
	type HmtxTable,
	getAdvanceWidth,
	getLeftSideBearing,
	parseHmtx,
} from "./tables/hmtx.ts";
import { type MaxpTable, parseMaxp } from "./tables/maxp.ts";
import { type FontDirectory, parseFontDirectory, isTrueType } from "./tables/sfnt.ts";
import { type GdefTable, parseGdef } from "./tables/gdef.ts";
import { type GsubTable, parseGsub } from "./tables/gsub.ts";
import { type GposTable, parseGpos } from "./tables/gpos.ts";

/** Font loading options */
export interface FontLoadOptions {
	/** Tables to parse eagerly (default: lazy) */
	eagerTables?: Tag[];
}

/**
 * Represents a loaded font file.
 * Tables are parsed lazily on first access.
 */
export class Font {
	private readonly reader: Reader;
	private readonly directory: FontDirectory;

	// Lazy-loaded tables
	private _head: HeadTable | null = null;
	private _maxp: MaxpTable | null = null;
	private _hhea: HheaTable | null = null;
	private _hmtx: HmtxTable | null = null;
	private _cmap: CmapTable | null = null;
	private _gdef: GdefTable | null | undefined = undefined;
	private _gsub: GsubTable | null | undefined = undefined;
	private _gpos: GposTable | null | undefined = undefined;

	private constructor(buffer: ArrayBuffer, _options: FontLoadOptions = {}) {
		this.reader = new Reader(buffer);
		this.directory = parseFontDirectory(this.reader);
	}

	/** Load font from ArrayBuffer */
	static load(buffer: ArrayBuffer, options?: FontLoadOptions): Font {
		return new Font(buffer, options);
	}

	/** Load font from URL (works in browser and Bun) */
	static async fromURL(url: string, options?: FontLoadOptions): Promise<Font> {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch font: ${response.status} ${response.statusText}`);
		}
		const buffer = await response.arrayBuffer();
		return Font.load(buffer, options);
	}

	/** Load font from file path (Bun only) */
	static async fromFile(path: string, options?: FontLoadOptions): Promise<Font> {
		const file = Bun.file(path);
		const buffer = await file.arrayBuffer();
		return Font.load(buffer, options);
	}

	// Table accessors

	/** Check if font has a specific table */
	hasTable(tag: Tag): boolean {
		return this.directory.tables.has(tag);
	}

	/** Get table record */
	getTableRecord(tag: Tag): TableRecord | undefined {
		return this.directory.tables.get(tag);
	}

	/** Get reader for a table */
	getTableReader(tag: Tag): Reader | null {
		const record = this.directory.tables.get(tag);
		if (!record) return null;
		return this.reader.slice(record.offset, record.length);
	}

	// Required tables (lazy-loaded)

	get head(): HeadTable {
		if (!this._head) {
			const reader = this.getTableReader(Tags.head);
			if (!reader) throw new Error("Missing required 'head' table");
			this._head = parseHead(reader);
		}
		return this._head;
	}

	get maxp(): MaxpTable {
		if (!this._maxp) {
			const reader = this.getTableReader(Tags.maxp);
			if (!reader) throw new Error("Missing required 'maxp' table");
			this._maxp = parseMaxp(reader);
		}
		return this._maxp;
	}

	get hhea(): HheaTable {
		if (!this._hhea) {
			const reader = this.getTableReader(Tags.hhea);
			if (!reader) throw new Error("Missing required 'hhea' table");
			this._hhea = parseHhea(reader);
		}
		return this._hhea;
	}

	get hmtx(): HmtxTable {
		if (!this._hmtx) {
			const reader = this.getTableReader(Tags.hmtx);
			if (!reader) throw new Error("Missing required 'hmtx' table");
			this._hmtx = parseHmtx(reader, this.hhea.numberOfHMetrics, this.numGlyphs);
		}
		return this._hmtx;
	}

	get cmap(): CmapTable {
		if (!this._cmap) {
			const record = this.getTableRecord(Tags.cmap);
			const reader = this.getTableReader(Tags.cmap);
			if (!reader || !record) throw new Error("Missing required 'cmap' table");
			this._cmap = parseCmap(reader, record.length);
		}
		return this._cmap;
	}

	get gdef(): GdefTable | null {
		if (this._gdef === undefined) {
			const reader = this.getTableReader(Tags.GDEF);
			this._gdef = reader ? parseGdef(reader) : null;
		}
		return this._gdef;
	}

	get gsub(): GsubTable | null {
		if (this._gsub === undefined) {
			const reader = this.getTableReader(Tags.GSUB);
			this._gsub = reader ? parseGsub(reader) : null;
		}
		return this._gsub;
	}

	get gpos(): GposTable | null {
		if (this._gpos === undefined) {
			const reader = this.getTableReader(Tags.GPOS);
			this._gpos = reader ? parseGpos(reader) : null;
		}
		return this._gpos;
	}

	// Convenience properties

	/** Number of glyphs in the font */
	get numGlyphs(): number {
		return this.maxp.numGlyphs;
	}

	/** Units per em */
	get unitsPerEm(): number {
		return this.head.unitsPerEm;
	}

	/** Ascender (from hhea) */
	get ascender(): number {
		return this.hhea.ascender;
	}

	/** Descender (from hhea) */
	get descender(): number {
		return this.hhea.descender;
	}

	/** Line gap (from hhea) */
	get lineGap(): number {
		return this.hhea.lineGap;
	}

	/** Is this a TrueType font (vs CFF)? */
	get isTrueType(): boolean {
		return isTrueType(this.directory);
	}

	/** Is this a CFF font? */
	get isCFF(): boolean {
		return this.hasTable(Tags.CFF) || this.hasTable(Tags.CFF2);
	}

	/** Is this a variable font? */
	get isVariable(): boolean {
		return this.hasTable(Tags.fvar);
	}

	/** Has OpenType layout tables? */
	get hasOpenTypeLayout(): boolean {
		return this.hasTable(Tags.GSUB) || this.hasTable(Tags.GPOS);
	}

	/** Has AAT layout tables? */
	get hasAATLayout(): boolean {
		return this.hasTable(Tags.morx) || this.hasTable(Tags.kerx);
	}

	// Glyph operations

	/** Get glyph ID for a Unicode codepoint */
	glyphId(codepoint: number): GlyphId {
		return getGlyphId(this.cmap, codepoint);
	}

	/** Get glyph ID for a character */
	glyphIdForChar(char: string): GlyphId {
		const codepoint = char.codePointAt(0);
		if (codepoint === undefined) return 0;
		return this.glyphId(codepoint);
	}

	/** Get advance width for a glyph */
	advanceWidth(glyphId: GlyphId): number {
		return getAdvanceWidth(this.hmtx, glyphId);
	}

	/** Get left side bearing for a glyph */
	leftSideBearing(glyphId: GlyphId): number {
		return getLeftSideBearing(this.hmtx, glyphId);
	}

	/** List all table tags in the font */
	listTables(): string[] {
		return Array.from(this.directory.tables.keys()).map(tagToString);
	}
}
