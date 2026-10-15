<script setup>
import {watchEffect,onMounted,onBeforeUnmount,ref} from 'vue'
import {bootstrap,sites,pageState,continueLive} from './composables/useMonitor.js'
import {applyAppearance,config,t} from './composables/useTheme.js'
import {adminUrl} from './utils/config.js'
import MonitorFooter from './components/MonitorFooter.vue'
import TurnstileGate from './components/TurnstileGate.vue'
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
      <nav :aria-label="t('站点导航','Site navigation')">
        <a class="admin-link" :href="sites[0]?adminUrl(sites[0].base):'/admin#/admin'" :aria-label="t('管理','Admin')" :title="t('管理','Admin')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9.5 3-.6 2.3-1.6.9-2.3-.6-2.5 4.3 1.7 1.7v1.8l-1.7 1.7L5 19.4l2.3-.6 1.6.9.6 2.3h5l.6-2.3 1.6-.9 2.3.6 2.5-4.3-1.7-1.7v-1.8l1.7-1.7L19 5.6l-2.3.6-1.6-.9L14.5 3Z"/><circle cx="12" cy="12.5" r="3"/></svg></a>
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
