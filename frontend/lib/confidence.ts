export interface ConfidenceData {
  name: string;
  length: number;
  /** Per-residue pLDDT (0–100). `plddt.length === length`. */
  plddt: number[];
  /** Predicted aligned error matrix in Å. `pae.length === length`, each row also `length`. */
  pae: number[][];
  /** Interface pTM (0–1). Only meaningful for multi-chain predictions; may be absent for single-chain. */
  iptm?: number;
}

export type PlddtBand = "very-high" | "high" | "low" | "very-low";

export function plddtBand(score: number): PlddtBand {
  if (score >= 90) return "very-high";
  if (score >= 70) return "high";
  if (score >= 50) return "low";
  return "very-low";
}

/** AF3 typically caps PAE display at 30 Å — values above this all read "very uncertain". */
export const PAE_MAX = 30;
