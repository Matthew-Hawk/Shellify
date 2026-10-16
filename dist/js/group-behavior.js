import {commands} from './commands.js';
import {resolveStep} from './execution.js';
import {parameterDefinitions} from './parameters.js';
export const behaviorKeys=['whatIf','confirm','verbose','onError','computer'];
export const behaviorPresets=[
  {id:'diagnostic',name:'Diagnostic collection',settings:{changeMode:'preview',onError:'continue',verbose:true}},
  {id:'preview',name:'Preview supported changes',settings:{changeMode:'preview',onError:'stop',verbose:false}},
  {id:'confirmed',name:'Apply with confirmation',settings:{changeMode:'confirm',onError:'stop',verbose:false}}
];
const actionFor=step=>commands.find(c=>c.id===step.actionId);
const supports=(action,key)=>action?.parameters.some(p=>p.name===key);
export function groupName(group){return group?.name||group?.workflowId||'Workflow group';}
export function behaviorShapeErrors(workspace){
  const errors=[],ids=new Set();
  if(workspace.groups!==undefined&&!Array.isArray(workspace.groups))return ['Workflow groups must be a list.'];
  if(workspace.groups?.length>200)errors.push('Use at most 200 workflow groups.');
  for(const group of workspace.groups||[]){
    if(!group||typeof group.id!=='string'||!group.id||group.id.length>100||ids.has(group.id)){errors.push('Workflow groups need unique IDs.');continue;}ids.add(group.id);
    if(group.name!==undefined&&(typeof group.name!=='string'||!group.name.trim()||group.name.length>100))errors.push('Group names need 1–100 characters.');
    if(group.intent!==undefined&&(typeof group.intent!=='string'||group.intent.length>500))errors.push('Group intent must be up to 500 characters.');
    const b=group.behavior;if(b===undefined)continue;
    if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['changeMode','onError','verbose','computerInputId'].includes(k))){errors.push('Unsupported group behavior settings.');continue;}
    if(b.changeMode!==undefined&&!['preserve','preview','confirm'].includes(b.changeMode))errors.push('Choose a supported group change behavior.');
    if(b.onError!==undefined&&!['stop','continue'].includes(b.onError))errors.push('Choose a supported group failure policy.');
    if(b.verbose!==undefined&&typeof b.verbose!=='boolean')errors.push('Choose a valid group evidence setting.');
    if(b.computerInputId!==undefined&&(typeof b.computerInputId!=='string'||b.computerInputId.length>100))errors.push('Choose a valid shared computer input.');
  }
  for(const step of workspace.steps||[]){
    const o=step.behaviorOverrides;
    if(o!==undefined&&(!o||typeof o!=='object'||Array.isArray(o)||Object.entries(o).some(([key,value])=>!behaviorKeys.includes(key)||typeof value!=='boolean')))errors.push('Use supported step behavior overrides.');
  }
  return errors;
}
export function effectiveStep(step,workspace={}){
  const action=actionFor(step),group=(workspace.groups||[]).find(g=>g.id===step.groupId),b=group?.behavior||{},o=step.behaviorOverrides||{};
  const result={...step,values:{...step.values},bindings:{...step.bindings}};
  if(action?.risk==='modify'&&b.changeMode&&b.changeMode!=='preserve'){
    if(supports(action,'whatIf')&&!o.whatIf)result.values.whatIf=b.changeMode==='preview';
    if(supports(action,'confirm')&&!o.confirm)result.values.confirm=true;
  }
  if(b.onError!==undefined&&!o.onError&&!action?.report)result.onError=b.onError;
  if(b.verbose!==undefined&&!o.verbose&&supports(action,'verbose'))result.values.verbose=b.verbose;
  if(b.computerInputId&&supports(action,'computer')&&!o.computer){result.bindings.computer=b.computerInputId;result.bulk={...step.bulk};if(result.bulk.field==='computer')result.bulk.field='';result.parameterFields={...step.parameterFields};delete result.parameterFields.computer;}
  // A script-wide dry run is the strongest safety setting, including explicit overrides.
  if(workspace.dryRun&&action?.whatIf)result.values.whatIf=true;
  return result;
}
export function effectiveWorkspace(workspace){return {...workspace,steps:(workspace.steps||[]).map(s=>effectiveStep(s,workspace))};}
export function behaviorOrigin(step,key,workspace){
  const action=actionFor(step),group=(workspace.groups||[]).find(g=>g.id===step.groupId),b=group?.behavior||{};
  if(key==='whatIf'&&workspace.dryRun&&action?.whatIf)return 'Script-wide dry run';
  if(step.behaviorOverrides?.[key])return 'Step override';
  const inherited=(['whatIf','confirm'].includes(key)&&action?.risk==='modify'&&b.changeMode&&b.changeMode!=='preserve'&&supports(action,key))||(key==='onError'&&!action?.report&&b.onError!==undefined)||(key==='verbose'&&b.verbose!==undefined)||(key==='computer'&&b.computerInputId&&supports(action,'computer'));
  return inherited?'Group default':'Command / recipe default';
}
export function behaviorErrors(workspace){
  const errors=behaviorShapeErrors(workspace);if(errors.length)return errors;
  workspace.steps?.forEach((step,index)=>{
    const action=actionFor(step),group=workspace.groups?.find(g=>g.id===step.groupId),b=group?.behavior,eff=effectiveStep(step,workspace),prefix=`${index+1}. ${action?.name||'Step'}: `;
    if(step.groupId&&!group){errors.push(prefix+'Workflow group is missing. Move the step to an existing group or ungroup it.');return;}
    if(!b)return;
    if(b.computerInputId&&!workspace.sharedInputs?.some(i=>i.id===b.computerInputId)&&supports(action,'computer')&&!step.behaviorOverrides?.computer)errors.push(prefix+'Choose an existing shared computer input in group behavior.');
    if(action?.risk==='modify'&&b.changeMode==='preview'){
      if(!supports(action,'whatIf'))errors.push(prefix+'This group requests preview, but this command has no WhatIf support. Remove it from this group or use a supported workflow.');
      else if(eff.values.whatIf!==true)errors.push(prefix+'The step override enables live changes in a preview group. Reset WhatIf to inherit or change the group behavior.');
    }
    if(action?.risk==='modify'&&b.changeMode==='confirm'){
      if(!supports(action,'confirm'))errors.push(prefix+'This command cannot inherit confirmation. Move it out or choose another group behavior.');
      else if(eff.values.confirm!==true)errors.push(prefix+'The confirmation override conflicts with Apply with confirmation. Reset it to inherit.');
    }
  });return errors;
}
export function behaviorCapabilities(step,workspace){
  const action=actionFor(step),b=workspace.groups?.find(g=>g.id===step.groupId)?.behavior||{},notes=[];
  if(b.computerInputId&&!supports(action,'computer'))notes.push('Shared computer target unsupported; retains command targeting');
  if(action?.risk==='modify'&&b.changeMode==='preview'&&!supports(action,'whatIf'))notes.push('WhatIf unsupported — export blocked');
  if(action?.risk==='modify'&&b.changeMode==='confirm'&&!supports(action,'confirm'))notes.push('Confirmation unsupported — export blocked');
  if(action?.report)notes.push('Report retains its own failure policy and writes a new file');
  if(step.values?.force)notes.push('Force is enabled explicitly and retained');
  return notes;
}
const snapshot=(step,w)=>{
  const eff=effectiveStep(step,w),index=w.steps.findIndex(s=>s.id===step.id),parameter=parameterDefinitions(effectiveWorkspace(w)).find(p=>p.uses.some(use=>use.index===index&&use.field==='computer'));
  const computer=w.targets?.length&&actionFor(step)?.remote&&!actionFor(step)?.report?`Script-wide fleet: ${w.targets.join(', ')}`:parameter?`Runtime parameter: ${parameter.name}`:eff.bulk?.field==='computer'?`Bulk computers: ${eff.bulk.targets.join(', ')}`:resolveStep(eff,w.sharedInputs).values.computer||'Local / command targeting';
  return {whatIf:eff.values.whatIf,confirm:eff.values.confirm,verbose:eff.values.verbose,onError:eff.onError,computer};
};
export function planBehaviorChange(before,after,label,affectedIds){
  const rows=affectedIds.map(id=>{
    const old=before.steps.find(s=>s.id===id),next=after.steps.find(s=>s.id===id);if(!next)return null;
    const previous=snapshot(old||{...next,groupId:undefined},before),current=snapshot(next,after);
    const leavesPreview=before.groups?.find(g=>g.id===old?.groupId)?.behavior?.changeMode==='preview'&&after.groups?.find(g=>g.id===next.groupId)?.behavior?.changeMode!=='preview';
    return {id,title:actionFor(next).name,index:after.steps.indexOf(next)+1,before:previous,after:current,changed:behaviorKeys.filter(k=>previous[k]!==current[k]),retained:Object.keys(next.behaviorOverrides||{}).filter(k=>next.behaviorOverrides[k]),notes:behaviorCapabilities(next,after),requiresAcknowledgement:actionFor(next).risk==='modify'&&(((previous.whatIf===true||leavesPreview)&&current.whatIf!==true)||(previous.confirm===true&&current.confirm!==true))};
  }).filter(Boolean);
  return {label,before:JSON.stringify(before),after,rows,requiresAcknowledgement:rows.some(r=>r.requiresAcknowledgement),errors:behaviorErrors(after)};
}
export function moveStepToGroup(workspace,stepId,groupId){
  const step=workspace.steps.find(s=>s.id===stepId);if(!step)throw Error('Step is missing.');
  workspace.steps=workspace.steps.filter(s=>s.id!==stepId);
  if(groupId)step.groupId=groupId;else delete step.groupId;
  const last=workspace.steps.findLastIndex(s=>groupId&&s.groupId===groupId);
  workspace.steps.splice(last<0?workspace.steps.length:last+1,0,step);
}
