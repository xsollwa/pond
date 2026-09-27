import { test, expect } from "vitest";
import { installDOM } from "../helpers";
import { extractPage } from "../../src/extraction/extract-page";
const body =
  "Residents are discussing affordable housing and tenant protections. They described eviction and homelessness concerns during a public meeting and asked council members to support rental assistance for families in the community.";
test("extracts title, metadata, headings and article data; removes chrome, hidden ancestors and editable content", async () => {
  installDOM(
    `<title>Housing</title><meta name="description" content="Local policy"><script type="application/ld+json">{"@type":"NewsArticle","headline":"Housing report"}</script><nav>BOILERPLATE</nav><main><header><h1>Housing debate</h1></header><p>${body}</p><aside>SIDEBAR</aside><div style="opacity:0"><p>SECRET</p></div><div hidden>HIDDEN</div><form><input value="PRIVATE"><p>FORM</p></form><div contenteditable="true">EDIT</div><p>${body}</p></main><footer>FOOTER</footer>`,
  );
  const result = await extractPage();
  expect(result.title).toBe("Housing");
  expect(result.description).toBe("Local policy");
  expect(result.headings).toContain("Housing debate");
  expect(result.structured[0]?.headline).toBe("Housing report");
  for (const token of [
    "BOILERPLATE",
    "SIDEBAR",
    "SECRET",
    "HIDDEN",
    "PRIVATE",
    "FORM",
    "EDIT",
    "FOOTER",
  ])
    expect(result.text).not.toContain(token);
  expect(result.text.split(body)).toHaveLength(2);
});
test("does not use JSON-LD articleBody as visible content or fail on malformed JSON", async () => {
  installDOM(
    `<script type="application/ld+json">broken</script><script type="application/ld+json">{"@type":"NewsArticle","articleBody":"SECRET"}</script><article>${body}</article>`,
  );
  const result = await extractPage();
  expect(result.text).not.toContain("SECRET");
});
test("includes a delayed client-rendered article and captures updates on reread", async () => {
  installDOM("<main></main>");
  setTimeout(() => {
    document.querySelector("main")!.textContent = body;
  }, 40);
  expect((await extractPage()).text).toContain("tenant protections");
  document.querySelector("main")!.textContent = body + " Updated today.";
  expect((await extractPage()).text).toContain("Updated today.");
});
test("bounds oversized text", async () => {
  installDOM(`<article>${body.repeat(600)}</article>`);
  const result = await extractPage();
  expect(result.text.length).toBeLessThanOrEqual(48000);
  expect(result.diagnostics.truncated).toBe(true);
});
test("body fallback removes navigation", async () => {
  installDOM(`<nav>IGNORE</nav><div>${body}</div>`);
  const result = await extractPage();
  expect(result.diagnostics.root).toBe("body");
  expect(result.text).not.toContain("IGNORE");
});
test("hidden heading descendants do not leak through heading metadata", async () => {
  installDOM(
    `<article><h1>Housing <span hidden>SECRET</span></h1><p>${body}</p></article>`,
  );
  const result = await extractPage();
  expect(result.headings.join(" ")).not.toContain("SECRET");
});
test("stops work after the element budget even when all nodes are rejected", async () => {
  installDOM(
    `<article>${"<aside>Noise</aside>".repeat(9500)}<p>${body}</p></article>`,
  );
  const result = await extractPage();
  expect(result.diagnostics.nodesVisited).toBeLessThanOrEqual(9001);
  expect(result.diagnostics.truncated).toBe(true);
});
