import { wsUrl } from './config.js'
export function createSocket({base, scope, ids, jwt, deadline = 0, onBatch, onStatus, onTimeout, onUnauthorized, WebSocketClass = WebSocket, clock = {now: () => Date.now(), set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id)}}) {
  let socket, timer, expiry, stopped = false, attempts = 0
  const end = () => { stopped = true; clock.clear(timer); clock.clear(expiry); const old = socket; socket = null; if (old) old.close() }
  const expire = () => { end(); onStatus('paused'); onTimeout() }
  const connect = () => {
    if (stopped) return
    if (deadline && clock.now() >= deadline) return expire()
    onStatus('connecting')
    const target = wsUrl(base, scope, jwt)
    const current = new WebSocketClass(target); socket = current
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
      if ([1008, 4401].includes(event.code)) { end(); onUnauthorized(); return }
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
