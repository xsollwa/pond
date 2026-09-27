import { test, expect } from "vitest";
import data from "../../data/opportunities.json";
import { parseOpportunities } from "../../src/opportunities/schema";
import { WeightedOpportunityRanker, isStale } from "../../src/ranking/ranker";
import { LocalIssueAnalyzer } from "../../src/analysis/local-analyzer";
import { RANKING_CONFIG, USER_LOCATION } from "../../src/domain/config";
import { page } from "../helpers";
const records = parseOpportunities(data),
  ranker = new WeightedOpportunityRanker(),
  now = new Date("2026-09-24T00:00:00Z");
const analysis = () =>
  new LocalIssueAnalyzer().analyze(
    page(
      "Princeton council is reviewing affordable housing and tenant protections. Tenants discussed housing policy and eviction concerns during a public meeting and requested rental assistance for families in their community.",
    ),
  );
test("specific local housing actions outrank broad statewide directories", async () => {
  const ranked = ranker.rank(records, await analysis(), USER_LOCATION, now);
  expect(ranked[0]?.opportunity.id).toBe("pond-resource-1");
  expect(ranked).toHaveLength(4);
  for (const item of ranked) {
    const sum = Object.entries(item.components).reduce(
      (sum, [key, value]) =>
        sum +
        value *
          RANKING_CONFIG.weights[key as keyof typeof RANKING_CONFIG.weights],
      0,
    );
    expect(item.score).toBeCloseTo(sum, 4);
    expect(item.reasons.join(" ")).toContain("housing");
  }
});
test("excludes expired, unrelated, rejected and out-of-area records", async () => {
  const base = records[0]!;
  const candidates = [
    {
      ...base,
      id: "expired",
      kind: "event" as const,
      startDate: "2020-01-01T00:00:00Z",
      endDate: "2020-01-02T00:00:00Z",
    },
    {
      ...base,
      id: "elsewhere",
      coverage: { ...base.coverage, locality: "Trenton" },
    },
    { ...base, id: "unrelated", issues: ["guns" as const] },
    {
      ...base,
      id: "rejected",
      verification: { status: "rejected" as const, note: "Bad source" },
    },
  ];
  expect(ranker.rank(candidates, await analysis(), USER_LOCATION, now)).toEqual(
    [],
  );
});
test("stale and future-dated source checks reduce scores; upcoming events retain dates", async () => {
  const base = records[0]!;
  const stale = {
    ...base,
    id: "stale",
    freshness: { ...base.freshness, checkedAt: "2020-01-01T00:00:00Z" },
  };
  const result = ranker.rank(
    [stale, base],
    await analysis(),
    USER_LOCATION,
    now,
  );
  expect(result[0]?.opportunity.id).toBe(base.id);
  expect(result[1]?.stale).toBe(true);
  expect(result[1]?.components.timeliness).toBeLessThan(
    result[0]!.components.timeliness,
  );
  expect(
    isStale(
      {
        ...base,
        freshness: { ...base.freshness, checkedAt: "2030-01-01T00:00:00Z" },
      },
      now,
    ),
  ).toBe(true);
  const event = {
    ...base,
    kind: "event" as const,
    startDate: "2026-10-01T12:00:00Z",
    endDate: "2026-10-01T14:00:00Z",
  };
  expect(
    ranker.rank([event], await analysis(), USER_LOCATION, now)[0]?.opportunity
      .startDate,
  ).toBe(event.startDate);
});
test("article geography never changes the configured user location or fabricates proximity", async () => {
  const a = await analysis();
  a.geographicReferences = [
    {
      name: "California",
      scope: "state",
      country: "US",
      region: "CA",
      evidence: "california",
    },
  ];
  const result = ranker.rank(records, a, USER_LOCATION, now);
  expect(result[0]?.reasons.join(" ")).toContain(
    "not an action in the article’s location",
  );
  expect(
    ranker.rank(
      records,
      a,
      {
        label: "Elsewhere",
        country: "US",
        region: "CA",
        locality: "Los Angeles",
      },
      now,
    ),
  ).toEqual([]);
});
test("ties break consistently by identifier", async () => {
  const item = records[0]!;
  const a = await analysis();
  expect(
    ranker
      .rank(
        [
          { ...item, id: "z" },
          { ...item, id: "a" },
        ],
        a,
        USER_LOCATION,
        now,
      )
      .map((r) => r.opportunity.id),
  ).toEqual(["a", "z"]);
});
