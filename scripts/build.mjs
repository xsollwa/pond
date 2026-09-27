import { build } from "esbuild";
import { mkdir, readFile, writeFile, cp, access, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
const production = process.argv.includes("--production");
const config = JSON.parse(await readFile("deployment/production.json", "utf8"));
const identity = JSON.parse(
  await readFile("deployment/extension-identity.json", "utf8"),
);
const endpoint = production ? config.endpoint : "http://127.0.0.1:8787/analyze";
if (!endpoint)
  throw new Error(
    "Production endpoint has not been deployed. No release build will be created.",
  );
const service = new URL(endpoint);
if (
  service.username ||
  service.password ||
  service.search ||
  service.hash ||
  service.pathname !== "/analyze" ||
  (production && service.protocol !== "https:")
)
  throw new Error("Invalid public production endpoint");
const definitions = { __POND_SERVICE_URL__: JSON.stringify(endpoint) };
const browsers = ["chrome", "edge", "firefox"];
for (const browser of browsers) {
  const out = production
    ? resolve("dist", "production", browser)
    : resolve("dist", browser);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp("public", out, { recursive: true });
  await cp("data", join(out, "data"), { recursive: true });
  await cp("src/ui/styles.css", join(out, "app.css"));
  await build({
    entryPoints: ["src/ui/main.ts"],
    outfile: join(out, "app.js"),
    bundle: true,
    define: definitions,
    format: "esm",
    target: browser === "firefox" ? "firefox128" : "chrome116",
    minify: false,
    legalComments: "none",
  });
  for (const [entry, name] of [
    ["src/runtime/background.ts", "background"],
    ["src/runtime/content.ts", "content"],
    ["src/settings/main.ts", "settings"],
  ]) {
    await build({
      entryPoints: [entry],
      outfile: join(out, `${name}.js`),
      bundle: true,
      define: definitions,
      format: "iife",
      target: browser === "firefox" ? "firefox128" : "chrome116",
      legalComments: "none",
    });
  }
  const manifest = JSON.parse(
    await readFile(`manifests/${browser}.json`, "utf8"),
  );
  if (browser !== "firefox") manifest.key = identity.publicKey;
  manifest.host_permissions = [`${service.origin}/*`];
  manifest.content_security_policy.extension_pages = `script-src 'self'; object-src 'none'; connect-src 'self' ${service.origin}`;
  await writeFile(
    join(out, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  const files = [
    manifest.action.default_popup,
    manifest.options_ui?.page,
    manifest.background?.service_worker,
    ...(manifest.background?.scripts ?? []),
    "content.js",
    "settings.js",
    ...Object.values(manifest.icons),
    manifest.side_panel?.default_path,
    manifest.sidebar_action?.default_panel,
  ].filter(Boolean);
  for (const file of files) await access(join(out, file.split("?")[0]));
  const html =
    (await readFile(join(out, "index.html"), "utf8")) +
    (await readFile(join(out, "settings.html"), "utf8"));
  for (const [, file] of html.matchAll(/(?:src|href)="([^"]+)"/g))
    await access(join(out, file));
  if (
    JSON.stringify(manifest.host_permissions) !==
      JSON.stringify([`${service.origin}/*`]) ||
    manifest.permissions.some(
      (p) => !["storage", "scripting", "sidePanel"].includes(p),
    )
  )
    throw new Error("Unexpected permissions");
  for (const file of ["app.js", "background.js", "content.js", "settings.js"]) {
    const bundle = await readFile(join(out, file), "utf8");
    if (
      /sk-ant-[a-zA-Z0-9_-]{12,}|BEGIN (?:RSA )?PRIVATE KEY|ANTHROPIC_API_KEY/.test(
        bundle,
      )
    )
      throw new Error("Secret/server code detected in extension output");
  }
  if (production && /id="(?:endpoint|token)"/.test(html))
    throw new Error("Developer controls leaked into release settings");
  console.log(`Built and validated ${browser}: ${out}`);
}
