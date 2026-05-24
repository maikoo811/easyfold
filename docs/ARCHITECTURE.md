# EasyFold — Architecture

A running log of technical decisions. New decisions append a section below; deeper rationale goes in `docs/decisions/` as ADRs.

## Frontend

- **Next.js 15+ (App Router) + TypeScript (strict)** — App Router because all new Next.js work targets it; strict TS to surface contract bugs early.
- **Tailwind CSS v4 + shadcn/ui (New York, neutral, CSS variables)** — shadcn gives ownership of component source (no opaque library), Tailwind keeps the surface small.
- **Mol\* Viewer** for 3D structure rendering. Industry-standard; loads PDB/mmCIF/structural data natively.
- **Package manager: pnpm.** Disk-efficient and reproducible (frozen-lockfile in CI).

## Backend

- **FastAPI + Pydantic v2.** Pydantic v2 for typed request/response models. FastAPI for first-class OpenAPI generation (useful when wiring the frontend client).
- **Tooling: uv + ruff + mypy (strict) + pytest.** uv because it's the fastest resolver and produces a single-file lockfile.
- **Routes versioned under `/api/v1/`.** Breaking changes go to `/api/v2/`; v1 stays stable.

## Job queue / compute

- **Production: Modal Functions.** GPU access on-demand, no infra to manage, user deploys to their own Modal account (BYOC).
- **Self-host fallback: Celery + Redis.** For users who can't or won't use Modal.
- **Decision deferred** until the first prediction route lands — we need to see the real I/O shape before committing to a queue contract.

## LLM (result interpretation)

- **Anthropic Claude API, user-supplied key (BYOK).** No server-side key storage; the key is passed per request from the user's session and not persisted.
- Interpretation surface = "what does this pLDDT/PAE/ipTM mean for *my* question, and what should I do next?" — not a generic explainer.

## External data sources

- **UniProt REST** for protein sequences and metadata.
- **RCSB PDB API** for reference structures.
- Both are public, rate-limited; cache locally as needed.

### Client implementation (Task 1.2)

- Async clients live in `backend/easyfold/external/`. One free function per source — `fetch_uniprot()`, `fetch_rcsb()` — returning a common `FetchedSequence` Pydantic model (`id, source, sequence, organism, length, description`).
- **Errors** normalize to four exceptions: `SequenceNotFound` (400/404), `ExternalSourceUnavailable` (network / persistent 5xx), `MalformedExternalResponse` (2xx body we couldn't parse), all subclasses of `ExternalSourceError`.
- **Rate limiting** via `aiolimiter.AsyncLimiter(10, 1)` — one shared per host, process-wide. RCSB's 10 req/s is the binding constraint; UniProt has no documented limit but we keep the same budget for politeness.
- **Retry**: one retry on 5xx with exponential backoff (0.5s, 1s) inline in `_http.py`; no `tenacity` dep.
- **RCSB sequence selection**: longest *protein* chain (DNA/RNA polymer entities are filtered). FASTA + entry endpoints are always called; the entity endpoint is called only when the FASTA header omits organism.
- **Tests**: `respx` mocks for offline unit tests (run in CI); `@pytest.mark.live` for opt-in real-network tests (`uv run pytest --live`). Marker registered in `tests/conftest.py`.

## AF3 input mapping (Task 1.4)

- Internal `PredictionJob` model lives in `backend/easyfold/af3_input/`. Callers describe a job in EasyFold's snake_case vocabulary (`proteins`, `ligands`, `modifications`); `build_af3_input(job)` produces the AF3-shaped JSON.
- Chain IDs are assigned in **Excel column order** (`A, B, …, Z, AA, AB, …`). A `copies > 1` field on `ProteinSpec` / `LigandSpec` emits `"id": ["A", "B"]` as a list — AF3's native homo-multimer signal.
- `validate_af3_input(data)` is a hand-rolled structural validator (no `jsonschema` dep — AF3 publishes no schema). Builder runs it on its own output as defense in depth; callers can also use it on hand-authored JSON.
- AF3 version pin: `dialect = "alphafold3"`, `version = 4`. Validator accepts versions `{1, 2, 3, 4}`. Bumping AF3 means changing the constant + adding to the allow-set.
- See [ADR 0001](decisions/0001-af3-input-mapping.md) for the full rationale.

## AF3 on Modal (Task 3.1)

- AlphaFold 3 inference runs as a **Modal Function** in the user's own Modal account (zero-hosting OSS — see [ADR 0002](decisions/0002-af3-on-modal.md)). H100 GPU, weights mounted read-only from a user-provisioned `easyfold-af3-weights` Modal Volume.
- **MSAs come from ColabFold's public mmseqs2 server** at request time. AF3 runs with `--norun_data_pipeline`. Sidesteps the multi-hundred-GB AF3 database mount and multi-hour MSA build.
- Python code lives in `backend/easyfold/inference/`: `af3.py` (Modal App), `colabfold.py` (MSA fetch), `input_prep.py` (disk-layout helpers), `output_parse.py` (read AF3 outputs into a dict). The repo's `/modal/` directory holds deployment metadata (`README.md` provisioning guide, `deploy.sh`).
- AF3 invocation is via `subprocess` to `run_alphafold.py` — the published CLI is more stable than AF3's internal Python API.
- End-to-end inference is **not exercised in CI** (requires Google-approved weights + Modal credits). Pure-Python helpers have unit-test coverage; the Modal Function is verified at import time only.

## Boltz-2 on Modal + unified `ModelResult` (Task 3.2)

- **Boltz-2 inference runs as a sibling Modal Function** (`easyfold-boltz`) alongside `easyfold-af3`. MIT-licensed weights ship via `pip install boltz==2.*`, downloaded lazily on first run into the `easyfold-boltz-cache` Modal Volume mounted at `/root/.boltz`. No user-side weight provisioning step.
- **Boltz YAML input** is produced by `easyfold.boltz_input.build_boltz_yaml(job)` from the same `PredictionJob` that AF3 consumes — single source of truth for job descriptions across models. Boltz expands homo-multimers to one entry per chain (vs AF3's list-of-ids collapsing). Excel-column chain IDs are reused so a given protein has stable chain identifiers across both models.
- **MSAs come from Boltz's built-in ColabFold integration** via the `--use_msa_server` flag. We don't reuse our `colabfold.py` for Boltz — Boltz handles it natively, less coupling, no two-implementations-of-the-same-thing.
- **Unified `ModelResult` dataclass** (`backend/easyfold/inference/result.py`) replaces 3.1's `AF3Outputs`. Both `read_af3_outputs` and `read_boltz_outputs` return it; the Function return is `ModelResult.to_dict()`. Model-specific raw confidence JSON is preserved under `extras` so the LLM interpretation pass keeps per-token detail.
- **Independent deploys.** `./modal/deploy.sh af3` and `./modal/deploy.sh boltz` are separate Apps with separate images. Either runs without the other. See [ADR 0003](decisions/0003-boltz-on-modal-and-model-result.md) for the full rationale.

## Hosting

- **Demo: Hugging Face Spaces** (CPU free tier). Pre-computed examples only; no live prediction.
- **Production: Modal one-click deploy to the user's own account.** No EasyFold-hosted service. This is a hard constraint of the project.

## License

- Project is **CC-BY-NC-SA 4.0** because AlphaFold 3 is, and EasyFold's primary value depends on it.
- Boltz-2 is MIT (commercial OK). When a user selects a model, the UI must surface the license difference so commercial users know which path is viable.

## Out-of-scope for MVP

User auth, batch prediction, mutation scanning, docking, mobile UI, non-English locales, hosted service. Listed here so future PRs don't re-litigate.

## Open decisions

- Session/job-state storage (in-memory vs. SQLite vs. Modal volumes) — decide when first long-running prediction lands.
- Auth model — currently none; revisit only if multi-user features get scoped in.
- Viewer state management — local to the viewer page or hoisted? Defer until second consumer appears.
