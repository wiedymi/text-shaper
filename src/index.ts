// Core types
export * from "./types.ts";

// Font parsing
export { Font, type FontLoadOptions } from "./font/font.ts";
export { Face, createFace } from "./font/face.ts";
export { Reader } from "./font/binary/reader.ts";

// Required tables
export type { HeadTable } from "./font/tables/head.ts";
export type { MaxpTable } from "./font/tables/maxp.ts";
export type { HheaTable } from "./font/tables/hhea.ts";
export type { HmtxTable } from "./font/tables/hmtx.ts";
export type { CmapTable } from "./font/tables/cmap.ts";

// OpenType layout tables
export type { GdefTable } from "./font/tables/gdef.ts";
export type { GsubTable } from "./font/tables/gsub.ts";
export type { GposTable } from "./font/tables/gpos.ts";

// Variable font tables
export type { FvarTable, VariationAxis, NamedInstance } from "./font/tables/fvar.ts";
export { normalizeAxisValue } from "./font/tables/fvar.ts";
export type { GvarTable, GlyphVariationData, TupleVariationHeader } from "./font/tables/gvar.ts";
export { getGlyphDelta, calculateTupleScalar } from "./font/tables/gvar.ts";
export type { AvarTable, AxisSegmentMap } from "./font/tables/avar.ts";
export { applyAvar, applyAvarMapping } from "./font/tables/avar.ts";
export type { HvarTable } from "./font/tables/hvar.ts";
export { getAdvanceWidthDelta } from "./font/tables/hvar.ts";

// Vertical metrics tables
export type { VheaTable } from "./font/tables/vhea.ts";
export type { VmtxTable, VerticalMetric } from "./font/tables/vmtx.ts";
export { getVerticalMetrics } from "./font/tables/vmtx.ts";

// Legacy kern table
export type { KernTable, KernSubtable } from "./font/tables/kern.ts";
export { getKernValue } from "./font/tables/kern.ts";

// AAT tables
export type { MorxTable, MorxChain, MorxSubtable } from "./font/tables/morx.ts";
export { MorxSubtableType, applyNonContextual } from "./font/tables/morx.ts";
export type { KerxTable, KerxSubtable } from "./font/tables/kerx.ts";
export { getKerxValue } from "./font/tables/kerx.ts";
export type { TrakTable, TrackData } from "./font/tables/trak.ts";
export { getTrackingValue, applyTracking } from "./font/tables/trak.ts";

// Layout structures
export type { Coverage } from "./layout/structures/coverage.ts";
export type { ClassDef } from "./layout/structures/class-def.ts";

// Buffers
export { UnicodeBuffer } from "./buffer/unicode-buffer.ts";
export { GlyphBuffer } from "./buffer/glyph-buffer.ts";

// Shaper
export { shape, type ShapeOptions, type FontLike } from "./shaper/shaper.ts";
export { createShapePlan, getOrCreateShapePlan, type ShapePlan, type ShapeFeature } from "./shaper/shape-plan.ts";

// Fallback positioning
export { applyFallbackMarkPositioning, applyFallbackKerning } from "./shaper/fallback.ts";

// Unicode utilities
export { getCombiningClass, reorderMarks, decompose, normalize, NormalizationMode } from "./unicode/normalize.ts";

// BiDi processing (UAX #9)
export {
	getEmbeddings,
	getVisualOrder,
	reorderGlyphs,
	getMirror,
	applyMirroring,
	processBidi,
	detectDirection,
	isRTL,
	isLTR,
	getCharType,
	BidiType,
	type BidiResult,
	type BidiParagraph,
} from "./unicode/bidi.ts";

// AAT state machine
export {
	processRearrangement,
	processContextual,
	processLigature,
	processInsertion,
} from "./aat/state-machine.ts";
