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
2. Check `docs/PROJECT_BRIEF.md` if the task touches architecture or product.
3. Look at recent commits with `git log --oneline -20` to understand where we left off.
4. If the task is ambiguous or scope > 3 steps, propose a plan first.

## Learning log

(Add rules here as we discover them through real work. Keep entries dated and short.)

- _(none yet — will be filled as the project progresses)_
