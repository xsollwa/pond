/** Native WebExtensions boundary shared by Chromium and Firefox. */
export interface ExtensionTab {
  id?: number;
  windowId?: number;
  url?: string;
  active?: boolean;
}
export interface MessageSender {
  tab?: ExtensionTab;
  url?: string;
  frameId?: number;
}
interface EventAPI<T> {
  addListener(listener: T): void;
  removeListener(listener: T): void;
}
export interface ExtensionAPI {
  runtime: {
    getURL(path: string): string;
    sendMessage(message: unknown): Promise<unknown>;
    onMessage: EventAPI<
      (
        message: unknown,
        sender: MessageSender,
        respond: (response: unknown) => void,
      ) => boolean | void
    >;
    onInstalled: EventAPI<(details?: { reason?: string }) => void>;
    onStartup: EventAPI<() => void>;
  };
  storage: {
    session?: {
      get(keys: string | string[]): Promise<Record<string, unknown>>;
      set(values: Record<string, unknown>): Promise<void>;
    };
    local: {
      get(keys: string | string[]): Promise<Record<string, unknown>>;
      set(values: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
  };
  permissions: {
    request(value: { origins: string[] }): Promise<boolean>;
    contains(value: { origins: string[] }): Promise<boolean>;
    getAll(): Promise<{ origins?: string[] }>;
    remove(value: { origins: string[] }): Promise<boolean>;
    onAdded: EventAPI<() => void>;
    onRemoved: EventAPI<() => void>;
  };
  scripting: {
    getRegisteredContentScripts(): Promise<
      { id: string; matches?: string[] }[]
    >;
    registerContentScripts(
      scripts: {
        id: string;
        matches: string[];
        js: string[];
        runAt: "document_idle";
        persistAcrossSessions: boolean;
      }[],
    ): Promise<void>;
    unregisterContentScripts(filter: { ids: string[] }): Promise<void>;
    executeScript(input: {
      target: { tabId: number };
      files: string[];
    }): Promise<unknown>;
  };
  tabs: {
    query(query: Record<string, unknown>): Promise<ExtensionTab[]>;
    create(options: { url: string }): Promise<ExtensionTab>;
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
    onRemoved: EventAPI<(tabId: number) => void>;
    onActivated: EventAPI<(info: { tabId: number; windowId: number }) => void>;
    onUpdated: EventAPI<
      (
        tabId: number,
        change: { status?: string; url?: string },
        tab: ExtensionTab,
      ) => void
    >;
  };
}
export function extensionAPI(): ExtensionAPI {
  const host = globalThis as unknown as {
    browser?: ExtensionAPI;
    chrome?: ExtensionAPI;
  };
  const api = host.browser ?? host.chrome;
  if (!api) throw new Error("WebExtensions API unavailable");
  return api;
}
export function ordinaryOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol)
      ? `${parsed.protocol}//${parsed.hostname}/*`
      : null;
  } catch {
    return null;
  }
}
