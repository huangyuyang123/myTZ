import {test,expect} from '@playwright/test'
import {nativeBackend} from './nativeBackend.js'
import {createServer} from 'node:http'

async function setup(page,testInfo) {
  // Serve real loopback HTML. Intercepted HTML is classified as public address space
  // by Chrome, which would correctly deny native loopback API requests under LNA.
  const vite=testInfo.project.use.baseURL
  let backend
  const frontendServer=createServer(async(req,res)=>{
    try {
      const response=await fetch(vite+req.url)
      res.statusCode=response.status
      res.setHeader('Content-Type',response.headers.get('Content-Type')||'application/octet-stream')
      if((response.headers.get('Content-Type')||'').includes('text/html')) {
        const html=(await response.text()).replace('name="apiBase" content=""',`name="apiBase" content="${backend.origin}"`).replace(/http-equiv="Content-Security-Policy" content="([^"]*)"/,(match,encoded)=>{
          const csp=encoded.replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/connect-src ([^;]*)/,`connect-src $1 ${backend.origin} ${backend.origin.replace('http:','ws:')} ${vite.replace('http:','ws:')}`).replace(/img-src ([^;]*)/,`img-src $1 ${backend.origin}`)
          return `http-equiv="Content-Security-Policy" content="${csp.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"`
        })
        res.end(html)
      } else res.end(Buffer.from(await response.arrayBuffer()))
    } catch {res.writeHead(502);res.end('Local fixture proxy failed')}
  })
  await new Promise(resolve=>frontendServer.listen(0,'127.0.0.1',resolve))
  const frontend=`http://127.0.0.1:${frontendServer.address().port}`
  backend=await nativeBackend(frontend)
  await page.addInitScript(token=>localStorage.setItem('jwt_token',token),backend.token)
  backend.frontend=frontend
  const closeBackend=backend.close
  backend.close=async()=>{await closeBackend();frontendServer.closeAllConnections();await new Promise(resolve=>frontendServer.close(resolve))}
  return backend
}

test('Native cross-origin private HTTP and WS carry JWT; actual HTTP 401 stops sockets and redirects once',async({page},testInfo)=>{
  const backend=await setup(page,testInfo)
  try {
    await page.goto(backend.frontend+'/#/');await expect(page.locator('.server-card')).toHaveCount(1)
    await expect(page.locator('.server-card')).toContainText('71.0%')
    expect(backend.upgrades).toEqual([{status:101,urlToken:true,cookie:false,origin:backend.frontend}])
    expect(backend.subscriptions).toEqual([{type:'subscribe',scope:'all',ids:['native-1']}])
    expect(backend.requests.filter(r=>r.path==='/api/servers')).toEqual([{path:'/api/servers',status:200,jwt:true}])
    backend.denyAuth=true
    await page.locator('.server-name').click();await expect(page).toHaveURL(backend.origin+'/admin#/admin')
    await expect.poll(()=>backend.sockets.size).toBe(0)
    expect(backend.requests.filter(r=>r.status===401).length).toBeGreaterThan(0)
    expect(backend.requests.filter(r=>r.path==='/admin')).toHaveLength(1)
  } finally {await backend.close()}
})

test('Private native WS ends at client JWT expiry and does not reconnect or poll',async({page},testInfo)=>{
  await page.clock.install()
  const backend=await setup(page,testInfo)
  try {
    await page.goto(backend.frontend+'/#/');await expect(page.locator('.server-card')).toHaveCount(1)
    await expect(page.locator('.server-card')).toContainText('71.0%')
    const requests=backend.requests.filter(r=>r.path.startsWith('/api/')).length
    await page.clock.fastForward(61000)
    await expect(page).toHaveURL(backend.origin+'/admin#/admin')
    await expect.poll(()=>backend.sockets.size).toBe(0)
    expect(backend.upgrades).toHaveLength(1)
    expect(backend.requests.filter(r=>r.path.startsWith('/api/'))).toHaveLength(requests)
  } finally {await backend.close()}
})

test('Initial real list 401 does not refresh data while login navigation is still pending',async({page},testInfo)=>{
  const backend=await setup(page,testInfo)
  backend.denyList=true;backend.adminDelay=1000
  try {
    await page.goto(backend.frontend+'/#/',{waitUntil:'domcontentloaded'})
    await expect(page).toHaveURL(backend.origin+'/admin#/admin')
    expect(backend.requests.filter(r=>r.path==='/api/servers')).toEqual([{path:'/api/servers',status:401,jwt:true}])
    expect(backend.requests.filter(r=>r.path==='/api/config')).toHaveLength(1)
    expect(backend.requests.filter(r=>r.path==='/admin')).toHaveLength(1)
    expect(backend.upgrades).toHaveLength(0)
  } finally {await backend.close()}
})
