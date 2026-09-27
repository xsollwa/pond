import { z } from "zod";
import {
  pageRepresentationSchema,
  taxonomyIdSchema,
} from "../intelligence/contracts";
import {
  isTaxonomyId,
  taxon,
  TAXONOMY_VERSION,
} from "../intelligence/taxonomy";
export const fixtureSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    family: z.string().min(1),
    split: z.enum(["development", "calibration", "reserved_test"]),
    group: z.enum([
      "single_issue",
      "implicit_single_issue",
      "overlap_adversarial",
      "ambiguous",
      "non_civic",
    ]),
    html: z.string().regex(/^pages\/[a-z0-9-]+\.html$/),
    page: pageRepresentationSchema,
    expected: z
      .object({
        status: z.enum(["civic", "unknown", "not_civic", "insufficient"]),
        primaryIssue: taxonomyIdSchema.nullable(),
        secondaryIssues: z.array(taxonomyIdSchema),
        evidenceBlockIds: z.array(z.string()),
        rationale: z.string().min(10),
      })
      .strict(),
    provenance: z
      .object({
        kind: z.literal("original_synthetic"),
        reviewStatus: z.literal("author_labeled_not_independently_reviewed"),
        sourceUrl: z.null(),
      })
      .strict(),
  })
  .strict()
  .superRefine((item, ctx) => {
    const expected = item.expected;
    const labels = [
      ...(expected.primaryIssue ? [expected.primaryIssue] : []),
      ...expected.secondaryIssues,
    ];
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if ((expected.status === "civic") !== !!expected.primaryIssue)
      fail(
        "Civic gold cases require a primary label; abstentions must not assert one",
      );
    if (expected.status !== "civic" && labels.length)
      fail("Abstention has issue labels");
    if (labels.some((id) => isTaxonomyId(id) && taxon(id).parentId === null))
      fail("Gold cases must specify leaf-level meaning");
    if (new Set(labels).size !== labels.length)
      fail("Duplicate expected labels");
    if (expected.status === "civic" && !expected.evidenceBlockIds.length)
      fail("Civic labels require annotated evidence blocks");
    if (
      expected.evidenceBlockIds.some(
        (id) => !item.page.blocks.some((block) => block.id === id),
      )
    )
      fail("Annotated evidence block is absent");
  });
export const corpusSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    taxonomyVersion: z.literal(TAXONOMY_VERSION),
    corpusVersion: z.string().min(1),
    fixtureSha256: z.string().regex(/^[a-f0-9]{64}$/),
    annotationNotes: z.string(),
    cases: z.array(fixtureSchema).min(100),
  })
  .strict()
  .superRefine((corpus, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (
      new Set(corpus.cases.map((item) => item.id)).size !== corpus.cases.length
    )
      fail("Duplicate fixture IDs");
    const families = new Map<string, string>();
    const texts = new Set<string>();
    for (const item of corpus.cases) {
      if (families.has(item.family) && families.get(item.family) !== item.split)
        fail("Scenario family leaked across splits");
      families.set(item.family, item.split);
      const body = item.page.blocks
        .filter((block) => block.kind !== "title")
        .map((block) => block.text.toLowerCase().replace(/\s+/g, " "))
        .join(" ");
      if (texts.has(body)) fail("Duplicate scenario text");
      texts.add(body);
    }
  });
export type EvaluationFixture = z.infer<typeof fixtureSchema>;
export type EvaluationCorpus = z.infer<typeof corpusSchema>;
