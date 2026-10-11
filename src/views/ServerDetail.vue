<script setup>
import {shallowReactive,computed,onMounted,onBeforeUnmount} from 'vue'
import {useRoute} from 'vue-router'
import {sites,pageState,enterDetail,changeRange,leavePage} from '../composables/useMonitor.js'
import {t} from '../composables/useTheme.js'
import {HOURS,bytes,percent,isOnline,probeLines,probe,gpu} from '../utils/metrics.js'
import SparkChart from '../components/SparkChart.vue'
import MetricBar from '../components/MetricBar.vue'
const route=useRoute(),siteIndex=Number(route.query.site||0)
const detail=shallowReactive({server:{},history:[],hours:0.167,historyLoading:false})
const site=computed(()=>sites.value[siteIndex])
const s=computed(()=>detail.server)
const probes=computed(()=>probeLines(site.value?.config||{}))
const charts=computed(()=>[
 {title:'CPU',unit:'%',series:[{key:'cpu',label:'CPU',color:'#f26b38'}]},
 {title:t('内存 / Swap','Memory / Swap'),unit:' MB',series:[{key:'ram_used',label:t('内存','Memory'),color:'#8c9be7'},{key:'swap_used',label:'Swap',color:'#aaba47'}]},
 {title:t('网络速率','Network speed'),unit:' B/s',series:[{key:'net_in_speed',label:t('下载','Download'),color:'#f26b38'},{key:'net_out_speed',label:t('上传','Upload'),color:'#8c9be7'}]},
 {title:t('延迟','Latency'),unit:' ms',series:probes.value.map(p=>({...p,key:'ping_'+p.key}))},
 {title:t('丢包率','Packet loss'),unit:'%',series:probes.value.map(p=>({...p,key:'loss_'+p.key}))},
 ...(detail.history.some(r=>r.disk && typeof r.disk==='object')?[{title:t('磁盘 IO','Disk IO'),unit:' B/s',series:[{key:'read_bps',label:t('读取','Read'),color:'#f26b38'},{key:'write_bps',label:t('写入','Write'),color:'#aaba47'}],disk:true}]:[]),
 ...Array.from(new Map(detail.history.flatMap(r=>gpu(r.gpu_info).map(g=>[String(g.id),g])))).map(([id,g])=>({title:g.name || `GPU ${id}`,unit:'%',series:[{key:'gpu_value',label:g.name || `GPU ${id}`,color:'#aaba47'}],gpuId:id}))
])
function rowsFor(chart){return chart.disk?detail.history.map(r=>({timestamp:r.timestamp,...r.disk})):chart.gpuId!==undefined?detail.history.map(r=>({timestamp:r.timestamp,gpu_value:gpu(r.gpu_info).find(g=>String(g.id)===chart.gpuId)?.info})):detail.history}
const rangeName=h=>h===0.167?t('10 分钟','10 min'):h===0.5?t('30 分钟','30 min'):h<24?`${h} ${t('小时','h')}`:`${h/24} ${t('天','d')}`
onMounted(()=>enterDetail(siteIndex,route.params.id,detail).catch(e=>pageState.error=e.message));onBeforeUnmount(leavePage)
</script>
<template><RouterLink to="/" class="back-link">← {{t('全部服务器','All servers')}}</RouterLink><section class="hero detail-hero"><div><p class="eyebrow">NODE / {{s.region || s.arch || 'DETAIL'}}</p><h1>{{s.name || route.params.id}}</h1><p class="muted">{{s.cpu_info || '—'}} · {{s.os || '—'}}</p></div><span class="status-chip" :class="{online:isOnline(s,pageState.now)}"><i></i>{{isOnline(s,pageState.now)?t('在线','Online'):t('离线','Offline')}}</span></section><div v-if="pageState.loading" class="empty panel">{{t('正在载入节点…','Loading node…')}}</div><template v-else-if="s.id"><section class="detail-stats panel"><MetricBar label="CPU" :value="typeof s.cpu==='number'?s.cpu:null"/><MetricBar :label="t('内存','Memory')" :value="percent(s.ram_used,s.ram_total)"/><MetricBar label="Swap" :value="percent(s.swap_used,s.swap_total)"/><MetricBar :label="t('磁盘空间','Storage')" :value="percent(s.disk_used,s.disk_total)"/></section><section class="node-facts panel"><div><span>{{t('实时下载','Download')}}</span><b>{{bytes(s.net_in_speed,'/s')}}</b></div><div><span>{{t('实时上传','Upload')}}</span><b>{{bytes(s.net_out_speed,'/s')}}</b></div><div><span>{{t('进程','Processes')}}</span><b>{{s.processes ?? '—'}}</b></div><div><span>TCP / UDP</span><b>{{s.tcp_conn ?? '—'}} / {{s.udp_conn ?? '—'}}</b></div><div><span>IPv4 / IPv6</span><b>{{s.ip_v4==='1'?'✓':'—'}} / {{s.ip_v6==='1'?'✓':'—'}}</b></div><div><span>{{t('总流量','Total traffic')}}</span><b>↓ {{bytes(s.net_rx)}} · ↑ {{bytes(s.net_tx)}}</b></div></section><section class="fleet-toolbar"><div><h2>{{t('运行轨迹','Performance history')}}</h2><p class="muted">{{t('实时样本增量追加，切换范围时读取一次历史','Live samples append locally; changing range reads history once')}}</p></div><select :value="detail.hours" :disabled="detail.historyLoading" @change="changeRange(Number($event.target.value))" :aria-label="t('历史范围','History range')"><option v-for="h in HOURS" :key="h" :value="h">{{rangeName(h)}}</option></select></section><div class="chart-grid" :aria-busy="detail.historyLoading"><article v-for="chart in charts" :key="chart.title" class="panel history-card"><div class="section-heading"><h3>{{chart.title}}</h3><span class="muted">{{chart.unit}}</span></div><SparkChart :rows="rowsFor(chart)" :series="chart.series" :unit="chart.unit"/></article></div><section class="panel probe-panel"><h3>{{t('当前网络质量','Current network quality')}}</h3><div class="probe-values"><div v-for="p in probes.filter(p=>probe(s['ping_'+p.key],' ms')!==null || probe(s['loss_'+p.key],'%')!==null)" :key="p.key"><span>{{p.label}}</span><b>{{probe(s['ping_'+p.key],' ms',t('超时','Timeout')) ?? '—'}}</b><small>{{probe(s['loss_'+p.key],'%',t('超时','Timeout')) ?? '—'}}</small></div></div></section><section v-if="gpu(s.gpu_info).length" class="panel probe-panel"><h3>GPU</h3><div class="probe-values"><div v-for="g in gpu(s.gpu_info)" :key="g.id"><span>{{g.name}}</span><b>{{typeof g.info==='number'?g.info.toFixed(1)+'%':JSON.stringify(g.info)}}</b></div></div></section></template></template>
