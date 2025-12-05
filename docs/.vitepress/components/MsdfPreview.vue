<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'

const props = defineProps<{
  font: any
  fontName: string
}>()

const character = ref('A')
const fontSize = ref(48)
const spread = ref(6)
const zoom = ref(4)
const showMode = ref<'rgb' | 'median' | 'channels'>('rgb')

const canvas = ref<HTMLCanvasElement | null>(null)
const channelCanvases = ref<{
  r: HTMLCanvasElement | null,
  g: HTMLCanvasElement | null,
  b: HTMLCanvasElement | null
}>({ r: null, g: null, b: null })

const msdfInfo = ref<{
  width: number
  height: number
  spread: number
} | null>(null)
const error = ref('')

async function renderMsdfPreview() {
  if (!props.font || !canvas.value) {
    msdfInfo.value = null
    return
  }

  error.value = ''

  try {
    const { renderMsdf, getGlyphPath, median } = await import('text-shaper')

    const codepoint = character.value.codePointAt(0) || 0
    const glyphId = props.font.glyphId(codepoint)

    if (glyphId === 0 && codepoint !== 0) {
      error.value = 'Character not found in font'
      msdfInfo.value = null
      return
    }

    // Get the glyph path (in font units)
    const path = getGlyphPath(props.font, glyphId)
    if (!path || !path.bounds) {
      error.value = 'Failed to get glyph path'
      msdfInfo.value = null
      return
    }

    // Calculate scale (font units to pixels)
    const scale = fontSize.value / props.font.unitsPerEm

    // Get bounds in font units and scale them
    const bounds = path.bounds
    const scaledMinX = bounds.xMin * scale
    const scaledMaxX = bounds.xMax * scale
    const scaledMinY = bounds.yMin * scale
    const scaledMaxY = bounds.yMax * scale

    const padding = spread.value
    const width = Math.ceil(scaledMaxX - scaledMinX) + padding * 2
    const height = Math.ceil(scaledMaxY - scaledMinY) + padding * 2

    if (width <= 0 || height <= 0) {
      error.value = 'Invalid glyph dimensions'
      msdfInfo.value = null
      return
    }

    const offsetX = -scaledMinX + padding
    const offsetY = padding + scaledMaxY

    // Render MSDF
    const bitmap = renderMsdf(path, {
      width,
      height,
      scale,
      offsetX,
      offsetY,
      flipY: true,
      spread: spread.value,
    })

    if (!bitmap || bitmap.width === 0 || bitmap.rows === 0) {
      error.value = 'Failed to render MSDF (empty bitmap)'
      msdfInfo.value = null
      return
    }

    msdfInfo.value = {
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

    // Convert MSDF to RGBA based on display mode
    const rgba = msdfToRGBA(bitmap, showMode.value, median)

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

    // Draw channel previews if in channels mode
    if (showMode.value === 'channels') {
      drawChannels(bitmap, zoom.value)
    }
  } catch (e) {
    console.error('MSDF rendering error:', e)
    error.value = `Error: ${e}`
    msdfInfo.value = null
  }
}

function drawChannels(bitmap: any, zoomLevel: number) {
  const channels = [
    { canvas: channelCanvases.value.r, idx: 0, color: [255, 0, 0] },
    { canvas: channelCanvases.value.g, idx: 1, color: [0, 255, 0] },
    { canvas: channelCanvases.value.b, idx: 2, color: [0, 0, 255] },
  ]

  for (const { canvas: cvs, idx, color } of channels) {
    if (!cvs) continue

    const ctx = cvs.getContext('2d')
    if (!ctx) continue

    const displayWidth = bitmap.width * zoomLevel
    const displayHeight = bitmap.rows * zoomLevel

    cvs.width = displayWidth
    cvs.height = displayHeight

    const rgba = new Uint8Array(bitmap.width * bitmap.rows * 4)
    for (let y = 0; y < bitmap.rows; y++) {
      for (let x = 0; x < bitmap.width; x++) {
        const srcIdx = y * bitmap.pitch + x * 3 + idx
        const value = bitmap.buffer[srcIdx]
        const dstIdx = (y * bitmap.width + x) * 4

        // Show as grayscale with color tint
        rgba[dstIdx] = value
        rgba[dstIdx + 1] = value
        rgba[dstIdx + 2] = value
        rgba[dstIdx + 3] = 255
      }
    }

    const imageData = new ImageData(
      new Uint8ClampedArray(rgba),
      bitmap.width,
      bitmap.rows
    )

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = bitmap.width
    tempCanvas.height = bitmap.rows
    const tempCtx = tempCanvas.getContext('2d')
    if (tempCtx) {
      tempCtx.putImageData(imageData, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(tempCanvas, 0, 0, displayWidth, displayHeight)
    }
  }
}

// Convert MSDF bitmap to RGBA for visualization
function msdfToRGBA(bitmap: any, mode: string, medianFn: (a: number, b: number, c: number) => number): Uint8Array {
  const rgba = new Uint8Array(bitmap.width * bitmap.rows * 4)

  for (let y = 0; y < bitmap.rows; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      const srcIdx = y * bitmap.pitch + x * 3
      const r = bitmap.buffer[srcIdx]
      const g = bitmap.buffer[srcIdx + 1]
      const b = bitmap.buffer[srcIdx + 2]
      const dstIdx = (y * bitmap.width + x) * 4

      if (mode === 'rgb') {
        // Show raw RGB channels
        rgba[dstIdx] = r
        rgba[dstIdx + 1] = g
        rgba[dstIdx + 2] = b
      } else if (mode === 'median') {
        // Show median value (reconstructed SDF)
        const med = medianFn(r, g, b)
        rgba[dstIdx] = med
        rgba[dstIdx + 1] = med
        rgba[dstIdx + 2] = med
      } else {
        // channels mode - show RGB
        rgba[dstIdx] = r
        rgba[dstIdx + 1] = g
        rgba[dstIdx + 2] = b
      }

      rgba[dstIdx + 3] = 255
    }
  }

  return rgba
}

watch(
  [character, fontSize, spread, zoom, showMode],
  () => renderMsdfPreview()
)

watch(
  () => props.font,
  () => nextTick(() => renderMsdfPreview())
)

onMounted(() => {
  renderMsdfPreview()
})
</script>

<template>
  <div class="msdf-preview">
    <div class="input-section">
      <div class="input-row">
        <label>Character</label>
        <input v-model="character" type="text" maxlength="2" placeholder="A" />
      </div>

      <div class="input-row">
        <label>Font Size: {{ fontSize }}px</label>
        <input v-model.number="fontSize" type="range" min="16" max="96" />
      </div>

      <div class="input-row">
        <label>Spread: {{ spread }}px</label>
        <input v-model.number="spread" type="range" min="2" max="16" />
      </div>

      <div class="input-row">
        <label>Zoom: {{ zoom }}x</label>
        <input v-model.number="zoom" type="range" min="1" max="10" />
      </div>

      <div class="input-row">
        <label>Display Mode</label>
        <div class="mode-buttons">
          <button :class="{ active: showMode === 'rgb' }" @click="showMode = 'rgb'">RGB</button>
          <button :class="{ active: showMode === 'median' }" @click="showMode = 'median'">Median</button>
          <button :class="{ active: showMode === 'channels' }" @click="showMode = 'channels'">Channels</button>
        </div>
      </div>
    </div>

    <div v-if="!props.font" class="no-font">
      Select a font above to preview MSDF rendering.
    </div>

    <template v-else>
      <div v-if="error" class="error">{{ error }}</div>

      <div class="preview-section">
        <label>Multi-channel Signed Distance Field</label>
        <div class="canvas-container">
          <canvas ref="canvas"></canvas>
        </div>

        <div v-if="showMode === 'channels' && msdfInfo" class="channel-previews">
          <div class="channel-preview">
            <span class="channel-label red">Red Channel</span>
            <canvas ref="el => channelCanvases.r = el"></canvas>
          </div>
          <div class="channel-preview">
            <span class="channel-label green">Green Channel</span>
            <canvas ref="el => channelCanvases.g = el"></canvas>
          </div>
          <div class="channel-preview">
            <span class="channel-label blue">Blue Channel</span>
            <canvas ref="el => channelCanvases.b = el"></canvas>
          </div>
        </div>

        <div v-if="msdfInfo" class="info-grid">
          <div class="info-item">
            <span class="label">MSDF Size</span>
            <span class="value">{{ msdfInfo.width }} x {{ msdfInfo.height }} px</span>
          </div>
          <div class="info-item">
            <span class="label">Spread</span>
            <span class="value">{{ msdfInfo.spread }} px</span>
          </div>
          <div class="info-item">
            <span class="label">Channels</span>
            <span class="value">RGB (3)</span>
          </div>
        </div>

        <div v-if="msdfInfo" class="msdf-info">
          <p v-if="showMode === 'rgb'">
            <strong>RGB Mode:</strong> Each channel (R, G, B) contains distance to differently-colored edge segments.
            This preserves sharp corners that single-channel SDF loses.
          </p>
          <p v-else-if="showMode === 'median'">
            <strong>Median Mode:</strong> Shows median(R, G, B) which reconstructs the signed distance field.
            Use this in shaders: <code>float sd = median(texture.r, texture.g, texture.b);</code>
          </p>
          <p v-else>
            <strong>Channels Mode:</strong> Individual R, G, B channels shown separately.
            Notice how different edges have different dominant channels at corners.
          </p>
        </div>

        <div v-if="msdfInfo" class="msdf-description">
          <p>
            <strong>MSDF (Multi-channel SDF)</strong> uses 3 channels to encode distance information,
            preserving sharp corners that standard SDF loses. Each edge in the glyph is assigned a color,
            and the shader uses <code>median(r, g, b)</code> to reconstruct crisp outlines at any scale.
            One small MSDF texture (e.g., 32x32) can render perfectly from 8px to 200px+.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.msdf-preview {
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

.mode-buttons {
  display: flex;
  gap: 8px;
}

.mode-buttons button {
  padding: 8px 16px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.mode-buttons button:hover {
  background: var(--vp-c-bg-soft);
}

.mode-buttons button.active {
  background: var(--vp-c-brand);
  color: white;
  border-color: var(--vp-c-brand);
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

.channel-previews {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.channel-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
}

.channel-label {
  font-weight: 600;
  font-size: 12px;
}

.channel-label.red { color: #e53935; }
.channel-label.green { color: #43a047; }
.channel-label.blue { color: #1e88e5; }

.channel-preview canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  max-width: 100%;
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

.msdf-info,
.msdf-description {
  padding: 12px;
  background: var(--vp-c-bg-soft);
  border-radius: 4px;
  font-size: 14px;
}

.msdf-info p,
.msdf-description p {
  margin: 0;
  color: var(--vp-c-text-2);
}

.msdf-info code,
.msdf-description code {
  background: var(--vp-c-bg);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
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
