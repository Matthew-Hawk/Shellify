import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createStep,freshWorkspace,restoreWorkspace,insertWorkflow,History,stepImpact} from '../dist/js/workspace.js';
import {effectiveStep,behaviorOrigin,behaviorErrors,behaviorPresets,planBehaviorChange,moveStepToGroup} from '../dist/js/group-behavior.js';
import {generateScript} from '../dist/js/generator.js';
import {reviewWorkspace,exportProject,importProject} from '../dist/js/projects.js';
import {createShareHash,restoreShareHash} from '../dist/js/share.js';
import {acknowledgeScope,scopeAcknowledged} from '../dist/js/composition.js';
const fixture=(id='restart')=>{const w=freshWorkspace();w.steps=[createStep(id)];w.steps[0].groupId='g';if(['restart','start-service'].includes(id))w.steps[0].values.service='Example';w.groups=[{id:'g',name:'Maintenance',intent:'Inspect and maintain explicit targets.',behavior:{...behaviorPresets[1].settings}}];return w;};
test('group defaults, explicit overrides and strongest script dry run resolve once without mutating base values',()=>{
  const w=fixture(),s=w.steps[0],before=JSON.stringify(s);assert.equal(effectiveStep(s,w).values.whatIf,true);assert.equal(behaviorOrigin(s,'whatIf',w),'Group default');assert.equal(JSON.stringify(s),before);
  s.behaviorOverrides.whatIf=true;s.values.whatIf=false;assert.equal(effectiveStep(s,w).values.whatIf,false);assert.match(behaviorErrors(w).join(),/live changes in a preview group/);assert.throws(()=>generateScript(w.steps,w),/live changes/);
  w.dryRun=true;assert.equal(effectiveStep(s,w).values.whatIf,true);assert.equal(behaviorOrigin(s,'whatIf',w),'Script-wide dry run');assert.deepEqual(behaviorErrors(w),[]);
  delete s.behaviorOverrides.whatIf;w.dryRun=false;assert.equal(stepImpact(s,w),'preview');
});
test('all presets agree with generated flags in both versions and output modes, retaining Force and confirmation',()=>{
  for(const preset of behaviorPresets)for(const version of ['5.1','7'])for(const viewMode of ['guided','expert']){
    const w=fixture();w.version=version;w.viewMode=viewMode;w.groups[0].behavior={...preset.settings};w.steps[0].values.force=true;
    const code=generateScript(w.steps,w);assert.match(code,/-Confirm:\$true/);assert.match(code,/-Force/);
    assert.equal(code.includes('-WhatIf'),preset.settings.changeMode==='preview');assert.equal(effectiveStep(w.steps[0],w).onError,preset.settings.onError);
    assert.equal(effectiveStep(w.steps[0],w).values.verbose,preset.settings.verbose);assert.match(code,preset.settings.onError==='continue'?/catch/:/ErrorActionPreference = 'Stop'/);
  }
});
test('unsupported preview/confirmation and conflicting overrides remain blocked rather than becoming live exports',()=>{
  const w=fixture('restore-point');assert.match(behaviorErrors(w).join(),/no WhatIf support/);assert.throws(()=>generateScript(w.steps,w),/no WhatIf/);
  w.groups[0].behavior.changeMode='confirm';assert.throws(()=>generateScript(w.steps,w),/cannot inherit confirmation/);
  w.groups[0].behavior.changeMode='preview';const repaired=structuredClone(w);repaired.groups[0].behavior.changeMode='preserve';assert.equal(planBehaviorChange(w,repaired,'Leave unsupported preview',[w.steps[0].id]).requiresAcknowledgement,true);
  const c=fixture();c.groups[0].behavior.changeMode='confirm';c.steps[0].values.confirm=false;c.steps[0].behaviorOverrides.confirm=true;assert.throws(()=>generateScript(c.steps,c),/confirmation override/);
});
test('group targeting applies only to computer-capable steps and explicit target sources remain overrides',()=>{
  const w=fixture();w.sharedInputs=[{id:'host',name:'Computer',value:'server01'}];w.groups[0].behavior.computerInputId='host';
  assert.equal(effectiveStep(w.steps[0],w).bindings.computer,'host');assert.match(generateScript(w.steps,w),/-ComputerName 'server01'/);
  w.steps[0].behaviorOverrides.computer=true;w.steps[0].values.computer='server02';assert.match(generateScript(w.steps,w),/-ComputerName 'server02'/);
  const local=createStep('disk');local.groupId='g';w.steps.unshift(local);assert.equal(effectiveStep(local,w).bindings.computer,undefined);
  w.steps[1].behaviorOverrides.computer=false;w.sharedInputs=[];assert.match(reviewWorkspace(w).errors.join(),/shared computer input/);
});
test('live change plans expose retained overrides, unsupported commands and immutable before/after scope',()=>{
  const w=fixture(),after=structuredClone(w);after.groups[0].behavior={...behaviorPresets[2].settings};
  const p=planBehaviorChange(w,after,'Apply with confirmation',[w.steps[0].id]);assert.equal(p.requiresAcknowledgement,true);assert.equal(p.rows[0].before.whatIf,true);assert.equal(p.rows[0].after.whatIf,false);assert.equal(w.groups[0].behavior.changeMode,'preview');
  after.steps[0].behaviorOverrides.whatIf=true;after.steps[0].values.whatIf=true;const retained=planBehaviorChange(w,after,'Retain preview',[w.steps[0].id]);assert.equal(retained.requiresAcknowledgement,false);assert.ok(retained.rows[0].retained.includes('whatIf'));
});

test('inherited computer parameters replace dormant per-step bulk/parameters and display actual script scope',()=>{
  const w=fixture();w.exportMode='parameters';w.sharedInputs=[{id:'host',name:'Computer',value:'server01',parameter:{enabled:true,name:'GroupComputer',required:true}}];w.groups[0].behavior.computerInputId='host';w.steps[0].parameterFields.computer={enabled:true,name:'OldComputer',required:true};w.steps[0].bulk={field:'computer',targets:['old01','old02']};
  const code=generateScript(w.steps,w);assert.match(code,/\$GroupComputer/);assert.doesNotMatch(code,/OldComputer|old01/);assert.equal(effectiveStep(w.steps[0],w).bulk.field,'');
  const after=structuredClone(w);after.groups[0].behavior.verbose=true;assert.equal(planBehaviorChange(w,after,'Evidence',[w.steps[0].id]).rows[0].after.computer,'Runtime parameter: GroupComputer');
  const fleet=fixture('services');fleet.targets=['fleet01','fleet02'];assert.match(planBehaviorChange(fleet,fleet,'Fleet',[fleet.steps[0].id]).rows[0].after.computer,/Script-wide fleet: fleet01, fleet02/);
});
test('behavior, membership and overrides survive Undo, reload, project and share round trips',async()=>{
  const w=fixture();w.steps[0].behaviorOverrides.verbose=true;w.steps[0].values.verbose=true;const code=generateScript(w.steps,w);
  const h=new History();h.remember(w);w.groups[0].behavior.changeMode='confirm';const previous=h.undo();
  assert.equal(JSON.parse(exportProject(previous)).schemaVersion,3);
  for(const r of [restoreWorkspace(previous),importProject(exportProject(previous)),await restoreShareHash(await createShareHash(previous))]){
    assert.equal(r.groups[0].behavior.changeMode,'preview');assert.equal(r.steps[0].behaviorOverrides.verbose,true);assert.equal(generateScript(r.steps,r),code);
  }
  const next=structuredClone(previous);next.groups.push({id:'live',name:'Confirmed',behavior:{...behaviorPresets[2].settings}});moveStepToGroup(next,next.steps[0].id,'live');assert.equal(planBehaviorChange(previous,next,'Move',[next.steps[0].id]).requiresAcknowledgement,true);
});
test('legacy nondefault step choices migrate as overrides, all new starters are grouped and malformed behavior is rejected',()=>{
  const old=fixture();delete old.steps[0].behaviorOverrides;delete old.groups[0].behavior;old.steps[0].values.confirm=false;old.steps[0].onError='continue';
  const r=restoreWorkspace(old);assert.equal(r.steps[0].behaviorOverrides.confirm,true);assert.equal(r.steps[0].behaviorOverrides.onError,true);
  const health=freshWorkspace();insertWorkflow(health,'health');assert.equal(health.groups.length,1);assert.equal(health.steps.filter(s=>s.groupId===health.groups[0].id).length,4);
  const p=JSON.parse(exportProject(fixture()));p.workspace.groups[0].behavior.force=true;assert.throws(()=>importProject(JSON.stringify(p)),/Unsupported group behavior/);
});
test('presets retain report paths and invalidate linked-scope acknowledgement when effective flags change',()=>{
  const w=fixture('services'),consumer=createStep('start-service');consumer.groupId='g';consumer.inputSourceId=w.steps[0].id;w.steps.push(consumer);acknowledgeScope(consumer,w.steps,w);assert.equal(scopeAcknowledged(consumer,w.steps,w),true);
  w.groups[0].behavior.verbose=true;assert.equal(scopeAcknowledged(consumer,w.steps,w),false);
  const report=createStep('report');report.groupId='g';report.onError='stop';w.steps.push(report);const path=report.values.path;w.groups[0].behavior.onError='continue';assert.equal(effectiveStep(report,w).onError,'stop');assert.equal(effectiveStep(report,w).values.path,path);
});
test('inherited failure handling records failed, successful and skipped attempts in both native runtimes and modes',{skip:process.platform!=='win32'},()=>{
  for(const shell of ['powershell.exe','pwsh'])for(const viewMode of ['guided','expert']){
    const w=freshWorkspace();w.version=shell==='pwsh'?'7':'5.1';w.viewMode=viewMode;w.executionSummary=true;w.groups=[{id:'g',name:'Diagnostic',behavior:{...behaviorPresets[0].settings}}];w.steps=['files','network','start-service'].map(createStep);w.steps.forEach(s=>s.groupId='g');w.steps[1].values.quiet=true;w.steps[2].values.service='Example';w.steps[2].condition={type:'connectivity',sourceId:w.steps[1].id};
    const mocks=`function Get-ChildItem { [CmdletBinding()]param($LiteralPath,[switch]$Force,[switch]$Recurse);throw 'Mock read failed' }\nfunction Test-Connection { [CmdletBinding()]param($ComputerName,$TargetName,$Count,[switch]$Quiet);$false }\nfunction Start-Service {throw 'Skipped command must not run'}\nfunction Get-Service {throw 'Skipped readback must not run'}\n`;
    const result=spawnSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(mocks+generateScript(w.steps,w),'utf16le').toString('base64')],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/1 succeeded; 1 failed; 1 skipped/);
  }
});
