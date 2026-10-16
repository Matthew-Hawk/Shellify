import {commands} from './commands.js';
import {effectiveStep,behaviorOrigin} from './group-behavior.js';
import {conditionSourceIndex} from './relationships.js';
import {conditionErrors} from './conditions.js';
import {hasResultSource,resultSourceIndex,sourceErrors,scopeErrors,sourceScopeText} from './composition.js';
export function relationshipsFor(workspace,step){
  const steps=workspace.steps,index=steps.indexOf(step),edges=[];
  const label=s=>s?`Step ${steps.indexOf(s)+1}: ${commands.find(c=>c.id===s.actionId).name}`:'Missing source';
  if(hasResultSource(step)){
    const source=steps[resultSourceIndex(step,steps)];
    edges.push({kind:'results',label:'Use results',sourceId:source?.id,targetId:step.id,detail:`${label(source)} → Name → ${label(step)} / Service name. ${sourceScopeText(source,workspace)} Affected count: determined when the script runs. Empty, skipped or failed source: skip the action.`,errors:[...sourceErrors(step,index,steps,workspace),...scopeErrors(step,index,steps,workspace)]});
  }
  if(step.condition?.type&&step.condition.type!=='none'){
    const source=steps[conditionSourceIndex(step,steps)];
    edges.push({kind:'condition',label:'Only if',sourceId:source?.id,targetId:step.id,detail:step.condition.type==='connectivity'?`${label(source)} → ${label(step)}. Run only if that ping/TCP check reports connectivity. ICMP failure does not prove the host is unavailable. False or failed check: skip follow-up.`:`${label(step)}: run only if the selected service is stopped.`,errors:conditionErrors(step,index,steps)});
  }
  for(const [field,id] of Object.entries(effectiveStep(step,workspace).bindings||{})){
    const input=workspace.sharedInputs.find(s=>s.id===id);
    const groupDefault=field==='computer'&&behaviorOrigin(step,field,workspace)==='Group default';
    edges.push({kind:'shared',field,groupDefault,label:'Shared input',targetId:step.id,detail:`${input?.name||'Missing shared input'} → ${label(step)} / ${field}. ${groupDefault?'Inherited from group behavior. ':''}${input?'Value: '+input.value:'Choose another shared input or custom value.'}`,errors:input?[]:['Shared input is missing.']});
  }
  if(step.actionId==='report')edges.push({kind:'report',label:'Collect results',targetId:step.id,detail:`${label(step)} collects independent earlier steps: ${steps.slice(0,index).map(label).join('; ')||'none yet'}. Collection is separate from result-to-input mapping. The exported script writes the report when run.`,errors:[]});
  return edges;
}
