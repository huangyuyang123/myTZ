import test from 'node:test'
import assert from 'node:assert/strict'
import {mergeMetrics,probe,batches,gpu,price,isOnline,HOURS} from '../src/utils/metrics.js'
import {wsUrl} from '../src/utils/config.js'
import {createApi} from '../src/utils/api.js'
import {createHttp} from '../src/utils/http.js'
import {createSocket} from '../src/utils/socket.js'
const base='https://backend.example'
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}}
test('Sparse samples retain disk, GPU, probes; false/null/zero stay distinct',()=>{
 const old={cpu:4,disk:{read_bps:8,write_bps:9},gpu_info:[{id:'0',name:'G',info:4}],ping_ct:null,loss_ct:0}
 const next=mergeMetrics(old,{cpu:22,ram_used:6,disk:{read_bps:10},ping_ct:undefined,arbitrary:1})
 assert.equal(next.cpu,22);assert.deepEqual(next.disk,{read_bps:10,write_bps:9});assert.deepEqual(next.gpu_info,old.gpu_info);assert.equal(next.ping_ct,null);assert.equal(next.loss_ct,0);assert.equal(next.arbitrary,undefined)
 assert.equal(probe(false,' ms'),null);assert.equal(probe(undefined,' ms'),null);assert.equal(probe(null,' ms'),'Timeout');assert.equal(probe(0,'%'),'0.0%')
 assert.deepEqual(gpu('[{"id":"0","name":"G","info":3}]'),[{id:'0',name:'G',info:3}]);assert.deepEqual(gpu('bad'),[])
 assert.equal(price({price:'-1'}),'free');assert.equal(price({price:'0'}),'free');assert.equal(price({price:''}),'')
 assert(isOnline({last_updated:1000},300999));assert(!isOnline({last_updated:1000},301000))
})
test('batch parser filters local IDs and orders incremental aliases',()=>{
 const result=batches({type:'batchUpdate',updates:[{serverId:'ours',samples:[{ts:2,payload:{cpu:2}},{ts:1,metrics:{cpu:1}}]},{serverId:'foreign',samples:[{ts:3,data:{cpu:99}}]}]},new Set(['ours']))
 assert.deepEqual(result.map(r=>r.data.cpu),[1,2])
})
test('WS credentials and range allowlist',()=>{
 assert.equal(new URL(wsUrl(base,'abc','jwt',base)).searchParams.get('token'),null)
 assert.equal(new URL(wsUrl(base,'abc','jwt','https://theme.example')).searchParams.get('token'),'jwt')
 const api=createApi({request:(url)=>url})
 for(const h of HOURS) assert(api.history('abc',h).endsWith(`hours=${h}`))
 assert.throws(()=>api.history('abc',2));assert.throws(()=>api.saveOptions([]));assert.throws(()=>api.saveOptions(null))
})
for(const isPublic of [true,false]) for(const enabled of [false,true]) {
 test(`HTTP public=${isPublic} Turnstile=${enabled}: credentials, exchange, persistence`,async()=>{
  const store=storage(),calls=[],redirects=[];if(!isPublic)store.setItem('jwt_token','jwt')
  let challenges=0
  const cfg={is_public:isPublic,turnstile_enabled:enabled,turnstile_site_key:'site-key'}
  const http=createHttp(base,{getConfig:()=>cfg,storage:store,redirect:u=>redirects.push(u),challenge:async()=>{challenges++;return 'challenge'},fetcher:async(url,opts)=>{
   calls.push({url,opts});return new Response(JSON.stringify(url.endsWith('/api/config')?{turnstile_verified:'verified'}:{servers:[]}),{status:200})
  }})
  await http.request('/api/servers');await http.request('/api/history/all?id=1&hours=0.167')
  assert.equal(challenges,enabled?1:0);assert.equal(calls.length,enabled?3:2);assert.equal(redirects.length,0)
  const last=calls.at(-1).opts.headers
  assert.equal(last.Authorization,isPublic?undefined:'Bearer jwt')
  assert.equal(last['X-Turnstile-Verified'],enabled?'verified':undefined)
  assert.equal(last['X-Turnstile-Token'],undefined)
  // A fresh HTTP client reuses the credential persisted by the previous instance.
  const fresh=createHttp(base,{getConfig:()=>cfg,storage:store,challenge:async()=>{throw Error('should not re-challenge')},fetcher:async()=>new Response('{}')})
  await fresh.request('/api/servers')
 })
}
test('Private anonymous and 401 redirect once without reload',async()=>{
 const store=storage(),redirects=[];let count=0
 const config={is_public:false,turnstile_enabled:false}
 const http=createHttp(base,{getConfig:()=>config,storage:store,redirect:u=>redirects.push(u),challenge:()=>{},fetcher:async()=>{count++;return new Response('{"error":"Unauthorized"}',{status:401})}})
 await assert.rejects(http.request('/api/servers'));assert.equal(count,0)
 store.setItem('jwt_token','bad');await assert.rejects(http.request('/api/servers'));assert.equal(store.getItem('jwt_token'),null)
 await assert.rejects(http.request('/api/servers'));assert.deepEqual(redirects,[base+'/admin#/admin'])
})
test('403 invalidates cached credential, re-verifies once, no infinite retry',async()=>{
 const store=storage();store.setItem(`cfsm:turnstile_verified:${base}`,'stale')
 let challenges=0,dataCalls=0,configCalls=0
 const http=createHttp(base,{getConfig:()=>({is_public:true,turnstile_enabled:true,turnstile_site_key:'k'}),storage:store,challenge:async()=>{challenges++;return 't'},fetcher:async(url)=>{
  if(url.endsWith('/api/config')){configCalls++;return new Response('{"turnstile_verified":"fresh"}')}
  dataCalls++;return new Response('{"error":"Forbidden"}',{status:403})
 }})
 await assert.rejects(http.request('/api/servers'));assert.equal(dataCalls,2);assert.equal(configCalls,1);assert.equal(challenges,1);assert.equal(store.getItem(`cfsm:turnstile_verified:${base}`),null)
})
test('Concurrent requests share one challenge exchange',async()=>{
 const store=storage();let challenges=0,exchanges=0
 const http=createHttp(base,{getConfig:()=>({is_public:true,turnstile_enabled:true,turnstile_site_key:'k'}),storage:store,challenge:async()=>{challenges++;return 't'},fetcher:async(url)=>{if(url.endsWith('/api/config')){exchanges++;return new Response('{"turnstile_verified":"v"}')}return new Response('{}')}})
 await Promise.all([http.request('/api/server?id=1'),http.request('/api/history/all?id=1&hours=0.167')]);assert.equal(challenges,1);assert.equal(exchanges,1)
})
function fakeClock(){let now=0,serial=0;const timers=new Map();return {now:()=>now,set:(fn,delay)=>{timers.set(++serial,{fn,at:now+delay});return serial},clear:id=>timers.delete(id),advance(ms){const target=now+ms;while(true){const entry=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;timers.delete(entry[0]);now=entry[1].at;entry[1].fn()}now=target},get timers(){return timers}}}
test('Reconnect doubles, caps and stops even if each connection briefly opens',()=>{
 const clock=fakeClock(),created=[],status=[]
 class WS{constructor(url){this.url=url;created.push(this)}send(msg){this.subscription=JSON.parse(msg)}close(){this.onclose?.({code:1000})}}
 globalThis.location={origin:base}
 const live=createSocket({base,scope:'all',ids:['only-this-site'],jwt:'',clock,WebSocketClass:WS,onStatus:s=>status.push(s),onBatch:()=>{},onTimeout:()=>{},onUnauthorized:()=>{}})
 created[0].onopen();assert.deepEqual(created[0].subscription,{type:'subscribe',scope:'all',ids:['only-this-site']})
 for(const delay of [1000,2000,4000,8000,16000,30000]){const n=created.length;created.at(-1).close();clock.advance(delay-1);assert.equal(created.length,n);clock.advance(1);assert.equal(created.length,n+1);created.at(-1).onopen()}
 created.at(-1).close();clock.advance(999999);assert.equal(created.length,7);assert(status.includes('exhausted'));live.close()
})
test('Session deadline is absolute and requires explicit continuation',()=>{
 const clock=fakeClock(),created=[];let paused=0
 class WS{constructor(){created.push(this)}send(){}close(){this.onclose?.({code:1000})}}
 const live=createSocket({base,scope:'one',ids:['one'],jwt:'',deadline:5000,clock,WebSocketClass:WS,onStatus:()=>{},onBatch:()=>{},onTimeout:()=>paused++,onUnauthorized:()=>{}})
 created[0].onopen();created[0].close();clock.advance(1000);created[1].onopen();clock.advance(4000);assert.equal(paused,1);clock.advance(100000);assert.equal(created.length,2);live.close()
})
