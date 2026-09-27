import type { PageContent } from "../domain/types";

/** Injected as a function: all runtime helpers must stay inside this boundary. */
export async function extractPage(): Promise<PageContent> {
  const started = performance.now();
  const MAX_CHARS = 48_000,
    MAX_NODES = 9_000,
    MAX_MS = 150;
  function snapshot(): PageContent {
    const passStart = performance.now();
    let visited = 0,
      characters = 0,
      truncated = false;
    const budgetExceeded = Symbol("extraction-budget");
    const parts: string[] = [],
      headings: string[] = [],
      seen = new Set<string>();
    const headingParts = new Map<Element, string>();
    const root =
      document.querySelector('main, [role="main"]') ||
      document.querySelector("article") ||
      document.body;
    const excluded =
      'script,style,noscript,nav,footer,aside,form,button,input,textarea,select,dialog,[role="navigation"],[role="banner"],[role="contentinfo"],[hidden],[inert],[aria-hidden="true"],[contenteditable]:not([contenteditable="false"]),.sidebar,.cookie-banner,.advertisement';
    const visible = (el: Element) => {
      for (
        let parent: Element | null = el;
        parent;
        parent = parent.parentElement
      ) {
        const style = getComputedStyle(parent);
        if (
          parent.matches(excluded) ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.visibility === "collapse" ||
          style.opacity === "0" ||
          style.contentVisibility === "hidden"
        )
          return false;
      }
      return el.getClientRects().length > 0;
    };
    if (root && visible(root)) {
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            visited++;
            if (visited > MAX_NODES || performance.now() - passStart > MAX_MS) {
              truncated = true;
              throw budgetExceeded;
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element;
              if (
                el.matches(excluded) ||
                (el.tagName === "HEADER" && !el.closest("article,main")) ||
                !visible(el)
              )
                return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_SKIP;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        },
      );
      let node: Node | null;
      try {
        while ((node = walker.nextNode())) {
          if (visited > MAX_NODES || performance.now() - passStart > MAX_MS) {
            truncated = true;
            break;
          }
          const value = (node.textContent || "")
            .slice(0, MAX_CHARS)
            .replace(/\s+/g, " ")
            .trim();
          if (!value) continue;
          const heading = node.parentElement?.closest("h1,h2,h3");
          if (heading && (headingParts.has(heading) || headingParts.size < 12))
            headingParts.set(
              heading,
              ((headingParts.get(heading) || "") + " " + value)
                .trim()
                .slice(0, 240),
            );
          if (seen.has(value)) continue;
          seen.add(value);
          const remaining = MAX_CHARS - characters;
          parts.push(value.slice(0, remaining));
          characters += Math.min(value.length, remaining) + 1;
          if (characters >= MAX_CHARS) {
            truncated = true;
            break;
          }
        }
      } catch (error) {
        if (error !== budgetExceeded) throw error;
      }
    }
    const meta = (selector: string) =>
      (document.querySelector<HTMLMetaElement>(selector)?.content || "").slice(
        0,
        600,
      );
    const structured: PageContent["structured"] = [];
    for (const script of Array.from(
      document.querySelectorAll('script[type="application/ld+json"]'),
    ).slice(0, 4)) {
      const raw = script.textContent || "";
      if (raw.length > 16000) continue;
      try {
        const parsed: unknown = JSON.parse(raw);
        const pending: unknown[] = Array.isArray(parsed)
          ? parsed.slice(0, 8)
          : [parsed];
        for (let i = 0; i < Math.min(pending.length, 12); i++) {
          const item = pending[i];
          if (!item || typeof item !== "object") continue;
          const object = item as Record<string, unknown>;
          if (Array.isArray(object["@graph"]))
            pending.push(...object["@graph"].slice(0, 8));
          const types = Array.isArray(object["@type"])
            ? object["@type"]
            : [object["@type"]];
          if (
            !types.some((type) =>
              ["Article", "NewsArticle", "BlogPosting"].includes(String(type)),
            )
          )
            continue;
          const clean = (value: unknown) =>
            typeof value === "string" ? value.slice(0, 400) : undefined;
          structured.push({
            headline: clean(object.headline),
            description: clean(object.description),
            section: clean(object.articleSection),
          });
        }
      } catch {
        /* Malformed structured data is common and not fatal. */
      }
    }
    headings.push(...headingParts.values());
    const text = parts.join(" ").slice(0, MAX_CHARS);
    return {
      title: document.title.slice(0, 300),
      description:
        meta('meta[name="description"]') ||
        meta('meta[property="og:description"]'),
      headings,
      text,
      structured,
      language: document.documentElement.lang.slice(0, 20),
      extractedAt: new Date().toISOString(),
      diagnostics: {
        root: root?.tagName.toLowerCase() || "none",
        characters: text.length,
        nodesVisited: visited,
        truncated,
        durationMs: performance.now() - started,
      },
    };
  }
  let result = snapshot();
  // Brief bounded grace period for an initially empty client-rendered page.
  for (let retry = 0; retry < 2 && result.text.length < 120; retry++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    result = snapshot();
  }
  return result;
}
