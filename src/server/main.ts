import { join } from "node:path";
import identity from "../../deployment/extension-identity.json";
import { createPondServer } from "./app";
const production = process.env.NODE_ENV === "production";
// Railway provides a persistent volume. Hosts without volumes (e.g. Koyeb free) must opt in
// explicitly with POND_DATA_DIR plus POND_EPHEMERAL_BUDGET=1, accepting counter resets on restart.
const volume =
  process.env.RAILWAY_VOLUME_MOUNT_PATH ??
  (process.env.POND_EPHEMERAL_BUDGET === "1"
    ? process.env.POND_DATA_DIR
    : undefined);
if (production && !volume)
  throw new Error(
    "Attach a persistent Railway volume before starting production; daily budgets must survive restarts. Set POND_DATA_DIR and POND_EPHEMERAL_BUDGET=1 to accept non-persistent budgets.",
  );
const positive = (name: string, fallback: number) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 100000)
    throw new Error(`Invalid ${name}`);
  return value;
};
export const server = createPondServer({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  model: process.env.POND_MODEL ?? "claude-sonnet-5",
  origins: [`chrome-extension://${identity.id}`],
  budgetFile: production
    ? join(volume!, "pond-budget.json")
    : (process.env.POND_BUDGET_FILE ?? ".cache/pond-budget.json"),
  production,
  clientIPHeader: process.env.POND_CLIENT_IP_HEADER ?? "x-real-ip",
  dailyLimit: positive("POND_DAILY_LIMIT", 200),
  perClientDaily: positive("POND_CLIENT_DAILY_LIMIT", 40),
});
server.listen(
  Number(process.env.PORT ?? process.env.POND_PORT ?? 8787),
  production ? "0.0.0.0" : "127.0.0.1",
  () =>
    console.log(
      JSON.stringify({
        event: "pond_started",
        mode: production ? "production" : "development",
      }),
    ),
);
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 45000).unref();
});
