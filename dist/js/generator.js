import {commands} from './commands.js';
import {quote,targetVariable} from './validation.js';
import {outputErrors,reviewWorkspace} from './projects.js';
import {resolveStep,executionErrors,sharedInputErrors} from './execution.js';
const indent=code=>code.split('\n').map(line=>'    '+line).join('\n');
const continueBlock=(code,index,target='')=>`try {\n${indent(code)}\n} catch {\n    Write-Warning (${quote(`Step ${index} failed${target?' for ':': '}`)}${target?` + ${target} + ': '`:''} + $_.Exception.Message)\n    [pscustomobject]@{Step=${index}; ${target?`Target=${target}; `:''}Error=$_.Exception.Message}\n}`;
export function generateScript(steps,options={}){
  const version=options.version||'5.1',expert=options.viewMode==='expert',inputs=options.sharedInputs||[];
  if(!['5.1','7'].includes(version))throw Error('Unsupported PowerShell version.');
  if(sharedInputErrors(inputs).length)throw Error('Invalid shared inputs.');
  const comment=value=>String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u2028\u2029]/g,' ').split(/\r\n|\r|\n/).map(line=>`# ${line}`).join('\n');
  const metadata=[options.title?comment(options.title):'',options.description?comment(options.description):''].filter(Boolean).join('\n');
  const duplicateDestination=reviewWorkspace({...options,steps,version}).errors.find(message=>message.includes('multiple steps write'));
  if(duplicateDestination)throw Error(duplicateDestination);
  const dependencies=new Set();
  const blocks=steps.map((original,i)=>{
    const index=i+1,action=commands.find(c=>c.id===original.actionId);
    if(!action)throw Error('Unsupported action.');
    if(!action.versions.includes(version))throw Error(`Step ${index} does not support PowerShell ${version}.`);
    if(Object.keys(executionErrors(action,original,inputs)).length)throw Error(`Step ${index} has invalid parameters.`);
    if(Object.keys(outputErrors(action,original.output)).length)throw Error(`Step ${index} has invalid output settings.`);
    action.dependencies.forEach(module=>dependencies.add(module));
    const step=resolveStep(original,inputs),bulk=step.bulk?.field,variable=`$ShellifyTarget${index}`;
    let code=action.generate(bulk?{...step.values,[bulk]:targetVariable(`ShellifyTarget${index}`)}:step.values,version);
    if((bulk||step.output?.format==='csv')&&action.id==='network'&&step.values.quiet)code+=" |\n    Select-Object @{Name='Reachable';Expression={$_}}";
    if(expert)code=code.replace(/\|\n\s+/g,'| ');
    if(bulk){
      code+=" |\n    Select-Object @{Name='Target';Expression={"+variable+"}}, *";
      const body=step.onError==='continue'?continueBlock(code,index,variable):code;
      code=`$ShellifyResults${index} = foreach (${variable} in @(${step.bulk.targets.map(quote).join(', ')})) {\n${indent(body)}\n}\n$ShellifyResults${index}`;
    }
    const output=step.output;
    if(output&&output.format!=='none'){
      const results=`@(\n${indent(code)}\n)`;
      code=output.format==='csv'?`${results} |\n    Export-Csv -LiteralPath ${quote(output.path)} -NoTypeInformation -Encoding UTF8 -NoClobber -ErrorAction Stop`:`ConvertTo-Json -InputObject ${results} -Depth 6 |\n    Out-File -LiteralPath ${quote(output.path)} -Encoding UTF8 -NoClobber -ErrorAction Stop`;
    }
    if(step.onError==='continue')code=continueBlock(code,index);
    if(expert)return code;
    return `# ${index}. ${action.name}\n# ${action.description}${action.dependencies.length?`\n# Requirements: ${action.requirements}`:''}${action.risk==='modify'?(step.values.whatIf?'\n# PREVIEW ONLY: -WhatIf reports the planned restart without changing the service.':'\n# CAUTION: Changes system state; review before running.') :''}${bulk?`\n# Bulk: ${step.bulk.targets.length} targets; results include a Target column.`:''}${step.onError==='continue'?'\n# Errors are reported as warnings and result records; later steps continue.':''}${output&&output.format!=='none'?'\n# RESULTS: Writes a new result file; existing files are not overwritten.':''}\n${code}`;
  });
  const imports=[...dependencies].map(module=>`Import-Module ${module} -ErrorAction Stop`).join('\n');
  if(expert)return ["$ErrorActionPreference = 'Stop'",imports,...blocks].filter(Boolean).join('\n\n')+'\n';
  return `# Shellify | Turn your words into PowerShell.\n${metadata?`${metadata}\n`:''}# Review before running. Target requirements are listed in the builder.\n# Target: ${version==='5.1'?'Windows PowerShell 5.1':'PowerShell 7 on Windows'}; check module compatibility.\n$ErrorActionPreference = 'Stop'\n${imports?`\n${imports}\n`:''}\n${blocks.length?blocks.join('\n\n'):'# Add an action to start building your script.'}\n`;
}
