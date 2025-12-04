import type { GlyphId, TableRecord, Tag } from "../types.ts";
import { Tags, tagToString } from "../types.ts";
import { Reader } from "./binary/reader.ts";
import { woff2ToSfnt } from "./woff2.ts";

// WOFF/WOFF2 magic numbers
const WOFF_MAGIC = 0x774f4646; // 'wOFF'
const WOFF2_MAGIC = 0x774f4632; // 'wOF2'

/** Check if buffer is WOFF2 format */
function isWoff2(buffer: ArrayBuffer): boolean {
	const view = new DataView(buffer);
	return view.getUint32(0, false) === WOFF2_MAGIC;
}

/** Check if buffer is WOFF format */
function isWoff(buffer: ArrayBuffer): boolean {
	const view = new DataView(buffer);
	return view.getUint32(0, false) === WOFF_MAGIC;
}

import { type AvarTable, parseAvar } from "./tables/avar.ts";
import { type BaseTable, parseBase } from "./tables/base.ts";
import {
	type CbdtTable,
	type CblcTable,
	parseCbdt,
	parseCblc,
} from "./tables/cbdt.ts";
import { type CffTable, parseCff } from "./tables/cff.ts";
import {
	executeCff2CharString,
	executeCffCharString,
} from "./tables/cff-charstring.ts";
import { type Cff2Table, parseCff2 } from "./tables/cff2.ts";
import { type CmapTable, getGlyphId, parseCmap } from "./tables/cmap.ts";
import { type ColrTable, parseColr } from "./tables/colr.ts";
import { type CpalTable, parseCpal } from "./tables/cpal.ts";
import { type FeatTable, parseFeat } from "./tables/feat.ts";
import { type FvarTable, parseFvar } from "./tables/fvar.ts";
import { type GaspTable, parseGasp } from "./tables/gasp.ts";
import { type GdefTable, parseGdef } from "./tables/gdef.ts";
import {
	type Contour,
	type GlyfTable,
	type Glyph,
	getGlyphBounds,
	getGlyphContours,
	getGlyphContoursWithVariation,
	parseGlyf,
	parseGlyph,
} from "./tables/glyf.ts";
import { type GposTable, parseGpos } from "./tables/gpos.ts";
import { type GsubTable, parseGsub } from "./tables/gsub.ts";
import { type GvarTable, parseGvar } from "./tables/gvar.ts";
import { type HeadTable, parseHead } from "./tables/head.ts";
import { type HheaTable, parseHhea } from "./tables/hhea.ts";
import {
	type CvtTable,
	type FpgmTable,
	type PrepTable,
	parseCvt,
	parseFpgm,
	parsePrep,
} from "./tables/hinting.ts";
import {
	getAdvanceWidth,
	getLeftSideBearing,
	type HmtxTable,
	parseHmtx,
} from "./tables/hmtx.ts";
import { type HvarTable, parseHvar } from "./tables/hvar.ts";
import { type JstfTable, parseJstf } from "./tables/jstf.ts";
import { type KernTable, parseKern } from "./tables/kern.ts";
import { type KerxTable, parseKerx } from "./tables/kerx.ts";
import { type LocaTable, parseLoca } from "./tables/loca.ts";
import { type MathTable, parseMath } from "./tables/math.ts";
import { type MaxpTable, parseMaxp } from "./tables/maxp.ts";
import { type MorxTable, parseMorx } from "./tables/morx.ts";
import { type MvarTable, parseMvar } from "./tables/mvar.ts";
import { type NameTable, parseName } from "./tables/name.ts";
import { type Os2Table, parseOs2 } from "./tables/os2.ts";
import { type PostTable, parsePost } from "./tables/post.ts";
import { parseSbix, type SbixTable } from "./tables/sbix.ts";
import {
	type FontDirectory,
	isTrueType,
	parseFontDirectory,
} from "./tables/sfnt.ts";
import { parseStat, type StatTable } from "./tables/stat.ts";
import { parseSvg, type SvgTable } from "./tables/svg.ts";
import { parseTrak, type TrakTable } from "./tables/trak.ts";
import { parseVhea, type VheaTable } from "./tables/vhea.ts";
import { parseVmtx, type VmtxTable } from "./tables/vmtx.ts";
import { parseVorg, type VorgTable } from "./tables/vorg.ts";
import { parseVvar, type VvarTable } from "./tables/vvar.ts";

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
	private _loca: LocaTable | null | undefined = undefined;
	private _glyf: GlyfTable | null | undefined = undefined;
	private _svg: SvgTable | null | undefined = undefined;
	private _vorg: VorgTable | null | undefined = undefined;
	private _sbix: SbixTable | null | undefined = undefined;
	private _stat: StatTable | null | undefined = undefined;
	private _cbdt: CbdtTable | null | undefined = undefined;
	private _cblc: CblcTable | null | undefined = undefined;
	private _feat: FeatTable | null | undefined = undefined;
	private _fpgm: FpgmTable | null | undefined = undefined;
	private _prep: PrepTable | null | undefined = undefined;
	private _cvt: CvtTable | null | undefined = undefined;
	private _gasp: GaspTable | null | undefined = undefined;

	private constructor(buffer: ArrayBuffer, _options: FontLoadOptions = {}) {
		this.reader = new Reader(buffer);
		this.directory = parseFontDirectory(this.reader);
	}

	/** Load font from ArrayBuffer (sync - does not support WOFF2) */
	static load(buffer: ArrayBuffer, options?: FontLoadOptions): Font {
		if (isWoff2(buffer)) {
			throw new Error(
				"WOFF2 requires async loading. Use Font.loadAsync() instead.",
			);
		}
		if (isWoff(buffer)) {
			throw new Error(
				"WOFF format is not supported. Please use TTF, OTF, or WOFF2.",
			);
		}
		return new Font(buffer, options);
	}

	/** Load font from ArrayBuffer with WOFF2 support (async) */
	static async loadAsync(
		buffer: ArrayBuffer,
		options?: FontLoadOptions,
	): Promise<Font> {
		if (isWoff2(buffer)) {
			buffer = await woff2ToSfnt(buffer);
		} else if (isWoff(buffer)) {
			throw new Error(
				"WOFF format is not supported. Please use TTF, OTF, or WOFF2.",
			);
		}
		return new Font(buffer, options);
	}

	/** Load font from URL (works in browser and Bun, supports WOFF2) */
	static async fromURL(url: string, options?: FontLoadOptions): Promise<Font> {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch font: ${response.status} ${response.statusText}`,
			);
		}
		const buffer = await response.arrayBuffer();
		return Font.loadAsync(buffer, options);
	}

	/** Load font from file path (Bun only, supports WOFF2) */
	static async fromFile(
		path: string,
		options?: FontLoadOptions,
	): Promise<Font> {
		const file = Bun.file(path);
		const buffer = await file.arrayBuffer();
		return Font.loadAsync(buffer, options);
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
			this._hmtx = parseHmtx(
				reader,
				this.hhea.numberOfHMetrics,
				this.numGlyphs,
			);
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
				this._vmtx = reader
					? parseVmtx(reader, vhea.numberOfVMetrics, this.numGlyphs)
					: null;
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

	get loca(): LocaTable | null {
		if (this._loca === undefined) {
			const reader = this.getTableReader(Tags.loca);
			this._loca = reader
				? parseLoca(reader, this.numGlyphs, this.head.indexToLocFormat)
				: null;
		}
		return this._loca;
	}

	get glyf(): GlyfTable | null {
		if (this._glyf === undefined) {
			const reader = this.getTableReader(Tags.glyf);
			this._glyf = reader ? parseGlyf(reader) : null;
		}
		return this._glyf;
	}

	get svg(): SvgTable | null {
		if (this._svg === undefined) {
			const reader = this.getTableReader(Tags.SVG);
			this._svg = reader ? parseSvg(reader) : null;
		}
		return this._svg;
	}

	get vorg(): VorgTable | null {
		if (this._vorg === undefined) {
			const reader = this.getTableReader(Tags.VORG);
			this._vorg = reader ? parseVorg(reader) : null;
		}
		return this._vorg;
	}

	get sbix(): SbixTable | null {
		if (this._sbix === undefined) {
			const reader = this.getTableReader(Tags.sbix);
			this._sbix = reader ? parseSbix(reader, this.numGlyphs) : null;
		}
		return this._sbix;
	}

	get stat(): StatTable | null {
		if (this._stat === undefined) {
			const reader = this.getTableReader(Tags.STAT);
			this._stat = reader ? parseStat(reader) : null;
		}
		return this._stat;
	}

	get cblc(): CblcTable | null {
		if (this._cblc === undefined) {
			const reader = this.getTableReader(Tags.CBLC);
			this._cblc = reader ? parseCblc(reader) : null;
		}
		return this._cblc;
	}

	get cbdt(): CbdtTable | null {
		if (this._cbdt === undefined) {
			const reader = this.getTableReader(Tags.CBDT);
			this._cbdt = reader ? parseCbdt(reader) : null;
		}
		return this._cbdt;
	}

	get feat(): FeatTable | null {
		if (this._feat === undefined) {
			const reader = this.getTableReader(Tags.feat);
			this._feat = reader ? parseFeat(reader) : null;
		}
		return this._feat;
	}

	get fpgm(): FpgmTable | null {
		if (this._fpgm === undefined) {
			const reader = this.getTableReader(Tags.fpgm);
			this._fpgm = reader ? parseFpgm(reader) : null;
		}
		return this._fpgm;
	}

	get prep(): PrepTable | null {
		if (this._prep === undefined) {
			const reader = this.getTableReader(Tags.prep);
			this._prep = reader ? parsePrep(reader) : null;
		}
		return this._prep;
	}

	get cvtTable(): CvtTable | null {
		if (this._cvt === undefined) {
			const reader = this.getTableReader(Tags.cvt);
			this._cvt = reader ? parseCvt(reader) : null;
		}
		return this._cvt;
	}

	get gasp(): GaspTable | null {
		if (this._gasp === undefined) {
			const reader = this.getTableReader(Tags.gasp);
			this._gasp = reader ? parseGasp(reader) : null;
		}
		return this._gasp;
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
		return (
			this.hasTable(Tags.COLR) ||
			this.hasTable(Tags.SVG) ||
			this.hasTable(Tags.sbix) ||
			this.hasTable(Tags.CBDT)
		);
	}

	/** Does this font have TrueType hinting? */
	get hasHinting(): boolean {
		return (
			this.isTrueType && (this.hasTable(Tags.fpgm) || this.hasTable(Tags.prep))
		);
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

	// Glyph outline operations

	/** Get raw glyph data (simple or composite) - TrueType only */
	getGlyph(glyphId: GlyphId): Glyph | null {
		if (!this.glyf || !this.loca) return null;
		return parseGlyph(this.glyf, this.loca, glyphId);
	}

	/** Get flattened contours for a glyph (resolves composites) */
	getGlyphContours(glyphId: GlyphId): Contour[] | null {
		// Try TrueType first
		if (this.glyf && this.loca) {
			return getGlyphContours(this.glyf, this.loca, glyphId);
		}
		// Try CFF
		if (this.cff) {
			return executeCffCharString(this.cff, glyphId, 0);
		}
		// Try CFF2
		if (this.cff2) {
			return executeCff2CharString(this.cff2, glyphId, null);
		}
		return null;
	}

	/** Get bounding box for a glyph */
	getGlyphBounds(
		glyphId: GlyphId,
	): { xMin: number; yMin: number; xMax: number; yMax: number } | null {
		// Try TrueType first
		if (this.glyf && this.loca) {
			return getGlyphBounds(this.glyf, this.loca, glyphId);
		}
		// For CFF, compute bounds from contours
		const contours = this.getGlyphContours(glyphId);
		if (!contours || contours.length === 0) return null;

		let xMin = Infinity;
		let yMin = Infinity;
		let xMax = -Infinity;
		let yMax = -Infinity;

		for (const contour of contours) {
			for (const point of contour) {
				xMin = Math.min(xMin, point.x);
				yMin = Math.min(yMin, point.y);
				xMax = Math.max(xMax, point.x);
				yMax = Math.max(yMax, point.y);
			}
		}

		if (xMin === Infinity) return null;
		return { xMin, yMin, xMax, yMax };
	}

	/** Get contours for a glyph with variation applied */
	getGlyphContoursWithVariation(
		glyphId: GlyphId,
		axisCoords: number[],
	): Contour[] | null {
		// Try TrueType first
		if (this.glyf && this.loca) {
			return getGlyphContoursWithVariation(
				this.glyf,
				this.loca,
				this.gvar,
				glyphId,
				axisCoords,
			);
		}
		// Try CFF2 with variation
		if (this.cff2) {
			return executeCff2CharString(this.cff2, glyphId, axisCoords);
		}
		// CFF doesn't support variations
		return this.getGlyphContours(glyphId);
	}
}
