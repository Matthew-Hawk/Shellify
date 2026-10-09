# Shellify ⚡

Turn your words into PowerShell. A buildless, static script builder using vanilla HTML, CSS, and JavaScript. No accounts, backend, AI integrations, or runtime JavaScript libraries.

## Run locally

Install Node.js 20 or later, then run `npm start` from this directory. Open http://127.0.0.1:4173. Run `npm test` for generator, escaping, validation, and matching tests. `npm run build` verifies the static entry files; no compilation or dependency installation is necessary. Deploy the `dist` directory to a static host such as Cloudflare Pages.

## Structure

- `dist/index.html`: semantic page layout and guide dialog.
- `dist/styles.css`: responsive dark neon styling, with Inter and JetBrains Mono from Google Fonts and system fallbacks.
- `dist/js/commands.js`: eight predefined actions, parameter schemas, requirements, risk, and generator functions.
- `dist/js/validation.js`: schema validation and literal PowerShell string quoting.
- `dist/js/matcher.js`: deterministic, conservative keyword matching. Ambiguous searches return candidates; unsupported requests produce no code. Numbers in searches do not configure parameters automatically.
- `dist/js/generator.js`: ordered script composition, validation gate, comments, and stop-on-error behavior.
- `dist/js/app.js`: catalog, categories, parameter editing, order controls, highlighted preview, clipboard and `.ps1` export.
- `tools/`: local server and static readiness check. `test/`: Node built-in tests.

## Safety and limitations

Shellify never executes scripts. The initial preview contains a read-only disk-space action. Scripts require review and are not tested or guaranteed safe in the target environment. PowerShell 5.1 and 7 on Windows are the initial targets; command requirements appear on each step. A static site cannot inspect target computers, modules, policies, privileges, remoting, or firewall settings.

String parameters are validated and emitted as single-quoted literals with doubled ASCII and typographic single quotation marks. Paths use `-LiteralPath`, and service names use equality instead of wildcard matching. Numeric parameters have strict integer bounds. Line breaks and control characters are rejected. Arbitrary code is not accepted. Templates avoid per-step global variables, so repeating and reordering actions does not create variable conflicts. The script stops on terminating errors through `$ErrorActionPreference = 'Stop'`.

Service restart is the only system-modifying action and defaults to confirmation. Remote restart requires configured WinRM/PowerShell remoting and suitable permissions; remote interactive confirmation may not behave like a local prompt. Inspect the complete generated script and choose confirmation deliberately for your environment. No forced restarts or deletion actions are provided.

Clipboard access requires localhost or HTTPS and browser permission. Downloads use UTF-8 with a BOM and Windows line endings for Windows PowerShell compatibility. State lives in memory and resets on refresh; persistent storage, AD, imports, and workflow logic are future work. Fonts are optional external CSS assets; browser-native features provide all application behavior.

To add an action, define its metadata, parameter schema, literal-safe generator, requirements, and search phrases in `commands.js`, then add tests. Changing the set of supported platforms or dependencies requires updating script-level comments and composition rules too.

Native parser tests run on Windows with Windows PowerShell and PowerShell 7 installed. They parse templates and adversarial literals without executing the generated scripts. Other platforms skip this integration test while still running the portable engine tests.

Reference documentation: [PowerShell quoting rules](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_quoting_rules), [Restart-Service](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/restart-service), and [Test-Connection](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/test-connection).

The Sites project identity is retained in `.openai/hosting.json`. A recoverable publishing copy is in the ignored `.sites-checkout/` directory. Private publication did not complete because the helper could not inspect Git metadata under expanded permissions. The main working project and static output remain usable.
