<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'

const props = defineProps<{
	font: any
	fontName: string
}>()

const character = ref('A')
const fontSize = ref(48)
const effectType = ref<'blur' | 'gradient' | 'both'>('blur')
const zoom = ref(2)

// Blur controls
const blurRadius = ref(4)
const blurRadiusY = ref(4)
const blurType = ref<'gaussian' | 'box' | 'cascade' | 'adaptive'>('gaussian')
const asymmetricBlur = ref(false)

// Gradient controls
const gradientType = ref<'linear' | 'radial'>('linear')
const startColor = ref('#3b82f6') // blue
const endColor = ref('#8b5cf6') // purple
const gradientAngle = ref(45)

const canvas = ref<HTMLCanvasElement | null>(null)
const error = ref('')
const bitmapInfo = ref<{
	width: number
	height: number
	bearingX: number
	bearingY: number
} | null>(null)

// Color presets
const colorPresets = [
	{ name: 'Blue → Purple', start: '#3b82f6', end: '#8b5cf6' },
	{ name: 'Red → Orange', start: '#ef4444', end: '#f97316' },
	{ name: 'Green → Teal', start: '#10b981', end: '#14b8a6' },
	{ name: 'Pink → Yellow', start: '#ec4899', end: '#eab308' },
	{ name: 'Black → White', start: '#000000', end: '#ffffff' },
]

// Parse hex color to RGBA tuple
function parseColor(hex: string): [number, number, number, number] {
	const r = parseInt(hex.slice(1, 3), 16)
	const g = parseInt(hex.slice(3, 5), 16)
	const b = parseInt(hex.slice(5, 7), 16)
	return [r, g, b, 255]
}

async function renderEffect() {
	if (!props.font || !canvas.value) {
		bitmapInfo.value = null
		return
	}

	error.value = ''

	try {
		const {
			rasterizeGlyph,
			getGlyphPath,
			blurBitmap,
			copyBitmap,
			rasterizePathWithGradient,
			bitmapToRGBA,
			PixelMode,
			cascadeBlur,
			adaptiveBlur,
		} = await import('text-shaper')

		const codepoint = character.value.codePointAt(0) || 0
		const glyphId = props.font.glyphId(codepoint)

		if (glyphId === 0 && codepoint !== 0) {
			error.value = 'Character not found in font'
			bitmapInfo.value = null
			return
		}

		let bitmap: any
		let bearingX = 0
		let bearingY = 0

		if (effectType.value === 'blur') {
			// Rasterize normally, then blur
			const result = rasterizeGlyph(props.font, glyphId, fontSize.value, {
				pixelMode: PixelMode.Gray,
				hinting: true,
				padding: Math.ceil(blurRadius.value) + 2,
			})

			if (!result || !result.bitmap || result.bitmap.width === 0 || result.bitmap.rows === 0) {
				error.value = 'Failed to rasterize glyph (empty bitmap)'
				bitmapInfo.value = null
				return
			}

			bearingX = result.bearingX
			bearingY = result.bearingY

			// Copy and blur based on type
			const copy = copyBitmap(result.bitmap)
			const radiusX = blurRadius.value
			const radiusY = asymmetricBlur.value ? blurRadiusY.value : blurRadius.value

			if (blurType.value === 'cascade') {
				bitmap = cascadeBlur(copy, radiusX, radiusY)
			} else if (blurType.value === 'adaptive') {
				bitmap = adaptiveBlur(copy, radiusX, radiusY)
			} else {
				// gaussian or box - use blurBitmap (doesn't support asymmetric)
				bitmap = blurBitmap(copy, blurRadius.value, blurType.value === 'gaussian')
			}

		} else if (effectType.value === 'gradient') {
			// Get path in font units
			const path = getGlyphPath(props.font, glyphId)

			if (!path || path.commands.length === 0) {
				error.value = 'Failed to get glyph path'
				bitmapInfo.value = null
				return
			}

			if (!path.bounds) {
				error.value = 'Path has no bounds'
				bitmapInfo.value = null
				return
			}

			// Scale from font units to pixels
			const scale = fontSize.value / props.font.unitsPerEm
			const padding = 2

			// Calculate scaled bounds
			const scaledMinX = path.bounds.xMin * scale
			const scaledMaxX = path.bounds.xMax * scale
			const scaledMinY = path.bounds.yMin * scale
			const scaledMaxY = path.bounds.yMax * scale

			const width = Math.ceil(scaledMaxX - scaledMinX) + padding * 2
			const height = Math.ceil(scaledMaxY - scaledMinY) + padding * 2
			bearingX = Math.floor(scaledMinX) - padding
			bearingY = Math.ceil(scaledMaxY) + padding

			// Build gradient based on type (in pixel coordinates)
			const startC = parseColor(startColor.value)
			const endC = parseColor(endColor.value)

			let gradient: any
			if (gradientType.value === 'linear') {
				const angleRad = (gradientAngle.value * Math.PI) / 180
				const cx = width / 2
				const cy = height / 2
				const len = Math.max(width, height) / 2
				gradient = {
					type: 'linear',
					x0: cx - Math.cos(angleRad) * len,
					y0: cy - Math.sin(angleRad) * len,
					x1: cx + Math.cos(angleRad) * len,
					y1: cy + Math.sin(angleRad) * len,
					stops: [
						{ offset: 0, color: startC },
						{ offset: 1, color: endC },
					],
				}
			} else {
				gradient = {
					type: 'radial',
					cx: width / 2,
					cy: height / 2,
					radius: Math.max(width, height) / 2,
					stops: [
						{ offset: 0, color: startC },
						{ offset: 1, color: endC },
					],
				}
			}

			// With flipY: y_pixel = -y_font * scale + offsetY
			// We want yMax (top) to map to padding, yMin (bottom) to map to height - padding
			// padding = -yMax * scale + offsetY  =>  offsetY = padding + yMax * scale = padding + scaledMaxY
			const offsetX = -scaledMinX + padding
			const offsetY = padding + scaledMaxY

			bitmap = rasterizePathWithGradient(path, gradient, {
				width,
				height,
				scale,
				offsetX,
				offsetY,
				flipY: true,
			})

			if (!bitmap || bitmap.width === 0 || bitmap.rows === 0) {
				error.value = 'Failed to rasterize path with gradient'
				bitmapInfo.value = null
				return
			}

		} else {
			// Both: gradient + blur
			const path = getGlyphPath(props.font, glyphId)

			if (!path || path.commands.length === 0) {
				error.value = 'Failed to get glyph path'
				bitmapInfo.value = null
				return
			}

			if (!path.bounds) {
				error.value = 'Path has no bounds'
				bitmapInfo.value = null
				return
			}

			const scale = fontSize.value / props.font.unitsPerEm
			const padding = Math.ceil(blurRadius.value) + 2

			const scaledMinX = path.bounds.xMin * scale
			const scaledMaxX = path.bounds.xMax * scale
			const scaledMinY = path.bounds.yMin * scale
			const scaledMaxY = path.bounds.yMax * scale

			const width = Math.ceil(scaledMaxX - scaledMinX) + padding * 2
			const height = Math.ceil(scaledMaxY - scaledMinY) + padding * 2
			bearingX = Math.floor(scaledMinX) - padding
			bearingY = Math.ceil(scaledMaxY) + padding

			const startC = parseColor(startColor.value)
			const endC = parseColor(endColor.value)

			let gradient: any
			if (gradientType.value === 'linear') {
				const angleRad = (gradientAngle.value * Math.PI) / 180
				const cx = width / 2
				const cy = height / 2
				const len = Math.max(width, height) / 2
				gradient = {
					type: 'linear',
					x0: cx - Math.cos(angleRad) * len,
					y0: cy - Math.sin(angleRad) * len,
					x1: cx + Math.cos(angleRad) * len,
					y1: cy + Math.sin(angleRad) * len,
					stops: [
						{ offset: 0, color: startC },
						{ offset: 1, color: endC },
					],
				}
			} else {
				gradient = {
					type: 'radial',
					cx: width / 2,
					cy: height / 2,
					radius: Math.max(width, height) / 2,
					stops: [
						{ offset: 0, color: startC },
						{ offset: 1, color: endC },
					],
				}
			}

			const offsetX = -scaledMinX + padding
			const offsetY = padding + scaledMaxY

			const gradientBitmap = rasterizePathWithGradient(path, gradient, {
				width,
				height,
				scale,
				offsetX,
				offsetY,
				flipY: true,
			})

			if (!gradientBitmap || gradientBitmap.width === 0 || gradientBitmap.rows === 0) {
				error.value = 'Failed to rasterize path with gradient'
				bitmapInfo.value = null
				return
			}

			// Blur the gradient bitmap
			const copy = copyBitmap(gradientBitmap)
			const radiusX = blurRadius.value
			const radiusY = asymmetricBlur.value ? blurRadiusY.value : blurRadius.value

			if (blurType.value === 'cascade') {
				bitmap = cascadeBlur(copy, radiusX, radiusY)
			} else if (blurType.value === 'adaptive') {
				bitmap = adaptiveBlur(copy, radiusX, radiusY)
			} else {
				bitmap = blurBitmap(copy, blurRadius.value, blurType.value === 'gaussian')
			}
		}

		bitmapInfo.value = {
			width: bitmap.width,
			height: bitmap.rows,
			bearingX,
			bearingY,
		}

		// Draw to canvas
		const ctx = canvas.value.getContext('2d')
		if (!ctx) return

		const bitmapWidth = bitmap.width
		const bitmapHeight = bitmap.rows
		const displayWidth = bitmapWidth * zoom.value
		const displayHeight = bitmapHeight * zoom.value

		canvas.value.width = displayWidth
		canvas.value.height = displayHeight

		// Clear with white background
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, displayWidth, displayHeight)

		// Get RGBA data - gradient bitmaps are already RGBA, blur bitmaps are Gray
		let rgba: Uint8Array
		if (bitmap.pixelMode === PixelMode.RGBA) {
			// Already RGBA, use buffer directly
			rgba = bitmap.buffer
		} else {
			// Convert gray to RGBA
			rgba = bitmapToRGBA(bitmap)
		}

		// Create ImageData
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

			// Scale up with smooth interpolation for effects
			ctx.imageSmoothingEnabled = true
			ctx.imageSmoothingQuality = 'high'
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
		console.error('Effect rendering error:', e)
		error.value = `Error: ${e}`
		bitmapInfo.value = null
	}
}

watch(
	[
		character,
		fontSize,
		effectType,
		blurRadius,
		blurRadiusY,
		blurType,
		asymmetricBlur,
		gradientType,
		startColor,
		endColor,
		gradientAngle,
		zoom,
	],
	() => renderEffect()
)

watch(
	() => props.font,
	() => nextTick(() => renderEffect())
)

onMounted(() => {
	renderEffect()
})

function applyColorPreset(preset: { start: string; end: string }) {
	startColor.value = preset.start
	endColor.value = preset.end
}
</script>

<template>
	<div class="effects-preview">
		<div class="input-section">
			<div class="input-row">
				<label>Character</label>
				<input v-model="character" type="text" maxlength="2" placeholder="A" />
			</div>

			<div class="input-row">
				<label>Font Size: {{ fontSize }}px</label>
				<input v-model.number="fontSize" type="range" min="16" max="72" />
			</div>

			<div class="input-row">
				<label>Zoom: {{ zoom }}x</label>
				<input v-model.number="zoom" type="range" min="1" max="10" />
			</div>

			<div class="input-row">
				<label>Effect Type</label>
				<div class="mode-toggle">
					<button :class="{ active: effectType === 'blur' }" @click="effectType = 'blur'">
						Blur
					</button>
					<button :class="{ active: effectType === 'gradient' }" @click="effectType = 'gradient'">
						Gradient
					</button>
					<button :class="{ active: effectType === 'both' }" @click="effectType = 'both'">
						Both
					</button>
				</div>
			</div>

			<!-- Blur controls -->
			<template v-if="effectType === 'blur' || effectType === 'both'">
				<div class="section-divider">Blur Settings</div>

				<div class="input-row">
					<label>Blur Type</label>
					<div class="mode-toggle">
						<button :class="{ active: blurType === 'gaussian' }" @click="blurType = 'gaussian'">
							Gaussian
						</button>
						<button :class="{ active: blurType === 'box' }" @click="blurType = 'box'">
							Box
						</button>
						<button :class="{ active: blurType === 'cascade' }" @click="blurType = 'cascade'">
							Cascade
						</button>
						<button :class="{ active: blurType === 'adaptive' }" @click="blurType = 'adaptive'">
							Adaptive
						</button>
					</div>
				</div>

				<div class="input-row">
					<label>Blur Radius{{ asymmetricBlur ? ' X' : '' }}: {{ blurRadius }}</label>
					<input v-model.number="blurRadius" type="range" min="0" max="50" step="0.5" />
				</div>

				<div v-if="blurType === 'cascade' || blurType === 'adaptive'" class="input-row">
					<label class="checkbox-label">
						<input type="checkbox" v-model="asymmetricBlur" />
						Asymmetric (separate X/Y radii)
					</label>
				</div>

				<div v-if="asymmetricBlur && (blurType === 'cascade' || blurType === 'adaptive')" class="input-row">
					<label>Blur Radius Y: {{ blurRadiusY }}</label>
					<input v-model.number="blurRadiusY" type="range" min="0" max="50" step="0.5" />
				</div>

				<div class="blur-info">
					<p v-if="blurType === 'gaussian'">Standard Gaussian blur - high quality, O(n) per pixel.</p>
					<p v-else-if="blurType === 'box'">Box blur - fast, uniform kernel.</p>
					<p v-else-if="blurType === 'cascade'">Cascade blur - O(1) per pixel using pyramid scaling. Best for large radii.</p>
					<p v-else-if="blurType === 'adaptive'">Adaptive - uses Gaussian for small radii, Cascade for large.</p>
				</div>
			</template>

			<!-- Gradient controls -->
			<template v-if="effectType === 'gradient' || effectType === 'both'">
				<div class="section-divider">Gradient Settings</div>

				<div class="input-row">
					<label>Gradient Type</label>
					<div class="mode-toggle">
						<button :class="{ active: gradientType === 'linear' }" @click="gradientType = 'linear'">
							Linear
						</button>
						<button :class="{ active: gradientType === 'radial' }" @click="gradientType = 'radial'">
							Radial
						</button>
					</div>
				</div>

				<div class="input-row">
					<label>Color Presets</label>
					<div class="color-presets">
						<button
							v-for="preset in colorPresets"
							:key="preset.name"
							@click="applyColorPreset(preset)"
							class="preset-btn"
						>
							<div class="preset-gradient" :style="{
								background: `linear-gradient(90deg, ${preset.start}, ${preset.end})`
							}"></div>
							<span>{{ preset.name }}</span>
						</button>
					</div>
				</div>

				<div class="input-row">
					<label>Start Color</label>
					<div class="color-input">
						<input v-model="startColor" type="color" />
						<input v-model="startColor" type="text" placeholder="#3b82f6" />
					</div>
				</div>

				<div class="input-row">
					<label>End Color</label>
					<div class="color-input">
						<input v-model="endColor" type="color" />
						<input v-model="endColor" type="text" placeholder="#8b5cf6" />
					</div>
				</div>

				<div v-if="gradientType === 'linear'" class="input-row">
					<label>Angle: {{ gradientAngle }}°</label>
					<input v-model.number="gradientAngle" type="range" min="0" max="360" />
				</div>

				<div v-else class="input-row">
					<div class="info-box">
						Radial gradient renders from center outward
					</div>
				</div>
			</template>
		</div>

		<div v-if="!props.font" class="no-font">
			Select a font above to preview blur and gradient effects.
		</div>

		<template v-else>
			<div v-if="error" class="error">{{ error }}</div>

			<div class="preview-section">
				<label>Effect Preview</label>
				<div class="canvas-container">
					<canvas ref="canvas"></canvas>
				</div>

				<div v-if="bitmapInfo" class="info-grid">
					<div class="info-item">
						<span class="label">Bitmap Size</span>
						<span class="value">{{ bitmapInfo.width }} x {{ bitmapInfo.height }} px</span>
					</div>
					<div class="info-item">
						<span class="label">Bearing X</span>
						<span class="value">{{ bitmapInfo.bearingX }}</span>
					</div>
					<div class="info-item">
						<span class="label">Bearing Y</span>
						<span class="value">{{ bitmapInfo.bearingY }}</span>
					</div>
				</div>

				<div v-if="bitmapInfo" class="effect-info">
					<p v-if="effectType === 'blur'">
						<strong>Blur:</strong> {{ blurType === 'gaussian' ? 'Gaussian' : 'Box' }} blur with radius {{ blurRadius }}.
						Gaussian blur produces smoother results but is computationally more expensive.
					</p>
					<p v-else-if="effectType === 'gradient'">
						<strong>Gradient:</strong> {{ gradientType === 'linear' ? 'Linear' : 'Radial' }} gradient from
						<span class="color-swatch" :style="{ background: startColor }"></span> {{ startColor }} to
						<span class="color-swatch" :style="{ background: endColor }"></span> {{ endColor }}.
						<template v-if="gradientType === 'linear'">Angle: {{ gradientAngle }}°.</template>
					</p>
					<p v-else>
						<strong>Combined:</strong> {{ gradientType === 'linear' ? 'Linear' : 'Radial' }} gradient with
						{{ blurType === 'gaussian' ? 'Gaussian' : 'Box' }} blur (radius {{ blurRadius }}).
					</p>
				</div>
			</div>
		</template>
	</div>
</template>

<style scoped>
.effects-preview {
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.input-section {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.section-divider {
	font-weight: 700;
	font-size: 14px;
	color: var(--vp-c-brand);
	margin-top: 8px;
	padding-top: 16px;
	border-top: 1px solid var(--vp-c-border);
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

.color-presets {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.preset-btn {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 8px 12px;
	border: 1px solid var(--vp-c-border);
	border-radius: 4px;
	background: var(--vp-c-bg);
	color: var(--vp-c-text-1);
	cursor: pointer;
	font-size: 13px;
	transition: all 0.2s;
}

.preset-btn:hover {
	border-color: var(--vp-c-brand);
	background: var(--vp-c-bg-soft);
}

.preset-gradient {
	width: 40px;
	height: 24px;
	border-radius: 3px;
	border: 1px solid var(--vp-c-border);
}

.color-input {
	display: flex;
	gap: 8px;
	align-items: center;
}

.color-input input[type="color"] {
	width: 50px;
	height: 40px;
	border: 1px solid var(--vp-c-border);
	border-radius: 4px;
	cursor: pointer;
}

.color-input input[type="text"] {
	flex: 1;
	padding: 8px 12px;
	border: 1px solid var(--vp-c-border);
	border-radius: 4px;
	background: var(--vp-c-bg);
	color: var(--vp-c-text-1);
	font-family: monospace;
}

.info-box {
	padding: 12px;
	background: var(--vp-c-bg-soft);
	border-radius: 4px;
	font-size: 13px;
	color: var(--vp-c-text-2);
}

.blur-info {
	padding: 10px 12px;
	background: var(--vp-c-bg-soft);
	border-radius: 4px;
	font-size: 13px;
}

.blur-info p {
	margin: 0;
	color: var(--vp-c-text-2);
}

.checkbox-label {
	display: flex;
	align-items: center;
	gap: 8px;
	cursor: pointer;
	font-weight: normal !important;
}

.checkbox-label input[type="checkbox"] {
	width: 16px;
	height: 16px;
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

.effect-info {
	padding: 12px;
	background: var(--vp-c-bg-soft);
	border-radius: 4px;
	font-size: 14px;
}

.effect-info p {
	margin: 0;
	color: var(--vp-c-text-2);
}

.color-swatch {
	display: inline-block;
	width: 14px;
	height: 14px;
	border: 1px solid var(--vp-c-border);
	border-radius: 2px;
	vertical-align: middle;
	margin: 0 2px;
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
