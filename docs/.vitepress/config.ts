import { defineConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'
import { copyOrDownloadAsMarkdownButtons } from 'vitepress-plugin-llms'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "TextShaper",
  description: "Pure TypeScript text shaping engine with OpenType layout, TrueType hinting, and FreeType-style rasterization",
  vite: {
    plugins: [
      llmstxt({
        generateLLMsFullTxt: true,
      })
    ]
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/font' },
      { text: 'Advanced', link: '/advanced/architecture' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Basic Usage', link: '/guide/basic-usage' },
            { text: 'OpenType Features', link: '/guide/features' },
            { text: 'Variable Fonts', link: '/guide/variable-fonts' },
            { text: 'Complex Scripts', link: '/guide/complex-scripts' },
            { text: 'Unicode Processing', link: '/guide/unicode' },
            { text: 'Rendering', link: '/guide/rendering' },
            { text: 'Rasterization', link: '/guide/rasterization' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Font', link: '/api/font' },
            { text: 'Buffer', link: '/api/buffer' },
            { text: 'Shaping', link: '/api/shaping' },
            { text: 'Rendering', link: '/api/rendering' },
            { text: 'Raster', link: '/api/raster' },
            { text: 'Tables', link: '/api/tables' }
          ]
        }
      ],
      '/advanced/': [
        {
          text: 'Advanced',
          items: [
            { text: 'Architecture', link: '/advanced/architecture' },
            { text: 'Shape Plans', link: '/advanced/shape-plan' },
            { text: 'Custom Features', link: '/advanced/custom-features' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/wiedymi/text-shaper' }
    ]
  },
  markdown: {
    config(md) {
      md.use(copyOrDownloadAsMarkdownButtons)
    }
  }
})
