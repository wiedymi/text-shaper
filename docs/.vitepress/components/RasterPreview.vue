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
const displayMode = ref<'pixels' | 'smooth'>('pixels')
const supersampling = ref<1 | 2>(1)
const gammaCorrection = ref(true)
const dpr = ref(1)

const canvas = ref<HTMLCanvasElement | null>(null)
const rasterInfo = ref<{
  width: number
  height: number
  bearingX: number
  bearingY: number
  advance: number
  renderSize: number
} | null>(null)
const error = ref('')

async function rasterize() {
  if (!props.font || !canvas.value) {
    rasterInfo.value = null
    return
  }

  error.value = ''

  try {
    const { rasterizeGlyph, PixelMode, bitmapToRGBA, resizeBitmapBilinear } = await import('text-shaper')

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

    const currentDpr = dpr.value
    const isSmooth = displayMode.value === 'smooth'
    const ssaa = supersampling.value

    // In smooth mode: render at final display size (fontSize * zoom * dpr * supersampling)
    // In pixels mode: render at fontSize, then zoom up with nearest-neighbor
    const renderSize = isSmooth
      ? fontSize.value * zoom.value * currentDpr * ssaa
      : fontSize.value

    const result = rasterizeGlyph(props.font, glyphId, renderSize, {
      pixelMode: mode,
      hinting: useHinting,
      padding: 2 * (isSmooth ? ssaa : 1),
    })

    if (!result || !result.bitmap || result.bitmap.width === 0 || result.bitmap.rows === 0) {
      error.value = 'Failed to rasterize glyph (empty bitmap)'
      rasterInfo.value = null
      return
    }

    // Downsample if supersampling in smooth mode
    let finalBitmap = result.bitmap
    if (isSmooth && ssaa > 1) {
      const targetWidth = Math.max(1, Math.round(result.bitmap.width / ssaa))
      const targetHeight = Math.max(1, Math.round(result.bitmap.rows / ssaa))
      finalBitmap = resizeBitmapBilinear(result.bitmap, targetWidth, targetHeight)
    }

    // Get advance width from font
    const advance = Math.round(props.font.advanceWidth(glyphId) * fontSize.value / props.font.unitsPerEm)

    // Report the logical bitmap size (at fontSize, not zoomed)
    const logicalScale = isSmooth ? (zoom.value * currentDpr) : 1
    rasterInfo.value = {
      width: Math.round(finalBitmap.width / logicalScale),
      height: Math.round(finalBitmap.rows / logicalScale),
      bearingX: Math.round(result.bearingX / logicalScale),
      bearingY: Math.round(result.bearingY / logicalScale),
      advance,
      renderSize: Math.round(renderSize),
    }

    // Draw to canvas
    const ctx = canvas.value.getContext('2d')
    if (!ctx) return

    const bitmapWidth = finalBitmap.width
    const bitmapHeight = finalBitmap.rows

    if (isSmooth) {
      // Smooth mode: canvas matches bitmap size, CSS scales down
      // This gives us crisp HiDPI rendering
      canvas.value.width = bitmapWidth
      canvas.value.height = bitmapHeight
      canvas.value.style.width = `${bitmapWidth / currentDpr}px`
      canvas.value.style.height = `${bitmapHeight / currentDpr}px`
    } else {
      // Pixels mode: zoom up the small bitmap
      const displayWidth = bitmapWidth * zoom.value
      const displayHeight = bitmapHeight * zoom.value
      canvas.value.width = displayWidth
      canvas.value.height = displayHeight
      canvas.value.style.width = ''
      canvas.value.style.height = ''
    }

    // Clear
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.value.width, canvas.value.height)

    // Convert bitmap to RGBA with optional gamma correction
    let rgba = bitmapToRGBA(finalBitmap)

    // Apply gamma correction for smoother perceived anti-aliasing
    // Without correction, gray values appear too dark, making edges look harsh
    if (isSmooth && gammaCorrection.value && pixelMode.value === 'gray') {
      // Gamma 1.8 lightens mid-tones for smoother edges
      const gamma = 1.8

      // Create new array since bitmapToRGBA returns Uint8Array
      const corrected = new Uint8Array(rgba.length)
      for (let i = 0; i < rgba.length; i += 4) {
        // rgba[i] is the display value (255=white, 0=black for text)
        const normalized = rgba[i] / 255
        // Apply gamma curve - this lightens mid-tones
        const value = Math.round(Math.pow(normalized, 1 / gamma) * 255)

        corrected[i] = value
        corrected[i + 1] = value
        corrected[i + 2] = value
        corrected[i + 3] = rgba[i + 3]
      }
      rgba = corrected
    }

    // Create ImageData
    const imageData = new ImageData(
      new Uint8ClampedArray(rgba),
      bitmapWidth,
      bitmapHeight
    )

    if (isSmooth) {
      // Smooth mode: draw directly at 1:1
      ctx.putImageData(imageData, 0, 0)
    } else {
      // Pixels mode: draw to temp canvas, then scale up
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = bitmapWidth
      tempCanvas.height = bitmapHeight
      const tempCtx = tempCanvas.getContext('2d')
      if (tempCtx) {
        tempCtx.putImageData(imageData, 0, 0)

        // Scale up with nearest neighbor
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(tempCanvas, 0, 0, canvas.value.width, canvas.value.height)

        // Draw grid if zoomed enough
        if (zoom.value >= 4) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
          ctx.lineWidth = 1
          for (let x = 0; x <= bitmapWidth; x++) {
            ctx.beginPath()
            ctx.moveTo(x * zoom.value, 0)
            ctx.lineTo(x * zoom.value, canvas.value.height)
            ctx.stroke()
          }
          for (let y = 0; y <= bitmapHeight; y++) {
            ctx.beginPath()
            ctx.moveTo(0, y * zoom.value)
            ctx.lineTo(canvas.value.width, y * zoom.value)
            ctx.stroke()
          }
        }
      }
    }
  } catch (e) {
    console.error('Rasterization error:', e)
    error.value = `Error: ${e}`
    rasterInfo.value = null
  }
}

watch(
  [character, fontSize, pixelMode, hinting, zoom, displayMode, supersampling, gammaCorrection],
  () => rasterize()
)

watch(
  () => props.font,
  () => nextTick(() => rasterize())
)

onMounted(() => {
  dpr.value = window.devicePixelRatio || 1
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

      <div class="input-row">
        <label>Display Mode</label>
        <div class="mode-toggle">
          <button :class="{ active: displayMode === 'pixels' }" @click="displayMode = 'pixels'">
            Pixels
          </button>
          <button :class="{ active: displayMode === 'smooth' }" @click="displayMode = 'smooth'">
            Smooth
          </button>
        </div>
      </div>

      <div class="input-row" v-if="displayMode === 'smooth'">
        <label class="checkbox-label">
          <input type="checkbox" :checked="supersampling === 2" @change="supersampling = ($event.target as HTMLInputElement).checked ? 2 : 1" />
          <span>2x Supersampling</span>
        </label>
      </div>

      <div class="input-row" v-if="displayMode === 'smooth'">
        <label class="checkbox-label">
          <input type="checkbox" v-model="gammaCorrection" />
          <span>Gamma Correction</span>
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
          <canvas ref="canvas" :class="{ pixelated: displayMode === 'pixels' }"></canvas>
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

        <div v-if="rasterInfo" class="mode-info">
          <p v-if="displayMode === 'pixels'">
            <strong>Pixels:</strong> Rasterized at {{ fontSize }}px, zoomed {{ zoom }}x with nearest-neighbor for pixel inspection.
          </p>
          <p v-else>
            <strong>Smooth:</strong> Rasterized at {{ rasterInfo.renderSize }}px ({{ fontSize }}px × {{ zoom }}x × {{ dpr }}dpr<span v-if="supersampling > 1"> × {{ supersampling }}ssaa</span>) for crisp HiDPI display.<span v-if="supersampling > 1"> Downsampled with bilinear filtering for smoother edges.</span>
          </p>
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

.canvas-container canvas.pixelated {
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
