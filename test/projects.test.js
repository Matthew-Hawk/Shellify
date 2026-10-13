import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {commands,defaults} from '../dist/js/commands.js';
import {freshWorkspace,createStep} from '../dist/js/workspace.js';
import {MAX_PROJECT_BYTES,exportProject,importProject,projectFilename,outputErrors,readDiscovery,saveDiscovery,markRecent,reviewWorkspace} from '../dist/js/projects.js';
import {generateScript} from '../dist/js/generator.js';
import {match} from '../dist/js/matcher.js';
const action=id=>commands.find(c=>c.id===id);
test('documented example imports and unsupported fixture is rejected',()=>{
  const sample=importProject(readFileSync(new URL('../docs/examples/network-review.shellify.json',import.meta.url),'utf8'));
  assert.equal(sample.title,'Network review');assert.equal(sample.steps.length,2);
  assert.match(generateScript(sample.steps,sample),/Out-File/);
  assert.throws(()=>importProject(readFileSync(new URL('./fixtures/invalid-project.json',import.meta.url),'utf8')),/Unsupported/);
});
test('editable projects round trip settings, flags, output and collapse with fresh IDs',()=>{
  const workspace=freshWorkspace();workspace.steps=[createStep('dns')];
  Object.assign(workspace,{title:'Network review',description:'Notes',version:'7',filename:'review.ps1'});
  workspace.steps[0].collapsed=true;workspace.steps[0].values.dnsOnly=true;workspace.steps[0].output={format:'json',path:"C:\\Reports\\O'Brien.json"};
  const json=exportProject(workspace),restored=importProject('\ufeff'+json);
  assert.equal(restored.title,workspace.title);assert.equal(restored.version,'7');assert.equal(restored.steps[0].values.dnsOnly,true);
  assert.deepEqual(restored.steps[0].output,workspace.steps[0].output);assert.equal(restored.steps[0].collapsed,true);
  assert.notEqual(restored.steps[0].id,workspace.steps[0].id);assert.doesNotMatch(json,new RegExp(workspace.steps[0].id));
  assert.equal(generateScript(restored.steps,restored),generateScript(workspace.steps,workspace));assert.equal(projectFilename(workspace),'review.shellify.json');
});
test('import rejects invalid and unsupported projects without altering the draft',()=>{
  const original=freshWorkspace(),baseline=JSON.stringify(original);
  for(const modify of [p=>p.format='powershell',p=>p.schemaVersion=999,p=>p.workspace.version='8',p=>p.workspace.steps[0].actionId='Remove-Item',p=>p.workspace.steps[0].values.verbose='-Force',p=>p.workspace.steps[0].values.script='whoami',p=>p.workspace.steps[0].output={format:'raw',path:''},p=>p.workspace.steps=Array(201).fill(p.workspace.steps[0])]){
    const p=JSON.parse(exportProject(original));modify(p);assert.throws(()=>importProject(JSON.stringify(p)));
  }
  for(const text of ['not json','null','[]',' '.repeat(MAX_PROJECT_BYTES+1)])assert.throws(()=>importProject(text));
  assert.equal(JSON.stringify(original),baseline);
  const unfinished=freshWorkspace();unfinished.steps=[createStep('files')];unfinished.steps[0].values.path='';
  assert.equal(importProject(exportProject(unfinished)).steps[0].values.path,'');
});
test('CSV/JSON wrap the entire result pipeline, quote paths, and prevent overwrites',()=>{
  for(const version of ['5.1','7'])for(const format of ['csv','json']){
    const step=createStep('files');step.output={format,path:"C:\\O'Brien\\$(whoami)."+format};
    const code=generateScript([step],{version});assert.match(code,/-NoClobber -ErrorAction Stop/);
    assert.ok(code.includes("-LiteralPath 'C:\\O''Brien\\$(whoami)."+format+"'"));
    assert.match(code,/# RESULTS: Writes a new result file/);
    if(format==='csv')assert.match(code,/@\([\s\S]*Select-Object Name, FullName, Length, LastWriteTime[\s\S]*\) \|\n    Export-Csv/);
    else assert.match(code,/ConvertTo-Json -InputObject @\([\s\S]*\) -Depth 6 \|\n    Out-File/);
  }
  const plain=createStep('files');assert.doesNotMatch(generateScript([plain]),/Export-Csv|ConvertTo-Json|Out-File/);
  const quiet=createStep('network');quiet.values.quiet=true;quiet.output={format:'csv',path:'ping.csv'};
  assert.match(generateScript([quiet]),/Name='Reachable'/);
});
test('output validation and review catch invalid paths and duplicate destinations',()=>{
  const step=createStep('disk');
  for(const path of ['', '  ', 'a\nb','a\u0000b','x'.repeat(501)])assert.ok(outputErrors(action('disk'),{format:'csv',path}).path);
  assert.ok(outputErrors(action('restart'),{format:'csv',path:'x.csv'}).format);
  assert.ok(outputErrors(action('disk'),{format:'script',path:'x'}).format);
  step.output={format:'csv',path:'C:\\Report.csv'};const other=createStep('disk');other.output={format:'csv',path:'c:/report.csv'};
  const workspace={...freshWorkspace(),steps:[step,other]};assert.match(reviewWorkspace(workspace).errors.join(' '),/multiple steps write/);
  assert.throws(()=>generateScript(workspace.steps),/multiple steps write/);
});
test('favorites and recents whitelist commands, survive storage and cap recent history',()=>{
  let value='';const storage={getItem:()=>value,setItem:(_,text)=>value=text};
  saveDiscovery(storage,{favorites:['files','unknown','files'],recent:['dns','dns','unknown']});
  let discovery=readDiscovery(storage);assert.deepEqual(discovery,{favorites:['files'],recent:['dns']});
  for(const c of commands)discovery=markRecent(discovery,c.id);assert.equal(discovery.recent.length,8);
  discovery=markRecent(discovery,'files');assert.equal(discovery.recent[0],'files');assert.equal(discovery.favorites[0],'files');
  value='bad json';assert.deepEqual(readDiscovery(storage),{favorites:[],recent:[]});
  assert.equal(saveDiscovery({setItem(){throw Error();}},discovery),false);
});
test('flag and cmdlet search works without accepting unsupported intent',()=>{
  assert.ok(match(commands,'-Force').some(c=>c.id==='files'));assert.equal(match(commands,'files -Force')[0].id,'files');
  assert.equal(match(commands,'-DnsOnly')[0].id,'dns');assert.equal(match(commands,'Get-WinEvent')[0].id,'events');
  assert.equal(match(commands,'delete files -Force').length,0);
  for(const [query,id] of [['installed software','software'],['scheduled tasks','scheduled-tasks'],['DNS lookup','dns'],['TCP port','tcp-port'],['event logs','events']])assert.equal(match(commands,query)[0].id,id);
});
test('review collects modules, permission notes, targets, modifications and files',()=>{
  const ad=createStep('ad-user'),dns=createStep('dns'),restart=createStep('restart'),preview=createStep('restart');
  ad.values.server='dc01';dns.output={format:'json',path:'dns.json'};restart.values.computer='server01';preview.values.whatIf=true;
  const review=reviewWorkspace({...freshWorkspace(),steps:[ad,dns,restart,preview]});
  assert.deepEqual(review.modules,['ActiveDirectory','DnsClient']);assert.ok(review.targets.includes('Computer: server01'));
  assert.equal(review.files[0].path,'dns.json');assert.equal(review.modifying.length,1);assert.equal(review.previews.length,1);
  assert.equal(review.permissions.length,4);assert.match(review.permissions[2].requirements,/administrator/);assert.deepEqual(review.errors,[]);
});
test('new catalog commands constrain queries and quote user values',()=>{
  const hostile="x'; Write-Host injected; #";
  const events=action('events').generate({...defaults(action('events')),log:hostile,computer:hostile,limit:12});
  assert.match(events,/-MaxEvents 12/);assert.ok(events.includes("LogName='x''; Write-Host injected; #'"));
  const tasks=action('scheduled-tasks').generate({...defaults(action('scheduled-tasks')),taskName:hostile,limit:25});
  assert.match(tasks,/Select-Object -First 25/);assert.ok(tasks.includes("-TaskName 'x''; Write-Host injected; #'"));
  const software=action('software').generate({...defaults(action('software')),name:hostile});assert.doesNotMatch(software,/Win32_Product/);assert.match(software,/WOW6432Node/);assert.ok(software.includes("IndexOf('x''; Write-Host injected; #'"));
});
