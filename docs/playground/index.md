---
title: Playground
---

<script setup>
import { ref } from 'vue'
import FontPicker from '../.vitepress/components/FontPicker.vue'
import ShapingPlayground from '../.vitepress/components/ShapingPlayground.vue'
import VariableFontPlayground from '../.vitepress/components/VariableFontPlayground.vue'
import GlyphInspector from '../.vitepress/components/GlyphInspector.vue'
import RasterPreview from '../.vitepress/components/RasterPreview.vue'
import SdfPreview from '../.vitepress/components/SdfPreview.vue'
import MsdfPreview from '../.vitepress/components/MsdfPreview.vue'
import SyntheticEffects from '../.vitepress/components/SyntheticEffects.vue'
import EffectsPreview from '../.vitepress/components/EffectsPreview.vue'
import TransformPreview from '../.vitepress/components/TransformPreview.vue'
import StrokePreview from '../.vitepress/components/StrokePreview.vue'

const font = ref(null)
const fontName = ref('')

function handleFontLoaded(loadedFont, name) {
  font.value = loadedFont
  fontName.value = name
}
</script>

# Playground

Test TextShaper's functionality directly in your browser. Load a font and explore all features below.

## Load a Font

<FontPicker @font-loaded="handleFontLoaded" />

<div v-if="font" class="font-loaded">
  Loaded: <strong>{{ fontName }}</strong>
  <span class="font-info">
    ({{ font.numGlyphs }} glyphs, {{ font.unitsPerEm }} UPM
    <span v-if="font.isVariable">, variable</span>)
  </span>
</div>

## Text Shaping

Shape text with OpenType features and see glyph positioning.

<ShapingPlayground :font="font" :font-name="fontName" />

## Variable Fonts

<div v-if="font && font.isVariable">
Adjust variation axes to see how the font responds.
</div>
<div v-else class="info-box">
Load a variable font to explore axis controls.
</div>

<VariableFontPlayground :font="font" :font-name="fontName" />

## Glyph Inspector

Inspect individual glyphs, their outlines, and metrics.

<GlyphInspector :font="font" :font-name="fontName" />

## Rasterization

Preview glyph rasterization with different settings.

<RasterPreview :font="font" :font-name="fontName" />

## SDF Rendering

Signed Distance Field rendering for GPU text.

<SdfPreview :font="font" :font-name="fontName" />

## MSDF Rendering

Multi-channel Signed Distance Field for sharp corners at any scale.

<MsdfPreview :font="font" :font-name="fontName" />

## Synthetic Effects

Apply synthetic bold, italic, and condensed transformations.

<SyntheticEffects :font="font" :font-name="fontName" />

## Blur & Gradients

Apply blur filters and gradient fills to glyphs.

<EffectsPreview :font="font" :font-name="fontName" />

## Outline Transforms

Apply 2D and 3D transformations (rotation, scale, shear, perspective) to glyph outlines using vector or raster rendering.

<TransformPreview :font="font" :font-name="fontName" />

## Asymmetric Stroke

Generate stroked outlines with independent X and Y border widths.

<StrokePreview :font="font" :font-name="fontName" />

<style>
.font-loaded {
  margin-top: 16px;
  padding: 12px 16px;
  background: var(--vp-c-brand-soft);
  border-radius: 8px;
  font-size: 14px;
}

.font-info {
  color: var(--vp-c-text-2);
  margin-left: 4px;
}

.info-box {
  padding: 12px 16px;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  margin-bottom: 16px;
}
</style>
