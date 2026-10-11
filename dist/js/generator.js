import {commands} from './commands.js';
import {validate} from './validation.js';
export function generateScript(steps){
  const dependencies=new Set();
  const blocks=steps.map((step,i)=>{
    const action=commands.find(c=>c.id===step.actionId);
    if(!action)throw Error('Unsupported action.');
    if(Object.keys(validate(action,step.values)).length)throw Error(`Step ${i+1} has invalid parameters.`);
    action.dependencies.forEach(module=>dependencies.add(module));
    return `# ${i+1}. ${action.name}\n# ${action.description}${action.dependencies.length?`\n# Requirements: ${action.requirements}`:''}${action.risk==='modify'?'\n# CAUTION: Changes system state; review before running.':''}\n${action.generate(step.values)}`;
  });
  const imports=[...dependencies].map(module=>`Import-Module ${module} -ErrorAction Stop`).join('\n');
  return `# Shellify | Turn your words into PowerShell.\n# Review before running. Target requirements are listed in the builder.\n# Target: Windows PowerShell 5.1 or PowerShell 7 on Windows; check module compatibility.\n$ErrorActionPreference = 'Stop'\n${imports?`\n${imports}\n`:''}\n${blocks.length?blocks.join('\n\n'):'# Add an action to start building your script.'}\n`;
}
