import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,readdir,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {createExampleServer} from '../examples/weather/server.mjs';
import {capture,replay} from '../src/index.mjs';
import {hash} from '../src/config.mjs';
const sample=JSON.parse(await readFile(new URL('../examples/weather/demo-proof.json',import.meta.url),'utf8'));
async function serve(server){await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port+'/';}
async function close(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
async function area(run){const root=await mkdtemp(join(tmpdir(),'demo-proof-integration-'));try{await run(root);}finally{await rm(root,{recursive:true,force:true});}}
function short(url){return {...sample,url,viewport:{width:640,height:480},steps:sample.steps.filter(x=>x.action!=='wait')};}
test('approved capture, API-down and server-off replay, checksummed MP4/GIF and no overwrite',()=>area(async root=>{
 const server=createExampleServer();const url=await serve(server);const config=short(url);config.fixtures[0].json={...config.fixtures[0].json,private:'PRIVATE_DO_NOT_EXPORT_42'};const file=join(root,'config.json');await writeFile(file,JSON.stringify(config));let captured;
 try{captured=await capture(file,join(root,'capture'));await assert.rejects(capture(file,join(root,'capture')),/EEXIST/);}finally{await close(server);}
 const text=await readFile(captured.bundle,'utf8');assert.ok(!text.includes('PRIVATE_DO_NOT_EXPORT_42'));assert.ok(!text.includes('ILLUSTRATIVE_UNAPPROVED_FIELD'));const b=JSON.parse(text);assert.equal(b.resources.length,3);assert.deepEqual(Object.keys(b.config.fixtures[0].json),['city','temperatureC','windKph']);
 const out=join(root,'export');const manifest=await replay(captured.bundle,out,{gif:true});assert.equal(manifest.status,'verified-http-replay');assert.equal(manifest.assertions,4);assert.ok(manifest.fixtureResponses>=2);assert.ok(manifest.replayedAssets>=3);assert.equal(manifest.bundleSha256,hash(text));
 for(const [name,entry]of Object.entries(manifest.files)){const bytes=await readFile(join(out,name));assert.equal(hash(bytes),entry.sha256);assert.equal(bytes.length,entry.bytes);assert.ok(bytes.length>0);}
 assert.ok((await readFile(join(out,'report.html'),'utf8')).includes('not a live service connection'));assert.ok(!(await readdir(out)).some(x=>x.endsWith('.webm')));await assert.rejects(replay(captured.bundle,out),/EEXIST/);
}));
test('unexpected requests fail even when the UI catches the error',()=>area(async root=>{
 const server=createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end('<h1>Ready</h1><script>fetch("/private?token=NOT_APPROVED").catch(()=>{})</script>');});const url=await serve(server);const file=join(root,'config.json');await writeFile(file,JSON.stringify({schemaVersion:1,url,assets:['/'],fixtures:[],steps:[{action:'expectText',selector:'h1',text:'Ready'}]}));
 try{await assert.rejects(capture(file,join(root,'failed')));assert.deepEqual(await readdir(join(root,'failed')),['failure.json']);assert.ok(!(await readFile(join(root,'failed','failure.json'),'utf8')).includes('NOT_APPROVED'));}finally{await close(server);}
}));
test('asset redirects never reach another server',()=>area(async root=>{
 let contacted=0;const foreign=createServer((req,res)=>{contacted++;res.end('No');});const other=await serve(foreign);const server=createServer((req,res)=>{res.writeHead(302,{location:other});res.end();});const url=await serve(server);const file=join(root,'config.json');await writeFile(file,JSON.stringify({schemaVersion:1,url,assets:['/'],fixtures:[],steps:[{action:'expectText',selector:'h1',text:'Ready'}]}));
 try{await assert.rejects(capture(file,join(root,'failed')));assert.equal(contacted,0);}finally{await close(server);await close(foreign);}
}));
test('broken assertions refuse verified export and input tampering is detected',()=>area(async root=>{
 const server=createExampleServer();const url=await serve(server);const c=short(url);const f=join(root,'config.json');await writeFile(f,JSON.stringify(c));let captured;try{captured=await capture(f,join(root,'capture'));}finally{await close(server);}
 const b=JSON.parse(await readFile(captured.bundle,'utf8'));b.config.steps=[{action:'expectText',selector:'#city',text:'Wrong city'}];const bad=join(root,'bad.json');await writeFile(bad,JSON.stringify(b));await assert.rejects(replay(bad,join(root,'failed')));assert.deepEqual(await readdir(join(root,'failed')),['failure.json']);
 b.resources[0].bodyBase64=Buffer.from('Tampered').toString('base64');await writeFile(bad,JSON.stringify(b));await assert.rejects(replay(bad,join(root,'tampered')),/checksum/);
}));
test('response cookies are not persisted or forwarded between asset fetches',()=>area(async root=>{
 const headers=[];const server=createServer((req,res)=>{headers.push(req.headers);res.writeHead(200,{'content-type':req.url==='/'?'text/html':'text/javascript','set-cookie':'private=COOKIE_DO_NOT_EXPORT_42'});res.end(req.url==='/'?'<h1>Ready</h1><script src="/app.js"></script>':'console.log("ready")');});const url=await serve(server);const f=join(root,'config.json');await writeFile(f,JSON.stringify({schemaVersion:1,url,assets:['/','/app.js'],fixtures:[],steps:[{action:'expectText',selector:'h1',text:'Ready'}]}));
 try{const result=await capture(f,join(root,'capture'));assert.ok(headers.length>=2);assert.ok(headers.every(h=>!h.cookie&&!h.authorization));assert.ok(!(await readFile(result.bundle,'utf8')).includes('COOKIE_DO_NOT_EXPORT_42'));}finally{await close(server);}
}));
test('new nested output parents are created without overwriting existing files',()=>area(async root=>{
 const server=createExampleServer();const url=await serve(server);const file=join(root,'config.json');await writeFile(file,JSON.stringify(short(url)));
 try{const r=await capture(file,join(root,'new-parent','capture'));assert.ok((await readFile(r.bundle,'utf8')).includes('sourceConfigSha256'));await writeFile(join(root,'occupied'),'keep');await assert.rejects(capture(file,join(root,'occupied')),/EEXIST/);assert.equal(await readFile(join(root,'occupied'),'utf8'),'keep');}finally{await close(server);}
}));
