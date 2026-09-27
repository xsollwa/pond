> Historical Phase 1 checkpoint. Runtime integration has since been implemented; see README.md and testing.md for current status and remaining limits.

# Content Intelligence redesign — Phase 1

Status: implemented foundation and evaluation baseline, September 24, 2026. This is the **first phase of the newly approved redesign**, separate from the earlier TypeScript refactor that was also called Phase 1.

## What changed

- `src/intelligence/taxonomy.ts`: taxonomy version 2.0.0 with 12 domains and 50 leaf issues. Each entry has a definition, exclusions and examples. Food insecurity is under economic security. Race, gender, disability, LGBTQ and religious discrimination have explicit civil-rights entries. These are semantic definitions, not new classifier keyword dictionaries.
- `src/intelligence/contracts.ts`: strict runtime schemas and inferred TypeScript types for structured `PageRepresentation`, multi-label `IssueAnalysis`, normalized geography and `ContextObject`. The new `IssueAnalyzer` supports cancellation and returns structured, versioned analysis. Provider modes distinguish deterministic fallback, local semantic and server semantic; only the baseline is implemented now.
- `src/intelligence/context.ts`: validated context assembly and deterministic representation fingerprints. User location defaults to null and must be supplied independently. Fingerprinting is a foundation for the planned cache, not a completed cache or background lifecycle.
- `src/intelligence/legacy-baseline.ts`: evaluation-only bridge to the unchanged keyword analyzer. Broad legacy outputs stay parent categories; only gun policy has an unambiguous one-to-one leaf mapping. No inferred specificity, populations or locations are manufactured.
- `src/evaluation/`: corpus validation, metric arithmetic, readable/JSON reporting and the baseline runner.
- `tests/fixtures/intelligence/`: 150 distinct original scenarios, gold representations/labels, and matching basic HTML snapshots. None was obtained from personal browsing or a private account.

The popup still imports the previous runtime pipeline. Website permissions and production classification have **not** changed in this phase. The legacy analyzer is retained to measure its failures and keep the extension working until the later integration phases. It is not being promoted as the semantic solution.

## Contracts and boundaries

`PageRepresentation` separates title, descriptions, OpenGraph, structured data, headings, paragraphs, selected/expanded posts and replies into evidence blocks. Each block carries an ID, source role, visibility, centrality, group and importance. The schema supports up to 32 blocks, 3,000 characters per block and 16,000 characters overall. It rejects unknown fields and raw URL/history additions. This does not yet implement extraction, PII sanitization or consent checks. A domain and text can still be sensitive; schema validation alone does not make a payload safe to transmit.

`IssueAnalysis` contains primary/secondary taxonomy labels, confidence, civic relevance, problem/action flags, entities, explicitly claimed populations, content geography, jurisdiction and evidence references. Four statuses remain distinct: civic, unknown, not_civic and insufficient. Provider failures are errors, not a non-civic answer. A civic result can have multiple supported labels without forcing a primary when none is defensible.

Validation rejects unknown taxonomy IDs, mismatched label text, invalid scores, duplicate labels/evidence, unknown evidence references and quotes absent from the supplied representation. It cannot prove that a quote logically supports a claim; semantic evaluation and provider prompting must address that. Provider-declared calibration requires a version identifier but is not itself proof of calibration.

`ContextObject` deliberately nests the validated analysis alongside independently provided user location and a representation fingerprint. It contains no complete page or raw blocks. Evidence snippets remain sensitive and transient. Content and user locations are separate; missing user location never becomes Princeton or the article's location. Coordinates require the consented-geolocation provenance marker. Actual browser permission and consent enforcement belong to the location subsystem in Phase 5; a marker alone is not permission.

`ContextOpportunityQuery` defines the later retrieval boundary. Existing opportunity data and ranking remain on the old types until the migration phase; no broad opportunity tags are silently relabeled as precise subtopics now.

## Corpus and label quality

There are 120 civic cases (23 with secondary labels), 8 ambiguous cases, 2 insufficient pages and 20 non-civic cases. All 50 leaf issues appear. Scenarios include food access with medical vocabulary, race/gender discrimination in medical treatment, disability barriers, food/transit overlap, housing and climate, worker leave and healthcare, immigration status, voting, criminal justice, recipes, programming workers, fictional cities and other vocabulary traps.

The stories are independently worded **synthetic diagnostic scenarios labeled by the implementation author**, not independently annotated real-world examples. Some explicitly explain why a competing category is inappropriate; this is useful for negation regression but is not natural-news distribution. The seven format tags and basic HTML shells do not constitute validation against actual Reddit, social-feed or government-site DOMs. Their gold PageRepresentations currently contain a title and a central paragraph/post; richer extraction artifacts belong to Phase 3. Separate contract tests exercise other block types and limits.

A content-independent hash assignment freezes 90 development, 30 calibration and 30 reserved-test cases. IDs/families cannot cross splits; duplicate body text is rejected. The source-visible reserved set has **not** become an independently held-out benchmark merely by receiving that name. No calibration has been fitted. Before release, expand independently reviewed public-page data, adjudicate disagreements, reserve an untouched external test set and measure extraction separately from analysis.

The fixture digest binds the expected labels and representations. Changes require intentional annotation review and a corpus version/digest update. Do not update labels to match a model's errors. The baseline's poor accuracy is expected and not a reason to alter gold labels.

## Run the evaluation

```sh
pnpm eval
pnpm eval --split development
pnpm eval --split calibration
pnpm eval --split reserved_test
```

The default evaluates all 150 cases. Only `--analyzer legacy` is currently implemented. Asking for another analyzer fails explicitly; it never substitutes a fake semantic result. The command makes no model/network calls and prints a readable report, with per-case JSON and Markdown saved under `test-results/intelligence/legacy-<split>.*`.

The baseline receives only the fixture's PageRepresentation, never its expected labels, rationale or split. Its output is schema- and evidence-validated before scoring. The runner exits unsuccessfully on corpus/provider/schema failures. Low classification quality produces an honest report, not a false green quality claim. No semantic release threshold has been approved or met in this phase.

Metrics:

- Exact primary leaf accuracy on civic examples; parent-domain accuracy reported separately.
- Strict all-label precision, recall and micro/macro F1; unexpected labels count as false positives.
- Hierarchical scores expand each label to its ancestors and deduplicate before scoring.
- Civic detection precision/recall/F1 and an explicit civic/unknown/not_civic/insufficient/error confusion matrix.
- Unknown and non-civic status accuracy separately, with per-domain, format-tag and split results.
- Top-confidence squared-error and five-bin ECE diagnostics against exact and parent correctness, including sample counts. These describe raw scores, exclude abstentions, and are not calibrated probabilities or a full multiclass Brier score.
- Local baseline execution timing only; no network latency or model cost is claimed.

A checked-in [baseline report](evaluation-baseline.md) records the initial result. The broad-domain accuracy is 23.3% on 120 civic cases. Leaf accuracy is 0.8%, partly because most legacy categories cannot express a leaf. Food insecurity and discrimination still incorrectly map to healthcare. The point of this phase is to expose that failure under a repeatable contract, not to hide it with a new scoring formula.

## Validation and next phases

The new tests check schema boundaries, evidence grounding, taxonomy completeness, independent locations, fingerprints, corpus integrity, cancellation and hand-computed metric arithmetic. The 150-case baseline test documents the old failure pattern; later provider-quality tests must compare semantic results to gold labels rather than require the old wrong answers.

`pnpm check` runs TypeScript, lint, formatting, all tests and all browser builds. No new runtime browser compatibility claim is made by these contract tests.

Remaining approved sequence:

1. Phase 2: explicit permission onboarding, registered content scripts, shared background coordinator and permission-revocation handling.
2. Phase 3: structured extraction, social/SPA focus, debouncing, hashing, cancellation and bounded cache.
3. Phase 4: consented semantic backend, schema/evidence validation, real provider evaluation and local-model experiment.
4. Phase 5: coarse user-location persistence and ContextObject-based retrieval/ranking.
5. Phase 6: branded-browser acceptance, independently reviewed evaluation and release checks.

No additional architecture approval is required to continue the approved sequence. Backend credentials, hosting and provider-specific consent will be configured when that phase becomes concrete; no private API key belongs in extension source.
