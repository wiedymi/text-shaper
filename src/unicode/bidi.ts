/**
 * Bidirectional text processing (UAX #9)
 * Wraps bidi-js for integration with the shaper
 */

import {
	getBidiCharType,
	getEmbeddingLevels,
	getMirroredCharacter,
	getReorderedIndices,
} from "../../reference/bidi-js/src/index.js";

import type { GlyphInfo } from "../types.ts";
import { Direction } from "../types.ts";

/**
 * Result of BiDi processing
 */
export interface BidiResult {
	/** Embedding levels per character */
	levels: Uint8Array;
	/** Paragraph information */
	paragraphs: BidiParagraph[];
}

/**
 * Paragraph info from BiDi algorithm
 */
export interface BidiParagraph {
	start: number;
	end: number;
	level: number;
}

/**
 * Get embedding levels for a string
 */
export function getEmbeddings(
	text: string,
	baseDirection: Direction = Direction.LTR,
): BidiResult {
	const dir =
		baseDirection === Direction.RTL
			? "rtl"
			: baseDirection === Direction.LTR
				? "ltr"
				: "auto";

	const result = getEmbeddingLevels(text, dir);

	return {
		levels: result.levels,
		paragraphs: result.paragraphs,
	};
}

/**
 * Get reordered indices for visual display
 */
export function getVisualOrder(
	text: string,
	levels: Uint8Array,
	start: number = 0,
	end: number = text.length,
): number[] {
	return Array.from(getReorderedIndices(text, levels, start, end));
}

/**
 * Apply BiDi reordering to glyph infos
 */
export function reorderGlyphs(
	infos: GlyphInfo[],
	levels: Uint8Array,
): GlyphInfo[] {
	if (infos.length === 0) return infos;

	// Get reordered indices
	const indices = getReorderedIndices(
		"x".repeat(infos.length), // Dummy string, we just need indices
		levels,
		0,
		infos.length,
	);

	// Reorder glyphs according to visual order
	const reordered: GlyphInfo[] = [];
	for (const idx of indices) {
		if (idx < infos.length) {
			const info = infos[idx];
			if (info) {
				reordered.push(info);
			}
		}
	}

	return reordered;
}

/**
 * Get mirrored character for RTL contexts
 */
export function getMirror(codepoint: number): number {
	const char = String.fromCodePoint(codepoint);
	const mirrored = getMirroredCharacter(char);
	return mirrored ? (mirrored.codePointAt(0) ?? codepoint) : codepoint;
}

/**
 * Apply character mirroring for RTL runs
 */
export function applyMirroring(infos: GlyphInfo[], levels: Uint8Array): void {
	for (const [i, info] of infos.entries()) {
		const level = levels[i];
		if (level === undefined) continue;

		// Odd levels are RTL
		if (level & 1) {
			const mirrored = getMirror(info.codepoint);
			if (mirrored !== info.codepoint) {
				// Store mirrored codepoint - glyph ID will be remapped later
				info.codepoint = mirrored;
			}
		}
	}
}

/**
 * BiDi character type constants
 */
export const BidiType = {
	L: 0x0001, // Left-to-Right
	R: 0x0002, // Right-to-Left
	EN: 0x0004, // European Number
	ES: 0x0008, // European Separator
	ET: 0x0010, // European Terminator
	AN: 0x0020, // Arabic Number
	CS: 0x0040, // Common Separator
	B: 0x0080, // Paragraph Separator
	S: 0x0100, // Segment Separator
	WS: 0x0200, // Whitespace
	ON: 0x0400, // Other Neutral
	BN: 0x0800, // Boundary Neutral
	NSM: 0x1000, // Non-Spacing Mark
	AL: 0x2000, // Arabic Letter
	LRO: 0x4000, // Left-to-Right Override
	RLO: 0x8000, // Right-to-Left Override
	LRE: 0x10000, // Left-to-Right Embedding
	RLE: 0x20000, // Right-to-Left Embedding
	PDF: 0x40000, // Pop Directional Format
	LRI: 0x80000, // Left-to-Right Isolate
	RLI: 0x100000, // Right-to-Left Isolate
	FSI: 0x200000, // First Strong Isolate
	PDI: 0x400000, // Pop Directional Isolate
} as const;

/**
 * Get BiDi character type for a character
 */
export function getCharType(char: string): number {
	return getBidiCharType(char);
}

/**
 * Check if a character is strongly RTL
 */
export function isRTL(codepoint: number): boolean {
	const char = String.fromCodePoint(codepoint);
	const type = getBidiCharType(char);
	return (type & (BidiType.R | BidiType.AL)) !== 0;
}

/**
 * Check if a character is strongly LTR
 */
export function isLTR(codepoint: number): boolean {
	const char = String.fromCodePoint(codepoint);
	const type = getBidiCharType(char);
	return (type & BidiType.L) !== 0;
}

/**
 * Detect base direction from text content
 */
export function detectDirection(text: string): Direction {
	for (const char of text) {
		const type = getBidiCharType(char);
		if (type & BidiType.L) return Direction.LTR;
		if (type & (BidiType.R | BidiType.AL)) return Direction.RTL;
	}
	return Direction.LTR; // Default
}

/**
 * Full BiDi processing for shaping
 */
export function processBidi(
	infos: GlyphInfo[],
	baseDirection: Direction = Direction.LTR,
): { infos: GlyphInfo[]; levels: Uint8Array } {
	if (infos.length === 0) {
		return { infos, levels: new Uint8Array(0) };
	}

	// Build string from codepoints
	const text = infos.map((i) => String.fromCodePoint(i.codepoint)).join("");

	// Get embedding levels
	const { levels } = getEmbeddings(text, baseDirection);

	// Apply character mirroring
	applyMirroring(infos, levels);

	// Reorder glyphs for visual order
	const reordered = reorderGlyphs(infos, levels);

	return { infos: reordered, levels };
}
