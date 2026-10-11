import { HOURS } from './metrics.js'
export function createApi(http) {
  return {
    config: () => http.request('/api/config', {bootstrap:true}),
    servers: options => http.request('/api/servers', options),
    server: (id, options) => http.request(`/api/server?id=${encodeURIComponent(id)}`, options),
    history: (id, hours, options) => {
      if (!HOURS.includes(hours)) throw Error('Unsupported history range')
      return http.request(`/api/history/all?id=${encodeURIComponent(id)}&hours=${hours}`, options)
    },
    saveOptions: options => {
      if (!options || Array.isArray(options) || typeof options !== 'object') throw Error('invalidThemeOptionsFormat')
      return http.request('/api/theme_options', {method:'POST', body:{theme_options:options}, requireJwt:true})
    }
  }
}
