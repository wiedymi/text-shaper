import type { GlyphId, int16, uint8, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";
import type { GvarTable, PointDelta } from "./gvar.ts";
import { calculateTupleScalar } from "./gvar.ts";
import type { LocaTable } from "./loca.ts";
import { getGlyphLocation } from "./loca.ts";

/**
 * glyf table - Glyph outline data
 * Contains TrueType glyph contours as quadratic Bézier curves
 */

/** Point flags */
export const PointFlag = {
	OnCurve: 0x01,
	XShortVector: 0x02,
	YShortVector: 0x04,
	Repeat: 0x08,
	XIsSameOrPositive: 0x10,
	YIsSameOrPositive: 0x20,
	OverlapSimple: 0x40,
} as const;

/** Composite glyph flags */
export const CompositeFlag = {
	Arg1And2AreWords: 0x0001,
	ArgsAreXYValues: 0x0002,
	RoundXYToGrid: 0x0004,
	WeHaveAScale: 0x0008,
	MoreComponents: 0x0020,
	WeHaveAnXAndYScale: 0x0040,
	WeHaveATwoByTwo: 0x0080,
	WeHaveInstructions: 0x0100,
	UseMyMetrics: 0x0200,
	OverlapCompound: 0x0400,
	ScaledComponentOffset: 0x0800,
	UnscaledComponentOffset: 0x1000,
} as const;

/** A point in a glyph contour */
export interface GlyphPoint {
	x: number;
	y: number;
	onCurve: boolean;
	/** True if this is a cubic bezier control point (CFF fonts) */
	cubic?: boolean;
}

/** A contour is a closed path of points */
export type Contour = GlyphPoint[];

/** Simple glyph with contours */
export interface SimpleGlyph {
	type: "simple";
	numberOfContours: int16;
	xMin: int16;
	yMin: int16;
	xMax: int16;
	yMax: int16;
	contours: Contour[];
	instructions: Uint8Array<ArrayBufferLike>;
}

/** Component of a composite glyph */
export interface GlyphComponent {
	glyphId: GlyphId;
	flags: uint16;
	/** X offset or point number */
	arg1: number;
	/** Y offset or point number */
	arg2: number;
	/** Transformation matrix [a, b, c, d] */
	transform: [number, number, number, number];
}

/** Composite glyph made of other glyphs */
export interface CompositeGlyph {
	type: "composite";
	numberOfContours: int16;
	xMin: int16;
	yMin: int16;
	xMax: int16;
	yMax: int16;
	components: GlyphComponent[];
	instructions: Uint8Array<ArrayBufferLike>;
}

/** Empty glyph (space, etc.) */
export interface EmptyGlyph {
	type: "empty";
}

export type Glyph = SimpleGlyph | CompositeGlyph | EmptyGlyph;

/** glyf table stores the raw reader for on-demand glyph parsing */
export interface GlyfTable {
	reader: Reader;
}

export function parseGlyf(reader: Reader): GlyfTable {
	// We don't parse all glyphs upfront - store reader for lazy access
	return { reader };
}

/**
 * Parse a single glyph from the glyf table
 */
export function parseGlyph(
	glyf: GlyfTable,
	loca: LocaTable,
	glyphId: GlyphId,
): Glyph {
	const location = getGlyphLocation(loca, glyphId);
	if (!location) {
		return { type: "empty" };
	}

	const reader = glyf.reader.slice(location.offset, location.length);
	return parseGlyphData(reader);
}

function parseGlyphData(reader: Reader): Glyph {
	const numberOfContours = reader.int16();
	const xMin = reader.int16();
	const yMin = reader.int16();
	const xMax = reader.int16();
	const yMax = reader.int16();

	if (numberOfContours >= 0) {
		return parseSimpleGlyph(reader, numberOfContours, xMin, yMin, xMax, yMax);
	} else {
		return parseCompositeGlyph(
			reader,
			numberOfContours,
			xMin,
			yMin,
			xMax,
			yMax,
		);
	}
}

function parseSimpleGlyph(
	reader: Reader,
	numberOfContours: int16,
	xMin: int16,
	yMin: int16,
	xMax: int16,
	yMax: int16,
): SimpleGlyph {
	if (numberOfContours === 0) {
		return {
			type: "simple",
			numberOfContours,
			xMin,
			yMin,
			xMax,
			yMax,
			contours: [],
			instructions: new Uint8Array(0),
		};
	}

	// Read end points of each contour
	const endPtsOfContours: uint16[] = [];
	for (let i = 0; i < numberOfContours; i++) {
		endPtsOfContours.push(reader.uint16());
	}

	// Total number of points
	const lastEndPt = endPtsOfContours[numberOfContours - 1];
	if (lastEndPt === undefined) {
		return {
			type: "simple",
			numberOfContours,
			xMin,
			yMin,
			xMax,
			yMax,
			contours: [],
			instructions: new Uint8Array(0),
		};
	}
	const numPoints = lastEndPt + 1;

	// Read instructions
	const instructionLength = reader.uint16();
	const instructions = reader.bytes(instructionLength);

	// Read flags
	const flags: uint8[] = [];
	while (flags.length < numPoints) {
		const flag = reader.uint8();
		flags.push(flag);

		// Handle repeat flag
		if (flag & PointFlag.Repeat) {
			const repeatCount = reader.uint8();
			for (let i = 0; i < repeatCount; i++) {
				flags.push(flag);
			}
		}
	}

	// Read X coordinates
	const xCoordinates: number[] = [];
	let x = 0;
	for (let i = 0; i < flags.length; i++) {
		const flag = flags[i]!;
		if (flag & PointFlag.XShortVector) {
			const dx = reader.uint8();
			x += flag & PointFlag.XIsSameOrPositive ? dx : -dx;
		} else if (!(flag & PointFlag.XIsSameOrPositive)) {
			x += reader.int16();
		}
		// else x stays the same (XIsSameOrPositive with no short vector)
		xCoordinates.push(x);
	}

	// Read Y coordinates
	const yCoordinates: number[] = [];
	let y = 0;
	for (let i = 0; i < flags.length; i++) {
		const flag = flags[i]!;
		if (flag & PointFlag.YShortVector) {
			const dy = reader.uint8();
			y += flag & PointFlag.YIsSameOrPositive ? dy : -dy;
		} else if (!(flag & PointFlag.YIsSameOrPositive)) {
			y += reader.int16();
		}
		// else y stays the same
		yCoordinates.push(y);
	}

	// Build contours
	const contours: Contour[] = [];
	let pointIndex = 0;
	for (let i = 0; i < endPtsOfContours.length; i++) {
		const endPt = endPtsOfContours[i]!;
		const contour: Contour = [];

		while (pointIndex <= endPt) {
			const xCoord = xCoordinates[pointIndex];
			const yCoord = yCoordinates[pointIndex];
			const flag = flags[pointIndex];
			if (xCoord === undefined || yCoord === undefined || flag === undefined) {
				break;
			}

			contour.push({
				x: xCoord,
				y: yCoord,
				onCurve: (flag & PointFlag.OnCurve) !== 0,
			});
			pointIndex++;
		}

		contours.push(contour);
	}

	return {
		type: "simple",
		numberOfContours,
		xMin,
		yMin,
		xMax,
		yMax,
		contours,
		instructions,
	};
}

function parseCompositeGlyph(
	reader: Reader,
	numberOfContours: int16,
	xMin: int16,
	yMin: int16,
	xMax: int16,
	yMax: int16,
): CompositeGlyph {
	const components: GlyphComponent[] = [];
	let flags: uint16;

	do {
		flags = reader.uint16();
		const glyphIndex = reader.uint16();

		let arg1: number;
		let arg2: number;

		if (flags & CompositeFlag.Arg1And2AreWords) {
			if (flags & CompositeFlag.ArgsAreXYValues) {
				arg1 = reader.int16();
				arg2 = reader.int16();
			} else {
				arg1 = reader.uint16();
				arg2 = reader.uint16();
			}
		} else {
			if (flags & CompositeFlag.ArgsAreXYValues) {
				arg1 = reader.int8();
				arg2 = reader.int8();
			} else {
				arg1 = reader.uint8();
				arg2 = reader.uint8();
			}
		}

		// Transformation matrix defaults to identity
		let a = 1,
			b = 0,
			c = 0,
			d = 1;

		if (flags & CompositeFlag.WeHaveAScale) {
			a = d = reader.f2dot14();
		} else if (flags & CompositeFlag.WeHaveAnXAndYScale) {
			a = reader.f2dot14();
			d = reader.f2dot14();
		} else if (flags & CompositeFlag.WeHaveATwoByTwo) {
			a = reader.f2dot14();
			b = reader.f2dot14();
			c = reader.f2dot14();
			d = reader.f2dot14();
		}

		components.push({
			glyphId: glyphIndex,
			flags,
			arg1,
			arg2,
			transform: [a, b, c, d],
		});
	} while (flags & CompositeFlag.MoreComponents);

	// Read instructions if present
	let instructions: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
	if (flags & CompositeFlag.WeHaveInstructions) {
		const instructionLength = reader.uint16();
		instructions = reader.bytes(instructionLength);
	}

	return {
		type: "composite",
		numberOfContours,
		xMin,
		yMin,
		xMax,
		yMax,
		components,
		instructions,
	};
}

function shouldScaleComponentOffset(
	flags: uint16,
	a: number,
	b: number,
	c: number,
	d: number,
): boolean {
	if (flags & CompositeFlag.UnscaledComponentOffset) return false;
	if (flags & CompositeFlag.ScaledComponentOffset) return true;
	return a !== 1 || b !== 0 || c !== 0 || d !== 1;
}

function flattenContoursPoints(contours: Contour[]): GlyphPoint[] {
	const points: GlyphPoint[] = [];
	for (let i = 0; i < contours.length; i++) {
		const contour = contours[i]!;
		for (let j = 0; j < contour.length; j++) {
			points.push(contour[j]!);
		}
	}
	return points;
}

function transformContour(
	contour: Contour,
	a: number,
	b: number,
	c: number,
	d: number,
	dx: number,
	dy: number,
): Contour {
	const transformed: Contour = new Array(contour.length);
	for (let i = 0; i < contour.length; i++) {
		const point = contour[i]!;
		const x = Math.round(a * point.x + c * point.y + dx);
		const y = Math.round(b * point.x + d * point.y + dy);
		const transformedPoint: GlyphPoint = { x, y, onCurve: point.onCurve };
		if (point.cubic) transformedPoint.cubic = true;
		transformed[i] = transformedPoint;
	}
	return transformed;
}

function appendComponentContours(
	result: Contour[],
	parentPoints: GlyphPoint[],
	component: GlyphComponent,
	componentContours: Contour[],
): void {
	const [a, b, c, d] = component.transform;
	const hasXY = (component.flags & CompositeFlag.ArgsAreXYValues) !== 0;
	const componentPoints = flattenContoursPoints(componentContours);

	let dx = 0;
	let dy = 0;

	if (hasXY) {
		dx = component.arg1;
		dy = component.arg2;

		if (shouldScaleComponentOffset(component.flags, a, b, c, d)) {
			const scaledX = a * dx + c * dy;
			const scaledY = b * dx + d * dy;
			dx = scaledX;
			dy = scaledY;
		}

		if (component.flags & CompositeFlag.RoundXYToGrid) {
			dx = Math.round(dx);
			dy = Math.round(dy);
		}
	} else {
		const parentIndex = component.arg1;
		const compIndex = component.arg2;
		if (
			parentIndex >= 0 &&
			parentIndex < parentPoints.length &&
			compIndex >= 0 &&
			compIndex < componentPoints.length
		) {
			const parentPoint = parentPoints[parentIndex]!;
			const compPoint = componentPoints[compIndex]!;
			const compX = a * compPoint.x + c * compPoint.y;
			const compY = b * compPoint.x + d * compPoint.y;
			dx = parentPoint.x - compX;
			dy = parentPoint.y - compY;
		}
	}

	for (let i = 0; i < componentContours.length; i++) {
		const contour = componentContours[i]!;
		const transformedContour = transformContour(contour, a, b, c, d, dx, dy);
		result.push(transformedContour);
		for (let j = 0; j < transformedContour.length; j++) {
			parentPoints.push(transformedContour[j]!);
		}
	}
}

/**
 * Flatten a composite glyph into simple contours
 * Recursively resolves all component glyphs and applies transformations
 */
export function flattenCompositeGlyph(
	glyf: GlyfTable,
	loca: LocaTable,
	glyph: CompositeGlyph,
	depth: number = 0,
): Contour[] {
	// Prevent infinite recursion
	if (depth > 32) {
		return [];
	}

	const result: Contour[] = [];
	const parentPoints: GlyphPoint[] = [];

	for (let i = 0; i < glyph.components.length; i++) {
		const component = glyph.components[i]!;
		const componentGlyph = parseGlyph(glyf, loca, component.glyphId);

		let componentContours: Contour[];
		if (componentGlyph.type === "simple") {
			componentContours = componentGlyph.contours;
		} else if (componentGlyph.type === "composite") {
			componentContours = flattenCompositeGlyph(
				glyf,
				loca,
				componentGlyph,
				depth + 1,
			);
		} else {
			continue;
		}

		appendComponentContours(result, parentPoints, component, componentContours);
	}

	return result;
}

/** LRU cache for composite glyph contours - using numeric keys for faster lookups */
const compositeCache = new Map<GlyphId, Contour[]>();
const COMPOSITE_CACHE_SIZE = 256;

/**
 * Get all contours for a glyph, flattening composites
 */
export function getGlyphContours(
	glyf: GlyfTable,
	loca: LocaTable,
	glyphId: GlyphId,
): Contour[] {
	const glyph = parseGlyph(glyf, loca, glyphId);

	if (glyph.type === "empty") {
		return [];
	} else if (glyph.type === "simple") {
		return glyph.contours;
	} else {
		// Check cache for composite glyphs using numeric key directly
		const cached = compositeCache.get(glyphId);
		if (cached) return cached;

		const result = flattenCompositeGlyph(glyf, loca, glyph);

		// Cache result with LRU eviction
		if (compositeCache.size >= COMPOSITE_CACHE_SIZE) {
			const firstKey = compositeCache.keys().next().value;
			if (firstKey !== undefined) compositeCache.delete(firstKey);
		}
		compositeCache.set(glyphId, result);

		return result;
	}
}

/**
 * Get contours and bounds for a glyph in one parse operation.
 * More efficient than calling getGlyphContours + getGlyphBounds separately.
 */
export function getGlyphContoursAndBounds(
	glyf: GlyfTable,
	loca: LocaTable,
	glyphId: GlyphId,
): {
	contours: Contour[];
	bounds: { xMin: number; yMin: number; xMax: number; yMax: number } | null;
} {
	const glyph = parseGlyph(glyf, loca, glyphId);

	if (glyph.type === "empty") {
		return { contours: [], bounds: null };
	}

	const bounds = {
		xMin: glyph.xMin,
		yMin: glyph.yMin,
		xMax: glyph.xMax,
		yMax: glyph.yMax,
	};

	if (glyph.type === "simple") {
		return { contours: glyph.contours, bounds };
	}

	// Composite glyph - check cache using numeric key directly
	let contours = compositeCache.get(glyphId);
	if (!contours) {
		contours = flattenCompositeGlyph(glyf, loca, glyph);
		if (compositeCache.size >= COMPOSITE_CACHE_SIZE) {
			const firstKey = compositeCache.keys().next().value;
			if (firstKey !== undefined) compositeCache.delete(firstKey);
		}
		compositeCache.set(glyphId, contours);
	}

	return { contours, bounds };
}

/**
 * Get bounding box for a glyph
 */
export function getGlyphBounds(
	glyf: GlyfTable,
	loca: LocaTable,
	glyphId: GlyphId,
): { xMin: number; yMin: number; xMax: number; yMax: number } | null {
	const glyph = parseGlyph(glyf, loca, glyphId);

	if (glyph.type === "empty") {
		return null;
	}

	return {
		xMin: glyph.xMin,
		yMin: glyph.yMin,
		xMax: glyph.xMax,
		yMax: glyph.yMax,
	};
}

/**
 * Get all deltas for a glyph at given variation coordinates
 */
export function getGlyphDeltas(
	gvar: GvarTable,
	glyphId: GlyphId,
	numPoints: number,
	axisCoords: number[],
): PointDelta[] {
	const glyphData = gvar.glyphVariationData[glyphId];
	if (!glyphData) {
		return Array(numPoints).fill({ x: 0, y: 0 });
	}

	// Initialize deltas array
	const deltas: PointDelta[] = Array(numPoints)
		.fill(null)
		.map(() => ({ x: 0, y: 0 }));

	for (let i = 0; i < glyphData.tupleVariationHeaders.length; i++) {
		const header = glyphData.tupleVariationHeaders[i]!;
		if (!header.peakTuple) continue;

		const scalar = calculateTupleScalar(
			header.peakTuple,
			axisCoords,
			header.intermediateStartTuple,
			header.intermediateEndTuple,
		);

		if (scalar === 0) continue;

		if (header.pointNumbers !== null) {
			// Sparse point deltas
			for (let j = 0; j < header.pointNumbers.length; j++) {
				const pointIndex = header.pointNumbers[j]!;
				const delta = deltas[pointIndex];
				const headerDelta = header.deltas[j];
				if (pointIndex < numPoints && delta && headerDelta) {
					delta.x += headerDelta.x * scalar;
					delta.y += headerDelta.y * scalar;
				}
			}
		} else {
			// All points
			for (let j = 0; j < Math.min(header.deltas.length, numPoints); j++) {
				const delta = deltas[j];
				const headerDelta = header.deltas[j];
				if (delta && headerDelta) {
					delta.x += headerDelta.x * scalar;
					delta.y += headerDelta.y * scalar;
				}
			}
		}
	}

	// Round final values
	for (let i = 0; i < deltas.length; i++) {
		const d = deltas[i]!;
		d.x = Math.round(d.x);
		d.y = Math.round(d.y);
	}

	return deltas;
}

/**
 * Apply variation deltas to contours
 */
export function applyVariationDeltas(
	contours: Contour[],
	deltas: PointDelta[],
): Contour[] {
	const result: Contour[] = [];
	let pointIndex = 0;

	for (let i = 0; i < contours.length; i++) {
		const contour = contours[i]!;
		const newContour: Contour = [];
		for (let j = 0; j < contour.length; j++) {
			const point = contour[j]!;
			const delta = deltas[pointIndex] ?? { x: 0, y: 0 };
			newContour.push({
				x: point.x + delta.x,
				y: point.y + delta.y,
				onCurve: point.onCurve,
			});
			pointIndex++;
		}
		result.push(newContour);
	}

	return result;
}

/**
 * Get contours for a glyph with variation applied
 */
export function getGlyphContoursWithVariation(
	glyf: GlyfTable,
	loca: LocaTable,
	gvar: GvarTable | null,
	glyphId: GlyphId,
	axisCoords?: number[],
): Contour[] {
	const glyph = parseGlyph(glyf, loca, glyphId);

	if (glyph.type === "empty") {
		return [];
	}

	let contours: Contour[];
	if (glyph.type === "simple") {
		contours = glyph.contours;
	} else {
		contours = flattenCompositeGlyphWithVariation(
			glyf,
			loca,
			gvar,
			glyph,
			axisCoords,
		);
	}

	// Apply variation if we have gvar and axis coordinates
	if (gvar && axisCoords && axisCoords.length > 0) {
		// Count total points
		let numPoints = 0;
		for (let i = 0; i < contours.length; i++) {
			const c = contours[i]!;
			numPoints += c.length;
		}
		// Add phantom points (4)
		numPoints += 4;

		const deltas = getGlyphDeltas(gvar, glyphId, numPoints, axisCoords);
		contours = applyVariationDeltas(contours, deltas);
	}

	return contours;
}

/**
 * Flatten composite glyph with variation support
 */
function flattenCompositeGlyphWithVariation(
	glyf: GlyfTable,
	loca: LocaTable,
	gvar: GvarTable | null,
	glyph: CompositeGlyph,
	axisCoords?: number[],
	depth: number = 0,
): Contour[] {
	if (depth > 32) {
		return [];
	}

	const result: Contour[] = [];
	const parentPoints: GlyphPoint[] = [];

	for (let i = 0; i < glyph.components.length; i++) {
		const component = glyph.components[i]!;
		const componentGlyph = parseGlyph(glyf, loca, component.glyphId);

		let componentContours: Contour[];
		if (componentGlyph.type === "simple") {
			componentContours = componentGlyph.contours;

			// Apply variation to component
			if (gvar && axisCoords && axisCoords.length > 0) {
				let numPoints = 0;
				for (let j = 0; j < componentContours.length; j++) {
					const c = componentContours[j]!;
					numPoints += c.length;
				}
				numPoints += 4; // phantom points

				const deltas = getGlyphDeltas(
					gvar,
					component.glyphId,
					numPoints,
					axisCoords,
				);
				componentContours = applyVariationDeltas(componentContours, deltas);
			}
		} else if (componentGlyph.type === "composite") {
			componentContours = flattenCompositeGlyphWithVariation(
				glyf,
				loca,
				gvar,
				componentGlyph,
				axisCoords,
				depth + 1,
			);
		} else {
			continue;
		}

		appendComponentContours(result, parentPoints, component, componentContours);
	}

	return result;
}
