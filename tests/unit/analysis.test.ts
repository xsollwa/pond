import { readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";
import cases from "../fixtures/cases.json";
import { installDOM, page } from "../helpers";
import { extractPage } from "../../src/extraction/extract-page";
import { LocalIssueAnalyzer } from "../../src/analysis/local-analyzer";
import { createIssueAnalyzer } from "../../src/analysis/provider";
const analyzer = new LocalIssueAnalyzer();
describe("HTML corpus: expected issue, abstention, geography and secondary topics", () => {
  for (const fixture of cases)
    test(fixture.id, async () => {
      installDOM(readFileSync(`tests/fixtures/pages/${fixture.file}`, "utf8"));
      const result = await analyzer.analyze(await extractPage());
      expect(result.primaryIssue?.id ?? null).toBe(fixture.expectedIssue);
      expect(result.status).toBe(fixture.expectedStatus);
      expect(result.geographicScope).toBe(fixture.expectedScope);
      if (fixture.expectedPlace)
        expect(
          result.geographicReferences.map((place) => place.name),
        ).toContain(fixture.expectedPlace);
      for (const secondary of fixture.expectedSecondary)
        expect(result.secondaryIssues.map((issue) => issue.id)).toContain(
          secondary,
        );
      if (result.primaryIssue) {
        expect(result.primaryIssue.confidence).toBeGreaterThan(0);
        expect(result.primaryIssue.confidence).toBeLessThan(1);
      }
    });
});
test("structured evidence, government levels and entity references", async () => {
  const result = await analyzer.analyze(
    page(
      "Congress is reviewing Medicaid and health insurance policy across the United States. Hospitals asked for more public health funding to improve medical care for uninsured residents. Healthcare access remains a priority for lawmakers and community organizations.",
      "Congress considers health care funding",
    ),
  );
  expect(result.entities.map((e) => e.name)).toContain("US Congress");
  expect(result.governmentLevels).toContain("federal");
  expect(result.actionCategories).toContain("contact");
  expect(result.primaryIssue?.terms).toContain("medicaid");
  expect(result.explanation).toContain("health insurance");
});
test("repetition cannot drown out more specific evidence", async () => {
  const result = await analyzer.analyze(
    page(
      "housing ".repeat(500) +
        " Reproductive rights and abortion access are part of the public policy debate. Residents discussed an abortion ban and reproductive health.",
    ),
  );
  expect(result.primaryIssue?.id).toBe("reproductive");
});
test("optional provider is dependency injection, local is the default", () => {
  expect(createIssueAnalyzer().id).toBe("local-evidence-v1");
  expect(createIssueAnalyzer(analyzer)).toBe(analyzer);
});
