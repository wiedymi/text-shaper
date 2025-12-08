# Benchmarks

<BenchmarkSummary :items="[
  { category: 'Path Extraction', vsHarfbuzz: '22x faster', vsOpentype: '13x faster' },
  { category: 'SVG Generation', vsHarfbuzz: '1.5-1.9x faster', vsOpentype: '4-6x faster', highlight: true },
  { category: 'Cyrillic Shaping', vsHarfbuzz: 'on par to 1.1x faster', vsOpentype: '3-4x faster' },
  { category: 'CJK Shaping', vsHarfbuzz: 'on par to 1.15x faster', vsOpentype: '4-7x faster' },
  { category: 'Latin Shaping', vsHarfbuzz: 'on par', vsOpentype: '10x faster' },
  { category: 'Arabic Shaping', vsHarfbuzz: '1.6x slower', vsOpentype: '4x faster' },
  { category: 'Hebrew Shaping', vsHarfbuzz: '1.7x slower', vsOpentype: '2x faster' },
  { category: 'Hindi Shaping', vsHarfbuzz: '3x faster', vsOpentype: '6x faster', highlight: true },
  { category: 'Myanmar Shaping', vsHarfbuzz: '10x faster', vsOpentype: '6x faster', highlight: true },
  { category: 'Khmer Shaping', vsHarfbuzz: '1.6x faster', vsOpentype: '3x faster', highlight: true },
  { category: 'UI Simulation', vsHarfbuzz: '6x faster', highlight: true },
  { category: 'Rasterization', vsFreetype: '1.8-13x faster', highlight: true },
  { category: 'Cache Benefits', improvement: '135x speedup on repeated shaping' }
]" />

<div class="env-info">
  <span>MacBook Pro M1 Pro</span>
  <span>16 GB</span>
  <span>Bun 1.3.3</span>
  <span>text-shaper 0.1.3</span>
</div>

## Glyph Paths

22x faster than HarfBuzz, 13x faster than opentype.js for path extraction.

<BenchmarkChart title="Extract 10 glyph paths" :results="[
  { name: 'text-shaper', opsPerSec: 1060000 },
  { name: 'opentype.js', opsPerSec: 80220 },
  { name: 'harfbuzzjs', opsPerSec: 46830 }
]" />

<BenchmarkChart title="SVG path generation (10 glyphs)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 55550 },
  { name: 'text-shaper', opsPerSec: 48790 },
  { name: 'opentype.js', opsPerSec: 17390 }
]" />

## Text to SVG

Full text-to-SVG pipeline including shaping and path generation. 1.5-1.9x faster than HarfBuzz, 4-6x faster than opentype.js.

<BenchmarkChart title="Hello World" :results="[
  { name: 'text-shaper', opsPerSec: 61530 },
  { name: 'harfbuzzjs', opsPerSec: 32980 },
  { name: 'opentype.js', opsPerSec: 13120 }
]" />

<BenchmarkChart title="Paragraph (87 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 11880 },
  { name: 'harfbuzzjs', opsPerSec: 7780 },
  { name: 'opentype.js', opsPerSec: 1830 }
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

On par with HarfBuzz for Cyrillic text, 20x faster than opentype.js.

<BenchmarkChart title="Russian paragraph (1001 chars)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 19250 },
  { name: 'text-shaper', opsPerSec: 16380 },
  { name: 'opentype.js', opsPerSec: 804 }
]" />

<BenchmarkChart title="Ukrainian paragraph (788 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 28170 },
  { name: 'harfbuzzjs', opsPerSec: 22700 },
  { name: 'opentype.js', opsPerSec: 1240 }
]" />

<BenchmarkChart title="Belarusian paragraph (712 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 32380 },
  { name: 'harfbuzzjs', opsPerSec: 25920 },
  { name: 'opentype.js', opsPerSec: 1480 }
]" />

### CJK Scripts

1.3x faster than HarfBuzz for CJK text, 10-13x faster than opentype.js.

<BenchmarkChart title="Chinese Simplified (329 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 63740 },
  { name: 'harfbuzzjs', opsPerSec: 49190 },
  { name: 'opentype.js', opsPerSec: 5580 }
]" />

<BenchmarkChart title="Japanese (418 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 46430 },
  { name: 'harfbuzzjs', opsPerSec: 36030 },
  { name: 'opentype.js', opsPerSec: 3490 }
]" />

<BenchmarkChart title="Korean (449 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 32160 },
  { name: 'harfbuzzjs', opsPerSec: 23620 },
  { name: 'opentype.js', opsPerSec: 3300 }
]" />

### Latin Scripts

1.2x faster than HarfBuzz, 11x faster than opentype.js for Latin text.

<BenchmarkChart title="English paragraph (1056 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 6700 },
  { name: 'harfbuzzjs', opsPerSec: 5450 },
  { name: 'opentype.js', opsPerSec: 611 }
]" />

### RTL Scripts

On par with HarfBuzz, 18-60x faster than opentype.js for RTL text.

<BenchmarkChart title="Arabic paragraph (1121 chars)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 3510 },
  { name: 'text-shaper', opsPerSec: 3340 },
  { name: 'opentype.js', opsPerSec: 56 }
]" />

<BenchmarkChart title="Hebrew paragraph (1220 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 9730 },
  { name: 'harfbuzzjs', opsPerSec: 8170 },
  { name: 'opentype.js', opsPerSec: 536 }
]" />

### Complex Scripts

TextShaper outperforms HarfBuzz on Indic and Southeast Asian scripts, 8-15x faster than opentype.js.

<BenchmarkChart title="Hindi paragraph (1275 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 3970 },
  { name: 'harfbuzzjs', opsPerSec: 1430 },
  { name: 'opentype.js', opsPerSec: 477 }
]" />

<BenchmarkChart title="Myanmar paragraph (1916 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 3840 },
  { name: 'harfbuzzjs', opsPerSec: 393 },
  { name: 'opentype.js', opsPerSec: 251 }
]" />

<BenchmarkChart title="Khmer paragraph (1128 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 4690 },
  { name: 'harfbuzzjs', opsPerSec: 2180 },
  { name: 'opentype.js', opsPerSec: 645 }
]" />

<BenchmarkChart title="Thai paragraph (1301 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 4810 },
  { name: 'harfbuzzjs', opsPerSec: 3510 },
  { name: 'opentype.js', opsPerSec: 508 }
]" />

### Greek

1.3x faster than HarfBuzz, 29x faster than opentype.js for Greek text.

<BenchmarkChart title="Greek paragraph (997 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 23550 },
  { name: 'harfbuzzjs', opsPerSec: 18070 },
  { name: 'opentype.js', opsPerSec: 820 }
]" />

## Caching Performance

Shape plan caching provides significant speedups for repeated shaping.

<BenchmarkChart title="Shape Plan Cache - Latin" :results="[
  { name: 'text-shaper', opsPerSec: 367640, note: 'warm' },
  { name: '(cold)', opsPerSec: 2730 }
]" />

<BenchmarkChart title="Repeated Shaping - Hello" :results="[
  { name: 'text-shaper', opsPerSec: 649890 },
  { name: 'harfbuzzjs', opsPerSec: 263250 },
  { name: '(first call)', opsPerSec: 42250 }
]" />

<BenchmarkChart title="Glyph Path Cache" :results="[
  { name: 'text-shaper', opsPerSec: 15750000 },
  { name: '(first call)', opsPerSec: 3410 }
]" />

## Real-World Simulations

<BenchmarkChart title="UI Simulation - 8 labels with paths" :results="[
  { name: 'text-shaper', opsPerSec: 87300 },
  { name: 'harfbuzzjs', opsPerSec: 14610 }
]" />

<BenchmarkChart title="Document Simulation - 4 paragraphs" :results="[
  { name: 'text-shaper', opsPerSec: 34120 },
  { name: 'harfbuzzjs', opsPerSec: 31880 }
]" />

## Rasterization

Compared against FreeType2 (WebAssembly). TextShaper is faster at all sizes.

<BenchmarkChart title="12px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 47030 },
  { name: 'freetype2', opsPerSec: 25780 }
]" />

<BenchmarkChart title="24px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 40770 },
  { name: 'freetype2', opsPerSec: 17910 }
]" />

<BenchmarkChart title="48px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 26120 },
  { name: 'freetype2', opsPerSec: 8060 }
]" />

<BenchmarkChart title="96px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 13480 },
  { name: 'freetype2', opsPerSec: 2630 }
]" />

<BenchmarkChart title="200px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 8010 },
  { name: 'freetype2', opsPerSec: 612 }
]" />

### Render Modes

<BenchmarkChart title="LCD subpixel (24px)" :results="[
  { name: 'text-shaper', opsPerSec: 40340 },
  { name: 'freetype2', opsPerSec: 21820 }
]" />

<BenchmarkChart title="Hinted (12px)" :results="[
  { name: 'text-shaper', opsPerSec: 72730 },
  { name: 'freetype2', opsPerSec: 11790 }
]" />

### Throughput

<BenchmarkChart title="62 glyphs at 16px" :results="[
  { name: 'text-shaper', opsPerSec: 3990 },
  { name: 'freetype2', opsPerSec: 1710 }
]" />

<BenchmarkChart title="Varying sizes - 15 sizes per iteration" :results="[
  { name: 'text-shaper', opsPerSec: 12610 },
  { name: 'freetype2', opsPerSec: 3340 }
]" />

<BenchmarkChart title="Very large - 5 glyphs at 200px" :results="[
  { name: 'text-shaper', opsPerSec: 8010 },
  { name: 'freetype2', opsPerSec: 612 }
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
