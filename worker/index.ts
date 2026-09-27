import { DurableObject } from "cloudflare:workers";
import identity from "../deployment/extension-identity.json";
import { handleEdgeRequest } from "../src/server/edge";
import { EdgeQuota } from "../src/server/edge-quota";
interface Env {
  ANTHROPIC_API_KEY?: string;
  POND_MODEL?: string;
  POND_DAILY_LIMIT?: string;
  POND_CLIENT_DAILY_LIMIT?: string;
  QUOTA: DurableObjectNamespace<PondQuota>;
}
const positive = (value: string | undefined, fallback: number) => {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n < 1 || n > 100000)
    throw new Error("Invalid limit");
  return n;
};
/** One global instance serializes every reservation, like the single-replica Node service. */
export class PondQuota extends DurableObject<Env> {
  private quota = new EdgeQuota(
    this.ctx.storage,
    positive(this.env.POND_DAILY_LIMIT, 200),
    positive(this.env.POND_CLIENT_DAILY_LIMIT, 40),
  );
  admit(client: string) {
    return this.quota.admit(client);
  }
  reserve(client: string) {
    return this.quota.reserve(client);
  }
}
export default {
  fetch(request, env) {
    const quota = env.QUOTA.get(env.QUOTA.idFromName("global"));
    return handleEdgeRequest(
      request,
      {
        apiKey: env.ANTHROPIC_API_KEY ?? "",
        model: env.POND_MODEL ?? "claude-sonnet-5",
        origins: [`chrome-extension://${identity.id}`],
      },
      quota,
    );
  },
} satisfies ExportedHandler<Env>;
