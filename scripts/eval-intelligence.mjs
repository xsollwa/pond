import { build } from "esbuild";
const compiled = await build({
  entryPoints: ["src/evaluation/run.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  write: false,
});
const { runEvaluation } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
);
try {
  await runEvaluation(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
