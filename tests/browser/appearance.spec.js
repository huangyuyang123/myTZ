import {test,expect} from '@playwright/test'
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
async function backend(page,{isPublic=true,turnstile=false,jwt=false,multi=false,challengeFailure=false}={}){
 const requests=[],sockets=[],subscriptions=[]
 await page.addInitScript(({jwt,challengeFailure})=>{if(jwt)localStorage.setItem('jwt_token','test-jwt');window.mockHidden=false;Object.defineProperty(document,'hidden',{get:()=>window.mockHidden});window.challengeAttempts=0;window.turnstile={render(el,opts){el.textContent='Mock challenge';const attempt=()=>{window.challengeAttempts++;if(challengeFailure){opts['error-callback']('110200');if(opts.retry!=='never')setTimeout(attempt,100)}else opts.callback('challenge-token')};setTimeout(attempt,5);return 1},remove(){}}},{jwt,challengeFailure})
 const metrics={cpu:24.5,ram_total:8192,ram_used:2460,swap_total:2048,swap_used:0,disk_total:102400,disk_used:33000,net_in_speed:1048576,net_out_speed:524288,net_rx_monthly:987654321,net_tx_monthly:123456789,net_rx:1234567890,net_tx:3456789012,processes:124,tcp_conn:32,udp_conn:4,ping_ct:0,ping_cu:null,ping_cm:false,loss_ct:0,loss_cu:null,loss_cm:false,gpu_info:'[{"id":"0","name":"NVIDIA RTX 3060","info":12.5}]',disk:{read_bps:4096,write_bps:2048},last_updated:Date.now()}
 const servers=['Tokyo · Edge 01','Frankfurt · Core 02','Singapore · API 03','Virginia · Cache 04','Hong Kong · Gateway 05','London · Storage 06'].map((name,i)=>({...metrics,id:String(i+1),name,region:['jp','de','sg','us','hk','gb'][i],os:'Ubuntu 22.04',arch:'x86_64',cpu_cores:4,server_group:i%2?'Production':'Edge network',price:i===0?'0':'12',currency:'$',billing_cycle:'month',ip_v4:'1',ip_v6:'0',is_hidden:'0',auto_renewal:'0',expire_date:'2027-06-01',cpu:12+i*9,ram_used:1600+i*700,last_updated:i===5?Date.now()-600000:Date.now(),ping:Array.from({length:12},(_,j)=>({ts:Date.now()-(12-j)*60000,ct:j===3?null:10+j,cu:j===5?null:20+j,cm:false,bd:0})),loss:[{ts:Date.now()-60000,ct:0,cu:null,cm:false,bd:0}]}))
 const cfg={site_title:'Observatory',version:'2.7.12',is_public:isPublic,authorization:jwt,turnstile_enabled:turnstile,turnstile_site_key:'test-key',preferred_theme:'dark',default_language:'zh',custom_ct_name:'电信',custom_cu_name:'联通',theme_options:{vendor_key:'retain'},frontend_ws_timeout_minutes:0}
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),headers=route.request().headers();requests.push({path:url.pathname,query:url.search,headers,method:route.request().method(),body:route.request().method()==='POST'?route.request().postDataJSON():null})
  if(url.pathname==='/api/config')return route.fulfill({json:{...cfg,...(headers['x-turnstile-token']?{turnstile_verified:'reusable-credential'}:{})}})
  if(!isPublic&&!headers.authorization)return route.fulfill({status:401,json:{error:'Unauthorized'}})
  if(turnstile&&headers['x-turnstile-verified']!=='reusable-credential')return route.fulfill({status:403,json:{error:'Forbidden'}})
  if(url.pathname==='/api/servers')return route.fulfill({json:{servers,stats:{total:6,online:5,offline:1,globalSpeedIn:6291456,globalSpeedOut:3145728},sysConfig:{show_price:true,show_expire:true,show_tf:true,show_three_net_details:true}}})
  if(url.pathname==='/api/server')return route.fulfill({json:servers.find(s=>s.id===url.searchParams.get('id'))})
  if(url.pathname==='/api/history/all')return route.fulfill({json:Array.from({length:16},(_,j)=>({...metrics,timestamp:Date.now()-(16-j)*30000,cpu:20+Math.sin(j)*12,ping_ct:j===5?null:j,loss_ct:0}))})
  if(url.pathname==='/api/theme_options')return route.fulfill({json:{success:true,theme_options:route.request().postDataJSON().theme_options}})
  return route.fulfill({status:404,json:{error:'Unexpected endpoint'}})
 })
 await page.route('**/flags/*.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20"><path fill="#e0e6ee" d="M0 0h30v20H0z"/><path fill="#e55" d="M0 8h30v4H0z"/></svg>'}))
 await page.route('**/os-icons/*.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle fill="#e98e55" cx="8" cy="8" r="6"/></svg>'}))
 await page.routeWebSocket('**/api/ws?*',ws=>{sockets.push(ws);ws.onMessage(msg=>{const sub=JSON.parse(msg);subscriptions.push(sub);if(sub.type==='subscribe')ws.send(JSON.stringify({type:'batchUpdate',updates:[{serverId:sub.scope==='all'?'1':sub.scope,reportTs:Date.now(),samples:[{ts:Date.now(),data:{cpu:71,ram_used:3000}}]}]}))})})
 return {requests,sockets,servers,cfg,subscriptions}
}

import {fileURLToPath} from 'node:url'
const shot=name=>fileURLToPath(new URL('../../../refined-'+name+'.png',import.meta.url))
test('refined appearance: themes, details, mobile, sparse data and text contrast',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 const state=await backend(page)
 await page.setViewportSize({width:1440,height:1000})
 for(const theme of ['dark','light']){
  state.cfg.preferred_theme=theme
  await page.goto('/#/');await page.reload()
  await expect(page.locator('.server-card')).toHaveCount(6)
  await expect(page.locator('.overview-hero h1')).toHaveText('CHAINSAW MAN')
  await expect(page.locator('.live-indicator')).toHaveCount(0)
  await expect(page.locator('.server-card .status-chip').last()).toHaveText('离线')
  await page.locator('.makima-art').evaluate(img=>img.decode())
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  const contrast=await page.evaluate(()=>{
   const lum=rgb=>{const values=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>rgb.startsWith('color(srgb')?v:v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*values[0]+.7152*values[1]+.0722*values[2]}
   const ratio=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05)
   return ['.card-subtitle','.status-chip.online','.summary-foot','.metric-line b','.card-bottom','.segmented button'].map(selector=>{
    const el=document.querySelector(selector),style=getComputedStyle(el)
    let bg=style.backgroundColor,node=el
    while(bg==='rgba(0, 0, 0, 0)' && node.parentElement){node=node.parentElement;bg=getComputedStyle(node).backgroundColor}
    // Body uses the root background color.
    if(bg==='rgba(0, 0, 0, 0)')bg=getComputedStyle(document.body).backgroundColor
    return {selector,ratio:ratio(lum(style.color),lum(bg))}
   })
  })
  console.log('CONTRAST',theme,JSON.stringify(contrast));for(const c of contrast)expect(c.ratio,c.selector).toBeGreaterThanOrEqual(4.5)
  await page.screenshot({path:shot(theme),fullPage:true})
  if(theme==='light')await page.screenshot({path:shot('cover'),fullPage:false})
 }
 await page.locator('.server-name').first().click();await expect(page.locator('.detail-stats')).toBeVisible()
 await page.screenshot({path:shot('detail'),fullPage:true})
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await page.goto('/#/')
  await expect(page.locator('.server-card')).toHaveCount(6)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect(await page.locator('.chart.small svg').first().evaluate(el=>el.getBoundingClientRect().height)).toBe(48)
  await page.screenshot({path:shot('mobile-'+width),fullPage:true})
 }
 state.servers[0].ping=[{ts:Date.now(),ct:false,cu:false,cm:false,bd:false}]
 state.servers[0].loss=[{ts:Date.now(),ct:false,cu:false,cm:false,bd:false}]
 await page.reload();await expect(page.locator('.server-card').first().locator('.card-charts')).toHaveCount(0)
 state.servers[0].name='阿里云抢占式超长名称节点-ABCDEFGHIJKLMNOPQRSTUVWXYZ'
 state.servers[0].ram_used=undefined;state.servers[0].net_in_speed=undefined
 state.cfg.default_language='en';state.cfg.theme_options={density:'compact',showCharts:false,accent:'#f26b38'}
 await page.setViewportSize({width:320,height:844});await page.reload()
 await expect(page.locator('html')).toHaveAttribute('data-density','compact')
 await expect(page.locator('.card-charts')).toHaveCount(0)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:shot('compact-en'),fullPage:false})
 await page.locator('.server-name').first().click();await expect(page.locator('.detail-stats')).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 expect(errors).toEqual([])
})
test('appearance dialog contains keyboard focus, restores trigger and saves existing options',async({page})=>{
 const state=await backend(page,{jwt:true})
 await page.goto('/#/');await expect(page.locator('.server-card')).toHaveCount(6)
 const trigger=page.getByRole('button',{name:'主题选项',exact:true}),dialog=page.getByRole('dialog',{name:'主题选项'})
 await trigger.click();await expect(dialog).toBeVisible()
 const close=dialog.getByRole('button',{name:'关闭'}),save=dialog.getByRole('button',{name:'保存到服务端'})
 await expect(close).toBeFocused()
 await page.keyboard.press('Shift+Tab');await expect(save).toBeFocused()
 await page.keyboard.press('Tab');await expect(close).toBeFocused()
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused()
 await trigger.click()
 await page.getByLabel('卡片密度').selectOption('compact');await page.getByLabel('显示卡片小图').uncheck()
 await save.click();await expect(page.getByRole('status')).toContainText('已保存到服务端')
 await expect(page.locator('html')).toHaveAttribute('data-density','compact')
 await page.setViewportSize({width:390,height:844})
 await page.screenshot({path:shot('settings'),fullPage:false})
 for(const accent of ['#111111','#ffffff']){
  await page.getByLabel('强调色').fill(accent);await save.click()
  await expect(page.locator('html')).toHaveCSS('--accent',accent)
  const colors=await save.evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}))
  expect(colors.fg).toBe(accent==='#111111'?'rgb(255, 255, 255)':'rgb(0, 0, 0)')
 }
 await close.click();await expect(trigger).toBeFocused();await expect(page.locator('.card-charts')).toHaveCount(0)
 const writes=state.requests.filter(r=>r.method==='POST');expect(writes).toHaveLength(3);expect(writes[0].path).toBe('/api/theme_options');expect(writes[0].body.theme_options.vendor_key).toBe('retain')
})
