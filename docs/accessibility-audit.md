# Accessibility audit

Run `npm ci`, then `npm run test:a11y` to repeat the axe scans. The accessibility suite also runs as part of `npm run test:browser`, including the existing Windows CI job.

## Coverage

The suite scans 23 states in both desktop (1440 × 900) and mobile (390 × 844) viewports:

- Landing page, enabled motion control, Files and Directory examples, and an expanded FAQ.
- Builder Discover, Configure, and Preview; descriptive catalog, search results, and the end of the catalog.
- Open Settings, step actions, and Search tips.
- Guide, Script settings, saved script library with a generated share link, Shared inputs, shared parameter inputs, Script review, and workflow input dialogs.
- Expanded advanced options, troubleshooting, result fields/filters/sorting, sample output, and step parameter controls.

Dialogs and configuration forms are also scanned while scrolling through their contents. Each scan runs all default axe rules; no rules or elements are excluded. Serious and critical violations fail the test. Full violations and incomplete checks are attached as JSON, with a per-state `axe-results.json` in `test-results/`. Passing rule counts are included, and CI retains reports in the `accessibility-scans` artifact for 14 days, including on failure.

Animations are disabled through the browser's reduced-motion preference for stable scans. External requests are blocked, matching the rest of the browser suite; optional Google Fonts use their system fallbacks.

## Findings and fixes

The original 38 accessibility scenarios passed with zero reported violations. The expanded suite additionally covers landing examples, enabled motion, search results, and generated share links; run `npm run test:a11y` to repeat all 46 viewport/state scenarios.

The initial scan found serious `label-content-name-mismatch` violations. No critical violations were found.

| Control | Problem | Fix |
| :--- | :--- | :--- |
| Motion toggle | Its accessible name omitted the visible “Motion on/off” text. | Include the visible state followed by “Pause animations” or “Enable animations,” including the initial HTML label. |
| Command cards | The overriding accessible name omitted visible descriptions and impact badges. | Let the visible card content provide the name, with a visually hidden “Add” or “Add workflow” prefix. This follows compact/descriptive mode automatically. |
| View requirements | Its accessible name said “Review script requirements.” | Include “View requirements” before the existing explanation. |
| Reset defaults | “Reset step N to defaults” did not contain the visible label as a continuous phrase. | Use “Reset defaults for step N.” |

The builder's missing level-one heading was also corrected. Panel headings now follow at level two; the mobile page title remains available to assistive technology while staying visually hidden. Typography and layout were preserved. Before/after screenshots of both pages at both viewports had zero changed pixels with reduced motion and system fonts.

## Contrast and color tokens

The scans found **no confirmed `color-contrast` violations**. No color-token changes are proposed or applied; the palette remains unchanged, including `--bg: #111126`, `--panel: #1a1a35`, `--text: #f4f2fa`, and `--muted: #b2bad4`.

Axe returns incomplete contrast checks for some gradient-backed text, overlapping or partially obscured content, and symbol-only labels. These are retained in the JSON reports for manual review; they are not passing contrast results or confirmed contrast failures. The automated result does not establish full contrast compliance for those elements, other fonts, hover/focus states, or other motion frames. A failing foreground/background pair should be confirmed before selecting a replacement token.

[Documentation](README.md)
