import test from 'node:test';
import assert from 'node:assert/strict';
import {commands,defaults} from '../dist/js/commands.js';
import {quote,validate} from '../dist/js/validation.js';
import {generateScript} from '../dist/js/generator.js';
import {match} from '../dist/js/matcher.js';
const action=id=>commands.find(c=>c.id===id);
test('every template generates with its defaults',()=>{for(const c of commands){assert.deepEqual(validate(c,defaults(c)),{});assert.match(generateScript([{actionId:c.id,values:defaults(c)}]),new RegExp(c.cmdlets.split(' · ')[0]));}});
test('quotes apostrophes and preserves executable-looking text as literals',()=>{assert.equal(quote("O'Brien"),"'O''Brien'");assert.equal(quote("$(Remove-Item C:\\)'; Write-Host x"),"'$(Remove-Item C:\\)''; Write-Host x'");const script=generateScript([{actionId:'files',values:{path:"C:\\O'Brien\\$(whoami)",recurse:false}}]);assert.ok(script.includes("-LiteralPath 'C:\\O''Brien\\$(whoami)'"));});
test('required, control characters, integer bounds and types are validated',()=>{const c=action('old-files');for(const days of ['',0,-1,1.1,'1; whoami','1e2',36501,Infinity])assert.ok(validate(c,{...defaults(c),days}).days);for(const path of ['','  ','a\nb','a\u0000b','x'.repeat(501)])assert.ok(validate(c,{...defaults(c),path}).path);assert.ok(validate(c,{...defaults(c),recurse:'true'}).recurse);assert.deepEqual(validate(c,{...defaults(c),days:36500}),{});});
test('generation rejects invalid and unknown actions',()=>{assert.throws(()=>generateScript([{actionId:'network',values:{host:'',count:4}}]),/invalid/);assert.throws(()=>generateScript([{actionId:'arbitrary',values:{}}]),/Unsupported/);});
test('order is preserved, repeated steps have no conflicting variables',()=>{const script=generateScript(['network','disk','network'].map(id=>({actionId:id,values:defaults(action(id))})));assert.ok(script.indexOf('# 1. Test')<script.indexOf('# 2. Check'));assert.ok(script.includes('# 3. Test'));assert.equal((script.match(/\$ErrorActionPreference =/g)||[]).length,1);});
test('modifying actions default to confirmation and use exact service comparison',()=>{const c=action('restart');const script=generateScript([{actionId:c.id,values:defaults(c)}]);assert.match(script,/-Confirm:\$true/);assert.match(script,/\.Name -eq 'Spooler'/);assert.match(script,/CAUTION/);const remote=c.generate({...defaults(c),computer:"server'one",confirm:false});assert.ok(remote.includes("-ComputerName 'server''one'"));assert.match(remote,/-Confirm:\$false/);});
test('search matches supported language and rejects unsupported or ambiguous intent',()=>{for(const [query,id] of [['restart a service','restart'],['List files older than 30 days','old-files'],['Get computer information','computer'],['Check disk space','disk'],['ping','network']])assert.equal(match(commands,query)[0]?.id,id);for(const query of ['delete old files','stop service','install software','banana'])assert.equal(match(commands,query).length,0);assert.ok(match(commands,'service').length>1);assert.equal(match(commands,'').length,commands.length);});
test('empty script is a readable placeholder',()=>assert.match(generateScript([]),/Add an action/));


test('AD actions import their module once and do not change directory state',()=>{
  const ad=commands.filter(c=>c.category==='Active Directory');
  assert.equal(ad.length,6);
  const script=generateScript(ad.map(c=>({actionId:c.id,values:defaults(c)})));
  assert.equal((script.match(/Import-Module ActiveDirectory/g)||[]).length,1);
  assert.doesNotMatch(script,/\b(?:Set|Remove|Disable|Unlock|New|Add)-AD/);
  assert.ok(ad.every(c=>c.risk==='read'));
  assert.ok(script.indexOf('Import-Module')<script.indexOf('Get-ADUser'));
  assert.doesNotMatch(generateScript([{actionId:'disk',values:{}}]),/Import-Module/);
});

test('AD queries constrain results and keep identities and scope as literals',()=>{
  const hostile="x'; Write-Host injected; #";
  const user=action('ad-user');
  assert.ok(user.generate({...defaults(user),identity:hostile,server:hostile}).includes("-Identity 'x''; Write-Host injected; #'"));
  const computers=action('ad-computers');
  const code=computers.generate({...defaults(computers),searchBase:hostile,limit:25});
  assert.ok(code.includes("-SearchBase 'x''; Write-Host injected; #'"));
  assert.match(code,/-Filter '\*'/);assert.match(code,/-ResultSetSize 25/);
  assert.doesNotMatch(computers.generate(defaults(computers)),/-SearchBase|-Server/);
  const members=action('ad-members');
  assert.doesNotMatch(members.generate(defaults(members)),/-Recursive/);
  assert.match(members.generate({...defaults(members),recursive:true}),/-Recursive/);
  const inactive=action('ad-inactive');
  assert.match(inactive.generate({...defaults(inactive),days:45}),/-DateTime \(Get-Date\).AddDays\(-45\)/);
  for(const limit of [0,5001,'100; whoami'])assert.ok(validate(computers,{...defaults(computers),limit}).limit);
  for(const [query,id] of [['Find inactive Active Directory users','ad-inactive'],['locked accounts','ad-locked'],['group membership','ad-members'],['domain computers','ad-computers']])assert.equal(match(commands,query)[0]?.id,id);
});
