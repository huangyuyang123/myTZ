import {test,expect} from '@playwright/test'

const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
async function fixture(page,{multi=false,clocked=false}={}) {
  const start=Date.now(),writes=[],requests=[]
  await page.addInitScript(({clocked})=>{
    localStorage.setItem('jwt_token','isolated-test-jwt')
    if(clocked) {
      class MockSocket {
        constructor(){this.timer=setTimeout(()=>this.onopen?.(),10)}
        send(message){const sub=JSON.parse(message);this.interval=setInterval(()=>this.onmessage?.({data:JSON.stringify({type:'batchUpdate',updates:[{serverId:'node',reportTs:Date.now(),samples:[{ts:Date.now(),data:{cpu:42,ram_used:200}}]}]})}),1000)}
        close(){clearTimeout(this.timer);clearInterval(this.interval)}
      }
      window.WebSocket=MockSocket
    }
  },{clocked})
  if(multi) await page.route(`${base}/`,async route=>{
    const response=await route.fetch()
    const body=(await response.text()).replace('name="apiBase" content=""','name="apiBase" content="https://one.example,https://two.example"')
      .replace(/connect-src ([^;]*)/,'connect-src $1 https://one.example https://two.example wss://one.example wss://two.example')
      .replace(/img-src ([^;]*)/,'img-src $1 https://one.example https://two.example')
    await route.fulfill({response,body})
  })
  const cfgA={site_title:'Site A',is_public:true,authorization:true,turnstile_enabled:false,preferred_theme:'light',default_language:'zh',theme_options:{accent:'#f26b38',alpha_only:'A'},frontend_ws_timeout_minutes:0}
  const cfgB={...cfgA,site_title:'Site B',theme_options:{accent:'#3366aa',beta_only:'B'}}
  const server={id:'node',name:'Audit node',region:'us',os:'Ubuntu',cpu:90,ram_total:1000,ram_used:200,disk_total:1000,disk_used:300,last_updated:start}
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url())
    const headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers})
    requests.push({path:url.pathname,hours:url.searchParams.get('hours')})
    const cfg=url.host==='two.example'?cfgB:cfgA
    if(url.pathname==='/api/config')return route.fulfill({headers,json:cfg})
    if(url.pathname==='/api/servers')return route.fulfill({headers,json:{servers:[server],stats:{total:1,online:1,offline:0},sysConfig:{}}})
    if(url.pathname==='/api/server')return route.fulfill({headers,json:server})
    if(url.pathname==='/api/history/all'){
      const h=Number(url.searchParams.get('hours')),rows=Array.from({length:120},(_,i)=>({timestamp:start-h*3600000+i*h*3600000/120,cpu:10+i%20,ram_used:200}))
      return route.fulfill({headers,json:rows})
    }
    if(url.pathname==='/api/theme_options'){
      const body=req.postDataJSON();writes.push({host:url.host,body})
      cfg.theme_options=body.theme_options
      return route.fulfill({headers,json:{success:true,theme_options:cfg.theme_options}})
    }
    return route.fulfill({headers,status:404,json:{error:'unexpected'}})
  })
  await page.route('**/flags/*.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="15"/>'}))
  await page.route('**/os-icons/*',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="15"/>'}))
  if(!clocked)await page.routeWebSocket('**/api/ws?*',ws=>ws.onMessage(()=>{}))
  return {start,writes,requests,server}
}

test('multi-site backend appearance stays isolated with no frontend settings entry',async({page})=>{
 const state=await fixture(page,{multi:true})
 await page.goto('/#/');await expect(page.locator('.server-card')).toHaveCount(2)
 await expect(page.getByRole('button',{name:'主题选项'})).toHaveCount(0)
 const options=await page.evaluate(async()=>{
  const {sites}=await import('/src/composables/useMonitor.js')
  return sites.value.map(site=>site.config.theme_options)
 })
 expect(options[0]).toEqual({accent:'#f26b38',alpha_only:'A'})
 expect(options[1]).toEqual({accent:'#3366aa',beta_only:'B'})
 await expect(page.getByRole('link',{name:'管理',exact:true})).toHaveAttribute('href','https://one.example/admin#/admin')
 expect(state.writes).toEqual([])
})

test('24 hour history retains its selected time range after 21 minutes of live updates',async({page})=>{
  test.setTimeout(90000)
  await page.clock.install()
  const state=await fixture(page,{clocked:true})
  await page.goto('/#/');await expect(page.locator('.server-card')).toHaveCount(1)
  await page.getByRole('link',{name:'Audit node ↗',exact:true}).click()
  await expect(page.locator('.detail-stats')).toBeVisible()
  await page.getByRole('combobox',{name:'历史范围',exact:true}).selectOption('24')
  await expect(page.getByRole('combobox',{name:'历史范围',exact:true})).toHaveValue('24')
  const readHistory=()=>page.evaluate(async()=>{
    const monitor=await import('/src/composables/useMonitor.js')
    const entry=await monitor.sites.value[0].details.get('node').promise
    return {hours:entry.hours,rows:entry.history.length,oldest:entry.history[0]?.timestamp,newest:entry.history.at(-1)?.timestamp}
  })
  const before=await readHistory()
  await page.clock.runFor(21*60000)
  const after=await readHistory()
  console.log('HISTORY_WINDOW',JSON.stringify({before,after,spanMinutes:(after.newest-after.oldest)/60000,historyRequests:state.requests.filter(r=>r.path==='/api/history/all').length}))
  expect(after.oldest,'The 24 hour selection must not collapse to the latest 20 minutes').toBeLessThan(state.start-23*3600000)
  expect(after.rows).toBeLessThanOrEqual(1200)
  expect(state.requests.filter(r=>r.path==='/api/history/all')).toHaveLength(2)
  expect(state.requests.filter(r=>r.path==='/api/servers')).toHaveLength(1)
  expect(state.requests.filter(r=>r.path==='/api/config')).toHaveLength(1)
})


test('long server names fit 320, 360 and 390 pixel phone layouts',async({page})=>{
  const state=await fixture(page)
  state.server.name='阿里云抢占式200g4元'
  const results=[]
  for(const width of [320,360,390]) {
    await page.setViewportSize({width,height:844})
    if(width===320) await page.goto('/#/')
    await expect(page.locator('.server-card')).toHaveCount(1)
    const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,cardRight:document.querySelector('.server-card').getBoundingClientRect().right}))
    results.push(metrics)
    expect(metrics.scrollWidth).toBeLessThanOrEqual(width)
    expect(metrics.cardRight).toBeLessThanOrEqual(width)
    if(width===320) await page.screenshot({path:'../../work/chainsaw-fixed-320.png',fullPage:true})
  }
  console.log('PHONE_WIDTHS',JSON.stringify(results))
})
