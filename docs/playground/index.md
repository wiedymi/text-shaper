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
import SyntheticEffects from '../.vitepress/components/SyntheticEffects.vue'

const font = ref(null)
const fontName = ref('')
const activeTab = ref('shaping')

function handleFontLoaded(loadedFont, name) {
  font.value = loadedFont
  fontName.value = name
}

const tabs = [
  { id: 'shaping', label: 'Text Shaping' },
  { id: 'variable', label: 'Variable Fonts' },
  { id: 'glyph', label: 'Glyph Inspector' },
  { id: 'raster', label: 'Rasterization' },
  { id: 'sdf', label: 'SDF Rendering' },
  { id: 'effects', label: 'Synthetic Effects' },
]
</script>

# Playground

Test TextShaper's functionality directly in your browser. Load a font and explore text shaping, variable font controls, glyph inspection, and rasterization.

## Load a Font

<FontPicker @font-loaded="handleFontLoaded" />

<div v-if="font" class="font-loaded">
  Loaded: <strong>{{ fontName }}</strong>
  <span class="font-info">
    ({{ font.numGlyphs }} glyphs, {{ font.unitsPerEm }} UPM
    <span v-if="font.isVariable">, variable</span>)
  </span>
</div>

## Explore

<div class="tabs">
  <button
    v-for="tab in tabs"
    :key="tab.id"
    :class="{ active: activeTab === tab.id }"
    @click="activeTab = tab.id"
  >
    {{ tab.label }}
  </button>
</div>

<div class="tab-content">
  <ShapingPlayground v-if="activeTab === 'shaping'" :font="font" :font-name="fontName" />
  <VariableFontPlayground v-else-if="activeTab === 'variable'" :font="font" :font-name="fontName" />
  <GlyphInspector v-else-if="activeTab === 'glyph'" :font="font" :font-name="fontName" />
  <RasterPreview v-else-if="activeTab === 'raster'" :font="font" :font-name="fontName" />
  <SdfPreview v-else-if="activeTab === 'sdf'" :font="font" :font-name="fontName" />
  <SyntheticEffects v-else-if="activeTab === 'effects'" :font="font" :font-name="fontName" />
</div>

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

.tabs {
  display: flex;
  gap: 0;
  margin-top: 24px;
  border-bottom: 2px solid var(--vp-c-border);
}

.tabs button {
  padding: 12px 20px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  transition: all 0.2s;
}

.tabs button:hover {
  color: var(--vp-c-text-1);
}

.tabs button.active {
  color: var(--vp-c-brand);
  border-bottom-color: var(--vp-c-brand);
}

.tab-content {
  padding: 24px 0;
}
</style>
