import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css']};
export function createExampleServer() {
 return createServer(async(req,res)=>{const file=files[req.url];if(!file){res.writeHead(req.url==='/api/weather'?503:404,{'content-type':'text/plain'});res.end('No live API. Use the declared DemoProof fixture.');return;}
 try{res.writeHead(200,{'content-type':file[1]});res.end(await readFile(new URL(file[0],import.meta.url)));}catch{res.writeHead(500);res.end();}});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))createExampleServer().listen(4178,'127.0.0.1',()=>console.log('Example: http://127.0.0.1:4178 (the live API intentionally returns 503)'));
