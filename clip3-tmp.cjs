const WebSocket=require('ws'),http=require('http'),fs=require('fs')
const TOK=fs.readFileSync('./tk.tmp','utf8').trim(),PAGE='/'+process.argv[2]
const gj=p=>new Promise((s,j)=>http.get({host:'127.0.0.1',port:9222,path:p},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>s(JSON.parse(d)))}).on('error',j))
;(async()=>{const t=(await gj('/json/list')).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl,{perMessageDeflate:false});let id=0;const pe=new Map()
const send=(m,p={})=>new Promise(r=>{const i=++id;pe.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))})
ws.on('message',raw=>{const m=JSON.parse(raw);if(m.id&&pe.has(m.id)){pe.get(m.id)(m.result);pe.delete(m.id)}})
await new Promise(r=>ws.on('open',r));await send('Runtime.enable');await send('Page.enable');await send('Network.enable')
await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false})
await send('Network.setCookie',{name:'next-auth.session-token',value:TOK,domain:'localhost',path:'/',httpOnly:true})
await send('Page.navigate',{url:'http://localhost:3001'+PAGE});await new Promise(r=>setTimeout(r,18000))
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});return r&&r.result?r.result.value:undefined}
console.log('  '+PAGE+' ellipsis-clipped: '+await ev(`JSON.stringify((function(){var o=[],e=document.querySelectorAll('body *');for(var i=0;i<e.length;i++){var c=getComputedStyle(e[i]);if(!(c.textOverflow==='ellipsis'&&c.overflow!=='visible'))continue;if(e[i].scrollWidth>e[i].clientWidth+1){var x=(e[i].textContent||'').trim();if(x&&x.length<60)o.push(x.slice(0,28))}}return o.slice(0,8)})())`))
console.log('  '+PAGE+' cut by ancestor (excl. marquee): '+await ev(`JSON.stringify((function(){var o=[],e=document.querySelectorAll('body *');
for(var i=0;i<e.length;i++){var el=e[i];if(el.closest('.ticker-tape'))continue;var t='';for(var j=0;j<el.childNodes.length;j++){var n=el.childNodes[j];if(n.nodeType===3&&n.textContent.trim())t+=n.textContent.trim()}
if(!t||t.length>26)continue;var r=el.getBoundingClientRect();if(!r.width)continue;var p=el.parentElement;
while(p&&p!==document.body){var pc=getComputedStyle(p);if(pc.overflow!=='visible'&&pc.overflowX!=='auto'&&pc.overflowX!=='scroll'){var pr=p.getBoundingClientRect();
 if(r.right>pr.right+1){o.push(t.slice(0,24));break}}p=p.parentElement}}
return o.slice(0,8)})())`))
ws.close();process.exit(0)})().catch(e=>{console.error('FAIL',e);process.exit(1)})
