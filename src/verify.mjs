import {createHash} from 'node:crypto';
import {lstat,open,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {assert,object,readJSON,path as routePath} from './config.mjs';

const digestPattern=/^[a-f0-9]{64}$/;
const names=new Set(['walkthrough.mp4','walkthrough.gif','screenshot.png']);
const MAX_MEDIA_BYTES=50_000_000;
function fields(value,allowed,label) {
  object(value,label);
  assert(Object.keys(value).every(key=>allowed.includes(key)),`${label} contains unsupported fields.`);
}
function integer(value,min,max,label) {
  assert(Number.isSafeInteger(value)&&value>=min&&value<=max,`${label} is out of range.`);
}
export function validateManifest(manifest) {
  fields(manifest,['schemaVersion','tool','version','status','capturedAt','replayedAt','bundleSha256','sourceConfigSha256','viewport','assertions','fixtureResponses','replayedAssets','networkPolicy','approvedFixtureFields','files','limits'],'manifest');
  assert(manifest.schemaVersion===1&&manifest.tool==='DemoProof'&&manifest.status==='verified-http-replay','Unsupported or unsuccessful export manifest.');
  assert(typeof manifest.version==='string'&&manifest.version.length>0&&manifest.version.length<=50,'Missing tool version.');
  for(const key of ['bundleSha256','sourceConfigSha256'])assert(typeof manifest[key]==='string'&&digestPattern.test(manifest[key]),`Invalid ${key}.`);
  for(const key of ['capturedAt','replayedAt'])assert(typeof manifest[key]==='string'&&Number.isFinite(Date.parse(manifest[key])),`Invalid ${key}.`);
  fields(manifest.viewport,['width','height'],'viewport');integer(manifest.viewport.width,320,1920,'width');integer(manifest.viewport.height,240,1080,'height');
  integer(manifest.assertions,1,100,'assertions');integer(manifest.fixtureResponses,0,1_000_000,'fixtureResponses');integer(manifest.replayedAssets,1,1_000_000,'replayedAssets');
  assert(typeof manifest.networkPolicy==='string'&&manifest.networkPolicy.length>0&&manifest.networkPolicy.length<=500,'Invalid network policy.');
  assert(Array.isArray(manifest.approvedFixtureFields)&&manifest.approvedFixtureFields.length<=50,'Invalid fixture field metadata.');
  for(const fixture of manifest.approvedFixtureFields) {
    fields(fixture,['path','fields'],'fixture field metadata');routePath(fixture.path);
    assert(Array.isArray(fixture.fields)&&fixture.fields.length>0&&fixture.fields.length<=50&&new Set(fixture.fields).size===fixture.fields.length&&fixture.fields.every(x=>typeof x==='string'&&x.length>0&&x.length<=20_000),'Invalid approved field names.');
  }
  assert(Array.isArray(manifest.limits)&&manifest.limits.length<=50&&manifest.limits.every(x=>typeof x==='string'&&x.length<=5000),'Invalid scope metadata.');
  object(manifest.files,'files');
  const entries=Object.entries(manifest.files);
  assert(entries.length>=2&&entries.length<=3&&Object.hasOwn(manifest.files,'walkthrough.mp4')&&Object.hasOwn(manifest.files,'screenshot.png'),'Manifest must list the MP4 and screenshot, optionally GIF.');
  for(const [name,entry]of entries) {
    assert(names.has(name),'Unsupported artifact name; only flat MP4/GIF/screenshot paths are allowed.');
    fields(entry,['bytes','sha256'],'artifact');integer(entry.bytes,1,MAX_MEDIA_BYTES,'Artifact size');
    assert(typeof entry.sha256==='string'&&digestPattern.test(entry.sha256),'Invalid artifact SHA-256.');
  }
  return manifest;
}
async function verifyFile(file,expected) {
  const before=await lstat(file);
  assert(before.isFile()&&!before.isSymbolicLink()&&before.size===expected.bytes,'Artifact must be a regular non-symlink file with the declared size.');
  const handle=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
  try {
    const start=await handle.stat();
    assert(start.isFile()&&start.ino===before.ino&&start.dev===before.dev&&start.size===expected.bytes,'Artifact identity changed before reading.');
    const hash=createHash('sha256');const buffer=Buffer.alloc(64*1024);let total=0;
    while(true) {
      const {bytesRead}=await handle.read(buffer,0,buffer.length,null);if(!bytesRead)break;
      total+=bytesRead;assert(total<=expected.bytes,'Artifact grew during verification.');hash.update(buffer.subarray(0,bytesRead));
    }
    const end=await handle.stat();const current=await lstat(file);
    assert(total===expected.bytes&&end.size===start.size&&end.mtimeMs===start.mtimeMs&&end.ctimeMs===start.ctimeMs&&current.isFile()&&!current.isSymbolicLink()&&current.ino===start.ino&&current.dev===start.dev&&current.size===end.size&&current.mtimeMs===end.mtimeMs&&current.ctimeMs===end.ctimeMs,'Artifact changed during verification.');
    assert(hash.digest('hex')===expected.sha256,'Artifact SHA-256 mismatch.');
    return {bytes:total,sha256:expected.sha256};
  }finally {await handle.close();}
}

/** Check named artifact bytes, never execute the report, browser, model or encoder. */
export async function verify(manifestFile,{expectedManifestSha256}={}) {
  assert(expectedManifestSha256===undefined||typeof expectedManifestSha256==='string'&&digestPattern.test(expectedManifestSha256),'Expected manifest SHA-256 must be 64 lowercase hexadecimal characters.');
  const file=resolve(manifestFile);const directory=dirname(file);
  assert(!(await lstat(directory)).isSymbolicLink(),'Use a regular export directory, not a directory symlink.');
  const root=await realpath(directory);const input=await readJSON(file);
  assert(expectedManifestSha256===undefined||input.sha256===expectedManifestSha256,'Manifest SHA-256 does not match the supplied digest.');
  const manifest=validateManifest(input.data);const files={};
  for(const [name,entry]of Object.entries(manifest.files)) files[name]=await verifyFile(join(root,name),entry);
  // Bind the result to the same manifest bytes that were inspected above.
  const after=await readJSON(file);assert(after.sha256===input.sha256,'Manifest changed during verification.');
  return {schemaVersion:1,status:'verified-artifact-hashes',manifestSha256:input.sha256,expectedManifestDigestMatched:expectedManifestSha256!==undefined,producerVersion:manifest.version,files,
    scope:['Only the required/listed MP4, screenshot and optional GIF bytes match this manifest.','No browser replay, media decoding, HTML report validation, bundle availability or source identity is established.','A changed manifest and changed files can agree; use a digest obtained through a trusted channel to pin the manifest.','Use stable input files in a trusted directory; this is not a filesystem snapshot or an OS sandbox.']};
}
