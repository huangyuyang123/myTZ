<script setup>
import {computed} from 'vue'
const props=defineProps({label:String,value:Number,caption:String,gauge:Boolean})
const level=computed(()=>Number.isFinite(props.value)?Math.max(0,Math.min(100,props.value)):0)
</script>
<template>
  <div class="metric" :class="{'has-gauge':gauge}">
    <svg v-if="gauge" class="metric-gauge" viewBox="0 0 84 84" fill="none" aria-hidden="true">
      <path class="gauge-track" d="M12 10a62 62 0 0 1 62 62"/>
      <path v-if="level>0" class="gauge-value" d="M12 10a62 62 0 0 1 62 62" pathLength="100" :stroke-dasharray="`${level} 100`"/>
    </svg>
    <div class="metric-line"><span>{{label}}</span><b>{{value == null || !Number.isFinite(value) ? '—' : value.toFixed(1)+'%'}}</b></div>
    <div class="bar"><span :class="{hot:value>85}" :style="{width:`${level}%`}"></span></div>
    <small v-if="caption" class="muted">{{caption}}</small>
  </div>
</template>
