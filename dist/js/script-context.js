import {effectiveWorkspace} from './group-behavior.js';
import {commands} from './commands.js';
import {resolveStep} from './execution.js';
import {parameterDefinitions} from './parameters.js';

// Display-only projection of the same resolved inputs used by generation.
// A target describes configured scope, never a verified machine or runtime result.
export function scriptScope(workspace){
  workspace=effectiveWorkspace(workspace);
  if(!workspace.steps.length)return 'No targets yet';
  const scopes=new Set(),parameters=parameterDefinitions(workspace);
  workspace.steps.forEach((step,index)=>{
    const action=commands.find(c=>c.id===step.actionId),values=resolveStep(step,workspace.sharedInputs).values;
    const parameterFor=field=>parameters.find(p=>p.uses.some(use=>use.index===index&&use.field===field));
    const describe=(field,label)=>{
      const parameter=parameterFor(field);
      if(parameter){scopes.add(`${label}: runtime parameter ${parameter.name}`);return true;}
      if(step.bulk?.field===field){scopes.add(`${label}: ${step.bulk.targets.length} bulk targets`);return true;}
      if(values[field]?.trim()){scopes.add(`${label}: ${values[field].trim()}`);return true;}
      return false;
    };
    if(workspace.targets?.length&&action.remote&&!action.report)scopes.add(`Remote: ${workspace.targets.length} fleet targets`);
    else if(action.category==='Active Directory'){
      if(!describe('computer','Remote')&&!describe('server','Directory'))scopes.add('Directory: current domain');
    }
    else if(!describe('computer','Remote'))scopes.add('Local');
    describe('host','Network');
    if(action.category!=='Active Directory')describe('server','DNS server');
  });
  return [...scopes].join(' · ');
}
