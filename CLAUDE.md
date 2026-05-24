# EasyFold — Project Context for Claude Code

## What this project is

EasyFold is an open-source web UI that makes AlphaFold 3 and Boltz-2 protein structure prediction usable by experimental biologists who don't code. The differentiation from existing tools (AFusion, Tamarind Bio, AlphaFold Server) is:

1. **Question-driven input UI** — users start from "what do I want to know?", not from AF3 JSON schema
2. **LLM interpretation layer** — pLDDT/PAE/ipTM are explained in natural language with suggested next actions
3. **Multi-model support** — AF3 and Boltz-2 are swappable behind the same UI
4. **Zero-hosting OSS** — each user deploys to their own Modal account; we don't host the production service

Target users: structural biologists, biochemists, drug discovery researchers, globally, English UI.

Full project brief is at `docs/PROJECT_BRIEF.md`. Always read it before making architectural decisions.

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
├── CLAUDE.md                    # this file
├── README.md                    # public-facing, demo-first
├── docs/
│   ├── PROJECT_BRIEF.md         # full project brief
│   ├── ARCHITECTURE.md          # technical decisions log
│   └── decisions/               # ADRs (architecture decision records)
├── frontend/                    # Next.js app
├── backend/                     # FastAPI app
├── modal/                       # Modal deployment scripts
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
2. **Read `docs/PROJECT_BRIEF.md` before architectural decisions.** Don't invent business logic.
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
3. Check `docs/PROJECT_BRIEF.md` if the task touches architecture or product.
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
