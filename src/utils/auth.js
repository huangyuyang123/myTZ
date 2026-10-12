// Decode only the expiry hint. The backend remains responsible for signature verification.
export function jwtExpiresAt(token) {
  try {
    const parts = String(token || '').split('.')
    if (parts.length !== 3) return null
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')), char => char.charCodeAt(0))
    const claims = JSON.parse(new TextDecoder().decode(bytes))
    return typeof claims.exp === 'number' && Number.isFinite(claims.exp) ? claims.exp * 1000 : null
  } catch { return null }
}
export function jwtExpired(token, now = Date.now()) {
  const expires = jwtExpiresAt(token)
  return expires !== null && now >= expires
}
