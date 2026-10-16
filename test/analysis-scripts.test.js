import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {commands} from '../dist/js/commands.js';
import {analysisScripts,writeAnalysisScripts} from '../tools/generate-analysis-scripts.js';

test('analysis corpus covers every catalog template and supported target on disk',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'shellify-analysis-'));
  try{
    await writeAnalysisScripts(directory);
    const expected=commands.flatMap(command=>command.versions.map(version=>`${command.id}-ps${version}.ps1`));
    assert.deepEqual((await readdir(directory)).sort(),expected.sort());
    for(const {file,code} of analysisScripts()){
      assert.equal(await readFile(join(directory,file),'utf8'),code);
      assert.match(code,/\$ErrorActionPreference = 'Stop'/);
    }
    assert.match(await readFile(join(directory,'network-ps5.1.ps1'),'utf8'),/-ComputerName 'localhost'/);
    assert.match(await readFile(join(directory,'network-ps7.ps1'),'utf8'),/-TargetName 'localhost'/);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('new required inputs cannot silently disappear from analyzer coverage',()=>{
  commands.push({id:'analysis-invalid-fixture',parameters:[{name:'required',type:'text',required:true,default:''}],versions:['5.1','7']});
  try{
    assert.throws(()=>analysisScripts(),/analysis-invalid-fixture: invalid analysis inputs/);
  }finally{commands.pop();}
});
