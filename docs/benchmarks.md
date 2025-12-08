# Benchmarks

<BenchmarkSummary :items="[
  { category: 'Path Extraction', vsHarfbuzz: '16x faster', vsOpentype: '10x faster' },
  { category: 'SVG Generation', vsHarfbuzz: '1.1x faster', vsOpentype: '5x faster' },
  { category: 'Latin Shaping', vsHarfbuzz: '1.5x faster', vsOpentype: '22x faster', highlight: true },
  { category: 'Cyrillic Shaping', vsHarfbuzz: '1.2-1.4x faster', vsOpentype: '17-56x faster' },
  { category: 'CJK Shaping', vsHarfbuzz: '1.3-1.5x faster', vsOpentype: '11-13x faster', highlight: true },
  { category: 'Arabic Shaping', vsHarfbuzz: '1.2x faster', vsOpentype: '86x faster', highlight: true },
  { category: 'Hebrew Shaping', vsHarfbuzz: '1.6x faster', vsOpentype: '33x faster', highlight: true },
  { category: 'Hindi Shaping', vsHarfbuzz: '3.6x faster', vsOpentype: '11x faster', highlight: true },
  { category: 'Thai Shaping', vsHarfbuzz: '2x faster', vsOpentype: '12x faster', highlight: true },
  { category: 'Myanmar Shaping', vsHarfbuzz: '10.5x faster', vsOpentype: '17x faster', highlight: true },
  { category: 'Khmer Shaping', vsHarfbuzz: '2.1x faster', vsOpentype: '8x faster', highlight: true },
  { category: 'UI Simulation', vsHarfbuzz: '4.8x faster', highlight: true },
  { category: 'Rasterization', vsFreetype: '1.6-11x faster', highlight: true },
  { category: 'Cache Benefits', improvement: '12x speedup on repeated shaping' }
]" />

<div class="env-info">
  <span>MacBook Pro M1 Pro</span>
  <span>16 GB</span>
  <span>Bun 1.3.3</span>
  <span>text-shaper 0.1.3</span>
</div>

## Glyph Paths

16x faster than HarfBuzz, 10x faster than opentype.js for path extraction.

<BenchmarkChart title="Extract 10 glyph paths" :results="[
  { name: 'text-shaper', opsPerSec: 831300 },
  { name: 'opentype.js', opsPerSec: 86850 },
  { name: 'harfbuzzjs', opsPerSec: 52350 }
]" />

<BenchmarkChart title="SVG path generation (10 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 77510 },
  { name: 'harfbuzzjs', opsPerSec: 71300 },
  { name: 'opentype.js', opsPerSec: 14220 }
]" />

## Text to SVG

Full text-to-SVG pipeline including shaping and path generation. On par to 1.3x faster than HarfBuzz, 4-6x faster than opentype.js.

<BenchmarkChart title="Hello World" :results="[
  { name: 'harfbuzzjs', opsPerSec: 43830 },
  { name: 'text-shaper', opsPerSec: 43250 },
  { name: 'opentype.js', opsPerSec: 11410 }
]" />

<BenchmarkChart title="Paragraph (87 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 8810 },
  { name: 'harfbuzzjs', opsPerSec: 6570 },
  { name: 'opentype.js', opsPerSec: 1530 }
]" />

## Text Shaping

### Basic Shaping

<BenchmarkChart title="LTR text (no features)" :results="[
  { name: 'text-shaper', opsPerSec: 410350 },
  { name: 'harfbuzzjs', opsPerSec: 179430 }
]" />

<BenchmarkChart title="liga + kern features" :results="[
  { name: 'text-shaper', opsPerSec: 277740 },
  { name: 'harfbuzzjs', opsPerSec: 208740 }
]" />

<BenchmarkChart title="Many features" :results="[
  { name: 'text-shaper', opsPerSec: 204470 },
  { name: 'harfbuzzjs', opsPerSec: 186160 }
]" />

### Cyrillic Scripts

1.2-1.4x faster than HarfBuzz across Russian, Ukrainian, and Belarusian. 17-56x faster than opentype.js.

<BenchmarkChart title="Russian paragraph (1001 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 21990 },
  { name: 'harfbuzzjs', opsPerSec: 18350 },
  { name: 'opentype.js', opsPerSec: 761 }
]" />

<BenchmarkChart title="Ukrainian paragraph (788 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 27890 },
  { name: 'harfbuzzjs', opsPerSec: 22710 },
  { name: 'opentype.js', opsPerSec: 1160 }
]" />

<BenchmarkChart title="Belarusian paragraph (712 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 36230 },
  { name: 'harfbuzzjs', opsPerSec: 26030 },
  { name: 'opentype.js', opsPerSec: 647 }
]" />

### CJK Scripts

1.3-1.5x faster than HarfBuzz for CJK text, 11-13x faster than opentype.js.

<BenchmarkChart title="Chinese Simplified (329 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 63550 },
  { name: 'harfbuzzjs', opsPerSec: 43540 },
  { name: 'opentype.js', opsPerSec: 4850 }
]" />

<BenchmarkChart title="Japanese (418 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 43750 },
  { name: 'harfbuzzjs', opsPerSec: 33660 },
  { name: 'opentype.js', opsPerSec: 3310 }
]" />

<BenchmarkChart title="Korean (449 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 34940 },
  { name: 'harfbuzzjs', opsPerSec: 25470 },
  { name: 'opentype.js', opsPerSec: 3100 }
]" />

### Latin Scripts

1.5x faster than HarfBuzz, 22x faster than opentype.js for Latin text.

<BenchmarkChart title="English paragraph (1056 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 7890 },
  { name: 'harfbuzzjs', opsPerSec: 5300 },
  { name: 'opentype.js', opsPerSec: 363 }
]" />

### RTL Scripts

1.2-1.6x faster than HarfBuzz for Arabic and Hebrew. 33-100x faster than opentype.js.

<BenchmarkChart title="Arabic paragraph (1121 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 4295 },
  { name: 'harfbuzzjs', opsPerSec: 3635 },
  { name: 'opentype.js', opsPerSec: 42 }
]" />

<BenchmarkChart title="Hebrew paragraph (1220 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 12920 },
  { name: 'harfbuzzjs', opsPerSec: 7840 },
  { name: 'opentype.js', opsPerSec: 387 }
]" />

### Complex Scripts

TextShaper outperforms HarfBuzz on Indic and Southeast Asian scripts, 8-17x faster than opentype.js.

<BenchmarkChart title="Hindi paragraph (1275 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 4980 },
  { name: 'harfbuzzjs', opsPerSec: 1390 },
  { name: 'opentype.js', opsPerSec: 456 }
]" />

<BenchmarkChart title="Myanmar paragraph (1916 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 4000 },
  { name: 'harfbuzzjs', opsPerSec: 380 },
  { name: 'opentype.js', opsPerSec: 230 }
]" />

<BenchmarkChart title="Khmer paragraph (1128 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 4650 },
  { name: 'harfbuzzjs', opsPerSec: 2190 },
  { name: 'opentype.js', opsPerSec: 575 }
]" />

<BenchmarkChart title="Thai paragraph (1301 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 5580 },
  { name: 'harfbuzzjs', opsPerSec: 2760 },
  { name: 'opentype.js', opsPerSec: 452 }
]" />

### Greek

1.2x faster than HarfBuzz, 28x faster than opentype.js for Greek text.

<BenchmarkChart title="Greek paragraph (997 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 21360 },
  { name: 'harfbuzzjs', opsPerSec: 17520 },
  { name: 'opentype.js', opsPerSec: 750 }
]" />

## Caching Performance

Shape plan caching provides significant speedups for repeated shaping.

<BenchmarkChart title="Repeated Shaping - Hello" :results="[
  { name: 'text-shaper', opsPerSec: 695640 },
  { name: 'harfbuzzjs', opsPerSec: 486630 },
  { name: '(first call)', opsPerSec: 57010 }
]" />

<BenchmarkChart title="Repeated Shaping - paragraph (85 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 80220 },
  { name: 'harfbuzzjs', opsPerSec: 61320 },
  { name: '(first call)', opsPerSec: 16430 }
]" />

<BenchmarkChart title="Glyph Path Cache" :results="[
  { name: 'text-shaper', opsPerSec: 15750000 },
  { name: '(first call)', opsPerSec: 3410 }
]" />

## Real-World Simulations

<BenchmarkChart title="UI Simulation - 8 labels with paths" :results="[
  { name: 'text-shaper', opsPerSec: 95550 },
  { name: 'harfbuzzjs', opsPerSec: 19980 }
]" />

<BenchmarkChart title="Document Simulation - 4 paragraphs" :results="[
  { name: 'text-shaper', opsPerSec: 36690 },
  { name: 'harfbuzzjs', opsPerSec: 33660 }
]" />

## Rasterization

Compared against FreeType2 (WebAssembly). TextShaper is 1.6-11x faster at all sizes.

<BenchmarkChart title="12px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 18520 },
  { name: 'freetype2', opsPerSec: 11450 }
]" />

<BenchmarkChart title="24px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 38950 },
  { name: 'freetype2', opsPerSec: 16560 }
]" />

<BenchmarkChart title="48px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 26770 },
  { name: 'freetype2', opsPerSec: 6390 }
]" />

<BenchmarkChart title="96px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 13260 },
  { name: 'freetype2', opsPerSec: 2040 }
]" />

<BenchmarkChart title="200px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 6780 },
  { name: 'freetype2', opsPerSec: 614 }
]" />

### Render Modes

<BenchmarkChart title="LCD subpixel (24px)" :results="[
  { name: 'text-shaper', opsPerSec: 38810 },
  { name: 'freetype2', opsPerSec: 14310 }
]" />

<BenchmarkChart title="Hinted (12px)" :results="[
  { name: 'text-shaper', opsPerSec: 71690 },
  { name: 'freetype2', opsPerSec: 19880 }
]" />

### Throughput

<BenchmarkChart title="62 glyphs at 16px" :results="[
  { name: 'text-shaper', opsPerSec: 3470 },
  { name: 'freetype2', opsPerSec: 435 }
]" />

<BenchmarkChart title="Varying sizes - 15 sizes per iteration" :results="[
  { name: 'text-shaper', opsPerSec: 10940 },
  { name: 'freetype2', opsPerSec: 2530 }
]" />

<BenchmarkChart title="Very large - 5 glyphs at 200px" :results="[
  { name: 'text-shaper', opsPerSec: 6780 },
  { name: 'freetype2', opsPerSec: 614 }
]" />

## OpenType Features

<BenchmarkChart title="No features - mixed text" :results="[
  { name: 'text-shaper', opsPerSec: 107310 },
  { name: 'harfbuzzjs', opsPerSec: 87310 }
]" />

<BenchmarkChart title="Standard ligatures (liga)" :results="[
  { name: 'text-shaper', opsPerSec: 305620 },
  { name: 'harfbuzzjs', opsPerSec: 269270 }
]" />

<BenchmarkChart title="Kerning pairs" :results="[
  { name: 'text-shaper', opsPerSec: 258760 },
  { name: 'harfbuzzjs', opsPerSec: 217960 }
]" />

<BenchmarkChart title="Small caps (smcp)" :results="[
  { name: 'text-shaper', opsPerSec: 253970 },
  { name: 'harfbuzzjs', opsPerSec: 196030 }
]" />

<BenchmarkChart title="Oldstyle figures (onum)" :results="[
  { name: 'text-shaper', opsPerSec: 309360 },
  { name: 'harfbuzzjs', opsPerSec: 239380 }
]" />

<BenchmarkChart title="Tabular figures (tnum)" :results="[
  { name: 'text-shaper', opsPerSec: 315830 },
  { name: 'harfbuzzjs', opsPerSec: 308330 }
]" />

<BenchmarkChart title="Fractions (frac)" :results="[
  { name: 'text-shaper', opsPerSec: 249400 },
  { name: 'harfbuzzjs', opsPerSec: 207510 }
]" />

<BenchmarkChart title="All common features" :results="[
  { name: 'harfbuzzjs', opsPerSec: 100080 },
  { name: 'text-shaper', opsPerSec: 30350 }
]" />

## Grapheme Clusters

<BenchmarkChart title="Count graphemes - ASCII (11 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 335440 }
]" />

<BenchmarkChart title="Count graphemes - emoji simple (5 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 3190000 }
]" />

<BenchmarkChart title="Count graphemes - emoji ZWJ (8 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 659200 }
]" />

<BenchmarkChart title="Count graphemes - Devanagari (8 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 632210 }
]" />

<BenchmarkChart title="Count graphemes - mixed (25 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 243710 }
]" />

<BenchmarkChart title="Split graphemes - emoji ZWJ (8 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 548740 }
]" />

<style>
.env-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
  font-size: 12px;
}

.env-info span {
  padding: 4px 10px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
}
</style>
