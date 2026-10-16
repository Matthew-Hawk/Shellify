import {quote} from './validation.js';
const schema=(fields,rows,help='')=>({fields:fields.split(',').map(part=>{const [name,type='text']=part.split(':');return {name,type};}),rows,help});
export const resultSchemas={
  'auto-services':schema('Name,DisplayName,State,StartMode,StartName',[{Name:'ExampleService',DisplayName:'Example service',State:'Stopped',StartMode:'Auto',StartName:'LocalSystem'}],'Stopped automatic services are candidates for investigation. Boot timing, exclusions and intended startup behavior require review.'),
  services:schema('Status,Name,DisplayName',[{Status:'Stopped',Name:'ExampleService',DisplayName:'Example service'}]),
  'service-details':schema('Name,DisplayName,State,StartMode,StartName',[{Name:'ExampleService',DisplayName:'Example service',State:'Stopped',StartMode:'Auto',StartName:'LocalSystem'}],'StartMode Auto means automatic. State describes the current service state.'),
  processes:schema('Id:number,ProcessName,MemoryMB:number',[{Id:1024,ProcessName:'ExampleApp',MemoryMB:512.5},{Id:2048,ProcessName:'ExampleTask',MemoryMB:64}],'MemoryMB is the working set in MiB (bytes divided by 1 MB in PowerShell).'),
  disk:schema('DeviceID,SizeGB:number,FreeGB:number',[{DeviceID:'C:',SizeGB:256,FreeGB:18},{DeviceID:'D:',SizeGB:512,FreeGB:230}],'SizeGB and FreeGB use GiB (bytes divided by 1 GB).'),
  files:schema('Name,FullName,Extension,Length:number,LastWriteTime:date',[{Name:'example.log',FullName:'C:\\Example\\example.log',Extension:'.log',Length:4096,LastWriteTime:'2026-01-01T10:00:00'}],'Length is bytes. Age uses LastWriteTime on the machine executing the script.'),
  'old-files':schema('FullName,Extension,LastWriteTime:date,Length:number',[{FullName:'C:\\Example\\archive.log',Extension:'.log',LastWriteTime:'2025-01-01T10:00:00',Length:8192}],'Length is bytes; the command’s age cutoff applies before these result filters.'),
  events:schema('TimeCreated:date,Id:number,LevelDisplayName,ProviderName,Message',[{TimeCreated:'2026-01-01T10:00:00',Id:1000,LevelDisplayName:'Error',ProviderName:'Example provider',Message:'Illustrative event message'}],'TimeCreated uses the event timestamp. Severity, provider, ID and time range are filtered natively before the event limit.'),
  'ip-config':schema('InterfaceAlias,InterfaceIndex:number,IPv4Address,Gateway',[{InterfaceAlias:'Ethernet',InterfaceIndex:7,IPv4Address:'192.0.2.10',Gateway:'192.0.2.1'}]),
  adapters:schema('Name,InterfaceDescription,Status,LinkSpeed,MacAddress',[{Name:'Ethernet',InterfaceDescription:'Example adapter',Status:'Up',LinkSpeed:'1 Gbps',MacAddress:'00-00-00-00-00-00'}],'LinkSpeed is a display string, not a numeric throughput measurement.'),
  'dns-settings':schema('InterfaceAlias,AddressFamily:number,ServerAddresses',[{InterfaceAlias:'Ethernet',AddressFamily:2,ServerAddresses:'192.0.2.53'}],'AddressFamily 2 is IPv4; 23 is IPv6.'),
  acl:schema('Path,Owner,IdentityReference,FileSystemRights,AccessControlType,IsInherited:boolean',[{Path:'C:\\Example',Owner:'EXAMPLE\\Owner',IdentityReference:'EXAMPLE\\Readers',FileSystemRights:'ReadAndExecute',AccessControlType:'Allow',IsInherited:true}],'Each row is an access rule, not an effective-access verdict.'),
  'file-hash':schema('Algorithm,Hash,Path',[{Algorithm:'SHA256',Hash:'0'.repeat(64),Path:'C:\\Example\\file.txt'}],'The digest reflects file contents. Match appears when an expected hash is supplied.'),
  'local-members':schema('Name,ObjectClass,PrincipalSource,SID',[{Name:'EXAMPLE\\Admin',ObjectClass:'User',PrincipalSource:'Local',SID:'S-1-5-21-0000-1001'}]),
  bitlocker:schema('MountPoint,VolumeStatus,ProtectionStatus,EncryptionPercentage:number',[{MountPoint:'C:',VolumeStatus:'FullyEncrypted',ProtectionStatus:'On',EncryptionPercentage:100}],'EncryptionPercentage is a percentage. Recovery protector details are excluded.'),
  defender:schema('AMServiceEnabled:boolean,AntivirusEnabled:boolean,RealTimeProtectionEnabled:boolean,AntivirusSignatureVersion,AntivirusSignatureLastUpdated:date',[{AMServiceEnabled:true,AntivirusEnabled:true,RealTimeProtectionEnabled:true,AntivirusSignatureVersion:'1.0.0.0',AntivirusSignatureLastUpdated:'2026-01-01T10:00:00'}],'Reported state does not establish that the endpoint is secure.'),
  hotfix:schema('HotFixID,Description,InstalledOn:date,InstalledBy',[{HotFixID:'KB0000000',Description:'Example update',InstalledOn:'2026-01-01',InstalledBy:'EXAMPLE\\Admin'}],'InstalledOn can be absent. This is not a complete Windows update inventory.'),
  computer:schema('CsName,WindowsProductName,WindowsVersion,OsArchitecture,CsTotalPhysicalMemory:number',[{CsName:'EXAMPLE-PC',WindowsProductName:'Windows',WindowsVersion:'Example',OsArchitecture:'64-bit',CsTotalPhysicalMemory:17179869184}],'CsTotalPhysicalMemory is bytes.'),
  software:schema('DisplayName,DisplayVersion,Publisher,InstallDate',[{DisplayName:'Example app',DisplayVersion:'1.0',Publisher:'Example publisher',InstallDate:'20260101'}],'InstallDate is often yyyyMMdd text and can be absent.')
};
export function schemaFor(action,values={}){
  const base=resultSchemas[action.id];if(!base)return null;
  const extra=action.id==='processes'&&values.includeUserName?[{name:'UserName',type:'text'}]:action.id==='file-hash'&&typeof values.expected==='string'&&values.expected.trim()?[{name:'Match',type:'boolean'}]:[];
  return {...base,fields:[...base.fields,...extra],rows:base.rows.map(row=>({...row,...(extra.length?{[extra[0].name]:action.id==='processes'?'EXAMPLE\\User':false}:{})}))};
}
export const operators=type=>type==='number'?['eq','ne','lt','le','gt','ge']:type==='date'?['older-days','newer-days']:type==='boolean'?['eq','ne']:['eq','ne','contains'];
export function settingsFor(action,step){return {fields:schemaFor(action,step.values)?.fields.map(f=>f.name)||[],filters:[],sort:'',descending:false,limit:0,...step.results};}
export function resultErrors(action,step){
  if(!step.results)return {};
  const s=schemaFor(action,step.values),r=settingsFor(action,step),errors={};
  if(!s)return {results:'Result controls are unavailable for this command.'};
  if(!Array.isArray(r.fields)||!r.fields.length||new Set(r.fields).size!==r.fields.length||r.fields.some(name=>!s.fields.some(f=>f.name===name)))errors.results='Select at least one supported output field.';
  if(!Array.isArray(r.filters)||r.filters.length>6)errors.results='Use at most six result filters.';
  else for(const filter of r.filters){const f=s.fields.find(f=>f.name===filter?.field);if(!f||!operators(f.type).includes(filter.operator)||typeof filter.value!=='string'||!filter.value.trim()||filter.value.length>500||/[\x00-\x1f\x7f]/.test(filter.value)){errors.results='Choose a supported field and operator and enter a single-line filter value.';continue;}if((f.type==='number'&&(!/^-?\d+(\.\d+)?$/.test(filter.value)||!Number.isFinite(Number(filter.value))||Math.abs(Number(filter.value))>Number.MAX_SAFE_INTEGER))||(f.type==='date'&&(!/^\d+$/.test(filter.value)||Number(filter.value)>36500))||(f.type==='boolean'&&!['true','false'].includes(filter.value)))errors.results='Use a number, whole-day age (0–36500), or true/false for the selected field.';}
  if(r.sort&&!s.fields.some(f=>f.name===r.sort))errors.results='Choose a supported sort field.';
  if(typeof r.descending!=='boolean'||!/^\d+$/.test(String(r.limit))||Number(r.limit)>5000)errors.results='Limit results to a whole number from 0 to 5000 (0 means no extra limit).';
  return errors;
}
export function applyResults(code,action,step){
  if(!step.results)return code;
  const r=settingsFor(action,step),s=schemaFor(action,step.values);
  for(const filter of r.filters){const f=s.fields.find(f=>f.name===filter.field),left=`$_.${f.name}`;let expression;
    if(f.type==='date')expression=`${left} -${filter.operator==='older-days'?'lt':'ge'} (Get-Date).AddDays(-${Number(filter.value)})`;
    else if(filter.operator==='contains')expression=`${left} -and ([string]${left}).IndexOf(${quote(filter.value)}, [System.StringComparison]::OrdinalIgnoreCase) -ge 0`;
    else expression=`${left} -${filter.operator} ${f.type==='number'?Number(filter.value):f.type==='boolean'?`$${filter.value}`:quote(filter.value)}`;
    code+=` |\n    Where-Object { ${expression} }`;
  }
  if(r.sort)code+=` |\n    Sort-Object -Property ${r.sort}${r.descending?' -Descending':''}`;
  return code+` |\n    Select-Object${Number(r.limit)>0?` -First ${Number(r.limit)}`:''} -Property ${r.fields.join(', ')}`;
}
