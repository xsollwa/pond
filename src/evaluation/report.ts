import {
  measure,
  exactPrimary,
  parentPrimary,
  type EvaluationOutcome,
} from "./metrics";
import { parentCategory } from "../intelligence/taxonomy";
import type { EvaluationCorpus } from "./corpus";
export function evaluationReport(
  corpus: EvaluationCorpus,
  rows: EvaluationOutcome[],
  providerId: string,
  split: string,
) {
  const groupBy = (key: (row: EvaluationOutcome) => string) =>
    Object.fromEntries(
      [...new Set(rows.map(key))]
        .sort()
        .map((group) => [
          group,
          measure(rows.filter((row) => key(row) === group)),
        ]),
    );
  return {
    corpusVersion: corpus.corpusVersion,
    fixtureSha256: corpus.fixtureSha256,
    analyzer: providerId,
    split,
    modelVersions: [
      ...new Set(
        rows.flatMap((row) =>
          row.prediction
            ? [
                `${row.prediction.analyzer.id}:${row.prediction.analyzer.version}`,
              ]
            : [],
        ),
      ),
    ],
    input: "Curated PageRepresentation; not extractor output",
    annotationNotes: corpus.annotationNotes,
    metrics: measure(rows),
    byDomain: groupBy((row) =>
      row.fixture.expected.primaryIssue
        ? parentCategory(row.fixture.expected.primaryIssue)
        : row.fixture.expected.status,
    ),
    byPlatform: groupBy((row) => row.fixture.page.source.kind),
    bySplit: groupBy((row) => row.fixture.split),
    outcomes: rows.map((row) => ({
      id: row.fixture.id,
      split: row.fixture.split,
      platform: row.fixture.page.source.kind,
      expected: row.fixture.expected,
      actual: row.prediction
        ? {
            status: row.prediction.status,
            primary: row.prediction.primaryIssue?.id ?? null,
            secondary: row.prediction.secondaryIssues.map((issue) => issue.id),
            confidence: row.prediction.primaryIssue?.confidence ?? null,
          }
        : null,
      error: row.error,
      exactPrimary: exactPrimary(row),
      parentPrimary: parentPrimary(row),
      durationMs: row.durationMs,
    })),
  };
}
const percent = (value: number | null) =>
  value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
export function readableReport(
  report: ReturnType<typeof evaluationReport>,
): string {
  const m = report.metrics;
  const lines = [
    `# Pond intelligence evaluation — ${report.analyzer}`,
    "",
    `Corpus: ${report.corpusVersion} · ${m.count} cases · split: ${report.split}`,
    `Fixture digest: ${report.fixtureSha256}`,
    "",
    report.input,
    report.annotationNotes,
    "",
    "| Metric | Result |",
    "| --- | --- |",
    `| Primary leaf accuracy (${m.civicCount} civic cases) | ${percent(m.primaryLeafAccuracy)} |`,
    `| Primary parent accuracy | ${percent(m.primaryParentAccuracy)} |`,
    `| Strict multi-label precision / recall / micro-F1 | ${percent(m.strictMultilabel.precision)} / ${percent(m.strictMultilabel.recall)} / ${percent(m.strictMultilabel.microF1)} |`,
    `| Strict multi-label macro-F1 | ${percent(m.strictMultilabel.macroF1)} |`,
    `| Hierarchical precision / recall / micro-F1 | ${percent(m.hierarchicalMultilabel.precision)} / ${percent(m.hierarchicalMultilabel.recall)} / ${percent(m.hierarchicalMultilabel.microF1)} |`,
    `| Civic detection precision / recall | ${percent(m.civicDetection.precision)} / ${percent(m.civicDetection.recall)} |`,
    `| Unknown / non-civic / insufficient status accuracy | ${percent(m.unknown.accuracy)} / ${percent(m.nonCivic.accuracy)} / ${percent(m.insufficient.accuracy)} |`,
    `| Provider/schema failures | ${m.errorCount} |`,
    `| Top-score ECE (exact / parent; uncalibrated diagnostic) | ${percent(m.confidence.exactLabel.ece)} / ${percent(m.confidence.parentLabel.ece)} |`,
    "",
    report.analyzer === "semantic-service-v1"
      ? "Remote service evaluation. See modelVersions in the JSON report for returned provider/model provenance. Scores do not establish independent real-world accuracy."
      : "Local evaluation only; no cloud model was called. Legacy broad labels remain parent categories; the conservative fallback deliberately abstains.",
    "All-label metrics count unsupported extra labels as false positives. Abstention precision is undefined, not perfect. Provider failures count as missed civic predictions and incorrect status decisions. The JSON report includes confusion matrices, confidence bins and split-level metrics.",
    "",
    "| Expected domain | Cases | Leaf accuracy | Parent accuracy |",
    "| --- | --- | --- | --- |",
    ...Object.entries(report.byDomain).map(
      ([id, value]) =>
        `| ${id} | ${value.count} | ${percent(value.primaryLeafAccuracy)} | ${percent(value.primaryParentAccuracy)} |`,
    ),
    "",
    "| Fixture format tag | Cases | Parent accuracy | Status accuracy |",
    "| --- | --- | --- | --- |",
    ...Object.entries(report.byPlatform).map(
      ([id, value]) =>
        `| ${id} | ${value.count} | ${percent(value.primaryParentAccuracy)} | ${percent(value.statusAccuracy)} |`,
    ),
    "",
    "## Reported failure patterns",
    "",
    ...report.outcomes
      .filter((row) =>
        [
          "food-diabetes",
          "race-medical",
          "food-insurance-noise",
          "race-nutrition",
          "gender-medical",
        ].includes(row.id),
      )
      .map(
        (row) =>
          `- ${row.id}: expected ${row.expected.primaryIssue}; got ${row.actual?.primary ?? row.actual?.status ?? "error"} (${row.actual?.confidence ?? "n/a"}).`,
      ),
    "",
  ];
  return lines.join("\n");
}
