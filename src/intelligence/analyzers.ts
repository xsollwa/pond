import {
  type IssueAnalyzer,
  type IssueAnalysis,
  type PageRepresentation,
  validateAnalysis,
  pageRepresentationSchema,
} from "./contracts";
import { TAXONOMY_VERSION } from "./taxonomy";
export class ConservativeFallback implements IssueAnalyzer {
  readonly id = "conservative-fallback-v1";
  async analyze(page: PageRepresentation): Promise<IssueAnalysis> {
    const enough =
      page.blocks
        .filter((b) => b.visible && b.groupId)
        .reduce((n, b) => n + b.text.length, 0) >= 100;
    return validateAnalysis(
      {
        schemaVersion: "1.0.0",
        taxonomyVersion: TAXONOMY_VERSION,
        status: enough ? "unknown" : "insufficient",
        primaryIssue: null,
        secondaryIssues: [],
        civicRelevance: 0,
        presentsCivicProblem: null,
        hasExplicitActionOpportunity: null,
        entities: [],
        affectedPopulations: [],
        contentLocation: null,
        otherContentLocations: [],
        jurisdiction: "unknown",
        evidence: [],
        explanation: !enough
          ? "There is not enough readable content yet."
          : page.focus.kind === "ambiguous"
            ? "Select or expand one post to focus Pond."
            : "Issue recognition is off or unavailable. You can enable it in Settings, or explore an issue below.",
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
export function serviceURL(value: string): URL {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
  )
    throw new Error("Use HTTPS or a local development server.");
  return url;
}
export class AnalysisServiceError extends Error {}
/** No user credentials or provider keys are transmitted by this client. */
export class RemoteIssueAnalyzer implements IssueAnalyzer {
  readonly id = "semantic-service-v1";
  constructor(
    private endpoint: string,
    private origin?: string,
  ) {
    serviceURL(endpoint);
  }
  async analyze(
    input: PageRepresentation,
    options?: { signal?: AbortSignal },
  ): Promise<IssueAnalysis> {
    const page = pageRepresentationSchema.parse(input);
    if (
      page.focus.kind === "ambiguous" ||
      page.blocks
        .filter((b) => b.visible && b.groupId)
        .reduce((n, b) => n + b.text.length, 0) < 100
    )
      return new ConservativeFallback().analyze(page);
    const response = await fetch(serviceURL(this.endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.origin ? { Origin: this.origin } : {}),
      },
      body: JSON.stringify({ page }),
      signal: options?.signal ?? AbortSignal.timeout(45000),
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) {
      const message =
        response.status === 429
          ? "Pond’s analysis limit has been reached. Please try later; you can still explore issues manually."
          : response.status === 504
            ? "Analysis took too long. Please try again."
            : "Pond is temporarily unavailable. Please try again later.";
      throw new AnalysisServiceError(message);
    }
    const raw = await response.text();
    if (raw.length > 64000) throw new Error("Analysis response is too large.");
    const analysis = validateAnalysis(JSON.parse(raw), page);
    if (
      analysis.analyzer.mode !== "server_semantic" ||
      analysis.analyzer.confidenceKind === "calibrated"
    )
      throw new Error("Unexpected model provenance.");
    return analysis;
  }
}
