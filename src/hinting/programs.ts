/**
 * TrueType Hinting Program Execution
 *
 * This module handles the setup and execution of TrueType hinting programs:
 * - fpgm: Font program (executed once when font is loaded)
 * - prep: CVT program (executed when size changes)
 * - glyph: Per-glyph instructions
 */

import {
	runCVTProgram,
	runFontProgram,
	runGlyphProgram,
	setCodeRange,
} from "./interpreter.ts";
import {
	CodeRange,
	createExecContext,
	createGlyphZone,
	type ExecContext,
} from "./types.ts";

/**
 * Hinting engine for a font
 */
export interface HintingEngine {
	/** Execution context */
	ctx: ExecContext;
	/** Units per EM from font */
	unitsPerEM: number;
	/** Has fpgm been executed */
	fpgmExecuted: boolean;
	/** Current ppem (prep needs re-run if this changes) */
	currentPpem: number;
}

/**
 * Create a hinting engine for a font
 */
export function createHintingEngine(
	unitsPerEM: number,
	maxStack: number = 256,
	maxStorage: number = 64,
	maxFDefs: number = 64,
	maxTwilightPoints: number = 16,
	cvtValues?: Int32Array,
): HintingEngine {
	const ctx = createExecContext(
		maxStack,
		maxStorage,
		maxFDefs,
		maxFDefs, // maxIDefs
		32, // maxCallStack
		maxTwilightPoints,
	);

	// Initialize CVT if provided
	if (cvtValues) {
		ctx.cvt = new Int32Array(cvtValues);
		ctx.cvtSize = cvtValues.length;
	}

	return {
		ctx,
		unitsPerEM,
		fpgmExecuted: false,
		currentPpem: 0,
	};
}

/**
 * Load font program (fpgm table)
 */
export function loadFontProgram(engine: HintingEngine, fpgm: Uint8Array): void {
	setCodeRange(engine.ctx, CodeRange.Font, fpgm);
}

/**
 * Load CVT program (prep table)
 */
export function loadCVTProgram(engine: HintingEngine, prep: Uint8Array): void {
	setCodeRange(engine.ctx, CodeRange.CVT, prep);
}

/**
 * Execute fpgm (should be called once after font load)
 */
export function executeFontProgram(engine: HintingEngine): string | null {
	if (engine.fpgmExecuted) return null;

	engine.ctx.error = null;
	runFontProgram(engine.ctx);
	engine.fpgmExecuted = true;

	return engine.ctx.error;
}

/**
 * Set up for a specific size and execute prep if needed
 */
export function setSize(
	engine: HintingEngine,
	ppem: number,
	pointSize: number,
): string | null {
	// Always run fpgm first if not done
	if (!engine.fpgmExecuted) {
		const fpgmError = executeFontProgram(engine);
		if (fpgmError) return fpgmError;
	}

	// Skip prep if size hasn't changed
	if (engine.currentPpem === ppem) return null;

	// Calculate scale factor: font units to 26.6 pixels
	// scale = ppem / unitsPerEM * 64 (for 26.6 format)
	engine.ctx.scale = (ppem * 64) / engine.unitsPerEM;
	engine.ctx.ppem = ppem;
	engine.ctx.pointSize = pointSize;

	// Scale CVT values from font units to pixels
	scaleCVT(engine.ctx);

	// Run prep program
	engine.ctx.error = null;
	runCVTProgram(engine.ctx);
	engine.currentPpem = ppem;

	return engine.ctx.error;
}

/**
 * Scale CVT values from font units to 26.6 pixels
 */
function scaleCVT(ctx: ExecContext): void {
	for (let i = 0; i < ctx.cvtSize; i++) {
		ctx.cvt[i] = Math.round(ctx.cvt[i] * ctx.scale);
	}
}

/**
 * Glyph outline for hinting
 */
export interface GlyphOutline {
	/** X coordinates in font units */
	xCoords: number[];
	/** Y coordinates in font units */
	yCoords: number[];
	/** Point flags (bit 0 = on-curve) */
	flags: Uint8Array;
	/** End point indices for each contour */
	contourEnds: number[];
	/** Glyph instructions */
	instructions: Uint8Array;
	/** Left side bearing in font units (for phantom point) */
	lsb?: number;
	/** Advance width in font units (for phantom point) */
	advanceWidth?: number;
	/** Top side bearing in font units (for vertical phantom point) */
	tsb?: number;
	/** Advance height in font units (for vertical phantom point) */
	advanceHeight?: number;
}

/**
 * Hinted glyph result
 */
export interface HintedGlyph {
	/** Hinted X coordinates in 26.6 pixels */
	xCoords: number[];
	/** Hinted Y coordinates in 26.6 pixels */
	yCoords: number[];
	/** Point flags */
	flags: Uint8Array;
	/** Contour end indices */
	contourEnds: number[];
	/** Error message if hinting failed */
	error: string | null;
}

/**
 * Hint a glyph
 */
export function hintGlyph(
	engine: HintingEngine,
	outline: GlyphOutline,
): HintedGlyph {
	const ctx = engine.ctx;
	const nPoints = outline.xCoords.length;
	const nContours = outline.contourEnds.length;

	// Add phantom points (4 points after glyph points)
	const totalPoints = nPoints + 4;

	// Set up glyph zone
	const zone = createGlyphZone(totalPoints, nContours);
	zone.nPoints = totalPoints;
	zone.nContours = nContours;

	// Scale and copy point coordinates
	for (let i = 0; i < nPoints; i++) {
		const x = Math.round(outline.xCoords[i] * ctx.scale);
		const y = Math.round(outline.yCoords[i] * ctx.scale);

		zone.org[i].x = x;
		zone.org[i].y = y;
		zone.cur[i].x = x;
		zone.cur[i].y = y;
		zone.orus[i].x = outline.xCoords[i];
		zone.orus[i].y = outline.yCoords[i];
		zone.tags[i] = outline.flags[i];
	}

	// Set up phantom points (for horizontal/vertical metrics)
	// Point n: origin (xMin - lsb, 0)
	// Point n+1: advance width point (origin.x + advanceWidth, 0)
	// Point n+2: top origin (0, yMax + tsb) - for vertical
	// Point n+3: bottom point (0, top - advanceHeight) - for vertical

	// Calculate xMin from outline for phantom point positioning
	let xMin = Infinity;
	for (let i = 0; i < nPoints; i++) {
		if (outline.xCoords[i] < xMin) xMin = outline.xCoords[i];
	}
	if (!Number.isFinite(xMin)) xMin = 0;

	const lsb = outline.lsb ?? 0;
	const advW = outline.advanceWidth ?? 0;

	// Phantom point 0: horizontal origin
	const pp0x = Math.round((xMin - lsb) * ctx.scale);
	zone.org[nPoints].x = pp0x;
	zone.org[nPoints].y = 0;
	zone.cur[nPoints].x = pp0x;
	zone.cur[nPoints].y = 0;
	zone.orus[nPoints].x = xMin - lsb;
	zone.orus[nPoints].y = 0;
	zone.tags[nPoints] = 0;

	// Phantom point 1: advance width
	const pp1x = Math.round((xMin - lsb + advW) * ctx.scale);
	zone.org[nPoints + 1].x = pp1x;
	zone.org[nPoints + 1].y = 0;
	zone.cur[nPoints + 1].x = pp1x;
	zone.cur[nPoints + 1].y = 0;
	zone.orus[nPoints + 1].x = xMin - lsb + advW;
	zone.orus[nPoints + 1].y = 0;
	zone.tags[nPoints + 1] = 0;

	// Phantom points 2 & 3: vertical metrics (simplified - set to 0)
	for (let i = nPoints + 2; i < totalPoints; i++) {
		zone.org[i].x = 0;
		zone.org[i].y = 0;
		zone.cur[i].x = 0;
		zone.cur[i].y = 0;
		zone.orus[i].x = 0;
		zone.orus[i].y = 0;
		zone.tags[i] = 0;
	}

	// Copy contour ends
	for (let i = 0; i < nContours; i++) {
		zone.contours[i] = outline.contourEnds[i];
	}

	// Set up context
	ctx.pts = zone;
	ctx.zp0 = zone;
	ctx.zp1 = zone;
	ctx.zp2 = zone;

	// Reset twilight zone
	ctx.twilight.nPoints = ctx.twilight.org.length;
	for (let i = 0; i < ctx.twilight.nPoints; i++) {
		ctx.twilight.org[i].x = 0;
		ctx.twilight.org[i].y = 0;
		ctx.twilight.cur[i].x = 0;
		ctx.twilight.cur[i].y = 0;
		ctx.twilight.tags[i] = 0;
	}

	// Run glyph instructions
	ctx.error = null;
	if (outline.instructions.length > 0) {
		runGlyphProgram(ctx, outline.instructions);
	}

	// Extract results
	const xCoords = new Array<number>(nPoints);
	const yCoords = new Array<number>(nPoints);

	for (let i = 0; i < nPoints; i++) {
		xCoords[i] = zone.cur[i]?.x;
		yCoords[i] = zone.cur[i]?.y;
	}

	return {
		xCoords,
		yCoords,
		flags: outline.flags,
		contourEnds: outline.contourEnds,
		error: ctx.error,
	};
}

/**
 * Convert hinted coordinates from 26.6 to floating point pixels
 */
export function hintedToPixels(coords: number[]): number[] {
	return coords.map((c) => c / 64);
}
