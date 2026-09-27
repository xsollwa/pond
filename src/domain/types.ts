export type IssueId =
  | "housing"
  | "environment"
  | "education"
  | "transportation"
  | "immigration"
  | "healthcare"
  | "democracy"
  | "reproductive"
  | "guns"
  | "labor"
  | "safety";
export type ActionType =
  "meeting" | "comment" | "volunteer" | "organize" | "learn" | "contact";
export type Scope =
  "local" | "state" | "national" | "international" | "unknown";
export type GovernmentLevel = "municipal" | "county" | "state" | "federal";
export interface PageContent {
  title: string;
  description: string;
  headings: string[];
  text: string;
  structured: { headline?: string; description?: string; section?: string }[];
  language: string;
  extractedAt: string;
  diagnostics: {
    root: string;
    characters: number;
    nodesVisited: number;
    truncated: boolean;
    durationMs: number;
  };
}
export interface IssueEvidence {
  id: IssueId;
  label: string;
  confidence: number;
  score: number;
  terms: string[];
}
export interface GeographicReference {
  name: string;
  scope: Exclude<Scope, "unknown">;
  country: string;
  region?: string;
  locality?: string;
  evidence: string;
}
export interface Analysis {
  status: "recognized" | "low-confidence" | "unrecognized" | "insufficient";
  primaryIssue: IssueEvidence | null;
  secondaryIssues: IssueEvidence[];
  entities: {
    name: string;
    type: "organization" | "government";
    evidence: string;
  }[];
  geographicReferences: GeographicReference[];
  geographicScope: Scope;
  governmentLevels: GovernmentLevel[];
  actionCategories: ActionType[];
  explanation: string;
  analyzer: string;
}
export interface UserLocation {
  label: string;
  locality: string;
  region: string;
  country: string;
  coordinates?: { latitude: number; longitude: number };
}
export interface Opportunity {
  civicIssues?: import("../intelligence/taxonomy").TaxonomyId[];
  id: string;
  title: string;
  organization: string;
  description: string;
  canonicalUrl: string;
  source: {
    name: string;
    url: string;
    kind: "official" | "community" | "unknown";
  };
  issues: IssueId[];
  coverage: {
    scope: Exclude<Scope, "unknown" | "international">;
    country: string;
    region?: string;
    locality?: string;
    label: string;
  };
  coordinates?: { latitude: number; longitude: number };
  actionType: ActionType;
  kind: "resource" | "ongoing" | "event";
  startDate?: string;
  endDate?: string;
  freshness: { checkedAt: string | null; maxAgeDays: number };
  verification: {
    status: "source-checked" | "verified" | "unverified" | "rejected";
    note: string;
  };
}
export interface IssueAnalyzer {
  readonly id: string;
  analyze(page: PageContent): Promise<Analysis>;
}
export interface OpportunityQuery {
  analysis: Analysis;
  location: UserLocation;
}
export interface OpportunityRepository {
  list(query: OpportunityQuery): Promise<Opportunity[]>;
}
export interface ScoreComponents {
  issue: number;
  geography: number;
  actionability: number;
  timeliness: number;
  quality: number;
}
export interface Recommendation {
  opportunity: Opportunity;
  score: number;
  components: ScoreComponents;
  reasons: string[];
  stale: boolean;
}
export interface OpportunityRanker {
  rank(
    records: Opportunity[],
    analysis: Analysis,
    location: UserLocation,
    now: Date,
  ): Recommendation[];
}
export interface PipelineResult {
  analysis: Analysis;
  recommendations: Recommendation[];
}
