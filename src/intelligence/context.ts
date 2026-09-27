import {
  contextObjectSchema,
  pageRepresentationSchema,
  validateAnalysis,
  type ContextObject,
  type GeographicLocation,
  type PageRepresentation,
} from "./contracts";
/** A stable content identity, not a browsing-history record or an implemented cache. */
export async function representationFingerprint(
  input: PageRepresentation,
): Promise<string> {
  const page = pageRepresentationSchema.parse(input);
  const canonical = {
    schemaVersion: page.schemaVersion,
    source: page.source,
    focus: page.focus,
    blocks: page.blocks
      .map((block) => ({
        id: block.id,
        kind: block.kind,
        text: block.text.normalize("NFC").trim().replace(/\s+/g, " "),
        provenance: block.provenance,
        visible: block.visible,
        central:
          page.focus.kind === "post" || page.focus.kind === "ambiguous"
            ? block.central
            : false,
        groupId: block.groupId,
        headingLevel: block.headingLevel,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonical)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
/** User location is supplied independently. Absence stays unknown; never default it from content geography. */
export async function createContext(
  analysis: unknown,
  page: PageRepresentation,
  userLocation: GeographicLocation | null = null,
): Promise<ContextObject> {
  return contextObjectSchema.parse({
    schemaVersion: "1.0.0",
    analysis: validateAnalysis(analysis, page),
    userLocation,
    representationFingerprint: await representationFingerprint(page),
  });
}
