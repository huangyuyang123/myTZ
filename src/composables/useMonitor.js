import { shallowReactive, shallowRef } from 'vue'
import { getApiBases } from '../utils/config.js'
import { createHttp, readJwt } from '../utils/http.js'
import { createApi } from '../utils/api.js'
import { createSocket } from '../utils/socket.js'
import { batches, mergeMetrics, gpu, timestamp } from '../utils/metrics.js'
import { compactHistory } from '../utils/history.js'
import { requestChallenge } from './challenge.js'

export const sites = shallowRef([])
export const pageState = shallowReactive({loading:false, error:'', paused:false, now:Date.now()})
let bootPromise, active
let loginRedirected = false
function redirectToLogin(url) {
  if (loginRedirected) return
  loginRedirected = true
  stopConnections()
  location.assign(url)
}
const normalized = s => ({...s, gpu_info:gpu(s.gpu_info)})
export function bootstrap() {
  if (!bootPromise) bootPromise = (async () => {
    sites.value = getApiBases().map((base, index) => {
      const site = shallowReactive({base, index, config:null, servers:[], stats:{}, sysConfig:{}, status:'idle', error:'', configPromise:null, listPromise:null, deadline:0, paused:false, details:new Map()})
      site.http = createHttp(base, {getConfig:()=>site.config, challenge:requestChallenge, redirect:redirectToLogin})
      site.api = createApi(site.http)
      site.configPromise = site.api.config().then(config => {
        site.config = config
        if (import.meta.env?.DEV) console.debug('[CFSM validation]', JSON.stringify({event:'config', site:index, public:config.is_public, turnstile:config.turnstile_enabled, authorized:config.authorization}))
        return config
      })
      return site
    })
    const results = await Promise.allSettled(sites.value.map(s => s.configPromise))
    results.forEach((r,i) => { if (r.status === 'rejected') sites.value[i].error = r.reason.message })
    if (!sites.value.some(s => s.config)) throw Error(results[0].reason.message)
    document.addEventListener('visibilitychange', visibility)
    return sites.value
  })()
  return bootPromise
}
async function list(site, restore = false) {
  if (!site.listPromise || restore) site.listPromise = site.api.servers().then(data => {
    if (!Array.isArray(data.servers)) throw Error('Invalid server list')
    site.servers = data.servers.map(normalized); site.stats = data.stats || {}; site.sysConfig = data.sysConfig || {}
    return data
  })
  return site.listPromise
}
function stopConnections() {
  if (!active) return
  active.generation++
  for (const socket of active.sockets) socket.close()
  active.sockets = []
  clearTimeout(active.flushTimer); active.flushTimer = null; active.pending.clear()
  clearTimeout(active.expiryTimer)
}
export function leavePage() {
  stopConnections(); active = null
}
function page(kind, site, id, detail) {
  leavePage()
  active = {kind, site, id, detail, sockets:[], pending:new Map(), fieldTimes:new Map(), flushTimer:null, lastFlush:0, generation:0, loading:false}
  pageState.error = ''; pageState.loading = true; pageState.paused = false
  return active
}
export async function enterDashboard() {
  const p = page('dashboard')
  await bootstrap()
  if (active !== p) return
  await load(p, false)
}
export async function enterDetail(siteIndex, id, target) {
  const p = page('detail', null, String(id), target)
  await bootstrap()
  if (active !== p) return
  const site = sites.value[siteIndex]
  if (!site?.config) { pageState.error = 'Backend configuration unavailable'; pageState.loading = false; return }
  p.site = site
  await load(p, false)
}
async function load(p, restore) {
  if (p.loading || document.hidden || active !== p) { pageState.loading = false; return }
  p.loading = true
  const generation = p.generation
  const valid = () => active === p && generation === p.generation && !document.hidden
  pageState.loading = true
  try {
    if (p.kind === 'dashboard') {
      await Promise.all(sites.value.filter(s => s.config && (!restore || !s.paused)).map(async site => {
        try { await list(site, restore); if (valid()) { site.error = ''; connect(p, site, 'all', site.servers.map(s=>String(s.id))) } }
        catch (e) { site.error = e.message }
      }))
    } else {
      const site = p.site
      const key = p.id
      let cached = site.details.get(key)
      if (!cached) {
        cached = {hours:0.167, promise: Promise.all([site.api.server(key), site.api.history(key, 0.167)]).then(([server,history]) => {
          if (!Array.isArray(history)) throw Error('Invalid history response')
          return {server:normalized(server), history:compactHistory(history.map(normalized), 0.167), hours:0.167}
        })}
        site.details.set(key, cached)
      }
      let data = await cached.promise
      // Visibility restoration refreshes current metrics once, never automatically re-queries history.
      if (restore) { data.server = normalized(await site.api.server(key)); cached.promise = Promise.resolve(data) }
      if (valid()) { Object.assign(p.detail, data); connect(p, site, p.id, [p.id]) }
    }
    if (valid()) { pageState.paused = sites.value.some(s => s.paused); pageState.now = Date.now(); scheduleExpiry(p) }
  } catch (e) { if (active === p) pageState.error = e.message }
  finally {
    p.loading = false
    if (active === p) pageState.loading = false
    // A hide/show during the initial request must not lose the visible-page reconnection.
    if (active === p && p.generation !== generation && !document.hidden) await load(p, true)
  }
}
function connect(p, site, scope, ids) {
  if (site.paused || active !== p || document.hidden) { pageState.paused ||= site.paused; return }
  const minutes = Number(site.config.frontend_ws_timeout_minutes) || 0
  if (!site.deadline && minutes > 0) site.deadline = Date.now() + minutes * 60000
  const generation = p.generation
  const valid = () => active === p && p.generation === generation && !document.hidden
  const socket = createSocket({base:site.base, scope, ids, jwt:readJwt, requireAuth:site.config.is_public !== true, deadline:site.deadline,
    onStatus: status => {
      if (!valid()) return
      site.status = status
      const lang = site.config.default_language
      const zh = (!lang || lang === 'auto' ? navigator.language : lang).startsWith('zh')
      if (status === 'blocked') site.error = zh ? '浏览器阻止了实时连接，请检查后台 CSP API 域名白名单。' : 'The browser blocked the live connection. Check the backend CSP API allowlist.'
      if (status === 'exhausted') site.error = zh ? '实时连接重试已停止，请通过管理入口重新登录，或刷新页面重试。' : 'Live connection retries stopped. Sign in through the admin link or refresh to retry.'
    },
    onUnauthorized: jwt => { if (valid()) site.http.unauthorized(jwt) },
    onTimeout: () => { if (active === p) { site.paused = true; pageState.paused = true } },
    onBatch: msg => { if (valid()) enqueue(p, site, msg, new Set(ids)) }
  })
  p.sockets.push(socket)
}
function enqueue(p, site, message, allowed) {
  for (const sample of batches(message, allowed)) {
    const key = `${site.index}:${sample.id}`
    const record = p.pending.get(key) || {site, id:sample.id, patch:{}, ts:0}
    const times = p.fieldTimes.get(key) || {}
    const patch = {}
    const ts = sample.ts || sample.report || Date.now()
    for (const [field,value] of Object.entries(sample.data)) {
      if (ts >= (times[field] || 0)) { patch[field] = value; times[field] = ts }
    }
    // Retain the report timestamp, including replay age, rather than making old replay samples appear fresh.
    const reportTs = sample.age != null ? Date.now() - Math.max(0, Number(sample.age)) : sample.report || timestamp(sample.data.last_updated) || ts
    patch.last_updated = Math.max(timestamp(record.patch.last_updated), reportTs)
    record.patch = mergeMetrics(record.patch, patch); record.ts = Math.max(record.ts, ts)
    p.pending.set(key, record); p.fieldTimes.set(key, times)
  }
  if (!p.pending.size || p.flushTimer) return
  p.flushTimer = setTimeout(() => flush(p), Math.max(0, 1000 - (Date.now() - p.lastFlush)))
}
function flush(p) {
  p.flushTimer = null
  if (active !== p || document.hidden) return
  p.lastFlush = Date.now()
  pageState.now = p.lastFlush
  if (import.meta.env?.DEV) console.debug('[CFSM validation]', JSON.stringify({event:'ws-merge', page:p.kind, updatedServers:p.pending.size}))
  if (p.kind === 'dashboard') {
    const groups = new Map()
    for (const record of p.pending.values()) {
      if (!groups.has(record.site)) groups.set(record.site, new Map())
      groups.get(record.site).set(record.id, record.patch)
    }
    for (const [site, patches] of groups) site.servers = site.servers.map(server => {
      const patch = patches.get(String(server.id))
      return patch ? mergeMetrics(server, {...patch,last_updated:Math.max(timestamp(server.last_updated),timestamp(patch.last_updated))}) : server
    })
    p.pending.clear()
    scheduleExpiry(p)
    return
  }
  for (const record of p.pending.values()) {
    {
      p.detail.server = mergeMetrics(p.detail.server, record.patch)
      const row = {...p.detail.server, timestamp:record.ts}
      p.detail.history = compactHistory([...p.detail.history, row], p.detail.hours)
      p.site.details.set(p.id, {promise:Promise.resolve({server:p.detail.server, history:p.detail.history, hours:p.detail.hours})})
    }
  }
  p.pending.clear()
  scheduleExpiry(p)
}
function scheduleExpiry(p) {
  clearTimeout(p.expiryTimer)
  if (active !== p || document.hidden) return
  const servers = p.kind === 'dashboard' ? sites.value.flatMap(s=>s.servers) : [p.detail.server]
  const deadlines = servers.map(s=>timestamp(s.last_updated)+300000).filter(ts=>ts>pageState.now)
  if (!deadlines.length) return
  p.expiryTimer = setTimeout(()=>{
    if (active !== p || document.hidden) return
    pageState.now = Date.now(); scheduleExpiry(p)
  },Math.max(1000,Math.min(...deadlines)-Date.now()+1))
}
let historyRevision = 0
export async function changeRange(hours) {
  const p = active
  if (!p || p.kind !== 'detail' || hours === p.detail.hours || document.hidden) return
  const ticket = ++historyRevision
  p.detail.historyLoading = true
  try {
    const rows = await p.site.api.history(p.id, hours)
    if (!Array.isArray(rows)) throw Error('Invalid history response')
    if (active !== p || ticket !== historyRevision) return
    p.detail.hours = hours; p.detail.history = compactHistory(rows.map(normalized), hours); pageState.error = ''
    p.site.details.set(p.id, {promise:Promise.resolve({server:p.detail.server, history:p.detail.history, hours})})
  } catch(e) { if (active === p) pageState.error = e.message }
  finally { if (active === p && ticket === historyRevision) p.detail.historyLoading = false }
}
async function visibility() {
  const p = active; if (!p) return
  if (document.hidden) { stopConnections(); for (const site of sites.value) if (!site.paused) site.status = 'hidden' }
  else {
    if (p.kind === 'detail' && p.site.paused || p.kind === 'dashboard' && sites.value.every(s=>s.paused)) { pageState.paused = true; return }
    await load(p, true)
  }
}
export async function continueLive() {
  if (!active || document.hidden) return
  const p = active; stopConnections()
  for (const site of sites.value) if (site.paused) { site.paused = false; site.deadline = 0 }
  pageState.paused = false
  await load(p, true)
}
