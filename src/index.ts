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
// CBDT/CBLC (Google color bitmap) tables
export type {
	BitmapGlyph,
	BitmapSize,
	CbdtTable,
	CblcTable,
	GlyphBitmapMetrics,
	IndexSubTable,
	SbitLineMetrics,
} from "./font/tables/cbdt.ts";
export {
	CbdtImageFormat,
	getBitmapGlyph,
	getColorBitmapSizes,
	hasColorBitmap,
} from "./font/tables/cbdt.ts";
// CFF charstring execution
export {
	executeCff2CharString,
	executeCffCharString,
	getCffGlyphWidth,
} from "./font/tables/cff-charstring.ts";
export type { CmapTable } from "./font/tables/cmap.ts";
// COLR/CPAL color tables
export type {
	Affine2x3,
	BaseGlyphPaintRecord,
	BaseGlyphRecord,
	ClipBox,
	ClipRecord,
	ColorLine,
	ColorStop,
	ColrTable,
	ItemVariationData,
	ItemVariationStore,
	LayerRecord,
	Paint,
	PaintColrGlyph,
	PaintColrLayers,
	PaintComposite,
	PaintGlyph,
	PaintLinearGradient,
	PaintRadialGradient,
	PaintRotate,
	PaintScale,
	PaintSkew,
	PaintSolid,
	PaintSweepGradient,
	PaintTransform,
	PaintTranslate,
	RegionAxisCoordinates,
	VarColorLine,
	VarColorStop,
	VariationRegion,
} from "./font/tables/colr.ts";
export {
	CompositeMode,
	Extend,
	getClipBox,
	getColorLayers,
	getColorPaint,
	getColorVariationDelta,
	getLayerPaint,
	hasColorGlyph,
	isColrV1,
	PaintFormat,
	parseColr,
} from "./font/tables/colr.ts";
export type { Color, ColorPalette, CpalTable } from "./font/tables/cpal.ts";
export {
	colorToHex,
	colorToRgba,
	getColor,
	PaletteType,
	parseCpal,
} from "./font/tables/cpal.ts";
// AAT feat table
export type {
	FeatTable,
	FeatureRecord,
	FeatureSetting,
} from "./font/tables/feat.ts";
export {
	aatToOpenTypeTag,
	CaseSensitiveLayoutSetting,
	CharacterShapeSetting,
	ContextualAlternativesSetting,
	DiacriticsSetting,
	FeatureFlags,
	FeatureType,
	FractionsSetting,
	getAllFeatures,
	getDefaultSetting,
	getFeature,
	getSettingByValue,
	hasSettingValue,
	isExclusiveFeature,
	LigatureSetting,
	LowerCaseSetting,
	NumberCaseSetting,
	NumberSpacingSetting,
	openTypeTagToAat,
	parseFeat,
	SmartSwashSetting,
	StylisticAlternativesSetting,
	UpperCaseSetting,
	VerticalPositionSetting,
} from "./font/tables/feat.ts";
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
export type { MvarTable, MvarValueRecord } from "./font/tables/mvar.ts";
export {
	getCapHeightDelta,
	getHAscenderDelta,
	getHDescenderDelta,
	getMetricDelta,
	getXHeightDelta,
	MvarTags,
} from "./font/tables/mvar.ts";
// SBIX (Apple bitmap) table
export type { SbixGlyph, SbixStrike, SbixTable } from "./font/tables/sbix.ts";
export {
	getAvailablePpemSizes,
	getGlyphBitmap as getSbixGlyphBitmap,
	getStrikeForPpem,
	hasGlyphBitmap,
	resolveDupeGlyph,
	SbixGraphicType,
} from "./font/tables/sbix.ts";
// STAT (Style Attributes) table
export type {
	AxisRecord,
	AxisValue,
	AxisValueFormat1,
	AxisValueFormat2,
	AxisValueFormat3,
	AxisValueFormat4,
	StatTable,
} from "./font/tables/stat.ts";
export {
	AxisValueFlags,
	findAxisValueByNameId,
	getAxisIndex,
	getAxisRecord,
	getAxisValueNumber,
	getAxisValuesForAxis,
	isElidableAxisValue,
	isOlderSiblingFont,
	matchAxisValue,
} from "./font/tables/stat.ts";
// SVG table for color fonts
export type { SvgDocumentRecord, SvgTable } from "./font/tables/svg.ts";
export {
	getSvgDocument,
	getSvgGlyphIds,
	hasSvgGlyph,
} from "./font/tables/svg.ts";
export type { TrackData, TrakTable } from "./font/tables/trak.ts";
export { applyTracking, getTrackingValue } from "./font/tables/trak.ts";
// Vertical metrics tables
export type { VheaTable } from "./font/tables/vhea.ts";
export type { VerticalMetric, VmtxTable } from "./font/tables/vmtx.ts";
export { getVerticalMetrics } from "./font/tables/vmtx.ts";
export type { VertOriginYMetric, VorgTable } from "./font/tables/vorg.ts";
export { getVertOriginY, hasVertOriginY } from "./font/tables/vorg.ts";
export type { VvarTable } from "./font/tables/vvar.ts";
export {
	getAdvanceHeightDelta,
	getBsbDelta,
	getTsbDelta,
	getVorgDelta,
} from "./font/tables/vvar.ts";
// Justification
export type {
	JustifyAdjustment,
	JustifyOptions,
	JustifyResult,
	LineBreakResult,
} from "./layout/justify.ts";
export {
	breakIntoLines,
	calculateLineWidth,
	JustifyMode,
	justify,
	justifyParagraph,
} from "./layout/justify.ts";
export type { ClassDef } from "./layout/structures/class-def.ts";
// Layout structures
export type { Coverage } from "./layout/structures/coverage.ts";
// Device tables
export type {
	DeviceOrVariationIndex,
	DeviceTable,
	VariationIndexTable,
} from "./layout/structures/device.ts";
export {
	applyDeviceAdjustment,
	getDeviceDelta,
	isVariationIndexTable,
} from "./layout/structures/device.ts";
// Feature variations
export type {
	Condition,
	ConditionSet,
	FeatureVariationRecord,
	FeatureVariations,
} from "./layout/structures/feature-variations.ts";
export {
	applyFeatureVariations,
	evaluateConditionSet,
	findMatchingFeatureVariation,
	getSubstitutedLookups,
} from "./layout/structures/feature-variations.ts";
export {
	bitmapToGray,
	bitmapToRGBA,
	rasterizeGlyph,
	rasterizePath,
	rasterizeText,
} from "./raster/rasterize.ts";
// Synthetic effects
export {
	obliquePath,
	emboldenPath,
	condensePath,
} from "./raster/synth.ts";
// Rasterization
export type {
	Bitmap,
	RasterizedGlyph,
	RasterizeOptions,
	Span,
} from "./raster/types.ts";
export {
	clearBitmap,
	createBitmap,
	FillRule,
	PixelMode,
} from "./raster/types.ts";
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
// Feature helpers
export {
	allSmallCaps,
	capitalSpacing,
	capsToSmallCaps,
	caseSensitiveForms,
	characterVariant,
	characterVariants,
	combineFeatures,
	contextualAlternates,
	discretionaryLigatures,
	feature,
	features,
	fractions,
	fullWidthForms,
	halfWidthForms,
	historicalLigatures,
	jis78Forms,
	jis83Forms,
	jis90Forms,
	jis2004Forms,
	kerning,
	liningFigures,
	oldstyleFigures,
	ordinals,
	petiteCaps,
	proportionalFigures,
	proportionalWidthForms,
	quarterWidthForms,
	ruby,
	scientificInferiors,
	simplifiedForms,
	slashedZero,
	smallCaps,
	standardLigatures,
	stylisticAlternates,
	stylisticSet,
	stylisticSets,
	subscript,
	superscript,
	swash,
	tabularFigures,
	thirdWidthForms,
	traditionalForms,
	verticalAlternatesRotation,
	verticalForms,
	verticalKanaAlternates,
	verticalLayoutFeatures,
} from "./shaper/features.ts";
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
// Line breaking (UAX #14)
export type { LineBreakAnalysis } from "./unicode/line-break.ts";
export {
	analyzeLineBreaks,
	analyzeLineBreaksForGlyphs,
	analyzeLineBreaksFromCodepoints,
	BreakAction,
	BreakOpportunity,
	canBreakAt,
	findNextBreak,
	getAllBreakOpportunities,
	getLineBreakClass,
	LineBreakClass,
	mustBreakAt,
} from "./unicode/line-break.ts";
// Unicode utilities
export {
	decompose,
	getCombiningClass,
	NormalizationMode,
	normalize,
	reorderMarks,
} from "./unicode/normalize.ts";
// Script detection
export type { ScriptRun } from "./unicode/script.ts";
export {
	detectScript,
	getScript,
	getScriptDirection,
	getScriptRuns,
	getScripts,
	getScriptTag,
	isComplexScript,
	isScript,
	Script,
} from "./unicode/script.ts";
// Text segmentation (UAX #29)
export type {
	GraphemeBoundaries,
	WordBoundaries,
} from "./unicode/segmentation.ts";
export {
	countGraphemes,
	findGraphemeBoundaries,
	findWordBoundaries,
	GraphemeBreakProperty,
	getGraphemeBreakProperty,
	getWordBreakProperty,
	splitGraphemes,
	splitWords,
	WordBreakProperty,
} from "./unicode/segmentation.ts";
