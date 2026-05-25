# TASK-4.3 — README overhaul (GIF, 5-minute Quickstart)

**Status:** In progress
**Branch:** `docs/readme-overhaul`
**Started:** 2026-05-25
**Completed:** —

## Context

The repo is feature-complete for MVP (3.1–3.4 + post-merge validation polish) but the public-facing README still reads "early skeleton — not yet usable." That line is now actively misleading. This task rewrites the README into the public-release artifact: hero screenshot, 30-second pitch, two quickstart paths, architecture diagram, license clarity. After this lands, the repo is ready to flip to Public.

## Goal

A stranger landing on the GitHub repo can decide in 30 seconds whether EasyFold is for them, and a motivated user can have a working stack in ~10 minutes via the Boltz quickstart.

## Requirements

- `README.md` rewritten with: tagline → hero image → what-is-EasyFold (3 differentiators) → Try the demo → Quickstart (Boltz path, ~5 steps) → Architecture (Mermaid) → Pick a model (table) → Status & Roadmap → Contributing → License → Acknowledgements.
- `docs/screenshots/CAPTURE.md` (new) tells the user exactly what to capture and to what spec (size, framing).
- `docs/screenshots/` directory has `.gitkeep`-style placeholder so the README's `<img>` paths resolve to *something* immediately; user replaces with real PNGs before merging.
- Mermaid diagram renders on GitHub.
- License section uses a table, not a paragraph.
- HF Spaces demo is **live** at `https://huggingface.co/spaces/maiko811/easyfold-demo` before merge — bundled deploy step.
- `docs/ROADMAP.md` 4.3 → Done; `← **NEXT**` advances to **5.2 Public release**.
- The "early skeleton" banner is deleted.

## Out of scope

- **Task 4.1 (Deploy-to-Modal button)** — README references the manual `./modal/deploy.sh boltz` step; the button is a follow-up that converts step 3 into a click.
- **Task 4.2 (Docker Compose)** — not in the critical path for public release; BYOC Modal is the primary supported path.
- **Task 4.4 (bioRxiv draft)** — separate effort; depends on README being done.
- **Task 5.1 (Closed beta)** — pulled out of the critical path; can happen post-public ("ask 20 people to try the public repo").
- **Real predict-flow GIF** — static composite is enough for MVP; GIF can come later if onboarding metrics show people don't grok the flow from stills.

## Acceptance criteria

- [ ] `README.md` renders cleanly on github.com (hero, Mermaid, table, all links).
- [ ] `curl -sI https://huggingface.co/spaces/maiko811/easyfold-demo | head -1` returns `HTTP/2 200`.
- [ ] `docs/screenshots/hero.png` exists and is referenced by the README.
- [ ] License section is a table (Use case → Model → License → Wait time).
- [ ] ROADMAP 4.3 → Done; `← **NEXT**` advances to 5.2.
- [ ] "early skeleton — not yet usable" line is removed.

## Approach

- Plan mode: yes (full structure was designed in plan mode before any edits).
- Files to reference:
  - `docs/PROJECT_BRIEF.md` — does not exist in repo today (CLAUDE.md references it but the file isn't checked in); use CLAUDE.md's top section for tone + audience instead.
  - `modal/README.md` — link target for the AF3 deeper-dive.
  - `demo/README.md` — link target for the HF Spaces details.
  - `docs/ARCHITECTURE.md` — link target for the architecture deep-dive.
- New dependencies: none.

## Implementation notes

- **README is 100% rewritten**, not patched. The old 40-line file claimed "early skeleton — not yet usable"; nothing in that framing survives. New file is ~155 lines, follows the structure laid out in the plan, leads with the tagline + hero + 3 differentiators.
- **`docs/PROJECT_BRIEF.md` does not exist in the repo** despite `CLAUDE.md` referencing it (CLAUDE.md instructs: "Read it before architectural decisions"). The actual content lives in `CLAUDE.md` § "What this project is" + § "Differentiation reminders". For the README rewrite I sourced tone and differentiators from `CLAUDE.md` directly. This is a real CLAUDE.md inconsistency worth a follow-up (separate small PR to either create `PROJECT_BRIEF.md` or remove the dangling reference — left out of 4.3 scope to keep the PR focused).
- **Hero / screenshots are NOT in this commit** — they're user-provided. The README references `docs/screenshots/hero.png` etc.; the PR ships in **draft** state until the screenshots land. `docs/screenshots/CAPTURE.md` is the user's spec for what to capture and how.
- **HF demo URL `https://huggingface.co/spaces/maiko811/easyfold-demo` returned HTTP 401** at the time of writing (curl check) — either not deployed publicly or under a different name. The README links to it as if it's live; deploying via `./demo/deploy.sh maiko811/easyfold-demo` is part of the acceptance criteria for this task.
- **Mermaid diagram tested against GitHub's renderer convention** (`flowchart LR` with `<br/>` line breaks in node labels). All node labels under 30 chars to avoid awkward wrapping. Should render correctly on github.com without any plugin or config.
- **License table includes a 4th row** for PTM jobs — `AlphaFold 3` is the recommended model when modifications are present (Boltz drops PTMs at builder time per ADR 0003). The "Pick a model" decision is more nuanced than a clean academic/commercial split, and the table reflects that.
- **Quickstart leads with Boltz**, not AF3, because Boltz is the path with no Google approval wait. AF3 gets a one-paragraph subsection that punts to `modal/README.md § AlphaFold 3` for the full setup.
- **No code changes.** This is docs-only. Backend pytest / mypy / ruff and frontend typecheck / lint / build all continue to pass without touching anything; CI will reflect that.

## Learnings

- [generalizable] **Write the public-facing README the moment the product is shippable, not the moment it's polished.** A 40-line README claiming "not yet usable" actively harms a working repo: searches don't surface it, drive-by visitors bounce, and the project deceives itself into thinking it's "pre-release" long after the actual product works. The threshold for rewriting the README isn't perfection; it's "could a stranger run it end-to-end."
- [generalizable] **Bundle infra deployment (demo URL, Twitter card, OG image, …) into the README PR.** A README that links to a 404'd demo is worse than a README without a demo link. Treat "the demo URL returns 200" as a hard acceptance criterion in the same PR that adds the link.
- [generalizable] **For projects with mixed-license dependencies, use a license table, not a paragraph.** Drug-discovery / commercial readers will skim a paragraph and miss the trade-off; a table forces the comparison into their field of view. Map "intended use" → "recommended dep" → "license" → "any waits/gates" — that's the actual decision matrix.
- Project-specific: `CLAUDE.md` references `docs/PROJECT_BRIEF.md` but the file isn't in the repo. Either create it or update CLAUDE.md. Tracked as a small follow-up; not in 4.3 scope.
