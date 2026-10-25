import {createHash} from 'node:crypto';
import {open,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';

export const LIMIT = 12_000_000;
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const badKeys = new Set(['__proto__', 'prototype', 'constructor']);
export function assert(ok, message) { if (!ok) throw new Error(message); }
export function object(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
}
function keys(value, allowed, label) {
  object(value, label);
  assert(Object.keys(value).every(k => allowed.includes(k)), `${label} contains unsupported fields.`);
}
export function path(value) {
  assert(typeof value === 'string' && /^\/[A-Za-z0-9/_.-]*$/.test(value) && !value.startsWith('//') && !value.split('/').some(x=>x==='..'||x==='.'), 'Use a literal absolute path without queries, fragments or traversal.');
  return value;
}
export function localURL(value) {
  assert(typeof value==='string', 'url must be a string.');
  let u; try { u=new URL(value); } catch { throw new Error('Invalid application URL.'); }
  assert(u.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname) && !u.username && !u.password && !u.search && !u.hash, 'v1 supports credential-free HTTP loopback URLs only.');
  path(u.pathname); return u;
}
function primitive(value) { return value===null || typeof value==='boolean' || typeof value==='number'&&Number.isFinite(value) || typeof value==='string'&&value.length<=20_000; }
export function approvedJSON(value, allowed) {
  object(value, 'fixture JSON');
  assert(Array.isArray(allowed)&&allowed.length>0&&allowed.length<=50&&new Set(allowed).size===allowed.length, 'Each fixture needs a nonempty unique field allowlist.');
  const result=Object.create(null);
  for(const key of allowed) {
    assert(typeof key==='string'&&!badKeys.has(key)&&Object.hasOwn(value,key), 'An approved fixture field is invalid or absent.');
    assert(primitive(value[key]), 'v1 approved fields must be flat JSON scalar values.'); result[key]=value[key];
  }
  return result;
}
export function validateConfig(input) {
  keys(input,['schemaVersion','url','viewport','assets','fixtures','steps'],'config');
  assert(input.schemaVersion===1,'Unsupported config schema.'); const u=localURL(input.url);
  const viewport=input.viewport??{width:1280,height:800}; keys(viewport,['width','height'],'viewport');
  assert(Number.isInteger(viewport.width)&&viewport.width>=320&&viewport.width<=1920&&Number.isInteger(viewport.height)&&viewport.height>=240&&viewport.height<=1080,'Viewport out of range.');
  assert(Array.isArray(input.assets)&&input.assets.length>0&&input.assets.length<=100,'Declare 1–100 same-origin asset paths.');
  const assets=input.assets.map(path); assert(new Set(assets).size===assets.length&&assets.includes(u.pathname),'Assets must be unique and include the entry page.');
  assert(Array.isArray(input.fixtures)&&input.fixtures.length<=50,'fixtures must be an array with at most 50 entries.');
  const fixtures=input.fixtures.map(f=>{
    keys(f,['path','method','json','allowFields'],'fixture');path(f.path); const method=f.method??'GET';assert(['GET','POST'].includes(method),'Fixture method must be GET or POST.');
    return {path:f.path,method,json:approvedJSON(f.json,f.allowFields)};
  });
  assert(new Set(fixtures.map(f=>f.method+' '+f.path)).size===fixtures.length,'Duplicate fixture routes.');
  assert(fixtures.every(f=>!assets.includes(f.path)),'Asset and fixture paths must not overlap.');
  assert(Array.isArray(input.steps)&&input.steps.length>0&&input.steps.length<=100,'Declare 1–100 journey steps.');
  let wait=0;
  const steps=input.steps.map(s=>{
    const fields=s.action==='wait'?['action','ms']:s.action==='click'?['action','selector']:['action','selector','text'];keys(s,fields,'step');
    assert(['wait','click','fill','expectText'].includes(s.action),'Unsupported journey action.');
    if(s.action==='wait'){assert(Number.isInteger(s.ms)&&s.ms>=0&&s.ms<=5000,'Wait must be 0–5000 ms.');wait+=s.ms;}
    else {assert(typeof s.selector==='string'&&s.selector.length>0&&s.selector.length<=500,'A step needs a bounded CSS selector.');if(s.action!=='click')assert(typeof s.text==='string'&&s.text.length<=5000,'A step needs bounded literal text.');}
    return {...s};
  });assert(wait<=60_000,'Total journey wait exceeds one minute.');assert(steps.some(s=>s.action==='expectText'),'At least one visible-text assertion is required.');
  return {schemaVersion:1,url:u.href,viewport:{...viewport},assets,fixtures,steps};
}
export async function readJSON(file) {
  const before=await lstat(file);assert(before.isFile()&&!before.isSymbolicLink(),'Input must be a regular non-symlink file.');
  const h=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
  try {const stat=await h.stat();assert(stat.isFile()&&stat.ino===before.ino&&stat.dev===before.dev&&stat.size<=LIMIT,'Input must be a regular JSON file under 12 MB.');
    const buffer=Buffer.alloc(LIMIT+1);let n=0;while(n<buffer.length){const {bytesRead}=await h.read(buffer,n,buffer.length-n,n);if(!bytesRead)break;n+=bytesRead;}assert(n<=LIMIT,'Input exceeds 12 MB.');const after=await h.stat();assert(stat.size===after.size&&stat.mtimeMs===after.mtimeMs,'Input changed during reading.');
    const bytes=buffer.subarray(0,n);let data;try{data=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes));}catch{throw new Error('Input must be valid UTF-8 JSON.');}return {data,sha256:hash(bytes)};
  } finally {await h.close();}
}
export function validateBundle(bundle) {
  keys(bundle,['schemaVersion','capturedAt','sourceConfigSha256','config','resources'],'bundle');assert(bundle.schemaVersion===1,'Unsupported bundle schema.');
  assert(typeof bundle.capturedAt==='string'&&Number.isFinite(Date.parse(bundle.capturedAt))&&/^[a-f0-9]{64}$/.test(bundle.sourceConfigSha256),'Invalid bundle provenance.');
  const wire=bundle.config;object(wire,'bundle config');assert(Array.isArray(wire.fixtures),'Missing bundled fixtures.');
  const config=validateConfig({...wire,fixtures:wire.fixtures.map(f=>{keys(f,['path','method','json'],'bundled fixture');object(f.json,'bundled JSON');return {...f,allowFields:Object.keys(f.json)};})});
  assert(Array.isArray(bundle.resources)&&bundle.resources.length===config.assets.length,'Bundle must contain exactly its declared assets.');
  let total=0;const seen=new Set();
  const resources=bundle.resources.map(r=>{keys(r,['path','contentType','bodyBase64','sha256'],'resource');path(r.path);assert(config.assets.includes(r.path)&&!seen.has(r.path),'Unexpected or duplicate resource.');seen.add(r.path);
    assert(typeof r.contentType==='string'&&r.contentType.length<=200&&!/[\r\n]/.test(r.contentType),'Invalid resource content type.');assert(typeof r.bodyBase64==='string'&&r.bodyBase64.length<=LIMIT,'Invalid encoded resource.');const body=Buffer.from(r.bodyBase64,'base64');assert(body.toString('base64')===r.bodyBase64,'Noncanonical resource encoding.');total+=body.length;assert(total<=8_000_000&&body.length<=2_000_000,'Resource limits exceeded.');assert(r.sha256===hash(body),'Resource checksum mismatch.');return {...r};});
  return {...bundle,config,resources};
}
