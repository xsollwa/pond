import { readFileSync } from "node:fs";
import { test, expect, vi } from "vitest";
import data from "../../data/opportunities.json";
import { installDOM, page } from "../helpers";
import { mountPond } from "../../src/ui/controller";
import type {
  BrowserAdapter,
  PageCapture,
} from "../../src/platform/browser-adapter";
import { PageAccessError } from "../../src/platform/browser-adapter";
import { PondPipeline } from "../../src/application/pipeline";
import { LocalIssueAnalyzer } from "../../src/analysis/local-analyzer";
import { LocalOpportunityRepository } from "../../src/opportunities/local-repository";
import { WeightedOpportunityRanker } from "../../src/ranking/ranker";
import { USER_LOCATION } from "../../src/domain/config";
const housing = page(
  "Affordable housing and tenant protections are under review. Princeton council is discussing housing policy and zoning reform. Residents asked for rental assistance at a public meeting to reduce eviction and homelessness for families living in the community.",
  "Housing report",
);
function setup(
  capture: BrowserAdapter["capture"] = async () => ({
    page: housing,
    tabId: 1,
  }),
  records: unknown = data,
) {
  installDOM(readFileSync("public/index.html", "utf8"));
  let onChange = () => {};
  const adapter: BrowserAdapter = {
    capture,
    panelAvailable: true,
    preparePanel: async () => {},
    openPanel: vi.fn(async () => {}),
    localData: async () => records,
    observeChanges: (callback) => {
      onChange = callback;
      return vi.fn();
    },
  };
  const pipeline = new PondPipeline(
    new LocalIssueAnalyzer(),
    new LocalOpportunityRepository(async () => records),
    new WeightedOpportunityRanker(),
    () => new Date("2026-09-24T00:00:00Z"),
  );
  return {
    dispose: mountPond(adapter, pipeline, USER_LOCATION),
    change: () => onChange(),
  };
}
const ready = () =>
  vi.waitFor(() =>
    expect(document.querySelector<HTMLButtonElement>("#retry")!.disabled).toBe(
      false,
    ),
  );
test("renders topic, geography, cards and keyboard-native disclosure, then clears on navigation", async () => {
  const app = setup();
  await ready();
  expect(document.querySelector("#status")!.textContent).toContain("Housing");
  expect(document.querySelector("#geography")!.textContent).toContain(
    "Princeton",
  );
  expect(document.querySelectorAll(".card")).toHaveLength(4);
  expect(document.querySelectorAll("details summary")).toHaveLength(4);
  expect(document.querySelector<HTMLAnchorElement>(".card a")!.rel).toContain(
    "noopener",
  );
  app.change();
  expect(document.querySelectorAll(".card")).toHaveLength(0);
  expect(document.querySelector("#status")!.textContent).toContain(
    "Ready for this page",
  );
  app.dispose();
});
test("shows unsupported page and still allows manual exploration", async () => {
  const app = setup(async () => {
    throw new PageAccessError("unsupported", "Browser page");
  });
  await ready();
  expect(document.querySelector("#status")!.textContent).toContain(
    "can’t be read",
  );
  const select = document.querySelector<HTMLSelectElement>("#issue")!;
  select.value = "housing";
  select.dispatchEvent(new Event("change"));
  await ready();
  expect(document.querySelectorAll(".card")).toHaveLength(4);
  expect(document.querySelector(".why")!.textContent).toContain(
    "your selected issue",
  );
  app.dispose();
});
test("shows insufficient, noncivic, low-confidence, no results, stale data and errors", async () => {
  let app = setup(async () => ({ page: page("tiny"), tabId: 1 }));
  await ready();
  expect(document.querySelector("#status")!.textContent).toContain(
    "more to go on",
  );
  app.dispose();
  app = setup(async () => ({
    page: page("A delicious recipe uses flour and water. ".repeat(10)),
    tabId: 1,
  }));
  await ready();
  expect(document.querySelector("#status")!.textContent).toContain(
    "No clear civic",
  );
  app.dispose();
  app = setup(async () => ({
    page: page(
      "Residents discussed housing at a community meeting. ".repeat(8),
      "Housing",
    ),
    tabId: 1,
  }));
  await ready();
  expect(document.querySelector("#status")!.textContent).toContain("TENTATIVE");
  app.dispose();
  app = setup(undefined, { schemaVersion: 1, opportunities: [] });
  await ready();
  expect(document.querySelector("#opportunities")!.textContent).toContain(
    "No suitable ideas",
  );
  app.dispose();
  const stale = structuredClone(data);
  for (const item of stale.opportunities)
    item.freshness.checkedAt = "2020-01-01T00:00:00Z";
  app = setup(undefined, stale);
  await ready();
  expect(document.querySelector<HTMLElement>("#stale")!.hidden).toBe(false);
  app.dispose();
  app = setup(undefined, { broken: true });
  await ready();
  expect(document.querySelector("#status")!.textContent).toContain(
    "Something didn’t load",
  );
  app.dispose();
});
test("a pending old-page result cannot overwrite navigation state", async () => {
  let finish!: (value: PageCapture) => void;
  const app = setup(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  app.change();
  finish({ page: housing, tabId: 1 });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(document.querySelector("#status")!.textContent).toContain(
    "Ready for this page",
  );
  expect(document.querySelectorAll(".card")).toHaveLength(0);
  app.dispose();
});
