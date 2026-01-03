<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  font: any
  fontName: string
}>()

const text = ref('Hello')
const fontSize = ref(64)

// Effect parameters
const obliqueSlant = ref(0.2)
const emboldenStrength = ref(30)
const condenseScale = ref(1.0)

// Effect toggles
const enableOblique = ref(false)
const enableEmbolden = ref(false)
const enableCondense = ref(false)

const originalSvg = ref('')
const transformedSvg = ref('')
const error = ref('')

async function generatePreviews() {
  if (!props.font || !text.value) {
    originalSvg.value = ''
    transformedSvg.value = ''
    return
  }

  error.value = ''

  try {
    const { getGlyphPath, pathToSVG, obliquePath, emboldenPath, condensePath } = await import('text-shaper')
    const svgScale = 10

    const characters = Array.from(text.value)
    let xOffset = 0
    let originalPaths: string[] = []
    let transformedPaths: string[] = []

    // Calculate total width and metrics for viewBox
    let maxY = -Infinity
    let minY = Infinity
    let totalWidth = 0

    for (const char of characters) {
      const codepoint = char.codePointAt(0) || 0
      const glyphId = props.font.glyphId(codepoint)

      if (glyphId === 0 && codepoint !== 0) {
        continue
      }

      const path = getGlyphPath(props.font, glyphId)
      if (!path) continue

      // Get original path
      const pathStr = pathToSVG(path, { flipY: false })
      originalPaths.push(`<path d="${pathStr}" transform="translate(${xOffset * svgScale}, 0)"/>`)

      // Apply transformations
      let transformedPath = path

      // Apply in order: condense -> embolden -> oblique
      if (enableCondense.value) {
        transformedPath = condensePath(transformedPath, condenseScale.value)
      }

      if (enableEmbolden.value) {
        transformedPath = emboldenPath(transformedPath, emboldenStrength.value)
      }

      if (enableOblique.value) {
        transformedPath = obliquePath(transformedPath, obliqueSlant.value)
      }

      const transformedPathStr = pathToSVG(transformedPath, { flipY: false })
      transformedPaths.push(`<path d="${transformedPathStr}" transform="translate(${xOffset * svgScale}, 0)"/>`)

      // Update bounds
      if (transformedPath.bounds) {
        maxY = Math.max(maxY, transformedPath.bounds.yMax)
        minY = Math.min(minY, transformedPath.bounds.yMin)
      }

      // Advance
      const advanceWidth = props.font.advanceWidth(glyphId)
      let scaledAdvance = advanceWidth

      // Apply condense to advance as well
      if (enableCondense.value) {
        scaledAdvance = advanceWidth * condenseScale.value
      }

      xOffset += scaledAdvance
      totalWidth = xOffset
    }

    if (originalPaths.length === 0) {
      error.value = 'No glyphs found for the given text'
      originalSvg.value = ''
      transformedSvg.value = ''
      return
    }

    if (!Number.isFinite(maxY)) {
      maxY = 0
      minY = 0
    }

    // Create viewBox with some padding
    const padding = 50
    const viewBoxMinY = (minY - padding) * svgScale
    const viewBoxHeight = (maxY - minY + padding * 2) * svgScale
    const viewBoxWidth = (totalWidth + padding * 2) * svgScale
    const viewBoxMinX = -padding * svgScale

    // Calculate display dimensions
    const displayWidth = fontSize.value * ((totalWidth + padding * 2) / (maxY - minY || 100))
    const displayHeight = fontSize.value

    originalSvg.value = `
      <svg viewBox="${viewBoxMinX} ${viewBoxMinY} ${viewBoxWidth} ${viewBoxHeight}"
           width="${displayWidth}"
           height="${displayHeight}"
           style="transform: scaleY(-1)">
        <line x1="${-padding * svgScale}" y1="0" x2="${(totalWidth + padding) * svgScale}" y2="0" stroke="#ccc" stroke-width="1" stroke-dasharray="4"/>
        <g fill="currentColor">
          ${originalPaths.join('\n')}
        </g>
      </svg>
    `

    transformedSvg.value = `
      <svg viewBox="${viewBoxMinX} ${viewBoxMinY} ${viewBoxWidth} ${viewBoxHeight}"
           width="${displayWidth}"
           height="${displayHeight}"
           style="transform: scaleY(-1)">
        <line x1="${-padding * svgScale}" y1="0" x2="${(totalWidth + padding) * svgScale}" y2="0" stroke="#ccc" stroke-width="1" stroke-dasharray="4"/>
        <g fill="currentColor">
          ${transformedPaths.join('\n')}
        </g>
      </svg>
    `
  } catch (e) {
    console.error('Error generating previews:', e)
    error.value = `Error: ${e}`
    originalSvg.value = ''
    transformedSvg.value = ''
  }
}

watch([
  text,
  fontSize,
  obliqueSlant,
  emboldenStrength,
  condenseScale,
  enableOblique,
  enableEmbolden,
  enableCondense,
  () => props.font
], generatePreviews, { immediate: true })
</script>

<template>
  <div class="synthetic-effects">
    <div class="input-section">
      <div class="input-row">
        <label>Text</label>
        <input v-model="text" type="text" placeholder="Enter text" />
      </div>

      <div class="input-row">
        <label>Font Size: {{ fontSize }}px</label>
        <input v-model.number="fontSize" type="range" min="32" max="120" />
      </div>

      <div class="effects-section">
        <h3>Effects</h3>

        <div class="effect-row">
          <label class="checkbox-label">
            <input type="checkbox" v-model="enableOblique" />
            <span>Oblique (Slant)</span>
          </label>
          <div class="slider-group" :class="{ disabled: !enableOblique }">
            <label>Slant: {{ obliqueSlant.toFixed(2) }}</label>
            <input
              v-model.number="obliqueSlant"
              type="range"
              min="-0.5"
              max="0.5"
              step="0.01"
              :disabled="!enableOblique"
            />
            <span class="hint">0.2 = typical italic (~11°)</span>
          </div>
        </div>

        <div class="effect-row">
          <label class="checkbox-label">
            <input type="checkbox" v-model="enableEmbolden" />
            <span>Embolden</span>
          </label>
          <div class="slider-group" :class="{ disabled: !enableEmbolden }">
            <label>Strength: {{ emboldenStrength }} units</label>
            <input
              v-model.number="emboldenStrength"
              type="range"
              min="0"
              max="50"
              :disabled="!enableEmbolden"
            />
          </div>
        </div>

        <div class="effect-row">
          <label class="checkbox-label">
            <input type="checkbox" v-model="enableCondense" />
            <span>Condense/Expand</span>
          </label>
          <div class="slider-group" :class="{ disabled: !enableCondense }">
            <label>Scale: {{ condenseScale.toFixed(2) }}x</label>
            <input
              v-model.number="condenseScale"
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              :disabled="!enableCondense"
            />
            <span class="hint">&lt; 1.0 = condensed, &gt; 1.0 = expanded</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!props.font" class="no-font">
      Select a font above to preview synthetic effects.
    </div>

    <template v-else>
      <div v-if="error" class="error">{{ error }}</div>

      <div class="preview-section">
        <div class="preview-box">
          <label>Original</label>
          <div class="svg-container" v-html="originalSvg"></div>
        </div>

        <div class="preview-box">
          <label>Transformed</label>
          <div class="svg-container" v-html="transformedSvg"></div>
        </div>
      </div>

      <div class="info-box">
        <p><strong>Synthetic Effects</strong> are transformations applied to glyph outlines to simulate font styles that don't exist natively.</p>
        <ul>
          <li><strong>Oblique:</strong> Slants the glyphs to simulate italic. Transform: x' = x + y × slant</li>
          <li><strong>Embolden:</strong> Expands outlines to simulate bold. Adds thickness to strokes.</li>
          <li><strong>Condense/Expand:</strong> Scales glyphs horizontally to adjust width.</li>
        </ul>
        <p>Effects are applied in order: Condense → Embolden → Oblique</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.synthetic-effects {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-row label {
  font-weight: 600;
  font-size: 14px;
}

.input-row input[type="text"] {
  padding: 10px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  font-size: 18px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.effects-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
}

.effects-section h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.effect-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--vp-c-bg);
  border-radius: 4px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 26px;
}

.slider-group.disabled {
  opacity: 0.5;
}

.slider-group label {
  font-size: 13px;
  color: var(--vp-c-text-2);
  font-weight: normal;
}

.slider-group .hint {
  font-size: 12px;
  color: var(--vp-c-text-3);
  font-style: italic;
}

.preview-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.preview-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-box > label {
  font-weight: 600;
  font-size: 14px;
}

.svg-container {
  padding: 24px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 120px;
  overflow: auto;
}

.info-box {
  padding: 16px;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  font-size: 14px;
}

.info-box p {
  margin: 0 0 12px 0;
  color: var(--vp-c-text-2);
}

.info-box ul {
  margin: 0 0 12px 0;
  padding-left: 20px;
  color: var(--vp-c-text-2);
}

.info-box li {
  margin: 4px 0;
}

.error {
  padding: 12px;
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger);
  border-radius: 4px;
  font-size: 14px;
}

.no-font {
  padding: 24px;
  text-align: center;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
}
</style>
