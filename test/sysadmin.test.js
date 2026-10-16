import {acknowledgeScope} from '../dist/js/composition.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {commands} from '../dist/js/commands.js';
import {createStep,freshWorkspace,insertWorkflow,stepImpact} from '../dist/js/workspace.js';
import {generateScript} from '../dist/js/generator.js';
import {reviewWorkspace,exportProject,importProject} from '../dist/js/projects.js';
import {quote} from '../dist/js/validation.js';
const values={'server-health':{targets:'',reportPath:'reports/health.html'},'connectivity-triage':{host:'example.com',port:'3389',dns1:'192.0.2.53',dns2:'192.0.2.54'},'locked-triage':{identity:'jdoe',server:'dc01'},'certificate-sweep':{targets:'server01, server02',days:'30',reportPath:'reports/certs.csv'}};
test('four first-wave workflows share inputs, retain groups and export in both languages',()=>{
  for(const [id,input] of Object.entries(values))for(const version of ['5.1','7']){const workspace=freshWorkspace();workspace.steps=[];workspace.version=version;insertWorkflow(workspace,id,input);assert.equal(workspace.groups.length,1);assert.deepEqual(reviewWorkspace(workspace).errors,[]);const code=generateScript(workspace.steps,workspace);assert.ok(code.length>100);const roundtrip=importProject(exportProject(workspace));assert.equal(roundtrip.groups[0].workflowId,id);assert.deepEqual(roundtrip.targets,workspace.targets);assert.equal(roundtrip.dryRun,workspace.dryRun);assert.equal(roundtrip.steps[0].groupId,workspace.groups[0].id);if(id==='locked-triage'){assert.match(code,/-WhatIf/);assert.match(code,/-Confirm:\$true/);assert.equal(stepImpact(workspace.steps[4],workspace),'preview');}if(id==='certificate-sweep'){assert.match(code,/Invoke-Command/);assert.match(code,/Test-Connection/);assert.match(code,/Export-Csv/);}}
});
test('composition validates type and order, preserves capture and blocks unpreviewable changes',()=>{
  const producer=createStep('auto-services'),consumer=createStep('start-service');consumer.inputStep=0;
  assert.throws(()=>generateScript([producer,consumer],{dryRun:true}),/acknowledge/);acknowledgeScope(consumer,[producer,consumer],{dryRun:true});
  assert.match(generateScript([producer,consumer],{dryRun:true}),/foreach \(\$ShellifySource in @\(\$script:ShellifyOutput1\)\)/);
  assert.match(generateScript([producer,consumer],{dryRun:true}),/Name -eq \$ShellifyTarget2.*Start-Service -WhatIf/);
  assert.throws(()=>generateScript([createStep('disk'),consumer]),/earlier services/);
  assert.throws(()=>generateScript([consumer,producer]),/earlier services/);
  assert.throws(()=>generateScript([createStep('restore-point')],{dryRun:true}),/cannot preview/);
  assert.throws(()=>generateScript([createStep('report'),createStep('disk')]),/final step/);
  assert.throws(()=>generateScript([createStep('network')],{targets:['host']}),/local inspection/);
  assert.throws(()=>importProject(exportProject({...freshWorkspace(),targets:['bad\nname']})),/single-line/);
});
const run=(shell,code)=>{const result=spawnSync(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stderr||result.stdout);return result.stdout;};
test('fleet, reports, event errors and typed service starts execute safely with mocks in both runtimes',{skip:process.platform!=='win32'},()=>{
  const folder=mkdtempSync(join(tmpdir(),'shellify-admin-'));
  for(const shell of ['powershell.exe','pwsh']){
    const expiry=createStep('certificates'),report=createStep('report');expiry.onError='continue';report.values.format='CSV';report.values.path=join(folder,shell+'.csv');
    const fleet=generateScript([expiry,report],{version:shell==='pwsh'?'7':'5.1',targets:['good','dead','broken','partial'],reachableOnly:true,executionSummary:true});
    const mocks=`function Import-Module {}\nfunction Test-Connection { param($ComputerName,$TargetName,$Count,[switch]$Quiet); ($ComputerName + $TargetName) -ne 'dead' }\nfunction Invoke-Command { param($ComputerName,[object[]]$ArgumentList,$ScriptBlock); if ($ComputerName -eq 'broken') { throw 'mock remote error' }; & $ScriptBlock @ArgumentList }\nfunction Get-ChildItem { [CmdletBinding()]param($LiteralPath); if($ShellifyTarget -eq 'partial') { throw 'mock step failure' }; [pscustomobject]@{Subject='Mock <script>';Thumbprint='abc';NotAfter=(Get-Date).AddDays(2)} }\n`;
    run(shell,mocks+fleet);const csv=readFileSync(report.values.path,'utf8');assert.match(csv,/good/);assert.match(csv,/broken/);assert.doesNotMatch(csv,/dead/);assert.match(csv,/Mock/);assert.match(csv,/partial/);assert.equal(csv.trim().split(/\r?\n/).length,4);
    assert.throws(()=>run(shell,mocks+fleet),'Existing report is never overwritten');
    const start=createStep('start-service');start.inputStep=0;
    const producer=createStep('auto-services'),serviceSteps=[producer,start];acknowledgeScope(start,serviceSteps,{dryRun:true,executionSummary:true});
    const serviceCode=generateScript(serviceSteps,{dryRun:true,executionSummary:true});
    const serviceMocks=`$script:Started=0\nfunction Get-CimInstance { [CmdletBinding()]param($ClassName,$Filter); if ($ClassName -eq 'Win32_OperatingSystem') { [pscustomobject]@{LastBootUpTime=(Get-Date).AddHours(-1)} } else { [pscustomobject]@{Name='MockService';State='Stopped';StartMode='Auto'} } }\nfunction Start-Service { [CmdletBinding(SupportsShouldProcess=$true,ConfirmImpact='High')]param([Parameter(ValueFromPipeline=$true)]$InputObject); process { if($PSCmdlet.ShouldProcess($InputObject.Name)){$script:Started++} } }\nfunction Get-Service {[pscustomobject]@{Name='MockService';Status='Stopped'} }\n`;
    const output=run(shell,serviceMocks+serviceCode+"\nif ($script:Started -ne 0) { throw 'Dry run changed a service' }\n'PASSED'");assert.match(output,/PASSED/);
    start.values.confirm=false;
    acknowledgeScope(start,serviceSteps,{executionSummary:true});const realStart=generateScript(serviceSteps,{executionSummary:true});
    run(shell,serviceMocks+realStart+"\nif ($script:Started -ne 1) { throw 'Producer output did not survive summary scope' }");
    const eventCode=generateScript([createStep('event-errors')]);
    run(shell,`function Get-WinEvent { [CmdletBinding()]param($FilterHashtable,$MaxEvents); $err=[Management.Automation.ErrorRecord]::new([Exception]::new('No events'),'NoMatchingEventsFound',[Management.Automation.ErrorCategory]::ObjectNotFound,$null); $PSCmdlet.ThrowTerminatingError($err) }\n`+eventCode);
    assert.throws(()=>run(shell,`function Get-WinEvent { [CmdletBinding()]param($FilterHashtable,$MaxEvents); throw 'Access denied' }\n`+eventCode));
  }
});
test('pending reboot and scheduled-task snippets preserve empty values and exclusion rules',{skip:process.platform!=='win32'},()=>{
  for(const shell of ['powershell.exe','pwsh']){
    const pending=generateScript([createStep('pending-reboot')]);
    const registryMocks="function Get-ItemProperty { [CmdletBinding()]param($LiteralPath); [pscustomobject]@{PendingFileRenameOperations=@('old','new')} }\nfunction Test-Path { param($LiteralPath); $false }\n";
    assert.match(run(shell,registryMocks+"$rows=@(& {\n"+pending+"\n}); if(-not $rows[0].RebootPending -or -not $rows[0].PendingFileRename) { throw 'Missing registry indicator' }; 'PASSED'"),/PASSED/);
    const tasks=generateScript([createStep('failing-tasks')]);
    const taskMocks="function Import-Module {}\nfunction Get-ScheduledTask { [CmdletBinding()]param(); foreach($value in @(0,0x41301,0x41303,5)){[pscustomobject]@{TaskName=[string]$value;TaskPath='\\';Result=$value}} }\nfunction Get-ScheduledTaskInfo { [CmdletBinding()]param([Parameter(ValueFromPipeline=$true)]$InputObject); process {[pscustomobject]@{LastTaskResult=$InputObject.Result}} }\n";
    run(shell,taskMocks+"$rows=@(& {\n"+tasks+"\n}); if($rows.Count -ne 1 -or $rows[0].LastTaskResult -ne 5){throw 'Task exclusion failed'}");
  }
});


