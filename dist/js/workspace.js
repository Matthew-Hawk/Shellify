import {effectiveStep} from './group-behavior.js';
import {remapRelationships} from './relationships.js';
import {commands,defaults} from './commands.js';
import {adminWorkflows} from './recipes.js';

export const DRAFT_KEY='shellify.draft.v1';
export const LIBRARY_KEY='shellify.library.v1';
export const workflows=[
  {id:'network-check',name:'Network troubleshooting',description:'Local adapters, IP and DNS settings, then DNS, ping and TCP checks to a shared destination.',actions:['adapters','ip-config','dns-settings','dns','network','tcp-port']},
  {id:'inventory',name:'Workstation inventory',description:'Local computer, drives, installed software, services and Defender-reported status.',actions:['computer','disk','software','services','defender']},
  {id:'service-check',name:'Service troubleshooting',description:'Inspect local status/startup configuration and recent System events. A restart is optional and must be configured explicitly.',actions:['service-details','events']},
  {id:'health',name:'System health check',description:'Computer details, disk space, processes, and connectivity.',actions:['computer','disk','processes','network']},
  {id:'files',name:'Folder review',description:'List files and find older files without deleting anything.',actions:['files','old-files']},
  {id:'ad-review',name:'AD account review',description:'Look up a user, then review locked and inactive accounts. Requires RSAT.',actions:['ad-user','ad-locked','ad-inactive']},...adminWorkflows
];
export const copy=value=>JSON.parse(JSON.stringify(value));
export function createStep(actionId){
  const action=commands.find(c=>c.id===actionId);
  if(!action)throw Error('Unsupported action.');
  return {id:crypto.randomUUID(),actionId,values:defaults(action),collapsed:false,groupId:undefined,output:{format:'none',path:''},bindings:{},bulk:{field:'',targets:[]},onError:'stop',condition:{type:'none'},parameterFields:{},behaviorOverrides:{}};
}
export function insertWorkflow(workspace,id,provided={}){
  const workflow=workflows.find(w=>w.id===id);if(!workflow)throw Error('Unknown workflow.');
  const added=workflow.actions.map(createStep);
  const group={id:crypto.randomUUID(),workflowId:id,name:workflow.name,intent:workflow.description,collapsed:false};workspace.groups||=[];workspace.groups.push(group);added.forEach(s=>s.groupId=group.id);
  if(workflow.inputs){
    added.forEach(s=>s.onError='continue');
    const inputValue=key=>String(provided[key]??workflow.inputs.find(p=>p.key===key)?.value??'');
    for(const input of workflow.inputs.filter(p=>!['targets','reportPath','dns1','dns2'].includes(p.key))){const shared={id:crypto.randomUUID(),name:input.label,value:inputValue(input.key)};workspace.sharedInputs.push(shared);for(const s of added)if(commands.find(c=>c.id===s.actionId).parameters.some(p=>p.name===input.key))s.bindings[input.key]=shared.id;}
    if(id==='connectivity-triage'){added[0].values.count=1;added[1].values.server=inputValue('dns1');added[2].values.server=inputValue('dns2');}
    if(id==='locked-triage'){const event=added.find(s=>s.actionId==='lockout-events'),controller=workspace.sharedInputs.findLast(s=>s.name==='PDC emulator');event.bindings.computer=controller.id;workspace.dryRun=true;}
    if(workflow.fleet){workspace.targets=inputValue('targets').split(',').map(t=>t.trim()).filter(Boolean);workspace.reachableOnly=true;workspace.executionSummary=true;}
    const report=added.find(s=>s.actionId==='report');if(report){report.values.format=workflow.report;report.values.path=inputValue('reportPath');report.onError='stop';}
  }
  const link=(name,value,fields)=>{const input={id:crypto.randomUUID(),name,value};workspace.sharedInputs.push(input);for(const step of added)for(const field of fields)if(commands.find(c=>c.id===step.actionId).parameters.some(p=>p.name===field))step.bindings[field]=input.id;};
  if(id==='network-check'){link('Destination','example.com',['host']);link('Local adapter','',['adapter']);}
  if(id==='files')link('Folder','C:\\Users\\Public',['path']);
  if(id==='service-check')link('Service name','',['service']);
  if(id==='ad-review')link('Domain controller','',['server']);
  workspace.steps.forEach(s=>s.collapsed=true);workspace.steps.push(...added);return added;
}
export function freshWorkspace(){return {steps:[createStep('disk')],groups:[],targets:[],reachableOnly:true,dryRun:false,title:'',description:'',filename:'shellify-script.ps1',version:'5.1',sharedInputs:[],viewMode:'guided',libraryId:'',preflight:false,executionSummary:false,logging:{enabled:false,path:''},exportMode:'embedded'};}

// Storage is untrusted. Keep only catalog fields and primitive values, including
// unfinished edits so validation can explain them after a refresh.
export function restoreWorkspace(data){
  if(!data||typeof data!=='object'||!Array.isArray(data.steps)||data.steps.length>200)throw Error('Invalid saved script.');
  const steps=data.steps.map(item=>{
    if(!item||typeof item!=='object')throw Error('Invalid saved step.');
    const action=commands.find(c=>c.id===item.actionId);
    if(!action)throw Error('This script includes an unsupported action.');
    const values=defaults(action);
    for(const p of action.parameters){
      const value=item.values?.[p.name];
      if(p.type==='boolean'&&typeof value==='boolean')values[p.name]=value;
      if(p.type!=='boolean'&&(typeof value==='string'||(typeof value==='number'&&Number.isFinite(value))))values[p.name]=String(value).slice(0,500);
    }
    const output=item.output&&['none','csv','json'].includes(item.output.format)?{format:item.output.format,path:typeof item.output.path==='string'?item.output.path.slice(0,500):''}:{format:'none',path:''};
    const bindings=Object.fromEntries(action.parameters.filter(p=>['text','number'].includes(p.type)&&typeof item.bindings?.[p.name]==='string').map(p=>[p.name,item.bindings[p.name].slice(0,100)]));
    const bulk={field:typeof item.bulk?.field==='string'?item.bulk.field:'',targets:Array.isArray(item.bulk?.targets)?item.bulk.targets.slice(0,200).filter(t=>typeof t==='string').map(t=>t.slice(0,500)):[]};
    return {...createStep(action.id),values,collapsed:item.collapsed===true,inputStep:Number.isInteger(item.inputStep)?item.inputStep:-1,groupId:typeof item.groupId==='string'?item.groupId.slice(0,100):undefined,output,bindings,bulk,onError:item.onError==='continue'?'continue':'stop',results:item.results===undefined?undefined:copy(item.results),condition:item.condition===undefined?{type:'none',sourceStep:-1}:copy(item.condition),parameterFields:item.parameterFields===undefined?{}:copy(item.parameterFields),behaviorOverrides:item.behaviorOverrides===undefined?Object.fromEntries([...['whatIf','confirm','verbose'].filter(key=>typeof item.values?.[key]==='boolean'&&item.values[key]!==defaults(action)[key]),...(item.onError==='continue'?['onError']:[]),...(item.values?.computer?.trim()||item.bindings?.computer||item.bulk?.field==='computer'||item.parameterFields?.computer?.enabled?['computer']:[])].map(key=>[key,true])):copy(item.behaviorOverrides)};
  });
  remapRelationships(data.steps,steps);
  const str=(name,max,fallback='')=>typeof data[name]==='string'?data[name].slice(0,max):fallback;
  const sharedInputs=Array.isArray(data.sharedInputs)?data.sharedInputs.slice(0,50).filter(i=>i&&typeof i.id==='string').map(i=>({id:i.id.slice(0,100),name:typeof i.name==='string'?i.name.slice(0,100):'',value:typeof i.value==='string'?i.value.slice(0,500):'',parameter:i.parameter?copy(i.parameter):undefined})):[];
  const groups=Array.isArray(data.groups)?data.groups.slice(0,200).filter(g=>g&&typeof g.id==='string').map(g=>({id:g.id.slice(0,100),workflowId:typeof g.workflowId==='string'?g.workflowId:undefined,name:typeof g.name==='string'?g.name.slice(0,100):undefined,intent:typeof g.intent==='string'?g.intent.slice(0,500):undefined,behavior:g.behavior===undefined?undefined:copy(g.behavior),collapsed:g.collapsed===true})):[];
  return {steps,groups,targets:Array.isArray(data.targets)?data.targets.slice(0,51).filter(t=>typeof t==='string').map(t=>t.slice(0,500)):[],reachableOnly:data.reachableOnly!==false,dryRun:data.dryRun===true,exportMode:data.exportMode==='parameters'?'parameters':'embedded',title:str('title',100),description:str('description',1000),filename:str('filename',120,'shellify-script.ps1'),version:data.version==='7'?'7':'5.1',sharedInputs,viewMode:data.viewMode==='expert'?'expert':'guided',libraryId:str('libraryId',100),preflight:data.preflight===true,executionSummary:data.executionSummary===true,logging:{enabled:data.logging?.enabled===true,path:typeof data.logging?.path==='string'?data.logging.path.slice(0,500):''}};
}
export function readDraft(storage){
  try{const value=storage.getItem(DRAFT_KEY);return {workspace:value?restoreWorkspace(JSON.parse(value)):freshWorkspace(),restored:Boolean(value),error:false};}
  catch{return {workspace:freshWorkspace(),restored:false,error:true};}
}
export function saveDraft(storage,workspace){try{storage.setItem(DRAFT_KEY,JSON.stringify(workspace));return true;}catch{return false;}}
export function readLibrary(storage){
  try{
    const records=JSON.parse(storage.getItem(LIBRARY_KEY)||'[]');
    if(!Array.isArray(records))throw Error();
    return {items:records.slice(0,50).flatMap(item=>{
      try{if(typeof item.id!=='string'||typeof item.name!=='string')return [];let previous=null;try{if(item.previous&&typeof item.previous.name==='string')previous={name:item.previous.name.slice(0,100),workspace:restoreWorkspace(item.previous.workspace)};}catch{}return [{id:item.id.slice(0,100),name:item.name.slice(0,100),workspace:restoreWorkspace(item.workspace),previous}];}catch{return [];}
    }),error:false};
  }catch{return {items:[],error:true};}
}
export function saveLibrary(storage,items){try{storage.setItem(LIBRARY_KEY,JSON.stringify(items));return true;}catch{return false;}}
export function filenameFor(value){
  const name=String(value).replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'-').trim().replace(/[. ]+$/,'').replace(/\.ps1$/i,'').slice(0,110)||'shellify-script';
  return `${/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)?'script-':''}${name}.ps1`;
}
export function stepSummary(step){
  const a=commands.find(c=>c.id===step.actionId);
  const target=['service','path','host','identity','log','taskName','name'].map(key=>step.values[key]).find(Boolean)||step.values.searchBase||'Current computer / domain';
  const flags=a.parameters.filter(p=>p.type==='boolean'&&step.values[p.name]===true).map(p=>p.flag);
  return `${target}${step.values.computer?` on ${step.values.computer}`:''}${flags.length?` · ${flags.join(' ')}`:''}${step.output?.format&&step.output.format!=='none'?` · ${step.output.format.toUpperCase()} → ${step.output.path||'Choose destination'}`:''}`;
}
export function stepImpact(step,options={}){
  step=effectiveStep(step,options);
  const action=commands.find(c=>c.id===step.actionId);
  return action.risk==='modify'?((step.values.whatIf===true||options.dryRun&&action.whatIf)?'preview':action.riskTier==='disruptive'?'disruptive':'modify'):'read';
}
export class History{
  constructor(limit=50){this.items=[];this.limit=limit;}
  remember(workspace){this.items.push(copy(workspace));if(this.items.length>this.limit)this.items.shift();}
  undo(){return this.items.pop();}
  get available(){return this.items.length>0;}
}
