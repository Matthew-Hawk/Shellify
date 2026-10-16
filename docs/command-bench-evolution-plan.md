# Shellify: connected Command Bench implementation plan

## Purpose and instructions for the next chat

Implement the UI/UX audit recommendations below in an ordered, verifiable process. This document is the complete handoff; do not require the previous chat to understand the work.

Start by reading this document and the repository's applicable instructions. Summarize the current state, complete Phase 0, and implement the first agreed phase. Work one phase at a time and present each completed phase in a working local instance for review. Pause at phase boundaries unless the user has explicitly authorized several phases or the entire plan. Within an authorized phase, make routine implementation and repair decisions without repeatedly asking permission.

Do not consider a phase complete until its acceptance criteria pass and its evidence is recorded. If work is interrupted, leave an exact resume point in the progress log at the end of this file.

**Delivery rule:** keep implementation local until the user explicitly authorizes a commit, push, or deployment. The earlier approval to push commit `5810ea0` does not authorize publishing this new work. Do not force-push, deploy, replace the app, or discard unrelated changes.

## Product goal and constraints

Help a system administrator discover a task, compose an understandable workflow, configure its inputs and behavior, review the generated PowerShell, and export it with confidence about its scope.

Preserve these accepted decisions:

- Shellify's existing logo, purple-and-mint palette, background motion, guide animations, pause control, and reduced-motion behavior.
- The Command Bench structure: discovery, workflow, and a generous PowerShell preview.
- A static, browser-based application with deterministic search. No account, AI backend, or execution service is required.
- Shellify generates scripts and never runs them. Sample results are illustrative, not observed machine data.
- Existing commands, saved drafts, favorites, recents, undo, library history, editable project import/export, share links, and clipboard/download behavior.
- Commented and Compact code modes must preserve the same operations.
- Valid previews remain visible during incomplete edits, clearly labeled out of date, while copy/download remain disabled.
- Outside-click dismissal for Scripts & workflows and How it works, including after scrolling. Clicking inside or dragging from inside to outside must not dismiss them; Escape and focus return must work.

The design should become clearer and more capable without changing its established identity. Do not replace the workspace with a freely positioned node editor, add arbitrary branching/loops, or introduce a new framework to accomplish this plan.

## Baseline and repository map

Observed baseline: `main`, commit `5810ea0` (Build Command Bench workspace and dismiss dialogs on outside clicks), reviewed on October 16, 2026. Verify the actual checkout and remote state; this is context, not permission to reset the repository.

Workspace in the originating environment: `C:\Users\matth\Desktop\Shellify`.

Relevant files:

- `dist/index.html`, `dist/landing.css`, `dist/js/landing.js`: landing page and examples.
- `dist/builder.html`, `dist/styles.css`, `dist/js/app.js`: builder layout and interactions.
- `dist/js/appearance.js`: shared motion preferences.
- `dist/js/commands.js`, `dist/js/essentials.js`: catalog, parameter definitions, templates, input/output metadata.
- `dist/js/composition.js`: current typed service-result linking and validation.
- `dist/js/results.js`, `dist/js/builder-controls.js`: fields, filters, sorting, sample output, conditions, parameter controls.
- `dist/js/conditions.js`: supported conditional execution.
- `dist/js/workspace.js`, `dist/js/recipes.js`: workspace state, recipes, groups, history, shared values.
- `dist/js/generator.js`, `dist/js/execution.js`, `dist/js/runtime.js`: generation, execution options, requirements, runtime validation.
- `dist/js/projects.js`, `dist/js/share.js`, `dist/js/parameters.js`: portability, sharing, parameterized export.
- `dist/js/search.js`, `dist/js/search-index.js`, `tools/build.js`: search and generated index. Do not hand-edit the generated index.
- `test/`, `browser-tests/`, `.github/workflows/ci.yml`: existing validation.
- `docs/development.md`: commands, parser coverage, PSScriptAnalyzer requirements, supported tooling.

The default local server is `npm start`, port 4173. A preview was running at port 4179 in the previous chat; check before starting another server. Browser tests use their own server on port 4190. Do not terminate an unidentified process to free a port.

### Capabilities that already exist

Revalidate these before designing replacements:

- Shared values linked into individual fields.
- An earlier service-producing step can provide `Name` values to Start a stopped service; source type and ordering are validated.
- The Start block already reads service status back after its action.
- Result field selection, AND filters, sorting, limits, and illustrative samples.
- Conditions based on supported earlier connectivity checks, plus a restricted service condition.
- Bulk targets, fleet workflows, combined reports, preflight checks, summaries, and transcripts.
- Some recipes have workflow groups; do not assume grouping is uniform across all starter recipes.
- Per-command confirmation/WhatIf support and a script-level dry-run option. Existing safeguards must survive new presets.
- Preview-only step markers map selected blocks to code without leaking into exports.

## Audit findings and requirement inventory

Use these IDs in phase evidence and the final reconciliation. Every requirement must end as verified, explicitly deferred with a reason, or blocked with the exact dependency. Silence is not completion.

- **R01 — Compact blocks:** collapsed steps consume too much vertical space. Keep title, target/input summary, and impact visible in a compact, readable arrangement; place secondary actions in the action menu.
- **R02 — Visual hierarchy:** mint currently carries several meanings. Preserve the palette while making selection and the next action strongest, supporting cmdlets quieter, and impact text readable without color alone.
- **R03 — Readable operational text:** improve small risk labels, search explanations, controls, and help. Preserve useful density and avoid page overflow.
- **R04 — Persistent script context:** expose script identity, PowerShell version, local/remote scope, step count, and modifying-step count. Do not confuse configuration validity with verified environment readiness.
- **R05 — Visible composition:** explain order, result handoffs, shared values, conditions, and report collection where users build the workflow.
- **R06 — Unambiguous input sources:** a service field sourced from earlier results currently competes with custom/shared-source controls. Present one authoritative input-source control and an explicit mapping summary.
- **R07 — Explicit modification scope:** broad service queries can feed many names into a modifying action. Expose upstream filters and require deliberate scope selection/acknowledgement before export where appropriate.
- **R08 — Library information architecture:** saved scripts, starter workflows, import/export, and sharing currently share one long dialog. Make their jobs distinct and easy to find.
- **R09 — Precise status language:** distinguish Ready to export, Requirements to review, Needs configuration, Out of date, and runtime outcomes. Never imply local machine verification or execution.
- **R10 — Group behavior presets:** offer meaningful targeting, change behavior, failure handling, evidence, and reporting settings with clear inheritance, overrides, capability limits, and effective values.
- **R11 — Useful workflow recipes:** demonstrate service diagnosis/recovery, server-health reporting, connectivity triage, and account-lockout investigation with correctly modeled relationships.
- **R12 — Landing-page clarity:** demonstrate a meaningful connected workflow as well as a single command. Correct the directory workflow copy: it currently promises browsing groups, while the inserted AD review recipe contains user lookup, locked accounts, and inactive accounts.
- **R13 — Interaction/accessibility continuity:** preserve keyboard paths, focus, motion preferences, mobile adaptation, scrolled-dialog dismissal, preview mapping, safe export, and recovery across every phase.

## Rules for implementation and verification

1. Read applicable repository instructions and relevant Stark UX/web skills if available. Treat the existing static stack and accepted identity as constraints.
2. Inspect the current implementation before changing it. Reuse validated behavior; do not implement a second, conflicting source of truth for conditions, flags, links, or generation.
3. Separate execution order, shared configuration, data transfer, conditions, and report collection. An arrow must describe a real supported relationship. Adjacent blocks are not automatically a PowerShell pipeline.
4. A successful command invocation, a healthy service, a reachable host, and a successful business outcome are different facts. Keep their labels and conditions distinct.
5. Never invent execution results, affected counts, or environment checks. Use “determined when the script runs” where scope is dynamic. Label examples as illustrative.
6. Preserve safe quoting, validation, exact target matching, version compatibility, module requirements, and bounded inputs. Never concatenate unchecked user strings as executable expressions.
7. Do not execute generated service, AD, remote, or other modifying scripts against real systems to test this feature. Use parser checks, isolated fixtures, and mocked commands.
8. Do not silently remove confirmation, enable live modifications, widen targets, or treat unsupported flags as applied. Show consequences before applying a preset.
9. Editing controls must reflect the values actually used by generation. Inherited/read-only values must not appear editable unless editing creates a visible override.
10. Preserve drafts and user input after validation failures. Make invalid connections visible and repairable; never silently drop them during reorder/import.
11. Use meaningful behavioral tests. Do not weaken assertions, skip failures, suppress accessibility rules, or replace expected output solely to make tests pass.
12. Run relevant checks after each phase; run the complete final checks after integration. Broaden/repeat only when changes, failures, or unresolved risks justify it.
13. Inspect rendered desktop and mobile states. A passing build or screenshot alone does not establish usability. Record both successful and recovery paths.
14. Keep a concise progress log, requirement checklist, unresolved issues, evidence paths, and next step in this document. Do not rely on chat memory.
15. Complete concrete implementation and verification before requesting phase review. Report environmental limitations explicitly rather than claiming checks passed.

## Phase 0 — Baseline, scope, and evidence

**Work**

- Inspect Git status, current branch, repository instructions, dependencies, and available local servers. Preserve pre-existing work.
- Read existing tests and architecture for source links, conditions, groups, reports, and project serialization.
- Reproduce the audit flows in an isolated browser context, without altering the user's saved draft: landing entry, discovery, four-step workflow, sourced service names, grouped recipe, incomplete preview, and scrolled dialogs.
- Capture desktop and mobile baseline screenshots after entrance animations settle. Use reduced motion for stable comparison, then separately check motion on/off.
- Run baseline checks appropriate to the environment. Record existing failures separately from regressions.
- Confirm phase sequencing with the user; default to one phase at a time.

**Acceptance gate**

- Known baseline, capability inventory, prior changes, test limitations, and preview URL recorded.
- All R01–R13 appear in the checklist below.
- No application changes required merely to establish the baseline.

## Phase 1 — Clarity and compactness before new mechanics

**Covers:** R01–R04, R09, R13; the R12 copy correction can be completed here.

**Work**

- Compact collapsed steps and consolidate secondary actions without burying reorder/remove/undo behavior.
- Improve title/target/impact hierarchy and operational text size. Avoid blanket font enlargement that breaks the three-panel layout.
- Introduce persistent script context using actual workspace values. Provide a direct editing path for title/version/settings.
- Label configuration validity “Ready to export”; show permissions/modules/targets as requirements, not verified facts.
- Correct the AD starter copy to describe its actual inserted steps.

**Acceptance gate**

- A four-step workflow is substantially easier to scan than the baseline; capture the same viewport and scenario for comparison.
- Long titles, wrapped targets, selected/collapsed/error states, and small viewports remain readable.
- Context updates after add/remove, version change, target change, undo, and draft reload.
- Logo, palette, animations, pause/reduced motion, and both outside-dismiss dialogs remain intact.

## Phase 2 — Explicit input sources and composition contracts

**Covers:** R05–R07, R13.

**Work**

- Define a small relationship model using stable step IDs rather than new index-based references. Decide whether it is derived from existing state or persisted; document that choice and avoid duplicate mutable authorities.
- Model execution order separately from a result source, condition, shared value, or report collector.
- Replace conflicting source controls with one clear source choice: Custom value / Shared input / Earlier results / Bulk targets, exposing only supported choices.
- For linked service input, show source step title, source property `Name`, target field, applicable scope/filter, and a Change source action. Hide irrelevant custom input or present a clearly read-only value.
- Validate direction, type, required fields, local/remote target context, and incompatible source modes. Reordering must preserve identity and detect broken dependencies.
- Show broad upstream scope before a modifying action. A filtered result can still contain many items; never equate having a filter with being safe.
- Define what happens for missing source, deleted source, no runtime results, source failure, and stale/incomplete configuration.
- Preserve old drafts/projects/share links through migration or compatible interpretation. Update versioning/validation deliberately if schema changes.

**Acceptance gate**

- An earlier services result can feed a Start block without a competing editable service-name control.
- Reorder/delete/undo/duplicate/import/share round trips preserve or explicitly invalidate links correctly.
- Unsupported types, future sources, required-property removal, conflicting bulk/shared modes, and incompatible target scopes are rejected with actionable text.
- Broad modifying scope requires an explicit, persisted decision tied to the current source/scope. Relevant edits invalidate that acknowledgement.
- Unknown affected counts remain unknown; zero input is described honestly and tested with mocks.

## Phase 3 — Labeled connectors and compact relationship inspection

**Covers:** R05–R07, R13.

**Work**

- Retain the vertical block stack. Add lightweight, labeled connector rows for **Then**, **Use results**, and **Only if**, with report/shared-input relationships explained distinctly.
- Build a result connector only when an actual supported link exists. Show source and destination when the source is non-adjacent; do not imply an intervening block supplies the data.
- Selecting a connection reveals its mapping/condition and lets the user edit or remove that relationship through the authoritative controls.
- Keep insertion explicit. Suggestions may identify compatible next actions but must not silently wire or modify the script.
- Display broken/blocked connections with reasons and a repair action. Keep them understandable inside collapsed groups.
- Provide a keyboard and touch equivalent for every connector action; no drag-only interaction.
- Preserve step-to-code highlighting and add relationship context without leaking preview metadata into exported PowerShell.

**Acceptance gate**

- A reviewer can distinguish order from data flow and conditions without opening every block.
- Connections remain accurate after reorder, group collapse, delete/undo, source edits, and import.
- Mobile uses readable connector labels rather than a squeezed diagram or crossing wires.
- Plain sequence connectors do not change generated behavior. Linking/unlinking changes only the intended composition.
- No animated “running” indicators imply that Shellify executed anything.

## Phase 4 — Group-level behavior and transparent flag presets

**Covers:** R07, R09–R10, R13.

**Work**

- Define groups as semantic units with shared intent and visible membership. Reconcile existing recipe groups before adding another grouping mechanism.
- Organize controls by Targeting, Change behavior, Failure handling, Evidence, and Results. Preserve command-specific parameters inside blocks.
- Provide a small initial set of concrete presets, such as Diagnostic collection, Preview supported changes, and Apply with confirmation. Document exactly which existing settings each preset controls.
- Define one deterministic resolution order for defaults, group settings, and explicit step overrides. Show effective values and their origin per block.
- Before applying a preset, show affected blocks, changed settings, retained overrides, and unsupported options. Switching to live changes requires an explicit action.
- Keep `-Force`, confirmation changes, and unsupported WhatIf behavior explicit. Do not advertise blanket safety or pretend every cmdlet supports every option.
- Explain scope: script-level settings such as fleet targeting or transcripts must not be represented as group-local unless the engine actually gains that capability.
- Include Reset to inherited value and Undo. Revalidate existing group members when new steps are added or moved.

**Acceptance gate**

- The UI summary and generated flags agree for every included step and both PowerShell targets.
- Preset application, individual overrides, reset, moving between groups, duplicate, undo, reload, import/export, and sharing are covered.
- Unsupported preview changes stay blocked or require a clearly separate supported workflow; no silent live operation.
- Grouping read-only tasks does not imply that writing a report/transcript has no file effects.
- Effective failure handling distinguishes Succeeded, Failed, and Skipped without claiming system health.

## Phase 5 — Four meaningful workflow examples

**Covers:** R05–R07, R10–R11, R13.

Build on existing recipes rather than adding near-duplicates. For each recipe, define purpose, inputs, relationships, impact, requirements, expected output shape, and failure/empty behavior.

### A. Service diagnosis and controlled recovery

- Discover automatic services that are stopped; expose boot-grace assumptions.
- Provide explicit scope/exclusions or an allowlist before remediation.
- Pass compatible selected names to the Start block, with preview/confirmation behavior explicit.
- Keep the existing status readback. Do not add a redundant verification action unless a distinct verification goal is defined.
- A runtime-derived set is not a machine-verified preview inside the browser. If runtime scope review is needed, implement actual exported-script behavior with mocks or narrow scope to explicit inputs; an illustrative sample is not approval of real targets.
- Test no matches, broad matches, rejected scope, source failure, partial action failure, missing service, preview mode, and verification outcome.

### B. Server-health collection and report

- Reuse shared targets for computer, disk, reboot, event, and related checks.
- Treat these as independent checks contributing to a collector, not one pipeline of incompatible objects.
- Write a combined report with accurate target/source labels and distinguish failed checks from healthy/empty findings.
- Preserve WinRM requirements, existing report paths, no-overwrite behavior, and fleet limits.

### C. Connectivity triage

- Share destination, port, and resolver inputs across relevant checks.
- Explain when DNS, ping, TCP, and remoting checks run independently or conditionally.
- Use supported earlier-check conditions only. ICMP failure must not imply that a host/service is unavailable.
- Distinguish unsuccessful connectivity, command execution failure, skipped follow-up, and successful collection.

### D. Account-lockout investigation

- Share one explicit identity and controller across evidence collection.
- Keep account unlock as a distinct, deliberate change/preview with confirmation and later verification.
- Never automatically unlock every account from a discovery list or present finding lockout events as resolving their cause.
- Preserve RSAT/domain-controller/event-log access requirements and preview defaults.

**Acceptance gate**

- Each recipe proves a different useful relationship; no decorative connectors or duplicate recipes.
- All four generate parseable code in supported export modes/versions, preserve parameters, and survive portable-project round trips.
- Modifying flows use isolated mocks; no real service/AD changes or remote execution occurs during verification.
- Recipe descriptions, inserted blocks, input forms, default settings, and output summaries agree.

## Phase 6 — Library navigation and landing-page proof

**Covers:** R08, R12–R13.

**Work**

- Separate Saved scripts, Starter workflows, and project transfer/sharing into clear views or sections with persistent context. Choose the smallest navigation change that solves the long mixed dialog.
- Make insertion behavior explicit: adding a workflow appends steps; opening/importing a project replaces the draft and remains undoable.
- Preserve saved-script rename/history/restore, sharing privacy information, import validation, and browser-local persistence messaging.
- Keep controls reachable in a long/scrolled view. Retain outside-dismiss behavior and focus return.
- Add a landing example of a meaningful connected workflow with real supported steps, labels, and corresponding generated output. Keep the existing single-command teaching example available.
- Connect the demo's CTA to the corresponding recipe/configuration rather than a generic destination that loses the selected task.
- Improve product-specific explanation while retaining the established visual identity. Keep “Nothing executes here” and distinguish exported PowerShell from an editable project.

**Acceptance gate**

- A new user can distinguish “start a workflow,” “open my saved script,” and “transfer/share a project.”
- Replacing versus appending is clear before action; Undo restores the previous draft correctly.
- Landing examples match real recipe behavior and remain understandable with animations paused and on mobile.
- Dialog tabs/sections have correct names, keyboard behavior, scroll handling, Escape, outside-dismiss, and focus restoration.

## Phase 7 — Integration, evidence, and handoff

**Covers:** all requirements.

- Reconcile every R01–R13 against shipped behavior and recorded evidence.
- Update user documentation, recipe descriptions, generated command documentation if affected, and intentional screenshots. Do not retain unrelated screenshot churn from tests.
- Review the complete diff for unrequested changes, obsolete controls, stale terminology, schema compatibility, generated-file drift, and preview-only marker leakage.
- Present the local instance with a concise walkthrough of the four recipes and at least one invalid/recovery state.
- Report any unverified environments, deferred scope, and remaining risks. Ask for publication only after a concrete verified local result exists and only if the user wants publication.

### Required final checks

Verify current package scripts and development instructions before running commands:

```text
npm run build
npm run docs:check
npm test
npm run test:browser
npm run test:a11y
git diff --check
```

The complete browser suite includes accessibility coverage; a separate repeat of `test:a11y` is unnecessary if the same final-code checks demonstrably ran in the full suite. Record that coverage rather than duplicating work.

If generator/template/schema behavior changed, run the repository's documented PSScriptAnalyzer workflow where available. Follow its pinned version and scoped suppression policy. Native parser/mock checks need both Windows PowerShell 5.1 and PowerShell 7; record skips or missing runtimes explicitly. Do not install software or change system settings without applicable authorization.

### Minimum scenario verification

- **First use:** discover a command, configure a block, understand its scope, review requirements, export.
- **Returning use:** keyboard search, favorites/recents, saved recipe/preset reuse, undo, resume a draft.
- **Composition:** compatible link, incompatible link, non-adjacent source, required-field removal, source deletion, reorder, duplicate, group collapse, cross-group move.
- **Scope:** explicit targets, dynamic result sets, broad query, no results, changed source after acknowledgement, local/remote mismatch.
- **Flags:** defaults, inherited values, overrides, reset, unsupported flag, preview versus live changes, failure policy, reporting effects.
- **Recovery:** invalid fields preserve values; stale preview is labeled and non-exportable; missing requirements and bad imports have an actionable next step.
- **Portability:** old draft/project compatibility; new draft/project/share round trips; library version restore; parameterized exports; both PowerShell targets.
- **Accessibility:** complete keyboard path, visible focus, correct names/roles/states, live announcements without noise, no hidden focus targets, dialogs at bottom scroll, inside-click/drag protection, Escape and focus return.
- **Responsive layout:** 1440×900 desktop, 1280×720 laptop, approximately 768px tablet, 390×844 phone, 320px width, and 200% zoom/reflow. No page-level overflow; bounded code/table scrolling only where justified.
- **Stress:** long titles/targets, many blocks, mixed groups, empty library/search, incomplete workflow, conflicting output destinations, disabled storage, motion on/off/reduced.
- **Preview/export fidelity:** selected-code mapping in both modes; clipboard and .ps1 contain actual intended script only; no UI markers, stale output, or invented result counts.
- **Runtime health:** no new browser console errors, unhandled promises, broken assets, or unsafe HTML insertion from user values.

## Progress tracking — maintain during implementation

For each phase, append a short entry with:

```text
Phase:
Status: not started / in progress / verified / blocked
Requirements addressed:
Behavior and files changed:
Checks run and results (including skips):
Desktop/mobile and recovery evidence paths:
Known limitations or deferred work:
User review outcome, if applicable:
Exact next step:
```

### Phase checklist

- [x] Phase 0 — Baseline and scope
- [x] Phase 1 — Clarity and compactness
- [x] Phase 2 — Input sources and composition contracts
- [x] Phase 3 — Labeled connectors
- [x] Phase 4 — Group behavior and presets
- [ ] Phase 5 — Four meaningful recipes
- [ ] Phase 6 — Library navigation and landing proof
- [ ] Phase 7 — Integration and final verification

### Requirement reconciliation

- [x] R01 Compact blocks — Phase 1 comparison and stress evidence verified.
- [x] R02 Visual hierarchy — Phase 1 selected state, quieter cmdlets and explicit impact labels verified.
- [x] R03 Readable operational text — Phase 1 desktop/mobile/reflow evidence verified.
- [x] R04 Persistent script context — Phase 1 edit, scope, count, undo and reload checks verified.
- [x] R05 Visible composition — Phases 2–3 verified: order, results, conditions, shared inputs and collection remain distinct and inspectable.
- [x] R06 Unambiguous input sources — Phase 2 verified: one selector owns each field's custom/shared/result/bulk source.
- [x] R07 Explicit modification scope — Phases 2–3 verified for supported local service-result links: query/mapping/scope shown and exact acknowledgement required. Phase 4 preserves this gate and invalidates acknowledgement when inherited settings change.
- [ ] R08 Library information architecture — deferred to Phase 6.
- [x] R09 Precise status language — Phase 1 export/configuration/stale/requirements distinction verified; Phase 4 preserves export/configuration/stale distinctions and honest Succeeded/Failed/Skipped attempt outcomes.
- [x] R10 Group behavior presets — Phase 4 verified: reviewed presets, effective origins, overrides/reset, membership, unsupported capabilities, file effects and portability.
- [ ] R11 Four useful workflow recipes — deferred to Phase 5.
- [ ] R12 Landing clarity and accurate copy — AD copy verified in Phase 1; connected landing proof deferred to Phase 6.
- [ ] R13 Interaction/accessibility continuity — verified through Phase 4; Phases 5–7 and final reconciliation remain pending.

### Definition of done

The plan is complete only when all agreed phases and requirements are verified, remaining exceptions are explicitly disclosed, the local instance is reviewable, regression and accessibility evidence covers the final code, documentation matches behavior, and no unrequested publication has occurred. A partially drawn connector UI or a happy-path demo is not completion.

## Technical references

- Repository: `docs/development.md`, `docs/features.md`, `docs/accessibility-audit.md`, and existing tests are the starting sources of truth; inspect actual code when documentation differs.
- PowerShell object pipelines and parameter binding: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_pipelines
- WhatIf/Confirm and ShouldProcess support: https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-shouldprocess
- Recheck official documentation when extending PowerShell semantics. A visual connection does not establish pipeline compatibility or guarantee confirmation/preview coverage.

## Initial handoff entry

- Status: plan authored; implementation has not started.
- Scope: all recommendations from the UI/UX audit and connected-workflow discussion are enumerated above.
- Baseline repository was clean at plan creation; this Markdown file is the only intended new change from the planning request.
- Next step: read applicable instructions, inspect the checkout, and perform Phase 0. Then implement Phase 1 within the user's authorized cadence.

## Implementation log — October 16, 2026

### Phase 0
- Status: verified.
- Requirements addressed: baseline for R01–R13; all retained in the checklist above.
- Baseline: `main`, `5810ea017916cbe3678af9647cec5838735fa03a`; remote `main` verified with `git ls-remote`. Only the untracked plan existed before work. No applicable AGENTS.md found in repository or ancestor directories. Node 24.15.0, npm 11.12.1, installed Playwright/axe/fast-check and Edge available.
- Architecture reviewed: composition/condition references are currently indices remapped by UI reorder; shared values resolve through execution.js; recipe groups persist in workspace/project data; report steps collect previous outputs. Retain these authorities in Phase 1. Four health steps are ungrouped; newer input-based recipes are grouped. Start-Service already reads status back. Phase 2 retains responsibility for source ambiguity and scope acknowledgement.
- Preview: existing server at http://127.0.0.1:4179/builder.html serves this checkout. No existing process stopped. Browser tests use 4190. Sandbox localhost access failed; browser checks run with approved external access.
- Checks: build and docs:check pass; npm test 69/69, zero skips, including Windows PowerShell 5.1 and PowerShell 7 parser/isolated mock fixtures. Baseline browser: 116 passed, one failed, one intentional mobile skip for desktop dividers. Existing failure: `enhancements.spec.js` expected 23% after an ArrowRight from the current 25% default; actual 26% was correct. Phase 1 corrects this assertion to check exactly +1 from the measured starting value. No generated scripts run against live systems.
- Evidence: `docs/evidence/command-bench/phase0/` includes desktop/mobile landing, four-step health workflow, sourced service input, collapsed group, stale/recovered preview, and scrolled library/guide. `metrics.json`: collapsed cards 126.5px desktop and 130.5px phone; no horizontal overflow or page errors. Reduced motion used for screenshots; motion enabled and pause separately checked. Capture tool: `tools/command-bench-evidence.js` uses fresh browser contexts.
- Sequencing: user explicitly authorized Phase 0 followed by Phase 1; pause after Phase 1 for local review. No commit, push, or deployment authorized.
- Exact next step: implement Phase 1, then capture matching evidence and run regression/accessibility checks.

### Phase 1 — implementation brief
- Status: verified; awaiting user local review.
- Requirements addressed: R01–R04, R09, R13; R12 copy correction only.
- UX/ergonomics contract: administrator repeatedly discovers → configures → reviews → exports. Preserve the three-panel command surface, keyboard search, existing editing/validation ownership, autosave and undo. Make title, target, and impact scannable; keep reorder/remove visible and duplicate/reset in the action disclosure. Configuration readiness never means machine verification. Invalid input stays in its field; stale preview remains visible and non-exportable.
- Web decision: targeted repair in existing static HTML/CSS/JS; retain fonts, logo, purple/mint identity and appearance.js motion ownership. Use quieter cmdlet text and readable 12px operational labels. A persistent context strip uses current workspace data and links directly to existing settings/review dialogs. Mobile retains stage tabs and wraps context without losing the editor's independent scrolling.
- State/evidence contract: empty, configured, incomplete, stale, selected/collapsed, dynamic targets, long text, undo/reload, keyboard/focus and motion. No loading/runtime-success state is invented. Compare identical four-step viewports, inspect mobile/laptop/tablet/320px and 200% equivalent reflow, test context changes and preserve existing dialog/export tests.
- Deferred: R05–R07 to Phases 2–3; R08 to Phase 6; R10 to Phase 4; R11 to Phase 5; R12 connected landing proof to Phase 6; cross-phase R13 reconciliation to Phase 7.
- Implementation: `dist/builder.html`, `dist/styles.css`, `dist/js/app.js`, and display-only `dist/js/script-context.js`. No generator, template, schema, source-link, or condition changes. Compact cards retain visible arrows/remove and menu-based duplicate/reset. Context derives scope from resolved shared/bulk/parameter/fleet values; settings reuse one opening function. Requirements review now includes fleet targets and full configured scope. AD landing copy matches the three inserted actions. User-facing behavior documented in `docs/features.md`.
- Repairs during verification: an accessible-name mismatch was fixed; a wrong test fixture assumption about restart's default WhatIf setting was corrected by explicitly selecting preview mode. Visual inspection caught unusably short editor space at 720×450 despite no overflow; short-window panels now retain scrollable editing/code space. The stress test now requires actual usable content height.
- Final checks: `npm run build`, `npm run docs:check`, and `git diff --check` pass. `npm test`: 71 passed, zero skips, including both native PowerShell runtimes. Final-code `npm run test:browser`: 123 passed, one intentional mobile skip for desktop-only divider dragging. The full suite includes `test:a11y`: 46 scenarios, 89 scans, zero violations in the retained reports, plus strict axe checks in Command Bench and responsive stress tests. No duplicate accessibility suite needed. PSScriptAnalyzer not rerun: generator/templates/schema were unchanged.
- Evidence: `docs/evidence/command-bench/README.md` indexes baseline and final screenshots. Each phase retains engine/browser logs and metrics. Phase 1 retains `accessibility-summary.json` and stress captures at 1440×900, 1280×720, 768×900, 390×844, 320×844 and 720×450. The latter simulates the CSS viewport available at 200% zoom on 1440×900; manual OS/browser zoom and assistive-technology certification were not performed.
- Acceptance: identical four-step cards reduced from 126.5px to 96px desktop (24.1%) and 130.5px to 100px phone (23.4%). Long targets wrap; long identity remains accessible through Edit settings; full scope is available in Requirements to review. Context reflects add/remove, version and target edits, preview/live impact, fleet settings, Undo and reload. Stale output remains non-exportable. Logo/palette, animations, motion pause/reduced motion, selected-code mapping, portability and scrolled-dialog dismissal all retain passing regression coverage. Rendered desktop/mobile, incomplete/recovered, selected/collapsed, and short-window states were inspected, not only captured.
- Known limitations: existing service-source ambiguity and dynamic modifying-scope acknowledgement remain explicitly deferred to Phase 2. Automated keyboard/axe checks do not certify screen-reader behavior. Real remote systems, AD and service modifications were not executed. User's saved browser draft was not used by verification. Unrelated screenshots rewritten by the suite were restored; intentional evidence is confined to the new evidence directory.
- Local review: http://127.0.0.1:4179/builder.html opened in the app browser. No commit, push or deployment performed. User review outcome: pending.
- Exact next step: pause at the Phase 1 boundary for user review. Address Phase 1 feedback locally; begin Phase 2 only after user authorization. All remaining phases are unstarted.

### Phases 2–3 — authorized combined batch
- Status: verified; awaiting user local review. User explicitly authorized both phases together, local only, stopping for review.
- Requirements addressed: R05–R07 and continuity under R13.
- Relationship contract: persisted `inputSourceId` and connectivity `condition.sourceId` are canonical. The relationship UI is a derived view; it stores no second mutable edge graph. Generation resolves IDs to current indices for PowerShell variable names. Legacy v1 numeric references migrate at draft/library/project/share load. Project schema v2 carries remappable IDs; v1 remains readable. Missing/deleted/future dependencies stay visible and block export rather than being discarded. Import permits repairable semantic connection errors while rejecting malformed schemas and unsupported commands/settings.
- UX contract: one source selector per supported field, with Custom / Shared / Earlier results / Bulk choices only where supported. Result mapping exposes Name → Service name, upstream scope and unknown runtime count. All linked scopes need an explicit acknowledgement tied to the source identity and exact effective configuration; query/target/flag edits invalidate it. Suggestions add steps without wiring. Service Name handoffs are restricted to single-computer local contexts; broader remote mapping is unsupported and explained.
- Phase 3 contract: vertical stack retained; Then describes order only, Use results and Only if inspect real relationships, and shared inputs/report collection have separate labels. Inspection edits/removes the authoritative relationship. Collapsed groups retain compact inspectable connection summaries. No execution animation or invented results.
- Behavior/files: `relationships.js` owns ID migration/resolution; `composition.js` owns link/scope validation and acknowledgement; `input-source-controls.js` renders authoritative field sources; `relationship-view.js` derives inspection data. Updated workspace/project serialization, condition controls, generator guards, app interactions, result schema for automatic stopped services, builder dialog and styles. Existing tests follow new controls and migration; new engine/browser contract tests cover the added behavior. `docs/features.md` and `docs/development.md` explain sources, scope and project v2 compatibility.
- Phase 2 gate: non-adjacent Name links export only after explicit scope review; conflicting source modes, wrong type/order, missing Name, source file exports and incompatible remote/fleet/bulk contexts block export. Relevant edits clear a stale acknowledgement in the UI; imports cannot transfer acknowledgement between identical but distinct sources. Custom values remain available when switching back. Old v1 projects/index references migrate; v2 projects, draft/library restore and share links reidentify references together. Missing sources remain repairable after reload/import. Both runtimes and both code modes were exercised with mocks for empty, failed, missing-Name and preview cases; no real service/AD/remote changes ran.
- Phase 3 gate: Then changes no generated behavior. Use results and Only if name actual non-adjacent sources; Shared input and Collect results are distinct. Inspector edit/remove paths operate on authoritative fields and support keyboard, Escape and focus return. Collapsed groups retain inspectable links and errors. Source reorder, delete/Undo, duplicate, required-field removal and recovery remain accurate. Selected-code mapping works in both modes and exported scripts contain no UI metadata. Suggestions add without automatically connecting.
- Repairs: preserved unchanged connector DOM during field blur to avoid losing the first click/focus; aligned accessible names with the full visible connector label; preserved unavailable condition choices; scope descriptions now resolve shared inputs and identify runtime parameters. Existing source/readback behavior was reused; zero-input follow-ups now explicitly skip rather than count as successful executions.
- Checks: build, docs:check and diff --check pass. Final `npm test`: 78 passed, zero skips, including native PowerShell 5.1/7 parser and isolated mocks. Complete browser suite: 129 passed, one intentional mobile skip for desktop-only divider dragging. After the final scope-description correction, focused context/source/responsive checks: 12 passed. Complete suite includes accessibility (46 report scenarios, 90 scans, zero violations) plus strict new inspector, scope and 320px checks; no duplicate test:a11y run needed. PSScriptAnalyzer workflow attempted but unavailable: pinned module 1.24.0 is absent. Exact diagnostic retained; no software installed.
- Evidence: `docs/evidence/command-bench/phase23/` retains full/final-focused browser logs, final engine log, analyzer diagnostic, accessibility summary, matching desktop/mobile discovery/recovery/source/group/dialog captures, missing-source and unreviewed/reviewed connection states, inspector, and all requested responsive sizes. Final source-contract screenshots cover 1440×900, 1280×720, 768×900, 390×844, 320×844 and 720×450 CSS-pixel reflow; inspected desktop, phone, 320px and short-window states. Motion on/off/reduced, existing dialogs, previews, clipboard/download, saved library and sharing retain passing regression coverage. Test-generated unrelated screenshots were restored.
- Known limits/deferred work: result handoffs intentionally support local single-computer service Name mapping only; unsupported remote/fleet/bulk combinations explain how to repair. Runtime affected count remains unknown until execution. Acknowledgement is a persisted configuration review, not environment verification or a runtime count preview. Project v2 requires this or a newer build; v1 remains readable. PSScriptAnalyzer remains unverified until its pinned module is available. Manual assistive-technology certification and actual browser/OS zoom are unverified; 200% equivalent CSS reflow was tested. R08/R10/R11 and the rest of R12 remain assigned to later phases.
- Local review: http://127.0.0.1:4179/builder.html. The prior server had stopped; a new preview was started on 4179 without terminating an unidentified process. Verification used isolated contexts, not the user's saved draft. No commit, push or deployment performed. User review outcome: pending.
- Exact next step: stop for review at the Phase 3 boundary. Address feedback on Phases 2–3 locally. Begin Phase 4 only after user authorization; Phases 4–7 are unstarted.
- Final visual-check repair: an initially incomplete restored workflow now says “Draft incomplete · No valid preview” rather than claiming a previous valid preview exists. Existing last-valid output still says Out of date. The focused desktop/mobile source/recovery checks passed again (2/2); `preview-status-tests.log` and refreshed source screenshots record this final label change. Final diff whitespace and JavaScript syntax checks pass.

### Phase 4 — authorized local implementation
- Status: verified; awaiting local review. User authorized Phase 4 only.
- Requirements addressed: R07, R09–R10 and continuity under R13.
- UX/implementation contract: keep existing recipe groups and make newly inserted starters consistently grouped. Persist group defaults plus explicit per-step override markers; command values remain the owner of explicit step values. One pure resolver serves generation, validation and displayed effective values. Resolution: command/recipe values → supported group defaults → explicit step overrides → script-wide dry run. Preview/confirmation groups reject incompatible live/confirmation overrides and unsupported modifying commands; never silently run unsupported changes.
- Controls: Targeting (shared computer input for commands with a computer field), Change behavior, Failure handling, Evidence (verbose), and Results (existing report/file effects). Fleet, transcript, preflight and execution summaries remain explicitly script-wide. Diagnostic collection, Preview supported changes and Apply with confirmation presets set only their documented group defaults; no Force changes or invented report collection.
- Review contract: show every affected step, before/after values, retained overrides, unsupported capabilities and file effects before applying. Live changes or loss of confirmation require an explicit acknowledgement. Membership changes and reset-to-inherited paths use the same review and Undo model. Existing drafts/projects retain nondefault legacy step choices as overrides. New project schema v3 prevents older builds from silently dropping inherited behavior; v1/v2 remain readable.
- Exact resume point: Phase 4 implementation and verification complete. Stop for user review. Address feedback locally; do not start Phase 5 or publish without authorization. Prior Phases 1–3 local changes remain intact.
- Implemented: all newly inserted starters share the existing semantic group model, with editable name/intent and visible membership. Behavior & presets reviews changes before applying; Step actions reviews membership changes and new groups. The effective resolver drives flags, origins, summaries, shared-input connectors, target scope, validation, scope acknowledgement and PowerShell generation. Command-specific parameters remain in their blocks. Shared inherited computer inputs are read-only until explicitly overridden; dormant bulk/parameter sources are not presented as effective. Report failure policy and paths are retained.
- Safety/recovery: Force is never changed by a group preset. Preview groups block unsupported modifying commands and live overrides; confirmation groups block unsupported confirmation and false-confirm overrides. Live transitions, loss of confirmation and leaving an unsupported preview group require acknowledgement. Script-wide dry run wins over all step/group settings; disabling it is reviewed when it enables live behavior. Invalid applications retain the last valid code as Out of date, with copy/download blocked. Cancel preserves the settings draft; apply/reset/move have Undo and focus recovery.
- Acceptance evidence: presets and generated flags agree across PowerShell 5.1/7 and Commented/Compact modes. Explicit overrides survive presets; reset restores inheritance. Group move/create, duplicate, Undo, reload, v1/v2 migration, v3 project export/import and share round trips are covered. Inherited target parameters resolve consistently with generation. A group preset changing effective flags invalidates linked-scope acknowledgement. Stable result-source identities remain authoritative; incompatible relationships stay visible for repair. Runtime counts are unknown until execution.
- Checks: build, docs:check, JavaScript syntax and diff whitespace checks pass. Final complete engine suite: 88 passed, zero skips, including native 5.1/7 parser checks and isolated fixtures/mocks. Final complete browser suite with two independent workers: 139 passed; one intentional mobile skip for desktop-only divider dragging. Final focused Phase 4 checks: 10 passed. Complete suite includes 46 accessibility reports / 90 scans with zero automatic violations; additional group-dialog/review scans also pass. No redundant test:a11y run. PSScriptAnalyzer workflow attempted; required module 1.24.0 is absent, so analysis remains unverified. Diagnostic retained; no software installed.
- Rendered evidence: `docs/evidence/command-bench/phase4/` includes test/analyzer logs, accessibility summary, desktop/mobile four-step comparisons, source/invalid/recovered/group/scrolled-dialog states and motion checks. `visuals/` includes live-change review, unsupported capability, last-valid-preview recovery, explicit file effects and group settings/effective values at 1440×900, 1280×720, 768×900, 390×844, 320×844 and 720×450. Desktop review, phone effective values, 320px settings, normal four-step desktop and collapsed mobile groups were inspected. No document overflow or browser page errors in the isolated evidence flow. Native browser/OS zoom and manual screen-reader certification remain unverified; CSS reflow was covered.
- Known limits: group targeting applies only to commands exposing a computer field; other commands retain their own targeting and disclose that limitation. Fleet, transcript, preflight and summary scope stay script-wide. Presets do not create reports or infer machine health. Required module imports still stop. Combined reports retain their own failure policy and file effects. Project v3 needs this or a newer build; v1/v2 remain readable. Existing local service-Name mapping limits remain. No real service, AD or remote modifications ran.
- Local review: http://127.0.0.1:4179/builder.html?review=phase-4. The existing server serves the new module (HTTP 200); no unidentified process was terminated. Verification used isolated contexts and preserved the user's saved draft. Prior local work remains intact; unrelated test-generated screenshots were restored. No commit, push or deployment performed. User review outcome: pending. Phase 5 is unstarted.

### Publication authorization — October 16, 2026
- User explicitly requested: “push everything to main please.” This authorizes committing and pushing all current work through Phase 4 to origin/main and supersedes the earlier local-only delivery boundary for this batch.
- Pre-publication check: checked out main; GitHub main still matches baseline 5810ea0. Whitespace verification passes. The completed Phase 4 checks remain 88 engine tests and 139 browser tests passed, with one intentional browser skip; the recorded PSScriptAnalyzer limitation remains.
- Publication scope: implementation, regression tests, documentation, progress tracking and retained evidence for Phases 0–4. Phase 5 remains unstarted and requires separate authorization.
