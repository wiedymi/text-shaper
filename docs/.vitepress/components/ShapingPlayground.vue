<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  font: any
  fontName: string
}>()

const text = ref('Hello, World!')
const direction = ref<'ltr' | 'rtl'>('ltr')
const script = ref('latn')
const language = ref('')
const fontSize = ref(48)

// Feature toggles
const features = ref({
  liga: true,
  kern: true,
  calt: true,
  smcp: false,
  dlig: false,
  onum: false,
  tnum: false,
  ss01: false,
})

const shapedResult = ref<any>(null)
const svgOutput = ref('')
const error = ref('')

const glyphData = computed(() => {
  if (!shapedResult.value) return []
  const result = []
  for (let i = 0; i < shapedResult.value.length; i++) {
    const info = shapedResult.value.infos[i]
    const pos = shapedResult.value.positions[i]
    result.push({
      index: i,
      glyphId: info.glyphId,
      cluster: info.cluster,
      xAdvance: pos.xAdvance,
      yAdvance: pos.yAdvance,
      xOffset: pos.xOffset,
      yOffset: pos.yOffset,
    })
  }
  return result
})

const totalWidth = computed(() => {
  if (!shapedResult.value) return 0
  let total = 0
  for (let i = 0; i < shapedResult.value.length; i++) {
    total += shapedResult.value.positions[i].xAdvance
  }
  return total
})

const totalWidthPx = computed(() => {
  if (!props.font) return 0
  return (totalWidth.value * fontSize.value) / props.font.unitsPerEm
})

async function shapeText() {
  if (!props.font || !text.value) {
    shapedResult.value = null
    svgOutput.value = ''
    return
  }

  error.value = ''

  try {
    const { UnicodeBuffer, shape, shapedTextToSVG, glyphBufferToShapedGlyphs, feature } = await import('text-shaper')

    const buffer = new UnicodeBuffer()
      .addStr(text.value)
      .setDirection(direction.value === 'rtl' ? 1 : 0)
      .setScript(script.value)

    if (language.value) {
      buffer.setLanguage(language.value)
    }

    // Build features array
    const featureList = []
    for (const [tag, enabled] of Object.entries(features.value)) {
      featureList.push(feature(tag, enabled))
    }

    const result = shape(props.font, buffer, {
      direction: direction.value,
      features: featureList,
    })

    shapedResult.value = result

    // Generate SVG - convert GlyphBuffer to ShapedGlyph[]
    const glyphs = glyphBufferToShapedGlyphs(result)
    svgOutput.value = shapedTextToSVG(props.font, glyphs, { fontSize: fontSize.value })
  } catch (e) {
    error.value = `Shaping error: ${e}`
    console.error(e)
  }
}

// Auto-shape when inputs change
watch([text, direction, script, language, fontSize, features, () => props.font], shapeText, {
  immediate: true,
  deep: true,
})

const scriptOptions = [
  { value: 'latn', label: 'Latin' },
  { value: 'arab', label: 'Arabic' },
  { value: 'deva', label: 'Devanagari' },
  { value: 'hebr', label: 'Hebrew' },
  { value: 'thai', label: 'Thai' },
  { value: 'hang', label: 'Hangul' },
  { value: 'hani', label: 'Han' },
  { value: 'cyrl', label: 'Cyrillic' },
  { value: 'grek', label: 'Greek' },
]
</script>

<template>
  <div class="shaping-playground">
    <div class="input-section">
      <div class="input-row">
        <label>Text</label>
        <textarea v-model="text" rows="2" placeholder="Enter text to shape..."></textarea>
      </div>

      <div class="options-row">
        <div class="option">
          <label>Direction</label>
          <select v-model="direction">
            <option value="ltr">LTR</option>
            <option value="rtl">RTL</option>
          </select>
        </div>

        <div class="option">
          <label>Script</label>
          <select v-model="script">
            <option v-for="opt in scriptOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }} ({{ opt.value }})
            </option>
          </select>
        </div>

        <div class="option">
          <label>Language</label>
          <input v-model="language" placeholder="e.g. en, ar, de" />
        </div>

        <div class="option">
          <label>Font Size</label>
          <input type="number" v-model.number="fontSize" min="8" max="200" />
        </div>
      </div>

      <div class="features-section">
        <label>OpenType Features</label>
        <div class="features-grid">
          <label v-for="(enabled, tag) in features" :key="tag" class="feature-toggle">
            <input type="checkbox" v-model="features[tag]" />
            <span>{{ tag }}</span>
          </label>
        </div>
      </div>
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="props.font" class="output-section">
      <div class="preview-container">
        <label>Preview</label>
        <div class="svg-preview" :style="{ direction: direction }" v-html="svgOutput"></div>
      </div>

      <div class="metrics">
        <div class="metric">
          <span class="label">Glyphs:</span>
          <span class="value">{{ glyphData.length }}</span>
        </div>
        <div class="metric">
          <span class="label">Total Width:</span>
          <span class="value">{{ totalWidth }} units ({{ totalWidthPx.toFixed(1) }}px)</span>
        </div>
      </div>

      <div class="glyph-table-container">
        <label>Glyph Data</label>
        <div class="table-scroll">
          <table class="glyph-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Glyph ID</th>
                <th>Cluster</th>
                <th>X Advance</th>
                <th>Y Advance</th>
                <th>X Offset</th>
                <th>Y Offset</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="glyph in glyphData" :key="glyph.index">
                <td>{{ glyph.index }}</td>
                <td>{{ glyph.glyphId }}</td>
                <td>{{ glyph.cluster }}</td>
                <td>{{ glyph.xAdvance }}</td>
                <td>{{ glyph.yAdvance }}</td>
                <td>{{ glyph.xOffset }}</td>
                <td>{{ glyph.yOffset }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-else class="no-font">
      Select a font above to start shaping text.
    </div>
  </div>
</template>

<style scoped>
.shaping-playground {
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

.input-row textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  font-size: 16px;
  font-family: inherit;
  resize: vertical;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.options-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.option {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.option label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.option select,
.option input {
  padding: 6px 10px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  font-size: 14px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.option input[type="number"] {
  width: 80px;
}

.features-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.features-section > label {
  font-weight: 600;
  font-size: 14px;
}

.features-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.feature-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 14px;
}

.feature-toggle input {
  cursor: pointer;
}

.feature-toggle span {
  font-family: monospace;
}

.output-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-container label {
  font-weight: 600;
  font-size: 14px;
}

.svg-preview {
  padding: 24px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  overflow-x: auto;
  min-height: 100px;
  display: flex;
  align-items: center;
}

.svg-preview :deep(svg) {
  max-width: 100%;
  height: auto;
}

.metrics {
  display: flex;
  gap: 24px;
}

.metric {
  font-size: 14px;
}

.metric .label {
  color: var(--vp-c-text-2);
}

.metric .value {
  font-weight: 600;
  margin-left: 4px;
}

.glyph-table-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.glyph-table-container label {
  font-weight: 600;
  font-size: 14px;
}

.table-scroll {
  overflow-x: auto;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
}

.glyph-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.glyph-table th,
.glyph-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--vp-c-border);
}

.glyph-table th {
  background: var(--vp-c-bg-soft);
  font-weight: 600;
  white-space: nowrap;
}

.glyph-table td {
  font-family: monospace;
}

.glyph-table tbody tr:hover {
  background: var(--vp-c-bg-soft);
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
