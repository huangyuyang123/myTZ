import { computed } from 'vue'
import { sites } from './useMonitor.js'
export const config = computed(() => sites.value[0]?.config || {})
export const language = computed(() => config.value.default_language === 'auto' || !config.value.default_language ? navigator.language.startsWith('zh') ? 'zh' : 'en' : config.value.default_language.startsWith('zh') ? 'zh' : 'en')
export const t = (zh, en) => language.value === 'zh' ? zh : en
export const defaults = {density:'comfortable', accent:'#22c7aa', showCharts:true}
export const options = computed(() => ({...defaults, ...(config.value.theme_options && !Array.isArray(config.value.theme_options) ? config.value.theme_options : {})}))
const initialTitle = document.title
const initialBackground = document.querySelector('meta[name="backgroundImage"]')?.content
let injected = false
export function applyAppearance() {
  const c = config.value
  document.title = c.site_title || initialTitle || 'CF-Server-Monitor'
  document.documentElement.lang = language.value
  document.documentElement.dataset.theme = ['light','dark'].includes(c.preferred_theme) ? c.preferred_theme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  const accent = /^#[0-9a-f]{6}$/i.test(options.value.accent) ? options.value.accent : defaults.accent
  document.documentElement.style.setProperty('--accent', accent)
  document.documentElement.dataset.density = options.value.density === 'compact' ? 'compact' : 'comfortable'
  const background = c.background_image || c.site_background || initialBackground
  if (background) {
    const u = new URL(background, location.origin)
    if (['https:','http:'].includes(u.protocol)) document.body.style.backgroundImage = `linear-gradient(var(--backdrop),var(--backdrop)),url(${JSON.stringify(u.href)})`
  }
  if (!injected && sites.value[0]?.config) {
    injected = true
    // These snippets are explicitly trusted administrator appearance configuration.
    for (const [parent, html] of [[document.head, c.custom_head || c.custom_html_head]]) {
      if (!html) continue
      const template = document.createElement('template'); template.innerHTML = html
      for (const node of [...template.content.childNodes]) {
        if (node.nodeName === 'SCRIPT') {
          const script = document.createElement('script')
          for (const a of node.attributes) script.setAttribute(a.name,a.value)
          script.textContent = node.textContent; parent.append(script)
        } else parent.append(node)
      }
    }
    if (c.custom_script || c.custom_js) {
      const script = document.createElement('script'); script.textContent = c.custom_script || c.custom_js; document.body.append(script)
    }
  }
}
