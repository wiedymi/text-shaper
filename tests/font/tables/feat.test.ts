import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseFeat,
	getFeature,
	getAllFeatures,
	isExclusiveFeature,
	getDefaultSetting,
	getSettingByValue,
	hasSettingValue,
	aatToOpenTypeTag,
	openTypeTagToAat,
	FeatureType,
	FeatureFlags,
	LigatureSetting,
	VerticalPositionSetting,
	NumberCaseSetting,
	NumberSpacingSetting,
	FractionsSetting,
	CaseSensitiveLayoutSetting,
	StylisticAlternativesSetting,
	ContextualAlternativesSetting,
	LowerCaseSetting,
	UpperCaseSetting,
	SmartSwashSetting,
	DiacriticsSetting,
	CharacterShapeSetting,
	type FeatTable,
	type FeatureRecord,
	type FeatureSetting,
} from "../../../src/font/tables/feat.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

describe("feat table - synthetic tests", () => {
	describe("parseFeat", () => {
		test("parses minimal feat table with version 1.0", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);
			let offset = 0;

			// Version 1.0 (Fixed 16.16)
			view.setUint32(offset, 0x00010000, false);
			offset += 4;
			// Feature count
			view.setUint16(offset, 0, false);
			offset += 2;
			// Reserved (2 bytes)
			view.setUint16(offset, 0, false);
			offset += 2;
			// Reserved (4 bytes)
			view.setUint32(offset, 0, false);
			offset += 4;

			const reader = new Reader(buffer);
			const feat = parseFeat(reader);

			expect(feat.version).toBe(1.0);
			expect(feat.features.length).toBe(0);
		});

		test("parses feat table with single feature", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);
			let offset = 0;

			// Header
			view.setUint32(offset, 0x00010000, false); // version 1.0
			offset += 4;
			view.setUint16(offset, 1, false); // 1 feature
			offset += 2;
			view.setUint16(offset, 0, false); // reserved
			offset += 2;
			view.setUint32(offset, 0, false); // reserved
			offset += 4;

			// Feature record (12 bytes)
			view.setUint16(offset, FeatureType.Ligatures, false); // featureType
			offset += 2;
			view.setUint16(offset, 2, false); // nSettings
			offset += 2;
			view.setUint32(offset, 24, false); // settingTableOffset (12 + 12 = 24)
			offset += 4;
			view.setUint16(offset, FeatureFlags.Exclusive, false); // featureFlags
			offset += 2;
			view.setUint16(offset, 256, false); // nameId
			offset += 2;

			// Setting table at offset 24
			view.setUint16(24, LigatureSetting.CommonLigaturesOn, false); // settingValue
			view.setUint16(26, 300, false); // nameId
			view.setUint16(28, LigatureSetting.CommonLigaturesOff, false); // settingValue
			view.setUint16(30, 301, false); // nameId

			const reader = new Reader(buffer);
			const feat = parseFeat(reader);

			expect(feat.version).toBe(1.0);
			expect(feat.features.length).toBe(1);

			const feature = feat.features[0];
			if (feature) {
				expect(feature.featureType).toBe(FeatureType.Ligatures);
				expect(feature.nSettings).toBe(2);
				expect(feature.settingTableOffset).toBe(24);
				expect(feature.featureFlags).toBe(FeatureFlags.Exclusive);
				expect(feature.defaultSettingIndex).toBe(0);
				expect(feature.nameId).toBe(256);
				expect(feature.settings.length).toBe(2);
				expect(feature.settings[0]?.settingValue).toBe(
					LigatureSetting.CommonLigaturesOn,
				);
				expect(feature.settings[0]?.nameId).toBe(300);
				expect(feature.settings[1]?.settingValue).toBe(
					LigatureSetting.CommonLigaturesOff,
				);
				expect(feature.settings[1]?.nameId).toBe(301);
			}
		});

		test("parses feat table with multiple features", () => {
			const buffer = new ArrayBuffer(300);
			const view = new DataView(buffer);

			// Header (12 bytes)
			view.setUint32(0, 0x00010000, false); // version
			view.setUint16(4, 2, false); // 2 features
			view.setUint16(6, 0, false); // reserved
			view.setUint32(8, 0, false); // reserved

			// Feature 1: Ligatures at offset 12 (12 bytes)
			view.setUint16(12, FeatureType.Ligatures, false);
			view.setUint16(14, 1, false);
			view.setUint32(16, 36, false); // settings at 36
			view.setUint16(20, 0x8000, false); // exclusive
			view.setUint16(22, 256, false);

			// Feature 2: VerticalPosition at offset 24 (12 bytes)
			view.setUint16(24, FeatureType.VerticalPosition, false);
			view.setUint16(26, 2, false);
			view.setUint32(28, 40, false); // settings at 40
			view.setUint16(32, 0x8001, false); // exclusive with default index 1
			view.setUint16(34, 257, false);

			// Settings for feature 1 at offset 36
			view.setUint16(36, LigatureSetting.CommonLigaturesOn, false);
			view.setUint16(38, 300, false);

			// Settings for feature 2 at offset 40
			view.setUint16(40, VerticalPositionSetting.Superiors, false);
			view.setUint16(42, 400, false);
			view.setUint16(44, VerticalPositionSetting.Inferiors, false);
			view.setUint16(46, 401, false);

			const reader = new Reader(buffer);
			const feat = parseFeat(reader);

			expect(feat.features.length).toBe(2);
			expect(feat.features[0]?.featureType).toBe(FeatureType.Ligatures);
			expect(feat.features[1]?.featureType).toBe(
				FeatureType.VerticalPosition,
			);
			expect(feat.features[1]?.defaultSettingIndex).toBe(1);
		});

		test("parses feature with non-exclusive flag", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint32(0, 0x00010000, false);
			view.setUint16(4, 1, false);
			view.setUint16(6, 0, false);
			view.setUint32(8, 0, false);

			// Feature with non-exclusive flag
			view.setUint16(12, FeatureType.SmartSwashes, false);
			view.setUint16(14, 1, false);
			view.setUint32(16, 28, false);
			view.setUint16(20, 0x0000, false); // not exclusive
			view.setUint16(22, 260, false);

			// Setting
			view.setUint16(28, SmartSwashSetting.WordInitialSwashesOn, false);
			view.setUint16(30, 350, false);

			const reader = new Reader(buffer);
			const feat = parseFeat(reader);

			expect(feat.features[0]?.featureFlags).toBe(0x0000);
			expect(isExclusiveFeature(feat.features[0]!)).toBe(false);
		});

		test("extracts default setting index from feature flags", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint32(0, 0x00010000, false);
			view.setUint16(4, 1, false);
			view.setUint16(6, 0, false);
			view.setUint32(8, 0, false);

			// Feature flags with default index 3
			view.setUint16(12, FeatureType.NumberCase, false);
			view.setUint16(14, 4, false);
			view.setUint32(16, 28, false);
			view.setUint16(20, 0x8003, false); // exclusive with index 3
			view.setUint16(22, 270, false);

			// Settings
			for (let i = 0; i < 4; i++) {
				view.setUint16(28 + i * 4, i, false);
				view.setUint16(30 + i * 4, 400 + i, false);
			}

			const reader = new Reader(buffer);
			const feat = parseFeat(reader);

			expect(feat.features[0]?.defaultSettingIndex).toBe(3);
		});

		test("parses version 2.0 format", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint32(0, 0x00020000, false); // version 2.0
			view.setUint16(4, 0, false);
			view.setUint16(6, 0, false);
			view.setUint32(8, 0, false);

			const reader = new Reader(buffer);
			const feat = parseFeat(reader);

			expect(feat.version).toBe(2.0);
		});

		test("parses fractional version numbers", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint32(0, 0x00018000, false); // version 1.5
			view.setUint16(4, 0, false);
			view.setUint16(6, 0, false);
			view.setUint32(8, 0, false);

			const reader = new Reader(buffer);
			const feat = parseFeat(reader);

			expect(feat.version).toBeCloseTo(1.5, 5);
		});
	});

	describe("getFeature", () => {
		function createFeatTable(...featureTypes: number[]): FeatTable {
			return {
				version: 1.0,
				features: featureTypes.map((type, i) => ({
					featureType: type,
					nSettings: 1,
					settingTableOffset: 0,
					featureFlags: 0,
					defaultSettingIndex: 0,
					nameId: 100 + i,
					settings: [{ settingValue: 0, nameId: 200 + i }],
				})),
			};
		}

		test("finds feature by type", () => {
			const feat = createFeatTable(
				FeatureType.Ligatures,
				FeatureType.VerticalPosition,
			);

			const ligatures = getFeature(feat, FeatureType.Ligatures);
			expect(ligatures).not.toBeUndefined();
			expect(ligatures?.featureType).toBe(FeatureType.Ligatures);
		});

		test("returns undefined for missing feature", () => {
			const feat = createFeatTable(FeatureType.Ligatures);

			const fractions = getFeature(feat, FeatureType.Fractions);
			expect(fractions).toBeUndefined();
		});

		test("finds first matching feature when duplicates exist", () => {
			const feat: FeatTable = {
				version: 1.0,
				features: [
					{
						featureType: FeatureType.Ligatures,
						nSettings: 1,
						settingTableOffset: 0,
						featureFlags: 0,
						defaultSettingIndex: 0,
						nameId: 100,
						settings: [{ settingValue: 0, nameId: 200 }],
					},
					{
						featureType: FeatureType.Ligatures,
						nSettings: 1,
						settingTableOffset: 0,
						featureFlags: 0,
						defaultSettingIndex: 0,
						nameId: 101,
						settings: [{ settingValue: 1, nameId: 201 }],
					},
				],
			};

			const ligatures = getFeature(feat, FeatureType.Ligatures);
			expect(ligatures?.nameId).toBe(100);
		});

		test("works with numeric feature type", () => {
			const feat = createFeatTable(1, 2, 3);

			const feature = getFeature(feat, 2);
			expect(feature).not.toBeUndefined();
			expect(feature?.featureType).toBe(2);
		});
	});

	describe("getAllFeatures", () => {
		test("returns all features", () => {
			const feat: FeatTable = {
				version: 1.0,
				features: [
					{
						featureType: FeatureType.Ligatures,
						nSettings: 1,
						settingTableOffset: 0,
						featureFlags: 0,
						defaultSettingIndex: 0,
						nameId: 100,
						settings: [{ settingValue: 0, nameId: 200 }],
					},
					{
						featureType: FeatureType.Fractions,
						nSettings: 1,
						settingTableOffset: 0,
						featureFlags: 0,
						defaultSettingIndex: 0,
						nameId: 101,
						settings: [{ settingValue: 0, nameId: 201 }],
					},
				],
			};

			const all = getAllFeatures(feat);
			expect(all.length).toBe(2);
			expect(all[0]?.featureType).toBe(FeatureType.Ligatures);
			expect(all[1]?.featureType).toBe(FeatureType.Fractions);
		});

		test("returns empty array for table with no features", () => {
			const feat: FeatTable = {
				version: 1.0,
				features: [],
			};

			const all = getAllFeatures(feat);
			expect(all.length).toBe(0);
		});
	});

	describe("isExclusiveFeature", () => {
		test("returns true for exclusive feature", () => {
			const feature: FeatureRecord = {
				featureType: FeatureType.Ligatures,
				nSettings: 2,
				settingTableOffset: 0,
				featureFlags: FeatureFlags.Exclusive,
				defaultSettingIndex: 0,
				nameId: 100,
				settings: [],
			};

			expect(isExclusiveFeature(feature)).toBe(true);
		});

		test("returns false for non-exclusive feature", () => {
			const feature: FeatureRecord = {
				featureType: FeatureType.SmartSwashes,
				nSettings: 2,
				settingTableOffset: 0,
				featureFlags: 0,
				defaultSettingIndex: 0,
				nameId: 100,
				settings: [],
			};

			expect(isExclusiveFeature(feature)).toBe(false);
		});

		test("returns true when exclusive bit is set with other flags", () => {
			const feature: FeatureRecord = {
				featureType: FeatureType.NumberCase,
				nSettings: 2,
				settingTableOffset: 0,
				featureFlags: FeatureFlags.Exclusive | FeatureFlags.UseDefault,
				defaultSettingIndex: 1,
				nameId: 100,
				settings: [],
			};

			expect(isExclusiveFeature(feature)).toBe(true);
		});
	});

	describe("getDefaultSetting", () => {
		test("returns default setting by index", () => {
			const feature: FeatureRecord = {
				featureType: FeatureType.NumberCase,
				nSettings: 2,
				settingTableOffset: 0,
				featureFlags: 0x8001, // default index 1
				defaultSettingIndex: 1,
				nameId: 100,
				settings: [
					{ settingValue: NumberCaseSetting.LowerCaseNumbers, nameId: 200 },
					{ settingValue: NumberCaseSetting.UpperCaseNumbers, nameId: 201 },
				],
			};

			const defaultSetting = getDefaultSetting(feature);
			expect(defaultSetting).not.toBeUndefined();
			expect(defaultSetting?.settingValue).toBe(
				NumberCaseSetting.UpperCaseNumbers,
			);
			expect(defaultSetting?.nameId).toBe(201);
		});

		test("returns first setting when default index is 0", () => {
			const feature: FeatureRecord = {
				featureType: FeatureType.Ligatures,
				nSettings: 3,
				settingTableOffset: 0,
				featureFlags: 0x8000,
				defaultSettingIndex: 0,
				nameId: 100,
				settings: [
					{ settingValue: 0, nameId: 200 },
					{ settingValue: 1, nameId: 201 },
					{ settingValue: 2, nameId: 202 },
				],
			};

			const defaultSetting = getDefaultSetting(feature);
			expect(defaultSetting?.settingValue).toBe(0);
			expect(defaultSetting?.nameId).toBe(200);
		});

		test("returns undefined when default index out of bounds", () => {
			const feature: FeatureRecord = {
				featureType: FeatureType.Ligatures,
				nSettings: 2,
				settingTableOffset: 0,
				featureFlags: 0x8005, // index 5, but only 2 settings
				defaultSettingIndex: 5,
				nameId: 100,
				settings: [
					{ settingValue: 0, nameId: 200 },
					{ settingValue: 1, nameId: 201 },
				],
			};

			const defaultSetting = getDefaultSetting(feature);
			expect(defaultSetting).toBeUndefined();
		});

		test("returns undefined when settings array is empty", () => {
			const feature: FeatureRecord = {
				featureType: FeatureType.Ligatures,
				nSettings: 0,
				settingTableOffset: 0,
				featureFlags: 0x8000,
				defaultSettingIndex: 0,
				nameId: 100,
				settings: [],
			};

			const defaultSetting = getDefaultSetting(feature);
			expect(defaultSetting).toBeUndefined();
		});
	});

	describe("getSettingByValue", () => {
		test("finds setting by value", () => {
			const feature: FeatureRecord = {
				featureType: FeatureType.Ligatures,
				nSettings: 3,
				settingTableOffset: 0,
				featureFlags: 0,
				defaultSettingIndex: 0,
				nameId: 100,
				settings: [
					{ settingValue: LigatureSetting.CommonLigaturesOn, nameId: 200 },
					{ settingValue: LigatureSetting.CommonLigaturesOff, nameId: 201 },
					{ settingValue: LigatureSetting.RareLigaturesOn, nameId: 202 },
				],
			};

			const setting = getSettingByValue(
				feature,
				LigatureSetting.CommonLigaturesOff,
			);
			expect(setting).not.toBeUndefined();
			expect(setting?.settingValue).toBe(LigatureSetting.CommonLigaturesOff);
			expect(setting?.nameId).toBe(201);
		});

		test("returns undefined for non-existent value", () => {
			const feature: FeatureRecord = {
				featureType: FeatureType.Ligatures,
				nSettings: 1,
				settingTableOffset: 0,
				featureFlags: 0,
				defaultSettingIndex: 0,
				nameId: 100,
				settings: [{ settingValue: LigatureSetting.CommonLigaturesOn, nameId: 200 }],
			};

			const setting = getSettingByValue(
				feature,
				LigatureSetting.RareLigaturesOn,
			);
			expect(setting).toBeUndefined();
		});

		test("returns first matching setting when duplicates exist", () => {
			const feature: FeatureRecord = {
				featureType: FeatureType.Ligatures,
				nSettings: 3,
				settingTableOffset: 0,
				featureFlags: 0,
				defaultSettingIndex: 0,
				nameId: 100,
				settings: [
					{ settingValue: 2, nameId: 200 },
					{ settingValue: 2, nameId: 201 },
					{ settingValue: 3, nameId: 202 },
				],
			};

			const setting = getSettingByValue(feature, 2);
			expect(setting?.nameId).toBe(200);
		});
	});

	describe("hasSettingValue", () => {
		test("returns true when setting exists", () => {
			const feature: FeatureRecord = {
				featureType: FeatureType.Fractions,
				nSettings: 3,
				settingTableOffset: 0,
				featureFlags: 0,
				defaultSettingIndex: 0,
				nameId: 100,
				settings: [
					{ settingValue: FractionsSetting.NoFractions, nameId: 200 },
					{ settingValue: FractionsSetting.VerticalFractions, nameId: 201 },
					{ settingValue: FractionsSetting.DiagonalFractions, nameId: 202 },
				],
			};

			expect(hasSettingValue(feature, FractionsSetting.VerticalFractions)).toBe(
				true,
			);
		});

		test("returns false when setting does not exist", () => {
			const feature: FeatureRecord = {
				featureType: FeatureType.Fractions,
				nSettings: 1,
				settingTableOffset: 0,
				featureFlags: 0,
				defaultSettingIndex: 0,
				nameId: 100,
				settings: [{ settingValue: FractionsSetting.NoFractions, nameId: 200 }],
			};

			expect(hasSettingValue(feature, FractionsSetting.DiagonalFractions)).toBe(
				false,
			);
		});

		test("returns false for empty settings array", () => {
			const feature: FeatureRecord = {
				featureType: FeatureType.Fractions,
				nSettings: 0,
				settingTableOffset: 0,
				featureFlags: 0,
				defaultSettingIndex: 0,
				nameId: 100,
				settings: [],
			};

			expect(hasSettingValue(feature, FractionsSetting.NoFractions)).toBe(false);
		});
	});

	describe("aatToOpenTypeTag", () => {
		describe("ligatures", () => {
			test("maps common ligatures", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.Ligatures,
						LigatureSetting.CommonLigaturesOn,
					),
				).toBe("liga");
			});

			test("maps rare ligatures", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.Ligatures,
						LigatureSetting.RareLigaturesOn,
					),
				).toBe("dlig");
			});

			test("maps historical ligatures", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.Ligatures,
						LigatureSetting.HistoricalLigaturesOn,
					),
				).toBe("hlig");
			});

			test("maps contextual ligatures", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.Ligatures,
						LigatureSetting.ContextualLigaturesOn,
					),
				).toBe("clig");
			});

			test("maps required ligatures", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.Ligatures,
						LigatureSetting.RequiredLigaturesOn,
					),
				).toBe("rlig");
			});

			test("returns null for unsupported ligature settings", () => {
				expect(
					aatToOpenTypeTag(FeatureType.Ligatures, LigatureSetting.LogosOn),
				).toBeNull();
			});
		});

		describe("vertical position", () => {
			test("maps superiors", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.VerticalPosition,
						VerticalPositionSetting.Superiors,
					),
				).toBe("sups");
			});

			test("maps inferiors", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.VerticalPosition,
						VerticalPositionSetting.Inferiors,
					),
				).toBe("subs");
			});

			test("maps ordinals", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.VerticalPosition,
						VerticalPositionSetting.Ordinals,
					),
				).toBe("ordn");
			});

			test("maps scientific inferiors", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.VerticalPosition,
						VerticalPositionSetting.ScientificInferiors,
					),
				).toBe("sinf");
			});
		});

		describe("fractions", () => {
			test("maps vertical fractions to frac", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.Fractions,
						FractionsSetting.VerticalFractions,
					),
				).toBe("frac");
			});

			test("maps diagonal fractions to frac", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.Fractions,
						FractionsSetting.DiagonalFractions,
					),
				).toBe("frac");
			});

			test("returns null for no fractions", () => {
				expect(
					aatToOpenTypeTag(FeatureType.Fractions, FractionsSetting.NoFractions),
				).toBeNull();
			});
		});

		describe("number case", () => {
			test("maps lower case numbers to onum", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.NumberCase,
						NumberCaseSetting.LowerCaseNumbers,
					),
				).toBe("onum");
			});

			test("maps upper case numbers to lnum", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.NumberCase,
						NumberCaseSetting.UpperCaseNumbers,
					),
				).toBe("lnum");
			});
		});

		describe("number spacing", () => {
			test("maps monospaced numbers to tnum", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.NumberSpacing,
						NumberSpacingSetting.MonospacedNumbers,
					),
				).toBe("tnum");
			});

			test("maps proportional numbers to pnum", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.NumberSpacing,
						NumberSpacingSetting.ProportionalNumbers,
					),
				).toBe("pnum");
			});
		});

		describe("case sensitive layout", () => {
			test("maps case sensitive layout on to case", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.CaseSensitiveLayout,
						CaseSensitiveLayoutSetting.CaseSensitiveLayoutOn,
					),
				).toBe("case");
			});

			test("returns null for case sensitive layout off", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.CaseSensitiveLayout,
						CaseSensitiveLayoutSetting.CaseSensitiveLayoutOff,
					),
				).toBeNull();
			});
		});

		describe("lower case", () => {
			test("maps lower case small caps to smcp", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.LowerCase,
						LowerCaseSetting.LowerCaseSmallCaps,
					),
				).toBe("smcp");
			});

			test("maps lower case petite caps to pcap", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.LowerCase,
						LowerCaseSetting.LowerCasePetiteCaps,
					),
				).toBe("pcap");
			});
		});

		describe("upper case", () => {
			test("maps upper case small caps to c2sc", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.UpperCase,
						UpperCaseSetting.UpperCaseSmallCaps,
					),
				).toBe("c2sc");
			});

			test("maps upper case petite caps to c2pc", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.UpperCase,
						UpperCaseSetting.UpperCasePetiteCaps,
					),
				).toBe("c2pc");
			});
		});

		describe("smart swashes", () => {
			test("maps word initial swashes to swsh", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.SmartSwashes,
						SmartSwashSetting.WordInitialSwashesOn,
					),
				).toBe("swsh");
			});

			test("maps word final swashes to swsh", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.SmartSwashes,
						SmartSwashSetting.WordFinalSwashesOn,
					),
				).toBe("swsh");
			});
		});

		describe("contextual alternatives", () => {
			test("maps contextual alternates on to calt", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.ContextualAlternatives,
						ContextualAlternativesSetting.ContextualAlternatesOn,
					),
				).toBe("calt");
			});

			test("maps swash alternates on to swsh", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.ContextualAlternatives,
						ContextualAlternativesSetting.SwashAlternatesOn,
					),
				).toBe("swsh");
			});
		});

		describe("stylistic alternatives", () => {
			test("maps stylistic alt one on to ss01", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.StylisticAlternatives,
						StylisticAlternativesSetting.StylisticAltOneOn,
					),
				).toBe("ss01");
			});

			test("maps stylistic alt ten on to ss10", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.StylisticAlternatives,
						StylisticAlternativesSetting.StylisticAltTenOn,
					),
				).toBe("ss10");
			});

			test("maps stylistic alt twenty on to ss20", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.StylisticAlternatives,
						StylisticAlternativesSetting.StylisticAltTwentyOn,
					),
				).toBe("ss20");
			});

			test("maps stylistic alt off settings to same ss tag", () => {
				// The algorithm treats both on and off the same way
				expect(
					aatToOpenTypeTag(
						FeatureType.StylisticAlternatives,
						StylisticAlternativesSetting.StylisticAltOneOff,
					),
				).toBe("ss01");
			});

			test("returns null for no stylistic alternates", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.StylisticAlternatives,
						StylisticAlternativesSetting.NoStylisticAlternates,
					),
				).toBeNull();
			});
		});

		describe("character shape", () => {
			test("maps traditional characters to trad", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.CharacterShape,
						CharacterShapeSetting.TraditionalCharacters,
					),
				).toBe("trad");
			});

			test("maps simplified characters to smpl", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.CharacterShape,
						CharacterShapeSetting.SimplifiedCharacters,
					),
				).toBe("smpl");
			});

			test("maps JIS1978 characters to jp78", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.CharacterShape,
						CharacterShapeSetting.JIS1978Characters,
					),
				).toBe("jp78");
			});

			test("maps JIS2004 characters to jp04", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.CharacterShape,
						CharacterShapeSetting.JIS2004Characters,
					),
				).toBe("jp04");
			});

			test("maps expert characters to expt", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.CharacterShape,
						CharacterShapeSetting.ExpertCharacters,
					),
				).toBe("expt");
			});

			test("maps hojo characters to hojo", () => {
				expect(
					aatToOpenTypeTag(
						FeatureType.CharacterShape,
						CharacterShapeSetting.HojoCharacters,
					),
				).toBe("hojo");
			});
		});

		describe("other features", () => {
			test("maps vertical substitution to vert", () => {
				expect(aatToOpenTypeTag(FeatureType.VerticalSubstitution, 0)).toBe(
					"vert",
				);
			});

			test("maps annotation to nalt", () => {
				expect(aatToOpenTypeTag(FeatureType.Annotation, 0)).toBe("nalt");
			});

			test("maps ruby kana to ruby", () => {
				expect(aatToOpenTypeTag(FeatureType.RubyKana, 0)).toBe("ruby");
			});
		});

		test("returns null for unsupported feature type", () => {
			expect(aatToOpenTypeTag(FeatureType.Diacritics, 0)).toBeNull();
		});
	});

	describe("openTypeTagToAat", () => {
		describe("ligature tags", () => {
			test("maps liga to common ligatures", () => {
				const result = openTypeTagToAat("liga");
				expect(result).not.toBeNull();
				expect(result?.featureType).toBe(FeatureType.Ligatures);
				expect(result?.settingValue).toBe(LigatureSetting.CommonLigaturesOn);
			});

			test("maps dlig to rare ligatures", () => {
				const result = openTypeTagToAat("dlig");
				expect(result?.featureType).toBe(FeatureType.Ligatures);
				expect(result?.settingValue).toBe(LigatureSetting.RareLigaturesOn);
			});

			test("maps hlig to historical ligatures", () => {
				const result = openTypeTagToAat("hlig");
				expect(result?.featureType).toBe(FeatureType.Ligatures);
				expect(result?.settingValue).toBe(LigatureSetting.HistoricalLigaturesOn);
			});

			test("maps clig to contextual ligatures", () => {
				const result = openTypeTagToAat("clig");
				expect(result?.featureType).toBe(FeatureType.Ligatures);
				expect(result?.settingValue).toBe(LigatureSetting.ContextualLigaturesOn);
			});

			test("maps rlig to required ligatures", () => {
				const result = openTypeTagToAat("rlig");
				expect(result?.featureType).toBe(FeatureType.Ligatures);
				expect(result?.settingValue).toBe(LigatureSetting.RequiredLigaturesOn);
			});
		});

		describe("vertical position tags", () => {
			test("maps sups to superiors", () => {
				const result = openTypeTagToAat("sups");
				expect(result?.featureType).toBe(FeatureType.VerticalPosition);
				expect(result?.settingValue).toBe(VerticalPositionSetting.Superiors);
			});

			test("maps subs to inferiors", () => {
				const result = openTypeTagToAat("subs");
				expect(result?.featureType).toBe(FeatureType.VerticalPosition);
				expect(result?.settingValue).toBe(VerticalPositionSetting.Inferiors);
			});

			test("maps ordn to ordinals", () => {
				const result = openTypeTagToAat("ordn");
				expect(result?.featureType).toBe(FeatureType.VerticalPosition);
				expect(result?.settingValue).toBe(VerticalPositionSetting.Ordinals);
			});

			test("maps sinf to scientific inferiors", () => {
				const result = openTypeTagToAat("sinf");
				expect(result?.featureType).toBe(FeatureType.VerticalPosition);
				expect(result?.settingValue).toBe(
					VerticalPositionSetting.ScientificInferiors,
				);
			});
		});

		describe("number tags", () => {
			test("maps onum to lower case numbers", () => {
				const result = openTypeTagToAat("onum");
				expect(result?.featureType).toBe(FeatureType.NumberCase);
				expect(result?.settingValue).toBe(NumberCaseSetting.LowerCaseNumbers);
			});

			test("maps lnum to upper case numbers", () => {
				const result = openTypeTagToAat("lnum");
				expect(result?.featureType).toBe(FeatureType.NumberCase);
				expect(result?.settingValue).toBe(NumberCaseSetting.UpperCaseNumbers);
			});

			test("maps tnum to monospaced numbers", () => {
				const result = openTypeTagToAat("tnum");
				expect(result?.featureType).toBe(FeatureType.NumberSpacing);
				expect(result?.settingValue).toBe(NumberSpacingSetting.MonospacedNumbers);
			});

			test("maps pnum to proportional numbers", () => {
				const result = openTypeTagToAat("pnum");
				expect(result?.featureType).toBe(FeatureType.NumberSpacing);
				expect(result?.settingValue).toBe(
					NumberSpacingSetting.ProportionalNumbers,
				);
			});
		});

		describe("case tags", () => {
			test("maps case to case sensitive layout", () => {
				const result = openTypeTagToAat("case");
				expect(result?.featureType).toBe(FeatureType.CaseSensitiveLayout);
				expect(result?.settingValue).toBe(
					CaseSensitiveLayoutSetting.CaseSensitiveLayoutOn,
				);
			});

			test("maps smcp to lower case small caps", () => {
				const result = openTypeTagToAat("smcp");
				expect(result?.featureType).toBe(FeatureType.LowerCase);
				expect(result?.settingValue).toBe(LowerCaseSetting.LowerCaseSmallCaps);
			});

			test("maps pcap to lower case petite caps", () => {
				const result = openTypeTagToAat("pcap");
				expect(result?.featureType).toBe(FeatureType.LowerCase);
				expect(result?.settingValue).toBe(LowerCaseSetting.LowerCasePetiteCaps);
			});

			test("maps c2sc to upper case small caps", () => {
				const result = openTypeTagToAat("c2sc");
				expect(result?.featureType).toBe(FeatureType.UpperCase);
				expect(result?.settingValue).toBe(UpperCaseSetting.UpperCaseSmallCaps);
			});

			test("maps c2pc to upper case petite caps", () => {
				const result = openTypeTagToAat("c2pc");
				expect(result?.featureType).toBe(FeatureType.UpperCase);
				expect(result?.settingValue).toBe(UpperCaseSetting.UpperCasePetiteCaps);
			});
		});

		describe("stylistic sets", () => {
			test("maps ss01 to stylistic alt one on", () => {
				const result = openTypeTagToAat("ss01");
				expect(result?.featureType).toBe(FeatureType.StylisticAlternatives);
				expect(result?.settingValue).toBe(
					StylisticAlternativesSetting.StylisticAltOneOn,
				);
			});

			test("maps ss10 to stylistic alt ten on", () => {
				const result = openTypeTagToAat("ss10");
				expect(result?.featureType).toBe(FeatureType.StylisticAlternatives);
				expect(result?.settingValue).toBe(
					StylisticAlternativesSetting.StylisticAltTenOn,
				);
			});

			test("maps ss20 to stylistic alt twenty on", () => {
				const result = openTypeTagToAat("ss20");
				expect(result?.featureType).toBe(FeatureType.StylisticAlternatives);
				expect(result?.settingValue).toBe(
					StylisticAlternativesSetting.StylisticAltTwentyOn,
				);
			});

			test("returns null for ss00", () => {
				const result = openTypeTagToAat("ss00");
				expect(result).toBeNull();
			});

			test("returns null for ss21", () => {
				const result = openTypeTagToAat("ss21");
				expect(result).toBeNull();
			});

			test("returns null for invalid ss tag format", () => {
				const result = openTypeTagToAat("ssXX");
				expect(result).toBeNull();
			});
		});

		describe("character shape tags", () => {
			test("maps trad to traditional characters", () => {
				const result = openTypeTagToAat("trad");
				expect(result?.featureType).toBe(FeatureType.CharacterShape);
				expect(result?.settingValue).toBe(
					CharacterShapeSetting.TraditionalCharacters,
				);
			});

			test("maps smpl to simplified characters", () => {
				const result = openTypeTagToAat("smpl");
				expect(result?.featureType).toBe(FeatureType.CharacterShape);
				expect(result?.settingValue).toBe(
					CharacterShapeSetting.SimplifiedCharacters,
				);
			});

			test("maps jp78 to JIS1978 characters", () => {
				const result = openTypeTagToAat("jp78");
				expect(result?.featureType).toBe(FeatureType.CharacterShape);
				expect(result?.settingValue).toBe(
					CharacterShapeSetting.JIS1978Characters,
				);
			});

			test("maps jp04 to JIS2004 characters", () => {
				const result = openTypeTagToAat("jp04");
				expect(result?.featureType).toBe(FeatureType.CharacterShape);
				expect(result?.settingValue).toBe(
					CharacterShapeSetting.JIS2004Characters,
				);
			});

			test("maps expt to expert characters", () => {
				const result = openTypeTagToAat("expt");
				expect(result?.featureType).toBe(FeatureType.CharacterShape);
				expect(result?.settingValue).toBe(CharacterShapeSetting.ExpertCharacters);
			});

			test("maps hojo to hojo characters", () => {
				const result = openTypeTagToAat("hojo");
				expect(result?.featureType).toBe(FeatureType.CharacterShape);
				expect(result?.settingValue).toBe(CharacterShapeSetting.HojoCharacters);
			});
		});

		describe("other tags", () => {
			test("maps frac to diagonal fractions", () => {
				const result = openTypeTagToAat("frac");
				expect(result?.featureType).toBe(FeatureType.Fractions);
				expect(result?.settingValue).toBe(FractionsSetting.DiagonalFractions);
			});

			test("maps swsh to word initial swashes", () => {
				const result = openTypeTagToAat("swsh");
				expect(result?.featureType).toBe(FeatureType.SmartSwashes);
				expect(result?.settingValue).toBe(SmartSwashSetting.WordInitialSwashesOn);
			});

			test("maps calt to contextual alternates", () => {
				const result = openTypeTagToAat("calt");
				expect(result?.featureType).toBe(FeatureType.ContextualAlternatives);
				expect(result?.settingValue).toBe(
					ContextualAlternativesSetting.ContextualAlternatesOn,
				);
			});

			test("maps vert to vertical substitution", () => {
				const result = openTypeTagToAat("vert");
				expect(result?.featureType).toBe(FeatureType.VerticalSubstitution);
				expect(result?.settingValue).toBe(0);
			});

			test("maps nalt to annotation", () => {
				const result = openTypeTagToAat("nalt");
				expect(result?.featureType).toBe(FeatureType.Annotation);
				expect(result?.settingValue).toBe(0);
			});

			test("maps ruby to ruby kana", () => {
				const result = openTypeTagToAat("ruby");
				expect(result?.featureType).toBe(FeatureType.RubyKana);
				expect(result?.settingValue).toBe(0);
			});
		});

		test("returns null for unsupported tag", () => {
			const result = openTypeTagToAat("kern");
			expect(result).toBeNull();
		});

		test("returns null for invalid tag format", () => {
			const result = openTypeTagToAat("abc");
			expect(result).toBeNull();
		});
	});

	describe("round-trip conversion", () => {
		test("AAT to OpenType to AAT preserves values", () => {
			const testCases = [
				{
					feature: FeatureType.Ligatures,
					setting: LigatureSetting.CommonLigaturesOn,
				},
				{
					feature: FeatureType.VerticalPosition,
					setting: VerticalPositionSetting.Superiors,
				},
				{
					feature: FeatureType.NumberCase,
					setting: NumberCaseSetting.LowerCaseNumbers,
				},
				{
					feature: FeatureType.StylisticAlternatives,
					setting: StylisticAlternativesSetting.StylisticAltFiveOn,
				},
			];

			for (const testCase of testCases) {
				const otTag = aatToOpenTypeTag(testCase.feature, testCase.setting);
				expect(otTag).not.toBeNull();

				const aatResult = openTypeTagToAat(otTag!);
				expect(aatResult).not.toBeNull();
				expect(aatResult?.featureType).toBe(testCase.feature);
				expect(aatResult?.settingValue).toBe(testCase.setting);
			}
		});

		test("OpenType to AAT to OpenType preserves tags", () => {
			const tags = [
				"liga",
				"dlig",
				"hlig",
				"sups",
				"subs",
				"onum",
				"lnum",
				"tnum",
				"pnum",
				"smcp",
				"c2sc",
				"ss05",
				"ss15",
				"case",
				"frac",
			];

			for (const tag of tags) {
				const aatResult = openTypeTagToAat(tag);
				expect(aatResult).not.toBeNull();

				const otTag = aatToOpenTypeTag(
					aatResult!.featureType,
					aatResult!.settingValue,
				);
				expect(otTag).toBe(tag);
			}
		});
	});
});

describe("feat table - real font tests", () => {
	const FONT_PATHS = [
		"/System/Library/Fonts/Geneva.ttf",
		"/System/Library/Fonts/Monaco.ttf",
		"/System/Library/Fonts/Supplemental/Zapfino.ttf",
		"/System/Library/Fonts/Supplemental/Skia.ttf",
	];

	let testFont: Font | null = null;
	let testPath: string | null = null;

	beforeAll(async () => {
		for (const path of FONT_PATHS) {
			try {
				const font = await Font.fromFile(path);
				const feat = font.feat;
				if (feat && feat.features.length > 0) {
					testFont = font;
					testPath = path;
					break;
				}
			} catch {
				// Font not found or error loading, try next
			}
		}
	});

	test("loads feat table from real font", () => {
		if (!testFont) {
			console.log("Skipping: No font with feat table found");
			return;
		}

		expect(testFont.feat).not.toBeNull();
	});

	test("real feat table has valid structure", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;

		expect(typeof feat.version).toBe("number");
		expect(feat.version).toBeGreaterThan(0);
		expect(Array.isArray(feat.features)).toBe(true);
	});

	test("real feat table has features", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;

		expect(feat.features.length).toBeGreaterThan(0);
	});

	test("feature records have valid structure", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;

		for (const feature of feat.features) {
			expect(typeof feature.featureType).toBe("number");
			expect(typeof feature.nSettings).toBe("number");
			expect(typeof feature.settingTableOffset).toBe("number");
			expect(typeof feature.featureFlags).toBe("number");
			expect(typeof feature.defaultSettingIndex).toBe("number");
			expect(typeof feature.nameId).toBe("number");
			expect(Array.isArray(feature.settings)).toBe(true);
			expect(feature.settings.length).toBe(feature.nSettings);
		}
	});

	test("settings have valid structure", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;

		for (const feature of feat.features) {
			for (const setting of feature.settings) {
				expect(typeof setting.settingValue).toBe("number");
				expect(typeof setting.nameId).toBe("number");
			}
		}
	});

	test("getFeature finds existing features", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;
		if (feat.features.length === 0) return;

		const firstFeature = feat.features[0];
		if (!firstFeature) return;

		const found = getFeature(feat, firstFeature.featureType);
		expect(found).not.toBeUndefined();
		expect(found?.featureType).toBe(firstFeature.featureType);
	});

	test("getAllFeatures returns all features", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;
		const all = getAllFeatures(feat);

		expect(all.length).toBe(feat.features.length);
	});

	test("isExclusiveFeature works on real features", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;

		for (const feature of feat.features) {
			const isExclusive = isExclusiveFeature(feature);
			expect(typeof isExclusive).toBe("boolean");

			if (isExclusive) {
				expect(feature.featureFlags & FeatureFlags.Exclusive).not.toBe(0);
			}
		}
	});

	test("getDefaultSetting returns valid settings", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;

		for (const feature of feat.features) {
			const defaultSetting = getDefaultSetting(feature);

			if (defaultSetting) {
				expect(typeof defaultSetting.settingValue).toBe("number");
				expect(typeof defaultSetting.nameId).toBe("number");
				expect(feature.settings).toContain(defaultSetting);
			}
		}
	});

	test("hasSettingValue works correctly", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;

		for (const feature of feat.features) {
			for (const setting of feature.settings) {
				expect(hasSettingValue(feature, setting.settingValue)).toBe(true);
			}

			// Test with unlikely value
			expect(hasSettingValue(feature, 9999)).toBe(false);
		}
	});

	test("getSettingByValue finds existing settings", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;

		for (const feature of feat.features) {
			for (const setting of feature.settings) {
				const found = getSettingByValue(feature, setting.settingValue);
				expect(found).not.toBeUndefined();
				expect(found?.settingValue).toBe(setting.settingValue);
			}
		}
	});

	test("common feature types exist in Apple fonts", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;
		const featureTypes = feat.features.map((f) => f.featureType);

		// Apple fonts commonly have these features
		const possibleTypes = [
			FeatureType.Ligatures,
			FeatureType.LetterCase,
			FeatureType.VerticalPosition,
			FeatureType.Fractions,
			FeatureType.NumberCase,
			FeatureType.NumberSpacing,
			FeatureType.CharacterAlternatives,
			FeatureType.StylisticAlternatives,
			FeatureType.ContextualAlternatives,
		];

		// At least one common feature type should exist
		const hasCommonFeature = possibleTypes.some((type) =>
			featureTypes.includes(type),
		);
		expect(hasCommonFeature).toBe(true);
	});

	test("AAT to OpenType conversion works on real features", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;

		for (const feature of feat.features) {
			for (const setting of feature.settings) {
				const tag = aatToOpenTypeTag(feature.featureType, setting.settingValue);
				// Tag can be null for unsupported conversions
				if (tag !== null) {
					expect(typeof tag).toBe("string");
					expect(tag.length).toBe(4);
				}
			}
		}
	});

	test("features have reasonable nameId values", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;

		for (const feature of feat.features) {
			// Name IDs should be positive
			expect(feature.nameId).toBeGreaterThanOrEqual(0);

			for (const setting of feature.settings) {
				expect(setting.nameId).toBeGreaterThanOrEqual(0);
			}
		}
	});

	test("default setting index is within bounds", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;

		for (const feature of feat.features) {
			expect(feature.defaultSettingIndex).toBeGreaterThanOrEqual(0);
			expect(feature.defaultSettingIndex).toBeLessThan(feature.nSettings);
		}
	});

	test("feature types are in valid range", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;

		for (const feature of feat.features) {
			// Feature types should be reasonable values (0-200)
			expect(feature.featureType).toBeGreaterThanOrEqual(0);
			expect(feature.featureType).toBeLessThan(200);
		}
	});

	test("setting values are reasonable", () => {
		if (!testFont?.feat) return;

		const feat = testFont.feat;

		for (const feature of feat.features) {
			for (const setting of feature.settings) {
				// Setting values should be reasonable (0-100 typically)
				expect(setting.settingValue).toBeGreaterThanOrEqual(0);
				expect(setting.settingValue).toBeLessThan(1000);
			}
		}
	});
});

describe("feat table - edge cases", () => {
	test("handles feature with no settings", () => {
		const buffer = new ArrayBuffer(100);
		const view = new DataView(buffer);

		view.setUint32(0, 0x00010000, false);
		view.setUint16(4, 1, false);
		view.setUint16(6, 0, false);
		view.setUint32(8, 0, false);

		// Feature with 0 settings
		view.setUint16(12, FeatureType.Ligatures, false);
		view.setUint16(14, 0, false); // nSettings = 0
		view.setUint32(16, 28, false);
		view.setUint16(20, 0, false);
		view.setUint16(22, 256, false);

		const reader = new Reader(buffer);
		const feat = parseFeat(reader);

		expect(feat.features[0]?.nSettings).toBe(0);
		expect(feat.features[0]?.settings.length).toBe(0);
	});

	test("handles maximum feature count", () => {
		// Test with many features (stress test)
		const featureCount = 100;
		const buffer = new ArrayBuffer(12 + featureCount * 16 + 1000);
		const view = new DataView(buffer);

		view.setUint32(0, 0x00010000, false);
		view.setUint16(4, featureCount, false);
		view.setUint16(6, 0, false);
		view.setUint32(8, 0, false);

		for (let i = 0; i < featureCount; i++) {
			const offset = 12 + i * 16;
			view.setUint16(offset, i, false); // featureType
			view.setUint16(offset + 2, 0, false); // nSettings
			view.setUint32(offset + 4, 0, false);
			view.setUint16(offset + 8, 0, false);
			view.setUint16(offset + 10, 100 + i, false);
		}

		const reader = new Reader(buffer);
		const feat = parseFeat(reader);

		expect(feat.features.length).toBe(featureCount);
	});

	test("handles feature with many settings", () => {
		const nSettings = 50;
		const buffer = new ArrayBuffer(200 + nSettings * 4);
		const view = new DataView(buffer);

		view.setUint32(0, 0x00010000, false);
		view.setUint16(4, 1, false);
		view.setUint16(6, 0, false);
		view.setUint32(8, 0, false);

		view.setUint16(12, FeatureType.StylisticAlternatives, false);
		view.setUint16(14, nSettings, false);
		view.setUint32(16, 28, false);
		view.setUint16(20, 0, false);
		view.setUint16(22, 256, false);

		// Create settings
		for (let i = 0; i < nSettings; i++) {
			view.setUint16(28 + i * 4, i, false);
			view.setUint16(30 + i * 4, 300 + i, false);
		}

		const reader = new Reader(buffer);
		const feat = parseFeat(reader);

		expect(feat.features[0]?.settings.length).toBe(nSettings);
	});

	test("handles all feature flag bits", () => {
		const buffer = new ArrayBuffer(100);
		const view = new DataView(buffer);

		view.setUint32(0, 0x00010000, false);
		view.setUint16(4, 1, false);
		view.setUint16(6, 0, false);
		view.setUint32(8, 0, false);

		// All flag bits set
		view.setUint16(12, FeatureType.Ligatures, false);
		view.setUint16(14, 1, false);
		view.setUint32(16, 28, false);
		view.setUint16(20, 0xffff, false); // all bits
		view.setUint16(22, 256, false);

		view.setUint16(28, 0, false);
		view.setUint16(30, 300, false);

		const reader = new Reader(buffer);
		const feat = parseFeat(reader);

		expect(feat.features[0]?.featureFlags).toBe(0xffff);
		expect(feat.features[0]?.defaultSettingIndex).toBe(0xff);
		expect(isExclusiveFeature(feat.features[0]!)).toBe(true);
	});

	test("handles zero nameId", () => {
		const buffer = new ArrayBuffer(100);
		const view = new DataView(buffer);

		view.setUint32(0, 0x00010000, false);
		view.setUint16(4, 1, false);
		view.setUint16(6, 0, false);
		view.setUint32(8, 0, false);

		view.setUint16(12, FeatureType.Ligatures, false);
		view.setUint16(14, 1, false);
		view.setUint32(16, 28, false);
		view.setUint16(20, 0, false);
		view.setUint16(22, 0, false); // nameId = 0

		view.setUint16(28, 0, false);
		view.setUint16(30, 0, false); // setting nameId = 0

		const reader = new Reader(buffer);
		const feat = parseFeat(reader);

		expect(feat.features[0]?.nameId).toBe(0);
		expect(feat.features[0]?.settings[0]?.nameId).toBe(0);
	});
});
