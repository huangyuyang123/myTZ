export function getApiBases() {
  const raw = document.querySelector('meta[name="apiBase"]')?.content || location.origin
  return [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const u = new URL(s)
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw Error('API_BASE must contain origins only')
    return u.origin
  }))]
}
export const adminUrl = base => `${base}/admin#/admin`
export function wsUrl(base, scope, jwt, origin = location.origin) {
  const u = new URL('/api/ws', base)
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
  u.searchParams.set('subscribe', scope)
  if (jwt && base !== origin) u.searchParams.set('token', jwt)
  return u.toString()
}
