import type { Reader } from "../binary/reader.ts";

/**
 * CPAL (Color Palette) table parser
 * Provides color palettes for color fonts
 */

export interface CpalTable {
	version: number;
	numPalettes: number;
	numPaletteEntries: number;
	palettes: ColorPalette[];
	paletteTypes?: number[];
	paletteLabels?: number[];
	paletteEntryLabels?: number[];
}

export interface ColorPalette {
	colors: Color[];
}

export interface Color {
	blue: number; // 0-255
	green: number; // 0-255
	red: number; // 0-255
	alpha: number; // 0-255
}

/**
 * Palette type flags
 */
export enum PaletteType {
	UsableWithLightBackground = 0x0001,
	UsableWithDarkBackground = 0x0002,
}

/**
 * Parse CPAL table
 */
export function parseCpal(reader: Reader): CpalTable {
	const startOffset = reader.offset;

	const version = reader.uint16();
	const numPaletteEntries = reader.uint16();
	const numPalettes = reader.uint16();
	const numColorRecords = reader.uint16();
	const colorRecordsArrayOffset = reader.uint32();

	// Read color record indices for each palette
	const colorRecordIndices: number[] = [];
	for (let i = 0; i < numPalettes; i++) {
		colorRecordIndices.push(reader.uint16());
	}

	// Read all color records
	reader.seek(startOffset + colorRecordsArrayOffset);
	const colorRecords: Color[] = [];
	for (let i = 0; i < numColorRecords; i++) {
		colorRecords.push({
			blue: reader.uint8(),
			green: reader.uint8(),
			red: reader.uint8(),
			alpha: reader.uint8(),
		});
	}

	// Build palettes
	const palettes: ColorPalette[] = [];
	for (let i = 0; i < numPalettes; i++) {
		const startIndex = colorRecordIndices[i]!;
		const colors: Color[] = [];
		for (let j = 0; j < numPaletteEntries; j++) {
			colors.push(colorRecords[startIndex + j]!);
		}
		palettes.push({ colors });
	}

	// Version 1 extensions
	let paletteTypes: number[] | undefined;
	let paletteLabels: number[] | undefined;
	let paletteEntryLabels: number[] | undefined;

	if (version >= 1) {
		// After color record indices
		reader.seek(startOffset + 12 + numPalettes * 2);

		const paletteTypesArrayOffset = reader.uint32();
		const paletteLabelsArrayOffset = reader.uint32();
		const paletteEntryLabelsArrayOffset = reader.uint32();

		if (paletteTypesArrayOffset !== 0) {
			reader.seek(startOffset + paletteTypesArrayOffset);
			paletteTypes = [];
			for (let i = 0; i < numPalettes; i++) {
				paletteTypes.push(reader.uint32());
			}
		}

		if (paletteLabelsArrayOffset !== 0) {
			reader.seek(startOffset + paletteLabelsArrayOffset);
			paletteLabels = [];
			for (let i = 0; i < numPalettes; i++) {
				paletteLabels.push(reader.uint16());
			}
		}

		if (paletteEntryLabelsArrayOffset !== 0) {
			reader.seek(startOffset + paletteEntryLabelsArrayOffset);
			paletteEntryLabels = [];
			for (let i = 0; i < numPaletteEntries; i++) {
				paletteEntryLabels.push(reader.uint16());
			}
		}
	}

	return {
		version,
		numPalettes,
		numPaletteEntries,
		palettes,
		paletteTypes,
		paletteLabels,
		paletteEntryLabels,
	};
}

/**
 * Get color from palette
 */
export function getColor(
	cpal: CpalTable,
	paletteIndex: number,
	colorIndex: number,
): Color | null {
	const palette = cpal.palettes[paletteIndex];
	if (!palette) return null;
	return palette.colors[colorIndex] ?? null;
}

/**
 * Convert color to CSS rgba string
 */
export function colorToRgba(color: Color): string {
	return `rgba(${color.red}, ${color.green}, ${color.blue}, ${(color.alpha / 255).toFixed(3)})`;
}

/**
 * Convert color to CSS hex string
 */
export function colorToHex(color: Color): string {
	const r = color.red.toString(16).padStart(2, "0");
	const g = color.green.toString(16).padStart(2, "0");
	const b = color.blue.toString(16).padStart(2, "0");
	if (color.alpha === 255) {
		return `#${r}${g}${b}`;
	}
	const a = color.alpha.toString(16).padStart(2, "0");
	return `#${r}${g}${b}${a}`;
}
