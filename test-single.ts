import { setupKhmerMasks } from "./src/shaper/complex/khmer.ts";
import type { GlyphInfo } from "./src/types.ts";

function makeInfo(codepoint: number): GlyphInfo {
	return { glyphId: 0, cluster: 0, mask: 0, codepoint };
}

console.log("Test: starts new syllable when second consonant not preceded by coeng");
const infos = [
	makeInfo(0x1780),
	makeInfo(0x1781),
];
console.log("Before:", infos);
setupKhmerMasks(infos);
console.log("After:", infos);
console.log("Masks:", infos.map(i => i.mask));
console.log("Expected: both masks should be 0");
console.log("Result:", infos[0].mask === 0 && infos[1].mask === 0 ? "PASS" : "FAIL");
