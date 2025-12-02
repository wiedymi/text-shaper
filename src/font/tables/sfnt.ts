import type { TableRecord, Tag } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/** Supported sfnt version tags */
const SFNT_VERSION_TRUETYPE = 0x00010000; // TrueType
const SFNT_VERSION_OPENTYPE = 0x4f54544f; // 'OTTO' - CFF
const SFNT_VERSION_TRUE = 0x74727565; // 'true' - Apple TrueType

/** Font directory containing table records */
export interface FontDirectory {
	sfntVersion: number;
	numTables: number;
	searchRange: number;
	entrySelector: number;
	rangeShift: number;
	tables: Map<Tag, TableRecord>;
}

/**
 * Parse the sfnt font directory (table of contents).
 * This is the first thing read from any TrueType/OpenType font.
 */
export function parseFontDirectory(reader: Reader): FontDirectory {
	const sfntVersion = reader.uint32();

	// Validate sfnt version
	if (
		sfntVersion !== SFNT_VERSION_TRUETYPE &&
		sfntVersion !== SFNT_VERSION_OPENTYPE &&
		sfntVersion !== SFNT_VERSION_TRUE
	) {
		throw new Error(
			`Invalid sfnt version: 0x${sfntVersion.toString(16).padStart(8, "0")}`,
		);
	}

	const numTables = reader.uint16();
	const searchRange = reader.uint16();
	const entrySelector = reader.uint16();
	const rangeShift = reader.uint16();

	const tables = new Map<Tag, TableRecord>();

	for (let i = 0; i < numTables; i++) {
		const tag = reader.tag();
		const checksum = reader.uint32();
		const offset = reader.uint32();
		const length = reader.uint32();

		tables.set(tag, { tag, checksum, offset, length });
	}

	return {
		sfntVersion,
		numTables,
		searchRange,
		entrySelector,
		rangeShift,
		tables,
	};
}

/** Check if this is a TrueType font (vs CFF) */
export function isTrueType(directory: FontDirectory): boolean {
	return (
		directory.sfntVersion === SFNT_VERSION_TRUETYPE ||
		directory.sfntVersion === SFNT_VERSION_TRUE
	);
}

/** Check if this is a CFF font */
export function isCFF(directory: FontDirectory): boolean {
	return directory.sfntVersion === SFNT_VERSION_OPENTYPE;
}
