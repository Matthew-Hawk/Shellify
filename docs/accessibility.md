# Accessibility checks

See the [accessibility audit](accessibility-audit.md) for scan coverage, fixes, and the contrast report.

Run `npm run test:a11y` with Node.js 22.12 or later. The Windows CI job uses Node.js 24 and retains the JSON reports as `accessibility-scans` for 14 days. The reports preserve all violations, incomplete checks, and passing rule counts.
