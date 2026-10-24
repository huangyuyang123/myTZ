<script setup>
import {computed,useId} from 'vue'
import {bytes} from '../utils/metrics.js'
import {t} from '../composables/useTheme.js'
const props=defineProps({kind:String,rate:Number,speeds:{type:Array,default:()=>[]}})
const id=useId()
const peak=computed(()=>Math.max(1,...props.speeds.map(s=>typeof s.value==='number'&&Number.isFinite(s.value)?s.value:0)))
const validSpeed=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0
</script>
<template>
  <div class="summary-art" :class="'summary-art-'+kind" aria-hidden="true">
    <svg v-if="kind==='servers'" class="server-stack" viewBox="0 0 120 124" fill="none">
      <defs>
        <linearGradient :id="id+'-peach'" x2="1" y2="1"><stop stop-color="#fff4e5"/><stop offset="1" stop-color="#f3bf9e"/></linearGradient>
        <linearGradient :id="id+'-orange'" x2="1" y2="1"><stop stop-color="#ffd0ab"/><stop offset="1" stop-color="var(--accent)"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="113" rx="43" ry="9" class="stack-shadow"/>
      <g v-for="(layer,i) in [{y:59,fill:'#654638'},{y:36,fill:`url(#${id}-orange)`},{y:13,fill:`url(#${id}-peach)`}]" :key="i" :transform="`translate(14 ${layer.y})`">
        <path d="M0 14 44 0 88 14 44 29Z" :fill="layer.fill"/>
        <path d="M0 14v18q0 5 5 7l39 14V29Z" :fill="layer.fill"/>
        <path d="m44 29 44-15v18q0 5-5 7L44 53Z" :fill="layer.fill"/>
        <path d="m44 29 44-15v18q0 5-5 7L44 53Z" fill="#6f2b1c" opacity=".15"/>
        <path d="M0 14 44 29 88 14" stroke="#fff" stroke-opacity=".45"/>
        <ellipse cx="12" cy="30" rx="2.5" ry="3.5" fill="#fff8df"/>
        <path d="m66 34 9-3" stroke="#fff8df" stroke-width="2" stroke-linecap="round"/>
      </g>
    </svg>
    <svg v-else-if="kind==='online'" class="online-ring" viewBox="0 0 90 90">
      <defs><linearGradient :id="id+'-ring'" x2="1" y2="1"><stop stop-color="#5cbe86"/><stop offset=".45" stop-color="#90cea0"/><stop offset=".7" stop-color="#efc494"/><stop offset="1" stop-color="var(--accent)"/></linearGradient></defs>
      <circle class="ring-track" cx="45" cy="45" r="32"/>
      <circle v-if="rate>0" class="ring-value" cx="45" cy="45" r="32" pathLength="100" :stroke="`url(#${id}-ring)`" :stroke-dasharray="`${rate} 100`" transform="rotate(-90 45 45)"/>
      <text x="45" y="51" text-anchor="middle" class="ring-text">{{rate==null?'—':Math.round(rate)+'%'}}</text>
    </svg>
    <div v-else-if="kind==='network' && speeds.some(s=>validSpeed(s.value))" class="network-distribution">
      <svg viewBox="0 0 90 60" fill="none">
        <path d="M2 56H88" class="distribution-base"/>
        <template v-for="(sample,i) in speeds" :key="i"><rect v-if="validSpeed(sample.value) && sample.value>0" :x="4+i*82/speeds.length" :y="56-sample.value/peak*46" :width="82/speeds.length*.65" :height="sample.value/peak*46" rx="2" class="distribution-bar"><title>{{sample.name}}: {{bytes(sample.value,'/s')}}</title></rect></template>
      </svg>
      <span>{{t('节点下载','Node download')}}</span>
    </div>
  </div>
</template>
