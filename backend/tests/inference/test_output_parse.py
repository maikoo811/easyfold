import json
from pathlib import Path

import pytest

from easyfold.inference.output_parse import MissingOutputError, read_af3_outputs
from easyfold.inference.result import ModelResult

_SAMPLE_CIF = "data_smoke\n#\n_entry.id smoke\n"
_SAMPLE_SUMMARY = {"ptm": 0.85, "iptm": None, "ranking_score": 0.84}
_SAMPLE_CONFIDENCES = {
    "atom_plddts": [80.0, 85.0],
    "pae": [[0.0, 5.0], [5.0, 0.0]],
}


def _write_sample(
    job_dir: Path,
    sample_name: str,
    *,
    cif: str = _SAMPLE_CIF,
    summary: dict[str, object] | None = None,
    confidences: dict[str, object] | None = None,
) -> Path:
    sample_dir = job_dir / sample_name
    sample_dir.mkdir(parents=True)
    (sample_dir / "model.cif").write_text(cif)
    (sample_dir / "summary_confidences.json").write_text(
        json.dumps(summary if summary is not None else _SAMPLE_SUMMARY)
    )
    if confidences is not None:
        (sample_dir / "confidences.json").write_text(json.dumps(confidences))
    return sample_dir


def test_read_outputs_with_ranking_csv(tmp_path: Path) -> None:
    job_dir = tmp_path / "smoke"
    sample_dir = _write_sample(
        job_dir,
        "seed-1_sample-0",
        confidences=_SAMPLE_CONFIDENCES,
    )
    # Also write a worse sample to confirm we pick by ranking, not by name order
    _write_sample(
        job_dir,
        "seed-1_sample-1",
        summary={"ptm": 0.5, "ranking_score": 0.5},
    )
    (job_dir / "ranking_scores.csv").write_text("seed,sample,ranking_score\n1,0,0.84\n1,1,0.5\n")

    result = read_af3_outputs(tmp_path, job_name="smoke")

    assert isinstance(result, ModelResult)
    assert result.model == "alphafold3"
    assert result.name == "smoke"
    assert result.sample_dir_name == sample_dir.name
    assert result.cif == _SAMPLE_CIF
    assert result.ptm == 0.85
    assert result.iptm is None
    assert result.ranking_score == 0.84
    assert result.plddt == [80.0, 85.0]
    assert result.pae == [[0.0, 5.0], [5.0, 0.0]]
    assert result.extras["summary_confidences"] == _SAMPLE_SUMMARY
    assert result.extras["confidences"] == _SAMPLE_CONFIDENCES


def test_read_outputs_falls_back_to_seed1_sample0(tmp_path: Path) -> None:
    job_dir = tmp_path / "smoke"
    _write_sample(job_dir, "seed-1_sample-0")

    result = read_af3_outputs(tmp_path, job_name="smoke")

    assert result.sample_dir_name == "seed-1_sample-0"
    # confidences.json was omitted → no plddt/pae signal available
    assert result.plddt == []
    assert result.pae is None
    assert result.extras["confidences"] == {}


def test_read_outputs_lowercases_job_name(tmp_path: Path) -> None:
    _write_sample(tmp_path / "smoke", "seed-1_sample-0")

    result = read_af3_outputs(tmp_path, job_name="SMOKE")

    assert result.sample_dir_name == "seed-1_sample-0"
    assert result.name == "SMOKE"  # echoes input; we lowercase only for dir lookup


def test_read_outputs_raises_when_job_dir_missing(tmp_path: Path) -> None:
    with pytest.raises(MissingOutputError, match=r"job directory"):
        read_af3_outputs(tmp_path, job_name="absent")


def test_read_outputs_raises_when_no_sample_dir(tmp_path: Path) -> None:
    job_dir = tmp_path / "smoke"
    job_dir.mkdir()
    with pytest.raises(MissingOutputError, match=r"seed-\*_sample-\*"):
        read_af3_outputs(tmp_path, job_name="smoke")


def test_read_outputs_raises_when_required_file_missing(tmp_path: Path) -> None:
    job_dir = tmp_path / "smoke"
    sample_dir = job_dir / "seed-1_sample-0"
    sample_dir.mkdir(parents=True)
    # Write summary but not the cif
    (sample_dir / "summary_confidences.json").write_text("{}")

    with pytest.raises(MissingOutputError, match=r"model\.cif"):
        read_af3_outputs(tmp_path, job_name="smoke")


def test_read_outputs_prefers_plddt_over_atom_plddts(tmp_path: Path) -> None:
    """Per-residue ``plddt`` (when present) is preferred over the per-token series."""
    _write_sample(
        tmp_path / "smoke",
        "seed-1_sample-0",
        confidences={
            "plddt": [70.0, 75.0, 80.0],
            "atom_plddts": [50.0, 55.0, 60.0, 65.0, 68.0],
        },
    )
    result = read_af3_outputs(tmp_path, job_name="smoke")
    assert result.plddt == [70.0, 75.0, 80.0]


def test_read_outputs_returns_none_pae_when_absent(tmp_path: Path) -> None:
    _write_sample(
        tmp_path / "smoke",
        "seed-1_sample-0",
        confidences={"atom_plddts": [80.0]},
    )
    result = read_af3_outputs(tmp_path, job_name="smoke")
    assert result.pae is None
