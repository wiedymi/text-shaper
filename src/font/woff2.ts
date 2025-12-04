/**
 * WOFF2 to SFNT Converter
 *
 * Converts WOFF2 compressed fonts back to raw TTF/OTF format.
 * Reference: https://www.w3.org/TR/WOFF2/
 */

// Known table tags indexed by flag value 0-62
const KNOWN_TAGS = [
	"cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post",
	"cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT",
	"EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea",
	"vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH",
	"CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar",
	"bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar",
	"gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop",
	"trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
];

interface Woff2TableEntry {
	tag: string;
	origLength: number;
	transformLength: number;
	transformVersion: number;
}

/** Read UIntBase128 variable-length integer */
function readUIntBase128(data: Uint8Array, offset: { value: number }): number {
	let result = 0;
	for (let i = 0; i < 5; i++) {
		const byte = data[offset.value++];
		if (i === 0 && byte === 0x80) {
			throw new Error("Invalid UIntBase128: leading zeros");
		}
		if (result > 0x1fffff) {
			throw new Error("UIntBase128 overflow");
		}
		result = (result << 7) | (byte & 0x7f);
		if ((byte & 0x80) === 0) {
			return result;
		}
	}
	throw new Error("UIntBase128 too long");
}

/** Read 255UInt16 */
function read255UInt16(data: Uint8Array, offset: { value: number }): number {
	const code = data[offset.value++];
	if (code === 253) {
		const hi = data[offset.value++];
		const lo = data[offset.value++];
		return (hi << 8) | lo;
	} else if (code === 255) {
		return data[offset.value++] + 253 * 2;
	} else if (code === 254) {
		return data[offset.value++] + 253;
	}
	return code;
}

/** Parse WOFF2 table directory entries */
function parseTableDirectory(data: Uint8Array, offset: { value: number }, numTables: number): Woff2TableEntry[] {
	const tables: Woff2TableEntry[] = [];

	for (let i = 0; i < numTables; i++) {
		const flags = data[offset.value++];
		const tagIndex = flags & 0x3f;
		const transformVersion = (flags >> 6) & 0x03;

		let tag: string;
		if (tagIndex === 63) {
			tag = String.fromCharCode(
				data[offset.value++],
				data[offset.value++],
				data[offset.value++],
				data[offset.value++]
			);
		} else {
			tag = KNOWN_TAGS[tagIndex];
		}

		const origLength = readUIntBase128(data, offset);

		let transformLength = origLength;
		// glyf/loca: transform version 0 = transformed, 3 = null transform
		// others: transform version 0 = null transform
		const hasTransform = (tag === "glyf" || tag === "loca")
			? transformVersion === 0
			: transformVersion !== 0;

		if (hasTransform) {
			transformLength = readUIntBase128(data, offset);
		}

		tables.push({ tag, origLength, transformLength, transformVersion });
	}

	return tables;
}

/** Decompress Brotli data */
async function decompressBrotli(data: Uint8Array): Promise<Uint8Array> {
	// Try native DecompressionStream with "brotli" (Safari 18.4+, Deno)
	if (typeof DecompressionStream !== "undefined") {
		try {
			const ds = new DecompressionStream("brotli" as CompressionFormat);
			const blob = new Blob([data]);
			const decompressedStream = blob.stream().pipeThrough(ds);
			const result = await new Response(decompressedStream).arrayBuffer();
			return new Uint8Array(result);
		} catch {
			// "brotli" not supported in this browser
		}
	}

	// Pure TypeScript brotli decoder
	const { decompress } = await import("./brotli/decode.ts");
	return decompress(data);
}

/** Write uint16 big-endian */
function writeUint16BE(arr: Uint8Array, offset: number, value: number): void {
	arr[offset] = (value >> 8) & 0xff;
	arr[offset + 1] = value & 0xff;
}

/** Write uint32 big-endian */
function writeUint32BE(arr: Uint8Array, offset: number, value: number): void {
	arr[offset] = (value >> 24) & 0xff;
	arr[offset + 1] = (value >> 16) & 0xff;
	arr[offset + 2] = (value >> 8) & 0xff;
	arr[offset + 3] = value & 0xff;
}

/** Read uint16 big-endian */
function readUint16BE(arr: Uint8Array, offset: number): number {
	return (arr[offset] << 8) | arr[offset + 1];
}

/** Read int16 big-endian */
function readInt16BE(arr: Uint8Array, offset: number): number {
	const val = readUint16BE(arr, offset);
	return val >= 0x8000 ? val - 0x10000 : val;
}

/** Read uint32 big-endian */
function readUint32BE(arr: Uint8Array, offset: number): number {
	return ((arr[offset] << 24) | (arr[offset + 1] << 16) | (arr[offset + 2] << 8) | arr[offset + 3]) >>> 0;
}

/** Calculate OpenType checksum */
function calcChecksum(data: Uint8Array, offset: number, length: number): number {
	let sum = 0;
	const nLongs = Math.ceil(length / 4);
	for (let i = 0; i < nLongs; i++) {
		const idx = offset + i * 4;
		sum = (sum + (
			((data[idx] || 0) << 24) |
			((data[idx + 1] || 0) << 16) |
			((data[idx + 2] || 0) << 8) |
			(data[idx + 3] || 0)
		)) >>> 0;
	}
	return sum;
}

/** Round up to 4-byte boundary */
function pad4(n: number): number {
	return (n + 3) & ~3;
}

/**
 * Decode triplet-encoded coordinates from WOFF2 glyph stream.
 * Based on fonttools implementation.
 *
 * Flag byte structure:
 *   bit 7: on-curve (0) or off-curve (1) - NOTE: inverted from TrueType!
 *   bits 0-6: encoding index (0-127)
 *
 * Encoding index determines:
 *   0-9: dy only (1 byte)
 *   10-19: dx only (1 byte)
 *   20-83: dx and dy (1 byte total)
 *   84-119: dx and dy (2 bytes total)
 *   120-123: dx and dy (3 bytes total)
 *   124-127: dx and dy (4 bytes total)
 */
function decodeTriplets(
	flagStream: Uint8Array,
	glyphStream: Uint8Array,
	nPoints: number,
	flagIdx: { value: number },
	glyphIdx: { value: number }
): { x: number; y: number; onCurve: boolean }[] {
	const points: { x: number; y: number; onCurve: boolean }[] = [];
	let x = 0, y = 0;

	function withSign(flag: number, baseval: number): number {
		return (flag & 1) ? baseval : -baseval;
	}

	for (let i = 0; i < nPoints; i++) {
		const flag = flagStream[flagIdx.value++];
		const onCurve = (flag >> 7) === 0; // bit 7 clear = on curve
		const flagValue = flag & 0x7f;

		let dx = 0, dy = 0;

		if (flagValue < 10) {
			// dy only, 1 byte
			dx = 0;
			dy = withSign(flag, ((flagValue & 14) << 7) + glyphStream[glyphIdx.value++]);
		} else if (flagValue < 20) {
			// dx only, 1 byte
			dx = withSign(flag, (((flagValue - 10) & 14) << 7) + glyphStream[glyphIdx.value++]);
			dy = 0;
		} else if (flagValue < 84) {
			// Both in 1 byte
			const b0 = flagValue - 20;
			const b1 = glyphStream[glyphIdx.value++];
			dx = withSign(flag, 1 + (b0 & 0x30) + (b1 >> 4));
			dy = withSign(flag >> 1, 1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f));
		} else if (flagValue < 120) {
			// Both in 2 bytes
			const b0 = flagValue - 84;
			dx = withSign(flag, 1 + (Math.floor(b0 / 12) << 8) + glyphStream[glyphIdx.value++]);
			dy = withSign(flag >> 1, 1 + (((b0 % 12) >> 2) << 8) + glyphStream[glyphIdx.value++]);
		} else if (flagValue < 124) {
			// Both in 3 bytes
			const b1 = glyphStream[glyphIdx.value++];
			const b2 = glyphStream[glyphIdx.value++];
			const b3 = glyphStream[glyphIdx.value++];
			dx = withSign(flag, (b1 << 4) + (b2 >> 4));
			dy = withSign(flag >> 1, ((b2 & 0x0f) << 8) + b3);
		} else {
			// Both in 4 bytes
			dx = withSign(flag, (glyphStream[glyphIdx.value++] << 8) + glyphStream[glyphIdx.value++]);
			dy = withSign(flag >> 1, (glyphStream[glyphIdx.value++] << 8) + glyphStream[glyphIdx.value++]);
		}

		x += dx;
		y += dy;
		points.push({ x, y, onCurve });
	}

	return points;
}

/** Reconstruct glyf and loca tables from WOFF2 transformed format */
function reconstructGlyfLoca(
	glyfTransform: Uint8Array,
	numGlyphs: number,
	indexFormat: number
): { glyf: Uint8Array; loca: Uint8Array } {
	let offset = 0;

	// Read transformed glyf header (per WOFF2 spec Table 1)
	const version = readUint16BE(glyfTransform, offset); offset += 2;
	if (version !== 0) {
		throw new Error(`Unsupported glyf transform version: ${version}`);
	}
	const optionFlags = readUint16BE(glyfTransform, offset); offset += 2;
	const numGlyphsHeader = readUint16BE(glyfTransform, offset); offset += 2;
	const indexFormatHeader = readUint16BE(glyfTransform, offset); offset += 2;

	const nContourStreamSize = readUint32BE(glyfTransform, offset); offset += 4;
	const nPointsStreamSize = readUint32BE(glyfTransform, offset); offset += 4;
	const flagStreamSize = readUint32BE(glyfTransform, offset); offset += 4;
	const glyphStreamSize = readUint32BE(glyfTransform, offset); offset += 4;
	const compositeStreamSize = readUint32BE(glyfTransform, offset); offset += 4;
	const bboxStreamSize = readUint32BE(glyfTransform, offset); offset += 4;
	const instructionStreamSize = readUint32BE(glyfTransform, offset); offset += 4;

	// Extract streams
	const nContourStream = glyfTransform.slice(offset, offset + nContourStreamSize);
	offset += nContourStreamSize;
	const nPointsStream = glyfTransform.slice(offset, offset + nPointsStreamSize);
	offset += nPointsStreamSize;
	const flagStream = glyfTransform.slice(offset, offset + flagStreamSize);
	offset += flagStreamSize;
	const glyphStream = glyfTransform.slice(offset, offset + glyphStreamSize);
	offset += glyphStreamSize;
	const compositeStream = glyfTransform.slice(offset, offset + compositeStreamSize);
	offset += compositeStreamSize;
	const bboxStream = glyfTransform.slice(offset, offset + bboxStreamSize);
	offset += bboxStreamSize;
	const instructionStream = glyfTransform.slice(offset, offset + instructionStreamSize);

	// Stream indices
	const nContourIdx = { value: 0 };
	const nPointsIdx = { value: 0 };
	const flagIdx = { value: 0 };
	const glyphIdx = { value: 0 };
	const compositeIdx = { value: 0 };
	const bboxIdx = { value: 0 };
	const instructionIdx = { value: 0 };

	// First pass: calculate glyf size
	const glyphOffsets: number[] = [0];
	const glyphParts: Uint8Array[] = [];
	let totalGlyfSize = 0;

	for (let g = 0; g < numGlyphs; g++) {
		const nContours = readInt16BE(nContourStream, nContourIdx.value);
		nContourIdx.value += 2;

		if (nContours === 0) {
			// Empty glyph
			glyphParts.push(new Uint8Array(0));
			glyphOffsets.push(totalGlyfSize);
			continue;
		}

		if (nContours > 0) {
			// Simple glyph
			const glyphData = reconstructSimpleGlyph(
				nContours,
				nPointsStream, nPointsIdx,
				flagStream, flagIdx,
				glyphStream, glyphIdx,
				bboxStream, bboxIdx,
				instructionStream, instructionIdx,
				optionFlags
			);
			glyphParts.push(glyphData);
			totalGlyfSize += pad4(glyphData.length);
			glyphOffsets.push(totalGlyfSize);
		} else {
			// Composite glyph (nContours === -1)
			const glyphData = reconstructCompositeGlyph(
				compositeStream, compositeIdx,
				bboxStream, bboxIdx,
				instructionStream, instructionIdx,
				optionFlags
			);
			glyphParts.push(glyphData);
			totalGlyfSize += pad4(glyphData.length);
			glyphOffsets.push(totalGlyfSize);
		}
	}

	// Build glyf table
	const glyf = new Uint8Array(totalGlyfSize);
	let glyfOffset = 0;
	for (const part of glyphParts) {
		glyf.set(part, glyfOffset);
		glyfOffset += pad4(part.length);
	}

	// Build loca table
	const locaSize = indexFormat === 0 ? (numGlyphs + 1) * 2 : (numGlyphs + 1) * 4;
	const loca = new Uint8Array(locaSize);

	for (let i = 0; i <= numGlyphs; i++) {
		if (indexFormat === 0) {
			writeUint16BE(loca, i * 2, glyphOffsets[i] / 2);
		} else {
			writeUint32BE(loca, i * 4, glyphOffsets[i]);
		}
	}

	return { glyf, loca };
}

function reconstructSimpleGlyph(
	nContours: number,
	nPointsStream: Uint8Array, nPointsIdx: { value: number },
	flagStream: Uint8Array, flagIdx: { value: number },
	glyphStream: Uint8Array, glyphIdx: { value: number },
	bboxStream: Uint8Array, bboxIdx: { value: number },
	instructionStream: Uint8Array, instructionIdx: { value: number },
	optionFlags: number
): Uint8Array {
	// Read endpoints
	const endPtsOfContours: number[] = [];
	let totalPoints = 0;
	for (let c = 0; c < nContours; c++) {
		const nPoints = read255UInt16(nPointsStream, nPointsIdx);
		totalPoints += nPoints;
		endPtsOfContours.push(totalPoints - 1);
	}

	// Read point data using triplet encoding
	const points = decodeTriplets(flagStream, glyphStream, totalPoints, flagIdx, glyphIdx);

	// Read/compute bbox
	let xMin: number, yMin: number, xMax: number, yMax: number;
	const bboxBitmap = (optionFlags & 1) === 0; // bit 0 clear = explicit bboxes stored

	if (bboxBitmap && bboxIdx.value + 8 <= bboxStream.length) {
		xMin = readInt16BE(bboxStream, bboxIdx.value); bboxIdx.value += 2;
		yMin = readInt16BE(bboxStream, bboxIdx.value); bboxIdx.value += 2;
		xMax = readInt16BE(bboxStream, bboxIdx.value); bboxIdx.value += 2;
		yMax = readInt16BE(bboxStream, bboxIdx.value); bboxIdx.value += 2;
	} else {
		// Compute bbox
		xMin = yMin = 0x7fff;
		xMax = yMax = -0x8000;
		for (const pt of points) {
			xMin = Math.min(xMin, pt.x);
			yMin = Math.min(yMin, pt.y);
			xMax = Math.max(xMax, pt.x);
			yMax = Math.max(yMax, pt.y);
		}
	}

	// Read instructions - length is read from glyphStream using 255UInt16 encoding
	const instructionLength = read255UInt16(glyphStream, glyphIdx);
	const instructions = instructionStream.slice(instructionIdx.value, instructionIdx.value + instructionLength);
	instructionIdx.value += instructionLength;

	// Encode glyph in TrueType format
	// Convert absolute coords to deltas and encode
	const xDeltas: number[] = [];
	const yDeltas: number[] = [];
	let prevX = 0, prevY = 0;
	for (const pt of points) {
		xDeltas.push(pt.x - prevX);
		yDeltas.push(pt.y - prevY);
		prevX = pt.x;
		prevY = pt.y;
	}

	// Encode flags and coordinates
	const encodedFlags: number[] = [];
	const encodedX: number[] = [];
	const encodedY: number[] = [];

	for (let i = 0; i < totalPoints; i++) {
		let flag = points[i].onCurve ? 1 : 0;
		const dx = xDeltas[i];
		const dy = yDeltas[i];

		// X encoding
		if (dx === 0) {
			flag |= 0x10; // x-same
		} else if (dx >= -255 && dx <= 255) {
			flag |= 0x02; // x-short
			if (dx > 0) flag |= 0x10; // positive
			encodedX.push(Math.abs(dx));
		} else {
			encodedX.push((dx >> 8) & 0xff, dx & 0xff);
		}

		// Y encoding
		if (dy === 0) {
			flag |= 0x20; // y-same
		} else if (dy >= -255 && dy <= 255) {
			flag |= 0x04; // y-short
			if (dy > 0) flag |= 0x20; // positive
			encodedY.push(Math.abs(dy));
		} else {
			encodedY.push((dy >> 8) & 0xff, dy & 0xff);
		}

		encodedFlags.push(flag);
	}

	// Build glyph buffer
	const headerSize = 10 + nContours * 2 + 2 + instructionLength;
	const totalSize = headerSize + encodedFlags.length + encodedX.length + encodedY.length;
	const data = new Uint8Array(totalSize);
	let off = 0;

	// Header
	writeUint16BE(data, off, nContours); off += 2;
	writeUint16BE(data, off, xMin & 0xffff); off += 2;
	writeUint16BE(data, off, yMin & 0xffff); off += 2;
	writeUint16BE(data, off, xMax & 0xffff); off += 2;
	writeUint16BE(data, off, yMax & 0xffff); off += 2;

	// End points
	for (const endPt of endPtsOfContours) {
		writeUint16BE(data, off, endPt); off += 2;
	}

	// Instructions
	writeUint16BE(data, off, instructionLength); off += 2;
	data.set(instructions, off); off += instructionLength;

	// Flags
	for (const f of encodedFlags) {
		data[off++] = f;
	}

	// X coordinates
	for (const x of encodedX) {
		data[off++] = x;
	}

	// Y coordinates
	for (const y of encodedY) {
		data[off++] = y;
	}

	return data.slice(0, off);
}

function reconstructCompositeGlyph(
	compositeStream: Uint8Array, compositeIdx: { value: number },
	bboxStream: Uint8Array, bboxIdx: { value: number },
	instructionStream: Uint8Array, instructionIdx: { value: number },
	optionFlags: number
): Uint8Array {
	const parts: number[] = [];

	// Read bbox
	const xMin = readInt16BE(bboxStream, bboxIdx.value); bboxIdx.value += 2;
	const yMin = readInt16BE(bboxStream, bboxIdx.value); bboxIdx.value += 2;
	const xMax = readInt16BE(bboxStream, bboxIdx.value); bboxIdx.value += 2;
	const yMax = readInt16BE(bboxStream, bboxIdx.value); bboxIdx.value += 2;

	// Header
	parts.push(0xff, 0xff); // nContours = -1
	parts.push((xMin >> 8) & 0xff, xMin & 0xff);
	parts.push((yMin >> 8) & 0xff, yMin & 0xff);
	parts.push((xMax >> 8) & 0xff, xMax & 0xff);
	parts.push((yMax >> 8) & 0xff, yMax & 0xff);

	// Read components
	let hasMoreComponents = true;
	let hasInstructions = false;

	while (hasMoreComponents) {
		const flags = readUint16BE(compositeStream, compositeIdx.value);
		compositeIdx.value += 2;
		const glyphIndex = readUint16BE(compositeStream, compositeIdx.value);
		compositeIdx.value += 2;

		parts.push((flags >> 8) & 0xff, flags & 0xff);
		parts.push((glyphIndex >> 8) & 0xff, glyphIndex & 0xff);

		// Arguments
		if (flags & 0x0001) { // ARG_1_AND_2_ARE_WORDS
			parts.push(compositeStream[compositeIdx.value++]);
			parts.push(compositeStream[compositeIdx.value++]);
			parts.push(compositeStream[compositeIdx.value++]);
			parts.push(compositeStream[compositeIdx.value++]);
		} else {
			parts.push(compositeStream[compositeIdx.value++]);
			parts.push(compositeStream[compositeIdx.value++]);
		}

		// Transform
		if (flags & 0x0008) { // WE_HAVE_A_SCALE
			parts.push(compositeStream[compositeIdx.value++]);
			parts.push(compositeStream[compositeIdx.value++]);
		} else if (flags & 0x0040) { // WE_HAVE_AN_X_AND_Y_SCALE
			for (let i = 0; i < 4; i++) parts.push(compositeStream[compositeIdx.value++]);
		} else if (flags & 0x0080) { // WE_HAVE_A_TWO_BY_TWO
			for (let i = 0; i < 8; i++) parts.push(compositeStream[compositeIdx.value++]);
		}

		hasMoreComponents = (flags & 0x0020) !== 0;
		if (flags & 0x0100) hasInstructions = true;
	}

	// Instructions
	if (hasInstructions) {
		const instrLen = read255UInt16(instructionStream, instructionIdx);
		parts.push((instrLen >> 8) & 0xff, instrLen & 0xff);
		for (let i = 0; i < instrLen; i++) {
			parts.push(instructionStream[instructionIdx.value++]);
		}
	}

	return new Uint8Array(parts);
}

/** Convert WOFF2 to SFNT */
export async function woff2ToSfnt(buffer: ArrayBuffer): Promise<ArrayBuffer> {
	const data = new Uint8Array(buffer);
	const view = new DataView(buffer);

	// Read header
	const signature = view.getUint32(0, false);
	if (signature !== 0x774f4632) {
		throw new Error("Not a valid WOFF2 file");
	}

	const flavor = view.getUint32(4, false);
	const numTables = view.getUint16(12, false);
	const totalCompressedSize = view.getUint32(20, false);

	// Parse table directory
	const offset = { value: 48 };
	const tables = parseTableDirectory(data, offset, numTables);

	// Decompress all table data
	const compressedData = data.slice(offset.value, offset.value + totalCompressedSize);
	const decompressedData = await decompressBrotli(compressedData);

	// Extract individual table data
	const tableData: Map<string, Uint8Array> = new Map();
	let decompOffset = 0;

	for (const table of tables) {
		const tdata = decompressedData.slice(decompOffset, decompOffset + table.transformLength);
		tableData.set(table.tag, tdata);
		decompOffset += table.transformLength;
	}

	// Get metadata from maxp and head
	const maxpData = tableData.get("maxp");
	const headData = tableData.get("head");
	if (!maxpData || !headData) {
		throw new Error("Missing required tables");
	}

	const numGlyphs = readUint16BE(maxpData, 4);
	const indexToLocFormat = readInt16BE(headData, 50);

	// Handle glyf/loca transform
	const glyfEntry = tables.find(t => t.tag === "glyf");
	const locaEntry = tables.find(t => t.tag === "loca");

	if (glyfEntry && glyfEntry.transformVersion === 0) {
		const glyfTransformed = tableData.get("glyf")!;
		const { glyf, loca } = reconstructGlyfLoca(glyfTransformed, numGlyphs, indexToLocFormat);
		tableData.set("glyf", glyf);
		tableData.set("loca", loca);

		// Update lengths
		glyfEntry.origLength = glyf.length;
		if (locaEntry) {
			locaEntry.origLength = loca.length;
		}
	}

	// Calculate SFNT size
	const headerSize = 12;
	const directorySize = numTables * 16;
	let tableOffset = headerSize + directorySize;

	const tableOffsets: number[] = [];
	for (const table of tables) {
		tableOffsets.push(tableOffset);
		tableOffset += pad4(table.origLength);
	}

	// Build output
	const output = new Uint8Array(tableOffset);

	// SFNT header
	const searchRange = Math.pow(2, Math.floor(Math.log2(numTables))) * 16;
	const entrySelector = Math.floor(Math.log2(numTables));
	const rangeShift = numTables * 16 - searchRange;

	writeUint32BE(output, 0, flavor);
	writeUint16BE(output, 4, numTables);
	writeUint16BE(output, 6, searchRange);
	writeUint16BE(output, 8, entrySelector);
	writeUint16BE(output, 10, rangeShift);

	// Table directory and data
	let headOffset = -1;
	for (let i = 0; i < tables.length; i++) {
		const table = tables[i];
		const tdata = tableData.get(table.tag)!;
		const dirOffset = headerSize + i * 16;

		if (table.tag === "head") headOffset = tableOffsets[i];

		// Tag
		for (let j = 0; j < 4; j++) {
			output[dirOffset + j] = table.tag.charCodeAt(j);
		}

		// Checksum
		const checksum = calcChecksum(tdata, 0, tdata.length);
		writeUint32BE(output, dirOffset + 4, checksum);

		// Offset
		writeUint32BE(output, dirOffset + 8, tableOffsets[i]);

		// Length
		writeUint32BE(output, dirOffset + 12, table.origLength);

		// Copy table data
		output.set(tdata.slice(0, table.origLength), tableOffsets[i]);
	}

	// Fix head checksum adjustment
	if (headOffset >= 0) {
		const totalChecksum = calcChecksum(output, 0, output.length);
		const checksumAdjustment = (0xB1B0AFBA - totalChecksum) >>> 0;
		writeUint32BE(output, headOffset + 8, checksumAdjustment);
	}

	return output.buffer;
}
