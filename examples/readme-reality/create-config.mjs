// An internal integration with the actual Readme Reality v0.2.0 built UI.
// Builds/servers remain explicit owner operations, never launched by DemoProof.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {validateConfig} from '../../src/config.mjs';
const args=process.argv.slice(2);
if(args.length!==2)throw new Error('Usage: node examples/readme-reality/create-config.mjs /path/to/readme-reality/site new-config.json');
const html=await readFile(join(resolve(args[0]),'index.html'),'utf8');
const refs=[...html.matchAll(/<(script|link)\b[^>]*(?:src|href)="([^"]+)"[^>]*>/g)].filter(m=>m[1]==='script'||/rel="stylesheet"/.test(m[0])).map(m=>m[2]);
if(refs.length!==2||refs.some(p=>!/^\/readme-reality\/assets\/[A-Za-z0-9_.-]+\.(js|css)$/.test(p)))throw new Error('Expected the reviewed v0.2.0 static JS/CSS build; inspect changed build output before recording.');
const config=validateConfig({schemaVersion:1,url:'http://127.0.0.1:4179/readme-reality/',viewport:{width:1280,height:960},assets:['/readme-reality/',...refs],fixtures:[],steps:[
 {action:'expectText',selector:'#status-pill',text:'Needs attention'},
 {action:'wait',ms:4500},
 {action:'click',selector:'#fixed'},
 {action:'expectText',selector:'#status-pill',text:'Checked'},
 {action:'wait',ms:4500},
 {action:'click',selector:'[data-id="html"]'},
 {action:'expectText',selector:'#status-pill',text:'Needs attention'},
 {action:'wait',ms:4500},
 {action:'click',selector:'#fixed'},
 {action:'expectText',selector:'#status-pill',text:'Checked'},
 {action:'wait',ms:4500}
]});
await writeFile(resolve(args[1]),JSON.stringify(config,null,2)+'\n',{flag:'wx'});
console.log('Created explicit static-asset config. Review it before capture; no API fixtures or remote scans.');
