"""AlphaFold 3 inference as a Modal Function.

The Function runs on the user's own Modal account, mounts user-supplied AF3
weights read-only from a named Volume, fetches per-sequence MSAs from
ColabFold, then shells out to ``run_alphafold.py`` with
``--norun_data_pipeline`` (since MSAs are already injected).

See `modal/README.md` for one-time provisioning (AF3 weight request, Modal
account setup, Volume upload) and `docs/decisions/0002-af3-on-modal.md` for
the design rationale.

Per the task scope, end-to-end inference is **not exercised in CI** — it
requires the user's Google-approved AF3 weights and a Modal account with
GPU credits. The pure-Python helpers in this package have unit-test coverage;
the Modal Function itself is verified at import time only (App registration
makes no network calls).
"""

import subprocess
import tempfile
from pathlib import Path
from typing import Any

import modal

from easyfold.inference.colabfold import fetch_msa_for
from easyfold.inference.input_prep import (
    build_af3_command,
    enrich_with_msa,
    write_input_json,
)
from easyfold.inference.output_parse import read_af3_outputs

APP_NAME = "easyfold-af3"
WEIGHTS_VOLUME_NAME = "easyfold-af3-weights"
WEIGHTS_MOUNT = "/weights"

app = modal.App(APP_NAME)

# AF3 needs CUDA 12.6+, JAX 0.4.34, and the alphafold3 package built from source.
# First deploy builds ~5-10 min; subsequent deploys reuse the layer cache.
af3_image = (
    modal.Image.from_registry("nvidia/cuda:12.6.0-cudnn-devel-ubuntu22.04", add_python="3.11")
    .apt_install("git", "wget", "build-essential", "zlib1g-dev")
    .pip_install("uv")
    .run_commands(
        "git clone --depth=1 https://github.com/google-deepmind/alphafold3.git /opt/alphafold3",
        "cd /opt/alphafold3 && uv pip install --system --no-cache-dir -e .",
        "uv pip install --system --no-cache-dir 'jax[cuda12]==0.4.34'",
    )
    .pip_install("httpx==0.28.*")  # for colabfold.py inside the container
)

weights_volume = modal.Volume.from_name(WEIGHTS_VOLUME_NAME, create_if_missing=False)


@app.function(
    image=af3_image,
    gpu="H100",
    timeout=60 * 30,
    volumes={WEIGHTS_MOUNT: weights_volume},
)
def run_af3(input_json: dict[str, Any], *, with_colabfold_msa: bool = True) -> dict[str, Any]:
    """Run AlphaFold 3 inference on a single job and return the parsed outputs.

    Args:
        input_json: AF3 input JSON dict, e.g. as produced by
            ``easyfold.af3_input.build_af3_input``.
        with_colabfold_msa: When True (default), fetch MSAs from ColabFold's
            mmseqs2 server for each protein chain that doesn't already carry
            ``unpairedMsa``, before invoking AF3 with ``--norun_data_pipeline``.
            When False, the AF3 input must already carry ``unpairedMsa`` /
            ``pairedMsa`` for every protein chain.

    Returns:
        Dict with the AF3Outputs shape (see ``output_parse.AF3Outputs.to_dict``):
        ``{cif, confidences, summary_confidences, sample_dir_name}``.
    """
    if with_colabfold_msa:
        msas: dict[str, str] = {}
        for entry in input_json.get("sequences", []):
            protein = entry.get("protein")
            if not isinstance(protein, dict):
                continue
            sequence = protein.get("sequence")
            if not isinstance(sequence, str) or "unpairedMsa" in protein:
                continue
            if sequence in msas:
                continue
            msas[sequence] = fetch_msa_for(sequence)
        if msas:
            input_json = enrich_with_msa(input_json, msas)

    with tempfile.TemporaryDirectory() as workdir_str:
        workdir = Path(workdir_str)
        input_path = write_input_json(input_json, workdir)
        output_dir = workdir / "output"
        cmd = build_af3_command(
            input_path=input_path,
            output_dir=output_dir,
            weights_dir=Path(WEIGHTS_MOUNT),
        )
        subprocess.run(cmd, check=True)
        return read_af3_outputs(output_dir, job_name=input_json["name"]).to_dict()


@app.local_entrypoint()
def smoke() -> None:
    """Sanity-check the deploy by predicting a 30-residue peptide.

    Run with:
        modal run backend/easyfold/inference/af3.py::smoke

    Requires the ``easyfold-af3-weights`` Volume to be populated. See
    `modal/README.md` for one-time setup.
    """
    from easyfold.af3_input import PredictionJob, ProteinSpec, build_af3_input

    job = build_af3_input(
        PredictionJob(
            name="smoke_test",
            proteins=[ProteinSpec(sequence="MEEPQSDPSVEPPLSQETFSDLWKLLPENN")],
        )
    )
    result = run_af3.remote(job)
    cif_len = len(result["cif"]) if isinstance(result.get("cif"), str) else 0
    print(f"Got {cif_len} chars of mmCIF")
    print(f"summary_confidences: {result.get('summary_confidences')}")
