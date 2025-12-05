<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from "vue";

const props = defineProps<{
	font: any;
	fontName: string;
}>();

const character = ref("A");
const fontSize = ref(48);
const zoom = ref(2);

// Stroke controls
const xBorder = ref(20);
const yBorder = ref(20);
const lineJoin = ref<"miter" | "round" | "bevel">("round");
const showFill = ref(true);
const showStroke = ref(true);
const strokeColor = ref("#3b82f6");
const fillColor = ref("#000000");

const canvas = ref<HTMLCanvasElement | null>(null);
const error = ref("");

async function renderStroke() {
	if (!props.font || !canvas.value) return;

	error.value = "";

	try {
		const {
			getGlyphPath,
			strokeAsymmetric,
			computeTightBounds,
			rasterizePath,
			createBitmap,
			compositeBitmaps,
			PixelMode,
		} = await import("text-shaper");

		const codepoint = character.value.codePointAt(0) || 0;
		const glyphId = props.font.glyphId(codepoint);

		if (glyphId === 0 && codepoint !== 0) {
			error.value = "Character not found in font";
			return;
		}

		const path = getGlyphPath(props.font, glyphId);
		if (!path || path.commands.length === 0) {
			error.value = "Failed to get glyph path";
			return;
		}

		// Generate stroke
		const { outer, inner } = strokeAsymmetric(path, {
			xBorder: xBorder.value,
			yBorder: yBorder.value,
			lineJoin: lineJoin.value,
			miterLimit: 4,
		});

		// Calculate combined bounds
		const scale = fontSize.value / props.font.unitsPerEm;
		const outerBounds = computeTightBounds(outer);
		const innerBounds = computeTightBounds(inner);
		const fillBounds = computeTightBounds(path);

		let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
		for (const b of [outerBounds, innerBounds, fillBounds]) {
			if (b) {
				xMin = Math.min(xMin, b.xMin * scale);
				yMin = Math.min(yMin, b.yMin * scale);
				xMax = Math.max(xMax, b.xMax * scale);
				yMax = Math.max(yMax, b.yMax * scale);
			}
		}

		if (!Number.isFinite(xMin)) {
			error.value = "Empty bounds";
			return;
		}

		const padding = 10;
		const width = Math.ceil(xMax - xMin) + padding * 2;
		const height = Math.ceil(yMax - yMin) + padding * 2;
		const offsetX = -xMin + padding;
		const offsetY = yMax + padding;

		// Create RGBA result bitmap
		const result = createBitmap(width, height, PixelMode.RGBA);

		// Parse colors
		const parseHex = (hex: string) => [
			parseInt(hex.slice(1, 3), 16),
			parseInt(hex.slice(3, 5), 16),
			parseInt(hex.slice(5, 7), 16),
		];

		// Rasterize and composite
		if (showStroke.value) {
			// Rasterize outer stroke
			const outerBitmap = rasterizePath(outer, {
				width,
				height,
				scale,
				offsetX,
				offsetY,
				flipY: true,
			});

			// Rasterize inner (to subtract)
			const innerBitmap = rasterizePath(inner, {
				width,
				height,
				scale,
				offsetX,
				offsetY,
				flipY: true,
			});

			// Create stroke mask: outer - inner
			const strokeMask = createBitmap(width, height, PixelMode.Gray);
			const [sr, sg, sb] = parseHex(strokeColor.value);

			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const outerVal = outerBitmap.buffer[y * outerBitmap.pitch + x] ?? 0;
					const innerVal = innerBitmap.buffer[y * innerBitmap.pitch + x] ?? 0;
					const strokeVal = Math.max(0, outerVal - innerVal);

					if (strokeVal > 0) {
						const idx = (y * width + x) * 4;
						const alpha = strokeVal / 255;
						const existing = result.buffer[idx + 3] ?? 0;
						if (existing === 0) {
							result.buffer[idx] = sr;
							result.buffer[idx + 1] = sg;
							result.buffer[idx + 2] = sb;
							result.buffer[idx + 3] = strokeVal;
						} else {
							// Blend
							const ea = existing / 255;
							const na = alpha + ea * (1 - alpha);
							result.buffer[idx] = Math.round((sr * alpha + (result.buffer[idx] ?? 0) * ea * (1 - alpha)) / na);
							result.buffer[idx + 1] = Math.round((sg * alpha + (result.buffer[idx + 1] ?? 0) * ea * (1 - alpha)) / na);
							result.buffer[idx + 2] = Math.round((sb * alpha + (result.buffer[idx + 2] ?? 0) * ea * (1 - alpha)) / na);
							result.buffer[idx + 3] = Math.round(na * 255);
						}
					}
				}
			}
		}

		if (showFill.value) {
			const fillBitmap = rasterizePath(path, {
				width,
				height,
				scale,
				offsetX,
				offsetY,
				flipY: true,
			});

			const [fr, fg, fb] = parseHex(fillColor.value);

			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const fillVal = fillBitmap.buffer[y * fillBitmap.pitch + x] ?? 0;
					if (fillVal > 0) {
						const idx = (y * width + x) * 4;
						const alpha = fillVal / 255;
						const existing = result.buffer[idx + 3] ?? 0;
						if (existing === 0) {
							result.buffer[idx] = fr;
							result.buffer[idx + 1] = fg;
							result.buffer[idx + 2] = fb;
							result.buffer[idx + 3] = fillVal;
						} else {
							const ea = existing / 255;
							const na = alpha + ea * (1 - alpha);
							result.buffer[idx] = Math.round((fr * alpha + (result.buffer[idx] ?? 0) * ea * (1 - alpha)) / na);
							result.buffer[idx + 1] = Math.round((fg * alpha + (result.buffer[idx + 1] ?? 0) * ea * (1 - alpha)) / na);
							result.buffer[idx + 2] = Math.round((fb * alpha + (result.buffer[idx + 2] ?? 0) * ea * (1 - alpha)) / na);
							result.buffer[idx + 3] = Math.round(na * 255);
						}
					}
				}
			}
		}

		// Draw to canvas
		const ctx = canvas.value.getContext("2d");
		if (!ctx) return;

		const displayWidth = width * zoom.value;
		const displayHeight = height * zoom.value;

		canvas.value.width = displayWidth;
		canvas.value.height = displayHeight;

		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, displayWidth, displayHeight);

		const imageData = new ImageData(
			new Uint8ClampedArray(result.buffer),
			width,
			height
		);

		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = width;
		tempCanvas.height = height;
		const tempCtx = tempCanvas.getContext("2d");
		if (tempCtx) {
			tempCtx.putImageData(imageData, 0, 0);
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(tempCanvas, 0, 0, displayWidth, displayHeight);
		}
	} catch (e) {
		console.error("Stroke error:", e);
		error.value = `Error: ${e}`;
	}
}

watch(
	[character, fontSize, xBorder, yBorder, lineJoin, showFill, showStroke, strokeColor, fillColor, zoom],
	() => renderStroke()
);

watch(
	() => props.font,
	() => nextTick(() => renderStroke())
);

onMounted(() => {
	renderStroke();
});
</script>

<template>
	<div class="stroke-preview">
		<div class="input-section">
			<div class="input-row">
				<label>Character</label>
				<input v-model="character" type="text" maxlength="2" placeholder="A" />
			</div>

			<div class="input-row">
				<label>Font Size: {{ fontSize }}px</label>
				<input v-model.number="fontSize" type="range" min="24" max="96" />
			</div>

			<div class="input-row">
				<label>Zoom: {{ zoom }}x</label>
				<input v-model.number="zoom" type="range" min="1" max="8" />
			</div>

			<div class="section-divider">Stroke Controls</div>

			<div class="input-row">
				<label>X Border: {{ xBorder }} units</label>
				<input v-model.number="xBorder" type="range" min="0" max="100" />
			</div>

			<div class="input-row">
				<label>Y Border: {{ yBorder }} units</label>
				<input v-model.number="yBorder" type="range" min="0" max="100" />
			</div>

			<div class="input-row">
				<label>Line Join</label>
				<div class="mode-toggle">
					<button :class="{ active: lineJoin === 'miter' }" @click="lineJoin = 'miter'">
						Miter
					</button>
					<button :class="{ active: lineJoin === 'round' }" @click="lineJoin = 'round'">
						Round
					</button>
					<button :class="{ active: lineJoin === 'bevel' }" @click="lineJoin = 'bevel'">
						Bevel
					</button>
				</div>
			</div>

			<div class="section-divider">Display</div>

			<div class="checkbox-row">
				<label>
					<input type="checkbox" v-model="showStroke" /> Show Stroke
				</label>
				<label>
					<input type="checkbox" v-model="showFill" /> Show Fill
				</label>
			</div>

			<div class="input-row">
				<label>Stroke Color</label>
				<div class="color-input">
					<input v-model="strokeColor" type="color" />
					<input v-model="strokeColor" type="text" />
				</div>
			</div>

			<div class="input-row">
				<label>Fill Color</label>
				<div class="color-input">
					<input v-model="fillColor" type="color" />
					<input v-model="fillColor" type="text" />
				</div>
			</div>
		</div>

		<div v-if="!props.font" class="no-font">
			Select a font above to preview asymmetric stroke.
		</div>

		<template v-else>
			<div v-if="error" class="error">{{ error }}</div>

			<div class="preview-section">
				<label>Stroke Preview</label>
				<div class="canvas-container">
					<canvas ref="canvas"></canvas>
				</div>

				<div class="stroke-info">
					<p>
						<strong>Asymmetric Stroke:</strong>
						X Border: {{ xBorder }} units, Y Border: {{ yBorder }} units,
						Join: {{ lineJoin }}
					</p>
					<p class="note">
						Asymmetric stroke allows different stroke widths in X and Y directions.
						This is useful for outline effects on text where you want independent control.
					</p>
				</div>
			</div>
		</template>
	</div>
</template>

<style scoped>
.stroke-preview {
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.input-section {
	display: flex;
	flex-direction: column;
	gap: 12px;
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
	gap: 6px;
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

.checkbox-row {
	display: flex;
	gap: 24px;
}

.checkbox-row label {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 14px;
	cursor: pointer;
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
	font-size: 14px;
	max-width: none;
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

.stroke-info {
	padding: 12px;
	background: var(--vp-c-bg-soft);
	border-radius: 4px;
	font-size: 14px;
}

.stroke-info p {
	margin: 0 0 8px 0;
	color: var(--vp-c-text-2);
}

.stroke-info p:last-child {
	margin-bottom: 0;
}

.stroke-info .note {
	font-size: 13px;
	color: var(--vp-c-text-3);
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
