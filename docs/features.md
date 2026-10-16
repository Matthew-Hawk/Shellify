# Feature details

[Documentation](README.md) · [Command catalog](commands.md)

## ✦ What is Shellify?

Shellify makes common PowerShell tasks easier to assemble and understand. Find a supported action using a simple description, configure its fields, and watch the script take shape beside you.

The landing page includes interactive Services, Files, and Directory examples, a Commented/Compact code preview switch, a feature showcase, common use cases, and FAQs. Lightweight CSS/SVG motion graphics illustrate script assembly, shared-input connections, bulk targets, and exports. The motion button pauses every graphic, reduced-motion preferences disable animations, and graphics outside the viewport pause automatically.

It uses **53 predefined templates and deterministic offline search**. It doesn't call an AI model, accept arbitrary code, or execute the generated script. Drafts, favorites, recent commands, recent searches, and your saved script library stay in local storage on the current browser and device; you can also copy or download scripts and editable projects.

## 01 / Find → configure → export

1. **Find an action.** Search for a task such as `disk space`, `list files`, or `ping`, or browse a category.
2. **Make it yours.** Add commands, fill in their parameters, check applicable command flags, and use the arrows to change the step order.
3. **Review the preview.** See the actual PowerShell, requirements, and any validation errors as you build.
4. **Take it with you.** Copy the script or download `shellify-script.ps1` for review and use in your environment.

**Try this:** Keep the initial disk-space step, add **List files in a directory**, then add **Test network connectivity**. Change the folder and hostname to see the preview update.

![A three-step script combining disk space, directory listing, and a connectivity check](screenshots/configured-script.png)

<details>
<summary><strong>📱 Mobile preview</strong></summary>

<p align="center"><img src="screenshots/mobile-builder.png" alt="Shellify mobile Preview tab with word wrap and export controls" width="320"></p>

</details>

Screenshots were captured from a local run of the repository.

## 02 / What's in the toolbox?

See the [complete command catalog](commands.md), generated from `dist/js/commands.js`.

### The useful details

- **Live preview** with syntax highlighting, line numbers, and toggleable word wrap. Wrap starts enabled; the browser remembers your preference without changing exported scripts.
- **Commented and Compact code output views.** Commented includes explanatory comments and numbered lines. Compact code generates code without those comments, compacts ordinary pipelines, and hides line numbers. The selection applies to preview, clipboard, and `.ps1` downloads and is saved with the project. Expand output provides a full-width editor view on desktop.
- **Editable, reorderable steps** with per-action requirements.
- **Persistent script context** shows the title, PowerShell version, configured local/remote/network/directory scope, step count, and modifying or preview-only step counts. **Edit settings** opens the existing title/version/run settings. **Ready to export** means configuration is valid; **Requirements to review** lists permissions, modules, and targets that Shellify has not checked in your environment. Incomplete edits retain the last valid preview, labeled **Out of date**, with copy/download disabled until corrected.
- **Explicit input sources** give supported fields one source selector: Custom value, a named Shared input, Bulk targets, or compatible Earlier results. Shared and result-derived values are read-only at the destination; switching back to Custom retains the original custom value. Service-result mapping shows the source query, `Name` → Service name, filters and limits. Using all returned names requires a scope acknowledgement before export, including preview exports. Relevant query, target, condition, version or change-setting edits require review again. A filter does not imply a single affected service; the count is determined when the exported script runs. Result-linked service actions currently support single-computer local queries, with existing confirmation/WhatIf behavior preserved.
- **Inspectable workflow relationships** distinguish Then (execution order), Use results, Only if, Shared input, and Collect results. Non-adjacent links name both step numbers. Select a relationship to inspect, edit or remove its mapping/condition through the same source controls. Collapsed groups retain their relationship summaries. Missing, future or incompatible sources remain repairable and prevent export; Undo restores removed links. Empty, skipped or failed source output skips the linked action. A failed source is still reported by that source step; an execution summary records the follow-up as Skipped.
- **Autosaved drafts** restore your steps, unfinished edits, collapsed cards, and export settings after a refresh. A status indicator reports when browser storage is unavailable. Start fresh opens an empty script.
- **Duplicate, reset, collapse, and Undo** make long scripts easier to manage. Collapsed cards show targets, enabled flags, and validation errors. Undo remembers up to 50 changes during the current visit, including edits, removals, resets, and clearing or replacing a draft.
- **Saved script library and starter workflows** under “Scripts & workflows.” Save up to 50 named scripts on this browser. Select an existing save destination to update it, rename entries, or restore their previous contents. Each entry keeps one previous version; renaming preserves that history. Open or delete entries, with a restore option for the last deletion during the current visit. System health, folder review, and AD account review workflows append related steps together.
- **Shared inputs** let you define a host, folder, service name, or domain controller once, then link multiple text fields through their value-source selectors. Changes update every linked step. Values resolve to safely quoted literals in generated scripts; missing links prevent export.
- **Bulk targets and error policies** live in each step’s Execution section. Supported hostname, service, and computer fields can accept up to 50 targets, one per line. The generated loop labels results by Target; CSV/JSON combine the step’s targets in one destination. Choose Stop the script or Record error and continue; continuation records warnings and error rows per failed target or step. Required module import failures always stop.
- **Script settings** provide a title, description, Windows-safe download filename, and PowerShell 5.1 or 7 target. Metadata is exported as comments; ping uses the parameter name for the selected version. Current templates support both versions; AD still requires compatible RSAT modules.
- **Flag-aware summaries** distinguish `-WhatIf` restart previews from actions that actually modify the system, both in the builder and exported comments.
- **Editable project import/export** under “Scripts & workflows.” Share a `.shellify.json` file to move steps, flags, output settings, and metadata between devices. Imports validate the format, version, command catalog, and fields before replacing the draft; Undo restores the previous draft. Unfinished edits remain editable. Files are limited to 1 MB and 200 steps. Exported projects contain the targets and paths you entered. Try importing [the network review example](examples/network-review.shellify.json).
- **Share links** under “Scripts & workflows.” Create and copy a link containing a compressed snapshot of the current project, with no backend. Opening it validates and restores the project; Undo restores the previous draft. Links include your targets, paths, and settings, so anyone with the link can read them. Invalid or oversized links show an error and preserve the draft. Links are limited to 16,384 hash characters and 1 MiB of expanded project data; use a project file for larger projects. Requires browser compression support.
- **Favorites and recent commands** make discovery quicker. Star commands to keep them in Favorites; Recent shows the last eight commands added. Search also recognizes cmdlet names and applicable flag names, such as `files -Force` or `-DnsOnly`.
- **Per-step CSV and JSON results** for read-only commands. Choose the output format and destination in the step’s Results section. Generated scripts write those files only when you run them, use UTF-8, and refuse to overwrite existing files. Destination folders must exist and be writable. JSON preserves an array even for zero or one result; quiet ping CSV output includes a Reachable column. Multiple steps must use separate destinations. CSV best suits flat fields; JSON preserves nested values.
- **Script review** groups module imports, permission and compatibility notes, remote/network targets, modifying actions, preview-only actions, and result destinations before export.
- **Optional run checks and reports** in Script settings. Preflight checks validate Windows, the selected PowerShell version, required modules, definite local administrator requirements, and destination folders before commands run. Remote permissions and folder write access are checked when the commands or file writes actually run. Execution summaries report successful command attempts and caught failures by step and target, including when a stopping error interrupts the script; they do not interpret returned connectivity or business results.
- **Optional transcript logging** records console activity and errors to a selected new file. The log folder must exist and be writable; existing files are not overwritten, and transcripts stop in a finally block. Logs can contain targets, results, and other displayed data. Preflight, summaries, and logging settings travel with drafts and project files. These options start disabled to preserve compact output until selected.
- **Command-specific troubleshooting** under each step’s “Common problems & fixes” covers paths, permissions, modules, service dependencies, DNS, firewall restrictions, and directory access.
- **Command flag checkboxes** with PowerShell flag names and explanations. Toggle file recursion and hidden files, process owners, quiet ping results, nested AD membership, and service restart confirmation, dry runs, force, and returned status. Every action also offers `-Verbose`. The preview, copy, and download reflect your selections; existing recursion and confirmation defaults are preserved.
- **Validation before export** for required fields, numeric bounds, and supported input types.
- **Read-only and system-modifying labels** so the impact of an action is visible.
- **Copy and `.ps1` download**, with UTF-8 BOM and Windows line endings on downloads.
- **Desktop workspace that fits the viewport**, with independent scrolling for long catalogs, steps, and scripts. Phones and tablets use Discover, Configure, and Preview tabs, with one comfortable pane visible at a time.
- **Subtle animated background**, a motion toggle, and support for reduced-motion preferences.
- **Responsive dark interface** with mint and purple accents, keyboard focus styling, and reduced-motion support.
- **No runtime libraries or backend**; Google Fonts are optional external assets with system fallbacks.

## Expanded builder controls

The catalog contains 53 templates and a 31-command Sysadmin Essentials pack, selectable through Category. Ten workflows append undoable steps and reuse appropriate shared inputs. The four new admin recipes ask for inputs, insert a collapsible group, and support fleet reports or a previewed unlock with verification. See [Sysadmin rollout, compatibility and later waves](sysadmin-rollout.md). The homepage opens the matching workflow; it never executes scripts.

One script step opens at a time; collapsed steps retain their summary, impact badge and validation status. The step actions menu holds Duplicate and Reset defaults. Essential inputs and output destinations stay visible, with a two-column field layout when space permits. Details combines compatibility, requirements and troubleshooting; Advanced options holds diagnostics, error policies, bulk targets and bounded conditions. Restart targets begin empty.

Scripts & workflows stays prominent in the toolbar. Settings groups Shared inputs and Script settings; Start fresh asks for confirmation and remains undoable. Desktop panel dividers support dragging, arrow keys, Home to reset one width, and double-click to reset both widths. The catalog offers compact/descriptive views with collections and category grouped together. Press Ctrl+K (or `/`) to focus command search; Ctrl+Shift+D duplicates a focused step, and Ctrl+Shift+Up/Down reorders it. Smaller screens retain the stage tabs. The preview groups filename, comment mode, wrapping and expansion in one toolbar, with View requirements beside the status and Copy/Download beneath it.

Supported results have selectable fields, bounded AND filters, sorting and limits, plus clearly labeled illustrative table/CSV/JSON samples. Optional parameterized exports promote supported custom/shared text inputs to validated string parameters and show an invocation example. Review separates blockers from informational requirements, lists targets/error policies/files/runtime settings and links back to each step.

Conditions support restarting only a stopped service or running after an earlier single-target connectivity check. Summaries distinguish succeeded, failed and skipped steps. Drafts and schema-version-1 projects retain compatibility; internal guided/expert values remain supported. See [Microsoft command references and validation scope](command-reference.md).

## 04 / Know the boundaries

**Shellify builds scripts; it never runs them.** The output targets Windows PowerShell 5.1 and PowerShell 7 on Windows. Review the full script and each action's requirements before running it on a target machine.

- Search matches curated tasks, symptoms, identifiers and flags with bounded typo tolerance and explainable ranking. Filters and keyboard navigation are supported. It isn't a general-purpose natural-language interpreter; numbers typed into search do not fill parameter fields. Partial matches are labeled Also try. A 150-query golden suite protects ranking in CI.
- Restarting a service is the only current system-modifying action. Confirmation is enabled by default. Remote restarts need configured PowerShell remoting and suitable permissions; interactive confirmation can behave differently remotely.
- File actions list results; they do not delete files.
- Validation and literal quoting help control generated syntax, but the browser cannot verify target-machine permissions, policies, connectivity, or installed modules.
- Word wrap is a display preference stored locally when browser storage is available. Copied and downloaded scripts retain their original line breaks.
- Refreshing restores your autosaved draft when browser storage is available. Project exports provide a portable backup independent of browser storage.

Active Directory actions require the RSAT ActiveDirectory module, a reachable domain controller with AD Web Services, and directory read permissions. Generated scripts import the module once. Use Windows PowerShell 5.1 or PowerShell 7 with a compatible module. Optional server and search-base fields scope queries; inventories and account reports have result limits. Inactivity uses replicated logon information and may lag; review accounts before making changes. These templates have been syntax-tested, but have not been executed against a live domain.

[Active Directory module reference](https://learn.microsoft.com/en-us/powershell/module/activedirectory/).

### Workflow group behavior

Workflow groups share an intent and visible membership. Behavior & presets controls shared computer targeting where supported, change preview/confirmation, failure handling and verbose evidence. Diagnostic collection previews supported changes, continues after command errors and enables verbose messages. Preview supported changes previews, stops on error and disables verbose messages. Apply with confirmation enables supported live changes with confirmation, stops on error and disables verbose messages. Presets retain targets, Force, result paths and explicit step overrides.

Effective values resolve from command/recipe defaults, group defaults, explicit step overrides, then script-wide dry run. Each block shows effective flags and their origin; editing creates an override, and Reset to inherited value and Undo restore previous choices. Review shows changes, retained overrides, unsupported capabilities and file effects before applying. Enabling live changes or removing confirmation requires explicit acknowledgement. Unsupported preview/confirmation and conflicting overrides block export. Fleet execution, transcripts, preflight and execution summaries remain script-wide. Succeeded, Failed and Skipped describe command attempts, not machine health.

Project format v3 preserves group behavior and overrides; this build reads v1/v2 projects and migrates existing drafts. Use this or a newer build to open v3 projects.
