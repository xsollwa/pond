import { z } from "zod";
import { ServiceError } from "./errors";
import { MinuteLimiter } from "./minute-limiter";
const ledgerSchema = z
  .object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    salt: z.string().length(64),
    total: z.number().int().nonnegative(),
    clients: z.record(
      z.string().regex(/^[a-f0-9]{64}$/),
      z.number().int().nonnegative(),
    ),
  })
  .strict();
type Ledger = z.infer<typeof ledgerSchema>;
export interface QuotaStorage {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
}
export type QuotaDecision =
  | { ok: true }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      retryAfter?: number;
    };
const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
const today = () => new Date().toISOString().slice(0, 10);
const deny = (error: ServiceError): QuotaDecision => ({
  ok: false,
  status: error.status,
  code: error.code,
  message: error.message,
  retryAfter: error.retryAfter,
});
/**
 * Durable-storage quota for the edge worker, mirroring Budget/MinuteLimiter: a single instance
 * serializes all reservations. Clients arrive as SHA-256 digests; storage keeps only daily salted HMACs.
 */
export class EdgeQuota {
  private limiter = new MinuteLimiter();
  constructor(
    private storage: QuotaStorage,
    private dailyLimit = 200,
    private perClientDaily = 40,
  ) {}
  /** Per-minute admission, checked before the body is read. */
  admit(client: string): QuotaDecision {
    if (!this.limiter.allow("all", 60) || !this.limiter.allow(client))
      return deny(
        new ServiceError(
          429,
          "rate_limit",
          "Please wait a minute before analyzing another page.",
          60,
        ),
      );
    return { ok: true };
  }
  /** Durably reserves one provider call before spending; failed calls still count. */
  async reserve(client: string): Promise<QuotaDecision> {
    const stored = await this.storage.get("ledger");
    // Corrupt state fails closed via the parse error rather than silently resetting.
    let ledger: Ledger =
      stored === undefined ? await this.fresh() : ledgerSchema.parse(stored);
    if (ledger.day !== today()) ledger = await this.fresh();
    const key = await this.hmac(ledger.salt, client);
    if (ledger.total >= this.dailyLimit)
      return deny(
        new ServiceError(
          429,
          "daily_capacity",
          "Pond has reached today’s analysis capacity. Please try again tomorrow.",
          3600,
        ),
      );
    if ((ledger.clients[key] ?? 0) >= this.perClientDaily)
      return deny(
        new ServiceError(
          429,
          "daily_limit",
          "You have reached today’s analysis limit. You can still explore issues manually.",
          3600,
        ),
      );
    ledger.total++;
    ledger.clients[key] = (ledger.clients[key] ?? 0) + 1;
    await this.storage.put("ledger", ledger);
    return { ok: true };
  }
  private async fresh(): Promise<Ledger> {
    return {
      day: today(),
      salt: hex(crypto.getRandomValues(new Uint8Array(32)).buffer),
      total: 0,
      clients: {},
    };
  }
  private async hmac(salt: string, value: string) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(salt),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    return hex(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
    );
  }
}
