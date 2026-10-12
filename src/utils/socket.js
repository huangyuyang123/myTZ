import { wsUrl } from './config.js'
import { jwtExpiresAt, jwtExpired } from './auth.js'
export function createSocket({base, scope, ids, jwt, requireAuth = false, deadline = 0, onBatch, onStatus, onTimeout, onUnauthorized, WebSocketClass = WebSocket, clock = {now: () => Date.now(), set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id)}}) {
  let socket, timer, expiry, authExpiry, stopped = false, attempts = 0
  const currentJwt = () => (typeof jwt === 'function' ? jwt() : jwt) || ''
  const end = () => { stopped = true; clock.clear(timer); clock.clear(expiry); clock.clear(authExpiry); const old = socket; socket = null; if (old) old.close() }
  const expire = () => { end(); onStatus('paused'); onTimeout() }
  const unauthorized = token => { end(); onStatus('unauthorized'); onUnauthorized(token) }
  function expireAuth() {
    if (stopped) return
    const latest = currentJwt()
    if (!latest || jwtExpired(latest, clock.now())) return unauthorized(latest)
    // A new login happened before the previous token expired. Reconnect with that login.
    const old = socket; socket = null; if (old) old.close()
    clock.clear(timer)
    connect()
  }
  function scheduleAuthExpiry(token) {
    clock.clear(authExpiry)
    const expires = requireAuth ? jwtExpiresAt(token) : null
    if (expires !== null) authExpiry = clock.set(expireAuth, Math.min(2147483647, Math.max(0, expires - clock.now())))
  }
  const connect = () => {
    if (stopped) return
    if (deadline && clock.now() >= deadline) return expire()
    const token = currentJwt()
    if (requireAuth && token && jwtExpired(token, clock.now())) return unauthorized(token)
    onStatus('connecting')
    const target = wsUrl(base, scope, token)
    let current
    try { current = new WebSocketClass(target) }
    catch { end(); onStatus('blocked'); return }
    socket = current
    scheduleAuthExpiry(token)
    current.onopen = () => {
      if (stopped || socket !== current) return
      current.send(JSON.stringify({type:'subscribe', scope, ids})); onStatus('live')
      if (import.meta.env?.DEV) console.debug('[CFSM validation]', JSON.stringify({event:'ws-open', scope:scope==='all'?'all':'single', idCount:ids.length, urlToken:new URL(target).searchParams.has('token')}))
    }
    current.onmessage = event => {
      if (stopped || socket !== current) return
      try { const msg = JSON.parse(event.data); if (msg.type === 'batchUpdate') onBatch(msg) } catch (error) { onStatus('invalid-message') }
    }
    current.onerror = () => { if (socket === current && !stopped) { onStatus('error'); current.close() } }
    current.onclose = event => {
      if (stopped || socket !== current) return
      socket = null
      if ([1008, 4401].includes(event.code) && currentJwt() === token) return unauthorized(token)
      if (requireAuth && token && currentJwt() === token && jwtExpired(token, clock.now())) return unauthorized(token)
      if (attempts >= 6) { end(); onStatus('exhausted'); return }
      const delay = Math.min(30000, 1000 * 2 ** attempts++)
      onStatus('reconnecting'); timer = clock.set(connect, delay)
    }
  }
  if (deadline) expiry = clock.set(expire, Math.max(0, deadline - clock.now()))
  connect()
  // Attempts do not reset on open: a server that accepts then closes cannot loop forever.
  return {close: end}
}
