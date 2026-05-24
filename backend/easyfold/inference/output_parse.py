"""Read AlphaFold 3 output files from disk into a normalized dict shape.

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

**Verify on first real end-to-end run** — the exact directory layout depends
on the AF3 version pinned in the Modal image. See `modal/README.md` § Troubleshooting.
"""

import csv
import json
from dataclasses import dataclass
from pathlib import Path


class MissingOutputError(RuntimeError):
    """A required AF3 output file was not present where we expected it."""


@dataclass(frozen=True)
class AF3Outputs:
    """Parsed AlphaFold 3 outputs for a single sample."""

    cif: str
    """mmCIF text of the predicted structure."""
    confidences: dict[str, object]
    """Per-token confidence values (parsed JSON)."""
    summary_confidences: dict[str, object]
    """Aggregate confidence metrics (parsed JSON): ptm, iptm, ranking_score, etc."""
    sample_dir_name: str
    """e.g. ``"seed-1_sample-0"`` — useful for traceability in logs."""

    def to_dict(self) -> dict[str, object]:
        return {
            "cif": self.cif,
            "confidences": self.confidences,
            "summary_confidences": self.summary_confidences,
            "sample_dir_name": self.sample_dir_name,
        }


def read_af3_outputs(output_dir: Path, *, job_name: str) -> AF3Outputs:
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
    summary_confidences = json.loads(summary_path.read_text())
    confidences: dict[str, object] = (
        json.loads(confidences_path.read_text()) if confidences_path.is_file() else {}
    )

    return AF3Outputs(
        cif=cif,
        confidences=confidences,
        summary_confidences=summary_confidences,
        sample_dir_name=sample_dir.name,
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
