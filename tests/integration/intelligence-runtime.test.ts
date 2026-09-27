import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  pageRepresentationSchema,
  type IssueAnalysis,
} from "../../src/intelligence/contracts";
import corpus from "../fixtures/intelligence/corpus.json";
const remote = vi.hoisted(() => vi.fn());
vi.mock("../../src/intelligence/analyzers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/intelligence/analyzers")>();
  return {
    ...actual,
    RemoteIssueAnalyzer: class {
      analyze = remote;
    },
  };
});
const page = pageRepresentationSchema.parse(corpus.cases[0]!.page);
let analysis: IssueAnalysis;
beforeEach(async () => {
  vi.resetModules();
  remote.mockReset();
  vi.stubGlobal("chrome", {
    runtime: { sendMessage: vi.fn(async () => {}) },
    storage: {
      local: {
        get: vi.fn(async () => ({
          semanticConsent: true,
          endpoint: "https://service.example/analyze",
        })),
      },
      session: { get: vi.fn(async () => ({ serviceToken: "session" })) },
    },
  });
  const { ConservativeFallback } =
    await import("../../src/intelligence/analyzers");
  analysis = await new ConservativeFallback().analyze(page);
});
afterEach(() => vi.unstubAllGlobals());
it("reuses unchanged content and invalidates reuse on settings reset", async () => {
  remote.mockResolvedValue(analysis);
  const engine = await import("../../src/runtime/intelligence");
  await engine.analyzeSnapshot(1, page, "a".repeat(64));
  await engine.analyzeSnapshot(1, page, "a".repeat(64));
  expect(remote).toHaveBeenCalledTimes(1);
  engine.resetIntelligence();
  await engine.analyzeSnapshot(1, page, "a".repeat(64));
  expect(remote).toHaveBeenCalledTimes(2);
});
it("late responses cannot repopulate state or cache after access revocation", async () => {
  let complete!: (value: IssueAnalysis) => void;
  remote.mockImplementationOnce(
    () =>
      new Promise<IssueAnalysis>((resolve) => {
        complete = resolve;
      }),
  );
  const engine = await import("../../src/runtime/intelligence");
  const pending = engine.analyzeSnapshot(1, page, "b".repeat(64));
  await vi.waitFor(() => expect(remote).toHaveBeenCalledOnce());
  engine.resetIntelligence();
  complete(analysis);
  await pending;
  expect(engine.states.size).toBe(0);
  remote.mockResolvedValue(analysis);
  await engine.analyzeSnapshot(1, page, "b".repeat(64));
  expect(remote).toHaveBeenCalledTimes(2);
});
it("invalidating an absent tab does not emit a refresh loop", async () => {
  const engine = await import("../../src/runtime/intelligence");
  engine.invalidate(100);
  const host = globalThis as unknown as {
    chrome: { runtime: { sendMessage: ReturnType<typeof vi.fn> } };
  };
  expect(host.chrome.runtime.sendMessage).not.toHaveBeenCalled();
});
