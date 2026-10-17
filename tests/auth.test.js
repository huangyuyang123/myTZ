import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {createHmac} from 'node:crypto'
import {jwtExpiresAt, jwtExpired} from '../src/utils/auth.js'
import {createHttp} from '../src/utils/http.js'
import {createSocket} from '../src/utils/socket.js'

const base = 'https://backend.example'
function storage() { const map=new Map(); return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)} }
const deferred = () => { let resolve; const promise=new Promise(r=>resolve=r); return {promise,resolve} }
function jwt(exp) {
  const head=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')
  const body=Buffer.from(JSON.stringify({sub:'test-only',exp})).toString('base64url')
  return `${head}.${body}.${createHmac('sha256','local-test-secret').update(`${head}.${body}`).digest('base64url')}`
}
function clock() {
  let now=0, id=0; const timers=new Map()
  return {now:()=>now,set:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id},clear:id=>timers.delete(id),advance(ms){const target=now+ms; for(;;){const next=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);now=next[1].at;next[1].fn()}now=target},timers}
}

test('JWT expiry is a time hint, accepts base64url, and does not invent expiry for opaque tokens',()=>{
  assert.equal(jwtExpiresAt(jwt(3)),3000)
  assert.equal(jwtExpired(jwt(3),2999),false);assert.equal(jwtExpired(jwt(3),3000),true)
  assert.equal(jwtExpired(jwt(0),0),true)
  for(const token of ['opaque','bad.invalid.signature',jwt('3'),jwt(null)]) assert.equal(jwtExpiresAt(token),null)
})

test('Delayed old 403 cannot remove a fresh credential or start a second challenge',async()=>{
  const store=storage(),late=deferred(),firstRetried=deferred(),key=`cfsm:turnstile_verified:${base}`
  store.setItem(key,'old')
  let challenges=0,exchanges=0,oldCalls=0,success=0
  const http=createHttp(base,{getConfig:()=>({is_public:true,turnstile_enabled:true,turnstile_site_key:'key'}),storage:store,challenge:async()=>{challenges++;return 'test-challenge'},fetcher:async(url,opts)=>{
    if(url.endsWith('/api/config')){exchanges++;return new Response('{"turnstile_verified":"fresh"}')}
    if(opts.headers['X-Turnstile-Verified']==='old'){
      if(++oldCalls===2) await late.promise
      return new Response('{"error":"Turnstile verification failed"}',{status:403})
    }
    success++;firstRetried.resolve();return new Response('{}')
  }})
  const requests=Promise.all([http.request('/api/server?id=1'),http.request('/api/history/all?id=1&hours=0.167')])
  await firstRetried.promise
  assert.equal(store.getItem(key),'fresh');late.resolve();await requests
  assert.equal(challenges,1);assert.equal(exchanges,1);assert.equal(success,2);assert.equal(store.getItem(key),'fresh')
})

test('A late 401 preserves a replacement login and retries only once with the new JWT',async()=>{
  const store=storage(),started=deferred(),reply=deferred(),redirects=[],headers=[]
  store.setItem('jwt_token','old-login')
  const http=createHttp(base,{storage:store,getConfig:()=>({is_public:false}),redirect:u=>redirects.push(u),fetcher:async(_url,opts)=>{
    headers.push(opts.headers.Authorization)
    if(headers.length===1){started.resolve();await reply.promise;return new Response('{}',{status:401})}
    return new Response('{}')
  }})
  const pending=http.request('/api/servers');await started.promise
  store.setItem('jwt_token','new-login');reply.resolve();await pending
  assert.deepEqual(headers,['Bearer old-login','Bearer new-login'])
  assert.equal(store.getItem('jwt_token'),'new-login');assert.deepEqual(redirects,[])
})

test('Known expired private JWT redirects once before data or verification requests',async()=>{
  const store=storage(),redirects=[];store.setItem('jwt_token',jwt(Math.floor(Date.now()/1000)-1))
  let requests=0,challenges=0
  const http=createHttp(base,{storage:store,getConfig:()=>({is_public:false,turnstile_enabled:true}),redirect:u=>redirects.push(u),challenge:async()=>{challenges++},fetcher:async()=>{requests++;return new Response('{}')}})
  await assert.rejects(http.request('/api/servers'),e=>e.status===401)
  await assert.rejects(http.request('/api/server?id=1'),e=>e.status===401)
  assert.equal(store.getItem('jwt_token'),null);assert.equal(requests,0);assert.equal(challenges,0);assert.deepEqual(redirects,[base+'/admin#/admin'])
})

test('A private live socket stops at JWT expiry without REST or reconnect; public sockets remain anonymous-capable',()=>{
  globalThis.location={origin:'https://theme.example'}
  for(const requireAuth of [true,false]) {
    const time=clock(),created=[],unauthorized=[]
    class WS{constructor(url){this.url=url;created.push(this)}send(){}close(){this.onclose?.({code:1000})}}
    const socket=createSocket({base,scope:'all',ids:['1'],jwt:jwt(2),requireAuth,clock:time,WebSocketClass:WS,onStatus:()=>{},onBatch:()=>{},onTimeout:()=>{},onUnauthorized:t=>unauthorized.push(t)})
    created[0].onopen();time.advance(2000)
    assert.equal(unauthorized.length,requireAuth?1:0);time.advance(100000);assert.equal(created.length,1);socket.close()
  }
})

test('Reconnect reads replacement JWT and a pending retry cannot duplicate the expiry-driven connection',()=>{
  globalThis.location={origin:'https://theme.example'}
  const time=clock(),created=[],statuses=[];let token=jwt(1),unauthorized=0
  class WS{constructor(url){this.url=url;created.push(this)}send(){}close(){this.onclose?.({code:1000})}}
  const live=createSocket({base,scope:'1',ids:['1'],jwt:()=>token,requireAuth:true,deadline:5000,clock:time,WebSocketClass:WS,onStatus:s=>statuses.push(s),onBatch:()=>{},onTimeout:()=>{},onUnauthorized:()=>unauthorized++})
  created[0].onopen();created[0].close();token=jwt(10);time.advance(1000)
  assert.equal(created.length,2);assert.equal(new URL(created[1].url).searchParams.get('token'),token)
  time.advance(3999);assert.equal(created.length,2);time.advance(1);assert(statuses.includes('paused'));assert.equal(unauthorized,0);live.close()
})

test('Browser-blocked socket exposes blocked state without throwing a URL containing JWT',()=>{
  const statuses=[],time=clock()
  class WS{constructor(url){throw Error('Blocked: '+url)}}
  createSocket({base,scope:'all',ids:['1'],jwt:jwt(9),requireAuth:true,deadline:5000,clock:time,WebSocketClass:WS,onStatus:s=>statuses.push(s),onBatch:()=>{},onTimeout:()=>{},onUnauthorized:()=>{}})
  assert.deepEqual(statuses,['connecting','blocked']);assert.equal(time.timers.size,0)
})

test('Native HTTP returns signed-token expiry 401 and credential-invalid 403; client clears or recovers without looping',async t=>{
  // An isolated local service, not the user's Worker or a Playwright response interception.
  const calls=[]
  const server=createServer((req,res)=>{
    calls.push(req.url)
    res.setHeader('Content-Type','application/json')
    if(req.url==='/api/config') {res.end('{"turnstile_verified":"fresh-local-credential"}');return}
    if(req.headers['x-turnstile-verified'] && req.headers['x-turnstile-verified']!=='fresh-local-credential') {res.writeHead(403);res.end('{"error":"Turnstile verification failed"}');return}
    const token=(req.headers.authorization||'').replace(/^Bearer /,'')
    const [head,body,signature]=token.split('.')
    const signed=head&&body&&signature===createHmac('sha256','local-test-secret').update(`${head}.${body}`).digest('base64url')
    // The backend clock is ahead: a real signed token can expire there before the client detects it.
    if(!signed || JSON.parse(Buffer.from(body,'base64url')).exp*1000<=Date.now()+5000) {res.writeHead(401);res.end('{"error":"Unauthorized"}');return}
    res.end('{"servers":[]}')
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  t.after(()=>{server.closeAllConnections();server.close()})
  const origin=`http://127.0.0.1:${server.address().port}`
  const expired=storage(),redirects=[];expired.setItem('jwt_token',jwt(Math.floor(Date.now()/1000)+2))
  const failed=createHttp(origin,{storage:expired,getConfig:()=>({is_public:false}),redirect:u=>redirects.push(u)})
  await assert.rejects(failed.request('/api/servers'),e=>e.status===401)
  assert.equal(expired.getItem('jwt_token'),null);assert.deepEqual(redirects,[origin+'/admin#/admin'])
  const valid=storage();valid.setItem('jwt_token',jwt(Math.floor(Date.now()/1000)+60));valid.setItem(`cfsm:turnstile_verified:${origin}`,'invalid-local-credential')
  let challenges=0
  const recovering=createHttp(origin,{storage:valid,getConfig:()=>({is_public:false,turnstile_enabled:true,turnstile_site_key:'local-key'}),challenge:async()=>{challenges++;return 'local-fixture-challenge'},redirect:()=>assert.fail('valid JWT must survive 403')})
  assert.deepEqual(await recovering.request('/api/servers'),{servers:[]})
  assert.equal(challenges,1);assert(valid.getItem('jwt_token'));assert.equal(valid.getItem(`cfsm:turnstile_verified:${origin}`),'fresh-local-credential')
  assert.deepEqual(calls,['/api/servers','/api/servers','/api/config','/api/servers'])
})
