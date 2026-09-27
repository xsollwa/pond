import type { BrowserAdapter } from "../platform/browser-adapter";
import { PageAccessError } from "../platform/browser-adapter";
import { PondPipeline } from "../application/pipeline";
import { TAXONOMY, ISSUE_IDS, ACTION_LABELS } from "../domain/taxonomy";
import type {
  Analysis,
  IssueId,
  PipelineResult,
  UserLocation,
} from "../domain/types";
export function mountPond(
  adapter: BrowserAdapter,
  pipeline: PondPipeline,
  location: UserLocation,
  doc: Document = document,
) {
  const get = <T extends HTMLElement>(id: string) =>
    doc.getElementById(id) as T;
  const status = get("status"),
    results = get("results"),
    cards = get("opportunities");
  const select = get<HTMLSelectElement>("issue"),
    retry = get<HTMLButtonElement>("retry"),
    panel = get<HTMLButtonElement>("open-panel");
  let generation = 0,
    disposed = false;
  const node = (tag: string, className: string, text: string) => {
    const el = doc.createElement(tag);
    el.className = className;
    el.textContent = text;
    return el;
  };
  const busy = (value: boolean) => {
    retry.disabled = value;
    select.disabled = value;
    status.setAttribute("aria-busy", String(value));
  };
  const clear = () => {
    results.hidden = true;
    cards.replaceChildren();
    get("page-title").textContent = "";
    get("geography").textContent = "";
  };
  const message = (title: string, description: string) => {
    clear();
    const box = node("div", "empty", "");
    box.append(node("h2", "", title), node("p", "", description));
    status.replaceChildren(box);
  };
  get("location").textContent = location.label;
  for (const id of ISSUE_IDS) {
    const option = doc.createElement("option");
    option.value = id;
    option.textContent = TAXONOMY[id].label;
    select.append(option);
  }
  const render = (result: PipelineResult, manual = false) => {
    const { analysis, recommendations } = result;
    const primary = analysis.primaryIssue;
    if (!primary) {
      message(
        analysis.status === "insufficient"
          ? "A little more to go on"
          : "No clear civic issue yet",
        analysis.explanation + " Try another article or choose an issue below.",
      );
      return;
    }
    const box = node("div", "detected", "");
    box.append(
      node(
        "p",
        "eyebrow",
        manual
          ? "YOU’RE EXPLORING"
          : analysis.status === "low-confidence"
            ? "A TENTATIVE MATCH"
            : "THIS LOOKS LIKE",
      ),
      node("h2", "", primary.label),
    );
    box.append(node("p", "analysis-reason", analysis.explanation));
    if (analysis.secondaryIssues.length)
      box.append(
        node(
          "p",
          "secondary",
          `Also touches on ${analysis.secondaryIssues.map((issue) => issue.label).join(", ")}.`,
        ),
      );
    if (analysis.status === "low-confidence")
      box.append(
        node(
          "p",
          "notice",
          "The evidence is limited or mixed. Choose another issue if this looks off.",
        ),
      );
    status.replaceChildren(box);
    get("geography").textContent = manual
      ? `Exploring ways to participate near ${location.label}.`
      : `Page context: ${analysis.geographicReferences.length ? analysis.geographicReferences.map((place) => place.name).join(" · ") : "no location confidently identified"}. ${analysis.geographicScope !== "unknown" ? `Scope: ${analysis.geographicScope}. ` : ""}Ideas are selected for ${location.label}.`;
    results.hidden = false;
    cards.replaceChildren();
    get("count").textContent = `${recommendations.length} ideas`;
    get("stale").hidden = !recommendations.some((item) => item.stale);
    if (!recommendations.length)
      cards.append(
        node(
          "p",
          "empty",
          "No suitable ideas in the current dataset. Try another issue.",
        ),
      );
    for (const recommendation of recommendations) {
      const item = recommendation.opportunity;
      const card = node("article", "card", "");
      const top = node("div", "card-top", "");
      top.append(
        node("span", "tag", ACTION_LABELS[item.actionType]),
        node("span", "place", item.coverage.label),
      );
      const heading = node("h3", "", "");
      const link = doc.createElement("a");
      link.textContent = item.title + " ↗";
      link.href = item.canonicalUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      heading.append(link);
      card.append(
        top,
        heading,
        node("p", "org", item.organization),
        node("p", "description", item.description),
      );
      card.append(
        node("p", "why", recommendation.reasons.slice(0, 2).join(" ")),
      );
      const details = doc.createElement("details");
      const summary = node("summary", "", "Why this suggestion");
      details.append(summary, node("p", "", recommendation.reasons.join(" ")));
      details.append(
        node("p", "", `Source: ${item.source.name}. ${item.verification.note}`),
      );
      const sourceLink = doc.createElement("a");
      sourceLink.href = item.source.url;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      sourceLink.textContent = "View source";
      details.append(sourceLink);
      details.append(
        node(
          "p",
          "",
          `Last source check: ${item.freshness.checkedAt ? item.freshness.checkedAt.slice(0, 10) : "not recorded"}. ${recommendation.stale ? "Needs rechecking." : ""}`,
        ),
      );
      if (item.startDate && item.endDate)
        details.append(
          node(
            "p",
            "",
            `Listed event: ${new Date(item.startDate).toLocaleString()} – ${new Date(item.endDate).toLocaleString()}.`,
          ),
        );
      const list = doc.createElement("dl");
      const labels = {
        issue: "Issue relevance",
        geography: "Geographic relevance",
        actionability: "Actionability",
        timeliness: "Timeliness",
        quality: "Source quality",
      };
      for (const [key, value] of Object.entries(recommendation.components)) {
        list.append(
          node("dt", "", labels[key as keyof typeof labels]),
          node("dd", "", `${Math.round(value * 100)}/100`),
        );
      }
      details.append(
        list,
        node(
          "p",
          "",
          `Overall match: ${Math.round(recommendation.score * 100)}/100. Heuristic ranking, not a probability.`,
        ),
      );
      card.append(details);
      cards.append(card);
    }
  };
  const read = async () => {
    const token = ++generation;
    busy(true);
    clear();
    select.value = "";
    status.replaceChildren(
      node("p", "loading", "Reading this page on your device…"),
    );
    try {
      const capture = await adapter.capture();
      const title = capture.page.title;
      const result = await pipeline.analyze(capture.page, location);
      if (disposed || token !== generation) return;
      render(result);
      get("page-title").textContent = `From: ${title || "Untitled page"}`;
    } catch (error) {
      if (disposed || token !== generation) return;
      message(
        error instanceof PageAccessError
          ? "This page can’t be read"
          : "Something didn’t load",
        error instanceof PageAccessError
          ? error.message
          : "The local analysis or opportunity data failed. Try again or reload Pond.",
      );
    } finally {
      if (!disposed && token === generation) busy(false);
    }
  };
  const explore = async () => {
    const id = select.value as IssueId;
    if (!TAXONOMY[id]) return;
    const token = ++generation;
    busy(true);
    clear();
    status.replaceChildren(node("p", "loading", "Finding local ideas…"));
    const analysis: Analysis = {
      status: "recognized",
      primaryIssue: {
        id,
        label: TAXONOMY[id].label,
        confidence: 1,
        score: 0,
        terms: [],
      },
      secondaryIssues: [],
      entities: [],
      geographicReferences: [],
      geographicScope: "unknown",
      governmentLevels: [],
      actionCategories: TAXONOMY[id].actions,
      explanation:
        "You selected this issue. These suggestions do not describe the current page.",
      analyzer: "manual",
    };
    try {
      const result = await pipeline.recommend(analysis, location);
      if (!disposed && token === generation) render(result, true);
    } catch {
      if (!disposed && token === generation)
        message("The local ideas couldn’t load", "Reload Pond and try again.");
    } finally {
      if (!disposed && token === generation) busy(false);
    }
  };
  const open = () => {
    void adapter.openPanel().catch(() => {
      get("panel-message").textContent =
        "The panel could not open. You can keep using Pond here.";
    });
  };
  retry.addEventListener("click", read);
  select.addEventListener("change", explore);
  panel.addEventListener("click", open);
  panel.hidden =
    !adapter.panelAvailable || doc.location.search.includes("panel");
  if (!panel.hidden) {
    panel.disabled = true;
    void adapter
      .preparePanel()
      .then(() => {
        if (!disposed) panel.disabled = false;
      })
      .catch(() => {
        panel.hidden = true;
      });
  }
  const unsubscribe = adapter.observeChanges(() => {
    generation++;
    busy(false);
    select.value = "";
    message(
      "Ready for this page",
      "Pond is preparing the current page. Read it when ready; website access is managed in Settings.",
    );
  });
  void read();
  return () => {
    disposed = true;
    generation++;
    unsubscribe();
    retry.removeEventListener("click", read);
    select.removeEventListener("change", explore);
    panel.removeEventListener("click", open);
  };
}
