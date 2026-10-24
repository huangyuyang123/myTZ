<script setup>
import {computed,ref,onMounted,onBeforeUnmount} from 'vue'
import {sites,pageState,enterDashboard,leavePage} from '../composables/useMonitor.js'
import {t} from '../composables/useTheme.js'
import {bytes,isOnline} from '../utils/metrics.js'
import ServerCard from '../components/ServerCard.vue'
import SummaryArt from '../components/SummaryArt.vue'
import makimaBackground from '../../assets/makima-background.png'
const search=ref(''),filter=ref('all')
const totals=computed(()=>sites.value.reduce((sum,s)=>{for(const k of Object.keys(sum)) sum[k]+=Number(s.stats[k]||0);return sum},{total:0,online:0,offline:0,globalSpeedIn:0,globalSpeedOut:0}))
const onlineRate=computed(()=>totals.value.total>0?Math.min(100,Math.max(0,totals.value.online/totals.value.total*100)):null)
const downloadSpeeds=computed(()=>sites.value.flatMap(site=>site.servers.map(server=>({name:server.name||server.id,value:server.net_in_speed}))))
const visible=computed(()=>sites.value.flatMap(site=>site.servers.map(server=>({site,server}))).filter(({server})=>`${server.name} ${server.server_group} ${server.tags||''} ${server.region||''}`.toLowerCase().includes(search.value.toLowerCase()) && (filter.value==='all' || isOnline(server,pageState.now)===(filter.value==='online'))))
onMounted(()=>enterDashboard().catch(e=>pageState.error=e.message));onBeforeUnmount(leavePage)
</script>
<template>
  <section class="hero overview-hero">
    <img class="makima-art" :src="makimaBackground" alt="" width="1536" height="1024" fetchpriority="high" decoding="async">
    <div class="hero-copy">
      <h1>CHAINSAW MAN</h1>
    </div>
  </section>
  <section class="summary-grid">
    <article class="panel summary summary-total"><span class="summary-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="3" width="16" height="7" rx="2"/><rect x="4" y="14" width="16" height="7" rx="2"/></svg>{{t('服务器总数','Total servers')}}</span><strong>{{totals.total}}<small>{{t('台','nodes')}}</small></strong><div class="summary-foot">{{sites.length}} {{t('个监控站点','monitoring sites')}}</div><SummaryArt kind="servers"/></article>
    <article class="panel summary summary-online"><span class="summary-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m8 12 2.5 2.5L16 9"/></svg>{{t('在线节点','Online nodes')}}</span><strong class="accent">{{totals.online}}<small>/ {{totals.total}}</small></strong><div class="summary-foot"><i class="dot"></i>{{t('当前在线','Currently online')}}</div><SummaryArt kind="online" :rate="onlineRate"/></article>
    <article class="panel summary summary-offline"><span class="summary-label"><i class="offline-dot" aria-hidden="true"></i>{{t('离线节点','Offline nodes')}}</span><strong>{{totals.offline}}</strong><div class="summary-foot">{{t('暂时不可用','Currently unavailable')}}</div></article>
    <article class="panel summary summary-network"><span class="summary-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 4v16m-4-4 4 4 4-4M17 20V4m-4 4 4-4 4 4"/></svg>{{t('全站网络速率','Aggregate network')}}</span><strong class="speed"><span>↓ {{bytes(totals.globalSpeedIn,'/s').split(' ')[0]}}</span><small>{{bytes(totals.globalSpeedIn,'/s').split(' ').slice(1).join(' ')}}</small></strong><div class="summary-foot">↑ {{bytes(totals.globalSpeedOut,'/s')}}</div><SummaryArt kind="network" :speeds="downloadSpeeds"/></article>
  </section>
  <section class="fleet-toolbar">
    <div><h2>{{t('服务器','Server fleet')}} <span class="count">{{visible.length}}</span></h2><p class="muted">{{t('选择节点查看资源与网络历史','Select a node to explore resources and network history')}}</p></div>
    <div class="filters"><div class="segmented"><button v-for="f in ['all','online','offline']" :key="f" :class="{selected:filter===f}" :aria-pressed="filter===f" @click="filter=f">{{f==='all'?t('全部','All'):f==='online'?t('在线','Online'):t('离线','Offline')}}</button></div><label class="search-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input v-model="search" type="search" :placeholder="t('搜索节点、地区、标签…','Search nodes, regions, tags…')" :aria-label="t('搜索服务器','Search servers')"></label></div>
  </section>
  <div v-for="site in sites.filter(s=>s.error)" :key="site.index" role="alert" class="error-banner">{{site.config?.site_title || site.base}} · {{site.error}}</div>
  <div v-if="pageState.loading && !visible.length" class="empty panel">{{t('正在载入服务器…','Loading server fleet…')}}</div>
  <div v-else-if="!visible.length" class="empty panel">{{t('没有匹配的服务器','No matching servers')}}</div>
  <section class="server-grid"><ServerCard v-for="item in visible" :key="`${item.site.index}:${item.server.id}`" :site="item.site" :server="item.server"/></section>
  <p class="snapshot-note muted">{{t('统计来自最近一次快照。','Totals reflect the latest snapshot.')}}</p>
</template>
