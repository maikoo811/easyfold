export type ModelName = "alphafold3" | "boltz2";

export type JobStatusName = "pending" | "running" | "succeeded" | "failed";

/** Unified per-prediction result. Mirrors `easyfold.inference.result.ModelResult`. */
export interface ModelResult {
  model: ModelName;
  name: string;
  /** mmCIF text of the predicted structure. */
  cif: string;
  /** Per-residue pLDDT, 0-100. */
  plddt: number[];
  /** NxN PAE matrix in Å, or `null` when omitted by the model. */
  pae: number[][] | null;
  /** Interface pTM, 0-1; `null` for single-chain jobs. */
  iptm: number | null;
  /** Predicted TM-score, 0-1. */
  ptm: number | null;
  /** Model's self-ranking score, 0-1. */
  ranking_score: number | null;
  /** Per-sample subdirectory name on disk (e.g. "seed-1_sample-0"). */
  sample_dir_name: string;
  /** Model-specific raw confidence JSON, preserved for the LLM interpretation pass. */
  extras: Record<string, unknown>;
}

/** Shared shape returned by `POST /api/v1/jobs` and `GET /api/v1/jobs/{id}`.
 *
 * Note: `model` is `null` on `GET` responses — Modal's `FunctionCall` doesn't
 * surface the originating App through the SDK. The frontend keeps the model
 * in URL state on `/predict/[jobId]?model=…` to avoid the reverse lookup.
 */
export interface JobStatus {
  job_id: string;
  model: ModelName | null;
  status: JobStatusName;
  result: ModelResult | null;
  error: string | null;
}

export interface JobCreateBodyModification {
  ptm_type: string;
  ptm_position: number;
}

/** POST /api/v1/jobs request body. Matches `easyfold.api.models.JobCreateRequest`. */
export interface JobCreateBody {
  model: ModelName;
  job: {
    name: string;
    proteins: {
      sequence: string;
      copies?: number;
      modifications?: JobCreateBodyModification[];
    }[];
    ligands?: { smiles?: string; ccd_codes?: string[]; copies?: number }[];
    model_seeds?: number[];
  };
}
