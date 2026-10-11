import test from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
function files(path){return readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(path,e.name)):[join(path,e.name)])}
test('Production source contains only allowed monitoring endpoints, no REST polling or custom admin',()=>{
 const text=files('src').map(p=>readFileSync(p,'utf8')).join('\n')
 const endpoints=[...text.matchAll(/\/api\/[\w/]+/g)].map(m=>m[0])
 assert(endpoints.length>0)
 assert(endpoints.every(p=>['/api/config','/api/servers','/api/server','/api/history/all','/api/ws','/api/theme_options'].includes(p)))
 assert(!text.includes('setInterval'))
 assert(!text.includes('location.reload'))
 assert(!text.includes('/admin/api'))
 assert(!files('src').some(p=>p.includes('views/admin')))
})
test('Workflow appends history, preserves source message and injects all five Secrets',()=>{
 const workflow=readFileSync('.github/workflows/build.yml','utf8')
 assert(!/push\s+(?:-f|--force)/.test(workflow));assert(workflow.includes('git log -1 --format=%B'));assert(workflow.includes('commit --allow-empty -F'))
 assert(workflow.includes('HEAD:refs/heads/dist'));assert(workflow.includes('concurrency:'));assert(workflow.includes('contents: write'))
 for(const key of ['API_BASE','TITLE','BACKGROUND_IMAGE','CSP_API','CSP_STATIC'])assert(workflow.includes(`secrets.${key}`))
})
