# EasyFold — Project Context for Claude Code

## What this project is

EasyFold is an open-source web UI that makes AlphaFold 3 and Boltz-2 protein structure prediction usable by experimental biologists who don't code. The differentiation from existing tools (AFusion, Tamarind Bio, AlphaFold Server) is:

1. **Question-driven input UI** — users start from "what do I want to know?", not from AF3 JSON schema
2. **LLM interpretation layer** — pLDDT/PAE/ipTM are explained in natural language with suggested next actions
3. **Multi-model support** — AF3 and Boltz-2 are swappable behind the same UI
4. **Zero-hosting OSS** — each user deploys to their own Modal account; we don't host the production service

Target users: structural biologists, biochemists, drug discovery researchers, globally, English UI.

The product framing and differentiation rationale live in this file (sections **What this project is**, **Differentiation reminders**, **Things that are out of scope for MVP**). There is no separate `PROJECT_BRIEF.md` — the brief is here.

## Tech stack (decided — don't suggest alternatives without asking)

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **3D viewer**: Mol* Viewer (https://molstar.org/)
- **Backend**: FastAPI + Pydantic v2
- **Job queue**: Modal Functions (production) / Celery + Redis (self-host alternative)
- **LLM for interpretation**: Anthropic Claude API (user provides their own key)
- **External APIs**: UniProt REST, RCSB PDB API
- **Demo hosting**: Hugging Face Spaces (CPU free tier)
- **Production deployment**: Modal one-click deploy
- **License**: CC-BY-NC-SA 4.0 (inherits from AlphaFold 3)

## Repository structure

```
easyfold/
├── CLAUDE.md                    # this file — agent contract + project brief
├── README.md                    # public-facing, demo-first
├── docs/
│   ├── ROADMAP.md               # authoritative task list (drives session progression)
│   ├── ARCHITECTURE.md          # technical decisions log
│   ├── TASK_TEMPLATE.md         # starter for new per-task docs
│   ├── decisions/               # ADRs (architecture decision records)
│   ├── tasks/                   # per-task long-form notes (TASK-X.Y.md)
│   └── screenshots/             # README hero + supporting PNGs
├── frontend/                    # Next.js app
├── backend/                     # FastAPI app
├── modal/                       # Modal deployment scripts + provisioning guide
├── demo/                        # Hugging Face Spaces demo
├── scripts/                     # dev utilities
└── tests/
```

## Coding conventions

- **TypeScript**: strict mode, no `any`. Prefer `unknown` and narrow.
- **Python**: 3.11+, type hints required, Pydantic models for all I/O. Use `ruff` for linting and formatting.
- **Naming**: camelCase for TS, snake_case for Python.
- **No comments explaining what the code does** — comments only for why (non-obvious decisions).
- **Component files**: one component per file, named exports preferred.
- **API routes**: REST-style under `/api/v1/`, versioned.

## Workflow rules — IMPORTANT

1. **Always use plan mode for tasks with 3+ steps.** Show me the plan before implementing.
2. **Re-read this file's product framing before architectural decisions** (sections "What this project is" + "Differentiation reminders"). Don't invent business logic.
3. **One concern per PR/commit.** No mixing of feature + refactor + dependency bump.
4. **Ask before adding new dependencies.** Especially for the frontend — bundle size matters.
5. **Never push to `main` directly.** Always use a feature branch.
6. **Never commit secrets.** Use `.env.local` (gitignored). The `.env.example` lists required variables.
7. **Write tests for backend logic.** Frontend tests only for non-trivial components (don't test trivial render).
8. **When stuck or unsure about scope, ask.** Don't guess and ship.

## Autonomous task workflow

The roadmap in `docs/ROADMAP.md` drives session progression. Per-task long-form docs live in `docs/tasks/TASK-<id>.md`, created from `docs/TASK_TEMPLATE.md`.

**At session start:**

1. Read `docs/ROADMAP.md`.
2. The **next task** is the first one with status `Not started` whose dependencies are all `Done`. The roadmap also marks it with `← **NEXT**` for grep-ability.
3. If the user says `continue` (or only greets without naming a task), proceed with that task. If the user says `do task X.Y`, switch to that one — it does not need to be the inferred next.

**Before coding a task:**

1. Copy `docs/TASK_TEMPLATE.md` to `docs/tasks/TASK-<id>.md`.
2. Fill in **Context, Goal, Requirements, Out of scope, Acceptance criteria, Approach**.
3. Enter plan mode and propose the implementation. Wait for the user's approval — *every time*, even when the user has previously said "no questions". A new task is a new approval boundary.
4. Create the feature branch (`<type>/<short-desc>`) before any code edits — per the PR-workflow rule (#5).
5. Update `docs/ROADMAP.md`: status → `In progress`, fill the **Branch** field.

**During the task:**

Append meaningful decisions, surprises, and scope changes to the task doc's **Implementation notes** as they happen. The doc is the long-form record; commit messages stay short.

**After the task:**

1. Verify *every* acceptance criterion. Run the **full** test suite, not just new tests (see learning log: 2026-05-23).
2. Commit, push, `gh pr create`, wait for CI green, `gh pr merge --rebase --delete-branch`, pull main.
3. Update `docs/ROADMAP.md`: status → `Done`, fill **Completed**, move the `← **NEXT**` marker to the new next task.
4. Write **Learnings** in the task doc. If a learning is *generalizable* (would apply to future tasks regardless of subject), copy it to **Learning log** below with the date.
5. Do **not** start the next task automatically — wait for the user's next message. The user says `continue` to proceed, `do task X.Y` to jump, or describes the next thing directly.

## Things that are out of scope for MVP

Do not implement these unless explicitly asked:

- User authentication, accounts, multi-tenancy
- Batch prediction, mutation scanning
- Docking integration
- Hosted service (we are not running production for users)
- Mobile UI (desktop-first)
- Languages other than English

## Differentiation reminders

When designing UI, always check:

- Are we asking the user about *the science*, or about *the JSON schema*? Aim for the former.
- Does the result include natural-language interpretation, or just numbers? Aim for both.
- Can the user start without already knowing AF3's input format? They must be able to.

## Known constraints

- AlphaFold 3 model weights require Google approval (2-3 business days). The repo cannot ship weights.
- AlphaFold 3 is CC-BY-NC-SA 4.0 (non-commercial). Boltz-2 is MIT (commercial OK). The UI must communicate this clearly when a user picks a model.
- AlphaFold Server has 20 requests/day limit and restricted ligands. We are not wrapping that API.

## What to do at the start of every session

1. Read this file (you are, good).
2. Read `docs/ROADMAP.md` to identify the next task — see **Autonomous task workflow** above.
3. Re-read the **What this project is** and **Differentiation reminders** sections above if the task touches architecture or product.
4. Look at recent commits with `git log --oneline -20` to understand where we left off.
5. If the task is ambiguous or scope > 3 steps, propose a plan first.

## Learning log

(Add rules here as we discover them through real work. Keep entries dated and short.)

- 2026-05-23: Task 1.3.5 introduced a regression in UniProt validation (Task 1.3.6 fixed it). Always run all existing tests after design/refactor tasks, not just new ones. Add tests for any logic touched by a refactor.
- 2026-05-23: Next.js 16 App Router rejects `dynamic(..., { ssr: false })` from Server Components. If a component is already `'use client'` and doesn't import server-incompatible code at module load, import it directly from the Server Component; reserve `ssr: false` for client wrappers around code that truly cannot be evaluated server-side. (From Task 2.1.)
- 2026-05-23: ESLint defaults don't ignore `/public/`. When adding vendored bundles or generated assets there, also add the path to `eslint.config.mjs` global ignores — otherwise the lint job scans them and explodes. (From Task 2.1.)
- 2026-05-23: When a 3rd-party library ships `.html`/`.scss`/Node-only files that Turbopack/webpack can't bundle, vendor the library's prebuilt UMD into `/public/` via a `postinstall` script and load it via `<script>` tag at runtime. Loses tree-shaking, gains a clean build. (From Task 2.1, Mol*.)
- 2026-05-23: When a library's exported TypeScript types are wrong or too narrow vs. the runtime shape, define a local interface matching what you actually use instead of fighting the imported type. Faster than `as any`, faster than chasing the library's generic args, and documents your code's contract. (From Task 2.2, Recharts 3.x `TooltipProps`.)
- 2026-05-23: For 2D heatmaps on a chart page, plain SVG (30 LOC of `<rect>` + one delegated `onMouseMove`) outperforms wrapping a chart lib. Reach for a chart lib only when you need its axes, legends, or animations. (From Task 2.2, PAE heatmap.)
- 2026-05-23: `@anthropic-ai/sdk` doesn't bundle for the browser with Turbopack — its top-level client transitively imports Node-only Managed Agents beta paths (`agent-toolset/node.mjs` → `node:fs/promises`). Dynamic import doesn't help because the chunking still walks the graph. For browser-side BYOK Claude calls, raw `fetch` against `POST /v1/messages` with the `anthropic-dangerous-direct-browser-access: true` header is ~30 LOC and 0 KB bundle delta. Reserve the SDK for Node servers or when you need streaming helpers, tool runners, or Managed Agents. (From Task 2.3.)
- 2026-05-23: When parsing structured LLM output, prefer a delimited text protocol (`KEY:\n…` blocks + a small client-side parser) over `output_config.format` unless the target model is on the supported-models list. Robust across models, free of compatibility flags, trivially testable. Reserve `json_schema` for cases where a downstream consumer won't tolerate any drift. (From Task 2.3.)
- 2026-05-23: Summarize before sending to an LLM. Passing raw N×N matrices or long arrays wastes tokens and dilutes signal. A short stats block (means/mins/maxes/percentages) gives the model enough to ground its answer in the actual numbers without flooding context. (From Task 2.3.)
- 2026-05-24: When you delete or rename a Next.js App Router page, `rm -rf .next` before `tsc --noEmit`. The auto-generated `.next/types/validator.ts` keeps references to removed routes and causes typecheck to fail with `Cannot find module '../../app/.../page.js'`. `next build` clears it, but standalone typecheck runs don't. (From Task 2.4.)
- 2026-05-24: Conditional `output: "export"` driven by an env var (e.g. `BUILD_TARGET=demo`) keeps one Next.js codebase serving two deploy targets — full-stack (with API routes, middleware) for production, fully static for HF Spaces / CDN demo. Add a `build:demo` package script so the env var isn't a hidden incantation. (From Task 2.4.)
- 2026-05-24: Next.js static export emits `<route>.html`, not `<route>/index.html`, for non-root routes. Static file servers (and HF Spaces) handle both URL forms via extension fallback, but build-time assertions that look for `index.html` under each route folder will silently fail. (From Task 2.4.)
- 2026-05-24: Unify model-result shapes at model #2, not model #N. When adding a second adapter behind a planned-multi-model surface, refactor the shared shape *as part of the second adapter's commit*. The first refactor is small (single-caller dataclass swap); the N-th is large (every consumer already depends on the per-model shape). Pair the unified shape with an "escape-hatch" field (e.g. `extras: dict[str, Any]`) so model-specific raw signal stays addressable without polluting the common surface. (From Task 3.2, AF3+Boltz `ModelResult`.)
- 2026-05-24: `create_if_missing` on `modal.Volume.from_name` is a deploy-UX dial. Strict (`False`) when you want the deploy to fail loudly if the user skipped a manual provisioning step (license-gated weights). Permissive (`True`) when the resource self-populates on first run and the user has no pre-deploy work (auto-downloaded weights / caches). Document the choice in the source comment + the deploy README. (From Task 3.2, Boltz cache Volume.)
- 2026-05-24: When wrapping an external CLI whose output schema drifts between releases, accept aliases at the parser boundary (`summary.get("iptm", summary.get("complex_iptm"))`) and note in the docstring which canonical form to prefer once a real run lands. Costs one line, makes the parser robust across pinned-version drift, lets you pick the canonical form after observing real output instead of guessing from docs. (From Task 3.2, Boltz confidence JSON.)
- 2026-05-24: Cloud-runner SDKs (Modal, etc.) are usually lazy — `Function.from_name()` and `FunctionCall.from_id()` return references without round-tripping; "not found" surfaces from the first real operation (`.spawn()`, `.get()`) as a generic exception with a substring in the message, not the typed `NotFoundError` the docs suggest. When mapping cloud-runner errors to API responses, plan for **two** signals at every exception site: the typed exception **and** a fallback that pattern-matches the error message. Verify the real shape with a live `curl` before declaring the route done — unit-test mocks won't reveal it. (From Task 3.3.)
- 2026-05-24: Cloud-runner call IDs make excellent public job IDs when state can live entirely in the runner. Skip the UUID-+-mapping-table layer: use Modal's `FunctionCall.object_id` (or equivalent) as the URL token. Stateless backend, no DB, jobs survive process restarts, existing runner tooling (dashboards, logs, cancellation APIs) speaks the same ID. The trade-off is leaking the runner choice in the URL — acceptable when the runner is already part of the user's mental model (BYOC deploys). (From Task 3.3.)
- 2026-05-24: Next 16 `output: "export"` + dynamic routes need (a) at least one placeholder param in `generateStaticParams` (empty array fails the build with "missing generateStaticParams") and (b) a `<Suspense>` boundary around any client component using `useSearchParams`/`usePathname` (CSR-bailout requirement). Split into a server-shell page that exports `generateStaticParams` + Suspense wrapper, and a client subcomponent for the runtime logic. Easy to miss until `pnpm build:demo` fails. (From Task 3.3.)
- 2026-05-24: For cloud-runner integrations, isolate all SDK imports in a single `dispatch.py` (or equivalent) module. Route handlers call your wrapper functions and never touch `modal.*` / `boto3.*` directly. Gives you one place to mock for route-layer tests, one place to migrate when the SDK changes, and one place to test the SDK-specific exception mapping. Pattern repeats for any future runner (RunPod, Beam, self-host Celery). (From Task 3.3.)
- 2026-05-24: When integrating a cloud runner (Modal, Beam, RunPod) for a workload that can't run in CI (cloud GPU, license-gated weights), split the implementation into (a) the decorated entrypoint that just orchestrates and (b) pure-Python helpers that everything testable lives in. The decorated function becomes 20-30 LOC verified at import time; the helpers get full unit-test coverage. Same shape works for any platform-specific decorator. (From Task 3.1.)
- 2026-05-24: Embed "first-real-run verification points" as inline source comments when integrating with an external API/contract you can't exercise in CI. Months later when it breaks, those notes + the README troubleshooting matrix are the fastest path to "what should I check." (From Task 3.1, ColabFold API + AF3 output layout.)
- 2026-05-24: When using Modal's `add_local_python_source(pkg)`, **every** runtime dep the mounted package transitively imports must be present in the image's `pip_install(...)`. Python walks the import graph at container start; any missing dep aborts the container with `ModuleNotFoundError`. CI's "import the App module" check only verifies the local Python env, not the container's. Copy the runtime deps explicitly from `pyproject.toml` into the image — don't rely on the cloud runner's transitive deps to cover yours. (From Task 3.3 first-real-run validation.)
- 2026-05-24: **Never name a Python file (or directory) after a PyPI package the same code imports.** Modal copies the deployed file to `/root/<basename>.py` and prepends `/root` to `sys.path`, so a file named `boltz.py` shadows the installed `boltz` package — `from boltz.main import cli` finds our single-file module and crashes with `'boltz' is not a package`. ADR 0002 warned about this for directory names (`/modal/`); the same rule applies to file names. Use a suffix (`*_app.py`, `*_runner.py`) when the file imports a package that shares its base name. (From Task 3.3 first-real-run validation.)
- 2026-05-24: ML library "optional" deps are often unconditional imports on the hot path. Boltz's README lists `cuequivariance-torch` as optional but `kernel_triangular_mult` imports it unconditionally when `use_kernels=True` (the CLI default). For MVP validation, prefer a `--no_kernels` / `--no_jit` / `--cpu_only` slow-path flag over wrestling with CUDA-native package install (NVIDIA's `cuequivariance-ops-torch` etc. have strict CUDA+PyTorch ABI requirements). The slow path costs 2-3x runtime but the integration is reliable. Re-enable kernels in a follow-up performance pass once correctness is proven. (From Task 3.3, Boltz on Modal.)
- 2026-05-24: When a cloud-runner CLI uses an output directory keyed off the **input file's stem**, name the input file after the logical job identifier (`{job.name}.yaml` instead of `input.yaml`). Mismatched stems → parser looking at the wrong path → "missing output" errors that look like the runner failed when the runner actually succeeded. Cheap one-line fix; document the dependency at the input-write site. (From Task 3.3, Boltz output layout.)
- 2026-05-24: Confidence-score conventions differ across models and need normalization at the parser boundary. AF3 writes pLDDT in 0-100; Boltz-2 writes it in 0-1. Frontend code (charts, LLM stats summarization) is much simpler when both speak the same scale. Use a heuristic at parse time (`if max <= 1.0: scale by 100`) plus a docstring note explaining what was observed in the first real run, so the scaling is robust across pinned-version drift in either model. (From Task 3.3 first-real-run validation.)
- 2026-05-24: Mol* (UMD bundle) defaults to its full UI — State Tree + Sequence panel + Structure Tools sidebar + log panel — which inflates the viewer well past any container `height`. For an embedded viewer (we want a clean 3D + our own controls below), pass explicit layout options to `Viewer.create(host, { layoutIsExpanded: false, layoutShowControls: false, layoutShowSequence: false, layoutShowLog: false, layoutShowLeftPanel: false })`. The default is "Mol* standalone viewer" — not "embedded canvas." (From Task 3.3 first-real-run validation.)
- 2026-05-24: Next.js dev server falls back to port 3001 when 3000 is busy. Backend CORS defaults should include both ports so the first-time-running stack doesn't hit `Network error` from the frontend the moment the user happens to have something else on 3000. Set the default to `http://localhost:3000,http://localhost:3001`. (From Task 3.3 first-real-run validation.)
- 2026-05-24: FastAPI async routes calling sync Modal SDK methods (`call.get(timeout=0)`, `func.spawn(...)`) trigger `AsyncUsageWarning` and block the event-loop thread for the duration. Use the `.aio` variants (`await call.get.aio(timeout=0)`, `await func.spawn.aio(...)`) and make the wrapper functions `async def`. Required for correct async behavior even when functionally appearing to work. (From Task 3.3 first-real-run validation.)
- 2026-05-25: When backend Pydantic already models the full API surface but the UI exposes a subset, build a typed `Draft` shape in the frontend + a one-way `toJobBody()` converter. Keeps UI state ergonomic (React keys, display-only fields like organism / source, input-mode toggles) without forcing components to reason in API JSON. The converter is the single seam where friendly client-side validation lives. (From Task 3.4, AssemblyState → JobCreateBody.)
- 2026-05-25: Surface per-backend / per-model capability differences as **UI affordances**, not as footnotes. Boltz silently drops PTMs at builder time; the Predict button disables Boltz with an inline tooltip when modifications are present rather than letting the user discover the silent loss after a 10-minute inference. Disabled-button + tooltip > fine print. (From Task 3.4, PredictButton.)
- 2026-05-25: For ≤20-option dropdowns that match the project's existing input primitive's styling, a styled native `<select>` is plenty — saves a `@radix-ui/react-select`-style dep. Reach for the richer component only when you genuinely need multi-select, search-as-you-type, or custom item rendering. (From Task 3.4, PTM picker.)
- 2026-05-25: React 19's `react-hooks/immutability` rule forbids reassigning a counter variable inside a `.map` callback (React may re-execute the callback during render). For prefix-sum-style computations (e.g. chain-ID starts that depend on previous entities' `copies`), use an imperative loop wrapped in an IIFE — `reduce` works but is harder to read for the multi-output case. (From Task 3.4, assembly-card chain-id calculation.)
- 2026-05-25: When porting a backend helper to the frontend for UI preview (`excel_chain_id` → TS), drop cross-reference comments on both sides. Easy to forget that the preview can drift from actual backend behavior; one line saves a future head-scratch when one side changes. (From Task 3.4, `chain-ids.ts`.)
- 2026-05-25: Cloud-runner SDKs often expose `get_result(timeout=0)` / equivalent that raises `TimeoutError` while the runner is *still trying to start a container* — not just while a container is actively computing. For crash-looping containers (missing image deps, startup-time import errors), this means the polling route reports "running" forever until the runner's function-level timeout fires. Look for a separate call-graph / status API (Modal: `FunctionCall.get_call_graph()` → `InputStatus.INIT_FAILURE` / `TERMINATED` / `TIMEOUT`); inspect it BEFORE the result poll and flip the job to a terminal-failure state immediately. Fail open if the status API errors so transient hiccups don't spuriously fail jobs. (From Task 3.3 follow-up: `dispatch._check_terminal_failure`.)
- 2026-05-25: Write the public-facing README the moment the product is shippable, not the moment it's polished. A README that says "early skeleton — not yet usable" actively harms a working repo: searches don't surface it, drive-by visitors bounce, and the project deceives itself into thinking it's pre-release long after the actual product works. Threshold for the rewrite is "could a stranger run it end-to-end," not "is everything perfect." (From Task 4.3 README overhaul.)
- 2026-05-25: For OSS projects with mixed-license dependencies, license clarity needs a table, not a paragraph. Map "intended use" → "recommended dep" → "license" → "any waits/gates" so the user can match their situation to a row at a glance. Drug-discovery / commercial readers skim paragraphs and miss the trade-off; the table forces the comparison into their field of view. (From Task 4.3, EasyFold's AF3 vs Boltz-2 license matrix.)
- 2026-05-25: Bundle infra deployment (demo URL going live, OG-image upload, etc.) into the README PR. A README that links to a 404'd demo is worse than a README without a demo link. Treat "the demo URL returns 200" as a hard acceptance criterion in the same PR that adds the link. (From Task 4.3, HF Spaces demo deploy.)
- 2026-05-25: Pure-function reducers (`useReducer` pattern) are the highest-ROI thing to test in a React app — no jsdom, no React Testing Library, just import the reducer and assert `reducer(state, action)` transitions directly. The hook is trivial glue around `useReducer`; if the reducer is right, the hook is right. Pair with a one-line `export` of the previously-module-private reducer; consumers stay unaffected. (From Task 4.5.)
- 2026-05-25: OpenAPI schema snapshots catch accidental API breakage with one assertion. Commit the snapshot JSON, write a 5-line test comparing `app.openapi()` to it, ship a regen script next to the snapshot, and put the regen command in the test's failure message. Intentional API changes get a snapshot bump in the same PR; accidental ones surface in CI. (From Task 4.5.)
- 2026-05-25: Use `hypothesis` for round-trip-stability properties on Pydantic models — "any generated valid input survives `model_validate(model_dump())` unchanged" catches whole classes of serialization bugs (default-factory drift, alias mismatches) that example-based tests miss. Pair with builder→validator invariants for schema generators. Keep `max_examples` small (30–50) so CI stays fast. (From Task 4.5.)
- 2026-05-25: Per-file ruff ignores belong scoped to test files, not the whole repo. Tests deliberately embed lookalike Unicode (Greek α, NUL byte, en-dashes in docstrings) to verify rejection paths or aid readability — production code shouldn't. Glob `tests/**/*.py` in `tool.ruff.lint.per-file-ignores` instead of weakening the project-wide lint config. (From Task 4.5.)
- 2026-05-26: **Update on the 2026-05-24 CORS-3001-fallback entry.** Dropped `http://localhost:3001` from the default for v1.0 — the Quickstart now ships with just `http://localhost:3000`. Rationale: a permissive default that covers the "port-collision edge case" is still a permissive default. Users who actually hit the port collision (Next falls back to 3001) get a one-line override via `EASYFOLD_CORS_ORIGINS`. The previous 2-port default was a 100% case fix for a <10% scenario — wrong trade-off in retrospect.
- 2026-05-26: Verbatim user terms ≠ literal commands. "Localhostを消して" turned out to mean "drop `http://localhost:3001`" (the fallback only), not "remove localhost entirely" → empty CORS default. The semantically broader interpretation was technically more secure but added a Quickstart env-var step the user hadn't asked for. When a short directive is ambiguous in scope, **default to the narrower interpretation** (which doesn't break existing UX) and confirm before going broader. From the Clearline pass-3 CORS rollback PR.
