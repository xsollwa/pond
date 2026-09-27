import { extensionAPI } from "../platform/extension-api";
import { createBrowserAdapter } from "../platform/browser-adapter";
import {
  contextObjectSchema,
  geographicLocationSchema,
  type ContextObject,
  type GeographicLocation,
} from "../intelligence/contracts";
import { TAXONOMY_NODES, isTaxonomyId } from "../intelligence/taxonomy";
import { retrieveResources, exploreResources } from "../intelligence/retrieval";
import { parseOpportunities } from "../opportunities/schema";
import type { Opportunity } from "../domain/types";
const api = extensionAPI(),
  adapter = createBrowserAdapter();
const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const status = get("status"),
  results = get("results"),
  cards = get("opportunities"),
  select = get<HTMLSelectElement>("issue");
const node = (tag: string, className: string, text: string) => {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
};
let observedTabId: number | undefined;
let generation = 0,
  disposed = false,
  location: GeographicLocation | null = null,
  records: Opportunity[] = [];
function message(title: string, description: string) {
  results.hidden = true;
  cards.replaceChildren();
  get("geography").textContent = "";
  const box = node("div", "empty", "");
  box.append(node("h2", "", title), node("p", "", description));
  status.replaceChildren(box);
}
function showCards(items: Opportunity[]) {
  results.hidden = false;
  cards.replaceChildren();
  get("count").textContent = `${items.length} ideas`;
  if (!items.length)
    cards.append(
      node(
        "p",
        "empty",
        location
          ? "No matching resources in this small example dataset."
          : "Add your area in Settings to see relevant local resources.",
      ),
    );
  for (const item of items) {
    const card = node("article", "card", ""),
      top = node("div", "card-top", ""),
      heading = node("h3", "", "");
    const link = document.createElement("a");
    link.textContent = item.title + " ↗";
    link.href = item.canonicalUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    heading.append(link);
    top.append(
      node("span", "tag", item.actionType),
      node("span", "place", item.coverage.label),
    );
    card.append(
      top,
      heading,
      node("p", "org", item.organization),
      node("p", "description", item.description),
    );
    const details = document.createElement("details");
    details.append(
      node("summary", "", "About this resource"),
      node("p", "", `${item.source.name}. ${item.verification.note}`),
    );
    card.append(details);
    cards.append(card);
  }
}
function render(context: ContextObject, notice?: string) {
  const analysis = context.analysis;
  location = context.userLocation;
  const primary = analysis.primaryIssue ?? analysis.secondaryIssues[0];
  if (!primary) {
    message(
      analysis.status === "insufficient"
        ? "A little more to go on"
        : analysis.status === "not_civic"
          ? "No civic issue on this page"
          : "No clear civic issue yet",
      notice ?? analysis.explanation,
    );
    return;
  }
  const box = node("div", "detected", "");
  box.append(
    node(
      "p",
      "eyebrow",
      analysis.primaryIssue ? "THIS LOOKS LIKE" : "TOPICS ON THIS PAGE",
    ),
    node("h2", "", primary.label),
    node("p", "analysis-reason", analysis.explanation),
  );
  if (analysis.secondaryIssues.length)
    box.append(
      node(
        "p",
        "secondary",
        `Also touches on ${analysis.secondaryIssues.map((i) => i.label).join(", ")}.`,
      ),
    );
  const details = document.createElement("details");
  details.append(
    node("summary", "", "Evidence and uncertainty"),
    node(
      "p",
      "",
      "Model confidence is uncalibrated; this is a suggestion to review.",
    ),
  );
  for (const evidence of analysis.evidence.slice(0, 5))
    details.append(node("p", "", `“${evidence.quote}”`));
  box.append(details);
  status.replaceChildren(box);
  const place = analysis.contentLocation;
  get("geography").textContent =
    `Page location: ${place ? [place.city, place.state, place.country].filter(Boolean).join(", ") : "not established"}. Your area: ${location ? [location.city, location.state, location.country].filter(Boolean).join(", ") : "not set"}.`;
  showCards(retrieveResources(records, context));
}
async function refresh(force = false) {
  const current = ++generation;
  select.value = "";
  try {
    const config = await api.storage.local.get([
      "userLocation",
      "semanticConsent",
    ]);
    location = geographicLocationSchema
      .nullable()
      .parse(config.userLocation ?? null);
    get("location").textContent = location?.city ?? "Area not set";
    document.querySelector("footer")!.textContent = config.semanticConsent
      ? "Issue recognition on · short extracts sent to Pond"
      : "Local reading · remote analysis is off";
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (disposed || current !== generation) return;
    observedTabId = tab?.id;
    if (!tab?.id || !/^https?:/.test(tab.url ?? "")) {
      message(
        "This page is unavailable",
        "Open an ordinary website. Browser settings and extension stores cannot be read.",
      );
      return;
    }
    const response = (await api.runtime.sendMessage({
      type: "GET_CONTEXT",
      force,
      tabId: tab.id,
    })) as { status: string; context?: unknown; notice?: string };
    if (disposed || current !== generation) return;
    if (response.context)
      render(contextObjectSchema.parse(response.context), response.notice);
    else
      message(
        response.status === "analyzing"
          ? "Reading the context…"
          : "Pond needs website access",
        response.notice ??
          (response.status === "analyzing"
            ? "Finding the main issue and supporting evidence."
            : "Open Settings to enable automatic access once, then return to this page. The page may also still be loading or restricted by your browser."),
      );
  } catch {
    if (current === generation)
      message(
        "Could not read this page",
        "Try again, or review website access in Settings.",
      );
  }
}
for (const item of TAXONOMY_NODES.filter((n) => n.parentId === null)) {
  const option = document.createElement("option");
  option.value = item.id;
  option.textContent = item.label;
  select.append(option);
}
select.addEventListener("change", () => {
  if (!isTaxonomyId(select.value)) return;
  generation++;
  const selected = TAXONOMY_NODES.find((n) => n.id === select.value)!;
  message(
    `Exploring ${selected.label}`,
    "You chose this topic. This is not a page classification.",
  );
  showCards(
    exploreResources(records, [{ id: selected.id, confidence: 1 }], location),
  );
});
get("retry").addEventListener("click", () => {
  void refresh(true);
});
const listener = (input: unknown) => {
  if (
    input &&
    typeof input === "object" &&
    "type" in input &&
    ["CONTEXT_UPDATED", "PAGE_READY"].includes(String(input.type)) &&
    "tabId" in input &&
    input.tabId === observedTabId
  )
    void refresh();
};
api.runtime.onMessage.addListener(listener);
const onTab = () => {
  void refresh();
};
api.tabs.onActivated.addListener(onTab);
void adapter.preparePanel();
const panel = get<HTMLButtonElement>("open-panel");
panel.hidden = !adapter.panelAvailable;
panel.addEventListener("click", () => {
  void adapter.openPanel().catch(() => {
    get("panel-message").textContent = "The side panel could not be opened.";
  });
});
void fetch(api.runtime.getURL("data/opportunities.json"))
  .then((r) => r.json())
  .then((data) => {
    records = parseOpportunities(data);
    return refresh();
  })
  .catch(() =>
    message(
      "Resources could not load",
      "Reload Pond from your browser’s extension settings.",
    ),
  );
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    generation++;
    api.runtime.onMessage.removeListener(listener);
    api.tabs.onActivated.removeListener(onTab);
  },
  { once: true },
);
