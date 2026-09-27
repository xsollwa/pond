import { vi } from "vitest";
import type { PageContent } from "../src/domain/types";
export function installDOM(html: string) {
  document.open();
  document.write(html);
  document.close();
  // jsdom has no layout. Visibility remains determined by computed ancestor styles.
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(
    () =>
      ({
        0: {},
        length: 1,
        item: () => null,
        [Symbol.iterator]: function* () {},
      }) as unknown as DOMRectList,
  );
}
export function page(text: string, title = ""): PageContent {
  return {
    title,
    text,
    description: "",
    headings: [],
    structured: [],
    language: "en",
    extractedAt: "2026-09-23T12:00:00Z",
    diagnostics: {
      root: "article",
      characters: text.length,
      nodesVisited: 1,
      truncated: false,
      durationMs: 1,
    },
  };
}
