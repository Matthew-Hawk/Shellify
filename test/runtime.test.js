import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createStep,freshWorkspace,restoreWorkspace} from '../dist/js/workspace.js';
import {commands} from '../dist/js/commands.js';
import {generateScript} from '../dist/js/generator.js';
import {exportProject,importProject,reviewWorkspace} from '../dist/js/projects.js';
import {runtimeErrors,troubleshooting} from '../dist/js/runtime.js';
test('runtime options persist and invalid or colliding logs prevent export',()=>{
  const workspace=freshWorkspace();Object.assign(workspace,{preflight:true,executionSummary:true,logging:{enabled:true,path:"reports/O'Brien.log"}});
  const imported=importProject(exportProject(workspace));assert.equal(imported.preflight,true);assert.equal(imported.executionSummary,true);assert.deepEqual(imported.logging,workspace.logging);
  assert.deepEqual(restoreWorkspace(workspace).logging,workspace.logging);
  workspace.logging.path='';assert.ok(reviewWorkspace(workspace).errors.length);assert.throws(()=>generateScript(workspace.steps,workspace),/log path/);
  workspace.logging.path='REPORTS/results.csv';workspace.steps[0].output={format:'csv',path:'reports/results.csv'};assert.match(runtimeErrors(workspace).join(' '),/separate destinations/);
});
test('preflight guards version, modules, definite local elevation and destination folders',()=>{
  const step=createStep('ad-user');step.output={format:'json',path:"C:\\Reports\\O'Brien.json"};
  const code=generateScript([step],{preflight:true,version:'7',viewMode:'expert'});
  assert.match(code,/PSVersionTable.PSVersion.Major -lt 7/);assert.match(code,/Get-Module -ListAvailable -Name 'ActiveDirectory'/);
  assert.match(code,/GetUnresolvedProviderPathFromPSPath\('C:\\Reports\\O''Brien.json'\)/);assert.match(code,/-PathType Container/);assert.match(code,/Destination already exists/);assert.doesNotMatch(code,/^#/m);
  const restart=createStep('restart');restart.values.service='Spooler';assert.match(generateScript([restart],{preflight:true}),/WindowsBuiltInRole\]::Administrator/);
  restart.values.computer='server01';assert.doesNotMatch(generateScript([restart],{preflight:true}),/WindowsBuiltInRole\]::Administrator/);
});
test('logging uses literal paths, prevents overwrites and stops in finally',()=>{
  const code=generateScript([createStep('network')],{executionSummary:true,logging:{enabled:true,path:"logs/O'Brien.log"}});
  assert.match(code,/Start-Transcript -LiteralPath 'logs\/O''Brien.log' -NoClobber/);
  assert.match(code, /finally \{[\s\S]*Execution summary:[\s\S]*Stop-Transcript/);
  assert.doesNotMatch(generateScript([createStep('network')]),/Start-Transcript|ShellifyRunSummary/);
});
test('every command has troubleshooting guidance',()=>{for(const action of commands){assert.ok(troubleshooting(action).length>=2);assert.ok(troubleshooting(action).every(tip=>typeof tip==='string'));}});
test('summary counts mock target successes and failures without mixing rows into results',{skip:process.platform!=='win32'},()=>{
  const step=createStep('network');step.bulk={field:'host',targets:['first','fail','last']};step.onError='continue';
  const code=generateScript([step],{executionSummary:true,viewMode:'expert'});
  const mock=`$WarningPreference='SilentlyContinue'
function Test-Connection { [CmdletBinding()]param([string]$ComputerName,[int]$Count)
if ($ComputerName -eq 'fail') { throw 'Mock failure' }; [pscustomobject]@{Destination=$ComputerName} }
$rows=@(. { ${code} } 6>$null)
ConvertTo-Json -InputObject @{Rows=$rows; Summary=@($ShellifyRunSummary)} -Depth 6 -Compress`;
  const result=spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(mock,'utf16le').toString('base64')],{encoding:'utf8',timeout:15000});
  assert.equal(result.status,0,result.stderr);const data=JSON.parse(result.stdout.trim());
  assert.equal(data.Rows.length,3);assert.deepEqual(data.Summary.map(row=>row.Status),['Succeeded','Failed','Succeeded']);assert.equal(data.Summary[1].Target,'fail');
});
test('summary and transcript cleanup run when a stopping step throws',{skip:process.platform!=='win32'},()=>{
  const code=generateScript([createStep('network')],{executionSummary:true,logging:{enabled:true,path:'mock.log'},viewMode:'expert'});
  const mock=`function Test-Path { param($LiteralPath,$PathType) return [bool]$PathType }
function Start-Transcript { param($LiteralPath,[switch]$NoClobber,$ErrorAction) $script:started=$true }
function Stop-Transcript { param($ErrorAction) $script:stopped=$true }
function Test-Connection { [CmdletBinding()]param($ComputerName,$Count) throw 'Expected failure' }
try { . { ${code} } 6>$null } catch { $caught=$true }
ConvertTo-Json -InputObject @{Started=$started;Stopped=$stopped;Caught=$caught;Summary=@($ShellifyRunSummary)} -Depth 6 -Compress`;
  const result=spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(mock,'utf16le').toString('base64')],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stderr);
  const data=JSON.parse(result.stdout.trim());assert.equal(data.Started,true);assert.equal(data.Stopped,true);assert.equal(data.Caught,true);assert.equal(data.Summary[0].Status,'Failed');
});
