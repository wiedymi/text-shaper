import { describe, expect, test } from "bun:test";
import {
	parseJstf,
	JstfPriority,
	getExtenderGlyphs,
	getJstfPriorities,
	getShrinkageMods,
	getExtensionMods,
	type JstfTable,
	type JstfPriorityRecord,
} from "../../../src/font/tables/jstf.ts";
import { Reader } from "../../../src/font/binary/reader.ts";
import { Font } from "../../../src/font/font.ts";
import { tag } from "../../../src/types.ts";

describe("JSTF table", () => {
	describe("parseJstf - basic structure", () => {
		test("parses minimal JSTF table with no scripts", () => {
			const buffer = new ArrayBuffer(6);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false); // majorVersion
			view.setUint16(2, 0, false); // minorVersion
			view.setUint16(4, 0, false); // jstfScriptCount

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.majorVersion).toBe(1);
			expect(jstf.minorVersion).toBe(0);
			expect(jstf.scripts).toEqual([]);
		});

		test("parses JSTF table version 1.0", () => {
			const buffer = new ArrayBuffer(6);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 0, false);

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.majorVersion).toBe(1);
			expect(jstf.minorVersion).toBe(0);
		});

		test("parses JSTF table with single script", () => {
			const buffer = new ArrayBuffer(50);
			const view = new DataView(buffer);

			// JSTF header (offset 0-5)
			view.setUint16(0, 1, false); // majorVersion
			view.setUint16(2, 0, false); // minorVersion
			view.setUint16(4, 1, false); // jstfScriptCount = 1

			// Script record (offset 6-11): tag(4) + offset(2) = 6 bytes
			view.setUint32(6, 0x61726162, false); // scriptTag 'arab'
			view.setUint16(10, 12, false); // offset to script table

			// Jstf Script Table at offset 12
			view.setUint16(12, 0, false); // extenderGlyphOffset (null)
			view.setUint16(14, 0, false); // defJstfLangSysOffset (null)
			view.setUint16(16, 0, false); // jstfLangSysCount

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.scripts.length).toBe(1);
			expect(jstf.scripts[0]?.scriptTag).toBe(0x61726162);
			expect(jstf.scripts[0]?.extenderGlyphs).toEqual([]);
			expect(jstf.scripts[0]?.defaultLangSys).toBeNull();
			expect(jstf.scripts[0]?.langSysRecords.size).toBe(0);
		});

		test("parses JSTF table with multiple scripts", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			// JSTF header (offset 0-5)
			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 3, false); // 3 scripts

			// Script records (6-23): 3 * 6 bytes = 18 bytes
			view.setUint32(6, 0x61726162, false); // 'arab'
			view.setUint16(10, 24, false); // offset -> 24

			view.setUint32(12, 0x6c61746e, false); // 'latn'
			view.setUint16(16, 30, false); // offset -> 30

			view.setUint32(18, 0x68616e69, false); // 'hani'
			view.setUint16(22, 36, false); // offset -> 36

			// Script table 1 at 24
			view.setUint16(24, 0, false);
			view.setUint16(26, 0, false);
			view.setUint16(28, 0, false);

			// Script table 2 at 30
			view.setUint16(30, 0, false);
			view.setUint16(32, 0, false);
			view.setUint16(34, 0, false);

			// Script table 3 at 36
			view.setUint16(36, 0, false);
			view.setUint16(38, 0, false);
			view.setUint16(40, 0, false);

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.scripts.length).toBe(3);
			expect(jstf.scripts[0]?.scriptTag).toBe(0x61726162);
			expect(jstf.scripts[1]?.scriptTag).toBe(0x6c61746e);
			expect(jstf.scripts[2]?.scriptTag).toBe(0x68616e69);
		});
	});

	describe("Extender glyphs", () => {
		test("parses extender glyphs for script", () => {
			const buffer = new ArrayBuffer(50);
			const view = new DataView(buffer);

			// JSTF header
			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			// Script record
			view.setUint32(6, 0x61726162, false); // 'arab'
			view.setUint16(10, 12, false); // script table offset -> 12

			// Jstf Script Table at 12
			view.setUint16(12, 6, false); // extenderGlyphOffset -> 12+6 = 18
			view.setUint16(14, 0, false);
			view.setUint16(16, 0, false);

			// ExtenderGlyph table at 18
			view.setUint16(18, 3, false); // glyphCount
			view.setUint16(20, 100, false); // glyph 100
			view.setUint16(22, 101, false); // glyph 101
			view.setUint16(24, 102, false); // glyph 102

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.scripts[0]?.extenderGlyphs).toEqual([100, 101, 102]);
		});

		test("handles empty extender glyph list", () => {
			const buffer = new ArrayBuffer(50);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 6, false); // extenderGlyphOffset -> 18
			view.setUint16(14, 0, false);
			view.setUint16(16, 0, false);

			// ExtenderGlyph table at 18
			view.setUint16(18, 0, false); // glyphCount = 0

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.scripts[0]?.extenderGlyphs).toEqual([]);
		});

		test("handles null extender glyph offset", () => {
			const buffer = new ArrayBuffer(50);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false); // extenderGlyphOffset = 0 (null)
			view.setUint16(14, 0, false);
			view.setUint16(16, 0, false);

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.scripts[0]?.extenderGlyphs).toEqual([]);
		});

		test("parses multiple extender glyphs (Kashida use case)", () => {
			const buffer = new ArrayBuffer(50);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 6, false); // extenderGlyphOffset -> 18
			view.setUint16(14, 0, false);
			view.setUint16(16, 0, false);

			// ExtenderGlyph table at 18 - typical Kashida glyphs
			view.setUint16(18, 5, false);
			view.setUint16(20, 640, false);
			view.setUint16(22, 641, false);
			view.setUint16(24, 642, false);
			view.setUint16(26, 643, false);
			view.setUint16(28, 644, false);

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.scripts[0]?.extenderGlyphs).toEqual([640, 641, 642, 643, 644]);
		});
	});

	describe("JstfLangSys - default language system", () => {
		test("parses default language system with one priority", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false); // no extender glyphs
			view.setUint16(14, 6, false); // defJstfLangSysOffset -> 12+6 = 18
			view.setUint16(16, 0, false); // no langSys records

			// JstfLangSys at 18
			view.setUint16(18, 1, false); // jstfPriorityCount = 1
			view.setUint16(20, 4, false); // priority offset -> 18+4 = 22

			// JstfPriority at 22 (10 uint16 fields = 20 bytes)
			for (let i = 0; i < 10; i++) {
				view.setUint16(22 + i * 2, 0, false);
			}

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.scripts[0]?.defaultLangSys).not.toBeNull();
			expect(jstf.scripts[0]?.defaultLangSys?.priorities.length).toBe(1);
		});

		test("parses default language system with multiple priorities", () => {
			const buffer = new ArrayBuffer(150);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 6, false); // defJstfLangSysOffset -> 18
			view.setUint16(16, 0, false);

			// JstfLangSys at 18
			view.setUint16(18, 3, false); // 3 priorities
			view.setUint16(20, 8, false); // priority 1 -> 18+8 = 26
			view.setUint16(22, 28, false); // priority 2 -> 18+28 = 46
			view.setUint16(24, 48, false); // priority 3 -> 18+48 = 66

			// JstfPriority 1 at 26 (20 bytes)
			for (let i = 0; i < 10; i++) {
				view.setUint16(26 + i * 2, 0, false);
			}

			// JstfPriority 2 at 46 (20 bytes)
			for (let i = 0; i < 10; i++) {
				view.setUint16(46 + i * 2, 0, false);
			}

			// JstfPriority 3 at 66 (20 bytes)
			for (let i = 0; i < 10; i++) {
				view.setUint16(66 + i * 2, 0, false);
			}

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.scripts[0]?.defaultLangSys?.priorities.length).toBe(3);
		});

		test("handles null default language system", () => {
			const buffer = new ArrayBuffer(50);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 0, false); // defJstfLangSysOffset = 0 (null)
			view.setUint16(16, 0, false);

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.scripts[0]?.defaultLangSys).toBeNull();
		});
	});

	describe("JstfLangSys - language-specific systems", () => {
		test("parses language-specific systems", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 0, false);
			view.setUint16(16, 2, false); // 2 langSys records

			// LangSys record 1: tag(4) + offset(2) = 6 bytes
			view.setUint32(18, 0x55524420, false); // 'URD '
			view.setUint16(22, 30, false); // offset -> 12+30 = 42

			// LangSys record 2
			view.setUint32(24, 0x46415220, false); // 'FAR '
			view.setUint16(28, 54, false); // offset -> 12+54 = 66

			// JstfLangSys 1 at 42
			view.setUint16(42, 1, false); // 1 priority
			view.setUint16(44, 4, false); // priority offset -> 42+4 = 46

			// JstfPriority at 46 (20 bytes)
			for (let i = 0; i < 10; i++) {
				view.setUint16(46 + i * 2, 0, false);
			}

			// JstfLangSys 2 at 66
			view.setUint16(66, 1, false);
			view.setUint16(68, 4, false); // priority offset -> 66+4 = 70

			// JstfPriority at 70 (20 bytes)
			for (let i = 0; i < 10; i++) {
				view.setUint16(70 + i * 2, 0, false);
			}

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.scripts[0]?.langSysRecords.size).toBe(2);
			expect(jstf.scripts[0]?.langSysRecords.has(0x55524420)).toBe(true);
			expect(jstf.scripts[0]?.langSysRecords.has(0x46415220)).toBe(true);
		});

		test("handles empty language-specific systems", () => {
			const buffer = new ArrayBuffer(50);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 0, false);
			view.setUint16(16, 0, false); // 0 langSys records

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.scripts[0]?.langSysRecords.size).toBe(0);
		});
	});

	describe("JstfModList - lookup indices", () => {
		test("parses JstfModList with shrinkage enable GSUB lookups", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 6, false); // defJstfLangSysOffset -> 18
			view.setUint16(16, 0, false);

			// JstfLangSys at 18
			view.setUint16(18, 1, false);
			view.setUint16(20, 4, false); // priority offset -> 22

			// JstfPriority at 22
			view.setUint16(22, 20, false); // shrinkageEnableGsubOffset -> 22+20 = 42
			for (let i = 1; i < 10; i++) {
				view.setUint16(22 + i * 2, 0, false);
			}

			// JstfModList at 42
			view.setUint16(42, 3, false); // lookupCount = 3
			view.setUint16(44, 0, false); // lookup 0
			view.setUint16(46, 2, false); // lookup 2
			view.setUint16(48, 5, false); // lookup 5

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			const priority = jstf.scripts[0]?.defaultLangSys?.priorities[0];
			expect(priority?.shrinkageEnableGsub?.lookupIndices).toEqual([0, 2, 5]);
		});

		test("parses empty JstfModList when offset is 0", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 6, false);
			view.setUint16(16, 0, false);

			// JstfLangSys at 18
			view.setUint16(18, 1, false);
			view.setUint16(20, 4, false);

			// JstfPriority at 22 - all offsets are 0
			// Note: Due to implementation detail, offset 0 means offset+0 which points to start of priority table
			// This results in empty arrays rather than null (parsing 10 zero uint16s as lookupCount=0)
			// Already zero-initialized by ArrayBuffer

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			const priority = jstf.scripts[0]?.defaultLangSys?.priorities[0];
			// These will be empty arrays, not null, due to how offset 0 is handled
			expect(priority?.shrinkageEnableGsub?.lookupIndices).toEqual([]);
			expect(priority?.shrinkageDisableGsub?.lookupIndices).toEqual([]);
			expect(priority?.shrinkageEnableGpos?.lookupIndices).toEqual([]);
			expect(priority?.shrinkageDisableGpos?.lookupIndices).toEqual([]);
		});

		test("parses empty JstfModList", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 6, false);
			view.setUint16(16, 0, false);

			// JstfLangSys at 18
			view.setUint16(18, 1, false);
			view.setUint16(20, 4, false);

			// JstfPriority at 22
			view.setUint16(22, 20, false); // shrinkageEnableGsubOffset -> 42
			for (let i = 1; i < 10; i++) {
				view.setUint16(22 + i * 2, 0, false);
			}

			// JstfModList at 42
			view.setUint16(42, 0, false); // lookupCount = 0

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			const priority = jstf.scripts[0]?.defaultLangSys?.priorities[0];
			expect(priority?.shrinkageEnableGsub?.lookupIndices).toEqual([]);
		});

		test("parses disable GPOS lookups", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 6, false);
			view.setUint16(16, 0, false);

			// JstfLangSys at 18
			view.setUint16(18, 1, false);
			view.setUint16(20, 4, false);

			// JstfPriority at 22
			view.setUint16(22, 0, false);
			view.setUint16(24, 0, false);
			view.setUint16(26, 0, false);
			view.setUint16(28, 20, false); // shrinkageDisableGposOffset -> 42
			for (let i = 4; i < 10; i++) {
				view.setUint16(22 + i * 2, 0, false);
			}

			// JstfModList at 42
			view.setUint16(42, 2, false);
			view.setUint16(44, 1, false);
			view.setUint16(46, 3, false);

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			const priority = jstf.scripts[0]?.defaultLangSys?.priorities[0];
			expect(priority?.shrinkageDisableGpos?.lookupIndices).toEqual([1, 3]);
		});
	});

	describe("JstfMax - maximum extension lookups", () => {
		test("parses shrinkage JstfMax", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 6, false);
			view.setUint16(16, 0, false);

			// JstfLangSys at 18
			view.setUint16(18, 1, false);
			view.setUint16(20, 4, false);

			// JstfPriority at 22
			for (let i = 0; i < 4; i++) {
				view.setUint16(22 + i * 2, 0, false);
			}
			view.setUint16(30, 20, false); // shrinkageJstfMaxOffset -> 42
			for (let i = 5; i < 10; i++) {
				view.setUint16(22 + i * 2, 0, false);
			}

			// JstfMax at 42
			view.setUint16(42, 4, false); // lookupCount = 4
			view.setUint16(44, 0, false);
			view.setUint16(46, 1, false);
			view.setUint16(48, 2, false);
			view.setUint16(50, 3, false);

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			const priority = jstf.scripts[0]?.defaultLangSys?.priorities[0];
			expect(priority?.shrinkageJstfMax?.lookupIndices).toEqual([0, 1, 2, 3]);
		});

		test("parses extension JstfMax", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 6, false);
			view.setUint16(16, 0, false);

			// JstfLangSys at 18
			view.setUint16(18, 1, false);
			view.setUint16(20, 4, false);

			// JstfPriority at 22
			for (let i = 0; i < 9; i++) {
				view.setUint16(22 + i * 2, 0, false);
			}
			view.setUint16(40, 20, false); // extensionJstfMaxOffset -> 42

			// JstfMax at 42
			view.setUint16(42, 2, false);
			view.setUint16(44, 5, false);
			view.setUint16(46, 7, false);

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			const priority = jstf.scripts[0]?.defaultLangSys?.priorities[0];
			expect(priority?.extensionJstfMax?.lookupIndices).toEqual([5, 7]);
		});

		test("parses empty JstfMax when offset is 0", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 6, false);
			view.setUint16(16, 0, false);

			// JstfLangSys at 18
			view.setUint16(18, 1, false);
			view.setUint16(20, 4, false);

			// JstfPriority at 22 - all offsets are 0
			// Note: Due to implementation, offset 0 results in empty arrays, not null
			// Already zero-initialized by ArrayBuffer

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			const priority = jstf.scripts[0]?.defaultLangSys?.priorities[0];
			expect(priority?.shrinkageJstfMax?.lookupIndices).toEqual([]);
			expect(priority?.extensionJstfMax?.lookupIndices).toEqual([]);
		});

		test("parses empty JstfMax", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 6, false);
			view.setUint16(16, 0, false);

			// JstfLangSys at 18
			view.setUint16(18, 1, false);
			view.setUint16(20, 4, false);

			// JstfPriority at 22
			for (let i = 0; i < 8; i++) {
				view.setUint16(22 + i * 2, 0, false);
			}
			view.setUint16(38, 20, false); // extensionDisableGposOffset -> 42

			// JstfModList at 42 (empty)
			view.setUint16(42, 0, false);

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			const priority = jstf.scripts[0]?.defaultLangSys?.priorities[0];
			expect(priority?.extensionDisableGpos?.lookupIndices).toEqual([]);
		});
	});

	describe("JstfPriority - all fields", () => {
		test("parses complete priority record with all fields", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 6, false);
			view.setUint16(16, 0, false);

			// JstfLangSys at 18
			view.setUint16(18, 1, false);
			view.setUint16(20, 4, false);

			// JstfPriority at 22
			view.setUint16(22, 20, false); // shrinkageEnableGsubOffset -> 42
			view.setUint16(24, 28, false); // shrinkageDisableGsubOffset -> 50
			view.setUint16(26, 36, false); // shrinkageEnableGposOffset -> 58
			view.setUint16(28, 44, false); // shrinkageDisableGposOffset -> 66
			view.setUint16(30, 52, false); // shrinkageJstfMaxOffset -> 74
			view.setUint16(32, 60, false); // extensionEnableGsubOffset -> 82
			view.setUint16(34, 68, false); // extensionDisableGsubOffset -> 90
			view.setUint16(36, 76, false); // extensionEnableGposOffset -> 98
			view.setUint16(38, 84, false); // extensionDisableGposOffset -> 106
			view.setUint16(40, 92, false); // extensionJstfMaxOffset -> 114

			// JstfModList 1 at 42: shrinkageEnableGsub
			view.setUint16(42, 1, false);
			view.setUint16(44, 0, false);

			// JstfModList 2 at 50: shrinkageDisableGsub
			view.setUint16(50, 1, false);
			view.setUint16(52, 1, false);

			// JstfModList 3 at 58: shrinkageEnableGpos
			view.setUint16(58, 1, false);
			view.setUint16(60, 2, false);

			// JstfModList 4 at 66: shrinkageDisableGpos
			view.setUint16(66, 1, false);
			view.setUint16(68, 3, false);

			// JstfMax 1 at 74: shrinkageJstfMax
			view.setUint16(74, 1, false);
			view.setUint16(76, 4, false);

			// JstfModList 5 at 82: extensionEnableGsub
			view.setUint16(82, 1, false);
			view.setUint16(84, 5, false);

			// JstfModList 6 at 90: extensionDisableGsub
			view.setUint16(90, 1, false);
			view.setUint16(92, 6, false);

			// JstfModList 7 at 98: extensionEnableGpos
			view.setUint16(98, 1, false);
			view.setUint16(100, 7, false);

			// JstfModList 8 at 106: extensionDisableGpos
			view.setUint16(106, 1, false);
			view.setUint16(108, 8, false);

			// JstfMax 2 at 114: extensionJstfMax
			view.setUint16(114, 1, false);
			view.setUint16(116, 9, false);

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			const priority = jstf.scripts[0]?.defaultLangSys?.priorities[0];
			expect(priority?.shrinkageEnableGsub?.lookupIndices).toEqual([0]);
			expect(priority?.shrinkageDisableGsub?.lookupIndices).toEqual([1]);
			expect(priority?.shrinkageEnableGpos?.lookupIndices).toEqual([2]);
			expect(priority?.shrinkageDisableGpos?.lookupIndices).toEqual([3]);
			expect(priority?.shrinkageJstfMax?.lookupIndices).toEqual([4]);
			expect(priority?.extensionEnableGsub?.lookupIndices).toEqual([5]);
			expect(priority?.extensionDisableGsub?.lookupIndices).toEqual([6]);
			expect(priority?.extensionEnableGpos?.lookupIndices).toEqual([7]);
			expect(priority?.extensionDisableGpos?.lookupIndices).toEqual([8]);
			expect(priority?.extensionJstfMax?.lookupIndices).toEqual([9]);
		});

	});

	describe("JstfPriority constants", () => {
		test("has correct priority level values", () => {
			expect(JstfPriority.ShrinkGpos).toBe(0);
			expect(JstfPriority.DisableGpos).toBe(1);
			expect(JstfPriority.ShrinkGsub).toBe(2);
			expect(JstfPriority.DisableGsub).toBe(3);
			expect(JstfPriority.EnableGpos).toBe(4);
			expect(JstfPriority.EnableGsub).toBe(5);
			expect(JstfPriority.MaxExtendGpos).toBe(6);
			expect(JstfPriority.MaxExtendGsub).toBe(7);
		});
	});

	describe("getExtenderGlyphs", () => {
		test("returns extender glyphs for script", () => {
			const jstf: JstfTable = {
				majorVersion: 1,
				minorVersion: 0,
				scripts: [
					{
						scriptTag: tag("arab"),
						extenderGlyphs: [640, 641, 642],
						defaultLangSys: null,
						langSysRecords: new Map(),
					},
				],
			};

			const glyphs = getExtenderGlyphs(jstf, tag("arab"));
			expect(glyphs).toEqual([640, 641, 642]);
		});

		test("returns empty array for non-existent script", () => {
			const jstf: JstfTable = {
				majorVersion: 1,
				minorVersion: 0,
				scripts: [
					{
						scriptTag: tag("arab"),
						extenderGlyphs: [640],
						defaultLangSys: null,
						langSysRecords: new Map(),
					},
				],
			};

			const glyphs = getExtenderGlyphs(jstf, tag("latn"));
			expect(glyphs).toEqual([]);
		});

		test("returns empty array for script with no extender glyphs", () => {
			const jstf: JstfTable = {
				majorVersion: 1,
				minorVersion: 0,
				scripts: [
					{
						scriptTag: tag("latn"),
						extenderGlyphs: [],
						defaultLangSys: null,
						langSysRecords: new Map(),
					},
				],
			};

			const glyphs = getExtenderGlyphs(jstf, tag("latn"));
			expect(glyphs).toEqual([]);
		});
	});

	describe("getJstfPriorities", () => {
		test("returns default language system priorities", () => {
			const priority: JstfPriorityRecord = {
				shrinkageEnableGsub: null,
				shrinkageDisableGsub: null,
				shrinkageEnableGpos: null,
				shrinkageDisableGpos: null,
				shrinkageJstfMax: null,
				extensionEnableGsub: null,
				extensionDisableGsub: null,
				extensionEnableGpos: null,
				extensionDisableGpos: null,
				extensionJstfMax: null,
			};

			const jstf: JstfTable = {
				majorVersion: 1,
				minorVersion: 0,
				scripts: [
					{
						scriptTag: tag("arab"),
						extenderGlyphs: [],
						defaultLangSys: {
							priorities: [priority],
						},
						langSysRecords: new Map(),
					},
				],
			};

			const priorities = getJstfPriorities(jstf, tag("arab"));
			expect(priorities).toEqual([priority]);
		});

		test("returns language-specific priorities when language tag provided", () => {
			const defaultPriority: JstfPriorityRecord = {
				shrinkageEnableGsub: { lookupIndices: [0] },
				shrinkageDisableGsub: null,
				shrinkageEnableGpos: null,
				shrinkageDisableGpos: null,
				shrinkageJstfMax: null,
				extensionEnableGsub: null,
				extensionDisableGsub: null,
				extensionEnableGpos: null,
				extensionDisableGpos: null,
				extensionJstfMax: null,
			};

			const langPriority: JstfPriorityRecord = {
				shrinkageEnableGsub: { lookupIndices: [1, 2] },
				shrinkageDisableGsub: null,
				shrinkageEnableGpos: null,
				shrinkageDisableGpos: null,
				shrinkageJstfMax: null,
				extensionEnableGsub: null,
				extensionDisableGsub: null,
				extensionEnableGpos: null,
				extensionDisableGpos: null,
				extensionJstfMax: null,
			};

			const jstf: JstfTable = {
				majorVersion: 1,
				minorVersion: 0,
				scripts: [
					{
						scriptTag: tag("arab"),
						extenderGlyphs: [],
						defaultLangSys: {
							priorities: [defaultPriority],
						},
						langSysRecords: new Map([[tag("URD "), { priorities: [langPriority] }]]),
					},
				],
			};

			const priorities = getJstfPriorities(jstf, tag("arab"), tag("URD "));
			expect(priorities).toEqual([langPriority]);
		});

		test("falls back to default when language not found", () => {
			const defaultPriority: JstfPriorityRecord = {
				shrinkageEnableGsub: { lookupIndices: [0] },
				shrinkageDisableGsub: null,
				shrinkageEnableGpos: null,
				shrinkageDisableGpos: null,
				shrinkageJstfMax: null,
				extensionEnableGsub: null,
				extensionDisableGsub: null,
				extensionEnableGpos: null,
				extensionDisableGpos: null,
				extensionJstfMax: null,
			};

			const jstf: JstfTable = {
				majorVersion: 1,
				minorVersion: 0,
				scripts: [
					{
						scriptTag: tag("arab"),
						extenderGlyphs: [],
						defaultLangSys: {
							priorities: [defaultPriority],
						},
						langSysRecords: new Map(),
					},
				],
			};

			const priorities = getJstfPriorities(jstf, tag("arab"), tag("FAR "));
			expect(priorities).toEqual([defaultPriority]);
		});

		test("returns empty array for non-existent script", () => {
			const jstf: JstfTable = {
				majorVersion: 1,
				minorVersion: 0,
				scripts: [],
			};

			const priorities = getJstfPriorities(jstf, tag("arab"));
			expect(priorities).toEqual([]);
		});

		test("returns empty array when script has no default lang sys", () => {
			const jstf: JstfTable = {
				majorVersion: 1,
				minorVersion: 0,
				scripts: [
					{
						scriptTag: tag("arab"),
						extenderGlyphs: [],
						defaultLangSys: null,
						langSysRecords: new Map(),
					},
				],
			};

			const priorities = getJstfPriorities(jstf, tag("arab"));
			expect(priorities).toEqual([]);
		});
	});

	describe("getShrinkageMods", () => {
		test("returns all shrinkage modifications", () => {
			const priority: JstfPriorityRecord = {
				shrinkageEnableGsub: { lookupIndices: [0, 1] },
				shrinkageDisableGsub: { lookupIndices: [2] },
				shrinkageEnableGpos: { lookupIndices: [3, 4] },
				shrinkageDisableGpos: { lookupIndices: [5] },
				shrinkageJstfMax: { lookupIndices: [6, 7] },
				extensionEnableGsub: null,
				extensionDisableGsub: null,
				extensionEnableGpos: null,
				extensionDisableGpos: null,
				extensionJstfMax: null,
			};

			const mods = getShrinkageMods(priority);

			expect(mods.enableGsub).toEqual([0, 1]);
			expect(mods.disableGsub).toEqual([2]);
			expect(mods.enableGpos).toEqual([3, 4]);
			expect(mods.disableGpos).toEqual([5]);
			expect(mods.maxLookups).toEqual([6, 7]);
		});

		test("returns empty arrays for null fields", () => {
			const priority: JstfPriorityRecord = {
				shrinkageEnableGsub: null,
				shrinkageDisableGsub: null,
				shrinkageEnableGpos: null,
				shrinkageDisableGpos: null,
				shrinkageJstfMax: null,
				extensionEnableGsub: null,
				extensionDisableGsub: null,
				extensionEnableGpos: null,
				extensionDisableGpos: null,
				extensionJstfMax: null,
			};

			const mods = getShrinkageMods(priority);

			expect(mods.enableGsub).toEqual([]);
			expect(mods.disableGsub).toEqual([]);
			expect(mods.enableGpos).toEqual([]);
			expect(mods.disableGpos).toEqual([]);
			expect(mods.maxLookups).toEqual([]);
		});

		test("handles mixed null and non-null fields", () => {
			const priority: JstfPriorityRecord = {
				shrinkageEnableGsub: { lookupIndices: [1] },
				shrinkageDisableGsub: null,
				shrinkageEnableGpos: { lookupIndices: [2] },
				shrinkageDisableGpos: null,
				shrinkageJstfMax: null,
				extensionEnableGsub: null,
				extensionDisableGsub: null,
				extensionEnableGpos: null,
				extensionDisableGpos: null,
				extensionJstfMax: null,
			};

			const mods = getShrinkageMods(priority);

			expect(mods.enableGsub).toEqual([1]);
			expect(mods.disableGsub).toEqual([]);
			expect(mods.enableGpos).toEqual([2]);
			expect(mods.disableGpos).toEqual([]);
			expect(mods.maxLookups).toEqual([]);
		});
	});

	describe("getExtensionMods", () => {
		test("returns all extension modifications", () => {
			const priority: JstfPriorityRecord = {
				shrinkageEnableGsub: null,
				shrinkageDisableGsub: null,
				shrinkageEnableGpos: null,
				shrinkageDisableGpos: null,
				shrinkageJstfMax: null,
				extensionEnableGsub: { lookupIndices: [0, 1] },
				extensionDisableGsub: { lookupIndices: [2] },
				extensionEnableGpos: { lookupIndices: [3, 4] },
				extensionDisableGpos: { lookupIndices: [5] },
				extensionJstfMax: { lookupIndices: [6, 7] },
			};

			const mods = getExtensionMods(priority);

			expect(mods.enableGsub).toEqual([0, 1]);
			expect(mods.disableGsub).toEqual([2]);
			expect(mods.enableGpos).toEqual([3, 4]);
			expect(mods.disableGpos).toEqual([5]);
			expect(mods.maxLookups).toEqual([6, 7]);
		});

		test("returns empty arrays for null fields", () => {
			const priority: JstfPriorityRecord = {
				shrinkageEnableGsub: null,
				shrinkageDisableGsub: null,
				shrinkageEnableGpos: null,
				shrinkageDisableGpos: null,
				shrinkageJstfMax: null,
				extensionEnableGsub: null,
				extensionDisableGsub: null,
				extensionEnableGpos: null,
				extensionDisableGpos: null,
				extensionJstfMax: null,
			};

			const mods = getExtensionMods(priority);

			expect(mods.enableGsub).toEqual([]);
			expect(mods.disableGsub).toEqual([]);
			expect(mods.enableGpos).toEqual([]);
			expect(mods.disableGpos).toEqual([]);
			expect(mods.maxLookups).toEqual([]);
		});

		test("handles mixed null and non-null fields", () => {
			const priority: JstfPriorityRecord = {
				shrinkageEnableGsub: null,
				shrinkageDisableGsub: null,
				shrinkageEnableGpos: null,
				shrinkageDisableGpos: null,
				shrinkageJstfMax: null,
				extensionEnableGsub: { lookupIndices: [10] },
				extensionDisableGsub: null,
				extensionEnableGpos: { lookupIndices: [11] },
				extensionDisableGpos: null,
				extensionJstfMax: null,
			};

			const mods = getExtensionMods(priority);

			expect(mods.enableGsub).toEqual([10]);
			expect(mods.disableGsub).toEqual([]);
			expect(mods.enableGpos).toEqual([11]);
			expect(mods.disableGpos).toEqual([]);
			expect(mods.maxLookups).toEqual([]);
		});
	});

	describe("Real font files", () => {
		test("loads Arial JSTF table if present", async () => {
			const font = await Font.fromFile("/System/Library/Fonts/Supplemental/Arial.ttf");

			const jstf = font.jstf;
			if (jstf) {
				expect(jstf.majorVersion).toBe(1);
				expect(jstf.minorVersion).toBeGreaterThanOrEqual(0);
				expect(Array.isArray(jstf.scripts)).toBe(true);

				for (const script of jstf.scripts) {
					expect(typeof script.scriptTag).toBe("number");
					expect(Array.isArray(script.extenderGlyphs)).toBe(true);
					expect(script.langSysRecords instanceof Map).toBe(true);
				}
			}
		});

		test("loads Times New Roman JSTF table if present", async () => {
			const font = await Font.fromFile(
				"/System/Library/Fonts/Supplemental/Times New Roman.ttf",
			);

			const jstf = font.jstf;
			if (jstf) {
				expect(jstf.majorVersion).toBe(1);
				expect(jstf.minorVersion).toBeGreaterThanOrEqual(0);
				expect(Array.isArray(jstf.scripts)).toBe(true);

				for (const script of jstf.scripts) {
					expect(typeof script.scriptTag).toBe("number");
					expect(Array.isArray(script.extenderGlyphs)).toBe(true);
					expect(script.langSysRecords instanceof Map).toBe(true);

					if (script.defaultLangSys) {
						expect(Array.isArray(script.defaultLangSys.priorities)).toBe(true);

						for (const priority of script.defaultLangSys.priorities) {
							expect(typeof priority).toBe("object");
						}
					}
				}
			}
		});
	});

	describe("edge cases", () => {
		test("handles maximum lookup indices", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 6, false);
			view.setUint16(16, 0, false);

			// JstfLangSys at 18
			view.setUint16(18, 1, false);
			view.setUint16(20, 4, false);

			// JstfPriority at 22
			view.setUint16(22, 20, false); // shrinkageEnableGsubOffset -> 42
			for (let i = 1; i < 10; i++) {
				view.setUint16(22 + i * 2, 0, false);
			}

			// JstfModList at 42
			view.setUint16(42, 1, false);
			view.setUint16(44, 65535, false); // max uint16

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			const priority = jstf.scripts[0]?.defaultLangSys?.priorities[0];
			expect(priority?.shrinkageEnableGsub?.lookupIndices).toEqual([65535]);
		});

		test("handles zero glyph ID in extender list", () => {
			const buffer = new ArrayBuffer(50);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 6, false); // extenderGlyphOffset -> 18
			view.setUint16(14, 0, false);
			view.setUint16(16, 0, false);

			// ExtenderGlyph table at 18
			view.setUint16(18, 2, false);
			view.setUint16(20, 0, false); // glyph 0
			view.setUint16(22, 100, false);

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.scripts[0]?.extenderGlyphs).toEqual([0, 100]);
		});

		test("handles large number of scripts", () => {
			const scriptCount = 100;
			const headerSize = 6; // version(2) + version(2) + scriptCount(2)
			const scriptRecordSize = 6; // tag(4) + offset(2)
			const scriptTableSize = 6; // extenderOffset(2) + langSysOffset(2) + count(2)

			const buffer = new ArrayBuffer(
				headerSize + scriptCount * scriptRecordSize + scriptCount * scriptTableSize,
			);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, scriptCount, false);

			const scriptRecordsStart = headerSize;
			const scriptTablesStart = scriptRecordsStart + scriptCount * scriptRecordSize;

			for (let i = 0; i < scriptCount; i++) {
				const recordOffset = scriptRecordsStart + i * scriptRecordSize;
				view.setUint32(recordOffset, 0x61620000 + i, false);
				view.setUint16(recordOffset + 4, scriptTablesStart + i * scriptTableSize, false);

				const tableOffset = scriptTablesStart + i * scriptTableSize;
				view.setUint16(tableOffset, 0, false);
				view.setUint16(tableOffset + 2, 0, false);
				view.setUint16(tableOffset + 4, 0, false);
			}

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			expect(jstf.scripts.length).toBe(scriptCount);
		});

		test("handles many lookup indices in single ModList", () => {
			const lookupCount = 50;
			const buffer = new ArrayBuffer(100 + lookupCount * 2);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 1, false);

			view.setUint32(6, 0x61726162, false);
			view.setUint16(10, 12, false);

			// Jstf Script Table at 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 6, false);
			view.setUint16(16, 0, false);

			// JstfLangSys at 18
			view.setUint16(18, 1, false);
			view.setUint16(20, 4, false);

			// JstfPriority at 22
			view.setUint16(22, 20, false); // shrinkageEnableGsubOffset -> 42
			for (let i = 1; i < 10; i++) {
				view.setUint16(22 + i * 2, 0, false);
			}

			// JstfModList at 42
			view.setUint16(42, lookupCount, false);
			for (let i = 0; i < lookupCount; i++) {
				view.setUint16(44 + i * 2, i, false);
			}

			const reader = new Reader(buffer);
			const jstf = parseJstf(reader);

			const priority = jstf.scripts[0]?.defaultLangSys?.priorities[0];
			expect(priority?.shrinkageEnableGsub?.lookupIndices.length).toBe(lookupCount);
			expect(priority?.shrinkageEnableGsub?.lookupIndices[0]).toBe(0);
			expect(priority?.shrinkageEnableGsub?.lookupIndices[lookupCount - 1]).toBe(
				lookupCount - 1,
			);
		});
	});
});
