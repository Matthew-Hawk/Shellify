import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {commands,defaults as catalogDefaults} from '../dist/js/commands.js';
import {quote} from '../dist/js/validation.js';
import {generateScript} from '../dist/js/generator.js';
import {createStep} from '../dist/js/workspace.js';
import {settingsFor} from '../dist/js/results.js';
const defaults=c=>({...catalogDefaults(c),...(['restart','start-service'].includes(c.id)?{service:'Spooler'}:c.id==='ad-unlock'?{identity:'jdoe'}:c.id==='lockout-events'?{computer:'dc01'}:c.id==='file-hash'?{path:'C:\\Example\\file.txt'}:{})});
// Parse only: neither generated scripts nor test payloads are ever executed.
test('native PowerShell parser accepts templates and preserves hostile literals', {skip:process.platform!=='win32'},()=>{
  const literals=["O'Brien",'x’; Write-Host injected; #','x‘; Write-Host injected; #','x‚; Write-Host injected; #','x‛; Write-Host injected; #','$(whoami)`; "quoted"','C:\\folder\\[test]'];
  const scripts=commands.map(c=>generateScript([{actionId:c.id,values:defaults(c)}]));
  for(const viewMode of ['guided','expert'])for(const version of ['5.1','7'])scripts.push(generateScript(commands.map(c=>({actionId:c.id,values:defaults(c)})),{viewMode,version,preflight:true,executionSummary:true,logging:{enabled:true,path:"logs/O'Brien.log"}}));
  for(const id of ['network','restart','tcp-port'])for(const viewMode of ['guided','expert'])for(const onError of ['stop','continue']){
    const c=commands.find(c=>c.id===id),values=defaults(c);if(id==='restart'){values.computer='server01';values.passThru=true;values.whatIf=true;}
    scripts.push(generateScript([{actionId:id,values,onError,bulk:{field:id==='restart'?'service':'host',targets:["target'; whoami #",'second']},output:{format:id==='restart'?'none':'json',path:'results.json'}}],{viewMode}));
  }
  scripts.push(generateScript(commands.map(c=>({actionId:c.id,values:defaults(c)})),{version:'7',title:'Title\nWrite-Host injected',description:'Notes\rSecond line\u2028Text'}));
  for(const action of commands.filter(c=>c.risk==='read'))for(const format of ['csv','json']){
    scripts.push(generateScript([{actionId:action.id,values:defaults(action),output:{format,path:`C:\\Reports\\O'Brien\\$(whoami).${format}`}}],{version:'7'}));
  }
  for(const c of commands){
    const values=defaults(c);
    for(const p of c.parameters.filter(p=>p.type==='boolean'))values[p.name]=true;
    scripts.push(generateScript([{actionId:c.id,values}]));
    if(c.id==='restart')scripts.push(generateScript([{actionId:c.id,values:{...values,computer:'server01'}}]));
  }
  scripts.push(generateScript([{actionId:'restart',values:{...defaults(commands.find(c=>c.id==='restart')),computer:"remote’host",service:"Spooler'; whoami #"}}]));
  for(const action of commands.filter(c=>c.category==='Active Directory')){
    for(const literal of literals){
      const values=defaults(action);
      for(const p of action.parameters.filter(p=>p.type==='text'))values[p.name]=literal;
      scripts.push(generateScript([{actionId:action.id,values}]));
    }
  }
  for(const version of ['5.1','7'])for(const viewMode of ['guided','expert']){
    const ping=createStep('network'),files=createStep('files'),restart=createStep('restart');
    ping.values.quiet=true;restart.values.service='Spooler';restart.values.computer="server'O'Brien";restart.condition={type:'service-stopped',sourceStep:-1};
    files.condition={type:'connectivity',sourceStep:0};files.parameterFields.path={enabled:true,name:'Folder',required:true};
    files.results={...settingsFor(commands.find(c=>c.id==='files'),files),fields:['Name','Length'],filters:[{field:'Length',operator:'gt',value:'10'}],sort:'Length',descending:true,limit:10};files.output={format:'csv',path:"C:\\Reports\\O'Brien.csv"};
    scripts.push(generateScript([ping,files,restart],{version,viewMode,exportMode:'parameters',executionSummary:true,preflight:true,sharedInputs:[{id:'host',name:'Destination',value:"O'Brien",parameter:{enabled:true,name:'Destination',required:false}}]}));
    restart.bulk={field:'service',targets:['Spooler','W32Time']};restart.onError='continue';scripts.push(generateScript([restart],{version,viewMode,executionSummary:true}));
  }
  const parser=`[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
  [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
  $data = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $results = foreach ($item in $data) {
    $tokens = $null; $parseErrors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseInput($item.code, [ref]$tokens, [ref]$parseErrors)
    $literal = $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.StringConstantExpressionAst]}, $true)
    $cmds = $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.CommandAst]}, $true)
    [pscustomobject]@{ errors = @($parseErrors | ForEach-Object Message); commandCount = $cmds.Count; values = @($literal | ForEach-Object Value) }
  }
  ConvertTo-Json -InputObject @($results) -Depth 6 -Compress`;
  const data=[...scripts.map(code=>({code})),...literals.map(value=>({code:quote(value)}))];
  for(const executable of ['powershell.exe','pwsh.exe']){
    const result=spawnSync(executable,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(parser,'utf16le').toString('base64')],{input:JSON.stringify(data),encoding:'utf8',timeout:20000});
    assert.equal(result.status,0,result.stderr);
    const parsed=JSON.parse(result.stdout.trim());
    parsed.forEach(r=>assert.deepEqual(r.errors,[]));
    literals.forEach((value,i)=>{const r=parsed[scripts.length+i];assert.equal(r.commandCount,0);assert.deepEqual(r.values,[value]);});
  }
});
