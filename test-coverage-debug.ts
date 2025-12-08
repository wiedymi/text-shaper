import { setupKhmerMasks, reorderKhmer, getKhmerCategory, KhmerCategory } from "./src/shaper/complex/khmer.ts";
import type { GlyphInfo } from "./src/types.ts";

function makeInfo(codepoint: number): GlyphInfo {
	return { glyphId: 0, cluster: 0, mask: 0, codepoint };
}

// Test case 1: undefined in outer loop (lines 102-103)
console.log("Test 1: undefined in setupKhmerMasks outer loop");
const test1 = new Array(3);
test1[0] = makeInfo(0x1780);
test1[2] = makeInfo(0x17c1);
console.log("Before:", test1);
setupKhmerMasks(test1);
console.log("After:", test1);

// Test case 2: undefined in inner loop (lines 126-127)
console.log("\nTest 2: undefined in setupKhmerMasks inner loop");
const test2 = new Array(4);
test2[0] = makeInfo(0x1780); // consonant
test2[2] = makeInfo(0x17b6); // vowel
console.log("Before:", test2);
setupKhmerMasks(test2);
console.log("After:", test2);

// Test case 3: consonant not preceded by coeng (lines 138-140)
console.log("\nTest 3: consonant not preceded by coeng");
const test3 = [
	makeInfo(0x1780), // consonant
	makeInfo(0x1781), // consonant (not preceded by coeng)
];
console.log("Before:", test3);
setupKhmerMasks(test3);
console.log("After:", test3);

// Test case 4: coeng without following consonant (line 155)
console.log("\nTest 4: coeng at end");
const test4 = new Array(3);
test4[0] = makeInfo(0x1780); // consonant
test4[1] = makeInfo(0x17d2); // coeng
// test4[2] is undefined
console.log("Before:", test4);
setupKhmerMasks(test4);
console.log("After:", test4);

// Test case 5: undefined in reorderKhmer (lines 209-210)
console.log("\nTest 5: undefined in reorderKhmer");
const test5 = new Array(3);
test5[0] = makeInfo(0x1780);
test5[2] = makeInfo(0x17c1);
console.log("Before:", test5);
reorderKhmer(test5);
console.log("After:", test5);

// Test case 6: More complex syllable break
console.log("\nTest 6: Complex syllable with consonant after vowel");
const test6 = [
	makeInfo(0x1780), // ក consonant
	makeInfo(0x17b6), // ා vowel
	makeInfo(0x1781), // ខ consonant (should break syllable)
];
console.log("Before:", test6);
console.log("Categories:", test6.map(i => getKhmerCategory(i.codepoint)));
setupKhmerMasks(test6);
console.log("After:", test6);
console.log("Masks:", test6.map(i => i.mask));

// Test case 7: consonant with undefined before it
console.log("\nTest 7: consonant with undefined prevInfo");
const test7 = new Array(3);
test7[0] = makeInfo(0x1780); // consonant
// test7[1] is undefined
test7[2] = makeInfo(0x1781); // consonant
console.log("Before:", test7);
setupKhmerMasks(test7);
console.log("After:", test7);
console.log("Masks:", test7.map(i => i ? i.mask : undefined));
