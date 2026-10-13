<script setup>
import {ref,watch,nextTick,onBeforeUnmount} from 'vue'
import {sites} from '../composables/useMonitor.js'
import {defaults,t} from '../composables/useTheme.js'
const open=ref(false),message=ref(''),busy=ref(false),siteIndex=ref(0)
const draft=ref({...defaults})
const dialog=ref(null),trigger=ref(null)
function closeDialog(){open.value=false}
function trapFocus(event){
  if(event.key!=='Tab')return
  const items=[...dialog.value.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length)
  if(!items.length){event.preventDefault();dialog.value.focus();return}
  const first=items[0],last=items.at(-1),active=document.activeElement
  if(event.shiftKey && (active===first || !items.includes(active))){event.preventDefault();last.focus()}
  else if(!event.shiftKey && (active===last || !items.includes(active))){event.preventDefault();first.focus()}
}
function loadDraft(){const saved=sites.value[siteIndex.value]?.config?.theme_options;draft.value={...defaults,...(saved && typeof saved==='object' && !Array.isArray(saved)?saved:{})};message.value=''}
watch(open, async value=>{
  if(value){loadDraft();await nextTick();if(open.value && dialog.value && !dialog.value.open)dialog.value.showModal()}
  else{dialog.value?.close();await nextTick();trigger.value?.focus()}
})
onBeforeUnmount(()=>dialog.value?.close())
watch(siteIndex, ()=>{if(open.value) loadDraft()})
async function save(){busy.value=true;message.value='';const site=sites.value[siteIndex.value];const payload={...draft.value};try{const result=await site.api.saveOptions(payload);site.config={...site.config,theme_options:result.theme_options || payload};if(open.value && sites.value[siteIndex.value]===site)message.value=t('已保存到服务端','Saved to server')}catch(e){if(open.value && sites.value[siteIndex.value]===site)message.value=e.message}finally{busy.value=false}}
</script>
<template><button ref="trigger" class="quiet" aria-haspopup="dialog" :aria-expanded="open" @click="open=true">{{t('主题选项','Theme options')}}</button><Teleport to="body"><dialog ref="dialog" class="theme-dialog" aria-labelledby="theme-options-title" @cancel.prevent="closeDialog" @close="closeDialog" @keydown="trapFocus"><form class="panel gate" @submit.prevent="save"><div class="section-heading"><h2 id="theme-options-title">{{t('主题选项','Theme options')}}</h2><button type="button" class="quiet" @click="closeDialog" :aria-label="t('关闭','Close')">×</button></div><label v-if="sites.length>1">{{t('保存到站点','Save to site')}}<select v-model.number="siteIndex"><option v-for="site in sites" :key="site.index" :value="site.index">{{site.config?.site_title || site.base}}</option></select></label><label>{{t('卡片密度','Card density')}}<select v-model="draft.density"><option value="comfortable">{{t('舒适','Comfortable')}}</option><option value="compact">{{t('紧凑','Compact')}}</option></select></label><label>{{t('强调色','Accent')}}<input type="color" v-model="draft.accent"></label><label class="check-label"><input type="checkbox" v-model="draft.showCharts">{{t('显示卡片小图','Show card charts')}}</label><p class="muted">{{t('登录后台后可保存外观设置。','Sign in to the admin page to save appearance settings.')}}</p><button type="submit" :disabled="busy">{{busy?t('保存中…','Saving…'):t('保存到服务端','Save to server')}}</button><p v-if="message" role="status">{{message}}</p></form></dialog></Teleport></template>
