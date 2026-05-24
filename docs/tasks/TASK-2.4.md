# TASK-2.4 — Hugging Face Spaces demo build

**Status:** Done
**Branch:** `feat/hf-demo`
**Started:** 2026-05-23
**Completed:** 2026-05-24

## Context

Tasks 2.1–2.3 produced a working result page on `/demo/viewer`: Mol\* viewer + pLDDT/PAE charts + LLM interpretation. Currently it shows only 1TUP. To put EasyFold in front of researchers without asking them to install anything, we need a public static demo on Hugging Face Spaces (CPU free tier, no GPU, no backend) with three pre-computed structures. The full self-hostable app (with AF3 / Boltz, backend, sequence input) lands in Phase 3.

## Goal

Ship a static-exportable Next.js demo at `/demo` with three featured structures — 1TUP, 1CRN, 6LU7 — each displaying structure + charts + interpretation, deployable to Hugging Face Spaces via a single `deploy.sh` script.

## Requirements

- Three structures, each with a real mmCIF (downloaded from RCSB) and a deterministic synthetic confidence fixture:
  - **1TUP** (TP53 / DNA, ~219 aa) — already shipped, reuse as-is.
  - **1CRN** (Crambin, 46 aa) — textbook small protein.
  - **6LU7** (SARS-CoV-2 main protease + N3 inhibitor, 306 aa) — COVID drug target. *Substituted from 6VXX (~1281 aa × 3 chains → ~50 MB of fixtures); same SARS-CoV-2 angle, ~50× smaller. Swap-back is one line if you'd rather have the spike RBD instead.*
- New routes: `/demo` (landing with three cards) and `/demo/viewer/[id]` (dynamic single-example page). The existing `/demo/viewer` page is replaced.
- Static export support: `next.config.ts` switches to `output: "export"` when `BUILD_TARGET=demo`; the production build keeps SSR/prerender so future API routes work.
- `generateStaticParams()` on `/demo/viewer/[id]` enumerates the three IDs so static export produces three HTML files.
- HF Spaces metadata: `demo/README.md` (root-level) with the Spaces YAML frontmatter (`sdk: static`).
- Deploy script: `demo/deploy.sh` runs the demo build + pushes `out/` to a Hugging Face Space using `huggingface_hub` CLI. User runs it locally with `HF_TOKEN` set; we don't actually deploy in this task (per clarifying question).
- Update `frontend/public/fixtures/README.md` to list all three sources.
- Parameterize `scripts/generate-confidence-fixture.mjs` to emit per-structure fixtures.

## Out of scope

- Actually deploying to Hugging Face (we prepare; user pushes — per clarifying question).
- Backend / sequence-input flow in the demo (decided: result view only).
- A real AF3 run for any of these structures (synthetic confidence is fine for MVP demo).
- ResultViewer / StructureViewer / ConfidenceCharts API redesign — they already accept the right props, just pass in dynamic URLs.

## Acceptance criteria

- [x] `pnpm typecheck` / `pnpm lint` / `pnpm build` (default target) green.
- [x] `BUILD_TARGET=demo pnpm build` produces an `out/` directory with `out/index.html`, `out/demo.html`, and `out/demo/viewer/{1tup,1crn,6lu7}.html` (Next.js emits flat `<route>.html`, not `<route>/index.html`).
- [x] Total `out/` size **9.0 MB** (under the ~12 MB target).
- [x] Serving `out/` via `pnpm dlx serve out` → `/demo` lists three cards → clicking each reaches the result page → viewer + charts render, interpretation panel wired — user-confirmed.
- [x] `demo/README.md` (Spaces YAML frontmatter) and `demo/deploy.sh` (executable, `bash -n` syntax-OK) checked in; the script is documented and runnable.
- [x] Repo root `README.md` mentions the demo path (live URL filled in after the manual push as a follow-up — see PR description).

## Approach

- Plan mode: yes (new routes, conditional build config, new fixtures, deploy artifacts).
- Files to reference:
  - `frontend/app/demo/viewer/page.tsx` — current single-example page; becomes the basis for the dynamic route
  - `frontend/components/result-viewer/result-viewer.tsx` — already takes `fixtureUrl` / `structureId` / `structureDescription` props, no changes needed
  - `frontend/components/structure-viewer/structure-viewer.tsx` — already takes `url`, no changes needed
  - `frontend/scripts/generate-confidence-fixture.mjs` — current single-structure generator; parameterize
  - `frontend/public/fixtures/README.md` — update with the new sources
- Existing patterns to reuse: existing `Example` cards style would mirror shadcn `Card` (we already have it from Task 1.3.5); deterministic Mulberry32 RNG in the existing fixture generator.
- New dependencies: none. `huggingface_hub` is invoked via `pipx` / `uv tool run` in the script — user-side, not a project dep.

## Implementation notes

- **Swapped 6VXX → 6LU7** for size. 6VXX is a 3-chain spike trimer (~1281 aa per chain → ~16 MB PAE matrix per chain). 6LU7 (SARS-CoV-2 main protease, 306 aa) preserves the COVID drug-target story while keeping the fixture under 500 KB.
- **Conditional static export** via `BUILD_TARGET=demo` env var in `next.config.ts`. Default builds keep `output` undefined so future API routes / middleware in the self-hosted deployment continue to work. Demo build sets `output: "export"`. Single source tree, two deploy targets.
- **Dynamic route + `generateStaticParams`**: `/demo/viewer/[id]/page.tsx` lists the 3 example IDs at build time so static export emits concrete HTML files for each (`out/demo/viewer/1tup.html` etc.). Next.js 16 App Router uses `params` as a `Promise<{id}>`; the page is `async` and `await`s it.
- **`.next/types/validator.ts` cached stale routes.** Deleting `app/demo/viewer/page.tsx` (replaced by `[id]`) left a dangling reference in the auto-generated `.next/types/validator.ts` that broke `tsc --noEmit` even though the new dynamic route was structurally fine. `rm -rf .next` fixed it. Worth remembering for any task that moves/deletes routes.
- **Next.js static export uses flat `<route>.html`**, not `<route>/index.html`, for non-root routes. The plan's verification step expected `out/demo/viewer/1tup/index.html` and that file doesn't exist — `out/demo/viewer/1tup.html` is what gets written. `serve` handles both URL forms transparently (clean URLs + extension fallback). Updated the acceptance criteria to match reality.
- **Fixture generator refactor was non-cosmetic**: parameterizing by length recomputed the loop / domain boundaries proportionally instead of hard-coded (was `r <= 150` / `r >= 110` / `i < 100`; now `Math.round(n * 0.69)` / etc.). For 1TUP the boundaries shift by 1–2 residues. plddt[0] still matches (61.2) because the N-terminal ramp is unchanged. Acceptable for synthetic data; documented.
- **Deploy script uses `uvx`**, not `pip install huggingface_hub`, so the user doesn't need a Python venv. Prerequisite is just `uv` + a Hugging Face token.

## Learnings

- [generalizable] **Conditional `output: "export"` via env var** is the cleanest way to maintain one Next.js codebase with two deploy targets (full-stack vs static). Add a `build:demo` script that sets the env var so CI/devs don't have to remember the incantation.
- [generalizable] **When you delete or rename a Next.js App Router page, `rm -rf .next` before typechecking.** The auto-generated `.next/types/validator.ts` keeps references to removed routes and causes `tsc --noEmit` to fail with "Cannot find module '../../app/.../page.js'" — `next build` clears it but stale-state `pnpm typecheck` runs don't.
- [generalizable] **Next.js static export emits `<route>.html`, not `<route>/index.html`** for non-root routes. Static file servers (and HF Spaces) handle both URL forms via extension fallback / redirects, but build-time assertions that look for `index.html` under each route folder will silently fail.
- Project-specific: for any future demo task, prefer `uvx --from huggingface_hub huggingface-cli ...` over installing `huggingface_hub` system-wide — keeps the script `uv`-only.
