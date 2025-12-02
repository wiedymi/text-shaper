import {
	type Coverage,
	parseCoverageAt,
} from "../../layout/structures/coverage.ts";
import {
	type DeviceOrVariationIndex,
	parseDeviceAt,
} from "../../layout/structures/device.ts";
import type { GlyphId, int16, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * MATH table - Mathematical typesetting data
 * Provides metrics and glyph information for math layout
 */

/** MathValueRecord - value with optional device correction */
export interface MathValueRecord {
	value: int16;
	device: DeviceOrVariationIndex | null;
}

/** MathConstants - global math constants */
export interface MathConstants {
	scriptPercentScaleDown: int16;
	scriptScriptPercentScaleDown: int16;
	delimitedSubFormulaMinHeight: uint16;
	displayOperatorMinHeight: uint16;
	mathLeading: MathValueRecord;
	axisHeight: MathValueRecord;
	accentBaseHeight: MathValueRecord;
	flattenedAccentBaseHeight: MathValueRecord;
	subscriptShiftDown: MathValueRecord;
	subscriptTopMax: MathValueRecord;
	subscriptBaselineDropMin: MathValueRecord;
	superscriptShiftUp: MathValueRecord;
	superscriptShiftUpCramped: MathValueRecord;
	superscriptBottomMin: MathValueRecord;
	superscriptBaselineDropMax: MathValueRecord;
	subSuperscriptGapMin: MathValueRecord;
	superscriptBottomMaxWithSubscript: MathValueRecord;
	spaceAfterScript: MathValueRecord;
	upperLimitGapMin: MathValueRecord;
	upperLimitBaselineRiseMin: MathValueRecord;
	lowerLimitGapMin: MathValueRecord;
	lowerLimitBaselineDropMin: MathValueRecord;
	stackTopShiftUp: MathValueRecord;
	stackTopDisplayStyleShiftUp: MathValueRecord;
	stackBottomShiftDown: MathValueRecord;
	stackBottomDisplayStyleShiftDown: MathValueRecord;
	stackGapMin: MathValueRecord;
	stackDisplayStyleGapMin: MathValueRecord;
	stretchStackTopShiftUp: MathValueRecord;
	stretchStackBottomShiftDown: MathValueRecord;
	stretchStackGapAboveMin: MathValueRecord;
	stretchStackGapBelowMin: MathValueRecord;
	fractionNumeratorShiftUp: MathValueRecord;
	fractionNumeratorDisplayStyleShiftUp: MathValueRecord;
	fractionDenominatorShiftDown: MathValueRecord;
	fractionDenominatorDisplayStyleShiftDown: MathValueRecord;
	fractionNumeratorGapMin: MathValueRecord;
	fractionNumDisplayStyleGapMin: MathValueRecord;
	fractionRuleThickness: MathValueRecord;
	fractionDenominatorGapMin: MathValueRecord;
	fractionDenomDisplayStyleGapMin: MathValueRecord;
	skewedFractionHorizontalGap: MathValueRecord;
	skewedFractionVerticalGap: MathValueRecord;
	overbarVerticalGap: MathValueRecord;
	overbarRuleThickness: MathValueRecord;
	overbarExtraAscender: MathValueRecord;
	underbarVerticalGap: MathValueRecord;
	underbarRuleThickness: MathValueRecord;
	underbarExtraDescender: MathValueRecord;
	radicalVerticalGap: MathValueRecord;
	radicalDisplayStyleVerticalGap: MathValueRecord;
	radicalRuleThickness: MathValueRecord;
	radicalExtraAscender: MathValueRecord;
	radicalKernBeforeDegree: MathValueRecord;
	radicalKernAfterDegree: MathValueRecord;
	radicalDegreeBottomRaisePercent: int16;
}

/** Italic correction info */
export interface MathItalicsCorrection {
	coverage: Coverage;
	values: MathValueRecord[];
}

/** Top accent attachment */
export interface MathTopAccentAttachment {
	coverage: Coverage;
	values: MathValueRecord[];
}

/** Extended shape coverage */
export interface ExtendedShapeCoverage {
	coverage: Coverage;
}

/** Math kern record for corner kerns */
export interface MathKernRecord {
	correctionHeights: MathValueRecord[];
	kernValues: MathValueRecord[];
}

/** Math kern info for a glyph */
export interface MathKernInfo {
	topRight: MathKernRecord | null;
	topLeft: MathKernRecord | null;
	bottomRight: MathKernRecord | null;
	bottomLeft: MathKernRecord | null;
}

/** Math kern info table */
export interface MathKernInfoTable {
	coverage: Coverage;
	kernInfo: MathKernInfo[];
}

/** MathGlyphInfo - per-glyph math info */
export interface MathGlyphInfo {
	italicsCorrection: MathItalicsCorrection | null;
	topAccentAttachment: MathTopAccentAttachment | null;
	extendedShapeCoverage: ExtendedShapeCoverage | null;
	kernInfo: MathKernInfoTable | null;
}

/** Glyph part record for assembly */
export interface GlyphPartRecord {
	glyphId: GlyphId;
	startConnectorLength: uint16;
	endConnectorLength: uint16;
	fullAdvance: uint16;
	partFlags: uint16;
}

/** Glyph assembly */
export interface GlyphAssembly {
	italicsCorrection: MathValueRecord;
	parts: GlyphPartRecord[];
}

/** Math glyph construction */
export interface MathGlyphConstruction {
	glyphAssembly: GlyphAssembly | null;
	variants: Array<{ variantGlyph: GlyphId; advanceMeasurement: uint16 }>;
}

/** MathVariants - glyph variants and construction */
export interface MathVariants {
	minConnectorOverlap: uint16;
	vertGlyphCoverage: Coverage | null;
	horizGlyphCoverage: Coverage | null;
	vertGlyphConstruction: MathGlyphConstruction[];
	horizGlyphConstruction: MathGlyphConstruction[];
}

/** MATH table */
export interface MathTable {
	majorVersion: uint16;
	minorVersion: uint16;
	constants: MathConstants | null;
	glyphInfo: MathGlyphInfo | null;
	variants: MathVariants | null;
}

function parseMathValueRecord(
	reader: Reader,
	tableReader: Reader,
): MathValueRecord {
	const value = reader.int16();
	const deviceOffset = reader.uint16();
	return {
		value,
		device: parseDeviceAt(tableReader, deviceOffset),
	};
}

function parseMathConstants(reader: Reader): MathConstants {
	const tableReader = reader;
	const scriptPercentScaleDown = reader.int16();
	const scriptScriptPercentScaleDown = reader.int16();
	const delimitedSubFormulaMinHeight = reader.uint16();
	const displayOperatorMinHeight = reader.uint16();

	return {
		scriptPercentScaleDown,
		scriptScriptPercentScaleDown,
		delimitedSubFormulaMinHeight,
		displayOperatorMinHeight,
		mathLeading: parseMathValueRecord(reader, tableReader),
		axisHeight: parseMathValueRecord(reader, tableReader),
		accentBaseHeight: parseMathValueRecord(reader, tableReader),
		flattenedAccentBaseHeight: parseMathValueRecord(reader, tableReader),
		subscriptShiftDown: parseMathValueRecord(reader, tableReader),
		subscriptTopMax: parseMathValueRecord(reader, tableReader),
		subscriptBaselineDropMin: parseMathValueRecord(reader, tableReader),
		superscriptShiftUp: parseMathValueRecord(reader, tableReader),
		superscriptShiftUpCramped: parseMathValueRecord(reader, tableReader),
		superscriptBottomMin: parseMathValueRecord(reader, tableReader),
		superscriptBaselineDropMax: parseMathValueRecord(reader, tableReader),
		subSuperscriptGapMin: parseMathValueRecord(reader, tableReader),
		superscriptBottomMaxWithSubscript: parseMathValueRecord(
			reader,
			tableReader,
		),
		spaceAfterScript: parseMathValueRecord(reader, tableReader),
		upperLimitGapMin: parseMathValueRecord(reader, tableReader),
		upperLimitBaselineRiseMin: parseMathValueRecord(reader, tableReader),
		lowerLimitGapMin: parseMathValueRecord(reader, tableReader),
		lowerLimitBaselineDropMin: parseMathValueRecord(reader, tableReader),
		stackTopShiftUp: parseMathValueRecord(reader, tableReader),
		stackTopDisplayStyleShiftUp: parseMathValueRecord(reader, tableReader),
		stackBottomShiftDown: parseMathValueRecord(reader, tableReader),
		stackBottomDisplayStyleShiftDown: parseMathValueRecord(reader, tableReader),
		stackGapMin: parseMathValueRecord(reader, tableReader),
		stackDisplayStyleGapMin: parseMathValueRecord(reader, tableReader),
		stretchStackTopShiftUp: parseMathValueRecord(reader, tableReader),
		stretchStackBottomShiftDown: parseMathValueRecord(reader, tableReader),
		stretchStackGapAboveMin: parseMathValueRecord(reader, tableReader),
		stretchStackGapBelowMin: parseMathValueRecord(reader, tableReader),
		fractionNumeratorShiftUp: parseMathValueRecord(reader, tableReader),
		fractionNumeratorDisplayStyleShiftUp: parseMathValueRecord(
			reader,
			tableReader,
		),
		fractionDenominatorShiftDown: parseMathValueRecord(reader, tableReader),
		fractionDenominatorDisplayStyleShiftDown: parseMathValueRecord(
			reader,
			tableReader,
		),
		fractionNumeratorGapMin: parseMathValueRecord(reader, tableReader),
		fractionNumDisplayStyleGapMin: parseMathValueRecord(reader, tableReader),
		fractionRuleThickness: parseMathValueRecord(reader, tableReader),
		fractionDenominatorGapMin: parseMathValueRecord(reader, tableReader),
		fractionDenomDisplayStyleGapMin: parseMathValueRecord(reader, tableReader),
		skewedFractionHorizontalGap: parseMathValueRecord(reader, tableReader),
		skewedFractionVerticalGap: parseMathValueRecord(reader, tableReader),
		overbarVerticalGap: parseMathValueRecord(reader, tableReader),
		overbarRuleThickness: parseMathValueRecord(reader, tableReader),
		overbarExtraAscender: parseMathValueRecord(reader, tableReader),
		underbarVerticalGap: parseMathValueRecord(reader, tableReader),
		underbarRuleThickness: parseMathValueRecord(reader, tableReader),
		underbarExtraDescender: parseMathValueRecord(reader, tableReader),
		radicalVerticalGap: parseMathValueRecord(reader, tableReader),
		radicalDisplayStyleVerticalGap: parseMathValueRecord(reader, tableReader),
		radicalRuleThickness: parseMathValueRecord(reader, tableReader),
		radicalExtraAscender: parseMathValueRecord(reader, tableReader),
		radicalKernBeforeDegree: parseMathValueRecord(reader, tableReader),
		radicalKernAfterDegree: parseMathValueRecord(reader, tableReader),
		radicalDegreeBottomRaisePercent: reader.int16(),
	};
}

function parseMathItalicsCorrection(reader: Reader): MathItalicsCorrection {
	const coverageOffset = reader.uint16();
	const count = reader.uint16();

	const values: MathValueRecord[] = [];
	for (let i = 0; i < count; i++) {
		values.push(parseMathValueRecord(reader, reader));
	}

	const coverage = parseCoverageAt(reader, coverageOffset);

	return { coverage, values };
}

function parseMathTopAccentAttachment(reader: Reader): MathTopAccentAttachment {
	const coverageOffset = reader.uint16();
	const count = reader.uint16();

	const values: MathValueRecord[] = [];
	for (let i = 0; i < count; i++) {
		values.push(parseMathValueRecord(reader, reader));
	}

	const coverage = parseCoverageAt(reader, coverageOffset);

	return { coverage, values };
}

function parseMathKernRecord(reader: Reader, offset: number): MathKernRecord {
	const kernReader = reader.sliceFrom(offset);
	const heightCount = kernReader.uint16();

	const correctionHeights: MathValueRecord[] = [];
	for (let i = 0; i < heightCount; i++) {
		correctionHeights.push(parseMathValueRecord(kernReader, kernReader));
	}

	const kernValues: MathValueRecord[] = [];
	for (let i = 0; i < heightCount + 1; i++) {
		kernValues.push(parseMathValueRecord(kernReader, kernReader));
	}

	return { correctionHeights, kernValues };
}

function parseMathKernInfoTable(reader: Reader): MathKernInfoTable {
	const coverageOffset = reader.uint16();
	const count = reader.uint16();

	const kernInfoRecords: Array<{
		topRightOffset: uint16;
		topLeftOffset: uint16;
		bottomRightOffset: uint16;
		bottomLeftOffset: uint16;
	}> = [];

	for (let i = 0; i < count; i++) {
		kernInfoRecords.push({
			topRightOffset: reader.uint16(),
			topLeftOffset: reader.uint16(),
			bottomRightOffset: reader.uint16(),
			bottomLeftOffset: reader.uint16(),
		});
	}

	const coverage = parseCoverageAt(reader, coverageOffset);

	const kernInfo: MathKernInfo[] = kernInfoRecords.map((record) => ({
		topRight:
			record.topRightOffset !== 0
				? parseMathKernRecord(reader, record.topRightOffset)
				: null,
		topLeft:
			record.topLeftOffset !== 0
				? parseMathKernRecord(reader, record.topLeftOffset)
				: null,
		bottomRight:
			record.bottomRightOffset !== 0
				? parseMathKernRecord(reader, record.bottomRightOffset)
				: null,
		bottomLeft:
			record.bottomLeftOffset !== 0
				? parseMathKernRecord(reader, record.bottomLeftOffset)
				: null,
	}));

	return { coverage, kernInfo };
}

function parseMathGlyphInfo(reader: Reader): MathGlyphInfo {
	const italicsCorrectionOffset = reader.uint16();
	const topAccentAttachmentOffset = reader.uint16();
	const extendedShapeCoverageOffset = reader.uint16();
	const kernInfoOffset = reader.uint16();

	let italicsCorrection: MathItalicsCorrection | null = null;
	if (italicsCorrectionOffset !== 0) {
		italicsCorrection = parseMathItalicsCorrection(
			reader.sliceFrom(italicsCorrectionOffset),
		);
	}

	let topAccentAttachment: MathTopAccentAttachment | null = null;
	if (topAccentAttachmentOffset !== 0) {
		topAccentAttachment = parseMathTopAccentAttachment(
			reader.sliceFrom(topAccentAttachmentOffset),
		);
	}

	let extendedShapeCoverage: ExtendedShapeCoverage | null = null;
	if (extendedShapeCoverageOffset !== 0) {
		const coverage = parseCoverageAt(reader, extendedShapeCoverageOffset);
		extendedShapeCoverage = { coverage };
	}

	let kernInfo: MathKernInfoTable | null = null;
	if (kernInfoOffset !== 0) {
		kernInfo = parseMathKernInfoTable(reader.sliceFrom(kernInfoOffset));
	}

	return {
		italicsCorrection,
		topAccentAttachment,
		extendedShapeCoverage,
		kernInfo,
	};
}

function parseGlyphAssembly(reader: Reader): GlyphAssembly {
	const italicsCorrection = parseMathValueRecord(reader, reader);
	const partCount = reader.uint16();

	const parts: GlyphPartRecord[] = [];
	for (let i = 0; i < partCount; i++) {
		parts.push({
			glyphId: reader.uint16(),
			startConnectorLength: reader.uint16(),
			endConnectorLength: reader.uint16(),
			fullAdvance: reader.uint16(),
			partFlags: reader.uint16(),
		});
	}

	return { italicsCorrection, parts };
}

function parseMathGlyphConstruction(reader: Reader): MathGlyphConstruction {
	const glyphAssemblyOffset = reader.uint16();
	const variantCount = reader.uint16();

	const variants: Array<{ variantGlyph: GlyphId; advanceMeasurement: uint16 }> =
		[];
	for (let i = 0; i < variantCount; i++) {
		variants.push({
			variantGlyph: reader.uint16(),
			advanceMeasurement: reader.uint16(),
		});
	}

	let glyphAssembly: GlyphAssembly | null = null;
	if (glyphAssemblyOffset !== 0) {
		glyphAssembly = parseGlyphAssembly(reader.sliceFrom(glyphAssemblyOffset));
	}

	return { glyphAssembly, variants };
}

function parseMathVariants(reader: Reader): MathVariants {
	const minConnectorOverlap = reader.uint16();
	const vertGlyphCoverageOffset = reader.uint16();
	const horizGlyphCoverageOffset = reader.uint16();
	const vertGlyphCount = reader.uint16();
	const horizGlyphCount = reader.uint16();

	const vertGlyphConstructionOffsets: uint16[] = [];
	for (let i = 0; i < vertGlyphCount; i++) {
		vertGlyphConstructionOffsets.push(reader.uint16());
	}

	const horizGlyphConstructionOffsets: uint16[] = [];
	for (let i = 0; i < horizGlyphCount; i++) {
		horizGlyphConstructionOffsets.push(reader.uint16());
	}

	const vertGlyphCoverage =
		vertGlyphCoverageOffset !== 0
			? parseCoverageAt(reader, vertGlyphCoverageOffset)
			: null;

	const horizGlyphCoverage =
		horizGlyphCoverageOffset !== 0
			? parseCoverageAt(reader, horizGlyphCoverageOffset)
			: null;

	const vertGlyphConstruction = vertGlyphConstructionOffsets.map((offset) =>
		parseMathGlyphConstruction(reader.sliceFrom(offset)),
	);

	const horizGlyphConstruction = horizGlyphConstructionOffsets.map((offset) =>
		parseMathGlyphConstruction(reader.sliceFrom(offset)),
	);

	return {
		minConnectorOverlap,
		vertGlyphCoverage,
		horizGlyphCoverage,
		vertGlyphConstruction,
		horizGlyphConstruction,
	};
}

export function parseMath(reader: Reader): MathTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	const mathConstantsOffset = reader.uint16();
	const mathGlyphInfoOffset = reader.uint16();
	const mathVariantsOffset = reader.uint16();

	let constants: MathConstants | null = null;
	if (mathConstantsOffset !== 0) {
		constants = parseMathConstants(reader.sliceFrom(mathConstantsOffset));
	}

	let glyphInfo: MathGlyphInfo | null = null;
	if (mathGlyphInfoOffset !== 0) {
		glyphInfo = parseMathGlyphInfo(reader.sliceFrom(mathGlyphInfoOffset));
	}

	let variants: MathVariants | null = null;
	if (mathVariantsOffset !== 0) {
		variants = parseMathVariants(reader.sliceFrom(mathVariantsOffset));
	}

	return {
		majorVersion,
		minorVersion,
		constants,
		glyphInfo,
		variants,
	};
}

// Helper functions

/** Get italic correction for a glyph */
export function getItalicsCorrection(
	math: MathTable,
	glyphId: GlyphId,
): MathValueRecord | null {
	const italics = math.glyphInfo?.italicsCorrection;
	if (!italics) return null;

	const index = italics.coverage.get(glyphId);
	if (index === null) return null;

	return italics.values[index] ?? null;
}

/** Get top accent attachment for a glyph */
export function getTopAccentAttachment(
	math: MathTable,
	glyphId: GlyphId,
): MathValueRecord | null {
	const attachment = math.glyphInfo?.topAccentAttachment;
	if (!attachment) return null;

	const index = attachment.coverage.get(glyphId);
	if (index === null) return null;

	return attachment.values[index] ?? null;
}

/** Check if glyph is an extended shape */
export function isExtendedShape(math: MathTable, glyphId: GlyphId): boolean {
	const extended = math.glyphInfo?.extendedShapeCoverage;
	if (!extended) return false;

	return extended.coverage.get(glyphId) !== null;
}

/** Get vertical glyph variants */
export function getVerticalVariants(
	math: MathTable,
	glyphId: GlyphId,
): Array<{ variantGlyph: GlyphId; advanceMeasurement: uint16 }> | null {
	const variants = math.variants;
	if (!variants?.vertGlyphCoverage) return null;

	const index = variants.vertGlyphCoverage.get(glyphId);
	if (index === null) return null;

	return variants.vertGlyphConstruction[index]?.variants ?? null;
}

/** Get horizontal glyph variants */
export function getHorizontalVariants(
	math: MathTable,
	glyphId: GlyphId,
): Array<{ variantGlyph: GlyphId; advanceMeasurement: uint16 }> | null {
	const variants = math.variants;
	if (!variants?.horizGlyphCoverage) return null;

	const index = variants.horizGlyphCoverage.get(glyphId);
	if (index === null) return null;

	return variants.horizGlyphConstruction[index]?.variants ?? null;
}

/** Get vertical glyph assembly */
export function getVerticalAssembly(
	math: MathTable,
	glyphId: GlyphId,
): GlyphAssembly | null {
	const variants = math.variants;
	if (!variants?.vertGlyphCoverage) return null;

	const index = variants.vertGlyphCoverage.get(glyphId);
	if (index === null) return null;

	return variants.vertGlyphConstruction[index]?.glyphAssembly ?? null;
}

/** Get horizontal glyph assembly */
export function getHorizontalAssembly(
	math: MathTable,
	glyphId: GlyphId,
): GlyphAssembly | null {
	const variants = math.variants;
	if (!variants?.horizGlyphCoverage) return null;

	const index = variants.horizGlyphCoverage.get(glyphId);
	if (index === null) return null;

	return variants.horizGlyphConstruction[index]?.glyphAssembly ?? null;
}
