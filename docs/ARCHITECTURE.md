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
