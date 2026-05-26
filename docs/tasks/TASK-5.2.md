# TASK-5.2 — Public release (v1.0.0)

**Status:** In progress
**Branch:** `chore/public-release-v1.0.0`
**Started:** 2026-05-26
**Completed:** —

## Context

The repo is feature-complete for MVP (1.1 → 4.3 + 4.5 test hardening + post-4.5 input limits / body size middleware / security headers / bearer-URL disclosure). The HF demo is live, the README is polished, the security audit (internal + Clearline external) returned no critical findings, and the only thing left between us and Public is the flip itself.

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

- [ ] `https://github.com/maikoo811/easyfold` loads in incognito (README + 3 stacked screenshots + Mermaid diagram all render).
- [ ] `https://huggingface.co/spaces/maiko811/easyfold-demo` still loads in incognito (regression check).
- [ ] Repo Settings shows: visibility = Public, Discussions = Enabled, `main` branch protection active with the rules above.
- [ ] `git ls-remote --tags origin | grep v1.0.0` shows the tag pushed to origin.
- [ ] `https://github.com/maikoo811/easyfold/releases/tag/v1.0.0` shows the release with the notes from `docs/release-notes/v1.0.0.md`.

## Approach

- Plan mode: yes (full sequencing reviewed before branching, including the "Public first, then protect" ordering).
- Files to reference:
  - `docs/release-notes/v1.0.0.md` — the GitHub Release body (committed for posterity + future-version template).
  - `docs/ROADMAP.md` — flip 5.2 to In progress now, Done after the release tag lands.
- New dependencies: none. All operations are `gh` CLI + GitHub UI.

## Implementation notes

<Filled during work.>

## Learnings

<Filled after completion.>
