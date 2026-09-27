import { createServer, type IncomingMessage } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import {
  pageRepresentationSchema,
  validateAnalysis,
  type PageRepresentation,
  type IssueAnalysis,
} from "../intelligence/contracts";
import { ServiceError } from "./errors";
import { groupClientIP } from "./client-ip";
import { Budget, MinuteLimiter } from "./limits";
import { analyzeWithModel } from "./provider";
const envelope = z.object({ page: pageRepresentationSchema }).strict();
export interface ServerConfig {
  apiKey: string;
  model: string;
  origins: string[];
  budgetFile: string;
  production: boolean;
  /** Edge-set header carrying the client IP in production; must be one the host overwrites. */
  clientIPHeader?: string;
  dailyLimit?: number;
  perClientDaily?: number;
  timeoutMs?: number;
}
export type ModelCall = (
  page: PageRepresentation,
  signal: AbortSignal,
) => Promise<IssueAnalysis>;
function clientIP(req: IncomingMessage, production: boolean, header: string) {
  // Only a host edge-provided header (Railway: X-Real-IP); never trust a client-chosen X-Forwarded-For chain.
  return groupClientIP(
    production ? req.headers[header.toLowerCase()] : req.socket.remoteAddress,
  );
}
async function readBody(req: IncomingMessage, signal: AbortSignal) {
  if (
    req.headers["content-encoding"] &&
    req.headers["content-encoding"] !== "identity"
  )
    throw new ServiceError(
      415,
      "unsupported_encoding",
      "Compressed requests are not supported.",
    );
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] ?? ""))
    throw new ServiceError(415, "content_type", "JSON is required.");
  const size = Number(req.headers["content-length"] ?? 0);
  if (size > 80000)
    throw new ServiceError(
      413,
      "payload_too_large",
      "This page is too large to analyze.",
    );
  return new Promise<unknown>((resolve, reject) => {
    let length = 0;
    const chunks: Buffer[] = [];
    const cleanup = () => {
      req.off("data", data);
      req.off("end", end);
      req.off("error", error);
      signal.removeEventListener("abort", abort);
    };
    const error = (e: unknown) => {
      cleanup();
      reject(e);
    };
    const abort = () => {
      cleanup();
      req.resume();
      reject(
        new ServiceError(
          504,
          "timeout",
          "Analysis took too long. Please try again.",
        ),
      );
    };
    const data = (chunk: Buffer) => {
      length += chunk.length;
      if (length > 80000) {
        cleanup();
        req.resume();
        reject(
          new ServiceError(
            413,
            "payload_too_large",
            "This page is too large to analyze.",
          ),
        );
        return;
      }
      chunks.push(chunk);
    };
    const end = () => {
      cleanup();
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(
          new ServiceError(
            400,
            "invalid_json",
            "The page request was not valid JSON.",
          ),
        );
      }
    };
    req.on("data", data);
    req.on("end", end);
    req.on("error", error);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
export function createPondServer(
  config: ServerConfig,
  model: ModelCall = (page, signal) => analyzeWithModel(page, signal, config),
) {
  if (
    !config.origins.length ||
    config.origins.some(
      (origin) => !/^chrome-extension:\/\/[a-p]{32}$/.test(origin),
    )
  )
    throw new Error("A stable Chrome extension origin is required.");
  const budget = new Budget(
      config.budgetFile,
      config.dailyLimit,
      config.perClientDaily,
    ),
    limiter = new MinuteLimiter();
  let active = 0;
  return createServer(
    { maxHeaderSize: 16384, requestTimeout: 50000, headersTimeout: 10000 },
    async (req, res) => {
      const id = randomUUID();
      res.setHeader("X-Request-Id", id);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "no-referrer");
      const reply = (status: number, value: unknown) => {
        if (res.destroyed || res.writableEnded) return;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(value));
      };
      if (req.url === "/healthz" && req.method === "GET")
        return reply(config.apiKey ? 200 : 503, {
          status: config.apiKey ? "ready" : "not_ready",
        });
      if (req.url !== "/analyze")
        return reply(404, {
          error: { code: "not_found", message: "Not found", requestId: id },
        });
      const origin = req.headers.origin;
      if (!origin || !config.origins.includes(origin))
        return reply(403, {
          error: {
            code: "origin_denied",
            message: "This client is not supported.",
            requestId: id,
          },
        });
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "content-type");
      res.setHeader(
        "Access-Control-Expose-Headers",
        "Retry-After,X-Request-Id",
      );
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method !== "POST")
        return reply(405, {
          error: {
            code: "method_not_allowed",
            message: "POST required",
            requestId: id,
          },
        });
      let entered = false;
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        config.timeoutMs ?? 40000,
      );
      res.on("close", () => controller.abort());
      try {
        if (!config.apiKey)
          throw new ServiceError(
            503,
            "not_ready",
            "Pond is being set up. Please try again shortly.",
          );
        const ip = clientIP(
            req,
            config.production,
            config.clientIPHeader ?? "x-real-ip",
          ),
          hash = createHash("sha256").update(ip).digest("hex");
        if (!limiter.allow("all", 60) || !limiter.allow(hash))
          throw new ServiceError(
            429,
            "rate_limit",
            "Please wait a minute before analyzing another page.",
            60,
          );
        if (active >= 2)
          throw new ServiceError(
            429,
            "busy",
            "Pond is busy. Please try again in a moment.",
            15,
          );
        active++;
        entered = true;
        const parsed = envelope.safeParse(
          await readBody(req, controller.signal),
        );
        if (!parsed.success)
          throw new ServiceError(
            400,
            "invalid_page",
            "Pond could not read this page’s content.",
          );
        if (controller.signal.aborted)
          throw new ServiceError(
            504,
            "timeout",
            "Analysis took too long. Please try again.",
          );
        budget.reserve(ip);
        const analysis = validateAnalysis(
          await model(parsed.data.page, controller.signal),
          parsed.data.page,
        );
        if (controller.signal.aborted)
          throw new ServiceError(
            504,
            "timeout",
            "Analysis took too long. Please try again.",
          );
        reply(200, analysis);
      } catch (error) {
        const safe = controller.signal.aborted
          ? new ServiceError(
              504,
              "timeout",
              "Analysis took too long. Please try again.",
            )
          : error instanceof ServiceError
            ? error
            : new ServiceError(
                503,
                "unavailable",
                "Pond is temporarily unavailable. Please try again later.",
              );
        if (safe.retryAfter) res.setHeader("Retry-After", safe.retryAfter);
        reply(safe.status, {
          error: { code: safe.code, message: safe.message, requestId: id },
        });
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
      } finally {
        clearTimeout(timer);
        if (entered) active--;
      }
    },
  );
}
