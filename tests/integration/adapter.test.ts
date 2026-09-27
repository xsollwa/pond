import { test, expect, vi } from "vitest";
import {
  createBrowserAdapter,
  type NativeAPI,
} from "../../src/platform/browser-adapter";
import { page } from "../helpers";
function native() {
  const query = vi.fn(async () => [
    { id: 1, windowId: 7, url: "https://example.org/article" },
  ]);
  const api: NativeAPI = {
    tabs: {
      query,
      onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: {
      getURL: (path) => `chrome-extension://pond/${path}`,
      sendMessage: vi.fn(async () => ({
        page: page("article"),
        url: "https://example.org/article",
      })),
    },
    sidePanel: { open: vi.fn(async () => {}) },
  };
  return { api, query };
}
test("captures with activeTab and rejects restricted or changed pages", async () => {
  const { api, query } = native();
  const adapter = createBrowserAdapter(api);
  expect((await adapter.capture()).tabId).toBe(1);
  query.mockResolvedValueOnce([
    { id: 1, windowId: 7, url: "chrome://settings" },
  ]);
  await expect(adapter.capture()).rejects.toMatchObject({
    code: "unsupported",
  });
  query
    .mockResolvedValueOnce([
      { id: 1, windowId: 7, url: "https://example.org/article" },
    ])
    .mockResolvedValueOnce([
      { id: 2, windowId: 7, url: "https://example.org/other" },
    ]);
  await expect(adapter.capture()).rejects.toMatchObject({
    code: "unavailable",
  });
});
test("permission rejection becomes a recoverable page access error", async () => {
  const { api } = native();
  vi.mocked(api.runtime.sendMessage).mockRejectedValue(
    new Error("Cannot access page"),
  );
  await expect(createBrowserAdapter(api).capture()).rejects.toMatchObject({
    code: "permission",
  });
});
test("panel opens synchronously within the initiating gesture after preparation", async () => {
  const { api } = native();
  const adapter = createBrowserAdapter(api);
  await adapter.preparePanel();
  const promise = adapter.openPanel();
  expect(api.sidePanel!.open).toHaveBeenCalledWith({ windowId: 7 });
  await promise;
  const firefox = {
    ...api,
    sidePanel: undefined,
    sidebarAction: { open: vi.fn(async () => {}) },
  };
  await createBrowserAdapter(firefox).openPanel();
  expect(firefox.sidebarAction.open).toHaveBeenCalledOnce();
});
test("navigation subscriptions clear current results and are disposable", async () => {
  const { api } = native();
  const adapter = createBrowserAdapter(api);
  await adapter.capture();
  const changed = vi.fn();
  const dispose = adapter.observeChanges(changed);
  const updated = vi.mocked(api.tabs.onUpdated.addListener).mock.calls[0]![0];
  updated(1, { status: "loading" }, { id: 1 });
  expect(changed).toHaveBeenCalledOnce();
  updated(2, { status: "loading" }, { id: 2 });
  expect(changed).toHaveBeenCalledOnce();
  dispose();
  expect(api.tabs.onUpdated.removeListener).toHaveBeenCalledWith(updated);
});
