import type { GlyphBuffer } from "../buffer/glyph-buffer.ts";
import type { Font } from "../font/font.ts";
import {
	getVariationGlyphId,
	isVariationSelector,
} from "../font/tables/cmap.ts";

/**
 * Resolve Unicode variation sequences against the font's cmap format 14
 * subtable. For each <base, variation selector> pair the base glyph is
 * remapped to the variation glyph when the font defines one, and the
 * selector is merged into the base's cluster. The selector glyph itself is
 * kept in the buffer so GSUB/morx rules can still match it; it is removed
 * afterwards by hideVariationSelectors().
 *
 * Returns true if the buffer contains any variation selector.
 */
export function applyVariationSelectors(
	font: Font,
	buffer: GlyphBuffer,
): boolean {
	const infos = buffer.infos;
	let sawSelector = false;
	for (let i = 1; i < infos.length; i++) {
		const info = infos[i];
		if (!info || !isVariationSelector(info.codepoint)) continue;
		sawSelector = true;
		const base = infos[i - 1];
		if (!base || isVariationSelector(base.codepoint)) continue;
		const remapped = getVariationGlyphId(
			font.cmap,
			base.codepoint,
			info.codepoint,
		);
		if (remapped !== undefined) {
			base.glyphId = remapped;
		}
		info.cluster = base.cluster;
	}
	return sawSelector;
}

/**
 * Drop variation-selector glyphs from the shaped output. Variation selectors
 * are default-ignorable code points: they participate in cmap format 14 and
 * GSUB/morx matching but must never surface as visible glyphs — without this
 * a font whose cmap maps U+FE0F (most color emoji fonts do) emits a stray
 * zero-advance glyph, and one without such a mapping emits .notdef.
 */
export function hideVariationSelectors(buffer: GlyphBuffer): void {
	const infos = buffer.infos;
	for (let i = 0; i < infos.length; i++) {
		const info = infos[i];
		if (info && isVariationSelector(info.codepoint)) {
			buffer.markDeleted(i);
		}
	}
	if (buffer.hasPendingDeletions()) {
		buffer.compact();
	}
}
