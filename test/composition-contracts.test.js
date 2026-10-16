import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {freshWorkspace,createStep,restoreWorkspace,History} from '../dist/js/workspace.js';
import {exportProject,importProject,reviewWorkspace} from '../dist/js/projects.js';
import {createShareHash,restoreShareHash} from '../dist/js/share.js';
import {generateScript} from '../dist/js/generator.js';
import {sourceErrors,acknowledgeScope,scopeAcknowledged,scopeErrors,sourceScopeText} from '../dist/js/composition.js';
import {conditionErrors} from '../dist/js/conditions.js';
import {relationshipsFor} from '../dist/js/relationship-view.js';
const connected=()=>{const w=freshWorkspace();w.steps=[createStep('services'),createStep('disk'),createStep('start-service')];w.steps[2].inputSourceId=w.steps[0].id;return w;};
test('stable result identity survives reorder, duplicate, deletion/undo, reload, projects and shares',async()=>{
  const w=connected(),consumer=w.steps[2],source=w.steps[0];acknowledgeScope(consumer,w.steps,w);
  assert.deepEqual(reviewWorkspace(w).errors,[]);assert.match(generateScript(w.steps,w),/ShellifyOutput1/);
  const history=new History();history.remember(w);w.steps.splice(0,1);assert.match(sourceErrors(consumer,1,w.steps,w).join(),/missing/);
  const restored=history.undo();assert.equal(restored.steps[2].inputSourceId,restored.steps[0].id);
  for(const r of [restoreWorkspace(restored),importProject(exportProject(restored)),await restoreShareHash(await createShareHash(restored))]){
    assert.equal(r.steps[2].inputSourceId,r.steps[0].id);assert.notEqual(r.steps[0].id,source.id);assert.equal(scopeAcknowledged(r.steps[2],r.steps,r),true);assert.deepEqual(reviewWorkspace(r).errors,[]);
  }
  w.steps=[source,consumer,createStep('disk')];acknowledgeScope(consumer,w.steps,w);assert.equal(scopeAcknowledged(consumer,w.steps,w),true);
  w.steps.reverse();assert.match(sourceErrors(consumer,1,w.steps,w).join(),/before/);
  const duplicate={...structuredClone(consumer),id:crypto.randomUUID()};assert.equal(duplicate.inputSourceId,source.id);
});
test('legacy numeric references migrate once and semantic damage remains repairable on import',()=>{
  const w=connected();delete w.steps[2].inputSourceId;w.steps[2].inputStep=0;
  w.steps[1].condition={type:'connectivity',sourceStep:0}; // incompatible producer is preserved, never silently dropped
  const legacy={format:'shellify-project',schemaVersion:1,workspace:w};const r=importProject(JSON.stringify(legacy));
  assert.equal(r.steps[2].inputSourceId,r.steps[0].id);assert.equal(r.steps[2].inputStep,undefined);
  assert.equal(r.steps[1].condition.sourceId,r.steps[0].id);assert.match(conditionErrors(r.steps[1],1,r.steps).join(),/earlier/);
  assert.throws(()=>generateScript(r.steps,r),/condition/);
  r.steps.splice(0,1);const damaged=importProject(exportProject(r));assert.match(sourceErrors(damaged.steps[1],1,damaged.steps,damaged).join(),/missing/);
  const malformed=JSON.parse(exportProject(w));malformed.workspace.steps[1].id=malformed.workspace.steps[0].id;assert.throws(()=>importProject(JSON.stringify(malformed)),/duplicate/);
});
test('import cannot transfer scope acknowledgement to a different identical source',()=>{
  const w=connected();w.steps.splice(1,0,structuredClone(w.steps[0]));w.steps[1].id=crypto.randomUUID();acknowledgeScope(w.steps[3],w.steps,w);
  const project=JSON.parse(exportProject(w));project.workspace.steps[3].inputSourceId=project.workspace.steps[1].id;
  const r=importProject(JSON.stringify(project));assert.equal(scopeAcknowledged(r.steps[3],r.steps,r),false);assert.throws(()=>generateScript(r.steps,r),/acknowledge/);
});
test('result contracts reject type, order, Name removal, remote, bulk, files and input conflicts',()=>{
  for(const mutate of [
    w=>w.steps[0].actionId='disk',w=>w.steps.reverse(),w=>w.steps[0].results={fields:['Status'],filters:[],limit:0},
    w=>w.steps[2].values.computer='server01',w=>w.steps[0].values.computer='server01',w=>w.targets=['server01'],
    w=>w.steps[0].bulk={field:'computer',targets:['one','two']},w=>w.steps[2].bulk={field:'service',targets:['Spooler']},
    w=>w.steps[2].bindings.service='shared',w=>w.steps[2].parameterFields.service={enabled:true,name:'Service',required:true},
    w=>w.steps[0].output={format:'csv',path:'results.csv'},w=>w.steps[0].results={fields:['Name'],filters:[{field:'NoSuchField',operator:'eq',value:'x'}]}
  ]){const w=connected();mutate(w);const consumer=w.steps.find(s=>s.actionId==='start-service');assert.ok(sourceErrors(consumer,w.steps.indexOf(consumer),w.steps,w).length);assert.throws(()=>generateScript(w.steps,w));}
});
test('acknowledgement is exact, includes upstream and target edits, and never infers a safe count',()=>{
  const w=connected(),consumer=w.steps[2];assert.match(scopeErrors(consumer,2,w.steps,w).join(),/acknowledge/);
  const mutations=[()=>w.steps[0].values.service='Spooler',()=>w.steps[0].results={fields:['Name'],filters:[],limit:1},()=>consumer.values.whatIf=true,()=>w.dryRun=true,()=>w.version='7',()=>consumer.onError='continue'];
  for(const mutate of mutations){acknowledgeScope(consumer,w.steps,w);assert.equal(scopeAcknowledged(consumer,w.steps,w),true);mutate();assert.equal(scopeAcknowledged(consumer,w.steps,w),false);assert.throws(()=>generateScript(w.steps,w),/acknowledge/);}
  acknowledgeScope(consumer,w.steps,w);const edge=relationshipsFor(w,consumer)[0];assert.match(edge.detail,/Step 1.*Name.*Step 3/);assert.match(edge.detail,/determined when the script runs/);assert.doesNotMatch(edge.detail,/1 service affected/);
  const previous=generateScript(w.steps,w);w.steps[1].collapsed=true;assert.equal(generateScript(w.steps,w),previous);
});
test('scope inspection shows effective shared and runtime queries rather than unused custom text',()=>{
  const w=connected(),source=w.steps[0];w.sharedInputs=[{id:'name',name:'Service query',value:'Spooler'}];source.bindings.service='name';
  assert.match(sourceScopeText(source,w),/Service query: Spooler/);
  source.results={fields:['Name'],filters:[],limit:'0'};assert.match(sourceScopeText(source,w),/No extra result limit/);
  w.exportMode='parameters';w.sharedInputs[0].parameter={enabled:true,name:'ServiceQuery',required:true};assert.match(sourceScopeText(source,w),/runtime parameter ServiceQuery/);
});
test('mocked zero results, failed sources and preview actions skip safely in both PowerShell runtimes',{skip:process.platform!=='win32'},()=>{
  for(const shell of ['powershell.exe','pwsh'])for(const mode of ['empty','failure','preview','missing-name'])for(const viewMode of ['guided','expert']){
    const w=connected();w.steps.splice(1,1);const source=w.steps[0],consumer=w.steps[1];source.onError='continue';consumer.values.whatIf=true;w.executionSummary=true;w.version=shell==='pwsh'?'7':'5.1';acknowledgeScope(consumer,w.steps,w);
    if(mode==='missing-name')consumer.onError='continue';w.viewMode=viewMode;acknowledgeScope(consumer,w.steps,w);
    const code=generateScript(w.steps,w),mocks=`$script:Changes=0\nfunction Get-Service { [CmdletBinding()]param(); ${mode==='failure'?"throw 'Mock source failed'":mode==='empty'?'':mode==='missing-name'?"[pscustomobject]@{Status='Stopped'}":"[pscustomobject]@{Name='Example';Status='Stopped';DisplayName='Example'}"} }\nfunction Start-Service { [CmdletBinding(SupportsShouldProcess=$true)]param([Parameter(ValueFromPipeline=$true)]$InputObject);process {if($PSCmdlet.ShouldProcess($InputObject.Name)){$script:Changes++}} }\n`;
    const result=spawnSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(mocks+code+"\nif($script:Changes -ne 0){throw 'Unexpected modification'}",'utf16le').toString('base64')],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,mode==='preview'?/2 succeeded; 0 failed; 0 skipped/:mode==='failure'?/0 succeeded; 1 failed; 1 skipped/:mode==='missing-name'?/1 succeeded; 1 failed; 0 skipped/:/1 succeeded; 0 failed; 1 skipped/);
    assert.doesNotMatch(code,/scopeAcknowledgement|inputSourceId|data-relationship|SHELLIFY_BEGIN/);
  }
});
