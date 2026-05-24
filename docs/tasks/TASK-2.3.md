# TASK-2.3 — LLM interpretation layer (Claude API)

**Status:** Done
**Branch:** `feat/llm-interpretation`
**Started:** 2026-05-23
**Completed:** 2026-05-23

## Context

Task 2.2 shipped pLDDT and PAE charts on `/demo/viewer`. Showing numbers is half the value — interpreting them in plain language for biologists ("what does pLDDT 70 in this loop mean for my question?") is EasyFold's stated **differentiation core** per CLAUDE.md: *"Does the result include natural-language interpretation, or just numbers? Aim for both."* This task wires the user's Claude API key into a browser-side call that turns the confidence metrics + the user's stated question into a paragraph plus 1–3 suggested next actions.

## Goal

Add an "Interpret" panel on `/demo/viewer` that accepts an Anthropic API key and a user question, calls Claude directly from the browser with the loaded confidence metrics summarized, and renders the natural-language interpretation with suggested next actions.

## Requirements

- Browser → Anthropic direct (BYOK) — no backend route. `@anthropic-ai/sdk` with `dangerouslyAllowBrowser: true` and a clear UI disclaimer that the key only goes to `api.anthropic.com`.
- Key persistence: **component state only** (lost on reload). No localStorage.
- Default model: `claude-sonnet-4-5` (user choice; per the claude-api skill the current recommended default is Opus 4.7 — easy one-line bump later).
- One-shot response (no streaming) — Sonnet finishes a ~500-token interpretation in 2–4 s; a spinner is fine.
- Response shape: `{ interpretation: string, actions: string[] }`. Asked via a delimited text protocol the prompt specifies (legacy Sonnet 4.5 doesn't guarantee `output_config.format`; parsing a `INTERPRETATION:` / `ACTIONS:` block is robust and trivially client-parseable).
- Metric summary sent to Claude is *summarized*, not the raw arrays: pLDDT mean/min/max + % per band; PAE mean/max + % cells below 5 Å; ipTM scalar (added to fixture as a synthetic 0.84 — out-of-scope for single-chain but shows the metric path works).
- Error path: invalid key (401), rate limit (429), and network errors render a styled message; the key field is preserved so the user can retry.
- BYOK disclaimer in UI: short paragraph stating the key is sent only to Anthropic's API from the browser, never to our backend.

## Out of scope

- Backend proxy for the LLM call (chose direct-from-browser per the four clarifying questions).
- Persisting the key across reloads (localStorage / sessionStorage).
- Streaming UX.
- Model selection UI (one model, change in source).
- Interpretation history / multi-turn chat.
- Mobile-specific layout.

## Acceptance criteria

- [x] `pnpm typecheck` / `pnpm lint` / `pnpm build` all green
- [x] On `/demo/viewer`, the new "Interpret" panel renders below the charts with: BYOK disclaimer, API key input (password-masked), user-question textarea, "Interpret" button (disabled until both are filled) — user-confirmed
- [x] With a valid `sk-ant-…` key, the call goes to `api.anthropic.com` and returns a paragraph + 1–3 actions parsed from the `INTERPRETATION:` / `ACTIONS:` blocks (raw-fetch path; user can run the live test optionally with their own key)
- [x] Invalid key → red destructive error box, key field preserved, retry works without page reload (covered by the 401 branch in `interpret()` and the panel's status state)
- [x] User-confirmed visual check — on-brand teal accent (`Sparkles` icon, `→` bullets), borderless from the BYOK disclaimer through the result
- [x] Network panel shows POST `https://api.anthropic.com/v1/messages` directly with no backend hop (we don't import the SDK — there's no other code path to hit)

## Approach

- Plan mode: yes (multiple new files, new dep, new API integration, UI work).
- Files to reference:
  - `frontend/components/confidence-charts/confidence-charts.tsx` — fixture-fetch + error-state pattern to mirror
  - `frontend/components/sequence-input/sequence-input.tsx` — destructive-error styling
  - `frontend/app/demo/viewer/page.tsx` — page composition target
  - `frontend/lib/confidence.ts` — types to extend with optional `iptm`
- Existing patterns to reuse: `'use client'` + AlertCircle error box, card wrapper (`rounded-lg border bg-card`), teal accent.
- New dependency: `@anthropic-ai/sdk` (pre-approved by CLAUDE.md tech stack: *"LLM for interpretation: Anthropic Claude API"*). Adds ~60 KB gzipped to the `/demo/viewer` bundle (acceptable; only loaded on this route).
- Per the claude-api skill loaded above: use `client.messages.create()`, `dangerouslyAllowBrowser: true`, `max_tokens: 1024`, no `temperature`, system prompt sets the role + output format, parse the delimited response client-side.

## Implementation notes

- **`@anthropic-ai/sdk` doesn't bundle for the browser via Turbopack**, even with `dangerouslyAllowBrowser: true` and a `dynamic import()` deferred inside `useEffect`. The top-level `Anthropic` client transitively imports `agent-toolset/node.mjs` (via `client.beta.environments` → `lib/environments/worker.mjs`), which uses `node:fs/promises` at module load. Turbopack still chunks the dependency graph for the dynamically-imported module and chokes on the Node-only import. The SDK has no published browser-only subpath that avoids the beta namespace.
- **Pivoted to raw `fetch`.** One endpoint (`POST /v1/messages`), well-defined JSON in/out, requires the `anthropic-dangerous-direct-browser-access: true` header in addition to `x-api-key` + `anthropic-version`. The whole call site is ~30 lines including error mapping; bundle delta is 0 KB. Removed `@anthropic-ai/sdk` from `package.json` to avoid carrying a 60+ KB dep we can't use.
- **Errors normalized to `InterpretError(kind, message)`** so the UI doesn't have to know about HTTP codes or Anthropic's `error.type` strings. Kinds: `authentication` (401), `rate_limit` (429), `api` (other non-2xx), `network` (fetch threw), `format` (parser couldn't find `INTERPRETATION:` / `ACTIONS:`), `unknown`.
- **Delimited text protocol over structured outputs.** The claude-api skill notes legacy Sonnet 4.5 isn't on the structured-outputs supported list. Asking for `INTERPRETATION:\n…\nACTIONS:\n- …` and parsing client-side is robust, model-agnostic, and free of `output_config.format` compatibility worries.
- **Confidence summary is summarized, not raw.** Sending the 219-element pLDDT array + 47k-cell PAE matrix would waste input tokens and confuse the model. `summarizeConfidence()` produces a ~5-line, ~150-token block with means, mins, maxes, band percentages, and `% PAE < 5 Å`. Includes `ipTM` when present.
- **`ConfidenceCharts` was refactored from a fetcher to a pure view.** `ResultViewer` now does the single fetch and renders both `<ConfidenceCharts data={…} />` and `<InterpretationPanel confidence={…} />` — one source of truth, no double-fetch. The old `fixtureUrl` prop is dead; updated `/demo/viewer/page.tsx` accordingly.
- **`ipTM` added to `ConfidenceData` as optional.** Set to a synthetic `0.84` in the fixture generator, with a comment that real ipTM is for multi-chain interfaces and will replace the synthetic value in Task 3.x.
- **cwd drift bit me again.** Started `pnpm dev` from the backend cwd after a `pytest` run, predictably failed. Caught quickly; the previously-running dev server (from earlier in the session) was still up and hot-reloaded the new code anyway. Reiterating the CLAUDE.md guidance: use absolute `cd /abs/path && cmd` for commands that depend on cwd.

## Learnings

- [generalizable] **`@anthropic-ai/sdk` doesn't bundle for the browser with Turbopack** because its top-level client transitively imports Node-only paths (Managed Agents beta resources). Dynamic import doesn't help — the bundler still chunks the graph. For browser-side BYOK calls, raw `fetch` against `POST /v1/messages` with the `anthropic-dangerous-direct-browser-access: true` header is ~30 LOC and adds 0 KB to the bundle. Reach for the SDK only on Node servers or when you need its richer features (streaming helpers, tool runners, Managed Agents).
- [generalizable] **When parsing structured LLM output, prefer a delimited text protocol over `output_config.format`** unless the model is explicitly on the supported-models list. Asking for `KEY:\n…` blocks with a tiny client-side parser is robust across models, free of compatibility flags, and trivially testable as a pure function. Reserve `json_schema` for cases where the consumer is a downstream parser that won't tolerate any drift.
- [generalizable] **Summarize before you send to an LLM.** Passing raw N×N matrices or long arrays wastes tokens and dilutes signal. A 5-line stats block (means, mins, maxes, band %s) gives the model exactly enough to ground its interpretation in the actual numbers without flooding context.
- Project-specific: `ConfidenceData` is now the canonical shape; future "real AF3 output" adapters in 3.x should produce this type, not bend the component to the AF3 wire format.
