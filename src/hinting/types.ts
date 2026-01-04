/**
 * TrueType Hinting Types
 *
 * Based on FreeType's ttinterp.h and ttobjs.h
 */

/**
 * 26.6 fixed-point number (used for coordinates)
 */
export type F26Dot6 = number;

/**
 * 2.14 fixed-point number (used for unit vectors)
 */
export type F2Dot14 = number;

/**
 * Unit vector in 2.14 format
 */
export interface UnitVector {
	x: F2Dot14;
	y: F2Dot14;
}

/**
 * Point coordinate
 */
export interface Point {
	x: F26Dot6;
	y: F26Dot6;
}

/**
 * Rounding mode for ROUND instruction
 */
export enum RoundMode {
	ToHalfGrid = 0,
	ToGrid = 1,
	ToDoubleGrid = 2,
	DownToGrid = 3,
	UpToGrid = 4,
	Off = 5,
	Super = 6,
	Super45 = 7,
}

/**
 * Touch flags for points
 */
export enum TouchFlag {
	X = 0x10,
	Y = 0x20,
	Both = 0x30,
}

/**
 * Render mode used for GETINFO responses.
 */
export type HintRenderMode = "mono" | "gray" | "lcd" | "lcd_v";

/**
 * Glyph zone - holds glyph points
 */
export interface GlyphZone {
	/** Number of points */
	nPoints: number;
	/** Number of contours */
	nContours: number;
	/** Original point positions (before hinting) */
	org: Point[];
	/** Current point positions (after hinting) */
	cur: Point[];
	/** Original unscaled positions */
	orus: Point[];
	/** Touch flags per point */
	tags: Uint8Array;
	/** Contour end indices */
	contours: Uint16Array;
}

/**
 * TrueType Graphics State
 *
 * Contains all state variables that control how instructions operate
 */
export interface GraphicsState {
	// Reference points
	rp0: number;
	rp1: number;
	rp2: number;

	// Dual projection vector (for getting distances)
	dualVector: UnitVector;
	// Projection vector (direction along which we measure)
	projVector: UnitVector;
	// Freedom vector (direction in which points can move)
	freeVector: UnitVector;

	// Loop counter for repeated operations
	loop: number;

	// Minimum distance
	minimumDistance: F26Dot6;

	// Round state
	roundState: RoundMode;

	// Auto flip for MIRP/MDRP
	autoFlip: boolean;

	// Control value cut-in
	controlValueCutIn: F26Dot6;

	// Single width cut-in
	singleWidthCutIn: F26Dot6;
	// Single width value
	singleWidthValue: F26Dot6;

	// Delta base (for DELTA instructions)
	deltaBase: number;
	// Delta shift (for DELTA instructions)
	deltaShift: number;

	// Instruction control flags
	instructControl: number;

	// Scan control flags
	scanControl: number;
	scanType: number;

	// Zone pointers (0 = twilight, 1 = glyph)
	gep0: number;
	gep1: number;
	gep2: number;

	// Super rounding parameters
	period: F26Dot6;
	phase: F26Dot6;
	threshold: F26Dot6;
}

/**
 * Create default graphics state
 */
export function createDefaultGraphicsState(): GraphicsState {
	return {
		rp0: 0,
		rp1: 0,
		rp2: 0,
		dualVector: { x: 0x4000, y: 0 }, // 1.0, 0.0 in 2.14
		projVector: { x: 0x4000, y: 0 },
		freeVector: { x: 0x4000, y: 0 },
		loop: 1,
		minimumDistance: 64, // 1 pixel in 26.6
		roundState: RoundMode.ToGrid,
		autoFlip: true,
		controlValueCutIn: 68, // 17/16 pixel in 26.6
		singleWidthCutIn: 0,
		singleWidthValue: 0,
		deltaBase: 9,
		deltaShift: 3,
		instructControl: 0,
		scanControl: 0,
		scanType: 0,
		gep0: 1,
		gep1: 1,
		gep2: 1,
		period: 64,
		phase: 0,
		threshold: 32,
	};
}

/**
 * Function definition (from FDEF instruction)
 */
export interface FunctionDef {
	/** Function number */
	id: number;
	/** Start offset in bytecode */
	start: number;
	/** End offset (just after ENDF) */
	end: number;
	/** Active (has been defined) */
	active: boolean;
	/** Which code range */
	range: CodeRange;
}

/**
 * Instruction definition (from IDEF instruction)
 */
export interface InstructionDef {
	/** Opcode being redefined */
	opcode: number;
	/** Start offset */
	start: number;
	/** End offset */
	end: number;
	/** Active */
	active: boolean;
	/** Code range */
	range: CodeRange;
}

/**
 * Code range type
 */
export enum CodeRange {
	None = 0,
	Font = 1, // fpgm table
	CVT = 2, // prep table
	Glyph = 3, // glyph instructions
}

/**
 * Call stack record
 */
export interface CallRecord {
	/** Caller's instruction pointer */
	callerIP: number;
	/** Caller's code range */
	callerRange: CodeRange;
	/** Function definition */
	def: FunctionDef;
	/** Loop count (for LOOPCALL) */
	count: number;
}

/**
 * Execution context for the TrueType interpreter
 */
export interface ExecContext {
	// Graphics state
	GS: GraphicsState;
	// Default graphics state (reset after each glyph)
	defaultGS: GraphicsState;

	// Zone pointers
	zp0: GlyphZone;
	zp1: GlyphZone;
	zp2: GlyphZone;

	// Twilight zone (synthetic points)
	twilight: GlyphZone;
	// Glyph zone (actual glyph points)
	pts: GlyphZone;

	// Stack
	stack: Int32Array;
	stackTop: number;

	// Instruction pointer and code
	IP: number;
	code: Uint8Array;
	codeSize: number;
	currentRange: CodeRange;

	// Current opcode
	opcode: number;
	// Number of arguments for current opcode
	numArgs: number;

	// Control Value Table (scaled)
	cvt: Int32Array;
	cvtSize: number;

	// Storage area
	storage: Int32Array;
	storageSize: number;

	// Function definitions
	FDefs: FunctionDef[];
	maxFDefs: number;

	// Instruction definitions
	IDefs: InstructionDef[];
	maxIDefs: number;

	// Call stack
	callStack: CallRecord[];
	callStackTop: number;
	maxCallStack: number;

	// Code ranges
	codeRanges: Map<CodeRange, { code: Uint8Array; size: number }>;

	// Pixels per EM
	ppem: number;
	// Point size
	pointSize: number;

	// Scale factor from font units to 26.6 pixels
	scale: number;
	// Scale factor in 16.16 fixed-point
	scaleFix: number;
	// Light hinting mode (vertical-only for grayscale rendering)
	lightMode: boolean;
	// Grayscale hinting flag (FreeType exc->grayscale)
	grayscale: boolean;
	// Render mode used for GETINFO responses
	renderMode: HintRenderMode;
	// Backward compatibility flags (bit2 = active, bits0-1 track IUP)
	backwardCompatibility: number;
	// True if current glyph is composite
	isComposite: boolean;

	// Error state
	error: string | null;

	// Instruction execution count (for infinite loop protection)
	instructionCount: number;
	maxInstructions: number;
}

/**
 * Create an empty glyph zone
 */
export function createGlyphZone(
	maxPoints: number,
	maxContours: number,
): GlyphZone {
	return {
		nPoints: 0,
		nContours: 0,
		org: new Array(maxPoints).fill(null).map(() => ({ x: 0, y: 0 })),
		cur: new Array(maxPoints).fill(null).map(() => ({ x: 0, y: 0 })),
		orus: new Array(maxPoints).fill(null).map(() => ({ x: 0, y: 0 })),
		tags: new Uint8Array(maxPoints),
		contours: new Uint16Array(maxContours),
	};
}

/**
 * Create execution context
 */
export function createExecContext(
	maxStack: number = 256,
	maxStorage: number = 64,
	maxFDefs: number = 64,
	maxIDefs: number = 64,
	maxCallStack: number = 32,
	maxTwilightPoints: number = 16,
): ExecContext {
	const defaultGS = createDefaultGraphicsState();

	return {
		GS: { ...defaultGS },
		defaultGS,

		zp0: createGlyphZone(0, 0),
		zp1: createGlyphZone(0, 0),
		zp2: createGlyphZone(0, 0),

		twilight: createGlyphZone(maxTwilightPoints, 1),
		pts: createGlyphZone(0, 0),

		stack: new Int32Array(maxStack),
		stackTop: 0,

		IP: 0,
		code: new Uint8Array(0),
		codeSize: 0,
		currentRange: CodeRange.None,

		opcode: 0,
		numArgs: 0,

		cvt: new Int32Array(0),
		cvtSize: 0,

		storage: new Int32Array(maxStorage),
		storageSize: maxStorage,

		FDefs: new Array(maxFDefs).fill(null).map((_, i) => ({
			id: i,
			start: 0,
			end: 0,
			active: false,
			range: CodeRange.None,
		})),
		maxFDefs,

		IDefs: new Array(maxIDefs).fill(null).map((_, i) => ({
			opcode: i,
			start: 0,
			end: 0,
			active: false,
			range: CodeRange.None,
		})),
		maxIDefs,

		callStack: new Array(maxCallStack).fill(null).map(() => ({
			callerIP: 0,
			callerRange: CodeRange.None,
			def: { id: 0, start: 0, end: 0, active: false, range: CodeRange.None },
			count: 0,
		})),
		callStackTop: 0,
		maxCallStack,

		codeRanges: new Map(),

	ppem: 12,
	pointSize: 12,
	scale: 1,
	scaleFix: 0x10000,
	lightMode: false,
	grayscale: true,
	renderMode: "gray",
	backwardCompatibility: 0,
	isComposite: false,

		error: null,

		instructionCount: 0,
		maxInstructions: 1000000,
	};
}

/**
 * TrueType Opcodes
 */
export const Opcode = {
	// Push instructions
	NPUSHB: 0x40,
	NPUSHW: 0x41,
	PUSHB_0: 0xb0,
	PUSHB_1: 0xb1,
	PUSHB_2: 0xb2,
	PUSHB_3: 0xb3,
	PUSHB_4: 0xb4,
	PUSHB_5: 0xb5,
	PUSHB_6: 0xb6,
	PUSHB_7: 0xb7,
	PUSHW_0: 0xb8,
	PUSHW_1: 0xb9,
	PUSHW_2: 0xba,
	PUSHW_3: 0xbb,
	PUSHW_4: 0xbc,
	PUSHW_5: 0xbd,
	PUSHW_6: 0xbe,
	PUSHW_7: 0xbf,

	// Storage instructions
	RS: 0x43,
	WS: 0x42,

	// CVT instructions
	RCVT: 0x45,
	WCVTP: 0x44,
	WCVTF: 0x70,

	// Stack operations
	DUP: 0x20,
	POP: 0x21,
	CLEAR: 0x22,
	SWAP: 0x23,
	DEPTH: 0x24,
	CINDEX: 0x25,
	MINDEX: 0x26,
	ROLL: 0x8a,

	// Arithmetic
	ADD: 0x60,
	SUB: 0x61,
	DIV: 0x62,
	MUL: 0x63,
	ABS: 0x64,
	NEG: 0x65,
	FLOOR: 0x66,
	CEILING: 0x67,
	MAX: 0x8b,
	MIN: 0x8c,

	// Comparison
	LT: 0x50,
	LTEQ: 0x51,
	GT: 0x52,
	GTEQ: 0x53,
	EQ: 0x54,
	NEQ: 0x55,
	ODD: 0x56,
	EVEN: 0x57,

	// Logic
	AND: 0x5a,
	OR: 0x5b,
	NOT: 0x5c,

	// Control flow
	IF: 0x58,
	ELSE: 0x1b,
	EIF: 0x59,
	JMPR: 0x1c,
	JROT: 0x78,
	JROF: 0x79,

	// Functions
	FDEF: 0x2c,
	ENDF: 0x2d,
	CALL: 0x2b,
	LOOPCALL: 0x2a,
	IDEF: 0x89,

	// Graphics state - vectors
	SVTCA_Y: 0x00,
	SVTCA_X: 0x01,
	SPVTCA_Y: 0x02,
	SPVTCA_X: 0x03,
	SFVTCA_Y: 0x04,
	SFVTCA_X: 0x05,
	SPVTL_0: 0x06,
	SPVTL_1: 0x07,
	SFVTL_0: 0x08,
	SFVTL_1: 0x09,
	SDPVTL_0: 0x86,
	SDPVTL_1: 0x87,
	SPVFS: 0x0a,
	SFVFS: 0x0b,
	GPV: 0x0c,
	GFV: 0x0d,
	SFVTPV: 0x0e,
	ISECT: 0x0f,

	// Graphics state - reference points
	SRP0: 0x10,
	SRP1: 0x11,
	SRP2: 0x12,

	// Graphics state - zone pointers
	SZP0: 0x13,
	SZP1: 0x14,
	SZP2: 0x15,
	SZPS: 0x16,

	// Graphics state - other
	SLOOP: 0x17,
	RTG: 0x18,
	RTHG: 0x19,
	SMD: 0x1a,
	RDTG: 0x7d,
	RUTG: 0x7c,
	ROFF: 0x7a,
	SROUND: 0x76,
	S45ROUND: 0x77,
	SCVTCI: 0x1d,
	SSWCI: 0x1e,
	SSW: 0x1f,
	FLIPON: 0x4d,
	FLIPOFF: 0x4e,
	SANGW: 0x7e,
	SDB: 0x5e,
	SDS: 0x5f,

	// Point operations
	GC_0: 0x46,
	GC_1: 0x47,
	SCFS: 0x48,
	MD_0: 0x49,
	MD_1: 0x4a,
	MPPEM: 0x4b,
	MPS: 0x4c,
	FLIPPT: 0x80,
	FLIPRGON: 0x81,
	FLIPRGOFF: 0x82,

	// Point movement
	SHP_0: 0x32,
	SHP_1: 0x33,
	SHC_0: 0x34,
	SHC_1: 0x35,
	SHZ_0: 0x36,
	SHZ_1: 0x37,
	SHPIX: 0x38,
	IP: 0x39,
	MSIRP_0: 0x3a,
	MSIRP_1: 0x3b,
	ALIGNRP: 0x3c,
	RTDG: 0x3d,
	MIAP_0: 0x3e,
	MIAP_1: 0x3f,

	// ALIGNPTS - Align Points
	ALIGNPTS: 0x27,

	// UTP - UnTouch Point
	UTP: 0x29,

	// MDAP - Move Direct Absolute Point
	MDAP_0: 0x2e,
	MDAP_1: 0x2f,

	// IUP - Interpolate Untouched Points
	IUP_Y: 0x30,
	IUP_X: 0x31,

	// Delta instructions
	DELTAP1: 0x5d,
	DELTAP2: 0x71,
	DELTAP3: 0x72,
	DELTAC1: 0x73,
	DELTAC2: 0x74,
	DELTAC3: 0x75,

	// Rounding
	ROUND_0: 0x68,
	ROUND_1: 0x69,
	ROUND_2: 0x6a,
	ROUND_3: 0x6b,
	NROUND_0: 0x6c,
	NROUND_1: 0x6d,
	NROUND_2: 0x6e,
	NROUND_3: 0x6f,

	// Other
	GETINFO: 0x88,
	INSTCTRL: 0x8e,
	SCANCTRL: 0x85,
	SCANTYPE: 0x8d,
	AA: 0x7f,
	DEBUG: 0x4f,

	// MDRP - Move Direct Relative Point (32 variants: 0xc0-0xdf)
	MDRP_BASE: 0xc0,

	// MIRP - Move Indirect Relative Point (32 variants: 0xe0-0xff)
	MIRP_BASE: 0xe0,
} as const;

/**
 * Number of values popped from stack for each opcode
 */
export const OpcodePops: Record<number, number> = {
	[Opcode.RS]: 1,
	[Opcode.WS]: 2,
	[Opcode.RCVT]: 1,
	[Opcode.WCVTP]: 2,
	[Opcode.WCVTF]: 2,
	[Opcode.DUP]: 1,
	[Opcode.POP]: 1,
	[Opcode.CLEAR]: 0,
	[Opcode.SWAP]: 2,
	[Opcode.DEPTH]: 0,
	[Opcode.CINDEX]: 1,
	[Opcode.MINDEX]: 1,
	[Opcode.ROLL]: 3,
	[Opcode.ADD]: 2,
	[Opcode.SUB]: 2,
	[Opcode.DIV]: 2,
	[Opcode.MUL]: 2,
	[Opcode.ABS]: 1,
	[Opcode.NEG]: 1,
	[Opcode.FLOOR]: 1,
	[Opcode.CEILING]: 1,
	[Opcode.MAX]: 2,
	[Opcode.MIN]: 2,
	[Opcode.LT]: 2,
	[Opcode.LTEQ]: 2,
	[Opcode.GT]: 2,
	[Opcode.GTEQ]: 2,
	[Opcode.EQ]: 2,
	[Opcode.NEQ]: 2,
	[Opcode.ODD]: 1,
	[Opcode.EVEN]: 1,
	[Opcode.AND]: 2,
	[Opcode.OR]: 2,
	[Opcode.NOT]: 1,
	[Opcode.IF]: 1,
	[Opcode.JMPR]: 1,
	[Opcode.JROT]: 2,
	[Opcode.JROF]: 2,
	[Opcode.CALL]: 1,
	[Opcode.LOOPCALL]: 2,
	[Opcode.SRP0]: 1,
	[Opcode.SRP1]: 1,
	[Opcode.SRP2]: 1,
	[Opcode.SZP0]: 1,
	[Opcode.SZP1]: 1,
	[Opcode.SZP2]: 1,
	[Opcode.SZPS]: 1,
	[Opcode.SLOOP]: 1,
	[Opcode.SMD]: 1,
	[Opcode.SCVTCI]: 1,
	[Opcode.SSWCI]: 1,
	[Opcode.SSW]: 1,
	[Opcode.SDB]: 1,
	[Opcode.SDS]: 1,
	[Opcode.SPVFS]: 2,
	[Opcode.SFVFS]: 2,
	[Opcode.SPVTL_0]: 2,
	[Opcode.SPVTL_1]: 2,
	[Opcode.SFVTL_0]: 2,
	[Opcode.SFVTL_1]: 2,
	[Opcode.SCFS]: 2,
	[Opcode.GC_0]: 1,
	[Opcode.GC_1]: 1,
	[Opcode.MD_0]: 2,
	[Opcode.MD_1]: 2,
	[Opcode.ISECT]: 5,
	[Opcode.ALIGNRP]: 0, // Uses loop
	[Opcode.IP]: 0, // Uses loop
	[Opcode.SHPIX]: 1, // Plus loop points
	[Opcode.MSIRP_0]: 2,
	[Opcode.MSIRP_1]: 2,
	[Opcode.MIAP_0]: 2,
	[Opcode.MIAP_1]: 2,
	[Opcode.MDAP_0]: 1,
	[Opcode.MDAP_1]: 1,
	[Opcode.DELTAP1]: 1,
	[Opcode.DELTAP2]: 1,
	[Opcode.DELTAP3]: 1,
	[Opcode.DELTAC1]: 1,
	[Opcode.DELTAC2]: 1,
	[Opcode.DELTAC3]: 1,
	[Opcode.SROUND]: 1,
	[Opcode.S45ROUND]: 1,
	[Opcode.ROUND_0]: 1,
	[Opcode.ROUND_1]: 1,
	[Opcode.ROUND_2]: 1,
	[Opcode.ROUND_3]: 1,
	[Opcode.NROUND_0]: 1,
	[Opcode.NROUND_1]: 1,
	[Opcode.NROUND_2]: 1,
	[Opcode.NROUND_3]: 1,
	[Opcode.INSTCTRL]: 2,
	[Opcode.SCANCTRL]: 1,
	[Opcode.SCANTYPE]: 1,
	[Opcode.GETINFO]: 1,
	[Opcode.FLIPPT]: 0, // Uses loop
	[Opcode.FLIPRGON]: 2,
	[Opcode.FLIPRGOFF]: 2,
};
