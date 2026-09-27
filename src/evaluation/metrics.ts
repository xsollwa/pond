import {
  ancestors,
  parentCategory,
  type TaxonomyId,
} from "../intelligence/taxonomy";
import type { IssueAnalysis } from "../intelligence/contracts";
import type { EvaluationFixture } from "./corpus";
export interface EvaluationOutcome {
  fixture: EvaluationFixture;
  prediction: IssueAnalysis | null;
  error: string | null;
  durationMs: number;
}
const ratio = (a: number, b: number): number | null => (b ? a / b : null);
function labels(result: IssueAnalysis | null): TaxonomyId[] {
  return result
    ? [
        ...(result.primaryIssue ? [result.primaryIssue.id] : []),
        ...result.secondaryIssues.map((issue) => issue.id),
      ]
    : [];
}
function gold(item: EvaluationFixture): TaxonomyId[] {
  return [
    ...(item.expected.primaryIssue ? [item.expected.primaryIssue] : []),
    ...item.expected.secondaryIssues,
  ];
}
export function exactPrimary(outcome: EvaluationOutcome): boolean {
  return (
    !!outcome.prediction &&
    outcome.prediction.primaryIssue?.id ===
      outcome.fixture.expected.primaryIssue
  );
}
export function parentPrimary(outcome: EvaluationOutcome): boolean {
  const predicted = outcome.prediction?.primaryIssue?.id,
    expected = outcome.fixture.expected.primaryIssue;
  return (
    !!predicted &&
    !!expected &&
    parentCategory(predicted) === parentCategory(expected)
  );
}
function setCounts(expected: Set<string>, predicted: Set<string>) {
  let tp = 0;
  for (const label of predicted) if (expected.has(label)) tp++;
  return { tp, fp: predicted.size - tp, fn: expected.size - tp };
}
function f1(tp: number, fp: number, fn: number) {
  return ratio(2 * tp, 2 * tp + fp + fn);
}
function multilabel(rows: EvaluationOutcome[], hierarchical = false) {
  let tp = 0,
    fp = 0,
    fn = 0;
  const perLabel = new Map<string, { tp: number; fp: number; fn: number }>();
  for (const row of rows) {
    const expected = new Set(
      gold(row.fixture).flatMap((id) => (hierarchical ? ancestors(id) : [id])),
    );
    const predicted = new Set(
      labels(row.prediction).flatMap((id) =>
        hierarchical ? ancestors(id) : [id],
      ),
    );
    const counts = setCounts(expected, predicted);
    tp += counts.tp;
    fp += counts.fp;
    fn += counts.fn;
    for (const id of new Set([...expected, ...predicted])) {
      const entry = perLabel.get(id) ?? { tp: 0, fp: 0, fn: 0 };
      if (expected.has(id) && predicted.has(id)) entry.tp++;
      else if (predicted.has(id)) entry.fp++;
      else entry.fn++;
      perLabel.set(id, entry);
    }
  }
  const macro = Array.from(perLabel.values()).map(
    (value) => f1(value.tp, value.fp, value.fn) ?? 0,
  );
  return {
    precision: ratio(tp, tp + fp),
    recall: ratio(tp, tp + fn),
    microF1: f1(tp, fp, fn),
    macroF1: macro.length
      ? macro.reduce((a, b) => a + b, 0) / macro.length
      : null,
    tp,
    fp,
    fn,
    labelCount: perLabel.size,
  };
}
/** Diagnostics on raw reported confidence. No calibration is fitted here. */
function confidenceDiagnostic(rows: EvaluationOutcome[], parent = false) {
  const samples = rows
    .filter((row) => row.prediction?.primaryIssue)
    .map((row) => ({
      confidence: row.prediction!.primaryIssue!.confidence,
      correct: parent ? parentPrimary(row) : exactPrimary(row),
    }));
  const bins = Array.from({ length: 5 }, (_, index) => {
    const members = samples.filter(
      (sample) => Math.min(4, Math.floor(sample.confidence * 5)) === index,
    );
    return {
      lower: index / 5,
      upper: (index + 1) / 5,
      count: members.length,
      meanConfidence: members.length
        ? members.reduce((sum, item) => sum + item.confidence, 0) /
          members.length
        : null,
      accuracy: members.length
        ? members.filter((item) => item.correct).length / members.length
        : null,
    };
  });
  return {
    sampleCount: samples.length,
    missingPrimaryCount: rows.length - samples.length,
    brier: samples.length
      ? samples.reduce(
          (sum, item) => sum + (item.confidence - Number(item.correct)) ** 2,
          0,
        ) / samples.length
      : null,
    ece: samples.length
      ? bins.reduce(
          (sum, bin) =>
            sum +
            (bin.count / samples.length) *
              Math.abs((bin.meanConfidence ?? 0) - (bin.accuracy ?? 0)),
          0,
        )
      : null,
    bins,
    note: "Top-label correctness diagnostic only, on raw reported scores. Excludes abstentions. Not a calibrated probability model or multiclass Brier score.",
  };
}
export function measure(rows: EvaluationOutcome[]) {
  const civic = rows.filter((row) => row.fixture.expected.status === "civic");
  const confusion: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const expected = row.fixture.expected.status;
    const actual = row.prediction?.status ?? "error";
    confusion[expected] ??= {};
    confusion[expected]![actual] = (confusion[expected]![actual] ?? 0) + 1;
  }
  const tp = rows.filter(
    (row) =>
      row.fixture.expected.status === "civic" &&
      row.prediction?.status === "civic",
  ).length;
  const fp = rows.filter(
    (row) =>
      row.fixture.expected.status !== "civic" &&
      row.prediction?.status === "civic",
  ).length;
  const fn = civic.length - tp;
  const status = (name: string) => {
    const items = rows.filter((row) => row.fixture.expected.status === name);
    return {
      count: items.length,
      accuracy: ratio(
        items.filter((row) => row.prediction?.status === name).length,
        items.length,
      ),
    };
  };
  return {
    count: rows.length,
    civicCount: civic.length,
    errorCount: rows.filter((row) => row.error !== null).length,
    primaryLeafAccuracy: ratio(civic.filter(exactPrimary).length, civic.length),
    primaryParentAccuracy: ratio(
      civic.filter(parentPrimary).length,
      civic.length,
    ),
    statusAccuracy: ratio(
      rows.filter(
        (row) => row.prediction?.status === row.fixture.expected.status,
      ).length,
      rows.length,
    ),
    strictMultilabel: multilabel(rows),
    hierarchicalMultilabel: multilabel(rows, true),
    civicDetection: {
      precision: ratio(tp, tp + fp),
      recall: ratio(tp, tp + fn),
      f1: f1(tp, fp, fn),
      tp,
      fp,
      fn,
    },
    unknown: status("unknown"),
    nonCivic: status("not_civic"),
    insufficient: status("insufficient"),
    statusConfusion: confusion,
    confidence: {
      exactLabel: confidenceDiagnostic(rows),
      parentLabel: confidenceDiagnostic(rows, true),
    },
    latency: {
      meanMs: rows.length
        ? rows.reduce((sum, row) => sum + row.durationMs, 0) / rows.length
        : null,
      p95Ms: rows.length
        ? [...rows].sort((a, b) => a.durationMs - b.durationMs)[
            Math.ceil(rows.length * 0.95) - 1
          ]!.durationMs
        : null,
    },
  };
}
