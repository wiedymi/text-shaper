# Benchmarks

<BenchmarkSummary :items="[
  { category: 'Path Extraction', vsHarfbuzz: '50x faster', vsOpentype: '15x faster' },
  { category: 'SVG Generation', vsHarfbuzz: '23x faster', vsOpentype: '99x faster', highlight: true },
  { category: 'Latin Shaping', vsHarfbuzz: '1.4x faster', vsOpentype: '12x faster', highlight: true },
  { category: 'Cyrillic Shaping', vsHarfbuzz: '1.1x faster', vsOpentype: '21-41x faster' },
  { category: 'CJK Shaping', vsHarfbuzz: '1.3-1.4x faster', vsOpentype: '12-14x faster', highlight: true },
  { category: 'Arabic Shaping', vsHarfbuzz: '1.0x', vsOpentype: '66x faster', highlight: true },
  { category: 'Hebrew Shaping', vsHarfbuzz: '1.5x faster', vsOpentype: '30x faster', highlight: true },
  { category: 'Hindi Shaping', vsHarfbuzz: '1.0x', vsOpentype: '10x faster', highlight: true },
  { category: 'Thai Shaping', vsHarfbuzz: '1.0x', vsOpentype: '9x faster', highlight: true },
  { category: 'Myanmar Shaping', vsHarfbuzz: '1.0x', vsOpentype: '14x faster', highlight: true },
  { category: 'Khmer Shaping', vsHarfbuzz: '1.0x', vsOpentype: '6x faster', highlight: true },
  { category: 'UI Simulation', vsHarfbuzz: '4x faster', highlight: true },
  { category: 'Rasterization', vsFreetype: '1.5-12x faster', highlight: true },
  { category: 'Cache Benefits', improvement: '3x speedup on repeated shaping' }
]" />

<BenchmarkEnv />

## Glyph Paths

50x faster than HarfBuzz, 15x faster than opentype.js for path extraction.

<BenchmarkFromData data-key="path.extraction" title="Extract 10 glyph paths" />

<BenchmarkFromData data-key="path.svgGeneration" title="SVG path generation (10 glyphs)" />

## Text to SVG

Full text-to-SVG pipeline including shaping and path generation. 3.3x faster than HarfBuzz, 13x faster than opentype.js.

<BenchmarkFromData data-key="path.textToSvgHello" title="Hello World" />

<BenchmarkFromData data-key="path.textToSvgParagraph" title="Paragraph (87 chars)" />

## Text Shaping

### Basic Shaping

<BenchmarkFromData data-key="basic.ltrNoFeatures" title="LTR text (no features)" />

<BenchmarkFromData data-key="basic.ligaKern" title="liga + kern features" />

<BenchmarkFromData data-key="basic.manyFeatures" title="Many features" />

### Cyrillic Scripts

1.1x faster than HarfBuzz across Russian, Ukrainian, and Belarusian. 21-41x faster than opentype.js.

<BenchmarkFromData data-key="cyrillic.russian" title="Russian paragraph (1001 chars)" />

<BenchmarkFromData data-key="cyrillic.ukrainian" title="Ukrainian paragraph (788 chars)" />

<BenchmarkFromData data-key="cyrillic.belarusian" title="Belarusian paragraph (712 chars)" />

### CJK Scripts

1.3-1.4x faster than HarfBuzz for CJK text, 12-14x faster than opentype.js.

<BenchmarkFromData data-key="cjk.chinese" title="Chinese Simplified (329 chars)" />

<BenchmarkFromData data-key="cjk.japanese" title="Japanese (418 chars)" />

<BenchmarkFromData data-key="cjk.korean" title="Korean (449 chars)" />

### Latin Scripts

1.4x faster than HarfBuzz, 12x faster than opentype.js for Latin text.

<BenchmarkFromData data-key="latin.english" title="English paragraph (1056 chars)" />

### RTL Scripts

1.0-1.5x vs HarfBuzz for Arabic and Hebrew. 30-66x faster than opentype.js.

<BenchmarkFromData data-key="rtl.arabic" title="Arabic paragraph (1121 chars)" />

<BenchmarkFromData data-key="rtl.hebrew" title="Hebrew paragraph (1220 chars)" />

### Complex Scripts

TextShaper matches HarfBuzz on Indic and Southeast Asian scripts, 6-14x faster than opentype.js.

<BenchmarkFromData data-key="complex.hindi" title="Hindi paragraph (1105 chars)" />

<BenchmarkFromData data-key="complex.myanmar" title="Myanmar paragraph (984 chars)" />

<BenchmarkFromData data-key="complex.khmer" title="Khmer paragraph (1004 chars)" />

<BenchmarkFromData data-key="complex.thai" title="Thai paragraph (832 chars)" />

### Greek

1.0x vs HarfBuzz, 23x faster than opentype.js for Greek text.

<BenchmarkFromData data-key="greek.greek" title="Greek paragraph (997 chars)" />

## Caching Performance

Shape plan caching provides significant speedups for repeated shaping.

<BenchmarkFromData data-key="caching.hello" title="Repeated Shaping - Hello" />

<BenchmarkFromData data-key="caching.paragraph" title="Repeated Shaping - paragraph (85 chars)" />

<BenchmarkFromData data-key="caching.glyphPath" title="Glyph Path Cache" />

## Real-World Simulations

<BenchmarkFromData data-key="simulation.ui" title="UI Simulation - 8 labels with paths" />

<BenchmarkFromData data-key="simulation.document" title="Document Simulation - 4 paragraphs" />

## Rasterization

Compared against FreeType2 (WebAssembly). TextShaper is 1.5-12x faster at all sizes.

<BenchmarkFromData data-key="raster.12px" title="12px grayscale (5 glyphs)" />

<BenchmarkFromData data-key="raster.24px" title="24px grayscale (5 glyphs)" />

<BenchmarkFromData data-key="raster.48px" title="48px grayscale (5 glyphs)" />

<BenchmarkFromData data-key="raster.96px" title="96px grayscale (5 glyphs)" />

<BenchmarkFromData data-key="raster.200px" title="200px grayscale (5 glyphs)" />

### Render Modes

<BenchmarkFromData data-key="rasterModes.lcd24px" title="LCD subpixel (24px)" />

<BenchmarkFromData data-key="rasterModes.hinted12px" title="Hinted (12px)" />

### Throughput

<BenchmarkFromData data-key="throughput.62glyphs16px" title="62 glyphs at 16px" />

<BenchmarkFromData data-key="throughput.varyingSizes" title="Varying sizes - 15 sizes per iteration" />

<BenchmarkFromData data-key="throughput.veryLarge" title="Very large - 5 glyphs at 200px" />

## OpenType Features

<BenchmarkFromData data-key="features.noFeatures" title="No features - mixed text" />

<BenchmarkFromData data-key="features.liga" title="Standard ligatures (liga)" />

<BenchmarkFromData data-key="features.kern" title="Kerning pairs" />

<BenchmarkFromData data-key="features.smcp" title="Small caps (smcp)" />

<BenchmarkFromData data-key="features.onum" title="Oldstyle figures (onum)" />

<BenchmarkFromData data-key="features.tnum" title="Tabular figures (tnum)" />

<BenchmarkFromData data-key="features.frac" title="Fractions (frac)" />

<BenchmarkFromData data-key="features.allCommon" title="All common features (liga + kern + calt)" />

## Grapheme Clusters

<BenchmarkFromData data-key="graphemes.ascii" title="Count graphemes - ASCII (11 chars)" />

<BenchmarkFromData data-key="graphemes.emojiSimple" title="Count graphemes - emoji simple (5 graphemes)" />

<BenchmarkFromData data-key="graphemes.emojiZwj" title="Count graphemes - emoji ZWJ (8 graphemes)" />

<BenchmarkFromData data-key="graphemes.devanagari" title="Count graphemes - Devanagari (8 graphemes)" />

<BenchmarkFromData data-key="graphemes.mixed" title="Count graphemes - mixed (25 graphemes)" />

<BenchmarkFromData data-key="graphemes.splitEmojiZwj" title="Split graphemes - emoji ZWJ (8 graphemes)" />
