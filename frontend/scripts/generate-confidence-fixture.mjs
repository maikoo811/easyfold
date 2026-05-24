// Generate a deterministic synthetic confidence fixture for the /demo/viewer page.
// 219 residues to match the 1TUP protein chain (the structure in public/fixtures/1tup.cif).
// Re-running with the same seed produces byte-identical output, so the committed JSON
// stays stable across regenerations. Replace with real AF3 output during Task 3.x.
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/fixtures/1tup_confidence.json");

const N = 219;
const SEED = 42;

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

function buildPlddt(rng) {
  // Three regions: N-terminal ramp (1..50), structured core (50..150), C-terminal ramp.
  // Single mid-chain loop (residues 110..125) drops into the "low" band for variety.
  const plddt = new Array(N);
  for (let i = 0; i < N; i++) {
    const r = i + 1;
    let base;
    if (r <= 50) base = 60 + (r / 50) * 32; // 60 -> 92
    else if (r <= 150) base = 90; // core
    else base = 92 - ((r - 150) / (N - 150)) * 37; // 92 -> 55
    if (r >= 110 && r <= 125) base -= 25; // loop
    const jitter = (rng() - 0.5) * 6;
    plddt[i] = Math.round(clamp(base + jitter, 30, 99) * 10) / 10;
  }
  return plddt;
}

function buildPae(rng) {
  // Distance-based PAE with a cross-domain step at residue 100, simulating
  // two-domain uncertainty. Symmetric.
  const pae = new Array(N);
  for (let i = 0; i < N; i++) pae[i] = new Array(N);
  for (let i = 0; i < N; i++) {
    for (let j = i; j < N; j++) {
      let v = Math.abs(i - j) * 0.15 + 1.0;
      if ((i < 100) !== (j < 100)) v += 12;
      v += (rng() - 0.5) * 1.0;
      v = clamp(v, 0.5, 30);
      pae[i][j] = Math.round(v * 100) / 100;
      pae[j][i] = pae[i][j];
    }
  }
  return pae;
}

const rng = makeRng(SEED);
// ipTM is the inter-chain interface confidence — really only meaningful for
// multi-chain complexes. 1TUP is a single protein chain in this fixture, so
// the value below is synthetic; included so the metric path can be exercised
// end-to-end (e.g. the LLM interpretation prompt). Real ipTM will land in 3.x.
const SYNTHETIC_IPTM = 0.84;
const data = {
  name: "1TUP (synthetic confidence)",
  length: N,
  plddt: buildPlddt(rng),
  pae: buildPae(rng),
  iptm: SYNTHETIC_IPTM,
};

await writeFile(OUT, JSON.stringify(data));
console.log(`generate-confidence-fixture: wrote ${N} residues -> ${OUT}`);
