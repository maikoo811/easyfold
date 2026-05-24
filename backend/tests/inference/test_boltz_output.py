import json
from pathlib import Path

import numpy as np
import pytest

from easyfold.inference.boltz_output import MissingOutputError, read_boltz_outputs
from easyfold.inference.result import ModelResult

_SAMPLE_CIF = "data_smoke\n#\n_entry.id smoke\n"
_SAMPLE_SUMMARY = {"confidence_score": 0.78, "ptm": 0.81, "iptm": 0.45}


def _write_boltz_outputs(
    out_dir: Path,
    job_name: str,
    *,
    cif: str = _SAMPLE_CIF,
    summary: dict[str, object] | None = None,
    plddt: list[float] | None = None,
    pae: list[list[float]] | None = None,
) -> Path:
    job_dir = out_dir / f"boltz_results_{job_name}" / "predictions" / job_name
    job_dir.mkdir(parents=True)
    (job_dir / f"{job_name}_model_0.cif").write_text(cif)
    (job_dir / f"confidence_{job_name}_model_0.json").write_text(
        json.dumps(summary if summary is not None else _SAMPLE_SUMMARY)
    )
    if plddt is not None:
        np.savez(job_dir / f"plddt_{job_name}_model_0.npz", plddt=np.array(plddt))
    if pae is not None:
        np.savez(job_dir / f"pae_{job_name}_model_0.npz", pae=np.array(pae))
    return job_dir


def test_read_boltz_outputs_full_happy_path(tmp_path: Path) -> None:
    _write_boltz_outputs(
        tmp_path,
        "smoke",
        plddt=[72.0, 80.0, 85.0],
        pae=[[0.0, 5.0, 6.0], [5.0, 0.0, 4.0], [6.0, 4.0, 0.0]],
    )

    result = read_boltz_outputs(tmp_path, job_name="smoke")

    assert isinstance(result, ModelResult)
    assert result.model == "boltz2"
    assert result.name == "smoke"
    assert result.cif == _SAMPLE_CIF
    assert result.plddt == [72.0, 80.0, 85.0]
    assert result.pae == [[0.0, 5.0, 6.0], [5.0, 0.0, 4.0], [6.0, 4.0, 0.0]]
    assert result.ptm == 0.81
    assert result.iptm == 0.45
    assert result.ranking_score == 0.78
    assert result.sample_dir_name == "smoke_model_0"
    assert result.extras["confidence_summary"] == _SAMPLE_SUMMARY


def test_read_boltz_outputs_pae_absent_returns_none(tmp_path: Path) -> None:
    _write_boltz_outputs(tmp_path, "single", plddt=[72.0])
    result = read_boltz_outputs(tmp_path, job_name="single")
    assert result.pae is None
    assert result.plddt == [72.0]


def test_read_boltz_outputs_plddt_absent_returns_empty(tmp_path: Path) -> None:
    _write_boltz_outputs(tmp_path, "minimal")
    result = read_boltz_outputs(tmp_path, job_name="minimal")
    assert result.plddt == []
    assert result.pae is None


def test_read_boltz_outputs_accepts_complex_score_aliases(tmp_path: Path) -> None:
    """Some Boltz versions emit ``complex_ptm`` / ``complex_iptm`` instead of plain names."""
    _write_boltz_outputs(
        tmp_path,
        "aliased",
        summary={
            "confidence_score": 0.7,
            "complex_ptm": 0.6,
            "complex_iptm": 0.4,
        },
    )
    result = read_boltz_outputs(tmp_path, job_name="aliased")
    assert result.ptm == 0.6
    assert result.iptm == 0.4


def test_read_boltz_outputs_raises_when_results_dir_missing(tmp_path: Path) -> None:
    with pytest.raises(MissingOutputError, match=r"results directory"):
        read_boltz_outputs(tmp_path, job_name="absent")


def test_read_boltz_outputs_raises_when_cif_missing(tmp_path: Path) -> None:
    job_dir = tmp_path / "boltz_results_partial" / "predictions" / "partial"
    job_dir.mkdir(parents=True)
    (job_dir / "confidence_partial_model_0.json").write_text("{}")
    # No .cif file written
    with pytest.raises(MissingOutputError, match=r"\.cif$"):
        read_boltz_outputs(tmp_path, job_name="partial")


def test_read_boltz_outputs_raises_when_confidence_missing(tmp_path: Path) -> None:
    job_dir = tmp_path / "boltz_results_partial" / "predictions" / "partial"
    job_dir.mkdir(parents=True)
    (job_dir / "partial_model_0.cif").write_text("data_x\n")
    with pytest.raises(MissingOutputError, match=r"confidence_.*\.json$"):
        read_boltz_outputs(tmp_path, job_name="partial")


def test_read_boltz_outputs_handles_missing_summary_keys(tmp_path: Path) -> None:
    _write_boltz_outputs(tmp_path, "empty_summary", summary={})
    result = read_boltz_outputs(tmp_path, job_name="empty_summary")
    assert result.ptm is None
    assert result.iptm is None
    assert result.ranking_score is None
