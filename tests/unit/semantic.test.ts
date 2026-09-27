import { it, expect, vi, afterEach } from "vitest";
import {
  ConservativeFallback,
  RemoteIssueAnalyzer,
  serviceURL,
} from "../../src/intelligence/analyzers";
import corpus from "../fixtures/intelligence/corpus.json";
import { pageRepresentationSchema } from "../../src/intelligence/contracts";
const page = pageRepresentationSchema.parse(corpus.cases[0]!.page);
afterEach(() => vi.unstubAllGlobals());
it("abstains instead of turning incidental medical words into a diagnosis of the topic", async () => {
  const result = await new ConservativeFallback().analyze(page);
  expect(result.status).toBe("unknown");
  expect(result.primaryIssue).toBeNull();
});
it("rejects insecure nonlocal services and URL credentials", () => {
  expect(() => serviceURL("http://example.com/analyze")).toThrow();
  expect(() => serviceURL("https://user:secret@example.com")).toThrow();
  expect(serviceURL("http://127.0.0.1:8787/analyze").hostname).toBe(
    "127.0.0.1",
  );
});
it("rejects fabricated model evidence", async () => {
  const result = await new ConservativeFallback().analyze(page);
  result.evidence = [{ id: "a", blockId: "missing", quote: "invented" }];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(result))),
  );
  await expect(
    new RemoteIssueAnalyzer("https://example.com/analyze").analyze(page),
  ).rejects.toThrow("Unsupported evidence");
});
it("transmits structured page only, no user location or browsing URL", async () => {
  const result = await new ConservativeFallback().analyze(page);
  result.analyzer.mode = "server_semantic";
  result.analyzer.confidenceKind = "uncalibrated_model";
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(result)));
  vi.stubGlobal("fetch", fetcher);
  await new RemoteIssueAnalyzer(
    "https://example.com/analyze",
    "session",
  ).analyze(page);
  expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({ page });
});
