import { LocalIssueAnalyzer } from "../analysis/local-analyzer";
import type { IssueId } from "../domain/types";
import {
  CONTRACT_VERSION,
  validateAnalysis,
  type IssueAnalysis,
  type IssueAnalyzer,
  type PageRepresentation,
} from "./contracts";
import { taxon, TAXONOMY_VERSION, type TaxonomyId } from "./taxonomy";
/** Evaluation-only bridge: broad legacy labels remain broad, not invented leaf predictions. */
export const LEGACY_LABEL_MAP: Record<IssueId, TaxonomyId> = {
  housing: "housing",
  environment: "environment",
  education: "education",
  transportation: "transportation",
  immigration: "immigration",
  healthcare: "healthcare",
  democracy: "democracy",
  reproductive: "reproductive_rights",
  guns: "justice_public_safety.gun_policy",
  labor: "labor",
  safety: "justice_public_safety",
};
export class LegacyBaselineAnalyzer implements IssueAnalyzer {
  readonly id = "legacy-keyword-baseline";
  async analyze(
    page: PageRepresentation,
    options?: { signal?: AbortSignal },
  ): Promise<IssueAnalysis> {
    options?.signal?.throwIfAborted();
    const visible = page.blocks.filter(
      (block) =>
        block.visible &&
        !["meta_description", "opengraph", "structured_data"].includes(
          block.kind,
        ),
    );
    // Flatten only at this compatibility boundary; future semantic providers receive structured blocks.
    const result = await new LocalIssueAnalyzer().analyze({
      title: page.blocks
        .filter((block) => block.kind === "title")
        .map((block) => block.text)
        .join(" "),
      description: page.blocks
        .filter((block) =>
          ["meta_description", "opengraph"].includes(block.kind),
        )
        .map((block) => block.text)
        .join(" "),
      headings: page.blocks
        .filter((block) => block.kind === "heading")
        .map((block) => block.text),
      text: visible
        .filter((block) => block.kind !== "title")
        .map((block) => block.text)
        .join(" "),
      structured: [],
      language: page.source.language,
      extractedAt: "2026-09-24T00:00:00Z",
      diagnostics: {
        root: "legacy-bridge",
        characters: 0,
        nodesVisited: 0,
        truncated: page.extraction.truncated,
        durationMs: 0,
      },
    });
    options?.signal?.throwIfAborted();
    const evidence: IssueAnalysis["evidence"] = [];
    const convert = (issue: NonNullable<typeof result.primaryIssue>) => {
      const evidenceIds: string[] = [];
      for (const term of issue.terms) {
        const block = visible.find((block) =>
          block.text.toLowerCase().includes(term),
        );
        if (!block) continue;
        const start = block.text.toLowerCase().indexOf(term);
        const id = `e${evidence.length + 1}`;
        evidence.push({
          id,
          blockId: block.id,
          quote: block.text.slice(start, start + term.length),
        });
        evidenceIds.push(id);
      }
      if (!evidenceIds.length) return null;
      const id = LEGACY_LABEL_MAP[issue.id];
      return {
        id,
        label: taxon(id).label,
        confidence: issue.confidence,
        evidenceIds,
      };
    };
    const primaryIssue = result.primaryIssue
      ? convert(result.primaryIssue)
      : null;
    const secondaryIssues = result.secondaryIssues
      .map(convert)
      .filter(
        (issue): issue is NonNullable<ReturnType<typeof convert>> =>
          issue !== null,
      )
      .filter((issue) => issue.id !== primaryIssue?.id)
      .filter(
        (issue, i, all) =>
          all.findIndex((other) => other.id === issue.id) === i,
      );
    const status =
      primaryIssue || secondaryIssues.length
        ? "civic"
        : result.status === "insufficient"
          ? "insufficient"
          : "unknown";
    return validateAnalysis(
      {
        schemaVersion: CONTRACT_VERSION,
        taxonomyVersion: TAXONOMY_VERSION,
        status,
        primaryIssue,
        secondaryIssues,
        civicRelevance: primaryIssue?.confidence ?? 0,
        presentsCivicProblem: null,
        hasExplicitActionOpportunity: null,
        entities: [],
        affectedPopulations: [],
        contentLocation: null,
        otherContentLocations: [],
        jurisdiction: "unknown",
        evidence,
        explanation:
          "Unmodified legacy phrase scorer, mapped only to taxonomy nodes it can represent. It cannot distinguish unknown from non-civic or supply grounded geographic/population claims.",
        analyzer: {
          id: this.id,
          version: "1",
          mode: "deterministic_fallback",
          confidenceKind: "heuristic",
          calibrationVersion: null,
        },
      },
      page,
    );
  }
}
