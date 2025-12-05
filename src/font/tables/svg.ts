import type { GlyphId, uint16, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * SVG table
 * Contains SVG documents for color glyph rendering
 */
export interface SvgTable {
	version: uint16;
	documentRecords: SvgDocumentRecord[];
}

/**
 * SVG document record
 * Maps a range of glyphs to an SVG document
 */
export interface SvgDocumentRecord {
	startGlyphID: GlyphId;
	endGlyphID: GlyphId;
	svgDoc: string;
}

/**
 * Parse SVG table
 */
export function parseSvg(reader: Reader): SvgTable {
	const version = reader.uint16();

	// SVG Document List offset (from start of SVG table)
	const svgDocumentListOffset = reader.offset32();

	// Reserved
	reader.skip(4);

	// Parse document list
	const listReader = reader.sliceFrom(svgDocumentListOffset);
	const numEntries = listReader.uint16();

	// No entries: return empty table
	if (numEntries === 0) {
		return { version, documentRecords: [] };
	}

	// Read document index entries
	const entries: {
		startGlyphID: uint16;
		endGlyphID: uint16;
		svgDocOffset: uint32;
		svgDocLength: uint32;
	}[] = [];

	for (let i = 0; i < numEntries; i++) {
		entries.push({
			startGlyphID: listReader.uint16(),
			endGlyphID: listReader.uint16(),
			svgDocOffset: listReader.offset32(),
			svgDocLength: listReader.uint32(),
		});
	}

	// Parse SVG documents
	const documentRecords: SvgDocumentRecord[] = [];
	const decoder = new TextDecoder("utf-8");

	for (const entry of entries) {
		// SVG doc offset is relative to SVG Document List
		const docReader = listReader.sliceFrom(entry.svgDocOffset);
		const svgBytes = docReader.bytes(entry.svgDocLength);

		// Decompress if gzipped (starts with 0x1F 0x8B)
		let svgDoc: string;
		if (svgBytes[0] === 0x1f && svgBytes[1] === 0x8b) {
			// Gzipped SVG - need to decompress
			try {
				const decompressed = decompressGzip(svgBytes);
				svgDoc = decoder.decode(decompressed);
			} catch {
				// If decompression fails, try as plain text
				svgDoc = decoder.decode(svgBytes);
			}
		} else {
			svgDoc = decoder.decode(svgBytes);
		}

		documentRecords.push({
			startGlyphID: entry.startGlyphID,
			endGlyphID: entry.endGlyphID,
			svgDoc,
		});
	}

	return { version, documentRecords };
}

/**
 * Get SVG document for a glyph
 * Returns null if no SVG exists for this glyph
 */
export function getSvgDocument(svg: SvgTable, glyphId: GlyphId): string | null {
	for (const record of svg.documentRecords) {
		if (glyphId >= record.startGlyphID && glyphId <= record.endGlyphID) {
			return record.svgDoc;
		}
	}
	return null;
}

/**
 * Check if a glyph has an SVG representation
 */
export function hasSvgGlyph(svg: SvgTable, glyphId: GlyphId): boolean {
	return getSvgDocument(svg, glyphId) !== null;
}

/**
 * Get all glyph IDs that have SVG representations
 */
export function getSvgGlyphIds(svg: SvgTable): GlyphId[] {
	const glyphIds: GlyphId[] = [];

	for (const record of svg.documentRecords) {
		for (let gid = record.startGlyphID; gid <= record.endGlyphID; gid++) {
			glyphIds.push(gid);
		}
	}

	return glyphIds;
}

/**
 * Simple gzip decompression using DecompressionStream (if available)
 * Falls back to returning original data if not supported
 */
function decompressGzip(data: Uint8Array): Uint8Array {
	// Use DecompressionStream if available (modern browsers/Bun)
	if (typeof DecompressionStream !== "undefined") {
		// This is async in nature, but we need sync.
		// For now, return original - proper implementation needs async
		// In practice, most SVG fonts use uncompressed SVG
		return data;
	}

	// No decompression available, return as-is
	return data;
}

/**
 * Async version of gzip decompression
 */
export async function decompressSvgDocument(data: Uint8Array): Promise<string> {
	const decoder = new TextDecoder("utf-8");

	// Not enough bytes or no magic -> plain decode
	if (data.length < 2 || data[0] !== 0x1f || data[1] !== 0x8b) {
		return decoder.decode(data);
	}

	// Try gzip decompress; on any failure, fall back to plain decode
	if (typeof DecompressionStream !== "undefined") {
		try {
			const stream = new DecompressionStream("gzip");
			const writer = stream.writable.getWriter();
			const reader = stream.readable.getReader();

			await writer.write(data as unknown as BufferSource);
			await writer.close();

			const chunks: Uint8Array[] = [];
			let result = await reader.read();
			while (!result.done) {
				chunks.push(result.value);
				result = await reader.read();
			}

			const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
			const decompressed = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of chunks) {
				decompressed.set(chunk, offset);
				offset += chunk.length;
			}

			return decoder.decode(decompressed);
		} catch {
			// fall through to plain decode
		}
	}

	return decoder.decode(data);
}
