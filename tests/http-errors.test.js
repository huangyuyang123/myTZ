import test from 'node:test'
import assert from 'node:assert/strict'
import {createHttp} from '../src/utils/http.js'
const base='https://backend.example',proof=`cfsm:turnstile_verified:${base}`
const storage=()=>{const values=new Map([['jwt_token','valid-login'],[proof,'cached-proof']]);return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}}

for(const variant of ['permission-json','edge-html','cors-network','invalid-json'])test(`${variant} preserves credentials and does not start a verification or retry`,async()=>{
 const store=storage();let calls=0,challenges=0,redirects=0
 const http=createHttp(base,{storage:store,getConfig:()=>({is_public:false,turnstile_enabled:true}),challenge:async()=>{challenges++;return 'unexpected'},redirect:()=>redirects++,fetcher:async()=>{
  calls++
  if(variant==='permission-json')return new Response('{"error":"Forbidden"}',{status:403})
  if(variant==='edge-html')return new Response('<html>Edge security policy denied this request</html>',{status:403})
  if(variant==='cors-network')throw new TypeError('Failed to fetch a URL containing a credential that must not be logged')
  return new Response('not-json',{status:200})
 }})
 await assert.rejects(http.request('/api/servers'),error=>{
  const kind=variant==='cors-network'?'network':variant==='invalid-json'?'invalid-response':'http'
  assert.equal(error.kind,kind)
  assert.equal(error.status,variant==='cors-network'?0:variant==='invalid-json'?200:403)
  assert(!error.message.includes('credential that must not be logged'))
  return true
 })
 assert.equal(calls,1);assert.equal(challenges,0);assert.equal(redirects,0)
 assert.equal(store.getItem('jwt_token'),'valid-login');assert.equal(store.getItem(proof),'cached-proof')
})

test('a permission rejection cannot invalidate a credential refreshed by a simultaneous Turnstile rejection',async()=>{
 const store=storage();let challenges=0,exchanges=0
 let release;const delayed=new Promise(resolve=>release=resolve)
 const http=createHttp(base,{storage:store,getConfig:()=>({is_public:false,turnstile_enabled:true,turnstile_site_key:'k'}),challenge:async()=>{challenges++;return 'fixture-challenge'},fetcher:async(url,opts)=>{
  if(url.endsWith('/api/config')){exchanges++;return new Response('{"turnstile_verified":"fresh-proof"}')}
  if(url.includes('permission')){await delayed;return new Response('{"message":"Forbidden"}',{status:403})}
  if(opts.headers['X-Turnstile-Verified']==='cached-proof')return new Response('{"error":"Turnstile verification failed","code":403}',{status:403})
  return new Response('{}')
 }})
 const permission=http.request('/api/server?id=permission').catch(e=>e)
 await http.request('/api/server?id=ours');release()
 assert.equal((await permission).kind,'http');assert.equal(store.getItem(proof),'fresh-proof')
 assert.equal(challenges,1);assert.equal(exchanges,1)
})

test('a failed verification exchange is released and a later explicit request can recover',async()=>{
 const store=storage();store.removeItem(proof)
 let challenges=0,exchanges=0
 const http=createHttp(base,{storage:store,getConfig:()=>({is_public:false,turnstile_enabled:true,turnstile_site_key:'k'}),challenge:async()=>{challenges++;return 'fixture-challenge'},fetcher:async(url)=>{
  if(url.endsWith('/api/config')){if(++exchanges===1)throw new TypeError('Connection failed');return new Response('{"turnstile_verified":"fresh-proof"}')}
  return new Response('{}')
 }})
 await assert.rejects(http.request('/api/servers'),e=>e.kind==='network')
 await http.request('/api/servers')
 assert.equal(challenges,2);assert.equal(exchanges,2);assert.equal(store.getItem(proof),'fresh-proof')
})
