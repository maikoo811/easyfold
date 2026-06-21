**English** | [日本語](README.ja.md)

# EasyFold

> **Ask Claude what your AlphaFold 3 prediction means.**

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/license-CC--BY--NC--SA--4.0-lightgrey.svg)](LICENSE)
[![Demo on Hugging Face Spaces](https://img.shields.io/badge/demo-Hugging%20Face%20Spaces-yellow.svg)](https://huggingface.co/spaces/maiko811/easyfold-demo)
[![Models: AlphaFold 3 + Boltz-2](https://img.shields.io/badge/models-AlphaFold%203%20%2B%20Boltz--2-teal.svg)](#pick-a-model)

> ⚠️ **Research tool.** Not for medical, diagnostic, or clinical use.

![Build](docs/screenshots/input.png)

> **Build** — point-and-click multi-chain assemblies with ligands and PTMs. No JSON.

![Predict](docs/screenshots/result.png)

> **Predict** — runs on your own Modal GPU. 30 s to a few minutes per job.

![Interpret](docs/screenshots/interpret.png)

> **Interpret** — bring your own [Anthropic API key](https://console.anthropic.com/) and ask Claude what the numbers mean.

---

## What is EasyFold

A web UI that makes [AlphaFold 3](https://github.com/google-deepmind/alphafold3) and [Boltz-2](https://github.com/jwohlwend/boltz) protein structure prediction usable by experimental biologists who don't code. Paste a sequence, click predict, your own Modal GPU runs it, Claude explains the result. **Sequences and API keys stay in your own cloud** (zero-hosting OSS).

Three things that make EasyFold different from existing wrappers ([AFusion](https://github.com/Hanziwww/AlphaFold3-GUI), [Tamarind Bio](https://www.tamarind.bio/), [AlphaFold Server](https://alphafoldserver.com/)):

- **Question-driven input** — think in proteins / ligands / copies, not in AF3 JSON schemas.
- **LLM interpretation** — Claude grounds its answer in your actual pLDDT / PAE / ipTM, with concrete next-step suggestions.
- **Two models, one UI** — AF3 (high quality, non-commercial) and Boltz-2 (MIT, commercial OK) swappable per job.

---

## Try the demo

**[→ huggingface.co/spaces/maiko811/easyfold-demo](https://huggingface.co/spaces/maiko811/easyfold-demo)**

No install, GPU, or API key needed. Three pre-computed structures: **1TUP** (p53), **1CRN** (crambin), **6LU7** (SARS-CoV-2 main protease).

> ℹ️ Demo confidence values are synthetic — for real numbers, follow the Quickstart.

---

## Quickstart (~10 minutes)

```bash
git clone https://github.com/maikoo811/easyfold.git
cd easyfold

cd backend && uv sync && uv run modal setup && cd ..
./modal/deploy.sh boltz       # first deploy: 5-10 min

# 2 terminals
cd backend && uv run uvicorn easyfold.main:app --reload
cd frontend && pnpm install && pnpm dev
```

Open `http://localhost:3000` and try **P04637** (p53). First prediction ~10 min, subsequent ones 30 s–5 min.

**Want AlphaFold 3?** Requires Google's weight approval (2-3 business days). See [`modal/README.md`](modal/README.md).

---

## What leaves your machine

| Destination | What's sent |
|---|---|
| **api.colabfold.com** | Your protein sequence (Boltz's MSA fetch) |
| **UniProt / RCSB** | Accession or PDB ID only (no sequence) |
| **api.anthropic.com** | Summary stats + your question (no full sequence, no raw PAE). API key stays in browser memory. |

For IP-sensitive sequences, the ColabFold step is the one to scrutinize. Job result URLs are bearer secrets — see [`SECURITY.md`](SECURITY.md) for the full disclosure.

---

## Pick a model

| Use case | Recommended | Wait |
|---|---|---|
| Just trying it | HF demo | 0 min |
| Academic, highest reference quality | **AlphaFold 3** | 2-3 days (Google approval) + 10 min |
| Commercial / drug discovery | **Boltz-2** | ~10 min first run; ~30 s after |
| Proteins with PTMs | **AlphaFold 3** | (Boltz-2 drops PTMs at MVP) |

---

## License

EasyFold's own code is [**CC-BY-NC-SA 4.0**](LICENSE) (inherited from AlphaFold 3). **If you run only the Boltz-2 path, commercial use is OK** under Boltz-2's [MIT license](https://github.com/jwohlwend/boltz/blob/main/LICENSE). Confirm with your legal team for production deployments.

## Contributing

Bug reports, feature requests, and any "this is unclear" feedback welcome via **[Issues](https://github.com/maikoo811/easyfold/issues)** or **[Discussions](https://github.com/maikoo811/easyfold/discussions)**. Workflow conventions: [`CLAUDE.md`](CLAUDE.md).

## Acknowledgements

[AlphaFold 3](https://github.com/google-deepmind/alphafold3) (DeepMind, 2024 Chemistry Nobel) · [Boltz-2](https://github.com/jwohlwend/boltz) (Wohlwend et al., MIT) · [Mol\*](https://molstar.org/) · [ColabFold](https://github.com/sokrypton/ColabFold) (Mirdita et al.) · [Modal](https://modal.com/) · [Anthropic Claude](https://www.anthropic.com/) — EasyFold doesn't exist without any of them.
