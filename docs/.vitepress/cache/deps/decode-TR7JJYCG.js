import "./chunk-BUSYA2B4.js";

// src/font/brotli/dictionary.ts
var DICTIONARY_OFFSETS_BY_LENGTH = new Uint32Array([
  0,
  0,
  0,
  0,
  0,
  4096,
  9216,
  21504,
  35840,
  44032,
  53248,
  63488,
  74752,
  87040,
  93696,
  100864,
  104704,
  106752,
  108928,
  113536,
  115968,
  118528,
  119872,
  121280,
  122016
]);
var DICTIONARY_SIZE_BITS_BY_LENGTH = new Uint8Array([
  0,
  0,
  0,
  0,
  10,
  10,
  11,
  11,
  10,
  10,
  10,
  10,
  10,
  9,
  9,
  8,
  7,
  7,
  8,
  7,
  7,
  6,
  6,
  5,
  5
]);
var DICTIONARY = new Uint8Array(122784);

// src/font/brotli/context.ts
var CONTEXT_LOOKUP = new Uint8Array([
  // CONTEXT_UTF8, last byte (0-255)
  // ASCII range
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  4,
  4,
  0,
  0,
  4,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  8,
  12,
  16,
  12,
  12,
  20,
  12,
  16,
  24,
  28,
  12,
  12,
  32,
  12,
  36,
  12,
  44,
  44,
  44,
  44,
  44,
  44,
  44,
  44,
  44,
  44,
  32,
  32,
  24,
  40,
  28,
  12,
  12,
  48,
  52,
  52,
  52,
  48,
  52,
  52,
  52,
  48,
  52,
  52,
  52,
  52,
  52,
  48,
  52,
  52,
  52,
  52,
  52,
  48,
  52,
  52,
  52,
  52,
  52,
  24,
  12,
  28,
  12,
  12,
  12,
  56,
  60,
  60,
  60,
  56,
  60,
  60,
  60,
  56,
  60,
  60,
  60,
  60,
  60,
  56,
  60,
  60,
  60,
  60,
  60,
  56,
  60,
  60,
  60,
  60,
  60,
  24,
  12,
  28,
  12,
  0,
  // UTF8 continuation byte range
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  0,
  1,
  // UTF8 lead byte range
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  2,
  3,
  // CONTEXT_UTF8 second last byte (256-511)
  // ASCII range
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  1,
  1,
  1,
  1,
  1,
  1,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  1,
  1,
  1,
  1,
  0,
  // UTF8 continuation byte range
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  // UTF8 lead byte range
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  // CONTEXT_SIGNED, second last byte (512-767)
  0,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  6,
  6,
  6,
  6,
  6,
  6,
  6,
  6,
  6,
  6,
  6,
  6,
  6,
  6,
  6,
  7,
  // CONTEXT_SIGNED, last byte (768-1023)
  0,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  24,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  32,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  40,
  48,
  48,
  48,
  48,
  48,
  48,
  48,
  48,
  48,
  48,
  48,
  48,
  48,
  48,
  48,
  56,
  // CONTEXT_LSB6, last byte (1024-1279)
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  // CONTEXT_MSB6, last byte (1280-1535)
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  6,
  6,
  6,
  6,
  7,
  7,
  7,
  7,
  8,
  8,
  8,
  8,
  9,
  9,
  9,
  9,
  10,
  10,
  10,
  10,
  11,
  11,
  11,
  11,
  12,
  12,
  12,
  12,
  13,
  13,
  13,
  13,
  14,
  14,
  14,
  14,
  15,
  15,
  15,
  15,
  16,
  16,
  16,
  16,
  17,
  17,
  17,
  17,
  18,
  18,
  18,
  18,
  19,
  19,
  19,
  19,
  20,
  20,
  20,
  20,
  21,
  21,
  21,
  21,
  22,
  22,
  22,
  22,
  23,
  23,
  23,
  23,
  24,
  24,
  24,
  24,
  25,
  25,
  25,
  25,
  26,
  26,
  26,
  26,
  27,
  27,
  27,
  27,
  28,
  28,
  28,
  28,
  29,
  29,
  29,
  29,
  30,
  30,
  30,
  30,
  31,
  31,
  31,
  31,
  32,
  32,
  32,
  32,
  33,
  33,
  33,
  33,
  34,
  34,
  34,
  34,
  35,
  35,
  35,
  35,
  36,
  36,
  36,
  36,
  37,
  37,
  37,
  37,
  38,
  38,
  38,
  38,
  39,
  39,
  39,
  39,
  40,
  40,
  40,
  40,
  41,
  41,
  41,
  41,
  42,
  42,
  42,
  42,
  43,
  43,
  43,
  43,
  44,
  44,
  44,
  44,
  45,
  45,
  45,
  45,
  46,
  46,
  46,
  46,
  47,
  47,
  47,
  47,
  48,
  48,
  48,
  48,
  49,
  49,
  49,
  49,
  50,
  50,
  50,
  50,
  51,
  51,
  51,
  51,
  52,
  52,
  52,
  52,
  53,
  53,
  53,
  53,
  54,
  54,
  54,
  54,
  55,
  55,
  55,
  55,
  56,
  56,
  56,
  56,
  57,
  57,
  57,
  57,
  58,
  58,
  58,
  58,
  59,
  59,
  59,
  59,
  60,
  60,
  60,
  60,
  61,
  61,
  61,
  61,
  62,
  62,
  62,
  62,
  63,
  63,
  63,
  63,
  // CONTEXT_{M,L}SB6, second last byte (1536-1791)
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0
]);
var CONTEXT_LOOKUP_OFFSETS = new Uint16Array([
  // CONTEXT_LSB6
  1024,
  1536,
  // CONTEXT_MSB6
  1280,
  1536,
  // CONTEXT_UTF8
  0,
  256,
  // CONTEXT_SIGNED
  768,
  512
]);

// src/font/brotli/transform.ts
var IDENTITY = 0;
var OMIT_LAST_1 = 1;
var OMIT_LAST_2 = 2;
var OMIT_LAST_3 = 3;
var OMIT_LAST_4 = 4;
var OMIT_LAST_5 = 5;
var OMIT_LAST_6 = 6;
var OMIT_LAST_7 = 7;
var OMIT_LAST_8 = 8;
var OMIT_LAST_9 = 9;
var UPPERCASE_FIRST = 10;
var UPPERCASE_ALL = 11;
var OMIT_FIRST_1 = 12;
var OMIT_FIRST_2 = 13;
var OMIT_FIRST_3 = 14;
var OMIT_FIRST_4 = 15;
var OMIT_FIRST_5 = 16;
var OMIT_FIRST_6 = 17;
var OMIT_FIRST_7 = 18;
var OMIT_FIRST_9 = 20;
function makeTransform(prefix, transform, suffix) {
  const prefixBytes = new Uint8Array(prefix.length);
  const suffixBytes = new Uint8Array(suffix.length);
  for (let i = 0; i < prefix.length; i++) prefixBytes[i] = prefix.charCodeAt(i);
  for (let i = 0; i < suffix.length; i++) suffixBytes[i] = suffix.charCodeAt(i);
  return { prefix: prefixBytes, transform, suffix: suffixBytes };
}
var TRANSFORMS = [
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
  makeTransform("", IDENTITY, '"'),
  makeTransform("", IDENTITY, "."),
  makeTransform("", IDENTITY, '">'),
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
  makeTransform("", IDENTITY, "\n	"),
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
  makeTransform("", UPPERCASE_FIRST, '"'),
  makeTransform(".", IDENTITY, "("),
  makeTransform("", UPPERCASE_ALL, " "),
  makeTransform("", UPPERCASE_FIRST, '">'),
  makeTransform("", IDENTITY, '="'),
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
  makeTransform(" ", IDENTITY, '="'),
  makeTransform("", IDENTITY, "er "),
  makeTransform(" ", UPPERCASE_ALL, " "),
  makeTransform("", IDENTITY, "al "),
  makeTransform(" ", UPPERCASE_ALL, ""),
  makeTransform("", IDENTITY, "='"),
  makeTransform("", UPPERCASE_ALL, '"'),
  makeTransform("", UPPERCASE_FIRST, ". "),
  makeTransform(" ", IDENTITY, "("),
  makeTransform("", IDENTITY, "ful "),
  makeTransform(" ", UPPERCASE_FIRST, ". "),
  makeTransform("", IDENTITY, "ive "),
  makeTransform("", IDENTITY, "less "),
  makeTransform("", UPPERCASE_ALL, "'"),
  makeTransform("", IDENTITY, "est "),
  makeTransform(" ", UPPERCASE_FIRST, "."),
  makeTransform("", UPPERCASE_ALL, '">'),
  makeTransform(" ", IDENTITY, "='"),
  makeTransform("", UPPERCASE_FIRST, ","),
  makeTransform("", IDENTITY, "ize "),
  makeTransform("", UPPERCASE_ALL, "."),
  makeTransform("Â ", IDENTITY, ""),
  makeTransform(" ", IDENTITY, ","),
  makeTransform("", UPPERCASE_FIRST, '="'),
  makeTransform("", UPPERCASE_ALL, '="'),
  makeTransform("", IDENTITY, "ous "),
  makeTransform("", UPPERCASE_ALL, ", "),
  makeTransform("", UPPERCASE_FIRST, "='"),
  makeTransform(" ", UPPERCASE_FIRST, ","),
  makeTransform(" ", UPPERCASE_ALL, '="'),
  makeTransform(" ", UPPERCASE_ALL, ", "),
  makeTransform("", UPPERCASE_ALL, ","),
  makeTransform("", UPPERCASE_ALL, "("),
  makeTransform("", UPPERCASE_ALL, ". "),
  makeTransform(" ", UPPERCASE_ALL, "."),
  makeTransform("", UPPERCASE_ALL, "='"),
  makeTransform(" ", UPPERCASE_ALL, ". "),
  makeTransform(" ", UPPERCASE_FIRST, '="'),
  makeTransform(" ", UPPERCASE_ALL, "='"),
  makeTransform(" ", UPPERCASE_FIRST, "='")
];
function toUpperCase(p, i) {
  if (p[i] < 192) {
    if (p[i] >= 97 && p[i] <= 122) {
      p[i] ^= 32;
    }
    return 1;
  }
  if (p[i] < 224) {
    p[i + 1] ^= 32;
    return 2;
  }
  p[i + 2] ^= 5;
  return 3;
}
function transformDictionaryWord(dst, idx, wordOffset, len, transformIdx, dictionary) {
  const transform = TRANSFORMS[transformIdx];
  const t = transform.transform;
  let skip = t < OMIT_FIRST_1 ? 0 : t - (OMIT_FIRST_1 - 1);
  const startIdx = idx;
  if (skip > len) skip = len;
  for (let i = 0; i < transform.prefix.length; i++) {
    dst[idx++] = transform.prefix[i];
  }
  let word = wordOffset + skip;
  let wordLen = len - skip;
  if (t <= OMIT_LAST_9) {
    wordLen -= t;
  }
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
  for (let i = 0; i < transform.suffix.length; i++) {
    dst[idx++] = transform.suffix[i];
  }
  return idx - startIdx;
}

// src/font/brotli/decode.ts
var MAX_HUFFMAN_TABLE_SIZE = 1080;
var CODE_LENGTH_CODES = 18;
var NUM_LITERAL_CODES = 256;
var NUM_INSERT_AND_COPY_CODES = 704;
var NUM_BLOCK_LENGTH_CODES = 26;
var NUM_DISTANCE_SHORT_CODES = 16;
var HUFFMAN_TABLE_BITS = 8;
var HUFFMAN_TABLE_MASK = 255;
var CODE_LENGTH_CODE_ORDER = new Uint8Array([
  1,
  2,
  3,
  4,
  0,
  5,
  17,
  6,
  16,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15
]);
var DISTANCE_SHORT_CODE_INDEX_OFFSET = new Uint8Array([
  3,
  2,
  1,
  0,
  3,
  3,
  3,
  3,
  3,
  3,
  2,
  2,
  2,
  2,
  2,
  2
]);
var DISTANCE_SHORT_CODE_VALUE_OFFSET = new Int8Array([
  0,
  0,
  0,
  0,
  -1,
  1,
  -2,
  2,
  -3,
  3,
  -1,
  1,
  -2,
  2,
  -3,
  3
]);
var BLOCK_LENGTH_PREFIX = [
  { offset: 1, nbits: 2 },
  { offset: 5, nbits: 2 },
  { offset: 9, nbits: 2 },
  { offset: 13, nbits: 2 },
  { offset: 17, nbits: 3 },
  { offset: 25, nbits: 3 },
  { offset: 33, nbits: 3 },
  { offset: 41, nbits: 3 },
  { offset: 49, nbits: 4 },
  { offset: 65, nbits: 4 },
  { offset: 81, nbits: 4 },
  { offset: 97, nbits: 4 },
  { offset: 113, nbits: 5 },
  { offset: 145, nbits: 5 },
  { offset: 177, nbits: 5 },
  { offset: 209, nbits: 5 },
  { offset: 241, nbits: 6 },
  { offset: 305, nbits: 6 },
  { offset: 369, nbits: 7 },
  { offset: 497, nbits: 8 },
  { offset: 753, nbits: 9 },
  { offset: 1265, nbits: 10 },
  { offset: 2289, nbits: 11 },
  { offset: 4337, nbits: 12 },
  { offset: 8433, nbits: 13 },
  { offset: 16625, nbits: 24 }
];
var INSERT_LENGTH_PREFIX = [
  { offset: 0, nbits: 0 },
  { offset: 1, nbits: 0 },
  { offset: 2, nbits: 0 },
  { offset: 3, nbits: 0 },
  { offset: 4, nbits: 0 },
  { offset: 5, nbits: 0 },
  { offset: 6, nbits: 1 },
  { offset: 8, nbits: 1 },
  { offset: 10, nbits: 2 },
  { offset: 14, nbits: 2 },
  { offset: 18, nbits: 3 },
  { offset: 26, nbits: 3 },
  { offset: 34, nbits: 4 },
  { offset: 50, nbits: 4 },
  { offset: 66, nbits: 5 },
  { offset: 98, nbits: 5 },
  { offset: 130, nbits: 6 },
  { offset: 194, nbits: 7 },
  { offset: 322, nbits: 8 },
  { offset: 578, nbits: 9 },
  { offset: 1090, nbits: 10 },
  { offset: 2114, nbits: 12 },
  { offset: 6210, nbits: 14 },
  { offset: 22594, nbits: 24 }
];
var COPY_LENGTH_PREFIX = [
  { offset: 2, nbits: 0 },
  { offset: 3, nbits: 0 },
  { offset: 4, nbits: 0 },
  { offset: 5, nbits: 0 },
  { offset: 6, nbits: 0 },
  { offset: 7, nbits: 0 },
  { offset: 8, nbits: 0 },
  { offset: 9, nbits: 0 },
  { offset: 10, nbits: 1 },
  { offset: 12, nbits: 1 },
  { offset: 14, nbits: 2 },
  { offset: 18, nbits: 2 },
  { offset: 22, nbits: 3 },
  { offset: 30, nbits: 3 },
  { offset: 38, nbits: 4 },
  { offset: 54, nbits: 4 },
  { offset: 70, nbits: 5 },
  { offset: 102, nbits: 5 },
  { offset: 134, nbits: 6 },
  { offset: 198, nbits: 7 },
  { offset: 326, nbits: 8 },
  { offset: 582, nbits: 9 },
  { offset: 1094, nbits: 10 },
  { offset: 2118, nbits: 24 }
];
var INSERT_RANGE_LUT = [0, 0, 8, 8, 0, 16, 8, 16, 16];
var COPY_RANGE_LUT = [0, 8, 0, 8, 16, 0, 16, 8, 16];
var BitReader = class {
  constructor(data) {
    this.data = data;
    this.buf = new Uint8Array(8224);
    this.fillBuffer();
    for (let i = 0; i < 4; i++) {
      this.val |= this.buf[this.pos] << 8 * i;
      this.pos++;
    }
  }
  buf;
  pos = 0;
  val = 0;
  bitPos = 0;
  bitEndPos = 0;
  eos = false;
  fillBuffer() {
    if (this.bitEndPos > 256) return;
    if (this.eos) {
      if (this.bitPos > this.bitEndPos) {
        throw new Error("Unexpected end of input");
      }
      return;
    }
    const remaining = this.data.length - this.pos;
    const toRead = Math.min(4096, remaining);
    if (toRead > 0) {
      this.buf.set(this.data.subarray(this.pos, this.pos + toRead), 0);
      this.pos = 0;
    }
    if (toRead < 4096) {
      this.eos = true;
      for (let i = 0; i < 32; i++) {
        this.buf[toRead + i] = 0;
      }
    }
    this.bitEndPos += toRead << 3;
  }
  readMoreInput() {
    if (this.bitEndPos > 256) return;
    if (this.eos) {
      if (this.bitPos > this.bitEndPos) {
        throw new Error("Unexpected end of input");
      }
      return;
    }
    const dst = this.pos & 4095;
    const bytesRemaining = Math.min(4096, this.data.length - (this.pos & ~4095));
    if (bytesRemaining > 0) {
      const srcStart = this.pos & ~4095;
      this.buf.set(this.data.subarray(srcStart, srcStart + bytesRemaining), dst === 0 ? 0 : 4096);
    }
    if (bytesRemaining < 4096) {
      this.eos = true;
      for (let i = 0; i < 32; i++) {
        this.buf[dst + bytesRemaining + i] = 0;
      }
    }
    this.bitEndPos += bytesRemaining << 3;
  }
  fillBitWindow() {
    while (this.bitPos >= 8) {
      this.val >>>= 8;
      this.val |= this.buf[this.pos & 8191] << 24;
      this.pos++;
      this.bitPos -= 8;
      this.bitEndPos -= 8;
    }
  }
  readBits(n) {
    if (32 - this.bitPos < n) {
      this.fillBitWindow();
    }
    const val = this.val >>> this.bitPos & (1 << n) - 1;
    this.bitPos += n;
    return val;
  }
  peekBits() {
    this.fillBitWindow();
    return this.val >>> this.bitPos & HUFFMAN_TABLE_MASK;
  }
  get currentBitPos() {
    return this.bitPos;
  }
  set currentBitPos(v) {
    this.bitPos = v;
  }
  get currentVal() {
    return this.val;
  }
};
function buildHuffmanTable(rootTable, tableOffset, rootBits, codeLengths, codeLengthsSize) {
  const MAX_LENGTH = 15;
  const count = new Int32Array(MAX_LENGTH + 1);
  const offset = new Int32Array(MAX_LENGTH + 1);
  const sorted = new Int32Array(codeLengthsSize);
  for (let i = 0; i < codeLengthsSize; i++) {
    count[codeLengths[i]]++;
  }
  offset[1] = 0;
  for (let len = 1; len < MAX_LENGTH; len++) {
    offset[len + 1] = offset[len] + count[len];
  }
  for (let i = 0; i < codeLengthsSize; i++) {
    if (codeLengths[i] !== 0) {
      sorted[offset[codeLengths[i]]++] = i;
    }
  }
  let tableBits = rootBits;
  let tableSize = 1 << tableBits;
  let totalSize = tableSize;
  if (offset[MAX_LENGTH] === 1) {
    for (let i = 0; i < totalSize; i++) {
      rootTable[tableOffset + i] = { bits: 0, value: sorted[0] & 65535 };
    }
    return totalSize;
  }
  let key = 0;
  let symbol = 0;
  for (let len = 1, step = 2; len <= rootBits; len++, step <<= 1) {
    for (; count[len] > 0; count[len]--) {
      const code = { bits: len & 255, value: sorted[symbol++] & 65535 };
      replicateValue(rootTable, tableOffset + key, step, tableSize, code);
      key = getNextKey(key, len);
    }
  }
  const mask = totalSize - 1;
  let low = -1;
  let table = tableOffset;
  for (let len = rootBits + 1, step = 2; len <= MAX_LENGTH; len++, step <<= 1) {
    for (; count[len] > 0; count[len]--) {
      if ((key & mask) !== low) {
        table += tableSize;
        tableBits = nextTableBitSize(count, len, rootBits);
        tableSize = 1 << tableBits;
        totalSize += tableSize;
        low = key & mask;
        rootTable[tableOffset + low] = {
          bits: tableBits + rootBits & 255,
          value: table - tableOffset - low & 65535
        };
      }
      const code = { bits: len - rootBits & 255, value: sorted[symbol++] & 65535 };
      replicateValue(rootTable, table + (key >> rootBits), step, tableSize, code);
      key = getNextKey(key, len);
    }
  }
  return totalSize;
}
function getNextKey(key, len) {
  let step = 1 << len - 1;
  while (key & step) {
    step >>= 1;
  }
  return (key & step - 1) + step;
}
function replicateValue(table, offset, step, end, code) {
  do {
    end -= step;
    table[offset + end] = { bits: code.bits, value: code.value };
  } while (end > 0);
}
function nextTableBitSize(count, len, rootBits) {
  let left = 1 << len - rootBits;
  while (len < 15) {
    left -= count[len];
    if (left <= 0) break;
    len++;
    left <<= 1;
  }
  return len - rootBits;
}
function readSymbol(table, tableOffset, br) {
  br.fillBitWindow();
  let index = tableOffset + (br.currentVal >>> br.currentBitPos & HUFFMAN_TABLE_MASK);
  let nbits = table[index].bits - HUFFMAN_TABLE_BITS;
  if (nbits > 0) {
    br.currentBitPos += HUFFMAN_TABLE_BITS;
    index += table[index].value;
    index += br.currentVal >>> br.currentBitPos & (1 << nbits) - 1;
  }
  br.currentBitPos += table[index].bits;
  return table[index].value;
}
function decodeVarLenUint8(br) {
  if (br.readBits(1)) {
    const nbits = br.readBits(3);
    if (nbits === 0) return 1;
    return br.readBits(nbits) + (1 << nbits);
  }
  return 0;
}
function decodeWindowBits(br) {
  if (br.readBits(1) === 0) return 16;
  let n = br.readBits(3);
  if (n > 0) return 17 + n;
  n = br.readBits(3);
  if (n > 0) return 8 + n;
  return 17;
}
function decodeMetaBlockLength(br) {
  const isLast = br.readBits(1) === 1;
  if (isLast && br.readBits(1)) {
    return { length: 0, isLast: true, isUncompressed: false, isMetadata: false };
  }
  let sizeNibbles = br.readBits(2) + 4;
  if (sizeNibbles === 7) {
    if (br.readBits(1) !== 0) throw new Error("Invalid reserved bit");
    const sizeBytes = br.readBits(2);
    if (sizeBytes === 0) return { length: 0, isLast, isUncompressed: false, isMetadata: true };
    let length2 = 0;
    for (let i = 0; i < sizeBytes; i++) {
      const nextByte = br.readBits(8);
      if (i + 1 === sizeBytes && sizeBytes > 1 && nextByte === 0) {
        throw new Error("Invalid size byte");
      }
      length2 |= nextByte << i * 8;
    }
    return { length: length2 + 1, isLast, isUncompressed: false, isMetadata: true };
  }
  let length = 0;
  for (let i = 0; i < sizeNibbles; i++) {
    const nextNibble = br.readBits(4);
    if (i + 1 === sizeNibbles && sizeNibbles > 4 && nextNibble === 0) {
      throw new Error("Invalid size nibble");
    }
    length |= nextNibble << i * 4;
  }
  length++;
  const isUncompressed = !isLast ? br.readBits(1) === 1 : false;
  return { length, isLast, isUncompressed, isMetadata: false };
}
function readHuffmanCodeLengths(codeLengthCodeLengths, numSymbols, codeLengths, br) {
  const DEFAULT_CODE_LENGTH = 8;
  const CODE_LENGTH_REPEAT_CODE = 16;
  let symbol = 0;
  let prevCodeLen = DEFAULT_CODE_LENGTH;
  let repeat = 0;
  let repeatCodeLen = 0;
  let space = 32768;
  const table = [];
  for (let i = 0; i < 32; i++) {
    table.push({ bits: 0, value: 0 });
  }
  buildHuffmanTable(table, 0, 5, codeLengthCodeLengths, CODE_LENGTH_CODES);
  while (symbol < numSymbols && space > 0) {
    br.readMoreInput();
    br.fillBitWindow();
    const p = br.currentVal >>> br.currentBitPos & 31;
    br.currentBitPos += table[p].bits;
    const codeLen = table[p].value & 255;
    if (codeLen < CODE_LENGTH_REPEAT_CODE) {
      repeat = 0;
      codeLengths[symbol++] = codeLen;
      if (codeLen !== 0) {
        prevCodeLen = codeLen;
        space -= 32768 >> codeLen;
      }
    } else {
      const extraBits = codeLen - 14;
      let newLen = 0;
      if (codeLen === CODE_LENGTH_REPEAT_CODE) {
        newLen = prevCodeLen;
      }
      if (repeatCodeLen !== newLen) {
        repeat = 0;
        repeatCodeLen = newLen;
      }
      const oldRepeat = repeat;
      if (repeat > 0) {
        repeat -= 2;
        repeat <<= extraBits;
      }
      repeat += br.readBits(extraBits) + 3;
      const repeatDelta = repeat - oldRepeat;
      if (symbol + repeatDelta > numSymbols) {
        throw new Error("Symbol overflow");
      }
      for (let i = 0; i < repeatDelta; i++) {
        codeLengths[symbol + i] = repeatCodeLen;
      }
      symbol += repeatDelta;
      if (repeatCodeLen !== 0) {
        space -= repeatDelta << 15 - repeatCodeLen;
      }
    }
  }
  if (space !== 0) {
    throw new Error("Invalid code lengths");
  }
  for (; symbol < numSymbols; symbol++) {
    codeLengths[symbol] = 0;
  }
}
function readHuffmanCode(alphabetSize, tables, tableOffset, br) {
  const codeLengths = new Uint8Array(alphabetSize);
  br.readMoreInput();
  const simpleCodeOrSkip = br.readBits(2);
  if (simpleCodeOrSkip === 1) {
    let maxBitsCounter = alphabetSize - 1;
    let maxBits = 0;
    while (maxBitsCounter) {
      maxBitsCounter >>= 1;
      maxBits++;
    }
    const symbols = new Int32Array(4);
    const numSymbols = br.readBits(2) + 1;
    for (let i = 0; i < numSymbols; i++) {
      symbols[i] = br.readBits(maxBits) % alphabetSize;
      codeLengths[symbols[i]] = 2;
    }
    codeLengths[symbols[0]] = 1;
    switch (numSymbols) {
      case 2:
        if (symbols[0] === symbols[1]) throw new Error("Invalid symbols");
        codeLengths[symbols[1]] = 1;
        break;
      case 4:
        if (br.readBits(1)) {
          codeLengths[symbols[2]] = 3;
          codeLengths[symbols[3]] = 3;
        } else {
          codeLengths[symbols[0]] = 2;
        }
        break;
    }
  } else {
    const codeLengthCodeLengths = new Uint8Array(CODE_LENGTH_CODES);
    let space = 32;
    let numCodes = 0;
    const huff = [
      { bits: 2, value: 0 },
      { bits: 2, value: 4 },
      { bits: 2, value: 3 },
      { bits: 3, value: 2 },
      { bits: 2, value: 0 },
      { bits: 2, value: 4 },
      { bits: 2, value: 3 },
      { bits: 4, value: 1 },
      { bits: 2, value: 0 },
      { bits: 2, value: 4 },
      { bits: 2, value: 3 },
      { bits: 3, value: 2 },
      { bits: 2, value: 0 },
      { bits: 2, value: 4 },
      { bits: 2, value: 3 },
      { bits: 4, value: 5 }
    ];
    for (let i = simpleCodeOrSkip; i < CODE_LENGTH_CODES && space > 0; i++) {
      const codeLenIdx = CODE_LENGTH_CODE_ORDER[i];
      br.fillBitWindow();
      const p = br.currentVal >>> br.currentBitPos & 15;
      br.currentBitPos += huff[p].bits;
      const v = huff[p].value;
      codeLengthCodeLengths[codeLenIdx] = v;
      if (v !== 0) {
        space -= 32 >> v;
        numCodes++;
      }
    }
    if (!(numCodes === 1 || space === 0)) {
      throw new Error("Invalid code length codes");
    }
    readHuffmanCodeLengths(codeLengthCodeLengths, alphabetSize, codeLengths, br);
  }
  return buildHuffmanTable(tables, tableOffset, HUFFMAN_TABLE_BITS, codeLengths, alphabetSize);
}
var HuffmanTreeGroup = class {
  constructor(alphabetSize, numHTrees) {
    this.alphabetSize = alphabetSize;
    this.numHTrees = numHTrees;
    this.htrees = new Uint32Array(numHTrees);
    const maxSize = this.getMaxTableSize();
    for (let i = 0; i < numHTrees + numHTrees * maxSize; i++) {
      this.codes.push({ bits: 0, value: 0 });
    }
  }
  codes = [];
  htrees;
  getMaxTableSize() {
    const sizes = [
      256,
      402,
      436,
      468,
      500,
      534,
      566,
      598,
      630,
      662,
      694,
      726,
      758,
      790,
      822,
      854,
      886,
      920,
      952,
      984,
      1016,
      1048,
      1080
    ];
    const idx = this.alphabetSize + 31 >>> 5;
    return sizes[Math.min(idx, sizes.length - 1)];
  }
  decode(br) {
    let next = 0;
    for (let i = 0; i < this.numHTrees; i++) {
      this.htrees[i] = next;
      const tableSize = readHuffmanCode(this.alphabetSize, this.codes, next, br);
      next += tableSize;
    }
  }
};
function decodeContextMap(contextMapSize, br) {
  br.readMoreInput();
  const numHTrees = decodeVarLenUint8(br) + 1;
  const contextMap = new Uint8Array(contextMapSize);
  if (numHTrees <= 1) {
    return { numHTrees, contextMap };
  }
  const useRleForZeros = br.readBits(1) === 1;
  let maxRunLengthPrefix = 0;
  if (useRleForZeros) {
    maxRunLengthPrefix = br.readBits(4) + 1;
  }
  const table = [];
  for (let i = 0; i < MAX_HUFFMAN_TABLE_SIZE; i++) {
    table.push({ bits: 0, value: 0 });
  }
  readHuffmanCode(numHTrees + maxRunLengthPrefix, table, 0, br);
  for (let i = 0; i < contextMapSize; ) {
    br.readMoreInput();
    const code = readSymbol(table, 0, br);
    if (code === 0) {
      contextMap[i++] = 0;
    } else if (code <= maxRunLengthPrefix) {
      const reps = 1 + (1 << code) + br.readBits(code);
      for (let j = 1; j < reps && i < contextMapSize; j++) {
        contextMap[i++] = 0;
      }
    } else {
      contextMap[i++] = code - maxRunLengthPrefix;
    }
  }
  if (br.readBits(1)) {
    const mtf = new Uint8Array(256);
    for (let i = 0; i < 256; i++) mtf[i] = i;
    for (let i = 0; i < contextMapSize; i++) {
      const idx = contextMap[i];
      contextMap[i] = mtf[idx];
      if (idx) {
        const value = mtf[idx];
        for (let j = idx; j > 0; j--) mtf[j] = mtf[j - 1];
        mtf[0] = value;
      }
    }
  }
  return { numHTrees, contextMap };
}
function readBlockLength(table, tableOffset, br) {
  const code = readSymbol(table, tableOffset, br);
  const prefix = BLOCK_LENGTH_PREFIX[code];
  return prefix.offset + br.readBits(prefix.nbits);
}
function translateShortCodes(code, ringBuffer, index) {
  if (code < NUM_DISTANCE_SHORT_CODES) {
    const idx = index + DISTANCE_SHORT_CODE_INDEX_OFFSET[code] & 3;
    return ringBuffer[idx] + DISTANCE_SHORT_CODE_VALUE_OFFSET[code];
  }
  return code - NUM_DISTANCE_SHORT_CODES + 1;
}
function decompress(data) {
  const br = new BitReader(data);
  const windowBits = decodeWindowBits(br);
  const maxBackwardDistance = (1 << windowBits) - 16;
  const ringBufferSize = 1 << windowBits;
  const ringBufferMask = ringBufferSize - 1;
  const ringBuffer = new Uint8Array(ringBufferSize + 578);
  let pos = 0;
  let maxDistance = 0;
  const distRb = [16, 15, 11, 4];
  let distRbIdx = 0;
  let prevByte1 = 0;
  let prevByte2 = 0;
  const output = [];
  while (true) {
    br.readMoreInput();
    const meta = decodeMetaBlockLength(br);
    if (meta.length === 0 && meta.isLast) {
      break;
    }
    if (meta.isMetadata) {
      br.currentBitPos = br.currentBitPos + 7 & ~7;
      for (let i = 0; i < meta.length; i++) {
        br.readMoreInput();
        br.readBits(8);
      }
      continue;
    }
    let metaBlockRemaining = meta.length;
    if (metaBlockRemaining === 0) continue;
    if (meta.isUncompressed) {
      br.currentBitPos = br.currentBitPos + 7 & ~7;
      for (let i = 0; i < metaBlockRemaining; i++) {
        br.readMoreInput();
        const byte = br.readBits(8);
        ringBuffer[pos & ringBufferMask] = byte;
        if ((pos & ringBufferMask) === ringBufferMask) {
          output.push(...ringBuffer.slice(0, ringBufferSize));
        }
        pos++;
      }
      continue;
    }
    const numBlockTypes = [1, 1, 1];
    const blockLength = [1 << 28, 1 << 28, 1 << 28];
    const blockType = [0, 0, 0];
    const blockTypeRb = [0, 1, 0, 1, 0, 1];
    const blockTypeRbIndex = [0, 0, 0];
    const blockTypeTrees = [];
    const blockLenTrees = [];
    for (let i = 0; i < 3 * MAX_HUFFMAN_TABLE_SIZE; i++) {
      blockTypeTrees.push({ bits: 0, value: 0 });
      blockLenTrees.push({ bits: 0, value: 0 });
    }
    for (let i = 0; i < 3; i++) {
      numBlockTypes[i] = decodeVarLenUint8(br) + 1;
      if (numBlockTypes[i] >= 2) {
        readHuffmanCode(numBlockTypes[i] + 2, blockTypeTrees, i * MAX_HUFFMAN_TABLE_SIZE, br);
        readHuffmanCode(NUM_BLOCK_LENGTH_CODES, blockLenTrees, i * MAX_HUFFMAN_TABLE_SIZE, br);
        blockLength[i] = readBlockLength(blockLenTrees, i * MAX_HUFFMAN_TABLE_SIZE, br);
        blockTypeRbIndex[i] = 1;
      }
    }
    br.readMoreInput();
    const distancePostfixBits = br.readBits(2);
    const numDirectDistanceCodes = NUM_DISTANCE_SHORT_CODES + (br.readBits(4) << distancePostfixBits);
    const distancePostfixMask = (1 << distancePostfixBits) - 1;
    const numDistanceCodes = numDirectDistanceCodes + (48 << distancePostfixBits);
    const contextModes = new Uint8Array(numBlockTypes[0]);
    for (let i = 0; i < numBlockTypes[0]; i++) {
      br.readMoreInput();
      contextModes[i] = br.readBits(2) << 1;
    }
    const literalContextMap = decodeContextMap(numBlockTypes[0] << 6, br);
    const distContextMap = decodeContextMap(numBlockTypes[2] << 2, br);
    const hgroup = [
      new HuffmanTreeGroup(NUM_LITERAL_CODES, literalContextMap.numHTrees),
      new HuffmanTreeGroup(NUM_INSERT_AND_COPY_CODES, numBlockTypes[1]),
      new HuffmanTreeGroup(numDistanceCodes, distContextMap.numHTrees)
    ];
    for (let i = 0; i < 3; i++) {
      hgroup[i].decode(br);
    }
    let contextMapSlice = 0;
    let distContextMapSlice = 0;
    let contextMode = contextModes[blockType[0]];
    let contextLookupOffset1 = CONTEXT_LOOKUP_OFFSETS[contextMode];
    let contextLookupOffset2 = CONTEXT_LOOKUP_OFFSETS[contextMode + 1];
    let htreeCommand = hgroup[1].htrees[0];
    while (metaBlockRemaining > 0) {
      br.readMoreInput();
      if (blockLength[1] === 0) {
        const typeCode = readSymbol(blockTypeTrees, MAX_HUFFMAN_TABLE_SIZE, br);
        let bt;
        if (typeCode === 0) {
          bt = blockTypeRb[2 + (blockTypeRbIndex[1] & 1)];
        } else if (typeCode === 1) {
          bt = blockTypeRb[2 + (blockTypeRbIndex[1] - 1 & 1)] + 1;
        } else {
          bt = typeCode - 2;
        }
        if (bt >= numBlockTypes[1]) bt -= numBlockTypes[1];
        blockType[1] = bt;
        blockTypeRb[2 + (blockTypeRbIndex[1] & 1)] = bt;
        blockTypeRbIndex[1]++;
        blockLength[1] = readBlockLength(blockLenTrees, MAX_HUFFMAN_TABLE_SIZE, br);
        htreeCommand = hgroup[1].htrees[blockType[1]];
      }
      blockLength[1]--;
      const cmdCode = readSymbol(hgroup[1].codes, htreeCommand, br);
      const rangeIdx = cmdCode >> 6;
      let distanceCode;
      if (rangeIdx >= 2) {
        distanceCode = -1;
      } else {
        distanceCode = 0;
      }
      const insertCode = INSERT_RANGE_LUT[rangeIdx] + (cmdCode >> 3 & 7);
      const copyCode = COPY_RANGE_LUT[rangeIdx] + (cmdCode & 7);
      const insertLength = INSERT_LENGTH_PREFIX[insertCode].offset + br.readBits(INSERT_LENGTH_PREFIX[insertCode].nbits);
      const copyLength = COPY_LENGTH_PREFIX[copyCode].offset + br.readBits(COPY_LENGTH_PREFIX[copyCode].nbits);
      prevByte1 = ringBuffer[pos - 1 & ringBufferMask];
      prevByte2 = ringBuffer[pos - 2 & ringBufferMask];
      for (let j = 0; j < insertLength; j++) {
        br.readMoreInput();
        if (blockLength[0] === 0) {
          const typeCode = readSymbol(blockTypeTrees, 0, br);
          let bt;
          if (typeCode === 0) {
            bt = blockTypeRb[blockTypeRbIndex[0] & 1];
          } else if (typeCode === 1) {
            bt = blockTypeRb[blockTypeRbIndex[0] - 1 & 1] + 1;
          } else {
            bt = typeCode - 2;
          }
          if (bt >= numBlockTypes[0]) bt -= numBlockTypes[0];
          blockType[0] = bt;
          blockTypeRb[blockTypeRbIndex[0] & 1] = bt;
          blockTypeRbIndex[0]++;
          blockLength[0] = readBlockLength(blockLenTrees, 0, br);
          const contextOffset = blockType[0] << 6;
          contextMapSlice = contextOffset;
          contextMode = contextModes[blockType[0]];
          contextLookupOffset1 = CONTEXT_LOOKUP_OFFSETS[contextMode];
          contextLookupOffset2 = CONTEXT_LOOKUP_OFFSETS[contextMode + 1];
        }
        const context = CONTEXT_LOOKUP[contextLookupOffset1 + prevByte1] | CONTEXT_LOOKUP[contextLookupOffset2 + prevByte2];
        const literalHtreeIndex = literalContextMap.contextMap[contextMapSlice + context];
        blockLength[0]--;
        prevByte2 = prevByte1;
        prevByte1 = readSymbol(hgroup[0].codes, hgroup[0].htrees[literalHtreeIndex], br);
        ringBuffer[pos & ringBufferMask] = prevByte1;
        if ((pos & ringBufferMask) === ringBufferMask) {
          output.push(...ringBuffer.slice(0, ringBufferSize));
        }
        pos++;
      }
      metaBlockRemaining -= insertLength;
      if (metaBlockRemaining <= 0) break;
      if (distanceCode < 0) {
        br.readMoreInput();
        if (blockLength[2] === 0) {
          const typeCode = readSymbol(blockTypeTrees, 2 * MAX_HUFFMAN_TABLE_SIZE, br);
          let bt;
          if (typeCode === 0) {
            bt = blockTypeRb[4 + (blockTypeRbIndex[2] & 1)];
          } else if (typeCode === 1) {
            bt = blockTypeRb[4 + (blockTypeRbIndex[2] - 1 & 1)] + 1;
          } else {
            bt = typeCode - 2;
          }
          if (bt >= numBlockTypes[2]) bt -= numBlockTypes[2];
          blockType[2] = bt;
          blockTypeRb[4 + (blockTypeRbIndex[2] & 1)] = bt;
          blockTypeRbIndex[2]++;
          blockLength[2] = readBlockLength(blockLenTrees, 2 * MAX_HUFFMAN_TABLE_SIZE, br);
          distContextMapSlice = blockType[2] << 2;
        }
        blockLength[2]--;
        const context = (copyLength > 4 ? 3 : copyLength - 2) & 255;
        const distHtreeIndex = distContextMap.contextMap[distContextMapSlice + context];
        distanceCode = readSymbol(hgroup[2].codes, hgroup[2].htrees[distHtreeIndex], br);
        if (distanceCode >= numDirectDistanceCodes) {
          distanceCode -= numDirectDistanceCodes;
          const postfix = distanceCode & distancePostfixMask;
          distanceCode >>= distancePostfixBits;
          const nbits = (distanceCode >> 1) + 1;
          const offset = (2 + (distanceCode & 1) << nbits) - 4;
          distanceCode = numDirectDistanceCodes + (offset + br.readBits(nbits) << distancePostfixBits) + postfix;
        }
      }
      const distance = translateShortCodes(distanceCode, distRb, distRbIdx);
      if (distance < 0) {
        throw new Error("Invalid distance");
      }
      if (pos < maxBackwardDistance && maxDistance !== maxBackwardDistance) {
        maxDistance = pos;
      } else {
        maxDistance = maxBackwardDistance;
      }
      let copyDst = pos & ringBufferMask;
      if (distance > maxDistance) {
        if (copyLength >= 4 && copyLength <= 24) {
          const offset = DICTIONARY_OFFSETS_BY_LENGTH[copyLength];
          const wordId = distance - maxDistance - 1;
          const shift = DICTIONARY_SIZE_BITS_BY_LENGTH[copyLength];
          const mask = (1 << shift) - 1;
          const wordIdx = wordId & mask;
          const transformIdx = wordId >> shift;
          const wordOffset = offset + wordIdx * copyLength;
          if (transformIdx < TRANSFORMS.length) {
            const len = transformDictionaryWord(
              ringBuffer,
              copyDst,
              wordOffset,
              copyLength,
              transformIdx,
              DICTIONARY
            );
            copyDst += len;
            pos += len;
            metaBlockRemaining -= len;
            if (copyDst >= ringBufferSize) {
              output.push(...ringBuffer.slice(0, ringBufferSize));
              for (let i = 0; i < copyDst - ringBufferSize; i++) {
                ringBuffer[i] = ringBuffer[ringBufferSize + i];
              }
            }
          } else {
            throw new Error("Invalid backward reference");
          }
        } else {
          throw new Error("Invalid backward reference");
        }
      } else {
        if (distanceCode > 0) {
          distRb[distRbIdx & 3] = distance;
          distRbIdx++;
        }
        if (copyLength > metaBlockRemaining) {
          throw new Error("Invalid backward reference");
        }
        for (let j = 0; j < copyLength; j++) {
          ringBuffer[pos & ringBufferMask] = ringBuffer[pos - distance & ringBufferMask];
          if ((pos & ringBufferMask) === ringBufferMask) {
            output.push(...ringBuffer.slice(0, ringBufferSize));
          }
          pos++;
          metaBlockRemaining--;
        }
      }
      prevByte1 = ringBuffer[pos - 1 & ringBufferMask];
      prevByte2 = ringBuffer[pos - 2 & ringBufferMask];
    }
    if (meta.isLast) break;
  }
  output.push(...ringBuffer.slice(0, pos & ringBufferMask));
  return new Uint8Array(output);
}
export {
  decompress
};
//# sourceMappingURL=decode-TR7JJYCG.js.map
