/**
 * Helpers for summarizing a pLDDT array into research-friendly stats.
 *
 * The 4-band convention (very high ≥90, confident 70-89, low 50-69, very
 * low <50) matches AlphaFold DB's published legend so users coming from the
 * AF3 website see the same buckets and colors. The previous 2-bucket version
 * (high > 70, low < 50) merged "very high" + "confident" under a single
 * "high" label which a researcher would (correctly) read as ≥90 only.
 */

export interface PlddtStats {
  /** Number of residues with a numeric pLDDT (NaN entries are skipped). */
  count: number;
  /** Arithmetic mean across non-NaN residues, in the 0–100 scale. */
  mean: number;
  /** Median (50th percentile, linear interpolation between adjacent samples).
   * More honest than `mean` for the typical bimodal distribution where a
   * confident core + disordered tails would otherwise cancel out. */
  median: number;
  /** Fraction (0–1) of residues with pLDDT ≥ 90 — AF3 "very high". */
  veryHighFraction: number;
  /** Fraction (0–1) of residues with 70 ≤ pLDDT < 90 — AF3 "confident". */
  confidentFraction: number;
  /** Fraction (0–1) of residues with 50 ≤ pLDDT < 70 — AF3 "low". */
  lowFraction: number;
  /** Fraction (0–1) of residues with pLDDT < 50 — AF3 "very low" (likely
   * disordered or mispredicted). */
  veryLowFraction: number;
}

const VERY_HIGH_THRESHOLD = 90;
const CONFIDENT_THRESHOLD = 70;
const LOW_THRESHOLD = 50;

function median(sortedAscending: readonly number[]): number {
  const n = sortedAscending.length;
  if (n === 0) return Number.NaN;
  const mid = (n - 1) / 2;
  const lo = Math.floor(mid);
  const hi = Math.ceil(mid);
  return (sortedAscending[lo] + sortedAscending[hi]) / 2;
}

/** Compute pLDDT summary stats. Returns `null` when the array is empty or
 * fully NaN — callers should fall back to "no confidence info" UI in that
 * case rather than rendering 0% chips. */
export function summarizePlddt(plddt: readonly number[]): PlddtStats | null {
  let sum = 0;
  let count = 0;
  let veryHighCount = 0;
  let confidentCount = 0;
  let lowCount = 0;
  let veryLowCount = 0;
  const valid: number[] = [];
  for (const value of plddt) {
    if (!Number.isFinite(value)) continue;
    sum += value;
    count += 1;
    valid.push(value);
    if (value >= VERY_HIGH_THRESHOLD) veryHighCount += 1;
    else if (value >= CONFIDENT_THRESHOLD) confidentCount += 1;
    else if (value >= LOW_THRESHOLD) lowCount += 1;
    else veryLowCount += 1;
  }
  if (count === 0) return null;
  valid.sort((a, b) => a - b);
  return {
    count,
    mean: sum / count,
    median: median(valid),
    veryHighFraction: veryHighCount / count,
    confidentFraction: confidentCount / count,
    lowFraction: lowCount / count,
    veryLowFraction: veryLowCount / count,
  };
}
