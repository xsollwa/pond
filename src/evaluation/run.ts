import {
  RemoteIssueAnalyzer,
  ConservativeFallback,
} from "../intelligence/analyzers";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { corpusSchema } from "./corpus";
import { LegacyBaselineAnalyzer } from "../intelligence/legacy-baseline";
import { validateAnalysis } from "../intelligence/contracts";
import { evaluationReport, readableReport } from "./report";
import type { EvaluationOutcome } from "./metrics";
export async function runEvaluation(args: string[]): Promise<void> {
  let split = "all",
    provider = "legacy";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--split" && args[i + 1]) split = args[++i]!;
    else if (args[i] === "--analyzer" && args[i + 1]) provider = args[++i]!;
    else
      throw new Error(
        "Usage: pnpm eval [--split all|development|calibration|reserved_test] [--analyzer legacy|remote|fallback]",
      );
  }
  if (!["all", "development", "calibration", "reserved_test"].includes(split))
    throw new Error("Unknown split");
  if (!["legacy", "remote", "fallback"].includes(provider))
    throw new Error("Unknown analyzer.");
  const corpus = corpusSchema.parse(
    JSON.parse(
      await readFile("tests/fixtures/intelligence/corpus.json", "utf8"),
    ),
  );
  const digest = createHash("sha256")
    .update(JSON.stringify(corpus.cases))
    .digest("hex");
  if (digest !== corpus.fixtureSha256)
    throw new Error(
      "Corpus changed without an intentional version/digest update.",
    );
  if (
    provider === "remote" &&
    (!process.env.POND_ENDPOINT || !process.env.POND_EXTENSION_ORIGIN)
  )
    throw new Error(
      "Remote evaluation requires POND_ENDPOINT and POND_EXTENSION_ORIGIN; no simulated model results will be substituted.",
    );
  const analyzer =
    provider === "remote"
      ? new RemoteIssueAnalyzer(
          process.env.POND_ENDPOINT!,
          process.env.POND_EXTENSION_ORIGIN!,
        )
      : provider === "fallback"
        ? new ConservativeFallback()
        : new LegacyBaselineAnalyzer();
  const rows: EvaluationOutcome[] = [];
  for (const fixture of corpus.cases.filter(
    (item) => split === "all" || item.split === split,
  )) {
    if (provider === "remote")
      await new Promise((resolve) => setTimeout(resolve, 2100));
    const started = performance.now();
    try {
      const prediction = validateAnalysis(
        await analyzer.analyze(fixture.page),
        fixture.page,
      );
      rows.push({
        fixture,
        prediction,
        error: null,
        durationMs: performance.now() - started,
      });
    } catch {
      rows.push({
        fixture,
        prediction: null,
        error: "Provider execution or schema/evidence validation failed",
        durationMs: performance.now() - started,
      });
    }
  }
  const report = evaluationReport(corpus, rows, analyzer.id, split),
    readable = readableReport(report);
  await mkdir("test-results/intelligence", { recursive: true });
  await writeFile(
    `test-results/intelligence/${provider}-${split}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  await writeFile(
    `test-results/intelligence/${provider}-${split}.md`,
    readable,
  );
  console.log(readable);
  if (report.metrics.errorCount)
    throw new Error(
      `${report.metrics.errorCount} provider/schema failures; see report`,
    );
}
