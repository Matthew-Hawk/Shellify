import {copy} from './workspace.js';
const snapshot=workspace=>({...copy(workspace),libraryId:''});
const validName=name=>{if(typeof name!=='string'||!name.trim()||name.length>100)throw Error('Enter a name of up to 100 characters.');return name.trim();};
export function saveEntry(items,id,name,workspace){
  name=validName(name);
  if(!id){if(items.length>=50)throw Error('The library holds 50 scripts. Delete one to make room.');const entry={id:crypto.randomUUID(),name,workspace:snapshot(workspace),previous:null};return {id:entry.id,items:[entry,...items]};}
  const old=items.find(item=>item.id===id);if(!old)throw Error('This saved script no longer exists. Save it as a new entry.');
  return {id,items:items.map(item=>item.id===id?{...item,name,workspace:snapshot(workspace),previous:{name:item.name,workspace:snapshot(item.workspace)}}:item)};
}
export function renameEntry(items,id,name){
  name=validName(name);if(!items.some(item=>item.id===id))throw Error('Saved script not found.');
  return items.map(item=>item.id===id?{...item,name,previous:item.previous||{name:item.name,workspace:snapshot(item.workspace)}}:item);
}
export function restoreEntry(items,id){
  const item=items.find(item=>item.id===id);if(!item?.previous)throw Error('No previous version is available.');
  return items.map(entry=>entry.id===id?{...entry,name:entry.previous.name,workspace:snapshot(entry.previous.workspace),previous:{name:entry.name,workspace:snapshot(entry.workspace)}}:entry);
}
