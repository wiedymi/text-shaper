# Benchmarks

<BenchmarkSummary :items="[
  { category: 'Path Extraction', vsHarfbuzz: '46x faster', vsOpentype: '15x faster' },
  { category: 'SVG Generation', vsHarfbuzz: '1.2x faster', vsOpentype: '5x faster' },
  { category: 'Latin Shaping', vsHarfbuzz: '1.4x faster', vsOpentype: '12x faster', highlight: true },
  { category: 'Cyrillic Shaping', vsHarfbuzz: '1.1x faster', vsOpentype: '21-41x faster' },
  { category: 'CJK Shaping', vsHarfbuzz: '1.3-1.4x faster', vsOpentype: '12-14x faster', highlight: true },
  { category: 'Arabic Shaping', vsHarfbuzz: '1.2x faster', vsOpentype: '81x faster', highlight: true },
  { category: 'Hebrew Shaping', vsHarfbuzz: '1.5x faster', vsOpentype: '30x faster', highlight: true },
  { category: 'Hindi Shaping', vsHarfbuzz: '2.7x faster', vsOpentype: '10x faster', highlight: true },
  { category: 'Thai Shaping', vsHarfbuzz: '1.6x faster', vsOpentype: '9x faster', highlight: true },
  { category: 'Myanmar Shaping', vsHarfbuzz: '8.9x faster', vsOpentype: '14x faster', highlight: true },
  { category: 'Khmer Shaping', vsHarfbuzz: '1.7x faster', vsOpentype: '6x faster', highlight: true },
  { category: 'UI Simulation', vsHarfbuzz: '10.7x faster', highlight: true },
  { category: 'Rasterization', vsFreetype: '1.8-11x faster', highlight: true },
  { category: 'Cache Benefits', improvement: '14x speedup on repeated shaping' }
]" />

<div class="env-info">
  <span>MacBook Pro M1 Pro</span>
  <span>16 GB</span>
  <span>Bun 1.3.4</span>
  <span>text-shaper 0.1.4</span>
</div>

## Glyph Paths

46x faster than HarfBuzz, 15x faster than opentype.js for path extraction.

<BenchmarkChart title="Extract 10 glyph paths" :results="[
  { name: 'text-shaper', opsPerSec: 2300000 },
  { name: 'opentype.js', opsPerSec: 154510 },
  { name: 'harfbuzzjs', opsPerSec: 50120 }
]" />

<BenchmarkChart title="SVG path generation (10 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 104520 },
  { name: 'harfbuzzjs', opsPerSec: 87360 },
  { name: 'opentype.js', opsPerSec: 20590 }
]" />

## Text to SVG

Full text-to-SVG pipeline including shaping and path generation. 1.3-1.5x faster than HarfBuzz, 4-8x faster than opentype.js.

<BenchmarkChart title="Hello World" :results="[
  { name: 'text-shaper', opsPerSec: 56930 },
  { name: 'harfbuzzjs', opsPerSec: 44470 },
  { name: 'opentype.js', opsPerSec: 12660 }
]" />

<BenchmarkChart title="Paragraph (87 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 11580 },
  { name: 'harfbuzzjs', opsPerSec: 7870 },
  { name: 'opentype.js', opsPerSec: 1400 }
]" />

## Text Shaping

### Basic Shaping

<BenchmarkChart title="LTR text (no features)" :results="[
  { name: 'text-shaper', opsPerSec: 571260 },
  { name: 'harfbuzzjs', opsPerSec: 167110 }
]" />

<BenchmarkChart title="liga + kern features" :results="[
  { name: 'text-shaper', opsPerSec: 101050 },
  { name: 'harfbuzzjs', opsPerSec: 106060 }
]" />

<BenchmarkChart title="Many features" :results="[
  { name: 'text-shaper', opsPerSec: 97540 },
  { name: 'harfbuzzjs', opsPerSec: 88200 }
]" />

### Cyrillic Scripts

1.1x faster than HarfBuzz across Russian, Ukrainian, and Belarusian. 21-41x faster than opentype.js.

<BenchmarkChart title="Russian paragraph (1001 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 20200 },
  { name: 'harfbuzzjs', opsPerSec: 18590 },
  { name: 'opentype.js', opsPerSec: 858 }
]" />

<BenchmarkChart title="Ukrainian paragraph (788 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 25760 },
  { name: 'harfbuzzjs', opsPerSec: 23230 },
  { name: 'opentype.js', opsPerSec: 1210 }
]" />

<BenchmarkChart title="Belarusian paragraph (712 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 25200 },
  { name: 'harfbuzzjs', opsPerSec: 26270 },
  { name: 'opentype.js', opsPerSec: 616 }
]" />

### CJK Scripts

1.3-1.4x faster than HarfBuzz for CJK text, 12-14x faster than opentype.js.

<BenchmarkChart title="Chinese Simplified (329 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 60390 },
  { name: 'harfbuzzjs', opsPerSec: 46350 },
  { name: 'opentype.js', opsPerSec: 5040 }
]" />

<BenchmarkChart title="Japanese (418 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 44160 },
  { name: 'harfbuzzjs', opsPerSec: 34620 },
  { name: 'opentype.js', opsPerSec: 3100 }
]" />

<BenchmarkChart title="Korean (449 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 36210 },
  { name: 'harfbuzzjs', opsPerSec: 25600 },
  { name: 'opentype.js', opsPerSec: 2830 }
]" />

### Latin Scripts

1.4x faster than HarfBuzz, 12x faster than opentype.js for Latin text.

<BenchmarkChart title="English paragraph (1056 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 6980 },
  { name: 'harfbuzzjs', opsPerSec: 4890 },
  { name: 'opentype.js', opsPerSec: 576 }
]" />

### RTL Scripts

1.2-1.5x faster than HarfBuzz for Arabic and Hebrew. 30-81x faster than opentype.js.

<BenchmarkChart title="Arabic paragraph (1121 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 3970 },
  { name: 'harfbuzzjs', opsPerSec: 3470 },
  { name: 'opentype.js', opsPerSec: 49 }
]" />

<BenchmarkChart title="Hebrew paragraph (1220 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 11670 },
  { name: 'harfbuzzjs', opsPerSec: 7980 },
  { name: 'opentype.js', opsPerSec: 384 }
]" />

### Complex Scripts

TextShaper outperforms HarfBuzz on Indic and Southeast Asian scripts, 6-14x faster than opentype.js.

<BenchmarkChart title="Hindi paragraph (1275 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 3410 },
  { name: 'harfbuzzjs', opsPerSec: 1270 },
  { name: 'opentype.js', opsPerSec: 357 }
]" />

<BenchmarkChart title="Myanmar paragraph (1916 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 3260 },
  { name: 'harfbuzzjs', opsPerSec: 366 },
  { name: 'opentype.js', opsPerSec: 225 }
]" />

<BenchmarkChart title="Khmer paragraph (1128 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 3400 },
  { name: 'harfbuzzjs', opsPerSec: 2050 },
  { name: 'opentype.js', opsPerSec: 580 }
]" />

<BenchmarkChart title="Thai paragraph (1301 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 4230 },
  { name: 'harfbuzzjs', opsPerSec: 2650 },
  { name: 'opentype.js', opsPerSec: 486 }
]" />

### Greek

1.0x vs HarfBuzz, 23x faster than opentype.js for Greek text.

<BenchmarkChart title="Greek paragraph (997 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 16810 },
  { name: 'harfbuzzjs', opsPerSec: 17490 },
  { name: 'opentype.js', opsPerSec: 736 }
]" />

## Caching Performance

Shape plan caching provides significant speedups for repeated shaping.

<BenchmarkChart title="Repeated Shaping - Hello" :results="[
  { name: 'text-shaper', opsPerSec: 322410 },
  { name: 'harfbuzzjs', opsPerSec: 123630 },
  { name: '(first call)', opsPerSec: 23550 }
]" />

<BenchmarkChart title="Repeated Shaping - paragraph (85 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 40110 },
  { name: 'harfbuzzjs', opsPerSec: 21800 },
  { name: '(first call)', opsPerSec: 2250 }
]" />

<BenchmarkChart title="Glyph Path Cache" :results="[
  { name: 'text-shaper', opsPerSec: 8540000 },
  { name: '(first call)', opsPerSec: 1160 }
]" />

## Real-World Simulations

<BenchmarkChart title="UI Simulation - 8 labels with paths" :results="[
  { name: 'text-shaper', opsPerSec: 79160 },
  { name: 'harfbuzzjs', opsPerSec: 7370 }
]" />

<BenchmarkChart title="Document Simulation - 4 paragraphs" :results="[
  { name: 'text-shaper', opsPerSec: 19720 },
  { name: 'harfbuzzjs', opsPerSec: 32000 }
]" />

## Rasterization

Compared against FreeType2 (WebAssembly). TextShaper is 1.8-11x faster at all sizes.

<BenchmarkChart title="12px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 47660 },
  { name: 'freetype2', opsPerSec: 26030 }
]" />

<BenchmarkChart title="24px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 44020 },
  { name: 'freetype2', opsPerSec: 17630 }
]" />

<BenchmarkChart title="48px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 26090 },
  { name: 'freetype2', opsPerSec: 5170 }
]" />

<BenchmarkChart title="96px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 15700 },
  { name: 'freetype2', opsPerSec: 2580 }
]" />

<BenchmarkChart title="200px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 7540 },
  { name: 'freetype2', opsPerSec: 658 }
]" />

### Render Modes

<BenchmarkChart title="LCD subpixel (24px)" :results="[
  { name: 'text-shaper', opsPerSec: 45370 },
  { name: 'freetype2', opsPerSec: 20610 }
]" />

<BenchmarkChart title="Hinted (12px)" :results="[
  { name: 'text-shaper', opsPerSec: 71070 },
  { name: 'freetype2', opsPerSec: 19810 }
]" />

### Throughput

<BenchmarkChart title="62 glyphs at 16px" :results="[
  { name: 'text-shaper', opsPerSec: 4330 },
  { name: 'freetype2', opsPerSec: 1670 }
]" />

<BenchmarkChart title="Varying sizes - 15 sizes per iteration" :results="[
  { name: 'text-shaper', opsPerSec: 12430 },
  { name: 'freetype2', opsPerSec: 3330 }
]" />

<BenchmarkChart title="Very large - 5 glyphs at 200px" :results="[
  { name: 'text-shaper', opsPerSec: 7540 },
  { name: 'freetype2', opsPerSec: 658 }
]" />

## OpenType Features

<BenchmarkChart title="No features - mixed text" :results="[
  { name: 'text-shaper', opsPerSec: 54470 },
  { name: 'harfbuzzjs', opsPerSec: 55700 }
]" />

<BenchmarkChart title="Standard ligatures (liga)" :results="[
  { name: 'text-shaper', opsPerSec: 161250 },
  { name: 'harfbuzzjs', opsPerSec: 121380 }
]" />

<BenchmarkChart title="Kerning pairs" :results="[
  { name: 'text-shaper', opsPerSec: 111810 },
  { name: 'harfbuzzjs', opsPerSec: 188800 }
]" />

<BenchmarkChart title="Small caps (smcp)" :results="[
  { name: 'text-shaper', opsPerSec: 225850 },
  { name: 'harfbuzzjs', opsPerSec: 196700 }
]" />

<BenchmarkChart title="Oldstyle figures (onum)" :results="[
  { name: 'text-shaper', opsPerSec: 233960 },
  { name: 'harfbuzzjs', opsPerSec: 285350 }
]" />

<BenchmarkChart title="Tabular figures (tnum)" :results="[
  { name: 'text-shaper', opsPerSec: 398800 },
  { name: 'harfbuzzjs', opsPerSec: 367340 }
]" />

<BenchmarkChart title="Fractions (frac)" :results="[
  { name: 'text-shaper', opsPerSec: 339770 },
  { name: 'harfbuzzjs', opsPerSec: 199910 }
]" />

<BenchmarkChart title="All common features (liga + kern + calt)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 99090 },
  { name: 'text-shaper', opsPerSec: 88710 }
]" />

## Grapheme Clusters

<BenchmarkChart title="Count graphemes - ASCII (11 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 367580 }
]" />

<BenchmarkChart title="Count graphemes - emoji simple (5 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 2870000 }
]" />

<BenchmarkChart title="Count graphemes - emoji ZWJ (8 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 573200 }
]" />

<BenchmarkChart title="Count graphemes - Devanagari (8 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 625200 }
]" />

<BenchmarkChart title="Count graphemes - mixed (25 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 252310 }
]" />

<BenchmarkChart title="Split graphemes - emoji ZWJ (8 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 504830 }
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
