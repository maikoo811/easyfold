# EasyFold Roadmap

The authoritative task list. Drives session progression — see `CLAUDE.md → Autonomous task workflow` for how this file is read and updated.

**How to read a row:**

- `[x]` Done · `[ ]` Not started · `[~]` In progress (the explicit `Status:` line is authoritative; the checkbox is a glance signal)
- `← **NEXT**` marks the inferred next task (the first `Not started` row whose `Depends` are all `Done`)
- `Branch` records the working branch (kept after merge so PRs are traceable)
- `Depends` lists task IDs that must be Done before this one can start

---

## Week 1-2 — Foundation

- [x] **1.1 Project skeleton (Next.js + FastAPI + CI)** · Branch: `chore/initial-skeleton`
  - Status: Done · Completed: 2026-05-23
  - Next.js 15 + TypeScript + Tailwind + shadcn/ui on the frontend; FastAPI + Pydantic v2 + uv + ruff + mypy strict + pytest on the backend; GitHub Actions CI for both.
  - Depends: —
  - Acceptance: `pnpm install` + `uv sync` clean; CI green on lint, typecheck, test; `/api/v1/healthz` returns `{"status":"ok"}`.

- [x] **1.2 UniProt / RCSB API clients** · Branch: `chore/initial-skeleton` (folded into 1.1's branch retroactively)
  - Status: Done · Completed: 2026-05-23
  - Async clients in `backend/easyfold/external/` returning a common `FetchedSequence` Pydantic model. Per-host rate limiter, retry on 5xx, normalized exceptions.
  - Depends: 1.1
  - Acceptance: live and mocked tests pass for P04637 (UniProt) and 1TUP (RCSB); 404/400 maps to `SequenceNotFound`.

- [x] **1.3 Sequence input form (FASTA / UniProt / PDB)** · Branch: `(merged direct to main)`
  - Status: Done · Completed: 2026-05-23
  - Three-tab frontend form (Paste FASTA / UniProt lookup / PDB lookup) wired to the backend sequence routes. Result card with copy + reset.
  - Depends: 1.2
  - Acceptance: each tab fetches and renders a valid sequence; errors surface inline; copy works.

- [x] **1.3.5 UI polish** · Branch: `feat/sequence-input-polish`
  - Status: Done · Completed: 2026-05-23
  - Hero typography, deep-teal accent, inline SVG logo, mode-specific validation hints, chip-style "Try X", Badge for amino-acid count, italic organism.
  - Depends: 1.3
  - Acceptance: visual hierarchy clear at 1280px and ≥360px; active tab unmistakable; one consistent accent color.

- [x] **1.3.6 UniProt validation bug fix** · Branch: `fix/uniprot-accession-regex`
  - Status: Done · Completed: 2026-05-23
  - Replaced loose 1.3.5 regex with the official UniProt accession pattern (rejects e.g. `PPPPP1`).
  - Depends: 1.3.5
  - Acceptance: 11/11 sanity cases (`P04637`, `Q12345`, `A0A024R1R8`, … accepted; lowercase / too-long / malformed rejected).

- [x] **1.4 AF3 input JSON builder (internal logic)** · Branch: `feat/af3-input-builder`
  - Status: Done · Completed: 2026-05-23
  - `backend/easyfold/af3_input/` translates EasyFold's internal `PredictionJob` to AF3 input JSON. Excel-style chain IDs, `copies` for homo-multimers, hand-rolled validator (no jsonschema dep). ADR 0001 records the design.
  - Depends: 1.2
  - Acceptance: 42 new tests pass; full backend suite 61 passed / 2 live-skipped; mypy strict clean; builder self-validates output.

## Week 3-4 — Result viewer and demo

- [x] **2.1 Mol\* Viewer integration** · Branch: `feat/molstar-viewer`
  - Status: Done · Completed: 2026-05-23
  - Standalone `/demo/viewer` route loads a static 1TUP fixture via Mol*'s prebuilt UMD (vendored into `/public/molstar/` by a `postinstall` script — Turbopack can't bundle Mol* directly). `StructureViewer` is a `'use client'` component with proper unmount cleanup and an error state.
  - Depends: 1.1
  - Acceptance: viewer renders 1TUP and rotates; no console errors; error path renders the destructive-styled fallback.

- [x] **2.2 pLDDT / PAE chart visualization (Recharts)** · Branch: `feat/confidence-charts`
  - Status: Done · Completed: 2026-05-23
  - pLDDT rendered with Recharts `LineChart` (project teal line, muted reference bands at 50/70/90); PAE rendered as plain SVG (47k rects, single-hue teal scale, delegated mouse handler). Synthetic 219-residue fixture from a seeded Mulberry32 generator. Co-located with the Mol\* viewer on `/demo/viewer`.
  - Depends: 2.1
  - Acceptance: charts render; pLDDT tooltip shows `Residue N · pLDDT V`; PAE hover shows `(i, j) · X Å`; fixture spot-checks pass.

- [x] **2.3 LLM interpretation layer (Claude API)** · Branch: `feat/llm-interpretation` — DIFFERENTIATION CORE
  - Status: Done · Completed: 2026-05-23
  - "Interpret" panel on `/demo/viewer`: BYOK key + question textarea → raw `POST /v1/messages` from the browser → paragraph + 1–3 actions parsed from a delimited text protocol. The `@anthropic-ai/sdk` package doesn't bundle in Turbopack (Node-only beta paths) so we use `fetch` + `anthropic-dangerous-direct-browser-access` header instead — 0 KB bundle delta. `ConfidenceCharts` refactored into a pure view; new `ResultViewer` does the single fetch and renders both children.
  - Depends: 2.2
  - Acceptance: typecheck/lint/build green, panel renders, real Anthropic call succeeds with a user-supplied key, errors normalized to `InterpretError` and rendered inline.

- [x] **2.4 Hugging Face Spaces demo build** · Branch: `feat/hf-demo`
  - Status: Done · Completed: 2026-05-24
  - `/demo` landing + `/demo/viewer/[id]` dynamic route for 1TUP, 1CRN, 6LU7 (swapped from 6VXX for size). Conditional `output: "export"` in `next.config.ts` driven by `BUILD_TARGET=demo`; `pnpm build:demo` produces `out/` (9 MB). `demo/deploy.sh` runs `huggingface-cli upload` via `uvx`. Live URL pending manual push (user runs `./demo/deploy.sh maiko811/easyfold-demo` with `HF_TOKEN`).
  - Depends: 2.1, 2.2, 2.3
  - Acceptance: typecheck/lint/both builds green; user-confirmed visual check on the 3 examples; deploy script syntax-OK and documented.

## Week 5-8 — Computation integration

- [x] **3.1 AF3 on Modal (weight mounting, inference)** · Branch: `feat/af3-on-modal`
  - Status: Done · Completed: 2026-05-24
  - `modal.App("easyfold-af3")` on H100 with weights mounted from a user-provisioned `easyfold-af3-weights` Volume; MSAs fetched from ColabFold's mmseqs2 server (no 200 GB DB mount). Code in `backend/easyfold/inference/`; deploy metadata in `/modal/`. Pure-Python helpers fully unit-tested (84 passing); end-to-end smoke test scripted in `modal/README.md` § 5 for the user to run after Google-approved weights arrive. See ADR 0002.
  - Depends: 1.4
  - Acceptance: ruff/mypy/pytest green; Modal App imports without network; `modal/README.md` provisioning guide complete with smoke-test command + troubleshooting.

- [x] **3.2 Boltz-2 on Modal (MIT-licensed alternative)** · Branch: `feat/boltz-on-modal`
  - Status: Done · Completed: 2026-05-24
  - `modal.App("easyfold-boltz")` sibling to `easyfold-af3` on H100; weights auto-download into `easyfold-boltz-cache` Volume (`create_if_missing=True`); MSAs via Boltz's built-in `--use_msa_server`. `boltz_input/` package mirrors `af3_input/` (YAML emitter + validator). Refactored 3.1's `AF3Outputs` → unified `ModelResult` dataclass (`inference/result.py`) so both Functions return one shape; model-specific raw JSON preserved under `extras`. 120 passing tests (was 84). `./modal/deploy.sh` now takes `af3`|`boltz` arg. End-to-end smoke scripted in `modal/README.md` § Boltz-2 for the user — Boltz unblocks the first real inference (no weight approval gate). See ADR 0003.
  - Depends: 1.4
  - Acceptance: ruff/mypy/pytest green; both Modal Apps import without network; `modal/README.md` Boltz section complete with smoke + troubleshooting.

- [x] **3.3 Backend API for job submission and progress** · Branch: `feat/jobs-api`
  - Status: Done · Completed: 2026-05-24
  - `POST /api/v1/jobs` and `GET /api/v1/jobs/{job_id}` (`job_id` = Modal's `FunctionCall.object_id` — stateless backend, no DB). Lazy `modal.Function.from_name` per request. Dispatch isolated in `easyfold.inference.dispatch` (sole module outside Function definitions that imports `modal`). Frontend: `SequenceResultCard` now has a `PredictCta` (Boltz-2 default), which POSTs and navigates to `/predict/[jobId]?model=…`; the page polls every 3 s and renders the structure + confidence + LLM panel on completion. Backend 145 passing tests (was 120). Both `pnpm build` and `pnpm build:demo` green. End-to-end smoke (first real inference!) deferred to user post-merge — `./modal/deploy.sh boltz` then submit any sequence. See ADR 0004.
  - Depends: 3.1, 3.2
  - Acceptance: ruff/mypy/pytest green; both frontend builds green; live `curl` confirms 502 with actionable "deploy this first" message and 404 for unknown job IDs.

- [x] **3.4 Ligand / modification / complex input UI** · Branch: `feat/complex-input-ui`
  - Status: Done · Completed: 2026-05-25
  - Home page is an assembly builder: existing 3-tab `SequenceInput` adds proteins to a running `AssemblyState`; per-protein `copies` + `ModificationsEditor` (10 PTM presets + "Other..." free text); "Add ligand" creates a `LigandCard` with SMILES / CCD modes; chain-ID preview via TS port of `excel_chain_id`. Predict button disables Boltz with tooltip when modifications are present (Boltz silently drops them; AF3 supports them). Backend untouched except +1 pytest case (`test_post_accepts_full_assembly`). No new dependencies — native `<select>` styled to match the existing `Input` primitive.
  - Depends: 1.4, 3.3
  - Acceptance: ruff/mypy/pytest green (146 passing); frontend typecheck/lint/build/build:demo green; ARCHITECTURE.md "Complex input UI" section added.

## Week 9-12 — Deploy experience and release

- [ ] **4.1 "Deploy to Modal" button and template**
  - Status: Not started · Branch: —
  - One-click Modal deploy template + button on the README/landing page that takes a user from zero to running stack in their own Modal account.
  - Depends: 3.1, 3.2, 3.3
  - Acceptance: a new Modal account can deploy with default settings in <5 minutes; secrets prompts are clear.

- [ ] **4.2 Docker Compose self-hosting**
  - Status: Not started · Branch: —
  - `docker compose up` brings up frontend + backend locally. Modal is optional; fallback path documented.
  - Depends: 3.1, 3.2, 3.3
  - Acceptance: a fresh clone runs `docker compose up` and reaches the UI on `localhost:3000` with a working healthz.

- [~] **4.3 README overhaul (GIF, 5-minute Quickstart)** ← **NEXT**
  - Status: In progress · Started: 2026-05-25 · Branch: `docs/readme-overhaul`
  - Hero GIF/screenshot, 5-minute quickstart, link to the demo, link to the deploy button, license + model-license clarity.
  - Depends: 4.1 (formally; pulled ahead per the agreed pre-Public sweet-spot path — README is "Boltz quickstart" until 4.1 lands the deploy button, then we add it in a follow-up).
  - Acceptance: a stranger can reach a working install in 5 minutes following only the README.

- [ ] **4.4 bioRxiv Application Note draft**
  - Status: Not started · Branch: —
  - Short application-note manuscript (≤4 pages) describing EasyFold's purpose, differentiation, and usage. Ready for bioRxiv submission.
  - Depends: 4.3
  - Acceptance: draft passes a self-review against bioRxiv format; figures embed real screenshots; references the public release.

- [ ] **5.1 Closed beta (20 testers)**
  - Status: Not started · Branch: —
  - Recruit 20 structural biologists / drug discovery researchers; collect feedback over 2 weeks; iterate on top 3 issues.
  - Depends: 4.1, 4.3
  - Acceptance: 20 users installed; ≥10 ran at least one prediction; feedback log committed to `docs/beta-feedback.md`.

- [ ] **5.2 Public release**
  - Status: Not started · Branch: —
  - GitHub release tag, social announcement, demo link in the README front matter. Public bug tracker open.
  - Depends: 5.1
  - Acceptance: v1.0.0 tagged; release notes published; announcement posted.
