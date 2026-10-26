import {mkdir,writeFile,mkdtemp,rm,copyFile,readFile,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {validateConfig,validateBundle,readJSON,hash,assert,LIMIT} from './config.mjs';
import {journey} from './browser.mjs';
const exec=promisify(execFile);
const json = value => JSON.stringify(value,null,2)+'\n';
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function reserve(out) {const target=resolve(out);await mkdir(dirname(target),{recursive:true});await mkdir(target);return target;}
async function save(root,name,bytes) {await writeFile(join(root,name),bytes,{flag:'wx'});}
async function failure(root,phase) {await save(root,'failure.json',json({schemaVersion:1,status:'failed',phase,verifiedExport:false,createdAt:new Date().toISOString(),message:'No verified export. Review the declared routes, UI assertions and local runtime.'})).catch(()=>{});}
export async function capture(configFile,out) {
  const input=await readJSON(configFile);const config=validateConfig(input.data);const root=await reserve(out);
  try {
    const result=await journey(config);
    const bundle={schemaVersion:1,capturedAt:new Date().toISOString(),sourceConfigSha256:input.sha256,config,resources:result.resources};validateBundle(bundle);
    assert(Buffer.byteLength(json(bundle))<=LIMIT,'Combined bundle exceeds 12 MB.');
    await save(root,'bundle.json',json(bundle));await save(root,'capture.json',json({schemaVersion:1,status:'captured',bundleSha256:hash(Buffer.from(json(bundle))),assertions:result.assertions,fixtureResponses:result.fixtureResponses,liveAssets:result.resources.length,networkPolicy:result.networkPolicy,scope:'Approved flat fixture fields only. Captured application assets and journey text still require owner review before sharing.'}));
    return {bundle:join(root,'bundle.json'),assertions:result.assertions};
  }catch(error){await failure(root,'capture');throw error;}
}
function report(manifest) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DemoProof — replay evidence</title><style>body{font:17px system-ui;background:#f4f4ed;color:#17372d;max-width:1000px;margin:40px auto;padding:24px}video,img{max-width:100%;border-radius:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#e7ecdf;padding:20px;border-radius:12px}a{color:#245e45}h1{font-size:42px}.badge{background:#d8e8cc;padding:8px 12px;display:inline-block}li{margin:8px 0}</style><h1>DemoProof</h1><p class="badge">Verified HTTP replay · approved example data</p><p>This records a browser journey against a frozen local snapshot. It is not a live service connection, general secret scanner, application security audit or proof of full functionality.</p><video controls muted playsinline src="walkthrough.mp4" aria-label="Recorded replay walkthrough"></video><p><a href="manifest.json">Download provenance</a> · <a href="screenshot.png">Final screen</a></p><h2>Evidence and scope</h2><pre>${escape(json(manifest))}</pre></html>`;
}
export async function replay(bundleFile,out,{gif=false}={}) {
  const input=await readJSON(bundleFile);const bundle=validateBundle(input.data);const root=await reserve(out);const stage=await mkdtemp(join(tmpdir(),'demo-proof-video-'));
  try {
    const result=await journey(bundle.config,{resources:bundle.resources,videoDir:stage,screenshot:true});assert(result.videoPath,'Browser recording unavailable.');
    const mp4=join(stage,'walkthrough.mp4');
    await exec('ffmpeg',['-y','-i',result.videoPath,'-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',mp4],{timeout:60_000,maxBuffer:500_000});
    const names=['walkthrough.mp4'];
    if(gif){await exec('ffmpeg',['-y','-i',result.videoPath,'-filter_complex','fps=10,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer','-loop','0',join(stage,'walkthrough.gif')],{timeout:60_000,maxBuffer:500_000});names.push('walkthrough.gif');}
    const files={};for(const name of names){const p=join(stage,name);const size=(await stat(p)).size;assert(size<=50_000_000,'Encoded output exceeds 50 MB.');const bytes=await readFile(p);files[name]={bytes:size,sha256:hash(bytes)};}
    files['screenshot.png']={bytes:result.screenshotBytes.length,sha256:hash(result.screenshotBytes)};
    const manifest={schemaVersion:1,tool:'DemoProof',version:'0.1.0',status:'verified-http-replay',capturedAt:bundle.capturedAt,replayedAt:new Date().toISOString(),bundleSha256:input.sha256,sourceConfigSha256:bundle.sourceConfigSha256,viewport:bundle.config.viewport,assertions:result.assertions,fixtureResponses:result.fixtureResponses,replayedAssets:result.replayedAssets,networkPolicy:result.networkPolicy,approvedFixtureFields:bundle.config.fixtures.map(f=>({path:f.path,fields:Object.keys(f.json)})),files,limits:['Only the declared journey and supported HTTP replay are checked.','Application assets, selectors, expected/fill text and media need human review before sharing.','Fixture field projection does not detect every secret or personal detail.','Trusted local applications only; this is not an OS network sandbox.']};
    for(const name of names)await copyFile(join(stage,name),join(root,name),constants.COPYFILE_EXCL);
    await save(root,'screenshot.png',result.screenshotBytes);await save(root,'report.html',report(manifest));await save(root,'manifest.json',json(manifest));return manifest;
  }catch{await failure(root,'replay');throw new Error('Replay/export failed. No verified manifest was produced; check the approved journey and Chromium/ffmpeg installation.');}
  finally {await rm(stage,{recursive:true,force:true});}
}
