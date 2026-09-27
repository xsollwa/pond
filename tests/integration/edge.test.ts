// @vitest-environment node
import { beforeEach, it, expect, vi } from "vitest";
import { handleEdgeRequest, type EdgeQuotaClient } from "../../src/server/edge";
import { EdgeQuota } from "../../src/server/edge-quota";
import { ConservativeFallback } from "../../src/intelligence/analyzers";
import { pageRepresentationSchema } from "../../src/intelligence/contracts";
import corpus from "../fixtures/intelligence/corpus.json";
import identity from "../../deployment/extension-identity.json";
const origin = `chrome-extension://${identity.id}`,
  firefox = "moz-extension://0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b";
const page = pageRepresentationSchema.parse(corpus.cases[0]!.page);
const model = vi.fn();
let store: Map<string, unknown>, quota: EdgeQuotaClient;
const memoryStorage = (map: Map<string, unknown>) => ({
  get: async (key: string) => structuredClone(map.get(key)),
  put: async (key: string, value: unknown) => {
    map.set(key, structuredClone(value));
  },
});
const wrap = (q: EdgeQuota): EdgeQuotaClient => ({
  admit: async (c) => q.admit(c),
  reserve: (c) => q.reserve(c),
});
beforeEach(async () => {
  store = new Map();
  quota = wrap(new EdgeQuota(memoryStorage(store), 4, 2));
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
});
const config = {
  apiKey: "test-provider-key",
  model: "test-model",
  origins: [origin],
  timeoutMs: 1000,
};
const request = (
  body: unknown,
  headers: Record<string, string> = {},
  init: RequestInit = {},
) =>
  handleEdgeRequest(
    new Request("https://pond.example/analyze", {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.7",
        ...headers,
      },
      body: JSON.stringify(body),
      ...init,
    }),
    config,
    quota,
    model,
  );
it("reports health without calling the model", async () => {
  const response = await handleEdgeRequest(
    new Request("https://pond.example/healthz"),
    config,
    quota,
    model,
  );
  expect(await response.json()).toEqual({ status: "ready" });
  const missing = await handleEdgeRequest(
    new Request("https://pond.example/healthz"),
    { ...config, apiKey: "" },
    quota,
    model,
  );
  expect(missing.status).toBe(503);
  expect(model).not.toHaveBeenCalled();
});
it("serves Chrome/Edge and Firefox extension origins with pinned CORS", async () => {
  const chrome = await request({ page });
  expect(chrome.status).toBe(200);
  expect(chrome.headers.get("access-control-allow-origin")).toBe(origin);
  expect((await chrome.json()).analyzer.mode).toBe("server_semantic");
  const fox = await request(
    { page },
    { origin: firefox, "cf-connecting-ip": "203.0.113.8" },
  );
  expect(fox.status).toBe(200);
  expect(fox.headers.get("access-control-allow-origin")).toBe(firefox);
  const preflight = await request(null, {}, { method: "OPTIONS", body: null });
  expect(preflight.status).toBe(204);
});
it("rejects missing and unapproved origins before invoking a model", async () => {
  expect((await request({ page }, { origin: "" })).status).toBe(403);
  expect(
    (await request({ page }, { origin: "https://attacker.example" })).status,
  ).toBe(403);
  expect(
    (
      await request(
        { page },
        { origin: "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
      )
    ).status,
  ).toBe(403);
  expect(model).not.toHaveBeenCalled();
});
it("identifies clients only by Cloudflare's CF-Connecting-IP", async () => {
  const response = await request(
    { page },
    {
      "cf-connecting-ip": "",
      "x-real-ip": "203.0.113.9",
      "x-forwarded-for": "203.0.113.8",
    },
  );
  expect(response.status).toBe(400);
  expect(model).not.toHaveBeenCalled();
});
it("rejects oversized, invalid-schema and compressed requests before spending", async () => {
  expect((await request({ padding: "x".repeat(81000) })).status).toBe(413);
  expect((await request({ page, rawHistory: "secret" })).status).toBe(400);
  expect((await request({ page }, { "content-encoding": "gzip" })).status).toBe(
    415,
  );
  expect(
    (await request({ page }, { "content-type": "text/plain" })).status,
  ).toBe(415);
  expect(model).not.toHaveBeenCalled();
  expect(store.get("ledger")).toBeUndefined();
});
it("caps each client daily and globally, with retry guidance", async () => {
  await request({ page });
  await request({ page });
  const limited = await request({ page });
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBeTruthy();
  expect((await limited.json()).error.code).toBe("daily_limit");
  for (const ip of ["198.51.100.1", "198.51.100.2"])
    expect((await request({ page }, { "cf-connecting-ip": ip })).status).toBe(
      200,
    );
  const full = await request({ page }, { "cf-connecting-ip": "198.51.100.3" });
  expect((await full.json()).error.code).toBe("daily_capacity");
  expect(model).toHaveBeenCalledTimes(4);
});
it("groups IPv6 clients by /64", async () => {
  await request({ page }, { "cf-connecting-ip": "2001:db8:1:2::1" });
  await request({ page }, { "cf-connecting-ip": "2001:db8:1:2::2" });
  const response = await request(
    { page },
    { "cf-connecting-ip": "2001:db8:1:2:ffff::3" },
  );
  expect((await response.json()).error.code).toBe("daily_limit");
});
it("applies the per-minute client limit", async () => {
  const roomy = wrap(new EdgeQuota(memoryStorage(new Map()), 100, 100));
  const statuses = [];
  for (let i = 0; i < 7; i++)
    statuses.push(
      (
        await handleEdgeRequest(
          new Request("https://pond.example/analyze", {
            method: "POST",
            headers: {
              origin,
              "content-type": "application/json",
              "cf-connecting-ip": "203.0.113.50",
            },
            body: JSON.stringify({ page }),
          }),
          config,
          roomy,
          model,
        )
      ).status,
    );
  expect(statuses.slice(0, 6).every((s) => s === 200)).toBe(true);
  expect(statuses[6]).toBe(429);
});
it("persists budgets across instances, stores no raw IPs and fails closed on corruption", async () => {
  await request({ page });
  const ledger = JSON.stringify(store.get("ledger"));
  expect(ledger).not.toContain("203.0.113.7");
  const restarted = new EdgeQuota(memoryStorage(store), 1, 40);
  expect((await restarted.reserve("a".repeat(64))).ok).toBe(false);
  store.set("ledger", { day: "garbage" });
  await expect(
    new EdgeQuota(memoryStorage(store)).reserve("a".repeat(64)),
  ).rejects.toThrow();
});
it("redacts provider exceptions and times out slow analysis", async () => {
  model.mockRejectedValueOnce(new Error("test-provider-key private page body"));
  const failed = await request({ page });
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toMatch(
    /test-provider-key|private page body/,
  );
  model.mockImplementationOnce(
    (_page, signal: AbortSignal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("cancelled")), {
          once: true,
        }),
      ),
  );
  const slow = await request({ page }, { "cf-connecting-ip": "203.0.113.60" });
  expect(slow.status).toBe(504);
  expect((await slow.json()).error.code).toBe("timeout");
});
