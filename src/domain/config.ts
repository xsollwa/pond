import type { ScoreComponents, UserLocation } from "./types";
export const USER_LOCATION: UserLocation = {
  label: "Princeton, NJ",
  locality: "Princeton",
  region: "NJ",
  country: "US",
};
export const ANALYSIS_CONFIG = {
  minCharacters: 120,
  minWords: 22,
  minimumScore: 3,
  confidentScore: 7,
  confidenceThreshold: 0.62,
  secondaryRatio: 0.4,
  maxSecondary: 3,
  titleBoost: 2,
  headingBoost: 1,
  metadataBoost: 0.5,
} as const;
export const RANKING_CONFIG = {
  weights: {
    issue: 0.42,
    geography: 0.25,
    actionability: 0.14,
    timeliness: 0.09,
    quality: 0.1,
  } satisfies ScoreComponents,
  secondaryRelevance: 0.55,
  specificityPenalty: 0.12,
  broadResourcePenalty: 0.6,
  maxRecommendations: 4,
  minimumScore: 0.35,
  actionValues: {
    meeting: 0.85,
    comment: 0.9,
    volunteer: 1,
    organize: 0.9,
    learn: 0.4,
    contact: 0.85,
  },
  resourceMultiplier: 0.7,
  nonPreferredActionMultiplier: 0.8,
  unknownSourceMultiplier: 0.7,
  staleQualityMultiplier: 0.7,
  broadTagCount: 3,
  geography: {
    local: 1,
    state: 0.75,
    national: 0.5,
    articleOverlapBoost: 0.05,
  },
  quality: {
    verified: 1,
    "source-checked": 0.65,
    unverified: 0.25,
    rejected: 0,
  },
  timeliness: { event: 1, ongoing: 0.85, resource: 0.7, stale: 0.2 },
} as const;
