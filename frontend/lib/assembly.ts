/**
 * Frontend "draft" types for a prediction assembly, plus a one-way
 * converter to the API's `JobCreateBody` shape.
 *
 * The backend Pydantic models (`backend/easyfold/af3_input/models.py`)
 * are the canonical schema. These types are intentionally lighter — they
 * carry React-keying ids, display metadata (organism, source), and UI
 * state (ligand input mode), none of which the API needs.
 *
 * The conversion `toJobBody(state)` is lossy by design: ids, organism,
 * mode flags are stripped; only the fields the backend expects make it
 * through. Validation errors (no proteins, modification out of range,
 * ligand with neither SMILES nor CCD) surface as `{ error }` so the
 * caller can render an inline message before POST.
 */

import type { FetchedSequence, JobCreateBody, ModelName } from "@/lib/api";

export interface ModificationDraft {
  id: string;
  ptmType: string;
  ptmPosition: number;
}

export interface ProteinDraft {
  id: string;
  source: FetchedSequence["source"];
  sourceId: string | null;
  name: string;
  description: string | null;
  sequence: string;
  organism: string | null;
  copies: number;
  modifications: ModificationDraft[];
}

export type LigandMode = "smiles" | "ccd";

export interface LigandDraft {
  id: string;
  mode: LigandMode;
  smiles: string;
  ccd: string[];
  copies: number;
}

export interface AssemblyState {
  jobName: string;
  proteins: ProteinDraft[];
  ligands: LigandDraft[];
}

export const EMPTY_ASSEMBLY: AssemblyState = {
  jobName: "",
  proteins: [],
  ligands: [],
};

/** Default display name from the current proteins. */
export function defaultJobName(proteins: ProteinDraft[]): string {
  if (proteins.length === 0) return "";
  const first = proteins[0].sourceId ?? proteins[0].name ?? "job";
  if (proteins.length === 1 && proteins[0].copies === 1 && proteins[0].modifications.length === 0) {
    return first;
  }
  return `${first}_complex`;
}

export function newProteinDraft(seq: FetchedSequence): ProteinDraft {
  return {
    id: cryptoId(),
    source: seq.source,
    sourceId: seq.source === "fasta" ? null : seq.id,
    name: seq.id,
    description: seq.description,
    sequence: seq.sequence,
    organism: seq.organism,
    copies: 1,
    modifications: [],
  };
}

export function newModificationDraft(): ModificationDraft {
  return { id: cryptoId(), ptmType: "PHOSPHO", ptmPosition: 1 };
}

export function newLigandDraft(mode: LigandMode): LigandDraft {
  return { id: cryptoId(), mode, smiles: "", ccd: [], copies: 1 };
}

/** Boltz silently drops modifications; surface in the UI as a disabled state. */
export function assemblyHasModifications(state: AssemblyState): boolean {
  return state.proteins.some((p) => p.modifications.length > 0);
}

export type ToJobBodyResult =
  | { ok: true; body: JobCreateBody }
  | { ok: false; error: string };

/** One-way: AssemblyState → JobCreateBody. Lossy by design. */
export function toJobBody(state: AssemblyState, model: ModelName): ToJobBodyResult {
  if (state.proteins.length === 0) {
    return { ok: false, error: "Add at least one protein before predicting." };
  }

  const name = state.jobName.trim() || defaultJobName(state.proteins);
  if (!name) {
    return { ok: false, error: "Job needs a name." };
  }

  const proteins: JobCreateBody["job"]["proteins"] = [];
  for (const p of state.proteins) {
    if (!p.sequence) {
      return { ok: false, error: "A protein with no sequence — remove it before predicting." };
    }
    for (const mod of p.modifications) {
      if (!mod.ptmType.trim()) {
        return { ok: false, error: `Modification on ${p.name} is missing a PTM code.` };
      }
      if (mod.ptmPosition < 1 || mod.ptmPosition > p.sequence.length) {
        return {
          ok: false,
          error: `Modification on ${p.name} at position ${mod.ptmPosition} is outside the sequence (1-${p.sequence.length}).`,
        };
      }
    }
    proteins.push({
      sequence: p.sequence,
      copies: p.copies,
      modifications: p.modifications.map((m) => ({
        ptm_type: m.ptmType.trim(),
        ptm_position: m.ptmPosition,
      })),
    });
  }

  const ligands: NonNullable<JobCreateBody["job"]["ligands"]> = [];
  for (const l of state.ligands) {
    if (l.mode === "smiles") {
      const smiles = l.smiles.trim();
      if (!smiles) {
        return { ok: false, error: "A ligand is missing its SMILES string." };
      }
      ligands.push({ smiles, copies: l.copies });
    } else {
      const codes = l.ccd.map((c) => c.trim()).filter(Boolean);
      if (codes.length === 0) {
        return { ok: false, error: "A ligand is missing its CCD codes." };
      }
      ligands.push({ ccd_codes: codes, copies: l.copies });
    }
  }

  return {
    ok: true,
    body: {
      model,
      job: {
        name,
        proteins,
        ...(ligands.length > 0 ? { ligands } : {}),
        model_seeds: [1],
      },
    },
  };
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
