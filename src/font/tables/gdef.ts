import {
	type ClassDef,
	parseClassDefAt,
} from "../../layout/structures/class-def.ts";
import type { GlyphId, uint16 } from "../../types.ts";
import { GlyphClass } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/** Attach point for a glyph */
export interface AttachPoint {
	pointIndices: uint16[];
}

/** Ligature caret for a ligature glyph */
export interface LigatureCaret {
	caretValues: number[];
}

/** Mark glyph sets */
export interface MarkGlyphSets {
	/** Check if glyph is in mark set */
	has(setIndex: number, glyphId: GlyphId): boolean;
}

/** Glyph Definition table */
export interface GdefTable {
	version: { major: number; minor: number };

	/** Glyph class definitions (Base=1, Ligature=2, Mark=3, Component=4) */
	glyphClassDef: ClassDef;

	/** Attachment point list (optional) */
	attachList: Map<GlyphId, AttachPoint> | null;

	/** Ligature caret list (optional) */
	ligCaretList: Map<GlyphId, LigatureCaret> | null;

	/** Mark attachment class definitions */
	markAttachClassDef: ClassDef;

	/** Mark glyph sets (version 1.2+) */
	markGlyphSets: MarkGlyphSets | null;
}

export function parseGdef(reader: Reader): GdefTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();

	const glyphClassDefOffset = reader.offset16();
	const attachListOffset = reader.offset16();
	const ligCaretListOffset = reader.offset16();
	const markAttachClassDefOffset = reader.offset16();

	let markGlyphSetsDefOffset = 0;
	if (majorVersion === 1 && minorVersion >= 2) {
		markGlyphSetsDefOffset = reader.offset16();
	}

	// Parse glyph class definitions
	const glyphClassDef = parseClassDefAt(reader, glyphClassDefOffset);

	// Parse attachment list (optional)
	let attachList: Map<GlyphId, AttachPoint> | null = null;
	if (attachListOffset !== 0) {
		attachList = parseAttachList(reader.sliceFrom(attachListOffset));
	}

	// Parse ligature caret list (optional)
	let ligCaretList: Map<GlyphId, LigatureCaret> | null = null;
	if (ligCaretListOffset !== 0) {
		ligCaretList = parseLigCaretList(reader.sliceFrom(ligCaretListOffset));
	}

	// Parse mark attachment class definitions
	const markAttachClassDef = parseClassDefAt(reader, markAttachClassDefOffset);

	// Parse mark glyph sets (version 1.2+)
	let markGlyphSets: MarkGlyphSets | null = null;
	if (markGlyphSetsDefOffset !== 0) {
		markGlyphSets = parseMarkGlyphSets(
			reader.sliceFrom(markGlyphSetsDefOffset),
		);
	}

	return {
		version: { major: majorVersion, minor: minorVersion },
		glyphClassDef,
		attachList,
		ligCaretList,
		markAttachClassDef,
		markGlyphSets,
	};
}

export function parseAttachList(reader: Reader): Map<GlyphId, AttachPoint> {
	const coverageOffset = reader.offset16();
	const glyphCount = reader.uint16();

	// Read attach point offsets
	const attachPointOffsets = reader.uint16Array(glyphCount);

	// Parse coverage to get glyph IDs
	const coverageReader = reader.sliceFrom(coverageOffset);
	const format = coverageReader.uint16();

	const glyphIds: GlyphId[] = [];
	if (format === 1) {
		const count = coverageReader.uint16();
		for (let i = 0; i < count; i++) {
			glyphIds.push(coverageReader.uint16());
		}
	} else if (format === 2) {
		const rangeCount = coverageReader.uint16();
		for (let i = 0; i < rangeCount; i++) {
			const start = coverageReader.uint16();
			const end = coverageReader.uint16();
			coverageReader.skip(2); // startCoverageIndex
			for (let g = start; g <= end; g++) {
				glyphIds.push(g);
			}
		}
	}

	// Parse attach points
	const result = new Map<GlyphId, AttachPoint>();
	for (let i = 0; i < attachPointOffsets.length; i++) {
		const offset = attachPointOffsets[i]!;
		const glyphId = glyphIds[i];
		if (glyphId === undefined) continue;

		const pointReader = reader.sliceFrom(offset);
		const pointCount = pointReader.uint16();
		const pointIndices = Array.from(pointReader.uint16Array(pointCount));

		result.set(glyphId, { pointIndices });
	}

	return result;
}

export function parseLigCaretList(reader: Reader): Map<GlyphId, LigatureCaret> {
	const coverageOffset = reader.offset16();
	const ligGlyphCount = reader.uint16();

	// Read ligature glyph offsets
	const ligGlyphOffsets = reader.uint16Array(ligGlyphCount);

	// Parse coverage to get glyph IDs
	const coverageReader = reader.sliceFrom(coverageOffset);
	const format = coverageReader.uint16();

	const glyphIds: GlyphId[] = [];
	if (format === 1) {
		const count = coverageReader.uint16();
		for (let i = 0; i < count; i++) {
			glyphIds.push(coverageReader.uint16());
		}
	} else if (format === 2) {
		const rangeCount = coverageReader.uint16();
		for (let i = 0; i < rangeCount; i++) {
			const start = coverageReader.uint16();
			const end = coverageReader.uint16();
			coverageReader.skip(2);
			for (let g = start; g <= end; g++) {
				glyphIds.push(g);
			}
		}
	}

	// Parse ligature glyphs
	const result = new Map<GlyphId, LigatureCaret>();
	for (let i = 0; i < ligGlyphOffsets.length; i++) {
		const offset = ligGlyphOffsets[i]!;
		const glyphId = glyphIds[i];
		if (glyphId === undefined) continue;

		const ligReader = reader.sliceFrom(offset);
		const caretCount = ligReader.uint16();
		const caretValueOffsets = ligReader.uint16Array(caretCount);

		const caretValues: number[] = [];
		for (let j = 0; j < caretValueOffsets.length; j++) {
			const caretOffset = caretValueOffsets[j]!;
			const caretReader = reader.sliceFrom(offset + caretOffset);
			const caretFormat = caretReader.uint16();

			if (caretFormat === 1) {
				// Design units
				caretValues.push(caretReader.int16());
			} else if (caretFormat === 2) {
				// Contour point
				caretValues.push(caretReader.uint16()); // point index
			} else if (caretFormat === 3) {
				// Design units + device table
				caretValues.push(caretReader.int16());
			}
		}

		result.set(glyphId, { caretValues });
	}

	return result;
}

export function parseMarkGlyphSets(reader: Reader): MarkGlyphSets {
	const _format = reader.uint16();
	const markSetCount = reader.uint16();

	// Read coverage offsets
	const coverageOffsets = reader.uint32Array(markSetCount);

	// Parse each mark set coverage
	const markSets: Set<GlyphId>[] = [];
	for (let i = 0; i < coverageOffsets.length; i++) {
		const offset = coverageOffsets[i]!;
		const coverageReader = reader.sliceFrom(offset);
		const coverageFormat = coverageReader.uint16();

		const glyphSet = new Set<GlyphId>();
		if (coverageFormat === 1) {
			const count = coverageReader.uint16();
			for (let j = 0; j < count; j++) {
				glyphSet.add(coverageReader.uint16());
			}
		} else if (coverageFormat === 2) {
			const rangeCount = coverageReader.uint16();
			for (let j = 0; j < rangeCount; j++) {
				const start = coverageReader.uint16();
				const end = coverageReader.uint16();
				coverageReader.skip(2);
				for (let g = start; g <= end; g++) {
					glyphSet.add(g);
				}
			}
		}
		markSets.push(glyphSet);
	}

	return {
		has(setIndex: number, glyphId: GlyphId): boolean {
			const set = markSets[setIndex];
			return set ? set.has(glyphId) : false;
		},
	};
}

/** Get glyph class from GDEF */
export function getGlyphClass(
	gdef: GdefTable | null,
	glyphId: GlyphId,
): GlyphClass | 0 {
	if (!gdef) return 0;
	const cls = gdef.glyphClassDef.get(glyphId);
	return cls as GlyphClass | 0;
}

/** Check if glyph is a base glyph */
export function isBaseGlyph(gdef: GdefTable | null, glyphId: GlyphId): boolean {
	return getGlyphClass(gdef, glyphId) === GlyphClass.Base;
}

/** Check if glyph is a ligature */
export function isLigature(gdef: GdefTable | null, glyphId: GlyphId): boolean {
	return getGlyphClass(gdef, glyphId) === GlyphClass.Ligature;
}

/** Check if glyph is a mark */
export function isMark(gdef: GdefTable | null, glyphId: GlyphId): boolean {
	return getGlyphClass(gdef, glyphId) === GlyphClass.Mark;
}

/** Check if glyph is a component */
export function isComponent(gdef: GdefTable | null, glyphId: GlyphId): boolean {
	return getGlyphClass(gdef, glyphId) === GlyphClass.Component;
}
