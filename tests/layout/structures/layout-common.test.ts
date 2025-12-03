import { describe, expect, test } from "bun:test";
import { Reader } from "../../../src/font/binary/reader.ts";
import {
	getMarkAttachmentType,
	LookupFlag,
	parseScriptList,
	parseFeatureList,
	parseLookupHeaders,
	findScript,
	findLangSys,
	getFeature,
} from "../../../src/layout/structures/layout-common.ts";

function createBuffer(...bytes: number[]): ArrayBuffer {
	return new Uint8Array(bytes).buffer;
}

describe("LookupFlag constants", () => {
	test("defines all required flags", () => {
		expect(LookupFlag.RightToLeft).toBe(0x0001);
		expect(LookupFlag.IgnoreBaseGlyphs).toBe(0x0002);
		expect(LookupFlag.IgnoreLigatures).toBe(0x0004);
		expect(LookupFlag.IgnoreMarks).toBe(0x0008);
		expect(LookupFlag.UseMarkFilteringSet).toBe(0x0010);
		expect(LookupFlag.MarkAttachmentTypeMask).toBe(0xff00);
	});
});

describe("getMarkAttachmentType", () => {
	test("extracts mark attachment type from lookup flag", () => {
		// Bits 8-15 contain the mark attachment type
		const flag = 0x0000; // No mark attachment type
		expect(getMarkAttachmentType(flag)).toBe(0);
	});

	test("extracts non-zero mark attachment type", () => {
		// Type 1: 0x0100 >> 8 = 1
		const flag = 0x0100;
		expect(getMarkAttachmentType(flag)).toBe(1);
	});

	test("extracts max mark attachment type", () => {
		// Type 255: 0xff00 >> 8 = 255
		const flag = 0xff00;
		expect(getMarkAttachmentType(flag)).toBe(255);
	});

	test("ignores lower 8 bits", () => {
		// Lower bits should be ignored
		const flag = 0xff0f;
		expect(getMarkAttachmentType(flag)).toBe(255);
	});

	test("extracts type with other flags set", () => {
		// Type 3 with UseMarkFilteringSet flag
		const flag = 0x0310; // 0x0300 for type 3, 0x0010 for UseMarkFilteringSet
		expect(getMarkAttachmentType(flag)).toBe(3);
	});
});

describe("parseScriptList", () => {
	test("parses empty script list", () => {
		const reader = new Reader(createBuffer(
			0x00, 0x00, // scriptCount = 0
		));

		const result = parseScriptList(reader);

		expect(result.scripts).toEqual([]);
	});

	test("parses single script", () => {
		// ScriptList: count=1, tag="DFLT", offset to script
		// Script: defaultLangSysOffset=0, langSysCount=0
		const buf = [
			// Byte 0-1: scriptCount = 1
			0x00, 0x01,
			// Byte 2-9: ScriptRecord[0]: tag "DFLT", offset
			0x44, 0x46, 0x4c, 0x54, // "DFLT"
			0x00, 0x0a, // offset = 10 (points to byte 10)
			// Byte 10-15: Script at offset 10
			0x00, 0x00, // defaultLangSysOffset = 0
			0x00, 0x00, // langSysCount = 0
			// padding
			0x00, 0x00,
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseScriptList(reader);

		expect(result.scripts).toHaveLength(1);
		expect(result.scripts[0].scriptTag).toBe(0x44464c54); // "DFLT"
		expect(result.scripts[0].script.defaultLangSys).toBeNull();
		expect(result.scripts[0].script.langSysRecords).toEqual([]);
	});

	test("parses multiple scripts", () => {
		// Create two separate script lists and test parsing independently
		const buf1 = [
			0x00, 0x01, // scriptCount = 1
			0x44, 0x46, 0x4c, 0x54, // "DFLT"
			0x00, 0x0a, // offset = 10
			0x00, 0x00, 0x00, 0x00, // padding
			0x00, 0x00, // defaultLangSysOffset = 0
			0x00, 0x00, // langSysCount = 0
		];
		const buf2 = [
			0x00, 0x01, // scriptCount = 1
			0x6c, 0x61, 0x74, 0x6e, // "latn"
			0x00, 0x0a, // offset = 10
			0x00, 0x00, 0x00, 0x00, // padding
			0x00, 0x00, // defaultLangSysOffset = 0
			0x00, 0x00, // langSysCount = 0
		];

		const result1 = parseScriptList(new Reader(createBuffer(...buf1)));
		const result2 = parseScriptList(new Reader(createBuffer(...buf2)));

		expect(result1.scripts).toHaveLength(1);
		expect(result1.scripts[0].scriptTag).toBe(0x44464c54); // "DFLT"

		expect(result2.scripts).toHaveLength(1);
		expect(result2.scripts[0].scriptTag).toBe(0x6c61746e); // "latn"
	});

	test("parses script with default lang sys", () => {
		const buf = [
			// ScriptList header
			0x00, 0x01, // scriptCount = 1
			// ScriptRecord[0]
			0x44, 0x46, 0x4c, 0x54, // "DFLT"
			0x00, 0x08, // offset = 8
			// Script[0] at offset 8
			0x00, 0x04, // defaultLangSysOffset = 4 (relative to script)
			0x00, 0x00, // langSysCount = 0
			// LangSys at offset 8+4=12
			0x00, 0x00, // lookupOrderOffset = 0
			0xff, 0xff, // requiredFeatureIndex = 0xFFFF
			0x00, 0x00, // featureIndexCount = 0
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseScriptList(reader);

		expect(result.scripts[0].script.defaultLangSys).not.toBeNull();
		expect(result.scripts[0].script.defaultLangSys!.requiredFeatureIndex).toBe(0xffff);
		expect(result.scripts[0].script.defaultLangSys!.featureIndices).toEqual([]);
	});

	test("parses script with language system records", () => {
		const buf = [
			// ScriptList header
			0x00, 0x01, // scriptCount = 1
			// ScriptRecord[0]
			0x44, 0x46, 0x4c, 0x54, // "DFLT"
			0x00, 0x08, // offset = 8
			// Script[0] at offset 8
			0x00, 0x00, // defaultLangSysOffset = 0 (no default)
			0x00, 0x02, // langSysCount = 2
			// LangSysRecord[0]
			0x52, 0x4f, 0x4d, 0x41, // "ROMA"
			0x00, 0x10, // offset = 16 (relative to script at 8)
			// LangSysRecord[1]
			0x49, 0x54, 0x41, 0x4c, // "ITAL"
			0x00, 0x18, // offset = 24 (relative to script at 8)
			// LangSys[0] at offset 8+16=24
			0x00, 0x00, // lookupOrderOffset = 0
			0x00, 0x00, // requiredFeatureIndex = 0
			0x00, 0x01, // featureIndexCount = 1
			0x00, 0x05, // featureIndex[0] = 5
			// LangSys[1] at offset 8+24=32
			0x00, 0x00, // lookupOrderOffset = 0
			0x00, 0x01, // requiredFeatureIndex = 1
			0x00, 0x00, // featureIndexCount = 0
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseScriptList(reader);
		const script = result.scripts[0].script;

		expect(script.langSysRecords).toHaveLength(2);
		expect(script.langSysRecords[0].langSysTag).toBe(0x524f4d41); // "ROMA"
		expect(script.langSysRecords[0].langSys.requiredFeatureIndex).toBe(0);
		expect(script.langSysRecords[0].langSys.featureIndices).toEqual([5]);
		expect(script.langSysRecords[1].langSysTag).toBe(0x4954414c); // "ITAL"
		expect(script.langSysRecords[1].langSys.requiredFeatureIndex).toBe(1);
	});

	test("parses lang sys with multiple feature indices", () => {
		const buf = [
			// ScriptList header
			0x00, 0x01, // scriptCount = 1
			// ScriptRecord[0]
			0x44, 0x46, 0x4c, 0x54, // "DFLT"
			0x00, 0x08, // offset = 8
			// Script[0] at offset 8
			0x00, 0x04, // defaultLangSysOffset = 4
			0x00, 0x00, // langSysCount = 0
			// LangSys at offset 8+4=12
			0x00, 0x00, // lookupOrderOffset = 0
			0x00, 0x02, // requiredFeatureIndex = 2
			0x00, 0x04, // featureIndexCount = 4
			0x00, 0x01, // featureIndex[0] = 1
			0x00, 0x03, // featureIndex[1] = 3
			0x00, 0x05, // featureIndex[2] = 5
			0x00, 0x07, // featureIndex[3] = 7
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseScriptList(reader);
		const langSys = result.scripts[0].script.defaultLangSys!;

		expect(langSys.requiredFeatureIndex).toBe(2);
		expect(langSys.featureIndices).toEqual([1, 3, 5, 7]);
	});
});

describe("parseFeatureList", () => {
	test("parses empty feature list", () => {
		const reader = new Reader(createBuffer(
			0x00, 0x00, // featureCount = 0
		));

		const result = parseFeatureList(reader);

		expect(result.features).toEqual([]);
	});

	test("parses single feature", () => {
		const buf = [
			// FeatureList header
			0x00, 0x01, // featureCount = 1
			// FeatureRecord[0]
			0x61, 0x62, 0x74, 0x79, // tag = "abty"
			0x00, 0x08, // offset = 8
			// Feature at offset 8
			0x00, 0x00, // featureParamsOffset = 0
			0x00, 0x00, // lookupIndexCount = 0
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseFeatureList(reader);

		expect(result.features).toHaveLength(1);
		expect(result.features[0].featureTag).toBe(0x61627479); // "abty"
		expect(result.features[0].feature.featureParamsOffset).toBe(0);
		expect(result.features[0].feature.lookupListIndices).toEqual([]);
	});

	test("parses multiple features", () => {
		const buf = [
			// FeatureList header (bytes 0-1)
			0x00, 0x02, // featureCount = 2
			// FeatureRecord[0] (bytes 2-9)
			0x61, 0x62, 0x74, 0x79, // tag[0] = "abty"
			0x00, 0x0e, // offset[0] = 14
			// FeatureRecord[1] (bytes 10-17)
			0x61, 0x66, 0x66, 0x63, // tag[1] = "affc"
			0x00, 0x18, // offset[1] = 24
			// Feature[0] at offset 14 (bytes 14-19)
			0x00, 0x00, // featureParamsOffset = 0
			0x00, 0x01, // lookupIndexCount = 1
			0x00, 0x03, // lookupIndex[0] = 3
			// padding
			0x00, 0x00, 0x00, 0x00,
			// Feature[1] at offset 24 (bytes 24-27)
			0x00, 0x00, // featureParamsOffset = 0
			0x00, 0x00, // lookupIndexCount = 0
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseFeatureList(reader);

		expect(result.features).toHaveLength(2);
		expect(result.features[0].feature.lookupListIndices).toEqual([3]);
		expect(result.features[1].feature.lookupListIndices).toEqual([]);
	});

	test("parses feature with params offset", () => {
		const buf = [
			// FeatureList header
			0x00, 0x01, // featureCount = 1
			// FeatureRecord[0]
			0x73, 0x69, 0x7a, 0x65, // tag = "size"
			0x00, 0x08, // offset = 8
			// Feature at offset 8
			0x00, 0x08, // featureParamsOffset = 8
			0x00, 0x02, // lookupIndexCount = 2
			0x00, 0x01, // lookupIndex[0] = 1
			0x00, 0x02, // lookupIndex[1] = 2
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseFeatureList(reader);

		expect(result.features[0].feature.featureParamsOffset).toBe(8);
		expect(result.features[0].feature.lookupListIndices).toEqual([1, 2]);
	});

	test("parses feature with many lookup indices", () => {
		const buf = [
			// FeatureList header
			0x00, 0x01, // featureCount = 1
			// FeatureRecord[0]
			0x64, 0x75, 0x6d, 0x6d, // tag = "dumm"
			0x00, 0x08, // offset = 8
			// Feature at offset 8
			0x00, 0x00, // featureParamsOffset = 0
			0x00, 0x05, // lookupIndexCount = 5
			0x00, 0x00, // lookupIndex[0] = 0
			0x00, 0x01, // lookupIndex[1] = 1
			0x00, 0x02, // lookupIndex[2] = 2
			0x00, 0x03, // lookupIndex[3] = 3
			0x00, 0x04, // lookupIndex[4] = 4
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseFeatureList(reader);

		expect(result.features[0].feature.lookupListIndices).toEqual([0, 1, 2, 3, 4]);
	});
});

describe("parseLookupHeaders", () => {
	test("parses empty lookup list", () => {
		const reader = new Reader(createBuffer(
			0x00, 0x00, // lookupCount = 0
		));

		const result = parseLookupHeaders(reader);

		expect(result).toEqual([]);
	});

	test("parses single simple lookup", () => {
		const buf = [
			// LookupList header
			0x00, 0x01, // lookupCount = 1
			0x00, 0x04, // lookupOffset[0] = 4
			// Lookup header at offset 4
			0x00, 0x01, // lookupType = 1
			0x00, 0x00, // lookupFlag = 0
			0x00, 0x01, // subtableCount = 1
			0x00, 0x08, // subtableOffset[0] = 8
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseLookupHeaders(reader);

		expect(result).toHaveLength(1);
		expect(result[0].lookupType).toBe(1);
		expect(result[0].lookupFlag).toBe(0);
		expect(result[0].subtableOffsets).toEqual([8]);
		expect(result[0].markFilteringSet).toBeUndefined();
	});

	test("parses lookup with multiple subtables", () => {
		const buf = [
			// LookupList header
			0x00, 0x01, // lookupCount = 1
			0x00, 0x04, // lookupOffset[0] = 4
			// Lookup header at offset 4
			0x00, 0x02, // lookupType = 2
			0x00, 0x00, // lookupFlag = 0
			0x00, 0x03, // subtableCount = 3
			0x00, 0x10, // subtableOffset[0] = 16
			0x00, 0x20, // subtableOffset[1] = 32
			0x00, 0x30, // subtableOffset[2] = 48
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseLookupHeaders(reader);

		expect(result[0].subtableOffsets).toEqual([16, 32, 48]);
	});

	test("parses lookup with lookup flags", () => {
		const buf = [
			// LookupList header
			0x00, 0x01, // lookupCount = 1
			0x00, 0x04, // lookupOffset[0] = 4
			// Lookup header at offset 4
			0x00, 0x01, // lookupType = 1
			0x00, 0x0f, // lookupFlag = RightToLeft|IgnoreBaseGlyphs|IgnoreLigatures|IgnoreMarks
			0x00, 0x01, // subtableCount = 1
			0x00, 0x08, // subtableOffset[0] = 8
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseLookupHeaders(reader);

		expect(result[0].lookupFlag).toBe(0x000f);
	});

	test("parses lookup with mark filtering set", () => {
		const buf = [
			// LookupList header
			0x00, 0x01, // lookupCount = 1
			0x00, 0x04, // lookupOffset[0] = 4
			// Lookup header at offset 4
			0x00, 0x04, // lookupType = 4
			0x00, 0x10, // lookupFlag = UseMarkFilteringSet
			0x00, 0x01, // subtableCount = 1
			0x00, 0x0a, // subtableOffset[0] = 10
			0x00, 0x02, // markFilteringSet = 2
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseLookupHeaders(reader);

		expect(result[0].markFilteringSet).toBe(2);
		expect(result[0].lookupFlag & LookupFlag.UseMarkFilteringSet).toBe(LookupFlag.UseMarkFilteringSet);
	});

	test("parses multiple lookups", () => {
		const buf = [
			// LookupList header (bytes 0-5)
			0x00, 0x02, // lookupCount = 2
			0x00, 0x06, // lookupOffset[0] = 6
			0x00, 0x0e, // lookupOffset[1] = 14
			// Lookup 1 at offset 6 (bytes 6-11)
			0x00, 0x01, // lookupType = 1
			0x00, 0x00, // lookupFlag = 0
			0x00, 0x01, // subtableCount = 1
			0x00, 0x10, // subtableOffset[0] = 16
			// Lookup 2 at offset 14 (bytes 14-21)
			0x00, 0x02, // lookupType = 2
			0x00, 0x01, // lookupFlag = RightToLeft
			0x00, 0x01, // subtableCount = 1
			0x00, 0x20, // subtableOffset[0] = 32
			0x00, 0x00,
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseLookupHeaders(reader);

		expect(result).toHaveLength(2);
		expect(result[0].lookupType).toBe(1);
		expect(result[1].lookupType).toBe(2);
		expect(result[1].lookupFlag).toBe(1);
	});

	test("parses lookup with mark attachment type", () => {
		const buf = [
			// LookupList header
			0x00, 0x01, // lookupCount = 1
			0x00, 0x04, // lookupOffset[0] = 4
			// Lookup header at offset 4
			0x00, 0x06, // lookupType = 6
			0x05, 0x00, // lookupFlag = MarkAttachmentType 5 (0x0500)
			0x00, 0x01, // subtableCount = 1
			0x00, 0x08, // subtableOffset[0] = 8
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseLookupHeaders(reader);

		expect(getMarkAttachmentType(result[0].lookupFlag)).toBe(5);
	});

	test("parses lookup without marking filtering set despite flag", () => {
		const buf = [
			// LookupList header
			0x00, 0x01, // lookupCount = 1
			0x00, 0x04, // lookupOffset[0] = 4
			// Lookup header at offset 4
			0x00, 0x03, // lookupType = 3
			0x00, 0x00, // lookupFlag = 0 (no UseMarkFilteringSet)
			0x00, 0x01, // subtableCount = 1
			0x00, 0x08, // subtableOffset[0] = 8
		];
		const reader = new Reader(createBuffer(...buf));

		const result = parseLookupHeaders(reader);

		expect(result[0].markFilteringSet).toBeUndefined();
	});
});

describe("findScript", () => {
	test("finds script by tag", () => {
		const scriptList = {
			scripts: [
				{
					scriptTag: 0x44464c54, // "DFLT"
					script: {
						defaultLangSys: null,
						langSysRecords: [],
					},
				},
				{
					scriptTag: 0x6c61746e, // "latn"
					script: {
						defaultLangSys: null,
						langSysRecords: [],
					},
				},
			],
		};

		const result = findScript(scriptList, 0x6c61746e); // "latn"

		expect(result).not.toBeNull();
		expect(result).toBe(scriptList.scripts[1].script);
	});

	test("returns null when script not found", () => {
		const scriptList = {
			scripts: [
				{
					scriptTag: 0x44464c54, // "DFLT"
					script: {
						defaultLangSys: null,
						langSysRecords: [],
					},
				},
			],
		};

		const result = findScript(scriptList, 0x6172616220); // "arab"

		expect(result).toBeNull();
	});

	test("finds script in empty list returns null", () => {
		const scriptList = { scripts: [] };

		const result = findScript(scriptList, 0x44464c54);

		expect(result).toBeNull();
	});

	test("finds first matching script when duplicates exist", () => {
		const script1 = {
			defaultLangSys: null,
			langSysRecords: [],
		};
		const script2 = {
			defaultLangSys: { requiredFeatureIndex: 1, featureIndices: [] },
			langSysRecords: [],
		};

		const scriptList = {
			scripts: [
				{ scriptTag: 0x6c61746e, script: script1 }, // "latn"
				{ scriptTag: 0x6c61746e, script: script2 }, // "latn" again
			],
		};

		const result = findScript(scriptList, 0x6c61746e);

		expect(result).toBe(script1);
	});
});

describe("findLangSys", () => {
	test("returns default lang sys when langSysTag is null", () => {
		const defaultLangSys = { requiredFeatureIndex: 0, featureIndices: [] };
		const script = {
			defaultLangSys,
			langSysRecords: [],
		};

		const result = findLangSys(script, null);

		expect(result).toBe(defaultLangSys);
	});

	test("finds lang sys by tag", () => {
		const roma = { requiredFeatureIndex: 0, featureIndices: [1, 2] };
		const script = {
			defaultLangSys: null,
			langSysRecords: [
				{ langSysTag: 0x524f4d41, langSys: roma }, // "ROMA"
				{ langSysTag: 0x4954414c, langSys: { requiredFeatureIndex: 1, featureIndices: [] } }, // "ITAL"
			],
		};

		const result = findLangSys(script, 0x524f4d41); // "ROMA"

		expect(result).toBe(roma);
	});

	test("falls back to default lang sys when tag not found", () => {
		const defaultLangSys = { requiredFeatureIndex: 0, featureIndices: [] };
		const script = {
			defaultLangSys,
			langSysRecords: [
				{ langSysTag: 0x524f4d41, langSys: { requiredFeatureIndex: 1, featureIndices: [] } }, // "ROMA"
			],
		};

		const result = findLangSys(script, 0x4954414c); // "ITAL" (not found)

		expect(result).toBe(defaultLangSys);
	});

	test("returns null when tag not found and no default", () => {
		const script = {
			defaultLangSys: null,
			langSysRecords: [
				{ langSysTag: 0x524f4d41, langSys: { requiredFeatureIndex: 0, featureIndices: [] } }, // "ROMA"
			],
		};

		const result = findLangSys(script, 0x4954414c); // "ITAL"

		expect(result).toBeNull();
	});

	test("finds first matching lang sys when duplicates exist", () => {
		const langSys1 = { requiredFeatureIndex: 0, featureIndices: [1] };
		const langSys2 = { requiredFeatureIndex: 1, featureIndices: [2] };
		const script = {
			defaultLangSys: null,
			langSysRecords: [
				{ langSysTag: 0x524f4d41, langSys: langSys1 }, // "ROMA"
				{ langSysTag: 0x524f4d41, langSys: langSys2 }, // "ROMA" again
			],
		};

		const result = findLangSys(script, 0x524f4d41);

		expect(result).toBe(langSys1);
	});

	test("returns default lang sys when explicitly requested via null tag", () => {
		const defaultLangSys = { requiredFeatureIndex: 5, featureIndices: [10, 11] };
		const script = {
			defaultLangSys,
			langSysRecords: [
				{ langSysTag: 0x524f4d41, langSys: { requiredFeatureIndex: 0, featureIndices: [] } }, // "ROMA"
			],
		};

		const result = findLangSys(script, null);

		expect(result).toBe(defaultLangSys);
	});
});

describe("getFeature", () => {
	test("returns feature at valid index", () => {
		const feature = { featureParamsOffset: 0, lookupListIndices: [1, 2, 3] };
		const featureList = {
			features: [
				{ featureTag: 0x61627479, feature: { featureParamsOffset: 0, lookupListIndices: [] } }, // "abty"
				{ featureTag: 0x61666663, feature }, // "affc"
			],
		};

		const result = getFeature(featureList, 1);

		expect(result).toBe(featureList.features[1]);
		expect(result?.feature).toBe(feature);
	});

	test("returns feature at index 0", () => {
		const feature = { featureParamsOffset: 0, lookupListIndices: [] };
		const featureList = {
			features: [{ featureTag: 0x61627479, feature }], // "abty"
		};

		const result = getFeature(featureList, 0);

		expect(result).toBe(featureList.features[0]);
	});

	test("returns null for out of bounds index", () => {
		const featureList = {
			features: [
				{ featureTag: 0x61627479, feature: { featureParamsOffset: 0, lookupListIndices: [] } }, // "abty"
			],
		};

		const result = getFeature(featureList, 5);

		expect(result).toBeNull();
	});

	test("returns null for negative index", () => {
		const featureList = {
			features: [
				{ featureTag: 0x61627479, feature: { featureParamsOffset: 0, lookupListIndices: [] } }, // "abty"
			],
		};

		const result = getFeature(featureList, -1);

		expect(result).toBeNull();
	});

	test("returns null for empty feature list", () => {
		const featureList = { features: [] };

		const result = getFeature(featureList, 0);

		expect(result).toBeNull();
	});

	test("handles large index values", () => {
		const featureList = {
			features: Array.from({ length: 100 }, (_, i) => ({
				featureTag: i,
				feature: { featureParamsOffset: 0, lookupListIndices: [] },
			})),
		};

		const result = getFeature(featureList, 99);

		expect(result).not.toBeNull();
		expect(result?.featureTag).toBe(99);
	});

	test("returns null beyond array bounds", () => {
		const featureList = {
			features: Array.from({ length: 10 }, (_, i) => ({
				featureTag: i,
				feature: { featureParamsOffset: 0, lookupListIndices: [] },
			})),
		};

		const result = getFeature(featureList, 15);

		expect(result).toBeNull();
	});
});
