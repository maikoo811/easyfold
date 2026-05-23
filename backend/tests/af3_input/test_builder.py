from easyfold.af3_input import (
    DIALECT,
    VERSION,
    LigandSpec,
    ModificationSpec,
    PredictionJob,
    ProteinSpec,
    build_af3_input,
)


def test_minimal_single_protein_matches_docs_example() -> None:
    job = PredictionJob(
        name="minimal_example",
        proteins=[ProteinSpec(sequence="ACDEFGHIKLMNPQRSTVWY")],
    )

    assert build_af3_input(job) == {
        "name": "minimal_example",
        "modelSeeds": [1],
        "sequences": [
            {"protein": {"id": "A", "sequence": "ACDEFGHIKLMNPQRSTVWY"}},
        ],
        "dialect": DIALECT,
        "version": VERSION,
    }


def test_two_distinct_proteins_get_chain_ids_a_and_b() -> None:
    job = PredictionJob(
        name="dimer",
        proteins=[
            ProteinSpec(sequence="MEEP"),
            ProteinSpec(sequence="GGGG"),
        ],
    )
    sequences = build_af3_input(job)["sequences"]
    assert sequences[0]["protein"]["id"] == "A"
    assert sequences[1]["protein"]["id"] == "B"


def test_homo_dimer_emits_id_as_list() -> None:
    job = PredictionJob(
        name="homodimer",
        proteins=[ProteinSpec(sequence="MEEP", copies=2)],
    )
    body = build_af3_input(job)["sequences"][0]["protein"]
    assert body["id"] == ["A", "B"]
    assert body["sequence"] == "MEEP"


def test_protein_then_ligand_chain_ids_continue() -> None:
    job = PredictionJob(
        name="prot_lig",
        proteins=[
            ProteinSpec(sequence="MEEP"),
            ProteinSpec(sequence="GGGG"),
        ],
        ligands=[LigandSpec(ccd_codes=["HEM"])],
    )
    sequences = build_af3_input(job)["sequences"]
    assert [next(iter(e.keys())) for e in sequences] == ["protein", "protein", "ligand"]
    assert sequences[0]["protein"]["id"] == "A"
    assert sequences[1]["protein"]["id"] == "B"
    assert sequences[2]["ligand"]["id"] == "C"
    assert sequences[2]["ligand"]["ccdCodes"] == ["HEM"]


def test_modifications_round_trip_to_camelcase() -> None:
    job = PredictionJob(
        name="modified",
        proteins=[
            ProteinSpec(
                sequence="MEEPQS",
                modifications=[ModificationSpec(ptm_type="PHOSPHO", ptm_position=4)],
            )
        ],
    )
    body = build_af3_input(job)["sequences"][0]["protein"]
    assert body["modifications"] == [{"ptmType": "PHOSPHO", "ptmPosition": 4}]


def test_ligand_with_smiles_emits_smiles_field() -> None:
    job = PredictionJob(
        name="lig",
        proteins=[ProteinSpec(sequence="MEEP")],
        ligands=[LigandSpec(smiles="CCO")],
    )
    ligand_body = build_af3_input(job)["sequences"][1]["ligand"]
    assert ligand_body["smiles"] == "CCO"
    assert "ccdCodes" not in ligand_body


def test_custom_model_seeds_are_preserved() -> None:
    job = PredictionJob(
        name="seeded",
        proteins=[ProteinSpec(sequence="MEEP")],
        model_seeds=[42, 1729],
    )
    assert build_af3_input(job)["modelSeeds"] == [42, 1729]


def test_top_level_dialect_and_version() -> None:
    job = PredictionJob(name="x", proteins=[ProteinSpec(sequence="MEEP")])
    result = build_af3_input(job)
    assert result["dialect"] == "alphafold3"
    assert result["version"] == 4
