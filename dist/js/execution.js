import {validate} from './validation.js';
export const bulkFields=action=>action.parameters.filter(p=>p.type==='text'&&['host','service','computer'].includes(p.name));
export function resolveStep(step,inputs=[]){
  const values={...step.values};
  for(const [name,id] of Object.entries(step.bindings||{}))values[name]=inputs.find(input=>input.id===id)?.value??'';
  if(step.bulk?.field&&step.bulk.targets?.length)values[step.bulk.field]=step.bulk.targets[0];
  return {...step,values};
}
export function executionErrors(action,step,inputs=[],validationValues=null){
  const errors=validate(action,validationValues||resolveStep(step,inputs).values);
  for(const [name,id] of Object.entries(step.bindings||{})){
    if(!action.parameters.some(p=>p.name===name&&p.type==='text'))errors.bindings='Shared inputs can only link to text fields.';
    if(!inputs.some(input=>input.id===id))errors[name]='Choose an existing shared input or use a custom value.';
  }
  if(step.onError&&!['stop','continue'].includes(step.onError))errors.onError='Choose a valid error policy.';
  if(step.bulk?.field){
    if(!bulkFields(action).some(p=>p.name===step.bulk.field))errors.bulk='Bulk targets are not supported for this field.';
    const targets=step.bulk.targets;
    if(!Array.isArray(targets)||targets.length<1||targets.length>50)errors.bulk='Enter between 1 and 50 targets, one per line.';
    else if(targets.some(target=>typeof target!=='string'||!target.trim()||target.length>500||/[\x00-\x1f\x7f]/.test(target)))errors.bulk='Targets must be single-line text values of up to 500 characters.';
    if(step.bindings?.[step.bulk.field])errors.bulk='Use either a shared input or bulk targets for this field.';
  }
  return errors;
}
export function sharedInputErrors(inputs=[]){
  if(!Array.isArray(inputs)||inputs.length>50)return ['Use at most 50 shared inputs.'];
  const ids=new Set(),errors=[];
  for(const input of inputs){
    if(!input||typeof input.id!=='string'||ids.has(input.id)||typeof input.name!=='string'||!input.name.trim()||input.name.length>100||typeof input.value!=='string'||input.value.length>500||/[\x00-\x1f\x7f]/.test(input.value))errors.push('Shared inputs need a unique ID, a name, and a single-line value.');
    ids.add(input?.id);
  }
  return errors;
}
