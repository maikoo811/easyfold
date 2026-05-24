"""Read AlphaFold 3 output files from disk into a :class:`ModelResult`.

AF3 (as of writing) writes:

    <output_dir>/<job_name_lowercased>/
    ├── seed-<S>_sample-<I>/
    │   ├── model.cif
    │   ├── confidences.json
    │   └── summary_confidences.json
    ├── ranking_scores.csv
    └── ...

For MVP we return the top-ranked sample only. If ``ranking_scores.csv`` is
absent (older or differently-configured AF3 builds), we fall back to the
``seed-1_sample-0`` directory.

**Verify on first real end-to-end run** — the exact directory layout and
the key names inside ``confidences.json`` depend on the AF3 version pinned
in the Modal image. See `modal/README.md` § Troubleshooting.

This module returns the unified :class:`~easyfold.inference.result.ModelResult`
shape (Task 3.2). The raw AF3 confidence JSONs are preserved under
``ModelResult.extras`` so the LLM interpretation pass can still reach
the per-token signal.
"""

import csv
import json
from pathlib import Path
from typing import Any

from easyfold.inference.result import ModelResult, nullable_float


class MissingOutputError(RuntimeError):
    """A required AF3 output file was not present where we expected it."""


def read_af3_outputs(output_dir: Path, *, job_name: str) -> ModelResult:
    """Locate the top-ranked sample under ``output_dir`` and load its files.

    Args:
        output_dir: The ``--output_dir`` passed to ``run_alphafold.py``.
        job_name: The ``name`` field of the AF3 input JSON. AF3 lowercases
            this to form the per-job subdirectory.

    Raises:
        MissingOutputError: when the expected job subdirectory or required
            files (model.cif / summary_confidences.json) are absent.
    """
    job_dir = output_dir / job_name.lower()
    if not job_dir.is_dir():
        raise MissingOutputError(
            f"AF3 output missing: expected job directory {job_dir} (not found)"
        )

    sample_dir = _pick_top_sample(job_dir)

    cif_path = sample_dir / "model.cif"
    confidences_path = sample_dir / "confidences.json"
    summary_path = sample_dir / "summary_confidences.json"

    for required in (cif_path, summary_path):
        if not required.is_file():
            raise MissingOutputError(f"AF3 output missing required file: {required}")

    cif = cif_path.read_text()
    summary: dict[str, Any] = json.loads(summary_path.read_text())
    confidences: dict[str, Any] = (
        json.loads(confidences_path.read_text()) if confidences_path.is_file() else {}
    )

    return ModelResult(
        model="alphafold3",
        name=job_name,
        cif=cif,
        plddt=_extract_plddt(confidences),
        pae=_extract_pae(confidences),
        iptm=nullable_float(summary.get("iptm")),
        ptm=nullable_float(summary.get("ptm")),
        ranking_score=nullable_float(summary.get("ranking_score")),
        sample_dir_name=sample_dir.name,
        extras={"confidences": confidences, "summary_confidences": summary},
    )


def _pick_top_sample(job_dir: Path) -> Path:
    """Use ranking_scores.csv when present; otherwise default to seed-1_sample-0."""
    ranking_csv = job_dir / "ranking_scores.csv"
    if ranking_csv.is_file():
        with ranking_csv.open() as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        if rows:
            # AF3's CSV uses columns like seed,sample,ranking_score sorted best-first.
            top = rows[0]
            seed = top.get("seed")
            sample = top.get("sample")
            if seed is not None and sample is not None:
                candidate = job_dir / f"seed-{seed}_sample-{sample}"
                if candidate.is_dir():
                    return candidate
    fallback = job_dir / "seed-1_sample-0"
    if fallback.is_dir():
        return fallback
    raise MissingOutputError(
        f"AF3 output missing: could not locate any seed-*_sample-* dir under {job_dir}"
    )


def _extract_plddt(confidences: dict[str, Any]) -> list[float]:
    """Best-effort extraction of a per-position pLDDT series from AF3's JSON.

    AF3 writes ``atom_plddts`` (per-token) plus, in some builds, ``plddt``
    (per-residue). We prefer the per-residue series when both are present
    because the ``/demo/viewer`` Recharts series is per-residue. The first
    real end-to-end run will tell us which keys to trust.
    """
    for key in ("plddt", "atom_plddts"):
        value = confidences.get(key)
        if isinstance(value, list) and value:
            return [float(v) for v in value if isinstance(v, int | float)]
    return []


def _extract_pae(confidences: dict[str, Any]) -> list[list[float]] | None:
    """Best-effort extraction of an NxN PAE matrix.

    AF3 writes a ``pae`` key as a list-of-lists. Returns ``None`` when the
    key is absent (some single-chain configurations) or empty.
    """
    pae = confidences.get("pae")
    if not isinstance(pae, list) or not pae:
        return None
    matrix: list[list[float]] = []
    for row in pae:
        if not isinstance(row, list):
            return None
        matrix.append([float(v) for v in row if isinstance(v, int | float)])
    return matrix
