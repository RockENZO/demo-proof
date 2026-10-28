import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,symlink,mkdir,cp,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {verify,validateManifest} from '../src/verify.mjs';
import {hash} from '../src/config.mjs';

// Tiny bytes test integrity only, never claim decodable media or real replay.
async function area(run) {
 const root=await mkdtemp(join(tmpdir(),'demo-proof-verify-'));
 try {await run(root);}finally {await rm(root,{recursive:true,force:true});}
}
async function fixture(root,{gif=true,version='0.2.0'}={}) {
 const files={};
 for(const name of ['walkthrough.mp4','screenshot.png',...(gif?['walkthrough.gif']:[])]) {
  const bytes=Buffer.from('synthetic integrity fixture '+name);await writeFile(join(root,name),bytes);files[name]={bytes:bytes.length,sha256:hash(bytes)};
 }
 const manifest={schemaVersion:1,tool:'DemoProof',version,status:'verified-http-replay',capturedAt:'2026-10-26T00:00:00Z',replayedAt:'2026-10-26T00:01:00Z',bundleSha256:'a'.repeat(64),sourceConfigSha256:'b'.repeat(64),viewport:{width:640,height:480},assertions:1,fixtureResponses:0,replayedAssets:1,networkPolicy:'Fixture for file verification only',approvedFixtureFields:[],files,limits:['Synthetic fixture, not browser evidence.']};
 await save(root,manifest);return manifest;
}
async function save(root,manifest) {await writeFile(join(root,'manifest.json'),JSON.stringify(manifest));}
const file=root=>join(root,'manifest.json');
test('valid artifact hashes are read-only and optional trusted manifest digest binds bytes',()=>area(async root=>{
 const m=await fixture(root);const bytes=await readFile(file(root));const before=await readdir(root);const result=await verify(file(root),{expectedManifestSha256:hash(bytes)});
 assert.equal(result.status,'verified-artifact-hashes');assert.equal(result.expectedManifestDigestMatched,true);assert.equal(result.manifestSha256,hash(bytes));assert.deepEqual(result.files,m.files);assert.deepEqual(await readFile(file(root)),bytes);assert.deepEqual(await readdir(root),before);
}));
test('old 0.1.0 exports without a GIF remain verifiable',()=>area(async root=>{
 await fixture(root,{gif:false,version:'0.1.0'});assert.equal((await verify(file(root))).producerVersion,'0.1.0');
}));
test('same-size tampering fails the media digest',()=>area(async root=>{
 await fixture(root);const p=join(root,'walkthrough.mp4');const bytes=await readFile(p);bytes[0]^=1;await writeFile(p,bytes);await assert.rejects(verify(file(root)),/SHA-256/);
}));
test('truncated, missing and oversized declared files fail',()=>area(async root=>{
 const m=await fixture(root);await writeFile(join(root,'screenshot.png'),'short');await assert.rejects(verify(file(root)),/size/);
 await rm(join(root,'screenshot.png'));await assert.rejects(verify(file(root)),/ENOENT/);
 m.files['screenshot.png'].bytes=50_000_001;await save(root,m);await assert.rejects(verify(file(root)),/size/i);
}));
test('all mandatory media are required, without arbitrary paths or extra artifacts',()=>area(async root=>{
 const original=await fixture(root);
 for(const name of ['../secret','/etc/passwd','sub/file','constructor','walkthrough.webm']) {
  const m=structuredClone(original);delete m.files['walkthrough.gif'];m.files[name]={bytes:1,sha256:'a'.repeat(64)};
  await save(root,m);await assert.rejects(verify(file(root)),/artifact name/i);
 }
 for(const name of ['walkthrough.mp4','screenshot.png']) {const m=structuredClone(original);delete m.files[name];assert.throws(()=>validateManifest(m),/MP4 and screenshot/);}
}));
test('manifest, media and direct parent symlinks are rejected',()=>area(async root=>{
 await fixture(root);const outside=join(root,'outside');await mkdir(outside);const p=join(root,'screenshot.png');await cp(p,join(outside,'original.png'));await rm(p);await symlink(join(outside,'original.png'),p);await assert.rejects(verify(file(root)),/non-symlink/);
 await rm(p);await cp(join(outside,'original.png'),p);await cp(file(root),join(outside,'manifest.json'));await rm(file(root));await symlink(join(outside,'manifest.json'),file(root));await assert.rejects(verify(file(root)),/non-symlink/);
 await rm(file(root));await cp(join(outside,'manifest.json'),file(root));const alias=join(root,'alias');await symlink(root,alias);await assert.rejects(verify(join(alias,'manifest.json')),/directory symlink/);
}));
test('failed/unsupported manifests and malformed metadata fail before acceptance',()=>area(async root=>{
 const original=await fixture(root);
 for(const edit of [m=>m.status='failed',m=>m.schemaVersion=2,m=>m.tool='Other',m=>m.assertions=0,m=>m.assertions=true,m=>m.replayedAssets=0,m=>m.version='',m=>m.capturedAt='not a date',m=>m.bundleSha256='bad',m=>m.viewport.width=0,m=>m.approvedFixtureFields=[null],m=>m.files['screenshot.png'].sha256='g'.repeat(64),m=>m.files['screenshot.png'].bytes=-1]) {
  const m=structuredClone(original);edit(m);await save(root,m);await assert.rejects(verify(file(root)));
 }
}));
test('changing both media and manifest is not publisher authentication; a pinned digest detects it',()=>area(async root=>{
 const m=await fixture(root);const trustedDigest=hash(await readFile(file(root)));const changed=Buffer.from('replacement');await writeFile(join(root,'walkthrough.mp4'),changed);m.files['walkthrough.mp4']={bytes:changed.length,sha256:hash(changed)};await save(root,m);
 const result=await verify(file(root));assert.equal(result.expectedManifestDigestMatched,false);assert.ok(result.scope.some(s=>s.includes('changed manifest')));await assert.rejects(verify(file(root),{expectedManifestSha256:trustedDigest}),/supplied digest/);
}));
test('bad expected digest and invalid UTF-8/JSON never pass',()=>area(async root=>{
 await fixture(root);await assert.rejects(verify(file(root),{expectedManifestSha256:'anything'}),/64 lowercase/);await writeFile(file(root),Buffer.from([0xff]));await assert.rejects(verify(file(root)),/UTF-8 JSON/);
}));
test('verify CLI works with no Playwright dependency or encoder and rejects unrelated flags',()=>area(async root=>{
 const out=join(root,'export');await mkdir(out);await fixture(out);const standalone=join(root,'standalone');await mkdir(join(standalone,'bin'),{recursive:true});await mkdir(join(standalone,'src'));
 for(const p of ['bin/demo-proof.mjs','src/config.mjs','src/verify.mjs'])await cp(new URL('../'+p,import.meta.url),join(standalone,p));
 const run=extra=>spawnSync(process.execPath,[join(standalone,'bin/demo-proof.mjs'),'verify','--manifest',file(out),...extra],{encoding:'utf8'});
 let result=run([]);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).status,'verified-artifact-hashes');
 for(const extra of [['--out',join(root,'new')],['--gif'],['--manifest',file(out)],['--expected-manifest-sha256','bad']]){result=run(extra);assert.equal(result.status,1);assert.equal(result.stdout,'');}
}));
test('known-app config generator discovers hashed assets and refuses reuse or unsupported builds',()=>area(async root=>{
 const site=join(root,'site');await mkdir(site);const output=join(root,'new-config.json');const generator=new URL('../examples/readme-reality/create-config.mjs',import.meta.url);
 await writeFile(join(site,'index.html'),'<script type="module" src="/readme-reality/assets/index-abc.js"></script><link rel="stylesheet" href="/readme-reality/assets/index-def.css">');
 const run=()=>spawnSync(process.execPath,[generator.pathname,site,output],{encoding:'utf8'});
 assert.equal(run().status,0);const bytes=await readFile(output);const config=JSON.parse(bytes);assert.equal(config.fixtures.length,0);assert.equal(config.steps.filter(s=>s.action==='expectText').length,4);assert.equal(config.assets.length,3);
 assert.equal(run().status,1);assert.deepEqual(await readFile(output),bytes);await rm(output);await writeFile(join(site,'index.html'),'<script src="/other-app.js"></script>');assert.equal(run().status,1);
}));
test('pure verification is available through the package subpath export',async()=>{
 const api=await import('@rockenzo/demo-proof/verify');assert.equal(api.verify,verify);
});
