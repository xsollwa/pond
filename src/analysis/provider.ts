import type { IssueAnalyzer } from "../domain/types";
import { LocalIssueAnalyzer } from "./local-analyzer";
/** Remote providers are an explicit injection point, never an implicit network fallback.
 * Consent, authenticated backend transport and schema validation must precede deployment.
 * No API credentials, endpoints or remote implementation are bundled in Phase 1. */
export function createIssueAnalyzer(
  approvedOptionalProvider?: IssueAnalyzer,
): IssueAnalyzer {
  return approvedOptionalProvider ?? new LocalIssueAnalyzer();
}
