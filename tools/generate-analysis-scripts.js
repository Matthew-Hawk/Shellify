import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {commands,defaults} from '../dist/js/commands.js';
import {validate} from '../dist/js/validation.js';
import {generateScript} from '../dist/js/generator.js';

// Only required fields without catalog defaults need representative input.
const examples={
  restart:{service:'Spooler'},
  'start-service':{service:'Spooler'},
  'file-hash':{path:'C:\\Example\\file.txt'},
  'lockout-events':{computer:'dc01'},
  'ad-unlock':{identity:'jdoe'}
};

export function analysisScripts(){
  return commands.flatMap(command=>{
    const values={...defaults(command),...examples[command.id]};
    const errors=validate(command,values);
    if(Object.keys(errors).length)throw Error(`${command.id}: invalid analysis inputs: ${JSON.stringify(errors)}`);
    return command.versions.map(version=>({
      file:`${command.id}-ps${version}.ps1`,
      code:generateScript([{actionId:command.id,values}],{version})
    }));
  });
}

export async function writeAnalysisScripts(directory){
  const scripts=analysisScripts();
  if(!scripts.length)throw Error('No command templates found.');
  if(new Set(scripts.map(script=>script.file)).size!==scripts.length)throw Error('Duplicate analysis script names.');
  await mkdir(directory,{recursive:true});
  for(const script of scripts)await writeFile(resolve(directory,script.file),script.code,'utf8');
  console.log(`Generated ${scripts.length} scripts from ${commands.length} command templates in ${directory}.`);
}
