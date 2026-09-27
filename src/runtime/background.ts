import {
  analyzeSnapshot,
  invalidate,
  resetIntelligence,
  states,
} from "./intelligence";
import { extensionAPI, ordinaryOrigin } from "../platform/extension-api";
import { grantedWebsiteOrigins, reconcileContentScripts } from "./permissions";
import {
  pageRepresentationSchema,
  type PageRepresentation,
} from "../intelligence/contracts";
import type { PageContent } from "../domain/types";
const api = extensionAPI();
const snapshots = new Map<
  number,
  {
    page: PageContent;
    representation: PageRepresentation;
    fingerprint: string;
    url: string;
    time: number;
  }
>();
let accessEpoch = 0;
let reconcile = Promise.resolve();
const schedule = (bootstrap = false) => {
  reconcile = reconcile
    .catch(() => {})
    .then(() => reconcileContentScripts(api, bootstrap));
  return reconcile;
};
function localSender(url: string | undefined) {
  return !!url && url.startsWith(api.runtime.getURL(""));
}
api.runtime.onInstalled.addListener((details) => {
  if (details?.reason === "install")
    void api.tabs.create({ url: api.runtime.getURL("settings.html") });
  void schedule(true);
});
api.runtime.onStartup.addListener(() => {
  void schedule(true);
});
api.permissions.onAdded.addListener(() => {
  void schedule(true);
});
api.permissions.onRemoved.addListener(() => {
  accessEpoch++;
  snapshots.clear();
  resetIntelligence();
  void (async () => {
    for (const tab of await api.tabs.query({}))
      if (tab.id)
        try {
          await api.tabs.sendMessage(tab.id, { type: "STOP_POND" });
        } catch {
          /* No content script in this tab. */
        }
    await schedule(true);
  })();
});
api.tabs.onRemoved.addListener((id) => {
  snapshots.delete(id);
  invalidate(id);
});
api.tabs.onUpdated.addListener((id, change) => {
  if (change.status === "loading" || change.url) {
    snapshots.delete(id);
    invalidate(id);
    void api.tabs.sendMessage(id, { type: "PAGE_NAVIGATED" }).catch(() => {});
  }
});
api.runtime.onMessage.addListener((input, sender, respond) => {
  if (!input || typeof input !== "object" || !("type" in input)) return;
  const message = input as {
    type: string;
    page?: PageContent;
    representation?: PageRepresentation;
    fingerprint?: string;
    tabId?: number;
    force?: boolean;
    url?: string;
  };
  if (
    message.type === "PAGE_SNAPSHOT" &&
    sender.tab?.id &&
    sender.frameId === 0
  ) {
    const epoch = accessEpoch;
    void (async () => {
      const live = (await api.tabs.query({})).find(
        (tab) => tab.id === sender.tab!.id,
      );
      if (!live?.url || live.url !== message.url) return respond({ ok: false });
      const origin = ordinaryOrigin(live.url);
      if (!origin || !(await api.permissions.contains({ origins: [origin] })))
        return respond({ ok: false });
      const matches = await grantedWebsiteOrigins(api);
      if (
        !matches.some(
          (pattern) =>
            pattern === origin ||
            pattern === `${new URL(sender.url!).protocol}//*/*`,
        )
      )
        return respond({ ok: false });
      const page = message.page;
      if (
        !page ||
        typeof page.text !== "string" ||
        page.text.length > 48000 ||
        typeof page.title !== "string"
      )
        return respond({ ok: false });
      const representation = pageRepresentationSchema.parse(
        message.representation,
      );
      if (!message.fingerprint?.match(/^[a-f0-9]{64}$/))
        return respond({ ok: false });
      if (epoch !== accessEpoch) return respond({ ok: false });
      snapshots.set(sender.tab!.id!, {
        page,
        representation,
        fingerprint: message.fingerprint,
        url: message.url!,
        time: Date.now(),
      });
      while (snapshots.size > 20)
        snapshots.delete(snapshots.keys().next().value!);
      void analyzeSnapshot(
        sender.tab!.id!,
        representation,
        message.fingerprint,
      );
      void api.runtime
        .sendMessage({ type: "PAGE_READY", tabId: sender.tab!.id! })
        .catch(() => {});
      respond({ ok: true });
    })().catch(() => respond({ ok: false }));
    return true;
  }
  if (!localSender(sender.url)) return;
  if (message.type === "SETTINGS_CHANGED") {
    resetIntelligence();
    for (const [id, snapshot] of snapshots)
      void analyzeSnapshot(id, snapshot.representation, snapshot.fingerprint);
    respond({ ok: true });
    return;
  }
  if (message.type === "GET_CONTEXT" && Number.isInteger(message.tabId)) {
    const id = message.tabId!;
    void (async () => {
      const tab = (await api.tabs.query({})).find((item) => item.id === id),
        origin = ordinaryOrigin(tab?.url);
      const matches = await grantedWebsiteOrigins(api);
      if (
        !origin ||
        !(await api.permissions.contains({ origins: [origin] })) ||
        !matches.some(
          (pattern) =>
            pattern === origin ||
            pattern === `${new URL(tab!.url!).protocol}//*/*`,
        )
      ) {
        invalidate(id);
        respond({ status: "unavailable" });
        return;
      }
      const state = states.get(id);
      if (state && !message.force) {
        respond(state);
        return;
      }
      const value = (await api.tabs.sendMessage(id, {
        type: "GET_CURRENT_PAGE",
      })) as {
        representation?: PageRepresentation;
        fingerprint?: string;
        url?: string;
      };
      const latest = (await api.tabs.query({})).find((item) => item.id === id);
      if (
        value?.representation &&
        value.fingerprint &&
        value.url === latest?.url
      ) {
        void analyzeSnapshot(
          id,
          pageRepresentationSchema.parse(value.representation),
          value.fingerprint,
        );
        respond({ status: "analyzing" });
      } else respond({ status: "unavailable" });
    })().catch(() => respond({ status: "unavailable" }));
    return true;
  }
  if (message.type === "RECONCILE_ACCESS") {
    accessEpoch++;
    snapshots.clear();
    resetIntelligence();
    void (async () => {
      for (const tab of await api.tabs.query({}))
        if (tab.id)
          await api.tabs
            .sendMessage(tab.id, { type: "STOP_POND" })
            .catch(() => {});
      await schedule(true);
    })()
      .then(() => respond({ ok: true }))
      .catch(() => respond({ ok: false }));
    return true;
  }
  if (message.type === "GET_PAGE" && Number.isInteger(message.tabId)) {
    const id = message.tabId!;
    const snapshot = snapshots.get(id);
    if (snapshot && Date.now() - snapshot.time < 5 * 60_000) {
      respond({
        page: snapshot.page,
        representation: snapshot.representation,
        fingerprint: snapshot.fingerprint,
        url: snapshot.url,
      });
      return;
    }
    // A suspended background context can recover from the already-running content script.
    void api.tabs
      .sendMessage(id, { type: "GET_CURRENT_PAGE" })
      .then(respond)
      .catch(() => respond({ error: "unavailable" }));
    return true;
  }
});
void schedule();
