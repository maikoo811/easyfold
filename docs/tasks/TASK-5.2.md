# TASK-5.2 — Public release (v1.0.0)

**Status:** Done
**Branch:** `chore/public-release-v1.0.0` (scaffolding) + `chore/flip-task-5.2-done` (this PR)
**Started:** 2026-05-26
**Completed:** 2026-05-30

## Context

The repo is feature-complete for MVP (1.1 → 4.3 + 4.5 test hardening + post-4.5 input limits / body size middleware / security headers / bearer-URL disclosure / license clarity / opt-in rate limit). The HF demo is live, the README is polished, the security audit (internal + Clearline external × 3) returned no critical findings, and the only thing left between us and Public was the flip itself.

This task is the flip: Private → Public, branch protection, Discussions, `v1.0.0` tag + GitHub Release.

## Goal

EasyFold is publicly visible on github.com/maikoo811/easyfold with branch protection on `main`, Discussions enabled, and a `v1.0.0` GitHub Release that summarizes the MVP work.

## Requirements

- GitHub Discussions enabled (works on Private — do this first so it's already on when we flip).
- Repo visibility flipped Private → Public via GitHub Settings → Danger Zone.
- Branch protection on `main`: require PR, require CI (`frontend` + `backend` status checks), block force push, block deletion, require linear history, admins can bypass (solo-maintainer escape hatch).
- `v1.0.0` annotated git tag pointing at the merge of this PR, pushed to origin.
- GitHub Release `v1.0.0` published with release notes from `docs/release-notes/v1.0.0.md`.
- README + HF demo URL both load on first visit from an incognito window.

## Out of scope

- **Branch protection on Private** — GitHub Free plan doesn't support it. Order is Public-then-protect; tiny gap is acceptable for a solo-maintainer repo nobody knows about yet.
- **`enforce_admins=true`** — solo project; admin bypass is the emergency escape hatch.
- **Required code-owner reviews** — would block solo dev (no second reviewer).
- **Signed commit requirement** — overkill for MVP.
- **`v1.0.1` patch tag** — none of the post-4.3 fixes change behavior in a way that warrants a separate tag; they're rolled into v1.0.0.
- **HF demo redeploy** — already live and verified; no changes since last deploy.

## Acceptance criteria

- [x] `https://github.com/maikoo811/easyfold` loads in incognito (README + 3 stacked screenshots + Mermaid diagram all render).
- [x] `https://huggingface.co/spaces/maiko811/easyfold-demo` still loads in incognito (regression check).
- [x] Repo Settings shows: visibility = Public, Discussions = Enabled, `main` branch protection active with the rules above.
- [x] `git ls-remote --tags origin | grep v1.0.0` → `75e4382...refs/tags/v1.0.0` (pushed).
- [x] `https://github.com/maikoo811/easyfold/releases/tag/v1.0.0` shows the release with the notes from `docs/release-notes/v1.0.0.md`.

## Approach

- Plan mode: yes (full sequencing reviewed before branching, including the "Public first, then protect" ordering).
- Files to reference:
  - `docs/release-notes/v1.0.0.md` — the GitHub Release body (committed for posterity + future-version template).
  - `docs/ROADMAP.md` — flip 5.2 to In progress now, Done after the release tag lands.
- New dependencies: none. All operations are `gh` CLI + GitHub UI.

## Implementation notes

- **3 PRs of pre-Public hardening landed between scaffolding and flip** — not strictly required by 5.2 but triggered by Clearline external reviews (×3) while waiting on the user's Public-flip UI action. Each one was small, focused, and tightened the v1.0.0 surface:
  - PR #21: input size caps + body-size middleware + security headers + bearer-URL docs.
  - PR #23: license clarity table + UI warnings (bearer-secret banner on `/predict/{jobId}`, Anthropic-key fork-audit warning on Interpret panel) + Issues templates.
  - PR #24: generic-error mode (env-var opt-in) + optional `slowapi` rate limit + `PredictionJob.name` regex + ColabFold A3M validation + pLDDT scale constant.
  - PR #25: rollback over-reach on CORS default (back to `localhost:3000` only, dropped 3001 fallback). Surfaced a generalizable lesson about narrow vs broad interpretation of ambiguous user directives — captured in CLAUDE.md learning log.
- **Public-first, then-protect ordering** worked as planned. GitHub Free plan doesn't allow branch protection on Private repos; the brief window of unprotected `main` between flip and `gh api PUT` was seconds, with no public traffic possible.
- **Branch protection applied via `gh api`** with the planned settings:
  - `required_status_checks.contexts=["frontend", "backend"]` (CI green required)
  - `required_status_checks.strict=true` (branches must be up to date)
  - `required_linear_history=true` (matches our rebase-merge policy)
  - `allow_force_pushes=false`, `allow_deletions=false`
  - `enforce_admins=false` (solo-maintainer emergency escape hatch)
  - `required_pull_request_reviews=null` (no review requirement — single dev)
- **`v1.0.0` annotated tag** points at the post-CORS-rollback merge commit (`c9dfa66`), so the release reflects the fully hardened MVP. Tag pushed via `git push origin v1.0.0`, Release created via `gh release create v1.0.0 --notes-file docs/release-notes/v1.0.0.md --latest`.
- **SNS announcement** was prepared in parallel with the flip but held until v1.0.0 was published so the GitHub link wouldn't 404 for early visitors.

## Learnings

- [generalizable] **GitHub Free plan branch protection is Public-only.** If you want secure-by-default-from-second-zero, you either pay for Pro or accept a 30-second window of unprotected `main` between visibility flip and the protection API call. For a fresh repo nobody knows about, the window is harmless — but worth knowing for repos with pre-flip notoriety.
- [generalizable] **External review pressure during a Public flip is high-quality forcing-function input.** While waiting on the UI flip, three rounds of external review (Clearline) surfaced real medium-priority items (license clarity, input caps, UI warnings, rate-limit opt-in, A3M validation) that we'd have shipped sub-optimally without the pause. The right rhythm is: open the PR for the flip, then keep reviewing in parallel, and don't let "ready to flip" mean "stop reviewing."
- [generalizable] **Narrow interpretation of ambiguous user directives first.** Captured separately as a CLAUDE.md learning log entry from the CORS rollback PR: "Localhostを消して" → broader interpretation (remove all localhost) was technically more secure but added a Quickstart env-var step the user hadn't asked for. The narrower read (drop the 3001 fallback only) was what they meant. When a short directive could mean multiple things, default to the smaller change and confirm before going broader.
- Project-specific: `gh release create --notes-file` reads markdown files committed to the repo. Committing `docs/release-notes/vX.Y.Z.md` for each release gives you a persistent source of truth that survives even if GitHub Releases gets re-imported, plus the file is reviewable as a PR before the tag goes out.
