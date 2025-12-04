/**
 * TrueType Hinting Module
 *
 * Implements the TrueType bytecode interpreter for grid-fitting.
 */

export {
	execute,
	runCVTProgram,
	runFontProgram,
	runGlyphProgram,
	runProgram,
	setCodeRange,
} from "./interpreter.ts";
export {
	createHintingEngine,
	executeFontProgram,
	type GlyphOutline,
	type HintedGlyph,
	type HintingEngine,
	hintedToPixels,
	hintGlyph,
	loadCVTProgram,
	loadFontProgram,
	setSize,
} from "./programs.ts";
export {
	compensate,
	parseSuperRound,
	round,
	roundDownToGrid,
	roundOff,
	roundSuper,
	roundSuper45,
	roundToDoubleGrid,
	roundToGrid,
	roundToHalfGrid,
	roundUpToGrid,
} from "./rounding.ts";
export {
	type CallRecord,
	CodeRange,
	createDefaultGraphicsState,
	createExecContext,
	createGlyphZone,
	type ExecContext,
	type F2Dot14,
	type F26Dot6,
	type FunctionDef,
	type GlyphZone,
	type GraphicsState,
	type InstructionDef,
	Opcode,
	type Point,
	RoundMode,
	TouchFlag,
	type UnitVector,
} from "./types.ts";
