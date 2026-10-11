import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {commands,defaults} from '../dist/js/commands.js';
import {quote} from '../dist/js/validation.js';
import {generateScript} from '../dist/js/generator.js';
// Parse only: neither generated scripts nor test payloads are ever executed.
test('native PowerShell parser accepts templates and preserves hostile literals', {skip:process.platform!=='win32'},()=>{
  const literals=["O'Brien",'x’; Write-Host injected; #','x‘; Write-Host injected; #','x‚; Write-Host injected; #','x‛; Write-Host injected; #','$(whoami)`; "quoted"','C:\\folder\\[test]'];
  const scripts=commands.map(c=>generateScript([{actionId:c.id,values:defaults(c)}]));
  scripts.push(generateScript([{actionId:'restart',values:{...defaults(commands.find(c=>c.id==='restart')),computer:"remote’host",service:"Spooler'; whoami #"}}]));
  for(const action of commands.filter(c=>c.category==='Active Directory')){
    for(const literal of literals){
      const values=defaults(action);
      for(const p of action.parameters.filter(p=>p.type==='text'))values[p.name]=literal;
      scripts.push(generateScript([{actionId:action.id,values}]));
    }
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
