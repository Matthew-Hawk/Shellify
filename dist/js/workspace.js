import {commands,defaults} from './commands.js';

export const DRAFT_KEY='shellify.draft.v1';
export const LIBRARY_KEY='shellify.library.v1';
export const workflows=[
  {id:'health',name:'System health check',description:'Computer details, disk space, processes, and connectivity.',actions:['computer','disk','processes','network']},
  {id:'files',name:'Folder review',description:'List files and find older files without deleting anything.',actions:['files','old-files']},
  {id:'ad-review',name:'AD account review',description:'Look up a user, then review locked and inactive accounts. Requires RSAT.',actions:['ad-user','ad-locked','ad-inactive']}
];
export const copy=value=>JSON.parse(JSON.stringify(value));
export function createStep(actionId){
  const action=commands.find(c=>c.id===actionId);
  if(!action)throw Error('Unsupported action.');
  return {id:crypto.randomUUID(),actionId,values:defaults(action),collapsed:false};
}
export function freshWorkspace(){return {steps:[createStep('disk')],title:'',description:'',filename:'shellify-script.ps1',version:'5.1'};}

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
    return {...createStep(action.id),values,collapsed:item.collapsed===true};
  });
  const str=(name,max,fallback='')=>typeof data[name]==='string'?data[name].slice(0,max):fallback;
  return {steps,title:str('title',100),description:str('description',1000),filename:str('filename',120,'shellify-script.ps1'),version:data.version==='7'?'7':'5.1'};
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
      try{if(typeof item.id!=='string'||typeof item.name!=='string')return [];return [{id:item.id.slice(0,100),name:item.name.slice(0,100),workspace:restoreWorkspace(item.workspace)}];}catch{return [];}
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
  const target=['service','path','host','identity'].map(key=>step.values[key]).find(Boolean)||step.values.searchBase||'Current computer / domain';
  const flags=a.parameters.filter(p=>p.type==='boolean'&&step.values[p.name]===true).map(p=>p.flag);
  return `${target}${step.values.computer?` on ${step.values.computer}`:''}${flags.length?` · ${flags.join(' ')}`:''}`;
}
export function stepImpact(step){
  const action=commands.find(c=>c.id===step.actionId);
  return action.risk==='modify'?(step.values.whatIf===true?'preview':'modify'):'read';
}
export class History{
  constructor(limit=50){this.items=[];this.limit=limit;}
  remember(workspace){this.items.push(copy(workspace));if(this.items.length>this.limit)this.items.shift();}
  undo(){return this.items.pop();}
  get available(){return this.items.length>0;}
}
