import { taxonomyIdSchema } from "../intelligence/contracts";
import { z } from "zod";
import type { Opportunity } from "../domain/types";
const text = z.string().trim().min(1).max(2000);
const url = z
  .string()
  .url()
  .refine((value) => {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  }, "Expected an HTTPS URL without credentials");
const issue = z.enum([
  "housing",
  "environment",
  "education",
  "transportation",
  "immigration",
  "healthcare",
  "democracy",
  "reproductive",
  "guns",
  "labor",
  "safety",
]);
const record = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(100),
    title: text,
    organization: text,
    description: text,
    canonicalUrl: url,
    source: z
      .object({
        name: text,
        url,
        kind: z.enum(["official", "community", "unknown"]),
      })
      .strict(),
    issues: z.array(issue).min(1).max(11),
    civicIssues: z.array(taxonomyIdSchema).max(62).optional(),
    coverage: z
      .object({
        scope: z.enum(["local", "state", "national"]),
        country: z.string().regex(/^[A-Z]{2}$/),
        region: text.optional(),
        locality: text.optional(),
        label: text,
      })
      .strict(),
    coordinates: z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .strict()
      .optional(),
    actionType: z.enum([
      "meeting",
      "comment",
      "volunteer",
      "organize",
      "learn",
      "contact",
    ]),
    kind: z.enum(["resource", "ongoing", "event"]),
    startDate: z.string().datetime({ offset: true }).optional(),
    endDate: z.string().datetime({ offset: true }).optional(),
    freshness: z
      .object({
        checkedAt: z.string().datetime({ offset: true }).nullable(),
        maxAgeDays: z.number().int().positive().max(730),
      })
      .strict(),
    verification: z
      .object({
        status: z.enum([
          "source-checked",
          "verified",
          "unverified",
          "rejected",
        ]),
        note: text,
      })
      .strict(),
  })
  .strict()
  .superRefine((item, ctx) => {
    const invalid = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (item.kind === "event" && (!item.startDate || !item.endDate))
      invalid("Events require start and end timestamps");
    if (
      item.startDate &&
      item.endDate &&
      Date.parse(item.endDate) < Date.parse(item.startDate)
    )
      invalid("End precedes start");
    if (
      item.coverage.scope === "local" &&
      (!item.coverage.locality || !item.coverage.region)
    )
      invalid("Local coverage requires locality and region");
    if (item.coverage.scope === "state" && !item.coverage.region)
      invalid("State coverage requires region");
    if (new Set(item.issues).size !== item.issues.length)
      invalid("Duplicate issue tags");
    if (
      ["verified", "source-checked"].includes(item.verification.status) &&
      !item.freshness.checkedAt
    )
      invalid("Checked sources require a timestamp");
  });
const dataset = z
  .object({
    schemaVersion: z.literal(1),
    opportunities: z.array(record).max(1000),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      new Set(data.opportunities.map((item) => item.id)).size !==
      data.opportunities.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate opportunity identifiers",
      });
  });
export function parseOpportunities(input: unknown): Opportunity[] {
  return dataset.parse(input).opportunities;
}
