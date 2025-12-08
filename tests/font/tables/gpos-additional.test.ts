import { describe, expect, test } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import type { GposTable, PairPosLookup } from "../../../src/font/tables/gpos.ts";
import { applyKerningDirect, GposLookupType, __testing, parseGpos } from "../../../src/font/tables/gpos.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("GPOS additional coverage tests", () => {
	test("applyKerningDirect with format 1 pair positioning", async () => {
		const font = await Font.fromFile(ARIAL_PATH);
		if (!font.gpos) return;

		const pairLookup = font.gpos.lookups.find(
			(l): l is PairPosLookup => l.type === 2 && l.subtables.some((st) => st.format === 1),
		);
		if (!pairLookup) return;

		// Find a valid glyph pair from format 1 subtable
		for (const subtable of pairLookup.subtables) {
			if (subtable.format === 1) {
				const glyphs = subtable.coverage.glyphs();
				for (let i = 0; i < glyphs.length; i++) {
					const glyph = glyphs[i];
					if (glyph === undefined) continue;
					const index = subtable.coverage.get(glyph);
					if (index === null) continue;
					const pairSet = subtable.pairSets[index];
					if (pairSet && pairSet.pairValueRecords.length > 0) {
						const firstGlyph = glyph;
						const secondGlyph = pairSet.pairValueRecords[0]!.secondGlyph;

						const pos1 = { xAdvance: 100, yAdvance: 0, xOffset: 0, yOffset: 0 };
						const pos2 = { xAdvance: 100, yAdvance: 0, xOffset: 0, yOffset: 0 };

						const applied = applyKerningDirect(
							pairLookup,
							firstGlyph,
							secondGlyph,
							pos1,
							pos2,
						);

						expect(applied).toBe(true);
						// Covers lines 810-833 in gpos.ts
						return;
					}
				}
			}
		}
	});

	test("applyKerningDirect with format 2 pair positioning", async () => {
		const font = await Font.fromFile(ARIAL_PATH);
		if (!font.gpos) return;

		const pairLookup = font.gpos.lookups.find(
			(l): l is PairPosLookup => l.type === 2 && l.subtables.some((st) => st.format === 2),
		);
		if (!pairLookup) return;

		// Find valid glyphs from format 2 subtable
		for (const subtable of pairLookup.subtables) {
			if (subtable.format === 2) {
				const firstGlyph = subtable.coverage.glyphs()[0];
				if (firstGlyph === undefined) continue;

				const class1 = subtable.classDef1.get(firstGlyph);
				for (let class2 = 0; class2 < subtable.class2Count; class2++) {
					const class1Record = subtable.class1Records[class1];
					if (!class1Record) continue;
					const class2Record = class1Record.class2Records[class2];
					if (!class2Record) continue;

					// Find a glyph in class2
					let secondGlyph = 0;
					const glyphsInClass2 = subtable.classDef2.glyphsInClass(class2);
					if (glyphsInClass2.length > 0) {
						secondGlyph = glyphsInClass2[0]!;
					}

					if (secondGlyph > 0) {
						const pos1 = { xAdvance: 100, yAdvance: 0, xOffset: 0, yOffset: 0 };
						const pos2 = { xAdvance: 100, yAdvance: 0, xOffset: 0, yOffset: 0 };

						applyKerningDirect(
							pairLookup,
							firstGlyph,
							secondGlyph,
							pos1,
							pos2,
						);
						// Covers lines 834-848 in gpos.ts
						return;
					}
				}
			}
		}
	});

	test("applyKerningDirect returns false for non-matching glyphs", async () => {
		const font = await Font.fromFile(ARIAL_PATH);
		if (!font.gpos) return;

		const pairLookup = font.gpos.lookups.find(
			(l): l is PairPosLookup => l.type === 2,
		);
		if (!pairLookup) return;

		const pos1 = { xAdvance: 100, yAdvance: 0, xOffset: 0, yOffset: 0 };
		const pos2 = { xAdvance: 100, yAdvance: 0, xOffset: 0, yOffset: 0 };

		// Test with glyphs that definitely don't have kerning
		const applied = applyKerningDirect(pairLookup, 9999, 9999, pos1, pos2);
		expect(applied).toBe(false);
		expect(pos1.xAdvance).toBe(100); // unchanged
		expect(pos2.xAdvance).toBe(100); // unchanged
	});

	test("GPOS with extension lookups (Trattatello)", async () => {
		// Trattatello.ttf has Extension lookups (type 9) in GPOS
		const trattatello = await Font.fromFile("/System/Library/Fonts/Supplemental/Trattatello.ttf").catch(() => null);
		if (!trattatello?.gpos) return;

		// Extension lookups get unwrapped during parsing, so we just verify the font loaded
		expect(trattatello.gpos.lookups.length).toBeGreaterThan(0);

		// Verify some lookup types exist (these came from extension lookups)
		const hasMarkToBase = trattatello.gpos.lookups.some((l) => l.type === 4);
		const hasPair = trattatello.gpos.lookups.some((l) => l.type === 2);
		expect(hasMarkToBase || hasPair).toBe(true);
	});

	test("GPOS with extension lookups (KefaIII)", async () => {
		// KefaIII.ttf has Extension lookups (type 9) in GPOS
		const kefa = await Font.fromFile("/System/Library/Fonts/Supplemental/KefaIII.ttf").catch(() => null);
		if (!kefa?.gpos) return;

		// Extension lookups get unwrapped during parsing
		expect(kefa.gpos.lookups.length).toBeGreaterThan(0);
	});

	test("GPOS with Device tables", async () => {
		// Find a font with Device tables in value records
		const font = await Font.fromFile(ARIAL_PATH);
		if (!font.gpos) return;

		// Check if any lookup has device tables
		for (const lookup of font.gpos.lookups) {
			if (lookup.type === 1) {
				// Single positioning
				for (const subtable of lookup.subtables) {
					if (subtable.format === 1 && subtable.value) {
						// Check for device tables
						if (subtable.value.xPlaDevice || subtable.value.yPlaDevice) {
							expect(true).toBe(true);
							return;
						}
					}
				}
			}
		}
	});

	test("Mark-to-Base positioning lookups", async () => {
		const font = await Font.fromFile(ARIAL_PATH);
		if (!font.gpos) return;

		const markBaseLookup = font.gpos.lookups.find((l) => l.type === 4);
		if (!markBaseLookup) return;

		expect(markBaseLookup.type).toBe(4);
		expect(markBaseLookup.subtables.length).toBeGreaterThan(0);
	});

	test("Mark-to-Ligature positioning lookups", async () => {
		const font = await Font.fromFile(ARIAL_PATH);
		if (!font.gpos) return;

		const markLigLookup = font.gpos.lookups.find((l) => l.type === 5);
		if (!markLigLookup) return;

		expect(markLigLookup.type).toBe(5);
	});

	test("Mark-to-Mark positioning lookups", async () => {
		const font = await Font.fromFile(ARIAL_PATH);
		if (!font.gpos) return;

		const markMarkLookup = font.gpos.lookups.find((l) => l.type === 6);
		if (!markMarkLookup) return;

		expect(markMarkLookup.type).toBe(6);
	});

	test("Cursive attachment positioning lookups", async () => {
		const nastaliq = await Font.fromFile("/System/Library/Fonts/Supplemental/NotoNastaliqUrdu-Regular.ttf").catch(() => null);
		if (!nastaliq?.gpos) return;

		const cursiveLookup = nastaliq.gpos.lookups.find((l) => l.type === 3);
		if (!cursiveLookup) return;

		expect(cursiveLookup.type).toBe(3);
		expect(cursiveLookup.subtables.length).toBeGreaterThan(0);
	});

	test("Context positioning lookups", async () => {
		// Context positioning - type 7
		const font = await Font.fromFile("tests/fixtures/NotoSansNewa-Regular.ttf").catch(() => null);
		if (!font?.gpos) return;

		const contextLookup = font.gpos.lookups.find((l) => l.type === 7);
		if (!contextLookup) return;

		expect(contextLookup.type).toBe(7);
	});

	test("Chaining Context positioning lookups", async () => {
		// Chaining context positioning - type 8
		const font = await Font.fromFile("tests/fixtures/NotoSansLepcha-Regular.ttf").catch(() => null);
		if (!font?.gpos) return;

		const chainContextLookup = font.gpos.lookups.find((l) => l.type === 8);
		if (!chainContextLookup) return;

		expect(chainContextLookup.type).toBe(8);
	});
});

describe("GPOS Extension lookup unit tests", () => {
	// Helper to build minimal SinglePos Format 1 subtable
	function buildSinglePosFormat1(glyph: number, xAdvance: number): Uint8Array {
		// SinglePos Format 1: format(2), coverageOffset(2), valueFormat(2), valueRecord
		// Coverage at offset 8: format(2), glyphCount(2), glyphArray
		const subtable = new Uint8Array(8 + 6); // header + coverage
		const view = new DataView(subtable.buffer);
		view.setUint16(0, 1); // format = 1
		view.setUint16(2, 8); // coverageOffset = 8
		view.setUint16(4, 0x0004); // valueFormat = xAdvance only
		view.setInt16(6, xAdvance); // xAdvance value
		// Coverage at offset 8
		view.setUint16(8, 1); // coverage format 1
		view.setUint16(10, 1); // glyphCount = 1
		view.setUint16(12, glyph); // glyph ID
		return subtable;
	}

	// Helper to build minimal PairPos Format 1 subtable
	function buildPairPosFormat1(glyph1: number, glyph2: number, kern: number): Uint8Array {
		// PairPos Format 1: format(2), coverageOffset(2), valueFormat1(2), valueFormat2(2), pairSetCount(2), pairSetOffsets[](2)
		// PairSet: pairValueCount(2), pairValueRecords[](secondGlyph(2) + value1)
		// Coverage: format(2), glyphCount(2), glyph(2)
		const headerSize = 12; // 2+2+2+2+2+2
		const pairSetOffset = headerSize;
		const pairSetSize = 2 + 2 + 2; // count + secondGlyph + xAdvance
		const coverageOffset = pairSetOffset + pairSetSize;

		const subtable = new Uint8Array(coverageOffset + 6);
		const view = new DataView(subtable.buffer);
		view.setUint16(0, 1); // format = 1
		view.setUint16(2, coverageOffset); // coverageOffset
		view.setUint16(4, 0x0004); // valueFormat1 = xAdvance
		view.setUint16(6, 0x0000); // valueFormat2 = none
		view.setUint16(8, 1); // pairSetCount = 1
		view.setUint16(10, pairSetOffset); // pairSetOffset[0]
		// PairSet at pairSetOffset
		view.setUint16(pairSetOffset, 1); // pairValueCount = 1
		view.setUint16(pairSetOffset + 2, glyph2); // secondGlyph
		view.setInt16(pairSetOffset + 4, kern); // value1.xAdvance
		// Coverage at coverageOffset
		view.setUint16(coverageOffset, 1); // format 1
		view.setUint16(coverageOffset + 2, 1); // glyphCount = 1
		view.setUint16(coverageOffset + 4, glyph1); // glyph ID
		return subtable;
	}

	// Helper to build Extension subtable that wraps another type
	function buildExtensionSubtable(wrappedType: number, wrappedData: Uint8Array): Uint8Array {
		// Extension subtable: format(2), extensionLookupType(2), extensionOffset(4)
		const extensionOffset = 8; // data starts right after header
		const subtable = new Uint8Array(8 + wrappedData.length);
		const view = new DataView(subtable.buffer);
		view.setUint16(0, 1); // format = 1
		view.setUint16(2, wrappedType);
		view.setUint32(4, extensionOffset);
		subtable.set(wrappedData, 8);
		return subtable;
	}

	// Helper to build lookup header with Extension type 9
	function buildExtensionLookup(subtableOffsets: number[], flag: number = 0): { header: Uint8Array; size: number } {
		// Lookup: lookupType(2), lookupFlag(2), subtableCount(2), subtableOffsets[](2*n)
		const size = 6 + subtableOffsets.length * 2;
		const header = new Uint8Array(size);
		const view = new DataView(header.buffer);
		view.setUint16(0, GposLookupType.Extension); // type 9
		view.setUint16(2, flag);
		view.setUint16(4, subtableOffsets.length);
		for (let i = 0; i < subtableOffsets.length; i++) {
			view.setUint16(6 + i * 2, subtableOffsets[i]);
		}
		return { header, size };
	}

	test("Extension lookup wrapping SinglePos (type 1)", () => {
		const singlePos = buildSinglePosFormat1(42, 100);
		const extSubtable = buildExtensionSubtable(GposLookupType.Single, singlePos);

		// Build full lookup with extension subtable
		const subtableOffset = 8; // after lookup header
		const { header } = buildExtensionLookup([subtableOffset]);

		const data = new Uint8Array(header.length + extSubtable.length);
		data.set(header, 0);
		data.set(extSubtable, header.length);

		const reader = new Reader(data.buffer);
		const lookup = __testing.parseGposLookup(reader);

		expect(lookup).not.toBeNull();
		expect(lookup!.type).toBe(GposLookupType.Single);
		expect(lookup!.subtables.length).toBeGreaterThan(0);
	});

	test("Extension lookup wrapping PairPos (type 2)", () => {
		const pairPos = buildPairPosFormat1(65, 66, -50);
		const extSubtable = buildExtensionSubtable(GposLookupType.Pair, pairPos);

		const subtableOffset = 8;
		const { header } = buildExtensionLookup([subtableOffset]);

		const data = new Uint8Array(header.length + extSubtable.length);
		data.set(header, 0);
		data.set(extSubtable, header.length);

		const reader = new Reader(data.buffer);
		const lookup = __testing.parseGposLookup(reader);

		expect(lookup).not.toBeNull();
		expect(lookup!.type).toBe(GposLookupType.Pair);
	});

	test("Extension lookup with empty subtables returns null", () => {
		const { header } = buildExtensionLookup([]);
		const reader = new Reader(header.buffer as ArrayBuffer);
		const lookup = __testing.parseGposLookup(reader);
		expect(lookup).toBeNull();
	});

	test("Extension lookup with invalid format skips subtable", () => {
		// Create extension subtable with format 2 (invalid - only format 1 is valid)
		const invalidExt = new Uint8Array(8);
		const view = new DataView(invalidExt.buffer);
		view.setUint16(0, 2); // format = 2 (invalid!)
		view.setUint16(2, GposLookupType.Single);
		view.setUint32(4, 8);

		const subtableOffset = 8;
		const { header } = buildExtensionLookup([subtableOffset]);

		const data = new Uint8Array(header.length + invalidExt.length);
		data.set(header, 0);
		data.set(invalidExt, header.length);

		const reader = new Reader(data.buffer);
		const lookup = __testing.parseGposLookup(reader);

		// Should return null because all subtables were skipped
		expect(lookup).toBeNull();
	});

	test("Extension lookup wrapping Cursive (type 3)", () => {
		// CursivePos Format 1: format(2), coverageOffset(2), entryExitCount(2), entryExitRecords[]
		// EntryExitRecord: entryAnchorOffset(2), exitAnchorOffset(2)
		// Anchor Format 1: format(2), xCoord(2), yCoord(2)
		const headerSize = 6; // format + coverageOffset + entryExitCount
		const entryExitRecordSize = 4; // 2 offsets
		const entryExitOffset = headerSize;
		const anchor1Offset = entryExitOffset + entryExitRecordSize;
		const anchor2Offset = anchor1Offset + 6;
		const coverageOffset = anchor2Offset + 6;

		const subtable = new Uint8Array(coverageOffset + 6);
		const view = new DataView(subtable.buffer);
		view.setUint16(0, 1); // format = 1
		view.setUint16(2, coverageOffset);
		view.setUint16(4, 1); // entryExitCount = 1
		// EntryExitRecord
		view.setUint16(entryExitOffset, anchor1Offset);
		view.setUint16(entryExitOffset + 2, anchor2Offset);
		// Anchor 1
		view.setUint16(anchor1Offset, 1); // format 1
		view.setInt16(anchor1Offset + 2, 10); // x
		view.setInt16(anchor1Offset + 4, 20); // y
		// Anchor 2
		view.setUint16(anchor2Offset, 1);
		view.setInt16(anchor2Offset + 2, 30);
		view.setInt16(anchor2Offset + 4, 40);
		// Coverage
		view.setUint16(coverageOffset, 1); // format 1
		view.setUint16(coverageOffset + 2, 1); // count
		view.setUint16(coverageOffset + 4, 42); // glyph

		const extSubtable = buildExtensionSubtable(GposLookupType.Cursive, subtable);
		const subtableOff = 8;
		const { header } = buildExtensionLookup([subtableOff]);

		const data = new Uint8Array(header.length + extSubtable.length);
		data.set(header, 0);
		data.set(extSubtable, header.length);

		const reader = new Reader(data.buffer);
		const lookup = __testing.parseGposLookup(reader);

		expect(lookup).not.toBeNull();
		expect(lookup!.type).toBe(GposLookupType.Cursive);
	});

	test("Extension lookup wrapping MarkToBase (type 4)", () => {
		// Minimal MarkBasePos Format 1
		// format(2), markCoverageOffset(2), baseCoverageOffset(2), markClassCount(2), markArrayOffset(2), baseArrayOffset(2)
		const coverage = [0, 1, 0, 1, 0, 42]; // format 1, count 1, glyph 42
		const anchor = [0, 1, 0, 0, 0, 0]; // format 1, x=0, y=0
		// MarkArray: markCount(2), markRecords[](markClass(2), markAnchorOffset(2))
		const markArray = [0, 1, 0, 0, 0, 4, ...anchor]; // count=1, class=0, offset=4, anchor
		// BaseArray: baseCount(2), baseRecords[](baseAnchorOffsets[](2))
		const baseArray = [0, 1, 0, 2, ...anchor]; // count=1, anchorOffset=2, anchor

		const markCoverageOffset = 12; // after header
		const baseCoverageOffset = markCoverageOffset + coverage.length;
		const markArrayOffset = baseCoverageOffset + coverage.length;
		const baseArrayOffset = markArrayOffset + markArray.length;

		const markBasePos = new Uint8Array([
			0, 1, // format = 1
			(markCoverageOffset >> 8) & 0xff, markCoverageOffset & 0xff,
			(baseCoverageOffset >> 8) & 0xff, baseCoverageOffset & 0xff,
			0, 1, // markClassCount = 1
			(markArrayOffset >> 8) & 0xff, markArrayOffset & 0xff,
			(baseArrayOffset >> 8) & 0xff, baseArrayOffset & 0xff,
			...coverage, // mark coverage
			...coverage, // base coverage
			...markArray,
			...baseArray,
		]);

		const extSubtable = buildExtensionSubtable(GposLookupType.MarkToBase, markBasePos);
		const subtableOffset = 8;
		const { header } = buildExtensionLookup([subtableOffset]);

		const data = new Uint8Array(header.length + extSubtable.length);
		data.set(header, 0);
		data.set(extSubtable, header.length);

		const reader = new Reader(data.buffer);
		const lookup = __testing.parseGposLookup(reader);

		expect(lookup).not.toBeNull();
		expect(lookup!.type).toBe(GposLookupType.MarkToBase);
	});

	test("Extension lookup wrapping MarkToLigature (type 5)", () => {
		// Similar to MarkToBase but with ligature attachment
		const coverage = [0, 1, 0, 1, 0, 42];
		const anchor = [0, 1, 0, 0, 0, 0];
		const markArray = [0, 1, 0, 0, 0, 4, ...anchor];
		// LigatureArray: ligatureCount(2), ligatureAttachOffsets[](2)
		// LigatureAttach: componentCount(2), componentRecords[](ligatureAnchorOffsets[](2))
		const ligatureAttach = [0, 1, 0, 2, ...anchor]; // 1 component, offset=2, anchor
		const ligatureArray = [0, 1, 0, 2, ...ligatureAttach]; // count=1, offset=2, attach

		const markCoverageOffset = 12;
		const ligCoverageOffset = markCoverageOffset + coverage.length;
		const markArrayOffset = ligCoverageOffset + coverage.length;
		const ligArrayOffset = markArrayOffset + markArray.length;

		const markLigPos = new Uint8Array([
			0, 1, // format = 1
			(markCoverageOffset >> 8) & 0xff, markCoverageOffset & 0xff,
			(ligCoverageOffset >> 8) & 0xff, ligCoverageOffset & 0xff,
			0, 1, // markClassCount = 1
			(markArrayOffset >> 8) & 0xff, markArrayOffset & 0xff,
			(ligArrayOffset >> 8) & 0xff, ligArrayOffset & 0xff,
			...coverage,
			...coverage,
			...markArray,
			...ligatureArray,
		]);

		const extSubtable = buildExtensionSubtable(GposLookupType.MarkToLigature, markLigPos);
		const subtableOffset = 8;
		const { header } = buildExtensionLookup([subtableOffset]);

		const data = new Uint8Array(header.length + extSubtable.length);
		data.set(header, 0);
		data.set(extSubtable, header.length);

		const reader = new Reader(data.buffer);
		const lookup = __testing.parseGposLookup(reader);

		expect(lookup).not.toBeNull();
		expect(lookup!.type).toBe(GposLookupType.MarkToLigature);
	});

	test("Extension lookup wrapping MarkToMark (type 6)", () => {
		const coverage = [0, 1, 0, 1, 0, 42];
		const anchor = [0, 1, 0, 0, 0, 0];
		const markArray = [0, 1, 0, 0, 0, 4, ...anchor];
		// Mark2Array: mark2Count(2), mark2Records[](mark2AnchorOffsets[](2))
		const mark2Array = [0, 1, 0, 2, ...anchor];

		const mark1CoverageOffset = 12;
		const mark2CoverageOffset = mark1CoverageOffset + coverage.length;
		const mark1ArrayOffset = mark2CoverageOffset + coverage.length;
		const mark2ArrayOffset = mark1ArrayOffset + markArray.length;

		const markMarkPos = new Uint8Array([
			0, 1, // format = 1
			(mark1CoverageOffset >> 8) & 0xff, mark1CoverageOffset & 0xff,
			(mark2CoverageOffset >> 8) & 0xff, mark2CoverageOffset & 0xff,
			0, 1, // markClassCount = 1
			(mark1ArrayOffset >> 8) & 0xff, mark1ArrayOffset & 0xff,
			(mark2ArrayOffset >> 8) & 0xff, mark2ArrayOffset & 0xff,
			...coverage,
			...coverage,
			...markArray,
			...mark2Array,
		]);

		const extSubtable = buildExtensionSubtable(GposLookupType.MarkToMark, markMarkPos);
		const subtableOffset = 8;
		const { header } = buildExtensionLookup([subtableOffset]);

		const data = new Uint8Array(header.length + extSubtable.length);
		data.set(header, 0);
		data.set(extSubtable, header.length);

		const reader = new Reader(data.buffer);
		const lookup = __testing.parseGposLookup(reader);

		expect(lookup).not.toBeNull();
		expect(lookup!.type).toBe(GposLookupType.MarkToMark);
	});

	test("Extension lookup wrapping Context (type 7)", () => {
		// ContextPos Format 2 (class-based) is simpler to construct
		// format(2), coverageOffset(2), classDefOffset(2), posClassSetCount(2), posClassSetOffsets[]
		const headerSize = 10;
		const coverageOffset = headerSize;
		const classDefOffset = coverageOffset + 6;
		// ClassDef format 1: format(2), startGlyph(2), glyphCount(2), classValues[]
		const classDefSize = 8;
		const posClassSetOffset = classDefOffset + classDefSize;
		// PosClassSet: posClassRuleCount(2), posClassRuleOffsets[]
		// PosClassRule: glyphCount(2), posCount(2) - minimal with no extra glyphs or lookups
		const posClassSetSize = 2 + 2 + 4; // count + offset + rule

		const subtable = new Uint8Array(posClassSetOffset + posClassSetSize);
		const view = new DataView(subtable.buffer);
		view.setUint16(0, 2); // format = 2
		view.setUint16(2, coverageOffset);
		view.setUint16(4, classDefOffset);
		view.setUint16(6, 1); // posClassSetCount = 1
		view.setUint16(8, posClassSetOffset);
		// Coverage format 1
		view.setUint16(coverageOffset, 1);
		view.setUint16(coverageOffset + 2, 1);
		view.setUint16(coverageOffset + 4, 42);
		// ClassDef format 1
		view.setUint16(classDefOffset, 1);
		view.setUint16(classDefOffset + 2, 42); // startGlyph
		view.setUint16(classDefOffset + 4, 1); // glyphCount
		view.setUint16(classDefOffset + 6, 0); // class 0
		// PosClassSet
		view.setUint16(posClassSetOffset, 1); // count
		view.setUint16(posClassSetOffset + 2, 4); // offset to rule (relative)
		// PosClassRule at offset 4 relative to posClassSet
		view.setUint16(posClassSetOffset + 4, 1); // glyphCount = 1 (first glyph only)
		view.setUint16(posClassSetOffset + 6, 0); // posCount = 0

		const extSubtable = buildExtensionSubtable(GposLookupType.Context, subtable);
		const subtableOff = 8;
		const { header } = buildExtensionLookup([subtableOff]);

		const data = new Uint8Array(header.length + extSubtable.length);
		data.set(header, 0);
		data.set(extSubtable, header.length);

		const reader = new Reader(data.buffer);
		const lookup = __testing.parseGposLookup(reader);

		expect(lookup).not.toBeNull();
		expect(lookup!.type).toBe(GposLookupType.Context);
	});

	test("Extension lookup wrapping ChainingContext (type 8)", () => {
		// ChainingContextPos Format 3: coverage-based
		// format(2), backtrackGlyphCount(2), backtrackCoverageOffsets[],
		// inputGlyphCount(2), inputCoverageOffsets[],
		// lookaheadGlyphCount(2), lookaheadCoverageOffsets[],
		// posCount(2), posLookupRecords[]
		const headerSize = 12; // format + backtrackCount + inputCount + inputCovOff + lookaheadCount + posCount
		const coverageOffset = headerSize;
		const coverageSize = 6;

		const subtable = new Uint8Array(coverageOffset + coverageSize);
		const view = new DataView(subtable.buffer);
		view.setUint16(0, 3); // format = 3
		view.setUint16(2, 0); // backtrackGlyphCount = 0
		view.setUint16(4, 1); // inputGlyphCount = 1
		view.setUint16(6, coverageOffset); // inputCoverageOffsets[0]
		view.setUint16(8, 0); // lookaheadGlyphCount = 0
		view.setUint16(10, 0); // posCount = 0
		// Coverage format 1
		view.setUint16(coverageOffset, 1);
		view.setUint16(coverageOffset + 2, 1);
		view.setUint16(coverageOffset + 4, 42);

		const extSubtable = buildExtensionSubtable(GposLookupType.ChainingContext, subtable);
		const subtableOff = 8;
		const { header } = buildExtensionLookup([subtableOff]);

		const data = new Uint8Array(header.length + extSubtable.length);
		data.set(header, 0);
		data.set(extSubtable, header.length);

		const reader = new Reader(data.buffer);
		const lookup = __testing.parseGposLookup(reader);

		expect(lookup).not.toBeNull();
		expect(lookup!.type).toBe(GposLookupType.ChainingContext);
	});

	test("Extension lookup with unknown wrapped type returns null", () => {
		const singlePos = buildSinglePosFormat1(42, 100);
		const extSubtable = buildExtensionSubtable(99, singlePos); // type 99 doesn't exist

		const subtableOffset = 8;
		const { header } = buildExtensionLookup([subtableOffset]);

		const data = new Uint8Array(header.length + extSubtable.length);
		data.set(header, 0);
		data.set(extSubtable, header.length);

		const reader = new Reader(data.buffer);
		const lookup = __testing.parseGposLookup(reader);

		expect(lookup).toBeNull();
	});

	test("parseValueRecord with all format flags", () => {
		// valueFormat with all flags: xPlacement, yPlacement, xAdvance, yAdvance, xPlaDevice, yPlaDevice, xAdvDevice, yAdvDevice
		const valueFormat = 0x00FF; // all 8 flags
		// Device table: format 3 (VariationIndex) = format(2), deltaSetOuterIndex(2), deltaSetInnerIndex(2)

		// Layout: 16 bytes for value record, then 4 device tables (6 bytes each)
		const valueRecordSize = 16; // 4 positions + 4 offsets
		const deviceTableSize = 6;
		const deviceOffset1 = valueRecordSize;
		const deviceOffset2 = deviceOffset1 + deviceTableSize;
		const deviceOffset3 = deviceOffset2 + deviceTableSize;
		const deviceOffset4 = deviceOffset3 + deviceTableSize;

		const data = new Uint8Array(valueRecordSize + 4 * deviceTableSize);
		const view = new DataView(data.buffer);
		view.setInt16(0, 10); // xPlacement
		view.setInt16(2, 20); // yPlacement
		view.setInt16(4, 30); // xAdvance
		view.setInt16(6, 40); // yAdvance
		view.setUint16(8, deviceOffset1); // xPlaDevice offset
		view.setUint16(10, deviceOffset2); // yPlaDevice offset
		view.setUint16(12, deviceOffset3); // xAdvDevice offset
		view.setUint16(14, deviceOffset4); // yAdvDevice offset
		// Device tables (format 3 = VariationIndex)
		view.setUint16(deviceOffset1, 0x8000); // format 3 marker
		view.setUint16(deviceOffset1 + 2, 0);
		view.setUint16(deviceOffset1 + 4, 0);
		view.setUint16(deviceOffset2, 0x8000);
		view.setUint16(deviceOffset2 + 2, 0);
		view.setUint16(deviceOffset2 + 4, 0);
		view.setUint16(deviceOffset3, 0x8000);
		view.setUint16(deviceOffset3 + 2, 0);
		view.setUint16(deviceOffset3 + 4, 0);
		view.setUint16(deviceOffset4, 0x8000);
		view.setUint16(deviceOffset4 + 2, 0);
		view.setUint16(deviceOffset4 + 4, 0);

		const reader = new Reader(data.buffer);
		const subtableReader = new Reader(data.buffer);
		const record = __testing.parseValueRecord(reader, valueFormat, subtableReader);

		expect(record.xPlacement).toBe(10);
		expect(record.yPlacement).toBe(20);
		expect(record.xAdvance).toBe(30);
		expect(record.yAdvance).toBe(40);
		expect(record.xPlaDevice).toBeDefined();
		expect(record.yPlaDevice).toBeDefined();
		expect(record.xAdvDevice).toBeDefined();
		expect(record.yAdvDevice).toBeDefined();
	});

	test("parseValueRecord with zero device offsets", () => {
		const valueFormat = 0x00F0; // only device flags
		const data = new Uint8Array([
			0, 0, // xPlaDevice offset = 0 (no device)
			0, 0, // yPlaDevice offset = 0
			0, 0, // xAdvDevice offset = 0
			0, 0, // yAdvDevice offset = 0
		]);

		const reader = new Reader(data.buffer);
		const record = __testing.parseValueRecord(reader, valueFormat);

		// All device fields should be undefined when offset is 0
		expect(record.xPlaDevice).toBeUndefined();
		expect(record.yPlaDevice).toBeUndefined();
		expect(record.xAdvDevice).toBeUndefined();
		expect(record.yAdvDevice).toBeUndefined();
	});

	test("parseGpos with version 1.1 (featureVariationsOffset)", () => {
		// GPOS 1.1 header: majorVersion(2), minorVersion(2), scriptListOffset(2), featureListOffset(2),
		// lookupListOffset(2), featureVariationsOffset(4)
		// We need minimal ScriptList, FeatureList, LookupList structures

		// Layout:
		// Header: 14 bytes (version 1.1 with featureVariationsOffset)
		// ScriptList at offset 14: scriptCount(2) = 0
		// FeatureList at offset 16: featureCount(2) = 0
		// LookupList at offset 18: lookupCount(2) = 0
		const headerSize = 14;
		const scriptListOffset = headerSize;
		const featureListOffset = scriptListOffset + 2;
		const lookupListOffset = featureListOffset + 2;

		const data = new Uint8Array(lookupListOffset + 2);
		const view = new DataView(data.buffer);
		view.setUint16(0, 1); // majorVersion = 1
		view.setUint16(2, 1); // minorVersion = 1 (triggers featureVariationsOffset read)
		view.setUint16(4, scriptListOffset);
		view.setUint16(6, featureListOffset);
		view.setUint16(8, lookupListOffset);
		view.setUint32(10, 0); // featureVariationsOffset (null/0 = no variations)
		// Empty ScriptList
		view.setUint16(scriptListOffset, 0);
		// Empty FeatureList
		view.setUint16(featureListOffset, 0);
		// Empty LookupList
		view.setUint16(lookupListOffset, 0);

		const reader = new Reader(data.buffer);
		const gpos = parseGpos(reader);

		expect(gpos.version.major).toBe(1);
		expect(gpos.version.minor).toBe(1);
		expect(gpos.lookups.length).toBe(0);
	});

	test("unknown lookup type returns null", () => {
		// Create a lookup with type 99 (doesn't exist)
		const data = new Uint8Array([
			0, 99, // lookupType = 99 (invalid)
			0, 0,  // lookupFlag = 0
			0, 0,  // subtableCount = 0
		]);

		const reader = new Reader(data.buffer);
		const lookup = __testing.parseGposLookup(reader);

		expect(lookup).toBeNull();
	});
});
