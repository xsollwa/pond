import { createHmac, randomBytes } from "node:crypto";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
} from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { ServiceError } from "./errors";
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
/** Single-replica durable quota: reserves a call before spending, including failed calls. No page data or raw IPs. */
export class Budget {
  private ledger: z.infer<typeof ledgerSchema>;
  constructor(
    private file: string,
    private dailyLimit = 200,
    private perClientDaily = 40,
  ) {
    mkdirSync(dirname(file), { recursive: true });
    this.ledger = existsSync(file)
      ? ledgerSchema.parse(JSON.parse(readFileSync(file, "utf8")))
      : this.fresh();
    this.persist();
  }
  private fresh() {
    return {
      day: new Date().toISOString().slice(0, 10),
      salt: randomBytes(32).toString("hex"),
      total: 0,
      clients: {} as Record<string, number>,
    };
  }
  private persist() {
    writeFileSync(this.file + ".tmp", JSON.stringify(this.ledger), {
      mode: 0o600,
    });
    renameSync(this.file + ".tmp", this.file);
  }
  reserve(ip: string) {
    if (this.ledger.day !== new Date().toISOString().slice(0, 10))
      this.ledger = this.fresh();
    const key = createHmac("sha256", this.ledger.salt).update(ip).digest("hex");
    if (this.ledger.total >= this.dailyLimit)
      throw new ServiceError(
        429,
        "daily_capacity",
        "Pond has reached today’s analysis capacity. Please try again tomorrow.",
        3600,
      );
    if ((this.ledger.clients[key] ?? 0) >= this.perClientDaily)
      throw new ServiceError(
        429,
        "daily_limit",
        "You have reached today’s analysis limit. You can still explore issues manually.",
        3600,
      );
    this.ledger.total++;
    this.ledger.clients[key] = (this.ledger.clients[key] ?? 0) + 1;
    // If storage fails, the provider must not be called. Never silently reset a corrupt ledger.
    this.persist();
  }
}
export { MinuteLimiter } from "./minute-limiter";
