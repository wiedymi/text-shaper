# Benchmarks

<BenchmarkSummary :items="[
  { category: 'Font Loading', vsHarfbuzz: '2-22x faster', vsOpentype: '1000x+ faster' },
  { category: 'Path Extraction', vsHarfbuzz: '18x faster', vsOpentype: '10x faster' },
  { category: 'Latin Shaping', vsHarfbuzz: '1.5x slower' },
  { category: 'Arabic Shaping', vsHarfbuzz: '1.6x slower' },
  { category: 'Hebrew Shaping', vsHarfbuzz: '3x slower' },
  { category: 'Hindi Shaping', vsHarfbuzz: '1.6x faster', highlight: true },
  { category: 'Myanmar Shaping', vsHarfbuzz: '8x faster', highlight: true },
  { category: 'Rasterization', vsFreetype: '2-12x faster', highlight: true }
]" />

<div class="env-info">
  <span>MacBook Pro M1 Pro</span>
  <span>16 GB</span>
  <span>Bun 1.3.3</span>
  <span>text-shaper 0.1.2</span>
</div>

## Font Loading

1000x faster than opentype.js through lazy table parsing.

<BenchmarkChart title="NotoSans-Regular.ttf" :results="[
  { name: 'text-shaper', opsPerSec: 225100 },
  { name: 'harfbuzzjs', opsPerSec: 59180 },
  { name: 'opentype.js', opsPerSec: 217 }
]" />

<BenchmarkChart title="NotoSans-Variable.ttf" :results="[
  { name: 'text-shaper', opsPerSec: 379750 },
  { name: 'harfbuzzjs', opsPerSec: 16980 },
  { name: 'opentype.js', opsPerSec: 183 }
]" />

## Glyph Paths

<BenchmarkChart title="Extract 10 glyph paths" :results="[
  { name: 'text-shaper', opsPerSec: 881110 },
  { name: 'opentype.js', opsPerSec: 84600 },
  { name: 'harfbuzzjs', opsPerSec: 48660 }
]" />

## Text Shaping

### Latin Scripts

<BenchmarkChart title="English paragraph (701 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 4950 },
  { name: 'harfbuzzjs', opsPerSec: 7520 }
]" />

<BenchmarkChart title="Hebrew paragraph (313 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 9910 },
  { name: 'harfbuzzjs', opsPerSec: 29500 }
]" />

### Complex Scripts

TextShaper outperforms HarfBuzz on Indic and Southeast Asian scripts.

<BenchmarkChart title="Hindi paragraph (806 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 4120 },
  { name: 'harfbuzzjs', opsPerSec: 2240 }
]" />

<BenchmarkChart title="Myanmar paragraph (729 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 8350 },
  { name: 'harfbuzzjs', opsPerSec: 1020 }
]" />

<BenchmarkChart title="Khmer paragraph (725 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 4380 },
  { name: 'harfbuzzjs', opsPerSec: 3570 }
]" />

<BenchmarkChart title="Thai word (11 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 180320 },
  { name: 'harfbuzzjs', opsPerSec: 84950 }
]" />

## Rasterization

Compared against FreeType2 (WebAssembly). TextShaper scales better at larger sizes.

<BenchmarkChart title="24px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 43310 },
  { name: 'freetype2', opsPerSec: 17670 }
]" />

<BenchmarkChart title="48px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 16280 },
  { name: 'freetype2', opsPerSec: 7690 }
]" />

<BenchmarkChart title="96px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 12430 },
  { name: 'freetype2', opsPerSec: 2570 }
]" />

<BenchmarkChart title="200px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 8070 },
  { name: 'freetype2', opsPerSec: 659 }
]" />

### Render Modes

<BenchmarkChart title="LCD subpixel (24px)" :results="[
  { name: 'text-shaper', opsPerSec: 38430 },
  { name: 'freetype2', opsPerSec: 19700 }
]" />

<BenchmarkChart title="Hinted (12px)" :results="[
  { name: 'text-shaper', opsPerSec: 71430 },
  { name: 'freetype2', opsPerSec: 25650 }
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
