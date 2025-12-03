import { describe, expect, test } from "bun:test";
import { Reader } from "../../../src/font/binary/reader.ts";
import {
	parseSvg,
	getSvgDocument,
	hasSvgGlyph,
	getSvgGlyphIds,
	decompressSvgDocument,
	type SvgTable,
} from "../../../src/font/tables/svg.ts";

/**
 * Create mock SVG table binary data
 */
function createSvgTableData(
	documentRecords: Array<{
		startGlyphID: number;
		endGlyphID: number;
		svgDoc: string;
		compress?: boolean;
	}>,
): ArrayBuffer {
	const textEncoder = new TextEncoder();
	const encodedDocs = documentRecords.map((rec) => {
		const docBytes = textEncoder.encode(rec.svgDoc);
		return {
			...rec,
			bytes: docBytes,
		};
	});

	// Calculate sizes
	const headerSize = 10; // version (2) + offsetToSVGDocumentList (4) + reserved (4)
	const docListHeaderSize = 2; // numEntries (2)
	const docIndexEntrySize = 12; // startGlyphID (2) + endGlyphID (2) + svgDocOffset (4) + svgDocLength (4)
	const docIndexSize = docListHeaderSize + docIndexEntrySize * documentRecords.length;

	let docsSize = 0;
	for (const doc of encodedDocs) {
		docsSize += doc.bytes.length;
	}

	const totalSize = headerSize + docIndexSize + docsSize;
	const buffer = new ArrayBuffer(totalSize);
	const view = new DataView(buffer);
	let offset = 0;

	// Write SVG header
	view.setUint16(offset, 0, false); // version = 0
	offset += 2;
	view.setUint32(offset, 10, false); // offsetToSVGDocumentList = 10 (right after header)
	offset += 4;
	view.setUint32(offset, 0, false); // reserved
	offset += 4;

	// Write SVG Document List header
	view.setUint16(offset, documentRecords.length, false); // numEntries
	offset += 2;

	// Write document index entries
	const docIndexStart = offset;
	let currentDocOffset = docIndexSize;

	for (const doc of encodedDocs) {
		view.setUint16(offset, doc.startGlyphID, false);
		offset += 2;
		view.setUint16(offset, doc.endGlyphID, false);
		offset += 2;
		view.setUint32(offset, currentDocOffset, false); // offset from SVG Document List start
		offset += 4;
		view.setUint32(offset, doc.bytes.length, false);
		offset += 4;
		currentDocOffset += doc.bytes.length;
	}

	// Write SVG documents
	for (const doc of encodedDocs) {
		const docArray = new Uint8Array(buffer, offset, doc.bytes.length);
		docArray.set(doc.bytes);
		offset += doc.bytes.length;
	}

	return buffer;
}

describe("svg table", () => {
	describe("parseSvg", () => {
		test("parses valid SVG table with single document", () => {
			const svgDoc = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 1, svgDoc },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			expect(svg.version).toBe(0);
			expect(svg.documentRecords.length).toBe(1);
			expect(svg.documentRecords[0]?.startGlyphID).toBe(1);
			expect(svg.documentRecords[0]?.endGlyphID).toBe(1);
			expect(svg.documentRecords[0]?.svgDoc).toBe(svgDoc);
		});

		test("parses SVG table with multiple documents", () => {
			const svgDoc1 = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
			const svgDoc2 = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20"/></svg>';
			const svgDoc3 = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0 L10,10"/></svg>';

			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 1, svgDoc: svgDoc1 },
				{ startGlyphID: 5, endGlyphID: 10, svgDoc: svgDoc2 },
				{ startGlyphID: 20, endGlyphID: 25, svgDoc: svgDoc3 },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			expect(svg.version).toBe(0);
			expect(svg.documentRecords.length).toBe(3);

			expect(svg.documentRecords[0]?.startGlyphID).toBe(1);
			expect(svg.documentRecords[0]?.endGlyphID).toBe(1);
			expect(svg.documentRecords[0]?.svgDoc).toBe(svgDoc1);

			expect(svg.documentRecords[1]?.startGlyphID).toBe(5);
			expect(svg.documentRecords[1]?.endGlyphID).toBe(10);
			expect(svg.documentRecords[1]?.svgDoc).toBe(svgDoc2);

			expect(svg.documentRecords[2]?.startGlyphID).toBe(20);
			expect(svg.documentRecords[2]?.endGlyphID).toBe(25);
			expect(svg.documentRecords[2]?.svgDoc).toBe(svgDoc3);
		});

		test("parses SVG table with glyph ranges", () => {
			const svgDoc = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
			const buffer = createSvgTableData([
				{ startGlyphID: 100, endGlyphID: 150, svgDoc },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			expect(svg.documentRecords.length).toBe(1);
			expect(svg.documentRecords[0]?.startGlyphID).toBe(100);
			expect(svg.documentRecords[0]?.endGlyphID).toBe(150);
		});

		test("handles empty SVG document", () => {
			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 1, svgDoc: "" },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			expect(svg.documentRecords.length).toBe(1);
			expect(svg.documentRecords[0]?.svgDoc).toBe("");
		});

		test("parses SVG with UTF-8 characters", () => {
			const svgDoc = '<svg xmlns="http://www.w3.org/2000/svg"><text>こんにちは</text></svg>';
			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 1, svgDoc },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			expect(svg.documentRecords[0]?.svgDoc).toBe(svgDoc);
		});

		test("handles complex SVG documents", () => {
			const svgDoc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="grad1">
      <stop offset="0%" stop-color="red"/>
      <stop offset="100%" stop-color="blue"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="40" fill="url(#grad1)"/>
</svg>`;
			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 1, svgDoc },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			expect(svg.documentRecords[0]?.svgDoc).toBe(svgDoc);
		});
	});

	describe("getSvgDocument", () => {
		let svg: SvgTable;

		test("returns SVG document for valid glyph ID", () => {
			const svgDoc = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 1, svgDoc },
			]);
			const reader = new Reader(buffer);
			svg = parseSvg(reader);

			const result = getSvgDocument(svg, 1);
			expect(result).toBe(svgDoc);
		});

		test("returns SVG document for glyph in range", () => {
			const svgDoc = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20"/></svg>';
			const buffer = createSvgTableData([
				{ startGlyphID: 5, endGlyphID: 10, svgDoc },
			]);
			const reader = new Reader(buffer);
			svg = parseSvg(reader);

			expect(getSvgDocument(svg, 5)).toBe(svgDoc);
			expect(getSvgDocument(svg, 7)).toBe(svgDoc);
			expect(getSvgDocument(svg, 10)).toBe(svgDoc);
		});

		test("returns null for glyph ID not in any range", () => {
			const svgDoc = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
			const buffer = createSvgTableData([
				{ startGlyphID: 5, endGlyphID: 10, svgDoc },
			]);
			const reader = new Reader(buffer);
			svg = parseSvg(reader);

			expect(getSvgDocument(svg, 1)).toBeNull();
			expect(getSvgDocument(svg, 4)).toBeNull();
			expect(getSvgDocument(svg, 11)).toBeNull();
			expect(getSvgDocument(svg, 100)).toBeNull();
		});

		test("returns correct document for multiple ranges", () => {
			const svgDoc1 = '<svg><circle r="10"/></svg>';
			const svgDoc2 = '<svg><rect width="20" height="20"/></svg>';
			const svgDoc3 = '<svg><path d="M0,0 L10,10"/></svg>';

			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 5, svgDoc: svgDoc1 },
				{ startGlyphID: 10, endGlyphID: 15, svgDoc: svgDoc2 },
				{ startGlyphID: 20, endGlyphID: 25, svgDoc: svgDoc3 },
			]);
			const reader = new Reader(buffer);
			svg = parseSvg(reader);

			expect(getSvgDocument(svg, 3)).toBe(svgDoc1);
			expect(getSvgDocument(svg, 12)).toBe(svgDoc2);
			expect(getSvgDocument(svg, 22)).toBe(svgDoc3);
			expect(getSvgDocument(svg, 8)).toBeNull();
			expect(getSvgDocument(svg, 17)).toBeNull();
		});

		test("handles boundary cases correctly", () => {
			const svgDoc = '<svg><circle r="10"/></svg>';
			const buffer = createSvgTableData([
				{ startGlyphID: 0, endGlyphID: 0, svgDoc },
			]);
			const reader = new Reader(buffer);
			svg = parseSvg(reader);

			expect(getSvgDocument(svg, 0)).toBe(svgDoc);
		});
	});

	describe("hasSvgGlyph", () => {
		let svg: SvgTable;

		test("returns true for glyph with SVG", () => {
			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 1, svgDoc: "<svg/>" },
			]);
			const reader = new Reader(buffer);
			svg = parseSvg(reader);

			expect(hasSvgGlyph(svg, 1)).toBe(true);
		});

		test("returns true for glyph in range", () => {
			const buffer = createSvgTableData([
				{ startGlyphID: 5, endGlyphID: 10, svgDoc: "<svg/>" },
			]);
			const reader = new Reader(buffer);
			svg = parseSvg(reader);

			expect(hasSvgGlyph(svg, 5)).toBe(true);
			expect(hasSvgGlyph(svg, 7)).toBe(true);
			expect(hasSvgGlyph(svg, 10)).toBe(true);
		});

		test("returns false for glyph without SVG", () => {
			const buffer = createSvgTableData([
				{ startGlyphID: 5, endGlyphID: 10, svgDoc: "<svg/>" },
			]);
			const reader = new Reader(buffer);
			svg = parseSvg(reader);

			expect(hasSvgGlyph(svg, 1)).toBe(false);
			expect(hasSvgGlyph(svg, 4)).toBe(false);
			expect(hasSvgGlyph(svg, 11)).toBe(false);
			expect(hasSvgGlyph(svg, 100)).toBe(false);
		});

		test("returns true even for empty SVG document", () => {
			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 1, svgDoc: "" },
			]);
			const reader = new Reader(buffer);
			svg = parseSvg(reader);

			expect(hasSvgGlyph(svg, 1)).toBe(true);
		});
	});

	describe("getSvgGlyphIds", () => {
		test("returns all glyph IDs with SVG", () => {
			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 3, svgDoc: "<svg/>" },
				{ startGlyphID: 5, endGlyphID: 7, svgDoc: "<svg/>" },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			const glyphIds = getSvgGlyphIds(svg);
			expect(glyphIds).toEqual([1, 2, 3, 5, 6, 7]);
		});

		test("returns single glyph ID for single glyph range", () => {
			const buffer = createSvgTableData([
				{ startGlyphID: 10, endGlyphID: 10, svgDoc: "<svg/>" },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			const glyphIds = getSvgGlyphIds(svg);
			expect(glyphIds).toEqual([10]);
		});

		test("returns empty array for table with no documents", () => {
			const buffer = createSvgTableData([]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			const glyphIds = getSvgGlyphIds(svg);
			expect(glyphIds).toEqual([]);
		});

		test("handles large glyph ranges", () => {
			const buffer = createSvgTableData([
				{ startGlyphID: 100, endGlyphID: 105, svgDoc: "<svg/>" },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			const glyphIds = getSvgGlyphIds(svg);
			expect(glyphIds).toEqual([100, 101, 102, 103, 104, 105]);
		});

		test("preserves order of glyph IDs", () => {
			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 2, svgDoc: "<svg/>" },
				{ startGlyphID: 10, endGlyphID: 11, svgDoc: "<svg/>" },
				{ startGlyphID: 5, endGlyphID: 6, svgDoc: "<svg/>" },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			const glyphIds = getSvgGlyphIds(svg);
			expect(glyphIds).toEqual([1, 2, 10, 11, 5, 6]);
		});
	});

	describe("decompressSvgDocument", () => {
		test("returns uncompressed data as string", async () => {
			const svgDoc = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
			const textEncoder = new TextEncoder();
			const data = textEncoder.encode(svgDoc);

			const result = await decompressSvgDocument(data);
			expect(result).toBe(svgDoc);
		});

		test("handles empty data", async () => {
			const data = new Uint8Array([]);
			const result = await decompressSvgDocument(data);
			expect(result).toBe("");
		});

		test("handles UTF-8 encoded data", async () => {
			const svgDoc = '<svg><text>Hello 世界</text></svg>';
			const textEncoder = new TextEncoder();
			const data = textEncoder.encode(svgDoc);

			const result = await decompressSvgDocument(data);
			expect(result).toBe(svgDoc);
		});

		test("detects gzip magic bytes but returns original for non-compressed", async () => {
			// Data that starts with gzip magic bytes but isn't actually compressed
			const data = new Uint8Array([0x1f, 0x8b, 0x00, 0x00]);
			const result = await decompressSvgDocument(data);
			// Will attempt decompression, but since it's not valid gzip, should handle gracefully
			expect(typeof result).toBe("string");
		});
	});

	describe("edge cases", () => {
		test("handles table with no document records", () => {
			const buffer = createSvgTableData([]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			expect(svg.version).toBe(0);
			expect(svg.documentRecords.length).toBe(0);
			expect(getSvgDocument(svg, 1)).toBeNull();
			expect(hasSvgGlyph(svg, 1)).toBe(false);
			expect(getSvgGlyphIds(svg)).toEqual([]);
		});

		test("handles very large glyph IDs", () => {
			const buffer = createSvgTableData([
				{ startGlyphID: 65535, endGlyphID: 65535, svgDoc: "<svg/>" },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			expect(getSvgDocument(svg, 65535)).toBe("<svg/>");
			expect(hasSvgGlyph(svg, 65535)).toBe(true);
		});

		test("handles adjacent glyph ranges", () => {
			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 5, svgDoc: "<svg>1</svg>" },
				{ startGlyphID: 6, endGlyphID: 10, svgDoc: "<svg>2</svg>" },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			expect(getSvgDocument(svg, 5)).toBe("<svg>1</svg>");
			expect(getSvgDocument(svg, 6)).toBe("<svg>2</svg>");
		});

		test("handles overlapping ranges in specification order", () => {
			// Per OpenType spec, ranges should not overlap, but test first match wins
			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 10, svgDoc: "<svg>first</svg>" },
				{ startGlyphID: 5, endGlyphID: 15, svgDoc: "<svg>second</svg>" },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			// First matching record should be returned
			expect(getSvgDocument(svg, 5)).toBe("<svg>first</svg>");
			expect(getSvgDocument(svg, 12)).toBe("<svg>second</svg>");
		});

		test("handles large SVG documents", () => {
			const largeSvg = "<svg>" + "x".repeat(10000) + "</svg>";
			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 1, svgDoc: largeSvg },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			expect(getSvgDocument(svg, 1)).toBe(largeSvg);
		});

		test("handles SVG with special XML characters", () => {
			const svgDoc = '<svg><text>&lt;&gt;&amp;&quot;&#39;</text></svg>';
			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 1, svgDoc },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			expect(getSvgDocument(svg, 1)).toBe(svgDoc);
		});
	});

	describe("version handling", () => {
		test("correctly stores version number", () => {
			const buffer = createSvgTableData([
				{ startGlyphID: 1, endGlyphID: 1, svgDoc: "<svg/>" },
			]);
			const reader = new Reader(buffer);
			const svg = parseSvg(reader);

			expect(typeof svg.version).toBe("number");
			expect(svg.version).toBe(0);
		});
	});
});
