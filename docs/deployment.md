# Hosted service deployment

Status: deployed on Cloudflare Workers (free plan) at `https://pond-api.gaboyanruzanna.workers.dev`. `deployment/production.json` points production extension builds at its `/analyze` endpoint. Real-model live end-to-end tests pass for the Chrome, Edge (in Chromium) and Firefox production builds.

## Layout

- `worker/index.ts`: Worker entry point and the `PondQuota` Durable Object.
- `src/server/edge.ts`: Fetch-API request handling (origin/CORS, validation, limits, model call, error redaction), shared with the Node service’s contracts and provider code.
- `src/server/edge-quota.ts`: durable per-minute and daily quota logic.
- `wrangler.jsonc`: Worker configuration, non-secret variables and the Durable Object migration.

The Node service (`src/server/app.ts`, `Dockerfile`, `railway.json`) is still supported for container hosts. On Railway it needs a persistent volume. On hosts without volumes, set `POND_DATA_DIR` and `POND_EPHEMERAL_BUDGET=1` to accept budgets that reset on restart. `POND_CLIENT_IP_HEADER` names the edge-set client IP header (default `x-real-ip`).

## Operating the Worker

```sh
pnpm exec wrangler login                                  # once per machine
pnpm deploy:worker                                        # deploy code and config
printenv ANTHROPIC_API_KEY | pnpm exec wrangler secret put ANTHROPIC_API_KEY
curl https://pond-api.gaboyanruzanna.workers.dev/healthz  # {"status":"ready"}
```

- `ANTHROPIC_API_KEY` is a Worker secret only. Never put it in `wrangler.jsonc`, the repository, the extension or chat.
- `POND_MODEL`, `POND_DAILY_LIMIT` and `POND_CLIENT_DAILY_LIMIT` are plain variables in `wrangler.jsonc`.
- Logs: `pnpm exec wrangler tail`. Application logs contain only event names, request IDs, codes and statuses.
- If the endpoint changes, update `deployment/production.json`, then run `pnpm release` and the live tests before publishing a new GitHub release.

## Production protections

No shared client secret is embedded. This is an anonymous, rate-limited endpoint. Chrome and Edge must send the exact stable extension origin `chrome-extension://mkcfmikjkimacobceplddcjmnfklppoc`, derived from the public key in `deployment/extension-identity.json`. Firefox assigns each installation a random UUID, so any well-formed `moz-extension://<uuid>` origin is accepted. CORS echoes only allowed origins. Origin headers can be spoofed by non-browser clients and are not authentication.

Clients are identified only by Cloudflare’s edge-set `CF-Connecting-IP`; Cloudflare rejects client attempts to set it. IPv6 is grouped by /64. Each client gets six requests per minute and 40 provider calls per UTC day. Globally the limits are 60 requests per minute and 200 provider calls per day. One global Durable Object serializes all reservations and stores only a daily salt, counts and salted HMACs of hashed client IPs. It never stores raw IPs, content, domains or browsing history. A provider call is reserved durably before spending, failed calls count, and invalid requests do not consume provider calls. Corrupt quota state fails closed.

These are **call-count limits, not a dollar cap**. Set a monthly spend limit for the API key in the Anthropic Console.

Other protections: strict JSON/page/evidence validation, 80 KB request bodies, compressed input rejected, 16,000 extracted characters, bounded provider output (100 KB, 4,500 max tokens), 40-second analysis deadline, upstream redirects not followed, no automatic retries, structured generic errors with request IDs and `Retry-After`, and no request/provider text or secrets in logs. The health check reports only ready/not_ready and makes no model call. Build-time scanning rejects provider keys, private keys and server-key variable references in extension bundles, and `pnpm release` re-verifies the zips.

Unlike the Node service, the Worker has no two-request global concurrency cap, because Workers scale per request. The daily limits bound total spend.

## References

- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare HTTP request headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)
- [Claude model IDs](https://platform.claude.com/docs/en/models/overview)
