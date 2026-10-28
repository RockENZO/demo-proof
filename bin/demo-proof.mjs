#!/usr/bin/env node
const args=process.argv.slice(2);
if(!args.length||args[0]==='--help')console.log('DemoProof (experimental)\n  demo-proof capture --config config.json --out new-directory\n  demo-proof replay --bundle capture/bundle.json --out new-directory [--gif]\n  demo-proof verify --manifest export/manifest.json [--expected-manifest-sha256 digest]\nRequires Node22+. Capture/replay also need Playwright Chromium and ffmpeg. Verify reads listed artifact bytes only, without replay or publisher authentication. Inputs must be trusted local apps; export uses approved example fields, not live API data.');
else {
 try {
  const command=args.shift();if(!['capture','replay','verify'].includes(command))throw Error();const options={};
  const allowed=command==='verify'?['--manifest','--expected-manifest-sha256']:command==='capture'?['--config','--out']:['--bundle','--out'];
  for(let i=0;i<args.length;i++){const flag=args[i];if(flag==='--gif'){if(options.gif||command!=='replay')throw Error();options.gif=true;}else {if(!allowed.includes(flag)||options[flag]||!args[i+1]||args[i+1].startsWith('--'))throw Error();options[flag]=args[++i];}}
  let result;
  if(command==='verify') {
    if(!options['--manifest'])throw Error();
    const {verify}=await import('../src/verify.mjs');
    result=await verify(options['--manifest'],{expectedManifestSha256:options['--expected-manifest-sha256']});
  }else {
    const key=command==='capture'?'--config':'--bundle';if(!options[key]||!options['--out'])throw Error();
    const {capture,replay}=await import('../src/index.mjs');
    result=command==='capture'?await capture(options[key],options['--out']):await replay(options[key],options['--out'],{gif:!!options.gif});
  }
  console.log(JSON.stringify(result,null,2));
 }catch{console.error('DemoProof failed. Review the command and inputs. Verify requires unchanged regular media files and a supported manifest; capture/replay also require approved routes, assertions and Chromium/ffmpeg.');process.exitCode=1;}
}
