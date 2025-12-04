<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const emit = defineEmits<{
  (e: 'fontLoaded', font: any, name: string): void
}>()

const demoFonts = [
  { name: 'Inter Variable', path: '/fonts/Inter-Variable.ttf' },
  { name: 'Recursive', path: '/fonts/Recursive-Variable.ttf' },
  { name: 'Noto Sans Arabic', path: '/fonts/NotoSansArabic-Variable.ttf' },
]

const selectedDemo = ref('')
const loading = ref(false)
const error = ref('')
const systemFonts = ref<{ family: string; fullName: string; postscriptName: string }[]>([])
const hasLocalFontAccess = ref(false)
const dragOver = ref(false)
const fontFilter = ref('')

const filteredSystemFonts = computed(() => {
  if (!fontFilter.value) return systemFonts.value
  const filter = fontFilter.value.toLowerCase()
  return systemFonts.value.filter(f => f.fullName.toLowerCase().includes(filter))
})

onMounted(() => {
  hasLocalFontAccess.value = 'queryLocalFonts' in window
})

async function loadDemoFont() {
  if (!selectedDemo.value) return

  const font = demoFonts.find(f => f.name === selectedDemo.value)
  if (!font) return

  loading.value = true
  error.value = ''

  try {
    const { Font } = await import('text-shaper')
    const response = await fetch(font.path)
    const buffer = await response.arrayBuffer()
    const loadedFont = await Font.loadAsync(buffer)
    emit('fontLoaded', loadedFont, font.name)
  } catch (e) {
    error.value = `Failed to load font: ${e}`
  } finally {
    loading.value = false
  }
}

async function handleFileDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false

  const file = e.dataTransfer?.files[0]
  if (!file) return

  await loadFontFile(file)
}

async function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  await loadFontFile(file)
}

async function loadFontFile(file: File) {
  loading.value = true
  error.value = ''

  try {
    const { Font } = await import('text-shaper')
    const buffer = await file.arrayBuffer()
    const loadedFont = await Font.loadAsync(buffer)
    emit('fontLoaded', loadedFont, file.name)
  } catch (e) {
    error.value = `Failed to load font: ${e}`
  } finally {
    loading.value = false
  }
}

async function querySystemFonts() {
  if (!hasLocalFontAccess.value) return

  loading.value = true
  error.value = ''

  try {
    // @ts-ignore - Local Font Access API
    const fonts = await window.queryLocalFonts()
    systemFonts.value = fonts.map((f: any) => ({
      family: f.family,
      fullName: f.fullName,
      postscriptName: f.postscriptName,
    }))
  } catch (e) {
    error.value = `Failed to access system fonts: ${e}`
  } finally {
    loading.value = false
  }
}

async function loadSystemFont(postscriptName: string, fullName: string) {
  loading.value = true
  error.value = ''

  try {
    // @ts-ignore - Local Font Access API
    const fonts = await window.queryLocalFonts({ postscriptNames: [postscriptName] })
    if (fonts.length === 0) {
      throw new Error('Font not found')
    }

    const fontData = fonts[0]
    const blob = await fontData.blob()
    const buffer = await blob.arrayBuffer()

    const { Font } = await import('text-shaper')
    const loadedFont = await Font.loadAsync(buffer)
    emit('fontLoaded', loadedFont, fullName)
    systemFonts.value = []
  } catch (e) {
    error.value = `Failed to load system font: ${e}`
  } finally {
    loading.value = false
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  dragOver.value = true
}

function handleDragLeave() {
  dragOver.value = false
}
</script>

<template>
  <div class="font-picker">
    <div class="picker-section">
      <label>Demo Fonts</label>
      <div class="demo-select">
        <select v-model="selectedDemo" @change="loadDemoFont">
          <option value="">Select a demo font...</option>
          <option v-for="font in demoFonts" :key="font.name" :value="font.name">
            {{ font.name }}
          </option>
        </select>
      </div>
    </div>

    <div class="picker-section">
      <label>Upload Font</label>
      <div
        class="drop-zone"
        :class="{ 'drag-over': dragOver }"
        @drop="handleFileDrop"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
      >
        <input
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          @change="handleFileInput"
          class="file-input"
        />
        <span>Drop font file here or click to browse</span>
      </div>
    </div>

    <div class="picker-section" v-if="hasLocalFontAccess">
      <label>System Fonts</label>
      <button @click="querySystemFonts" :disabled="loading" class="system-fonts-btn">
        Access System Fonts
      </button>
      <div v-if="systemFonts.length > 0" class="system-fonts-list">
        <input
          type="text"
          placeholder="Filter fonts..."
          class="font-filter"
          v-model="fontFilter"
        />
        <div class="font-list-scroll">
          <div
            v-for="font in filteredSystemFonts"
            :key="font.postscriptName"
            class="system-font-item"
            @click="loadSystemFont(font.postscriptName, font.fullName)"
          >
            {{ font.fullName }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading font...</div>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<style scoped>
.font-picker {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
}

.picker-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.picker-section label {
  font-weight: 600;
  font-size: 14px;
  color: var(--vp-c-text-1);
}

.demo-select select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
}

.drop-zone {
  position: relative;
  padding: 24px;
  border: 2px dashed var(--vp-c-border);
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.drop-zone:hover,
.drop-zone.drag-over {
  border-color: var(--vp-c-brand);
  background: var(--vp-c-bg-soft);
}

.drop-zone .file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.drop-zone span {
  color: var(--vp-c-text-2);
  font-size: 14px;
}

.system-fonts-btn {
  padding: 8px 16px;
  background: var(--vp-c-brand);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.system-fonts-btn:hover {
  background: var(--vp-c-brand-dark);
}

.system-fonts-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.system-fonts-list {
  margin-top: 8px;
}

.font-filter {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  margin-bottom: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.font-list-scroll {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
}

.system-font-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
}

.system-font-item:hover {
  background: var(--vp-c-bg-soft);
}

.loading {
  color: var(--vp-c-text-2);
  font-size: 14px;
}

.error {
  color: var(--vp-c-danger);
  font-size: 14px;
}
</style>
