# EasyFold

> **Ask Claude what your AlphaFold 3 prediction means.**

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/license-CC--BY--NC--SA--4.0-lightgrey.svg)](LICENSE)
[![Live demo on Hugging Face Spaces](https://img.shields.io/badge/demo-Hugging%20Face%20Spaces-yellow.svg)](https://huggingface.co/spaces/maiko811/easyfold-demo)
[![Models: AlphaFold 3 + Boltz-2](https://img.shields.io/badge/models-AlphaFold%203%20%2B%20Boltz--2-teal.svg)](#pick-a-model)

![Step 1 — build your assembly: protein + copies + modifications + ligand, with chain ID preview](docs/screenshots/input.png)

> **Build** — point and click your way to a multi-chain assembly with ligands and post-translational modifications. No JSON.

![Step 2 — get a 3D structure, per-residue pLDDT, and PAE heatmap](docs/screenshots/result.png)

> **Predict** — your sequence runs on your own Modal GPU. ~30 seconds to a few minutes. mmCIF + confidence charts render in the browser.

![Step 3 — ask Claude what the numbers mean for your scientific question](docs/screenshots/interpret.png)

> **Interpret** — bring your own [Anthropic API key](https://console.anthropic.com/), ask a question about the structure, and Claude grounds the answer in the actual pLDDT / PAE / ipTM your prediction produced.

---

## What is EasyFold

EasyFold is a web UI that makes [AlphaFold 3](https://github.com/google-deepmind/alphafold3) and [Boltz-2](https://github.com/jwohlwend/boltz) protein structure prediction usable by experimental biologists who don't code.

You paste a sequence (or look it up by UniProt accession / PDB ID), add ligands and modifications if you have them, click **Predict**, and 5–15 minutes later you get a 3D structure, per-residue confidence (pLDDT), pairwise alignment error (PAE), and — uniquely — a natural-language explanation of what those numbers mean for *your* question.

**Three things that make EasyFold different from existing wrappers ([AFusion](https://github.com/Hanziwww/AlphaFold3-GUI), [Tamarind Bio](https://www.tamarind.bio/), [AlphaFold Server](https://alphafoldserver.com/)):**

- **Question-driven input.** You think in proteins, ligands, modifications, and copies — not in AF3's JSON schema. The assembly builder UI maps your scientific question to the underlying spec.
- **LLM interpretation layer.** Ask "Is this DNA-binding pocket trustworthy enough for docking?" and Claude answers in plain English, grounded in the actual pLDDT / PAE / ipTM numbers your prediction produced, with concrete next-step suggestions.
- **Two models behind one UI.** Pick AlphaFold 3 (CC-BY-NC-SA, highest reference quality) or Boltz-2 (MIT, no Google approval needed) per job. Same input shape, same result viewer.

EasyFold is **zero-hosting OSS**: you deploy to your own [Modal](https://modal.com/) account, your GPU bills go to you, we never see your sequences. There's no central EasyFold service to depend on.

---

## Try the demo

**[→ huggingface.co/spaces/maiko811/easyfold-demo](https://huggingface.co/spaces/maiko811/easyfold-demo)**

No install, no GPU, no API key needed (unless you want to try the Interpret panel — that's bring-your-own [Anthropic API key](https://console.anthropic.com/)).

The demo shows three pre-computed structures (1TUP, 1CRN, 6LU7) with the Mol\* viewer, pLDDT / PAE confidence charts, and the Claude interpretation panel. Confidence values in the demo are synthetic; for real predictions on your own sequences, follow the Quickstart below.

---

## Quickstart: run real predictions in ~10 minutes

The fast path uses **Boltz-2** (MIT license, no Google approval). AlphaFold 3 setup is documented in [`modal/README.md`](modal/README.md) — it takes 2–3 business days for Google to approve weight access, so we don't lead with it here.

### Prerequisites

- macOS or Linux with [`uv`](https://docs.astral.sh/uv/), [`pnpm`](https://pnpm.io/), and `git`.
- A free [Modal account](https://modal.com/) (their free tier covers a few predictions).

### Steps

```bash
# 1. Clone + install
git clone https://github.com/maikoo811/easyfold.git
cd easyfold
cd backend && uv sync
cd ../frontend && pnpm install
cd ..

# 2. Authenticate Modal (opens a browser, ~30 sec)
cd backend && uv run modal setup
cd ..

# 3. Deploy the Boltz-2 inference Function to YOUR Modal account
./modal/deploy.sh boltz       # first deploy builds the image, ~5-10 min

# 4. Start backend (terminal 1)
cd backend && uv run uvicorn easyfold.main:app --reload

# 5. Start frontend (terminal 2)
cd frontend && pnpm dev
```

Open `http://localhost:3000`, look up a protein (try **P04637** for p53), and click **Predict with Boltz-2**. Your first prediction takes ~10 minutes (cold start + MSA fetch + inference + ~2 GB weight download into your Modal Volume cache). Subsequent predictions of any sequence take 30 seconds to 5 minutes.

**Want AlphaFold 3 instead?** It's the higher-quality reference model but it's CC-BY-NC-SA (academic use only) and requires Google's approval. Follow [`modal/README.md` § AlphaFold 3](modal/README.md#alphafold-3) for the weight-request → upload → `./modal/deploy.sh af3` flow.

---

## Architecture

EasyFold is a thin web stack in front of two cloud-GPU inference Functions. Nothing important lives in our infrastructure — the heavy compute runs in your Modal account.

```mermaid
flowchart LR
    User[Browser<br/>Next.js UI]
    Backend[FastAPI<br/>backend]
    Modal[Modal Function<br/>your account, your GPU]
    ColabFold[ColabFold<br/>MSA server]
    Claude[Anthropic Claude<br/>BYOK]
    User -- "POST /jobs" --> Backend
    Backend -- "spawn()" --> Modal
    Modal -- "MSA fetch" --> ColabFold
    Modal -- "ModelResult" --> Backend
    Backend -- "poll result" --> User
    User -- "Interpret?" --> Claude
    Claude -- "explanation" --> User
```

The backend is **stateless** — jobs are tracked by Modal's `FunctionCall.object_id` as the URL token, so there's no database, no job queue we maintain, and predictions survive backend restarts. See [ADR 0004](docs/decisions/0004-jobs-api-modal-funcall-as-id.md) for the rationale.

Deeper detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and the [`docs/decisions/`](docs/decisions/) ADRs.

### What leaves your machine

EasyFold is zero-hosting and we never see your data, but a prediction still reaches a few third parties. Worth scanning the table before you run anything IP-sensitive:

| Destination | What's sent | When |
|---|---|---|
| **[api.colabfold.com](https://colabfold.mmseqs.com/)** (ColabFold mmseqs2 MSA server) | Your **protein sequence** (one-letter amino acids) | On every prediction — Boltz fetches the MSA via `--use_msa_server`. |
| **[rest.uniprot.org](https://www.uniprot.org/)** / **[data.rcsb.org](https://www.rcsb.org/)** | The **accession or PDB ID** you typed (e.g. `P04637`, `1TUP`). **No sequence is sent** — the lookup is by ID. | Only when you use the UniProt / PDB lookup tabs. |
| **[api.anthropic.com](https://www.anthropic.com/)** | The prediction's **summary stats** (mean pLDDT, % low-confidence, PAE percentiles, pTM/ipTM) + your free-text question + the model's reply. **No full sequence or raw PAE matrix is sent.** Your own [Anthropic API key](https://console.anthropic.com/) — held only in browser memory (never persisted, never relayed through our backend). | Only when you click **Interpret**. |

If you're handling IP-sensitive sequences, the ColabFold step is the one to scrutinize. Self-hosting a ColabFold mmseqs2 server (the project publishes the Docker image) is the supported escape hatch.

**One more thing — job result URLs are bearer secrets.** Anyone with the `/predict/{jobId}` URL can read the prediction. The `jobId` is Modal's `FunctionCall.object_id` (~131 bits of entropy, unguessable) but treat the URL itself like an API token: don't paste it in chat, screenshots, or email if the result is sensitive.

Security reports: see [`SECURITY.md`](SECURITY.md).

---

## Pick a model

| Your use case | Recommended model | License | First-prediction wait |
|---|---|---|---|
| Just trying it (no install) | The HF demo above | (pre-computed) | 0 min |
| Academic research, highest-quality reference | **AlphaFold 3** | CC-BY-NC-SA 4.0 (non-commercial) | 2–3 days (Google weight approval) + 10 min |
| Commercial use, drug discovery, fast iteration | **Boltz-2** | MIT (commercial OK) | ~10 min (first run; ~30 s thereafter) |
| Predicting a protein with post-translational modifications (PTMs) | **AlphaFold 3** | CC-BY-NC-SA 4.0 | Boltz-2 silently drops PTMs at MVP; the UI disables it when modifications are present |

If you don't fall into a clear bucket: try the demo, then deploy Boltz-2. It's the path that works in one afternoon.

---

## Status

EasyFold is at **MVP**. The end-to-end stack works (sequence → assembly → Modal → result + interpretation), the assembly builder supports proteins / ligands / modifications / multi-chain, and the Boltz path is verified live (Task 3.3 validation, p53 / P04637). What's still pending (closed beta, one-click Modal deploy button, Docker Compose self-host, bioRxiv application note) is tracked in [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## Contributing

Workflow conventions live in [`CLAUDE.md`](CLAUDE.md) (originally written for AI coding agents, but the rules apply to humans too):

- One concern per PR; feature branches; rebase-merge.
- Backend uses `uv` + `ruff` + `mypy --strict` + `pytest`. Frontend uses `pnpm` + `tsc --noEmit` + `eslint`.
- New architectural decisions get an ADR in [`docs/decisions/`](docs/decisions/).
- Per-task long-form notes live in [`docs/tasks/`](docs/tasks/) (use [`docs/TASK_TEMPLATE.md`](docs/TASK_TEMPLATE.md) as the starting point).

Bug reports, feature requests, and design suggestions all welcome via GitHub Issues.

---

## License

This work is licensed under [**CC-BY-NC-SA 4.0**](LICENSE) — inherited from AlphaFold 3's license.

If you exclusively use the **Boltz-2** path (which is [MIT-licensed](https://github.com/jwohlwend/boltz/blob/main/LICENSE)) and don't run AlphaFold 3 weights through the deployment, your work isn't subject to the AF3 non-commercial clause. Commercial users should consult the Boltz-2 license and confirm with their legal team.

---

## Acknowledgements

- **[AlphaFold 3](https://github.com/google-deepmind/alphafold3)** (Google DeepMind) — the reference structure-prediction model EasyFold wraps.
- **[Boltz-2](https://github.com/jwohlwend/boltz)** (Wohlwend et al., MIT) — the MIT-licensed alternative that makes commercial use possible.
- **[Mol\*](https://molstar.org/)** — the embedded 3D structure viewer.
- **[ColabFold](https://github.com/sokrypton/ColabFold)** (Mirdita et al.) — the public mmseqs2 MSA server we delegate to (via Boltz's `--use_msa_server` flag).
- **[Modal](https://modal.com/)** — the cloud-GPU runner.
- **[Anthropic Claude](https://www.anthropic.com/)** — the LLM behind the Interpret panel.
