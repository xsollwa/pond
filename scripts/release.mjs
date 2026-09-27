// Packages the production builds into per-browser zips for GitHub Releases and verifies their contents.
import { execFileSync } from "node:child_process";
import { readFile, rm, mkdir, readdir, stat } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import assert from "node:assert/strict";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const config = JSON.parse(await readFile("deployment/production.json", "utf8"));
const identity = JSON.parse(
  await readFile("deployment/extension-identity.json", "utf8"),
);
execFileSync("node", ["scripts/build.mjs", "--production"], {
  stdio: "inherit",
});
const out = resolve("release");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
async function files(directory) {
  const entries = [];
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    if ((await stat(path)).isDirectory()) entries.push(...(await files(path)));
    else entries.push(path);
  }
  return entries;
}
const service = new URL(config.endpoint).origin;
for (const browser of ["chrome", "edge", "firefox"]) {
  const source = resolve("dist", "production", browser);
  const manifest = JSON.parse(
    await readFile(join(source, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.version, version, `${browser} manifest version`);
  assert.deepEqual(manifest.host_permissions, [`${service}/*`]);
  if (browser === "firefox")
    assert.ok(manifest.browser_specific_settings?.gecko?.id);
  else assert.equal(manifest.key, identity.publicKey, `${browser} stable ID`);
  const listed = (await files(source)).map((file) => relative(source, file));
  for (const file of listed) {
    assert.ok(
      !/(^|\/)\.|\.(pem|key|map|ts)$|(^|\/)(node_modules|src)\//.test(file),
      `Unexpected file in ${browser} release: ${file}`,
    );
    if (/\.(js|json|html)$/.test(file)) {
      const text = await readFile(join(source, file), "utf8");
      assert.ok(
        !/sk-ant-[a-zA-Z0-9_-]{12,}|BEGIN (?:RSA )?PRIVATE KEY|ANTHROPIC_API_KEY/.test(
          text,
        ),
        `Secret-like content in ${browser}/${file}`,
      );
    }
  }
  // Zip the folder contents at the archive root so the unzipped folder is loadable as-is.
  const archive = join(out, `pond-${browser}-v${version}.zip`);
  execFileSync("zip", ["-qr", "-X", archive, "."], { cwd: source });
  console.log(`Packaged ${relative(".", archive)} (${listed.length} files)`);
}
