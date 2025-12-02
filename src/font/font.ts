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
import { type KernTable, parseKern } from "./tables/kern.ts";
import { type FvarTable, parseFvar } from "./tables/fvar.ts";
import { type HvarTable, parseHvar } from "./tables/hvar.ts";
import { type VheaTable, parseVhea } from "./tables/vhea.ts";
import { type VmtxTable, parseVmtx, getVerticalMetrics } from "./tables/vmtx.ts";
import { type MorxTable, parseMorx } from "./tables/morx.ts";
import { type GvarTable, parseGvar } from "./tables/gvar.ts";
import { type AvarTable, parseAvar } from "./tables/avar.ts";
import { type KerxTable, parseKerx } from "./tables/kerx.ts";
import { type TrakTable, parseTrak } from "./tables/trak.ts";
import { type CffTable, parseCff } from "./tables/cff.ts";
import { type Cff2Table, parseCff2 } from "./tables/cff2.ts";
import { type ColrTable, parseColr } from "./tables/colr.ts";
import { type CpalTable, parseCpal } from "./tables/cpal.ts";
import { type VvarTable, parseVvar } from "./tables/vvar.ts";
import { type MvarTable, parseMvar } from "./tables/mvar.ts";
import { type Os2Table, parseOs2 } from "./tables/os2.ts";
import { type NameTable, parseName } from "./tables/name.ts";
import { type PostTable, parsePost } from "./tables/post.ts";
import { type BaseTable, parseBase } from "./tables/base.ts";
import { type JstfTable, parseJstf } from "./tables/jstf.ts";
import { type MathTable, parseMath } from "./tables/math.ts";

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
	private _kern: KernTable | null | undefined = undefined;
	private _fvar: FvarTable | null | undefined = undefined;
	private _hvar: HvarTable | null | undefined = undefined;
	private _vhea: VheaTable | null | undefined = undefined;
	private _vmtx: VmtxTable | null | undefined = undefined;
	private _morx: MorxTable | null | undefined = undefined;
	private _gvar: GvarTable | null | undefined = undefined;
	private _avar: AvarTable | null | undefined = undefined;
	private _kerx: KerxTable | null | undefined = undefined;
	private _trak: TrakTable | null | undefined = undefined;
	private _cff: CffTable | null | undefined = undefined;
	private _cff2: Cff2Table | null | undefined = undefined;
	private _colr: ColrTable | null | undefined = undefined;
	private _cpal: CpalTable | null | undefined = undefined;
	private _vvar: VvarTable | null | undefined = undefined;
	private _mvar: MvarTable | null | undefined = undefined;
	private _os2: Os2Table | null | undefined = undefined;
	private _name: NameTable | null | undefined = undefined;
	private _post: PostTable | null | undefined = undefined;
	private _base: BaseTable | null | undefined = undefined;
	private _jstf: JstfTable | null | undefined = undefined;
	private _math: MathTable | null | undefined = undefined;

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

	get kern(): KernTable | null {
		if (this._kern === undefined) {
			const reader = this.getTableReader(Tags.kern);
			this._kern = reader ? parseKern(reader) : null;
		}
		return this._kern;
	}

	get fvar(): FvarTable | null {
		if (this._fvar === undefined) {
			const reader = this.getTableReader(Tags.fvar);
			this._fvar = reader ? parseFvar(reader) : null;
		}
		return this._fvar;
	}

	get hvar(): HvarTable | null {
		if (this._hvar === undefined) {
			const reader = this.getTableReader(Tags.HVAR);
			this._hvar = reader ? parseHvar(reader) : null;
		}
		return this._hvar;
	}

	get vhea(): VheaTable | null {
		if (this._vhea === undefined) {
			const reader = this.getTableReader(Tags.vhea);
			this._vhea = reader ? parseVhea(reader) : null;
		}
		return this._vhea;
	}

	get vmtx(): VmtxTable | null {
		if (this._vmtx === undefined) {
			const vhea = this.vhea;
			if (!vhea) {
				this._vmtx = null;
			} else {
				const reader = this.getTableReader(Tags.vmtx);
				this._vmtx = reader ? parseVmtx(reader, vhea.numberOfVMetrics, this.numGlyphs) : null;
			}
		}
		return this._vmtx;
	}

	get morx(): MorxTable | null {
		if (this._morx === undefined) {
			const reader = this.getTableReader(Tags.morx);
			this._morx = reader ? parseMorx(reader) : null;
		}
		return this._morx;
	}

	get gvar(): GvarTable | null {
		if (this._gvar === undefined) {
			const reader = this.getTableReader(Tags.gvar);
			this._gvar = reader ? parseGvar(reader, this.numGlyphs) : null;
		}
		return this._gvar;
	}

	get avar(): AvarTable | null {
		if (this._avar === undefined) {
			const fvar = this.fvar;
			if (!fvar) {
				this._avar = null;
			} else {
				const reader = this.getTableReader(Tags.avar);
				this._avar = reader ? parseAvar(reader, fvar.axes.length) : null;
			}
		}
		return this._avar;
	}

	get kerx(): KerxTable | null {
		if (this._kerx === undefined) {
			const reader = this.getTableReader(Tags.kerx);
			this._kerx = reader ? parseKerx(reader) : null;
		}
		return this._kerx;
	}

	get trak(): TrakTable | null {
		if (this._trak === undefined) {
			const reader = this.getTableReader(Tags.trak);
			this._trak = reader ? parseTrak(reader) : null;
		}
		return this._trak;
	}

	get cff(): CffTable | null {
		if (this._cff === undefined) {
			const reader = this.getTableReader(Tags.CFF);
			this._cff = reader ? parseCff(reader) : null;
		}
		return this._cff;
	}

	get cff2(): Cff2Table | null {
		if (this._cff2 === undefined) {
			const reader = this.getTableReader(Tags.CFF2);
			this._cff2 = reader ? parseCff2(reader) : null;
		}
		return this._cff2;
	}

	get colr(): ColrTable | null {
		if (this._colr === undefined) {
			const reader = this.getTableReader(Tags.COLR);
			this._colr = reader ? parseColr(reader) : null;
		}
		return this._colr;
	}

	get cpal(): CpalTable | null {
		if (this._cpal === undefined) {
			const reader = this.getTableReader(Tags.CPAL);
			this._cpal = reader ? parseCpal(reader) : null;
		}
		return this._cpal;
	}

	get vvar(): VvarTable | null {
		if (this._vvar === undefined) {
			const reader = this.getTableReader(Tags.VVAR);
			this._vvar = reader ? parseVvar(reader) : null;
		}
		return this._vvar;
	}

	get mvar(): MvarTable | null {
		if (this._mvar === undefined) {
			const reader = this.getTableReader(Tags.MVAR);
			this._mvar = reader ? parseMvar(reader) : null;
		}
		return this._mvar;
	}

	get os2(): Os2Table | null {
		if (this._os2 === undefined) {
			const reader = this.getTableReader(Tags.OS2);
			this._os2 = reader ? parseOs2(reader) : null;
		}
		return this._os2;
	}

	get name(): NameTable | null {
		if (this._name === undefined) {
			const reader = this.getTableReader(Tags.name);
			this._name = reader ? parseName(reader) : null;
		}
		return this._name;
	}

	get post(): PostTable | null {
		if (this._post === undefined) {
			const reader = this.getTableReader(Tags.post);
			this._post = reader ? parsePost(reader) : null;
		}
		return this._post;
	}

	get base(): BaseTable | null {
		if (this._base === undefined) {
			const reader = this.getTableReader(Tags.BASE);
			this._base = reader ? parseBase(reader) : null;
		}
		return this._base;
	}

	get jstf(): JstfTable | null {
		if (this._jstf === undefined) {
			const reader = this.getTableReader(Tags.JSTF);
			this._jstf = reader ? parseJstf(reader) : null;
		}
		return this._jstf;
	}

	get math(): MathTable | null {
		if (this._math === undefined) {
			const reader = this.getTableReader(Tags.MATH);
			this._math = reader ? parseMath(reader) : null;
		}
		return this._math;
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

	/** Is this a color font? */
	get isColorFont(): boolean {
		return this.hasTable(Tags.COLR) || this.hasTable(Tags.SVG);
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
