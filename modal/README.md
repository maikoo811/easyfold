# `/modal` — AlphaFold 3 on Modal

This directory holds the deployment metadata + runner script for EasyFold's AlphaFold 3 inference Function. The Python code that defines the Function lives in [`backend/easyfold/inference/`](../backend/easyfold/inference/) (see [ADR 0002](../docs/decisions/0002-af3-on-modal.md) for why).

EasyFold is **zero-hosting OSS**: you deploy the Function to your own [Modal](https://modal.com) account, with your own Google-approved AlphaFold 3 weights, and you pay Modal directly for GPU time. We never run inference, never see your data, never pay your bill.

---

## Prerequisites

1. **Modal account** — sign up at [modal.com](https://modal.com). The free tier includes ~$30/month of compute, plenty for a few demo runs.
2. **AF3 weights** — request access via [Google's AlphaFold 3 form](https://github.com/google-deepmind/alphafold3#obtaining-model-parameters). Approval takes 2–3 business days. Once approved, you get a download link for `af3.bin` plus parameter files.
3. **Local tooling** — `uv` (for the `modal` CLI), `git` (to clone this repo), `pnpm` (only if you also want the frontend).

---

## One-time setup

### 1. Authenticate the Modal CLI

```bash
cd backend
uv sync                       # installs `modal` and friends
uv run modal setup            # opens a browser, prompts you to create a token
```

`modal setup` writes `~/.modal.toml` with your workspace credentials. The other commands below assume that file exists.

### 2. Create the weights Volume

```bash
uv run modal volume create easyfold-af3-weights
```

Volumes are persistent, mounted into the Function at `/weights` (read-only inside our code). The name `easyfold-af3-weights` is hard-coded in `backend/easyfold/inference/af3.py` — keep it as-is unless you also change that constant.

### 3. Upload AF3 weights

AF3 expects a directory layout like:

```
af3_params/
├── af3.bin
└── (other parameter files per AlphaFold 3 release notes)
```

Assuming you downloaded the weights to `~/Downloads/af3_params/`, push them to the Volume:

```bash
uv run modal volume put easyfold-af3-weights ~/Downloads/af3_params/ /
```

This is ~5 GB of upload — takes a few minutes. The Volume bills storage at ~$0.30/month for that footprint.

Verify:

```bash
uv run modal volume ls easyfold-af3-weights
# Should list af3.bin and the other parameter files
```

> **Compatibility note.** The exact filenames in `af3_params/` depend on which AF3 release you downloaded. EasyFold's image pins the `alphafold3` package via `git clone --depth=1 …/alphafold3.git`. If you upgrade weights, you may also need to bump the AF3 source pin in `backend/easyfold/inference/af3.py` and re-deploy.

### 4. Deploy the Function

From the repo root:

```bash
./modal/deploy.sh
```

That script just runs `uv run modal deploy easyfold/inference/af3.py` from the `backend/` directory. First deploy builds the Docker image (CUDA + JAX + AF3 source) — expect **5–10 minutes**. Subsequent deploys reuse the layer cache and take ~30 seconds.

You should see something like:

```
✓ Created objects.
├── 🔨 Created mount …
├── 🔨 Created image …
└── 🔨 Created function run_af3.
✓ App deployed in 8.42s! 🎉

View Deployment: https://modal.com/apps/<your-workspace>/main/deployed/easyfold-af3
```

### 5. Smoke test

```bash
cd backend
uv run modal run easyfold/inference/af3.py::smoke
```

This sends a 30-residue test peptide through ColabFold (MSA) → AF3 (inference) and prints the output. Expected output:

```
Got <N> chars of mmCIF
summary_confidences: {'ptm': 0.7..., 'iptm': None, 'ranking_score': ...}
```

First smoke run takes ~5–10 minutes (cold start + MSA + inference). Subsequent runs against the same sequence are faster because ColabFold caches MSAs server-side.

---

## Cost notes

| Item | Approx. cost |
|---|---|
| H100 GPU runtime | ~$5/hr on-demand |
| Typical single-protein job | 5–10 min wall time → **~$0.50–1 per run** |
| Weights Volume storage | ~$0.30/month for ~5 GB |
| Modal cold start (first run after deploy / a long idle) | ~30 s additional GPU wait |

Modal bills per-second of GPU time. The Function only burns GPU during inference — the ColabFold MSA fetch and result parsing run on CPU and don't tick the GPU meter.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `modal: command not found` | `uv` env not activated | Run via `uv run modal …` from `backend/` |
| `Volume 'easyfold-af3-weights' not found` | Volume not created yet | `uv run modal volume create easyfold-af3-weights` |
| `model_dir does not contain af3.bin` | Weights uploaded to a sub-dir | Re-upload with the right `/` target path, or update `WEIGHTS_MOUNT` |
| `CUDA error: no kernel image is available` | JAX/CUDA mismatch | Bump the JAX pin in `af3_image` (`backend/easyfold/inference/af3.py`); rebuild |
| ColabFold poll times out (`ColabFoldTimeout`) | ColabFold server under load | Retry, or set `with_colabfold_msa=False` and supply MSAs in the input JSON |
| `MissingOutputError: model.cif` | AF3 output layout changed in newer release | Verify against the AF3 release notes; update `output_parse.read_af3_outputs` to match |
| Permission denied writing `/weights/...` | Trying to write to weights Volume (it's read-only by design) | Use a separate Volume for outputs (out of scope for 3.1) |

---

## What this Function does (and doesn't)

**Does:**
- Accept the AF3 input JSON dict produced by `easyfold.af3_input.build_af3_input` (see [ADR 0001](../docs/decisions/0001-af3-input-mapping.md)).
- Fetch per-sequence MSAs from ColabFold's public mmseqs2 server.
- Inject MSAs into the input JSON and call `run_alphafold.py --norun_data_pipeline`.
- Parse outputs and return a dict suitable for the frontend's `ResultViewer` (mmCIF text + confidences).

**Doesn't:**
- Run AF3's full data pipeline (no Mgnify/BFD/Uniref DBs are mounted — see ADR 0002).
- Cache MSAs (ColabFold caches server-side; per-request lookup is fast for cache hits).
- Persist outputs across runs (the function returns the result; Task 3.3 will add an output Volume for the job-tracking API).
- Run Boltz-2 (that's [Task 3.2](../docs/ROADMAP.md), a sibling Function in this directory).
