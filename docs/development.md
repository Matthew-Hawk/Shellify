# Development and hosting

[Documentation](README.md)

## 03 / Run locally

The **[live demo](https://shellify.thehawk6353.workers.dev/)** is the recommended starting point. To explore or edit the source on your own machine, install **Node.js 20 or later** and clone the repo:

```sh
git clone https://github.com/Matthew-Hawk/Shellify.git
cd Shellify
npm start
```

Open **[http://127.0.0.1:4173](http://127.0.0.1:4173)** and select **Start building**, or open `http://127.0.0.1:4173/builder.html` directly. Leave the terminal running while you use the app; press **Ctrl+C** to stop it.

The static application and `npm start` require no package installation. Development checks require Node.js 22.12 or later (CI uses Node.js 24) because of the axe Playwright integration; the static server still supports Node.js 20 or later. Run `npm ci` to install test dependencies. If you prefer downloading a ZIP from GitHub, extract it, open a terminal in the folder containing `package.json`, and run `npm start`.

Use a local server instead of opening `dist/index.html` directly: the app loads JavaScript modules, and clipboard access needs localhost or HTTPS plus browser permission.

### Checks

```sh
npm test
npm run build
```

`npm test` covers generation, quoting, validation, ordering, command matching, project portability, library history, shared inputs, bulk execution, and compact code mode. The native PowerShell parser test runs only on Windows with both Windows PowerShell and PowerShell 7 installed; it parses generated scripts. Fixture runtime checks exercise real folder listing, hashes and CSV/JSON writes in both runtimes; mock commands verify conditions and summaries without system changes. Optional Windows modules and real remote targets still require testing in your environment. A separate isolated mock-cmdlet test checks bulk failure handling without network requests or system actions.

fast-check also checks literal quoting with 5,000 generated strings on every platform. On Windows, the existing native parser suite checks 1,024 generated strings per PowerShell runtime plus explicit edge cases, requiring one single-quoted string literal, the original UTF-16 value, and no command nodes. Inputs include apostrophes, smart quotes, backticks, `$()`, newlines, control characters, Unicode, and unpaired surrogates. Unsafe negative controls verify the parser detects quote breakout and interpolation. Payloads are only parsed, never executed; fixed seeds and fast-check's reported shrink paths make failures reproducible. These checks run through `npm test` in Windows CI and require the development dependencies installed by `npm ci`.

Run `npm run test:browser` after `npm ci` for automated desktop and mobile tests covering autosave, Undo, imports, favorites, library updates, shared inputs, bulk targets, output validation, clipboard, and downloads. Windows uses installed Microsoft Edge; other platforms use Playwright Chromium (`npx playwright install chromium`). Set `SHELLIFY_TEST_BROWSER=chrome` to use installed Chrome. The suite starts its own local server on port 4190 and blocks external page requests. These are development tools; the published app remains a static site.

`npm run build` checks the static entry files in `dist/`. It does not compile or bundle the app.

Run `npm run test:a11y` for the axe accessibility scans at desktop and mobile sizes, including open dialogs, menus, and scrolled forms. These scans also run in the complete browser suite and fail on serious or critical violations. See the [accessibility audit](accessibility-audit.md) for findings and contrast review limits. Per-state JSON reports, including incomplete checks and passing rule counts, are retained in the CI `accessibility-scans` artifact for 14 days, including on failure.

GitHub Actions runs the engine and native PowerShell tests, build check, and desktop/mobile browser suite on Windows for every push and pull request. The workflow can also be run manually from the repository’s Actions tab. It uses read-only repository permissions and a 15-minute job timeout.

### Generated script analysis

Windows CI installs PSScriptAnalyzer **1.24.0** from PowerShell Gallery, then runs `tools/analyze-templates.ps1`. The generator reads the entire exported command catalog (including imported templates) and writes one script per command and supported PowerShell target to a fresh temporary directory: currently 53 commands × two targets = 106 scripts. Scripts are only analyzed, never executed, so no AD, service, network, or file operations run.

Inputs start with the catalog defaults. Required fields with empty defaults receive explicit examples in `tools/generate-analysis-scripts.js`: `Spooler` for restart/start-service, `C:\Example\file.txt` for file-hash, `dc01` for lockout-events, and `jdoe` for ad-unlock. All inputs pass the application validator before generation; a new template with invalid defaults fails the check until valid examples are supplied.

Default analyzer rules run with the narrow exception below. Error and ParseError diagnostics produce GitHub error annotations and fail the step after every generated script has been analyzed. Warning diagnostics produce warning annotations with the generated filename, line, column, rule, and message, but do not fail CI. Information diagnostics are omitted. Module, generation, and analyzer failures also fail the step.

**Suppressed rule: `PSAvoidUsingComputerNameHardcoded`**, only for `lockout-events-ps5.1.ps1` and `lockout-events-ps7.ps1`. This template requires an explicit domain controller and deliberately emits the user's literal `-ComputerName` value; the CI example `dc01` is synthetic and contains no private infrastructure information. The rule treats this intentional literal as an Error. The runner excludes this one rule only for these two files; it remains enabled for every other template. No other rules are suppressed, and no generated script is modified to hide diagnostics. Any future suppression must name the rule, explain the specific false positive or intentional behavior here, and be scoped as narrowly as possible.

To reproduce locally with PowerShell 7, choose an output directory that does not already exist:

```powershell
Install-Module PSScriptAnalyzer -RequiredVersion 1.24.0 -Scope CurrentUser -Repository PSGallery -Force
./tools/analyze-templates.ps1 -OutputDirectory "$env:TEMP/shellify-analysis-$([guid]::NewGuid())"
```

## 05 / Under the hood

| File / folder | Responsibility |
| :--- | :--- |
| `dist/index.html` | Landing page with the Start building entry point |
| `dist/builder.html` | Dedicated responsive script builder and guide |
| `dist/js/appearance.js` | Shared background motion and reduced-motion support |
| `dist/js/landing.js` | Compatibility redirects for old builder bookmarks |
| `dist/styles.css` | Dark theme, responsive layouts, and typography |
| `dist/js/commands.js` | Action catalog, parameter schemas, requirements, and templates |
| `dist/js/matcher.js` | Compatibility entry point for deterministic search |
| `dist/js/search.js` | Weighted ranking, normalization, synonyms, filters and explanations |
| `dist/js/search-index.js` | Catalog/workflow index generated by the build |
| `dist/js/essentials.js` | Sysadmin commands and composition/search metadata |
| `dist/js/recipes.js` | First-wave admin workflows and shared input forms |
| `dist/js/composition.js` | Typed service-result source validation |
| `dist/js/validation.js` | Parameter validation and PowerShell literal quoting |
| `dist/js/generator.js` | Ordered script composition and validation gate |
| `dist/js/app.js` | Catalog, step editor, preview, clipboard, and downloads |
| `tools/` | Local server and static readiness check |
| `test/` | Engine tests and Windows parser test |
| `docs/screenshots/` | Images used in this README |

**Add a command:** Define its metadata, parameter schema, generator, requirements, and search phrases in `commands.js`, then add coverage in `test/`. If it needs new modules or platforms, update the script-level compatibility comments too.

**Host a copy:** Publish the contents of `dist/` to a static host. The app requires no backend or server-side PowerShell runtime. Serve it over HTTPS for clipboard support.

## Share links

Projects now export schema version 3 (group behavior and explicit overrides), extending version 2 identities. Step identities and result/condition source IDs travel together and are remapped consistently to fresh IDs when a project, share link, saved draft or library version is restored. Version 1/2 projects and old indexed references remain readable and migrate to ID references. A schema-valid project with a missing or incompatible connection opens for repair; it cannot export PowerShell until the relationship is corrected. Unsupported schemas, commands, parameter keys and malformed references are rejected before replacing the draft. Older Shellify builds that only support schema versions 1/2 cannot open new version 3 exports.

Relationship controls are a derived view of workspace fields (`inputSourceId`, `condition.sourceId`, shared bindings, and report steps), not a separately persisted graph. Result variable names use the current step order during generation. Scope acknowledgements store the source identity and an exact effective-configuration signature; source identities remap with portable projects, while a changed source/scope requires a new acknowledgement. The signature is a review guard, not a security signature or a browser check of actual machine state.

In **Scripts & workflows**, choose **Create share link**, then **Copy share link**. The link is a snapshot of the current editable project, using the same versioned schema as `.shellify.json`. It includes configured targets, paths, and settings, so share it only with intended recipients. It uses no backend: UTF-8 project JSON is compressed with `CompressionStream('deflate')` and base64url encoded in `#share=...`. The fragment is not sent to the web server. Creating links requires a browser with CompressionStream and DecompressionStream support; project file export remains available.

The entire hash is limited to 16,384 characters, and the project JSON to 1 MiB before compression and while decompressing. Oversized links show an error directing users to project file export. Malformed base64url, corrupt deflate streams, invalid UTF-8, and projects rejected by `importProject` show an invalid-link error without replacing the draft. Valid links go through the existing project import validator, restore fresh step IDs, and can be undone. The consumed hash is removed from the address bar so reload does not re-import the snapshot. `browser-tests/share.spec.js` checks round trips, clipboard copying, Undo, oversized creation, malformed hashes, unsupported schemas/commands/parameters, and compressed expansion beyond the size limit on desktop and mobile.

## Keep the command catalog current

The full [command table](commands.md) is generated from the exported catalog in `dist/js/commands.js`, including its imported templates and Sysadmin Essentials metadata. After changing command names, categories, cmdlets, descriptions, or catalog membership, run:

```sh
npm run docs:generate
npm run docs:check
```

Commit `docs/commands.md` with the catalog change. CI runs `npm run docs:check` before the engine tests and fails if the generated file is missing or stale. The check does not rewrite files and accepts both LF and CRLF line endings.

### Group behavior implementation

`dist/js/group-behavior.js` resolves behavior before validation and generation. Persisted group defaults and per-step override markers have one effective projection, shared by controls, scope acknowledgement, review and generation. Project schema v3 retains this behavior; v1/v2 remain readable. `test/group-behavior.test.js` covers flags in both versions/modes, migration and portability, blocked capabilities and isolated native failure/skip mocks. `browser-tests/group-behavior.spec.js` covers review/acknowledgement, overrides/reset, membership, dry run, Undo, reload, responsive dialogs and accessibility.
