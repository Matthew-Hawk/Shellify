# Command definitions and validation

The catalog now contains 30 templates. New templates stay within documented command parameters and selected output properties. The builder does not run scripts, probe modules, or read the user's machine. Windows modules can vary by installation and PowerShell compatibility; syntax checks do not establish that a module is installed or compatible on a target.

Microsoft sources used to review the additions:

- [Get-NetIPConfiguration](https://learn.microsoft.com/en-us/powershell/module/nettcpip/get-netipconfiguration?view=windowsserver2025-ps): optional InterfaceAlias; IPv4Address and IPv4DefaultGateway are flattened into text columns.
- [Get-NetAdapter](https://learn.microsoft.com/en-us/powershell/module/netadapter/get-netadapter?view=windowsserver2025-ps): Name selection; local adapter properties and reported link speed.
- [Get-DnsClientServerAddress](https://learn.microsoft.com/en-us/powershell/module/dnsclient/get-dnsclientserveraddress?view=windowsserver2025-ps): InterfaceAlias, AddressFamily and ServerAddresses. Addresses are joined for CSV readability.
- [Get-Acl](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/get-acl?view=powershell-5.1): literal paths, owner and individual access rules. Displaying a DACL is not a complete effective-access calculation.
- [Get-FileHash](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/get-filehash?view=powershell-7.5): LiteralPath, SHA256 default, SHA384/SHA512 options and Algorithm/Hash/Path. Expected hashes are length-checked hexadecimal strings; Match compares the digest with the supplied value.
- [Get-LocalGroupMember](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.localaccounts/get-localgroupmember?view=powershell-5.1): exact Name, LocalPrincipal properties, Windows version and 32-bit process limitations. Group names can be localized.
- [Get-BitLockerVolume](https://learn.microsoft.com/en-us/powershell/module/bitlocker/get-bitlockervolume?view=windowsserver2025-ps): optional MountPoint; only MountPoint, VolumeStatus, ProtectionStatus and EncryptionPercentage are exported. Requires the Windows feature/module and administrator access; no recovery protector fields are selected.
- [Get-MpComputerStatus](https://learn.microsoft.com/en-us/powershell/module/defender/get-mpcomputerstatus?view=windowsserver2025-ps): reported protection/signature state. Availability depends on the Windows Defender installation; these fields are not a complete security assessment.
- [Get-HotFix](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/get-hotfix?view=powershell-7.5): optional Id; this CBS/QuickFixEngineering inventory excludes many update types.
- [Win32_Service](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-service): local CIM Name, DisplayName, State, StartMode and StartName. Auto is automatic startup, distinct from current State. Restarts remain a separate action with an explicitly configured target.
- [Get-WinEvent](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.diagnostics/get-winevent?view=powershell-7.5): native FilterHashtable StartTime, EndTime, ProviderName, Level and Id, remote ComputerName and bounded MaxEvents. No-match errors are handled by the chosen step error policy.

## Result controls

Schemas in `dist/js/results.js` whitelist fields, types, operators, sample rows and units. Filters combine with AND. String values are quoted literals, not wildcard expressions; contains uses a case-insensitive literal substring. Age filters compare timestamps with a bounded number of days. Numeric values must be finite and within JavaScript's safe integer magnitude. Event limits apply to the native query before optional result-pipeline filters. Result fields/sorting/limits precede CSV/JSON serialization. Samples update their columns and format but never simulate the user's results.

## Parameterized exports and conditions

The default export embeds values. Parameterized mode promotes supported custom text fields or shared inputs to validated string parameters. Required parameters have no default; optional parameters require a nonempty configured default. PowerShell identifiers and reserved/internal names are checked. Literal defaults use the same escaping as embedded values. Bulk targets remain explicit literal lists; the same field cannot simultaneously use bulk targeting and a parameter.

Conditions are limited to a stopped-service test for restarts or the outcome of an earlier single-target ping/TCP check. False conditions skip the step; failures obey the selected error policy. Ping/TCP diagnostic outcomes are stored separately from command-execution status. Skipped steps are counted separately in summaries. Reordering/removing source steps updates references and blocks export if a dependency is missing or no longer earlier.

Project schema version 1 and the existing internal guided/expert values remain supported; the UI labels are Commented and Compact code. Old projects obtain defaults for added fields. New result/parameter/condition settings persist in drafts, library entries and portable projects.

## Validation scope

Automated checks parse generated scripts in Windows PowerShell 5.1 and PowerShell 7. Mock runtime tests exercise both runtimes without restarting services or connecting to remote machines. Read-only fixture tests exercise real folder listing, hashes and file serialization. These checks do not verify every optional Windows module, target permission, remote endpoint, or script in the user's environment.
