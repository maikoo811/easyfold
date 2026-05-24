# ADR 0003 — Boltz-2 on Modal and the unified `ModelResult` shape

## Status

Accepted — 2026-05-24.

## Context

EasyFold's multi-model story (CLAUDE.md: "AF3 and Boltz-2 are swappable behind the same UI") needs more than a UI toggle — it needs a second working backend predictor and a single result shape that the frontend, the Task 3.3 backend API, and the LLM interpretation prompt can all consume without per-model branching.

AlphaFold 3 (Task 3.1) ships, but its weights are CC-BY-NC-SA and Google-gated (2–3 business-day approval). For commercial workflows or users who can't wait for approval, **Boltz-2** (MIT-licensed, weights distributed via `pip install boltz`) is the path that works on day one. Adding it now also gives us the first end-to-end inference EasyFold can run (we still don't have AF3 weights in hand).

The cross-model contract question matters most now: introducing a second result shape would mean either Task 3.3 dispatches on model name everywhere, or we migrate later from a per-model shape to a unified one. The second model is the cheapest moment to unify.

## Decision

Ship Boltz-2 as a **sibling Modal App** to AF3 — separate App, separate Image, separate Volume — and **introduce a unified `ModelResult` dataclass that both AF3 and Boltz Functions return**. Refactor 3.1's `AF3Outputs` away as part of this task.

### Key sub-decisions

1. **Sibling Modal App, not a multi-Function App.** `modal.App("easyfold-boltz")` lives alongside `easyfold-af3`. Their images diverge (JAX 0.4.34 vs PyTorch 2.4) and their dep-churn cadences diverge (AF3 source-built from GitHub, Boltz pinned via `boltz==2.*` on PyPI). Independent Apps mean a deploy/break/upgrade of one never affects the other. Users can deploy one without the other (`./modal/deploy.sh af3` or `./modal/deploy.sh boltz`).

2. **YAML for Boltz input, always.** Boltz CLI accepts both FASTA and YAML. We always emit YAML because (a) Boltz's docs use YAML for non-trivial examples, (b) YAML supports ligands and modifications cleanly without an inline mini-language, and (c) one format means one builder + one validator + one set of tests. We also reuse AF3's `excel_chain_id` so a given protein has stable chain identifiers across both models — useful for cross-model comparison later.

3. **`--use_msa_server` instead of reusing `colabfold.py`.** Boltz CLI ships its own ColabFold integration; passing `--use_msa_server` delegates the MSA fetch to it. Reusing our `colabfold.py` would mean writing A3M files to disk ahead of time + maintaining two ColabFold client code paths. `colabfold.py` stays as-is — it's still the right approach for AF3 because AF3's data pipeline mounts 200 GB DBs we want to skip.

4. **No user-provisioned weights Volume for Boltz; `easyfold-boltz-cache` self-creates.** Boltz downloads weights lazily on first run. We mount `easyfold-boltz-cache` at `/root/.boltz` (Boltz's default cache path) with `create_if_missing=True` so the first deploy works without any manual `modal volume create` step. `cache_volume.commit()` after each run persists the download. AF3 stays strict (`create_if_missing=False`) because we want deploy to fail loudly if the user forgot to upload Google-approved weights — Boltz has no such pre-condition.

5. **Subprocess to the `boltz` CLI**, mirroring the AF3 decision (ADR 0002). The CLI is the stable surface; the Python API moves more between releases. One `subprocess.run([...])` and a per-release flag-list re-pin.

6. **Unified `ModelResult` shape, introduced now.** A single frozen dataclass (`inference/result.py`) with model-agnostic fields: `model`, `name`, `cif`, `plddt`, `pae`, `iptm`, `ptm`, `ranking_score`, `sample_dir_name`, `extras`. Model-specific raw confidence JSON lives under `extras` for callers (the LLM interpretation pass) that need per-token signal. Both parsers (`output_parse.read_af3_outputs`, `boltz_output.read_boltz_outputs`) produce it. The Function return type is `ModelResult.to_dict()` — a plain JSON-safe dict.

7. **Refactor `AF3Outputs` away.** Task 3.1's parser returned a model-specific dataclass; that dataclass goes away in this commit. The refactor is small (one file rewrite + test rewrite) and only its own callers know about it (the Modal Function still calls `.to_dict()` — same call site, different class). Deferring would mean either two shapes coexisting in 3.3 or migrating 3.3 later — strictly more work.

## Consequences

**Positive**

- Two predictors, one input model (`PredictionJob`), one output shape (`ModelResult`). The eventual `POST /api/v1/jobs?model=alphafold3|boltz2` route (Task 3.3) dispatches at one place and never branches downstream.
- Boltz unblocks the first real end-to-end run — we can verify the whole stack works without waiting on AF3 weight approval.
- Boltz also unblocks commercial use, addressing the AF3 license gap (CC-BY-NC-SA).
- The `extras` escape hatch keeps model-specific raw data available without polluting the unified schema. The LLM interpretation pass can keep grounding its answers in per-token detail.

**Negative**

- Two images to maintain. CUDA / PyTorch / JAX pins drift independently; one model breaking its image build doesn't block the other, but it's still two surfaces to watch.
- Boltz's output JSON key names have changed between releases (we accept both `iptm`/`complex_iptm`, `ptm`/`complex_ptm`). The first real smoke test will tell us which to prefer; until then the parser is documented as "verify on first real end-to-end run."
- `numpy` is now a backend runtime dep so the pure-Python `boltz_output` parser can read `.npz` files in CI without a container. Small (~15 MB), already present transitively in many environments; explicit pin makes the intent clear.

**Open**

- **Protein modifications in Boltz YAML.** Boltz expresses PTMs as CCD codes inline in the sequence string. The UI doesn't expose PTMs yet (Task 3.4); the builder silently drops them today with a docstring note. Revisit when 3.4 lands.
- **Cache Volume lifecycle.** Modal has no eviction policy; the `easyfold-boltz-cache` Volume grows until users prune it manually. Documented in `modal/README.md` § Boltz. If it becomes a real problem we'll add a periodic cleanup script.
- **Cross-model score comparison.** AF3 `ranking_score` and Boltz `confidence_score` aren't on the same scale. We surface the `model` field on `ModelResult` so the frontend can label charts honestly; equating the two is out of scope.
- **Per-residue vs per-token pLDDT.** AF3 writes per-token (`atom_plddts`); Boltz writes per-residue. We extract `plddt` (per-residue) when present, otherwise fall back to `atom_plddts`. For protein-only jobs the difference is irrelevant; multi-entity jobs need a downstream decision about how to render the chart, which we'll make in 3.3/3.4.
