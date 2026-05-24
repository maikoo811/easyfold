"""Boltz-2 inference as a Modal Function.

Sibling to ``easyfold-af3`` (Task 3.1). Boltz-2 is MIT-licensed and
distributes its weights via ``pip install boltz`` — no Google approval,
no separate weight provisioning. The first run after deploy downloads
weights into the ``easyfold-boltz-cache`` Volume mounted at
``/root/.boltz``; subsequent runs reuse the cache.

The Function takes a serialized :class:`PredictionJob` dict
(``PredictionJob.model_dump()``) so the eventual FastAPI caller in
Task 3.3 doesn't need the Pydantic schema in scope. We re-validate
inside the container.

See `modal/README.md` § Boltz-2 for provisioning + smoke-test commands,
and `docs/decisions/0003-boltz-on-modal-and-model-result.md` for the
design rationale (sibling App, ``--use_msa_server`` over ColabFold reuse,
``ModelResult`` unification).

Per the task scope, end-to-end inference is **not exercised in CI** —
the local-entrypoint smoke test is documented for the user to run after
deploy. The pure-Python helpers (``boltz_input``, ``boltz_output``) have
unit-test coverage; the Modal Function itself is verified at import time.
"""

import subprocess
import tempfile
from pathlib import Path
from typing import Any

import modal

from easyfold.boltz_input import build_boltz_yaml
from easyfold.inference.boltz_output import read_boltz_outputs

APP_NAME = "easyfold-boltz"
CACHE_VOLUME_NAME = "easyfold-boltz-cache"
CACHE_MOUNT = "/root/.boltz"  # Boltz CLI's default cache path; persists weight downloads

app = modal.App(APP_NAME)

# Boltz-2 needs PyTorch 2.4 + CUDA 12.4. ``boltz`` ships on PyPI as a
# pure-Python package with weights downloaded lazily on first run.
boltz_image = (
    modal.Image.from_registry("pytorch/pytorch:2.4.1-cuda12.4-cudnn9-runtime", add_python="3.11")
    .apt_install("git")
    .pip_install("boltz==2.*", "pyyaml==6.*")
)

# create_if_missing=True (vs AF3's strict False): Boltz has no manual
# provisioning step, so the first deploy can self-create the cache.
cache_volume = modal.Volume.from_name(CACHE_VOLUME_NAME, create_if_missing=True)


@app.function(
    image=boltz_image,
    gpu="H100",
    timeout=60 * 30,  # 30 min — generous; typical run is 3-5 min after first-cache warmup
    volumes={CACHE_MOUNT: cache_volume},
)
def run_boltz(job_dict: dict[str, Any]) -> dict[str, Any]:
    """Run Boltz-2 inference on a single job and return a unified ModelResult dict.

    Args:
        job_dict: A serialized :class:`PredictionJob`
            (``PredictionJob.model_dump()`` output). We deserialize inside
            the container so callers (Task 3.3's FastAPI route) don't need
            Pydantic in scope.

    Returns:
        Dict produced by :meth:`easyfold.inference.result.ModelResult.to_dict` —
        the same shape ``run_af3`` returns. Boltz-specific raw output
        (``confidence_*.json``) lives under ``["extras"]["confidence_summary"]``.
    """
    from easyfold.af3_input.models import PredictionJob

    job = PredictionJob.model_validate(job_dict)
    yaml_text = build_boltz_yaml(job)

    with tempfile.TemporaryDirectory() as workdir_str:
        workdir = Path(workdir_str)
        input_path = workdir / "input.yaml"
        input_path.write_text(yaml_text)
        output_dir = workdir / "out"

        cmd = [
            "boltz",
            "predict",
            str(input_path),
            "--out_dir",
            str(output_dir),
            "--use_msa_server",  # Boltz's native ColabFold integration
            "--output_format",
            "mmcif",
        ]
        subprocess.run(cmd, check=True)
        # Persist first-run weight download to the Volume
        cache_volume.commit()

        return read_boltz_outputs(output_dir, job_name=job.name).to_dict()


@app.local_entrypoint()
def smoke() -> None:
    """Sanity-check the Boltz deploy by predicting a 30-residue peptide.

    Run with:
        modal run backend/easyfold/inference/boltz.py::smoke

    First run takes ~10-15 min (cold start + weight download + MSA + inference).
    Subsequent runs are ~3-5 min thanks to the cache Volume.
    """
    from easyfold.af3_input.models import PredictionJob, ProteinSpec

    job = PredictionJob(
        name="smoke_test",
        proteins=[ProteinSpec(sequence="MEEPQSDPSVEPPLSQETFSDLWKLLPENN")],
    )
    result = run_boltz.remote(job.model_dump())
    cif_len = len(result["cif"]) if isinstance(result.get("cif"), str) else 0
    print(f"Got {cif_len} chars of mmCIF")
    print(
        f"pTM={result.get('ptm')}, ipTM={result.get('iptm')}, "
        f"ranking_score={result.get('ranking_score')}"
    )
