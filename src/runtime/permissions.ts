import type { ExtensionAPI } from "../platform/extension-api";
import { ordinaryOrigin } from "../platform/extension-api";
export const WEBSITE_ORIGINS = ["https://*/*", "http://*/*"];
export const SCRIPT_ID = "pond-consented-pages";
export async function grantedWebsiteOrigins(
  api: ExtensionAPI,
): Promise<string[]> {
  const settings = await api.storage.local.get("websiteOrigins");
  const requested = Array.isArray(settings.websiteOrigins)
    ? settings.websiteOrigins.filter(
        (item): item is string =>
          typeof item === "string" &&
          (WEBSITE_ORIGINS.includes(item) ||
            ordinaryOrigin(item.replace(/\*$/, "")) === item),
      )
    : [];
  const result: string[] = [];
  for (const origin of requested)
    if (await api.permissions.contains({ origins: [origin] }))
      result.push(origin);
  return result;
}
/** Reconcile registration on install/startup/permission changes, not on every toolbar click. */
export async function reconcileContentScripts(
  api: ExtensionAPI,
  bootstrap = false,
): Promise<void> {
  const matches = await grantedWebsiteOrigins(api);
  const current = (await api.scripting.getRegisteredContentScripts()).find(
    (script) => script.id === SCRIPT_ID,
  );
  if (
    JSON.stringify([...(current?.matches ?? [])].sort()) !==
    JSON.stringify([...matches].sort())
  ) {
    if (current)
      await api.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    if (matches.length)
      await api.scripting.registerContentScripts([
        {
          id: SCRIPT_ID,
          matches,
          js: ["content.js"],
          runAt: "document_idle",
          persistAcrossSessions: true,
        },
      ]);
  }
  if (!bootstrap || !matches.length) return;
  // One bootstrap for tabs already open at consent/startup. Normal navigation uses registered content scripts.
  for (const tab of await api.tabs.query({})) {
    const origin = ordinaryOrigin(tab.url);
    if (
      !tab.id ||
      !origin ||
      !(await api.permissions.contains({ origins: [origin] }))
    )
      continue;
    const permitted = matches.some(
      (pattern) =>
        pattern === origin || pattern === `${new URL(tab.url!).protocol}//*/*`,
    );
    if (permitted)
      try {
        await api.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        });
      } catch {
        /* Browser-restricted web origins remain unavailable. */
      }
  }
}
export async function requestWebsiteAccess(
  api: ExtensionAPI,
  origins: string[],
): Promise<boolean> {
  // Must be the first awaited native call in the settings button's user gesture.
  const granted = await api.permissions.request({ origins });
  if (!granted) return false;
  const previous = await api.storage.local.get("websiteOrigins");
  const known = Array.isArray(previous.websiteOrigins)
    ? previous.websiteOrigins.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  await api.storage.local.set({
    websiteOrigins: [...new Set([...known, ...origins])],
  });
  await api.runtime.sendMessage({ type: "RECONCILE_ACCESS" });
  return true;
}
