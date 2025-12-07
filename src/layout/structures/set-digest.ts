import type { GlyphId } from "../../types.ts";
import type { Coverage } from "./coverage.ts";

/**
 * Set Digest - A Bloom filter for fast O(1) glyph membership rejection.
 *
 * Uses three 64-bit masks with different bit shifts (0, 4, 9) to minimize
 * false positives. This is the same technique used by HarfBuzz/rustybuzz.
 *
 * The digest allows us to quickly reject glyphs that are definitely NOT
 * in a lookup's coverage without doing expensive Coverage table lookups.
 */
export class SetDigest {
	// Use two 32-bit numbers per mask since JS doesn't have native 64-bit integers
	// and BigInt is slow. We use the lower 32 bits only (6 bits per mask = 64 values)
	private mask0 = 0; // Bits 0-5 of glyphId
	private mask1 = 0; // Bits 4-9 of glyphId
	private mask2 = 0; // Bits 9-14 of glyphId

	/**
	 * Add a single glyph to the digest
	 * @param glyphId - The glyph ID to add
	 */
	add(glyphId: GlyphId): void {
		// Each mask uses 6 bits of the glyph ID at different positions
		this.mask0 |= 1 << (glyphId & 0x1f);
		this.mask1 |= 1 << ((glyphId >> 4) & 0x1f);
		this.mask2 |= 1 << ((glyphId >> 9) & 0x1f);
	}

	/**
	 * Add a range of glyphs to the digest
	 * @param start - Start glyph ID (inclusive)
	 * @param end - End glyph ID (inclusive)
	 */
	addRange(start: GlyphId, end: GlyphId): void {
		// For small ranges, add individually
		if (end - start < 32) {
			for (let gid = start; gid <= end; gid++) {
				this.add(gid);
			}
		} else {
			// For large ranges, set all bits (approximation that allows false positives)
			this.mask0 = 0xffffffff;
			this.mask1 = 0xffffffff;
			this.mask2 = 0xffffffff;
		}
	}

	/**
	 * Fast check if glyph MAY be in the set
	 * @param glyphId - The glyph ID to check
	 * @returns False if glyph is definitely NOT in the set, true if glyph MAY be in the set (false positives possible)
	 */
	mayHave(glyphId: GlyphId): boolean {
		return (
			(this.mask0 & (1 << (glyphId & 0x1f))) !== 0 &&
			(this.mask1 & (1 << ((glyphId >> 4) & 0x1f))) !== 0 &&
			(this.mask2 & (1 << ((glyphId >> 9) & 0x1f))) !== 0
		);
	}

	/**
	 * Add all glyphs from a Coverage table to this digest
	 * @param coverage - The coverage table containing glyphs to add
	 */
	addCoverage(coverage: Coverage): void {
		// Coverage.glyphs() returns all covered glyph IDs
		const glyphs = coverage.glyphs();
		for (let i = 0; i < glyphs.length; i++) {
			const gid = glyphs[i]!;
			this.add(gid);
		}
	}

	/**
	 * Check if this digest MAY intersect with another digest
	 * @param other - The other digest to check intersection with
	 * @returns False if there is definitely NO overlap, true if there MAY be overlap (false positives possible)
	 */
	mayIntersect(other: SetDigest): boolean {
		return (
			(this.mask0 & other.mask0) !== 0 &&
			(this.mask1 & other.mask1) !== 0 &&
			(this.mask2 & other.mask2) !== 0
		);
	}

	/**
	 * Get raw masks for external comparison
	 * @returns Object containing the three internal mask values
	 */
	getMasks(): { mask0: number; mask1: number; mask2: number } {
		return { mask0: this.mask0, mask1: this.mask1, mask2: this.mask2 };
	}
}

/**
 * Create a SetDigest from multiple Coverage tables (for a lookup with multiple subtables)
 * @param coverages - Array of coverage tables to combine into a single digest
 * @returns A new SetDigest containing all glyphs from all coverage tables
 */
export function createLookupDigest(coverages: Coverage[]): SetDigest {
	const digest = new SetDigest();
	for (let i = 0; i < coverages.length; i++) {
		const coverage = coverages[i]!;
		digest.addCoverage(coverage);
	}
	return digest;
}
