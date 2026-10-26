#!/usr/bin/env node
import {capture,replay} from '../src/index.mjs';
const args=process.argv.slice(2);
if(!args.length||args[0]==='--help')console.log('DemoProof (experimental)\n  demo-proof capture --config config.json --out new-directory\n  demo-proof replay --bundle capture/bundle.json --out new-directory [--gif]\nRequires Node22+, Playwright Chromium and ffmpeg. Inputs must be trusted local apps; export uses approved example fields, not live API data.');
else {
 try {
  const command=args.shift();if(!['capture','replay'].includes(command))throw Error();const options={};
  for(let i=0;i<args.length;i++){const flag=args[i];if(flag==='--gif'){if(options.gif||command!=='replay')throw Error();options.gif=true;}else {if(!['--config','--bundle','--out'].includes(flag)||options[flag]||!args[i+1]||args[i+1].startsWith('--'))throw Error();options[flag]=args[++i];}}
  const key=command==='capture'?'--config':'--bundle';if(!options[key]||!options['--out']||options[command==='capture'?'--bundle':'--config'])throw Error();
  const result=command==='capture'?await capture(options[key],options['--out']):await replay(options[key],options['--out'],{gif:!!options.gif});console.log(JSON.stringify(result,null,2));
 }catch{console.error('DemoProof failed. Review the command, config, approved local routes, journey assertions, and Chromium/ffmpeg setup. Existing output directories are never reused.');process.exitCode=1;}
}
