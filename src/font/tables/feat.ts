import type { uint16, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * AAT Feature Name table (feat)
 * https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6feat.html
 *
 * Defines the font's typographic features that can be controlled by the user.
 * Each feature has a type and settings with human-readable names.
 */
export interface FeatTable {
	version: number;
	features: FeatureRecord[];
}

/**
 * A single feature record
 */
export interface FeatureRecord {
	/** Feature type (e.g., 1 = ligatures, 2 = cursive connection) */
	featureType: uint16;
	/** Number of settings for this feature */
	nSettings: uint16;
	/** Offset to setting name array */
	settingTableOffset: uint32;
	/** Feature flags */
	featureFlags: uint16;
	/** Default setting index */
	defaultSettingIndex: uint16;
	/** Name table ID for feature name */
	nameId: uint16;
	/** Parsed settings */
	settings: FeatureSetting[];
}

/**
 * A single feature setting
 */
export interface FeatureSetting {
	/** Setting value to use in morx feature table */
	settingValue: uint16;
	/** Name table ID for setting name */
	nameId: uint16;
}

/**
 * Feature type constants (Apple-defined)
 */
export enum FeatureType {
	/** All typographic features */
	AllTypographicFeatures = 0,
	/** Ligatures */
	Ligatures = 1,
	/** Cursive connection */
	CursiveConnection = 2,
	/** Letter case */
	LetterCase = 3,
	/** Vertical substitution */
	VerticalSubstitution = 4,
	/** Linguistic rearrangement */
	LinguisticRearrangement = 5,
	/** Number spacing */
	NumberSpacing = 6,
	/** Smart swashes */
	SmartSwashes = 8,
	/** Diacritics */
	Diacritics = 9,
	/** Vertical position */
	VerticalPosition = 10,
	/** Fractions */
	Fractions = 11,
	/** Overlapping characters */
	OverlappingCharacters = 13,
	/** Typographic extras */
	TypographicExtras = 14,
	/** Mathematical extras */
	MathematicalExtras = 15,
	/** Ornament sets */
	OrnamentSets = 16,
	/** Character alternatives */
	CharacterAlternatives = 17,
	/** Design complexity */
	DesignComplexity = 18,
	/** Style options */
	StyleOptions = 19,
	/** Character shape */
	CharacterShape = 20,
	/** Number case */
	NumberCase = 21,
	/** Text spacing */
	TextSpacing = 22,
	/** Transliteration */
	Transliteration = 23,
	/** Annotation */
	Annotation = 24,
	/** Kana spacing */
	KanaSpacing = 25,
	/** Ideographic spacing */
	IdeographicSpacing = 26,
	/** Unicode decomposition */
	UnicodeDecomposition = 27,
	/** Ruby kana */
	RubyKana = 28,
	/** CJK symbol alternatives */
	CJKSymbolAlternatives = 29,
	/** Ideographic alternatives */
	IdeographicAlternatives = 30,
	/** CJK vertical roman placement */
	CJKVerticalRomanPlacement = 31,
	/** Italic CJK roman */
	ItalicCJKRoman = 32,
	/** Case-sensitive layout */
	CaseSensitiveLayout = 33,
	/** Alternate kana */
	AlternateKana = 34,
	/** Stylistic alternatives */
	StylisticAlternatives = 35,
	/** Contextual alternatives */
	ContextualAlternatives = 36,
	/** Lower case */
	LowerCase = 37,
	/** Upper case */
	UpperCase = 38,
	/** Language tag */
	LanguageTag = 39,
	/** CJK roman spacing */
	CJKRomanSpacing = 103,
}

/**
 * Common ligature settings
 */
export enum LigatureSetting {
	RequiredLigaturesOn = 0,
	RequiredLigaturesOff = 1,
	CommonLigaturesOn = 2,
	CommonLigaturesOff = 3,
	RareLigaturesOn = 4,
	RareLigaturesOff = 5,
	LogosOn = 6,
	LogosOff = 7,
	RebusPicturesOn = 8,
	RebusPicturesOff = 9,
	DiphthongLigaturesOn = 10,
	DiphthongLigaturesOff = 11,
	SquaredLigaturesOn = 12,
	SquaredLigaturesOff = 13,
	AbbrevSquaredLigaturesOn = 14,
	AbbrevSquaredLigaturesOff = 15,
	SymbolLigaturesOn = 16,
	SymbolLigaturesOff = 17,
	ContextualLigaturesOn = 18,
	ContextualLigaturesOff = 19,
	HistoricalLigaturesOn = 20,
	HistoricalLigaturesOff = 21,
}

/**
 * Vertical position settings
 */
export enum VerticalPositionSetting {
	NormalPosition = 0,
	Superiors = 1,
	Inferiors = 2,
	Ordinals = 3,
	ScientificInferiors = 4,
}

/**
 * Number case settings
 */
export enum NumberCaseSetting {
	LowerCaseNumbers = 0,
	UpperCaseNumbers = 1,
}

/**
 * Number spacing settings
 */
export enum NumberSpacingSetting {
	MonospacedNumbers = 0,
	ProportionalNumbers = 1,
	ThirdWidthNumbers = 2,
	QuarterWidthNumbers = 3,
}

/**
 * Fractions settings
 */
export enum FractionsSetting {
	NoFractions = 0,
	VerticalFractions = 1,
	DiagonalFractions = 2,
}

/**
 * Case-sensitive layout settings
 */
export enum CaseSensitiveLayoutSetting {
	CaseSensitiveLayoutOn = 0,
	CaseSensitiveLayoutOff = 1,
	CaseSensitiveSpacingOn = 2,
	CaseSensitiveSpacingOff = 3,
}

/**
 * Stylistic alternatives settings
 */
export enum StylisticAlternativesSetting {
	NoStylisticAlternates = 0,
	StylisticAltOneOn = 2,
	StylisticAltOneOff = 3,
	StylisticAltTwoOn = 4,
	StylisticAltTwoOff = 5,
	StylisticAltThreeOn = 6,
	StylisticAltThreeOff = 7,
	StylisticAltFourOn = 8,
	StylisticAltFourOff = 9,
	StylisticAltFiveOn = 10,
	StylisticAltFiveOff = 11,
	StylisticAltSixOn = 12,
	StylisticAltSixOff = 13,
	StylisticAltSevenOn = 14,
	StylisticAltSevenOff = 15,
	StylisticAltEightOn = 16,
	StylisticAltEightOff = 17,
	StylisticAltNineOn = 18,
	StylisticAltNineOff = 19,
	StylisticAltTenOn = 20,
	StylisticAltTenOff = 21,
	StylisticAltElevenOn = 22,
	StylisticAltElevenOff = 23,
	StylisticAltTwelveOn = 24,
	StylisticAltTwelveOff = 25,
	StylisticAltThirteenOn = 26,
	StylisticAltThirteenOff = 27,
	StylisticAltFourteenOn = 28,
	StylisticAltFourteenOff = 29,
	StylisticAltFifteenOn = 30,
	StylisticAltFifteenOff = 31,
	StylisticAltSixteenOn = 32,
	StylisticAltSixteenOff = 33,
	StylisticAltSeventeenOn = 34,
	StylisticAltSeventeenOff = 35,
	StylisticAltEighteenOn = 36,
	StylisticAltEighteenOff = 37,
	StylisticAltNineteenOn = 38,
	StylisticAltNineteenOff = 39,
	StylisticAltTwentyOn = 40,
	StylisticAltTwentyOff = 41,
}

/**
 * Contextual alternatives settings
 */
export enum ContextualAlternativesSetting {
	ContextualAlternatesOn = 0,
	ContextualAlternatesOff = 1,
	SwashAlternatesOn = 2,
	SwashAlternatesOff = 3,
	ContextualSwashAlternatesOn = 4,
	ContextualSwashAlternatesOff = 5,
}

/**
 * Lower case settings
 */
export enum LowerCaseSetting {
	DefaultLowerCase = 0,
	LowerCaseSmallCaps = 1,
	LowerCasePetiteCaps = 2,
}

/**
 * Upper case settings
 */
export enum UpperCaseSetting {
	DefaultUpperCase = 0,
	UpperCaseSmallCaps = 1,
	UpperCasePetiteCaps = 2,
}

/**
 * Smart swash settings
 */
export enum SmartSwashSetting {
	WordInitialSwashesOn = 0,
	WordInitialSwashesOff = 1,
	WordFinalSwashesOn = 2,
	WordFinalSwashesOff = 3,
	LineInitialSwashesOn = 4,
	LineInitialSwashesOff = 5,
	LineFinalSwashesOn = 6,
	LineFinalSwashesOff = 7,
	NonFinalSwashesOn = 8,
	NonFinalSwashesOff = 9,
}

/**
 * Diacritics settings
 */
export enum DiacriticsSetting {
	ShowDiacritics = 0,
	HideDiacritics = 1,
	DecomposeDiacritics = 2,
}

/**
 * Character shape settings (CJK)
 */
export enum CharacterShapeSetting {
	TraditionalCharacters = 0,
	SimplifiedCharacters = 1,
	JIS1978Characters = 2,
	JIS1983Characters = 3,
	JIS1990Characters = 4,
	TraditionalAltOne = 5,
	TraditionalAltTwo = 6,
	TraditionalAltThree = 7,
	TraditionalAltFour = 8,
	TraditionalAltFive = 9,
	ExpertCharacters = 10,
	NLCCharacters = 13,
	JIS2004Characters = 11,
	HojoCharacters = 12,
}

/**
 * Feature flag bits
 */
export enum FeatureFlags {
	/** Feature settings are mutually exclusive */
	Exclusive = 0x8000,
	/** Use default setting index if not specified */
	UseDefault = 0x4000,
}

/**
 * Parse feat table
 */
export function parseFeat(reader: Reader): FeatTable {
	const tableStart = reader.offset;

	const version = reader.fixed();
	const featureNameCount = reader.uint16();
	reader.skip(2); // reserved
	reader.skip(4); // reserved

	const features: FeatureRecord[] = [];

	for (let i = 0; i < featureNameCount; i++) {
		const featureType = reader.uint16();
		const nSettings = reader.uint16();
		const settingTableOffset = reader.offset32();
		const featureFlags = reader.uint16();
		const defaultSettingIndex = featureFlags & 0xff;
		const nameId = reader.uint16();

		// Parse settings
		const settings: FeatureSetting[] = [];
		const savedOffset = reader.offset;

		reader.seek(tableStart + settingTableOffset);
		for (let j = 0; j < nSettings; j++) {
			settings.push({
				settingValue: reader.uint16(),
				nameId: reader.uint16(),
			});
		}

		reader.seek(savedOffset);

		features.push({
			featureType,
			nSettings,
			settingTableOffset,
			featureFlags,
			defaultSettingIndex,
			nameId,
			settings,
		});
	}

	return { version, features };
}

/**
 * Get a feature by type
 */
export function getFeature(
	table: FeatTable,
	featureType: FeatureType | uint16,
): FeatureRecord | undefined {
	return table.features.find((f) => f.featureType === featureType);
}

/**
 * Get all features of a given type
 */
export function getAllFeatures(table: FeatTable): FeatureRecord[] {
	return table.features;
}

/**
 * Check if a feature is exclusive (only one setting can be active)
 */
export function isExclusiveFeature(feature: FeatureRecord): boolean {
	return (feature.featureFlags & FeatureFlags.Exclusive) !== 0;
}

/**
 * Get the default setting for a feature
 */
export function getDefaultSetting(
	feature: FeatureRecord,
): FeatureSetting | undefined {
	return feature.settings[feature.defaultSettingIndex];
}

/**
 * Get a setting by value
 */
export function getSettingByValue(
	feature: FeatureRecord,
	settingValue: uint16,
): FeatureSetting | undefined {
	return feature.settings.find((s) => s.settingValue === settingValue);
}

/**
 * Check if a feature has a specific setting
 */
export function hasSettingValue(
	feature: FeatureRecord,
	settingValue: uint16,
): boolean {
	return feature.settings.some((s) => s.settingValue === settingValue);
}

/**
 * Convert AAT feature type/setting to OpenType feature tag
 * This is a best-effort mapping as there's no 1:1 correspondence
 */
export function aatToOpenTypeTag(
	featureType: FeatureType | uint16,
	settingValue: uint16,
): string | null {
	switch (featureType) {
		case FeatureType.Ligatures:
			switch (settingValue) {
				case LigatureSetting.CommonLigaturesOn:
					return "liga";
				case LigatureSetting.RareLigaturesOn:
					return "dlig";
				case LigatureSetting.HistoricalLigaturesOn:
					return "hlig";
				case LigatureSetting.ContextualLigaturesOn:
					return "clig";
				case LigatureSetting.RequiredLigaturesOn:
					return "rlig";
			}
			break;
		case FeatureType.VerticalPosition:
			switch (settingValue) {
				case VerticalPositionSetting.Superiors:
					return "sups";
				case VerticalPositionSetting.Inferiors:
					return "subs";
				case VerticalPositionSetting.Ordinals:
					return "ordn";
				case VerticalPositionSetting.ScientificInferiors:
					return "sinf";
			}
			break;
		case FeatureType.Fractions:
			if (
				settingValue === FractionsSetting.VerticalFractions ||
				settingValue === FractionsSetting.DiagonalFractions
			) {
				return "frac";
			}
			break;
		case FeatureType.NumberCase:
			switch (settingValue) {
				case NumberCaseSetting.LowerCaseNumbers:
					return "onum";
				case NumberCaseSetting.UpperCaseNumbers:
					return "lnum";
			}
			break;
		case FeatureType.NumberSpacing:
			switch (settingValue) {
				case NumberSpacingSetting.MonospacedNumbers:
					return "tnum";
				case NumberSpacingSetting.ProportionalNumbers:
					return "pnum";
			}
			break;
		case FeatureType.CaseSensitiveLayout:
			if (settingValue === CaseSensitiveLayoutSetting.CaseSensitiveLayoutOn) {
				return "case";
			}
			break;
		case FeatureType.LowerCase:
			switch (settingValue) {
				case LowerCaseSetting.LowerCaseSmallCaps:
					return "smcp";
				case LowerCaseSetting.LowerCasePetiteCaps:
					return "pcap";
			}
			break;
		case FeatureType.UpperCase:
			switch (settingValue) {
				case UpperCaseSetting.UpperCaseSmallCaps:
					return "c2sc";
				case UpperCaseSetting.UpperCasePetiteCaps:
					return "c2pc";
			}
			break;
		case FeatureType.SmartSwashes:
			if (
				settingValue === SmartSwashSetting.WordInitialSwashesOn ||
				settingValue === SmartSwashSetting.WordFinalSwashesOn
			) {
				return "swsh";
			}
			break;
		case FeatureType.ContextualAlternatives:
			switch (settingValue) {
				case ContextualAlternativesSetting.ContextualAlternatesOn:
					return "calt";
				case ContextualAlternativesSetting.SwashAlternatesOn:
					return "swsh";
			}
			break;
		case FeatureType.StylisticAlternatives:
			// Stylistic sets ss01-ss20
			if (settingValue >= 2 && settingValue <= 41) {
				const setNum = Math.floor((settingValue - 2) / 2) + 1;
				if (setNum <= 20) {
					return `ss${setNum.toString().padStart(2, "0")}`;
				}
			}
			break;
		case FeatureType.CharacterShape:
			switch (settingValue) {
				case CharacterShapeSetting.TraditionalCharacters:
					return "trad";
				case CharacterShapeSetting.SimplifiedCharacters:
					return "smpl";
				case CharacterShapeSetting.JIS1978Characters:
					return "jp78";
				case CharacterShapeSetting.JIS1983Characters:
					return "jp83";
				case CharacterShapeSetting.JIS1990Characters:
					return "jp90";
				case CharacterShapeSetting.JIS2004Characters:
					return "jp04";
				case CharacterShapeSetting.NLCCharacters:
					return "nlck";
				case CharacterShapeSetting.ExpertCharacters:
					return "expt";
				case CharacterShapeSetting.HojoCharacters:
					return "hojo";
			}
			break;
		case FeatureType.VerticalSubstitution:
			return "vert";
		case FeatureType.Annotation:
			return "nalt";
		case FeatureType.RubyKana:
			return "ruby";
	}

	return null;
}

/**
 * Convert OpenType feature tag to AAT feature type/setting
 * Returns null if no mapping exists
 */
export function openTypeTagToAat(
	tag: string,
): { featureType: FeatureType; settingValue: uint16 } | null {
	switch (tag) {
		case "liga":
			return {
				featureType: FeatureType.Ligatures,
				settingValue: LigatureSetting.CommonLigaturesOn,
			};
		case "dlig":
			return {
				featureType: FeatureType.Ligatures,
				settingValue: LigatureSetting.RareLigaturesOn,
			};
		case "hlig":
			return {
				featureType: FeatureType.Ligatures,
				settingValue: LigatureSetting.HistoricalLigaturesOn,
			};
		case "clig":
			return {
				featureType: FeatureType.Ligatures,
				settingValue: LigatureSetting.ContextualLigaturesOn,
			};
		case "rlig":
			return {
				featureType: FeatureType.Ligatures,
				settingValue: LigatureSetting.RequiredLigaturesOn,
			};
		case "sups":
			return {
				featureType: FeatureType.VerticalPosition,
				settingValue: VerticalPositionSetting.Superiors,
			};
		case "subs":
			return {
				featureType: FeatureType.VerticalPosition,
				settingValue: VerticalPositionSetting.Inferiors,
			};
		case "ordn":
			return {
				featureType: FeatureType.VerticalPosition,
				settingValue: VerticalPositionSetting.Ordinals,
			};
		case "sinf":
			return {
				featureType: FeatureType.VerticalPosition,
				settingValue: VerticalPositionSetting.ScientificInferiors,
			};
		case "frac":
			return {
				featureType: FeatureType.Fractions,
				settingValue: FractionsSetting.DiagonalFractions,
			};
		case "onum":
			return {
				featureType: FeatureType.NumberCase,
				settingValue: NumberCaseSetting.LowerCaseNumbers,
			};
		case "lnum":
			return {
				featureType: FeatureType.NumberCase,
				settingValue: NumberCaseSetting.UpperCaseNumbers,
			};
		case "tnum":
			return {
				featureType: FeatureType.NumberSpacing,
				settingValue: NumberSpacingSetting.MonospacedNumbers,
			};
		case "pnum":
			return {
				featureType: FeatureType.NumberSpacing,
				settingValue: NumberSpacingSetting.ProportionalNumbers,
			};
		case "case":
			return {
				featureType: FeatureType.CaseSensitiveLayout,
				settingValue: CaseSensitiveLayoutSetting.CaseSensitiveLayoutOn,
			};
		case "smcp":
			return {
				featureType: FeatureType.LowerCase,
				settingValue: LowerCaseSetting.LowerCaseSmallCaps,
			};
		case "pcap":
			return {
				featureType: FeatureType.LowerCase,
				settingValue: LowerCaseSetting.LowerCasePetiteCaps,
			};
		case "c2sc":
			return {
				featureType: FeatureType.UpperCase,
				settingValue: UpperCaseSetting.UpperCaseSmallCaps,
			};
		case "c2pc":
			return {
				featureType: FeatureType.UpperCase,
				settingValue: UpperCaseSetting.UpperCasePetiteCaps,
			};
		case "swsh":
			return {
				featureType: FeatureType.SmartSwashes,
				settingValue: SmartSwashSetting.WordInitialSwashesOn,
			};
		case "calt":
			return {
				featureType: FeatureType.ContextualAlternatives,
				settingValue: ContextualAlternativesSetting.ContextualAlternatesOn,
			};
		case "trad":
			return {
				featureType: FeatureType.CharacterShape,
				settingValue: CharacterShapeSetting.TraditionalCharacters,
			};
		case "smpl":
			return {
				featureType: FeatureType.CharacterShape,
				settingValue: CharacterShapeSetting.SimplifiedCharacters,
			};
		case "jp78":
			return {
				featureType: FeatureType.CharacterShape,
				settingValue: CharacterShapeSetting.JIS1978Characters,
			};
		case "jp83":
			return {
				featureType: FeatureType.CharacterShape,
				settingValue: CharacterShapeSetting.JIS1983Characters,
			};
		case "jp90":
			return {
				featureType: FeatureType.CharacterShape,
				settingValue: CharacterShapeSetting.JIS1990Characters,
			};
		case "jp04":
			return {
				featureType: FeatureType.CharacterShape,
				settingValue: CharacterShapeSetting.JIS2004Characters,
			};
		case "nlck":
			return {
				featureType: FeatureType.CharacterShape,
				settingValue: CharacterShapeSetting.NLCCharacters,
			};
		case "expt":
			return {
				featureType: FeatureType.CharacterShape,
				settingValue: CharacterShapeSetting.ExpertCharacters,
			};
		case "hojo":
			return {
				featureType: FeatureType.CharacterShape,
				settingValue: CharacterShapeSetting.HojoCharacters,
			};
		case "vert":
			return { featureType: FeatureType.VerticalSubstitution, settingValue: 0 };
		case "nalt":
			return { featureType: FeatureType.Annotation, settingValue: 0 };
		case "ruby":
			return { featureType: FeatureType.RubyKana, settingValue: 0 };
	}

	// Handle stylistic sets ss01-ss20
	if (tag.startsWith("ss") && tag.length === 4) {
		const num = parseInt(tag.slice(2), 10);
		if (num >= 1 && num <= 20) {
			return {
				featureType: FeatureType.StylisticAlternatives,
				settingValue: (num - 1) * 2 + 2,
			};
		}
	}

	return null;
}
