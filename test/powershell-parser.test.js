import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {spawnSync} from 'node:child_process';
import {commands,defaults as catalogDefaults} from '../dist/js/commands.js';
import {quote} from '../dist/js/validation.js';
import {generateScript} from '../dist/js/generator.js';
import {createStep} from '../dist/js/workspace.js';
import {settingsFor} from '../dist/js/results.js';
// Any JavaScript UTF-16 string is possible; bias toward PowerShell syntax as well.
const codeUnit=fc.integer({min:0,max:0xffff}).map(value=>String.fromCharCode(value));
const hostileString=fc.string({unit:fc.oneof(codeUnit,fc.constantFrom("'",'‘','’','‚','‛','`','$(','); Write-Host injected; #','\r','\n','\u0000','😀','漢字')),maxLength:160});
const literalEdges=['',"'",'‘’‚‛',"''''",'`','$(throw "injected")',"'; throw 'injected'; #",'line one\r\nline two\nline three\r','\u0000','\u001a','\u0085\u2028\u2029','😀漢字e\u0301','\ud800','\udfff',"'".repeat(1024)];

test('literal quoting preserves arbitrary UTF-16 code units and doubles every PowerShell apostrophe',()=>{
  fc.assert(fc.property(hostileString,value=>{
    const quoted=quote(value);
    assert.equal(quoted[0],"'");assert.equal(quoted.at(-1),"'");
    const body=quoted.slice(1,-1);
    let decoded='';
    for(let i=0;i<body.length;i++){
      const character=body[i];
      if("'‘’‚‛".includes(character))assert.equal(body[++i],character);
      decoded+=character;
    }
    assert.equal(decoded,value);
  }),{numRuns:5000,seed:0x5348454c,examples:literalEdges.map(value=>[value])});
});

for(const executable of ['powershell.exe','pwsh.exe']){
  test(`${executable}: arbitrary quoted strings parse as one inert single-quoted literal`,{skip:process.platform!=='win32'},()=>{
    // Negative controls prove the oracle detects quote breakout and interpolation.
    // These are parsed as data, never evaluated or invoked.
    const unsafe=parseNative(executable,["'x'; Write-Host injected; #'","'x’; Write-Host injected; #'",'"$(Write-Host injected)"']);
    unsafe.forEach(result=>{assert.ok(result.commandCount>0);assert.equal(result.singleQuoted,false);});
    // Batch inputs to avoid starting a PowerShell process for each generated string.
    // fast-check retains its shrinking and reports the seed/path on failure.
    fc.assert(fc.property(fc.array(hostileString,{minLength:64,maxLength:64}),values=>{
      const inputs=[...literalEdges,...values];
      const parsed=parseNative(executable,inputs.map(quote));
      inputs.forEach((value,index)=>{
        const result=parsed[index],context=`${executable}: ${JSON.stringify(value)}`;
        assert.deepEqual(result.errors,[],context);
        assert.equal(result.singleQuoted,true,context);
        assert.deepEqual(result.tokenKinds,['StringLiteral'],context);
        assert.equal(result.commandCount,0,context);
        assert.deepEqual(result.values,[value],context);
      });
    }),{numRuns:16,seed:0x5348454c});
  });
}
const defaults=c=>({...catalogDefaults(c),...(['restart','start-service'].includes(c.id)?{service:'Spooler'}:c.id==='ad-unlock'?{identity:'jdoe'}:c.id==='lockout-events'?{computer:'dc01'}:c.id==='file-hash'?{path:'C:\\Example\\file.txt'}:{})});
const parser=`[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
  [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
  function Encode-String([string]$value) {
    $chars = $value.ToCharArray()
    $bytes = New-Object byte[] ($chars.Length * 2)
    [Buffer]::BlockCopy($chars, 0, $bytes, 0, $bytes.Length)
    [Convert]::ToBase64String($bytes)
  }
  $data = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $results = foreach ($item in $data) {
    $tokens = $null; $parseErrors = $null
    $bytes = [Convert]::FromBase64String($item.code)
    $chars = New-Object char[] ($bytes.Length / 2)
    [Buffer]::BlockCopy($bytes, 0, $chars, 0, $bytes.Length)
    $code = [string]::new($chars)
    $ast = [System.Management.Automation.Language.Parser]::ParseInput($code, [ref]$tokens, [ref]$parseErrors)
    $literal = $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.StringConstantExpressionAst]}, $true)
    $cmds = $ast.FindAll({param($node) $node -is [System.Management.Automation.Language.CommandAst]}, $true)
    $expression = $null
    if ($ast.EndBlock.Statements.Count -eq 1 -and $ast.EndBlock.Statements[0] -is [System.Management.Automation.Language.PipelineAst] -and $ast.EndBlock.Statements[0].PipelineElements.Count -eq 1 -and $ast.EndBlock.Statements[0].PipelineElements[0] -is [System.Management.Automation.Language.CommandExpressionAst]) {
      $expression = $ast.EndBlock.Statements[0].PipelineElements[0].Expression
    }
    [pscustomobject]@{
      errors = @($parseErrors | ForEach-Object Message)
      commandCount = $cmds.Count
      values = @($literal | ForEach-Object { Encode-String $_.Value })
      singleQuoted = ($expression -is [System.Management.Automation.Language.StringConstantExpressionAst] -and $expression.StringConstantType -eq 'SingleQuoted')
      tokenKinds = @($tokens | Where-Object Kind -ne EndOfInput | ForEach-Object { [string]$_.Kind })
    }
  }
  ConvertTo-Json -InputObject @($results) -Depth 6 -Compress`;

function parseNative(executable,codes){
  // Transport UTF-16 code units losslessly, including unpaired surrogates. Only the parser runs.
  const data=codes.map(code=>({code:Buffer.from(code,'utf16le').toString('base64')}));
  const result=spawnSync(executable,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(parser,'utf16le').toString('base64')],{input:JSON.stringify(data),encoding:'utf8',timeout:20000,maxBuffer:8*1024*1024});
  assert.equal(result.status,0,result.error?.message||result.stderr);
  const parsed=JSON.parse(result.stdout.trim());
  assert.equal(parsed.length,codes.length);
  return parsed.map(row=>({...row,values:row.values.map(value=>Buffer.from(value,'base64').toString('utf16le'))}));
}

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
  const codes=[...scripts,...literals.map(quote)];
  for(const executable of ['powershell.exe','pwsh.exe']){
    const parsed=parseNative(executable,codes);
    parsed.forEach(r=>assert.deepEqual(r.errors,[]));
    literals.forEach((value,i)=>{const r=parsed[scripts.length+i];assert.equal(r.commandCount,0);assert.deepEqual(r.values,[value]);});
  }
});
