# Phase 4 local review evidence

The implementation adds semantic workflow groups, reviewed behavior presets, inherited effective settings and explicit overrides. Presets never alter Force. Unsupported preview/confirmation commands and conflicting safety overrides block export. Fleet, transcripts, preflight and execution summaries remain script-wide.

Reproduce locally: open `http://127.0.0.1:4179/builder.html`, insert a starter workflow, and choose **Behavior & presets** in its group header. Select a preset, review the per-step changes and retained overrides, then apply. Live changes or removal of confirmation require acknowledgement. Open a block's **Effective behavior & overrides** to inspect values and origins; edit a field to override, reset to inheritance, or use Undo. Step actions can create a group or move a member with review.

Engine verification uses isolated fixtures and mocked PowerShell commands only. No generated service, Active Directory or remote modification was executed against a real system. Browser tests use disposable contexts and do not replace the user's saved draft.

- `engine-tests.log`: complete engine suite, including native PowerShell 5.1/7 parser and fixture checks.
- `browser-tests.log`: final complete desktop/mobile browser suite, including accessibility.
- `browser-focused.log`: focused Phase 4 checks after repairs.
- `browser-initial.log`: initial full run; two test interaction failures came from using `uncheck()` on a guard that deliberately keeps the checkbox checked while awaiting review. Changed to an actual click with subsequent review-state assertions.
- `analyzer.log`: required PSScriptAnalyzer 1.24.0 is absent; this check is unverified, and no module was installed.
- `accessibility-summary.json`: retained rule results from the full suite. Incomplete automatic rules are recorded for manual review; zero automatic violations is not assistive-technology certification.
- `visuals/`: preset review, unsupported states, recovery and file effects; group settings/effective values at 1440×900, 1280×720, 768×900, 390×844, 320×844 and 720×450. Reduced motion stabilizes captures; the full suite separately exercises motion settings.

Project schema v3 retains group behavior and overrides. v1/v2 projects remain readable; older builds cannot safely open v3 projects. Runtime counts remain unknown until execution. Shared group computer targeting is limited to commands that expose that field; other members retain their own targeting and say so in review.

All changes are local. Phase 5 is not started. User review is pending.
