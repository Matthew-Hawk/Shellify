import {effectiveWorkspace} from './group-behavior.js';
import {commands} from './commands.js';
import {resolveStep,executionErrors} from './execution.js';
import {parameterDefinitions,validationValues} from './parameters.js';
import {settingsFor,resultErrors} from './results.js';
import {conditionErrors} from './conditions.js';
import {resultSourceIndex,hasResultSource} from './relationships.js';
export {resultSourceIndex,hasResultSource};
export function sourceErrors(step,index,steps,options={}){
  steps=effectiveWorkspace({...options,steps}).steps;step=steps[index]||step;
  if(!hasResultSource(step))return [];
  const sourceIndex=resultSourceIndex(step,steps),source=steps[sourceIndex],action=commands.find(c=>c.id===step.actionId),producer=commands.find(c=>c.id===source?.actionId);
  if(!source)return ['Source step is missing. Choose another earlier services step or change the input source.'];
  if(!Number.isInteger(sourceIndex)||sourceIndex<0||sourceIndex>=index)return ['Move the source before this step, or choose an earlier services step.'];
  if(action?.id!=='start-service'||!producer||!action.accepts.includes(producer.outputType))return ['This input requires earlier services results. Choose a compatible services step.'];
  if(source.results?.fields!==undefined&&(!Array.isArray(source.results.fields)||!source.results.fields.includes('Name')))return ['Restore the Name output field on the source step, or choose another source.'];
  if(step.bulk?.field||step.bindings?.service||step.parameterFields?.service?.enabled)return ['Use either earlier results or custom/shared/bulk service names. Change the input source to resolve the conflict.'];
  const inputs=options.sharedInputs||[],a=resolveStep(source,inputs).values,b=resolveStep(step,inputs).values;
  if(source.bulk?.field||options.targets?.length||a.computer?.trim()||b.computer?.trim()||parameterDefinitions({...options,steps}).some(p=>p.uses.some(use=>[index,sourceIndex].includes(use.index)&&use.field==='computer')))
    return ['Service result links currently require single-computer local steps. Remove remote, fleet or bulk targeting, or use explicit service names.'];
  if(source.output?.format&&source.output.format!=='none')return ['Display the source results in PowerShell before linking them; a file export does not supply service objects.'];
  if(Object.keys(executionErrors(producer,source,inputs,sourceValues({...source,values:validationValues(source,sourceIndex,{...options,steps}).values}))).length||Object.keys(resultErrors(producer,source)).length||conditionErrors(source,sourceIndex,steps).length)
    return ['Configure the source step and its filters or conditions before using its results.'];
  return [];
}
export function sourceValues(step){return hasResultSource(step)&&step.actionId==='start-service'?{...step.values,service:'Earlier service results'}:step.values;}
export function scopeSignature(step,steps,options={}){
  steps=effectiveWorkspace({...options,steps}).steps;step=steps.find(s=>s.id===step.id)||step;
  const source=steps[resultSourceIndex(step,steps)];if(!source)return '';
  const values=s=>Object.fromEntries(Object.entries(resolveStep(s,options.sharedInputs).values).map(([key,value])=>[key,typeof value==='boolean'?value:String(value)]));
  const guard=s=>{const index=s.condition?.type==='connectivity'?(s.condition.sourceId!==undefined?steps.findIndex(t=>t.id===s.condition.sourceId):s.condition.sourceStep):-1,check=steps[index];return {type:s.condition?.type||'none',sourceIndex:index,check:check?{action:check.actionId,values:values(check),results:check.results}:null};};
  return JSON.stringify({source:{action:source.actionId,values:values(source),results:source.results||null,bulk:source.bulk,output:source.output,condition:guard(source),onError:source.onError,parameters:source.parameterFields},target:{values:values(step),bulk:step.bulk,condition:guard(step),onError:step.onError,parameters:step.parameterFields},version:options.version||'5.1',dryRun:options.dryRun===true,targets:options.targets||[],parameters:parameterDefinitions({...options,steps})});
}
export function scopeAcknowledged(step,steps,options={}){return !!step.scopeAcknowledgement&&step.scopeAcknowledgement.sourceId===steps[resultSourceIndex(step,steps)]?.id&&step.scopeAcknowledgement.signature===scopeSignature(step,steps,options);}
export function acknowledgeScope(step,steps,options={}){step.scopeAcknowledgement={sourceId:steps[resultSourceIndex(step,steps)]?.id,signature:scopeSignature(step,steps,options)};}
export function scopeErrors(step,index,steps,options={}){return hasResultSource(step)&&!sourceErrors(step,index,steps,options).length&&!scopeAcknowledged(step,steps,options)?['Review the source scope and acknowledge using all returned service names before export.']:[];}
export function sourceScopeText(source,options={}){
  if(!source)return 'Missing source';
  source=effectiveWorkspace({...options,steps:[source]}).steps[0];
  const action=commands.find(c=>c.id===source.actionId),r=settingsFor(action,source);
  const filters=Array.isArray(r.filters)?r.filters:[];
  const values=resolveStep(source,options.sharedInputs).values,parameter=parameterDefinitions({...options,steps:options.steps||[]}).find(p=>p.uses.some(use=>options.steps?.[use.index]?.id===source.id&&use.field==='service'));
  const base=source.actionId==='auto-services'?`Automatic services that are stopped; boot grace: ${values.bootGrace}`:parameter?`Service query supplied by runtime parameter ${parameter.name}; configured default: ${values.service||'none'}`:values.service?.trim()?`Service query: ${values.service}`:'All services returned by this query';
  return `${base}. ${filters.length?'AND filters: '+filters.map(f=>`${f?.field} ${f?.operator} ${f?.value}`).join('; '):'No extra result filters'}. ${Number(r.limit)>0?'Extra result limit: '+r.limit:'No extra result limit'}. A filter or limit can still return many services.`;
}
