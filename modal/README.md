# `/modal` — EasyFold inference Functions

This directory holds the deployment metadata + runner script for EasyFold's two inference Functions: **AlphaFold 3** (`easyfold-af3`) and **Boltz-2** (`easyfold-boltz`). The Python code that defines them lives in [`backend/easyfold/inference/`](../backend/easyfold/inference/) — see [ADR 0002](../docs/decisions/0002-af3-on-modal.md) (AF3 + code-layout rationale) and [ADR 0003](../docs/decisions/0003-boltz-on-modal-and-model-result.md) (Boltz + unified `ModelResult`).

EasyFold is **zero-hosting OSS**: you deploy these Functions to your own [Modal](https://modal.com) account and you pay Modal directly for GPU time. We never run inference, never see your data, never pay your bill.

**Pick your model:**

| Model | License | Weights | Best for |
|---|---|---|---|
| AlphaFold 3 | CC-BY-NC-SA 4.0 (non-commercial) | Request via Google (2–3 business days) | Academic use, highest-quality reference predictions |
| Boltz-2 | MIT (commercial OK) | Auto-downloaded on first run | Commercial use, fast start, no approval wait |

You can deploy one or both. They're independent Modal Apps.

---

# AlphaFold 3

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
./modal/deploy.sh          # default: AF3
# or explicitly:
./modal/deploy.sh af3
```

That script runs `uv run modal deploy easyfold/inference/af3.py` from the `backend/` directory. First deploy builds the Docker image (CUDA + JAX + AF3 source) — expect **5–10 minutes**. Subsequent deploys reuse the layer cache and take ~30 seconds.

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
- Run Boltz-2 (that's the sibling Function described below in this README).

---

# Boltz-2

## Prerequisites

1. **Modal account** — same as AF3. No weight request needed; Boltz-2 is MIT-licensed and the weights download automatically on first run.
2. **Local tooling** — `uv` (for the `modal` CLI), `git`.

## One-time setup

### 1. Authenticate the Modal CLI

Same as AF3 (skip if you've already done it):

```bash
cd backend
uv sync
uv run modal setup
```

### 2. (Optional) Create the cache Volume

```bash
uv run modal volume create easyfold-boltz-cache
```

This is **optional**: `inference/boltz_app.py` uses `create_if_missing=True`, so the first deploy self-creates the Volume. Creating it ahead of time just lets you `modal volume ls` to verify before the first run.

The Volume mounts at `/root/.boltz` inside the container — Boltz's default cache path. The first inference downloads ~2 GB of weights into the Volume; subsequent runs reuse them.

### 3. Deploy the Function

```bash
./modal/deploy.sh boltz
```

That runs `uv run modal deploy easyfold/inference/boltz_app.py` from the `backend/` directory. First deploy builds the Docker image (PyTorch + CUDA + boltz) — expect **5–10 minutes**. Subsequent deploys reuse the layer cache.

You should see something like:

```
✓ Created objects.
├── 🔨 Created mount …
├── 🔨 Created image …
└── 🔨 Created function run_boltz.
✓ App deployed in 7.81s! 🎉

View Deployment: https://modal.com/apps/<your-workspace>/main/deployed/easyfold-boltz
```

### 4. Smoke test

```bash
cd backend
uv run modal run easyfold/inference/boltz_app.py::smoke
```

This sends a 30-residue test peptide through Boltz's built-in ColabFold MSA fetcher → Boltz inference and prints the output. Expected:

```
Got <N> chars of mmCIF
pTM=0.7..., ipTM=None, ranking_score=0.7...
```

First smoke run takes ~10–15 minutes (cold start + weight download + MSA + inference). Subsequent runs against the same sequence are ~3–5 min — the cache Volume persists the weight download, and ColabFold caches MSAs server-side.

## Cost notes (Boltz)

| Item | Approx. cost |
|---|---|
| H100 GPU runtime | ~$5/hr on-demand |
| Typical single-protein job | 3–5 min wall time → **~$0.30–0.60 per run** |
| Cache Volume storage | ~$0.10/month for ~2 GB |
| First-deploy weight download | ~5 min × GPU rate = one-time ~$0.40 |

Same per-second billing model as AF3; image build and weight-download GPU time are billed too, so the first run is the most expensive.

## Troubleshooting (Boltz)

| Symptom | Likely cause | Fix |
|---|---|---|
| `boltz: command not found` inside container | Image build failed silently | Re-deploy; check `modal logs` for the `pip install boltz==2.*` step |
| Weights re-download every run | `cache_volume.commit()` not running, or Volume detached | Check the Modal dashboard; ensure the Volume is bound to the function |
| `KeyError: 'plddt'` from `np.load` | Boltz changed `.npz` key names in a release | Update `inference/boltz_output.py` `_load_npz_array` calls |
| `MissingOutputError: confidence_*.json` | Boltz changed output dir layout in a release | Verify against the [Boltz README](https://github.com/jwohlwend/boltz); update `read_boltz_outputs` |
| MSA fetch times out (`--use_msa_server` fails) | ColabFold server under load | Retry; or run Boltz locally first to seed the ColabFold cache |
| `CUDA out of memory` on long sequences | H100 80 GB still exhausted | Switch to multi-GPU or shrink the input (Boltz docs cover both) |

## What this Function does (and doesn't)

**Does:**
- Accept the same `PredictionJob` dict that AF3 accepts (see [ADR 0001](../docs/decisions/0001-af3-input-mapping.md)) — model swappability is the whole point.
- Convert it to Boltz YAML via `easyfold.boltz_input.build_boltz_yaml`.
- Run `boltz predict <input.yaml> --use_msa_server --output_format mmcif`.
- Parse outputs into the unified `ModelResult` shape (`inference/result.py`) — same shape AF3 returns. Boltz-specific raw JSON lives under `extras.confidence_summary`.

**Doesn't:**
- Support protein modifications yet (the UI doesn't expose them; will revisit when Task 3.4 lands).
- Cache MSAs in EasyFold's layer (ColabFold caches server-side; the Modal Function is stateless beyond the weights Volume).
- Run AlphaFold 3 (that's the `easyfold-af3` Function described above).
