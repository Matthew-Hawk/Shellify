import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,readFile,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {commands} from '../dist/js/commands.js';

test('command docs cover the catalog and reject missing or stale output without rewriting it',async()=>{
  const root=await mkdtemp(join(tmpdir(),'shellify-command-docs-'));
  try{
    await Promise.all(['tools','dist/js','docs'].map(path=>mkdir(join(root,path),{recursive:true})));
    await writeFile(join(root,'package.json'),'{"type":"module"}');
    await copyFile(new URL('../tools/generate-command-docs.js',import.meta.url),join(root,'tools/generate-command-docs.js'));
    const catalog=commands.map(({name,category,cmdlets,description})=>({name,category,cmdlets,description}));
    const source=join(root,'dist/js/commands.js'),target=join(root,'docs/commands.md');
    const saveCatalog=()=>writeFile(source,'export const commands='+JSON.stringify(catalog)+';');
    const run=(...args)=>spawnSync(process.execPath,['tools/generate-command-docs.js',...args],{cwd:root,encoding:'utf8'});
    await saveCatalog();
    const missing=run('--check');
    assert.equal(missing.status,1);assert.match(missing.stderr,/npm run docs:generate/);
    await assert.rejects(access(target),{code:'ENOENT'});
    assert.equal(run().status,0);
    const generated=await readFile(target,'utf8');
    assert.equal(generated.split('\n').filter(line=>line.startsWith('| ')).length,commands.length+2);
    for(const command of commands)assert.ok(generated.includes(command.name));
    assert.equal(run('--check').status,0);
    catalog[0].description+=' Updated catalog description.';
    await saveCatalog();
    assert.equal(run('--check').status,1);
    assert.equal(await readFile(target,'utf8'),generated);
    catalog.push({name:'Example | <command>',category:'Example',cmdlets:'Get-Example · Select-Object',description:'First line\nsecond line'});
    await saveCatalog();
    assert.equal(run().status,0);
    const updated=await readFile(target,'utf8');
    assert.ok(updated.includes(`All ${commands.length+1} commands`));
    assert.ok(updated.includes('Example \\| &lt;command&gt;'));
    assert.ok(updated.includes('`Get-Example`, `Select-Object`'));
    assert.ok(updated.includes('First line second line'));
    await writeFile(target,updated.replaceAll('\n','\r\n'));
    assert.equal(run('--check').status,0);
    await writeFile(target,updated+'Manual edit\n');
    assert.equal(run('--check').status,1);
  }finally{await rm(root,{recursive:true,force:true});}
});
