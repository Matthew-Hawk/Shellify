# Command Bench implementation evidence

Captured October 16, 2026 in isolated Edge contexts. No user browser profile, saved draft, or live PowerShell targets were used.

- `phase0/desktop-four-steps.png` and `phase1/desktop-four-steps.png`: identical four-step health workflow at 1440×900, all steps collapsed.
- `phase0/mobile-four-steps.png` and `phase1/mobile-four-steps.png`: the same workflow at 390×844.
- Each phase also includes landing, stale output, recovered output, service-result input, collapsed recipe group, and scrolled library/guide states on both viewports.
- `metrics.json` in each phase records card heights, horizontal containment and browser errors. Baseline heights: 126.5px desktop / 130.5px phone. Phase 1: 96px / 100px (24.1% / 23.4% reduction).
- Phase 1 `stress-*.png`: long script title, command title and targets at desktop, laptop, tablet, phone, 320px, and 720×450 CSS-pixel reflow (equivalent available CSS space to 1440×900 at 200% zoom). This is a reflow simulation, not a manual OS/browser zoom certification.
- `reflow-preview.png`: export controls remain reachable by scrolling the short-window preview panel; code retains a usable scroll area.
- Test logs and accessibility scan summary are retained alongside the screenshots. Full raw axe results are generated in ignored `test-results/` on each suite run. The summary retains scenario names, scroll phases, violation details, and incomplete-rule IDs; automated scans do not replace screen-reader testing.

Reproduce current-code captures with the app serving this checkout on port 4179:

```text
node tools/command-bench-evidence.js phase1
npm run test:browser
```

Do not recapture `phase0` on modified application code: those images document commit `5810ea0` before Phase 1. The capture command verifies motion on/off/reduced separately; screenshots use reduced motion. Browser suite tests additionally cover both dialog backdrops after scrolling, inside-click/drag protection, Escape and focus return.

See [the implementation plan](../../command-bench-evolution-plan.md) for acceptance, limitations, requirement reconciliation and the exact next step.

## Combined Phases 2–3

`phase23/` contains the latest local result. The standard capture script can reproduce the current general flows with `node tools/command-bench-evidence.js phase23`.

- `desktop-four-steps.png` / `mobile-four-steps.png`: plain Then labels describe sequence, without inventing a result handoff.
- `*-connected-reviewed.png`, `*-scope-unreviewed.png`, `*-source-missing.png`: reviewed mapping, blocked scope, and recoverable missing source.
- `*-collapsed-group.png`, `*-connection-inspector.png`, `*-distinct-relationships.png`: group inspection and separate result/condition/shared/report relationships.
- `*-source-contract-WIDTHxHEIGHT.png`: final scoped input controls across all requested viewport sizes, including 320px and short-window reflow.
- `browser-tests.log`: 129 passed, one intentional mobile skip. `final-focused-browser-tests.log`: 12 passed after the final scope-description correction. `engine-tests.log`: 78 passed with no skips. `accessibility-summary.json`: 46 scenarios / 90 scans / zero violations; additional strict axe checks run in the source/inspector tests.
- `analyzer-unavailable.log`: documented analyzer workflow could not load PSScriptAnalyzer 1.24.0. Native parser and isolated runtime mock tests passed in both PowerShell runtimes and both export modes.
- `preview-status-tests.log`: final desktop/mobile recovery checks (2 passed) verify that an incomplete restored workflow without valid output does not claim to display a previous preview.

Reproduce focused connection evidence with `npm run test:browser -- browser-tests/composition-contracts.spec.js`. Tests generate their PNGs in ignored `test-results/`; intentional review copies are retained here. All captures use disposable browser contexts and illustrative fixtures. No scripts ran against live service, directory, or remote targets.
