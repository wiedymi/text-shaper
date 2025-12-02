import { Font, UnicodeBuffer, GlyphBuffer, Direction, tagToString } from "./src/index.ts";
import { GsubLookupType } from "./src/font/tables/gsub.ts";
import { GposLookupType, getKerning } from "./src/font/tables/gpos.ts";

async function main() {
	const ttfPath = "/System/Library/Fonts/Supplemental/Arial.ttf";
	const font = await Font.fromFile(ttfPath);

	console.log("=== Font Info ===");
	console.log(`Tables: ${font.listTables().join(", ")}`);
	console.log(`Glyphs: ${font.numGlyphs}`);
	console.log(`Units per em: ${font.unitsPerEm}`);
	console.log(`Has OpenType layout: ${font.hasOpenTypeLayout}`);

	// Test GDEF
	const gdef = font.gdef;
	if (gdef) {
		console.log(`\n=== GDEF ===`);
		console.log(`Version: ${gdef.version.major}.${gdef.version.minor}`);
	}

	// Test GSUB
	const gsub = font.gsub;
	if (gsub) {
		console.log(`\n=== GSUB ===`);
		console.log(`Version: ${gsub.version.major}.${gsub.version.minor}`);
		console.log(`Scripts: ${gsub.scriptList.scripts.map(s => tagToString(s.scriptTag)).join(", ")}`);
		console.log(`Features: ${gsub.featureList.features.map(f => tagToString(f.featureTag)).join(", ")}`);
		console.log(`Lookups: ${gsub.lookups.length}`);

		// Count lookup types
		const typeCounts = new Map<number, number>();
		for (const lookup of gsub.lookups) {
			typeCounts.set(lookup.type, (typeCounts.get(lookup.type) ?? 0) + 1);
		}
		for (const [type, count] of typeCounts) {
			console.log(`  Type ${type} (${GsubLookupType[type]}): ${count}`);
		}
	}

	// Test GPOS
	const gpos = font.gpos;
	if (gpos) {
		console.log(`\n=== GPOS ===`);
		console.log(`Version: ${gpos.version.major}.${gpos.version.minor}`);
		console.log(`Features: ${gpos.featureList.features.map(f => tagToString(f.featureTag)).join(", ")}`);
		console.log(`Lookups: ${gpos.lookups.length}`);

		// Count lookup types
		const gposTypeCounts = new Map<number, number>();
		for (const lookup of gpos.lookups) {
			gposTypeCounts.set(lookup.type, (gposTypeCounts.get(lookup.type) ?? 0) + 1);
		}
		for (const [type, count] of gposTypeCounts) {
			console.log(`  Type ${type} (${GposLookupType[type]}): ${count}`);
		}

		// Test kerning
		const A = font.glyphIdForChar("A");
		const V = font.glyphIdForChar("V");
		console.log(`\nKerning test: A (${A}) + V (${V})`);

		for (const lookup of gpos.lookups) {
			if (lookup.type === GposLookupType.Pair) {
				const kern = getKerning(lookup, A, V);
				if (kern && (kern.xAdvance1 !== 0 || kern.xAdvance2 !== 0)) {
					console.log(`  Kerning found: xAdvance1=${kern.xAdvance1}`);
				}
			}
		}
	}

	// Test cmap
	console.log(`\n=== Cmap Test ===`);
	const text = "AVffi";
	for (const char of text) {
		const glyphId = font.glyphIdForChar(char);
		const advance = font.advanceWidth(glyphId);
		console.log(`'${char}' -> glyph ${glyphId}, advance ${advance}`);
	}
}

main();