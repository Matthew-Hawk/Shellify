import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStep,freshWorkspace} from '../dist/js/workspace.js';
import {generateScript} from '../dist/js/generator.js';
for(const viewMode of ['guided','expert'])for(const fleet of [false,true])test(`preview mapping preserves exact exported code (${viewMode}, fleet ${fleet})`,()=>{
  const steps=[createStep('disk'),createStep('services')];
  const options={...freshWorkspace(),steps,viewMode,targets:fleet?['server01']:[]};
  const exported=generateScript(steps,options),preview=generateScript(steps,{...options,previewMarkers:true});
  const stripped=preview.split('\n').filter(line=>!/^# SHELLIFY_(BEGIN|END) /.test(line.trim())).join('\n');
  assert.equal(stripped,exported);assert.ok(preview.includes('SHELLIFY_BEGIN '+steps[0].id));
  assert.ok(!exported.includes('SHELLIFY_BEGIN'));
});
