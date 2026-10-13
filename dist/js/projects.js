import {commands} from './commands.js';
import {restoreWorkspace,filenameFor,stepImpact} from './workspace.js';
import {validate} from './validation.js';

export const MAX_PROJECT_BYTES=1024*1024;
export function exportProject(workspace){
  return JSON.stringify({format:'shellify-project',schemaVersion:1,workspace:{...workspace,steps:workspace.steps.map(({actionId,values,collapsed,output})=>({actionId,values,collapsed,output}))}},null,2);
}
export const projectFilename=workspace=>filenameFor(workspace.filename).replace(/\.ps1$/i,'.shellify.json');
export function importProject(source){
  if(typeof source!=='string'||new TextEncoder().encode(source).length>MAX_PROJECT_BYTES)throw Error('Project files must be smaller than 1 MB.');
  let project;try{project=JSON.parse(source.replace(/^\ufeff/,''));}catch{throw Error('This file is not valid JSON. Choose a .shellify.json project.');}
  if(project?.format!=='shellify-project'||project.schemaVersion!==1)throw Error('Unsupported Shellify project format or version.');
  const data=project.workspace;
  if(!data||!['5.1','7'].includes(data.version)||!Array.isArray(data.steps)||data.steps.length>200)throw Error('Invalid project settings or step count.');
  for(const [key,max] of [['title',100],['description',1000],['filename',120]])if(typeof data[key]!=='string'||data[key].length>max)throw Error(`Invalid project ${key}.`);
  for(const item of data.steps){
    const action=commands.find(c=>c.id===item?.actionId);
    if(!action)throw Error('This project contains an unsupported command.');
    if(!item.values||typeof item.values!=='object'||Array.isArray(item.values))throw Error('Invalid project parameters.');
    for(const [name,value] of Object.entries(item.values)){
      const p=action.parameters.find(p=>p.name===name);
      if(!p)throw Error(`Unsupported parameter: ${name}.`);
      if(p.type==='boolean'?typeof value!=='boolean':!['string','number'].includes(typeof value)||String(value).length>500)throw Error(`Invalid parameter: ${name}.`);
    }
    if(item.output!==undefined){
      if(!item.output||!['none','csv','json'].includes(item.output.format)||typeof item.output.path!=='string'||item.output.path.length>500)throw Error('Invalid result output settings.');
      if(action.risk==='modify'&&item.output.format!=='none')throw Error('Result exports are available for read-only commands.');
    }
  }
  return restoreWorkspace(data);
}

export function outputErrors(action,output){
  if(!output)return {};
  if(!['none','csv','json'].includes(output.format))return {format:'Choose a supported output format.'};
  if(output.format==='none')return {};
  if(action.risk==='modify')return {format:'Result exports are available for read-only commands.'};
  if(typeof output.path!=='string'||!output.path.trim()||output.path.length>500||/[\x00-\x1f\x7f]/.test(output.path))return {path:'Enter a destination path of up to 500 characters without control characters.'};
  return {};
}

const DISCOVERY_KEY='shellify.discovery.v1';
export function readDiscovery(storage){
  try{const data=JSON.parse(storage.getItem(DISCOVERY_KEY)||'{}');const clean=value=>Array.isArray(value)?[...new Set(value.filter(id=>commands.some(c=>c.id===id)))]:[];return {favorites:clean(data.favorites),recent:clean(data.recent).slice(0,8)};}catch{return {favorites:[],recent:[]};}
}
export function saveDiscovery(storage,data){try{storage.setItem(DISCOVERY_KEY,JSON.stringify(data));return true;}catch{return false;}}
export function markRecent(discovery,id){return {...discovery,recent:[id,...discovery.recent.filter(item=>item!==id)].slice(0,8)};}

export function reviewWorkspace(workspace){
  const modules=new Set(),targets=new Set(),files=[],permissions=[],modifying=[],previews=[],errors=[];
  const destinations=new Set();
  workspace.steps.forEach((step,index)=>{
    const a=commands.find(c=>c.id===step.actionId);if(!a){errors.push(`Step ${index+1}: unsupported command.`);return;}
    const label=`${index+1}. ${a.name}`;
    a.dependencies.forEach(module=>modules.add(module));
    permissions.push({label,requirements:a.requirements});
    if(Object.keys(validate(a,step.values)).length||Object.keys(outputErrors(a,step.output)).length||!a.versions.includes(workspace.version))errors.push(`${label}: fix the step errors before exporting.`);
    const v=step.values;
    if(v.computer?.trim())targets.add(`Computer: ${v.computer}`);
    if(v.host?.trim())targets.add(`Network host: ${v.host}`);
    if(v.server?.trim())targets.add(`${a.category==='Active Directory'?'Domain controller':'DNS server'}: ${v.server}`);
    if(a.category==='Active Directory'&&!v.server?.trim())targets.add('Active Directory: current domain');
    if(stepImpact(step)==='modify')modifying.push(label);
    if(stepImpact(step)==='preview')previews.push(label);
    if(step.output?.format&&step.output.format!=='none'){
      files.push({label,format:step.output.format,path:step.output.path});
      const path=typeof step.output.path==='string'?step.output.path.trim().toLowerCase().replaceAll('/','\\'):'';
      if(destinations.has(path))errors.push(`${label}: multiple steps write to the same destination. Use separate output paths.`);
      destinations.add(path);
    }
  });
  return {modules:[...modules],targets:[...targets],files,permissions,modifying,previews,errors};
}
