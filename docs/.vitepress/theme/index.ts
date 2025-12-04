import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import CopyOrDownloadAsMarkdownButtons from 'vitepress-plugin-llms/vitepress-components/CopyOrDownloadAsMarkdownButtons.vue'
import FontPicker from '../components/FontPicker.vue'
import ShapingPlayground from '../components/ShapingPlayground.vue'
import VariableFontPlayground from '../components/VariableFontPlayground.vue'
import GlyphInspector from '../components/GlyphInspector.vue'
import RasterPreview from '../components/RasterPreview.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('CopyOrDownloadAsMarkdownButtons', CopyOrDownloadAsMarkdownButtons)
    app.component('FontPicker', FontPicker)
    app.component('ShapingPlayground', ShapingPlayground)
    app.component('VariableFontPlayground', VariableFontPlayground)
    app.component('GlyphInspector', GlyphInspector)
    app.component('RasterPreview', RasterPreview)
  }
} satisfies Theme
