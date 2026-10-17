import {test,expect} from '@playwright/test'
import {fileURLToPath} from 'node:url'

async function fixture(page,{brokenScript='network'}={}){
 const calls=[],scripts=[],metrics={id:'node',name:'Recovery fixture',cpu:3,last_updated:Date.now()}
 await page.routeWebSocket('**/api/ws?*',ws=>ws.onMessage(()=>{}))
 await page.route('**/os-icons/*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'}))
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname,headers=route.request().headers();calls.push({path,verified:!!headers['x-turnstile-verified'],token:!!headers['x-turnstile-token']})
  if(path==='/api/config')return route.fulfill({json:{site_title:'Local recovery fixture',is_public:true,turnstile_enabled:true,turnstile_site_key:'fixture-key',preferred_theme:'light',default_language:'en',...(headers['x-turnstile-token']?{turnstile_verified:'fixture-proof'}:{})}})
  if(headers['x-turnstile-verified']!=='fixture-proof')return route.fulfill({status:403,json:{error:'Turnstile verification failed'}})
  if(path==='/api/servers')return route.fulfill({json:{servers:[metrics],stats:{total:1,online:1},sysConfig:{}}})
  if(path==='/api/server')return route.fulfill({json:metrics})
  return route.fulfill({json:[]})
 })
 await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*',route=>{
  scripts.push(1)
  if(scripts.length===1){
   if(brokenScript==='network')return route.abort('failed')
   return route.fulfill({contentType:'application/javascript',body:'/* Loaded without the expected API, local fixture only. */'})
  }
  return route.fulfill({contentType:'application/javascript',body:"window.turnstile={render(host,opts){host.textContent='Local verification fixture';setTimeout(()=>opts.callback('fixture-challenge'),10);return 1},remove(){}}"})
 })
 return {calls,scripts}
}

for(const brokenScript of ['network','missing-api'])test(`verification ${brokenScript} failure remains retryable without reloading config`,async({page})=>{
 const state=await fixture(page,{brokenScript})
 await page.goto('/#/')
 const dialog=page.getByRole('dialog',{name:'Access verification'})
 await expect(dialog.getByRole('alert')).toHaveText('Verification could not load. Check your connection and try again.')
 await expect(dialog).toBeVisible();await expect(page.locator('.fatal-error')).toHaveCount(0)
 expect(state.scripts).toHaveLength(1)
 expect(state.calls.map(c=>c.path)).toEqual(['/api/config'])
 await dialog.getByRole('button',{name:'Try again',exact:true}).click()
 await expect(dialog).toHaveCount(0);await expect(page.locator('.server-card')).toHaveCount(1)
 expect(state.scripts).toHaveLength(2)
 expect(state.calls.map(c=>c.path)).toEqual(['/api/config','/api/config','/api/servers'])
 expect(state.calls[1].token).toBe(true);expect(state.calls[2].verified).toBe(true)
 await expect(page.locator('.fatal-error')).toHaveCount(0)
})

for(const start of ['/#/','/#/server/node'])test(`verification stays open until a successful retry from ${start}`,async({page})=>{
 const state=await fixture(page)
 await page.goto(start)
 const dialog=page.getByRole('dialog',{name:'Access verification'})
 await expect(dialog.getByRole('alert')).toBeVisible()
 await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toHaveCount(0)
 await page.keyboard.press('Escape')
 await page.locator('.modal-backdrop').click({position:{x:5,y:5}})
 await expect(dialog).toBeVisible()
 expect(state.scripts).toHaveLength(1)
 expect(state.calls.map(c=>c.path)).toEqual(['/api/config'])
 if(start==='/#/')await dialog.screenshot({path:fileURLToPath(new URL('../../../turnstile-no-cancel.png',import.meta.url))})
 await dialog.getByRole('button',{name:'Try again',exact:true}).click()
 await expect(dialog).toHaveCount(0)
 await expect(start==='/#/'?page.locator('.server-card'):page.locator('.detail-stats')).toBeVisible()
 const other=start==='/#/'?'#/server/node':'#/'
 await page.evaluate(hash=>{location.hash=hash},other)
 await expect(start==='/#/'?page.locator('.detail-stats'):page.locator('.server-card')).toBeVisible()
 await page.evaluate(hash=>{location.hash=hash},start==='/#/'?'#/':'#/server/node')
 await expect(start==='/#/'?page.locator('.server-card'):page.locator('.detail-stats')).toBeVisible()
 expect(state.calls.filter(c=>c.path==='/api/config')).toHaveLength(2)
 expect(state.scripts).toHaveLength(2)
})
