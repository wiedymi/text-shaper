import { describe, expect, test } from "bun:test";
import { Reader } from "../../../src/font/binary/reader.ts";
import { parseCoverage } from "../../../src/layout/structures/coverage.ts";
import { SetDigest, createLookupDigest } from "../../../src/layout/structures/set-digest.ts";

function createBuffer(...bytes: number[]): ArrayBuffer {
	return new Uint8Array(bytes).buffer;
}

describe("SetDigest", () => {
	describe("add", () => {
		test("adds single glyph", () => {
			const digest = new SetDigest();
			digest.add(10);

			expect(digest.mayHave(10)).toBe(true);
		});

		test("adds multiple glyphs", () => {
			const digest = new SetDigest();
			digest.add(5);
			digest.add(10);
			digest.add(15);

			expect(digest.mayHave(5)).toBe(true);
			expect(digest.mayHave(10)).toBe(true);
			expect(digest.mayHave(15)).toBe(true);
		});

		test("handles glyph ID 0", () => {
			const digest = new SetDigest();
			digest.add(0);

			expect(digest.mayHave(0)).toBe(true);
		});

		test("handles high glyph IDs", () => {
			const digest = new SetDigest();
			digest.add(65535);

			expect(digest.mayHave(65535)).toBe(true);
		});

		test("sets bits in all three masks", () => {
			const digest = new SetDigest();
			digest.add(100);

			const masks = digest.getMasks();
			expect(masks.mask0).not.toBe(0);
			expect(masks.mask1).not.toBe(0);
			expect(masks.mask2).not.toBe(0);
		});
	});

	describe("addRange", () => {
		test("adds small range individually (< 32)", () => {
			const digest = new SetDigest();
			digest.addRange(10, 20);

			for (let i = 10; i <= 20; i++) {
				expect(digest.mayHave(i)).toBe(true);
			}

			expect(digest.mayHave(9)).toBe(false);
			expect(digest.mayHave(21)).toBe(false);
		});

		test("adds range of exactly 31 individually", () => {
			const digest = new SetDigest();
			digest.addRange(100, 131);

			expect(digest.mayHave(100)).toBe(true);
			expect(digest.mayHave(115)).toBe(true);
			expect(digest.mayHave(131)).toBe(true);

			// Note: bloom filters can have false positives, so we test
			// that at least one glyph outside the range is detected as false
			// We use a very distant glyph to minimize false positives
			expect(digest.mayHave(10000)).toBe(false);
		});

		test("adds large range (>= 32) by setting all bits", () => {
			const digest = new SetDigest();
			digest.addRange(10, 50);

			const masks = digest.getMasks();
			expect(masks.mask0).toBe(0xffffffff);
			expect(masks.mask1).toBe(0xffffffff);
			expect(masks.mask2).toBe(0xffffffff);

			// With all bits set, mayHave will always return true
			expect(digest.mayHave(1)).toBe(true);
			expect(digest.mayHave(100)).toBe(true);
			expect(digest.mayHave(65535)).toBe(true);
		});

		test("adds range of exactly 32 by setting all bits", () => {
			const digest = new SetDigest();
			digest.addRange(0, 32);

			const masks = digest.getMasks();
			expect(masks.mask0).toBe(0xffffffff);
			expect(masks.mask1).toBe(0xffffffff);
			expect(masks.mask2).toBe(0xffffffff);
		});

		test("adds single glyph range", () => {
			const digest = new SetDigest();
			digest.addRange(10, 10);

			expect(digest.mayHave(10)).toBe(true);
			expect(digest.mayHave(9)).toBe(false);
			expect(digest.mayHave(11)).toBe(false);
		});
	});

	describe("mayHave", () => {
		test("returns false for glyph not in digest", () => {
			const digest = new SetDigest();
			digest.add(10);

			expect(digest.mayHave(20)).toBe(false);
		});

		test("returns true for glyph in digest", () => {
			const digest = new SetDigest();
			digest.add(10);

			expect(digest.mayHave(10)).toBe(true);
		});

		test("may have false positives due to bloom filter", () => {
			// This is inherent to bloom filters - we can't guarantee
			// false positives won't happen, but we can verify the basic logic
			const digest = new SetDigest();
			digest.add(0);

			// At minimum, 0 should be detected
			expect(digest.mayHave(0)).toBe(true);
		});

		test("requires all three masks to match", () => {
			const digest = new SetDigest();
			// Empty digest should return false
			expect(digest.mayHave(10)).toBe(false);
		});
	});

	describe("addCoverage", () => {
		test("adds all glyphs from Format 1 coverage", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x03, // glyphCount = 3
				0x00, 0x05, // glyph[0] = 5
				0x00, 0x0a, // glyph[1] = 10
				0x00, 0x0f, // glyph[2] = 15
			));
			const coverage = parseCoverage(reader);

			const digest = new SetDigest();
			digest.addCoverage(coverage);

			expect(digest.mayHave(5)).toBe(true);
			expect(digest.mayHave(10)).toBe(true);
			expect(digest.mayHave(15)).toBe(true);
			expect(digest.mayHave(7)).toBe(false);
		});

		test("adds all glyphs from Format 2 coverage", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x02, // format = 2
				0x00, 0x02, // rangeCount = 2
				0x00, 0x05, // range[0].start = 5
				0x00, 0x07, // range[0].end = 7
				0x00, 0x00, // range[0].startIndex = 0
				0x00, 0x0a, // range[1].start = 10
				0x00, 0x0b, // range[1].end = 11
				0x00, 0x03, // range[1].startIndex = 3
			));
			const coverage = parseCoverage(reader);

			const digest = new SetDigest();
			digest.addCoverage(coverage);

			// Glyphs from first range
			expect(digest.mayHave(5)).toBe(true);
			expect(digest.mayHave(6)).toBe(true);
			expect(digest.mayHave(7)).toBe(true);

			// Glyphs from second range
			expect(digest.mayHave(10)).toBe(true);
			expect(digest.mayHave(11)).toBe(true);

			// Gap between ranges
			expect(digest.mayHave(8)).toBe(false);
			expect(digest.mayHave(9)).toBe(false);
		});

		test("handles empty coverage", () => {
			const reader = new Reader(createBuffer(
				0x00, 0x01, // format = 1
				0x00, 0x00, // glyphCount = 0
			));
			const coverage = parseCoverage(reader);

			const digest = new SetDigest();
			digest.addCoverage(coverage);

			expect(digest.mayHave(0)).toBe(false);
			expect(digest.mayHave(10)).toBe(false);
		});
	});

	describe("mayIntersect", () => {
		test("returns true when digests intersect", () => {
			const digest1 = new SetDigest();
			digest1.add(10);
			digest1.add(20);

			const digest2 = new SetDigest();
			digest2.add(10);
			digest2.add(30);

			expect(digest1.mayIntersect(digest2)).toBe(true);
		});

		test("returns false when digests do not intersect", () => {
			const digest1 = new SetDigest();
			digest1.add(10);

			const digest2 = new SetDigest();
			digest2.add(1000);

			expect(digest1.mayIntersect(digest2)).toBe(false);
		});

		test("returns false when one digest is empty", () => {
			const digest1 = new SetDigest();
			digest1.add(10);

			const digest2 = new SetDigest();

			expect(digest1.mayIntersect(digest2)).toBe(false);
		});

		test("returns false when both digests are empty", () => {
			const digest1 = new SetDigest();
			const digest2 = new SetDigest();

			expect(digest1.mayIntersect(digest2)).toBe(false);
		});

		test("returns true when both have same glyphs", () => {
			const digest1 = new SetDigest();
			digest1.add(10);
			digest1.add(20);
			digest1.add(30);

			const digest2 = new SetDigest();
			digest2.add(10);
			digest2.add(20);
			digest2.add(30);

			expect(digest1.mayIntersect(digest2)).toBe(true);
		});

		test("requires all three masks to overlap", () => {
			const digest1 = new SetDigest();
			digest1.add(5);

			const digest2 = new SetDigest();
			digest2.add(5);

			// Same glyph should definitely intersect
			expect(digest1.mayIntersect(digest2)).toBe(true);
		});
	});

	describe("getMasks", () => {
		test("returns current mask values", () => {
			const digest = new SetDigest();

			const masks1 = digest.getMasks();
			expect(masks1.mask0).toBe(0);
			expect(masks1.mask1).toBe(0);
			expect(masks1.mask2).toBe(0);

			digest.add(10);

			const masks2 = digest.getMasks();
			expect(masks2.mask0).not.toBe(0);
			expect(masks2.mask1).not.toBe(0);
			expect(masks2.mask2).not.toBe(0);
		});

		test("returns independent object", () => {
			const digest = new SetDigest();
			digest.add(10);

			const masks1 = digest.getMasks();
			const masks2 = digest.getMasks();

			expect(masks1).not.toBe(masks2);
			expect(masks1.mask0).toBe(masks2.mask0);
			expect(masks1.mask1).toBe(masks2.mask1);
			expect(masks1.mask2).toBe(masks2.mask2);
		});
	});
});

describe("createLookupDigest", () => {
	test("creates digest from single coverage", () => {
		const reader = new Reader(createBuffer(
			0x00, 0x01, // format = 1
			0x00, 0x02, // glyphCount = 2
			0x00, 0x05, // glyph[0] = 5
			0x00, 0x0a, // glyph[1] = 10
		));
		const coverage = parseCoverage(reader);

		const digest = createLookupDigest([coverage]);

		expect(digest.mayHave(5)).toBe(true);
		expect(digest.mayHave(10)).toBe(true);
		expect(digest.mayHave(7)).toBe(false);
	});

	test("creates digest from multiple coverages", () => {
		const reader1 = new Reader(createBuffer(
			0x00, 0x01, // format = 1
			0x00, 0x02, // glyphCount = 2
			0x00, 0x05, // glyph[0] = 5
			0x00, 0x0a, // glyph[1] = 10
		));
		const coverage1 = parseCoverage(reader1);

		const reader2 = new Reader(createBuffer(
			0x00, 0x01, // format = 1
			0x00, 0x02, // glyphCount = 2
			0x00, 0x14, // glyph[0] = 20
			0x00, 0x1e, // glyph[1] = 30
		));
		const coverage2 = parseCoverage(reader2);

		const digest = createLookupDigest([coverage1, coverage2]);

		expect(digest.mayHave(5)).toBe(true);
		expect(digest.mayHave(10)).toBe(true);
		expect(digest.mayHave(20)).toBe(true);
		expect(digest.mayHave(30)).toBe(true);
		expect(digest.mayHave(15)).toBe(false);
	});

	test("creates empty digest from empty array", () => {
		const digest = createLookupDigest([]);

		expect(digest.mayHave(0)).toBe(false);
		expect(digest.mayHave(10)).toBe(false);
	});

	test("handles coverage with many glyphs", () => {
		const reader = new Reader(createBuffer(
			0x00, 0x02, // format = 2
			0x00, 0x01, // rangeCount = 1
			0x00, 0x0a, // start = 10
			0x00, 0x64, // end = 100
			0x00, 0x00, // startIndex = 0
		));
		const coverage = parseCoverage(reader);

		const digest = createLookupDigest([coverage]);

		expect(digest.mayHave(10)).toBe(true);
		expect(digest.mayHave(50)).toBe(true);
		expect(digest.mayHave(100)).toBe(true);

		// Use distant glyph to test rejection (bloom filters can have false positives)
		expect(digest.mayHave(10000)).toBe(false);
	});
});

describe("SetDigest edge cases", () => {
	test("handles multiple adds of same glyph", () => {
		const digest = new SetDigest();
		digest.add(10);
		digest.add(10);
		digest.add(10);

		expect(digest.mayHave(10)).toBe(true);
	});

	test("different glyphs may share bits in bloom filter", () => {
		// This tests the bloom filter property - different glyphs
		// can set the same bits, which is expected behavior
		const digest = new SetDigest();

		// Add a glyph
		digest.add(10);

		// Glyph 10 should be detected
		expect(digest.mayHave(10)).toBe(true);

		// Some other glyph might also be detected (false positive)
		// but we can't predict which, so we just verify the basic property
		const masks = digest.getMasks();
		expect(masks.mask0).not.toBe(0);
	});

	test("glyph IDs at bit boundaries", () => {
		const digest = new SetDigest();

		// Test glyphs at powers of 2
		digest.add(1);
		digest.add(2);
		digest.add(4);
		digest.add(8);
		digest.add(16);
		digest.add(32);
		digest.add(64);
		digest.add(128);
		digest.add(256);
		digest.add(512);
		digest.add(1024);

		expect(digest.mayHave(1)).toBe(true);
		expect(digest.mayHave(2)).toBe(true);
		expect(digest.mayHave(4)).toBe(true);
		expect(digest.mayHave(8)).toBe(true);
		expect(digest.mayHave(16)).toBe(true);
		expect(digest.mayHave(32)).toBe(true);
		expect(digest.mayHave(64)).toBe(true);
		expect(digest.mayHave(128)).toBe(true);
		expect(digest.mayHave(256)).toBe(true);
		expect(digest.mayHave(512)).toBe(true);
		expect(digest.mayHave(1024)).toBe(true);
	});

	test("combines addRange and add", () => {
		const digest = new SetDigest();
		digest.addRange(10, 20);
		digest.add(50);
		digest.add(100);

		expect(digest.mayHave(15)).toBe(true);
		expect(digest.mayHave(50)).toBe(true);
		expect(digest.mayHave(100)).toBe(true);
		expect(digest.mayHave(30)).toBe(false);
	});

	test("large range overwrites previous adds", () => {
		const digest = new SetDigest();
		digest.add(5);

		const masksBefore = digest.getMasks();

		// Adding large range sets all bits to 0xffffffff
		digest.addRange(100, 200);

		const masksAfter = digest.getMasks();
		expect(masksAfter.mask0).toBe(0xffffffff);
		expect(masksAfter.mask1).toBe(0xffffffff);
		expect(masksAfter.mask2).toBe(0xffffffff);

		// Now everything returns true
		expect(digest.mayHave(5)).toBe(true);
		expect(digest.mayHave(1000)).toBe(true);
	});
});
