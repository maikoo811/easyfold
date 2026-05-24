# TASK-3.1 — AlphaFold 3 on Modal (weight mounting, inference)

**Status:** Done
**Branch:** `feat/af3-on-modal`
**Started:** 2026-05-24
**Completed:** 2026-05-24

## Context

Task 1.4 produced the AF3 input JSON builder (`easyfold.af3_input.build_af3_input`). Tasks 2.x produced the result UX (viewer, charts, LLM interpretation) that consumes AF3-shaped output. This task wires the inference itself: a Modal Function that takes the input JSON, runs AlphaFold 3 on a GPU in the user's own Modal account, and returns the predicted structure + confidence files. It is the missing link that lets the demo become a real prediction tool.

## Goal

Ship a deployable Modal Function that runs AF3 inference on a single-protein job and returns the parsed outputs, plus the documentation a user needs to provision their Modal account + AF3 weights and deploy it.

## Requirements

- `backend/easyfold/inference/af3.py` defines a `modal.App("easyfold-af3")` with one Function (`run_af3`) that accepts the dict produced by `build_af3_input` and returns parsed outputs.
- AF3 runs with `--norun_data_pipeline`; MSAs are fetched from ColabFold's mmseqs2 server upstream of the AF3 invocation so no MSA-database mount is required.
- Modal Image based on `nvidia/cuda:12.6.0-cudnn-devel-ubuntu22.04`, GPU set to `H100`, weights mounted read-only from a `easyfold-af3-weights` Modal Volume at `/weights`.
- Pure-Python helpers (`colabfold.py`, `input_prep.py`, `output_parse.py`) are testable in isolation without Modal or network.
- `modal/README.md` is a full provisioning guide (AF3 weight request → download → Modal setup → Volume upload → deploy → smoke test) and `modal/deploy.sh` wraps the deploy command.
- ADR 0002 records the design choices (Modal, H100, ColabFold MSAs, code-location-not-in-`/modal/`, subprocess to AF3 CLI).
- `modal` added to backend runtime deps (Task 3.3 needs it to invoke the Function from FastAPI).

## Out of scope

- Actually running inference end-to-end. The user doesn't have AF3 weights yet (Google approval pending per CLAUDE.md known constraints). The deploy + smoke-test commands are documented for the user to run after weights arrive.
- Caching MSAs across jobs. ColabFold caches server-side; we don't need our own layer at MVP scale.
- Output Volume for large artifacts. Single-job outputs (mmCIF + two JSONs) fit in Modal's response budget.
- Backend API for job submission. That's Task 3.3.
- Frontend integration. That's Task 3.4 (or part of 3.3).
- Multi-job batching, retries, queueing. Modal handles those at the platform level when 3.3 lands.

## Acceptance criteria

- [x] `uv run ruff check . && uv run ruff format --check .` clean (43 files).
- [x] `uv run mypy easyfold` strict, 0 issues across 24 source files (was 19).
- [x] `uv run pytest` green: **84 passed, 2 skipped** (was 61/2). +23 new tests in `tests/inference/`.
- [x] `uv run python -c "from easyfold.inference.af3 import app; print(app.name)"` → `easyfold-af3`. No network call, no Modal handshake.
- [x] `bash -n modal/deploy.sh` syntax OK; `chmod +x` applied.
- [x] `modal/README.md` ends with the smoke-test command + troubleshooting matrix; ADR 0002 covers Modal-vs-alternatives, ColabFold-vs-DB-mount, code-location, and CLI-vs-Python-API.

## Approach

- Plan mode: yes (5 new modules + tests + docs + dep + ADR).
- Files to reference:
  - `backend/easyfold/af3_input/builder.py` — what produces the input dict we consume.
  - `backend/easyfold/external/uniprot.py` — pattern for httpx clients + error handling (we mirror it in `colabfold.py`).
  - `docs/decisions/0001-af3-input-mapping.md` — ADR pattern.
- Existing patterns to reuse:
  - Pydantic models from `easyfold.af3_input` (we accept that shape).
  - `respx` mocking pattern from `tests/external/` for `tests/inference/test_colabfold.py`.
- New dependencies:
  - `modal` (~20 MB, pure Python) — runtime dep. Mandatory; this is the SDK that defines the Function.

## Implementation notes

- **Code in `backend/easyfold/inference/`, not `/modal/`.** Was tempting to colocate the Modal Function file with its deployment metadata, but a Python file inside a directory named `modal/` would shadow the PyPI `modal` package depending on sys.path / import-resolution order. Recorded the rationale in ADR 0002. `/modal/` mirrors `/demo/`: deploy artifacts only (README + shell script).
- **Pure-Python helpers split out** (`input_prep.py`, `colabfold.py`, `output_parse.py`) so the testable bits (command construction, JSON enrichment, output-dir walking) live free of `import modal` and `subprocess.run`. The Modal-decorated `run_af3` is ~30 lines orchestrating those helpers — keeps the surface that *can't* be tested in CI to a minimum.
- **ColabFold endpoint shapes are documented but unverified.** The submit/poll/download flow in `colabfold.py` matches the public API as of writing, but the project has changed wire formats historically. Documented in the docstring + README that the first real run with weights should verify the response shapes still match. Tests are respx-mocked, so they pass regardless — they verify *our* flow, not the upstream contract.
- **AF3 output layout is documented but unverified.** AF3 writes `<job_name_lower>/seed-<S>_sample-<I>/{model.cif,confidences.json,summary_confidences.json}` per the current docs. `output_parse.read_af3_outputs` uses `ranking_scores.csv` to pick the top sample, with a `seed-1_sample-0` fallback for older / differently-configured builds. Real test deferred until weights land.
- **`modal` SDK is now a backend runtime dep.** Required by `inference/af3.py` at import time; will also be required by Task 3.3 (backend FastAPI route invoking `run_af3.spawn(...)`). Small (~20 MB), pure Python — no install drama.
- **N818 per-file ignore added for `colabfold.py`** (`ColabFoldError`/`ColabFoldTimeout` exception class names without the `Error` suffix). Matches the existing pattern for `external/exceptions.py` and `af3_input/exceptions.py` — the project consistently prefers expressive exception names over the lint rule.
- **Skipped this session by design**: actual `modal deploy`, actual inference run, actual MSA fetch from ColabFold. These need user-side resources (Google-approved weights + Modal credits) and are scripted into `modal/README.md` § 4-5 for the user to run after weights arrive.

## Learnings

- [generalizable] **Inference-runner integrations split cleanly into "decorated entrypoint" + "pure helpers."** When the runtime can't be exercised in CI (cloud GPU, license-gated weights), keep the platform-specific (Modal/Beam/RunPod-decorated) function as small as possible — its only job is to orchestrate pure-Python helpers. Helpers get full unit-test coverage; the decorated function is verified only at import time. The same shape will apply to Boltz-2 on Modal (Task 3.2) and any future runner.
- [generalizable] **Document "first-real-run verification points" in the source.** Both the ColabFold client and the AF3 output parser embed external contracts that may change between when we write the code and when it's first exercised. Inline comments + a docstring note pointing at the README's troubleshooting matrix make it obvious where to look when "I deployed and it broke" happens months later.
- Project-specific: putting `import modal` inside a Python file in a directory called `/modal/` is a packaging foot-gun; pick a different directory name for source code that imports the SDK. Documented in ADR 0002 so future contributors don't try to "tidy up" by moving the file back.
