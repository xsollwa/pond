import type {
  IssueAnalyzer,
  OpportunityRepository,
  OpportunityRanker,
  PageContent,
  PipelineResult,
  UserLocation,
  Analysis,
} from "../domain/types";
export class PondPipeline {
  constructor(
    private readonly analyzer: IssueAnalyzer,
    private readonly repository: OpportunityRepository,
    private readonly ranker: OpportunityRanker,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async analyze(
    page: PageContent,
    location: UserLocation,
  ): Promise<PipelineResult> {
    const analysis = await this.analyzer.analyze(page);
    return this.recommend(analysis, location);
  }
  async recommend(
    analysis: Analysis,
    location: UserLocation,
  ): Promise<PipelineResult> {
    if (!analysis.primaryIssue) return { analysis, recommendations: [] };
    const records = await this.repository.list({ analysis, location });
    return {
      analysis,
      recommendations: this.ranker.rank(
        records,
        analysis,
        location,
        this.now(),
      ),
    };
  }
}
