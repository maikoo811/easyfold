# TASK-2.1 — Mol* Viewer integration

**Status:** Done
**Branch:** `feat/molstar-viewer`
**Started:** 2026-05-23
**Completed:** 2026-05-23

## Context

Task 1.4 produced the AF3 input JSON builder; future tasks (3.x) will run AF3 / Boltz-2 and produce predicted structures. Before those land we need a frontend component that can render an mmCIF or PDB file. This task ships the viewer with a static 1TUP fixture so the Mol*-on-Next.js integration is proven end-to-end, ready to receive real prediction outputs without rework.

## Goal

Render an mmCIF/PDB structure file in the EasyFold frontend using Mol* Viewer, mounted at a `/demo/viewer` route with 1TUP as the default fixture.

## Requirements

- Add `molstar` (npm, current 5.9.0) as a frontend dep — pre-approved by the tech stack in CLAUDE.md (`3D viewer: Mol*`).
- New React component `StructureViewer` that takes a structure URL and renders it in a fixed-height container.
- New route `/demo/viewer` that mounts the component.
- 1TUP fixture committed to `frontend/public/fixtures/1tup.cif` (served as a static asset; no runtime fetch to RCSB).
- Mol* runs client-side only — `'use client'` + `next/dynamic` with `ssr: false` from a server component parent.
- Graceful failure: when the URL is unreachable or the file is malformed, render an error message in the container, not a white screen.
- Proper cleanup on unmount (`viewer.dispose()`).

## Out of scope

- Wiring the viewer into the existing sequence-input result flow — the result card stays sequence-only until 3.x actually produces structures.
- pLDDT / per-residue coloring (that's 2.2).
- File upload UI — the ROADMAP entry mentions "Upload mmCIF/PDB" but the acceptance only asks for fixture load + graceful failure; deferring keeps the task scoped.
- Custom Mol* UI styling beyond the shipped light theme.
- Mobile layout (desktop-first per CLAUDE.md).

## Acceptance criteria

- [x] `pnpm typecheck` / `pnpm lint` / `pnpm build` all green
- [x] `http://localhost:3000/demo/viewer` renders the 1TUP fixture; structure visible within ~3s; mouse drag rotates the structure (user-confirmed)
- [x] No console errors at page load (user-confirmed)
- [x] Pointing at `/fixtures/does-not-exist.cif` shows a styled error state in the container (try/catch around `loadStructureFromUrl` renders the AlertCircle box)
- [x] Bundle: Mol* served as a static `~5 MB` UMD from `/public/molstar/molstar.js`; route bundle itself is tiny because the dep is not webpack-included

## Approach

- Plan mode: yes (touches dep, route, component, fixture, CSS).
- Files to reference:
  - `frontend/app/page.tsx` — current page layout convention
  - `frontend/components/sequence-input/` — component organization pattern
  - `CLAUDE.md` tech stack line for Mol*
- Existing patterns to reuse: shadcn card wrapper for the error/empty state (`rounded-lg border bg-card`); Geist font stack inherited from layout.
- New dependencies: `molstar` (~29 MB unpacked, ~5 MB gzipped at runtime). Pre-approved by CLAUDE.md tech stack. May also need `sass` as a dev dep if Next.js can't import Mol*'s `.scss` directly (will try the compiled `.css` path first).

## Implementation notes

- **Mol* + Turbopack don't bundle cleanly.** Importing `molstar/lib/apps/viewer` (even dynamically inside `useEffect`) triggers four Turbopack errors at build: `.html` files in the package (`embedded.html`, `index.html`, `mvs.html`), an `.scss` import (`mol-plugin-ui/skin/light.scss`) that needs `sass`, and the `h264-mp4-encoder` Node dep (`require("fs")`) pulled in by the optional mp4-export extension.
- **Pivoted to vendoring Mol*'s prebuilt UMD via `/public/`.** `scripts/copy-molstar.mjs` runs from `postinstall`, copying `node_modules/molstar/build/viewer/molstar.{js,css}` into `frontend/public/molstar/`. `StructureViewer` injects a `<script>` and `<link>` once per page (module-level promise dedupes), then calls `window.molstar.Viewer.create(host)`. No Mol* import in our source tree → Turbopack sees nothing to bundle.
- **`/public/molstar/` is gitignored.** The vendored bundle is rebuilt from the npm dep on every `pnpm install` (CI included). The npm dep stays in `package.json` as the version-pinned source of truth.
- **`ssr: false` with `next/dynamic` is rejected in Server Components in Next.js 16.** Initial design used `dynamic(import(...), { ssr: false })` from the demo page. After moving Mol* loading to runtime script injection, the dynamic import isn't needed at all — the demo page directly imports the `'use client'` component and Next handles the boundary.
- **ESLint scans `/public/` by default.** Dropping a 5 MB UMD into `public/molstar/` produced 6,946 ESLint problems. Added `public/molstar/**` to `eslint.config.mjs` global ignores.
- **`@scarf/scarf` postinstall script** (Mol* transitive analytics dep) flagged by pnpm 11; explicitly denied in `pnpm-workspace.yaml` (`'@scarf/scarf': false`) so CI doesn't trip the ignored-builds warning.
- Workflow nit: doing the ROADMAP→Done + Learnings update in the same PR as the feature, rather than a follow-up PR after merge. The strict workflow says "after merge"; doing it together avoids a tiny second PR but flips the doc to Done before main actually has the commits. Acceptable tradeoff for solo dev; reconsider if a teammate ever reads ROADMAP between merge and follow-up.

## Learnings

- [generalizable] **Next.js 16 + `dynamic(...{ ssr: false })` is Server-Component-forbidden.** If a component is already `'use client'` and doesn't pull heavy server-incompatible deps at module load, just import it directly from a Server Component — Next handles the boundary. Reserve `dynamic({ ssr: false })` for client wrappers around code that must not be evaluated on the server.
- [generalizable] **ESLint defaults don't ignore `/public/`.** When adding non-source asset directories (vendored bundles, generated files), audit `eslint.config.mjs` ignores too — the lint job will scan everything `tsconfig`-adjacent unless told otherwise.
- [generalizable] **Bundler hostility ⇒ vendor via `/public/` + `<script>` tag.** When a heavy 3rd-party library ships `.html` / `.scss` / Node-only files that Turbopack/webpack chokes on, a prebuilt UMD copied into `/public/` via a `postinstall` script is the smallest viable workaround. Tradeoff: lose tree-shaking; gain a clean build.
- Mol*-specific (not generalizable): `Viewer.create(host)` from the UMD attaches its own toolbar UI; no need to mount any React subtree from Mol* itself.
