<script setup>
import {computed} from 'vue'
import {probe} from '../utils/metrics.js'
import {t} from '../composables/useTheme.js'
const props = defineProps({rows:{type:Array,default:()=>[]},series:{type:Array,default:()=>[]},small:Boolean,unit:{type:String,default:''}})
const values = computed(()=>props.rows.flatMap(r=>props.series.map(s=>r[s.key])).filter(v=>typeof v==='number' && Number.isFinite(v)))
const max = computed(()=>Math.max(1,...values.value))
const minTs = computed(()=>Number(props.rows[0]?.timestamp ?? props.rows[0]?.ts) || 0)
const maxTs = computed(()=>Number(props.rows.at(-1)?.timestamp ?? props.rows.at(-1)?.ts) || 0)
function x(row, i) { const ts=Number(row.timestamp ?? row.ts); return maxTs.value > minTs.value && Number.isFinite(ts) ? 4+(ts-minTs.value)/(maxTs.value-minTs.value)*392 : 4+i/Math.max(1,props.rows.length-1)*392 }
const y = v => 94-Number(v)/max.value*82
function paths(key) {
  const segments=[]; let points=[]
  props.rows.forEach((r,i)=>{const v=r[key]; if(typeof v === 'number' && Number.isFinite(v)) points.push(`${x(r,i)},${y(v)}`); else if(points.length) {segments.push(points.join(' ')); points=[]}})
  if(points.length) segments.push(points.join(' ')); return segments
}
function last(key) { for(let i=props.rows.length-1;i>=0;i--) if(props.rows[i][key]!==undefined && props.rows[i][key]!==false) return props.rows[i][key] }
</script>
<template><div class="chart" :class="{small}"><svg viewBox="0 0 400 104" :preserveAspectRatio="small ? 'none' : 'xMidYMid meet'" role="img" :aria-label="series.map(s=>s.label).join(', ')"><path v-if="!small" class="grid-line" d="M4 12H396M4 53H396M4 94H396"/><g v-for="s in series" :key="s.key"><polyline v-for="(points,i) in paths(s.key)" :key="i" :points="points" fill="none" :stroke="s.color" stroke-width="2" vector-effect="non-scaling-stroke"/><circle v-for="(r,i) in rows.filter(r=>typeof r[s.key]==='number')" :key="`dot${i}`" :cx="x(r,rows.indexOf(r))" :cy="y(r[s.key])" r="1.7" :fill="s.color"/><path v-for="(r,i) in rows.filter(r=>r[s.key]===null)" :key="i" :d="`M${x(r,rows.indexOf(r))-3} 96l3 -6l3 6z`" :fill="s.color"><title>{{s.label}} · {{t('超时','Timeout')}}</title></path></g></svg><div class="chart-legend"><span v-for="s in series.filter(s=>rows.some(r=>r[s.key]!==false && r[s.key]!==undefined))" :key="s.key"><i :style="{background:s.color}"></i>{{s.label}} <b>{{probe(last(s.key),unit,t('超时','Timeout')) ?? '—'}}</b><em v-if="last(s.key)!==null && rows.some(r=>r[s.key]===null)"> △ {{t('超时','Timeout')}}</em></span></div><div v-if="!small && rows.length" class="chart-time muted"><span>{{new Date(minTs).toLocaleTimeString()}}</span><span>{{new Date(maxTs).toLocaleTimeString()}}</span></div><p v-if="!rows.length" class="muted">{{t('暂无历史样本','No history samples')}}</p></div></template>
