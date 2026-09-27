import { build } from "esbuild";
await build({
  entryPoints: ["src/server/main.ts"],
  outfile: ".server/main.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
});
