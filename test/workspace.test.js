import test from 'node:test';
import assert from 'node:assert/strict';
import {commands} from '../dist/js/commands.js';
import {generateScript} from '../dist/js/generator.js';
import {DRAFT_KEY,LIBRARY_KEY,createStep,freshWorkspace,restoreWorkspace,readDraft,saveDraft,readLibrary,saveLibrary,filenameFor,stepSummary,stepImpact,workflows,History} from '../dist/js/workspace.js';
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};

test('autosave round trips empty drafts, invalid edits, collapse state and settings',()=>{
  const storage=memory(),workspace=freshWorkspace();
  workspace.steps=[createStep('files')];workspace.steps[0].values.path='';workspace.steps[0].values.force=true;workspace.steps[0].collapsed=true;
  Object.assign(workspace,{title:'Review',description:'Notes\non two lines',filename:'review.ps1',version:'7'});
  assert.equal(saveDraft(storage,workspace),true);
  const restored=readDraft(storage);
  assert.equal(restored.restored,true);assert.equal(restored.error,false);
  assert.equal(restored.workspace.steps[0].values.path,'');assert.equal(restored.workspace.steps[0].collapsed,true);assert.equal(restored.workspace.steps[0].values.force,true);
  assert.equal(restored.workspace.version,'7');assert.equal(restored.workspace.title,'Review');
  assert.notEqual(restored.workspace.steps[0].id,workspace.steps[0].id);
  workspace.steps=[];saveDraft(storage,workspace);assert.deepEqual(readDraft(storage).workspace.steps,[]);
});
test('corrupt storage and denied storage recover without losing generation',()=>{
  const storage=memory();storage.setItem(DRAFT_KEY,'broken json');assert.equal(readDraft(storage).error,true);
  storage.setItem(DRAFT_KEY,JSON.stringify({steps:[{actionId:'evil'}]}));assert.equal(readDraft(storage).error,true);
  assert.throws(()=>restoreWorkspace({steps:Array(201).fill({actionId:'disk'})}));
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('quota');}};
  assert.equal(saveDraft(denied,freshWorkspace()),false);assert.equal(saveLibrary(denied,[]),false);assert.equal(readLibrary(denied).error,true);
  assert.match(generateScript(readDraft(denied).workspace.steps),/Get-CimInstance/);
  const restored=restoreWorkspace({steps:[{id:'" injected',actionId:'restart',values:{confirm:'false',service:'Spooler',computer:'',arbitrary:'whoami'}}]});
  assert.equal(restored.steps[0].values.confirm,true);assert.equal(restored.steps[0].values.arbitrary,undefined);assert.notEqual(restored.steps[0].id,'" injected');
});
test('saved library retains independent scripts and skips unsupported records',()=>{
  const storage=memory(),workspace=freshWorkspace();
  saveLibrary(storage,[{id:'one',name:'First script',workspace}]);workspace.steps.length=0;
  const restored=readLibrary(storage);assert.equal(restored.items[0].workspace.steps.length,1);
  storage.setItem(LIBRARY_KEY,JSON.stringify([{id:'bad',name:'Bad',workspace:{steps:[{actionId:'no'}]}},...restored.items]));assert.equal(readLibrary(storage).items.length,1);
});
test('undo snapshots survive changes, reset and clear without sharing references',()=>{
  const history=new History(2),workspace=freshWorkspace();history.remember(workspace);
  workspace.steps.push(createStep('files'));history.remember(workspace);workspace.steps[1].values.path='changed';history.remember(workspace);workspace.steps.length=0;
  const previous=history.undo();assert.equal(previous.steps[1].values.path,'changed');previous.steps.length=0;
  assert.equal(history.undo().steps.length,2);assert.equal(history.undo(),undefined);assert.equal(history.available,false);
});
test('workflows generate supported read-only scripts for both PowerShell targets',()=>{
  for(const workflow of workflows)for(const version of ['5.1','7']){
    const steps=workflow.actions.map(createStep);assert.ok(steps.every(step=>stepImpact(step)==='read'));
    assert.doesNotThrow(()=>generateScript(steps,{version}));
  }
});
test('filenames are safe Windows basenames with one PowerShell extension',()=>{
  for(const [value,expected] of [['audit','audit.ps1'],['audit.PS1','audit.ps1'],['','shellify-script.ps1'],['../report','..-report.ps1'],['CON','script-CON.ps1'],['a:b*?','a-b--.ps1']])assert.equal(filenameFor(value),expected);
  assert.ok(filenameFor('a'.repeat(200)).length<=114);
});
test('version-specific generation and metadata cannot introduce executable code',()=>{
  const steps=[createStep('network')];
  const code=generateScript(steps,{version:'7',title:'Title\nWrite-Host injected',description:'First\rSecond\u2028Third'});
  assert.match(code,/# Title\n# Write-Host injected/);assert.match(code,/# First\n# Second Third/);
  assert.match(code,/Test-Connection -TargetName/);assert.doesNotMatch(code,/-ComputerName/);
  assert.match(generateScript(steps,{version:'5.1'}),/Test-Connection -ComputerName/);
  assert.throws(()=>generateScript(steps,{version:'8'}),/Unsupported/);
  assert.ok(commands.every(c=>c.versions.includes('5.1')&&c.versions.includes('7')));
});
test('summary and exported comments distinguish dry runs from modifying steps',()=>{
  const step=createStep('restart');step.values.computer='server01';step.values.whatIf=true;
  assert.equal(stepImpact(step),'preview');assert.match(stepSummary(step),/Spooler on server01.*-WhatIf/);
  const code=generateScript([step]);assert.match(code,/# PREVIEW ONLY:/);assert.doesNotMatch(code,/# CAUTION:/);
  step.values.whatIf=false;assert.equal(stepImpact(step),'modify');assert.match(generateScript([step]),/# CAUTION:/);
});
