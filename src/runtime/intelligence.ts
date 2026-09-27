import { SERVICE_URL } from "../platform/service-config";
import { AnalysisServiceError } from "../intelligence/analyzers";
import { extensionAPI } from "../platform/extension-api";
import {
  ConservativeFallback,
  RemoteIssueAnalyzer,
} from "../intelligence/analyzers";
import { createContext } from "../intelligence/context";
import {
  geographicLocationSchema,
  type ContextObject,
  type PageRepresentation,
} from "../intelligence/contracts";
const api = extensionAPI();
const tasks = new Map<number, AbortController>();
const cache = new Map<string, { context: ContextObject; at: number }>();
export const states = new Map<
  number,
  { status: "analyzing" | "ready"; context?: ContextObject; notice?: string }
>();
function publish(id: number) {
  void api.runtime
    .sendMessage({ type: "CONTEXT_UPDATED", tabId: id })
    .catch(() => {});
}
export function invalidate(id: number) {
  const changed = tasks.has(id) || states.has(id);
  tasks.get(id)?.abort();
  tasks.delete(id);
  states.delete(id);
  if (changed) publish(id);
}
export function resetIntelligence() {
  for (const id of new Set([...tasks.keys(), ...states.keys()])) invalidate(id);
  states.clear();
  cache.clear();
}
export async function analyzeSnapshot(
  id: number,
  page: PageRepresentation,
  fingerprint: string,
) {
  invalidate(id);
  const controller = new AbortController();
  tasks.set(id, controller);
  states.set(id, { status: "analyzing" });
  publish(id);
  try {
    const config = await api.storage.local.get([
      "semanticConsent",
      "userLocation",
    ]);
    if (controller.signal.aborted) return;
    const location = geographicLocationSchema
      .nullable()
      .parse(config.userLocation ?? null);
    const enabled = config.semanticConsent === true;
    const key = JSON.stringify([
      fingerprint,
      enabled ? SERVICE_URL : "fallback-v1",
      location,
    ]);
    const hit = cache.get(key);
    let context: ContextObject;
    let notice: string | undefined;
    if (hit && Date.now() - hit.at < 15 * 60000) context = hit.context;
    else {
      let analysis;
      try {
        analysis = await (enabled
          ? new RemoteIssueAnalyzer(SERVICE_URL).analyze(page, {
              signal: AbortSignal.any([
                controller.signal,
                AbortSignal.timeout(45000),
              ]),
            })
          : new ConservativeFallback().analyze(page));
      } catch (error) {
        if (controller.signal.aborted) return;
        analysis = await new ConservativeFallback().analyze(page);
        notice =
          error instanceof AnalysisServiceError
            ? error.message
            : "Pond is temporarily unavailable. Please try again. You can still explore issues manually.";
      }
      if (controller.signal.aborted) return;
      context = await createContext(analysis, page, location);
      if (controller.signal.aborted) return;
      if (!notice) {
        cache.set(key, { context, at: Date.now() });
        while (cache.size > 20) cache.delete(cache.keys().next().value!);
      }
    }
    if (controller.signal.aborted || tasks.get(id) !== controller) return;
    states.set(id, { status: "ready", context, notice });
    while (states.size > 20) states.delete(states.keys().next().value!);
    publish(id);
  } catch {
    if (!controller.signal.aborted) {
      states.set(id, {
        status: "ready",
        notice: "Analysis settings are invalid. Open Settings to update them.",
      });
      publish(id);
    }
  } finally {
    if (tasks.get(id) === controller) tasks.delete(id);
  }
}
