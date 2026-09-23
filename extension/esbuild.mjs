import * as esbuild from "esbuild";

const common = { bundle: true, sourcemap: true, logLevel: "info" };

const builds = [
  // Extension host.
  { ...common, entryPoints: ["src/extension.ts"], outfile: "dist/extension.js", external: ["vscode"], format: "cjs", platform: "node", target: "node20" },
  // Pair editor webview.
  { ...common, entryPoints: ["webview/pair.ts"], outfile: "dist/webview/pair.js", format: "iife", platform: "browser", target: "es2022", minify: true },
];

if (process.argv.includes("--watch")) {
  for (const options of builds) await (await esbuild.context(options)).watch();
} else {
  await Promise.all(builds.map((options) => esbuild.build(options)));
}
