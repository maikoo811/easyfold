// Generate deterministic synthetic confidence fixtures for the /demo viewer examples.
// Re-running with the same seed produces byte-identical output, so the committed
// JSONs stay stable. Will be replaced with real AlphaFold output during Task 3.x.
//
//   node scripts/generate-confidence-fixture.mjs            # regenerates all structures
//   node scripts/generate-confidence-fixture.mjs 1crn       # regenerates one
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/fixtures");

// Synthetic ipTM (interface pTM, 0..1). Real ipTM is for multi-chain interfaces
// and will replace this value when AF3 actually runs in 3.x.
const SYNTHETIC_IPTM = 0.84;

const STRUCTURES = {
  "1tup": { length: 219, name: "1TUP (synthetic confidence)", seed: 42 },
  "1crn": { length: 46, name: "1CRN (synthetic confidence)", seed: 43 },
  "6lu7": { length: 306, name: "6LU7 (synthetic confidence)", seed: 44 },
};

function makeRng(seed) {
  // Mulberry32 — small, deterministic, good enough for fixture noise.
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

function buildPlddt(rng, n) {
  // Three regions: N-terminal ramp, structured core, C-terminal ramp.
  // A single mid-chain loop drops into the "low" band for visual variety.
  // Region boundaries scale with chain length so small chains still get
  // a recognisable shape.
  const nTermEnd = Math.max(4, Math.round(n * 0.23));
  const cTermStart = Math.max(nTermEnd + 1, Math.round(n * 0.69));
  const loopStart = Math.max(nTermEnd + 1, Math.round(n * 0.50));
  const loopEnd = Math.min(cTermStart - 1, loopStart + Math.round(n * 0.08));

  const plddt = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = i + 1;
    let base;
    if (r <= nTermEnd) base = 60 + (r / nTermEnd) * 32; // 60 -> 92
    else if (r <= cTermStart) base = 90;
    else base = 92 - ((r - cTermStart) / Math.max(1, n - cTermStart)) * 37; // 92 -> 55
    if (r >= loopStart && r <= loopEnd) base -= 25;
    const jitter = (rng() - 0.5) * 6;
    plddt[i] = Math.round(clamp(base + jitter, 30, 99) * 10) / 10;
  }
  return plddt;
}

function buildPae(rng, n) {
  // Distance-based PAE with a cross-domain step at the midpoint to simulate
  // two-domain uncertainty. Symmetric.
  const midpoint = Math.floor(n / 2);
  const pae = new Array(n);
  for (let i = 0; i < n; i++) pae[i] = new Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let v = Math.abs(i - j) * 0.15 + 1.0;
      if ((i < midpoint) !== (j < midpoint)) v += 12;
      v += (rng() - 0.5) * 1.0;
      v = clamp(v, 0.5, 30);
      pae[i][j] = Math.round(v * 100) / 100;
      pae[j][i] = pae[i][j];
    }
  }
  return pae;
}

async function generate(key) {
  const cfg = STRUCTURES[key];
  if (!cfg) {
    throw new Error(`Unknown structure id "${key}". Available: ${Object.keys(STRUCTURES).join(", ")}`);
  }
  const rng = makeRng(cfg.seed);
  const data = {
    name: cfg.name,
    length: cfg.length,
    plddt: buildPlddt(rng, cfg.length),
    pae: buildPae(rng, cfg.length),
    iptm: SYNTHETIC_IPTM,
  };
  const out = `${OUT_DIR}/${key}_confidence.json`;
  await writeFile(out, JSON.stringify(data));
  console.log(`generate-confidence-fixture: ${cfg.length} residues -> ${out}`);
}

const arg = process.argv[2];
const targets = arg ? [arg] : Object.keys(STRUCTURES);
for (const key of targets) {
  await generate(key);
}
