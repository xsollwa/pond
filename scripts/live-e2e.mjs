/* global chrome, fetch */
// Real deployed backend + real model only. No fetch/route interception or synthetic analysis.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const config = JSON.parse(await readFile("deployment/production.json", "utf8"));
if (!config.endpoint?.startsWith("https://"))
  throw new Error("Deploy the real service and configure production first.");
// Chrome and Edge share the Chromium engine and the key-derived extension ID.
const build = process.env.POND_LIVE_BUILD ?? "chrome";
if (!["chrome", "edge"].includes(build))
  throw new Error("POND_LIVE_BUILD must be chrome or edge");
const identity = JSON.parse(
  await readFile("deployment/extension-identity.json", "utf8"),
);
const health = await fetch(new URL("/healthz", config.endpoint));
assert.equal(health.status, 200, "Hosted backend must be ready");
const cases = [
  { id: "pantry-rations", parent: "economic_security" },
  { id: "housing-rent", parent: "housing" },
];
// Choose the frozen housing fixture by label, without hardcoding a model answer into application code.
const corpus = JSON.parse(
  await readFile("tests/fixtures/intelligence/corpus.json", "utf8"),
);
cases[1].id = corpus.cases.find((item) =>
  item.expected.primaryIssue?.startsWith("housing."),
).id;
const server = createServer(async (req, res) => {
  const item = cases.find((item) => req.url === `/${item.id}`);
  if (!item) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.end(
    await readFile(`tests/fixtures/intelligence/pages/${item.id}.html`, "utf8"),
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const root = resolve(".cache", `live-${Date.now()}`),
  extension = resolve(root, "extension");
await mkdir(root, { recursive: true });
await cp(`dist/production/${build}`, extension, { recursive: true });
const manifest = JSON.parse(
  await readFile(resolve(extension, "manifest.json"), "utf8"),
);
assert.equal(manifest.key, identity.publicKey);
manifest.host_permissions.push("http://127.0.0.1/*");
await writeFile(resolve(extension, "manifest.json"), JSON.stringify(manifest));
const context = await chromium.launchPersistentContext(
  resolve(root, "profile"),
  {
    executablePath: process.env.POND_CHROMIUM,
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  },
);
const results = [];
try {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  assert.equal(new URL(worker.url()).host, identity.id);
  const ui = await context.newPage();
  await ui.goto(`chrome-extension://${identity.id}/index.html`);
  await ui.evaluate(async () => {
    await chrome.storage.local.set({
      websiteOrigins: ["http://127.0.0.1/*"],
      semanticConsent: true,
      userLocation: {
        city: "Princeton",
        state: "NJ",
        country: "US",
        county: null,
        coordinates: null,
        confidence: 1,
        provenance: "explicit_user",
        evidenceIds: [],
      },
    });
    await chrome.runtime.sendMessage({ type: "RECONCILE_ACCESS" });
  });
  const page = await context.newPage();
  for (const item of cases) {
    await page.goto(`http://127.0.0.1:${port}/${item.id}`);
    await page.bringToFront();
    const tabId = await worker.evaluate(
      async (path) =>
        (await chrome.tabs.query({})).find((tab) => tab.url?.endsWith(path))
          ?.id,
      `/${item.id}`,
    );
    assert.ok(tabId);
    let result;
    const deadline = Date.now() + 65000;
    while (Date.now() < deadline) {
      result = await ui.evaluate(
        (tabId) => chrome.runtime.sendMessage({ type: "GET_CONTEXT", tabId }),
        tabId,
      );
      if (result.context?.analysis.analyzer.mode === "server_semantic") break;
      if (result.status === "ready" && result.notice)
        throw new Error(result.notice);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.equal(
      result?.context?.analysis.analyzer.id,
      "anthropic",
      "A real provider result is required; no fallback or mock accepted",
    );
    assert.equal(
      result.context.analysis.primaryIssue?.id.split(".")[0],
      item.parent,
      `Unexpected real classification for ${item.id}`,
    );
    // The extension view remains backgrounded so its active-tab query targets the fixture page.
    await ui.waitForFunction(
      () => document.querySelectorAll(".card").length >= 2,
      undefined,
      { timeout: 10000 },
    );
    await ui.screenshot({
      path: resolve(root, `${item.id}.png`),
      fullPage: true,
    });
    results.push({
      fixture: item.id,
      provider: result.context.analysis.analyzer,
      primaryIssue: result.context.analysis.primaryIssue.id,
      cards: await ui.locator(".card").count(),
      evidenceCount: result.context.analysis.evidence.length,
    });
  }
  await mkdir("test-results", { recursive: true });
  await writeFile(
    `test-results/live-e2e${build === "chrome" ? "" : `-${build}`}.json`,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        endpoint: config.endpoint,
        build,
        extensionId: identity.id,
        realModel: true,
        results,
        limits: [
          "Fixture-origin access pregranted in isolated copy; normal consent UI still needs manual acceptance.",
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ realModel: true, results }, null, 2));
} finally {
  await context.close();
  await new Promise((resolve) => server.close(resolve));
}
