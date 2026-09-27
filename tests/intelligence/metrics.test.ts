import { test, expect } from "vitest";
import raw from "../fixtures/intelligence/corpus.json";
import {
  fixtureSchema,
  type EvaluationFixture,
} from "../../src/evaluation/corpus";
import { measure, type EvaluationOutcome } from "../../src/evaluation/metrics";
import {
  analysisSchema,
  type IssueAnalysis,
} from "../../src/intelligence/contracts";
import { taxon, type TaxonomyId } from "../../src/intelligence/taxonomy";
const civic = fixtureSchema.parse(
  raw.cases.find((item) => item.id === "food-transit"),
);
const nonCivic = fixtureSchema.parse(
  raw.cases.find((item) => item.id === "recipe-diabetes"),
);
function prediction(
  ids: TaxonomyId[],
  confidence = 0.8,
  status: IssueAnalysis["status"] = "civic",
): IssueAnalysis {
  const labels = ids.map((id) => ({
    id,
    label: taxon(id).label,
    confidence,
    evidenceIds: ["e1"],
  }));
  return analysisSchema.parse({
    schemaVersion: "1.0.0",
    taxonomyVersion: "2.0.0",
    status,
    primaryIssue: labels[0] ?? null,
    secondaryIssues: labels.slice(1),
    civicRelevance: ids.length ? confidence : 0,
    presentsCivicProblem: null,
    hasExplicitActionOpportunity: null,
    entities: [],
    affectedPopulations: [],
    contentLocation: null,
    otherContentLocations: [],
    jurisdiction: "unknown",
    evidence: ids.length
      ? [{ id: "e1", blockId: "b1", quote: "Arithmetic test only" }]
      : [],
    explanation:
      "Synthetic prediction used only to validate metric arithmetic.",
    analyzer: {
      id: "metric-test",
      version: "1",
      mode: "server_semantic",
      confidenceKind: "uncalibrated_model",
      calibrationVersion: null,
    },
  });
}
const row = (
  fixture: EvaluationFixture,
  prediction: IssueAnalysis | null,
  error: string | null = null,
): EvaluationOutcome => ({ fixture, prediction, error, durationMs: 10 });
test("perfect known predictions score correctly without relying on provider quality", () => {
  const result = measure([
    row(
      civic,
      prediction(
        ["economic_security.food_insecurity", "transportation.public_transit"],
        0.8,
      ),
    ),
    row(nonCivic, prediction([], 0, "not_civic")),
  ]);
  expect(result.primaryLeafAccuracy).toBe(1);
  expect(result.primaryParentAccuracy).toBe(1);
  expect(result.strictMultilabel.microF1).toBe(1);
  expect(result.hierarchicalMultilabel.microF1).toBe(1);
  expect(result.statusAccuracy).toBe(1);
  expect(result.confidence.exactLabel.brier).toBeCloseTo(0.04);
  expect(result.confidence.exactLabel.ece).toBeCloseTo(0.2);
});
test("missing and extra labels both count, with explicit micro and macro scores", () => {
  const result = measure([
    row(
      civic,
      prediction(["economic_security.food_insecurity", "healthcare.access"]),
    ),
  ]);
  expect(result.strictMultilabel).toMatchObject({
    tp: 1,
    fp: 1,
    fn: 1,
    precision: 0.5,
    recall: 0.5,
    microF1: 0.5,
  });
  expect(result.strictMultilabel.macroF1).toBeCloseTo(1 / 3);
  expect(result.hierarchicalMultilabel.microF1).toBe(0.5);
});
test("a parent-only prediction gets parent credit but no invented leaf correctness", () => {
  const result = measure([row(civic, prediction(["economic_security"]))]);
  expect(result.primaryLeafAccuracy).toBe(0);
  expect(result.primaryParentAccuracy).toBe(1);
  expect(result.strictMultilabel.tp).toBe(0);
  expect(result.hierarchicalMultilabel).toMatchObject({
    tp: 1,
    fp: 0,
    fn: 3,
    microF1: 0.4,
  });
});
test("unknown and non-civic are not interchangeable; failures do not earn abstention credit", () => {
  const result = measure([
    row(nonCivic, prediction([], 0, "unknown")),
    row(nonCivic, null, "timeout"),
    row(civic, null, "invalid schema"),
  ]);
  expect(result.statusAccuracy).toBe(0);
  expect(result.nonCivic.accuracy).toBe(0);
  expect(result.errorCount).toBe(2);
  expect(result.civicDetection.recall).toBe(0);
  expect(result.statusConfusion.not_civic).toEqual({ unknown: 1, error: 1 });
  expect(result.strictMultilabel.precision).toBeNull();
});
test("empty evaluation and all-abstention confidence statistics stay undefined, not perfect", () => {
  expect(measure([]).primaryLeafAccuracy).toBeNull();
  expect(measure([]).strictMultilabel.microF1).toBeNull();
  expect(
    measure([row(nonCivic, prediction([], 0, "not_civic"))]).confidence
      .exactLabel.ece,
  ).toBeNull();
});
test("confidence diagnostics use observed correctness rather than treating scores as truth", () => {
  const result = measure([
    row(civic, prediction(["economic_security.food_insecurity"], 0.8)),
    row(nonCivic, prediction(["economic_security.food_insecurity"], 0.8)),
  ]);
  expect(result.confidence.exactLabel.brier).toBeCloseTo(0.34);
  expect(result.confidence.exactLabel.ece).toBeCloseTo(0.3);
  expect(result.civicDetection.precision).toBe(0.5);
});
