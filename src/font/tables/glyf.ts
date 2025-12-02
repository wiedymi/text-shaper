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
	const numPoints = endPtsOfContours[numberOfContours - 1]! + 1;

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
	for (let i = 0; i < numPoints; i++) {
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
	for (let i = 0; i < numPoints; i++) {
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
	for (let c = 0; c < numberOfContours; c++) {
		const endPt = endPtsOfContours[c]!;
		const contour: Contour = [];

		while (pointIndex <= endPt) {
			contour.push({
				x: xCoordinates[pointIndex]!,
				y: yCoordinates[pointIndex]!,
				onCurve: (flags[pointIndex]! & PointFlag.OnCurve) !== 0,
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

	for (const component of glyph.components) {
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

		// Apply transformation and offset
		const [a, b, c, d] = component.transform;
		const dx =
			component.flags & CompositeFlag.ArgsAreXYValues ? component.arg1 : 0;
		const dy =
			component.flags & CompositeFlag.ArgsAreXYValues ? component.arg2 : 0;

		for (const contour of componentContours) {
			const transformedContour: Contour = contour.map((point) => ({
				x: Math.round(a * point.x + c * point.y + dx),
				y: Math.round(b * point.x + d * point.y + dy),
				onCurve: point.onCurve,
			}));
			result.push(transformedContour);
		}
	}

	return result;
}

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
		return flattenCompositeGlyph(glyf, loca, glyph);
	}
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

	for (const header of glyphData.tupleVariationHeaders) {
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
			for (let i = 0; i < header.pointNumbers.length; i++) {
				const pointIndex = header.pointNumbers[i]!;
				if (pointIndex < numPoints && header.deltas[i]) {
					deltas[pointIndex]!.x += header.deltas[i]?.x * scalar;
					deltas[pointIndex]!.y += header.deltas[i]?.y * scalar;
				}
			}
		} else {
			// All points
			for (let i = 0; i < Math.min(header.deltas.length, numPoints); i++) {
				if (header.deltas[i]) {
					deltas[i]!.x += header.deltas[i]?.x * scalar;
					deltas[i]!.y += header.deltas[i]?.y * scalar;
				}
			}
		}
	}

	// Round final values
	for (const d of deltas) {
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

	for (const contour of contours) {
		const newContour: Contour = [];
		for (const point of contour) {
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
		for (const c of contours) {
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

	for (const component of glyph.components) {
		const componentGlyph = parseGlyph(glyf, loca, component.glyphId);

		let componentContours: Contour[];
		if (componentGlyph.type === "simple") {
			componentContours = componentGlyph.contours;

			// Apply variation to component
			if (gvar && axisCoords && axisCoords.length > 0) {
				let numPoints = 0;
				for (const c of componentContours) {
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

		// Apply transformation and offset
		const [a, b, c, d] = component.transform;
		const dx =
			component.flags & CompositeFlag.ArgsAreXYValues ? component.arg1 : 0;
		const dy =
			component.flags & CompositeFlag.ArgsAreXYValues ? component.arg2 : 0;

		for (const contour of componentContours) {
			const transformedContour: Contour = contour.map((point) => ({
				x: Math.round(a * point.x + c * point.y + dx),
				y: Math.round(b * point.x + d * point.y + dy),
				onCurve: point.onCurve,
			}));
			result.push(transformedContour);
		}
	}

	return result;
}
