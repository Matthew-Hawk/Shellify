import test from 'node:test';
import assert from 'node:assert/strict';
import {scriptScope} from '../dist/js/script-context.js';
import {createStep,freshWorkspace} from '../dist/js/workspace.js';

test('context distinguishes local, remote, directory and network scope from resolved inputs',()=>{
  const w=freshWorkspace();assert.equal(scriptScope(w),'Local');
  const restart=createStep('restart');restart.values.service='Spooler';restart.bindings.computer='target';
  w.steps.push(restart);w.sharedInputs=[{id:'target',name:'Computer',value:'server01'}];
  assert.equal(scriptScope(w),'Local · Remote: server01');
  w.sharedInputs[0].value='server02';assert.match(scriptScope(w),/Remote: server02/);
  restart.bulk={field:'computer',targets:['one','two']};delete restart.bindings.computer;
  assert.match(scriptScope(w),/Remote: 2 bulk targets/);
  w.steps=[createStep('ad-user')];assert.equal(scriptScope(w),'Directory: current domain');
  w.steps=[createStep('lockout-events')];w.steps[0].values.computer='dc01';assert.equal(scriptScope(w),'Remote: dc01');
  w.steps=[createStep('network')];assert.match(scriptScope(w),/Local · Network: localhost/);
  w.steps=[];assert.equal(scriptScope(w),'No targets yet');
});

test('context does not mistake parameter defaults or fleet execution for local scope',()=>{
  const w=freshWorkspace();w.targets=['one','two'];assert.equal(scriptScope(w),'Remote: 2 fleet targets');
  w.steps.push(createStep('report'));assert.equal(scriptScope(w),'Remote: 2 fleet targets · Local');
  w.targets=[];w.steps=[createStep('restart')];w.exportMode='parameters';
  w.steps[0].parameterFields.computer={enabled:true,name:'Computer',required:true};
  assert.equal(scriptScope(w),'Remote: runtime parameter Computer');
  w.steps[0].bindings.computer='shared';delete w.steps[0].parameterFields.computer;
  w.sharedInputs=[{id:'shared',value:'server01',parameter:{enabled:true,name:'Target',required:false}}];
  assert.equal(scriptScope(w),'Remote: runtime parameter Target');
});
