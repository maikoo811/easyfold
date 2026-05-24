from pathlib import Path

import pytest

from easyfold.inference.input_prep import (
    AF3_RUN_SCRIPT,
    build_af3_command,
    enrich_with_msa,
    write_input_json,
)


def test_write_input_json_creates_workdir_and_file(tmp_path: Path) -> None:
    payload = {"name": "demo", "sequences": []}
    target = write_input_json(payload, tmp_path / "fresh")

    assert target == tmp_path / "fresh" / "input.json"
    assert target.is_file()
    assert '"name": "demo"' in target.read_text()


def test_build_af3_command_defaults_to_norun_data_pipeline(tmp_path: Path) -> None:
    cmd = build_af3_command(
        input_path=tmp_path / "input.json",
        output_dir=tmp_path / "output",
        weights_dir=Path("/weights"),
    )

    assert cmd[0] == "python"
    assert cmd[1] == AF3_RUN_SCRIPT
    assert f"--json_path={tmp_path / 'input.json'}" in cmd
    assert f"--output_dir={tmp_path / 'output'}" in cmd
    assert "--model_dir=/weights" in cmd
    assert "--norun_data_pipeline" in cmd


def test_build_af3_command_with_data_pipeline_omits_flag(tmp_path: Path) -> None:
    cmd = build_af3_command(
        input_path=tmp_path / "in.json",
        output_dir=tmp_path / "out",
        weights_dir=Path("/weights"),
        run_data_pipeline=True,
    )
    assert "--norun_data_pipeline" not in cmd


def test_enrich_with_msa_fills_unpaired_for_matching_sequences() -> None:
    input_json = {
        "name": "demo",
        "sequences": [
            {"protein": {"id": "A", "sequence": "MEEP"}},
            {"protein": {"id": "B", "sequence": "GGGG"}},
        ],
    }
    msas = {"MEEP": ">seq1\nMEEP\n", "GGGG": ">seq2\nGGGG\n"}

    out = enrich_with_msa(input_json, msas)

    assert out["sequences"][0]["protein"]["unpairedMsa"] == ">seq1\nMEEP\n"
    assert out["sequences"][0]["protein"]["pairedMsa"] == ""
    assert out["sequences"][1]["protein"]["unpairedMsa"] == ">seq2\nGGGG\n"


def test_enrich_with_msa_does_not_overwrite_existing() -> None:
    input_json = {
        "name": "demo",
        "sequences": [
            {
                "protein": {
                    "id": "A",
                    "sequence": "MEEP",
                    "unpairedMsa": "existing",
                }
            }
        ],
    }
    out = enrich_with_msa(input_json, {"MEEP": "fresh"})

    assert out["sequences"][0]["protein"]["unpairedMsa"] == "existing"


def test_enrich_with_msa_skips_non_protein_entries() -> None:
    input_json = {
        "name": "demo",
        "sequences": [
            {"ligand": {"id": "A", "smiles": "CCO"}},
            {"protein": {"id": "B", "sequence": "MEEP"}},
        ],
    }
    out = enrich_with_msa(input_json, {"MEEP": "msa"})

    assert "unpairedMsa" not in out["sequences"][0]["ligand"]
    assert out["sequences"][1]["protein"]["unpairedMsa"] == "msa"


def test_enrich_with_msa_is_a_deep_copy() -> None:
    input_json = {"name": "demo", "sequences": [{"protein": {"id": "A", "sequence": "MEEP"}}]}
    out = enrich_with_msa(input_json, {"MEEP": "msa"})

    out["sequences"][0]["protein"]["sequence"] = "MUTATED"
    assert input_json["sequences"][0]["protein"]["sequence"] == "MEEP"


def test_enrich_with_msa_handles_missing_sequence_in_msa_map() -> None:
    input_json = {"name": "demo", "sequences": [{"protein": {"id": "A", "sequence": "MEEP"}}]}
    out = enrich_with_msa(input_json, {})

    assert "unpairedMsa" not in out["sequences"][0]["protein"]


@pytest.mark.parametrize("missing_field", ["sequence", None])
def test_enrich_with_msa_handles_malformed_protein(missing_field: str | None) -> None:
    protein: dict[str, object] = {"id": "A", "sequence": "MEEP"}
    if missing_field == "sequence":
        del protein["sequence"]
    input_json = {"name": "demo", "sequences": [{"protein": protein}]}
    out = enrich_with_msa(input_json, {"MEEP": "msa"})

    assert "sequences" in out
