import type { FWord, int16, UFWord, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/** Horizontal header table */
export interface HheaTable {
	majorVersion: uint16;
	minorVersion: uint16;
	ascender: FWord;
	descender: FWord;
	lineGap: FWord;
	advanceWidthMax: UFWord;
	minLeftSideBearing: FWord;
	minRightSideBearing: FWord;
	xMaxExtent: FWord;
	caretSlopeRise: int16;
	caretSlopeRun: int16;
	caretOffset: int16;
	reserved1: int16;
	reserved2: int16;
	reserved3: int16;
	reserved4: int16;
	metricDataFormat: int16;
	numberOfHMetrics: uint16;
}

export function parseHhea(reader: Reader): HheaTable {
	return {
		majorVersion: reader.uint16(),
		minorVersion: reader.uint16(),
		ascender: reader.fword(),
		descender: reader.fword(),
		lineGap: reader.fword(),
		advanceWidthMax: reader.ufword(),
		minLeftSideBearing: reader.fword(),
		minRightSideBearing: reader.fword(),
		xMaxExtent: reader.fword(),
		caretSlopeRise: reader.int16(),
		caretSlopeRun: reader.int16(),
		caretOffset: reader.int16(),
		reserved1: reader.int16(),
		reserved2: reader.int16(),
		reserved3: reader.int16(),
		reserved4: reader.int16(),
		metricDataFormat: reader.int16(),
		numberOfHMetrics: reader.uint16(),
	};
}
