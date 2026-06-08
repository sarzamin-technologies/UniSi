// Copies pdfjs-dist's web worker into apps/web/public so the browser can load
// it from the same origin as the page. Resolves the package via Node so it
// works regardless of whether pnpm hoisted the file or kept it in .pnpm/.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { copyFileSync, mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

try {
  const pkgPath = require.resolve("pdfjs-dist/package.json");
  const src = resolve(dirname(pkgPath), "build", "pdf.worker.min.mjs");
  const destDir = resolve(here, "..", "public");
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, resolve(destDir, "pdf.worker.min.mjs"));
} catch (err) {
  console.warn("[copy-pdf-worker] skipped:", err?.message ?? err);
}
