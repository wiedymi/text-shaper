<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'

const props = defineProps<{
  font: any
  fontName: string
}>()

const character = ref('A')
const fontSize = ref(32)
const spread = ref(8)
const zoom = ref(4)
const showColorized = ref(true)

const canvas = ref<HTMLCanvasElement | null>(null)
const sdfInfo = ref<{
  width: number
  height: number
  spread: number
} | null>(null)
const error = ref('')

async function renderSdfPreview() {
  if (!props.font || !canvas.value) {
    sdfInfo.value = null
    return
  }

  error.value = ''

  try {
    const { renderSdf, getGlyphPath } = await import('text-shaper')

    const codepoint = character.value.codePointAt(0) || 0
    const glyphId = props.font.glyphId(codepoint)

    if (glyphId === 0 && codepoint !== 0) {
      error.value = 'Character not found in font'
      sdfInfo.value = null
      return
    }

    // Get the glyph path
    const path = getGlyphPath(props.font, glyphId)
    if (!path) {
      error.value = 'Failed to get glyph path'
      sdfInfo.value = null
      return
    }

    // Calculate scale and bounds
    const scale = fontSize.value / props.font.unitsPerEm
    const bounds = getPathBounds(path, scale)

    if (!bounds) {
      error.value = 'Failed to get path bounds'
      sdfInfo.value = null
      return
    }

    const padding = spread.value
    const width = Math.ceil(bounds.maxX - bounds.minX) + padding * 2
    const height = Math.ceil(bounds.maxY - bounds.minY) + padding * 2

    if (width <= 0 || height <= 0) {
      error.value = 'Invalid glyph dimensions'
      sdfInfo.value = null
      return
    }

    const offsetX = -bounds.minX + padding
    const offsetY = -bounds.minY + padding

    // Render SDF
    const bitmap = renderSdf(path, {
      width,
      height,
      scale,
      offsetX,
      offsetY,
      flipY: true,
      spread: spread.value,
    })

    if (!bitmap || bitmap.width === 0 || bitmap.rows === 0) {
      error.value = 'Failed to render SDF (empty bitmap)'
      sdfInfo.value = null
      return
    }

    sdfInfo.value = {
      width: bitmap.width,
      height: bitmap.rows,
      spread: spread.value,
    }

    // Draw to canvas
    const ctx = canvas.value.getContext('2d')
    if (!ctx) return

    const displayWidth = bitmap.width * zoom.value
    const displayHeight = bitmap.rows * zoom.value

    canvas.value.width = displayWidth
    canvas.value.height = displayHeight

    // Clear
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    // Convert SDF to RGBA
    const rgba = sdfToRGBA(bitmap, showColorized.value)

    // Create ImageData
    const imageData = new ImageData(
      new Uint8ClampedArray(rgba),
      bitmap.width,
      bitmap.rows
    )

    // Draw at 1:1 scale first
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = bitmap.width
    tempCanvas.height = bitmap.rows
    const tempCtx = tempCanvas.getContext('2d')
    if (tempCtx) {
      tempCtx.putImageData(imageData, 0, 0)

      // Scale up with nearest neighbor (pixelated)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(tempCanvas, 0, 0, displayWidth, displayHeight)

      // Draw grid if zoomed enough
      if (zoom.value >= 4) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
        ctx.lineWidth = 1
        for (let x = 0; x <= bitmap.width; x++) {
          ctx.beginPath()
          ctx.moveTo(x * zoom.value, 0)
          ctx.lineTo(x * zoom.value, displayHeight)
          ctx.stroke()
        }
        for (let y = 0; y <= bitmap.rows; y++) {
          ctx.beginPath()
          ctx.moveTo(0, y * zoom.value)
          ctx.lineTo(displayWidth, y * zoom.value)
          ctx.stroke()
        }
      }
    }
  } catch (e) {
    console.error('SDF rendering error:', e)
    error.value = `Error: ${e}`
    sdfInfo.value = null
  }
}

// Simple bounds calculation for path
function getPathBounds(path: any, scale: number) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let currentX = 0
  let currentY = 0

  for (const cmd of path.commands) {
    switch (cmd.type) {
      case 'M':
      case 'L':
        currentX = cmd.x * scale
        currentY = cmd.y * scale
        minX = Math.min(minX, currentX)
        minY = Math.min(minY, currentY)
        maxX = Math.max(maxX, currentX)
        maxY = Math.max(maxY, currentY)
        break
      case 'Q':
        minX = Math.min(minX, cmd.x1 * scale, cmd.x * scale)
        minY = Math.min(minY, cmd.y1 * scale, cmd.y * scale)
        maxX = Math.max(maxX, cmd.x1 * scale, cmd.x * scale)
        maxY = Math.max(maxY, cmd.y1 * scale, cmd.y * scale)
        currentX = cmd.x * scale
        currentY = cmd.y * scale
        break
      case 'C':
        minX = Math.min(minX, cmd.x1 * scale, cmd.x2 * scale, cmd.x * scale)
        minY = Math.min(minY, cmd.y1 * scale, cmd.y2 * scale, cmd.y * scale)
        maxX = Math.max(maxX, cmd.x1 * scale, cmd.x2 * scale, cmd.x * scale)
        maxY = Math.max(maxY, cmd.y1 * scale, cmd.y2 * scale, cmd.y * scale)
        currentX = cmd.x * scale
        currentY = cmd.y * scale
        break
    }
  }

  if (minX === Infinity) return null

  return { minX, minY, maxX, maxY }
}

// Convert SDF bitmap to RGBA for visualization
function sdfToRGBA(bitmap: any, colorized: boolean): Uint8Array {
  const rgba = new Uint8Array(bitmap.width * bitmap.rows * 4)

  for (let i = 0; i < bitmap.buffer.length; i++) {
    const value = bitmap.buffer[i]
    const offset = i * 4

    if (colorized) {
      // Colorized visualization:
      // 0 (far outside) = blue
      // 128 (edge) = white
      // 255 (far inside) = red
      if (value < 128) {
        // Outside: blue to white
        const t = value / 128
        rgba[offset] = Math.round(t * 255)     // R
        rgba[offset + 1] = Math.round(t * 255) // G
        rgba[offset + 2] = 255                 // B
      } else {
        // Inside: white to red
        const t = (value - 128) / 127
        rgba[offset] = 255                     // R
        rgba[offset + 1] = Math.round((1 - t) * 255) // G
        rgba[offset + 2] = Math.round((1 - t) * 255) // B
      }
    } else {
      // Raw grayscale
      rgba[offset] = value
      rgba[offset + 1] = value
      rgba[offset + 2] = value
    }

    rgba[offset + 3] = 255 // Alpha
  }

  return rgba
}

watch([character, fontSize, spread, zoom, showColorized, () => props.font], renderSdfPreview)

onMounted(async () => {
  await nextTick()
  renderSdfPreview()
})
</script>

<template>
  <div class="sdf-preview">
    <div class="input-section">
      <div class="input-row">
        <label>Character</label>
        <input v-model="character" type="text" maxlength="2" placeholder="A" />
      </div>

      <div class="input-row">
        <label>Font Size: {{ fontSize }}px</label>
        <input v-model.number="fontSize" type="range" min="8" max="72" />
      </div>

      <div class="input-row">
        <label>Spread: {{ spread }}px</label>
        <input v-model.number="spread" type="range" min="1" max="16" />
      </div>

      <div class="input-row">
        <label>Zoom: {{ zoom }}x</label>
        <input v-model.number="zoom" type="range" min="1" max="10" />
      </div>

      <div class="input-row">
        <label class="checkbox-label">
          <input type="checkbox" v-model="showColorized" />
          <span>Colorized Visualization</span>
        </label>
      </div>
    </div>

    <div v-if="!props.font" class="no-font">
      Select a font above to preview SDF rendering.
    </div>

    <template v-else>
      <div v-if="error" class="error">{{ error }}</div>

      <div class="preview-section">
        <label>Signed Distance Field</label>
        <div class="canvas-container">
          <canvas ref="canvas"></canvas>
        </div>

        <div v-if="sdfInfo" class="info-grid">
          <div class="info-item">
            <span class="label">SDF Size</span>
            <span class="value">{{ sdfInfo.width }} x {{ sdfInfo.height }} px</span>
          </div>
          <div class="info-item">
            <span class="label">Spread</span>
            <span class="value">{{ sdfInfo.spread }} px</span>
          </div>
        </div>

        <div v-if="sdfInfo" class="sdf-info">
          <p v-if="showColorized">
            <strong>Colorized:</strong> Blue = outside, White = edge (128), Red = inside.
            Distance values are encoded in the color gradient.
          </p>
          <p v-else>
            <strong>Raw SDF:</strong> Grayscale values where 128 = edge, 0 = far outside, 255 = far inside.
            Each pixel stores the distance to the nearest outline edge.
          </p>
        </div>

        <div v-if="sdfInfo" class="sdf-description">
          <p>
            <strong>Signed Distance Field (SDF)</strong> encodes the distance to the nearest glyph outline edge.
            The spread parameter controls how far the distance field extends ({{ spread }}px in each direction).
            SDFs enable high-quality text rendering at any scale in GPU shaders.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sdf-preview {
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
  font-size: 24px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  max-width: 100px;
  text-align: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: normal !important;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.preview-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-section > label {
  font-weight: 600;
  font-size: 14px;
}

.canvas-container {
  padding: 24px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  display: flex;
  justify-content: center;
  overflow: auto;
}

.canvas-container canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.info-item {
  padding: 12px;
  background: var(--vp-c-bg-soft);
  border-radius: 4px;
}

.info-item .label {
  display: block;
  font-size: 12px;
  color: var(--vp-c-text-2);
  margin-bottom: 4px;
}

.info-item .value {
  font-family: monospace;
  font-size: 14px;
  font-weight: 600;
}

.sdf-info,
.sdf-description {
  padding: 12px;
  background: var(--vp-c-bg-soft);
  border-radius: 4px;
  font-size: 14px;
}

.sdf-info p,
.sdf-description p {
  margin: 0;
  color: var(--vp-c-text-2);
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
