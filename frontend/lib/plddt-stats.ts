/**
 * Helpers for summarizing a pLDDT array into research-friendly stats.
 *
 * The "very high / confident / low / very low" bucket boundaries match
 * AlphaFold DB's published convention so users coming from the AF3 website
 * see the same legend.
 */

export interface PlddtStats {
  /** Number of residues with a numeric pLDDT (NaN entries are skipped). */
  count: number;
  /** Arithmetic mean across non-NaN residues, in the 0–100 scale. */
  mean: number;
  /** Fraction (0–1) of residues with pLDDT > 70 — confident or better. */
  highFraction: number;
  /** Fraction (0–1) of residues with pLDDT < 50 — likely disordered or
   * mispredicted. Same axis as `highFraction`; the gap between the two is the
   * "low confidence" bucket (50 ≤ pLDDT ≤ 70). */
  lowFraction: number;
}

const HIGH_THRESHOLD = 70;
const LOW_THRESHOLD = 50;

/** Compute pLDDT summary stats. Returns `null` when the array is empty or
 * fully NaN — callers should fall back to "no confidence info" UI in that
 * case rather than rendering 0% chips. */
export function summarizePlddt(plddt: readonly number[]): PlddtStats | null {
  let sum = 0;
  let count = 0;
  let highCount = 0;
  let lowCount = 0;
  for (const value of plddt) {
    if (!Number.isFinite(value)) continue;
    sum += value;
    count += 1;
    if (value > HIGH_THRESHOLD) highCount += 1;
    if (value < LOW_THRESHOLD) lowCount += 1;
  }
  if (count === 0) return null;
  return {
    count,
    mean: sum / count,
    highFraction: highCount / count,
    lowFraction: lowCount / count,
  };
}
