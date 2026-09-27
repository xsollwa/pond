import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { test, expect } from "vitest";
import raw from "../fixtures/intelligence/corpus.json";
import { corpusSchema } from "../../src/evaluation/corpus";
import { LEAF_IDS } from "../../src/intelligence/taxonomy";
import { LegacyBaselineAnalyzer } from "../../src/intelligence/legacy-baseline";
import { measure } from "../../src/evaluation/metrics";
const corpus = corpusSchema.parse(raw);
test("150 unique frozen cases cover all leaves, source kinds, overlapping labels and abstentions", () => {
  expect(corpus.cases).toHaveLength(150);
  expect(
    createHash("sha256").update(JSON.stringify(corpus.cases)).digest("hex"),
  ).toBe(corpus.fixtureSha256);
  const labels = new Set(
    corpus.cases.flatMap((item) => [
      item.expected.primaryIssue,
      ...item.expected.secondaryIssues,
    ]),
  );
  for (const leaf of LEAF_IDS) expect(labels.has(leaf)).toBe(true);
  expect(new Set(corpus.cases.map((item) => item.page.source.kind)).size).toBe(
    7,
  );
  expect(
    corpus.cases.filter((item) => item.expected.secondaryIssues.length).length,
  ).toBeGreaterThanOrEqual(20);
  expect(
    corpus.cases.filter((item) => item.expected.status === "not_civic"),
  ).toHaveLength(20);
  expect(
    corpus.cases.filter((item) => item.expected.status === "unknown"),
  ).toHaveLength(8);
  expect(
    corpus.cases.filter((item) => item.expected.status === "insufficient"),
  ).toHaveLength(2);
  expect(
    corpus.cases.filter((item) => item.split === "development"),
  ).toHaveLength(90);
  expect(
    corpus.cases.filter((item) => item.split === "calibration"),
  ).toHaveLength(30);
  expect(
    corpus.cases.filter((item) => item.split === "reserved_test"),
  ).toHaveLength(30);
});
test("every representation has an original HTML snapshot with matching annotated body content", () => {
  for (const item of corpus.cases) {
    const path = `tests/fixtures/intelligence/${item.html}`;
    expect(existsSync(path)).toBe(true);
    const html = readFileSync(path, "utf8");
    expect(html).toContain('data-block-id="b1"');
    expect(html).toContain(
      item.page.blocks
        .find((block) => block.id === "b1")!
        .text.slice(0, 15)
        .replaceAll("&", "&amp;")
        .replaceAll("'", "&#x27;"),
    );
  }
});
test("no expected labels or rationale are passed into an analyzer; baseline is recorded, not tuned to pass", async () => {
  const analyzer = new LegacyBaselineAnalyzer();
  const rows = [];
  for (const fixture of corpus.cases) {
    expect("expected" in fixture.page).toBe(false);
    const prediction = await analyzer.analyze(fixture.page);
    rows.push({ fixture, prediction, error: null, durationMs: 0 });
  }
  const metrics = measure(rows);
  expect(metrics.count).toBe(150);
  expect(metrics.errorCount).toBe(0);
  expect(metrics.primaryLeafAccuracy).toBeLessThan(0.2);
  // These assertions freeze the demonstrated legacy defect. Later semantic-provider quality tests use the gold labels instead.
  const food = rows.find((row) => row.fixture.id === "food-diabetes")!;
  expect(food.prediction.primaryIssue?.id).toBe("healthcare");
  const race = rows.find((row) => row.fixture.id === "race-medical")!;
  expect(race.prediction.primaryIssue?.id).toBe("healthcare");
});
test("aborted baseline work does not produce stale analysis", async () => {
  const signal = AbortSignal.abort();
  await expect(
    new LegacyBaselineAnalyzer().analyze(corpus.cases[0]!.page, { signal }),
  ).rejects.toThrow();
});
