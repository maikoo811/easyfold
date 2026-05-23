import pytest
from pydantic import ValidationError

from easyfold.af3_input import (
    LigandSpec,
    ModificationSpec,
    PredictionJob,
    ProteinSpec,
)

TP53_SEQUENCE = (
    "MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP"
    "DEAPRMPEAAPPVAPAPAAPTPAAPAPAPSWPLSSSVPSQKTYPQGLNGTVNLPGRNSFEV"
)


def test_protein_spec_accepts_tp53_fragment() -> None:
    spec = ProteinSpec(sequence=TP53_SEQUENCE)
    assert spec.sequence == TP53_SEQUENCE
    assert spec.copies == 1
    assert spec.modifications == []


def test_protein_spec_uppercases_and_strips_whitespace() -> None:
    spec = ProteinSpec(sequence="  meep\nqsdpsv  ")
    assert spec.sequence == "MEEPQSDPSV"


def test_protein_spec_rejects_empty() -> None:
    with pytest.raises(ValidationError, match="empty"):
        ProteinSpec(sequence="   ")


def test_protein_spec_rejects_non_standard_amino_acid() -> None:
    with pytest.raises(ValidationError, match="non-standard amino acid"):
        ProteinSpec(sequence="MEEPQX")


def test_protein_spec_rejects_copies_zero() -> None:
    with pytest.raises(ValidationError):
        ProteinSpec(sequence="MEEP", copies=0)


def test_protein_spec_rejects_modification_outside_range() -> None:
    with pytest.raises(ValidationError, match="exceeds sequence length"):
        ProteinSpec(
            sequence="MEEP",
            modifications=[ModificationSpec(ptm_type="PHOSPHO", ptm_position=10)],
        )


def test_protein_spec_accepts_modification_at_boundary() -> None:
    spec = ProteinSpec(
        sequence="MEEP",
        modifications=[ModificationSpec(ptm_type="PHOSPHO", ptm_position=4)],
    )
    assert spec.modifications[0].ptm_position == 4


def test_ligand_spec_requires_smiles_or_ccd() -> None:
    with pytest.raises(ValidationError, match="smiles or ccd_codes"):
        LigandSpec()


def test_ligand_spec_accepts_smiles_only() -> None:
    spec = LigandSpec(smiles="CCO")
    assert spec.smiles == "CCO"
    assert spec.ccd_codes == []


def test_ligand_spec_accepts_ccd_only() -> None:
    spec = LigandSpec(ccd_codes=["HEM"])
    assert spec.ccd_codes == ["HEM"]


def test_prediction_job_requires_at_least_one_protein() -> None:
    with pytest.raises(ValidationError):
        PredictionJob(name="x", proteins=[])


def test_prediction_job_defaults_to_single_seed() -> None:
    job = PredictionJob(name="x", proteins=[ProteinSpec(sequence="MEEP")])
    assert job.model_seeds == [1]
