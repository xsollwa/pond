import {
  pageRepresentationSchema,
  type EvidenceBlock,
  type PageRepresentation,
} from "../intelligence/contracts";
/** Content-script extraction. Keeps blocks and provenance; never clones forms or uploads HTML. */
export function extractRepresentation(
  doc: Document = document,
  view: Window = window,
): PageRepresentation {
  const start = performance.now(),
    limit = 16000;
  let visited = 0,
    truncated = false;
  const excluded =
    'script,style,noscript,nav,footer,aside,form,input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[hidden],[inert],[aria-hidden="true"],[role="navigation"],[role="banner"],[role="contentinfo"],.sidebar,.cookie-banner,.advertisement,[data-ad],[data-testid="recommendations"]';
  const shown = (el: Element) => {
    for (let node: Element | null = el; node; node = node.parentElement) {
      const css = view.getComputedStyle(node);
      if (
        node.matches(excluded) ||
        css.display === "none" ||
        css.visibility === "hidden" ||
        css.opacity === "0"
      )
        return false;
    }
    return true;
  };
  const central = (el: Element) => {
    const r = el.getBoundingClientRect();
    return (
      r.height > 0 &&
      r.bottom > 0 &&
      r.top < view.innerHeight &&
      r.left < view.innerWidth &&
      r.right > 0
    );
  };
  const candidates = Array.from(
    doc.querySelectorAll(
      'shreddit-post,[data-testid="post-container"],[data-post-id],[role="article"],article',
    ),
  )
    .slice(0, 30)
    .filter(shown);
  const selection = view.getSelection();
  const selectionNode = selection?.anchorNode?.parentElement;
  const selected = selection?.toString().trim();
  const explicit =
    selected && selected.length >= 20 && selectionNode && shown(selectionNode)
      ? candidates.find((el) => el.contains(selectionNode))
      : undefined;
  const expanded = candidates.find(
    (el) => el.getAttribute("aria-expanded") === "true" && central(el),
  );
  const ranked = candidates
    .map((el, index) => {
      const r = el.getBoundingClientRect();
      const visible = Math.max(
        0,
        Math.min(r.bottom, view.innerHeight) - Math.max(0, r.top),
      );
      return {
        el,
        index,
        score:
          visible *
          Math.max(0, Math.min(r.right, view.innerWidth) - Math.max(0, r.left)),
      };
    })
    .sort((a, b) => b.score - a.score);
  const social =
    /reddit\.|facebook\.|instagram\.|(?:^|\.)x\.com$|threads\./.test(
      view.location.hostname,
    ) || !!doc.querySelector('shreddit-post,[data-post-id],[role="feed"]');
  const root =
    explicit ||
    expanded ||
    (social ? ranked[0]?.el : undefined) ||
    doc.querySelector('main,[role="main"],article') ||
    doc.body;
  const ambiguous = !!(
    social &&
    !explicit &&
    !expanded &&
    ranked.length > 1 &&
    ranked[0]!.score > 0 &&
    ranked[1]!.score / ranked[0]!.score > 0.9
  );
  const focusId = "focused-content";
  const blocks: EvidenceBlock[] = [];
  let chars = 0;
  const add = (
    id: string,
    kind: EvidenceBlock["kind"],
    text: string,
    provenance: EvidenceBlock["provenance"],
    importance: number,
    visible: boolean,
    isCentral: boolean,
    groupId: string | null = null,
    headingLevel: 1 | 2 | 3 | null = null,
  ) => {
    const cleaned = text
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, Math.min(1500, limit - chars));
    if (!cleaned || blocks.length >= 32) {
      truncated = true;
      return;
    }
    chars += cleaned.length;
    blocks.push({
      id,
      kind,
      text: cleaned,
      provenance,
      importance,
      visible,
      central: isCentral,
      groupId,
      headingLevel,
    });
  };
  add("title", "title", doc.title, "document", 0.7, true, false);
  for (const [id, selector, kind] of [
    ["description", 'meta[name="description"]', "meta_description"],
    ["ogtitle", 'meta[property="og:title"]', "opengraph"],
    ["ogdescription", 'meta[property="og:description"]', "opengraph"],
  ] as const) {
    const el = doc.querySelector<HTMLMetaElement>(selector);
    if (el) add(id, kind, el.content, "metadata", 0.35, false, false);
  }
  for (const [index, script] of Array.from(
    doc.querySelectorAll('script[type="application/ld+json"]'),
  )
    .slice(0, 3)
    .entries()) {
    const raw = script.textContent ?? "";
    if (raw.length > 16000) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      const pending = Array.isArray(parsed) ? parsed.slice(0, 5) : [parsed];
      for (let i = 0; i < Math.min(pending.length, 8); i++) {
        const entry = pending[i];
        if (!entry || typeof entry !== "object") continue;
        const object = entry as Record<string, unknown>;
        if (Array.isArray(object["@graph"]))
          pending.push(...object["@graph"].slice(0, 5));
        const allowed: Record<string, unknown> = {};
        for (const key of [
          "@type",
          "headline",
          "description",
          "articleSection",
          "spatialCoverage",
          "location",
        ]) {
          const value = object[key];
          if (typeof value === "string") allowed[key] = value.slice(0, 400);
          else if (
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
          ) {
            const v = value as Record<string, unknown>;
            allowed[key] = Object.fromEntries(
              ["name", "addressLocality", "addressRegion", "addressCountry"]
                .filter((k) => typeof v[k] === "string")
                .map((k) => [k, String(v[k]).slice(0, 150)]),
            );
          }
        }
        if (Object.keys(allowed).length)
          add(
            `schema${index}_${i}`,
            "structured_data",
            JSON.stringify(allowed),
            "schema_org",
            0.3,
            false,
            false,
          );
      }
    } catch {
      /* Invalid publisher metadata is ignored. */
    }
  }
  const groups = new Map<Element, { parts: string[]; order: number }>();
  const exhausted = Symbol("budget");
  if (root && shown(root)) {
    const walker = doc.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          visited++;
          if (visited > 6000 || performance.now() - start > 120) {
            truncated = true;
            throw exhausted;
          }
          if (node.nodeType === Node.ELEMENT_NODE)
            return shown(node as Element)
              ? NodeFilter.FILTER_SKIP
              : NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );
    try {
      let node: Node | null;
      let observed = 0;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent) continue;
        const text = (node.textContent ?? "").trim().slice(0, 1500);
        if (!text) continue;
        const owner = parent.closest("p,li,blockquote,h1,h2,h3") ?? parent;
        const group = groups.get(owner) ?? { parts: [], order: groups.size };
        group.parts.push(text);
        groups.set(owner, group);
        observed += text.length;
        if (observed > 20000) {
          truncated = true;
          break;
        }
      }
    } catch (error) {
      if (error !== exhausted) throw error;
    }
  }
  const seen = new Set<string>();
  for (const [el, group] of groups) {
    const text = group.parts.join(" ").replace(/\s+/g, " ").trim();
    if (seen.has(text)) continue;
    seen.add(text);
    const heading = /^H[123]$/.test(el.tagName);
    const visibleCentral = central(el);
    add(
      `block${group.order}`,
      heading
        ? "heading"
        : social
          ? explicit
            ? "selected_post"
            : "expanded_post"
          : "paragraph",
      text,
      social ? "social_post" : root?.tagName === "ARTICLE" ? "article" : "main",
      heading ? 0.8 : visibleCentral ? 0.9 : 0.6,
      true,
      visibleCentral,
      focusId,
      heading ? (Number(el.tagName[1]) as 1 | 2 | 3) : null,
    );
    if (chars >= limit || blocks.length >= 32) {
      truncated = true;
      break;
    }
  }
  const hasFocus = blocks.some((block) => block.groupId === focusId);
  return pageRepresentationSchema.parse({
    schemaVersion: "1.0.0",
    source: {
      domain: view.location.hostname || "unknown.invalid",
      kind: /reddit\./.test(view.location.hostname)
        ? "reddit"
        : social
          ? "social"
          : /\.gov$/.test(view.location.hostname)
            ? "government"
            : /\.org$/.test(view.location.hostname)
              ? "organization"
              : root?.tagName === "ARTICLE"
                ? "news"
                : "other",
      language: doc.documentElement.lang || "en",
    },
    focus: {
      kind: ambiguous
        ? "ambiguous"
        : social
          ? "post"
          : root?.tagName === "ARTICLE"
            ? "article"
            : "page",
      groupId: hasFocus && !ambiguous ? focusId : null,
    },
    blocks,
    extraction: {
      truncated,
      coverage: hasFocus ? (truncated ? 0.6 : 1) : 0.1,
      warnings: ambiguous
        ? ["Multiple posts are equally prominent; select or expand one."]
        : [],
    },
  });
}
