# EasyFold

A web UI that makes [AlphaFold 3](https://github.com/google-deepmind/alphafold3) and [Boltz-2](https://github.com/jwohlwend/boltz) protein structure prediction usable by experimental biologists who don't code.

EasyFold differs from existing tools by starting from *the scientific question* rather than the model's JSON schema, explaining results in natural language (pLDDT, PAE, ipTM), and supporting multiple prediction models behind one UI.

**Status:** early skeleton — not yet usable. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the technical plan and [`CLAUDE.md`](CLAUDE.md) for project conventions.

## Try the demo

A static, pre-computed demo runs on Hugging Face Spaces — three structures (1TUP, 1CRN, 6LU7) with Mol\* viewer, pLDDT / PAE charts, and BYOK Claude-API natural-language interpretation. Confidence values in the demo are synthetic for now; real AlphaFold output lands in the self-hosted deployment.

- **Live demo**: link TBD (deploy script lives at `demo/deploy.sh` — see [`demo/README.md`](demo/README.md))

## Repository layout

```
easyfold/
├── frontend/   Next.js 15 + TypeScript + Tailwind + shadcn/ui
├── backend/    FastAPI + Pydantic v2
├── modal/      Modal Functions for production deployment (TBD)
├── demo/       Hugging Face Spaces demo (deploy script + README)
├── scripts/    Dev utilities
├── tests/      Cross-cutting end-to-end tests
└── docs/       ARCHITECTURE.md, ADRs
```

## Local development

```bash
# Frontend
cd frontend && pnpm install && pnpm dev

# Backend
cd backend && uv sync && uv run uvicorn app.main:app --reload
```

## License

[CC-BY-NC-SA 4.0](LICENSE) — inherited from AlphaFold 3. Boltz-2 is MIT; the UI surfaces the difference when a user selects a model.
