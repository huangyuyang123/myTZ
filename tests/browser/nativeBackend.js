import {createServer} from 'node:http'
import {createHash,createHmac} from 'node:crypto'

// Native local HTTP/CORS/WebSocket fixture. No connection to the user's Worker.
export async function nativeBackend(frontend) {
  const key='isolated-native-browser-test',exp=Math.floor(Date.now()/1000)+60
  const head=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')
  const payload=Buffer.from(JSON.stringify({sub:'test-only',exp})).toString('base64url')
  const token=`${head}.${payload}.${createHmac('sha256',key).update(`${head}.${payload}`).digest('base64url')}`
  const state={requests:[],upgrades:[],subscriptions:[],sockets:new Set(),denyAuth:false,denyList:false,adminDelay:0}
  const valid=value=>!state.denyAuth && value===token && Date.now()<exp*1000
  const metrics={id:'native-1',name:'Native cross-origin node',cpu:3,ram_used:100,ram_total:1000,last_updated:Date.now()}
  const server=createServer((req,res)=>{
    res.setHeader('Access-Control-Allow-Origin',frontend);res.setHeader('Access-Control-Allow-Credentials','true')
    res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-Turnstile-Token, X-Turnstile-Verified')
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Vary','Origin')
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
    const url=new URL(req.url,'http://local.test'),authorized=valid((req.headers.authorization||'').replace(/^Bearer /,''))
    const record={path:url.pathname,status:200,jwt:!!req.headers.authorization};state.requests.push(record)
    if(url.pathname==='/admin'){res.setHeader('Content-Type','text/html');setTimeout(()=>res.end('Built-in admin entry fixture'),state.adminDelay);return}
    if(url.pathname.startsWith('/os-icons/') || url.pathname.startsWith('/flags/')) {res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg"/>');return}
    res.setHeader('Content-Type','application/json')
    if(url.pathname==='/api/config'){res.end(JSON.stringify({is_public:false,authorization:authorized,turnstile_enabled:false,default_language:'en',preferred_theme:'light',frontend_ws_timeout_minutes:0}));return}
    if(!authorized || url.pathname==='/api/servers' && state.denyList){record.status=401;res.writeHead(401);res.end('{"error":"Unauthorized"}');return}
    if(url.pathname==='/api/servers'){res.end(JSON.stringify({servers:[metrics],stats:{total:1,online:1,offline:0},sysConfig:{}}));return}
    if(url.pathname==='/api/server'){res.end(JSON.stringify(metrics));return}
    if(url.pathname==='/api/history/all'){res.end(JSON.stringify([{...metrics,timestamp:Date.now()}]));return}
    res.writeHead(404);res.end('{}')
  })
  function frame(opcode,payload){const data=Buffer.from(payload),header=data.length<126?Buffer.from([0x80|opcode,data.length]):Buffer.from([0x80|opcode,126,data.length>>8,data.length&255]);return Buffer.concat([header,data])}
  server.on('upgrade',(req,socket)=>{
    const url=new URL(req.url,'http://local.test'),authorized=valid(url.searchParams.get('token'))
    state.upgrades.push({status:authorized?101:401,urlToken:url.searchParams.has('token'),cookie:!!req.headers.cookie,origin:req.headers.origin})
    if(!authorized){socket.end('HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n');return}
    const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
    state.sockets.add(socket);socket.on('close',()=>state.sockets.delete(socket));socket.on('error',()=>{})
    let buffer=Buffer.alloc(0)
    socket.on('data',chunk=>{
      buffer=Buffer.concat([buffer,chunk])
      while(buffer.length>=2){
        const opcode=buffer[0]&15,masked=!!(buffer[1]&128);let length=buffer[1]&127,offset=2
        if(length===126){if(buffer.length<4)return;length=buffer.readUInt16BE(2);offset=4}
        if(length===127){socket.destroy();return}
        const mask=masked?buffer.subarray(offset,offset+4):null;if(masked)offset+=4
        if(buffer.length<offset+length)return
        const body=Buffer.from(buffer.subarray(offset,offset+length));buffer=buffer.subarray(offset+length)
        if(masked)for(let i=0;i<body.length;i++)body[i]^=mask[i%4]
        if(opcode===8){socket.end(frame(8,body));return}
        if(opcode!==1)continue
        const sub=JSON.parse(body.toString());state.subscriptions.push(sub)
        socket.write(frame(1,JSON.stringify({type:'batchUpdate',updates:[{serverId:'native-1',reportTs:Date.now(),samples:[{ts:Date.now(),data:{cpu:71}}]}]})))
      }
    })
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  return {...state,get denyAuth(){return state.denyAuth},set denyAuth(value){state.denyAuth=value},get denyList(){return state.denyList},set denyList(value){state.denyList=value},get adminDelay(){return state.adminDelay},set adminDelay(value){state.adminDelay=value},token,exp,origin:`http://127.0.0.1:${server.address().port}`,close:()=>{for(const socket of state.sockets)socket.destroy();server.closeAllConnections();return new Promise(resolve=>server.close(resolve))}}
}
