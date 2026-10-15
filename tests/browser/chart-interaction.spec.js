import {test,expect} from '@playwright/test'
import {fileURLToPath} from 'node:url'

const screenshot=name=>fileURLToPath(new URL(`../../../hover-${name}.png`,import.meta.url))
async function fixture(page){
 const start=Date.now()-540000
 const metrics={cpu:45.5,ram_total:8192,ram_used:2048,swap_total:2048,swap_used:0,disk_total:102400,disk_used:25600,net_in_speed:1048576,net_out_speed:524288,processes:124,tcp_conn:32,udp_conn:4,net_rx:1234567890,net_tx:3456789012,ping_ct:17,ping_cu:24,loss_ct:0,loss_cu:0,ip_v4:'1',ip_v6:'0',last_updated:Date.now(),disk:{read_bps:4096,write_bps:2048},gpu_info:[{id:'0',name:'NVIDIA RTX 3060',info:12.5}]}
 const state={requests:[],socket:null,config:{site_title:'Observatory',is_public:true,preferred_theme:'light',default_language:'zh',turnstile_enabled:false,custom_ct_name:'电信',custom_cu_name:'联通'},rows:[0,30000,120000,360000,540000].map((offset,i)=>({...metrics,timestamp:start+offset,cpu:[0,10.25,45.5,76,90][i],ping_ct:[0,null,false,undefined,17][i],ping_cu:[14,33,null,25,24][i]}))}
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url());state.requests.push(url.pathname)
  if(url.pathname==='/api/config')return route.fulfill({json:state.config})
  if(url.pathname==='/api/server')return route.fulfill({json:{...metrics,id:'node',name:'Tokyo · Edge 01',region:'jp',os:'Ubuntu 22.04',arch:'x86_64',cpu_cores:4,server_group:'Edge network'}})
  if(url.pathname==='/api/history/all')return route.fulfill({json:state.rows})
  return route.fulfill({json:{servers:[],stats:{},sysConfig:{}}})
 })
 await page.route('**/flags/*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20"><path fill="white" d="M0 0h30v20H0z"/><circle fill="#bc002d" cx="15" cy="10" r="6"/></svg>'}))
 await page.routeWebSocket('**/api/ws?*',ws=>{state.socket=ws;ws.onMessage(()=>{})})
 await page.goto('/#/server/node');await expect(page.locator('.history-card')).toHaveCount(7)
 await expect.poll(()=>state.socket!==null).toBe(true)
 return state
}
const card=(page,title)=>page.locator('.history-card').filter({has:page.getByRole('heading',{name:title,exact:true})})
async function hoverAt(page,chart,fraction){
 const svg=chart.locator('.detail-plot-stage svg');await svg.scrollIntoViewIfNeeded()
 const box=await svg.boundingBox()
 await page.mouse.move(box.x+box.width*(4+392*fraction)/400,box.y+box.height*.7)
 return chart.getByRole('tooltip')
}

test('history hover uses the nearest real timestamp for every chart and makes no requests',async({page})=>{
 await page.setViewportSize({width:1440,height:1000})
 const state=await fixture(page),before=state.requests.length,cpu=card(page,'CPU')
 let tip=await hoverAt(page,cpu,120000/540000)
 await expect(tip.locator('time')).toHaveAttribute('data-timestamp',String(state.rows[2].timestamp))
 await expect(tip).toContainText('45.5 %')
 await expect(cpu.locator('.chart-crosshair')).toHaveCount(1)
 await expect(cpu.locator('.chart-selected-point')).toHaveCount(1)
 await page.screenshot({path:screenshot('cpu-light'),fullPage:false})
 tip=await hoverAt(page,cpu,0);await expect(tip).toContainText('0 %')
 tip=await hoverAt(page,cpu,1);await expect(tip).toContainText('90 %')
 for(const [title,value] of [['内存 / Swap','2 GB'],['网络速率','1 MB/s'],['丢包率','0 %'],['磁盘 IO','4 KB/s'],['NVIDIA RTX 3060','12.5 %']]){
  tip=await hoverAt(page,card(page,title),120000/540000);await expect(tip).toContainText(value)
 }
 const latency=card(page,'延迟')
 tip=await hoverAt(page,latency,0);await expect(tip).toContainText('0 ms')
 tip=await hoverAt(page,latency,30000/540000)
 await expect(tip.locator('dl>div').nth(0)).toHaveText('电信超时')
 await expect(tip.locator('dl>div').nth(1)).toHaveText('联通33 ms')
 tip=await hoverAt(page,latency,120000/540000)
 await expect(tip.locator('dl>div').nth(0)).toHaveText('电信—')
 await expect(tip.locator('dl>div').nth(1)).toHaveText('联通超时')
 tip=await hoverAt(page,latency,360000/540000);await expect(tip.locator('dl>div').nth(0)).toHaveText('电信—')
 await page.mouse.move(0,0);await expect(page.getByRole('tooltip')).toHaveCount(0)
 expect(state.requests).toHaveLength(before)
 state.config.preferred_theme='dark';await page.reload()
 tip=await hoverAt(page,card(page,'延迟'),30000/540000);await expect(tip).toBeVisible()
 await page.screenshot({path:screenshot('latency-dark'),fullPage:false})
})

test('keyboard selection is stable across live updates and resets on range change or expiry',async({page})=>{
 await page.clock.install()
 const state=await fixture(page),cpu=card(page,'CPU'),svg=cpu.locator('.detail-plot-stage svg'),tip=cpu.getByRole('tooltip')
 await page.getByRole('combobox',{name:'历史范围'}).focus();await page.keyboard.press('Tab')
 await expect(svg).toBeFocused();await expect(tip).toContainText('90 %')
 await page.keyboard.press('Home');await expect(tip).toContainText('0 %')
 await page.keyboard.press('ArrowRight');await expect(tip).toContainText('10.25 %')
 const selected=state.rows[1].timestamp,before=state.requests.length
 state.socket.send(JSON.stringify({type:'batchUpdate',updates:[{serverId:'node',reportTs:Date.now(),samples:[{ts:Date.now(),data:{cpu:99}}]}]}))
 await page.clock.runFor(1100)
 await expect(tip.locator('time')).toHaveAttribute('data-timestamp',String(selected))
 await expect(tip).toContainText('10.25 %')
 await page.keyboard.press('End');await expect(tip).toContainText('99 %')
 await page.keyboard.press('ArrowLeft');await expect(tip).toContainText('90 %')
 await page.keyboard.press('Escape');await expect(tip).toHaveCount(0)
 await page.keyboard.press('Home');await expect(tip).toContainText('0 %')
 expect(state.requests).toHaveLength(before)
 // The selected sample ages out when the next live batch compacts the window.
 await page.clock.fastForward(11*60000)
 const now=await page.evaluate(()=>Date.now())
 state.socket.send(JSON.stringify({type:'batchUpdate',updates:[{serverId:'node',reportTs:now,samples:[{ts:now,data:{cpu:44}}]}]}))
 await page.clock.runFor(1100);await expect(tip).toHaveCount(0)
 await page.keyboard.press('End');await expect(tip).toContainText('44 %')
 await page.getByRole('combobox',{name:'历史范围'}).selectOption('1');await expect(tip).toHaveCount(0)
 expect(state.requests.filter(p=>p==='/api/history/all')).toHaveLength(2)
})

test('single sample and empty history do not invent data',async({page})=>{
 const state=await fixture(page)
 state.rows=[state.rows[0]];await page.reload()
 const cpu=card(page,'CPU');await expect(cpu.locator('.detail-plot-stage')).toBeVisible()
 let tip=await hoverAt(page,cpu,1);await expect(tip).toContainText('0 %')
 await expect(tip.locator('time')).toHaveAttribute('data-timestamp',String(state.rows[0].timestamp))
 state.rows=[];await page.reload()
 await expect(cpu.locator('.detail-chart-empty')).toHaveText('暂无历史样本')
 await expect(cpu.locator('[tabindex]')).toHaveCount(0)
 await expect(page.getByRole('tooltip')).toHaveCount(0)
})

test('touch selection fits narrow screens, closes outside, and lets vertical gestures scroll',async({browser})=>{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:5173',viewport:{width:320,height:844},hasTouch:true,isMobile:true})
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const state=await fixture(page)
  state.config.default_language='en';state.config.custom_ct_name='A very long custom carrier name';await page.reload()
  const cpu=card(page,'CPU'),svg=cpu.locator('.detail-plot-stage svg')
  await svg.scrollIntoViewIfNeeded();let box=await svg.boundingBox()
  await page.touchscreen.tap(box.x+box.width*.98,box.y+70)
  const tip=cpu.getByRole('tooltip');await expect(tip).toContainText('90 %')
  const bounds=await tip.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(320)
  await page.screenshot({path:screenshot('mobile-320'),fullPage:false})
  await cpu.getByRole('heading').tap();await expect(tip).toHaveCount(0)
  await svg.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:1,clientX:box.x+30,clientY:box.y+50})
  await svg.dispatchEvent('pointermove',{pointerType:'touch',pointerId:1,clientX:box.x+30,clientY:box.y+100})
  await svg.dispatchEvent('pointerup',{pointerType:'touch',pointerId:1,clientX:box.x+30,clientY:box.y+100})
  await expect(tip).toHaveCount(0)
  await expect(cpu.locator('.detail-plot-stage')).toHaveCSS('touch-action','pan-y')
  const latency=card(page,'Latency')
  await latency.locator('.detail-plot-stage svg').scrollIntoViewIfNeeded();box=await latency.locator('svg').boundingBox()
  await page.touchscreen.tap(box.x+box.width*(4+392*30000/540000)/400,box.y+70)
  await expect(latency.getByRole('tooltip')).toContainText('Timeout')
  const longBounds=await latency.getByRole('tooltip').boundingBox();expect(longBounds.x+longBounds.width).toBeLessThanOrEqual(320)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect(errors).toEqual([])
 }finally{await context.close()}
})
