---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "TextShaper"
  text: "Pure TypeScript Text Shaping Engine"
  tagline: OpenType layout, variable fonts, complex scripts, TrueType hinting, and FreeType-style rasterization
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /api/font

features:
  - title: OpenType Layout
    details: Full GSUB/GPOS support with ligatures, kerning, mark positioning, and contextual alternates.
  - title: Variable Fonts
    details: Complete variable font support with axis normalization, HVAR/VVAR metrics, and glyph deltas.
  - title: Complex Scripts
    details: Arabic, Hebrew, Indic, Thai, Khmer, Myanmar, Hangul, and 40+ scripts via Universal Shaping Engine.
  - title: Rasterization
    details: FreeType-style glyph rasterization with TrueType hinting, LCD subpixel rendering, and texture atlas generation.
  - title: Pure TypeScript
    details: Zero dependencies, works in browsers and Bun/Node.js. No WebAssembly or native bindings required.
  - title: Color Fonts
    details: COLR/CPAL color palettes, SVG glyphs, sbix bitmaps, and CBDT/CBLC color bitmap support.
---

<BenchmarkHero />

