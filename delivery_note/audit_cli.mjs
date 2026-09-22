import {audit, inventory, snapshot, validateRequirements} from './web/core.mjs';
let input='';
try {
  for await (const chunk of process.stdin) {input+=chunk;if(input.length>4*1024*1024)throw new Error('Request too large');}
  const {package:pkg,runtime={},mode='audit',requirements}=JSON.parse(input);
  let result;
  if(mode==='validate-plan')result={requirements:validateRequirements(requirements)};
  else if(mode==='inventory'){const files=await inventory(pkg);result={snapshot:await snapshot(pkg,files),files:files.map(({text,parsed,...f})=>({...f,columns:parsed?.columns||null}))};}
  else result=await audit(pkg,runtime);
  process.stdout.write(JSON.stringify(result));
} catch (e) {process.stderr.write(String(e.message).slice(0,1000));process.exitCode=1;}
