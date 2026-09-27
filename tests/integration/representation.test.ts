// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { extractRepresentation } from "../../src/extraction/representation";
function page(html: string) {
  document.documentElement.innerHTML = `<head><title>Public debate</title></head><body>${html}</body>`;
  return extractRepresentation();
}
describe("structured extraction", () => {
  it("keeps article blocks and headings, excludes navigation, forms and hidden children", () => {
    const result = page(
      '<nav>Election elections</nav><main><h1>Food access</h1><p>Neighbors need groceries.<span hidden>SECRET</span></p><form><input value="PRIVATE"></form><aside>Healthcare advertising</aside></main>',
    );
    const text = result.blocks.map((b) => b.text).join(" ");
    expect(text).toContain("Neighbors need groceries.");
    expect(text).not.toMatch(/SECRET|PRIVATE|advertising|Election elections/);
    expect(result.blocks.some((b) => b.kind === "heading")).toBe(true);
  });
  it("bounds payload and ignores publisher addresses in schema metadata", () => {
    document.documentElement.innerHTML =
      '<head><title>News</title><script type="application/ld+json">{"headline":"Food access","publisher":{"address":"Private address"}}</script></head><body><main>' +
      Array.from(
        { length: 100 },
        (_, i) => `<p>${i} ${"visible text ".repeat(200)}</p>`,
      ).join("") +
      "</main></body>";
    const result = extractRepresentation();
    expect(result.blocks.length).toBeLessThanOrEqual(32);
    expect(
      result.blocks.reduce((sum, b) => sum + b.text.length, 0),
    ).toBeLessThanOrEqual(16000);
    expect(JSON.stringify(result)).not.toContain("Private address");
    expect(result.extraction.truncated).toBe(true);
  });
  it("does not capture editable text", () => {
    const result = page(
      '<main><p>Community reporting.</p><div contenteditable="true"><p>Unsent private message.</p></div></main>',
    );
    expect(JSON.stringify(result)).not.toContain("Unsent");
  });
});

it("focuses the explicitly selected social post without copying editable selections", () => {
  document.documentElement.innerHTML =
    '<head><title>Feed</title></head><body><div role="feed"><article data-post-id="a"><p id="chosen">Neighbors need reliable food assistance and grocery access in their community.</p><div contenteditable="true">Private unsent reply</div></article><article data-post-id="b"><p>Unrelated medical advertising from another post.</p></article></div></body>';
  const text = document.querySelector("#chosen")!.firstChild!;
  const range = document.createRange();
  range.selectNodeContents(text);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  const result = extractRepresentation();
  expect(result.focus.kind).toBe("post");
  expect(result.blocks.some((block) => block.kind === "selected_post")).toBe(
    true,
  );
  expect(JSON.stringify(result)).not.toMatch(
    /Private unsent|Unrelated medical/,
  );
  selection.removeAllRanges();
});
