<div align="center">

# ›_ Shellify ✦

### Turn your words into PowerShell.

**Less syntax. More getting things done.**<br>
Build scripts with guided commands, editable steps, and a live PowerShell preview.

[![Try the live demo](https://img.shields.io/badge/TRY_THE_LIVE_DEMO_%E2%86%97-46f2cb?style=for-the-badge&labelColor=111126)](https://shellify.thehawk6353.workers.dev/)

**The best way to interact with Shellify is the [live demo ↗](https://shellify.thehawk6353.workers.dev/).**<br>
Open it in your browser and choose **Get started** to enter the dedicated builder—no account or installation needed.

![Shellify's dark workspace with a command catalog, script steps, and a live PowerShell preview](docs/screenshots/desktop-builder.png)

![JavaScript](https://img.shields.io/badge/JavaScript-111126?style=flat-square&logo=javascript&logoColor=46f2cb)
![HTML](https://img.shields.io/badge/HTML-111126?style=flat-square&logo=html5&logoColor=cf84ff)
![CSS](https://img.shields.io/badge/CSS-111126?style=flat-square&logo=css&logoColor=46f2cb)
![PowerShell output](https://img.shields.io/badge/PowerShell_output-cf84ff?style=flat-square)

</div>

---

## ✦ What is Shellify?

Shellify makes common PowerShell tasks easier to assemble and understand. Find a supported action using a simple description, configure its fields, and watch the script take shape beside you.

It uses **twenty predefined templates and deterministic keyword matching**. It doesn't call an AI model, accept arbitrary code, or execute the generated script. Drafts, favorites, recent commands, and your saved script library stay in local storage on the current browser and device; you can also copy or download scripts and editable projects.

## 01 / Find → configure → export

1. **Find an action.** Search for a task such as `disk space`, `list files`, or `ping`, or browse a category.
2. **Make it yours.** Add commands, fill in their parameters, check applicable command flags, and use the arrows to change the step order.
3. **Review the preview.** See the actual PowerShell, requirements, and any validation errors as you build.
4. **Take it with you.** Copy the script or download `shellify-script.ps1` for review and use in your environment.

**Try this:** Keep the initial disk-space step, add **List files in a directory**, then add **Test network connectivity**. Change the folder and hostname to see the preview update.

![A three-step script combining disk space, directory listing, and a connectivity check](docs/screenshots/configured-script.png)

<details>
<summary><strong>📱 Mobile preview</strong></summary>

<p align="center"><img src="docs/screenshots/mobile-builder.png" alt="Shellify mobile Preview tab with word wrap and export controls" width="330"></p>

</details>

Screenshots were captured from a local run of the repository.

## 02 / What's in the toolbox?

| Action | Main cmdlets | Purpose |
| :--- | :--- | :--- |
| Get computer information | `Get-ComputerInfo` | Windows, operating system, and hardware details |
| Check disk space | `Get-CimInstance` | Capacity and free space on fixed drives |
| List running processes | `Get-Process` | Processes sorted by memory usage |
| Get Windows services | `Get-Service` | Service names and current status |
| Restart a Windows service | `Get-Service`, `Restart-Service`, `Invoke-Command` | Restart an exact service name locally or remotely |
| List files in a directory | `Get-ChildItem` | Files in a selected folder, optionally including subfolders |
| Find older files | `Get-ChildItem`, `Where-Object` | Files older than a configured last-modified cutoff |
| Get Active Directory user | `Get-ADUser` | Look up a user by exact identity |
| List Active Directory computers | `Get-ADComputer` | Bounded domain computer inventory |
| List Active Directory groups | `Get-ADGroup` | Bounded group inventory |
| Get Active Directory group members | `Get-ADGroupMember` | Direct or nested group membership |
| Find locked Active Directory users | `Search-ADAccount` | Report locked accounts |
| Find inactive Active Directory users | `Search-ADAccount` | Report accounts with no recent directory logon |
| Test network connectivity | `Test-Connection` | Ping a hostname or IP address |
| Read recent event logs | `Get-WinEvent` | Bounded Windows event queries, locally or remotely |
| List scheduled tasks | `Get-ScheduledTask` | Task names, paths, and state without starting tasks |
| List installed software | `Get-ItemProperty` | Machine and current-user desktop software registry inventory |
| Look up DNS records | `Resolve-DnsName` | Resolve names using the default or a specified DNS server |
| Test a TCP port | `Test-NetConnection` | Check whether a host accepts a TCP connection |
| List TCP connections | `Get-NetTCPConnection` | Local endpoints, peers, states, and owning processes |

### The useful details

- **Live preview** with syntax highlighting, line numbers, and toggleable word wrap. Wrap starts enabled; the browser remembers your preference without changing exported scripts.
- **Guided and Expert output views.** Guided includes explanatory comments and numbered lines. Expert generates code without those comments, compacts ordinary pipelines, and hides line numbers. The selection applies to preview, clipboard, and `.ps1` downloads and is saved with the project. Expand output provides a full-width editor view on desktop.
- **Editable, reorderable steps** with per-action requirements.
- **Autosaved drafts** restore your steps, unfinished edits, collapsed cards, and export settings after a refresh. A status indicator reports when browser storage is unavailable. Start fresh opens an empty script.
- **Duplicate, reset, collapse, and Undo** make long scripts easier to manage. Collapsed cards show targets, enabled flags, and validation errors. Undo remembers up to 50 changes during the current visit, including edits, removals, resets, and clearing or replacing a draft.
- **Saved script library and starter workflows** under “Scripts & workflows.” Save up to 50 named scripts on this browser. Select an existing save destination to update it, rename entries, or restore their previous contents. Each entry keeps one previous version; renaming preserves that history. Open or delete entries, with a restore option for the last deletion during the current visit. System health, folder review, and AD account review workflows append related steps together.
- **Shared inputs** let you define a host, folder, service name, or domain controller once, then link multiple text fields through their value-source selectors. Changes update every linked step. Values resolve to safely quoted literals in generated scripts; missing links prevent export.
- **Bulk targets and error policies** live in each step’s Execution section. Supported hostname, service, and computer fields can accept up to 50 targets, one per line. The generated loop labels results by Target; CSV/JSON combine the step’s targets in one destination. Choose Stop the script or Record error and continue; continuation records warnings and error rows per failed target or step. Required module import failures always stop.
- **Script settings** provide a title, description, Windows-safe download filename, and PowerShell 5.1 or 7 target. Metadata is exported as comments; ping uses the parameter name for the selected version. Current templates support both versions; AD still requires compatible RSAT modules.
- **Flag-aware summaries** distinguish `-WhatIf` restart previews from actions that actually modify the system, both in the builder and exported comments.
- **Editable project import/export** under “Scripts & workflows.” Share a `.shellify.json` file to move steps, flags, output settings, and metadata between devices. Imports validate the format, version, command catalog, and fields before replacing the draft; Undo restores the previous draft. Unfinished edits remain editable. Files are limited to 1 MB and 200 steps. Exported projects contain the targets and paths you entered. Try importing [the network review example](docs/examples/network-review.shellify.json).
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

## 03 / Run locally

The **[live demo](https://shellify.thehawk6353.workers.dev/)** is the recommended starting point. To explore or edit the source on your own machine, install **Node.js 20 or later** and clone the repo:

```sh
git clone https://github.com/Matthew-Hawk/Shellify.git
cd Shellify
npm start
```

Open **[http://127.0.0.1:4173](http://127.0.0.1:4173)** and select **Get started**, or open `http://127.0.0.1:4173/builder.html` directly. Leave the terminal running while you use the app; press **Ctrl+C** to stop it.

The static application and `npm start` require no package installation. Development browser tests use Playwright: run `npm ci` to install test dependencies. If you prefer downloading a ZIP from GitHub, extract it, open a terminal in the folder containing `package.json`, and run `npm start`.

Use a local server instead of opening `dist/index.html` directly: the app loads JavaScript modules, and clipboard access needs localhost or HTTPS plus browser permission.

### Checks

```sh
npm test
npm run build
```

`npm test` covers generation, quoting, validation, ordering, command matching, project portability, library history, shared inputs, bulk execution, and Expert mode. The native PowerShell parser test runs only on Windows with both Windows PowerShell and PowerShell 7 installed; it parses scripts without executing them. A separate isolated mock-cmdlet test checks bulk failure handling without network requests or system actions.

Run `npm run test:browser` after `npm ci` for automated desktop and mobile tests covering autosave, Undo, imports, favorites, library updates, shared inputs, bulk targets, output validation, clipboard, and downloads. Windows uses installed Microsoft Edge; other platforms use Playwright Chromium (`npx playwright install chromium`). Set `SHELLIFY_TEST_BROWSER=chrome` to use installed Chrome. The suite starts its own local server on port 4190 and blocks external page requests. These are development tools; the published app remains a static site.

`npm run build` checks the static entry files in `dist/`. It does not compile or bundle the app.

GitHub Actions runs the engine and native PowerShell tests, build check, and desktop/mobile browser suite on Windows for every push and pull request. The workflow can also be run manually from the repository’s Actions tab. It uses read-only repository permissions and a 15-minute job timeout.

## 04 / Know the boundaries

**Shellify builds scripts; it never runs them.** The output targets Windows PowerShell 5.1 and PowerShell 7 on Windows. Review the full script and each action's requirements before running it on a target machine.

- Search matches supported phrases; it isn't a general-purpose natural-language interpreter. Unsupported requests produce no commands, and numbers typed into search do not fill parameter fields.
- Restarting a service is the only current system-modifying action. Confirmation is enabled by default. Remote restarts need configured PowerShell remoting and suitable permissions; interactive confirmation can behave differently remotely.
- File actions list results; they do not delete files.
- Validation and literal quoting help control generated syntax, but the browser cannot verify target-machine permissions, policies, connectivity, or installed modules.
- Word wrap is a display preference stored locally when browser storage is available. Copied and downloaded scripts retain their original line breaks.
- Refreshing restores your autosaved draft when browser storage is available. Project exports provide a portable backup independent of browser storage.

Active Directory actions require the RSAT ActiveDirectory module, a reachable domain controller with AD Web Services, and directory read permissions. Generated scripts import the module once. Use Windows PowerShell 5.1 or PowerShell 7 with a compatible module. Optional server and search-base fields scope queries; inventories and account reports have result limits. Inactivity uses replicated logon information and may lag; review accounts before making changes. These templates have been syntax-tested, but have not been executed against a live domain.

[Active Directory module reference](https://learn.microsoft.com/en-us/powershell/module/activedirectory/).

## 05 / Under the hood

| File / folder | Responsibility |
| :--- | :--- |
| `dist/index.html` | Landing page with the Get started entry point |
| `dist/builder.html` | Dedicated responsive script builder and guide |
| `dist/js/appearance.js` | Shared background motion and reduced-motion support |
| `dist/js/landing.js` | Compatibility redirects for old builder bookmarks |
| `dist/styles.css` | Dark theme, responsive layouts, and typography |
| `dist/js/commands.js` | Action catalog, parameter schemas, requirements, and templates |
| `dist/js/matcher.js` | Conservative keyword and alias matching |
| `dist/js/validation.js` | Parameter validation and PowerShell literal quoting |
| `dist/js/generator.js` | Ordered script composition and validation gate |
| `dist/js/app.js` | Catalog, step editor, preview, clipboard, and downloads |
| `tools/` | Local server and static readiness check |
| `test/` | Engine tests and Windows parser test |
| `docs/screenshots/` | Images used in this README |

**Add a command:** Define its metadata, parameter schema, generator, requirements, and search phrases in `commands.js`, then add coverage in `test/`. If it needs new modules or platforms, update the script-level compatibility comments too.

**Host a copy:** Publish the contents of `dist/` to a static host. The app requires no backend or server-side PowerShell runtime. Serve it over HTTPS for clipboard support.

---

<div align="center">

**✦ A little less memorizing. A lot more automating.**

[Try Shellify ↗](https://shellify.thehawk6353.workers.dev/) · [Matthew Hawkins](https://github.com/Matthew-Hawk)

</div>
