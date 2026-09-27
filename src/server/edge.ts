import { z } from "zod";
import {
  pageRepresentationSchema,
  validateAnalysis,
  type PageRepresentation,
  type IssueAnalysis,
} from "../intelligence/contracts";
import { ServiceError } from "./errors";
import { groupClientIP } from "./client-ip";
import { analyzeWithModel } from "./provider";
import type { QuotaDecision } from "./edge-quota";
const envelope = z.object({ page: pageRepresentationSchema }).strict();
/** Firefox assigns each installation a random extension UUID, so its origin cannot be pinned. */
const FIREFOX_ORIGIN =
  /^moz-extension:\/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export interface EdgeConfig {
  apiKey: string;
  model: string;
  /** Exact Chromium origins (Chrome and Edge share the key-derived ID). */
  origins: string[];
  timeoutMs?: number;
}
/** Single serialized quota authority (a Durable Object in production). */
export interface EdgeQuotaClient {
  admit(client: string): Promise<QuotaDecision>;
  reserve(client: string): Promise<QuotaDecision>;
}
export type EdgeModelCall = (
  page: PageRepresentation,
  signal: AbortSignal,
) => Promise<IssueAnalysis>;
const timeout = () =>
  new ServiceError(504, "timeout", "Analysis took too long. Please try again.");
function check(decision: QuotaDecision) {
  if (!decision.ok)
    throw new ServiceError(
      decision.status,
      decision.code,
      decision.message,
      decision.retryAfter,
    );
}
async function readBody(request: Request, signal: AbortSignal) {
  const encoding = request.headers.get("content-encoding");
  if (encoding && encoding !== "identity")
    throw new ServiceError(
      415,
      "unsupported_encoding",
      "Compressed requests are not supported.",
    );
  if (
    !/^application\/json(?:\s*;|$)/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    throw new ServiceError(415, "content_type", "JSON is required.");
  const tooLarge = () =>
    new ServiceError(
      413,
      "payload_too_large",
      "This page is too large to analyze.",
    );
  if (Number(request.headers.get("content-length") ?? 0) > 80000)
    throw tooLarge();
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (reader) {
    if (signal.aborted) {
      await reader.cancel();
      throw timeout();
    }
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 80000) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new ServiceError(
      400,
      "invalid_json",
      "The page request was not valid JSON.",
    );
  }
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
/**
 * Fetch-API port of createPondServer for Cloudflare Workers. The client IP comes only from
 * Cloudflare's edge-set CF-Connecting-IP, which clients cannot override.
 */
export async function handleEdgeRequest(
  request: Request,
  config: EdgeConfig,
  quota: EdgeQuotaClient,
  model: EdgeModelCall = (page, signal) =>
    analyzeWithModel(page, signal, config),
): Promise<Response> {
  const id = crypto.randomUUID();
  const headers = new Headers({
    "X-Request-Id": id,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  const reply = (status: number, value: unknown) => {
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(value), { status, headers });
  };
  const path = new URL(request.url).pathname;
  if (path === "/healthz" && request.method === "GET")
    return reply(config.apiKey ? 200 : 503, {
      status: config.apiKey ? "ready" : "not_ready",
    });
  if (path !== "/analyze")
    return reply(404, {
      error: { code: "not_found", message: "Not found", requestId: id },
    });
  const origin = request.headers.get("origin");
  if (
    !origin ||
    !(config.origins.includes(origin) || FIREFOX_ORIGIN.test(origin))
  )
    return reply(403, {
      error: {
        code: "origin_denied",
        message: "This client is not supported.",
        requestId: id,
      },
    });
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "content-type");
  headers.set("Access-Control-Expose-Headers", "Retry-After,X-Request-Id");
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return reply(405, {
      error: {
        code: "method_not_allowed",
        message: "POST required",
        requestId: id,
      },
    });
  const signal = AbortSignal.timeout(config.timeoutMs ?? 40000);
  try {
    if (!config.apiKey)
      throw new ServiceError(
        503,
        "not_ready",
        "Pond is being set up. Please try again shortly.",
      );
    const client = await sha256(
      groupClientIP(request.headers.get("cf-connecting-ip")),
    );
    check(await quota.admit(client));
    const parsed = envelope.safeParse(await readBody(request, signal));
    if (!parsed.success)
      throw new ServiceError(
        400,
        "invalid_page",
        "Pond could not read this page’s content.",
      );
    if (signal.aborted) throw timeout();
    check(await quota.reserve(client));
    const analysis = validateAnalysis(
      await model(parsed.data.page, signal),
      parsed.data.page,
    );
    if (signal.aborted) throw timeout();
    return reply(200, analysis);
  } catch (error) {
    const safe = signal.aborted
      ? timeout()
      : error instanceof ServiceError
        ? error
        : new ServiceError(
            503,
            "unavailable",
            "Pond is temporarily unavailable. Please try again later.",
          );
    if (safe.retryAfter) headers.set("Retry-After", String(safe.retryAfter));
    // No request bodies, provider errors, headers, IP addresses or credentials in application logs.
    if (safe.status >= 500)
      console.warn(
        JSON.stringify({
          event: "analysis_failed",
          requestId: id,
          code: safe.code,
          status: safe.status,
        }),
      );
    return reply(safe.status, {
      error: { code: safe.code, message: safe.message, requestId: id },
    });
  }
}
