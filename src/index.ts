// Core types

// AAT state machine
export {
	processContextual,
	processInsertion,
	processLigature,
	processRearrangement,
} from "./aat/state-machine.ts";
export { GlyphBuffer } from "./buffer/glyph-buffer.ts";
// Buffers
export { UnicodeBuffer } from "./buffer/unicode-buffer.ts";
export { Reader } from "./font/binary/reader.ts";
export { createFace, Face } from "./font/face.ts";
// Font parsing
export { Font, type FontLoadOptions } from "./font/font.ts";
export type { AvarTable, AxisSegmentMap } from "./font/tables/avar.ts";
export { applyAvar, applyAvarMapping } from "./font/tables/avar.ts";
export type { CmapTable } from "./font/tables/cmap.ts";
// Variable font tables
export type {
	FvarTable,
	NamedInstance,
	VariationAxis,
} from "./font/tables/fvar.ts";
export { normalizeAxisValue } from "./font/tables/fvar.ts";
// OpenType layout tables
export type { GdefTable } from "./font/tables/gdef.ts";
// Glyph outlines
export type {
	CompositeGlyph,
	Contour,
	Glyph,
	GlyphPoint,
	SimpleGlyph,
} from "./font/tables/glyf.ts";
export type { GposTable } from "./font/tables/gpos.ts";
export type { GsubTable } from "./font/tables/gsub.ts";
export type {
	GlyphVariationData,
	GvarTable,
	TupleVariationHeader,
} from "./font/tables/gvar.ts";
export { calculateTupleScalar, getGlyphDelta } from "./font/tables/gvar.ts";
// Required tables
export type { HeadTable } from "./font/tables/head.ts";
export type { HheaTable } from "./font/tables/hhea.ts";
export type { HmtxTable } from "./font/tables/hmtx.ts";
export type { HvarTable } from "./font/tables/hvar.ts";
export { getAdvanceWidthDelta } from "./font/tables/hvar.ts";
// Legacy kern table
export type { KernSubtable, KernTable } from "./font/tables/kern.ts";
export { getKernValue } from "./font/tables/kern.ts";
export type { KerxSubtable, KerxTable } from "./font/tables/kerx.ts";
export { getKerxValue } from "./font/tables/kerx.ts";
export type { LocaTable } from "./font/tables/loca.ts";
export { getGlyphLocation, hasGlyphOutline } from "./font/tables/loca.ts";
export type { MaxpTable } from "./font/tables/maxp.ts";
// AAT tables
export type { MorxChain, MorxSubtable, MorxTable } from "./font/tables/morx.ts";
export { applyNonContextual, MorxSubtableType } from "./font/tables/morx.ts";
export type { TrackData, TrakTable } from "./font/tables/trak.ts";
export { applyTracking, getTrackingValue } from "./font/tables/trak.ts";
// Vertical metrics tables
export type { VheaTable } from "./font/tables/vhea.ts";
export type { VerticalMetric, VmtxTable } from "./font/tables/vmtx.ts";
export { getVerticalMetrics } from "./font/tables/vmtx.ts";
export type { ClassDef } from "./layout/structures/class-def.ts";
// Layout structures
export type { Coverage } from "./layout/structures/coverage.ts";
// Rendering utilities
export type { GlyphPath, PathCommand, ShapedGlyph } from "./render/path.ts";
export {
	contourToPath,
	createPath2D,
	getGlyphPath,
	getGlyphPathWithVariation,
	getTextWidth,
	glyphBufferToShapedGlyphs,
	glyphToSVG,
	pathToCanvas,
	pathToSVG,
	renderShapedText,
	renderShapedTextWithVariation,
	shapedTextToSVG,
	shapedTextToSVGWithVariation,
} from "./render/path.ts";
// Fallback positioning
export {
	applyFallbackKerning,
	applyFallbackMarkPositioning,
} from "./shaper/fallback.ts";
export {
	createShapePlan,
	getOrCreateShapePlan,
	type ShapeFeature,
	type ShapePlan,
} from "./shaper/shape-plan.ts";
// Shaper
export { type FontLike, type ShapeOptions, shape } from "./shaper/shaper.ts";
export * from "./types.ts";
// BiDi processing (UAX #9)
export {
	applyMirroring,
	type BidiParagraph,
	type BidiResult,
	BidiType,
	detectDirection,
	getCharType,
	getEmbeddings,
	getMirror,
	getVisualOrder,
	isLTR,
	isRTL,
	processBidi,
	reorderGlyphs,
} from "./unicode/bidi.ts";
// Unicode utilities
export {
	decompose,
	getCombiningClass,
	NormalizationMode,
	normalize,
	reorderMarks,
} from "./unicode/normalize.ts";
