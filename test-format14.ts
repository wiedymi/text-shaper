import { Font } from "./src/font/font.ts";

const fonts = [
	"/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
	"/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
	"/System/Library/Fonts/Supplemental/NotoSansEgyptianHieroglyphs-Regular.ttf",
];

for (const path of fonts) {
	try {
		const font = await Font.fromFile(path);
		const formats = Array.from(font.cmap.subtables.values()).map((s) => s.format);
		console.log(`${path.split("/").pop()}: formats = [${formats.join(", ")}]`);

		if (formats.includes(14)) {
			console.log("  HAS FORMAT 14!");
		}
	} catch (e) {
		console.log(`${path.split("/").pop()}: Error - ${(e as Error).message}`);
	}
}
