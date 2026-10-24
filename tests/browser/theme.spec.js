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
  if(turnstile&&headers['x-turnstile-verified']!=='reusable-credential')return route.fulfill({status:403,json:{error:'Turnstile verification failed'}})
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
for(const isPublic of [true,false])for(const turnstile of [false,true])test(`public=${isPublic} Turnstile=${turnstile}: dashboard, detail, refresh`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const state=await backend(page,{isPublic,turnstile,jwt:!isPublic})
 await page.goto('/#/');await expect(page.locator('.server-card')).toHaveCount(6);await expect(page.locator('.server-card').first()).toContainText('71.0%')
 expect(state.requests.filter(r=>r.path==='/api/config')).toHaveLength(turnstile?2:1)
 expect(state.requests.filter(r=>r.path==='/api/servers')).toHaveLength(1)
 await page.locator('.server-name').first().click();await expect(page.locator('.detail-stats')).toBeVisible();await expect(page.locator('.probe-panel').first()).toContainText('超时');await expect(page.locator('.probe-panel').first()).toContainText('0.0%')
 expect(new URL(state.sockets.at(-1).url()).searchParams.get('subscribe')).toBe('1')
 await page.getByRole('combobox',{name:'历史范围'}).selectOption('1');await expect(page.getByRole('combobox',{name:'历史范围'})).toHaveValue('1')
 expect(state.requests.filter(r=>r.path==='/api/history/all')).toHaveLength(2)
 await page.getByRole('link',{name:'← 全部服务器',exact:true}).click();await expect(page.locator('.server-card')).toHaveCount(6)
 expect(state.requests.filter(r=>r.path==='/api/servers')).toHaveLength(1)
 await page.reload();await expect(page.locator('.server-card')).toHaveCount(6)
 expect(state.requests.filter(r=>r.path==='/api/config')).toHaveLength(turnstile?3:2)
 expect(errors).toEqual([])
})
test('unauthorized Turnstile hostname stops until explicit retry and does not query monitoring data',async({page})=>{
 await page.clock.install()
 const state=await backend(page,{turnstile:true,challengeFailure:true})
 await page.goto('/#/');await expect(page.getByRole('dialog',{name:'访问验证'})).toBeVisible()
 await page.clock.runFor(500)
 await expect(page.getByRole('alert')).toContainText('110200')
 expect(await page.evaluate(()=>window.challengeAttempts)).toBe(1)
 expect(state.requests.filter(r=>r.path==='/api/config')).toHaveLength(1)
 expect(state.requests.filter(r=>r.path==='/api/servers')).toHaveLength(0)
 expect(state.sockets).toHaveLength(0)
 await page.getByRole('button',{name:'重试',exact:true}).click();await page.clock.runFor(500)
 expect(await page.evaluate(()=>window.challengeAttempts)).toBe(2)
 expect(state.requests).toHaveLength(1)
})
test('visibility restoration performs one list refresh; detail never refreshes history',async({page})=>{
 const state=await backend(page)
 await page.goto('/#/');await expect(page.locator('.server-card')).toHaveCount(6)
 await page.evaluate(()=>{window.mockHidden=true;document.dispatchEvent(new Event('visibilitychange'))})
 const count=state.requests.length;await page.waitForTimeout(1100);expect(state.requests.length).toBe(count)
 await page.evaluate(()=>{window.mockHidden=false;document.dispatchEvent(new Event('visibilitychange'))})
 await expect.poll(()=>state.requests.filter(r=>r.path==='/api/servers').length).toBe(2)
 await page.locator('.server-name').first().click();await expect(page.locator('.detail-stats')).toBeVisible()
 const history=state.requests.filter(r=>r.path==='/api/history/all').length
 await page.evaluate(()=>{window.mockHidden=true;document.dispatchEvent(new Event('visibilitychange'));window.mockHidden=false;document.dispatchEvent(new Event('visibilitychange'))})
 await expect.poll(()=>state.requests.filter(r=>r.path==='/api/server').length).toBe(2)
 expect(state.requests.filter(r=>r.path==='/api/history/all')).toHaveLength(history)
})
test('anonymous private site redirects to built-in admin',async({page})=>{
 const state=await backend(page,{isPublic:false})
 await page.route('**/admin',r=>r.fulfill({contentType:'text/html',body:'Built-in login'}))
 await page.goto('/#/');await expect(page).toHaveURL(/\/admin#\/admin/)
 expect(state.requests.filter(r=>r.path==='/api/servers')).toHaveLength(0)
})
test('renders desktop and mobile without overflow',async({page})=>{
 const state=await backend(page);await page.setViewportSize({width:1440,height:1100});await page.goto('/#/');await expect(page.locator('.server-card')).toHaveCount(6)
 await page.locator('.server-name').first().click();await expect(page.locator('.detail-stats')).toBeVisible()
 await page.goto('/#/');await page.setViewportSize({width:390,height:844});await expect(page.locator('.server-card')).toHaveCount(6)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 state.cfg.preferred_theme='light';await page.setViewportSize({width:1440,height:1100});await page.reload();await expect(page.locator('.server-card')).toHaveCount(6)
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
test('dashboard coalesces bursts, preserves report fields, no background REST polling',async({page})=>{
 const state=await backend(page)
 await page.goto('/#/');await expect(page.locator('.server-card').first()).toContainText('71.0%')
 await page.evaluate(()=>{
  window.cpuMutations=[];const node=document.querySelector('.server-card .metric-line b');new MutationObserver(()=>window.cpuMutations.push({at:performance.now(),value:node.textContent})).observe(node,{childList:true,subtree:true,characterData:true})
 })
 const ws=state.sockets[0]
 const start=Date.now()
 for(let i=0;i<30;i++)ws.send(JSON.stringify({type:'batchUpdate',updates:[{serverId:'1',reportTs:start,samples:[{ts:start+i,data:{cpu:40+i}}]}]}))
 await expect(page.locator('.server-card').first()).toContainText('69.0%')
 const changes=await page.evaluate(()=>window.cpuMutations)
 expect(changes.length).toBeLessThanOrEqual(2)
 if(changes.length===2)expect(changes[1].at-changes[0].at).toBeGreaterThanOrEqual(950)
 const card=page.locator('.server-card').first();await expect(card).toContainText('32.2%');await expect(card).toContainText('联通')
 const count=state.requests.length;await page.waitForTimeout(1500);expect(state.requests.length).toBe(count)
 expect(state.requests.filter(r=>r.path==='/api/history/all')).toHaveLength(0)
})
test('multi-site WS subscribe payloads contain only that backend IDs, detail uses selected backend',async({page})=>{
 const subscriptions=[],requests=[]
 await page.addInitScript(()=>{window.mockHidden=false;Object.defineProperty(document,'hidden',{get:()=>window.mockHidden});localStorage.setItem('jwt_token','cross-jwt')})
 await page.route(`${base}/`,async route=>{
  const response=await route.fetch();const html=(await response.text()).replace('name="apiBase" content=""','name="apiBase" content="https://one.example,https://two.example"').replace(/connect-src ([^;]*)/,'connect-src $1 https://one.example https://two.example wss://one.example wss://two.example').replace(/img-src ([^;]*)/,'img-src $1 https://one.example https://two.example')
  await route.fulfill({response,body:html})
 })
 await page.route('https://*.example/api/**',async route=>{
  const url=new URL(route.request().url());const id=url.host==='one.example'?'one-id':'two-id';requests.push(url.toString())
  const headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
  if(url.pathname==='/api/config')return route.fulfill({headers,json:{site_title:url.host,is_public:false,authorization:true,turnstile_enabled:false,preferred_theme:'light',default_language:'en'}})
  if(url.pathname==='/api/servers')return route.fulfill({headers,json:{servers:[{id,name:id,cpu:3,last_updated:Date.now()}],stats:{total:1,online:1,offline:0},sysConfig:{}}})
  if(url.pathname==='/api/server')return route.fulfill({headers,json:{id,name:id,cpu:3,last_updated:Date.now()}})
  return route.fulfill({headers,json:[]})
 })
 await page.route('https://*.example/os-icons/*',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'}))
 await page.routeWebSocket('wss://*.example/api/ws?*',ws=>ws.onMessage(msg=>subscriptions.push({url:ws.url(),...JSON.parse(msg)})))
 await page.goto('/#/');await expect(page.locator('.server-card')).toHaveCount(2)
 await expect.poll(()=>subscriptions.length).toBe(2)
 for(const sub of subscriptions){const url=new URL(sub.url);expect(sub.ids).toEqual([url.host==='one.example'?'one-id':'two-id']);expect(url.searchParams.get('token')).toBe('cross-jwt')}
 await page.getByRole('link',{name:'two-id ↗'}).click();await expect(page.locator('.detail-stats')).toBeVisible()
 await expect.poll(()=>subscriptions.length).toBe(3)
 const sub=subscriptions.at(-1);expect(new URL(sub.url).searchParams.get('subscribe')).toBe('two-id');expect(new URL(sub.url).host).toBe('two.example')
 expect(requests.filter(u=>new URL(u).pathname==='/api/server').every(u=>new URL(u).host==='two.example')).toBe(true)
})
test('backend theme options still apply without a frontend settings dialog',async({page})=>{
 const state=await backend(page,{jwt:true})
 state.cfg.theme_options={accent:'#3366aa',density:'compact',showCharts:false,vendor_key:'retain'}
 await page.goto('/#/');await expect(page.locator('.server-card')).toHaveCount(6)
 await expect(page.locator('html')).toHaveCSS('--accent','#3366aa')
 await expect(page.locator('html')).toHaveAttribute('data-density','compact')
 await expect(page.locator('.card-charts')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'主题选项'})).toHaveCount(0)
 await expect(page.getByRole('dialog')).toHaveCount(0)
 expect(state.requests.filter(r=>r.method==='POST')).toHaveLength(0)
})

test('online card expires after five minutes without REST; backend totals retain snapshot',async({page})=>{
 await page.clock.install()
 const state=await backend(page);await page.goto('/#/');await expect(page.locator('.server-card')).toHaveCount(6)
 await page.clock.runFor(1100)
 const requests=state.requests.length
 await page.clock.fastForward(301000)
 await expect(page.locator('.server-card .status-chip.online')).toHaveCount(0)
 expect(state.requests.length).toBe(requests)
 await expect(page.locator('.summary').nth(1)).toContainText('5')
})
