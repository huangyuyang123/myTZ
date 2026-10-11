export const HOURS = [0.167, 0.5, 1, 6, 12, 24, 48, 96, 168]
export const FIELDS = new Set(('cpu ram_total ram_used swap_total swap_used disk_total disk_used disk gpu_info net_in_speed net_out_speed net_rx net_tx net_rx_monthly net_tx_monthly processes tcp_conn udp_conn load_avg boot_time last_updated timestamp sample_timestamp kernel_version ping_ct ping_cu ping_cm ping_bd loss_ct loss_cu loss_cm loss_bd ' + Array.from({length:4}, (_, i) => `ping_node_${i+1} loss_node_${i+1}`).join(' ')).split(/\s+/))
export const timestamp = value => { const n = Number(value); return Number.isFinite(n) ? n : 0 }
export const isOnline = (server, now = Date.now()) => timestamp(server.last_updated) > 0 && now - timestamp(server.last_updated) < 300000
export function gpu(value) {
  if (typeof value === 'string') { try { value = JSON.parse(value) } catch { return [] } }
  return Array.isArray(value) ? value : []
}
export function mergeMetrics(previous, patch) {
  const next = { ...previous }
  for (const [key, value] of Object.entries(patch || {})) {
    if (!FIELDS.has(key) || value === undefined) continue
    next[key] = key === 'gpu_info' ? gpu(value) : key === 'disk' && value && typeof value === 'object' ? { ...previous.disk, ...value } : value
  }
  return next
}
export function batches(message, allowedIds) {
  if (message.type !== 'batchUpdate') return []
  return (message.updates || []).filter(u => allowedIds.has(String(u.serverId))).flatMap(u =>
    (u.samples || []).map(s => ({ id: String(u.serverId), ts: timestamp(s.ts ?? s.timestamp), report: timestamp(u.reportTs ?? message.ts), age: u.reportAgeMs, data: s.data || s.payload || s.metrics })).filter(s => s.data && typeof s.data === 'object')
  ).sort((a, b) => a.ts - b.ts)
}
export function probe(value, unit, timeout = 'Timeout') {
  if (value === false || value === undefined) return null
  if (value === null) return timeout
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}${unit}` : null
}
export function bytes(value, suffix = '') {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return '—'
  const n = Math.max(0, Number(value)); const i = n ? Math.min(4, Math.floor(Math.log(n) / Math.log(1024))) : 0
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${['B','KB','MB','GB','TB'][i]}${suffix}`
}
export const percent = (used, total) => Number(total) > 0 ? Math.min(100, Math.max(0, Number(used || 0) / Number(total) * 100)) : null
export const price = s => ['0','-1'].includes(String(s.price)) ? 'free' : String(s.price ?? '').trim() ? `${s.currency || ''}${s.price} / ${s.billing_cycle || ''}` : ''
export function probeLines(config) {
  return ['ct','cu','cm','bd', ...Array.from({length:4},(_,i)=>`node_${i+1}`)].map((key,i) => ({ key, label: i < 4 ? config[`custom_${key}_name`] || ['CT','CU','CM','BGP'][i] : config[`${key}_name`] || `Node ${i-3}`, color: ['#22c7aa','#8d9cff','#f5ba64','#eb80bc','#7dd3fc','#c4b5fd','#bef264','#fb923c'][i] }))
}
