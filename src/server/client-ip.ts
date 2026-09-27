import { isIP } from "node:net";
import { ServiceError } from "./errors";
/** Validates an edge-provided client IP; IPv6 is grouped by /64 to avoid trivial rate-limit evasion using privacy addresses. */
export function groupClientIP(candidate: unknown): string {
  if (typeof candidate !== "string" || !isIP(candidate))
    throw new ServiceError(
      400,
      "invalid_client",
      "Pond could not identify this connection.",
    );
  if (isIP(candidate) === 6) {
    const host = new URL(`http://[${candidate}]`).hostname.slice(1, -1);
    const [left, right = ""] = host.split("::");
    const a = left ? left.split(":") : [],
      b = right ? right.split(":") : [];
    return [
      ...a,
      ...Array(Math.max(0, 8 - a.length - b.length)).fill("0"),
      ...b,
    ]
      .slice(0, 4)
      .join(":");
  }
  return candidate;
}
