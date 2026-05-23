// Copy Mol*'s prebuilt UMD bundle + CSS from node_modules into public/molstar/
// so the StructureViewer can load it via <script> / <link> tags. This sidesteps
// Turbopack's failure to bundle Mol*'s .html / .scss / Node-only mp4-export modules.
// Runs from package.json "postinstall" — both locally and in CI.
import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../node_modules/molstar/build/viewer");
const DEST = resolve(__dirname, "../public/molstar");
const FILES = ["molstar.js", "molstar.css"];

try {
  await mkdir(DEST, { recursive: true });
  await Promise.all(
    FILES.map((f) => cp(`${SRC}/${f}`, `${DEST}/${f}`, { force: true })),
  );
  console.log(`copy-molstar: copied ${FILES.join(", ")} to ${DEST}`);
} catch (err) {
  // Don't crash install if molstar isn't installed yet (e.g. mid-uninstall).
  console.warn(`copy-molstar: skipped (${err instanceof Error ? err.message : err})`);
}
