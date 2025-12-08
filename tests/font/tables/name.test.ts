import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseName,
	getNameById,
	getFontFamily,
	getFontSubfamily,
	getFullName,
	getPostScriptName,
	getVersion,
	NameId,
	PlatformId,
	WindowsEncodingId,
	type NameTable,
	type NameRecord,
} from "../../../src/font/tables/name.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("name table", () => {
	let font: Font;
	let nameTable: NameTable | null;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
		nameTable = font.name;
	});

	describe("parseName", () => {
		test("returns NameTable from Arial", () => {
			expect(nameTable).not.toBeNull();
			if (!nameTable) return;

			expect(typeof nameTable.format).toBe("number");
			expect(Array.isArray(nameTable.records)).toBe(true);
			expect(nameTable.records.length).toBeGreaterThan(0);
		});

		test("records have required properties", () => {
			if (!nameTable) return;

			for (const record of nameTable.records) {
				expect(typeof record.platformId).toBe("number");
				expect(typeof record.encodingId).toBe("number");
				expect(typeof record.languageId).toBe("number");
				expect(typeof record.nameId).toBe("number");
				expect(typeof record.value).toBe("string");
			}
		});

		test("parses synthetic name table with Unicode platform", () => {
			// Create a simple name table with one Unicode record
			// Format 0, count 1, stringOffset 18 (6 bytes header + 12 bytes record)
			const nameString = "Test Font";
			const stringBytes = new Uint8Array(nameString.length * 2);
			for (let i = 0; i < nameString.length; i++) {
				stringBytes[i * 2] = 0;
				stringBytes[i * 2 + 1] = nameString.charCodeAt(i);
			}

			const data = new Uint8Array([
				0x00, 0x00, // format: 0
				0x00, 0x01, // count: 1
				0x00, 0x12, // stringOffset: 18
				// Name record
				0x00, 0x00, // platformId: Unicode (0)
				0x00, 0x03, // encodingId: 3
				0x00, 0x00, // languageId: 0
				0x00, 0x01, // nameId: FontFamily (1)
				0x00, nameString.length * 2, // length
				0x00, 0x00, // offset: 0
				...stringBytes,
			]);

			const reader = new Reader(data.buffer);
			const table = parseName(reader);

			expect(table.format).toBe(0);
			expect(table.records.length).toBe(1);
			expect(table.records[0]!.platformId).toBe(PlatformId.Unicode);
			expect(table.records[0]!.nameId).toBe(NameId.FontFamily);
			expect(table.records[0]!.value).toBe(nameString);
		});

		test("parses synthetic name table with Windows Unicode", () => {
			const nameString = "Arial";
			const stringBytes = new Uint8Array(nameString.length * 2);
			for (let i = 0; i < nameString.length; i++) {
				stringBytes[i * 2] = 0;
				stringBytes[i * 2 + 1] = nameString.charCodeAt(i);
			}

			const data = new Uint8Array([
				0x00, 0x00, // format: 0
				0x00, 0x01, // count: 1
				0x00, 0x12, // stringOffset: 18
				// Name record
				0x00, 0x03, // platformId: Windows (3)
				0x00, 0x01, // encodingId: UnicodeBMP (1)
				0x04, 0x09, // languageId: 0x0409 (en-US)
				0x00, 0x04, // nameId: FullName (4)
				0x00, nameString.length * 2, // length
				0x00, 0x00, // offset: 0
				...stringBytes,
			]);

			const reader = new Reader(data.buffer);
			const table = parseName(reader);

			expect(table.format).toBe(0);
			expect(table.records.length).toBe(1);
			expect(table.records[0]!.platformId).toBe(PlatformId.Windows);
			expect(table.records[0]!.encodingId).toBe(WindowsEncodingId.UnicodeBMP);
			expect(table.records[0]!.value).toBe(nameString);
		});

		test("parses synthetic name table with Windows UnicodeFullRepertoire", () => {
			const nameString = "Test";
			const stringBytes = new Uint8Array(nameString.length * 2);
			for (let i = 0; i < nameString.length; i++) {
				stringBytes[i * 2] = 0;
				stringBytes[i * 2 + 1] = nameString.charCodeAt(i);
			}

			const data = new Uint8Array([
				0x00, 0x00, // format: 0
				0x00, 0x01, // count: 1
				0x00, 0x12, // stringOffset: 18
				// Name record
				0x00, 0x03, // platformId: Windows (3)
				0x00, 0x0a, // encodingId: UnicodeFullRepertoire (10)
				0x00, 0x00, // languageId: 0
				0x00, 0x06, // nameId: PostScriptName (6)
				0x00, nameString.length * 2, // length
				0x00, 0x00, // offset: 0
				...stringBytes,
			]);

			const reader = new Reader(data.buffer);
			const table = parseName(reader);

			expect(table.format).toBe(0);
			expect(table.records.length).toBe(1);
			expect(table.records[0]!.platformId).toBe(PlatformId.Windows);
			expect(table.records[0]!.encodingId).toBe(
				WindowsEncodingId.UnicodeFullRepertoire,
			);
			expect(table.records[0]!.value).toBe(nameString);
		});

		test("parses synthetic name table with Macintosh Roman", () => {
			const nameString = "Mac Font";
			const stringBytes = new Uint8Array(nameString.length);
			for (let i = 0; i < nameString.length; i++) {
				stringBytes[i] = nameString.charCodeAt(i);
			}

			const data = new Uint8Array([
				0x00, 0x00, // format: 0
				0x00, 0x01, // count: 1
				0x00, 0x12, // stringOffset: 18
				// Name record
				0x00, 0x01, // platformId: Macintosh (1)
				0x00, 0x00, // encodingId: Roman (0)
				0x00, 0x00, // languageId: 0
				0x00, 0x01, // nameId: FontFamily (1)
				0x00, nameString.length, // length (single byte per char)
				0x00, 0x00, // offset: 0
				...stringBytes,
			]);

			const reader = new Reader(data.buffer);
			const table = parseName(reader);

			expect(table.format).toBe(0);
			expect(table.records.length).toBe(1);
			expect(table.records[0]!.platformId).toBe(PlatformId.Macintosh);
			expect(table.records[0]!.encodingId).toBe(0);
			expect(table.records[0]!.value).toBe(nameString);
		});

		test("skips unsupported encodings", () => {
			const data = new Uint8Array([
				0x00, 0x00, // format: 0
				0x00, 0x02, // count: 2
				0x00, 0x1e, // stringOffset: 30 (6 + 12*2)
				// Name record 1: Unsupported encoding (Macintosh non-Roman)
				0x00, 0x01, // platformId: Macintosh (1)
				0x00, 0x01, // encodingId: Japanese (1)
				0x00, 0x00, // languageId: 0
				0x00, 0x01, // nameId: FontFamily (1)
				0x00, 0x04, // length
				0x00, 0x00, // offset: 0
				// Name record 2: Windows Unicode (supported)
				0x00, 0x03, // platformId: Windows (3)
				0x00, 0x01, // encodingId: UnicodeBMP (1)
				0x00, 0x00, // languageId: 0
				0x00, 0x01, // nameId: FontFamily (1)
				0x00, 0x08, // length
				0x00, 0x04, // offset: 4
				// String data
				0x00, 0x00, 0x00, 0x00, // Unsupported string (4 bytes)
				0x00, 0x54, 0x00, 0x65, 0x00, 0x73, 0x00, 0x74, // "Test" in UTF-16BE
			]);

			const reader = new Reader(data.buffer);
			const table = parseName(reader);

			expect(table.format).toBe(0);
			// Only the supported encoding should be included
			expect(table.records.length).toBe(1);
			expect(table.records[0]!.value).toBe("Test");
		});

		test("handles multiple records with different platforms", () => {
			const data = new Uint8Array([
				0x00, 0x00, // format: 0
				0x00, 0x03, // count: 3
				0x00, 0x2a, // stringOffset: 42
				// Record 1: Unicode
				0x00, 0x00, // platformId: Unicode
				0x00, 0x03, // encodingId: 3
				0x00, 0x00, // languageId: 0
				0x00, 0x01, // nameId: FontFamily
				0x00, 0x08, // length
				0x00, 0x00, // offset: 0
				// Record 2: Windows
				0x00, 0x03, // platformId: Windows
				0x00, 0x01, // encodingId: UnicodeBMP
				0x04, 0x09, // languageId: en-US
				0x00, 0x02, // nameId: FontSubfamily
				0x00, 0x0e, // length: 14 (7 chars * 2 bytes)
				0x00, 0x08, // offset: 8
				// Record 3: Macintosh
				0x00, 0x01, // platformId: Macintosh
				0x00, 0x00, // encodingId: Roman
				0x00, 0x00, // languageId: 0
				0x00, 0x04, // nameId: FullName
				0x00, 0x04, // length
				0x00, 0x16, // offset: 22
				// String data
				0x00, 0x54, 0x00, 0x65, 0x00, 0x73, 0x00, 0x74, // "Test" UTF-16
				0x00, 0x52, 0x00, 0x65, 0x00, 0x67, 0x00, 0x75, // "Regu" UTF-16
				0x00, 0x6c, 0x00, 0x61, 0x00, 0x72, // "lar" UTF-16
				0x46, 0x6f, 0x6e, 0x74, // "Font" ASCII
			]);

			const reader = new Reader(data.buffer);
			const table = parseName(reader);

			expect(table.format).toBe(0);
			expect(table.records.length).toBe(3);
			expect(table.records[0]!.value).toBe("Test");
			expect(table.records[1]!.value).toBe("Regular");
			expect(table.records[2]!.value).toBe("Font");
		});

		test("handles empty name table", () => {
			const data = new Uint8Array([
				0x00, 0x00, // format: 0
				0x00, 0x00, // count: 0
				0x00, 0x06, // stringOffset: 6
			]);

			const reader = new Reader(data.buffer);
			const table = parseName(reader);

			expect(table.format).toBe(0);
			expect(table.records.length).toBe(0);
		});
	});

	describe("getNameById", () => {
		test("returns name by ID from Arial", () => {
			if (!nameTable) return;

			const familyName = getNameById(nameTable, NameId.FontFamily);
			expect(familyName).not.toBeNull();
			expect(typeof familyName).toBe("string");
		});

		test("prefers Windows Unicode encoding", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Macintosh,
						encodingId: 0,
						languageId: 0,
						nameId: NameId.FontFamily,
						value: "Mac Font",
					},
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.FontFamily,
						value: "Windows Font",
					},
					{
						platformId: PlatformId.Unicode,
						encodingId: 3,
						languageId: 0,
						nameId: NameId.FontFamily,
						value: "Unicode Font",
					},
				],
			};

			const name = getNameById(table, NameId.FontFamily);
			expect(name).toBe("Windows Font");
		});

		test("falls back to Unicode platform when Windows not available", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Macintosh,
						encodingId: 0,
						languageId: 0,
						nameId: NameId.FontFamily,
						value: "Mac Font",
					},
					{
						platformId: PlatformId.Unicode,
						encodingId: 3,
						languageId: 0,
						nameId: NameId.FontFamily,
						value: "Unicode Font",
					},
				],
			};

			const name = getNameById(table, NameId.FontFamily);
			expect(name).toBe("Unicode Font");
		});

		test("falls back to any platform when Windows and Unicode not available", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Macintosh,
						encodingId: 0,
						languageId: 0,
						nameId: NameId.FontFamily,
						value: "Mac Font",
					},
				],
			};

			const name = getNameById(table, NameId.FontFamily);
			expect(name).toBe("Mac Font");
		});

		test("returns null when name ID not found", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.FontFamily,
						value: "Test",
					},
				],
			};

			const name = getNameById(table, NameId.Designer);
			expect(name).toBeNull();
		});

		test("respects language ID when specified", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409, // en-US
						nameId: NameId.FontFamily,
						value: "English Font",
					},
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x040c, // fr-FR
						nameId: NameId.FontFamily,
						value: "French Font",
					},
				],
			};

			const enName = getNameById(table, NameId.FontFamily, 0x0409);
			expect(enName).toBe("English Font");

			const frName = getNameById(table, NameId.FontFamily, 0x040c);
			expect(frName).toBe("French Font");
		});

		test("falls back through platforms when language ID specified", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Unicode,
						encodingId: 3,
						languageId: 0x0409,
						nameId: NameId.FontFamily,
						value: "Unicode Font",
					},
					{
						platformId: PlatformId.Macintosh,
						encodingId: 0,
						languageId: 0x0409,
						nameId: NameId.FontFamily,
						value: "Mac Font",
					},
				],
			};

			// Should fall back to Unicode, then to any platform
			const name = getNameById(table, NameId.FontFamily, 0x0409);
			expect(name).toBe("Unicode Font");
		});

		test("returns null when language ID specified but not found", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409, // en-US
						nameId: NameId.FontFamily,
						value: "English Font",
					},
				],
			};

			const name = getNameById(table, NameId.FontFamily, 0x040c); // fr-FR
			expect(name).toBeNull();
		});

		test("handles multiple name IDs", () => {
			if (!nameTable) return;

			const ids = [
				NameId.FontFamily,
				NameId.FontSubfamily,
				NameId.FullName,
				NameId.Version,
				NameId.PostScriptName,
			];

			for (const id of ids) {
				const name = getNameById(nameTable, id);
				expect(name === null || typeof name === "string").toBe(true);
			}
		});
	});

	describe("getFontFamily", () => {
		test("returns font family from Arial", () => {
			if (!nameTable) return;

			const family = getFontFamily(nameTable);
			expect(family).not.toBeNull();
			expect(typeof family).toBe("string");
		});

		test("prefers typographic family over basic family", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.FontFamily,
						value: "Basic Family",
					},
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.TypographicFamily,
						value: "Typographic Family",
					},
				],
			};

			const family = getFontFamily(table);
			expect(family).toBe("Typographic Family");
		});

		test("falls back to basic family when typographic not available", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.FontFamily,
						value: "Basic Family",
					},
				],
			};

			const family = getFontFamily(table);
			expect(family).toBe("Basic Family");
		});

		test("returns null when neither family available", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.FullName,
						value: "Some Font",
					},
				],
			};

			const family = getFontFamily(table);
			expect(family).toBeNull();
		});
	});

	describe("getFontSubfamily", () => {
		test("returns font subfamily from Arial", () => {
			if (!nameTable) return;

			const subfamily = getFontSubfamily(nameTable);
			expect(subfamily).not.toBeNull();
			expect(typeof subfamily).toBe("string");
		});

		test("prefers typographic subfamily over basic subfamily", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.FontSubfamily,
						value: "Regular",
					},
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.TypographicSubfamily,
						value: "Light Italic",
					},
				],
			};

			const subfamily = getFontSubfamily(table);
			expect(subfamily).toBe("Light Italic");
		});

		test("falls back to basic subfamily when typographic not available", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.FontSubfamily,
						value: "Bold",
					},
				],
			};

			const subfamily = getFontSubfamily(table);
			expect(subfamily).toBe("Bold");
		});

		test("returns null when neither subfamily available", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.FontFamily,
						value: "Some Font",
					},
				],
			};

			const subfamily = getFontSubfamily(table);
			expect(subfamily).toBeNull();
		});
	});

	describe("getFullName", () => {
		test("returns full name from Arial", () => {
			if (!nameTable) return;

			const fullName = getFullName(nameTable);
			expect(fullName).not.toBeNull();
			expect(typeof fullName).toBe("string");
		});

		test("returns full name when available", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.FullName,
						value: "Arial Bold",
					},
				],
			};

			const fullName = getFullName(table);
			expect(fullName).toBe("Arial Bold");
		});

		test("returns null when full name not available", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.FontFamily,
						value: "Arial",
					},
				],
			};

			const fullName = getFullName(table);
			expect(fullName).toBeNull();
		});
	});

	describe("getPostScriptName", () => {
		test("returns PostScript name from Arial", () => {
			if (!nameTable) return;

			const psName = getPostScriptName(nameTable);
			expect(psName).not.toBeNull();
			expect(typeof psName).toBe("string");
		});

		test("returns PostScript name when available", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.PostScriptName,
						value: "ArialMT",
					},
				],
			};

			const psName = getPostScriptName(table);
			expect(psName).toBe("ArialMT");
		});

		test("returns null when PostScript name not available", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.FontFamily,
						value: "Arial",
					},
				],
			};

			const psName = getPostScriptName(table);
			expect(psName).toBeNull();
		});
	});

	describe("getVersion", () => {
		test("returns version from Arial", () => {
			if (!nameTable) return;

			const version = getVersion(nameTable);
			expect(version === null || typeof version === "string").toBe(true);
		});

		test("returns version when available", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.Version,
						value: "Version 1.0",
					},
				],
			};

			const version = getVersion(table);
			expect(version).toBe("Version 1.0");
		});

		test("returns null when version not available", () => {
			const table: NameTable = {
				format: 0,
				records: [
					{
						platformId: PlatformId.Windows,
						encodingId: WindowsEncodingId.UnicodeBMP,
						languageId: 0x0409,
						nameId: NameId.FontFamily,
						value: "Arial",
					},
				],
			};

			const version = getVersion(table);
			expect(version).toBeNull();
		});
	});

	describe("NameId constants", () => {
		test("has correct values", () => {
			expect(NameId.Copyright).toBe(0);
			expect(NameId.FontFamily).toBe(1);
			expect(NameId.FontSubfamily).toBe(2);
			expect(NameId.UniqueID).toBe(3);
			expect(NameId.FullName).toBe(4);
			expect(NameId.Version).toBe(5);
			expect(NameId.PostScriptName).toBe(6);
			expect(NameId.Trademark).toBe(7);
			expect(NameId.Manufacturer).toBe(8);
			expect(NameId.Designer).toBe(9);
			expect(NameId.Description).toBe(10);
			expect(NameId.TypographicFamily).toBe(16);
			expect(NameId.TypographicSubfamily).toBe(17);
		});
	});

	describe("PlatformId constants", () => {
		test("has correct values", () => {
			expect(PlatformId.Unicode).toBe(0);
			expect(PlatformId.Macintosh).toBe(1);
			expect(PlatformId.Reserved).toBe(2);
			expect(PlatformId.Windows).toBe(3);
		});
	});

	describe("WindowsEncodingId constants", () => {
		test("has correct values", () => {
			expect(WindowsEncodingId.Symbol).toBe(0);
			expect(WindowsEncodingId.UnicodeBMP).toBe(1);
			expect(WindowsEncodingId.ShiftJIS).toBe(2);
			expect(WindowsEncodingId.PRC).toBe(3);
			expect(WindowsEncodingId.Big5).toBe(4);
			expect(WindowsEncodingId.Wansung).toBe(5);
			expect(WindowsEncodingId.Johab).toBe(6);
			expect(WindowsEncodingId.UnicodeFullRepertoire).toBe(10);
		});
	});

	describe("integration tests", () => {
		test("Arial has expected name records", () => {
			if (!nameTable) return;

			const family = getFontFamily(nameTable);
			const subfamily = getFontSubfamily(nameTable);
			const fullName = getFullName(nameTable);
			const psName = getPostScriptName(nameTable);

			expect(family).not.toBeNull();
			expect(subfamily).not.toBeNull();
			expect(fullName).not.toBeNull();
			expect(psName).not.toBeNull();
		});

		test("can extract all common name IDs", () => {
			if (!nameTable) return;

			const commonIds = [
				NameId.Copyright,
				NameId.FontFamily,
				NameId.FontSubfamily,
				NameId.FullName,
				NameId.Version,
				NameId.PostScriptName,
			];

			for (const id of commonIds) {
				const name = getNameById(nameTable, id);
				if (name !== null) {
					expect(typeof name).toBe("string");
					expect(name.length).toBeGreaterThan(0);
				}
			}
		});

		test("name records have consistent platform distribution", () => {
			if (!nameTable) return;

			const platforms = new Set<number>();
			for (const record of nameTable.records) {
				platforms.add(record.platformId);
			}

			expect(platforms.size).toBeGreaterThan(0);
			expect(platforms.size).toBeLessThanOrEqual(4); // Max 4 platforms
		});
	});
});
