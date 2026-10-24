<script setup>
import {computed} from 'vue'
import MetricBar from './MetricBar.vue'
import SparkChart from './SparkChart.vue'
import {bytes,percent,isOnline,price,probeLines} from '../utils/metrics.js'
import {t,options} from '../composables/useTheme.js'
import {pageState} from '../composables/useMonitor.js'
const props=defineProps({server:Object,site:Object})
const online=computed(()=>isOnline(props.server,pageState.now))
const usage=(used,total)=>used==null || used===false?null:percent(used,total)
const capacity=(used,total)=>`${bytes(used==null || used===false?undefined:used*1048576)} / ${bytes(total==null || total===false?undefined:total*1048576)}`
const cardPrice=computed(()=>price(props.server))
const lineSeries=computed(()=>probeLines(props.site.config).slice(0,4))
const hasSamples=rows=>Array.isArray(rows) && rows.some(row=>lineSeries.value.some(line=>row[line.key]===null || (typeof row[line.key]==='number' && Number.isFinite(row[line.key]))))
const hasPing=computed(()=>hasSamples(props.server.ping)),hasLoss=computed(()=>hasSamples(props.server.loss))
const osFile=computed(()=>{const os=String(props.server.os||'').toLowerCase(); const known=['ubuntu','debian','alpine','windows','centos','fedora','arch','macos','openwrt','rocky','redhat','oracle','gentoo','mint','nix','alma'].find(s=>os.includes(s));return known==='alpine'?'os-alpine.webp':`os-${known || 'unknown'}.svg`})
</script>
<template>
  <article class="server-card panel">
    <div class="card-heading">
      <div class="server-identity">
        <img v-if="server.region && /^[a-z]{2}$/i.test(server.region)" class="flag" :src="`${site.base}/flags/${server.region.toLowerCase()}.svg`" :alt="server.region">
        <div>
          <RouterLink :to="{path:'/server/'+encodeURIComponent(server.id),query:site.index ? {site:site.index} : {}}" class="server-name" :title="server.name || server.id">{{server.name || server.id}}<span>&nbsp;↗</span></RouterLink>
          <p class="muted card-subtitle">{{server.server_group || server.region || '—'}} <span v-if="server.cpu_cores">· {{server.cpu_cores}} {{t('核','cores')}}</span></p>
        </div>
      </div>
      <span class="status-chip" :class="{online}"><i></i>{{online?t('在线','Online'):t('离线','Offline')}}</span>
    </div>
    <div class="card-metrics">
      <MetricBar gauge label="CPU" :value="typeof server.cpu==='number'?server.cpu:null"/>
      <MetricBar gauge :label="t('内存','Memory')" :value="usage(server.ram_used,server.ram_total)" :caption="capacity(server.ram_used,server.ram_total)"/>
      <MetricBar :label="t('磁盘','Storage')" :value="usage(server.disk_used,server.disk_total)" :caption="capacity(server.disk_used,server.disk_total)"/>
    </div>
    <div class="network-row"><div><small>↓ {{t('下载','IN')}}</small><b>{{bytes(server.net_in_speed,'/s')}}</b><svg class="network-direction" viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="M8 29V7m-5 6 5-6 5 6M24 7v22m-5-6 5 6 5-6"/></svg></div><div><small>↑ {{t('上传','OUT')}}</small><b>{{bytes(server.net_out_speed,'/s')}}</b><svg class="network-direction" viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="M8 29V7m-5 6 5-6 5 6M24 7v22m-5-6 5 6 5-6"/></svg></div></div>
    <div v-if="site.sysConfig.show_tf===true" class="traffic-row muted"><span>{{t('月流量','Monthly traffic')}}</span><b>↓ {{bytes(server.net_rx_monthly)}} · ↑ {{bytes(server.net_tx_monthly)}}</b></div>
    <div v-if="site.sysConfig.show_three_net_details===true && options.showCharts && (hasPing || hasLoss)" class="card-charts">
      <div v-if="hasPing" class="card-mini-chart"><h4 class="mini-chart-heading">{{t('延迟','Latency')}}</h4><SparkChart small area :rows="server.ping" :series="lineSeries" unit=" ms"/></div>
      <div v-if="hasLoss" class="card-mini-chart"><h4 class="mini-chart-heading">{{t('丢包率','Packet loss')}}</h4><SparkChart small :rows="server.loss" :series="lineSeries" unit="%"/></div>
    </div>
    <div class="card-bottom"><span class="os-label"><img :src="`${site.base}/os-icons/${osFile}`" alt="">{{server.os || '—'}}</span><span v-if="site.sysConfig.show_price===true && cardPrice">{{cardPrice==='free'?t('免费','Free'):cardPrice}}</span><span v-else>{{server.arch || '—'}}</span></div>
    <p v-if="site.sysConfig.show_expire===true && server.expire_date" class="expiry muted">{{t('到期','Expires')}} {{server.expire_date}} · {{server.auto_renewal==='1'?t('自动续费','Auto-renew'):t('手动续费','Manual renew')}}</p>
  </article>
</template>
