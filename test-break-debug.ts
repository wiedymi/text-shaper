import { getKhmerCategory, KhmerCategory } from "./src/shaper/complex/khmer.ts";
import type { GlyphInfo } from "./src/types.ts";

function makeInfo(codepoint: number): GlyphInfo {
	return { glyphId: 0, cluster: 0, mask: 0, codepoint };
}

// Manually trace through the logic
const infos = [
	makeInfo(0x1780), // consonant1
	makeInfo(0x1781), // consonant2
];

console.log("Setup:");
console.log("infos[0] category:", getKhmerCategory(infos[0].codepoint), "=== Consonant?", getKhmerCategory(infos[0].codepoint) === KhmerCategory.Consonant);
console.log("infos[1] category:", getKhmerCategory(infos[1].codepoint), "=== Consonant?", getKhmerCategory(infos[1].codepoint) === KhmerCategory.Consonant);

// Simulate the loop at j=1
const j = 1;
const i = 0;
const nextInfo = infos[j];
const nextCat = getKhmerCategory(nextInfo.codepoint);

console.log("\nAt j=1:");
console.log("nextCat === Consonant?", nextCat === KhmerCategory.Consonant);

if (nextCat === KhmerCategory.Consonant) {
	const prevInfo = infos[j - 1];
	console.log("prevInfo exists?", !!prevInfo);
	if (prevInfo) {
		const prevCat = getKhmerCategory(prevInfo.codepoint);
		console.log("prevInfo category:", prevCat);
		console.log("prevCat !== Coeng?", prevCat !== KhmerCategory.Coeng);

		if (prevInfo && prevCat !== KhmerCategory.Coeng) {
			console.log("WOULD BREAK");
		} else {
			console.log("Would NOT break");
		}
	}
}
