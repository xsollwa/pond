import { test, expect, afterEach, vi } from "vitest";
import { webcrypto } from "node:crypto";
import corpus from "../fixtures/intelligence/corpus.json";
import {
  pageRepresentationSchema,
  analysisSchema,
  geographicLocationSchema,
  validateAnalysis,
  contextObjectSchema,
  type IssueAnalysis,
} from "../../src/intelligence/contracts";
import {
  createContext,
  representationFingerprint,
} from "../../src/intelligence/context";
import {
  TAXONOMY_NODES,
  TAXONOMY_VERSION,
  LEAF_IDS,
  taxon,
} from "../../src/intelligence/taxonomy";
const page = pageRepresentationSchema.parse(corpus.cases[0]!.page);
export function supportedAnalysis(): IssueAnalysis {
  return analysisSchema.parse({
    schemaVersion: "1.0.0",
    taxonomyVersion: TAXONOMY_VERSION,
    status: "civic",
    primaryIssue: {
      id: "economic_security.food_insecurity",
      label: "Food insecurity",
      confidence: 0.9,
      evidenceIds: ["e1"],
    },
    secondaryIssues: [],
    civicRelevance: 0.9,
    presentsCivicProblem: true,
    hasExplicitActionOpportunity: true,
    entities: [],
    affectedPopulations: [],
    contentLocation: null,
    otherContentLocations: [],
    jurisdiction: "unknown",
    evidence: [
      {
        id: "e1",
        blockId: "b1",
        quote: page.blocks
          .find((block) => block.id === "b1")!
          .text.slice(0, 120),
      },
    ],
    explanation: "Food access is the problem discussed.",
    analyzer: {
      id: "contract-test",
      version: "1",
      mode: "server_semantic",
      confidenceKind: "uncalibrated_model",
      calibrationVersion: null,
    },
  });
}
afterEach(() => vi.unstubAllGlobals());
test("taxonomy has twelve parents and fifty uniquely defined leaves, including missing civic domains", () => {
  expect(TAXONOMY_NODES.filter((node) => node.parentId === null)).toHaveLength(
    12,
  );
  expect(LEAF_IDS).toHaveLength(50);
  expect(new Set(TAXONOMY_NODES.map((node) => node.id)).size).toBe(62);
  for (const node of TAXONOMY_NODES) {
    expect(node.definition.length).toBeGreaterThan(20);
    expect(node.exclusions.length).toBeGreaterThan(20);
    expect(node.examples.length).toBeGreaterThan(0);
    if (node.parentId) expect(taxon(node.parentId).parentId).toBeNull();
  }
  expect(taxon("economic_security.food_insecurity").parentId).toBe(
    "economic_security",
  );
  expect(taxon("civil_rights.racial_discrimination").parentId).toBe(
    "civil_rights",
  );
});
test("PageRepresentation preserves source blocks and rejects raw URL/history extras and oversized input", () => {
  expect(page.blocks[0]?.kind).toBe("title");
  expect(page.blocks[1]?.kind).toBe("paragraph");
  expect(() =>
    pageRepresentationSchema.parse({
      ...page,
      rawHtml: "<form>private</form>",
    }),
  ).toThrow();
  expect(() =>
    pageRepresentationSchema.parse({
      ...page,
      source: { ...page.source, url: "https://example.test/?token=secret" },
    }),
  ).toThrow();
  expect(() =>
    pageRepresentationSchema.parse({
      ...page,
      blocks: [page.blocks[0], page.blocks[0]],
    }),
  ).toThrow();
  expect(() =>
    pageRepresentationSchema.parse({
      ...page,
      blocks: Array.from({ length: 6 }, (_, i) => ({
        ...page.blocks[1],
        id: `x${i}`,
        text: "x".repeat(3000),
      })),
    }),
  ).toThrow();
  expect(() =>
    pageRepresentationSchema.parse({
      ...page,
      focus: { kind: "post", groupId: "absent" },
    }),
  ).toThrow();
});
test("analyzer responses reject fabricated labels, ungrounded quotations and inconsistent abstention", () => {
  const valid = supportedAnalysis();
  expect(validateAnalysis(valid, page).primaryIssue?.id).toBe(
    "economic_security.food_insecurity",
  );
  for (const invalid of [
    { ...valid, primaryIssue: { ...valid.primaryIssue, id: "made.up" } },
    { ...valid, primaryIssue: { ...valid.primaryIssue, label: "Healthcare" } },
    { ...valid, primaryIssue: { ...valid.primaryIssue, confidence: 1.2 } },
    { ...valid, status: "not_civic" },
    { ...valid, secondaryIssues: [valid.primaryIssue] },
    {
      ...valid,
      evidence: [{ id: "e1", blockId: "b1", quote: "fabricated quotation" }],
    },
    {
      ...valid,
      primaryIssue: { ...valid.primaryIssue, evidenceIds: ["not-there"] },
    },
    {
      ...valid,
      analyzer: {
        ...valid.analyzer,
        confidenceKind: "calibrated",
        calibrationVersion: null,
      },
    },
  ])
    expect(() => validateAnalysis(invalid, page)).toThrow();
});
test("unknown, not civic and insufficient remain distinct and do not force a label", () => {
  for (const status of ["unknown", "not_civic", "insufficient"]) {
    const a = analysisSchema.parse({
      ...supportedAnalysis(),
      status,
      primaryIssue: null,
      secondaryIssues: [],
      evidence: [],
    });
    expect(a.primaryIssue).toBeNull();
    expect(a.status).toBe(status);
  }
});
test("user location is independent of content geography and unknown is not silently Princeton", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const a = supportedAnalysis();
  a.contentLocation = {
    city: "Los Angeles",
    county: null,
    state: "CA",
    country: "US",
    coordinates: null,
    confidence: 0.8,
    provenance: "content_evidence",
    evidenceIds: ["e1"],
  };
  // Schema independence is tested here; quotation entailment requires semantic evaluation.
  const unknown = await createContext(a, page);
  expect(unknown.userLocation).toBeNull();
  const user = {
    city: "Princeton",
    county: "Mercer",
    state: "NJ",
    country: "US",
    coordinates: null,
    confidence: 1,
    provenance: "explicit_user" as const,
    evidenceIds: [],
  };
  const context = await createContext(a, page, user);
  expect(context.analysis.contentLocation?.state).toBe("CA");
  expect(context.userLocation?.state).toBe("NJ");
  expect(JSON.stringify(context)).not.toContain("blocks");
  expect(() =>
    contextObjectSchema.parse({ ...context, userLocation: a.contentLocation }),
  ).toThrow();
  expect(() =>
    geographicLocationSchema.parse({
      ...user,
      coordinates: { latitude: 40, longitude: -74 },
    }),
  ).toThrow();
  expect(() =>
    geographicLocationSchema.parse({
      ...user,
      city: null,
      county: null,
      state: null,
      country: null,
    }),
  ).toThrow();
});
test("fingerprint is stable across whitespace and diagnostics but changes for focus or meaningful content", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const first = await representationFingerprint(page);
  expect(first).toMatch(/^[a-f0-9]{64}$/);
  const equivalent = structuredClone(page);
  equivalent.blocks[1]!.text = equivalent.blocks[1]!.text.replace(/ /g, "  ");
  equivalent.extraction.coverage = 0.7;
  equivalent.blocks[1]!.importance = 0.5;
  equivalent.blocks.reverse();
  expect(await representationFingerprint(equivalent)).toBe(first);
  const changed = structuredClone(page);
  changed.blocks[1]!.text += " The situation has changed.";
  expect(await representationFingerprint(changed)).not.toBe(first);
  expect(
    await representationFingerprint({
      ...page,
      focus: { kind: "ambiguous", groupId: null },
    }),
  ).not.toBe(first);
});
