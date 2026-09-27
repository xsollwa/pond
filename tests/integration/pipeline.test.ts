import { readFileSync } from "node:fs";
import { test, expect } from "vitest";
import data from "../../data/opportunities.json";
import { installDOM } from "../helpers";
import { extractPage } from "../../src/extraction/extract-page";
import { LocalIssueAnalyzer } from "../../src/analysis/local-analyzer";
import { LocalOpportunityRepository } from "../../src/opportunities/local-repository";
import { WeightedOpportunityRanker } from "../../src/ranking/ranker";
import { PondPipeline } from "../../src/application/pipeline";
import { USER_LOCATION } from "../../src/domain/config";
test("HTML → content → structured analysis → validated data → ranked explainable actions", async () => {
  installDOM(readFileSync("tests/fixtures/pages/housing-local.html", "utf8"));
  const pipeline = new PondPipeline(
    new LocalIssueAnalyzer(),
    new LocalOpportunityRepository(async () => data),
    new WeightedOpportunityRanker(),
    () => new Date("2026-09-24T00:00:00Z"),
  );
  const result = await pipeline.analyze(await extractPage(), USER_LOCATION);
  expect(result.analysis.primaryIssue?.id).toBe("housing");
  expect(result.recommendations).toHaveLength(4);
  expect(result.recommendations[0]?.opportunity.id).toBe("pond-resource-1");
  expect(result.recommendations[0]?.reasons.join(" ")).toContain("Princeton");
  expect(JSON.stringify(result)).not.toContain("diagnostics");
  expect(JSON.stringify(result)).not.toContain("Tenants face");
});
