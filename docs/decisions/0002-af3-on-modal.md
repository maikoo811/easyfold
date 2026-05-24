# ADR 0002 — AlphaFold 3 on Modal

## Status

Accepted — 2026-05-24.

## Context

EasyFold needs a way to run AlphaFold 3 inference on a GPU. Three hard constraints:

1. **Zero-hosting OSS.** EasyFold is intended for solo researchers and small academic groups; the project does not host a shared inference endpoint. Each user runs inference in their own cloud account. CLAUDE.md states this as a non-negotiable design tenet ("each user deploys to their own Modal account; we don't host the production service").
2. **License-restricted weights.** AF3 model weights require explicit Google approval (2–3 business days). We cannot ship weights; users must provision their own.
3. **MSA data path is heavy.** AF3's native data pipeline mounts a multi-hundred-GB MSA/template database and takes hours per job. For an interactive UX this is a non-starter on first use.

We need: a GPU runner pattern that's Python-native, easy to deploy from a single repo, cheap for the user (free-tier-friendly), and skips the heavy MSA path without sacrificing too much quality.

## Decision

Run AF3 inference as a **Modal Function** in the user's own Modal account, with weights mounted from a user-provisioned Modal Volume and MSAs fetched at request time from **ColabFold's public mmseqs2 server**.

### Key sub-decisions

1. **Modal as the runner.** Modal exposes "Python function → cloud GPU" in ~10 lines of code, bills per-second, and has H100 / A100 capacity on demand. The competing options (RunPod, Lambda Labs, self-managed Kubernetes on AWS/GCP) are either substantially more operator-friction or substantially less Python-native. Modal also has a generous free tier that covers the few demo runs a new user will do.

2. **H100 default.** Inference latency is the bottleneck for the user UX (they're waiting in a browser). H100 is ~2× faster than A100 on AF3-like workloads. The per-job cost delta (~$0.20) is small enough that the UX win wins.

3. **ColabFold MSAs over AF3's native data pipeline.** AF3's own pipeline mounts Mgnify/BFD/Uniref (~200 GB) and runs `jackhmmer` / `hhblits` for tens of minutes to hours. ColabFold's mmseqs2 server returns A3M MSAs in seconds for cached sequences and within a few minutes for cold ones, with quality close enough that the prediction differences are usually below pLDDT's noise floor. The community already considers this an acceptable substitution. We run AF3 with `--norun_data_pipeline` and inject `unpairedMsa` ourselves.

4. **Python code in `backend/easyfold/inference/`, not `/modal/`.** Putting `import modal` inside a Python file in a directory literally named `modal/` is a recipe for PyPI-package shadowing (whether by Python's relative-import rules or by `sys.path` ordering). Keeping the Function definition under the existing backend package avoids that and lets us share types/utilities with the rest of the backend. `/modal/` holds only deployment metadata (README + `deploy.sh`), mirroring the `/demo/` layout from Task 2.4.

5. **Shell out to `run_alphafold.py`** rather than call AF3's Python API. The CLI is the published, stable interface; the internal API changes more frequently. `subprocess.run([...])` keeps our coupling to AF3 down to a string list we re-pin per release.

6. **One Volume for weights, function-return for outputs.** Single-job outputs (one mmCIF + two JSONs, total ~2 MB) fit in Modal's response budget. We don't need an output Volume at MVP. If a future task needs to persist outputs across requests (job-tracking API, async result retrieval), the function will start writing to a second Volume.

## Consequences

**Positive**

- Deployment is one shell command (`./modal/deploy.sh`) after a documented one-time provisioning.
- No infrastructure for EasyFold maintainers to operate; bills go to users, who can choose their own GPU class.
- ColabFold's caching means repeat predictions of the same sequence are seconds instead of minutes.
- Boltz-2 (Task 3.2) plugs in as a sibling Function in the same directory, same Volume pattern, same call signature.

**Negative**

- Two external dependencies (Modal + ColabFold) on a request's critical path. Either can be down. We surface ColabFold errors as `ColabFoldError` / `ColabFoldTimeout` so the frontend can show useful messages; Modal failures bubble up as the platform's standard exceptions.
- ColabFold MSA quality is slightly below AF3's full pipeline. Acceptable for most workflows but worth documenting for users who need to compare against published AlphaFold results.
- The AF3 CLI's output directory layout is undocumented in detail and has changed across releases. `output_parse.py` includes a fallback path (`seed-1_sample-0`) for the common case, but a future AF3 release may break parsing — we'll fix forward.

**Open**

- **MSA caching layer.** ColabFold caches server-side; we don't. If a user re-submits the same sequence at high frequency we'd add unnecessary load. Out of scope for 3.1; revisit when the job-tracking API (3.3) is in.
- **Output Volume.** When 3.3 lands we'll persist outputs so the frontend can poll results without keeping a long HTTP connection open. The Function's signature will need to add a `job_id` so the Volume key is predictable.
- **Cold start.** First deploy builds the image (5–10 min). Documented in `modal/README.md`; nothing to do here. If first-request latency becomes a recurring pain we can keep a warm container with `modal.App.cls` and `keep_warm=1`, at the cost of a small idle GPU bill.
