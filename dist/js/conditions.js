import {conditionSourceIndex} from './relationships.js';
import {quote} from './validation.js';
export function conditionErrors(step,index,steps){
  const c=step.condition;if(!c||c.type==='none')return [];
  if(c.type==='service-stopped')return step.actionId==='restart'?[]:['Only a service restart can use the stopped-service condition.'];
  if(c.type==='connectivity'){const sourceIndex=conditionSourceIndex(step,steps),source=steps[sourceIndex];if(!Number.isInteger(sourceIndex)||sourceIndex<0||sourceIndex>=index||!source||!['network','tcp-port'].includes(source.actionId)||source.bulk?.field)return ['Choose an earlier, single-target ping or TCP-port check.'];return [];}
  return ['Choose a supported condition.'];
}
export function conditionExpression(step,steps=[]){
  if(step.condition?.type==='connectivity')return `$script:ShellifyConnectivity${conditionSourceIndex(step,steps)+1}`;
  if(step.condition?.type==='service-stopped'){
    const check=`$ShellifyService = Get-Service | Where-Object { $_.Name -eq ${step.values.computer.trim()?'$ShellifyServiceName':quote(step.values.service)} }; if (-not $ShellifyService) { throw 'The selected service was not found.' }; $ShellifyService.Status -eq 'Stopped'`;
    return step.values.computer.trim()?`(Invoke-Command -ComputerName ${quote(step.values.computer)} -ArgumentList ${quote(step.values.service)} -ScriptBlock { param($ShellifyServiceName) ${check} } -ErrorAction Stop)`:`(& { ${check} })`;
  }
  return '';
}
export function captureConnectivity(code,action,step,index){
  const expr=action.id==='tcp-port'?'$_.TcpTestSucceeded -eq $true':step.values.quiet?'$_ -eq $true':`$_.${'StatusCode'} -eq 0 -or $_.Status -eq 'Success'`;
  return `$ShellifyCheck${index} = @(\n${code.split('\n').map(line=>'    '+line).join('\n')}\n)\n$script:ShellifyConnectivity${index} = @($ShellifyCheck${index} | Where-Object { ${expr} }).Count -gt 0\n$ShellifyCheck${index}`;
}
