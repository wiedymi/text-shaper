import type { uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/** Name IDs */
export const NameId = {
	Copyright: 0,
	FontFamily: 1,
	FontSubfamily: 2,
	UniqueID: 3,
	FullName: 4,
	Version: 5,
	PostScriptName: 6,
	Trademark: 7,
	Manufacturer: 8,
	Designer: 9,
	Description: 10,
	ManufacturerURL: 11,
	DesignerURL: 12,
	License: 13,
	LicenseURL: 14,
	Reserved: 15,
	TypographicFamily: 16,
	TypographicSubfamily: 17,
	CompatibleFullName: 18,
	SampleText: 19,
	PostScriptCIDFindfontName: 20,
	WWSFamily: 21,
	WWSSubfamily: 22,
	LightBackgroundPalette: 23,
	DarkBackgroundPalette: 24,
	VariationsPostScriptNamePrefix: 25,
} as const;

/** Platform IDs */
export const PlatformId = {
	Unicode: 0,
	Macintosh: 1,
	Reserved: 2,
	Windows: 3,
} as const;

/** Windows encoding IDs */
export const WindowsEncodingId = {
	Symbol: 0,
	UnicodeBMP: 1,
	ShiftJIS: 2,
	PRC: 3,
	Big5: 4,
	Wansung: 5,
	Johab: 6,
	UnicodeFullRepertoire: 10,
} as const;

/** A single name record */
export interface NameRecord {
	platformId: uint16;
	encodingId: uint16;
	languageId: uint16;
	nameId: uint16;
	value: string;
}

/** Name table */
export interface NameTable {
	format: uint16;
	records: NameRecord[];
}

export function parseName(reader: Reader): NameTable {
	const format = reader.uint16();
	const count = reader.uint16();
	const stringOffset = reader.uint16();

	const records: NameRecord[] = [];

	// Parse name records
	const recordData: Array<{
		platformId: uint16;
		encodingId: uint16;
		languageId: uint16;
		nameId: uint16;
		length: uint16;
		offset: uint16;
	}> = [];

	for (let i = 0; i < count; i++) {
		recordData.push({
			platformId: reader.uint16(),
			encodingId: reader.uint16(),
			languageId: reader.uint16(),
			nameId: reader.uint16(),
			length: reader.uint16(),
			offset: reader.uint16(),
		});
	}

	// Decode strings
	for (const rd of recordData) {
		const strReader = reader.sliceFrom(stringOffset + rd.offset);
		const value = decodeNameString(strReader, rd.length, rd.platformId, rd.encodingId);

		if (value !== null) {
			records.push({
				platformId: rd.platformId,
				encodingId: rd.encodingId,
				languageId: rd.languageId,
				nameId: rd.nameId,
				value,
			});
		}
	}

	return { format, records };
}

/** Decode name string based on platform and encoding */
function decodeNameString(
	reader: Reader,
	length: number,
	platformId: number,
	encodingId: number,
): string | null {
	// Unicode platform or Windows platform with Unicode encoding
	if (platformId === PlatformId.Unicode ||
		(platformId === PlatformId.Windows && (encodingId === 1 || encodingId === 10))) {
		// UTF-16BE
		const chars: string[] = [];
		for (let i = 0; i < length; i += 2) {
			const code = reader.uint16();
			chars.push(String.fromCharCode(code));
		}
		return chars.join("");
	}

	// Macintosh Roman (basic ASCII-compatible)
	if (platformId === PlatformId.Macintosh && encodingId === 0) {
		const bytes: number[] = [];
		for (let i = 0; i < length; i++) {
			bytes.push(reader.uint8());
		}
		// Simple ASCII decoding for Mac Roman (limited support)
		return String.fromCharCode(...bytes);
	}

	// Skip unsupported encodings
	return null;
}

/** Get a specific name by ID, preferring Windows Unicode */
export function getNameById(table: NameTable, nameId: number, languageId?: number): string | null {
	// Prefer Windows Unicode (platform 3, encoding 1)
	for (const record of table.records) {
		if (record.nameId !== nameId) continue;
		if (record.platformId === PlatformId.Windows && record.encodingId === 1) {
			if (languageId === undefined || record.languageId === languageId) {
				return record.value;
			}
		}
	}

	// Fallback to Unicode platform
	for (const record of table.records) {
		if (record.nameId !== nameId) continue;
		if (record.platformId === PlatformId.Unicode) {
			if (languageId === undefined || record.languageId === languageId) {
				return record.value;
			}
		}
	}

	// Fallback to any platform
	for (const record of table.records) {
		if (record.nameId !== nameId) continue;
		if (languageId === undefined || record.languageId === languageId) {
			return record.value;
		}
	}

	return null;
}

/** Get font family name */
export function getFontFamily(table: NameTable): string | null {
	// Prefer typographic family (16) over basic family (1)
	return getNameById(table, NameId.TypographicFamily) ??
		getNameById(table, NameId.FontFamily);
}

/** Get font subfamily (style) */
export function getFontSubfamily(table: NameTable): string | null {
	return getNameById(table, NameId.TypographicSubfamily) ??
		getNameById(table, NameId.FontSubfamily);
}

/** Get full font name */
export function getFullName(table: NameTable): string | null {
	return getNameById(table, NameId.FullName);
}

/** Get PostScript name */
export function getPostScriptName(table: NameTable): string | null {
	return getNameById(table, NameId.PostScriptName);
}

/** Get version string */
export function getVersion(table: NameTable): string | null {
	return getNameById(table, NameId.Version);
}
