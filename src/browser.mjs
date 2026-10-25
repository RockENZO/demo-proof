import {chromium} from 'playwright';
import {setTimeout as delay} from 'node:timers/promises';
import {assert,hash} from './config.mjs';

export async function journey(config, {resources=null,videoDir=null,screenshot=null}={}) {
  const browser=await chromium.launch();let context;const violations=[];const fetched=new Map();let fixtureResponses=0,replayedAssets=0;
  try {
    context=await browser.newContext({viewport:config.viewport,serviceWorkers:'block',acceptDownloads:false,...(videoDir?{recordVideo:{dir:videoDir,size:config.viewport}}:{})});
    await context.routeWebSocket('**/*',ws=>{violations.push('WebSocket traffic is outside v1 coverage.');ws.close();});
    const cached=new Map((resources??[]).map(r=>[r.path,r]));const origin=new URL(config.url).origin;
    await context.route('**/*',async route=>{
      const request=route.request();let u;try{u=new URL(request.url());}catch{violations.push('Unsupported network request.');await route.abort();return;}
      if(u.origin!==origin||u.search||u.hash){violations.push('Unapproved network request.');await route.abort();return;}
      const fixture=config.fixtures.find(f=>f.path===u.pathname&&f.method===request.method());
      if(fixture){fixtureResponses++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture.json)});return;}
      if(request.method()!=='GET'||!config.assets.includes(u.pathname)){violations.push('Unapproved network request.');await route.abort();return;}
      if(resources){const resource=cached.get(u.pathname);if(!resource){violations.push('Missing replay resource.');await route.abort();return;}replayedAssets++;await route.fulfill({status:200,contentType:resource.contentType,body:Buffer.from(resource.bodyBase64,'base64')});return;}
      try {
        // Do not forward cookies, request bodies or browser authorization headers.
        const response=await fetch(u.href,{redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(5000)});
        assert(response.status===200,'Declared asset did not return HTTP 200.');const chunks=[];let size=0;
        for await(const chunk of response.body){size+=chunk.length;assert(size<=2_000_000,'Asset exceeds 2 MB.');chunks.push(Buffer.from(chunk));}const body=Buffer.concat(chunks);
        const contentType=response.headers.get('content-type')??'application/octet-stream';assert(contentType.length<=200&&!/[\r\n]/.test(contentType),'Invalid asset content type.');
        const resource={path:u.pathname,contentType,bodyBase64:body.toString('base64'),sha256:hash(body)};fetched.set(u.pathname,resource);assert([...fetched.values()].reduce((n,r)=>n+Buffer.byteLength(r.bodyBase64,'base64'),0)<=8_000_000,'Assets exceed 8 MB.');
        await route.fulfill({status:200,contentType,body});
      }catch{violations.push('Declared asset could not be safely captured.');await route.abort();}
    });
    const page=await context.newPage();page.on('pageerror',()=>violations.push('Application script error.'));await page.goto(config.url,{waitUntil:'load',timeout:10_000});
    let assertions=0;
    for(const step of config.steps){
      if(step.action==='wait')await delay(step.ms);
      else if(step.action==='click')await page.locator(step.selector).click({timeout:5000});
      else if(step.action==='fill')await page.locator(step.selector).fill(step.text,{timeout:5000});
      else {const until=Date.now()+5000;let matched=false;while(Date.now()<until){const text=await page.locator(step.selector).innerText({timeout:1000});if(text.includes(step.text)){matched=true;break;}await delay(50);}assert(matched,'Journey text assertion failed.');assertions++;}
    }
    await delay(200);assert(!violations.length,'Journey failed its network or application-error gate.');
    const screenshotBytes=screenshot?await page.screenshot({fullPage:false}):null;const video=page.video();await context.close();context=null;
    assert(!violations.length,'Journey failed its network or application-error gate.');
    if(!resources)assert(config.assets.every(p=>fetched.has(p)),'A declared asset was never observed; trim the allowlist or exercise it.');
    return {resources:resources??[...fetched.values()],assertions,fixtureResponses,replayedAssets,videoPath:video?await video.path():null,screenshotBytes,networkPolicy:resources?'All HTTP requests fulfilled locally or aborted; no asset fetches.':'Only declared same-origin GET assets fetched; fixture APIs fulfilled locally.'};
  }catch{throw new Error('Journey failed: inspect the approved routes and declared UI assertions. No verified export was produced.');}
  finally{if(context)await context.close().catch(()=>{});await browser.close();}
}
