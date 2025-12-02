import type { FWord, int16, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * Vertical Header table (vhea)
 * Contains information for vertical layout
 */
export interface VheaTable {
	/** Table version (1.0 or 1.1) */
	version: { major: number; minor: number };
	/** Typographic ascent (vertical) */
	ascender: FWord;
	/** Typographic descent (vertical) */
	descender: FWord;
	/** Typographic line gap (vertical) */
	lineGap: FWord;
	/** Maximum advance height */
	advanceHeightMax: uint16;
	/** Minimum top side bearing */
	minTopSideBearing: FWord;
	/** Minimum bottom side bearing */
	minBottomSideBearing: FWord;
	/** Maximum y extent (yMax - yMin) */
	yMaxExtent: FWord;
	/** Caret slope rise (for vertical text) */
	caretSlopeRise: int16;
	/** Caret slope run */
	caretSlopeRun: int16;
	/** Caret offset */
	caretOffset: int16;
	/** Metric data format (0 for current) */
	metricDataFormat: int16;
	/** Number of vertical metrics in vmtx */
	numberOfVMetrics: uint16;
}

/**
 * Parse vhea table
 */
export function parseVhea(reader: Reader): VheaTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	const ascender = reader.fword();
	const descender = reader.fword();
	const lineGap = reader.fword();
	const advanceHeightMax = reader.uint16();
	const minTopSideBearing = reader.fword();
	const minBottomSideBearing = reader.fword();
	const yMaxExtent = reader.fword();
	const caretSlopeRise = reader.int16();
	const caretSlopeRun = reader.int16();
	const caretOffset = reader.int16();

	// Skip reserved fields
	reader.skip(8);

	const metricDataFormat = reader.int16();
	const numberOfVMetrics = reader.uint16();

	return {
		version: { major: majorVersion, minor: minorVersion },
		ascender,
		descender,
		lineGap,
		advanceHeightMax,
		minTopSideBearing,
		minBottomSideBearing,
		yMaxExtent,
		caretSlopeRise,
		caretSlopeRun,
		caretOffset,
		metricDataFormat,
		numberOfVMetrics,
	};
}
