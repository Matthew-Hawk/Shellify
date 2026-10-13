# Sysadmin Essentials rollout

This implements the first wave from the October 2026 catalog and search proposal. The catalog has 53 commands, with 31 tagged Sysadmin Essentials. Select that pack in the Category dropdown. Existing read-only templates stay available; service restarts now carry a DISRUPTIVE badge. An unlock and a service start support confirmation, global Dry run, and verification.

## What ships

New entries cover uptime, three pending-reboot indicators, physical disk health, stopped automatic services, recent errors, unexpected shutdowns, failed sign-ins, cleared logs, lockout sources, listening-port owners, expiring certificates, largest files, failing tasks, WinRM, routes, time synchronization, password expiry, account unlock, workstation restore points, reachable hosts, signed-in sessions and combined reports. Existing disk-space, patch, process, TCP, local administrator and AD account queries join the pack. Result sorting and limits already provide top-process views.

The four recommended initial workflows are New server health check, Connectivity triage, Locked-out user triage, and Certificate expiry sweep. They ask for shared inputs before insertion. New groups can collapse, move and delete together; Undo restores group operations. A preview comment identifies each group. The lockout recipe starts in Dry run, reads the caller computer from event XML, and verifies the selected user's status after the unlock. A broad locked-account query is never fed automatically into an unlock.

The service-start action can consume Name values from an earlier services result. It validates output type, source order and selected output fields. Deleting a source leaves an invalid reference rather than switching silently to another step. The next-step area suggests compatible actions and read-only verification.

Fleet execution repeats local inspection steps through WinRM for up to 50 explicit targets. A single ping gates each target by default; this can be disabled because ICMP filtering can hide online hosts. Results retain step and target labels; failures are recorded in the report. Per-step remote targets, bulk lists, parameterized exports and individual file outputs cannot be combined with fleet execution in this wave. Use the combined report, written on the orchestrating computer. CSV and JSON store a stable Step/Target/Data envelope; HTML encodes data through ConvertTo-Html. Existing files are never overwritten. Transcripts stay on the orchestrating computer.

Global Dry run enables WhatIf wherever supported. It blocks export when a modifying command cannot be previewed. Restore points are explicit, never automatically inserted: they need client Windows, elevation and enabled System Restore, and creation is normally rate-limited. PowerShell 7 exports call Windows PowerShell for Checkpoint-Computer. Reports must remain last; order and fleet incompatibilities appear inline and prevent export.

## Search

Search is entirely local and deterministic. `npm run build` generates the committed search index. Weighted titles, cmdlets, aliases, identifiers, categories, descriptions and parameters support case/accent normalization, identifier splitting, light stemming, curated synonyms, prefixes and bounded Damerau edit distance. Short words and numbers are never fuzzy matched. Unsupported destructive verbs do not become primary read-only results.

Matching workflows appear before commands only when their titles or aliases match the intent. Explanations and highlighted title terms accompany query results. Partial matches appear under Also try. Empty search shows recent queries and examples. Empty results provide popular commands, recovery, and an explicit copy-search button; there is no transmission or telemetry.

Filters: `cat:ad`, `is:readonly`, `is:modifies`, `is:disruptive`, `fav:`, `needs:admin`, `ps:5.1`, `takes:services`, `makes:users`, quoted phrases, and flags such as `-Force`. Arrow keys select results, Enter adds, Escape clears, and Ctrl+K or `/` focuses search. `?debug=search` exposes scores and local query/zero-result counts; missed searches are retained on this device only in that diagnostic mode.

## Verification and limits

The 150-query golden suite asserts top-1 and top-3 command results and runs in CI. Windows PowerShell 5.1 and PowerShell 7 parse all templates, including hostile quoted values. Runtime tests mock fleet reachability/remoting, certificates, service starts and event-log errors, and exercise real file serialization. Native errors, permission failures, missing optional modules and actual AD/WinRM infrastructure still require validation in the deployment environment; these tests do not claim that every optional Windows role was exercised live.

Primary references: [Get-WinEvent filters](https://learn.microsoft.com/en-us/powershell/scripting/samples/creating-get-winevent-queries-with-filterhashtable), [Get-PhysicalDisk](https://learn.microsoft.com/en-us/powershell/module/storage/get-physicaldisk), [Unlock-ADAccount](https://learn.microsoft.com/en-us/powershell/module/activedirectory/unlock-adaccount), [Checkpoint-Computer](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/checkpoint-computer?view=powershell-5.1), and [Get-ScheduledTaskInfo](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/get-scheduledtaskinfo).

## Later waves

The remaining proposed workflows, additional destructive commands, server-role packs and cloud sign-in integrations remain future work. Record-before-change automation, automatic restore points, generalized typed-output chaining beyond service names, report clipboard output, throttled/background fleet execution, CPU trend sampling, SSD reliability counters and waiting/retry controls are also outside this first wave. Each needs its own runtime fixtures and compatibility checks before being advertised as supported.
