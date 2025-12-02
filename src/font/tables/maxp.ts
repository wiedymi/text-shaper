import type { uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/** Maximum profile table (version 0.5 - CFF) */
export interface MaxpTable05 {
	version: 0x00005000;
	numGlyphs: uint16;
}

/** Maximum profile table (version 1.0 - TrueType) */
export interface MaxpTable10 {
	version: 0x00010000;
	numGlyphs: uint16;
	maxPoints: uint16;
	maxContours: uint16;
	maxCompositePoints: uint16;
	maxCompositeContours: uint16;
	maxZones: uint16;
	maxTwilightPoints: uint16;
	maxStorage: uint16;
	maxFunctionDefs: uint16;
	maxInstructionDefs: uint16;
	maxStackElements: uint16;
	maxSizeOfInstructions: uint16;
	maxComponentElements: uint16;
	maxComponentDepth: uint16;
}

export type MaxpTable = MaxpTable05 | MaxpTable10;

export function parseMaxp(reader: Reader): MaxpTable {
	const version = reader.uint32();
	const numGlyphs = reader.uint16();

	if (version === 0x00005000) {
		// Version 0.5 (CFF fonts)
		return { version, numGlyphs };
	}

	if (version === 0x00010000) {
		// Version 1.0 (TrueType fonts)
		return {
			version,
			numGlyphs,
			maxPoints: reader.uint16(),
			maxContours: reader.uint16(),
			maxCompositePoints: reader.uint16(),
			maxCompositeContours: reader.uint16(),
			maxZones: reader.uint16(),
			maxTwilightPoints: reader.uint16(),
			maxStorage: reader.uint16(),
			maxFunctionDefs: reader.uint16(),
			maxInstructionDefs: reader.uint16(),
			maxStackElements: reader.uint16(),
			maxSizeOfInstructions: reader.uint16(),
			maxComponentElements: reader.uint16(),
			maxComponentDepth: reader.uint16(),
		};
	}

	throw new Error(`Unknown maxp version: 0x${version.toString(16)}`);
}
