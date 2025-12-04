<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'

const props = defineProps<{
  font: any
  fontName: string
}>()

const character = ref('A')
const fontSize = ref(32)
const pixelMode = ref<'gray' | 'mono' | 'lcd'>('gray')
const hinting = ref(true)
const zoom = ref(4)

const canvas = ref<HTMLCanvasElement | null>(null)
const rasterInfo = ref<{
  width: number
  height: number
  bearingX: number
  bearingY: number
  advance: number
} | null>(null)
const error = ref('')

async function rasterize() {
  if (!props.font || !canvas.value) {
    rasterInfo.value = null
    return
  }

  error.value = ''

  try {
    const { rasterizeGlyph, PixelMode, bitmapToRGBA } = await import('text-shaper')

    const codepoint = character.value.codePointAt(0) || 0
    const glyphId = props.font.glyphId(codepoint)

    if (glyphId === 0 && codepoint !== 0) {
      error.value = 'Character not found in font'
      rasterInfo.value = null
      return
    }

    // Map pixel mode string to enum
    let mode = PixelMode.Gray
    if (pixelMode.value === 'mono') mode = PixelMode.Mono
    else if (pixelMode.value === 'lcd') mode = PixelMode.LCD

    // CFF fonts don't have TrueType hinting, so disable it
    const useHinting = hinting.value && props.font.hasHinting
    const result = rasterizeGlyph(props.font, glyphId, fontSize.value, {
      pixelMode: mode,
      hinting: useHinting,
      padding: 2,
    })

    if (!result || !result.bitmap || result.bitmap.width === 0 || result.bitmap.rows === 0) {
      error.value = 'Failed to rasterize glyph (empty bitmap)'
      rasterInfo.value = null
      return
    }

    // Get advance width from font
    const advance = Math.round(props.font.advanceWidth(glyphId) * fontSize.value / props.font.unitsPerEm)

    rasterInfo.value = {
      width: result.bitmap.width,
      height: result.bitmap.rows,
      bearingX: result.bearingX,
      bearingY: result.bearingY,
      advance,
    }

    // Draw to canvas
    const ctx = canvas.value.getContext('2d')
    if (!ctx) return

    // bitmap.width is always the pixel width (not subpixel count)
    const bitmapWidth = result.bitmap.width
    const bitmapHeight = result.bitmap.rows
    const displayWidth = bitmapWidth * zoom.value
    const displayHeight = bitmapHeight * zoom.value

    canvas.value.width = displayWidth
    canvas.value.height = displayHeight

    // Clear
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    // Convert bitmap to RGBA
    const rgba = bitmapToRGBA(result.bitmap)

    // Create ImageData with correct dimensions
    const imageData = new ImageData(
      new Uint8ClampedArray(rgba),
      bitmapWidth,
      bitmapHeight
    )

    // Draw at 1:1 scale first
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = bitmapWidth
    tempCanvas.height = bitmapHeight
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
        for (let x = 0; x <= bitmapWidth; x++) {
          ctx.beginPath()
          ctx.moveTo(x * zoom.value, 0)
          ctx.lineTo(x * zoom.value, displayHeight)
          ctx.stroke()
        }
        for (let y = 0; y <= bitmapHeight; y++) {
          ctx.beginPath()
          ctx.moveTo(0, y * zoom.value)
          ctx.lineTo(displayWidth, y * zoom.value)
          ctx.stroke()
        }
      }
    }
  } catch (e) {
    console.error('Rasterization error:', e)
    error.value = `Error: ${e}`
    rasterInfo.value = null
  }
}

watch([character, fontSize, pixelMode, hinting, zoom, () => props.font], rasterize)

onMounted(async () => {
  await nextTick()
  rasterize()
})
</script>

<template>
  <div class="raster-preview">
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
        <label>Zoom: {{ zoom }}x</label>
        <input v-model.number="zoom" type="range" min="1" max="10" />
      </div>

      <div class="input-row">
        <label>Pixel Mode</label>
        <div class="mode-toggle">
          <button :class="{ active: pixelMode === 'gray' }" @click="pixelMode = 'gray'">
            Gray
          </button>
          <button :class="{ active: pixelMode === 'mono' }" @click="pixelMode = 'mono'">
            Mono
          </button>
          <button :class="{ active: pixelMode === 'lcd' }" @click="pixelMode = 'lcd'">
            LCD
          </button>
        </div>
      </div>

      <div class="input-row">
        <label class="checkbox-label">
          <input type="checkbox" v-model="hinting" />
          <span>TrueType Hinting</span>
        </label>
      </div>
    </div>

    <div v-if="!props.font" class="no-font">
      Select a font above to preview rasterization.
    </div>

    <template v-else>
      <div v-if="error" class="error">{{ error }}</div>

      <div class="preview-section">
        <label>Rasterized Bitmap</label>
        <div class="canvas-container">
          <canvas ref="canvas"></canvas>
        </div>

        <div v-if="rasterInfo" class="info-grid">
          <div class="info-item">
            <span class="label">Bitmap Size</span>
            <span class="value">{{ rasterInfo.width }} x {{ rasterInfo.height }} px</span>
          </div>
          <div class="info-item">
            <span class="label">Bearing X</span>
            <span class="value">{{ rasterInfo.bearingX }}</span>
          </div>
          <div class="info-item">
            <span class="label">Bearing Y</span>
            <span class="value">{{ rasterInfo.bearingY }}</span>
          </div>
          <div class="info-item">
            <span class="label">Advance</span>
            <span class="value">{{ rasterInfo.advance }}</span>
          </div>
        </div>

        <div v-if="rasterInfo" class="mode-info">
          <p v-if="pixelMode === 'gray'">
            <strong>Gray:</strong> 8-bit anti-aliased grayscale. Best for general use.
          </p>
          <p v-else-if="pixelMode === 'mono'">
            <strong>Mono:</strong> 1-bit black and white. No anti-aliasing.
          </p>
          <p v-else-if="pixelMode === 'lcd'">
            <strong>LCD:</strong> Subpixel rendering for LCD displays. Uses RGB channels for horizontal subpixels.
          </p>
        </div>

        <div v-if="rasterInfo" class="hinting-info">
          <template v-if="props.font.hasHinting">
            <p v-if="hinting">
              Hinting is <strong>enabled</strong>. Glyph outlines are adjusted to align with the pixel grid for sharper rendering at small sizes.
            </p>
            <p v-else>
              Hinting is <strong>disabled</strong>. Outlines are rendered without grid-fitting adjustments.
            </p>
          </template>
          <p v-else>This font does not contain TrueType hinting instructions.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.raster-preview {
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

.mode-toggle button:not(:first-child):not(:last-child) {
  border-left: none;
}

.mode-toggle button.active {
  background: var(--vp-c-brand);
  color: white;
  border-color: var(--vp-c-brand);
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

.mode-info,
.hinting-info {
  padding: 12px;
  background: var(--vp-c-bg-soft);
  border-radius: 4px;
  font-size: 14px;
}

.mode-info p,
.hinting-info p {
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
