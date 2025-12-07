import type { GlyphId, int8, uint8, uint16, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * Color Bitmap Data Table (CBDT)
 * Google's color bitmap table for emoji fonts
 * Used together with CBLC (Color Bitmap Location Table)
 */
export interface CbdtTable {
	majorVersion: uint16;
	minorVersion: uint16;
	/** Raw data for bitmap lookup */
	data: Uint8Array;
}

/**
 * Color Bitmap Location Table (CBLC)
 * Index for looking up bitmaps in CBDT
 */
export interface CblcTable {
	majorVersion: uint16;
	minorVersion: uint16;
	bitmapSizes: BitmapSize[];
}

/**
 * Bitmap size record
 */
export interface BitmapSize {
	indexSubTableArrayOffset: uint32;
	indexTablesSize: uint32;
	numberOfIndexSubTables: uint32;
	colorRef: uint32;
	hori: SbitLineMetrics;
	vert: SbitLineMetrics;
	startGlyphIndex: GlyphId;
	endGlyphIndex: GlyphId;
	ppemX: uint8;
	ppemY: uint8;
	bitDepth: uint8;
	flags: int8;
	indexSubTables: IndexSubTable[];
}

/**
 * Line metrics for bitmap glyphs
 */
export interface SbitLineMetrics {
	ascender: int8;
	descender: int8;
	widthMax: uint8;
	caretSlopeNumerator: int8;
	caretSlopeDenominator: int8;
	caretOffset: int8;
	minOriginSB: int8;
	minAdvanceSB: int8;
	maxBeforeBL: int8;
	minAfterBL: int8;
	pad1: int8;
	pad2: int8;
}

/**
 * Index sub-table for glyph lookup
 */
export interface IndexSubTable {
	firstGlyphIndex: GlyphId;
	lastGlyphIndex: GlyphId;
	indexFormat: uint16;
	imageFormat: uint16;
	imageDataOffset: uint32;
	/** Glyph offsets (format-dependent) */
	glyphOffsets: Map<GlyphId, { offset: uint32; length: uint32 }>;
}

/**
 * Bitmap glyph metrics
 */
export interface GlyphBitmapMetrics {
	height: uint8;
	width: uint8;
	bearingX: int8;
	bearingY: int8;
	advance: uint8;
}

/**
 * Bitmap glyph data
 */
export interface BitmapGlyph {
	metrics: GlyphBitmapMetrics;
	imageFormat: uint16;
	data: Uint8Array;
}

/**
 * Image formats in CBDT
 */
export const CbdtImageFormat = {
	SmallMetrics: 1, // Small metrics, byte-aligned
	SmallMetricsPng: 17, // Small metrics + PNG
	BigMetrics: 2, // Big metrics, byte-aligned
	BigMetricsPng: 18, // Big metrics + PNG
	CompressedPng: 19, // Metrics in CBLC + PNG
} as const;

/**
 * Parse CBLC table
 */
export function parseCblc(reader: Reader): CblcTable {
	const tableStart = reader.offset;
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	const numSizes = reader.uint32();

	const bitmapSizes: BitmapSize[] = [];

	// Read BitmapSize records
	for (let i = 0; i < numSizes; i++) {
		const indexSubTableArrayOffset = reader.uint32();
		const indexTablesSize = reader.uint32();
		const numberOfIndexSubTables = reader.uint32();
		const colorRef = reader.uint32();

		const hori = parseSbitLineMetrics(reader);
		const vert = parseSbitLineMetrics(reader);

		const startGlyphIndex = reader.uint16();
		const endGlyphIndex = reader.uint16();
		const ppemX = reader.uint8();
		const ppemY = reader.uint8();
		const bitDepth = reader.uint8();
		const flags = reader.int8();

		bitmapSizes.push({
			indexSubTableArrayOffset,
			indexTablesSize,
			numberOfIndexSubTables,
			colorRef,
			hori,
			vert,
			startGlyphIndex,
			endGlyphIndex,
			ppemX,
			ppemY,
			bitDepth,
			flags,
			indexSubTables: [],
		});
	}

	// Parse index sub-tables for each bitmap size
	for (let i = 0; i < bitmapSizes.length; i++) {
		const size = bitmapSizes[i]!;
		const subTableReader = reader.sliceFrom(
			tableStart + size.indexSubTableArrayOffset,
		);

		// Read IndexSubTableArray
		const subTableHeaders: {
			firstGlyphIndex: uint16;
			lastGlyphIndex: uint16;
			additionalOffsetToIndexSubtable: uint32;
		}[] = [];

		for (let j = 0; j < size.numberOfIndexSubTables; j++) {
			subTableHeaders.push({
				firstGlyphIndex: subTableReader.uint16(),
				lastGlyphIndex: subTableReader.uint16(),
				additionalOffsetToIndexSubtable: subTableReader.uint32(),
			});
		}

		// Parse each index sub-table
		for (let j = 0; j < subTableHeaders.length; j++) {
			const header = subTableHeaders[j]!;
			const indexSubTable = parseIndexSubTable(
				reader,
				tableStart +
					size.indexSubTableArrayOffset +
					header.additionalOffsetToIndexSubtable,
				header.firstGlyphIndex,
				header.lastGlyphIndex,
			);
			size.indexSubTables.push(indexSubTable);
		}
	}

	return { majorVersion, minorVersion, bitmapSizes };
}

function parseSbitLineMetrics(reader: Reader): SbitLineMetrics {
	return {
		ascender: reader.int8(),
		descender: reader.int8(),
		widthMax: reader.uint8(),
		caretSlopeNumerator: reader.int8(),
		caretSlopeDenominator: reader.int8(),
		caretOffset: reader.int8(),
		minOriginSB: reader.int8(),
		minAdvanceSB: reader.int8(),
		maxBeforeBL: reader.int8(),
		minAfterBL: reader.int8(),
		pad1: reader.int8(),
		pad2: reader.int8(),
	};
}

function parseIndexSubTable(
	reader: Reader,
	offset: number,
	firstGlyph: GlyphId,
	lastGlyph: GlyphId,
): IndexSubTable {
	const subReader = reader.sliceFrom(offset);
	const indexFormat = subReader.uint16();
	const imageFormat = subReader.uint16();
	const imageDataOffset = subReader.uint32();

	const glyphOffsets = new Map<GlyphId, { offset: uint32; length: uint32 }>();
	const numGlyphs = lastGlyph - firstGlyph + 1;

	switch (indexFormat) {
		case 1: {
			// Variable metrics, 4-byte offsets
			const offsets: uint32[] = [];
			for (let i = 0; i <= numGlyphs; i++) {
				offsets.push(subReader.uint32());
			}
			for (let i = 0; i < numGlyphs; i++) {
				const glyphOffset = offsets[i];
				const nextOffset = offsets[i + 1];
				if (glyphOffset === undefined || nextOffset === undefined) continue;
				if (nextOffset > glyphOffset) {
					glyphOffsets.set(firstGlyph + i, {
						offset: imageDataOffset + glyphOffset,
						length: nextOffset - glyphOffset,
					});
				}
			}
			break;
		}
		case 2: {
			// Constant image size
			const imageSize = subReader.uint32();
			// Big metrics follow
			const _bigMetrics = {
				height: subReader.uint8(),
				width: subReader.uint8(),
				horiBearingX: subReader.int8(),
				horiBearingY: subReader.int8(),
				horiAdvance: subReader.uint8(),
				vertBearingX: subReader.int8(),
				vertBearingY: subReader.int8(),
				vertAdvance: subReader.uint8(),
			};
			for (let i = 0; i < numGlyphs; i++) {
				glyphOffsets.set(firstGlyph + i, {
					offset: imageDataOffset + i * imageSize,
					length: imageSize,
				});
			}
			break;
		}
		case 3: {
			// Variable metrics, 2-byte offsets
			const offsets: uint16[] = [];
			for (let i = 0; i <= numGlyphs; i++) {
				offsets.push(subReader.uint16());
			}
			for (let i = 0; i < numGlyphs; i++) {
				const glyphOffset = offsets[i];
				const nextOffset = offsets[i + 1];
				if (glyphOffset === undefined || nextOffset === undefined) continue;
				if (nextOffset > glyphOffset) {
					glyphOffsets.set(firstGlyph + i, {
						offset: imageDataOffset + glyphOffset,
						length: nextOffset - glyphOffset,
					});
				}
			}
			break;
		}
		case 4: {
			// Sparse glyph array
			const numGlyphsActual = subReader.uint32();
			const glyphArray: { glyphId: uint16; offset: uint16 }[] = [];
			for (let i = 0; i <= numGlyphsActual; i++) {
				glyphArray.push({
					glyphId: subReader.uint16(),
					offset: subReader.uint16(),
				});
			}
			for (let i = 0; i < numGlyphsActual; i++) {
				const entry = glyphArray[i];
				const nextEntry = glyphArray[i + 1];
				if (entry === undefined || nextEntry === undefined) continue;
				glyphOffsets.set(entry.glyphId, {
					offset: imageDataOffset + entry.offset,
					length: nextEntry.offset - entry.offset,
				});
			}
			break;
		}
		case 5: {
			// Constant metrics, sparse glyph array
			const imageSize = subReader.uint32();
			// Big metrics
			subReader.skip(8);
			const numGlyphsActual = subReader.uint32();
			for (let i = 0; i < numGlyphsActual; i++) {
				const glyphId = subReader.uint16();
				glyphOffsets.set(glyphId, {
					offset: imageDataOffset + i * imageSize,
					length: imageSize,
				});
			}
			break;
		}
	}

	return {
		firstGlyphIndex: firstGlyph,
		lastGlyphIndex: lastGlyph,
		indexFormat,
		imageFormat,
		imageDataOffset,
		glyphOffsets,
	};
}

/**
 * Parse CBDT table
 */
export function parseCbdt(reader: Reader): CbdtTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();

	// Store raw data for later lookup
	const data = reader.bytes(reader.remaining);

	return { majorVersion, minorVersion, data };
}

/**
 * Get bitmap glyph from CBDT using CBLC index
 */
export function getBitmapGlyph(
	cblc: CblcTable,
	cbdt: CbdtTable,
	glyphId: GlyphId,
	ppem: number,
): BitmapGlyph | null {
	// Find matching bitmap size
	let bestSize: BitmapSize | null = null;
	let bestDiff = Infinity;

	for (let i = 0; i < cblc.bitmapSizes.length; i++) {
		const size = cblc.bitmapSizes[i]!;
		if (glyphId < size.startGlyphIndex || glyphId > size.endGlyphIndex) {
			continue;
		}
		const diff = Math.abs(size.ppemX - ppem);
		if (diff < bestDiff) {
			bestDiff = diff;
			bestSize = size;
		}
	}

	if (!bestSize) return null;

	// Find glyph in index sub-tables
	for (let i = 0; i < bestSize.indexSubTables.length; i++) {
		const subTable = bestSize.indexSubTables[i]!;
		const glyphInfo = subTable.glyphOffsets.get(glyphId);
		if (!glyphInfo) continue;

		// Read glyph data from CBDT
		const glyphData = cbdt.data.slice(
			glyphInfo.offset - 4, // Adjust for CBDT header
			glyphInfo.offset - 4 + glyphInfo.length,
		);

		return parseGlyphData(glyphData, subTable.imageFormat);
	}

	return null;
}

function parseGlyphData(
	data: Uint8Array,
	imageFormat: uint16,
): BitmapGlyph | null {
	if (data.length === 0) return null;

	let offset = 0;
	let metrics: GlyphBitmapMetrics;

	switch (imageFormat) {
		case 1:
		case 2:
		case 17:
		case 18: {
			// Small or big metrics embedded
			if (imageFormat === 1 || imageFormat === 17) {
				// Small metrics (5 bytes)
				if (offset + 5 > data.length) return null;
				metrics = {
					height: data[offset++] ?? 0,
					width: data[offset++] ?? 0,
					bearingX: ((data[offset++] ?? 0) << 24) >> 24, // Sign extend
					bearingY: ((data[offset++] ?? 0) << 24) >> 24,
					advance: data[offset++] ?? 0,
				};
			} else {
				// Big metrics (8 bytes)
				if (offset + 8 > data.length) return null;
				metrics = {
					height: data[offset++] ?? 0,
					width: data[offset++] ?? 0,
					bearingX: ((data[offset++] ?? 0) << 24) >> 24,
					bearingY: ((data[offset++] ?? 0) << 24) >> 24,
					advance: data[offset++] ?? 0,
				};
				offset += 3; // Skip vertical metrics
			}
			break;
		}
		case 19: {
			// Metrics in CBLC, just PNG data
			metrics = { height: 0, width: 0, bearingX: 0, bearingY: 0, advance: 0 };
			break;
		}
		default:
			return null;
	}

	return {
		metrics,
		imageFormat,
		data: data.slice(offset),
	};
}

/**
 * Check if glyph has color bitmap
 */
export function hasColorBitmap(
	cblc: CblcTable,
	glyphId: GlyphId,
	ppem?: number,
): boolean {
	for (let i = 0; i < cblc.bitmapSizes.length; i++) {
		const size = cblc.bitmapSizes[i]!;
		if (ppem !== undefined && size.ppemX !== ppem) continue;
		if (glyphId < size.startGlyphIndex || glyphId > size.endGlyphIndex) {
			continue;
		}
		for (let j = 0; j < size.indexSubTables.length; j++) {
			const subTable = size.indexSubTables[j]!;
			if (subTable.glyphOffsets.has(glyphId)) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Get available ppem sizes for color bitmaps
 */
export function getColorBitmapSizes(cblc: CblcTable): number[] {
	const sizes = new Set<number>();
	for (let i = 0; i < cblc.bitmapSizes.length; i++) {
		const size = cblc.bitmapSizes[i]!;
		sizes.add(size.ppemX);
	}
	return Array.from(sizes).sort((a, b) => a - b);
}
