import type {
  Opportunity,
  OpportunityQuery,
  OpportunityRepository,
} from "../domain/types";
import { parseOpportunities } from "./schema";
export class LocalOpportunityRepository implements OpportunityRepository {
  private records: Opportunity[] | undefined;
  constructor(private readonly load: () => Promise<unknown>) {}
  async list(query: OpportunityQuery): Promise<Opportunity[]> {
    this.records ??= parseOpportunities(await this.load());
    const issues = [
      query.analysis.primaryIssue?.id,
      ...query.analysis.secondaryIssues.map((issue) => issue.id),
    ];
    return this.records
      .filter((item) => item.issues.some((issue) => issues.includes(issue)))
      .map((item) => structuredClone(item));
  }
}
