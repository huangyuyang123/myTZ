<script setup>
import {shallowReactive,computed,onMounted,onBeforeUnmount} from 'vue'
import {useRoute} from 'vue-router'
import {sites,pageState,enterDetail,changeRange,leavePage} from '../composables/useMonitor.js'
import {t,options} from '../composables/useTheme.js'
import {HOURS,bytes,percent,isOnline,probeLines,probe,gpu} from '../utils/metrics.js'
import SparkChart from '../components/SparkChart.vue'
import MetricBar from '../components/MetricBar.vue'
const route=useRoute(),siteIndex=Number(route.query.site||0)
const detail=shallowReactive({server:{},history:[],hours:0.167,historyLoading:false})
const site=computed(()=>sites.value[siteIndex])
const s=computed(()=>detail.server)
const probes=computed(()=>probeLines(site.value?.config||{}))
const charts=computed(()=>[
 {title:'CPU',unit:'%',series:[{key:'cpu',label:'CPU',color:'var(--detail-accent)'}]},
 {title:t('内存 / Swap','Memory / Swap'),unit:' MB',series:[{key:'ram_used',label:t('内存','Memory'),color:'#8c9be7'},{key:'swap_used',label:'Swap',color:'#aaba47'}]},
 {title:t('网络速率','Network speed'),unit:' B/s',series:[{key:'net_in_speed',label:t('下载','Download'),color:'var(--detail-accent)'},{key:'net_out_speed',label:t('上传','Upload'),color:'#8c9be7'}]},
 {title:t('延迟','Latency'),unit:' ms',series:probes.value.map(p=>({...p,key:'ping_'+p.key}))},
 {title:t('丢包率','Packet loss'),unit:'%',series:probes.value.map(p=>({...p,key:'loss_'+p.key}))},
 ...(detail.history.some(r=>r.disk && typeof r.disk==='object')?[{title:t('磁盘 IO','Disk IO'),unit:' B/s',series:[{key:'read_bps',label:t('读取','Read'),color:'var(--detail-accent)'},{key:'write_bps',label:t('写入','Write'),color:'#aaba47'}],disk:true}]:[]),
 ...Array.from(new Map(detail.history.flatMap(r=>gpu(r.gpu_info).map(g=>[String(g.id),g])))).map(([id,g])=>({title:g.name || `GPU ${id}`,unit:'%',series:[{key:'gpu_value',label:g.name || `GPU ${id}`,color:'#aaba47'}],gpuId:id}))
])
function rowsFor(chart){return chart.disk?detail.history.map(r=>({timestamp:r.timestamp,...r.disk})):chart.gpuId!==undefined?detail.history.map(r=>({timestamp:r.timestamp,gpu_value:gpu(r.gpu_info).find(g=>String(g.id)===chart.gpuId)?.info})):detail.history}
// Keep configured accents legible on both theme surfaces, including white/black accents.
const detailColors=computed(()=>{
 const hex=/^#[0-9a-f]{6}$/i.test(options.value.accent)?options.value.accent:'#f26b38'
 const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16))
 const luminance=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)
 const adjusted=(bg,ink)=>{
  let color=rgb
  for(let amount=0;amount<=1;amount+=.05){
   color=rgb.map((v,i)=>Math.round(v*(1-amount)+ink[i]*amount))
   const a=luminance(color),b=luminance(bg)
   if((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5)break
  }
  return `rgb(${color.join(',')})`
 }
 return {'--detail-accent-light':adjusted([255,254,249],[38,36,32]),'--detail-accent-dark':adjusted([36,38,34],[241,240,233])}
})
const visibleProbes=computed(()=>probes.value.filter(p=>probe(s.value['ping_'+p.key])!==null || probe(s.value['loss_'+p.key])!==null))
const capacity=(used,total)=>`${bytes(used==null?undefined:used*1048576)} / ${bytes(total==null?undefined:total*1048576)}`
const usage=(used,total)=>used==null?null:percent(used,total)
const ipState=value=>value==='1'||value===1?t('支持','Supported'):value==='0'||value===0?t('未启用','Disabled'):'—'
const currentGpu=id=>gpu(s.value.gpu_info).find(g=>String(g.id)===id)
const gpuValue=g=>typeof g?.info==='number'?g.info.toFixed(1)+'%':g?.info==null?'—':JSON.stringify(g.info)
const rangeName=h=>h===0.167?t('10 分钟','10 min'):h===0.5?t('30 分钟','30 min'):h<24?`${h} ${t('小时','h')}`:`${h/24} ${t('天','d')}`
onMounted(()=>enterDetail(siteIndex,route.params.id,detail).catch(e=>pageState.error=e.message));onBeforeUnmount(leavePage)
</script>
<template>
  <div class="server-detail" :style="detailColors">
    <RouterLink to="/" class="back-link">← {{t('全部服务器','All servers')}}</RouterLink>
    <header class="detail-hero">
      <div class="detail-title-row">
        <img v-if="s.region && /^[a-z]{2}$/i.test(s.region)" class="detail-flag" :src="`${site.base}/flags/${s.region.toLowerCase()}.svg`" :alt="s.region">
        <h1>{{s.name || route.params.id}}</h1>
        <span v-if="!pageState.loading && s.id" class="status-chip" :class="{online:isOnline(s,pageState.now)}"><i></i>{{isOnline(s,pageState.now)?t('在线','Online'):t('离线','Offline')}}</span>
      </div>
      <div class="detail-meta muted"><span v-if="s.server_group || s.region">{{s.server_group || s.region}}</span><span v-if="s.os">{{s.os}}</span><span v-if="s.cpu_cores">{{s.cpu_cores}} {{t('核','cores')}}</span><span v-if="s.arch">{{s.arch}}</span></div>
      <p v-if="s.cpu_info" class="detail-cpu muted">{{s.cpu_info}}</p>
    </header>
    <div v-if="pageState.loading" class="empty panel" role="status">{{t('正在载入节点…','Loading node…')}}</div>
    <template v-else-if="s.id">
      <section class="detail-stats panel" :aria-label="t('资源概览','Resource overview')">
        <MetricBar label="CPU" :value="typeof s.cpu==='number'?s.cpu:null"/>
        <MetricBar :label="t('内存','Memory')" :value="usage(s.ram_used,s.ram_total)" :caption="capacity(s.ram_used,s.ram_total)"/>
        <MetricBar label="Swap" :value="usage(s.swap_used,s.swap_total)" :caption="capacity(s.swap_used,s.swap_total)"/>
        <MetricBar :label="t('磁盘空间','Storage')" :value="usage(s.disk_used,s.disk_total)" :caption="capacity(s.disk_used,s.disk_total)"/>
      </section>
      <div class="detail-network-grid">
        <section class="panel detail-network">
          <h2>{{t('实时网络','Live network')}}</h2>
          <div class="detail-speeds"><div><span>{{t('实时下载','Download')}}</span><strong>↓ {{bytes(s.net_in_speed,'/s')}}</strong></div><div><span>{{t('实时上传','Upload')}}</span><strong>↑ {{bytes(s.net_out_speed,'/s')}}</strong></div></div>
          <dl class="detail-facts">
            <div><dt>{{t('进程','Processes')}}</dt><dd>{{s.processes ?? '—'}}</dd></div>
            <div><dt>TCP / UDP</dt><dd>{{s.tcp_conn ?? '—'}} / {{s.udp_conn ?? '—'}}</dd></div>
            <div><dt>{{t('累计下载','Total download')}}</dt><dd>{{bytes(s.net_rx)}}</dd></div>
            <div><dt>{{t('累计上传','Total upload')}}</dt><dd>{{bytes(s.net_tx)}}</dd></div>
          </dl>
          <div class="detail-ip muted"><span>IPv4 <b>{{ipState(s.ip_v4)}}</b></span><span>IPv6 <b>{{ipState(s.ip_v6)}}</b></span></div>
        </section>
        <section class="panel probe-panel detail-probes">
          <h2>{{t('当前网络质量','Current network quality')}}</h2>
          <table v-if="visibleProbes.length"><thead><tr><th>{{t('线路','Route')}}</th><th>{{t('延迟','Latency')}}</th><th>{{t('丢包','Loss')}}</th></tr></thead><tbody><tr v-for="p in visibleProbes" :key="p.key"><th scope="row">{{p.label}}</th><td :class="{timeout:s['ping_'+p.key]===null}">{{probe(s['ping_'+p.key],' ms',t('超时','Timeout')) ?? '—'}}</td><td :class="{timeout:s['loss_'+p.key]===null}">{{probe(s['loss_'+p.key],'%',t('超时','Timeout')) ?? '—'}}</td></tr></tbody></table>
          <p v-else class="detail-no-data muted">{{t('暂无网络探测数据','No network probe data')}}</p>
        </section>
      </div>
      <section class="detail-history panel">
        <div class="detail-history-heading"><h2>{{t('运行轨迹','Performance history')}}</h2><div class="detail-range"><span v-if="detail.historyLoading" role="status" class="muted">{{t('加载中…','Loading…')}}</span><select :value="detail.hours" :disabled="detail.historyLoading" @change="changeRange(Number($event.target.value))" :aria-label="t('历史范围','History range')"><option v-for="h in HOURS" :key="h" :value="h">{{rangeName(h)}}</option></select></div></div>
        <div class="chart-grid" :aria-busy="detail.historyLoading">
          <article v-for="chart in charts" :key="chart.gpuId ?? chart.title" class="panel history-card">
            <div class="section-heading"><h3>{{chart.title}}</h3><span v-if="chart.gpuId!==undefined" class="muted">{{t('当前','Current')}} {{gpuValue(currentGpu(chart.gpuId))}}</span></div>
            <SparkChart detailed :rows="rowsFor(chart)" :series="chart.series" :unit="chart.unit"/>
          </article>
        </div>
      </section>
      <section v-if="gpu(s.gpu_info).some(g=>!charts.some(c=>c.gpuId===String(g.id)))" class="panel probe-panel"><h2>GPU</h2><div class="probe-values"><div v-for="g in gpu(s.gpu_info).filter(g=>!charts.some(c=>c.gpuId===String(g.id)))" :key="g.id"><span>{{g.name}}</span><b>{{gpuValue(g)}}</b></div></div></section>
    </template>
    <div v-else class="empty panel">{{t('暂无节点数据，请返回服务器列表查看其他节点。','No node data. Return to the server list to view other nodes.')}}</div>
  </div>
</template>
