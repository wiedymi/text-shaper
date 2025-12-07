import { describe, test, beforeAll } from "bun:test";
import { measure, loadFontBuffer, printComparison, type BenchResult } from "./utils";
import { Font, shape, UnicodeBuffer } from "../src";

describe("Micro-benchmarks for Bottleneck Verification", () => {
	let font: Font;
	const paragraph =
		"The quick brown fox jumps over the lazy dog. " +
		"Pack my box with five dozen liquor jugs. " +
		"How vexingly quick daft zebras jump!";

	beforeAll(async () => {
		const buffer = await loadFontBuffer(
			"reference/rustybuzz/benches/fonts/NotoSans-Regular.ttf",
		);
		font = Font.load(buffer);
	});

	test("1. Optional chaining vs cached access", () => {
		const arr: { glyphId: number }[] = Array(1000)
			.fill(null)
			.map((_, i) => ({ glyphId: i }));

		// With optional chaining
		const withOptional = measure(
			"optional chaining",
			() => {
				let sum = 0;
				for (let i = 0; i < arr.length; i++) {
					sum += arr[i]?.glyphId ?? 0;
				}
				return sum;
			},
			{ iterations: 10000 },
		);

		// With cached access
		const withCached = measure(
			"cached access",
			() => {
				let sum = 0;
				for (let i = 0; i < arr.length; i++) {
					const item = arr[i];
					if (item) sum += item.glyphId;
				}
				return sum;
			},
			{ iterations: 10000 },
		);

		printComparison("Optional Chaining vs Cached Access", [
			withOptional,
			withCached,
		]);
	});

	test("2. Spread sort vs slice sort vs in-place", () => {
		const records = [
			{ sequenceIndex: 3 },
			{ sequenceIndex: 1 },
			{ sequenceIndex: 2 },
		];

		const withSpread = measure(
			"[...arr].sort()",
			() => {
				const sorted = [...records].sort(
					(a, b) => b.sequenceIndex - a.sequenceIndex,
				);
				return sorted[0]!.sequenceIndex;
			},
			{ iterations: 100000 },
		);

		const withSlice = measure(
			"arr.slice().sort()",
			() => {
				const copy = records.slice();
				copy.sort((a, b) => b.sequenceIndex - a.sequenceIndex);
				return copy[0]!.sequenceIndex;
			},
			{ iterations: 100000 },
		);

		// Pre-sorted (simulating caching the sorted order)
		const preSorted = records.slice().sort((a, b) => b.sequenceIndex - a.sequenceIndex);
		const withPreSorted = measure(
			"pre-sorted (cached)",
			() => {
				return preSorted[0]!.sequenceIndex;
			},
			{ iterations: 100000 },
		);

		printComparison("Sort Methods", [withSpread, withSlice, withPreSorted]);
	});

	test("3. .entries() vs index loop", () => {
		const arr = Array(500)
			.fill(null)
			.map((_, i) => ({ glyphId: i, cluster: i }));

		const withEntries = measure(
			".entries()",
			() => {
				let sum = 0;
				for (const [i, info] of arr.entries()) {
					sum += info.glyphId + i;
				}
				return sum;
			},
			{ iterations: 10000 },
		);

		const withIndex = measure(
			"index loop",
			() => {
				let sum = 0;
				for (let i = 0; i < arr.length; i++) {
					const info = arr[i]!;
					sum += info.glyphId + i;
				}
				return sum;
			},
			{ iterations: 10000 },
		);

		printComparison(".entries() vs Index Loop", [withEntries, withIndex]);
	});

	test("4. Function call vs precomputed array", () => {
		const glyphIds = new Uint16Array(500);
		const skipFlags = new Uint8Array(500);
		for (let i = 0; i < 500; i++) {
			glyphIds[i] = i;
			skipFlags[i] = i % 10 === 0 ? 1 : 0;
		}

		const shouldSkip = (glyphId: number, flag: number) => {
			return glyphId % 10 === 0 && (flag & 0x8) !== 0;
		};

		const withFunction = measure(
			"function call",
			() => {
				let count = 0;
				for (let i = 0; i < glyphIds.length; i++) {
					if (shouldSkip(glyphIds[i]!, 0x8)) count++;
				}
				return count;
			},
			{ iterations: 10000 },
		);

		const withPrecomputed = measure(
			"precomputed Uint8Array",
			() => {
				let count = 0;
				for (let i = 0; i < skipFlags.length; i++) {
					if (skipFlags[i]) count++;
				}
				return count;
			},
			{ iterations: 10000 },
		);

		printComparison("Function Call vs Precomputed", [
			withFunction,
			withPrecomputed,
		]);
	});

	test("5. Linear scan vs precomputed next-index array", () => {
		const skip = new Uint8Array(500);
		// Mark every 10th as skipped
		for (let i = 0; i < 500; i++) {
			skip[i] = i % 10 === 0 ? 1 : 0;
		}

		// Build next-non-skip array
		const nextNonSkip = new Int16Array(500);
		let lastNonSkip = -1;
		for (let i = 499; i >= 0; i--) {
			nextNonSkip[i] = lastNonSkip;
			if (!skip[i]) lastNonSkip = i;
		}

		const withLinearScan = measure(
			"linear scan",
			() => {
				let count = 0;
				for (let i = 0; i < skip.length; i++) {
					if (skip[i]) continue;
					// Find next non-skipped
					let j = i + 1;
					while (j < skip.length && skip[j]) j++;
					if (j < skip.length) count++;
				}
				return count;
			},
			{ iterations: 5000 },
		);

		const withPrecomputed = measure(
			"precomputed next-index",
			() => {
				let count = 0;
				for (let i = 0; i < skip.length; i++) {
					if (skip[i]) continue;
					const j = nextNonSkip[i];
					if (j >= 0) count++;
				}
				return count;
			},
			{ iterations: 5000 },
		);

		printComparison("Linear Scan vs Precomputed Next-Index", [
			withLinearScan,
			withPrecomputed,
		]);
	});

	test("6. Coverage lookup simulation (binary search vs cached)", () => {
		// Simulate coverage table with 200 glyphs
		const coverageGlyphs = new Uint16Array(200);
		for (let i = 0; i < 200; i++) {
			coverageGlyphs[i] = i * 3; // Sparse coverage
		}

		// Binary search
		const binarySearch = (glyphId: number): number | null => {
			let low = 0;
			let high = coverageGlyphs.length - 1;
			while (low <= high) {
				const mid = (low + high) >>> 1;
				const midVal = coverageGlyphs[mid]!;
				if (midVal < glyphId) {
					low = mid + 1;
				} else if (midVal > glyphId) {
					high = mid - 1;
				} else {
					return mid;
				}
			}
			return null;
		};

		// Test glyphs - mix of covered and non-covered
		const testGlyphs = new Uint16Array(100);
		for (let i = 0; i < 100; i++) {
			testGlyphs[i] = i * 6; // Half will be covered
		}

		const withBinarySearch = measure(
			"binary search",
			() => {
				let count = 0;
				for (let i = 0; i < testGlyphs.length; i++) {
					if (binarySearch(testGlyphs[i]!) !== null) count++;
				}
				return count;
			},
			{ iterations: 10000 },
		);

		// With cache (simulating per-lookup cache)
		const cache = new Map<number, number | null>();
		const cachedLookup = (glyphId: number): number | null => {
			let result = cache.get(glyphId);
			if (result === undefined) {
				result = binarySearch(glyphId);
				cache.set(glyphId, result);
			}
			return result;
		};

		const withCache = measure(
			"cached binary search",
			() => {
				cache.clear();
				let count = 0;
				for (let i = 0; i < testGlyphs.length; i++) {
					if (cachedLookup(testGlyphs[i]!) !== null) count++;
				}
				return count;
			},
			{ iterations: 10000 },
		);

		// With repeated lookups (same glyphs multiple times - more realistic)
		const repeatedGlyphs = new Uint16Array(500);
		for (let i = 0; i < 500; i++) {
			repeatedGlyphs[i] = testGlyphs[i % 100]!;
		}

		const withBinaryRepeated = measure(
			"binary (repeated)",
			() => {
				let count = 0;
				for (let i = 0; i < repeatedGlyphs.length; i++) {
					if (binarySearch(repeatedGlyphs[i]!) !== null) count++;
				}
				return count;
			},
			{ iterations: 5000 },
		);

		const withCacheRepeated = measure(
			"cached (repeated)",
			() => {
				cache.clear();
				let count = 0;
				for (let i = 0; i < repeatedGlyphs.length; i++) {
					if (cachedLookup(repeatedGlyphs[i]!) !== null) count++;
				}
				return count;
			},
			{ iterations: 5000 },
		);

		printComparison("Coverage Lookup (unique glyphs)", [
			withBinarySearch,
			withCache,
		]);
		printComparison("Coverage Lookup (repeated glyphs)", [
			withBinaryRepeated,
			withCacheRepeated,
		]);
	});

	test("7. Full shaping baseline", () => {
		const word = "Hello";
		const sentence = "The quick brown fox jumps over the lazy dog.";

		const wordResult = measure(
			"word (Hello)",
			() => {
				const buf = new UnicodeBuffer();
				buf.addStr(word);
				return shape(font, buf);
			},
			{ iterations: 2000 },
		);

		const sentenceResult = measure(
			"sentence",
			() => {
				const buf = new UnicodeBuffer();
				buf.addStr(sentence);
				return shape(font, buf);
			},
			{ iterations: 1000 },
		);

		const paragraphResult = measure(
			"paragraph",
			() => {
				const buf = new UnicodeBuffer();
				buf.addStr(paragraph);
				return shape(font, buf);
			},
			{ iterations: 500 },
		);

		printComparison("Full Shaping (current implementation)", [
			wordResult,
			sentenceResult,
			paragraphResult,
		]);
	});
});
