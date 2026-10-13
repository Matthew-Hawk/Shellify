import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {quote} from '../dist/js/validation.js';
import {commands,defaults} from '../dist/js/commands.js';
import {createStep,freshWorkspace,insertWorkflow} from '../dist/js/workspace.js';
import {generateScript} from '../dist/js/generator.js';
import {exportProject,importProject,reviewWorkspace} from '../dist/js/projects.js';
import {settingsFor,resultErrors} from '../dist/js/results.js';
import {sampleMarkup} from '../dist/js/builder-controls.js';
import {invocation} from '../dist/js/parameters.js';
const action=id=>commands.find(c=>c.id===id);
test('restart requires an explicit target and confirmation remains enabled',()=>{
  const step=createStep('restart');assert.equal(step.values.service,'');assert.equal(step.values.confirm,true);assert.throws(()=>generateScript([step]),/invalid parameters/);assert.ok(reviewWorkspace({...freshWorkspace(),steps:[step]}).errors.length);
});
test('workflows append, share appropriate inputs and never insert a restart',()=>{
  const w=freshWorkspace();insertWorkflow(w,'network-check');assert.equal(w.steps.length,7);assert.equal(w.steps.filter(s=>s.bindings.host).length,3);assert.ok(w.steps.slice(1,4).every(s=>!s.bindings.host));assert.ok(!w.steps.some(s=>s.actionId==='restart'));assert.match(generateScript(w.steps,w),/Get-NetIPConfiguration/);
  insertWorkflow(w,'files');assert.equal(w.steps.at(-1).bindings.path,w.steps.at(-2).bindings.path);insertWorkflow(w,'service-check');assert.ok(!w.steps.some(s=>s.actionId==='restart'));
});
test('bounded result controls build useful safe pipelines and illustrative samples',()=>{
  const step=createStep('processes');step.results={...settingsFor(action('processes'),step),fields:['ProcessName','MemoryMB'],sort:'MemoryMB',descending:true,limit:10};assert.match(generateScript([step]),/Sort-Object -Property MemoryMB -Descending[\s\S]*Select-Object -First 10 -Property ProcessName, MemoryMB/);
  assert.match(sampleMarkup(step,action('processes')),/illustrative data, not executed results/);assert.doesNotMatch(sampleMarkup(step,action('processes')),/<th scope="col">Id/);
  const services=createStep('service-details');services.results={...settingsFor(action(services.actionId),services),filters:[{field:'State',operator:'eq',value:'Stopped'},{field:'StartMode',operator:'eq',value:'Auto'}]};assert.match(generateScript([services]),/State -eq 'Stopped'[\s\S]*StartMode -eq 'Auto'/);
  const files=createStep('files');files.results={...settingsFor(action('files'),files),filters:[{field:'Extension',operator:'eq',value:".log'; whoami #"},{field:'Length',operator:'gt',value:'1024'},{field:'LastWriteTime',operator:'older-days',value:'30'}]};assert.match(generateScript([files]),/Extension -eq '.log''; whoami #'/);assert.match(generateScript([files]),/AddDays\(-30\)/);
  files.results.filters[1].value='1024; whoami';assert.ok(resultErrors(action('files'),files).results);assert.throws(()=>generateScript([files]),/invalid result/);
  files.results.filters=[];files.results.fields=['$(whoami)'];assert.throws(()=>generateScript([files]),/invalid result/);
});
test('event native filters and new template safeguards validate',()=>{
  const event=createStep('events');Object.assign(event.values,{level:2,eventId:1000,provider:"Example'Provider",endHours:1});assert.match(generateScript([event]),/ProviderName='Example''Provider'; Level=2; Id=1000/);event.values.endHours=24;assert.throws(()=>generateScript([event]),/invalid parameters/);
  const hash=createStep('file-hash');hash.values.path='C:\\Example\\file.txt';hash.values.expected='a'.repeat(64);assert.match(generateScript([hash]),/Algorithm 'SHA256'[\s\S]*Name='Match'/);hash.values.expected='xyz';assert.throws(()=>generateScript([hash]),/invalid parameters/);
  assert.doesNotMatch(generateScript([createStep('bitlocker')],{viewMode:'expert'}),/KeyProtector|RecoveryPassword/);assert.match(action('local-members').requirements,/32-bit/);assert.match(action('hotfix').requirements,/not a complete inventory/);
});
test('parameters preserve literals, imports, fields, conditions and invocation',()=>{
  const w=freshWorkspace();w.exportMode='parameters';w.steps=[createStep('network'),createStep('files')];w.sharedInputs=[{id:'host',name:'Destination',value:"example'host",parameter:{enabled:true,name:'Destination',required:false}}];w.steps[0].bindings.host='host';w.steps[1].parameterFields.path={enabled:true,name:'Folder',required:true};w.steps[1].values.path='';w.steps[1].condition={type:'connectivity',sourceStep:0};w.executionSummary=true;
  for(const viewMode of ['guided','expert']){w.viewMode=viewMode;const code=generateScript(w.steps,w);assert.match(code,/^param\(/);assert.match(code,/\[string\]\$Destination = 'example''host'/);assert.match(code,/-LiteralPath \$Folder/);assert.match(code,/Status='Skipped'/);assert.match(code,/\$script:ShellifyConnectivity1/);assert.doesNotMatch(code,/-LiteralPath 'Required parameter'/);}
  const imported=importProject(exportProject(w));assert.deepEqual(imported.steps[1].parameterFields,w.steps[1].parameterFields);assert.deepEqual(imported.steps[1].condition,w.steps[1].condition);assert.equal(imported.sharedInputs[0].parameter.name,'Destination');assert.match(invocation(w),/-Folder '<value>'/);
  w.steps[1].parameterFields.path.name='Destination';assert.throws(()=>generateScript(w.steps,w),/unique parameter/);
  const restart=createStep('restart');restart.values.service='ExampleService';restart.parameterFields.computer={enabled:true,name:'RemoteComputer',required:true};const remote=generateScript([restart],{exportMode:'parameters',preflight:true});assert.match(remote,/-ComputerName \$RemoteComputer/);assert.doesNotMatch(remote,/WindowsBuiltInRole\]::Administrator/);
});
test('conditions reject future, missing and bulk sources',()=>{
  const steps=[createStep('network'),createStep('files')];steps[1].condition={type:'connectivity',sourceStep:1};assert.throws(()=>generateScript(steps),/invalid result controls or condition/);steps[1].condition.sourceStep=0;steps[0].bulk={field:'host',targets:['a','b']};assert.throws(()=>generateScript(steps),/invalid result controls or condition/);
});
test('mocked connectivity and service conditions report skips separately on both PowerShell versions',{skip:process.platform!=='win32'},()=>{
  for(const executable of ['powershell.exe','pwsh.exe'])for(const reachable of [true,false]){
    const steps=[createStep('network'),createStep('restart')];steps[0].values.quiet=true;steps[1].values.service='ExampleService';steps[1].values.confirm=false;steps[1].condition={type:'connectivity',sourceStep:0};
    const script=generateScript(steps,{executionSummary:true,viewMode:'expert'});
    const mocks=`function Test-Connection { [CmdletBinding()] param($ComputerName,$TargetName,$Count,[switch]$Quiet) $${reachable} }\nfunction Get-Service { [pscustomobject]@{Name='ExampleService';Status='Stopped'} }\nfunction Restart-Service { [CmdletBinding(SupportsShouldProcess)] param([Parameter(ValueFromPipeline)]$InputObject) process { Write-Output 'MOCK-RESTART' } }\n`;
    const result=spawnSync(executable,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(mocks+script,'utf16le').toString('base64')],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,reachable?/2 succeeded; 0 failed; 0 skipped/:/1 succeeded; 0 failed; 1 skipped/);assert.equal(result.stdout.includes('MOCK-RESTART'),reachable);
    steps[1].condition={type:'service-stopped',sourceStep:-1};const conditional=generateScript([steps[1]],{executionSummary:true});const skipped=spawnSync(executable,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(mocks.replace("Status='Stopped'","Status='Running'")+conditional,'utf16le').toString('base64')],{encoding:'utf8',timeout:15000});assert.equal(skipped.status,0,skipped.stderr);assert.match(skipped.stdout,/0 succeeded; 0 failed; 1 skipped/);assert.doesNotMatch(skipped.stdout,/MOCK-RESTART/);
  }
});
test('real fixture hashes and parameterized CSV/JSON exports work in both runtimes',{skip:process.platform!=='win32'},()=>{
  mkdirSync('test-results',{recursive:true});const folder=mkdtempSync(resolve('test-results','runtime-')),file=resolve(folder,"O'Brien[file].txt"),content='Shellify fixture data';writeFileSync(file,content);const hash=createHash('sha256').update(content).digest('hex');
  for(const executable of ['powershell.exe','pwsh.exe']){
    // Codex's host can put PowerShell 7 modules first in inherited PSModulePath.
    // Native 5.1 must load its own built-in modules for real command tests.
    const env={...process.env};if(executable==='powershell.exe'){for(const key of Object.keys(env))if(key.toLowerCase()==='psmodulepath')delete env[key];env.PSModulePath=resolve(process.env.WINDIR||'C:\\Windows','System32','WindowsPowerShell','v1.0','Modules');}
    const integrity=createStep('file-hash');integrity.values.path=file;integrity.values.expected=hash;const report=generateScript([integrity],{viewMode:'expert'}).trimEnd()+' | ConvertTo-Json -Compress';
    const hashed=spawnSync(executable,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(report,'utf16le').toString('base64')],{encoding:'utf8',timeout:15000,env});assert.equal(hashed.status,0,hashed.stderr);assert.equal(JSON.parse(hashed.stdout.trim()).Match,true);
    for(const format of ['csv','json']){
      const step=createStep('files');step.values.path='';step.parameterFields.path={enabled:true,name:'Folder',required:true};step.results={...settingsFor(action('files'),step),fields:['Name','Length'],filters:[{field:'Length',operator:'gt',value:'1'}],sort:'Length',descending:true,limit:1};step.output={format,path:resolve(folder,executable+'.'+format)};
      const code=generateScript([step],{exportMode:'parameters',viewMode:'expert'});const run=spawnSync(executable,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(`& {\n${code}\n} -Folder ${quote(folder)}`,'utf16le').toString('base64')],{encoding:'utf8',timeout:15000,env});assert.equal(run.status,0,run.stderr);const output=readFileSync(step.output.path,'utf8').replace(/^\ufeff/,'');if(format==='json'){const rows=JSON.parse(output);assert.equal(rows.length,1);assert.deepEqual(Object.keys(rows[0]),['Name','Length']);}else{assert.match(output,/"Name","Length"/);assert.equal(output.trim().split(/\r?\n/).length,2);}
    }
  }
});
