# Verification and release limits

`pnpm check` runs TypeScript, ESLint, formatting, automated tests and all browser builds. The build checks manifest popup, options, background, content-script, icon and local HTML asset references. Production manifests declare optional website access; no required broad host grant is added.

`pnpm test:browser` loads an isolated Chromium test copy and a local fixture server. Only the test copy receives a required fixture-origin host grant. It exercises registered content scripts, repeat navigation, DOM mutation, SPA routes, hashes, fallback context, consented loopback service transport through the production CSP, explicit user geography, manual resource results, side-panel opening, access removal and extraction of all 150 authored HTML fixtures. It saves a screenshot and `test-results/browser-acceptance.json`. It does not prove optional permission dialog behavior or semantic quality.

Backend integration tests use a real loopback HTTP listener with mocked provider transport. They verify origin rejection, input bounds, persistent daily quotas, timeout cancellation, error redaction, and rejection of fabricated quotations. No real provider key is used.

## Evaluation

`pnpm eval --analyzer legacy|fallback|remote [--split all|development|calibration|reserved_test]` writes JSON and Markdown reports. Remote evaluation requires operator endpoint/extension-origin configuration and makes real provider requests through the service. There is no mock accuracy substitute. Reports include exact leaf accuracy, parent accuracy, strict and hierarchical multi-label metrics, civic detection, unknown/non-civic detection, status confusion and raw confidence-bin diagnostics.

The frozen corpus has 150 synthetic cases: 120 civic, 20 non-civic, eight unknown and two insufficient. Author labels are not independent annotation. Splits are visible in source and must not be described as a blind held-out benchmark. Gold PageRepresentations isolate classifier behavior; browser extraction checks bounds separately. Real-world end-to-end classification quality is not established by either test alone. The server prompt excludes taxonomy example texts to avoid copying fixture examples into inference.

## Manual acceptance still required

- Install the production Chrome folder, accept/deny optional website access, restart Chrome and navigate across multiple allowed sites without another prompt.
- Revoke permission through Chrome’s extension UI and confirm reading stops. Test allow-one-site, denied sites and restricted browser/store pages.
- Configure a real semantic provider; run the full corpus and independently inspect food insecurity, racial/gender discrimination, healthcare overlap, ambiguous and non-civic examples. Examine unsupported evidence failures, not just accuracy.
- Test social-post selection, expansion, scrolling, navigation and rapid changes on real sites; unusual DOMs, canvas content, shadow roots and nested frames may not extract correctly.
- Exercise Firefox and Edge natively. Their build validation alone is not a compatibility claim.

No real hosted semantic run has been completed in this environment. The separate `pnpm test:live` runner fails unless it obtains a real provider result and renders relevant resources. Confidence is uncalibrated. No local semantic model has been benchmarked or shipped.
