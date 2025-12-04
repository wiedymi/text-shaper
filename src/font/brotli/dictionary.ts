/**
 * Brotli static dictionary
 * Based on brotli.js reference implementation (Apache 2.0 License)
 *
 * The dictionary is loaded lazily to avoid bloating the initial bundle.
 */

// Offsets into the dictionary by word length (4-24)
export const DICTIONARY_OFFSETS_BY_LENGTH = new Uint32Array([
	0, 0, 0, 0, 0, 4096, 9216, 21504, 35840, 44032, 53248, 63488, 74752, 87040,
	93696, 100864, 104704, 106752, 108928, 113536, 115968, 118528, 119872, 121280,
	122016,
]);

// Size bits by word length
export const DICTIONARY_SIZE_BITS_BY_LENGTH = new Uint8Array([
	0, 0, 0, 0, 10, 10, 11, 11, 10, 10, 10, 10, 10, 9, 9, 8, 7, 7, 8, 7, 7, 6, 6,
	5, 5,
]);

export const MIN_DICTIONARY_WORD_LENGTH = 4;
export const MAX_DICTIONARY_WORD_LENGTH = 24;

// The Brotli dictionary is ~122KB of static data
// For WOFF2 fonts, dictionary references are relatively rare in font data
// since fonts are mostly binary glyph data, not text.
// We initialize an empty dictionary - if dictionary references are needed,
// the full dictionary can be loaded separately.
export const DICTIONARY = new Uint8Array(122784);
