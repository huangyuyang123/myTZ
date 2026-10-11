<script setup>
import {watchEffect,onMounted,onBeforeUnmount,ref} from 'vue'
import {bootstrap,sites,pageState,continueLive} from './composables/useMonitor.js'
import {applyAppearance,config,t} from './composables/useTheme.js'
import {adminUrl} from './utils/config.js'
import MonitorFooter from './components/MonitorFooter.vue'
import TurnstileGate from './components/TurnstileGate.vue'
import ThemeOptions from './components/ThemeOptions.vue'
const fatal=ref('')
watchEffect(applyAppearance)
const media=matchMedia('(prefers-color-scheme: dark)')
onMounted(()=>{bootstrap().catch(e=>fatal.value=e.message);media.addEventListener('change',applyAppearance)})
onBeforeUnmount(()=>media.removeEventListener('change',applyAppearance))
</script>
<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink to="/" class="brand">
        <span class="brand-symbol" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M5 23 22 6l5 5L10 28H5v-5Z" stroke="currentColor" stroke-width="2.5"/><path d="m8 17-3-3m8-2-3-3m8-2-3-3m0 19 3 3m2-8 3 3m2-8 3 3" stroke="currentColor" stroke-width="2.5"/><path d="m7 25 17-17" stroke="currentColor" stroke-width="2"/></svg></span>
        <span>{{config.site_title || t('服务器监控','Server monitor')}}</span>
      </RouterLink>
      <nav>
        <RouterLink to="/" class="nav-link">{{t('概览','Overview')}}</RouterLink>
        <ThemeOptions/>
        <a class="admin-link" :href="sites[0]?adminUrl(sites[0].base):'/admin#/admin'">{{t('管理','Admin')}} <span>↗</span></a>
      </nav>
    </header>
    <main>
      <div v-if="fatal || pageState.error" role="alert" class="error-banner">{{fatal || pageState.error}}</div>
      <div v-if="pageState.paused" role="status" class="pause-banner">
        <div><b>{{t('实时订阅已暂停','Live subscription paused')}}</b><p>{{t('已达到后台设置的订阅时长。保留最后一次数据，继续需由你确认。','The configured session limit was reached. Last data is retained; continuing requires your action.')}}</p></div>
        <button @click="continueLive">{{t('继续实时更新','Continue live updates')}}</button>
      </div>
      <RouterView :key="$route.fullPath"/>
    </main>
    <MonitorFooter/>
    <TurnstileGate/>
  </div>
</template>
