import type { ContextObject, GeographicLocation } from "./contracts";
import { parentCategory, type TaxonomyId } from "./taxonomy";
import type { Opportunity } from "../domain/types";
const aliases: Record<string, TaxonomyId> = {
  reproductive: "reproductive_rights",
  guns: "justice_public_safety",
  safety: "justice_public_safety",
};
const normalized = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();
function nearby(item: Opportunity, location: GeographicLocation | null) {
  if (
    !location ||
    normalized(location.country) !== normalized(item.coverage.country)
  )
    return false;
  if (item.coverage.scope === "national") return true;
  const state = normalized(location.state).replace(/^new jersey$/, "nj");
  if (state !== normalized(item.coverage.region)) return false;
  return (
    item.coverage.scope === "state" ||
    normalized(location.city) === normalized(item.coverage.locality)
  );
}
export function exploreResources(
  records: Opportunity[],
  issues: { id: TaxonomyId; confidence: number }[],
  location: GeographicLocation | null,
): Opportunity[] {
  return records
    .filter(
      (item) =>
        item.verification.status !== "rejected" && nearby(item, location),
    )
    .map((item) => ({
      item,
      score:
        Math.max(
          0,
          ...issues.map((issue) =>
            (
              item.civicIssues ?? item.issues.map((tag) => aliases[tag] ?? tag)
            ).some(
              (tag) => tag === issue.id || tag === parentCategory(issue.id),
            )
              ? issue.confidence
              : 0,
          ),
        ) + (item.coverage.scope === "local" ? 0.05 : 0),
    }))
    .filter(
      (row) => row.score > (row.item.coverage.scope === "local" ? 0.05 : 0),
    )
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, 4)
    .map((row) => row.item);
}
/** Retrieval consumes analysis and independent user location, never page geography as the reader's address. */
export function retrieveResources(
  records: Opportunity[],
  context: ContextObject,
): Opportunity[] {
  if (context.analysis.status !== "civic") return [];
  return exploreResources(
    records,
    [
      ...(context.analysis.primaryIssue ? [context.analysis.primaryIssue] : []),
      ...context.analysis.secondaryIssues,
    ],
    context.userLocation,
  );
}
