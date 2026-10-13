import {commands} from './commands.js';
export function sourceErrors(step,index,steps){
  if(step.inputStep===undefined||step.inputStep===-1)return [];
  const action=commands.find(c=>c.id===step.actionId),source=steps[step.inputStep],producer=commands.find(c=>c.id===source?.actionId);
  if(!Number.isInteger(step.inputStep)||step.inputStep<0||step.inputStep>=index||action?.id!=='start-service'||!producer||!action.accepts.includes(producer.outputType)||source.results?.fields!==undefined&&(!Array.isArray(source.results.fields)||!source.results.fields.includes('Name')))return ['Choose an earlier services step that includes its Name field.'];
  if(step.bulk?.field||step.bindings?.service||step.parameterFields?.service?.enabled)return ['Use either earlier results or custom/shared/bulk service names.'];
  return [];
}
export function sourceValues(step){return step.inputStep!==undefined&&step.inputStep!==-1&&step.actionId==='start-service'?{...step.values,service:'Earlier service results'}:step.values;}
