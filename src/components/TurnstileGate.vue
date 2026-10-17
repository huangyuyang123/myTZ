<script setup>
import {ref, watch, nextTick, onBeforeUnmount} from 'vue'
import {challengeState, finishChallenge} from '../composables/challenge.js'
import {t} from '../composables/useTheme.js'
const host = ref(null), error = ref(''), loading = ref(false)
let scriptPromise, widget, version = 0
function script() {
  if (typeof window.turnstile?.render === 'function') return Promise.resolve()
  if (!scriptPromise) scriptPromise = new Promise((resolve,reject)=> {
    const el = document.createElement('script'); el.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; el.async=true; el.dataset.cfsmRetryable='turnstile'
    const failed=()=>{el.remove();scriptPromise=undefined;reject(Error('Turnstile resource failed'))}
    el.onload=()=>{if(typeof window.turnstile?.render==='function')resolve();else failed()}; el.onerror=failed; document.head.append(el)
  })
  return scriptPromise
}
async function render() {
  const task = challengeState.value, ticket = ++version
  error.value=''
  loading.value=!!task
  if (widget != null && window.turnstile) window.turnstile.remove(widget)
  widget = undefined
  if (!task) return
  try {
    await nextTick(); await script()
    if (ticket !== version || challengeState.value !== task) return
    const current = () => ticket === version && challengeState.value === task
    widget = window.turnstile.render(host.value, {
      sitekey:task.siteKey, theme:'auto', retry:'never',
      'refresh-expired':'manual', 'refresh-timeout':'manual',
      callback:token=>{if (current()) finishChallenge(token)},
      'error-callback':code=>{
        if (!current()) return true
        error.value = String(code) === '110200'
          ? t('此访问地址未获验证授权，请联系管理员（110200）。','This address is not authorized for verification. Contact the administrator (110200).')
          : t('验证失败，请重试','Verification failed. Try again.')
        return true
      },
      'expired-callback':()=>{if (current()) error.value=t('验证已过期，请重试','Challenge expired. Try again.')},
      'timeout-callback':()=>{if (current()) error.value=t('验证超时，请重试','Challenge timed out. Try again.')}
    })
  } catch {
    if(ticket===version && challengeState.value===task)error.value=t('验证组件加载失败，请检查网络后重试。','Verification could not load. Check your connection and try again.')
  } finally {if(ticket===version)loading.value=false}
}
watch(challengeState, render, {flush:'post'})
onBeforeUnmount(()=>{version++; if (widget != null) window.turnstile?.remove(widget)})
</script>
<template><div v-if="challengeState" class="modal-backdrop"><section role="dialog" aria-modal="true" :aria-label="t('访问验证','Access verification')" class="gate panel"><p class="eyebrow">CLOUDFLARE TURNSTILE</p><h2>{{t('验证后继续','Verify to continue')}}</h2><p class="muted">{{challengeState.base}}</p><div ref="host"></div><p v-if="loading" role="status">{{t('正在加载验证组件…','Loading verification…')}}</p><p v-if="error" role="alert">{{error}}</p><button v-if="error" :disabled="loading" @click="render">{{t('重试','Try again')}}</button></section></div></template>
