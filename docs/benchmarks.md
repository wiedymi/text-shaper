# Benchmarks

<BenchmarkSummary :items="[
  { category: 'Font Loading', vsHarfbuzz: '4-49x faster', vsOpentype: '1000-4400x faster' },
  { category: 'Path Extraction', vsHarfbuzz: '16x faster', vsOpentype: '10x faster' },
  { category: 'Latin Shaping', vsHarfbuzz: '1.2x slower' },
  { category: 'Cyrillic Shaping', vsHarfbuzz: 'on par' },
  { category: 'CJK Shaping', vsHarfbuzz: 'on par' },
  { category: 'Arabic Shaping', vsHarfbuzz: '1.6x slower' },
  { category: 'Hebrew Shaping', vsHarfbuzz: '1.7x slower' },
  { category: 'Hindi Shaping', vsHarfbuzz: '2.2x faster', highlight: true },
  { category: 'Myanmar Shaping', vsHarfbuzz: '9x faster', highlight: true },
  { category: 'Khmer Shaping', vsHarfbuzz: '1.6x faster', highlight: true },
  { category: 'Rasterization', vsFreetype: '1.4-10x faster', highlight: true }
]" />

<div class="env-info">
  <span>MacBook Pro M1 Pro</span>
  <span>16 GB</span>
  <span>Bun 1.3.3</span>
  <span>text-shaper 0.1.2</span>
</div>

## Font Loading

1000x+ faster than opentype.js through lazy table parsing.

<BenchmarkChart title="NotoSans-Regular.ttf" :results="[
  { name: 'text-shaper', opsPerSec: 223630 },
  { name: 'harfbuzzjs', opsPerSec: 51190 },
  { name: 'opentype.js', opsPerSec: 208 }
]" />

<BenchmarkChart title="NotoSans-VariableFont.ttf" :results="[
  { name: 'text-shaper', opsPerSec: 770480 },
  { name: 'harfbuzzjs', opsPerSec: 15700 },
  { name: 'opentype.js', opsPerSec: 173 }
]" />

## Glyph Paths

16x faster than HarfBuzz, 10x faster than opentype.js for path extraction.

<BenchmarkChart title="Extract 10 glyph paths" :results="[
  { name: 'text-shaper', opsPerSec: 831300 },
  { name: 'opentype.js', opsPerSec: 86850 },
  { name: 'harfbuzzjs', opsPerSec: 52350 }
]" />

## Text Shaping

### Latin Scripts

<BenchmarkChart title="English paragraph (701 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 6250 },
  { name: 'harfbuzzjs', opsPerSec: 7370 }
]" />

### Cyrillic Scripts

On par with HarfBuzz for Cyrillic text.

<BenchmarkChart title="Russian paragraph (594 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 28940 },
  { name: 'harfbuzzjs', opsPerSec: 30770 }
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

<BenchmarkChart title="Chinese Simplified paragraph (185 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 88450 },
  { name: 'harfbuzzjs', opsPerSec: 87230 }
]" />

<BenchmarkChart title="Japanese paragraph (224 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 59470 },
  { name: 'harfbuzzjs', opsPerSec: 66560 }
]" />

<BenchmarkChart title="Korean paragraph (263 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 48820 },
  { name: 'harfbuzzjs', opsPerSec: 42440 }
]" />

### RTL Scripts

<BenchmarkChart title="Arabic paragraph (621 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 3990 },
  { name: 'harfbuzzjs', opsPerSec: 6620 }
]" />

<BenchmarkChart title="Hebrew paragraph (313 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 17540 },
  { name: 'harfbuzzjs', opsPerSec: 29380 }
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
  { name: 'text-shaper', opsPerSec: 11510 },
  { name: 'harfbuzzjs', opsPerSec: 11910 }
]" />

## Rasterization

Compared against FreeType2 (WebAssembly). TextShaper scales better at larger sizes.

<BenchmarkChart title="24px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 23620 },
  { name: 'freetype2', opsPerSec: 17400 }
]" />

<BenchmarkChart title="48px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 22270 },
  { name: 'freetype2', opsPerSec: 8100 }
]" />

<BenchmarkChart title="96px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 11220 },
  { name: 'freetype2', opsPerSec: 2570 }
]" />

<BenchmarkChart title="200px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 6740 },
  { name: 'freetype2', opsPerSec: 673 }
]" />

### Render Modes

<BenchmarkChart title="LCD subpixel (24px)" :results="[
  { name: 'text-shaper', opsPerSec: 31900 },
  { name: 'freetype2', opsPerSec: 20090 }
]" />

<BenchmarkChart title="Hinted (12px)" :results="[
  { name: 'text-shaper', opsPerSec: 67620 },
  { name: 'freetype2', opsPerSec: 25960 }
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
