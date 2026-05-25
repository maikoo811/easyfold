/**
 * Preset post-translational modification codes recognized by AlphaFold 3.
 *
 * AF3 accepts arbitrary PTM codes from the PDB Chemical Component Dictionary
 * (CCD) — the preset list below covers the ~10 most common in mammalian
 * cell biology. "Other..." swaps the dropdown for a free text input so power
 * users can enter any CCD ligand code.
 *
 * **Boltz-2 silently drops modifications** (see `boltz_input/builder.py`'s
 * docstring). The Predict button disables Boltz when any protein carries
 * modifications and the user sees an explanatory tooltip.
 */

export interface PtmPreset {
  code: string;
  label: string;
}

export const PTM_PRESETS: PtmPreset[] = [
  { code: "PHOSPHO", label: "Phosphorylation" },
  { code: "METHYLATION", label: "Methylation" },
  { code: "ACETYLATION", label: "Acetylation" },
  { code: "HYDROXY", label: "Hydroxylation" },
  { code: "GLYCAN", label: "Glycosylation" },
  { code: "MYRISTOYLATION", label: "Myristoylation" },
  { code: "PALMITOYLATION", label: "Palmitoylation" },
  { code: "UBIQUITIN", label: "Ubiquitination" },
  { code: "SUMO", label: "SUMOylation" },
  { code: "SUCCINYLATION", label: "Succinylation" },
];

export const PTM_OTHER_SENTINEL = "__OTHER__";

export function isPresetCode(code: string): boolean {
  return PTM_PRESETS.some((p) => p.code === code);
}
