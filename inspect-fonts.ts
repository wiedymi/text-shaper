import { Font } from "./src/font/font.ts";

async function inspectFont(path: string, name: string) {
	console.log(`\n=== ${name} ===`);
	try {
		const font = await Font.fromFile(path);
		console.log(`GSUB: ${font.gsub ? "Yes" : "No"}`);
		console.log(`GPOS: ${font.gpos ? "Yes" : "No"}`);
		console.log(`morx: ${font.morx ? "Yes" : "No"}`);

		if (font.gsub) {
			console.log(`GSUB lookups: ${font.gsub.lookups.length}`);
			const types = new Set(font.gsub.lookups.map(l => l.type));
			console.log(`GSUB types: ${Array.from(types).join(", ")}`);
		}
		if (font.gpos) {
			console.log(`GPOS lookups: ${font.gpos.lookups.length}`);
			const types = new Set(font.gpos.lookups.map(l => l.type));
			console.log(`GPOS types: ${Array.from(types).join(", ")}`);
		}
	} catch (e: any) {
		console.log(`Error: ${e.message}`);
	}
}

await inspectFont("/System/Library/Fonts/Supplemental/NotoSansJavanese-Regular.otf", "Javanese");
await inspectFont("/System/Library/Fonts/Supplemental/NotoSansMandaic-Regular.ttf", "Mandaic");
await inspectFont("/System/Library/Fonts/Supplemental/NotoSansMongolian-Regular.ttf", "Mongolian");
await inspectFont("/System/Library/Fonts/Geneva.ttf", "Geneva");
