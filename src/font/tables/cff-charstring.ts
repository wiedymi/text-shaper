import type { GlyphId } from "../../types.ts";
import type { CffTable } from "./cff.ts";
import type { Cff2Table, ItemVariationStore } from "./cff2.ts";
import type { Contour, GlyphPoint } from "./glyf.ts";

/**
 * CFF CharString interpreter
 * Executes Type 2 CharString programs to produce glyph outlines
 */

// CharString operators
enum Op {
	// Path construction
	hstem = 1,
	vstem = 3,
	vmoveto = 4,
	rlineto = 5,
	hlineto = 6,
	vlineto = 7,
	rrcurveto = 8,
	callsubr = 10,
	return_ = 11,
	endchar = 14,
	hstemhm = 18,
	hintmask = 19,
	cntrmask = 20,
	rmoveto = 21,
	hmoveto = 22,
	vstemhm = 23,
	rcurveline = 24,
	rlinecurve = 25,
	vvcurveto = 26,
	hhcurveto = 27,
	callgsubr = 29,
	vhcurveto = 30,
	hvcurveto = 31,

	// Two-byte operators (12 xx)
	dotsection = 0x0c00,
	and_ = 0x0c03,
	or_ = 0x0c04,
	not_ = 0x0c05,
	abs_ = 0x0c09,
	add_ = 0x0c0a,
	sub_ = 0x0c0b,
	div_ = 0x0c0c,
	neg_ = 0x0c0e,
	eq_ = 0x0c0f,
	drop_ = 0x0c12,
	put_ = 0x0c14,
	get_ = 0x0c15,
	ifelse_ = 0x0c16,
	random_ = 0x0c17,
	mul_ = 0x0c18,
	sqrt_ = 0x0c1a,
	dup_ = 0x0c1b,
	exch_ = 0x0c1c,
	index_ = 0x0c1d,
	roll_ = 0x0c1e,
	hflex = 0x0c22,
	flex = 0x0c23,
	hflex1 = 0x0c24,
	flex1 = 0x0c25,

	// CFF2 operators
	vsindex = 15,
	blend = 16,
}

interface CharStringState {
	x: number;
	y: number;
	stack: number[];
	/** Current read position for shift-like operations (O(1) instead of O(n) shift) */
	stackPos: number;
	nStems: number;
	haveWidth: boolean;
	width: number;
	contours: Contour[];
	currentContour: GlyphPoint[];
	transientArray: number[];
	// For subroutine calls
	callStack: { data: Uint8Array; pos: number }[];
	// For CFF2 blending
	vsindex: number;
	axisCoords: number[] | null;
	vstore: ItemVariationStore | null;
}

/** Get number of available stack values (from stackPos to end) */
function stackLen(state: CharStringState): number {
	return state.stack.length - state.stackPos;
}

/** Read next value from stack (replaces shift - O(1)) */
function stackShift(state: CharStringState): number | undefined {
	if (state.stackPos >= state.stack.length) return undefined;
	return state.stack[state.stackPos++];
}

/** Clear the stack (reset both pointer and length) */
function stackClear(state: CharStringState): void {
	state.stack.length = 0;
	state.stackPos = 0;
}

/**
 * Execute a CFF charstring and return contours
 */
export function executeCffCharString(
	cff: CffTable,
	glyphId: GlyphId,
	fontIndex: number = 0,
): Contour[] | null {
	const charStrings = cff.charStrings[fontIndex];
	if (!charStrings || glyphId >= charStrings.length) return null;

	const charString = charStrings[glyphId];
	if (!charString) return null;

	const globalSubrs = cff.globalSubrs;

	// For CID fonts, use fdSelect to get the right FD and its local subrs
	const topDict = cff.topDicts[fontIndex];
	const isCID = topDict?.ros !== undefined;
	let localSubrs: Uint8Array[] = [];

	if (isCID && cff.fdSelects[fontIndex] && cff.fdArrays[fontIndex]) {
		const fdIndex = cff.fdSelects[fontIndex]?.select(glyphId) ?? 0;
		const fdArray = cff.fdArrays[fontIndex];
		const fd = fdArray?.[fdIndex];
		// Use FD-specific local subrs if available
		localSubrs = fd?.localSubrs || cff.localSubrs[fontIndex] || [];
	} else {
		localSubrs = cff.localSubrs[fontIndex] || [];
	}

	const state: CharStringState = {
		x: 0,
		y: 0,
		stack: [],
		stackPos: 0,
		nStems: 0,
		haveWidth: false,
		width: 0,
		contours: [],
		currentContour: [],
		transientArray: new Array(32).fill(0),
		callStack: [],
		vsindex: 0,
		axisCoords: null,
		vstore: null,
	};

	executeCharString(state, charString, globalSubrs, localSubrs);

	// Close any open contour
	if (state.currentContour.length > 0) {
		state.contours.push(state.currentContour);
	}

	return state.contours;
}

/**
 * Execute a CFF2 charstring with variation support
 */
export function executeCff2CharString(
	cff2: Cff2Table,
	glyphId: GlyphId,
	axisCoords: number[] | null = null,
): Contour[] | null {
	if (glyphId >= cff2.charStrings.length) return null;

	const charString = cff2.charStrings[glyphId];
	if (!charString) return null;

	const globalSubrs = cff2.globalSubrs;

	// Get FD index and local subrs
	const fdIndex = cff2.fdSelect?.select(glyphId) ?? 0;
	const fd = cff2.fdArray[fdIndex];
	const localSubrs = fd?.localSubrs || [];

	const state: CharStringState = {
		x: 0,
		y: 0,
		stack: [],
		stackPos: 0,
		nStems: 0,
		haveWidth: true, // CFF2 doesn't have width in charstring
		width: 0,
		contours: [],
		currentContour: [],
		transientArray: new Array(32).fill(0),
		callStack: [],
		vsindex: fd?.private?.vsindex ?? 0,
		axisCoords,
		vstore: cff2.vstore,
	};

	executeCharString(state, charString, globalSubrs, localSubrs);

	// Close any open contour
	if (state.currentContour.length > 0) {
		state.contours.push(state.currentContour);
	}

	return state.contours;
}

function executeCharString(
	state: CharStringState,
	data: Uint8Array,
	globalSubrs: Uint8Array[],
	localSubrs: Uint8Array[],
): void {
	let pos = 0;

	while (pos < data.length) {
		const b0 = data[pos++];
		if (b0 === undefined) return;

		if (b0 === 28) {
			// 16-bit signed integer
			const b1 = data[pos++];
			if (b1 === undefined) return;
			const b2 = data[pos++];
			if (b2 === undefined) return;
			state.stack.push((((b1 << 8) | b2) << 16) >> 16);
		} else if (b0 === 255) {
			// 32-bit fixed point (16.16)
			const b1 = data[pos++];
			if (b1 === undefined) return;
			const b2 = data[pos++];
			if (b2 === undefined) return;
			const b3 = data[pos++];
			if (b3 === undefined) return;
			const b4 = data[pos++];
			if (b4 === undefined) return;
			const val = ((b1 << 24) | (b2 << 16) | (b3 << 8) | b4) >> 0;
			state.stack.push(val / 65536);
		} else if (b0 >= 32 && b0 <= 246) {
			state.stack.push(b0 - 139);
		} else if (b0 >= 247 && b0 <= 250) {
			const b1 = data[pos++];
			if (b1 === undefined) return;
			state.stack.push((b0 - 247) * 256 + b1 + 108);
		} else if (b0 >= 251 && b0 <= 254) {
			const b1 = data[pos++];
			if (b1 === undefined) return;
			state.stack.push(-(b0 - 251) * 256 - b1 - 108);
		} else if (b0 === 12) {
			// Two-byte operator
			const b1 = data[pos++];
			if (b1 === undefined) return;
			const op = 0x0c00 | b1;
			executeOperator(state, op, globalSubrs, localSubrs);
		} else if (b0 === Op.hintmask || b0 === Op.cntrmask) {
			// hintmask/cntrmask: process stems from stack, then skip mask bytes
			const len = stackLen(state);
			const hasWidth = len % 2 !== 0;
			if (hasWidth && !state.haveWidth) {
				const width = stackShift(state);
				if (width !== undefined) {
					state.width = width;
					state.haveWidth = true;
				}
			}
			state.nStems += stackLen(state) / 2;
			stackClear(state);
			// Skip mask bytes (ceil(nStems / 8) bytes)
			const maskBytes = Math.ceil(state.nStems / 8);
			pos += maskBytes;
		} else {
			// Single-byte operator
			executeOperator(state, b0, globalSubrs, localSubrs);
		}

		// Handle return from subroutine
		if (state.callStack.length > 0) {
			const frame = state.callStack[state.callStack.length - 1];
			if (frame && frame.pos >= frame.data.length) {
				state.callStack.pop();
			}
		}
	}
}

function executeOperator(
	state: CharStringState,
	op: number,
	globalSubrs: Uint8Array[],
	localSubrs: Uint8Array[],
): void {
	const stack = state.stack;

	switch (op) {
		case Op.hstem:
		case Op.vstem:
		case Op.hstemhm:
		case Op.vstemhm: {
			// Stem hints
			const len = stackLen(state);
			const hasWidth = len % 2 !== 0;
			if (hasWidth && !state.haveWidth) {
				const width = stackShift(state);
				if (width === undefined) break;
				state.width = width;
				state.haveWidth = true;
			}
			state.nStems += stackLen(state) / 2;
			stackClear(state);
			break;
		}

		case Op.hintmask:
		case Op.cntrmask:
			// Handled inline in executeCharString to skip mask bytes
			break;

		case Op.rmoveto: {
			if (stackLen(state) > 2 && !state.haveWidth) {
				const width = stackShift(state);
				if (width === undefined) break;
				state.width = width;
				state.haveWidth = true;
			}
			// Close current contour if any
			if (state.currentContour.length > 0) {
				state.contours.push(state.currentContour);
				state.currentContour = [];
			}
			// rmoveto uses shift order: dx dy
			const dx = stackShift(state);
			if (dx === undefined) break;
			const dy = stackShift(state);
			if (dy === undefined) break;
			state.x += dx;
			state.y += dy;
			state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
			stackClear(state);
			break;
		}

		case Op.hmoveto: {
			if (stackLen(state) > 1 && !state.haveWidth) {
				const width = stackShift(state);
				if (width === undefined) break;
				state.width = width;
				state.haveWidth = true;
			}
			if (state.currentContour.length > 0) {
				state.contours.push(state.currentContour);
				state.currentContour = [];
			}
			const dx = stackShift(state);
			if (dx === undefined) break;
			state.x += dx;
			state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
			stackClear(state);
			break;
		}

		case Op.vmoveto: {
			if (stackLen(state) > 1 && !state.haveWidth) {
				const width = stackShift(state);
				if (width === undefined) break;
				state.width = width;
				state.haveWidth = true;
			}
			if (state.currentContour.length > 0) {
				state.contours.push(state.currentContour);
				state.currentContour = [];
			}
			const dy = stackShift(state);
			if (dy === undefined) break;
			state.y += dy;
			state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
			stackClear(state);
			break;
		}

		case Op.rlineto: {
			while (stackLen(state) >= 2) {
				const dx = stackShift(state);
				if (dx === undefined) break;
				const dy = stackShift(state);
				if (dy === undefined) break;
				state.x += dx;
				state.y += dy;
				state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
			}
			break;
		}

		case Op.hlineto: {
			let isHorizontal = true;
			while (stackLen(state) >= 1) {
				const val = stackShift(state);
				if (val === undefined) break;
				if (isHorizontal) {
					state.x += val;
				} else {
					state.y += val;
				}
				state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
				isHorizontal = !isHorizontal;
			}
			break;
		}

		case Op.vlineto: {
			let isVertical = true;
			while (stackLen(state) >= 1) {
				const val = stackShift(state);
				if (val === undefined) break;
				if (isVertical) {
					state.y += val;
				} else {
					state.x += val;
				}
				state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
				isVertical = !isVertical;
			}
			break;
		}

		case Op.rrcurveto: {
			while (stackLen(state) >= 6) {
				const dx1 = stackShift(state);
				if (dx1 === undefined) break;
				const dy1 = stackShift(state);
				if (dy1 === undefined) break;
				const dx2 = stackShift(state);
				if (dx2 === undefined) break;
				const dy2 = stackShift(state);
				if (dy2 === undefined) break;
				const dx3 = stackShift(state);
				if (dx3 === undefined) break;
				const dy3 = stackShift(state);
				if (dy3 === undefined) break;
				addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, dy3);
			}
			break;
		}

		case Op.hhcurveto: {
			let dy1 = 0;
			if (stackLen(state) % 4 === 1) {
				const val = stackShift(state);
				if (val === undefined) break;
				dy1 = val;
			}
			while (stackLen(state) >= 4) {
				const dx1 = stackShift(state);
				if (dx1 === undefined) break;
				const dx2 = stackShift(state);
				if (dx2 === undefined) break;
				const dy2 = stackShift(state);
				if (dy2 === undefined) break;
				const dx3 = stackShift(state);
				if (dx3 === undefined) break;
				addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, 0);
				dy1 = 0;
			}
			break;
		}

		case Op.vvcurveto: {
			let dx1 = 0;
			if (stackLen(state) % 4 === 1) {
				const val = stackShift(state);
				if (val === undefined) break;
				dx1 = val;
			}
			while (stackLen(state) >= 4) {
				const dy1 = stackShift(state);
				if (dy1 === undefined) break;
				const dx2 = stackShift(state);
				if (dx2 === undefined) break;
				const dy2 = stackShift(state);
				if (dy2 === undefined) break;
				const dy3 = stackShift(state);
				if (dy3 === undefined) break;
				addCubicBezier(state, dx1, dy1, dx2, dy2, 0, dy3);
				dx1 = 0;
			}
			break;
		}

		case Op.hvcurveto: {
			// Alternates horizontal/vertical starting tangent
			let isHorizontal = true;
			while (stackLen(state) >= 4) {
				if (isHorizontal) {
					const dx1 = stackShift(state);
					if (dx1 === undefined) break;
					const dx2 = stackShift(state);
					if (dx2 === undefined) break;
					const dy2 = stackShift(state);
					if (dy2 === undefined) break;
					const dy3 = stackShift(state);
					if (dy3 === undefined) break;
					const dx3 = stackLen(state) === 1 ? (stackShift(state) ?? 0) : 0;
					addCubicBezier(state, dx1, 0, dx2, dy2, dx3, dy3);
				} else {
					const dy1 = stackShift(state);
					if (dy1 === undefined) break;
					const dx2 = stackShift(state);
					if (dx2 === undefined) break;
					const dy2 = stackShift(state);
					if (dy2 === undefined) break;
					const dx3 = stackShift(state);
					if (dx3 === undefined) break;
					const dy3 = stackLen(state) === 1 ? (stackShift(state) ?? 0) : 0;
					addCubicBezier(state, 0, dy1, dx2, dy2, dx3, dy3);
				}
				isHorizontal = !isHorizontal;
			}
			break;
		}

		case Op.vhcurveto: {
			// Alternates vertical/horizontal starting tangent
			let isVertical = true;
			while (stackLen(state) >= 4) {
				if (isVertical) {
					const dy1 = stackShift(state);
					if (dy1 === undefined) break;
					const dx2 = stackShift(state);
					if (dx2 === undefined) break;
					const dy2 = stackShift(state);
					if (dy2 === undefined) break;
					const dx3 = stackShift(state);
					if (dx3 === undefined) break;
					const dy3 = stackLen(state) === 1 ? (stackShift(state) ?? 0) : 0;
					addCubicBezier(state, 0, dy1, dx2, dy2, dx3, dy3);
				} else {
					const dx1 = stackShift(state);
					if (dx1 === undefined) break;
					const dx2 = stackShift(state);
					if (dx2 === undefined) break;
					const dy2 = stackShift(state);
					if (dy2 === undefined) break;
					const dy3 = stackShift(state);
					if (dy3 === undefined) break;
					const dx3 = stackLen(state) === 1 ? (stackShift(state) ?? 0) : 0;
					addCubicBezier(state, dx1, 0, dx2, dy2, dx3, dy3);
				}
				isVertical = !isVertical;
			}
			break;
		}

		case Op.rcurveline: {
			while (stackLen(state) >= 8) {
				const dx1 = stackShift(state);
				if (dx1 === undefined) break;
				const dy1 = stackShift(state);
				if (dy1 === undefined) break;
				const dx2 = stackShift(state);
				if (dx2 === undefined) break;
				const dy2 = stackShift(state);
				if (dy2 === undefined) break;
				const dx3 = stackShift(state);
				if (dx3 === undefined) break;
				const dy3 = stackShift(state);
				if (dy3 === undefined) break;
				addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, dy3);
			}
			// Final line
			if (stackLen(state) >= 2) {
				const dx = stackShift(state);
				if (dx === undefined) break;
				const dy = stackShift(state);
				if (dy === undefined) break;
				state.x += dx;
				state.y += dy;
				state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
			}
			break;
		}

		case Op.rlinecurve: {
			while (stackLen(state) >= 8) {
				const dx = stackShift(state);
				if (dx === undefined) break;
				const dy = stackShift(state);
				if (dy === undefined) break;
				state.x += dx;
				state.y += dy;
				state.currentContour.push({ x: state.x, y: state.y, onCurve: true });
			}
			// Final curve
			if (stackLen(state) >= 6) {
				const dx1 = stackShift(state);
				if (dx1 === undefined) break;
				const dy1 = stackShift(state);
				if (dy1 === undefined) break;
				const dx2 = stackShift(state);
				if (dx2 === undefined) break;
				const dy2 = stackShift(state);
				if (dy2 === undefined) break;
				const dx3 = stackShift(state);
				if (dx3 === undefined) break;
				const dy3 = stackShift(state);
				if (dy3 === undefined) break;
				addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, dy3);
			}
			break;
		}

		case Op.callsubr: {
			const index = stack.pop();
			if (index === undefined) break;
			const biasedIndex = index + getSubrBias(localSubrs.length);
			const subr = localSubrs[biasedIndex];
			if (subr) {
				executeCharString(state, subr, globalSubrs, localSubrs);
			}
			break;
		}

		case Op.callgsubr: {
			const index = stack.pop();
			if (index === undefined) break;
			const biasedIndex = index + getSubrBias(globalSubrs.length);
			const subr = globalSubrs[biasedIndex];
			if (subr) {
				executeCharString(state, subr, globalSubrs, localSubrs);
			}
			break;
		}

		case Op.return_:
			// Return from subroutine - handled by caller
			break;

		case Op.endchar: {
			if (stackLen(state) > 0 && !state.haveWidth) {
				const width = stackShift(state);
				if (width === undefined) break;
				state.width = width;
				state.haveWidth = true;
			}
			// Close current contour
			if (state.currentContour.length > 0) {
				state.contours.push(state.currentContour);
				state.currentContour = [];
			}
			stackClear(state);
			break;
		}

		// Flex operators
		case Op.flex: {
			// 12 arguments: dx1 dy1 dx2 dy2 dx3 dy3 dx4 dy4 dx5 dy5 dx6 dy6 fd
			if (stackLen(state) >= 13) {
				const dx1 = stackShift(state);
				if (dx1 === undefined) break;
				const dy1 = stackShift(state);
				if (dy1 === undefined) break;
				const dx2 = stackShift(state);
				if (dx2 === undefined) break;
				const dy2 = stackShift(state);
				if (dy2 === undefined) break;
				const dx3 = stackShift(state);
				if (dx3 === undefined) break;
				const dy3 = stackShift(state);
				if (dy3 === undefined) break;
				const dx4 = stackShift(state);
				if (dx4 === undefined) break;
				const dy4 = stackShift(state);
				if (dy4 === undefined) break;
				const dx5 = stackShift(state);
				if (dx5 === undefined) break;
				const dy5 = stackShift(state);
				if (dy5 === undefined) break;
				const dx6 = stackShift(state);
				if (dx6 === undefined) break;
				const dy6 = stackShift(state);
				if (dy6 === undefined) break;
				stackShift(state); // fd (flex depth) - not used for rendering
				addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, dy3);
				addCubicBezier(state, dx4, dy4, dx5, dy5, dx6, dy6);
			}
			break;
		}

		case Op.hflex: {
			// dx1 dx2 dy2 dx3 dx4 dx5 dx6
			if (stackLen(state) >= 7) {
				const dx1 = stackShift(state);
				if (dx1 === undefined) break;
				const dx2 = stackShift(state);
				if (dx2 === undefined) break;
				const dy2 = stackShift(state);
				if (dy2 === undefined) break;
				const dx3 = stackShift(state);
				if (dx3 === undefined) break;
				const dx4 = stackShift(state);
				if (dx4 === undefined) break;
				const dx5 = stackShift(state);
				if (dx5 === undefined) break;
				const dx6 = stackShift(state);
				if (dx6 === undefined) break;
				addCubicBezier(state, dx1, 0, dx2, dy2, dx3, 0);
				addCubicBezier(state, dx4, 0, dx5, -dy2, dx6, 0);
			}
			break;
		}

		case Op.hflex1: {
			// dx1 dy1 dx2 dy2 dx3 dx4 dx5 dy5 dx6
			if (stackLen(state) >= 9) {
				const dx1 = stackShift(state);
				if (dx1 === undefined) break;
				const dy1 = stackShift(state);
				if (dy1 === undefined) break;
				const dx2 = stackShift(state);
				if (dx2 === undefined) break;
				const dy2 = stackShift(state);
				if (dy2 === undefined) break;
				const dx3 = stackShift(state);
				if (dx3 === undefined) break;
				const dx4 = stackShift(state);
				if (dx4 === undefined) break;
				const dx5 = stackShift(state);
				if (dx5 === undefined) break;
				const dy5 = stackShift(state);
				if (dy5 === undefined) break;
				const dx6 = stackShift(state);
				if (dx6 === undefined) break;
				addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, 0);
				addCubicBezier(state, dx4, 0, dx5, dy5, dx6, -(dy1 + dy2 + dy5));
			}
			break;
		}

		case Op.flex1: {
			// dx1 dy1 dx2 dy2 dx3 dy3 dx4 dy4 dx5 dy5 d6
			if (stackLen(state) >= 11) {
				const dx1 = stackShift(state);
				if (dx1 === undefined) break;
				const dy1 = stackShift(state);
				if (dy1 === undefined) break;
				const dx2 = stackShift(state);
				if (dx2 === undefined) break;
				const dy2 = stackShift(state);
				if (dy2 === undefined) break;
				const dx3 = stackShift(state);
				if (dx3 === undefined) break;
				const dy3 = stackShift(state);
				if (dy3 === undefined) break;
				const dx4 = stackShift(state);
				if (dx4 === undefined) break;
				const dy4 = stackShift(state);
				if (dy4 === undefined) break;
				const dx5 = stackShift(state);
				if (dx5 === undefined) break;
				const dy5 = stackShift(state);
				if (dy5 === undefined) break;
				const d6 = stackShift(state);
				if (d6 === undefined) break;

				const dx = dx1 + dx2 + dx3 + dx4 + dx5;
				const dy = dy1 + dy2 + dy3 + dy4 + dy5;

				let dx6: number, dy6: number;
				if (Math.abs(dx) > Math.abs(dy)) {
					dx6 = d6;
					dy6 = -dy;
				} else {
					dx6 = -dx;
					dy6 = d6;
				}

				addCubicBezier(state, dx1, dy1, dx2, dy2, dx3, dy3);
				addCubicBezier(state, dx4, dy4, dx5, dy5, dx6, dy6);
			}
			break;
		}

		// Arithmetic operators
		case Op.and_: {
			const b = stack.pop();
			if (b === undefined) break;
			const a = stack.pop();
			if (a === undefined) break;
			stack.push(a && b ? 1 : 0);
			break;
		}

		case Op.or_: {
			const b = stack.pop();
			if (b === undefined) break;
			const a = stack.pop();
			if (a === undefined) break;
			stack.push(a || b ? 1 : 0);
			break;
		}

		case Op.not_: {
			const a = stack.pop();
			if (a === undefined) break;
			stack.push(a ? 0 : 1);
			break;
		}

		case Op.abs_: {
			const a = stack.pop();
			if (a === undefined) break;
			stack.push(Math.abs(a));
			break;
		}

		case Op.add_: {
			const b = stack.pop();
			if (b === undefined) break;
			const a = stack.pop();
			if (a === undefined) break;
			stack.push(a + b);
			break;
		}

		case Op.sub_: {
			const b = stack.pop();
			if (b === undefined) break;
			const a = stack.pop();
			if (a === undefined) break;
			stack.push(a - b);
			break;
		}

		case Op.div_: {
			const b = stack.pop();
			if (b === undefined) break;
			const a = stack.pop();
			if (a === undefined) break;
			stack.push(a / b);
			break;
		}

		case Op.neg_: {
			const a = stack.pop();
			if (a === undefined) break;
			stack.push(-a);
			break;
		}

		case Op.eq_: {
			const b = stack.pop();
			if (b === undefined) break;
			const a = stack.pop();
			if (a === undefined) break;
			stack.push(a === b ? 1 : 0);
			break;
		}

		case Op.drop_: {
			stack.pop();
			break;
		}

		case Op.put_: {
			const i = stack.pop();
			if (i === undefined) break;
			const val = stack.pop();
			if (val === undefined) break;
			state.transientArray[i] = val;
			break;
		}

		case Op.get_: {
			const i = stack.pop();
			if (i === undefined) break;
			stack.push(state.transientArray[i] ?? 0);
			break;
		}

		case Op.ifelse_: {
			const v2 = stack.pop();
			if (v2 === undefined) break;
			const v1 = stack.pop();
			if (v1 === undefined) break;
			const s2 = stack.pop();
			if (s2 === undefined) break;
			const s1 = stack.pop();
			if (s1 === undefined) break;
			stack.push(v1 <= v2 ? s1 : s2);
			break;
		}

		case Op.random_: {
			stack.push(Math.random());
			break;
		}

		case Op.mul_: {
			const b = stack.pop();
			if (b === undefined) break;
			const a = stack.pop();
			if (a === undefined) break;
			stack.push(a * b);
			break;
		}

		case Op.sqrt_: {
			const a = stack.pop();
			if (a === undefined) break;
			stack.push(Math.sqrt(a));
			break;
		}

		case Op.dup_: {
			const a = stack[stack.length - 1];
			if (a === undefined) break;
			stack.push(a);
			break;
		}

		case Op.exch_: {
			const b = stack.pop();
			if (b === undefined) break;
			const a = stack.pop();
			if (a === undefined) break;
			stack.push(b, a);
			break;
		}

		case Op.index_: {
			const i = stack.pop();
			if (i === undefined) break;
			const idx = stack.length - 1 - i;
			stack.push(stack[idx] ?? 0);
			break;
		}

		case Op.roll_: {
			const j = stack.pop();
			if (j === undefined) break;
			const n = stack.pop();
			if (n === undefined) break;
			if (n > 0) {
				const items = stack.splice(-n);
				const shift = ((j % n) + n) % n;
				for (let i = 0; i < n; i++) {
					const item = items[(i + shift) % n];
					if (item !== undefined) {
						stack.push(item);
					}
				}
			}
			break;
		}

		// CFF2 blend operator
		case Op.blend: {
			if (!state.axisCoords || !state.vstore) break;

			const n = stack.pop();
			if (n === undefined) break;
			const regionCount =
				state.vstore.itemVariationData[state.vsindex]?.regionIndexCount ?? 0;

			// For each of n values, there are regionCount deltas
			const totalDeltaCount = n * regionCount;
			const deltas = stack.splice(-totalDeltaCount);
			const defaults = stack.splice(-n);

			for (let i = 0; i < n; i++) {
				const defaultVal = defaults[i];
				if (defaultVal === undefined) continue;
				let value = defaultVal;
				for (let r = 0; r < regionCount; r++) {
					const delta = deltas[i * regionCount + r];
					if (delta === undefined) continue;
					const scalar = computeRegionScalar(
						state.vstore,
						state.vsindex,
						r,
						state.axisCoords,
					);
					value += delta * scalar;
				}
				stack.push(value);
			}
			break;
		}

		case Op.vsindex: {
			const vsindex = stack.pop();
			if (vsindex === undefined) break;
			state.vsindex = vsindex;
			break;
		}

		case Op.dotsection:
			// Deprecated, ignore
			break;
	}
}

function addCubicBezier(
	state: CharStringState,
	dx1: number,
	dy1: number,
	dx2: number,
	dy2: number,
	dx3: number,
	dy3: number,
): void {
	// CFF uses cubic Beziers
	// Store control points with onCurve: false and special marker for cubic
	// We use a convention: cubic control points are stored as pairs with a special flag

	const x0 = state.x;
	const y0 = state.y;
	const x1 = x0 + dx1;
	const y1 = y0 + dy1;
	const x2 = x1 + dx2;
	const y2 = y1 + dy2;
	const x3 = x2 + dx3;
	const y3 = y2 + dy3;

	// Store as: cp1 (cubic=true), cp2 (cubic=true), endpoint (onCurve=true)
	// The 'cubic' property distinguishes this from TrueType quadratic off-curve points
	state.currentContour.push({
		x: x1,
		y: y1,
		onCurve: false,
		cubic: true,
	} as GlyphPoint);
	state.currentContour.push({
		x: x2,
		y: y2,
		onCurve: false,
		cubic: true,
	} as GlyphPoint);
	state.currentContour.push({ x: x3, y: y3, onCurve: true });

	state.x = x3;
	state.y = y3;
}

function _approximateCubicWithQuadratics(
	state: CharStringState,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	x3: number,
	y3: number,
	depth: number,
): void {
	// Maximum recursion depth
	if (depth > 4) {
		// Just use a simple quadratic approximation
		const qx = (3 * (x1 + x2) - (x0 + x3)) / 4;
		const qy = (3 * (y1 + y2) - (y0 + y3)) / 4;
		state.currentContour.push({ x: qx, y: qy, onCurve: false });
		state.currentContour.push({ x: x3, y: y3, onCurve: true });
		return;
	}

	// Check if cubic is close enough to a quadratic
	// by measuring the distance from control points to the line
	const tolerance = 0.5;

	// Calculate the quadratic control point that would give the same tangents
	const qx = (3 * (x1 + x2) - (x0 + x3)) / 4;
	const qy = (3 * (y1 + y2) - (y0 + y3)) / 4;

	// Check error - simplified check
	const err1 =
		Math.abs(x1 - (x0 + 2 * qx) / 3 - x0 / 3) +
		Math.abs(y1 - (y0 + 2 * qy) / 3 - y0 / 3);
	const err2 =
		Math.abs(x2 - (2 * qx + x3) / 3 - x3 / 3) +
		Math.abs(y2 - (2 * qy + y3) / 3 - y3 / 3);

	if (err1 + err2 < tolerance) {
		// Good enough approximation
		state.currentContour.push({ x: qx, y: qy, onCurve: false });
		state.currentContour.push({ x: x3, y: y3, onCurve: true });
	} else {
		// Subdivide the cubic
		const mx1 = (x0 + x1) / 2;
		const my1 = (y0 + y1) / 2;
		const mx2 = (x1 + x2) / 2;
		const my2 = (y1 + y2) / 2;
		const mx3 = (x2 + x3) / 2;
		const my3 = (y2 + y3) / 2;

		const mmx1 = (mx1 + mx2) / 2;
		const mmy1 = (my1 + my2) / 2;
		const mmx2 = (mx2 + mx3) / 2;
		const mmy2 = (my2 + my3) / 2;

		const midx = (mmx1 + mmx2) / 2;
		const midy = (mmy1 + mmy2) / 2;

		// Recurse on both halves
		_approximateCubicWithQuadratics(
			state,
			x0,
			y0,
			mx1,
			my1,
			mmx1,
			mmy1,
			midx,
			midy,
			depth + 1,
		);
		_approximateCubicWithQuadratics(
			state,
			midx,
			midy,
			mmx2,
			mmy2,
			mx3,
			my3,
			x3,
			y3,
			depth + 1,
		);
	}
}

function getSubrBias(count: number): number {
	if (count < 1240) return 107;
	if (count < 33900) return 1131;
	return 32768;
}

function computeRegionScalar(
	vstore: ItemVariationStore,
	vsindex: number,
	regionIndex: number,
	axisCoords: number[],
): number {
	const data = vstore.itemVariationData[vsindex];
	if (!data) return 0;

	const actualRegionIndex = data.regionIndexes[regionIndex];
	if (actualRegionIndex === undefined) return 0;

	const region = vstore.variationRegionList.regions[actualRegionIndex];
	if (!region) return 0;

	let scalar = 1;
	for (let i = 0; i < region.axes.length && i < axisCoords.length; i++) {
		const coords = region.axes[i];
		if (!coords) continue;
		const coord = axisCoords[i];
		if (coord === undefined) continue;

		if (coord < coords.startCoord || coord > coords.endCoord) {
			return 0;
		}

		if (coord === coords.peakCoord) {
			continue;
		}

		if (coord < coords.peakCoord) {
			scalar *=
				(coord - coords.startCoord) / (coords.peakCoord - coords.startCoord);
		} else {
			scalar *=
				(coords.endCoord - coord) / (coords.endCoord - coords.peakCoord);
		}
	}

	return scalar;
}

/**
 * Get glyph width from CFF charstring
 */
export function getCffGlyphWidth(
	cff: CffTable,
	_glyphId: GlyphId,
	fontIndex: number = 0,
): number {
	// Would need to parse charstring just enough to get width
	// For now, return nominalWidthX as default
	const _topDict = cff.topDicts[fontIndex];
	return 0; // Proper implementation would parse the charstring
}
