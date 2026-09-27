import { z } from "zod";
import { isTaxonomyId, taxon, TAXONOMY_VERSION } from "./taxonomy";
export const CONTRACT_VERSION = "1.0.0" as const;
const score = z.number().finite().min(0).max(1);
const shortText = z.string().trim().min(1).max(400);
const evidenceIds = z.array(z.string().min(1).max(80)).max(24);
export const taxonomyIdSchema = z
  .string()
  .refine(isTaxonomyId, "Unknown taxonomy ID")
  .transform((id) => id as import("./taxonomy").TaxonomyId);
export const evidenceBlockSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    kind: z.enum([
      "title",
      "meta_description",
      "opengraph",
      "structured_data",
      "heading",
      "paragraph",
      "selected_post",
      "expanded_post",
      "reply",
    ]),
    text: z.string().trim().min(1).max(3000),
    provenance: z.enum([
      "document",
      "article",
      "main",
      "viewport",
      "selection",
      "social_post",
      "metadata",
      "schema_org",
    ]),
    importance: score,
    visible: z.boolean(),
    central: z.boolean(),
    groupId: z.string().max(80).nullable(),
    headingLevel: z
      .union([z.literal(1), z.literal(2), z.literal(3)])
      .nullable(),
  })
  .strict();
export const pageRepresentationSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSION),
    source: z
      .object({
        domain: z
          .string()
          .max(253)
          .regex(
            /^(?:localhost|(?:[0-9]{1,3}\.){3}[0-9]{1,3}|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})$/,
          ),
        kind: z.enum([
          "news",
          "blog",
          "reddit",
          "social",
          "forum",
          "government",
          "organization",
          "other",
        ]),
        language: z.string().min(2).max(35),
      })
      .strict(),
    focus: z
      .object({
        kind: z.enum(["article", "post", "page", "ambiguous"]),
        groupId: z.string().max(80).nullable(),
      })
      .strict(),
    blocks: z.array(evidenceBlockSchema).max(32),
    extraction: z
      .object({
        truncated: z.boolean(),
        coverage: score,
        warnings: z.array(shortText).max(8),
      })
      .strict(),
  })
  .strict()
  .superRefine((page, ctx) => {
    if (
      new Set(page.blocks.map((block) => block.id)).size !== page.blocks.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate block IDs" });
    if (page.blocks.reduce((sum, block) => sum + block.text.length, 0) > 16000)
      ctx.addIssue({
        code: "custom",
        message: "Text payload exceeds 16,000 characters",
      });
    if (
      page.focus.groupId !== null &&
      !page.blocks.some((block) => block.groupId === page.focus.groupId)
    )
      ctx.addIssue({ code: "custom", message: "Focus group does not exist" });
  });
export type PageRepresentation = z.infer<typeof pageRepresentationSchema>;
export type EvidenceBlock = z.infer<typeof evidenceBlockSchema>;
export const geographicLocationSchema = z
  .object({
    city: shortText.nullable(),
    county: shortText.nullable(),
    state: shortText.nullable(),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable(),
    coordinates: z
      .object({
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180),
      })
      .strict()
      .nullable(),
    confidence: score,
    provenance: z.enum([
      "explicit_user",
      "consented_geolocation",
      "content_evidence",
      "coarse_backend",
    ]),
    evidenceIds,
  })
  .strict()
  .superRefine((location, ctx) => {
    if (
      ![
        location.city,
        location.county,
        location.state,
        location.country,
        location.coordinates,
      ].some(Boolean)
    )
      ctx.addIssue({
        code: "custom",
        message: "Use null for unknown location",
      });
    if (location.coordinates && location.provenance !== "consented_geolocation")
      ctx.addIssue({
        code: "custom",
        message: "Coordinates require explicit geolocation consent",
      });
  });
export type GeographicLocation = z.infer<typeof geographicLocationSchema>;
const issueSchema = z
  .object({
    id: taxonomyIdSchema,
    label: shortText,
    confidence: score,
    evidenceIds,
  })
  .strict()
  .superRefine((issue, ctx) => {
    if (isTaxonomyId(issue.id) && issue.label !== taxon(issue.id).label)
      ctx.addIssue({
        code: "custom",
        message: "Label does not match taxonomy ID",
      });
    if (!issue.evidenceIds.length)
      ctx.addIssue({ code: "custom", message: "Issue requires evidence" });
  });
const evidenceSchema = z
  .object({
    id: z.string().min(1).max(80),
    blockId: z.string().min(1).max(80),
    quote: z.string().min(1).max(600),
  })
  .strict();
export const analysisSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSION),
    taxonomyVersion: z.literal(TAXONOMY_VERSION),
    status: z.enum(["civic", "unknown", "not_civic", "insufficient"]),
    primaryIssue: issueSchema.nullable(),
    secondaryIssues: z.array(issueSchema).max(8),
    civicRelevance: score,
    presentsCivicProblem: z.boolean().nullable(),
    hasExplicitActionOpportunity: z.boolean().nullable(),
    entities: z
      .array(
        z
          .object({
            name: shortText,
            type: z.enum([
              "organization",
              "government",
              "place",
              "public_person",
            ]),
            evidenceIds,
          })
          .strict(),
      )
      .max(16),
    affectedPopulations: z
      .array(z.object({ description: shortText, evidenceIds }).strict())
      .max(12),
    contentLocation: geographicLocationSchema.nullable(),
    otherContentLocations: z.array(geographicLocationSchema).max(8),
    jurisdiction: z.enum([
      "municipal",
      "county",
      "state",
      "federal",
      "international",
      "multiple",
      "unknown",
    ]),
    evidence: z.array(evidenceSchema).max(32),
    explanation: z.string().max(1200),
    analyzer: z
      .object({
        id: shortText,
        version: shortText,
        mode: z.enum([
          "deterministic_fallback",
          "local_semantic",
          "server_semantic",
        ]),
        confidenceKind: z.enum([
          "heuristic",
          "uncalibrated_model",
          "calibrated",
        ]),
        calibrationVersion: shortText.nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const issues = [
      ...(value.primaryIssue ? [value.primaryIssue] : []),
      ...value.secondaryIssues,
    ];
    if (value.status !== "civic" && issues.length)
      fail("Abstention must not silently assert issue labels");
    if (value.status === "civic" && !issues.length)
      fail("Civic analysis requires supported labels");
    if (new Set(issues.map((issue) => issue.id)).size !== issues.length)
      fail("Duplicate issue labels");
    if (
      new Set(value.evidence.map((item) => item.id)).size !==
      value.evidence.length
    )
      fail("Duplicate evidence IDs");
    const supported = new Set(value.evidence.map((item) => item.id));
    for (const claim of [
      ...issues,
      ...value.entities,
      ...value.affectedPopulations,
      ...(value.contentLocation ? [value.contentLocation] : []),
      ...value.otherContentLocations,
    ]) {
      if (
        !claim.evidenceIds.length ||
        claim.evidenceIds.some((id) => !supported.has(id))
      )
        fail("Claim has missing or unknown evidence");
    }
    for (const location of [
      ...(value.contentLocation ? [value.contentLocation] : []),
      ...value.otherContentLocations,
    ])
      if (location.provenance !== "content_evidence")
        fail("Content geography cannot come from user location");
    if (
      value.analyzer.confidenceKind === "calibrated" &&
      !value.analyzer.calibrationVersion
    )
      fail("Calibrated confidence requires versioned calibration");
  });
export type IssueAnalysis = z.infer<typeof analysisSchema>;
export interface IssueAnalyzer {
  readonly id: string;
  analyze(
    page: PageRepresentation,
    options?: { signal?: AbortSignal },
  ): Promise<IssueAnalysis>;
}
/** Grounding validation does not prove that a quotation entails the associated model claim. */
export function validateAnalysis(
  input: unknown,
  page: PageRepresentation,
): IssueAnalysis {
  const parsed = analysisSchema.parse(input);
  const blocks = new Map(
    pageRepresentationSchema
      .parse(page)
      .blocks.map((block) => [block.id, block]),
  );
  for (const evidence of parsed.evidence) {
    const block = blocks.get(evidence.blockId);
    if (!block || !block.text.includes(evidence.quote))
      throw new Error(`Unsupported evidence: ${evidence.id}`);
  }
  return parsed;
}
export const contextObjectSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSION),
    analysis: analysisSchema,
    userLocation: geographicLocationSchema.nullable(),
    representationFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .superRefine((context, ctx) => {
    if (
      context.userLocation?.provenance === "content_evidence" ||
      context.userLocation?.evidenceIds.length
    )
      ctx.addIssue({
        code: "custom",
        message:
          "User location must be independently supplied, never inferred from page evidence",
      });
  });
export type ContextObject = z.infer<typeof contextObjectSchema>;
/** Retrieval gets context, never raw blocks. No backend or location collection is implemented here. */
export interface ContextOpportunityQuery {
  context: ContextObject;
}
