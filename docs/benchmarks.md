# Benchmarks

<BenchmarkSummary :items="[
  { category: 'Path Extraction', vsHarfbuzz: '11-24x faster', vsOpentype: '10-15x faster' },
  { category: 'SVG Generation', vsHarfbuzz: 'on par', vsOpentype: '3x faster' },
  { category: 'Cyrillic Shaping', vsHarfbuzz: 'on par to 1.1x faster' },
  { category: 'CJK Shaping', vsHarfbuzz: 'on par to 1.15x faster' },
  { category: 'Latin Shaping', vsHarfbuzz: '1.2x slower' },
  { category: 'Arabic Shaping', vsHarfbuzz: '1.6x slower' },
  { category: 'Hebrew Shaping', vsHarfbuzz: '1.7x slower' },
  { category: 'Hindi Shaping', vsHarfbuzz: '2.2x faster', highlight: true },
  { category: 'Myanmar Shaping', vsHarfbuzz: '9x faster', highlight: true },
  { category: 'Khmer Shaping', vsHarfbuzz: '1.6x faster', highlight: true },
  { category: 'UI Simulation', vsHarfbuzz: '2.3-2.5x faster', highlight: true },
  { category: 'Rasterization', vsFreetype: '1-11x faster', highlight: true },
  { category: 'Cache Benefits', improvement: '5-7x speedup on repeated shaping' }
]" />

<div class="env-info">
  <span>MacBook Pro M1 Pro</span>
  <span>16 GB</span>
  <span>Bun 1.3.3</span>
  <span>text-shaper 0.1.2</span>
</div>

## Glyph Paths

11-24x faster than HarfBuzz, 10-15x faster than opentype.js for path extraction.

<BenchmarkChart title="Extract 10 glyph paths" :results="[
  { name: 'text-shaper', opsPerSec: 990000 },
  { name: 'opentype.js', opsPerSec: 85000 },
  { name: 'harfbuzzjs', opsPerSec: 50000 }
]" />

<BenchmarkChart title="SVG path generation (10 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 52000 },
  { name: 'harfbuzzjs', opsPerSec: 45000 },
  { name: 'opentype.js', opsPerSec: 18000 }
]" />

## Text to SVG

Full text-to-SVG pipeline including shaping and path generation.

<BenchmarkChart title="Hello World" :results="[
  { name: 'harfbuzzjs', opsPerSec: 35000 },
  { name: 'text-shaper', opsPerSec: 17000 },
  { name: 'opentype.js', opsPerSec: 10500 }
]" />

<BenchmarkChart title="Paragraph (87 chars)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 6700 },
  { name: 'text-shaper', opsPerSec: 6300 },
  { name: 'opentype.js', opsPerSec: 1700 }
]" />

## Text Shaping

### Basic Shaping

<BenchmarkChart title="LTR text (no features)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 340000 },
  { name: 'text-shaper', opsPerSec: 185000 }
]" />

<BenchmarkChart title="liga + kern features" :results="[
  { name: 'harfbuzzjs', opsPerSec: 213000 },
  { name: 'text-shaper', opsPerSec: 172000 }
]" />

<BenchmarkChart title="Many features" :results="[
  { name: 'harfbuzzjs', opsPerSec: 192000 },
  { name: 'text-shaper', opsPerSec: 98000 }
]" />

### Cyrillic Scripts

On par with HarfBuzz for Cyrillic text.

<BenchmarkChart title="Russian paragraph (594 chars)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 30770 },
  { name: 'text-shaper', opsPerSec: 28940 }
]" />

<BenchmarkChart title="Ukrainian paragraph (527 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 35340 },
  { name: 'harfbuzzjs', opsPerSec: 34650 }
]" />

<BenchmarkChart title="Belarusian paragraph (489 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 39230 },
  { name: 'harfbuzzjs', opsPerSec: 36940 }
]" />

### CJK Scripts

On par with HarfBuzz for CJK text.

<BenchmarkChart title="Chinese Simplified (185 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 88450 },
  { name: 'harfbuzzjs', opsPerSec: 87230 }
]" />

<BenchmarkChart title="Japanese (224 chars)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 66560 },
  { name: 'text-shaper', opsPerSec: 59470 }
]" />

<BenchmarkChart title="Korean (263 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 48820 },
  { name: 'harfbuzzjs', opsPerSec: 42440 }
]" />

### Latin Scripts

<BenchmarkChart title="English paragraph (701 chars)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 7370 },
  { name: 'text-shaper', opsPerSec: 6250 }
]" />

### RTL Scripts

<BenchmarkChart title="Arabic paragraph (621 chars)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 6620 },
  { name: 'text-shaper', opsPerSec: 3990 }
]" />

<BenchmarkChart title="Hebrew paragraph (313 chars)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 29380 },
  { name: 'text-shaper', opsPerSec: 17540 }
]" />

### Complex Scripts

TextShaper outperforms HarfBuzz on Indic and Southeast Asian scripts.

<BenchmarkChart title="Hindi paragraph (806 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 5130 },
  { name: 'harfbuzzjs', opsPerSec: 2290 }
]" />

<BenchmarkChart title="Myanmar paragraph (729 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 9500 },
  { name: 'harfbuzzjs', opsPerSec: 1030 }
]" />

<BenchmarkChart title="Khmer paragraph (725 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 5940 },
  { name: 'harfbuzzjs', opsPerSec: 3630 }
]" />

<BenchmarkChart title="Thai paragraph (444 chars)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 11910 },
  { name: 'text-shaper', opsPerSec: 11510 }
]" />

### Greek

<BenchmarkChart title="Greek paragraph" :results="[
  { name: 'text-shaper', opsPerSec: 32000 },
  { name: 'harfbuzzjs', opsPerSec: 31500 }
]" />

## Caching Performance

Shape plan caching provides significant speedups for repeated shaping.

<BenchmarkChart title="Cold vs Warm - Latin" :results="[
  { name: 'warm (cached)', opsPerSec: 284000 },
  { name: 'cold (first)', opsPerSec: 2500 }
]" />

<BenchmarkChart title="Repeated shaping - Hello" :results="[
  { name: 'harfbuzzjs', opsPerSec: 460000 },
  { name: 'text-shaper (repeat)', opsPerSec: 369000 },
  { name: 'text-shaper (first)', opsPerSec: 60000 }
]" />

<BenchmarkChart title="Glyph path - same glyph" :results="[
  { name: 'repeated access', opsPerSec: 14700000 },
  { name: 'first access', opsPerSec: 4400 }
]" />

## Real-World Simulations

<BenchmarkChart title="UI Simulation - 8 labels with paths" :results="[
  { name: 'text-shaper', opsPerSec: 45000 },
  { name: 'harfbuzzjs', opsPerSec: 18400 }
]" />

<BenchmarkChart title="Document Simulation - 4 paragraphs" :results="[
  { name: 'harfbuzzjs', opsPerSec: 29400 },
  { name: 'text-shaper', opsPerSec: 26700 }
]" />

## Rasterization

Compared against FreeType2 (WebAssembly). TextShaper scales better at larger sizes.

<BenchmarkChart title="12px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 26000 },
  { name: 'freetype2', opsPerSec: 26500 }
]" />

<BenchmarkChart title="24px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 26000 },
  { name: 'freetype2', opsPerSec: 16000 }
]" />

<BenchmarkChart title="48px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 19500 },
  { name: 'freetype2', opsPerSec: 7400 }
]" />

<BenchmarkChart title="96px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 11800 },
  { name: 'freetype2', opsPerSec: 2500 }
]" />

<BenchmarkChart title="200px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 6600 },
  { name: 'freetype2', opsPerSec: 643 }
]" />

### Render Modes

<BenchmarkChart title="LCD subpixel (24px)" :results="[
  { name: 'text-shaper', opsPerSec: 33000 },
  { name: 'freetype2', opsPerSec: 22000 }
]" />

<BenchmarkChart title="Hinted (12px)" :results="[
  { name: 'text-shaper', opsPerSec: 71000 },
  { name: 'freetype2', opsPerSec: 27000 }
]" />

### Throughput

<BenchmarkChart title="62 glyphs at 16px" :results="[
  { name: 'text-shaper', opsPerSec: 3700 },
  { name: 'freetype2', opsPerSec: 1650 }
]" />

<BenchmarkChart title="Varying sizes - 15 sizes per iteration" :results="[
  { name: 'text-shaper', opsPerSec: 11100 },
  { name: 'freetype2', opsPerSec: 3300 }
]" />

<BenchmarkChart title="Very large - 5 glyphs at 200px" :results="[
  { name: 'text-shaper', opsPerSec: 6600 },
  { name: 'freetype2', opsPerSec: 643 }
]" />

## OpenType Features

<BenchmarkChart title="No features - mixed text" :results="[
  { name: 'text-shaper', opsPerSec: 91000 },
  { name: 'harfbuzzjs', opsPerSec: 85000 }
]" />

<BenchmarkChart title="Standard ligatures (liga)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 238000 },
  { name: 'text-shaper', opsPerSec: 213000 }
]" />

<BenchmarkChart title="Kerning pairs" :results="[
  { name: 'harfbuzzjs', opsPerSec: 210000 },
  { name: 'text-shaper', opsPerSec: 173000 }
]" />

<BenchmarkChart title="Small caps (smcp)" :results="[
  { name: 'text-shaper', opsPerSec: 192000 },
  { name: 'harfbuzzjs', opsPerSec: 199000 }
]" />

<BenchmarkChart title="Oldstyle figures (onum)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 207000 },
  { name: 'text-shaper', opsPerSec: 207000 }
]" />

<BenchmarkChart title="Tabular figures (tnum)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 407000 },
  { name: 'text-shaper', opsPerSec: 174000 }
]" />

<BenchmarkChart title="Fractions (frac)" :results="[
  { name: 'harfbuzzjs', opsPerSec: 168000 },
  { name: 'text-shaper', opsPerSec: 140000 }
]" />

<BenchmarkChart title="All common features" :results="[
  { name: 'harfbuzzjs', opsPerSec: 93000 },
  { name: 'text-shaper', opsPerSec: 84000 }
]" />

## Grapheme Clusters

<BenchmarkChart title="Count graphemes - ASCII (11 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 264000 }
]" />

<BenchmarkChart title="Count graphemes - emoji simple (5 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 1250000 }
]" />

<BenchmarkChart title="Count graphemes - emoji ZWJ (8 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 435000 }
]" />

<BenchmarkChart title="Count graphemes - Devanagari (8 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 518000 }
]" />

<BenchmarkChart title="Count graphemes - mixed (25 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 219000 }
]" />

<BenchmarkChart title="Split graphemes - emoji ZWJ (8 graphemes)" :results="[
  { name: 'text-shaper', opsPerSec: 369000 }
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
