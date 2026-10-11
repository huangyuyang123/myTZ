import test from 'node:test'
import assert from 'node:assert/strict'
import {compactHistory} from '../src/utils/history.js'

test('Dense history retains its time span, extrema and probe states within the point budget',()=>{
  const now=1800000000000, start=now-24*3600000
  const rows=Array.from({length:2401},(_,i)=>({timestamp:start+i*36000,cpu:i===900?99:i%11,ping_ct:i===901?null:i===902?false:0,loss_ct:0,net_in_speed:i===903?999999:100,disk:{read_bps:i===904?88888:0},gpu_info:JSON.stringify([{id:'0',info:i===905?87:1}])}))
  const result=compactHistory(rows,24,now)
  assert(result.length<=1200)
  assert.equal(result[0].timestamp,start);assert.equal(result.at(-1).timestamp,now)
  assert(result.some(r=>r.cpu===99));assert(result.some(r=>r.net_in_speed===999999))
  assert(result.some(r=>r.disk.read_bps===88888));assert(result.some(r=>JSON.parse(r.gpu_info)[0].info===87))
  assert(result.some(r=>r.ping_ct===null));assert(result.some(r=>r.ping_ct===false));assert(result.some(r=>r.ping_ct===0))
  assert(result.every(r=>rows.includes(r)))
})

test('History removes only expired timestamps, merges duplicate times and retains sparse samples',()=>{
  const now=1800000000000, cutoff=now-0.167*3600000
  const old={timestamp:cutoff-1,cpu:1},first={timestamp:cutoff,cpu:2},duplicate={timestamp:now,cpu:3},latest={timestamp:now,cpu:4}
  const input=[duplicate,old,first,latest]
  assert.deepEqual(compactHistory(input,0.167,now),[first,latest])
  assert.equal(input.length,4)
})
