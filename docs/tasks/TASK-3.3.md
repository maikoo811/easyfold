# TASK-3.3 — Backend API for job submission and progress

**Status:** Done
**Branch:** `feat/jobs-api`
**Started:** 2026-05-24
**Completed:** 2026-05-24

## Context

Tasks 3.1 (AF3) and 3.2 (Boltz-2) shipped two Modal Functions that each accept a `PredictionJob` dict and return a unified `ModelResult` dict. Nothing calls them today: the frontend can render *fixture* predictions on `/demo/viewer` but can't run a real one.

This task wires the FastAPI backend and the Next.js frontend to the Modal Functions: `POST /api/v1/jobs` spawns a prediction; `GET /api/v1/jobs/{job_id}` polls it; the browser hits both from a new `/predict/[jobId]` page that renders the structure + confidence charts when the Modal Function returns.

## Goal

Ship the smallest stateless backend API + frontend wire-up that lets a user (with at least Boltz deployed) take a sequence on the EasyFold home page → click "Predict" → see their real prediction render.

## Requirements

- `POST /api/v1/jobs` accepts `{model: "alphafold3"|"boltz2", job: PredictionJob}` and returns `{job_id, model, status: "pending", result: null, error: null}`. `job_id` is Modal's `FunctionCall.object_id`.
- `GET /api/v1/jobs/{job_id}` returns the same shape with `status` in `{"running", "succeeded", "failed"}` and `result` / `error` populated when terminal.
- **Stateless backend** — no DB, no in-memory job map. State lives in Modal.
- **Lazy Modal Function lookup** — `modal.Function.from_name(...)` per request. Backend starts without either Function deployed; the route returns 502 with a "deploy this first" message if the user hasn't run `./modal/deploy.sh`.
- `easyfold.inference.dispatch` is the sole module outside Function definitions that imports `modal` — keeps the SDK boundary mockable.
- Error → HTTP mapping: `JobNotFound` → 404, `ModalFunctionNotDeployed` / `ModalDispatchError` → 502, `ValidationError` (FastAPI auto) → 422.
- Frontend: `SequenceResultCard` gets a "Predict structure" CTA (model select defaulting to Boltz-2). Clicking POSTs and navigates to `/predict/[jobId]?model=<m>`, which polls every 3s and renders `StructureViewer` + `ConfidenceCharts` + `InterpretationPanel` when ready.
- `StructureViewer` accepts a `cif` text prop (converts to Blob URL internally) in addition to its existing `url` prop.
- ADR 0004 records: `FunctionCall.object_id`-as-`job_id` rationale, lazy lookup, dispatch-module isolation, parallel Pydantic mirror of `ModelResult`, fixed-interval polling over SSE.

## Out of scope

- **Live deploy / actual round-trip from CI.** No Modal credits in CI; the user runs the smoke after merge. We test the route layer with Modal mocked at the boundary.
- **Job persistence beyond Modal's retention.** Modal's `FunctionCall` results expire after a few days; we accept this as MVP behavior. Documented in ADR 0004.
- **Output Volume for large artifacts.** Single-protein outputs (mmCIF + plddt list + PAE matrix) fit Modal's response budget. Long proteins with full PAE may approach the limit — we'll measure and migrate to a Volume in a future task.
- **Multi-user / auth / job ownership.** Out of scope per CLAUDE.md (no auth at MVP).
- **Ligand / modification / multi-chain UI.** That's Task 3.4. This task ships single-protein only on the frontend; the backend already accepts the full `PredictionJob` shape.
- **Cancellation / "abort job" route.** Modal supports it (`FunctionCall.cancel()`); not needed at MVP single-user scale.

## Acceptance criteria

- [x] `uv run ruff check . && uv run ruff format --check .` clean (60 files).
- [x] `uv run mypy easyfold` strict, 0 issues across 34 source files (was 31).
- [x] `uv run pytest` green: **145 passed, 2 skipped** (was 120/2). +25 tests across `tests/api/test_jobs.py` (13) and `tests/inference/test_dispatch.py` (12).
- [x] `uv run uvicorn easyfold.main:app` — `POST /api/v1/jobs` without deployed Functions returns 502 with the actionable "Run `./modal/deploy.sh boltz` first" message; `GET /api/v1/jobs/fc-doesnotexist` returns 404. Verified via `curl`.
- [x] `pnpm typecheck && pnpm lint && pnpm build` (full-stack target) green.
- [x] `pnpm build:demo` (static target) green — `/predict/[jobId]` builds a single placeholder static page (`/predict/static-build-placeholder`); the demo doesn't need a real predict route.
- [x] ADR 0004 covers all decisions including the `FunctionCall.object_id`-as-`job_id` rationale, lazy lookup, dispatch-module isolation, Pydantic mirror, polling strategy. ARCHITECTURE.md has the Jobs API section.

## Approach

- Plan mode: yes (multi-file frontend + backend + ADR).
- Files to reference:
  - `backend/easyfold/api/v1/sequences.py` — existing route pattern.
  - `backend/tests/api/test_sequences.py` — `ASGITransport` test pattern.
  - `backend/easyfold/main.py` — existing exception-handler pattern.
  - `backend/easyfold/inference/result.py` — `ModelResult` + `ModelName`.
  - `backend/easyfold/inference/{af3,boltz}.py` — Function names + App names to look up.
  - `frontend/components/sequence-input/sequence-result-card.tsx` — embedding point for `PredictCta`.
  - `frontend/components/structure-viewer/structure-viewer.tsx` — `url` → also `cif` prop.
  - `frontend/components/result-viewer/result-viewer.tsx` — composes ConfidenceCharts + InterpretationPanel; pattern to mirror in `PredictionResult`.
  - `frontend/lib/api/client.ts` — `apiFetch` + `ApiRequestError` to reuse.
- Existing patterns to reuse:
  - `apiFetch<T>` in `frontend/lib/api/client.ts` for both `createJob` and `getJob`.
  - FastAPI route layout (one file per resource under `easyfold/api/v1/`).
  - Pydantic `BaseModel` for request/response; `model_validate(...)` for ModelResult bridging.
- New dependencies: none (Modal SDK + Pydantic already present).

## Implementation notes

- **Modal's `Function.from_name` is lazy.** The plan assumed `from_name` raises `NotFoundError` synchronously when the App/Function isn't deployed. Actual behavior: `from_name` returns a reference unconditionally, and the "App not found" error surfaces from `.spawn()` (or any later call) as a generic `modal.exception.Error` with the message `"Lookup failed for Function 'run_boltz' from the 'easyfold-boltz' app: App 'easyfold-boltz' not found in environment 'main'."`. Same shape with `FunctionCall.from_id` for unknown call IDs: generic `Error` containing `"No Function Call with ID 'fc-xxx' found."`. Added a `_is_not_found_error(exc)` helper that matches on message and re-raises as the specific typed exception (`ModalFunctionNotDeployed` / `JobNotFound`). Both the typed-exception path and the message-match path are tested. Discovered via live `curl` after the initial implementation passed unit tests but returned a generic 502 instead of the actionable error.
- **`generateStaticParams` is required even for an empty route in `output: "export"`.** Returning `[]` causes Next.js 16 to fail the static build with `Page "/predict/[jobId]" is missing "generateStaticParams()"`. The empty array is interpreted as "function missing." Fix: return one placeholder param (`{ jobId: "static-build-placeholder" }`) so the route emits at least one HTML file. The placeholder is unreachable from the real flow — a user always lands at `/predict/[fresh-job-id]` from the POST redirect.
- **`useSearchParams` requires a `<Suspense>` boundary during static export.** Next.js's CSR bailout demands it for pages that use it. The page is split into a server-shell (`page.tsx` with `generateStaticParams` + `Suspense` wrapper) and a client subcomponent (`predict-client.tsx`). The server shell can't be `'use client'` because `generateStaticParams` must be server-evaluated.
- **Dispatch module is the only file outside Function definitions that imports `modal`.** Route tests mock `easyfold.api.v1.jobs.spawn_prediction` / `.poll_prediction` directly via `monkeypatch.setattr`; dispatch tests mock `modal.Function.from_name` / `modal.FunctionCall.from_id` directly. Two clean seams, both exercisable in CI without Modal credits. Pattern is worth keeping for any future runner (RunPod, Beam) — wrap the SDK in one file.
- **`ModelResult` lives twice on purpose.** Dataclass inside the Modal container (`inference/result.py`, no Pydantic dep needed in the boltz image); Pydantic mirror in `api/models.py` for OpenAPI docs and request/response validation. Bridge: `ModelResultModel.model_validate(model_result.to_dict())`. The "duplicate type" is the price of clean OpenAPI generation vs the boltz container size.
- **N818 per-file ignore added for `inference/dispatch.py`** (`JobNotFound`, `ModalFunctionNotDeployed`, `ModalDispatchError` without `Error` suffix where it would read awkwardly). Matches the existing pattern across `external/exceptions.py`, `af3_input/exceptions.py`, `boltz_input/exceptions.py`, `inference/colabfold.py`. (`ModalDispatchError` does carry the suffix — kept the per-file ignore for the two without.)
- **The GET response's `model` field is `null` by design.** Modal's `FunctionCall` doesn't expose the originating App through the SDK. The frontend keeps the model in URL state on `/predict/[jobId]?model=…`. Documented in `JobStatusResponse.model`'s docstring and in ADR 0004 § Open.
- **Skipped this session by design**: actual end-to-end inference. Requires the user to have deployed at least the Boltz Function (`./modal/deploy.sh boltz`) — easy now that 3.2 ships the script. The whole stack (frontend POST → backend spawn → polling → render) is wired and tested with mocks; the user's first real-world run will be the first real inference EasyFold has ever done.

### Post-merge validation (real run, 2026-05-24)

The first real end-to-end run for p53 (P04637, 393 residues) on Boltz-2 surfaced **eight** distinct issues that CI couldn't catch — none in code logic, all in image/runtime configuration and untested-contract assumptions. Patches were bundled into a follow-up PR (`fix/modal-deploy-and-validation-polish`):

1. `add_local_python_source("easyfold")` missing from both Modal images → container `ModuleNotFoundError: easyfold` at startup.
2. Easyfold runtime deps (`pydantic`, `httpx`, `numpy`, `pyyaml`) not in container image — Boltz/AF3 don't transitively cover them. Walk-the-import-graph means every dep must be explicit.
3. File name `inference/boltz.py` shadowed the `boltz` PyPI package via Modal's `/root/<basename>.py` layout → `from boltz.main import cli` crashed with `'boltz' is not a package`. Renamed to `boltz_app.py`. Same packaging foot-gun class ADR 0002 warned about for directory names.
4. `cuequivariance_torch` + `cuequivariance_ops_torch` missing → Boltz's optimized triangular-attention kernels crash. Used `--no_kernels` flag instead of fighting CUDA-native package install. Quality trade-off noted in ADR 0003.
5. Boltz uses YAML input file's stem as output directory key → our parser looked at `boltz_results_<job.name>/` but output went to `boltz_results_input/`. Fix: name input `{job.name}.yaml`.
6. Boltz writes pLDDT in 0-1 range, not 0-100 (AF3 convention). Parser scales when `max <= 1.0`.
7. Mol* default UI inflates the viewer to fullscreen with State Tree + Structure Tools side panels. Passed explicit `layoutShowControls: false` etc. options to `Viewer.create()` to constrain to the contained 520px box.
8. Backend CORS default `http://localhost:3000` didn't include `:3001`, which Next.js dev falls back to when 3000 is busy. Default now includes both.

Plus async fixes: `dispatch.spawn_prediction` / `poll_prediction` made `async def` using Modal's `.aio` API to avoid blocking the FastAPI event loop. Tests updated to use `AsyncMock`.

After patches, p53 prediction completes in ~20s wall time (cache-warm). LLM interpretation (Anthropic Claude API, BYOK) returned biologically informed analysis: correctly identified p53's intrinsically disordered N-terminal transactivation domain (~1-100) and C-terminal regulatory domain (~360-393), recommended PDB 2OCJ as an experimental reference, and proposed NMR/SAXS/HDX-MS over crystallography for full-length protein. **Differentiation thesis validated end-to-end.**

## Learnings

- [generalizable] **Cloud runners' lazy SDKs surface errors at use-time, not lookup-time.** Modal's `Function.from_name` and `FunctionCall.from_id` return references without round-tripping to the server; "not found" surfaces on the first real operation (`.spawn()`, `.get()`) — and usually as a generic exception with a substring in the message, not as the typed `NotFoundError` the docs suggest. When mapping cloud-runner errors to API responses, plan for **two** signals: the typed exception **and** a fallback that pattern-matches the error message. Test both paths.
- [generalizable] **Cloud-runner call IDs make excellent job IDs.** When state can live entirely inside the runner (Modal, Step Functions, Temporal, …), use the runner's call ID as your public identifier rather than minting your own UUID + storing a mapping. Stateless backend, no DB, jobs survive process restarts, all existing runner tooling (dashboards, logs, cancellation APIs) speaks the same ID. The only cost is leaking the runner choice in the URL — acceptable when the runner is already part of the user's mental model (e.g. BYOC deploys).
- [generalizable] **`output: "export"` + dynamic routes need one placeholder param + a Suspense boundary.** Empty `generateStaticParams` fails the build; the fix is a single sentinel param that emits one unreachable static page. Any client component using `useSearchParams`/`usePathname` also needs `<Suspense>` during pre-render. Both points are easy to miss until `pnpm build:demo` fails; remember them when designing routes that exist on both targets.
- Project-specific: when a route layer needs to talk to the Modal SDK, put the SDK calls in a separate `dispatch.py` (or equivalent) module — one place to mock, one place to migrate when the SDK changes, no `modal.*` imports in route files. Documented in ADR 0004; pattern will repeat if/when we add a self-host fallback (Celery + Redis).
