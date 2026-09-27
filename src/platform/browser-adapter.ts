import type { PageContent } from "../domain/types";
export class PageAccessError extends Error {
  constructor(
    public readonly code: "unsupported" | "permission" | "unavailable",
    message: string,
  ) {
    super(message);
  }
}
export interface TabInfo {
  id?: number;
  windowId?: number;
  url?: string;
  title?: string;
}
interface ExtensionEvent<T> {
  addListener(listener: T): void;
  removeListener(listener: T): void;
}
export interface NativeAPI {
  tabs: {
    query(query: {
      active: boolean;
      currentWindow: boolean;
    }): Promise<TabInfo[]>;
    onActivated: ExtensionEvent<
      (info: { tabId: number; windowId: number }) => void
    >;
    onUpdated: ExtensionEvent<
      (
        id: number,
        change: { url?: string; status?: string },
        tab: TabInfo,
      ) => void
    >;
  };
  runtime: {
    getURL(path: string): string;
    sendMessage(message: unknown): Promise<unknown>;
    onMessage?: ExtensionEvent<(message: unknown) => void>;
  };
  sidePanel?: { open(options: { windowId: number }): Promise<void> };
  sidebarAction?: { open(): Promise<void> };
  windows?: { getCurrent(): Promise<{ id?: number }> };
}
export interface PageCapture {
  page: PageContent;
  tabId: number;
}
export interface BrowserAdapter {
  capture(): Promise<PageCapture>;
  localData(path: string): Promise<unknown>;
  panelAvailable: boolean;
  preparePanel(): Promise<void>;
  openPanel(): Promise<void>;
  observeChanges(onChange: () => void): () => void;
}
/** Native namespaces exist only here; Chrome modern APIs and Firefox use promises. */
export function nativeAPI(): NativeAPI {
  const host = globalThis as unknown as {
    browser?: NativeAPI;
    chrome?: NativeAPI;
  };
  const api = host.browser ?? host.chrome;
  if (!api)
    throw new PageAccessError(
      "unavailable",
      "Extension APIs are not available here.",
    );
  return api;
}
export function createBrowserAdapter(
  api: NativeAPI = nativeAPI(),
): BrowserAdapter {
  let activeTabId: number | undefined, windowId: number | undefined;
  return {
    panelAvailable: !!(api.sidePanel?.open || api.sidebarAction?.open),
    async preparePanel() {
      windowId = (
        await api.tabs.query({ active: true, currentWindow: true })
      )[0]?.windowId;
    },
    openPanel() {
      // Do not await a query before this call: native open must retain its user gesture.
      if (api.sidebarAction) return api.sidebarAction.open();
      if (api.sidePanel && windowId !== undefined)
        return api.sidePanel.open({ windowId });
      return Promise.reject(new Error("Panel is unavailable in this browser."));
    },
    async localData(path) {
      if (path !== "data/opportunities.json")
        throw new Error("Unknown bundled resource");
      const response = await fetch(api.runtime.getURL(path));
      if (!response.ok)
        throw new Error("The bundled opportunities could not load.");
      return response.json();
    },
    async capture() {
      const tab = (
        await api.tabs.query({ active: true, currentWindow: true })
      )[0];
      if (!tab?.id)
        throw new PageAccessError("unavailable", "No active page was found.");
      activeTabId = tab.id;
      windowId = tab.windowId;
      // URLs can be omitted when host access is withheld. The content-script coordinator reports availability.
      if (tab.url && !/^https?:/.test(tab.url))
        throw new PageAccessError(
          "unsupported",
          "This browser page cannot be read.",
        );
      let result: PageContent | undefined;
      try {
        const response = (await api.runtime.sendMessage({
          type: "GET_PAGE",
          tabId: tab.id,
        })) as { page?: PageContent; url?: string };
        if (response?.url && tab.url && response.url !== tab.url)
          throw new Error("Page changed");
        result = response?.page;
      } catch {
        throw new PageAccessError(
          "permission",
          "Pond has no page snapshot yet. Enable website access in Pond settings, then reload the page. Browser-restricted pages remain unavailable.",
        );
      }
      const current = (
        await api.tabs.query({ active: true, currentWindow: true })
      )[0];
      if (current?.id !== tab.id || (tab.url && current.url !== tab.url))
        throw new PageAccessError(
          "unavailable",
          "The page changed while it was being read. Please try again.",
        );
      if (!result)
        throw new PageAccessError(
          "unavailable",
          "Pond is waiting for this page. If website access is not enabled, open Pond settings.",
        );
      return { page: result, tabId: tab.id };
    },
    observeChanges(onChange) {
      let disposed = false;
      const activated = (info: { tabId: number; windowId: number }) => {
        if (windowId !== undefined && info.windowId !== windowId) return;
        activeTabId = info.tabId;
        onChange();
      };
      const updated = (
        id: number,
        change: { url?: string; status?: string },
      ) => {
        if (id === activeTabId && (change.url || change.status === "loading"))
          onChange();
      };
      const snapshotReady = (input: unknown) => {
        if (
          input &&
          typeof input === "object" &&
          "type" in input &&
          input.type === "PAGE_READY" &&
          "tabId" in input &&
          input.tabId === activeTabId
        )
          onChange();
      };
      api.runtime.onMessage?.addListener(snapshotReady);
      api.tabs.onActivated.addListener(activated);
      api.tabs.onUpdated.addListener(updated);
      // Register listeners before the query to avoid a capture/navigation race.
      void api.tabs
        .query({ active: true, currentWindow: true })
        .then((tabs) => {
          if (!disposed) {
            activeTabId = tabs[0]?.id;
            windowId = tabs[0]?.windowId;
          }
        })
        .catch(() => {});
      return () => {
        disposed = true;
        api.runtime.onMessage?.removeListener(snapshotReady);
        api.tabs.onActivated.removeListener(activated);
        api.tabs.onUpdated.removeListener(updated);
      };
    },
  };
}
