import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
const escape = value => String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export default defineConfig({
  base: './',
  plugins: [vue(), {
    name: 'runtime-meta',
    transformIndexHtml(html) {
      html = html.replace('name="apiBase" content=""', `name="apiBase" content="${escape(process.env.API_BASE)}"`)
        .replace('name="backgroundImage" content=""', `name="backgroundImage" content="${escape(process.env.BACKGROUND_IMAGE)}"`)
        .replace('<title></title>', `<title>${escape(process.env.TITLE)}</title>`)
      const api = (process.env.API_BASE || '').split(',').filter(Boolean).flatMap(base => {
        const url = new URL(base.trim()); return [url.origin, url.origin.replace(/^http/, 'ws')]
      })
      const extra = value => (value || '').split(/[\s,]+/).filter(Boolean).map(v => {
        const url = new URL(v); if (!['https:', 'http:', 'wss:', 'ws:'].includes(url.protocol)) throw Error('Invalid CSP origin'); return url.origin
      })
      const staticOrigins = extra(process.env.CSP_STATIC)
      // Inline scripts/styles are required for administrator-controlled appearance snippets and Vue styles.
      const csp = `default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com ${staticOrigins.join(' ')}; style-src 'self' 'unsafe-inline' ${staticOrigins.join(' ')}; img-src 'self' data: ${[...api.filter(x => /^http/.test(x)), ...staticOrigins].join(' ')}; font-src 'self' ${staticOrigins.join(' ')}; connect-src 'self' ${[...api, ...extra(process.env.CSP_API)].join(' ')}; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'`
      return html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${escape(csp)}">`)
    }
  }],
  build: { assetsDir: 'assets', sourcemap: false }
})
