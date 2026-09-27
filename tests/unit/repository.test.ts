import { test, expect, vi } from "vitest";
import data from "../../data/opportunities.json";
import { parseOpportunities } from "../../src/opportunities/schema";
import { LocalOpportunityRepository } from "../../src/opportunities/local-repository";
import { USER_LOCATION } from "../../src/domain/config";
import { LocalIssueAnalyzer } from "../../src/analysis/local-analyzer";
import { page } from "../helpers";
test("validates bundled records and rejects malformed URLs, dates, coverage and duplicates", () => {
  expect(parseOpportunities(data)).toHaveLength(7);
  const first = data.opportunities[0]!;
  for (const invalid of [
    { ...first, canonicalUrl: "javascript:alert(1)" },
    { ...first, kind: "event" },
    { ...first, coverage: { ...first.coverage, locality: undefined } },
    { ...first, issues: ["invented"] },
    { ...first, coordinates: { latitude: 100, longitude: 0 } },
  ])
    expect(() =>
      parseOpportunities({ schemaVersion: 1, opportunities: [invalid] }),
    ).toThrow();
  expect(() =>
    parseOpportunities({ schemaVersion: 1, opportunities: [first, first] }),
  ).toThrow();
});
test("repository filters by analysis, caches validated data, and protects its cache", async () => {
  const load = vi.fn(async () => data);
  const repo = new LocalOpportunityRepository(load);
  const analysis = await new LocalIssueAnalyzer().analyze(
    page(
      "Affordable housing and tenant protections are part of housing policy. Residents discussed eviction and rental assistance at the public meeting and asked officials to support families with safe homes in their community.",
    ),
  );
  const query = { analysis, location: USER_LOCATION };
  const first = await repo.list(query);
  first[0]!.title = "Mutated";
  const second = await repo.list(query);
  expect(load).toHaveBeenCalledTimes(1);
  expect(second[0]?.title).not.toBe("Mutated");
  expect(second.every((item) => item.issues.includes("housing"))).toBe(true);
});
