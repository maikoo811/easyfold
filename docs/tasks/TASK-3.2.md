# TASK-3.2 — Boltz-2 on Modal (MIT-licensed alternative)

**Status:** Done
**Branch:** `feat/boltz-on-modal`
**Started:** 2026-05-24
**Completed:** 2026-05-24

## Context

Task 3.1 shipped AlphaFold 3 as a Modal Function (`easyfold-af3`). AF3 weights are CC-BY-NC-SA and Google-gated (2–3 business-day approval). Multi-model support is a stated differentiator — **Boltz-2** is MIT-licensed and ships freely, so it's the path that "just works" for commercial users and for anyone who can't wait on AF3 approval.

This task adds Boltz-2 as a **sibling** Modal Function (`easyfold-boltz`) consuming the same `PredictionJob` input that AF3 already accepts.

## Goal

Ship a deployable Modal Function that runs Boltz-2 inference on a single-protein job, plus a unified `ModelResult` shape both AF3 and Boltz produce, plus the docs to deploy + smoke-test it.

## Requirements

- `backend/easyfold/inference/boltz.py` defines `modal.App("easyfold-boltz")` with one Function (`run_boltz`) accepting a `PredictionJob.model_dump()` dict.
- Boltz runs with `--use_msa_server` (its built-in ColabFold integration); no separate MSA helper needed.
- `easyfold-boltz-cache` Modal Volume mounted at `/root/.boltz` persists weight downloads across runs. `create_if_missing=True` so the user doesn't need a manual provisioning step.
- `backend/easyfold/boltz_input/` mirrors `af3_input/` layout: `builder.py` (YAML), `validator.py`, `exceptions.py`, `__init__.py`. Reuses `PredictionJob` from `af3_input.models`.
- New `backend/easyfold/inference/result.py` defines `ModelResult` (unified shape). `output_parse.read_af3_outputs` refactored to return `ModelResult`; `AF3Outputs` removed.
- New `backend/easyfold/inference/boltz_output.py` parses Boltz output dir into `ModelResult`.
- Pure-Python helpers fully unit-tested (no Modal, no network). ~21 new tests; existing `test_output_parse.py` updated for the refactor.
- `modal/README.md` adds a Boltz section (provisioning + deploy + smoke + cost). `modal/deploy.sh` takes optional `af3`|`boltz` arg (default `af3` for back-compat).
- ADR 0003 records the design choices (sibling App, YAML, `--use_msa_server`, `ModelResult` introduction).
- `pyyaml` + `numpy` added to backend runtime deps; `types-pyyaml` to dev deps.

## Out of scope

- Live deployment / actual inference. User runs `./modal/deploy.sh boltz` + `modal run` on their own time (no Modal credits burned in CI). Smoke command scripted in `modal/README.md`.
- Protein modifications in Boltz YAML. UI doesn't expose PTMs yet (Task 3.4); we log + ignore them with a documented warning.
- Cross-model result comparison (AF3 vs Boltz on the same job). Different score scales; will revisit after 3.3 ships the API.
- Cache Volume cleanup. Modal has no eviction; users prune manually.
- Backend API for job submission (3.3) and frontend integration (3.4).

## Acceptance criteria

- [x] `uv run ruff check . && uv run ruff format --check .` clean (55 files).
- [x] `uv run mypy easyfold` strict, 0 issues across 31 source files (was 24).
- [x] `uv run pytest` green: **120 passed, 2 skipped** (was 84/2). +36 new tests across `tests/boltz_input/` (24) and `tests/inference/` (12 — split between `test_result.py`, `test_boltz_output.py`, and PAE-extraction additions to `test_output_parse.py`).
- [x] `uv run python -c "from easyfold.inference.boltz import app; print(app.name)"` → `easyfold-boltz`. No network call.
- [x] `uv run python -c "from easyfold.inference.af3 import app; print(app.name)"` → `easyfold-af3`. Refactor didn't break AF3 import.
- [x] `bash -n modal/deploy.sh` clean; `./modal/deploy.sh xyz` prints `Usage: ... [af3|boltz]` and exits 1.
- [x] `modal/README.md` adds a Boltz section after the AF3 one, with deploy + smoke + cost note + troubleshooting matrix. Top of file restructured to disambiguate which section applies to which model.
- [x] ADR 0003 covers: sibling App, YAML, `--use_msa_server`, cache Volume `create_if_missing=True`, `ModelResult` rationale, refactor-now vs migrate-later, open questions (PTM emission, cache lifecycle, cross-model score comparison, per-residue vs per-token pLDDT).

## Approach

- Plan mode: yes (4 new modules + boltz_input package + tests + refactor + docs + ADR).
- Files to reference:
  - `backend/easyfold/inference/af3.py` — sibling pattern to mirror.
  - `backend/easyfold/inference/output_parse.py` — refactoring target.
  - `backend/easyfold/af3_input/{builder,validator,models}.py` — mirror layout.
  - `backend/tests/af3_input/` and `backend/tests/inference/` — test patterns.
- Existing patterns to reuse:
  - `PredictionJob` + `ProteinSpec` + `LigandSpec` from `af3_input.models` (no duplication).
  - `excel_chain_id` from `af3_input._chain_ids` — Boltz uses the same chain-ID scheme.
  - Modal Function structure from `inference/af3.py` (App + Image + Volume + decorated function + local entrypoint).
- New dependencies:
  - `pyyaml` (runtime) — emits Boltz YAML.
  - `numpy` (runtime) — reads Boltz `.npz` outputs in the pure-Python parser. Likely already transitive via httpx/pydantic but pin explicit.
  - `types-pyyaml` (dev) — mypy types for pyyaml.

## Implementation notes

- **Sibling Modal App over multi-Function App.** Considered colocating `run_af3` and `run_boltz` in one `modal.App`. Rejected because the images diverge sharply (JAX/AF3-source vs PyTorch/boltz-PyPI) and the dep churn cadences are decoupled — pinning JAX shouldn't force a Boltz redeploy, and the boltz-PyPI release stream is faster than AF3's. Two Apps also let users deploy one without the other (`./modal/deploy.sh boltz` works even if they haven't requested AF3 weights yet).
- **`ModelResult` introduced in this task, not deferred.** Originally considered shipping Boltz with its own `BoltzOutputs` and unifying later. Decided against it — Task 3.3's API will dispatch by model, so the unified shape was needed there *anyway*; doing the refactor at the second model is one rewrite (and one matching test rewrite) instead of N model-specific shapes by 3.3 time. `AF3Outputs` deletion was a 30-line diff that only touched `output_parse.py` + its tests; no callers downstream had to change because the Modal Function still calls `.to_dict()` (same call site, different class).
- **`extras` keeps model-specific raw JSON addressable.** The LLM interpretation pass (Task 2.3) summarizes per-token confidence into the prompt. Stripping model-specific fields would lose that detail. Putting them under `ModelResult.extras` keeps the unified surface clean while preserving the raw signal for callers that want it.
- **Pure-Python parsers needed `numpy` outside the container.** Boltz writes per-residue pLDDT and the PAE matrix as `.npz` files. We unit-test the parser in CI (no Modal container available), so `numpy` is now a backend runtime dep — not just a transitive one in the image. ~15 MB; common enough to be uncontroversial.
- **Boltz output JSON has key drift across releases.** Parser accepts both `iptm`/`complex_iptm` and `ptm`/`complex_ptm`. Documented in the docstring + `modal/README.md` § Troubleshooting that the first real smoke test should confirm which key set the user's pinned Boltz version emits.
- **`cache_volume.commit()` after `subprocess.run`.** Without the explicit commit, Boltz's first-run weight download wouldn't survive function termination. `create_if_missing=True` (vs AF3's strict `False`) means the user doesn't need a manual provisioning step — the deploy self-creates the cache Volume on first push.
- **Boltz YAML expands homo-multimers to one entry per chain.** AF3 collapses `copies=2` into `"id": ["A","B"]`; Boltz wants two `protein:` entries. The builder handles the difference; validator + test enforce it (`test_homo_dimer_emits_one_entry_per_chain`, `test_rejects_list_chain_id`).
- **Protein modifications dropped at MVP for Boltz.** Boltz expresses PTMs as inline CCD codes in the sequence; the UI doesn't expose PTMs yet (Task 3.4 will). Builder silently ignores `ProteinSpec.modifications` with a docstring + test (`test_protein_modifications_are_silently_ignored`) so future contributors know it's a known gap, not a bug.
- **N818 per-file ignore added for `boltz_input/exceptions.py`** (`InvalidBoltzInput` without `Error` suffix). Matches the existing pattern for `af3_input/exceptions.py`, `external/exceptions.py`, `inference/colabfold.py` — the project consistently prefers expressive exception names over the lint rule.
- **Skipped this session by design**: actual `modal deploy`, actual Boltz inference run. Documented in `modal/README.md` § Boltz-2 § 4 for the user to run after merge. Boltz needs no Google approval, so this *will* be the first real end-to-end inference EasyFold runs — meaning it also doubles as a first-real-test of the `ModelResult` shape against live data.

## Learnings

- [generalizable] **Unify model-result shapes at model #2, not model #N.** When introducing a second adapter behind a planned-multi-model surface, refactor the shared shape *as part of the second adapter's commit*, not as a follow-up. The first refactor is small (single-caller dataclass swap); the N-th is large (every consumer already depends on the per-model shape). Pair the refactor with an "escape-hatch" field (`extras` here) so the unified shape doesn't lose model-specific detail.
- [generalizable] **`create_if_missing` is a deploy-UX dial for Modal Volumes.** Strict (`False`) when you want the deploy to fail loudly if the user forgot a manual provisioning step (AF3 weights, license-gated assets). Permissive (`True`) when the resource self-populates on first run and the user has no pre-deploy work to do (Boltz cache). Document the choice in the source comment + the deploy README.
- [generalizable] **When wrapping an external CLI whose output schema drifts, accept aliases at the parser boundary.** Boltz's confidence JSON has used both `iptm` and `complex_iptm` across versions; parsing both with `summary.get("iptm", summary.get("complex_iptm"))` costs one line and makes the parser robust across pinned-version drift. Document which set to prefer after the first real run lands — until then, accept any.
- Project-specific: when a sibling Modal Function uses a different base image and Python deps (PyTorch vs JAX), keep them in **separate Modal Apps**, not separate Functions in one App. Cleaner deploy boundaries, independent image rebuilds, users can adopt one without adopting the other. Documented in ADR 0003.
- Project-specific: Boltz YAML chain expansion differs from AF3 input JSON (one entry per chain vs `"id": [...]` lists). The shared `PredictionJob` model still works, but the builders look different. Tests in `tests/boltz_input/test_builder.py::test_homo_dimer_emits_one_entry_per_chain` and `test_rejects_list_chain_id` lock the difference in.
