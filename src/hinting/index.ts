/**
 * TrueType Hinting Module
 *
 * Implements the TrueType bytecode interpreter for grid-fitting.
 */

export {
	type ExecContext,
	type GraphicsState,
	type GlyphZone,
	type FunctionDef,
	type InstructionDef,
	type CallRecord,
	type F26Dot6,
	type F2Dot14,
	type UnitVector,
	type Point,
	RoundMode,
	TouchFlag,
	CodeRange,
	Opcode,
	createExecContext,
	createGlyphZone,
	createDefaultGraphicsState,
} from "./types.ts";

export {
	execute,
	setCodeRange,
	runProgram,
	runFontProgram,
	runCVTProgram,
	runGlyphProgram,
} from "./interpreter.ts";

export {
	type HintingEngine,
	type GlyphOutline,
	type HintedGlyph,
	createHintingEngine,
	loadFontProgram,
	loadCVTProgram,
	executeFontProgram,
	setSize,
	hintGlyph,
	hintedToPixels,
} from "./programs.ts";

export {
	round,
	roundToGrid,
	roundToHalfGrid,
	roundToDoubleGrid,
	roundDownToGrid,
	roundUpToGrid,
	roundOff,
	roundSuper,
	roundSuper45,
	compensate,
	parseSuperRound,
} from "./rounding.ts";
