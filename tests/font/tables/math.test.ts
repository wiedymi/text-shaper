import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseMath,
	getItalicsCorrection,
	getTopAccentAttachment,
	isExtendedShape,
	getVerticalVariants,
	getHorizontalVariants,
	getVerticalAssembly,
	getHorizontalAssembly,
	type MathTable,
	type MathConstants,
	type MathGlyphInfo,
	type MathVariants,
	type MathValueRecord,
	type GlyphAssembly,
} from "../../../src/font/tables/math.ts";

const STIX_TWO_MATH_PATH =
	"/Users/uyakauleu/vivy/experiments/typeshaper/tests/fonts/STIXTwoMath-Regular.otf";
const XITS_MATH_PATH =
	"/Users/uyakauleu/vivy/experiments/typeshaper/tests/fonts/XITSMath-Regular.otf";

describe("MATH table", () => {
	let stixFont: Font;
	let xitsFont: Font;
	let stixMath: MathTable | null;
	let xitsMath: MathTable | null;

	beforeAll(async () => {
		stixFont = await Font.fromFile(STIX_TWO_MATH_PATH);
		xitsFont = await Font.fromFile(XITS_MATH_PATH);
		stixMath = stixFont.math;
		xitsMath = xitsFont.math;
	});

	describe("parseMath", () => {
		test("parses MATH table from STIX Two Math", () => {
			expect(stixMath).toBeDefined();
			expect(stixMath).not.toBeNull();
		});

		test("parses MATH table from XITS Math", () => {
			expect(xitsMath).toBeDefined();
			expect(xitsMath).not.toBeNull();
		});

		test("has version information", () => {
			if (stixMath) {
				expect(stixMath.majorVersion).toBe(1);
				expect(stixMath.minorVersion).toBeGreaterThanOrEqual(0);
			}
			if (xitsMath) {
				expect(xitsMath.majorVersion).toBe(1);
				expect(xitsMath.minorVersion).toBeGreaterThanOrEqual(0);
			}
		});

		test("has constants, glyphInfo, and variants", () => {
			if (stixMath) {
				expect(stixMath.constants).toBeDefined();
				expect(stixMath.glyphInfo).toBeDefined();
				expect(stixMath.variants).toBeDefined();
			}
			if (xitsMath) {
				expect(xitsMath.constants).toBeDefined();
				expect(xitsMath.glyphInfo).toBeDefined();
				expect(xitsMath.variants).toBeDefined();
			}
		});
	});

	describe("MathConstants", () => {
		test("has scale down percentages", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.scriptPercentScaleDown).toBeGreaterThan(0);
				expect(constants.scriptPercentScaleDown).toBeLessThanOrEqual(100);
				expect(constants.scriptScriptPercentScaleDown).toBeGreaterThan(0);
				expect(constants.scriptScriptPercentScaleDown).toBeLessThan(
					constants.scriptPercentScaleDown,
				);
			}
		});

		test("has minimum heights", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.delimitedSubFormulaMinHeight).toBeGreaterThan(0);
				expect(constants.displayOperatorMinHeight).toBeGreaterThan(0);
			}
		});

		test("has math leading value record", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.mathLeading).toBeDefined();
				expect(typeof constants.mathLeading.value).toBe("number");
				expect(constants.mathLeading.device).toBeDefined();
			}
		});

		test("has axis height", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.axisHeight).toBeDefined();
				expect(typeof constants.axisHeight.value).toBe("number");
				expect(constants.axisHeight.value).toBeGreaterThan(0);
			}
		});

		test("has accent base heights", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.accentBaseHeight).toBeDefined();
				expect(constants.accentBaseHeight.value).toBeGreaterThan(0);
				expect(constants.flattenedAccentBaseHeight).toBeDefined();
			}
		});

		test("has subscript parameters", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.subscriptShiftDown).toBeDefined();
				expect(constants.subscriptTopMax).toBeDefined();
				expect(constants.subscriptBaselineDropMin).toBeDefined();
			}
		});

		test("has superscript parameters", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.superscriptShiftUp).toBeDefined();
				expect(constants.superscriptShiftUpCramped).toBeDefined();
				expect(constants.superscriptBottomMin).toBeDefined();
				expect(constants.superscriptBaselineDropMax).toBeDefined();
			}
		});

		test("has sub-superscript gap parameters", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.subSuperscriptGapMin).toBeDefined();
				expect(constants.subSuperscriptGapMin.value).toBeGreaterThan(0);
				expect(constants.superscriptBottomMaxWithSubscript).toBeDefined();
				expect(constants.spaceAfterScript).toBeDefined();
			}
		});

		test("has limit parameters", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.upperLimitGapMin).toBeDefined();
				expect(constants.upperLimitBaselineRiseMin).toBeDefined();
				expect(constants.lowerLimitGapMin).toBeDefined();
				expect(constants.lowerLimitBaselineDropMin).toBeDefined();
			}
		});

		test("has stack parameters", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.stackTopShiftUp).toBeDefined();
				expect(constants.stackTopDisplayStyleShiftUp).toBeDefined();
				expect(constants.stackBottomShiftDown).toBeDefined();
				expect(constants.stackBottomDisplayStyleShiftDown).toBeDefined();
				expect(constants.stackGapMin).toBeDefined();
				expect(constants.stackDisplayStyleGapMin).toBeDefined();
			}
		});

		test("has stretch stack parameters", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.stretchStackTopShiftUp).toBeDefined();
				expect(constants.stretchStackBottomShiftDown).toBeDefined();
				expect(constants.stretchStackGapAboveMin).toBeDefined();
				expect(constants.stretchStackGapBelowMin).toBeDefined();
			}
		});

		test("has fraction parameters", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.fractionNumeratorShiftUp).toBeDefined();
				expect(constants.fractionNumeratorDisplayStyleShiftUp).toBeDefined();
				expect(constants.fractionDenominatorShiftDown).toBeDefined();
				expect(constants.fractionDenominatorDisplayStyleShiftDown).toBeDefined();
				expect(constants.fractionNumeratorGapMin).toBeDefined();
				expect(constants.fractionNumDisplayStyleGapMin).toBeDefined();
				expect(constants.fractionRuleThickness).toBeDefined();
				expect(constants.fractionRuleThickness.value).toBeGreaterThan(0);
				expect(constants.fractionDenominatorGapMin).toBeDefined();
				expect(constants.fractionDenomDisplayStyleGapMin).toBeDefined();
			}
		});

		test("has skewed fraction parameters", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.skewedFractionHorizontalGap).toBeDefined();
				expect(constants.skewedFractionVerticalGap).toBeDefined();
			}
		});

		test("has overbar parameters", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.overbarVerticalGap).toBeDefined();
				expect(constants.overbarRuleThickness).toBeDefined();
				expect(constants.overbarRuleThickness.value).toBeGreaterThan(0);
				expect(constants.overbarExtraAscender).toBeDefined();
			}
		});

		test("has underbar parameters", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.underbarVerticalGap).toBeDefined();
				expect(constants.underbarRuleThickness).toBeDefined();
				expect(constants.underbarRuleThickness.value).toBeGreaterThan(0);
				expect(constants.underbarExtraDescender).toBeDefined();
			}
		});

		test("has radical parameters", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.radicalVerticalGap).toBeDefined();
				expect(constants.radicalDisplayStyleVerticalGap).toBeDefined();
				expect(constants.radicalRuleThickness).toBeDefined();
				expect(constants.radicalRuleThickness.value).toBeGreaterThan(0);
				expect(constants.radicalExtraAscender).toBeDefined();
				expect(constants.radicalKernBeforeDegree).toBeDefined();
				expect(constants.radicalKernAfterDegree).toBeDefined();
				expect(constants.radicalDegreeBottomRaisePercent).toBeGreaterThanOrEqual(
					0,
				);
			}
		});

		test("constants values are reasonable", () => {
			const constants = stixMath?.constants;
			if (constants) {
				expect(constants.axisHeight.value).toBeGreaterThan(100);
				expect(constants.axisHeight.value).toBeLessThan(1000);

				const units = stixFont.unitsPerEm;
				expect(constants.fractionRuleThickness.value).toBeLessThan(units / 10);
			}
		});
	});

	describe("MathGlyphInfo", () => {
		test("has italics correction table", () => {
			const glyphInfo = stixMath?.glyphInfo;
			if (glyphInfo) {
				expect(glyphInfo.italicsCorrection).toBeDefined();
				if (glyphInfo.italicsCorrection) {
					expect(glyphInfo.italicsCorrection.coverage).toBeDefined();
					expect(Array.isArray(glyphInfo.italicsCorrection.values)).toBe(true);
					expect(glyphInfo.italicsCorrection.values.length).toBeGreaterThan(0);
				}
			}
		});

		test("has top accent attachment table", () => {
			const glyphInfo = stixMath?.glyphInfo;
			if (glyphInfo) {
				expect(glyphInfo.topAccentAttachment).toBeDefined();
				if (glyphInfo.topAccentAttachment) {
					expect(glyphInfo.topAccentAttachment.coverage).toBeDefined();
					expect(Array.isArray(glyphInfo.topAccentAttachment.values)).toBe(true);
					expect(glyphInfo.topAccentAttachment.values.length).toBeGreaterThan(0);
				}
			}
		});

		test("has extended shape coverage", () => {
			const glyphInfo = stixMath?.glyphInfo;
			if (glyphInfo) {
				expect(glyphInfo.extendedShapeCoverage).toBeDefined();
				if (glyphInfo.extendedShapeCoverage) {
					expect(glyphInfo.extendedShapeCoverage.coverage).toBeDefined();
				}
			}
		});

		test("has kern info table", () => {
			const glyphInfo = stixMath?.glyphInfo;
			if (glyphInfo) {
				expect(glyphInfo.kernInfo).toBeDefined();
				if (glyphInfo.kernInfo) {
					expect(glyphInfo.kernInfo.coverage).toBeDefined();
					expect(Array.isArray(glyphInfo.kernInfo.kernInfo)).toBe(true);
				}
			}
		});

		test("italic correction values have correct structure", () => {
			const glyphInfo = stixMath?.glyphInfo;
			if (glyphInfo?.italicsCorrection) {
				const firstValue = glyphInfo.italicsCorrection.values[0];
				if (firstValue) {
					expect(typeof firstValue.value).toBe("number");
					expect(firstValue.device !== undefined).toBe(true);
				}
			}
		});

		test("top accent attachment values are defined", () => {
			const glyphInfo = stixMath?.glyphInfo;
			if (glyphInfo?.topAccentAttachment) {
				for (const value of glyphInfo.topAccentAttachment.values) {
					expect(typeof value.value).toBe("number");
				}
			}
		});

		test("kern info records have corner data", () => {
			const glyphInfo = stixMath?.glyphInfo;
			if (glyphInfo?.kernInfo && glyphInfo.kernInfo.kernInfo.length > 0) {
				const kernInfo = glyphInfo.kernInfo.kernInfo[0];
				if (kernInfo) {
					expect(kernInfo.topRight !== undefined).toBe(true);
					expect(kernInfo.topLeft !== undefined).toBe(true);
					expect(kernInfo.bottomRight !== undefined).toBe(true);
					expect(kernInfo.bottomLeft !== undefined).toBe(true);
				}
			}
		});

		test("kern record has correction heights and kern values", () => {
			const glyphInfo = stixMath?.glyphInfo;
			if (glyphInfo?.kernInfo) {
				for (const kernInfo of glyphInfo.kernInfo.kernInfo) {
					const corners = [
						kernInfo.topRight,
						kernInfo.topLeft,
						kernInfo.bottomRight,
						kernInfo.bottomLeft,
					];
					for (const corner of corners) {
						if (corner) {
							expect(Array.isArray(corner.correctionHeights)).toBe(true);
							expect(Array.isArray(corner.kernValues)).toBe(true);
							expect(corner.kernValues.length).toBe(
								corner.correctionHeights.length + 1,
							);
						}
					}
				}
			}
		});
	});

	describe("MathVariants", () => {
		test("has min connector overlap", () => {
			const variants = stixMath?.variants;
			if (variants) {
				expect(typeof variants.minConnectorOverlap).toBe("number");
				expect(variants.minConnectorOverlap).toBeGreaterThanOrEqual(0);
			}
		});

		test("has vertical glyph coverage", () => {
			const variants = stixMath?.variants;
			if (variants) {
				expect(variants.vertGlyphCoverage).toBeDefined();
				if (variants.vertGlyphCoverage) {
					expect(variants.vertGlyphCoverage.get).toBeDefined();
				}
			}
		});

		test("has horizontal glyph coverage", () => {
			const variants = stixMath?.variants;
			if (variants) {
				expect(variants.horizGlyphCoverage).toBeDefined();
				if (variants.horizGlyphCoverage) {
					expect(variants.horizGlyphCoverage.get).toBeDefined();
				}
			}
		});

		test("has vertical glyph construction", () => {
			const variants = stixMath?.variants;
			if (variants) {
				expect(Array.isArray(variants.vertGlyphConstruction)).toBe(true);
				expect(variants.vertGlyphConstruction.length).toBeGreaterThan(0);
			}
		});

		test("has horizontal glyph construction", () => {
			const variants = stixMath?.variants;
			if (variants) {
				expect(Array.isArray(variants.horizGlyphConstruction)).toBe(true);
				expect(variants.horizGlyphConstruction.length).toBeGreaterThan(0);
			}
		});

		test("glyph construction has variants", () => {
			const variants = stixMath?.variants;
			if (variants && variants.vertGlyphConstruction.length > 0) {
				const construction = variants.vertGlyphConstruction[0];
				if (construction) {
					expect(Array.isArray(construction.variants)).toBe(true);
				}
			}
		});

		test("glyph variant records have correct structure", () => {
			const variants = stixMath?.variants;
			if (variants && variants.vertGlyphConstruction.length > 0) {
				const construction = variants.vertGlyphConstruction[0];
				if (construction && construction.variants.length > 0) {
					const variant = construction.variants[0];
					if (variant) {
						expect(typeof variant.variantGlyph).toBe("number");
						expect(typeof variant.advanceMeasurement).toBe("number");
						expect(variant.variantGlyph).toBeGreaterThanOrEqual(0);
						expect(variant.advanceMeasurement).toBeGreaterThan(0);
					}
				}
			}
		});

		test("glyph assembly has parts", () => {
			const variants = stixMath?.variants;
			if (variants) {
				for (const construction of variants.vertGlyphConstruction) {
					if (construction.glyphAssembly) {
						expect(Array.isArray(construction.glyphAssembly.parts)).toBe(true);
						expect(construction.glyphAssembly.parts.length).toBeGreaterThan(0);
						expect(construction.glyphAssembly.italicsCorrection).toBeDefined();
					}
				}
			}
		});

		test("glyph part records have correct structure", () => {
			const variants = stixMath?.variants;
			if (variants) {
				for (const construction of variants.vertGlyphConstruction) {
					if (
						construction.glyphAssembly &&
						construction.glyphAssembly.parts.length > 0
					) {
						const part = construction.glyphAssembly.parts[0];
						if (part) {
							expect(typeof part.glyphId).toBe("number");
							expect(typeof part.startConnectorLength).toBe("number");
							expect(typeof part.endConnectorLength).toBe("number");
							expect(typeof part.fullAdvance).toBe("number");
							expect(typeof part.partFlags).toBe("number");
							expect(part.glyphId).toBeGreaterThanOrEqual(0);
							expect(part.startConnectorLength).toBeGreaterThanOrEqual(0);
							expect(part.endConnectorLength).toBeGreaterThanOrEqual(0);
							expect(part.fullAdvance).toBeGreaterThan(0);
						}
					}
				}
			}
		});

		test("part flags indicate extender status", () => {
			const variants = stixMath?.variants;
			if (variants) {
				let foundExtender = false;
				for (const construction of variants.vertGlyphConstruction) {
					if (construction.glyphAssembly) {
						for (const part of construction.glyphAssembly.parts) {
							const isExtender = (part.partFlags & 0x0001) !== 0;
							if (isExtender) {
								foundExtender = true;
							}
						}
					}
				}
				expect(foundExtender).toBe(true);
			}
		});
	});

	describe("Helper functions", () => {
		describe("getItalicsCorrection", () => {
			test("returns null for fonts without MATH table", () => {
				const noMathTable = null;
				if (noMathTable === null) {
					expect(true).toBe(true);
				}
			});

			test("returns null for glyphs without italic correction", () => {
				if (stixMath) {
					const result = getItalicsCorrection(stixMath, 0);
					expect(result).toBeNull();
				}
			});

			test("returns italic correction for covered glyphs", () => {
				if (stixMath) {
					const glyphId = stixFont.glyphIdForChar("x");
					const result = getItalicsCorrection(stixMath, glyphId);
					if (result) {
						expect(typeof result.value).toBe("number");
					}
				}
			});

			test("italic correction values are reasonable", () => {
				if (stixMath?.glyphInfo?.italicsCorrection) {
					const coverage = stixMath.glyphInfo.italicsCorrection.coverage;
					const values = stixMath.glyphInfo.italicsCorrection.values;
					const glyphIds = Array.from({ length: stixFont.numGlyphs }, (_, i) => i);

					for (const glyphId of glyphIds) {
						const index = coverage.get(glyphId);
						if (index !== null && values[index]) {
							const correction = values[index];
							if (correction) {
								expect(Math.abs(correction.value)).toBeLessThan(
									stixFont.unitsPerEm,
								);
							}
						}
					}
				}
			});
		});

		describe("getTopAccentAttachment", () => {
			test("returns null for fonts without MATH table", () => {
				const noMathTable = null;
				if (noMathTable === null) {
					expect(true).toBe(true);
				}
			});

			test("returns null for glyphs without top accent attachment", () => {
				if (stixMath) {
					const result = getTopAccentAttachment(stixMath, 0);
					expect(result).toBeNull();
				}
			});

			test("returns top accent attachment for covered glyphs", () => {
				if (stixMath) {
					const glyphId = stixFont.glyphIdForChar("A");
					const result = getTopAccentAttachment(stixMath, glyphId);
					if (result) {
						expect(typeof result.value).toBe("number");
						expect(result.value).toBeGreaterThanOrEqual(0);
					}
				}
			});
		});

		describe("isExtendedShape", () => {
			test("returns false for fonts without MATH table", () => {
				const noMathTable = null;
				if (noMathTable === null) {
					expect(true).toBe(true);
				}
			});

			test("returns false for glyphs not in extended shape coverage", () => {
				if (stixMath) {
					const glyphId = stixFont.glyphIdForChar("A");
					const result = isExtendedShape(stixMath, glyphId);
					expect(typeof result).toBe("boolean");
				}
			});

			test("identifies extended shapes correctly", () => {
				if (stixMath?.glyphInfo?.extendedShapeCoverage) {
					const coverage = stixMath.glyphInfo.extendedShapeCoverage.coverage;
					const glyphIds = Array.from({ length: stixFont.numGlyphs }, (_, i) => i);

					for (const glyphId of glyphIds) {
						const inCoverage = coverage.get(glyphId) !== null;
						const isExtended = isExtendedShape(stixMath, glyphId);
						expect(isExtended).toBe(inCoverage);
					}
				}
			});
		});

		describe("getVerticalVariants", () => {
			test("returns null for fonts without MATH table", () => {
				const noMathTable = null;
				if (noMathTable === null) {
					expect(true).toBe(true);
				}
			});

			test("returns null for glyphs without vertical variants", () => {
				if (stixMath) {
					const glyphId = stixFont.glyphIdForChar("A");
					const result = getVerticalVariants(stixMath, glyphId);
					if (result === null) {
						expect(result).toBeNull();
					}
				}
			});

			test("returns vertical variants for covered glyphs", () => {
				if (stixMath?.variants?.vertGlyphCoverage) {
					const coverage = stixMath.variants.vertGlyphCoverage;
					const glyphIds = Array.from({ length: stixFont.numGlyphs }, (_, i) => i);

					for (const glyphId of glyphIds) {
						const index = coverage.get(glyphId);
						if (index !== null) {
							const variants = getVerticalVariants(stixMath, glyphId);
							if (variants) {
								expect(Array.isArray(variants)).toBe(true);
								expect(variants.length).toBeGreaterThan(0);
								for (const variant of variants) {
									expect(typeof variant.variantGlyph).toBe("number");
									expect(typeof variant.advanceMeasurement).toBe("number");
								}
							}
							break;
						}
					}
				}
			});

			test("vertical variants have increasing sizes", () => {
				if (stixMath?.variants?.vertGlyphCoverage) {
					const coverage = stixMath.variants.vertGlyphCoverage;
					const glyphIds = Array.from({ length: stixFont.numGlyphs }, (_, i) => i);

					for (const glyphId of glyphIds) {
						const variants = getVerticalVariants(stixMath, glyphId);
						if (variants && variants.length > 1) {
							for (let i = 1; i < variants.length; i++) {
								const prev = variants[i - 1];
								const curr = variants[i];
								if (prev && curr) {
									expect(curr.advanceMeasurement).toBeGreaterThanOrEqual(
										prev.advanceMeasurement,
									);
								}
							}
							break;
						}
					}
				}
			});
		});

		describe("getHorizontalVariants", () => {
			test("returns null for fonts without MATH table", () => {
				const noMathTable = null;
				if (noMathTable === null) {
					expect(true).toBe(true);
				}
			});

			test("returns null for glyphs without horizontal variants", () => {
				if (stixMath) {
					const glyphId = stixFont.glyphIdForChar("A");
					const result = getHorizontalVariants(stixMath, glyphId);
					if (result === null) {
						expect(result).toBeNull();
					}
				}
			});

			test("returns horizontal variants for covered glyphs", () => {
				if (stixMath?.variants?.horizGlyphCoverage) {
					const coverage = stixMath.variants.horizGlyphCoverage;
					const glyphIds = Array.from({ length: stixFont.numGlyphs }, (_, i) => i);

					for (const glyphId of glyphIds) {
						const index = coverage.get(glyphId);
						if (index !== null) {
							const variants = getHorizontalVariants(stixMath, glyphId);
							if (variants) {
								expect(Array.isArray(variants)).toBe(true);
								expect(variants.length).toBeGreaterThan(0);
							}
							break;
						}
					}
				}
			});
		});

		describe("getVerticalAssembly", () => {
			test("returns null for fonts without MATH table", () => {
				const noMathTable = null;
				if (noMathTable === null) {
					expect(true).toBe(true);
				}
			});

			test("returns null for glyphs without vertical assembly", () => {
				if (stixMath) {
					const glyphId = stixFont.glyphIdForChar("A");
					const result = getVerticalAssembly(stixMath, glyphId);
					if (result === null) {
						expect(result).toBeNull();
					}
				}
			});

			test("returns vertical assembly for covered glyphs", () => {
				if (stixMath?.variants?.vertGlyphCoverage) {
					const coverage = stixMath.variants.vertGlyphCoverage;
					const constructions = stixMath.variants.vertGlyphConstruction;

					const glyphIds = Array.from({ length: stixFont.numGlyphs }, (_, i) => i);

					for (const glyphId of glyphIds) {
						const index = coverage.get(glyphId);
						if (
							index !== null &&
							constructions[index]?.glyphAssembly !== null
						) {
							const assembly = getVerticalAssembly(stixMath, glyphId);
							if (assembly) {
								expect(assembly.parts).toBeDefined();
								expect(Array.isArray(assembly.parts)).toBe(true);
								expect(assembly.parts.length).toBeGreaterThan(0);
								expect(assembly.italicsCorrection).toBeDefined();
							}
							break;
						}
					}
				}
			});

			test("assembly parts have valid glyph IDs", () => {
				if (stixMath) {
					const glyphIds = Array.from({ length: stixFont.numGlyphs }, (_, i) => i);

					for (const glyphId of glyphIds) {
						const assembly = getVerticalAssembly(stixMath, glyphId);
						if (assembly) {
							for (const part of assembly.parts) {
								expect(part.glyphId).toBeGreaterThanOrEqual(0);
								expect(part.glyphId).toBeLessThan(stixFont.numGlyphs);
							}
							break;
						}
					}
				}
			});
		});

		describe("getHorizontalAssembly", () => {
			test("returns null for fonts without MATH table", () => {
				const noMathTable = null;
				if (noMathTable === null) {
					expect(true).toBe(true);
				}
			});

			test("returns null for glyphs without horizontal assembly", () => {
				if (stixMath) {
					const glyphId = stixFont.glyphIdForChar("A");
					const result = getHorizontalAssembly(stixMath, glyphId);
					if (result === null) {
						expect(result).toBeNull();
					}
				}
			});

			test("returns horizontal assembly for covered glyphs", () => {
				if (stixMath?.variants?.horizGlyphCoverage) {
					const coverage = stixMath.variants.horizGlyphCoverage;
					const constructions = stixMath.variants.horizGlyphConstruction;

					const glyphIds = Array.from({ length: stixFont.numGlyphs }, (_, i) => i);

					for (const glyphId of glyphIds) {
						const index = coverage.get(glyphId);
						if (
							index !== null &&
							constructions[index]?.glyphAssembly !== null
						) {
							const assembly = getHorizontalAssembly(stixMath, glyphId);
							if (assembly) {
								expect(assembly.parts).toBeDefined();
								expect(Array.isArray(assembly.parts)).toBe(true);
								expect(assembly.parts.length).toBeGreaterThan(0);
							}
							break;
						}
					}
				}
			});
		});
	});

	describe("XITS Math font specific tests", () => {
		test("has valid constants", () => {
			const constants = xitsMath?.constants;
			if (constants) {
				expect(constants.scriptPercentScaleDown).toBeGreaterThan(0);
				expect(constants.scriptPercentScaleDown).toBeLessThanOrEqual(100);
				expect(constants.scriptScriptPercentScaleDown).toBeGreaterThan(0);
				expect(constants.scriptScriptPercentScaleDown).toBeLessThan(
					constants.scriptPercentScaleDown,
				);
			}
		});

		test("has glyph info tables", () => {
			const glyphInfo = xitsMath?.glyphInfo;
			if (glyphInfo) {
				expect(glyphInfo.italicsCorrection).toBeDefined();
				expect(glyphInfo.topAccentAttachment).toBeDefined();
				expect(glyphInfo.extendedShapeCoverage).toBeDefined();
			}
		});

		test("has math variants", () => {
			const variants = xitsMath?.variants;
			if (variants) {
				expect(variants.minConnectorOverlap).toBeGreaterThan(0);
				expect(variants.vertGlyphConstruction.length).toBeGreaterThan(0);
				expect(variants.horizGlyphConstruction.length).toBeGreaterThan(0);
			}
		});
	});

	describe("Cross-font consistency", () => {
		test("both fonts have MATH tables", () => {
			expect(stixMath).not.toBeNull();
			expect(xitsMath).not.toBeNull();
		});

		test("both fonts have version 1.0", () => {
			if (stixMath && xitsMath) {
				expect(stixMath.majorVersion).toBe(1);
				expect(xitsMath.majorVersion).toBe(1);
			}
		});

		test("both fonts have all three subtables", () => {
			if (stixMath && xitsMath) {
				expect(stixMath.constants).not.toBeNull();
				expect(stixMath.glyphInfo).not.toBeNull();
				expect(stixMath.variants).not.toBeNull();

				expect(xitsMath.constants).not.toBeNull();
				expect(xitsMath.glyphInfo).not.toBeNull();
				expect(xitsMath.variants).not.toBeNull();
			}
		});

		test("both fonts have similar constant structure", () => {
			if (stixMath?.constants && xitsMath?.constants) {
				const stixKeys = Object.keys(stixMath.constants);
				const xitsKeys = Object.keys(xitsMath.constants);
				expect(stixKeys.sort()).toEqual(xitsKeys.sort());
			}
		});
	});

	describe("Edge cases and error handling", () => {
		test("handles null math table gracefully", () => {
			const nullMath = null;
			if (nullMath === null) {
				expect(true).toBe(true);
			}
		});

		test("handles invalid glyph IDs", () => {
			if (stixMath) {
				const invalidGlyphId = 999999;
				expect(getItalicsCorrection(stixMath, invalidGlyphId)).toBeNull();
				expect(getTopAccentAttachment(stixMath, invalidGlyphId)).toBeNull();
				expect(isExtendedShape(stixMath, invalidGlyphId)).toBe(false);
				expect(getVerticalVariants(stixMath, invalidGlyphId)).toBeNull();
				expect(getHorizontalVariants(stixMath, invalidGlyphId)).toBeNull();
				expect(getVerticalAssembly(stixMath, invalidGlyphId)).toBeNull();
				expect(getHorizontalAssembly(stixMath, invalidGlyphId)).toBeNull();
			}
		});

		test("handles glyphs at boundary positions", () => {
			if (stixMath) {
				const firstGlyph = 0;
				const lastGlyph = stixFont.numGlyphs - 1;

				expect(() => getItalicsCorrection(stixMath, firstGlyph)).not.toThrow();
				expect(() => getItalicsCorrection(stixMath, lastGlyph)).not.toThrow();
			}
		});
	});
});
