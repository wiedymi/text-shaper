<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps<{
  font: any
  fontName: string
}>()

const emit = defineEmits<{
  (e: 'faceChanged', face: any): void
}>()

const text = ref('Variable Font')
const fontSize = ref(48)
const axisValues = ref<Record<string, number>>({})
const face = ref<any>(null)
const svgOutput = ref('')

const axes = computed(() => {
  if (!props.font?.fvar) return []
  return props.font.fvar.axes.map((axis: any) => ({
    tag: String.fromCharCode(
      (axis.tag >> 24) & 0xff,
      (axis.tag >> 16) & 0xff,
      (axis.tag >> 8) & 0xff,
      axis.tag & 0xff
    ),
    tagNum: axis.tag,
    minValue: axis.minValue,
    defaultValue: axis.defaultValue,
    maxValue: axis.maxValue,
    name: axis.name || '',
  }))
})

const isVariable = computed(() => props.font?.isVariable ?? false)

function initializeAxes() {
  if (!props.font?.fvar) {
    axisValues.value = {}
    return
  }

  const values: Record<string, number> = {}
  for (const axis of axes.value) {
    values[axis.tag] = axis.defaultValue
  }
  axisValues.value = values
}

async function updateFace() {
  if (!props.font || !isVariable.value) {
    face.value = null
    return
  }

  try {
    const { Face, shape, UnicodeBuffer, shapedTextToSVG, glyphBufferToShapedGlyphs } = await import('text-shaper')

    // Create face with current axis values
    face.value = new Face(props.font, axisValues.value)
    emit('faceChanged', face.value)

    // Shape and render
    const buffer = new UnicodeBuffer().addStr(text.value)
    const result = shape(face.value, buffer)
    const glyphs = glyphBufferToShapedGlyphs(result)
    svgOutput.value = shapedTextToSVG(props.font, glyphs, { fontSize: fontSize.value })
  } catch (e) {
    console.error('Error updating face:', e)
  }
}

watch(() => props.font, () => {
  initializeAxes()
  updateFace()
}, { immediate: true })

watch([text, fontSize, axisValues], updateFace, { deep: true })

function resetAxis(tag: string) {
  const axis = axes.value.find((a: any) => a.tag === tag)
  if (axis) {
    axisValues.value[tag] = axis.defaultValue
  }
}

function resetAllAxes() {
  initializeAxes()
}
</script>

<template>
  <div class="variable-font-playground">
    <div v-if="!isVariable" class="not-variable">
      <p>The selected font is not a variable font.</p>
      <p>Try loading <strong>Inter Variable</strong> or <strong>Recursive</strong> to see variable font controls.</p>
    </div>

    <template v-else>
      <div class="input-section">
        <div class="input-row">
          <label>Preview Text</label>
          <input v-model="text" type="text" placeholder="Enter text..." />
        </div>

        <div class="input-row">
          <label>Font Size: {{ fontSize }}px</label>
          <input v-model.number="fontSize" type="range" min="12" max="120" />
        </div>
      </div>

      <div class="axes-section">
        <div class="axes-header">
          <label>Variation Axes</label>
          <button @click="resetAllAxes" class="reset-all-btn">Reset All</button>
        </div>

        <div class="axes-list">
          <div v-for="axis in axes" :key="axis.tag" class="axis-control">
            <div class="axis-header">
              <span class="axis-tag">{{ axis.tag }}</span>
              <span class="axis-name" v-if="axis.name">{{ axis.name }}</span>
              <span class="axis-value">{{ axisValues[axis.tag]?.toFixed(0) }}</span>
              <button @click="resetAxis(axis.tag)" class="reset-btn" title="Reset to default">
                ↺
              </button>
            </div>
            <div class="axis-slider">
              <span class="axis-min">{{ axis.minValue }}</span>
              <input
                type="range"
                v-model.number="axisValues[axis.tag]"
                :min="axis.minValue"
                :max="axis.maxValue"
                :step="(axis.maxValue - axis.minValue) / 100"
              />
              <span class="axis-max">{{ axis.maxValue }}</span>
            </div>
            <div class="axis-info">
              Default: {{ axis.defaultValue }}
            </div>
          </div>
        </div>
      </div>

      <div class="preview-section">
        <label>Preview</label>
        <div class="svg-preview" v-html="svgOutput"></div>
      </div>

      <div class="code-section">
        <label>Code</label>
        <pre class="code-block"><code>const face = new Face(font, {{ JSON.stringify(axisValues, null, 2) }})
const result = shape(face, buffer)</code></pre>
      </div>
    </template>
  </div>
</template>

<style scoped>
.variable-font-playground {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.not-variable {
  padding: 24px;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  text-align: center;
}

.not-variable p {
  margin: 8px 0;
  color: var(--vp-c-text-2);
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
  font-size: 16px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.input-row input[type="range"] {
  width: 100%;
}

.axes-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.axes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.axes-header label {
  font-weight: 600;
  font-size: 14px;
}

.reset-all-btn {
  padding: 4px 12px;
  font-size: 12px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  cursor: pointer;
  color: var(--vp-c-text-2);
}

.reset-all-btn:hover {
  background: var(--vp-c-bg);
}

.axes-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.axis-control {
  padding: 12px;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
}

.axis-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.axis-tag {
  font-family: monospace;
  font-weight: 700;
  font-size: 14px;
  background: var(--vp-c-brand-soft);
  padding: 2px 6px;
  border-radius: 4px;
}

.axis-name {
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.axis-value {
  margin-left: auto;
  font-family: monospace;
  font-weight: 600;
  min-width: 50px;
  text-align: right;
}

.reset-btn {
  padding: 2px 6px;
  font-size: 14px;
  background: transparent;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  cursor: pointer;
  color: var(--vp-c-text-2);
}

.reset-btn:hover {
  background: var(--vp-c-bg);
}

.axis-slider {
  display: flex;
  align-items: center;
  gap: 8px;
}

.axis-slider input[type="range"] {
  flex: 1;
}

.axis-min,
.axis-max {
  font-size: 11px;
  color: var(--vp-c-text-3);
  min-width: 40px;
}

.axis-min {
  text-align: right;
}

.axis-info {
  margin-top: 4px;
  font-size: 11px;
  color: var(--vp-c-text-3);
}

.preview-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-section label {
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
  justify-content: center;
}

.code-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.code-section label {
  font-weight: 600;
  font-size: 14px;
}

.code-block {
  padding: 12px;
  background: var(--vp-c-bg-soft);
  border-radius: 4px;
  overflow-x: auto;
  font-size: 13px;
}

.code-block code {
  font-family: var(--vp-font-family-mono);
}
</style>
