import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
await mkdir(".server", { recursive: true });
await build({
  entryPoints: ["src/server/main.ts"],
  outfile: ".server/main.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
});
await import("../.server/main.mjs");
