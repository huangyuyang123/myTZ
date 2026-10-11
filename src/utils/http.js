import { adminUrl } from './config.js'
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status } }
export const readJwt = () => localStorage.getItem('jwt_token') || ''
export function createHttp(base, {getConfig, challenge, redirect = url => location.assign(url), fetcher = fetch, storage = localStorage}) {
  const cacheKey = `cfsm:turnstile_verified:${base}`
  let redirected = false, exchange = null
  function unauthorized() { storage.removeItem('jwt_token'); if (!redirected) { redirected = true; redirect(adminUrl(base)) } }
  async function raw(path, {method = 'GET', body, token, verified, signal} = {}) {
    const headers = {}; const jwt = storage.getItem('jwt_token')
    if (jwt) headers.Authorization = `Bearer ${jwt}`
    if (getConfig()?.turnstile_enabled === true) {
      if (verified) headers['X-Turnstile-Verified'] = verified
      else if (token) headers['X-Turnstile-Token'] = token
    }
    if (body) headers['Content-Type'] = 'application/json'
    const res = await fetcher(`${base}${path}`, {method, headers, body: body ? JSON.stringify(body) : undefined, credentials:'include', signal})
    // Local validation records presence only; never log JWT or challenge credentials.
    if (import.meta.env?.DEV) console.debug('[CFSM validation]', JSON.stringify({event:'http', method, path, status:res.status, jwt:!!jwt, token:!!headers['X-Turnstile-Token'], verified:!!headers['X-Turnstile-Verified']}))
    if (res.status === 401) { unauthorized(); throw new HttpError(401, 'Authentication required') }
    if (res.status === 403) storage.removeItem(cacheKey)
    const data = await res.json().catch(() => { throw new Error(`Invalid JSON response: ${path}`) })
    if (!res.ok) throw new HttpError(res.status, data.error || data.message || `HTTP ${res.status}`)
    if (getConfig()?.turnstile_enabled === true && typeof data?.turnstile_verified === 'string' && data.turnstile_verified) storage.setItem(cacheKey, data.turnstile_verified)
    return data
  }
  async function verify() {
    if (getConfig()?.turnstile_enabled !== true) return ''
    const cached = storage.getItem(cacheKey); if (cached) return cached
    if (!exchange) exchange = (async () => {
      const token = await challenge(base, getConfig().turnstile_site_key)
      // User-authorized authentication-only exception. Does not replace cached configuration.
      const result = await raw('/api/config', {token})
      if (!result.turnstile_verified) throw new Error('Backend did not issue turnstile_verified')
      return result.turnstile_verified
    })().finally(() => { exchange = null })
    return exchange
  }
  async function request(path, options = {}) {
    if (options.bootstrap) return raw(path, options)
    if (options.requireJwt || getConfig()?.is_public !== true) {
      if (!storage.getItem('jwt_token') && getConfig()?.authorization !== true) { unauthorized(); throw new HttpError(401, 'Authentication required') }
      if (options.requireJwt && !storage.getItem('jwt_token')) { unauthorized(); throw new HttpError(401, 'JWT required') }
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const verified = await verify()
      try { return await raw(path, {...options, verified}) }
      catch (e) { if (e.status !== 403 || attempt || getConfig()?.turnstile_enabled !== true) throw e }
    }
  }
  return {request, unauthorized}
}
