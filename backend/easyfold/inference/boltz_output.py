"""Read Boltz-2 output files from disk into a :class:`ModelResult`.

Boltz writes outputs under ``<out_dir>/boltz_results_<job_name>/`` per the
project README (https://github.com/jwohlwend/boltz). The exact layout as
of writing is::

    <out_dir>/boltz_results_<job_name>/
    ├── predictions/
    │   └── <job_name>/
    │       ├── <job_name>_model_0.cif         # rank-0 mmCIF
    │       ├── confidence_<job_name>_model_0.json   # summary: confidence_score, ptm, iptm, ...
    │       ├── pae_<job_name>_model_0.npz           # PAE NxN
    │       └── plddt_<job_name>_model_0.npz         # per-residue pLDDT
    └── processed/

**Verify on first real end-to-end run** — both the directory layout and
the JSON key names have changed between Boltz releases. This parser
accepts ``iptm`` / ``complex_iptm`` and ``ptm`` / ``complex_ptm`` as
aliases; pick the canonical set after a smoke run lands. See
`modal/README.md` § Troubleshooting.
"""

import json
from pathlib import Path
from typing import Any, cast

import numpy as np

from easyfold.inference.result import ModelResult, nullable_float


class MissingOutputError(RuntimeError):
    """A required Boltz output file was not present where we expected it."""


def read_boltz_outputs(out_dir: Path, *, job_name: str) -> ModelResult:
    """Parse a Boltz-2 output directory into a :class:`ModelResult`.

    Args:
        out_dir: The directory passed as ``--out_dir`` to ``boltz predict``.
        job_name: The ``name`` field of the original :class:`PredictionJob`.

    Raises:
        MissingOutputError: when the expected results directory or required
            files (mmCIF / confidence JSON) are absent.
    """
    job_results = out_dir / f"boltz_results_{job_name}" / "predictions" / job_name
    if not job_results.is_dir():
        raise MissingOutputError(
            f"Boltz output missing: expected results directory {job_results} (not found)"
        )

    cif_path = job_results / f"{job_name}_model_0.cif"
    summary_path = job_results / f"confidence_{job_name}_model_0.json"
    pae_path = job_results / f"pae_{job_name}_model_0.npz"
    plddt_path = job_results / f"plddt_{job_name}_model_0.npz"

    for required in (cif_path, summary_path):
        if not required.is_file():
            raise MissingOutputError(f"Boltz output missing required file: {required}")

    summary: dict[str, Any] = json.loads(summary_path.read_text())

    plddt: list[float] = []
    if plddt_path.is_file():
        raw_plddt = _load_npz_array(plddt_path, "plddt")
        # Boltz-2 writes pLDDT in 0-1 range; the unified ModelResult contract is
        # 0-100 (AF3 convention, what the /demo/viewer Recharts series expects).
        # Verified on first real end-to-end run 2026-05-24: a Boltz output of
        # ~0.9 means pLDDT 90. Scale up when values look 0-1 (heuristic: max<=1).
        if raw_plddt.size > 0 and float(raw_plddt.max()) <= 1.0:
            raw_plddt = raw_plddt * 100.0
        plddt = raw_plddt.tolist()

    pae: list[list[float]] | None = None
    if pae_path.is_file():
        pae = cast(list[list[float]], _load_npz_array(pae_path, "pae").tolist())

    return ModelResult(
        model="boltz2",
        name=job_name,
        cif=cif_path.read_text(),
        plddt=plddt,
        pae=pae,
        iptm=nullable_float(summary.get("iptm", summary.get("complex_iptm"))),
        ptm=nullable_float(summary.get("ptm", summary.get("complex_ptm"))),
        ranking_score=nullable_float(summary.get("confidence_score")),
        sample_dir_name=f"{job_name}_model_0",
        extras={"confidence_summary": summary},
    )


def _load_npz_array(path: Path, key: str) -> np.ndarray[Any, Any]:
    """Load ``path[key]`` from an ``.npz`` file, normalized to float."""
    with np.load(path) as data:
        arr = data[key]
    return cast("np.ndarray[Any, Any]", arr.astype(float))
