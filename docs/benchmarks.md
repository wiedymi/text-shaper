# Benchmarks

<BenchmarkSummary :items="[
  { category: 'Font Loading', vsHarfbuzz: '4-41x faster', vsOpentype: '1000-4000x faster' },
  { category: 'Path Extraction', vsHarfbuzz: '20x faster', vsOpentype: '10x faster' },
  { category: 'Latin Shaping', vsHarfbuzz: '1.5x slower' },
  { category: 'Cyrillic Shaping', vsHarfbuzz: 'on par' },
  { category: 'CJK Shaping', vsHarfbuzz: 'on par' },
  { category: 'Arabic Shaping', vsHarfbuzz: '1.2-1.6x slower' },
  { category: 'Hebrew Shaping', vsHarfbuzz: '2.5-3.5x slower' },
  { category: 'Hindi Shaping', vsHarfbuzz: '1.9-2.2x faster', highlight: true },
  { category: 'Myanmar Shaping', vsHarfbuzz: '7-9x faster', highlight: true },
  { category: 'Khmer Shaping', vsHarfbuzz: '1.4x faster', highlight: true },
  { category: 'Rasterization', vsFreetype: '1.2-10x faster', highlight: true }
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
  { name: 'text-shaper', opsPerSec: 226910 },
  { name: 'harfbuzzjs', opsPerSec: 56550 },
  { name: 'opentype.js', opsPerSec: 218 }
]" />

<BenchmarkChart title="NotoSans-VariableFont.ttf" :results="[
  { name: 'text-shaper', opsPerSec: 715800 },
  { name: 'harfbuzzjs', opsPerSec: 17420 },
  { name: 'opentype.js', opsPerSec: 180 }
]" />

## Glyph Paths

20x faster than HarfBuzz, 10x faster than opentype.js for path extraction.

<BenchmarkChart title="Extract 10 glyph paths" :results="[
  { name: 'text-shaper', opsPerSec: 870820 },
  { name: 'opentype.js', opsPerSec: 91000 },
  { name: 'harfbuzzjs', opsPerSec: 43420 }
]" />

## Text Shaping

### Latin Scripts

<BenchmarkChart title="English paragraph (701 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 4870 },
  { name: 'harfbuzzjs', opsPerSec: 7370 }
]" />

### Cyrillic Scripts

On par with HarfBuzz for Cyrillic text.

<BenchmarkChart title="Russian paragraph (594 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 29450 },
  { name: 'harfbuzzjs', opsPerSec: 31830 }
]" />

<BenchmarkChart title="Ukrainian paragraph (527 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 32640 },
  { name: 'harfbuzzjs', opsPerSec: 33360 }
]" />

<BenchmarkChart title="Belarusian paragraph (489 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 32910 },
  { name: 'harfbuzzjs', opsPerSec: 35930 }
]" />

### CJK Scripts

On par with HarfBuzz for CJK text.

<BenchmarkChart title="Chinese Simplified paragraph (185 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 89650 },
  { name: 'harfbuzzjs', opsPerSec: 86960 }
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
  { name: 'text-shaper', opsPerSec: 4090 },
  { name: 'harfbuzzjs', opsPerSec: 6740 }
]" />

<BenchmarkChart title="Hebrew paragraph (313 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 12180 },
  { name: 'harfbuzzjs', opsPerSec: 30520 }
]" />

### Complex Scripts

TextShaper outperforms HarfBuzz on Indic and Southeast Asian scripts.

<BenchmarkChart title="Hindi paragraph (806 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 5040 },
  { name: 'harfbuzzjs', opsPerSec: 2320 }
]" />

<BenchmarkChart title="Myanmar paragraph (729 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 9530 },
  { name: 'harfbuzzjs', opsPerSec: 1020 }
]" />

<BenchmarkChart title="Khmer paragraph (725 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 5240 },
  { name: 'harfbuzzjs', opsPerSec: 3610 }
]" />

<BenchmarkChart title="Thai paragraph (444 chars)" :results="[
  { name: 'text-shaper', opsPerSec: 10850 },
  { name: 'harfbuzzjs', opsPerSec: 11510 }
]" />

## Rasterization

Compared against FreeType2 (WebAssembly). TextShaper scales better at larger sizes.

<BenchmarkChart title="24px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 23860 },
  { name: 'freetype2', opsPerSec: 17930 }
]" />

<BenchmarkChart title="48px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 19810 },
  { name: 'freetype2', opsPerSec: 7850 }
]" />

<BenchmarkChart title="96px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 11110 },
  { name: 'freetype2', opsPerSec: 2630 }
]" />

<BenchmarkChart title="200px grayscale (5 glyphs)" :results="[
  { name: 'text-shaper', opsPerSec: 6440 },
  { name: 'freetype2', opsPerSec: 659 }
]" />

### Render Modes

<BenchmarkChart title="LCD subpixel (24px)" :results="[
  { name: 'text-shaper', opsPerSec: 31080 },
  { name: 'freetype2', opsPerSec: 20720 }
]" />

<BenchmarkChart title="Hinted (12px)" :results="[
  { name: 'text-shaper', opsPerSec: 71200 },
  { name: 'freetype2', opsPerSec: 25620 }
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
