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

- [ ] **2.2 pLDDT / PAE chart visualization (Recharts)** ← **NEXT**
  - Status: Not started · Branch: —
  - Render per-residue pLDDT line chart and PAE heatmap from AF3 output. Co-located with the Mol\* viewer on the result page.
  - Depends: 2.1
  - Acceptance: charts render from a fixture JSON; values match the source; tooltips show residue indices.

- [ ] **2.3 LLM interpretation layer (Claude API)** — DIFFERENTIATION CORE
  - Status: Not started · Branch: —
  - Take pLDDT/PAE/ipTM stats + the user's stated question and produce a natural-language interpretation with suggested next actions. BYOK; no server-side key storage.
  - Depends: 2.2
  - Acceptance: given a fixture metrics blob + a question, returns a sensible paragraph + 1-3 action suggestions; key never leaves the user's browser without explicit submission.

- [ ] **2.4 Hugging Face Spaces demo build**
  - Status: Not started · Branch: —
  - CPU-only demo on HF Spaces showcasing 3 pre-computed structures (no GPU, no AF3 runtime). End-to-end UX: input → viewer → charts → interpretation.
  - Depends: 2.1, 2.2, 2.3
  - Acceptance: HF Space loads in <10s; all 3 examples render structure, charts, and interpretation; README links to the live URL.

## Week 5-8 — Computation integration

- [ ] **3.1 AF3 on Modal (weight mounting, inference)**
  - Status: Not started · Branch: —
  - Modal Function that mounts AF3 weights (user-supplied) and runs inference on a sequence. Writes outputs to a Modal volume.
  - Depends: 1.4
  - Acceptance: a single-protein job from `build_af3_input` produces AF3 output files; instructions for weight provisioning in `modal/README.md`.

- [ ] **3.2 Boltz-2 on Modal (MIT-licensed alternative)**
  - Status: Not started · Branch: —
  - Sibling Modal Function for Boltz-2. Same `PredictionJob` input, different output shape adapter.
  - Depends: 1.4
  - Acceptance: a single-protein job runs end-to-end on Modal; output adapter normalizes Boltz outputs to the viewer's expected shape.

- [ ] **3.3 Backend API for job submission and progress**
  - Status: Not started · Branch: —
  - `POST /api/v1/jobs` (start), `GET /api/v1/jobs/{id}` (status + outputs). Backend dispatches to Modal; polling-based progress for the MVP.
  - Depends: 3.1, 3.2
  - Acceptance: end-to-end browser → backend → Modal → results round-trip works; CORS configured; errors surface as structured JSON.

- [ ] **3.4 Ligand / modification / complex input UI**
  - Status: Not started · Branch: —
  - Expose `LigandSpec` and `ModificationSpec` in the input UI; support multi-chain complexes via copies.
  - Depends: 1.4, 3.3
  - Acceptance: a user can submit (a) protein + ligand by SMILES, (b) protein with a phospho-modification, (c) homo-dimer — all without seeing AF3 JSON.

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

- [ ] **4.3 README overhaul (GIF, 5-minute Quickstart)**
  - Status: Not started · Branch: —
  - Hero GIF/screenshot, 5-minute quickstart, link to the demo, link to the deploy button, license + model-license clarity.
  - Depends: 4.1
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
