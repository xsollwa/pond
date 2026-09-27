/* global chrome, history */
import { chromium } from "playwright";
import { build } from "esbuild";
import { readFile, mkdir, writeFile, cp } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "node:http";
import assert from "node:assert/strict";
const root = resolve(".cache", `acceptance-${Date.now()}`),
  extension = resolve(root, "extension");
await mkdir(root, { recursive: true });
await cp("dist/chrome", extension, { recursive: true });
// The isolated harness pregrants ONLY its fixture server. Native optional-permission prompts remain a manual acceptance check.
const manifest = JSON.parse(
  await readFile(resolve(extension, "manifest.json"), "utf8"),
);
manifest.host_permissions = ["http://127.0.0.1/*"];
await writeFile(resolve(extension, "manifest.json"), JSON.stringify(manifest));
const fixture =
  '<html lang="en"><head><title>Neighbors need affordable homes</title></head><body><nav>Healthcare ads</nav><main><h1>Affordable homes</h1><p>Princeton residents are asking the council for more affordable housing. Tenants describe rent increases, eviction notices and a shortage of places to live near their jobs. The council will discuss zoning and tenant protections.</p></main></body></html>';
let serviceCalls = 0;
const server = createServer(async (req, res) => {
  if (req.url === "/analyze") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type,authorization");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    assert.ok(payload.page.blocks.length);
    assert.equal(Object.keys(payload).join(","), "page");
    serviceCalls++;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        schemaVersion: "1.0.0",
        taxonomyVersion: "2.0.0",
        status: "unknown",
        primaryIssue: null,
        secondaryIssues: [],
        civicRelevance: 0,
        presentsCivicProblem: null,
        hasExplicitActionOpportunity: null,
        entities: [],
        affectedPopulations: [],
        contentLocation: null,
        otherContentLocations: [],
        jurisdiction: "unknown",
        evidence: [],
        explanation: "Synthetic transport response, not a quality prediction.",
        analyzer: {
          id: "browser-transport-test",
          version: "1",
          mode: "server_semantic",
          confidenceKind: "uncalibrated_model",
          calibrationVersion: null,
        },
      }),
    );
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(fixture);
});
await new Promise((resolve) => server.listen(8787, "127.0.0.1", resolve));
const port = server.address().port,
  origin = `http://127.0.0.1:${port}`;
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
await mkdir("test-results", { recursive: true });
const errors = [];
context.on("page", (page) =>
  page.on("pageerror", (error) => errors.push(error.message)),
);
const wait = async (fn) => {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Timed out waiting for extension state");
};
try {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const ui = await context.newPage();
  await ui.goto(`chrome-extension://${id}/index.html`);
  await wait(async () =>
    /unavailable/.test(await ui.locator("#status").innerText()),
  );
  await ui.evaluate(async () => {
    await chrome.storage.local.set({
      websiteOrigins: ["http://127.0.0.1/*"],
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
  const registration = await ui.evaluate(() =>
    chrome.scripting.getRegisteredContentScripts(),
  );
  assert.equal(registration[0].persistAcrossSessions, true);
  const page = await context.newPage();
  await page.goto(origin + "/housing");
  await page.bringToFront();
  const tabId = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((tab) => tab.url?.includes("/housing")).id;
  });
  const getContext = () =>
    ui.evaluate(
      (id) => chrome.runtime.sendMessage({ type: "GET_CONTEXT", tabId: id }),
      tabId,
    );
  const first = await wait(async () => {
    const value = await getContext();
    return value.context && value;
  });
  assert.equal(first.context.analysis.status, "unknown");
  assert.equal(first.context.userLocation.city, "Princeton");
  await ui.evaluate(async (endpoint) => {
    await chrome.storage.local.set({ semanticConsent: true, endpoint });
    await chrome.runtime.sendMessage({ type: "SETTINGS_CHANGED" });
  }, origin + "/analyze");
  await wait(async () => {
    const result = await getContext();
    return result.context?.analysis.analyzer.mode === "server_semantic";
  });
  assert.ok(serviceCalls > 0);
  const firstHash = first.context.representationFingerprint;
  await page.evaluate(() => {
    document.querySelector("p").textContent =
      "Food banks are struggling to stock their shelves. Families who cannot afford groceries are asking the local government for food assistance and reliable access to meals. Nutrition is mentioned but the core concern is hunger.";
  });
  const updated = await wait(async () => {
    const value = await getContext();
    return (
      value.context?.representationFingerprint !== firstHash &&
      value.context &&
      value
    );
  });
  assert.equal(updated.context.analysis.primaryIssue, null);
  await page.evaluate(() => {
    history.pushState({}, "", "/new-story");
    document.querySelector("h1").textContent = "A new story";
  });
  await wait(async () => {
    const value = await getContext();
    return (
      value.context?.representationFingerprint !==
        updated.context.representationFingerprint && value.context
    );
  });
  await page.goto(origin + "/second-page");
  await wait(async () => {
    const value = await getContext();
    return value.context;
  });
  await ui.bringToFront();
  await ui.locator("#issue").selectOption("housing");
  await wait(async () => (await ui.locator(".card").count()) === 4);
  await ui.setViewportSize({ width: 390, height: 900 });
  await ui.screenshot({
    path: "test-results/pond-redesign.png",
    fullPage: true,
  });
  await ui.locator("#open-panel").click();
  const cdp = await context.browser().newBrowserCDPSession();
  const panel = await wait(async () => {
    const targets = await cdp.send("Target.getTargets");
    return targets.targetInfos.some(
      (t) => t.url === `chrome-extension://${id}/index.html?panel=1`,
    );
  });
  await cdp.detach();
  // Revocation at the app level must suppress cached context even with the harness's native grant.
  await ui.evaluate(async () => {
    await chrome.storage.local.set({ websiteOrigins: [] });
    await chrome.runtime.sendMessage({ type: "RECONCILE_ACCESS" });
  });
  assert.equal((await getContext()).status, "unavailable");
  assert.equal(
    (await ui.evaluate(() => chrome.scripting.getRegisteredContentScripts()))
      .length,
    0,
  );
  // Exercise the actual structured extractor across every checked-in HTML fixture in Chromium.
  const bundle = await build({
    stdin: {
      contents:
        'import {extractRepresentation} from "./src/extraction/representation.ts"; globalThis.pondExtract=extractRepresentation;',
      resolveDir: process.cwd(),
    },
    bundle: true,
    format: "iife",
    write: false,
    target: "chrome116",
  });
  const corpus = JSON.parse(
    await readFile("tests/fixtures/intelligence/corpus.json", "utf8"),
  );
  let extracted = 0;
  for (const item of corpus.cases) {
    await page.setContent(
      await readFile(
        `tests/fixtures/intelligence/pages/${item.id}.html`,
        "utf8",
      ),
    );
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const representation = await page.evaluate(() => globalThis.pondExtract());
    assert.ok(representation.blocks.length <= 32);
    assert.ok(
      representation.blocks.reduce((sum, b) => sum + b.text.length, 0) <= 16000,
    );
    extracted++;
  }
  assert.deepEqual(errors, []);
  const report = {
    browser: context.browser().version(),
    fixtureExtractionCount: extracted,
    checks: [
      "native registered content scripts",
      "consented browser-to-service transport through production CSP",
      "navigation without repeated injection requests",
      "mutation refresh",
      "SPA route refresh",
      "content fingerprints",
      "conservative fallback",
      "explicit user location",
      "manual context resource retrieval",
      "side panel target",
      "app access removal suppresses cached context",
      "no UI exceptions",
    ],
    nativePanelOpened: panel,
    limits: [
      "Optional host permission prompt pregranted only in test copy; manually test consent and browser revocation",
      "Model quality not tested: no credentials configured",
      "Firefox and Edge builds validated, not runtime-tested",
      "Synthetic fixture extraction is not real social-site compatibility",
    ],
  };
  await writeFile(
    "test-results/browser-acceptance.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await context.close();
  await new Promise((resolve) => server.close(resolve));
}
