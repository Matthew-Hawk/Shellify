import {filenameFor} from './workspace.js';
import {commands} from './commands.js';
import {quote,parameterVariable} from './validation.js';
import {resolveStep} from './execution.js';
export const parameterFields=action=>action.parameters.filter(p=>p.type==='text'&&['host','computer','path','service','identity','group','mountPoint','server','searchBase','adapter'].includes(p.name));
export function parameterDefinitions(workspace){
  if(workspace.exportMode!=='parameters')return [];
  const defs=[];
  for(const input of workspace.sharedInputs||[])if(input.parameter?.enabled){const uses=workspace.steps.flatMap((step,index)=>Object.entries(step.bindings||{}).filter(([,id])=>id===input.id).map(([field])=>({index,field})));defs.push({...input.parameter,value:input.value,uses});}
  workspace.steps.forEach((step,index)=>{for(const [field,p] of Object.entries(step.parameterFields||{}))if(p?.enabled)defs.push({...p,value:resolveStep(step,workspace.sharedInputs).values[field],uses:[{index,field}]});});
  return defs;
}
export function parameterErrors(workspace){
  const errors=[],names=new Set();
  if(workspace.exportMode!==undefined&&!['embedded','parameters'].includes(workspace.exportMode))errors.push('Choose embedded values or parameterized export.');
  for(const input of workspace.sharedInputs||[])if(input.parameter&&(typeof input.parameter!=='object'||typeof input.parameter.enabled!=='boolean'))errors.push('Invalid shared parameter options.');
  for(const step of workspace.steps||[]){if(step.parameterFields&&(!step.parameterFields||typeof step.parameterFields!=='object'||Array.isArray(step.parameterFields)))errors.push('Invalid step parameters.');for(const [field,p] of Object.entries(step.parameterFields||{})){const action=commands.find(c=>c.id===step.actionId);if(!p||typeof p!=='object'||typeof p.enabled!=='boolean'||!parameterFields(action).some(f=>f.name===field))errors.push('Use supported input parameters.');}}
  for(const d of parameterDefinitions(workspace)){
    if(typeof d.name!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(d.name)||/^(Shellify|ErrorAction|Verbose|Debug|WarningAction|InformationAction|Confirm|WhatIf|PS|Host$|Error$|Args$|Input$|True$|False$|Null$|Home$|PID$|Matches$|ExecutionContext$|MyInvocation$|Env$)/i.test(d.name)||names.has(d.name.toLowerCase()))errors.push('Use unique parameter names: a letter followed by letters, numbers or underscores (40 characters max); avoid PowerShell reserved names.');
    names.add(String(d.name).toLowerCase());
    if(typeof d.required!=='boolean'||typeof d.value!=='string'||d.value.length>500||/[\x00-\x1f\x7f]/.test(d.value))errors.push('Parameters need a required/default choice and a single-line string default.');
    if(!d.required&&(typeof d.value!=='string'||!d.value.trim()))errors.push('Optional parameters need a nonempty default; otherwise make the parameter required.');
    for(const use of d.uses){const step=workspace.steps[use.index],action=commands.find(c=>c.id===step.actionId);if(!parameterFields(action).some(p=>p.name===use.field)||step.bulk?.field===use.field||step.parameterFields?.[use.field]?.enabled&&step.bindings?.[use.field])errors.push(`Step ${use.index+1}: parameters must use supported text inputs and cannot also use bulk targets or two parameter sources.`);}
  }
  return errors;
}
export function validationValues(step,index,options){
  const resolved=resolveStep(step,options.sharedInputs);
  for(const d of parameterDefinitions(options))if(d.required)for(const use of d.uses)if(use.index===index&&!resolved.values[use.field]?.trim())resolved.values[use.field]='Required parameter';
  return {...resolved,bindings:Object.values(step.bindings||{}).some(id=>!(options.sharedInputs||[]).some(input=>input.id===id))?step.bindings:{}};
}
export function parameterizedValues(step,index,options){const values={...step.values};for(const d of parameterDefinitions(options))for(const use of d.uses)if(use.index===index)values[use.field]=parameterVariable(d.name);return values;}
export function parameterBlock(options){const defs=parameterDefinitions(options);if(!defs.length)return '';return `param(\n${defs.map(d=>`    [Parameter(Mandatory=$${d.required})]\n    [ValidateNotNullOrEmpty()]\n    [ValidatePattern('^[^\\x00-\\x1f\\x7f]*$')]\n    [ValidateLength(1,500)]\n    [string]$${d.name}${d.required?'':` = ${quote(d.value)}`}`).join(',\n')}\n)`;}
export function invocation(options){const defs=parameterDefinitions(options);return `& ${quote('./'+filenameFor(options.filename||'shellify-script.ps1'))}${defs.filter(d=>d.required).map(d=>` -${d.name} ${quote(d.value||'<value>')}`).join('')}`;}
