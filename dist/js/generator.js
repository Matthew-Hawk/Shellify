import {resultErrors} from './results.js';
import {conditionErrors} from './conditions.js';
import {applyResults} from './results.js';
import {parameterBlock,parameterizedValues,parameterErrors,validationValues} from './parameters.js';
import {conditionExpression,captureConnectivity} from './conditions.js';
import {runtimeErrors,preflightCode} from './runtime.js';
import {commands} from './commands.js';
import {quote,targetVariable} from './validation.js';
import {outputErrors,reviewWorkspace} from './projects.js';
import {resolveStep,executionErrors,sharedInputErrors} from './execution.js';
const indent=code=>code.split('\n').map(line=>'    '+line).join('\n');
const continueBlock=(code,index,target='')=>`try {\n${indent(code)}\n} catch {\n    Write-Warning (${quote(`Step ${index} failed${target?' for ':': '}`)}${target?` + ${target} + ': '`:''} + $_.Exception.Message)\n    [pscustomobject]@{Step=${index}; ${target?`Target=${target}; `:''}Error=$_.Exception.Message}\n}`;
const trackedBlock=(code,index,target,keepGoing,condition='')=>`try {\n${condition?`    if (-not (${condition})) {\n        [void]$ShellifyRunSummary.Add([pscustomobject]@{Step=${index}; Target=${target}; Status='Skipped'; Error=''})\n    } else {\n`:''}    $ShellifyData${index} = @(& {\n${indent(indent(code))}\n    })\n    [void]$ShellifyRunSummary.Add([pscustomobject]@{Step=${index}; Target=${target}; Status='Succeeded'; Error=''})\n    $ShellifyData${index}\n${condition?'    }\n':''}} catch {\n    [void]$ShellifyRunSummary.Add([pscustomobject]@{Step=${index}; Target=${target}; Status='Failed'; Error=$_.Exception.Message})\n    ${keepGoing?`Write-Warning ('Step ${index} failed: ' + $_.Exception.Message)\n    [pscustomobject]@{Step=${index}; Target=${target}; Error=$_.Exception.Message}`:'throw'}\n}`;
export function generateScript(steps,options={}){
  const version=options.version||'5.1',expert=options.viewMode==='expert',inputs=options.sharedInputs||[];
  if(!['5.1','7'].includes(version))throw Error('Unsupported PowerShell version.');
  if(runtimeErrors({...options,steps}).length)throw Error(runtimeErrors({...options,steps}).join(' '));
  if(parameterErrors({...options,steps}).length)throw Error(parameterErrors({...options,steps}).join(' '));
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
    if(Object.keys(executionErrors(action,original,inputs,validationValues(original,i,{...options,steps}).values)).length)throw Error(`Step ${index} has invalid parameters.`);
    if(Object.keys(outputErrors(action,original.output)).length)throw Error(`Step ${index} has invalid output settings.`);
    if(Object.keys(resultErrors(action,original)).length||conditionErrors(original,i,steps).length)throw Error(`Step ${index} has invalid result controls or condition.`);
    action.dependencies.forEach(module=>dependencies.add(module));
    const step=resolveStep(original,inputs);step.values=parameterizedValues(step,i,{...options,steps});const bulk=step.bulk?.field,variable=`$ShellifyTarget${index}`;
    let code=action.generate(bulk?{...step.values,[bulk]:targetVariable(`ShellifyTarget${index}`)}:step.values,version);
    if(steps.some(s=>s.condition?.type==='connectivity'&&s.condition.sourceStep===i))code=captureConnectivity(code,action,step,index);
    code=applyResults(code,action,step);
    if((bulk||step.output?.format==='csv')&&action.id==='network'&&step.values.quiet)code+=" |\n    Select-Object @{Name='Reachable';Expression={$_}}";
    const guard=conditionExpression(bulk?{...step,values:{...step.values,[bulk]:targetVariable(`ShellifyTarget${index}`)}}:step);
    if(expert)code=code.replace(/\|\n\s+/g,'| ');
    if(bulk){
      code+=" |\n    Select-Object @{Name='Target';Expression={"+variable+"}}, *";
      const body=options.executionSummary?trackedBlock(code,index,variable,step.onError==='continue',guard):step.onError==='continue'?continueBlock(guard?`if (${guard}) {\n${indent(code)}\n} else { Write-Verbose 'Step ${index} skipped: condition not met.' }`:code,index,variable):guard?`if (${guard}) {\n${indent(code)}\n} else { Write-Verbose 'Step ${index} skipped: condition not met.' }`:code;
      code=`$ShellifyResults${index} = foreach (${variable} in @(${step.bulk.targets.map(quote).join(', ')})) {\n${indent(body)}\n}\n$ShellifyResults${index}`;
    }
    const output=step.output;
    if(output&&output.format!=='none'){
      const results=`@(\n${indent(code)}\n)`;
      code=output.format==='csv'?`${results} |\n    Export-Csv -LiteralPath ${quote(output.path)} -NoTypeInformation -Encoding UTF8 -NoClobber -ErrorAction Stop`:`ConvertTo-Json -InputObject ${results} -Depth 6 |\n    Out-File -LiteralPath ${quote(output.path)} -Encoding UTF8 -NoClobber -ErrorAction Stop`;
    }
    if(!bulk&&options.executionSummary)code=trackedBlock(code,index,quote(step.values.host||step.values.computer||step.values.service||'Local'),step.onError==='continue',guard);
    else if(!bulk){if(guard)code=`if (${guard}) {\n${indent(code)}\n} else { Write-Verbose 'Step ${index} skipped: condition not met.' }`;if(step.onError==='continue')code=continueBlock(code,index);}
    if(bulk&&step.onError==='continue')code=continueBlock(code,index);
    if(expert)return code;
    return `# ${index}. ${action.name}\n# ${action.description}${action.dependencies.length?`\n# Requirements: ${action.requirements}`:''}${action.risk==='modify'?(step.values.whatIf?'\n# PREVIEW ONLY: -WhatIf reports the planned restart without changing the service.':'\n# CAUTION: Changes system state; review before running.') :''}${step.condition?.type==='service-stopped'?'\n# CONDITION: Run only if the selected service is stopped.':step.condition?.type==='connectivity'?`\n# CONDITION: Run only if connectivity check ${step.condition.sourceStep+1} succeeds.`:''}${bulk?`\n# Bulk: ${step.bulk.targets.length} targets; results include a Target column.`:''}${step.onError==='continue'?'\n# Errors are reported as warnings and result records; later steps continue.':''}${output&&output.format!=='none'?'\n# RESULTS: Writes a new result file; existing files are not overwritten.':''}\n${code}`;
  });
  const imports=[...dependencies].map(module=>`Import-Module ${module} -ErrorAction Stop`).join('\n');
  const preflight=preflightCode(steps,{...options,version},dependencies);
  let body=[preflight,imports,...blocks].filter(Boolean).join('\n\n');
  const runtime=steps.flatMap((step,i)=>steps.some(s=>s.condition?.type==='connectivity'&&s.condition.sourceStep===i)?[`$script:ShellifyConnectivity${i+1} = $false`]:[]);
  if(options.executionSummary)runtime.push('$ShellifyRunSummary = [System.Collections.Generic.List[object]]::new()');
  if(options.logging?.enabled)runtime.push(`Start-Transcript -LiteralPath ${quote(options.logging.path)} -NoClobber -ErrorAction Stop | Out-Null`);
  const cleanup=[];
  if(options.executionSummary)cleanup.push(`$ShellifySucceeded = @($ShellifyRunSummary | Where-Object { $_.Status -eq 'Succeeded' }).Count\n$ShellifyFailed = @($ShellifyRunSummary | Where-Object { $_.Status -eq 'Failed' }).Count\nWrite-Host ("Execution summary: {0} succeeded; {1} failed; {2} skipped." -f $ShellifySucceeded, $ShellifyFailed, @($ShellifyRunSummary | Where-Object { $_.Status -eq 'Skipped' }).Count)\nif ($ShellifyRunSummary.Count) { Write-Host ($ShellifyRunSummary | Format-Table Step, Target, Status, Error -AutoSize | Out-String) }`);
  if(options.logging?.enabled)cleanup.push('Stop-Transcript -ErrorAction Continue | Out-Null');
  if(cleanup.length)body=`try {\n${indent(body)}\n} finally {\n${indent(cleanup.join('\n'))}\n}`;
  body=[...runtime,body].filter(Boolean).join('\n\n');
  if(expert)return [parameterBlock({...options,steps}),"$ErrorActionPreference = 'Stop'",body].filter(Boolean).join('\n\n')+'\n';
  return `${parameterBlock({...options,steps})?parameterBlock({...options,steps})+'\n\n':''}# Shellify | Explainable PowerShell, built step by step.\n${metadata?`${metadata}\n`:''}# Review before running. Target requirements are listed in the builder.\n# Target: ${version==='5.1'?'Windows PowerShell 5.1':'PowerShell 7 on Windows'}; check module compatibility.\n$ErrorActionPreference = 'Stop'\n\n${body||'# Add an action to start building your script.'}\n`;
}
