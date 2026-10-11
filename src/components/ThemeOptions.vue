<script setup>
import {ref,reactive,watch} from 'vue'
import {sites} from '../composables/useMonitor.js'
import {defaults,options,t} from '../composables/useTheme.js'
const open=ref(false),message=ref(''),busy=ref(false),siteIndex=ref(0)
const draft=reactive({...options.value})
watch(open, value=>{if(value) Object.assign(draft,options.value)})
watch(siteIndex, index => Object.assign(draft,{...defaults,...sites.value[index]?.config?.theme_options}))
async function save(){busy.value=true;message.value='';try{const site=sites.value[siteIndex.value];const result=await site.api.saveOptions({...site.config.theme_options,...draft});site.config={...site.config,theme_options:result.theme_options || {...draft}};message.value=t('已保存到服务端','Saved to server')}catch(e){message.value=e.message}finally{busy.value=false}}
</script>
<template><button class="quiet" @click="open=!open">{{t('主题选项','Theme options')}}</button><div v-if="open" class="modal-backdrop"><form class="panel gate" role="dialog" aria-modal="true" @submit.prevent="save"><div class="section-heading"><h2>{{t('主题选项','Theme options')}}</h2><button type="button" class="quiet" @click="open=false" :aria-label="t('关闭','Close')">×</button></div><label v-if="sites.length>1">{{t('保存到站点','Save to site')}}<select v-model.number="siteIndex"><option v-for="site in sites" :key="site.index" :value="site.index">{{site.config?.site_title || site.base}}</option></select></label><label>{{t('卡片密度','Card density')}}<select v-model="draft.density"><option value="comfortable">{{t('舒适','Comfortable')}}</option><option value="compact">{{t('紧凑','Compact')}}</option></select></label><label>{{t('强调色','Accent')}}<input type="color" v-model="draft.accent"></label><label class="check-label"><input type="checkbox" v-model="draft.showCharts">{{t('显示卡片小图','Show card charts')}}</label><p class="muted">{{t('保存需要后台登录，选项存储在所选站点的 theme_options 中。','Saving requires admin login. Options are stored in the selected site’s theme_options.')}}</p><button :disabled="busy">{{busy?t('保存中…','Saving…'):t('保存到服务端','Save to server')}}</button><p v-if="message" role="status">{{message}}</p></form></div></template>
