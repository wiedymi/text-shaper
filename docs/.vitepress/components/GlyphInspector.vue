<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  font: any
  fontName: string
}>()

const input = ref('A')
const inputMode = ref<'char' | 'glyphId'>('char')
const scale = ref(200)

const glyphId = computed(() => {
  if (!props.font) return 0
  if (inputMode.value === 'glyphId') {
    return parseInt(input.value) || 0
  }
  const codepoint = input.value.codePointAt(0) || 0
  return props.font.glyphId(codepoint)
})

const glyphInfo = ref<{
  glyphId: number
  advanceWidth: number
  lsb: number
  bounds: { xMin: number; yMin: number; xMax: number; yMax: number } | null
  contourCount: number
} | null>(null)

const svgPath = ref('')
const pathData = ref<any[]>([])
const svgScale = 10

async function inspectGlyph() {
  if (!props.font) {
    glyphInfo.value = null
    svgPath.value = ''
    pathData.value = []
    return
  }

  try {
    const { getGlyphPath, pathToSVG } = await import('text-shaper')

    const gid = glyphId.value
    const path = getGlyphPath(props.font, gid)

    if (!path) {
      glyphInfo.value = null
      svgPath.value = ''
      pathData.value = []
      return
    }

    glyphInfo.value = {
      glyphId: gid,
      advanceWidth: props.font.advanceWidth(gid),
      lsb: props.font.leftSideBearing(gid),
      bounds: path.bounds,
      contourCount: countContours(path.commands),
    }

    pathData.value = path.commands

    // Generate SVG with viewBox based on bounds
    // Use font-native coordinates (Y-up) and flip via transform
    const bounds = path.bounds || { xMin: 0, yMin: -props.font.descender, xMax: glyphInfo.value.advanceWidth, yMax: props.font.ascender }
    const padding = 50
    const width = bounds.xMax - bounds.xMin + padding * 2
    const height = bounds.yMax - bounds.yMin + padding * 2

    // Don't flip Y in pathToSVG - we'll use SVG transform instead
    const pathStr = pathToSVG(path, { flipY: false })

    // ViewBox in font coordinates (Y-up), then flip the entire SVG
    const viewBoxMinX = (bounds.xMin - padding) * svgScale
    const viewBoxMinY = (bounds.yMin - padding) * svgScale
    const viewBoxWidth = width * svgScale
    const viewBoxHeight = height * svgScale

    svgPath.value = `
      <svg viewBox="${viewBoxMinX} ${viewBoxMinY} ${viewBoxWidth} ${viewBoxHeight}" width="${scale.value}" height="${scale.value * (height / width)}" style="transform: scaleY(-1)">
        <!-- Grid - baseline at y=0 -->
        <line x1="${(bounds.xMin - padding) * svgScale}" y1="0" x2="${(bounds.xMax + padding) * svgScale}" y2="0" stroke="#888" stroke-width="1" stroke-dasharray="4"/>
        <!-- Y-axis at x=0 -->
        <line x1="0" y1="${(bounds.yMin - padding) * svgScale}" x2="0" y2="${(bounds.yMax + padding) * svgScale}" stroke="#888" stroke-width="1" stroke-dasharray="4"/>
        <!-- Advance width marker -->
        <line x1="${glyphInfo.value.advanceWidth * svgScale}" y1="${(bounds.yMin - padding) * svgScale}" x2="${glyphInfo.value.advanceWidth * svgScale}" y2="${(bounds.yMax + padding) * svgScale}" stroke="#4a9eff" stroke-width="1" stroke-dasharray="2"/>
        <!-- LSB marker -->
        <line x1="${glyphInfo.value.lsb * svgScale}" y1="${(bounds.yMin - padding) * svgScale}" x2="${glyphInfo.value.lsb * svgScale}" y2="${(bounds.yMax + padding) * svgScale}" stroke="#ff6b6b" stroke-width="1" stroke-dasharray="2"/>
        <!-- Bounding box -->
        <rect x="${bounds.xMin * svgScale}" y="${bounds.yMin * svgScale}" width="${(bounds.xMax - bounds.xMin) * svgScale}" height="${(bounds.yMax - bounds.yMin) * svgScale}" fill="none" stroke="#ccc" stroke-width="1"/>
        <!-- Glyph path in font coordinates -->
        <path d="${pathStr}" fill="currentColor"/>
      </svg>
    `
  } catch (e) {
    console.error('Error inspecting glyph:', e)
    glyphInfo.value = null
    svgPath.value = ''
    pathData.value = []
  }
}

function countContours(commands: any[]): number {
  return commands.filter(cmd => cmd.type === 'Z').length
}

watch([input, inputMode, scale, () => props.font], inspectGlyph, { immediate: true })
</script>

<template>
  <div class="glyph-inspector">
    <div class="input-section">
      <div class="input-row">
        <label>Input Mode</label>
        <div class="mode-toggle">
          <button :class="{ active: inputMode === 'char' }" @click="inputMode = 'char'">
            Character
          </button>
          <button :class="{ active: inputMode === 'glyphId' }" @click="inputMode = 'glyphId'">
            Glyph ID
          </button>
        </div>
      </div>

      <div class="input-row">
        <label>{{ inputMode === 'char' ? 'Character' : 'Glyph ID' }}</label>
        <input
          v-model="input"
          :type="inputMode === 'glyphId' ? 'number' : 'text'"
          :placeholder="inputMode === 'char' ? 'Enter a character' : 'Enter glyph ID'"
          :maxlength="inputMode === 'char' ? 2 : undefined"
        />
      </div>

      <div class="input-row">
        <label>Preview Size: {{ scale }}px</label>
        <input v-model.number="scale" type="range" min="100" max="400" />
      </div>
    </div>

    <div v-if="!props.font" class="no-font">
      Select a font above to inspect glyphs.
    </div>

    <template v-else-if="glyphInfo">
      <div class="preview-section">
        <label>Glyph Preview</label>
        <div class="svg-preview" v-html="svgPath"></div>
        <div class="legend">
          <span class="legend-item"><span class="line baseline"></span> Baseline / Y-axis</span>
          <span class="legend-item"><span class="line advance"></span> Advance Width</span>
          <span class="legend-item"><span class="line lsb"></span> Left Side Bearing</span>
        </div>
      </div>

      <div class="info-section">
        <label>Glyph Metrics</label>
        <div class="metrics-grid">
          <div class="metric">
            <span class="label">Glyph ID</span>
            <span class="value">{{ glyphInfo.glyphId }}</span>
          </div>
          <div class="metric">
            <span class="label">Advance Width</span>
            <span class="value">{{ glyphInfo.advanceWidth }} units</span>
          </div>
          <div class="metric">
            <span class="label">Left Side Bearing</span>
            <span class="value">{{ glyphInfo.lsb }} units</span>
          </div>
          <div class="metric">
            <span class="label">Contours</span>
            <span class="value">{{ glyphInfo.contourCount }}</span>
          </div>
          <div class="metric" v-if="glyphInfo.bounds">
            <span class="label">Bounding Box</span>
            <span class="value">
              ({{ glyphInfo.bounds.xMin }}, {{ glyphInfo.bounds.yMin }}) -
              ({{ glyphInfo.bounds.xMax }}, {{ glyphInfo.bounds.yMax }})
            </span>
          </div>
          <div class="metric" v-if="glyphInfo.bounds">
            <span class="label">Glyph Size</span>
            <span class="value">
              {{ glyphInfo.bounds.xMax - glyphInfo.bounds.xMin }} x
              {{ glyphInfo.bounds.yMax - glyphInfo.bounds.yMin }} units
            </span>
          </div>
        </div>
      </div>

      <div class="path-section">
        <label>Path Commands ({{ pathData.length }})</label>
        <div class="path-list">
          <div v-for="(cmd, i) in pathData.slice(0, 50)" :key="i" class="path-cmd">
            <span class="cmd-type">{{ cmd.type }}</span>
            <span class="cmd-args" v-if="cmd.type === 'M' || cmd.type === 'L'">
              {{ cmd.x.toFixed(0) }}, {{ cmd.y.toFixed(0) }}
            </span>
            <span class="cmd-args" v-else-if="cmd.type === 'Q'">
              {{ cmd.x1.toFixed(0) }}, {{ cmd.y1.toFixed(0) }} → {{ cmd.x.toFixed(0) }}, {{ cmd.y.toFixed(0) }}
            </span>
            <span class="cmd-args" v-else-if="cmd.type === 'C'">
              {{ cmd.x1.toFixed(0) }}, {{ cmd.y1.toFixed(0) }} / {{ cmd.x2.toFixed(0) }}, {{ cmd.y2.toFixed(0) }} → {{ cmd.x.toFixed(0) }}, {{ cmd.y.toFixed(0) }}
            </span>
          </div>
          <div v-if="pathData.length > 50" class="path-more">
            ... and {{ pathData.length - 50 }} more commands
          </div>
        </div>
      </div>
    </template>

    <div v-else class="no-glyph">
      No glyph found for the given input.
    </div>
  </div>
</template>

<style scoped>
.glyph-inspector {
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

.input-row input[type="text"],
.input-row input[type="number"] {
  padding: 10px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  font-size: 18px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  max-width: 200px;
}

.mode-toggle {
  display: flex;
  gap: 0;
}

.mode-toggle button {
  padding: 8px 16px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
  font-size: 14px;
}

.mode-toggle button:first-child {
  border-radius: 4px 0 0 4px;
}

.mode-toggle button:last-child {
  border-radius: 0 4px 4px 0;
  border-left: none;
}

.mode-toggle button.active {
  background: var(--vp-c-brand);
  color: white;
  border-color: var(--vp-c-brand);
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
  display: flex;
  justify-content: center;
  overflow: auto;
}

.legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend .line {
  display: inline-block;
  width: 20px;
  height: 2px;
}

.legend .line.baseline {
  background: #888;
}

.legend .line.advance {
  background: #4a9eff;
}

.legend .line.lsb {
  background: #ff6b6b;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-section label {
  font-weight: 600;
  font-size: 14px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.metric {
  padding: 12px;
  background: var(--vp-c-bg-soft);
  border-radius: 4px;
}

.metric .label {
  display: block;
  font-size: 12px;
  color: var(--vp-c-text-2);
  margin-bottom: 4px;
}

.metric .value {
  font-family: monospace;
  font-size: 14px;
  font-weight: 600;
}

.path-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.path-section label {
  font-weight: 600;
  font-size: 14px;
}

.path-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  padding: 8px;
  background: var(--vp-c-bg-soft);
}

.path-cmd {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  font-family: monospace;
}

.cmd-type {
  display: inline-block;
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  background: var(--vp-c-brand-soft);
  border-radius: 4px;
  font-weight: 700;
}

.cmd-args {
  color: var(--vp-c-text-2);
}

.path-more {
  padding: 8px;
  text-align: center;
  color: var(--vp-c-text-3);
  font-size: 12px;
}

.no-font,
.no-glyph {
  padding: 24px;
  text-align: center;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
}
</style>
