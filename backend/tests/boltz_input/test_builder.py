from typing import Any

import pytest
import yaml

from easyfold.af3_input.models import (
    LigandSpec,
    ModificationSpec,
    PredictionJob,
    ProteinSpec,
)
from easyfold.boltz_input import build_boltz_yaml


def _parse(text: str) -> dict[str, Any]:
    return yaml.safe_load(text)


def test_single_protein_produces_minimal_yaml() -> None:
    job = PredictionJob(name="p53", proteins=[ProteinSpec(sequence="MEEP")])
    yaml_text = build_boltz_yaml(job)
    parsed = _parse(yaml_text)

    assert parsed == {
        "version": 1,
        "sequences": [
            {"protein": {"id": "A", "sequence": "MEEP"}},
        ],
    }


def test_homo_dimer_emits_one_entry_per_chain() -> None:
    """Unlike AF3, Boltz wants ``copies=2`` expanded to two ``protein`` entries."""
    job = PredictionJob(
        name="dimer",
        proteins=[ProteinSpec(sequence="MEEP", copies=2)],
    )
    parsed = _parse(build_boltz_yaml(job))

    sequences = parsed["sequences"]
    assert len(sequences) == 2
    assert sequences[0]["protein"] == {"id": "A", "sequence": "MEEP"}
    assert sequences[1]["protein"] == {"id": "B", "sequence": "MEEP"}


def test_protein_plus_ligand_smiles() -> None:
    job = PredictionJob(
        name="complex",
        proteins=[ProteinSpec(sequence="MEEP")],
        ligands=[LigandSpec(smiles="CCO")],
    )
    parsed = _parse(build_boltz_yaml(job))

    assert parsed["sequences"] == [
        {"protein": {"id": "A", "sequence": "MEEP"}},
        {"ligand": {"id": "B", "smiles": "CCO"}},
    ]


def test_ligand_ccd_codes_emit_ccd_key_not_smiles() -> None:
    job = PredictionJob(
        name="heme",
        proteins=[ProteinSpec(sequence="MEEP")],
        ligands=[LigandSpec(ccd_codes=["HEM", "NAG"])],
    )
    parsed = _parse(build_boltz_yaml(job))

    ligand_body = parsed["sequences"][1]["ligand"]
    assert ligand_body["id"] == "B"
    assert ligand_body["ccd"] == ["HEM", "NAG"]
    assert "smiles" not in ligand_body


def test_multiple_proteins_get_sequential_chain_ids() -> None:
    job = PredictionJob(
        name="mixed",
        proteins=[
            ProteinSpec(sequence="MEEP", copies=2),
            ProteinSpec(sequence="GGGG"),
        ],
        ligands=[LigandSpec(smiles="CCO", copies=2)],
    )
    parsed = _parse(build_boltz_yaml(job))

    chain_ids = []
    for entry in parsed["sequences"]:
        ((_, body),) = entry.items()
        chain_ids.append(body["id"])
    assert chain_ids == ["A", "B", "C", "D", "E"]


def test_protein_modifications_are_silently_ignored() -> None:
    """Documented behavior: PTMs in PredictionJob are dropped at MVP for Boltz."""
    job = PredictionJob(
        name="ptm",
        proteins=[
            ProteinSpec(
                sequence="MEEP",
                modifications=[ModificationSpec(ptm_type="PHOSPHO", ptm_position=2)],
            )
        ],
    )
    parsed = _parse(build_boltz_yaml(job))

    protein_body = parsed["sequences"][0]["protein"]
    assert "modifications" not in protein_body
    assert "modification" not in protein_body
    # sequence is still emitted unchanged
    assert protein_body["sequence"] == "MEEP"


def test_output_round_trips_through_yaml() -> None:
    job = PredictionJob(name="roundtrip", proteins=[ProteinSpec(sequence="MEEPGGGG")])
    text = build_boltz_yaml(job)
    parsed = yaml.safe_load(text)
    # Re-emit and re-parse — should be byte-identical structure
    text2 = yaml.safe_dump(parsed, sort_keys=False)
    assert yaml.safe_load(text2) == parsed


@pytest.mark.parametrize("name", ["smoke_test", "MyJob", "p53_dimer"])
def test_job_name_does_not_appear_in_yaml(name: str) -> None:
    """Boltz takes the job identifier from the CLI ``--out_dir``, not the YAML body."""
    job = PredictionJob(name=name, proteins=[ProteinSpec(sequence="MEEP")])
    parsed = _parse(build_boltz_yaml(job))
    assert "name" not in parsed
