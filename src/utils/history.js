import {gpu, timestamp} from './metrics.js'

const resourceKeys = ['cpu', 'ram_used', 'swap_used', 'net_in_speed', 'net_out_speed']

function chartValues(row) {
  const values = {}
  for (const key of resourceKeys) if (key in row) values[key] = row[key]
  for (const key of Object.keys(row)) if (/^(ping|loss)_/.test(key)) values[key] = row[key]
  for (const key of ['read_bps', 'write_bps']) if (row.disk && key in row.disk) values[`disk:${key}`] = row.disk[key]
  for (const device of gpu(row.gpu_info)) values[`gpu:${device.id}`] = device.info
  return values
}

function representatives(rows, values, cutoff, duration, bucketCount) {
  const buckets = new Map()
  rows.forEach((row, index) => {
    const key = Math.min(bucketCount - 1, Math.floor((timestamp(row.timestamp) - cutoff) / duration * bucketCount))
    let bucket = buckets.get(key)
    if (!bucket) { bucket = {first:index, last:index, extrema:new Map(), markers:new Map()}; buckets.set(key, bucket) }
    bucket.last = index
    for (const [field, value] of Object.entries(values[index])) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        const range = bucket.extrema.get(field)
        if (!range) bucket.extrema.set(field, {min:value, max:value, minIndex:index, maxIndex:index})
        else {
          if (value < range.min) { range.min = value; range.minIndex = index }
          if (value > range.max) { range.max = value; range.maxIndex = index }
        }
      } else if (value === null || value === false) {
        const marker = `${field}:${value}`
        if (!bucket.markers.has(marker)) bucket.markers.set(marker, index)
      }
    }
  })
  const selected = new Set()
  for (const bucket of buckets.values()) {
    selected.add(bucket.first); selected.add(bucket.last)
    for (const range of bucket.extrema.values()) { selected.add(range.minIndex); selected.add(range.maxIndex) }
    for (const index of bucket.markers.values()) selected.add(index)
  }
  return [...selected].sort((a,b) => a-b).map(index => rows[index])
}

// Bound chart memory across the entire selected time window, without querying history again.
// Retain complete real rows: no invented averages, null-to-zero conversion, or recent-only slicing.
export function compactHistory(history, hours, now = Date.now(), maxPoints = 1200) {
  const duration = hours * 3600000, cutoff = now - duration
  const limit = Number.isFinite(maxPoints) ? Math.max(2, Math.floor(maxPoints)) : 1200
  const unique = new Map()
  for (const row of history) {
    const ts = timestamp(row.timestamp)
    if (ts > 0 && ts >= cutoff) unique.set(ts, row)
  }
  const rows = [...unique.values()].sort((a,b) => timestamp(a.timestamp)-timestamp(b.timestamp))
  if (rows.length <= limit) return rows
  const values = rows.map(chartValues)
  let bucketCount = Math.max(1, Math.floor(limit / 2))
  while (true) {
    const selected = representatives(rows, values, cutoff, duration, bucketCount)
    if (selected.length <= limit) return selected
    if (bucketCount === 1) {
      // An exceptional number of different series can exceed the budget even in one bucket.
      // Keep both ends of the time window rather than discarding the older history.
      return Array.from({length:limit}, (_,i) => selected[Math.round(i*(selected.length-1)/(limit-1))])
    }
    bucketCount = Math.max(1, Math.floor(bucketCount / 2))
  }
}
