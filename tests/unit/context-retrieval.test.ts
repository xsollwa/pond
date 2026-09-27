import { it, expect } from "vitest";
import {
  exploreResources,
  retrieveResources,
} from "../../src/intelligence/retrieval";
import { ConservativeFallback } from "../../src/intelligence/analyzers";
import { createContext } from "../../src/intelligence/context";
import {
  pageRepresentationSchema,
  type GeographicLocation,
} from "../../src/intelligence/contracts";
import { parseOpportunities } from "../../src/opportunities/schema";
import data from "../../data/opportunities.json";
import corpus from "../fixtures/intelligence/corpus.json";
const records = parseOpportunities(data);
const location: GeographicLocation = {
  city: "Princeton",
  state: "NJ",
  country: "US",
  county: null,
  coordinates: null,
  confidence: 1,
  provenance: "explicit_user",
  evidenceIds: [],
};
it("requires user geography rather than silently defaulting to Princeton", () => {
  expect(
    exploreResources(records, [{ id: "housing", confidence: 1 }], null),
  ).toEqual([]);
  expect(
    exploreResources(records, [{ id: "housing", confidence: 1 }], location),
  ).toHaveLength(4);
  expect(
    exploreResources(records, [{ id: "housing", confidence: 1 }], {
      ...location,
      state: "CA",
    }),
  ).toEqual([]);
});
it("maps food insecurity and discrimination to broad state participation resources", () => {
  for (const id of [
    "economic_security.food_insecurity",
    "civil_rights.racial_discrimination",
  ] as const)
    expect(
      exploreResources(records, [{ id, confidence: 0.8 }], location),
    ).toHaveLength(2);
});
it("does not retrieve topic matches from an abstaining context", async () => {
  const page = pageRepresentationSchema.parse(corpus.cases[0]!.page);
  const context = await createContext(
    await new ConservativeFallback().analyze(page),
    page,
    location,
  );
  expect(retrieveResources(records, context)).toEqual([]);
});
