import { RANKING_CONFIG as C } from "../domain/config";
import { TAXONOMY } from "../domain/taxonomy";
import type {
  Analysis,
  Opportunity,
  OpportunityRanker,
  Recommendation,
  ScoreComponents,
  UserLocation,
} from "../domain/types";
export function isStale(item: Opportunity, now: Date): boolean {
  const checked = item.freshness.checkedAt
    ? Date.parse(item.freshness.checkedAt)
    : NaN;
  return (
    !Number.isFinite(checked) ||
    checked > now.getTime() ||
    now.getTime() - checked > item.freshness.maxAgeDays * 86400000
  );
}
function geography(
  item: Opportunity,
  analysis: Analysis,
  location: UserLocation,
): number {
  const coverage = item.coverage;
  if (coverage.country !== location.country) return 0;
  if (coverage.scope === "state" && coverage.region !== location.region)
    return 0;
  if (
    coverage.scope === "local" &&
    (coverage.region !== location.region ||
      coverage.locality?.toLowerCase() !== location.locality.toLowerCase())
  )
    return 0;
  const overlap = analysis.geographicReferences.some(
    (place) =>
      place.country === coverage.country &&
      (coverage.scope === "national" ||
        (place.region === coverage.region &&
          (coverage.scope === "state" ||
            place.locality === coverage.locality))),
  );
  return Math.min(
    1,
    C.geography[coverage.scope] +
      (overlap ? C.geography.articleOverlapBoost : 0),
  );
}
export class WeightedOpportunityRanker implements OpportunityRanker {
  rank(
    records: Opportunity[],
    analysis: Analysis,
    location: UserLocation,
    now: Date,
  ): Recommendation[] {
    if (!analysis.primaryIssue) return [];
    const ranked: Recommendation[] = [];
    for (const item of records) {
      if (
        item.verification.status === "rejected" ||
        (item.endDate && Date.parse(item.endDate) < now.getTime())
      )
        continue;
      const primary = item.issues.includes(analysis.primaryIssue.id);
      const secondary = analysis.secondaryIssues.find((issue) =>
        item.issues.includes(issue.id),
      );
      if (!primary && !secondary) continue;
      const geo = geography(item, analysis, location);
      if (!geo) continue;
      const stale = isStale(item, now);
      const broad = item.issues.length > C.broadTagCount;
      const components: ScoreComponents = {
        issue:
          (primary ? 1 : C.secondaryRelevance) *
          (broad
            ? C.broadResourcePenalty
            : 1 / (1 + C.specificityPenalty * (item.issues.length - 1))),
        geography: geo,
        actionability:
          C.actionValues[item.actionType] *
          (item.kind === "resource" ? C.resourceMultiplier : 1) *
          (analysis.actionCategories.includes(item.actionType)
            ? 1
            : C.nonPreferredActionMultiplier),
        timeliness: stale ? C.timeliness.stale : C.timeliness[item.kind],
        quality:
          C.quality[item.verification.status] *
          (item.source.kind === "unknown" ? C.unknownSourceMultiplier : 1) *
          (stale ? C.staleQualityMultiplier : 1),
      };
      const score = Object.entries(C.weights).reduce(
        (sum, [key, weight]) =>
          sum + components[key as keyof ScoreComponents] * weight,
        0,
      );
      if (score < C.minimumScore) continue;
      const issueLabel =
        TAXONOMY[primary ? analysis.primaryIssue.id : secondary!.id].label;
      const reasons = [
        broad
          ? `A general civic resource tagged for ${issueLabel.toLowerCase()}.`
          : `Listed for ${issueLabel.toLowerCase()}, ${analysis.analyzer === "manual" ? "your selected issue" : primary ? "the main issue on this page" : "a secondary issue on this page"}.`,
        item.coverage.scope === "local"
          ? `Covers your area: ${item.coverage.label}.`
          : `Available to residents of ${item.coverage.label}.`,
      ];
      if (
        analysis.geographicReferences.length &&
        !analysis.geographicReferences.some(
          (place) =>
            place.country === location.country &&
            (!place.region || place.region === location.region),
        )
      )
        reasons.push(
          "A way to engage near you; not an action in the article’s location.",
        );
      if (stale)
        reasons.push("Source details need a fresh check before you act.");
      if (item.kind === "resource")
        reasons.push("An ongoing resource, not a confirmed upcoming event.");
      ranked.push({
        opportunity: item,
        score: Number(score.toFixed(4)),
        components,
        reasons,
        stale,
      });
    }
    return ranked
      .sort(
        (a, b) =>
          b.score - a.score || a.opportunity.id.localeCompare(b.opportunity.id),
      )
      .slice(0, C.maxRecommendations);
  }
}
