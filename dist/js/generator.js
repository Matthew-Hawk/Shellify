import {commands} from './commands.js';
import {validate,quote} from './validation.js';
import {outputErrors,reviewWorkspace} from './projects.js';
export function generateScript(steps,options={}){
  const version=options.version||'5.1';
  if(!['5.1','7'].includes(version))throw Error('Unsupported PowerShell version.');
  const comment=value=>String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u2028\u2029]/g,' ').split(/\r\n|\r|\n/).map(line=>`# ${line}`).join('\n');
  const metadata=[options.title?comment(options.title):'',options.description?comment(options.description):''].filter(Boolean).join('\n');
  const duplicateDestination=reviewWorkspace({steps,version}).errors.find(message=>message.includes('multiple steps write'));
  if(duplicateDestination)throw Error(duplicateDestination);
  const dependencies=new Set();
  const blocks=steps.map((step,i)=>{
    const action=commands.find(c=>c.id===step.actionId);
    if(!action)throw Error('Unsupported action.');
    if(!action.versions.includes(version))throw Error(`Step ${i+1} does not support PowerShell ${version}.`);
    if(Object.keys(validate(action,step.values)).length)throw Error(`Step ${i+1} has invalid parameters.`);
    if(Object.keys(outputErrors(action,step.output)).length)throw Error(`Step ${i+1} has invalid output settings.`);
    action.dependencies.forEach(module=>dependencies.add(module));
    let code=action.generate(step.values,version);
    const output=step.output;
    if(output&&output.format!=='none'){
      if(output.format==='csv'&&action.id==='network'&&step.values.quiet)code+=" |\n    Select-Object @{Name='Reachable';Expression={$_}}";
      // Collect the entire pipeline, retaining an array for JSON even with 0/1 results.
      const results=`@(\n    ${code.replaceAll('\n','\n    ')}\n)`;
      code=output.format==='csv'?`${results} |\n    Export-Csv -LiteralPath ${quote(output.path)} -NoTypeInformation -Encoding UTF8 -NoClobber -ErrorAction Stop`:`ConvertTo-Json -InputObject ${results} -Depth 6 |\n    Out-File -LiteralPath ${quote(output.path)} -Encoding UTF8 -NoClobber -ErrorAction Stop`;
    }
    return `# ${i+1}. ${action.name}\n# ${action.description}${action.dependencies.length?`\n# Requirements: ${action.requirements}`:''}${action.risk==='modify'?(step.values.whatIf?'\n# PREVIEW ONLY: -WhatIf reports the planned restart without changing the service.':'\n# CAUTION: Changes system state; review before running.') :''}${output&&output.format!=='none'?'\n# RESULTS: Writes a new result file; existing files are not overwritten.':''}\n${code}`;
  });
  const imports=[...dependencies].map(module=>`Import-Module ${module} -ErrorAction Stop`).join('\n');
  return `# Shellify | Turn your words into PowerShell.\n${metadata?`${metadata}\n`:''}# Review before running. Target requirements are listed in the builder.\n# Target: ${version==='5.1'?'Windows PowerShell 5.1':'PowerShell 7 on Windows'}; check module compatibility.\n$ErrorActionPreference = 'Stop'\n${imports?`\n${imports}\n`:''}\n${blocks.length?blocks.join('\n\n'):'# Add an action to start building your script.'}\n`;
}
