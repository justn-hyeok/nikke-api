import { build } from "esbuild";

await build({
  entryPoints: ["src/*.ts"],
  outdir: "server",
  format: "esm",
  platform: "node",
  target: "es2022",
  logLevel: "info",
});
