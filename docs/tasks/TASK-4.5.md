# TASK-4.5 — Test coverage hardening (Tier 1 + Tier 2)

**Status:** In progress
**Branch:** `chore/test-coverage-hardening`
**Started:** 2026-05-25
**Completed:** —

## Context

After 3.1–3.4 + 4.3 the backend has 146 passing tests but the frontend has **zero**. The assembly builder reducer, the `toJobBody` converter (with all its validation branches), and the TS chain-ID generator are completely untested. Edge cases on both sides (NaN values, malformed input, Unicode, oversized payloads, race conditions) are also unverified.

Going Public means strangers will throw arbitrary input at the stack. The user explicitly chose "test it more thoroughly via tests" over manual dogfooding — automation gives us regression-proofing alongside the initial coverage. This task hardens coverage in two tiers, then exits.

## Goal

Frontend test runner + ~25–30 pure-function tests; backend ~25–30 new edge-case tests, ~5 hypothesis property tests, and an OpenAPI snapshot test. All wired into CI. No production-code changes (other than the one-line `reducer` export).

## Requirements

- Vitest installed in `frontend/` with `pnpm test` running all tests headless.
- `frontend/lib/assembly.test.ts`, `frontend/components/assembly-builder/use-assembly-builder.test.ts`, `frontend/components/assembly-builder/chain-ids.test.ts` written (~25–30 tests total).
- `reducer` is exported from `use-assembly-builder.ts` (one-line change, no consumer impact).
- Backend test files appended with ~25–30 new edge-case tests across `test_boltz_output.py`, `test_colabfold.py`, `test_dispatch.py`, `test_jobs.py`, `test_validate.py`, `test_validator.py`.
- `backend/tests/test_properties.py` with 5 hypothesis property tests (round-trip, chain-ID invariants, builder→validator).
- `backend/tests/api/test_openapi_snapshot.py` + `backend/tests/api/openapi.snapshot.json` + `backend/scripts/update_openapi_snapshot.py`.
- CI runs `pnpm test` for the frontend job. Backend job picks new tests up automatically via `pytest`'s `testpaths`.
- All gates (lint / typecheck / test on both sides; mypy strict on backend) green locally and in CI.

## Out of scope

- React component rendering tests (would need jsdom + React Testing Library). CLAUDE.md: "frontend tests only for non-trivial components."
- Playwright / E2E (heavy; manual smoke + real Boltz dogfood already covers this).
- Mutation testing, performance benchmarks, coverage threshold enforcement.
- Any backend production-code refactor — additive tests only.

## Acceptance criteria

- [ ] `cd frontend && pnpm test` exits 0 with ≥25 tests passing (where there were 0).
- [ ] `cd backend && uv run pytest` exits 0 with ≥185 tests passing (was 146; ~+40 new).
- [ ] `cd backend && uv run mypy easyfold` strict, 0 issues.
- [ ] `cd backend && uv run ruff check . && uv run ruff format --check .` clean.
- [ ] OpenAPI snapshot test passes; `python scripts/update_openapi_snapshot.py` is idempotent.
- [ ] CI on the PR: `frontend` and `backend` jobs both green (frontend gains a `pnpm test` step).
- [ ] Deliberately breaking a production branch (e.g. flipping one branch in `toJobBody`) makes the relevant test fail; revert leaves CI green.

## Approach

- Plan mode: yes (full plan reviewed and approved in plan mode before branching).
- Files to reference:
  - `frontend/lib/assembly.ts`, `frontend/components/assembly-builder/use-assembly-builder.ts`, `frontend/components/assembly-builder/chain-ids.ts` — the units under test.
  - `backend/easyfold/af3_input/`, `backend/easyfold/boltz_input/`, `backend/easyfold/inference/` — the source for the property tests + edge-case tests.
  - `backend/tests/conftest.py`, `backend/tests/api/conftest.py` — existing fixtures we'll reuse.
- New dependencies:
  - `vitest` + `@vitest/coverage-v8` (frontend devDependency).
  - `hypothesis` (backend dev dependency).
- No new production deps.

## Implementation notes

- **Frontend tests = pure-function only.** Vitest config `environment: "node"` (no jsdom). Tests import the reducer directly (one-line `export` added to `use-assembly-builder.ts`); the hook itself is untested because all behavior lives in `reducer(state, action)`. Same pattern for `toJobBody` (pure converter) and `chainIdRange` / `excelChainId` (pure utilities). 54 frontend tests run in ~200 ms.
- **Backend tests = 32 new edge cases + 5 properties + 2 snapshot.** Total backend: 146 → 185 passing (+39, +2 still skipped as live). Property tests use small `max_examples` (30–100) per test so the full suite still finishes in <10 s.
- **OpenAPI snapshot.** Stored as committed JSON at `backend/tests/api/openapi.snapshot.json`, indented + sort-keyed for clean diffs. Regen script at `backend/scripts/update_openapi_snapshot.py`; needs `sys.path` injection because `backend/scripts/` isn't a package and `backend/` itself isn't on `sys.path` when running scripts directly. Both `uv run python scripts/update_openapi_snapshot.py` and `uv run python -m scripts.update_openapi_snapshot` work; the former is documented in the test's docstring.
- **Ruff per-file-ignores grew.** Tests deliberately embed Greek alpha (`α`) and embedded NUL bytes to exercise Unicode-rejection paths; `RUF001` would otherwise complain. Property-test prose uses en-dashes; `RUF002`/`RUF003` added to `tests/*.py` glob. Production code is unchanged — the ignores are scoped to `tests/`.
- **CI: one new line.** Frontend job appends `pnpm test`; backend's existing `pytest` invocation picks the new tests up via the configured `testpaths`.
- **No production-code changes** other than the one-line `export` adjustment to `use-assembly-builder.ts` (and re-exporting `Action` type that's consumed by tests). The reducer's surface didn't change for any existing consumer.

## Learnings

<Filled after completion.>
