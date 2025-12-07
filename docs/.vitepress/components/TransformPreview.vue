<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from "vue";

const props = defineProps<{
	font: any;
	fontName: string;
}>();

const character = ref("A");
const fontSize = ref(48);
const zoom = ref(2);

// Render mode
const renderMode = ref<"raster" | "vector">("vector");

// Transform controls
const rotation = ref(0);
const scaleX = ref(1);
const scaleY = ref(1);
const shearX = ref(0);
const translateX = ref(0);
const translateY = ref(0);

// 3D perspective controls
const perspectiveX = ref(0);
const perspectiveY = ref(0);

const canvas = ref<HTMLCanvasElement | null>(null);
const error = ref("");

async function renderTransform() {
	if (!props.font || !canvas.value) return;

	error.value = "";

	try {
		if (renderMode.value === "raster") {
			await renderRaster();
		} else {
			await renderVector();
		}
	} catch (e) {
		console.error("Transform error:", e);
		error.value = `Error: ${e}`;
	}
}

async function renderRaster() {
	const {
		getGlyphPath,
		transformOutline2D,
		transformOutline3D,
		rotate2D,
		scale2D,
		shear2D,
		multiply2D,
		computeTightBounds,
		rasterizePath,
		bitmapToRGBA,
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

	const scale = fontSize.value / props.font.unitsPerEm;
	const use3D = perspectiveX.value !== 0 || perspectiveY.value !== 0;

	let transformed;

	if (use3D) {
		// Build 3x3 matrix for perspective transform
		const matrix3D: [[number, number, number], [number, number, number], [number, number, number]] = [
			[scale * scaleX.value, 0, 0],
			[0, scale * scaleY.value, 0],
			[perspectiveX.value * 0.0001, perspectiveY.value * 0.0001, 1],
		];

		// Apply rotation
		if (rotation.value !== 0) {
			const angle = (rotation.value * Math.PI) / 180;
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			const rotated: [[number, number, number], [number, number, number], [number, number, number]] = [
				[cos * matrix3D[0][0] - sin * matrix3D[1][0], cos * matrix3D[0][1] - sin * matrix3D[1][1], matrix3D[0][2]],
				[sin * matrix3D[0][0] + cos * matrix3D[1][0], sin * matrix3D[0][1] + cos * matrix3D[1][1], matrix3D[1][2]],
				matrix3D[2],
			];
			matrix3D[0] = rotated[0];
			matrix3D[1] = rotated[1];
		}

		// Apply shear
		if (shearX.value !== 0) {
			matrix3D[0][1] += shearX.value * matrix3D[0][0];
			matrix3D[1][1] += shearX.value * matrix3D[1][0];
		}

		transformed = transformOutline3D(path, matrix3D);
	} else {
		// Build 2D transform matrix
		let matrix = scale2D(scale * scaleX.value, scale * scaleY.value);

		if (rotation.value !== 0) {
			const rotMat = rotate2D((rotation.value * Math.PI) / 180);
			matrix = multiply2D(rotMat, matrix);
		}

		if (shearX.value !== 0) {
			const shearMat = shear2D(shearX.value, 0);
			matrix = multiply2D(shearMat, matrix);
		}

		transformed = transformOutline2D(path, matrix);
	}

	const bounds = computeTightBounds(transformed);

	if (!bounds || bounds.xMin >= bounds.xMax) {
		error.value = "Empty bounds after transform";
		return;
	}

	// Protect against extreme perspective causing huge bounds
	const maxDimension = 2000;
	const boundsWidth = bounds.xMax - bounds.xMin;
	const boundsHeight = bounds.yMax - bounds.yMin;
	if (!Number.isFinite(boundsWidth) || !Number.isFinite(boundsHeight) ||
		boundsWidth > maxDimension || boundsHeight > maxDimension ||
		Math.abs(bounds.xMin) > maxDimension * 10 || Math.abs(bounds.yMin) > maxDimension * 10) {
		error.value = "Perspective too extreme - coordinates overflow";
		return;
	}

	const padding = 10;
	const extraLeft = translateX.value < 0 ? -translateX.value : 0;
	const extraRight = translateX.value > 0 ? translateX.value : 0;
	const extraTop = translateY.value < 0 ? -translateY.value : 0;
	const extraBottom = translateY.value > 0 ? translateY.value : 0;

	const width =
		Math.ceil(bounds.xMax - bounds.xMin) + padding * 2 + extraLeft + extraRight;
	const height =
		Math.ceil(bounds.yMax - bounds.yMin) + padding * 2 + extraTop + extraBottom;

	const offsetX = -bounds.xMin + padding + extraLeft;
	const offsetY = bounds.yMax + padding + extraTop + translateY.value;

	const bitmap = rasterizePath(transformed, {
		width,
		height,
		scale: 1,
		offsetX,
		offsetY,
		flipY: true,
	});

	if (!bitmap || bitmap.width === 0) {
		error.value = "Failed to rasterize";
		return;
	}

	// Draw to canvas
	const ctx = canvas.value!.getContext("2d");
	if (!ctx) return;

	const displayWidth = bitmap.width * zoom.value;
	const displayHeight = bitmap.rows * zoom.value;

	canvas.value!.width = displayWidth;
	canvas.value!.height = displayHeight;

	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, displayWidth, displayHeight);

	const rgba = bitmapToRGBA(bitmap);
	const imageData = new ImageData(
		new Uint8ClampedArray(rgba),
		bitmap.width,
		bitmap.rows
	);

	const tempCanvas = document.createElement("canvas");
	tempCanvas.width = bitmap.width;
	tempCanvas.height = bitmap.rows;
	const tempCtx = tempCanvas.getContext("2d");
	if (tempCtx) {
		tempCtx.putImageData(imageData, 0, 0);
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(tempCanvas, 0, 0, displayWidth, displayHeight);
	}
}

async function renderVector() {
	const {
		getGlyphPath,
		pathToCanvas,
		rotate2D,
		scale2D,
		shear2D,
		translate2D,
		multiply2D,
		applyMatrixToContext,
		transformOutline2D,
		transformOutline3D,
		computeTightBounds,
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

	const ctx = canvas.value!.getContext("2d");
	if (!ctx) return;

	const scale = fontSize.value / props.font.unitsPerEm;
	const use3D = perspectiveX.value !== 0 || perspectiveY.value !== 0;

	// First transform the path to get proper bounds
	let transformed;

	if (use3D) {
		const matrix3D: [[number, number, number], [number, number, number], [number, number, number]] = [
			[scale * scaleX.value, 0, 0],
			[0, scale * scaleY.value, 0],
			[perspectiveX.value * 0.0001, perspectiveY.value * 0.0001, 1],
		];

		if (rotation.value !== 0) {
			const angle = (rotation.value * Math.PI) / 180;
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			const rotated: [[number, number, number], [number, number, number], [number, number, number]] = [
				[cos * matrix3D[0][0] - sin * matrix3D[1][0], cos * matrix3D[0][1] - sin * matrix3D[1][1], matrix3D[0][2]],
				[sin * matrix3D[0][0] + cos * matrix3D[1][0], sin * matrix3D[0][1] + cos * matrix3D[1][1], matrix3D[1][2]],
				matrix3D[2],
			];
			matrix3D[0] = rotated[0];
			matrix3D[1] = rotated[1];
		}

		if (shearX.value !== 0) {
			matrix3D[0][1] += shearX.value * matrix3D[0][0];
			matrix3D[1][1] += shearX.value * matrix3D[1][0];
		}

		transformed = transformOutline3D(path, matrix3D);
	} else {
		let matrix = scale2D(scale * scaleX.value, scale * scaleY.value);

		if (rotation.value !== 0) {
			const rotMat = rotate2D((rotation.value * Math.PI) / 180);
			matrix = multiply2D(rotMat, matrix);
		}

		if (shearX.value !== 0) {
			const shearMat = shear2D(shearX.value, 0);
			matrix = multiply2D(shearMat, matrix);
		}

		transformed = transformOutline2D(path, matrix);
	}

	const bounds = computeTightBounds(transformed);
	if (!bounds || bounds.xMin >= bounds.xMax) {
		error.value = "Empty bounds after transform";
		return;
	}

	// Protect against extreme perspective causing huge bounds
	const maxDimension = 2000;
	const boundsWidth = bounds.xMax - bounds.xMin;
	const boundsHeight = bounds.yMax - bounds.yMin;
	if (!Number.isFinite(boundsWidth) || !Number.isFinite(boundsHeight) ||
		boundsWidth > maxDimension || boundsHeight > maxDimension ||
		Math.abs(bounds.xMin) > maxDimension * 10 || Math.abs(bounds.yMin) > maxDimension * 10) {
		error.value = "Perspective too extreme - coordinates overflow";
		return;
	}

	const padding = 20;
	const contentWidth = Math.ceil(bounds.xMax - bounds.xMin) + padding * 2;
	const contentHeight = Math.ceil(bounds.yMax - bounds.yMin) + padding * 2;
	const displayWidth = contentWidth * zoom.value;
	const displayHeight = contentHeight * zoom.value;

	canvas.value!.width = displayWidth;
	canvas.value!.height = displayHeight;

	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, displayWidth, displayHeight);

	// Scale the canvas context for zoom
	ctx.scale(zoom.value, zoom.value);

	// Draw the transformed path with offset to fit in canvas
	const offsetX = -bounds.xMin + padding + translateX.value;
	const offsetY = bounds.yMax + padding + translateY.value;

	ctx.beginPath();
	pathToCanvas(ctx, transformed, {
		scale: 1,
		flipY: true,
		offsetX,
		offsetY,
	});
	ctx.fillStyle = "#000000";
	ctx.fill();
}

function resetTransforms() {
	rotation.value = 0;
	scaleX.value = 1;
	scaleY.value = 1;
	shearX.value = 0;
	translateX.value = 0;
	translateY.value = 0;
	perspectiveX.value = 0;
	perspectiveY.value = 0;
}

watch(
	[character, fontSize, rotation, scaleX, scaleY, shearX, translateX, translateY, zoom, renderMode, perspectiveX, perspectiveY],
	() => renderTransform()
);

watch(
	() => props.font,
	() => nextTick(() => renderTransform())
);

onMounted(() => {
	renderTransform();
});
</script>

<template>
	<div class="transform-preview">
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

			<div class="input-row">
				<label>Render Mode</label>
				<div class="mode-toggle">
					<button :class="{ active: renderMode === 'vector' }" @click="renderMode = 'vector'">
						Vector
					</button>
					<button :class="{ active: renderMode === 'raster' }" @click="renderMode = 'raster'">
						Raster
					</button>
				</div>
			</div>

			<div class="section-divider">2D Transform Controls</div>

			<div class="input-row">
				<label>Rotation: {{ rotation }}°</label>
				<input v-model.number="rotation" type="range" min="-180" max="180" />
			</div>

			<div class="input-row">
				<label>Scale X: {{ scaleX.toFixed(2) }}</label>
				<input v-model.number="scaleX" type="range" min="0.2" max="2" step="0.05" />
			</div>

			<div class="input-row">
				<label>Scale Y: {{ scaleY.toFixed(2) }}</label>
				<input v-model.number="scaleY" type="range" min="0.2" max="2" step="0.05" />
			</div>

			<div class="input-row">
				<label>Shear (Italic): {{ shearX.toFixed(2) }}</label>
				<input v-model.number="shearX" type="range" min="-0.5" max="0.5" step="0.02" />
			</div>

			<div class="input-row">
				<label>Translate X: {{ translateX }}px</label>
				<input v-model.number="translateX" type="range" min="-50" max="50" />
			</div>

			<div class="input-row">
				<label>Translate Y: {{ translateY }}px</label>
				<input v-model.number="translateY" type="range" min="-50" max="50" />
			</div>

			<div class="section-divider">3D Perspective</div>

			<div class="input-row">
				<label>Perspective X: {{ perspectiveX }}</label>
				<input v-model.number="perspectiveX" type="range" min="-50" max="50" />
			</div>

			<div class="input-row">
				<label>Perspective Y: {{ perspectiveY }}</label>
				<input v-model.number="perspectiveY" type="range" min="-50" max="50" />
			</div>

			<button class="reset-btn" @click="resetTransforms">Reset All</button>
		</div>

		<div v-if="!props.font" class="no-font">
			Select a font above to preview transforms.
		</div>

		<template v-else>
			<div v-if="error" class="error">{{ error }}</div>

			<div class="preview-section">
				<label>Transform Preview</label>
				<div class="canvas-container">
					<canvas ref="canvas"></canvas>
				</div>

				<div class="transform-info">
					<p>
						<strong>Mode:</strong> {{ renderMode === 'vector' ? 'Vector (Canvas Path)' : 'Raster (Bitmap)' }}
					</p>
					<p>
						<strong>2D Transform:</strong>
						Rotate {{ rotation }}°,
						Scale ({{ scaleX.toFixed(2) }}, {{ scaleY.toFixed(2) }}),
						Shear {{ shearX.toFixed(2) }},
						Translate ({{ translateX }}, {{ translateY }})
					</p>
					<p v-if="perspectiveX !== 0 || perspectiveY !== 0">
						<strong>3D Perspective:</strong>
						({{ perspectiveX }}, {{ perspectiveY }})
					</p>
				</div>

				<div class="mode-description">
					<p v-if="renderMode === 'vector'">
						<strong>Vector mode</strong> uses <code>transformOutline2D</code>/<code>transformOutline3D</code>
						to transform path coordinates, then renders with <code>pathToCanvas</code>. Produces smooth, resolution-independent output.
					</p>
					<p v-else>
						<strong>Raster mode</strong> uses <code>transformOutline2D</code>/<code>transformOutline3D</code> to transform the outline,
						then rasterizes to a bitmap. Useful for previewing pixel-level effects with zoomed view.
					</p>
					<p v-if="perspectiveX !== 0 || perspectiveY !== 0" class="perspective-note">
						3D perspective uses homogeneous coordinates (3x3 matrix) for projection effects.
					</p>
				</div>
			</div>
		</template>
	</div>
</template>

<style scoped>
.transform-preview {
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

.reset-btn {
	margin-top: 8px;
	padding: 10px 16px;
	border: 1px solid var(--vp-c-border);
	border-radius: 4px;
	background: var(--vp-c-bg-soft);
	color: var(--vp-c-text-1);
	cursor: pointer;
	font-size: 14px;
	font-weight: 600;
}

.reset-btn:hover {
	background: var(--vp-c-brand-soft);
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

.transform-info {
	padding: 12px;
	background: var(--vp-c-bg-soft);
	border-radius: 4px;
	font-size: 14px;
}

.transform-info p {
	margin: 0 0 4px 0;
	color: var(--vp-c-text-2);
}

.transform-info p:last-child {
	margin-bottom: 0;
}

.mode-description {
	padding: 12px;
	background: var(--vp-c-bg-soft);
	border-radius: 4px;
	font-size: 14px;
}

.mode-description p {
	margin: 0;
	color: var(--vp-c-text-2);
}

.mode-description code {
	background: var(--vp-c-bg-mute);
	padding: 2px 6px;
	border-radius: 3px;
	font-size: 12px;
}

.mode-description .perspective-note {
	margin-top: 8px;
	font-style: italic;
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
