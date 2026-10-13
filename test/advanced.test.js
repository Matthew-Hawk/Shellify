import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createStep,freshWorkspace,restoreWorkspace} from '../dist/js/workspace.js';
import {saveEntry,renameEntry,restoreEntry} from '../dist/js/library.js';
import {generateScript} from '../dist/js/generator.js';
import {importProject,exportProject,reviewWorkspace} from '../dist/js/projects.js';
import {quote,targetVariable} from '../dist/js/validation.js';
test('expert view omits explanatory text while preserving executable operations and literals',()=>{
  const step=createStep('files');step.values.path="C:\\#literal\\O'Brien";
  const options={title:'My title',description:'Description',viewMode:'expert'};
  const expert=generateScript([step],options);
  assert.doesNotMatch(expert,/^#/m);assert.doesNotMatch(expert,/My title|Description/);assert.match(expert,/-LiteralPath 'C:\\#literal\\O''Brien'/);
  assert.match(expert,/\| Select-Object/);assert.match(expert,/\$ErrorActionPreference = 'Stop'/);
  assert.match(generateScript([step]),/# 1\. List files/);
});
test('shared inputs resolve into literals and missing links prevent generation',()=>{
  const workspace=freshWorkspace();workspace.sharedInputs=[{id:'host',name:'Host',value:"host'; whoami #"}];workspace.steps=[createStep('network'),createStep('tcp-port')];
  workspace.steps.forEach(step=>step.bindings.host='host');
  const generated=generateScript(workspace.steps,workspace);assert.equal(generated.split("'host''; whoami #'").length-1,2);
  workspace.sharedInputs[0].value='changed';assert.equal(generateScript(workspace.steps,workspace).split("'changed'").length-1,2);
  workspace.sharedInputs=[];assert.throws(()=>generateScript(workspace.steps,workspace),/invalid parameters/);
  assert.ok(reviewWorkspace(workspace).errors.length>0);
});
test('bulk targets use bounded literal lists, label results, and marshal remote service values',()=>{
  const step=createStep('restart');step.values.computer='server01';step.values.whatIf=true;step.values.passThru=true;step.bulk={field:'service',targets:["Spooler'; whoami #",'W32Time']};step.onError='continue';
  const code=generateScript([step],{viewMode:'expert'});
  assert.match(code,/foreach \(\$ShellifyTarget1 in @\('Spooler''; whoami #', 'W32Time'\)\)/);
  assert.match(code,/-ArgumentList \$ShellifyTarget1 -ScriptBlock \{/);assert.match(code,/param\(\$ShellifyServiceName\)/);assert.match(code,/\.Name -eq \$ShellifyServiceName/);
  assert.match(code,/Name='Target';Expression=\{\$ShellifyTarget1\}/);assert.match(code,/catch \{/);assert.match(code,/Target=\$ShellifyTarget1; Error=/);
  assert.doesNotMatch(code,/^#/m);step.bulk.targets=Array(51).fill('host');assert.throws(()=>generateScript([step]),/invalid parameters/);
});
test('continuation catches the step and output failures while default behavior stops',()=>{
  const step=createStep('files');assert.doesNotMatch(generateScript([step]),/catch \{/);
  step.onError='continue';step.output={format:'csv',path:'files.csv'};
  const code=generateScript([step]);assert.match(code,/try \{[\s\S]*Export-Csv[\s\S]*\} catch \{/);assert.match(code,/Write-Warning/);assert.match(code,/Step=1; Error=/);
});
test('project and draft persistence preserve advanced settings and omit local library links',()=>{
  const workspace=freshWorkspace();Object.assign(workspace,{viewMode:'expert',sharedInputs:[{id:'host',name:'Host',value:'server01'}],libraryId:'local-entry'});
  workspace.steps=[createStep('network')];Object.assign(workspace.steps[0],{bindings:{host:'host'},onError:'continue'});
  const imported=importProject(exportProject(workspace));assert.equal(imported.viewMode,'expert');assert.equal(imported.libraryId,'');assert.deepEqual(imported.steps[0].bindings,{host:'host'});assert.equal(imported.steps[0].onError,'continue');
  assert.equal(restoreWorkspace(workspace).libraryId,'local-entry');
  const invalid=JSON.parse(exportProject(workspace));invalid.workspace.steps[0].bulk={field:'script',targets:['whoami']};assert.throws(()=>importProject(JSON.stringify(invalid)),/Invalid bulk/);
});
test('library updates preserve identity and previous contents; rename does not discard history',()=>{
  const original=freshWorkspace();let result=saveEntry([],null,'Health',original);const id=result.id;
  const edited=restoreWorkspace(original);edited.steps.push(createStep('processes'));
  result=saveEntry(result.items,id,'Health',edited);assert.equal(result.items.length,1);assert.equal(result.items[0].workspace.steps.length,2);assert.equal(result.items[0].previous.workspace.steps.length,1);
  let items=renameEntry(result.items,id,'Renamed');assert.equal(items[0].previous.workspace.steps.length,1);
  items=restoreEntry(items,id);assert.equal(items[0].name,'Health');assert.equal(items[0].workspace.steps.length,1);assert.equal(items[0].previous.workspace.steps.length,2);
  items=restoreEntry(items,id);assert.equal(items[0].name,'Renamed');assert.equal(items[0].workspace.steps.length,2);
  assert.throws(()=>saveEntry(items,'missing','Name',original),/no longer exists/);assert.throws(()=>renameEntry(items,id,''),/Enter a name/);
});
test('JSON objects cannot impersonate internal PowerShell variables',()=>{
  assert.equal(quote({name:'ShellifyTarget1'}),"'[object Object]'");assert.equal(quote(targetVariable('ShellifyTarget1')),'$ShellifyTarget1');assert.throws(()=>targetVariable('x; whoami'),/Invalid internal/);
});
test('bulk continuation runs later targets after a failure using a mock cmdlet', {skip:process.platform!=='win32'},()=>{
  const step=createStep('network');step.bulk={field:'host',targets:['first','fail','last']};step.onError='continue';
  const code=generateScript([step],{viewMode:'expert'});
  // A local mock replaces Test-Connection. No network requests or system actions occur.
  const script=`$WarningPreference = 'SilentlyContinue'
function Test-Connection {
  [CmdletBinding()]param([string]$ComputerName,[int]$Count)
  if ($ComputerName -eq 'fail') { throw 'Expected test failure' }
  [pscustomobject]@{Destination=$ComputerName;Status='OK'}
}
$results = @(& { ${code} })
ConvertTo-Json -InputObject $results -Depth 6 -Compress`;
  const result=spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',timeout:15000});
  assert.equal(result.status,0,result.stderr);
  const rows=JSON.parse(result.stdout.trim());assert.deepEqual(rows.map(row=>row.Target),['first','fail','last']);assert.equal(rows[1].Error,'Expected test failure');assert.equal(rows[2].Status,'OK');
});
