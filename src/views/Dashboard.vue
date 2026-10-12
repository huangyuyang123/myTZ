<script setup>
import {computed,ref,onMounted,onBeforeUnmount} from 'vue'
import {sites,pageState,enterDashboard,leavePage} from '../composables/useMonitor.js'
import {t} from '../composables/useTheme.js'
import {bytes,isOnline} from '../utils/metrics.js'
import ServerCard from '../components/ServerCard.vue'
import makimaBackground from '../../assets/makima-background.png'
const search=ref(''),filter=ref('all')
const totals=computed(()=>sites.value.reduce((sum,s)=>{for(const k of Object.keys(sum)) sum[k]+=Number(s.stats[k]||0);return sum},{total:0,online:0,offline:0,globalSpeedIn:0,globalSpeedOut:0}))
const visible=computed(()=>sites.value.flatMap(site=>site.servers.map(server=>({site,server}))).filter(({server})=>`${server.name} ${server.server_group} ${server.tags||''} ${server.region||''}`.toLowerCase().includes(search.value.toLowerCase()) && (filter.value==='all' || isOnline(server,pageState.now)===(filter.value==='online'))))
onMounted(()=>enterDashboard().catch(e=>pageState.error=e.message));onBeforeUnmount(leavePage)
</script>
<template>
  <section class="hero overview-hero">
    <img class="makima-art" :src="makimaBackground" alt="" width="1536" height="1024" fetchpriority="high" decoding="async">
    <div class="hero-copy">
      <h1>CHAINSAW MAN</h1>
      <div class="hero-meta">
        <div class="live-indicator"><i :class="{live:sites.some(s=>s.status==='live')}"></i>{{sites.some(s=>s.status==='live')?t('实时连接','Live connection'):t('静态快照','Last snapshot')}}</div>
      </div>
    </div>
  </section>
  <section class="summary-grid">
    <article class="panel summary"><span>{{t('服务器总数','Total servers')}}</span><strong>{{totals.total}}<small>{{t('台','nodes')}}</small></strong><div class="summary-foot">{{sites.length}} {{t('个监控站点','monitoring sites')}}</div></article>
    <article class="panel summary"><span>{{t('在线节点','Online nodes')}}</span><strong class="accent">{{totals.online}}<small>/ {{totals.total}}</small></strong><div class="summary-foot"><i class="dot"></i>{{t('后端统计口径','Backend snapshot')}}</div></article>
    <article class="panel summary"><span>{{t('离线节点','Offline nodes')}}</span><strong>{{totals.offline}}</strong><div class="summary-foot">{{t('最近一次列表快照','Last server-list snapshot')}}</div></article>
    <article class="panel summary"><span>{{t('全站网络速率','Aggregate network')}}</span><strong class="speed">{{bytes(totals.globalSpeedIn,'/s')}}</strong><div class="summary-foot">↑ {{bytes(totals.globalSpeedOut,'/s')}}</div></article>
  </section>
  <section class="fleet-toolbar">
    <div><h2>{{t('服务器','Server fleet')}} <span class="count">{{visible.length}}</span></h2><p class="muted">{{t('选择节点查看资源与网络历史','Select a node to explore resources and network history')}}</p></div>
    <div class="filters"><div class="segmented"><button v-for="f in ['all','online','offline']" :key="f" :class="{selected:filter===f}" @click="filter=f">{{f==='all'?t('全部','All'):f==='online'?t('在线','Online'):t('离线','Offline')}}</button></div><input v-model="search" type="search" :placeholder="t('搜索节点、地区、标签…','Search nodes, regions, tags…')" :aria-label="t('搜索服务器','Search servers')"></div>
  </section>
  <div v-for="site in sites.filter(s=>s.error)" :key="site.index" role="alert" class="error-banner">{{site.config?.site_title || site.base}} · {{site.error}}</div>
  <div v-if="pageState.loading && !visible.length" class="empty panel">{{t('正在载入服务器…','Loading server fleet…')}}</div>
  <div v-else-if="!visible.length" class="empty panel">{{t('没有匹配的服务器','No matching servers')}}</div>
  <section class="server-grid"><ServerCard v-for="item in visible" :key="`${item.site.index}:${item.server.id}`" :site="item.site" :server="item.server"/></section>
  <p class="snapshot-note muted">{{t('总数与在线统计来自后端列表快照；卡片指标通过实时连接更新。','Totals and online counts use the backend list snapshot; card metrics update through the live connection.')}}</p>
</template>
