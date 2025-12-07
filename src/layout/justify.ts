import { GlyphBuffer } from "../buffer/glyph-buffer.ts";
import type { Font } from "../font/font.ts";
import {
	getExtenderGlyphs,
	getExtensionMods,
	getJstfPriorities,
	getShrinkageMods,
} from "../font/tables/jstf.ts";
import type { GlyphId, Tag } from "../types.ts";
import { tag } from "../types.ts";

/**
 * Justification mode
 */
export enum JustifyMode {
	/** Shrink text to fit */
	Shrink = "shrink",
	/** Extend text to fit */
	Extend = "extend",
	/** Auto-select based on delta */
	Auto = "auto",
}

/**
 * Justification options
 */
export interface JustifyOptions {
	/** Target line width */
	targetWidth: number;
	/** Script tag */
	script?: Tag;
	/** Language tag */
	language?: Tag;
	/** Justification mode */
	mode?: JustifyMode;
	/** Maximum priority level to use (0-based) */
	maxPriority?: number;
	/** Enable Kashida insertion for Arabic */
	enableKashida?: boolean;
	/** Minimum word spacing factor (default: 0.8) */
	minWordSpacingFactor?: number;
	/** Maximum word spacing factor (default: 1.5) */
	maxWordSpacingFactor?: number;
	/** Enable inter-character spacing adjustment */
	enableLetterSpacing?: boolean;
	/** Maximum letter spacing in font units */
	maxLetterSpacing?: number;
}

/**
 * Justification result
 */
export interface JustifyResult {
	/** Whether justification succeeded */
	success: boolean;
	/** Final line width after justification */
	finalWidth: number;
	/** Delta from target (positive = too wide, negative = too narrow) */
	delta: number;
	/** Priority level used */
	priorityLevel: number;
	/** Adjustments applied */
	adjustments: JustifyAdjustment[];
}

/**
 * Individual justification adjustment
 */
export interface JustifyAdjustment {
	type: "spacing" | "kashida" | "lookup";
	/** Glyph indices affected */
	glyphIndices: number[];
	/** Adjustment value */
	value: number;
}

/**
 * Calculate current line width from glyph buffer
 * @param buffer - The glyph buffer to measure
 * @returns Total line width in font units (sum of all xAdvance values)
 */
export function calculateLineWidth(buffer: GlyphBuffer): number {
	let width = 0;
	for (let i = 0; i < buffer.positions.length; i++) {
		const pos = buffer.positions[i]!;
		width += pos.xAdvance;
	}
	return width;
}

/**
 * Justify a shaped glyph buffer to fit a target width
 * @param font - The font containing JSTF and glyph metrics
 * @param buffer - The shaped glyph buffer to justify (modified in place)
 * @param options - Justification options including target width and mode
 * @returns Result containing success status, final width, and applied adjustments
 */
export function justify(
	font: Font,
	buffer: GlyphBuffer,
	options: JustifyOptions,
): JustifyResult {
	const {
		targetWidth,
		script = tag("DFLT"),
		language,
		mode = JustifyMode.Auto,
		maxPriority = 10,
		enableKashida = true,
		minWordSpacingFactor = 0.8,
		maxWordSpacingFactor = 1.5,
		enableLetterSpacing = true,
		maxLetterSpacing = 100,
	} = options;

	const currentWidth = calculateLineWidth(buffer);
	const delta = targetWidth - currentWidth;

	// Already at target width
	if (Math.abs(delta) < 1) {
		return {
			success: true,
			finalWidth: currentWidth,
			delta: 0,
			priorityLevel: 0,
			adjustments: [],
		};
	}

	// Determine mode
	let actualMode: JustifyMode.Shrink | JustifyMode.Extend;
	if (mode === JustifyMode.Auto) {
		actualMode = delta > 0 ? JustifyMode.Extend : JustifyMode.Shrink;
	} else {
		actualMode = mode as JustifyMode.Shrink | JustifyMode.Extend;
	}

	const adjustments: JustifyAdjustment[] = [];
	let remainingDelta = delta;
	let priorityLevel = 0;

	// Try JSTF-based justification first
	const jstf = font.jstf;
	if (jstf) {
		const priorities = getJstfPriorities(jstf, script, language);

		for (let i = 0; i < Math.min(priorities.length, maxPriority); i++) {
			const priority = priorities[i];
			const mods =
				actualMode === JustifyMode.Shrink
					? getShrinkageMods(priority)
					: getExtensionMods(priority);

			// Apply JSTF lookup modifications
			// Note: This would require reshaping with modified lookups
			// For now, we just record the modifications needed
			if (
				mods.enableGsub.length > 0 ||
				mods.disableGsub.length > 0 ||
				mods.enableGpos.length > 0 ||
				mods.disableGpos.length > 0
			) {
				adjustments.push({
					type: "lookup",
					glyphIndices: [],
					value: i,
				});
				priorityLevel = i;
			}
		}

		// Kashida insertion for Arabic
		if (enableKashida && actualMode === JustifyMode.Extend) {
			const extenderGlyphs = getExtenderGlyphs(jstf, script);
			if (extenderGlyphs.length > 0) {
				const kashidaResult = insertKashida(
					buffer,
					extenderGlyphs[0],
					remainingDelta,
					font,
				);
				remainingDelta -= kashidaResult.totalExtension;
				adjustments.push(...kashidaResult.adjustments);
			}
		}
	}

	// Apply word spacing adjustment
	const spaceGlyphId = font.glyphId(0x0020); // Space character
	if (spaceGlyphId !== 0) {
		const spaceResult = adjustWordSpacing(
			buffer,
			spaceGlyphId,
			remainingDelta,
			actualMode === JustifyMode.Shrink
				? minWordSpacingFactor
				: maxWordSpacingFactor,
		);
		remainingDelta -= spaceResult.totalAdjustment;
		adjustments.push(...spaceResult.adjustments);
	}

	// Apply letter spacing if still needed
	if (enableLetterSpacing && Math.abs(remainingDelta) > 1) {
		const letterResult = adjustLetterSpacing(
			buffer,
			remainingDelta,
			maxLetterSpacing,
		);
		remainingDelta -= letterResult.totalAdjustment;
		adjustments.push(...letterResult.adjustments);
	}

	const finalWidth = calculateLineWidth(buffer);

	return {
		success: Math.abs(remainingDelta) < 1,
		finalWidth,
		delta: targetWidth - finalWidth,
		priorityLevel,
		adjustments,
	};
}

/**
 * Insert Kashida (tatweel) characters for Arabic justification
 * @param buffer - The glyph buffer to extend (modified in place)
 * @param kashidaGlyph - The glyph ID of the Kashida character
 * @param targetExtension - Target width to extend by in font units
 * @param font - The font containing glyph metrics
 * @returns Object containing total extension achieved and list of adjustments
 */
function insertKashida(
	buffer: GlyphBuffer,
	kashidaGlyph: GlyphId,
	targetExtension: number,
	font: Font,
): { totalExtension: number; adjustments: JustifyAdjustment[] } {
	const adjustments: JustifyAdjustment[] = [];
	let totalExtension = 0;

	// Find valid Kashida insertion points (between Arabic letters)
	const insertionPoints: number[] = [];
	for (let i = 0; i < buffer.infos.length - 1; i++) {
		const info = buffer.infos[i];
		// Check if this is a valid insertion point
		// (between joining Arabic characters)
		if (isValidKashidaPoint(info.codepoint)) {
			insertionPoints.push(i);
		}
	}

	if (insertionPoints.length === 0) {
		return { totalExtension: 0, adjustments: [] };
	}

	// Get Kashida width
	const kashidaWidth = font.advanceWidth(kashidaGlyph);
	if (kashidaWidth <= 0) {
		return { totalExtension: 0, adjustments: [] };
	}

	// Distribute Kashida evenly
	const kashidaPerPoint = Math.ceil(
		targetExtension / kashidaWidth / insertionPoints.length,
	);
	const adjustmentPerPoint = Math.min(
		kashidaPerPoint * kashidaWidth,
		targetExtension / insertionPoints.length,
	);

	for (let i = 0; i < insertionPoints.length; i++) {
		if (totalExtension >= targetExtension) break;

		const point = insertionPoints[i]!;
		// Add Kashida extension via xAdvance
		buffer.positions[point].xAdvance += adjustmentPerPoint;
		totalExtension += adjustmentPerPoint;

		adjustments.push({
			type: "kashida",
			glyphIndices: [point],
			value: adjustmentPerPoint,
		});
	}

	return { totalExtension, adjustments };
}

/**
 * Check if a codepoint is a valid Kashida insertion point
 * @param codepoint - Unicode codepoint to check
 * @returns True if this is an Arabic character that can have Kashida after it
 */
function isValidKashidaPoint(codepoint: number): boolean {
	// Arabic letters that can have Kashida after them
	// Simplified check - in reality need to check joining behavior
	return codepoint >= 0x0620 && codepoint <= 0x06ff;
}

/**
 * Adjust word spacing (space character width)
 * @param buffer - The glyph buffer to adjust (modified in place)
 * @param spaceGlyph - The glyph ID of the space character
 * @param targetAdjustment - Target total adjustment in font units (positive to expand, negative to shrink)
 * @param limitFactor - Maximum spacing factor relative to original space width (e.g., 1.5 allows 150% of original)
 * @returns Object containing total adjustment achieved and list of adjustments
 */
function adjustWordSpacing(
	buffer: GlyphBuffer,
	spaceGlyph: GlyphId,
	targetAdjustment: number,
	limitFactor: number,
): { totalAdjustment: number; adjustments: JustifyAdjustment[] } {
	const adjustments: JustifyAdjustment[] = [];
	let totalAdjustment = 0;

	// Find all space glyphs
	const spaceIndices: number[] = [];
	let totalSpaceWidth = 0;

	for (let i = 0; i < buffer.infos.length; i++) {
		if (buffer.infos[i]?.glyphId === spaceGlyph) {
			spaceIndices.push(i);
			totalSpaceWidth += buffer.positions[i]?.xAdvance;
		}
	}

	if (spaceIndices.length === 0) {
		return { totalAdjustment: 0, adjustments: [] };
	}

	// Calculate adjustment per space
	const adjustmentPerSpace = targetAdjustment / spaceIndices.length;
	const originalSpaceWidth = totalSpaceWidth / spaceIndices.length;
	const maxAdjustment = originalSpaceWidth * (limitFactor - 1);

	const clampedAdjustment =
		targetAdjustment > 0
			? Math.min(adjustmentPerSpace, maxAdjustment)
			: Math.max(adjustmentPerSpace, -maxAdjustment);

	for (let i = 0; i < spaceIndices.length; i++) {
		const idx = spaceIndices[i]!;
		buffer.positions[idx].xAdvance += clampedAdjustment;
		totalAdjustment += clampedAdjustment;
	}

	if (totalAdjustment !== 0) {
		adjustments.push({
			type: "spacing",
			glyphIndices: spaceIndices,
			value: clampedAdjustment,
		});
	}

	return { totalAdjustment, adjustments };
}

/**
 * Adjust letter spacing (inter-character spacing)
 * @param buffer - The glyph buffer to adjust (modified in place)
 * @param targetAdjustment - Target total adjustment in font units (positive to expand, negative to shrink)
 * @param maxAdjustment - Maximum adjustment per gap in font units
 * @returns Object containing total adjustment achieved and list of adjustments
 */
function adjustLetterSpacing(
	buffer: GlyphBuffer,
	targetAdjustment: number,
	maxAdjustment: number,
): { totalAdjustment: number; adjustments: JustifyAdjustment[] } {
	const adjustments: JustifyAdjustment[] = [];

	const numGlyphs = buffer.infos.length;
	if (numGlyphs <= 1) {
		return { totalAdjustment: 0, adjustments: [] };
	}

	// Distribute across all inter-glyph gaps (n-1 gaps for n glyphs)
	const numGaps = numGlyphs - 1;
	const adjustmentPerGap = targetAdjustment / numGaps;

	// Clamp to max
	const clampedAdjustment =
		targetAdjustment > 0
			? Math.min(adjustmentPerGap, maxAdjustment)
			: Math.max(adjustmentPerGap, -maxAdjustment);

	const affectedIndices: number[] = [];
	let totalAdjustment = 0;

	for (let i = 0; i < numGlyphs - 1; i++) {
		buffer.positions[i].xAdvance += clampedAdjustment;
		totalAdjustment += clampedAdjustment;
		affectedIndices.push(i);
	}

	if (totalAdjustment !== 0) {
		adjustments.push({
			type: "spacing",
			glyphIndices: affectedIndices,
			value: clampedAdjustment,
		});
	}

	return { totalAdjustment, adjustments };
}

/**
 * Simple line breaking for multi-line text
 */
export interface LineBreakResult {
	lines: GlyphBuffer[];
	breakPoints: number[];
}

/**
 * Break shaped text into lines at a given width using simple greedy algorithm
 * @param buffer - The shaped glyph buffer to break into lines
 * @param maxWidth - Maximum line width in font units
 * @param spaceGlyph - Optional glyph ID of space character for word boundary detection
 * @returns Object containing array of line buffers and break point indices
 */
export function breakIntoLines(
	buffer: GlyphBuffer,
	maxWidth: number,
	spaceGlyph?: GlyphId,
): LineBreakResult {
	const lines: GlyphBuffer[] = [];
	const breakPoints: number[] = [];

	if (buffer.infos.length === 0) {
		return { lines: [], breakPoints: [] };
	}

	let lineStart = 0;
	let currentWidth = 0;
	let lastBreakPoint = -1;
	let _lastBreakWidth = 0;

	for (let i = 0; i < buffer.infos.length; i++) {
		const pos = buffer.positions[i];
		const info = buffer.infos[i];

		currentWidth += pos.xAdvance;

		// Track potential break points (after spaces)
		if (spaceGlyph !== undefined && info.glyphId === spaceGlyph) {
			lastBreakPoint = i;
			_lastBreakWidth = currentWidth;
		}

		// Check if we need to break
		if (currentWidth > maxWidth && lineStart < i) {
			let breakAt: number;

			if (lastBreakPoint > lineStart) {
				// Break at last space
				breakAt = lastBreakPoint + 1;
			} else {
				// Force break at current position
				breakAt = i;
			}

			// Create line buffer
			const lineBuffer = createLineBuffer(buffer, lineStart, breakAt);
			lines.push(lineBuffer);
			breakPoints.push(breakAt);

			// Start new line
			lineStart = breakAt;
			currentWidth = 0;
			lastBreakPoint = -1;

			// Recalculate width from line start
			for (let j = lineStart; j <= i; j++) {
				currentWidth += buffer.positions[j]?.xAdvance;
			}
		}
	}

	// Add final line
	if (lineStart < buffer.infos.length) {
		const lineBuffer = createLineBuffer(buffer, lineStart, buffer.infos.length);
		lines.push(lineBuffer);
	}

	return { lines, breakPoints };
}

/**
 * Create a new GlyphBuffer from a slice of an existing buffer
 * @param source - The source glyph buffer to copy from
 * @param start - Start index (inclusive)
 * @param end - End index (exclusive)
 * @returns New glyph buffer containing the specified range
 */
function createLineBuffer(
	source: GlyphBuffer,
	start: number,
	end: number,
): GlyphBuffer {
	const lineBuffer = new GlyphBuffer();
	lineBuffer.direction = source.direction;
	lineBuffer.script = source.script;
	lineBuffer.language = source.language;

	for (let i = start; i < end; i++) {
		lineBuffer.infos.push({ ...source.infos[i] });
		lineBuffer.positions.push({ ...source.positions[i] });
	}

	return lineBuffer;
}

/**
 * Justify all lines in a paragraph to the same width
 * @param font - The font containing JSTF and glyph metrics
 * @param lines - Array of glyph buffers representing lines (modified in place)
 * @param options - Justification options including target width and mode
 * @returns Array of justification results, one per line
 */
export function justifyParagraph(
	font: Font,
	lines: GlyphBuffer[],
	options: JustifyOptions,
): JustifyResult[] {
	const results: JustifyResult[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const isLastLine = i === lines.length - 1;

		// Don't justify the last line (or justify less aggressively)
		if (isLastLine) {
			results.push({
				success: true,
				finalWidth: calculateLineWidth(line),
				delta: 0,
				priorityLevel: 0,
				adjustments: [],
			});
		} else {
			results.push(justify(font, line, options));
		}
	}

	return results;
}
