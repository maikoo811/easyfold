# TASK-2.2 — pLDDT / PAE chart visualization (Recharts)

**Status:** Done
**Branch:** `feat/confidence-charts`
**Started:** 2026-05-23
**Completed:** 2026-05-23

## Context

Task 2.1 shipped the Mol* viewer on `/demo/viewer` with a static 1TUP fixture. AlphaFold outputs come with two key confidence signals biologists actually look at: pLDDT (per-residue confidence, 0–100) and PAE (pairwise predicted aligned error, NxN Å matrix). They belong next to the structure on the same result page so users can read confidence visually alongside the model. This task ships both as fixture-driven components — real AF3 output will plug in during 3.x.

## Goal

Render pLDDT (line chart) and PAE (heatmap) for a synthetic 219-residue 1TUP fixture next to the existing Mol* viewer on `/demo/viewer`, with tooltips that name residue indices.

## Requirements

- New dep: `recharts` (pre-named in the ROADMAP entry, so pre-approved by CLAUDE.md rule #4).
- Internal confidence schema: `{ name: string; length: int; plddt: number[]; pae: number[][] }` (plddt 0–100; pae in Å). The schema is *EasyFold's* shape, not AF3's wire format — an adapter will land in 3.x when AF3 actually runs.
- pLDDT chart: Recharts `LineChart`, X = residue index (1-based), Y = pLDDT 0–100, tooltip shows `Residue 42 · pLDDT 87.5`. Color reference bands matching AF3 convention (very-high ≥90, high 70–89, low 50–69, very-low <50).
- PAE heatmap: plain SVG (Recharts has no native heatmap; ScatterChart with rects is more code than 30-line custom SVG). Color scale low Å → dark teal, high Å → light. Hover shows `(i, j) · X Å`.
- Synthetic fixture committed to `frontend/public/fixtures/1tup_confidence.json`. A small generator script in `frontend/scripts/` documents how it was produced.
- Charts placed below the Mol* viewer on `/demo/viewer`, in a 2-column grid on wide screens (pLDDT spanning full width above, PAE below — or pLDDT left, PAE right; pick what reads better).
- Error path: if the fixture URL fails to load, the section shows a destructive-styled message and the page still renders the viewer above.

## Out of scope

- Real AF3 output ingestion (3.x).
- Coloring the Mol* structure by pLDDT (a Mol* extension; defer to a later polish task).
- Per-chain split when N > 1 chain (1TUP fixture is a single 219-residue chain; multi-chain split lands when needed).
- Animations / transitions on the charts.
- PAE click-to-zoom or row-highlight interactions.

## Acceptance criteria

- [x] `pnpm typecheck` / `pnpm lint` / `pnpm build` all green
- [x] `http://localhost:3000/demo/viewer` shows the existing 3D viewer plus the pLDDT line chart and PAE heatmap below it (user-confirmed)
- [x] Hovering the pLDDT line shows `Residue N · pLDDT V` in the tooltip
- [x] Hovering a PAE cell shows `(i, j) · V Å`
- [x] Fixture values match the source JSON exactly (server-side spot-check: `plddt[0]=61.2`, `plddt[109]=65.9`, `pae[0][0]=1.23`)
- [x] No console errors on the page (user-confirmed)

## Approach

- Plan mode: yes (touches dep, multiple new components, new fixture, page composition).
- Files to reference:
  - `frontend/app/demo/viewer/page.tsx` — the page we're extending
  - `frontend/components/structure-viewer/structure-viewer.tsx` — pattern for client component + error state
  - `frontend/components/sequence-input/sequence-input.tsx` — error styling reuse
- New dependencies: `recharts` (~100 KB gzipped). No other new deps.

## Implementation notes

- **Recharts 3.8's exported `TooltipProps<...>` type doesn't expose `payload`.** First pass used `TooltipProps<number, string>` for the custom tooltip and tsc rejected it (`Property 'payload' does not exist`). Fixed by defining a local `PlddtTooltipProps` interface matching the runtime shape — cleaner than fighting the library's overly-narrow types.
- **PAE rendered as plain SVG, not Recharts.** 219×219 = 47,961 `<rect>` elements; browsers handle this fine. Used a single delegated `onMouseMove` on the SVG (clientX/clientY → cell index) instead of per-cell event handlers — keeps the hover bookkeeping cheap.
- **Single-hue teal sequential scale for PAE** (oklch 0.95→0.40 lightness, 0.02→0.10 chroma, hue fixed at 195) so the heatmap reads on-brand without competing with the pLDDT chart's primary teal. Cap at AF3-standard 30 Å.
- **pLDDT ReferenceArea bands use muted greys** (oklch 0.96/0.94/0.92/0.90), deliberately neutral so the actual line (project teal) is what your eye tracks. AF3's standard color-bands (blue/cyan/yellow/orange) would compete with the rest of the page's accent.
- **Fixture is deterministic.** `scripts/generate-confidence-fixture.mjs` uses a seeded Mulberry32 RNG (seed=42); re-running produces byte-identical JSON. Algorithm: N-terminal ramp 60→92, structured core 90 with jitter, single loop drop at residues 110–125, C-terminal ramp 92→55; PAE = distance-based + 12 Å step across residue-100 boundary to simulate two-domain uncertainty.
- **cwd drift bit me.** After running `uv run pytest` in `backend/`, the next `pnpm dev` inherited that cwd and pnpm couldn't find a `package.json`. Switched to absolute `cd` for the dev server. (CLAUDE.md already warns about this in the Bash tool guidance — followed-by-the-letter would have avoided it.)

## Learnings

- [generalizable] **When a library's exported TypeScript types are narrower or wrong vs. the runtime shape, define a local interface.** Faster than `as any`, faster than tracking down the library's correct generic args, and the local type documents exactly what your code depends on. (From Recharts 3.x `TooltipProps`.)
- [generalizable] **For 2D heatmaps on a chart page, plain SVG beats wrapping a chart lib.** 30 LOC of `<rect>` + delegated mouse handling outperforms Recharts/visx for the read-only case; reach for a chart lib only when you need its axes, legends, or animations.
- Recharts-specific (not generalizable): set `isAnimationActive={false}` on data-dense lines; the default flash-in animation feels janky at 200+ points.
- Synthesizing fixture data with seeded RNG + domain-aware shape (e.g. boundary steps in PAE) makes the visual far more informative than uniform noise — worth the extra 20 lines.
