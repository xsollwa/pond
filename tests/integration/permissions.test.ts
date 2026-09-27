import { test, expect, vi } from "vitest";
import {
  requestWebsiteAccess,
  reconcileContentScripts,
  WEBSITE_ORIGINS,
} from "../../src/runtime/permissions";
import type { ExtensionAPI } from "../../src/platform/extension-api";
function mock() {
  const api = {
    storage: {
      local: {
        get: vi.fn(async () => ({ websiteOrigins: WEBSITE_ORIGINS })),
        set: vi.fn(async () => {}),
      },
    },
    permissions: {
      request: vi.fn(async () => true),
      contains: vi.fn(async () => true),
    },
    runtime: { sendMessage: vi.fn(async () => ({ ok: true })) },
    scripting: {
      getRegisteredContentScripts: vi.fn(async () => []),
      registerContentScripts: vi.fn(async () => {}),
      unregisterContentScripts: vi.fn(async () => {}),
      executeScript: vi.fn(async () => {}),
    },
    tabs: {
      query: vi.fn(async () => [
        { id: 1, url: "https://example.org/story" },
        { id: 2, url: "chrome://settings" },
      ]),
    },
  };
  return { api, native: api as unknown as ExtensionAPI };
}
test("permission request is first in the user gesture and accepted origins persist", async () => {
  const { api, native } = mock();
  const promise = requestWebsiteAccess(native, WEBSITE_ORIGINS);
  expect(api.permissions.request).toHaveBeenCalledOnce();
  expect(api.storage.local.get).not.toHaveBeenCalled();
  expect(await promise).toBe(true);
  expect(api.storage.local.set).toHaveBeenCalledWith({
    websiteOrigins: WEBSITE_ORIGINS,
  });
});
test("denial is respected without storing consent or retrying", async () => {
  const { api, native } = mock();
  api.permissions.request.mockResolvedValue(false);
  expect(await requestWebsiteAccess(native, WEBSITE_ORIGINS)).toBe(false);
  expect(api.storage.local.set).not.toHaveBeenCalled();
  expect(api.runtime.sendMessage).not.toHaveBeenCalled();
});
test("registers persistent scripts for granted sites; bootstrap excludes browser pages", async () => {
  const { api, native } = mock();
  await reconcileContentScripts(native, true);
  expect(api.scripting.registerContentScripts).toHaveBeenCalledWith([
    {
      id: "pond-consented-pages",
      matches: WEBSITE_ORIGINS,
      js: ["content.js"],
      runAt: "document_idle",
      persistAcrossSessions: true,
    },
  ]);
  expect(api.scripting.executeScript).toHaveBeenCalledTimes(1);
  expect(api.scripting.executeScript).toHaveBeenCalledWith({
    target: { tabId: 1 },
    files: ["content.js"],
  });
});
test("withheld host access does not register or inject anything", async () => {
  const { api, native } = mock();
  api.permissions.contains.mockResolvedValue(false);
  await reconcileContentScripts(native, true);
  expect(api.scripting.registerContentScripts).not.toHaveBeenCalled();
  expect(api.scripting.executeScript).not.toHaveBeenCalled();
});

test("host patterns omit ports for local development services", async () => {
  const { ordinaryOrigin } = await import("../../src/platform/extension-api");
  expect(ordinaryOrigin("http://127.0.0.1:8787/analyze")).toBe(
    "http://127.0.0.1/*",
  );
});
