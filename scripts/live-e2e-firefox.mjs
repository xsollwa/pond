/* global browser, fetch */
// Firefox counterpart of live-e2e.mjs: real deployed backend + real model, no interception.
import puppeteer from "puppeteer-core";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const executablePath = process.env.POND_FIREFOX;
if (!executablePath) throw new Error("Set POND_FIREFOX to a Firefox binary.");
const config = JSON.parse(await readFile("deployment/production.json", "utf8"));
if (!config.endpoint?.startsWith("https://"))
  throw new Error("Deploy the real service and configure production first.");
const health = await fetch(new URL("/healthz", config.endpoint));
assert.equal(health.status, 200, "Hosted backend must be ready");
const corpus = JSON.parse(
  await readFile("tests/fixtures/intelligence/corpus.json", "utf8"),
);
const cases = [
  { id: "pantry-rations", parent: "economic_security" },
  {
    id: corpus.cases.find((item) =>
      item.expected.primaryIssue?.startsWith("housing."),
    ).id,
    parent: "housing",
  },
];
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
const root = resolve(".cache", `live-firefox-${Date.now()}`),
  extension = resolve(root, "extension");
await mkdir(root, { recursive: true });
await cp("dist/production/firefox", extension, { recursive: true });
const manifest = JSON.parse(
  await readFile(resolve(extension, "manifest.json"), "utf8"),
);
const addonId = manifest.browser_specific_settings.gecko.id;
manifest.host_permissions.push("http://127.0.0.1/*");
await writeFile(resolve(extension, "manifest.json"), JSON.stringify(manifest));
// Firefox gives each install a random internal UUID; pin it so the test can open extension pages.
const uuid = "0f1e2d3c-4b5a-4978-8a9b-0c1d2e3f4a5b";
const instance = await puppeteer.launch({
  browser: "firefox",
  executablePath,
  headless: true,
  // WebDriver BiDi only navigates to moz-extension pages with system access enabled.
  args: ["--remote-allow-system-access"],
  extraPrefsFirefox: {
    "extensions.webextensions.uuids": JSON.stringify({ [addonId]: uuid }),
  },
});
const results = [];
try {
  await instance.installExtension(extension);
  const base = `moz-extension://${uuid}`;
  const ui = await instance.newPage();
  // BiDi never reports load completion for privileged pages; wait for the rendered view instead.
  ui.goto(`${base}/index.html`, { timeout: 15000 }).catch(() => {});
  const until = async (check, timeout, message) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await ui.evaluate(check).catch(() => false)) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(message);
  };
  await until(
    () =>
      typeof browser !== "undefined" &&
      document.readyState === "complete" &&
      Boolean(document.body?.innerText.trim()),
    15000,
    "Pond view did not render in Firefox",
  );
  const granted = await ui.evaluate(() =>
    browser.permissions.contains({
      origins: ["http://127.0.0.1/*"],
    }),
  );
  assert.ok(granted, "Fixture-origin host access must be granted");
  await ui.evaluate(async () => {
    await browser.storage.local.set({
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
    await browser.runtime.sendMessage({ type: "RECONCILE_ACCESS" });
  });
  const page = await instance.newPage();
  for (const item of cases) {
    await page.goto(`http://127.0.0.1:${port}/${item.id}`);
    await page.bringToFront();
    const tabId = await ui.evaluate(
      async (path) =>
        (await browser.tabs.query({})).find((tab) => tab.url?.endsWith(path))
          ?.id,
      `/${item.id}`,
    );
    assert.ok(tabId);
    let result;
    const deadline = Date.now() + 65000;
    while (Date.now() < deadline) {
      result = await ui.evaluate(
        (tabId) => browser.runtime.sendMessage({ type: "GET_CONTEXT", tabId }),
        tabId,
      );
      if (result?.context?.analysis.analyzer.mode === "server_semantic") break;
      if (result?.status === "ready" && result.notice)
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
    await until(
      () => document.querySelectorAll(".card").length >= 2,
      10000,
      `Opportunity cards did not render for ${item.id}`,
    );
    // BiDi cannot screenshot privileged (moz-extension) contexts, so no screenshot is captured here.
    results.push({
      fixture: item.id,
      provider: result.context.analysis.analyzer,
      primaryIssue: result.context.analysis.primaryIssue.id,
      cards: await ui.$$eval(".card", (cards) => cards.length),
      evidenceCount: result.context.analysis.evidence.length,
    });
  }
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/live-e2e-firefox.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        endpoint: config.endpoint,
        build: "firefox",
        addonId,
        realModel: true,
        results,
        limits: [
          "Temporary add-on install with fixture-origin access pregranted in an isolated copy.",
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ realModel: true, results }, null, 2));
} finally {
  await instance.close();
  await new Promise((resolve) => server.close(resolve));
}
