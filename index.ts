import { GposLookupType, getKerning } from "./src/font/tables/gpos.ts";
import {
	Direction,
	detectDirection,
	Font,
	getEmbeddings,
	getMirror,
	shape,
	tagToString,
	UnicodeBuffer,
} from "./src/index.ts";

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
		console.log(
			`Scripts: ${gsub.scriptList.scripts.map((s) => tagToString(s.scriptTag)).join(", ")}`,
		);
		console.log(
			`Features: ${gsub.featureList.features.map((f) => tagToString(f.featureTag)).join(", ")}`,
		);
		console.log(`Lookups: ${gsub.lookups.length}`);

		// Count lookup types
		const gsubTypeNames: Record<number, string> = {
			1: "Single",
			2: "Multiple",
			3: "Alternate",
			4: "Ligature",
			5: "Context",
			6: "ChainingContext",
			7: "Extension",
			8: "ReverseChainingSingle",
		};
		const typeCounts = new Map<number, number>();
		for (const lookup of gsub.lookups) {
			typeCounts.set(lookup.type, (typeCounts.get(lookup.type) ?? 0) + 1);
		}
		for (const [type, count] of typeCounts) {
			console.log(
				`  Type ${type} (${gsubTypeNames[type] ?? "Unknown"}): ${count}`,
			);
		}
	}

	// Test GPOS
	const gpos = font.gpos;
	if (gpos) {
		console.log(`\n=== GPOS ===`);
		console.log(`Version: ${gpos.version.major}.${gpos.version.minor}`);
		console.log(
			`Features: ${gpos.featureList.features.map((f) => tagToString(f.featureTag)).join(", ")}`,
		);
		console.log(`Lookups: ${gpos.lookups.length}`);

		// Count lookup types
		const gposTypeNames: Record<number, string> = {
			1: "Single",
			2: "Pair",
			3: "Cursive",
			4: "MarkToBase",
			5: "MarkToLigature",
			6: "MarkToMark",
			7: "Context",
			8: "ChainingContext",
			9: "Extension",
		};
		const gposTypeCounts = new Map<number, number>();
		for (const lookup of gpos.lookups) {
			gposTypeCounts.set(
				lookup.type,
				(gposTypeCounts.get(lookup.type) ?? 0) + 1,
			);
		}
		for (const [type, count] of gposTypeCounts) {
			console.log(
				`  Type ${type} (${gposTypeNames[type] ?? "Unknown"}): ${count}`,
			);
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

	// Test shaping
	console.log(`\n=== Text Shaping Test ===`);
	const testStrings = ["AVffi", "WAVE", "office"];

	for (const text of testStrings) {
		console.log(`\nShaping: "${text}"`);
		const buffer = new UnicodeBuffer();
		buffer.addStr(text);

		const result = shape(font, buffer, { script: "latn" });

		console.log(`  Input codepoints: ${buffer.codepoints.length}`);
		console.log(`  Output glyphs: ${result.infos.length}`);

		let totalAdvance = 0;
		for (let i = 0; i < result.infos.length; i++) {
			const info = result.infos[i]!;
			const pos = result.positions[i]!;
			console.log(
				`    [${i}] glyph=${info.glyphId} cluster=${info.cluster} xAdv=${pos.xAdvance} xOff=${pos.xOffset}`,
			);
			totalAdvance += pos.xAdvance;
		}
		console.log(`  Total advance: ${totalAdvance}`);
	}

	// Test with kerning visible
	console.log(`\n=== Kerning Comparison ===`);
	const avBuffer = new UnicodeBuffer();
	avBuffer.addStr("AV");
	const avResult = shape(font, avBuffer, { script: "latn" });

	const aBuffer = new UnicodeBuffer();
	aBuffer.addStr("A");
	const aResult = shape(font, aBuffer, { script: "latn" });

	const vBuffer = new UnicodeBuffer();
	vBuffer.addStr("V");
	const vResult = shape(font, vBuffer, { script: "latn" });

	const aAdvance = aResult.positions[0]?.xAdvance ?? 0;
	const vAdvance = vResult.positions[0]?.xAdvance ?? 0;
	const avTotalAdvance =
		(avResult.positions[0]?.xAdvance ?? 0) +
		(avResult.positions[1]?.xAdvance ?? 0);

	console.log(`  A alone: ${aAdvance}`);
	console.log(`  V alone: ${vAdvance}`);
	console.log(`  A+V separate: ${aAdvance + vAdvance}`);
	console.log(`  AV shaped together: ${avTotalAdvance}`);
	console.log(`  Kerning effect: ${avTotalAdvance - (aAdvance + vAdvance)}`);

	// Test Arabic shaping
	console.log(`\n=== Arabic Shaping Test ===`);
	const arabicText = "مرحبا"; // "marhaba" - hello
	console.log(`Text: ${arabicText}`);

	const arabicBuffer = new UnicodeBuffer();
	arabicBuffer.addStr(arabicText);
	arabicBuffer.setScript("arab");
	arabicBuffer.setDirection(Direction.RTL);

	console.log(
		`Input codepoints: ${arabicBuffer.codepoints.map((cp) => `U+${cp.toString(16).padStart(4, "0")}`).join(" ")}`,
	);

	const arabicResult = shape(font, arabicBuffer, {
		script: "arab",
		direction: "rtl",
	});

	console.log(`Output glyphs: ${arabicResult.infos.length}`);
	for (let i = 0; i < arabicResult.infos.length; i++) {
		const info = arabicResult.infos[i]!;
		const pos = arabicResult.positions[i]!;
		const maskBits = info.mask & 0xf;
		const form =
			maskBits === 1
				? "isol"
				: maskBits === 2
					? "fina"
					: maskBits === 4
						? "medi"
						: maskBits === 8
							? "init"
							: "none";
		console.log(
			`  [${i}] glyph=${info.glyphId} cluster=${info.cluster} form=${form} xAdv=${pos.xAdvance}`,
		);
	}

	// Test BiDi
	console.log("\n=== BiDi Test ===");

	// Mixed LTR/RTL text
	const mixedText = "Hello مرحبا World";
	console.log(`Mixed text: "${mixedText}"`);

	const detected = detectDirection(mixedText);
	console.log(
		`Detected direction: ${detected === Direction.RTL ? "RTL" : "LTR"}`,
	);

	const { levels, paragraphs } = getEmbeddings(mixedText, Direction.LTR);
	console.log(`Embedding levels: [${Array.from(levels).join(", ")}]`);
	console.log(`Paragraphs: ${paragraphs.length}`);
	for (const p of paragraphs) {
		console.log(`  start=${p.start} end=${p.end} level=${p.level}`);
	}

	// Test mirroring
	console.log("\nMirroring test:");
	const brackets = ["(", ")", "[", "]", "{", "}"];
	for (const b of brackets) {
		const cp = b.codePointAt(0)!;
		const mirrored = getMirror(cp);
		console.log(
			`  '${b}' (U+${cp.toString(16).padStart(4, "0")}) -> '${String.fromCodePoint(mirrored)}' (U+${mirrored.toString(16).padStart(4, "0")})`,
		);
	}
}

main();
