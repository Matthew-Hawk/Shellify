import {commands} from './commands.js';
import {quote} from './validation.js';
import {resolveStep} from './execution.js';
import {parameterizedValues} from './parameters.js';
export function runtimeErrors(options={}){
  const errors=[];
  for(const key of ['preflight','executionSummary'])if(options[key]!==undefined&&typeof options[key]!=='boolean')errors.push('Choose valid runtime options.');
  if(options.logging?.enabled){
    const path=options.logging.path;
    if(typeof path!=='string'||!path.trim()||path.length>500||/[\x00-\x1f\x7f]/.test(path))errors.push('Enter a single-line log path of up to 500 characters.');
    if(options.steps?.some(step=>step.output?.format!=='none'&&step.output?.path?.trim().toLowerCase().replaceAll('/','\\')===path?.trim().toLowerCase().replaceAll('/','\\')))errors.push('The log and result files must use separate destinations.');
  }
  return errors;
}
export function preflightCode(steps,options,modules){
  const checks=[];
  if(options.preflight){
    checks.push("if ([System.Environment]::OSVersion.Platform -ne 'Win32NT') { throw 'This script requires Windows.' }");
    checks.push(options.version==='7'?"if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'Run this script with PowerShell 7 or newer.' }":"if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -lt 1) { throw 'Run this script with Windows PowerShell 5.1.' }");
    for(const module of modules)checks.push(`if (-not (Get-Module -ListAvailable -Name ${quote(module)})) { throw ${quote(`Required module not installed: ${module}.`)} }`);
    const elevation=steps.some((step,index)=>{const v=parameterizedValues(resolveStep(step,options.sharedInputs),index,{...options,steps});return commands.find(c=>c.id===step.actionId)?.admin||step.actionId==='processes'&&v.includeUserName||step.actionId==='restart'&&!v.whatIf&&!v.computer.trim()&&step.bulk?.field!=='computer';});
    if(elevation)checks.push("if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run PowerShell as administrator for these local commands.' }");
  }
  const paths=[...(options.preflight?steps.filter(s=>s.output?.format&&s.output.format!=='none').map(s=>s.output.path):[]),...(options.logging?.enabled?[options.logging.path]:[])];
  for(const path of paths)checks.push(`$ShellifyDestination = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath(${quote(path)})\nif (-not (Test-Path -LiteralPath (Split-Path -Path $ShellifyDestination -Parent) -PathType Container)) { throw ${quote(`Destination folder does not exist: ${path}`)} }\nif (Test-Path -LiteralPath $ShellifyDestination) { throw ${quote(`Destination already exists: ${path}`)} }`);
  return checks.join('\n');
}
export const troubleshooting=action=>action.category==='Active Directory'?['Check that RSAT and the ActiveDirectory module are installed.','Verify the domain controller is reachable and AD Web Services is running.','Check directory read permissions and the identity or search-base DN.']:({
  network:['A failed ping can mean ICMP is blocked even when the host is available.','Check the hostname, DNS resolution, and firewall policy.'],
  'tcp-port':['Check the host and port, then whether a service is listening.','Firewall rules and network routing can prevent a connection.'],
  dns:['Verify the hostname and selected DNS server.','Try DNS-only resolution to avoid LLMNR and NetBIOS fallback.'],
  restart:['Use the service name, not its display name.','Local restarts usually require administrator access; remote restarts require remoting permissions.','Dependent services may prevent a restart; review -Force before enabling it.'],
  files:['Check the folder path and read permissions.','Hidden files require -Force; subfolders require -Recurse.'],
  'old-files':['Check the folder path, age cutoff, and recursive search setting.','An empty result can simply mean no files meet the cutoff.'],
  events:['Check the log name and date range. No matching events can raise an error.','Security logs require appropriate event-log access.','Remote event reads need firewall and Event Log access.'],
  'scheduled-tasks':['Check the task-name filter and ScheduledTasks module.','Protected task definitions may require administrator access.'],
  software:['Run 64-bit PowerShell to read the full machine registry view.','Portable applications and some Microsoft Store apps do not appear here.'],
  processes:['Enable administrator access when requesting process owners.','Processes can exit while their properties are being read.'],
  'tcp-connections':['Check the local port filter and NetTCPIP module.','Some endpoints or process details require elevated access.']
}[action.id]||['Check the selected PowerShell version and the command’s requirements.','Review permissions and any error message from the target machine.']);
