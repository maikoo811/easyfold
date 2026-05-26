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


# ── Input size caps (Task 4.5 follow-up) ─────────────────────────────


def test_protein_spec_rejects_sequence_over_3000_aa() -> None:
    """3000 aa is the documented per-chain ceiling."""
    with pytest.raises(ValidationError):
        ProteinSpec(sequence="A" * 3001)


def test_protein_spec_accepts_sequence_exactly_at_3000_aa() -> None:
    spec = ProteinSpec(sequence="A" * 3000)
    assert len(spec.sequence) == 3000


def test_protein_spec_rejects_copies_above_20() -> None:
    """20 copies covers MVP homo-multimer requests; above that needs design work."""
    with pytest.raises(ValidationError):
        ProteinSpec(sequence="MEEP", copies=21)


def test_protein_spec_rejects_more_than_20_modifications() -> None:
    mods = [ModificationSpec(ptm_type="PHOSPHO", ptm_position=1) for _ in range(21)]
    with pytest.raises(ValidationError):
        ProteinSpec(sequence="A" * 30, modifications=mods)


def test_ligand_spec_rejects_more_than_5_ccd_codes() -> None:
    with pytest.raises(ValidationError):
        LigandSpec(ccd_codes=["HEM", "ATP", "NAG", "MG", "ZN", "FE"])


def test_ligand_spec_rejects_smiles_over_2000_chars() -> None:
    with pytest.raises(ValidationError):
        LigandSpec(smiles="C" * 2001)


def test_prediction_job_rejects_more_than_10_proteins() -> None:
    proteins = [ProteinSpec(sequence="MEEP") for _ in range(11)]
    with pytest.raises(ValidationError):
        PredictionJob(name="big", proteins=proteins)


def test_prediction_job_rejects_more_than_10_ligands() -> None:
    ligands = [LigandSpec(smiles="CCO") for _ in range(11)]
    with pytest.raises(ValidationError):
        PredictionJob(name="big", proteins=[ProteinSpec(sequence="MEEP")], ligands=ligands)


def test_prediction_job_rejects_more_than_5_seeds() -> None:
    with pytest.raises(ValidationError):
        PredictionJob(
            name="seedy", proteins=[ProteinSpec(sequence="MEEP")], model_seeds=[1, 2, 3, 4, 5, 6]
        )


def test_prediction_job_rejects_name_over_100_chars() -> None:
    with pytest.raises(ValidationError):
        PredictionJob(name="x" * 101, proteins=[ProteinSpec(sequence="MEEP")])
