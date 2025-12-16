import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './custom.css'
import CopyOrDownloadAsMarkdownButtons from 'vitepress-plugin-llms/vitepress-components/CopyOrDownloadAsMarkdownButtons.vue'
import FontPicker from '../components/FontPicker.vue'
import ShapingPlayground from '../components/ShapingPlayground.vue'
import VariableFontPlayground from '../components/VariableFontPlayground.vue'
import GlyphInspector from '../components/GlyphInspector.vue'
import RasterPreview from '../components/RasterPreview.vue'
import BenchmarkChart from '../components/BenchmarkChart.vue'
import BenchmarkSummary from '../components/BenchmarkSummary.vue'
import BenchmarkHero from '../components/BenchmarkHero.vue'
import BenchmarkFromData from '../components/BenchmarkFromData.vue'
import BenchmarkEnv from '../components/BenchmarkEnv.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('CopyOrDownloadAsMarkdownButtons', CopyOrDownloadAsMarkdownButtons)
    app.component('FontPicker', FontPicker)
    app.component('ShapingPlayground', ShapingPlayground)
    app.component('VariableFontPlayground', VariableFontPlayground)
    app.component('GlyphInspector', GlyphInspector)
    app.component('RasterPreview', RasterPreview)
    app.component('BenchmarkChart', BenchmarkChart)
    app.component('BenchmarkSummary', BenchmarkSummary)
    app.component('BenchmarkHero', BenchmarkHero)
    app.component('BenchmarkFromData', BenchmarkFromData)
    app.component('BenchmarkEnv', BenchmarkEnv)
  }
} satisfies Theme
