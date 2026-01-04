// Core types

// AAT state machine
export {
	processContextual,
	processInsertion,
	processLigature,
	processRearrangement,
} from "./aat/state-machine.ts";
// TrueType hinting
export {
	// Interpreter
	execute,
	runCVTProgram,
	runFontProgram,
	runGlyphProgram,
	runProgram,
	setCodeRange,
	// Programs
	createHintingEngine,
	executeFontProgram,
	type GlyphOutline,
	type HintedGlyph,
	type HintingEngine,
	hintedToPixels,
	hintGlyph,
	loadCVTProgram,
	loadFontProgram,
	setSize,
	// Rounding
	compensate,
	parseSuperRound,
	round,
	roundDownToGrid,
	roundOff,
	roundSuper,
	roundSuper45,
	roundToDoubleGrid,
	roundToGrid,
	roundToHalfGrid,
	roundUpToGrid,
	// Types
	type CallRecord,
	CodeRange,
	createDefaultGraphicsState,
	createExecContext,
	createGlyphZone,
	type ExecContext,
	type F2Dot14,
	type F26Dot6,
	type FunctionDef,
	type GlyphZone,
	type GraphicsState,
	type InstructionDef,
	Opcode,
	type Point as HintingPoint,
	RoundMode,
	TouchFlag,
	type UnitVector,
} from "./hinting/index.ts";
export { GlyphBuffer } from "./buffer/glyph-buffer.ts";
// Buffers
export { UnicodeBuffer } from "./buffer/unicode-buffer.ts";
// Fluent API - Builder classes
// Fluent API - Entry points
// Fluent API - Pipe function
// Fluent API - Pipe operators (prefixed with $ to avoid conflicts with existing exports)
export {
	adaptiveBlur as $adaptiveBlur,
	BitmapBuilder,
	bitmap,
	// Bitmap effects
	blur as $blur,
	boxBlur as $boxBlur,
	cascadeBlur as $cascadeBlur,
	char,
	clone as $clone,
	combine,
	combinePaths as $combinePaths,
	condensePath as $condensePath,
	convert as $convert,
	copy as $copy,
	embolden as $embolden,
	emboldenGlyph as $emboldenGlyph,
	// Path effects
	emboldenPath as $emboldenPath,
	fastBlur as $fastBlur,
	fromGlyph as $fromGlyph,
	glyph,
	glyphVar,
	italic as $italic,
	matrix as $matrix,
	obliquePath as $obliquePath,
	PathBuilder,
	pad as $pad,
	path,
	perspective as $perspective,
	pipe,
	// Rasterization
	rasterize as $rasterize,
	rasterizeAuto as $rasterizeAuto,
	rasterizeWithGradient as $rasterizeWithGradient,
	renderMsdf as $renderMsdf,
	// SDF/MSDF rendering
	renderSdf as $renderSdf,
	resize as $resize,
	resizeBilinear as $resizeBilinear,
	rotate as $rotate,
	rotateDeg as $rotateDeg,
	// Path transforms
	scale as $scale,
	shear as $shear,
	shearBitmapX as $shearBitmapX,
	shearBitmapY as $shearBitmapY,
	shearGlyphX as $shearGlyphX,
	shearGlyphY as $shearGlyphY,
	shift as $shift,
	strokeAsymmetric as $strokeAsymmetric,
	strokeAsymmetricCombined as $strokeAsymmetricCombined,
	strokePath as $strokePath,
	toGray as $toGray,
	// Output
	toRGBA as $toRGBA,
	toSVG as $toSVG,
	transformBitmap2D as $transformBitmap2D,
	transformBitmap3D as $transformBitmap3D,
	transformGlyph2D as $transformGlyph2D,
	transformGlyph3D as $transformGlyph3D,
	translate as $translate,
} from "./fluent/index.ts";
// Fluent API - Types
export type {
	AutoRasterOptions,
	CanvasOptions,
	RasterOptions,
	SVGElementOptions,
	SVGOptions,
	TransformState,
} from "./fluent/types.ts";
export { Reader } from "./font/binary/reader.ts";
export { createFace, Face } from "./font/face.ts";
// Font parsing
export { Font, type FontLoadOptions } from "./font/font.ts";
export type { AvarTable, AxisSegmentMap } from "./font/tables/avar.ts";
export { applyAvar, applyAvarMapping } from "./font/tables/avar.ts";
// BASE table (baseline alignment)
export type {
	AxisTable as BaseAxisTable,
	BaselineValue,
	BaseScriptRecord,
	BaseTable,
	BaseValues,
	FeatMinMaxRecord,
	MinMax,
	MinMaxRecord,
} from "./font/tables/base.ts";
export {
	BaselineTag,
	getBaselineForScript,
	getDefaultBaseline,
	getMinMaxExtent,
	parseBase,
} from "./font/tables/base.ts";
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
// CFF table
export type {
	CffTable,
	FDDict,
	FDSelect,
	PrivateDict,
	TopDict,
} from "./font/tables/cff.ts";
export { getCffString, parseCff } from "./font/tables/cff.ts";
// CFF2 table (variable fonts)
export type {
	Cff2FDDict,
	Cff2FDSelect,
	Cff2PrivateDict,
	Cff2Table,
	Cff2TopDict,
	ItemVariationData as Cff2ItemVariationData,
	ItemVariationStore as Cff2ItemVariationStore,
	RegionAxisCoordinates as Cff2RegionAxisCoordinates,
	VariationRegion as Cff2VariationRegion,
	VariationRegionList,
} from "./font/tables/cff2.ts";
export { calculateVariationDelta, parseCff2 } from "./font/tables/cff2.ts";
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
	FeatureRecord as AatFeatureRecord,
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
	getFeature as getAatFeature,
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
// gasp table
export type { GaspRange, GaspTable } from "./font/tables/gasp.ts";
export {
	GaspFlag,
	getGaspBehavior,
	parseGasp,
	shouldDoGray,
	shouldGridFit,
} from "./font/tables/gasp.ts";
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
// Hinting tables (fpgm, prep, cvt)
export type {
	CvtTable,
	FpgmTable,
	PrepTable,
} from "./font/tables/hinting.ts";
export { parseCvt, parseFpgm, parsePrep } from "./font/tables/hinting.ts";
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
// MATH table (mathematical typesetting)
export type {
	ExtendedShapeCoverage,
	GlyphAssembly,
	GlyphPartRecord,
	MathConstants,
	MathGlyphConstruction,
	MathGlyphInfo,
	MathItalicsCorrection,
	MathKernInfo,
	MathKernInfoTable,
	MathKernRecord,
	MathTable,
	MathTopAccentAttachment,
	MathValueRecord,
	MathVariants,
} from "./font/tables/math.ts";
export {
	getHorizontalAssembly,
	getHorizontalVariants,
	getItalicsCorrection,
	getTopAccentAttachment,
	getVerticalAssembly,
	getVerticalVariants,
	isExtendedShape,
	parseMath,
} from "./font/tables/math.ts";
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
// name table
export type { NameRecord, NameTable } from "./font/tables/name.ts";
export {
	getFontFamily,
	getFontSubfamily,
	getFullName,
	getNameById,
	getPostScriptName,
	getVersion,
	NameId,
	parseName,
	PlatformId,
	WindowsEncodingId,
} from "./font/tables/name.ts";
// OS/2 table
export type { Os2Table } from "./font/tables/os2.ts";
export {
	FsSelection,
	FsType,
	getEmbeddingPermission,
	isBold,
	isItalic,
	parseOs2,
	useTypoMetrics,
	WeightClass,
	WidthClass,
} from "./font/tables/os2.ts";
// post table
export type { PostTable } from "./font/tables/post.ts";
export { getGlyphName, isMonospaced, parsePost } from "./font/tables/post.ts";
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
// JSTF table (justification)
export type {
	JstfLangSys,
	JstfMax,
	JstfModList,
	JstfPriorityRecord,
	JstfScriptRecord,
	JstfTable,
} from "./font/tables/jstf.ts";
export {
	getExtenderGlyphs,
	getExtensionMods,
	getJstfPriorities,
	getShrinkageMods,
	JstfPriority,
	parseJstf,
} from "./font/tables/jstf.ts";
// SFNT font directory
export type { FontDirectory } from "./font/tables/sfnt.ts";
export {
	isCFF,
	isTrueType,
	parseFontDirectory,
} from "./font/tables/sfnt.ts";
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
export { ClassDef } from "./layout/structures/class-def.ts";
export {
	EMPTY_CLASS_DEF,
	parseClassDef,
	parseClassDefAt,
} from "./layout/structures/class-def.ts";
// Layout structures
export { Coverage } from "./layout/structures/coverage.ts";
export { parseCoverage, parseCoverageAt } from "./layout/structures/coverage.ts";
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
// Layout common structures
export type {
	Feature,
	FeatureList,
	FeatureRecord,
	LangSys,
	LangSysRecord,
	LookupHeader,
	Script as LayoutScript,
	ScriptList,
	ScriptRecord,
} from "./layout/structures/layout-common.ts";
export {
	findLangSys,
	findScript,
	getFeature,
	getMarkAttachmentType,
	LookupFlag,
	parseFeatureList,
	parseLookupHeaders,
	parseScriptList,
} from "./layout/structures/layout-common.ts";
// Set digest for fast glyph coverage checking
export { createLookupDigest, SetDigest } from "./layout/structures/set-digest.ts";
// Asymmetric stroke (independent x/y border widths)
export {
	type AsymmetricStrokeOptions,
	strokeAsymmetric,
	strokeAsymmetricCombined,
	strokeUniform,
} from "./raster/asymmetric-stroke.ts";
// Texture atlas for GPU rendering
export {
	atlasToAlpha,
	atlasToRGBA,
	buildAsciiAtlas,
	buildAtlas,
	buildStringAtlas,
	getGlyphUV,
} from "./raster/atlas.ts";
// Exact bounding box
export { getExactBounds } from "./raster/bbox.ts";
// Fixed-point math utilities
export {
	abs,
	ceilPixel,
	clamp,
	divFix,
	downscale,
	f26Dot6ToFloat,
	F16DOT16_ONE,
	F16DOT16_SHIFT,
	F26DOT6_ONE,
	F26DOT6_SHIFT,
	floatToF26Dot6,
	floatToPixel,
	floorPixel,
	fracPixel,
	hypot,
	mulDiv,
	mulFix,
	normalizeVector,
	ONE_PIXEL,
	PIXEL_BITS,
	PIXEL_MASK,
	roundPixel,
	sign,
	truncPixel,
	upscale,
	vectorLength,
} from "./raster/fixed-point.ts";
// Outline decomposition
export type { ValidationResult } from "./raster/outline-decompose.ts";
export {
	decomposePath,
	getFillRuleFromFlags,
	getPathBounds,
	OutlineError,
	validateOutline,
} from "./raster/outline-decompose.ts";
// Bitmap utilities
export {
	addBitmaps,
	blendBitmap,
	compositeBitmaps,
	convertBitmap,
	copyBitmap,
	emboldenBitmap,
	emboldenBitmapWithBearing,
	expandRasterMetrics,
	expandToFit,
	fixOutlineBitmap,
	fixOutline,
	maxBitmaps,
	mulBitmaps,
	padBitmap,
	resizeBitmap,
	resizeBitmapBilinear,
	shearBitmapX,
	shearBitmapY,
	shiftBitmap,
	subtractBitmap,
	subBitmaps,
	transformBitmap2D,
	transformBitmap3D,
	measureRasterGlyph,
} from "./raster/bitmap-utils.ts";
// Blur filters
export {
	blurBitmap,
	boxBlur,
	createGaussianKernel,
	gaussianBlur,
} from "./raster/blur.ts";
// Cascade blur (high-performance for large radii)
export {
	adaptiveBlur,
	cascadeBlur,
	fastGaussianBlur,
} from "./raster/cascade-blur.ts";
// Gradient fill
export {
	type ColorStop as GradientColorStop,
	createGradientBitmap,
	type Gradient,
	interpolateGradient,
	type LinearGradient,
	type RadialGradient,
	rasterizePathWithGradient,
} from "./raster/gradient.ts";
// LCD subpixel rendering
export {
	LCD_FILTER_DEFAULT,
	LCD_FILTER_LEGACY,
	LCD_FILTER_LIGHT,
	lcdToRGBA,
	LcdMode,
	rasterizeLcd,
} from "./raster/lcd-filter.ts";
// MSDF (Multi-channel Signed Distance Field) rendering
export {
	assignEdgeColors,
	buildMsdfAsciiAtlas,
	buildMsdfAtlas,
	buildMsdfStringAtlas,
	type MsdfEdge,
	type MsdfOptions,
	median,
	msdfAtlasToRGB,
	msdfAtlasToRGBA,
	type Point as MsdfPoint,
	renderMsdf,
	type SignedDistanceResult,
	signedDistanceToCubic,
	signedDistanceToLine,
	signedDistanceToQuadratic,
} from "./raster/msdf.ts";
export {
	bitmapToGray,
	bitmapToRGBA,
	rasterizeGlyph,
	rasterizeGlyphWithTransform,
	rasterizePath,
	rasterizeText,
} from "./raster/rasterize.ts";
// SDF rendering
export { renderSdf, type SdfOptions } from "./raster/sdf.ts";
// Stroker
export {
	type LineCap,
	type LineJoin,
	type StrokerOptions,
	strokePath,
} from "./raster/stroker.ts";
// Synthetic effects
export { condensePath, emboldenPath, obliquePath } from "./raster/synth.ts";
// Rasterization
export type {
	Bitmap,
	GlyphAtlas,
	GlyphMetrics,
	MsdfAtlasOptions,
	RasterizedGlyph,
	RasterizeOptions,
	Span,
} from "./raster/types.ts";
export type {
	BitmapTransformOptions,
	RasterEffectOptions,
	RasterMetrics,
} from "./raster/bitmap-utils.ts";
export {
	clearBitmap,
	createBitmap,
	FillRule,
	PixelMode,
} from "./raster/types.ts";
// Outline transforms
export {
	type BoundingBox,
	type ControlBox,
	clonePath,
	combinePaths,
	computeControlBox,
	computeTightBounds,
	identity2D,
	identity3x3,
	italicizeOutline,
	type Matrix2D,
	type Matrix3x3,
	multiply2D,
	multiply3x3,
	perspectiveMatrix,
	rotate2D,
	rotateOutline,
	rotateOutline90,
	scale2D,
	scaleOutline,
	scaleOutlinePow2,
	shear2D,
	transformOutline2D,
	transformOutline3D,
	transformPoint2D,
	transformPoint3x3,
	translate2D,
	translateOutline,
	updateMinTransformedX,
} from "./render/outline-transform.ts";
// Rendering utilities
export type { GlyphPath, PathCommand, ShapedGlyph } from "./render/path.ts";
export {
	applyMatrixToContext,
	contourToPath,
	createPath2D,
	getGlyphPath,
	getGlyphPathWithVariation,
	getTextWidth,
	glyphBufferToShapedGlyphs,
	glyphToSVG,
	matrixToSVGTransform,
	pathToCanvas,
	pathToCanvasWithMatrix,
	pathToCanvasWithMatrix3D,
	pathToSVG,
	pathToSVGWithMatrix,
	pathToSVGWithMatrix3D,
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
export {
	type FontLike,
	type ShapeOptions,
	shape,
	shapeInto,
} from "./shaper/shaper.ts";
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
