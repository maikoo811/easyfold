// One-time downloader for the mmCIF files that back the /demo viewer examples.
// Idempotent: skips files that already exist. Committed CIFs let contributors
// build the demo without a network connection.
//
//   node scripts/download-pdb-fixtures.mjs
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "../public/fixtures");
const ENTRIES = ["1CRN", "6LU7"]; // 1TUP is already in the repo

for (const pdb of ENTRIES) {
  const dest = `${FIXTURES_DIR}/${pdb.toLowerCase()}.cif`;
  if (existsSync(dest)) {
    console.log(`download-pdb-fixtures: ${pdb} already present, skipping`);
    continue;
  }
  const url = `https://files.rcsb.org/download/${pdb}.cif`;
  process.stdout.write(`download-pdb-fixtures: fetching ${pdb} ... `);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`failed (HTTP ${res.status})`);
    process.exitCode = 1;
    continue;
  }
  const body = await res.text();
  await writeFile(dest, body);
  console.log(`${(body.length / 1024).toFixed(0)} KB -> ${dest}`);
}
