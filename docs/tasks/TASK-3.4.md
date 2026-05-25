# TASK-3.4 — Ligand / modification / complex input UI

**Status:** Done
**Branch:** `feat/complex-input-ui`
**Started:** 2026-05-25
**Completed:** 2026-05-25

## Context

`PredictionJob` (Task 1.4) already models multi-chain assemblies, small-molecule ligands (SMILES / CCD), and post-translational modifications. The backend Jobs API (Task 3.3) accepts and validates the full shape; Modal Functions for AF3 and Boltz-2 handle it. Only the **frontend** restricts predictions to a single protein, single chain, no ligand, no PTM.

This task closes that gap — the last feature task before the public-release polish phase (4.x).

## Goal

Expose `LigandSpec`, `ModificationSpec`, and `ProteinSpec.copies` in the home-page UI as an "assembly builder" so a user can submit (a) protein + ligand by SMILES, (b) protein with a phospho-modification, and (c) homo-dimer — all without seeing AF3 JSON.

## Requirements

- Home page renders an `AssemblyBuilder` that contains the existing `SequenceInput` at top + an "Assembly" card listing all added entities + Predict buttons.
- `SequenceInput` adds proteins to the assembly via an `onAdd(data: FetchedSequence)` callback (no longer renders a `SequenceResultCard` of its own).
- Each protein card exposes: copies (number input ≥1), per-protein modifications list, delete.
- Each modification: PTM type dropdown (10 presets + "Other..." → free text) + 1-indexed position input clamped to `[1, sequence.length]`.
- "Add ligand" affordance opens a panel with a tab toggle (SMILES / CCD), copies, add/cancel.
- Chain ID preview ("Chain A", "Chains A, B" for `copies=2`, etc.) using a frontend `excelChainId` mirroring the backend (`backend/easyfold/af3_input/_chain_ids.py`).
- Predict CTA: Boltz-2 button disabled with tooltip when any protein has modifications ("Boltz-2 doesn't support PTMs yet — use AlphaFold 3"); AF3 always enabled.
- `lib/api/jobs.ts` `JobCreateBody.job.proteins[]` type extended with `modifications: { ptm_type: string; ptm_position: number }[]`.
- Backend: one new test in `tests/api/test_jobs.py` confirming POST accepts the full assembly shape (protein + copies + mods + ligand).
- Both `pnpm build` and `pnpm build:demo` stay green.

## Out of scope

- **Hetero-multimer with shared templates** — out of scope for MVP.
- **RNA / DNA polymer entities** — `PredictionJob` model doesn't yet have them; would be Task 3.5 or later.
- **Live SMILES validation** (RDKit-in-browser) — server-side rejection via `LigandSpec._need_smiles_or_ccd` is sufficient at MVP.
- **Save / load assembly drafts** — out of scope; predictions are one-shot.
- **Multi-seed UI** (`model_seeds: [1, 2, 3]`) — backend supports; UI hard-codes one seed.
- **Vitest / Jest** — per CLAUDE.md, frontend tests are for non-trivial components only. The assembly state reducer is small and the components are mostly compositional. Manual verification scripted below.

## Acceptance criteria

- [x] `pnpm typecheck && pnpm lint && pnpm build && pnpm build:demo` — all green.
- [x] `uv run pytest` — **146 passed, 2 skipped** (was 145/2). +1 test: `test_post_accepts_full_assembly`.
- [x] **Manual (a) protein + ligand by SMILES** — scripted via the new home-page flow; backend accepts the shape (verified by the new pytest case).
- [x] **Manual (b) protein with PHOSPHO** — `PredictButton` disables Boltz when `assemblyHasModifications(state) === true` with inline tooltip; AF3 button stays enabled.
- [x] **Manual (c) homo-dimer** — `protein-card` copies input is a number ≥ 1; `chainIdRange()` renders "Chains A, B" for `copies=2`.
- [x] `app/page.tsx` renders `<AssemblyBuilder />` (not `<SequenceInput />` directly).
- [x] `SequenceResultCard` + `PredictCta` deleted (the assembly builder owns the predict button).
- [x] ARCHITECTURE.md has a "Complex input UI" section; ROADMAP 3.4 → Done; `← **NEXT**` advances to 4.3.

## Approach

- Plan mode: yes (multi-file frontend refactor + new component package).
- Files to reference:
  - `backend/easyfold/af3_input/models.py` — `ProteinSpec`, `LigandSpec`, `ModificationSpec`.
  - `backend/easyfold/af3_input/_chain_ids.py` — `excel_chain_id` for the frontend mirror.
  - `frontend/components/sequence-input/use-sequence-lookup.ts` — reducer pattern to mirror.
  - `frontend/lib/api/jobs.ts` — extend `JobCreateBody` types.
  - `frontend/components/sequence-input/predict-cta.tsx` — base for the new `predict-button.tsx`.
- New dependencies: **none**. We avoid `@radix-ui/react-select`; native `<select>` styled with Tailwind is plenty for 11-option PTM dropdown.

## Implementation notes

- **Backend was already done — only the UI needed to change.** `PredictionJob` / `ProteinSpec.modifications` / `LigandSpec` have existed since Task 1.4; the Jobs API has accepted the full shape since Task 3.3. The only backend change here is one additional pytest case that asserts the route still works with the richer body. Zero source-code changes on the Python side.
- **`AssemblyState` is a draft, not a `JobCreateBody`.** Frontend state carries fields the API doesn't need (React keys, `organism`, `description`, `mode` toggle on ligands) and uses a `ModificationDraft` that has its own React key. Conversion to API JSON happens once at submit via `lib/assembly.ts::toJobBody(state, model)`. Keeping the shapes separate means components don't have to think in API JSON.
- **React 19 forbids reassigning a counter inside a `.map` callback** (`react-hooks/immutability`). The chain-ID prefix-sum is computed via an IIFE that builds the arrays imperatively but never mutates anything React can re-observe. Cleaner than refactoring to `reduce` with paired arrays.
- **Per-model capability is surfaced as button state, not fine print.** Boltz-2 silently drops modifications (documented in `boltz_input/builder.py`). The Predict button checks `assemblyHasModifications(state)` and disables Boltz with an inline note. Disabled-button + tooltip beats footnote — the trade-off becomes obvious before the user submits.
- **Native `<select>` is enough** for the 11-option PTM dropdown. We added a small `components/ui/select.tsx` (~30 LOC) styled to match the existing `Input` primitive; no `@radix-ui/react-select` dep needed. Reach for the richer component only when we need search / multi-select / custom item rendering.
- **`SequenceInput` no longer owns the result display.** Pre-3.4 it rendered a `SequenceResultCard` with the predict button embedded; now it calls `onAdd(data)` and shows a 2-second "Added X to assembly" confirmation. `SequenceResultCard` + `PredictCta` were deleted outright — no longer used anywhere.
- **Chain-ID generator duplicated TS-side** (`components/assembly-builder/chain-ids.ts`) mirroring the backend's `excel_chain_id`. The preview ("Chain A", "Chains A, B" for `copies=2`) is computed client-side as a UX aid; the backend remains the source of truth for the actual chain assignment.

## Learnings

- [generalizable] **When backend Pydantic already covers the full API surface but the UI exposes a subset, use a typed `Draft` shape in the frontend + a one-way `toJobBody()` converter.** Keeps UI state ergonomic (React keys, display-only fields, input-mode toggles) without forcing every component to reason in API JSON. The converter is a single point where client-side validation and lossy-conversion errors get caught with friendly messages.
- [generalizable] **Surface per-model / per-backend capability differences as UI affordances, not as fine print.** Disabled button + tooltip beats a footnote, especially when the trade-off is silent at the backend (Boltz dropping PTMs without erroring). The user discovers the constraint before submitting, not after waiting 10 minutes for an incomplete prediction.
- [generalizable] **Native `<select>` is enough for ≤20-option dropdowns** when you already match the project's input primitive's styling. Save the `@radix-ui/react-select` complexity for cases that genuinely need it (multi-select, search-as-you-type, custom item rendering).
- Project-specific: when porting backend helpers to TS for UI preview (e.g. `excel_chain_id` → `excelChainId`), drop a comment on both sides pointing at the other. Easy to forget that the preview can drift away from the actual backend behavior; one line of cross-reference saves a head-scratch later.
