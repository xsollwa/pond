import { beforeEach, afterEach, it, expect, vi } from "vitest";
import type { Server } from "node:http";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPondServer } from "../../src/server/app";
import { analyzeWithModel } from "../../src/server/provider";
import { Budget } from "../../src/server/limits";
import { ConservativeFallback } from "../../src/intelligence/analyzers";
import { pageRepresentationSchema } from "../../src/intelligence/contracts";
import corpus from "../fixtures/intelligence/corpus.json";
import identity from "../../deployment/extension-identity.json";
const realFetch = fetch,
  origin = `chrome-extension://${identity.id}`;
const page = pageRepresentationSchema.parse(corpus.cases[0]!.page);
let server: Server, url: string, directory: string;
const model = vi.fn();
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "pond-service-"));
  model.mockReset();
  const result = await new ConservativeFallback().analyze(page);
  result.analyzer = {
    id: "anthropic",
    version: "test-model",
    mode: "server_semantic",
    confidenceKind: "uncalibrated_model",
    calibrationVersion: null,
  };
  model.mockResolvedValue(result);
  server = createPondServer(
    {
      apiKey: "test-provider-key",
      model: "test-model",
      origins: [origin],
      budgetFile: join(directory, "budget.json"),
      production: true,
      dailyLimit: 4,
      perClientDaily: 2,
      timeoutMs: 1000,
    },
    model,
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No listener");
  url = `http://127.0.0.1:${address.port}/analyze`;
});
afterEach(async () => {
  vi.unstubAllGlobals();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
});
const request = (body: unknown, headers: Record<string, string> = {}) =>
  realFetch(url, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-real-ip": "203.0.113.7",
      ...headers,
    },
    body: JSON.stringify(body),
  });
it("allows the stable extension without a user token and pins CORS to its origin", async () => {
  const result = await request({ page });
  expect(result.status).toBe(200);
  expect(result.headers.get("access-control-allow-origin")).toBe(origin);
  expect((await result.json()).analyzer.mode).toBe("server_semantic");
});
it("rejects missing and unapproved origins before invoking a model", async () => {
  expect((await request({ page }, { origin: "" })).status).toBe(403);
  expect(
    (await request({ page }, { origin: "https://attacker.example" })).status,
  ).toBe(403);
  expect(model).not.toHaveBeenCalled();
});
it("does not accept a spoofed forwarded chain in place of the Railway client header", async () => {
  expect(
    (
      await request(
        { page },
        { "x-real-ip": "", "x-forwarded-for": "203.0.113.8" },
      )
    ).status,
  ).toBe(400);
  expect(model).not.toHaveBeenCalled();
});
it("rejects oversized, invalid-schema and compressed requests before model spending", async () => {
  expect((await request({ padding: "x".repeat(81000) })).status).toBe(413);
  expect((await request({ page, rawHistory: "secret" })).status).toBe(400);
  expect((await request({ page }, { "content-encoding": "gzip" })).status).toBe(
    415,
  );
  expect(model).not.toHaveBeenCalled();
});
it("caps each client daily and returns retry guidance", async () => {
  await request({ page });
  await request({ page });
  const response = await request({ page });
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBeTruthy();
  expect(model).toHaveBeenCalledTimes(2);
});
it("caps global spending even across different clients", async () => {
  for (let i = 1; i <= 4; i++)
    expect(
      (await request({ page }, { "x-real-ip": `203.0.113.${i}` })).status,
    ).toBe(200);
  const result = await request({ page }, { "x-real-ip": "203.0.113.99" });
  expect(result.status).toBe(429);
  expect((await result.json()).error.code).toBe("daily_capacity");
  expect(model).toHaveBeenCalledTimes(4);
});
it("redacts provider exceptions and credentials from errors", async () => {
  model.mockRejectedValue(new Error("test-provider-key private page body"));
  const response = await request({ page });
  expect(response.status).toBe(503);
  expect(await response.text()).not.toMatch(
    /test-provider-key|private page body/,
  );
});
it("aborts slow analysis and provides a useful timeout response", async () => {
  model.mockImplementation(
    (_page, signal: AbortSignal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("cancelled")), {
          once: true,
        }),
      ),
  );
  const response = await request({ page });
  expect(response.status).toBe(504);
  expect((await response.json()).error.code).toBe("timeout");
});
it("persists call budgets across restarts and rejects corrupt state", async () => {
  const file = join(directory, "quota.json");
  new Budget(file, 1).reserve("203.0.113.1");
  expect(() => new Budget(file, 1).reserve("203.0.113.2")).toThrow("capacity");
  await writeFile(file, "corrupt");
  expect(() => new Budget(file, 1)).toThrow();
});
it("rejects fabricated model evidence without returning the provider content", async () => {
  const result = await new ConservativeFallback().analyze(page);
  result.evidence = [{ id: "e", blockId: "missing", quote: "made up" }];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: JSON.stringify(result) }],
        }),
      ),
    ),
  );
  await expect(
    analyzeWithModel(page, new AbortController().signal, {
      apiKey: "test-key",
      model: "test-model",
    }),
  ).rejects.toThrow("verify");
});
