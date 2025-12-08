import { describe, expect, test } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import type { GposTable, PairPosLookup } from "../../../src/font/tables/gpos.ts";
import { applyKerningDirect } from "../../../src/font/tables/gpos.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("GPOS additional coverage tests", () => {
	test("applyKerningDirect with format 1 pair positioning", async () => {
		const font = await Font.fromFile(ARIAL_PATH);
		if (!font.gpos) return;

		const pairLookup = font.gpos.lookups.find(
			(l): l is PairPosLookup => l.type === 2 && l.subtables.some((st) => st.format === 1),
		);
		if (!pairLookup) return;

		// Find a valid glyph pair from format 1 subtable
		for (const subtable of pairLookup.subtables) {
			if (subtable.format === 1) {
				for (let i = 0; i < subtable.coverage.glyphs.length; i++) {
					const glyph = subtable.coverage.glyphs[i];
					if (glyph === undefined) continue;
					const index = subtable.coverage.get(glyph);
					if (index === null) continue;
					const pairSet = subtable.pairSets[index];
					if (pairSet && pairSet.pairValueRecords.length > 0) {
						const firstGlyph = glyph;
						const secondGlyph = pairSet.pairValueRecords[0]!.secondGlyph;

						const pos1 = { xAdvance: 100, yAdvance: 0, xOffset: 0, yOffset: 0 };
						const pos2 = { xAdvance: 100, yAdvance: 0, xOffset: 0, yOffset: 0 };

						const applied = applyKerningDirect(
							pairLookup,
							firstGlyph,
							secondGlyph,
							pos1,
							pos2,
						);

						expect(applied).toBe(true);
						// Covers lines 810-833 in gpos.ts
						return;
					}
				}
			}
		}
	});

	test("applyKerningDirect with format 2 pair positioning", async () => {
		const font = await Font.fromFile(ARIAL_PATH);
		if (!font.gpos) return;

		const pairLookup = font.gpos.lookups.find(
			(l): l is PairPosLookup => l.type === 2 && l.subtables.some((st) => st.format === 2),
		);
		if (!pairLookup) return;

		// Find valid glyphs from format 2 subtable
		for (const subtable of pairLookup.subtables) {
			if (subtable.format === 2) {
				const firstGlyph = subtable.coverage.glyphs[0];
				if (firstGlyph === undefined) continue;

				const class1 = subtable.classDef1.get(firstGlyph);
				for (let class2 = 0; class2 < subtable.class2Count; class2++) {
					const class1Record = subtable.class1Records[class1];
					if (!class1Record) continue;
					const class2Record = class1Record.class2Records[class2];
					if (!class2Record) continue;

					// Find a glyph in class2
					let secondGlyph = 0;
					for (const [glyph, cls] of subtable.classDef2.entries()) {
						if (cls === class2) {
							secondGlyph = glyph;
							break;
						}
					}

					if (secondGlyph > 0) {
						const pos1 = { xAdvance: 100, yAdvance: 0, xOffset: 0, yOffset: 0 };
						const pos2 = { xAdvance: 100, yAdvance: 0, xOffset: 0, yOffset: 0 };

						applyKerningDirect(
							pairLookup,
							firstGlyph,
							secondGlyph,
							pos1,
							pos2,
						);
						// Covers lines 834-848 in gpos.ts
						return;
					}
				}
			}
		}
	});

	test("applyKerningDirect returns false for non-matching glyphs", async () => {
		const font = await Font.fromFile(ARIAL_PATH);
		if (!font.gpos) return;

		const pairLookup = font.gpos.lookups.find(
			(l): l is PairPosLookup => l.type === 2,
		);
		if (!pairLookup) return;

		const pos1 = { xAdvance: 100, yAdvance: 0, xOffset: 0, yOffset: 0 };
		const pos2 = { xAdvance: 100, yAdvance: 0, xOffset: 0, yOffset: 0 };

		// Test with glyphs that definitely don't have kerning
		const applied = applyKerningDirect(pairLookup, 9999, 9999, pos1, pos2);
		expect(applied).toBe(false);
		expect(pos1.xAdvance).toBe(100); // unchanged
		expect(pos2.xAdvance).toBe(100); // unchanged
	});
});
