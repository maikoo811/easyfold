# ADR 0004 — Jobs API: stateless backend with Modal `FunctionCall.object_id` as the job_id

## Status

Accepted — 2026-05-24.

## Context

Tasks 3.1 and 3.2 shipped two deployable Modal Functions (`easyfold-af3`, `easyfold-boltz`) that each accept a `PredictionJob` and return a unified `ModelResult`. Nothing called them. The frontend could render *fixture* structures on `/demo/viewer` but had no way to kick off a real prediction.

We need a backend API that:

1. Accepts a job submission from the browser and returns an identifier the browser can poll.
2. Returns status + result/error for an identifier.
3. Stays trivial to run for a solo researcher's `uvicorn` install — no DB to provision, no migration step, no separate worker process. The whole point of zero-hosting OSS is that running the backend is one command.
4. Tolerates the backend being restarted while a long-running prediction is in flight.

Modal runs the Function in the user's own workspace, returns a `FunctionCall` object on `spawn()`, and exposes `FunctionCall.from_id(object_id)` to reconstruct it later. The `object_id` is a stable opaque string. This is a natural ID — using it directly eliminates a layer of indirection.

## Decision

**The backend is stateless.** `POST /api/v1/jobs` calls `func.spawn(job_dict)` and returns the resulting `FunctionCall.object_id` as the `job_id`. `GET /api/v1/jobs/{job_id}` calls `modal.FunctionCall.from_id(job_id).get(timeout=0)` and maps the outcome to a status + optional result/error. The backend stores nothing; all job state lives in Modal.

### Key sub-decisions

1. **`FunctionCall.object_id` is the public `job_id`.** Opaque string (`fc-abc123…`). The browser keeps it in the URL (`/predict/[jobId]`) — Modal-internal format is irrelevant to UX. Cost: ID leaks the cloud runner. Benefit: no DB, no UUID generation, no mapping table to keep coherent across restarts. The cost is acceptable because (a) EasyFold's "BYOC Modal" stance already exposes Modal as the runtime, and (b) the ID format is not user-facing in any meaningful way.

2. **Lazy `Function.from_name()` per request.** Looking up the Modal Function happens inside the `POST` handler, not at FastAPI startup. The backend boots even when neither AF3 nor Boltz is deployed in the user's workspace — useful during local dev when you're iterating on the frontend without a full Modal setup. The price: one extra Modal API call per `POST` (sub-100ms). The trade-off matters because the failure mode of "deploy this first" is the most common error for first-time users; surfacing it as a clean 502 with the exact `./modal/deploy.sh boltz` invocation is more helpful than crashing at startup.

3. **Dispatch lives in its own module (`easyfold.inference.dispatch`).** This is the **only** file outside the Function definitions (`inference/af3.py`, `inference/boltz.py`) that imports `modal`. The route layer (`api/v1/jobs.py`) calls `spawn_prediction()` and `poll_prediction()` and never touches the SDK. Tests mock at the dispatch-module boundary for route tests, and at the SDK boundary for dispatch tests — clean separation, both layers exercisable in CI without Modal credits.

4. **Pydantic mirror of `ModelResult` for the response.** `ModelResult` is a frozen dataclass (Task 3.2) so the Modal container doesn't need Pydantic. The API needs an OpenAPI schema, and FastAPI's generator works far better with `BaseModel` than with `@dataclass`. We declare `ModelResultModel(BaseModel)` once in `api/models.py` with the same fields; bridging is `ModelResultModel.model_validate(model_result.to_dict())`. The cost is one declaration kept in sync manually; the benefit is correct, complete OpenAPI docs.

5. **Fixed-interval polling on the frontend, not SSE/WebSocket.** Predictions take minutes (Boltz: 3–5 min after first run, AF3: 5–10 min). A 3-second polling interval costs ~60–200 requests per job, all to a single user's own backend. SSE would shave milliseconds off the "done" detection at the cost of backend async machinery (background tasks holding open connections, lifecycle ownership, retries). Not worth it at MVP. Polling stops on terminal status; `AbortController` cancels in-flight requests on unmount.

6. **`POST` returns `status: "pending"` without calling Modal.** The spawn already happened; reporting "pending" lets the frontend immediately navigate to `/predict/[jobId]` and start polling on its own cadence. We don't burn a second Modal call just to flip "pending" → "running" half a second later. The first `GET` polls.

7. **`GET` response has `model: null`.** Modal's `FunctionCall` doesn't surface the originating App/Function through the SDK. The frontend keeps the model in URL state (`/predict/[jobId]?model=boltz2`) — set at `POST` time, available everywhere. Reverse-looking-up the App from a call ID isn't worth the additional Modal call. Documented in `JobStatusResponse.model`'s docstring.

## Consequences

**Positive**

- Backend is a single FastAPI process with no DB, no Celery, no Redis, no migration step. A solo researcher runs `uv run uvicorn easyfold.main:app` and they're done.
- Jobs survive backend restarts. The frontend has the `job_id` in its URL; refresh the page after a restart and polling picks up where it left off.
- The Modal SDK boundary is a single file. If Modal changes its API or we want to swap runtimes (RunPod, Beam, Replicate), the change is contained.
- Error messages are actionable. "Modal Function easyfold-boltz/run_boltz is not deployed in this workspace. Run `./modal/deploy.sh boltz` first." beats `KeyError`.
- Tests run without Modal credits. Route tests mock `dispatch.spawn_prediction` / `dispatch.poll_prediction`; dispatch tests mock `modal.Function.from_name` / `modal.FunctionCall.from_id`. Both layers exercised in CI.

**Negative**

- Job IDs are opaque Modal call IDs. If we ever migrate off Modal, existing `/predict/[jobId]` bookmarks break. (Not a real concern today; the project is BYOC-Modal by design.)
- Result retention is bounded by Modal's policy (~7 days at writing). Bookmarking a `/predict/[jobId]` for a month and expecting it to resolve will fail — `JobNotFound` (404) instead of a result. Acceptable: predictions are short-lived analyses, not archival records.
- Frontend has to carry the model name in URL state because `GET` can't recover it. Minor papercut; mitigated by clear documentation in the type.
- Single-protein output PAE matrices for long proteins (1000+ residues) approach Modal's response budget. We'll measure and migrate to an output Volume when that becomes a real problem.

**Open**

- **Output Volume for large artifacts.** PAE for a 1500-residue protein is ~9 MB JSON. Modal's per-call result budget exists but is generous; we accept the risk until it bites and switch to a `Volume.commit()` + signed-URL pattern when it does.
- **Job cancellation.** Modal supports `FunctionCall.cancel()`. Not in scope at MVP single-user scale. Would be a third route (`DELETE /api/v1/jobs/{id}`) if added.
- **History / list-my-jobs.** Stateless backend means we can't enumerate jobs. If we ever want history, that's a real data-store decision (probably SQLite for self-hosted, something else for any hosted variant — but we don't host).
- **Per-user isolation.** The backend has no notion of "user." Anyone with the URL can poll any `job_id`. Acceptable for the single-user-local-deploy model; would need rethinking if EasyFold ever grew a multi-user mode (which is explicitly out of scope per CLAUDE.md).
