// OpenType primitive types
export type uint8 = number;
export type int8 = number;
export type uint16 = number;
export type int16 = number;
export type uint32 = number;
export type int32 = number;
export type Fixed = number; // 16.16 fixed-point
export type F2Dot14 = number; // 2.14 fixed-point
export type FWord = number; // int16 in font units
export type UFWord = number; // uint16 in font units
export type Offset16 = number;
export type Offset32 = number;
export type GlyphId = number;

/** 4-character ASCII tag (packed as uint32 for efficiency) */
export type Tag = number;

/** Text direction */
export enum Direction {
	Invalid = 0,
	LTR = 4,
	RTL = 5,
	TTB = 6,
	BTT = 7,
}

/** Cluster level for glyph-character mapping */
export enum ClusterLevel {
	MonotoneGraphemes = 0,
	MonotoneCharacters = 1,
	Characters = 2,
}

/** Buffer flags */
export enum BufferFlags {
	Default = 0x0,
	BeginningOfText = 0x1,
	EndOfText = 0x2,
	PreserveDefaultIgnorables = 0x4,
	RemoveDefaultIgnorables = 0x8,
	DoNotInsertDottedCircle = 0x10,
}

/** Glyph classification from GDEF */
export enum GlyphClass {
	Base = 1,
	Ligature = 2,
	Mark = 3,
	Component = 4,
}

/** Feature specification for shaping */
export interface Feature {
	tag: Tag;
	value: number;
	start: number;
	end: number;
}

/** Variation axis value */
export interface Variation {
	tag: Tag;
	value: number;
}

/** Glyph info during shaping */
export interface GlyphInfo {
	glyphId: GlyphId;
	cluster: number;
	mask: number;
	/** Unicode codepoint (before shaping) */
	codepoint: number;
}

/** Glyph position after shaping */
export interface GlyphPosition {
	xAdvance: number;
	yAdvance: number;
	xOffset: number;
	yOffset: number;
}

/** Table record from font directory */
export interface TableRecord {
	tag: Tag;
	checksum: uint32;
	offset: Offset32;
	length: uint32;
}

/** Lookup flags for controlling glyph matching */
export interface LookupFlags {
	rightToLeft: boolean;
	ignoreBaseGlyphs: boolean;
	ignoreLigatures: boolean;
	ignoreMarks: boolean;
	useMarkFilteringSet: boolean;
	markAttachmentType: number;
	markFilteringSet?: number;
}

// Tag utilities
export function tag(str: string): Tag {
	if (str.length !== 4) {
		throw new Error(`Tag must be exactly 4 characters: "${str}"`);
	}
	return (
		(str.charCodeAt(0) << 24) |
		(str.charCodeAt(1) << 16) |
		(str.charCodeAt(2) << 8) |
		str.charCodeAt(3)
	);
}

export function tagToString(t: Tag): string {
	return String.fromCharCode(
		(t >> 24) & 0xff,
		(t >> 16) & 0xff,
		(t >> 8) & 0xff,
		t & 0xff,
	);
}

// Common tags
export const Tags = {
	// Required tables
	head: tag("head"),
	hhea: tag("hhea"),
	hmtx: tag("hmtx"),
	maxp: tag("maxp"),
	cmap: tag("cmap"),
	loca: tag("loca"),
	glyf: tag("glyf"),
	name: tag("name"),
	OS2: tag("OS/2"),
	post: tag("post"),

	// OpenType layout
	GDEF: tag("GDEF"),
	GSUB: tag("GSUB"),
	GPOS: tag("GPOS"),
	BASE: tag("BASE"),
	JSTF: tag("JSTF"),
	MATH: tag("MATH"),

	// CFF
	CFF: tag("CFF "),
	CFF2: tag("CFF2"),

	// Variable fonts
	fvar: tag("fvar"),
	gvar: tag("gvar"),
	avar: tag("avar"),
	HVAR: tag("HVAR"),
	VVAR: tag("VVAR"),
	MVAR: tag("MVAR"),

	// AAT
	morx: tag("morx"),
	kerx: tag("kerx"),
	kern: tag("kern"),
	trak: tag("trak"),
	feat: tag("feat"),

	// Color
	COLR: tag("COLR"),
	CPAL: tag("CPAL"),
	SVG: tag("SVG "),
	sbix: tag("sbix"),
	CBDT: tag("CBDT"),
	CBLC: tag("CBLC"),

	// Style Attributes
	STAT: tag("STAT"),

	// Vertical
	vhea: tag("vhea"),
	vmtx: tag("vmtx"),
	VORG: tag("VORG"),
} as const;

// Feature tags
export const FeatureTags = {
	// GSUB
	ccmp: tag("ccmp"),
	locl: tag("locl"),
	rlig: tag("rlig"),
	liga: tag("liga"),
	clig: tag("clig"),
	calt: tag("calt"),
	rclt: tag("rclt"),
	dlig: tag("dlig"),
	smcp: tag("smcp"),
	c2sc: tag("c2sc"),

	// Arabic
	isol: tag("isol"),
	init: tag("init"),
	medi: tag("medi"),
	fina: tag("fina"),

	// GPOS
	kern: tag("kern"),
	mark: tag("mark"),
	mkmk: tag("mkmk"),
	curs: tag("curs"),
	dist: tag("dist"),
} as const;
