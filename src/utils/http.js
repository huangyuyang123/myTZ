import { adminUrl } from './config.js'
import { jwtExpired } from './auth.js'
export class HttpError extends Error { constructor(status, message, kind = 'http') { super(message); this.status = status; this.kind = kind } }
export const readJwt = () => localStorage.getItem('jwt_token') || ''
export function createHttp(base, {getConfig, challenge, redirect = url => location.assign(url), fetcher = fetch, storage = localStorage}) {
  const cacheKey = `cfsm:turnstile_verified:${base}`
  let redirected = false, exchange = null
  function unauthorized(expectedJwt = storage.getItem('jwt_token') || '') {
    // A late response for an old login must not erase a replacement login.
    if ((storage.getItem('jwt_token') || '') !== expectedJwt) return false
    storage.removeItem('jwt_token')
    if (!redirected) { redirected = true; redirect(adminUrl(base)) }
    return true
  }
  async function raw(path, {method = 'GET', body, token, verified, signal} = {}) {
    const headers = {}; const jwt = storage.getItem('jwt_token')
    if (jwt) headers.Authorization = `Bearer ${jwt}`
    if (getConfig()?.turnstile_enabled === true) {
      if (verified) headers['X-Turnstile-Verified'] = verified
      else if (token) headers['X-Turnstile-Token'] = token
    }
    if (body) headers['Content-Type'] = 'application/json'
    let res
    try { res = await fetcher(`${base}${path}`, {method, headers, body: body ? JSON.stringify(body) : undefined, credentials:'include', signal}) }
    catch (error) {
      if (error?.name === 'AbortError') throw error
      // Browsers deliberately hide whether fetch failed due to CORS, CSP or networking.
      throw new HttpError(0, 'Network request failed. Check the connection, CORS and CSP settings.', 'network')
    }
    // Local validation records presence only; never log JWT or challenge credentials.
    if (import.meta.env?.DEV) console.debug('[CFSM validation]', JSON.stringify({event:'http', method, path, status:res.status, jwt:!!jwt, token:!!headers['X-Turnstile-Token'], verified:!!headers['X-Turnstile-Verified']}))
    if (res.status === 401) {
      const replacement = storage.getItem('jwt_token') || ''
      const error = new HttpError(401, 'Authentication required', 'authentication')
      error.retryAuth = !!replacement && replacement !== (jwt || '')
      if (!error.retryAuth) unauthorized(jwt || '')
      throw error
    }
    let data
    try { data = await res.json() }
    catch { throw new HttpError(res.status, res.ok ? `Invalid JSON response: ${path}` : `HTTP ${res.status}`, res.ok ? 'invalid-response' : 'http') }
    if (!res.ok) {
      const message = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : `HTTP ${res.status}`
      // Only the Worker's explicit verification rejection invalidates this credential.
      const verificationFailed = res.status === 403 && getConfig()?.turnstile_enabled === true && message.trim().toLowerCase() === 'turnstile verification failed'
      if (verificationFailed && verified && storage.getItem(cacheKey) === verified) storage.removeItem(cacheKey)
      throw new HttpError(res.status, message, verificationFailed ? 'turnstile' : 'http')
    }
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
      const jwt = storage.getItem('jwt_token') || ''
      if (jwt && jwtExpired(jwt)) { unauthorized(jwt); throw new HttpError(401, 'Authentication expired', 'authentication') }
      if (!storage.getItem('jwt_token') && getConfig()?.authorization !== true) { unauthorized(); throw new HttpError(401, 'Authentication required', 'authentication') }
      if (options.requireJwt && !storage.getItem('jwt_token')) { unauthorized(); throw new HttpError(401, 'JWT required', 'authentication') }
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const verified = await verify()
      try { return await raw(path, {...options, verified}) }
      catch (e) {
        if (attempt || !(e.kind === 'turnstile' || e.status === 401 && e.retryAuth)) throw e
      }
    }
  }
  return {request, unauthorized}
}
