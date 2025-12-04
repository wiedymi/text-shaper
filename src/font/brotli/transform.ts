/**
 * Dictionary word transformations for Brotli decompression
 * Based on brotli.js reference implementation (Apache 2.0 License)
 */

const IDENTITY = 0;
const OMIT_LAST_1 = 1;
const OMIT_LAST_2 = 2;
const OMIT_LAST_3 = 3;
const OMIT_LAST_4 = 4;
const OMIT_LAST_5 = 5;
const OMIT_LAST_6 = 6;
const OMIT_LAST_7 = 7;
const OMIT_LAST_8 = 8;
const OMIT_LAST_9 = 9;
const UPPERCASE_FIRST = 10;
const UPPERCASE_ALL = 11;
const OMIT_FIRST_1 = 12;
const OMIT_FIRST_2 = 13;
const OMIT_FIRST_3 = 14;
const OMIT_FIRST_4 = 15;
const OMIT_FIRST_5 = 16;
const OMIT_FIRST_6 = 17;
const OMIT_FIRST_7 = 18;
const OMIT_FIRST_8 = 19;
const OMIT_FIRST_9 = 20;

interface Transform {
	prefix: Uint8Array;
	transform: number;
	suffix: Uint8Array;
}

function makeTransform(prefix: string, transform: number, suffix: string): Transform {
	const prefixBytes = new Uint8Array(prefix.length);
	const suffixBytes = new Uint8Array(suffix.length);
	for (let i = 0; i < prefix.length; i++) prefixBytes[i] = prefix.charCodeAt(i);
	for (let i = 0; i < suffix.length; i++) suffixBytes[i] = suffix.charCodeAt(i);
	return { prefix: prefixBytes, transform, suffix: suffixBytes };
}

export const TRANSFORMS: Transform[] = [
	makeTransform("", IDENTITY, ""),
	makeTransform("", IDENTITY, " "),
	makeTransform(" ", IDENTITY, " "),
	makeTransform("", OMIT_FIRST_1, ""),
	makeTransform("", UPPERCASE_FIRST, " "),
	makeTransform("", IDENTITY, " the "),
	makeTransform(" ", IDENTITY, ""),
	makeTransform("s ", IDENTITY, " "),
	makeTransform("", IDENTITY, " of "),
	makeTransform("", UPPERCASE_FIRST, ""),
	makeTransform("", IDENTITY, " and "),
	makeTransform("", OMIT_FIRST_2, ""),
	makeTransform("", OMIT_LAST_1, ""),
	makeTransform(", ", IDENTITY, " "),
	makeTransform("", IDENTITY, ", "),
	makeTransform(" ", UPPERCASE_FIRST, " "),
	makeTransform("", IDENTITY, " in "),
	makeTransform("", IDENTITY, " to "),
	makeTransform("e ", IDENTITY, " "),
	makeTransform("", IDENTITY, "\""),
	makeTransform("", IDENTITY, "."),
	makeTransform("", IDENTITY, "\">"),
	makeTransform("", IDENTITY, "\n"),
	makeTransform("", OMIT_LAST_3, ""),
	makeTransform("", IDENTITY, "]"),
	makeTransform("", IDENTITY, " for "),
	makeTransform("", OMIT_FIRST_3, ""),
	makeTransform("", OMIT_LAST_2, ""),
	makeTransform("", IDENTITY, " a "),
	makeTransform("", IDENTITY, " that "),
	makeTransform(" ", UPPERCASE_FIRST, ""),
	makeTransform("", IDENTITY, ". "),
	makeTransform(".", IDENTITY, ""),
	makeTransform(" ", IDENTITY, ", "),
	makeTransform("", OMIT_FIRST_4, ""),
	makeTransform("", IDENTITY, " with "),
	makeTransform("", IDENTITY, "'"),
	makeTransform("", IDENTITY, " from "),
	makeTransform("", IDENTITY, " by "),
	makeTransform("", OMIT_FIRST_5, ""),
	makeTransform("", OMIT_FIRST_6, ""),
	makeTransform(" the ", IDENTITY, ""),
	makeTransform("", OMIT_LAST_4, ""),
	makeTransform("", IDENTITY, ". The "),
	makeTransform("", UPPERCASE_ALL, ""),
	makeTransform("", IDENTITY, " on "),
	makeTransform("", IDENTITY, " as "),
	makeTransform("", IDENTITY, " is "),
	makeTransform("", OMIT_LAST_7, ""),
	makeTransform("", OMIT_LAST_1, "ing "),
	makeTransform("", IDENTITY, "\n\t"),
	makeTransform("", IDENTITY, ":"),
	makeTransform(" ", IDENTITY, ". "),
	makeTransform("", IDENTITY, "ed "),
	makeTransform("", OMIT_FIRST_9, ""),
	makeTransform("", OMIT_FIRST_7, ""),
	makeTransform("", OMIT_LAST_6, ""),
	makeTransform("", IDENTITY, "("),
	makeTransform("", UPPERCASE_FIRST, ", "),
	makeTransform("", OMIT_LAST_8, ""),
	makeTransform("", IDENTITY, " at "),
	makeTransform("", IDENTITY, "ly "),
	makeTransform(" the ", IDENTITY, " of "),
	makeTransform("", OMIT_LAST_5, ""),
	makeTransform("", OMIT_LAST_9, ""),
	makeTransform(" ", UPPERCASE_FIRST, ", "),
	makeTransform("", UPPERCASE_FIRST, "\""),
	makeTransform(".", IDENTITY, "("),
	makeTransform("", UPPERCASE_ALL, " "),
	makeTransform("", UPPERCASE_FIRST, "\">"),
	makeTransform("", IDENTITY, "=\""),
	makeTransform(" ", IDENTITY, "."),
	makeTransform(".com/", IDENTITY, ""),
	makeTransform(" the ", IDENTITY, " of the "),
	makeTransform("", UPPERCASE_FIRST, "'"),
	makeTransform("", IDENTITY, ". This "),
	makeTransform("", IDENTITY, ","),
	makeTransform(".", IDENTITY, " "),
	makeTransform("", UPPERCASE_FIRST, "("),
	makeTransform("", UPPERCASE_FIRST, "."),
	makeTransform("", IDENTITY, " not "),
	makeTransform(" ", IDENTITY, "=\""),
	makeTransform("", IDENTITY, "er "),
	makeTransform(" ", UPPERCASE_ALL, " "),
	makeTransform("", IDENTITY, "al "),
	makeTransform(" ", UPPERCASE_ALL, ""),
	makeTransform("", IDENTITY, "='"),
	makeTransform("", UPPERCASE_ALL, "\""),
	makeTransform("", UPPERCASE_FIRST, ". "),
	makeTransform(" ", IDENTITY, "("),
	makeTransform("", IDENTITY, "ful "),
	makeTransform(" ", UPPERCASE_FIRST, ". "),
	makeTransform("", IDENTITY, "ive "),
	makeTransform("", IDENTITY, "less "),
	makeTransform("", UPPERCASE_ALL, "'"),
	makeTransform("", IDENTITY, "est "),
	makeTransform(" ", UPPERCASE_FIRST, "."),
	makeTransform("", UPPERCASE_ALL, "\">"),
	makeTransform(" ", IDENTITY, "='"),
	makeTransform("", UPPERCASE_FIRST, ","),
	makeTransform("", IDENTITY, "ize "),
	makeTransform("", UPPERCASE_ALL, "."),
	makeTransform("\xc2\xa0", IDENTITY, ""),
	makeTransform(" ", IDENTITY, ","),
	makeTransform("", UPPERCASE_FIRST, "=\""),
	makeTransform("", UPPERCASE_ALL, "=\""),
	makeTransform("", IDENTITY, "ous "),
	makeTransform("", UPPERCASE_ALL, ", "),
	makeTransform("", UPPERCASE_FIRST, "='"),
	makeTransform(" ", UPPERCASE_FIRST, ","),
	makeTransform(" ", UPPERCASE_ALL, "=\""),
	makeTransform(" ", UPPERCASE_ALL, ", "),
	makeTransform("", UPPERCASE_ALL, ","),
	makeTransform("", UPPERCASE_ALL, "("),
	makeTransform("", UPPERCASE_ALL, ". "),
	makeTransform(" ", UPPERCASE_ALL, "."),
	makeTransform("", UPPERCASE_ALL, "='"),
	makeTransform(" ", UPPERCASE_ALL, ". "),
	makeTransform(" ", UPPERCASE_FIRST, "=\""),
	makeTransform(" ", UPPERCASE_ALL, "='"),
	makeTransform(" ", UPPERCASE_FIRST, "='"),
];

function toUpperCase(p: Uint8Array, i: number): number {
	if (p[i] < 0xc0) {
		if (p[i] >= 97 && p[i] <= 122) {
			p[i] ^= 32;
		}
		return 1;
	}

	// UTF-8 multi-byte
	if (p[i] < 0xe0) {
		p[i + 1] ^= 32;
		return 2;
	}

	// Three-byte characters
	p[i + 2] ^= 5;
	return 3;
}

export function transformDictionaryWord(
	dst: Uint8Array,
	idx: number,
	wordOffset: number,
	len: number,
	transformIdx: number,
	dictionary: Uint8Array
): number {
	const transform = TRANSFORMS[transformIdx];
	const t = transform.transform;
	let skip = t < OMIT_FIRST_1 ? 0 : t - (OMIT_FIRST_1 - 1);
	const startIdx = idx;

	if (skip > len) skip = len;

	// Write prefix
	for (let i = 0; i < transform.prefix.length; i++) {
		dst[idx++] = transform.prefix[i];
	}

	let word = wordOffset + skip;
	let wordLen = len - skip;

	if (t <= OMIT_LAST_9) {
		wordLen -= t;
	}

	// Copy dictionary word
	for (let i = 0; i < wordLen; i++) {
		dst[idx++] = dictionary[word + i];
	}

	let uppercase = idx - wordLen;

	if (t === UPPERCASE_FIRST) {
		toUpperCase(dst, uppercase);
	} else if (t === UPPERCASE_ALL) {
		while (wordLen > 0) {
			const step = toUpperCase(dst, uppercase);
			uppercase += step;
			wordLen -= step;
		}
	}

	// Write suffix
	for (let i = 0; i < transform.suffix.length; i++) {
		dst[idx++] = transform.suffix[i];
	}

	return idx - startIdx;
}
