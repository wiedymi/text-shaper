import type { Font } from "../font/font.ts";
import type { FontSizeMode } from "./types.ts";

export function resolveFontSize(
	font: Font,
	fontSize: number,
	sizeMode?: FontSizeMode,
): number {
	if (sizeMode !== "height") return fontSize;
	if (!Number.isFinite(fontSize) || fontSize <= 0) return fontSize;
	const baseHeight = font.ascender - font.descender;
	const height = font.isCFF ? baseHeight : baseHeight + font.lineGap;
	if (!Number.isFinite(height) || height <= 0) return fontSize;
	return (fontSize * font.unitsPerEm) / height;
}

export function resolveFontScale(
	font: Font,
	fontSize: number,
	sizeMode?: FontSizeMode,
): number {
	const effectiveSize = resolveFontSize(font, fontSize, sizeMode);
	return effectiveSize / font.unitsPerEm;
}
