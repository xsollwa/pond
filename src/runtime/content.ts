import { extensionAPI } from "../platform/extension-api";
import { extractRepresentation } from "../extraction/representation";
import { representationFingerprint } from "../intelligence/context";
import type { PageRepresentation } from "../intelligence/contracts";
import type { PageContent } from "../domain/types";
const host = globalThis as unknown as { __pondContentStop?: () => void };
host.__pondContentStop?.();
const api = extensionAPI();
let stopped = false,
  revision = 0,
  lastRun = 0,
  firstDirty = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let snapshot: {
  page: PageContent;
  representation: PageRepresentation;
  fingerprint: string;
  url: string;
} | null = null;
async function update() {
  timer = undefined;
  if (stopped || document.hidden) return;
  lastRun = Date.now();
  firstDirty = 0;
  const current = ++revision,
    url = location.href;
  try {
    const representation = extractRepresentation();
    const fingerprint = await representationFingerprint(representation);
    if (stopped || current !== revision || url !== location.href) return;
    if (snapshot?.fingerprint === fingerprint && snapshot.url === url) return;
    const page: PageContent = {
      title: document.title,
      description: "",
      headings: representation.blocks
        .filter((b) => b.kind === "heading")
        .map((b) => b.text),
      text: representation.blocks
        .filter((b) => b.visible && b.kind !== "title")
        .map((b) => b.text)
        .join(" "),
      structured: [],
      language: representation.source.language,
      extractedAt: new Date().toISOString(),
      diagnostics: {
        root: representation.focus.kind,
        characters: 0,
        nodesVisited: 0,
        truncated: representation.extraction.truncated,
        durationMs: 0,
      },
    };
    snapshot = { page, representation, fingerprint, url };
    await api.runtime.sendMessage({ type: "PAGE_SNAPSHOT", ...snapshot });
  } catch {
    /* Unsupported or detached documents yield no snapshot, never a fabricated issue. */
  }
}
function schedule() {
  revision++;
  if (stopped || document.hidden) return;
  firstDirty ||= Date.now();
  if (timer) clearTimeout(timer);
  const remaining = Math.max(0, 1000 - (Date.now() - lastRun));
  const quiet = Date.now() - firstDirty > 4000 ? 0 : 500;
  timer = setTimeout(
    () => {
      void update();
    },
    Math.max(remaining, quiet),
  );
}
const observer = new MutationObserver((records) => {
  if (
    records.some(
      (record) =>
        record.type === "characterData" ||
        record.addedNodes.length ||
        record.removedNodes.length ||
        record.type === "attributes",
    )
  )
    schedule();
});
observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["aria-expanded", "hidden"],
});
const listener = (
  input: unknown,
  _sender: unknown,
  respond: (response: unknown) => void,
) => {
  if (!input || typeof input !== "object" || !("type" in input)) return;
  if (input.type === "STOP_POND") {
    stop();
    respond({ ok: true });
  }
  if (input.type === "GET_CURRENT_PAGE")
    respond(snapshot ?? { error: "pending" });
  if (input.type === "PAGE_NAVIGATED") {
    snapshot = null;
    revision++;
    schedule();
  }
};
function stop() {
  stopped = true;
  revision++;
  snapshot = null;
  if (timer) clearTimeout(timer);
  observer.disconnect();
  for (const event of [
    "scroll",
    "selectionchange",
    "visibilitychange",
    "popstate",
    "hashchange",
  ])
    window.removeEventListener(event, schedule, true);
  api.runtime.onMessage.removeListener(listener);
}
host.__pondContentStop = stop;
api.runtime.onMessage.addListener(listener);
for (const event of [
  "scroll",
  "selectionchange",
  "visibilitychange",
  "popstate",
  "hashchange",
])
  window.addEventListener(event, schedule, true);
schedule();
