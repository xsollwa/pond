import { ANALYSIS_CONFIG as C } from "../domain/config";
import { TAXONOMY, ISSUE_IDS } from "../domain/taxonomy";
import type {
  Analysis,
  GeographicReference,
  GovernmentLevel,
  IssueAnalyzer,
  IssueEvidence,
  PageContent,
  Scope,
} from "../domain/types";
export const normalize = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
const contains = (text: string, term: string) => text.includes(normalize(term));
const PLACES: {
  aliases: string[];
  reference: Omit<GeographicReference, "evidence">;
}[] = [
  {
    aliases: ["princeton"],
    reference: {
      name: "Princeton, NJ",
      scope: "local",
      country: "US",
      region: "NJ",
      locality: "Princeton",
    },
  },
  {
    aliases: ["trenton"],
    reference: {
      name: "Trenton, NJ",
      scope: "local",
      country: "US",
      region: "NJ",
      locality: "Trenton",
    },
  },
  {
    aliases: ["newark"],
    reference: {
      name: "Newark, NJ",
      scope: "local",
      country: "US",
      region: "NJ",
      locality: "Newark",
    },
  },
  {
    aliases: ["new jersey"],
    reference: {
      name: "New Jersey",
      scope: "state",
      country: "US",
      region: "NJ",
    },
  },
  {
    aliases: ["new york city"],
    reference: {
      name: "New York City, NY",
      scope: "local",
      country: "US",
      region: "NY",
      locality: "New York City",
    },
  },
  {
    aliases: ["california"],
    reference: {
      name: "California",
      scope: "state",
      country: "US",
      region: "CA",
    },
  },
  {
    aliases: ["los angeles"],
    reference: {
      name: "Los Angeles, CA",
      scope: "local",
      country: "US",
      region: "CA",
      locality: "Los Angeles",
    },
  },
  {
    aliases: ["united states", "u.s."],
    reference: { name: "United States", scope: "national", country: "US" },
  },
  {
    aliases: ["london"],
    reference: {
      name: "London, UK",
      scope: "local",
      country: "GB",
      locality: "London",
    },
  },
  {
    aliases: ["canada"],
    reference: { name: "Canada", scope: "national", country: "CA" },
  },
  {
    aliases: ["france"],
    reference: { name: "France", scope: "national", country: "FR" },
  },
];
const ENTITIES = [
  {
    name: "Princeton Council",
    type: "government" as const,
    aliases: ["princeton council", "princeton town council"],
  },
  {
    name: "New Jersey Legislature",
    type: "government" as const,
    aliases: ["new jersey legislature", "nj legislature"],
  },
  {
    name: "NJ Transit",
    type: "organization" as const,
    aliases: ["nj transit"],
  },
  { name: "US Congress", type: "government" as const, aliases: ["congress"] },
  {
    name: "Sustainable Princeton",
    type: "organization" as const,
    aliases: ["sustainable princeton"],
  },
  {
    name: "School board",
    type: "government" as const,
    aliases: ["school board"],
  },
];
const LEVELS: [GovernmentLevel, string[]][] = [
  [
    "municipal",
    [
      "city council",
      "town council",
      "princeton council",
      "mayor",
      "municipal",
      "school board",
      "zoning board",
    ],
  ],
  ["county", ["county commission", "county board", "county government"]],
  [
    "state",
    [
      "state legislature",
      "new jersey legislature",
      "governor",
      "state senate",
      "state budget",
    ],
  ],
  ["federal", ["congress", "federal", "supreme court", "u.s. senate"]],
];
export class LocalIssueAnalyzer implements IssueAnalyzer {
  readonly id = "local-evidence-v1";
  async analyze(page: PageContent): Promise<Analysis> {
    const body = normalize(page.text),
      title = normalize(page.title),
      headings = normalize(page.headings.join(" "));
    const metadata = normalize(
      [
        page.description,
        ...page.structured.flatMap((item) => [
          item.headline,
          item.description,
          item.section,
        ]),
      ]
        .filter(Boolean)
        .join(" "),
    );
    const content = normalize(
      [page.title, page.headings.join(" "), page.text].join(" "),
    );
    const geographicReferences = PLACES.flatMap(({ aliases, reference }) => {
      const evidence = aliases.find((alias) => contains(content, alias));
      return evidence ? [{ ...reference, evidence }] : [];
    });
    const governmentLevels = LEVELS.filter(([, terms]) =>
      terms.some((term) => contains(content, term)),
    ).map(([level]) => level);
    const countries = new Set(
      geographicReferences.map((place) => place.country),
    );
    const regions = new Set(
      geographicReferences.map((place) => place.region).filter(Boolean),
    );
    let geographicScope: Scope = "unknown";
    if (countries.size > 1 || (countries.size === 1 && !countries.has("US")))
      geographicScope = "international";
    else if (
      governmentLevels.includes("federal") ||
      geographicReferences.some((place) => place.scope === "national") ||
      regions.size > 1
    )
      geographicScope = "national";
    else if (
      governmentLevels.includes("state") ||
      geographicReferences.some((place) => place.scope === "state")
    )
      geographicScope = "state";
    else if (geographicReferences.length) geographicScope = "local";
    const base: Analysis = {
      status: "unrecognized",
      primaryIssue: null,
      secondaryIssues: [],
      entities: ENTITIES.flatMap((entity) => {
        const evidence = entity.aliases.find((alias) =>
          contains(content, alias),
        );
        return evidence
          ? [{ name: entity.name, type: entity.type, evidence }]
          : [];
      }),
      geographicReferences,
      geographicScope,
      governmentLevels,
      actionCategories: [],
      explanation: "No strong civic context was identified.",
      analyzer: this.id,
    };
    if (
      page.text.trim().length < C.minCharacters ||
      page.text.trim().split(/\s+/).length < C.minWords
    )
      return {
        ...base,
        status: "insufficient",
        explanation: "There is too little readable page content to analyze.",
      };
    // Generic mentions of schools, workers, etc. need public-policy context.
    const civicContext = [
      "policy",
      "policies",
      "council",
      "legislation",
      "legislature",
      "government",
      "public",
      "rights",
      "funding",
      "budget",
      "law",
      "ordinance",
      "protections",
      "reform",
      "community",
      "petition",
      "organizing",
    ].some((term) => contains(content, term));
    const entertainmentContext = [
      "video game",
      "movie review",
      "fictional",
      "game review",
    ].some((term) => contains(title, term));
    const ranked = ISSUE_IDS.map((id) => {
      const topic = TAXONOMY[id];
      // Metadata can corroborate visible evidence, never manufacture it.
      const phrases = topic.phrases.filter((term) => contains(body, term));
      const terms = topic.terms.filter(
        (term) =>
          contains(body, term) &&
          !phrases.some((phrase) => contains(normalize(phrase), term)),
      );
      const evidence = [...phrases, ...terms];
      const score = evidence.reduce(
        (sum, term) =>
          sum +
          (phrases.includes(term) ? 4 : 1) +
          (contains(title, term) ? C.titleBoost : 0) +
          (contains(headings, term) ? C.headingBoost : 0) +
          (contains(metadata, term) ? C.metadataBoost : 0),
        0,
      );
      return {
        id,
        label: topic.label,
        score:
          (!civicContext && !phrases.length) || entertainmentContext
            ? 0
            : score,
        terms: evidence,
        confidence: 0,
      } satisfies IssueEvidence;
    }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const first = ranked[0]!;
    if (first.score < C.minimumScore) return base;
    const second = ranked[1]!;
    for (const issue of ranked) {
      const margin =
        issue === first
          ? Math.min(1, (first.score - second.score) / Math.max(first.score, 1))
          : 0;
      issue.confidence = Number(
        Math.min(
          0.95,
          0.3 +
            Math.min(0.4, issue.score / 30) +
            Math.min(0.15, issue.terms.length * 0.05) +
            margin * 0.1,
        ).toFixed(2),
      );
    }
    const secondaryIssues = ranked
      .slice(1)
      .filter(
        (issue) =>
          issue.score >= C.minimumScore &&
          issue.score >= first.score * C.secondaryRatio,
      )
      .slice(0, C.maxSecondary);
    const status =
      first.score >= C.confidentScore &&
      first.confidence >= C.confidenceThreshold
        ? "recognized"
        : "low-confidence";
    return {
      ...base,
      status,
      primaryIssue: first,
      secondaryIssues,
      actionCategories: [...TAXONOMY[first.id].actions],
      explanation: `${first.label} is supported by ${first.terms
        .slice(0, 3)
        .map((term) => `“${term}”`)
        .join(
          ", ",
        )} in the readable page${first.terms.some((term) => contains(title, term)) ? " and its title" : ""}.`,
    };
  }
}
