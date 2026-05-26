import pytest

from easyfold.af3_input import (
    InvalidAf3Input,
    PredictionJob,
    ProteinSpec,
    build_af3_input,
    validate_af3_input,
)


def _valid() -> dict[str, object]:
    return build_af3_input(PredictionJob(name="ok", proteins=[ProteinSpec(sequence="MEEP")]))


def test_builder_output_passes_validator() -> None:
    validate_af3_input(_valid())


def test_missing_top_level_key_raises() -> None:
    data = _valid()
    del data["dialect"]
    with pytest.raises(InvalidAf3Input, match="dialect"):
        validate_af3_input(data)


def test_wrong_dialect_raises() -> None:
    data = _valid()
    data["dialect"] = "alphafold2"
    with pytest.raises(InvalidAf3Input, match="dialect"):
        validate_af3_input(data)


def test_unsupported_version_raises() -> None:
    data = _valid()
    data["version"] = 99
    with pytest.raises(InvalidAf3Input, match="version"):
        validate_af3_input(data)


def test_empty_model_seeds_raises() -> None:
    data = _valid()
    data["modelSeeds"] = []
    with pytest.raises(InvalidAf3Input, match="modelSeeds"):
        validate_af3_input(data)


def test_non_int_seed_raises() -> None:
    data = _valid()
    data["modelSeeds"] = [1, "two"]
    with pytest.raises(InvalidAf3Input, match=r"modelSeeds\[1\]"):
        validate_af3_input(data)


def test_unknown_polymer_key_raises() -> None:
    data = _valid()
    data["sequences"] = [{"mineral": {"id": "A"}}]
    with pytest.raises(InvalidAf3Input, match="unknown polymer key"):
        validate_af3_input(data)


def test_invalid_chain_id_pattern_raises() -> None:
    data = _valid()
    data["sequences"] = [{"protein": {"id": "a1", "sequence": "MEEP"}}]
    with pytest.raises(InvalidAf3Input, match="chain id"):
        validate_af3_input(data)


def test_duplicate_chain_ids_raise() -> None:
    data = _valid()
    data["sequences"] = [
        {"protein": {"id": "A", "sequence": "MEEP"}},
        {"protein": {"id": "A", "sequence": "GGGG"}},
    ]
    with pytest.raises(InvalidAf3Input, match="duplicate chain id"):
        validate_af3_input(data)


def test_protein_with_non_standard_letter_raises() -> None:
    data = _valid()
    data["sequences"] = [{"protein": {"id": "A", "sequence": "MEEPX"}}]
    with pytest.raises(InvalidAf3Input, match="non-standard"):
        validate_af3_input(data)


def test_ligand_without_smiles_or_ccd_raises() -> None:
    data = _valid()
    data["sequences"] = [{"ligand": {"id": "A"}}]
    with pytest.raises(InvalidAf3Input, match=r"smiles.*ccdCodes"):
        validate_af3_input(data)


# ── edge cases (Task 4.5) ─────────────────────────────────────────────


def test_protein_sequence_with_unicode_letters_raises() -> None:
    """Non-ASCII letters (e.g. Greek alpha) are not in the standard AA set."""
    data = _valid()
    data["sequences"] = [{"protein": {"id": "A", "sequence": "MEEPα"}}]
    with pytest.raises(InvalidAf3Input, match="non-standard"):
        validate_af3_input(data)


def test_protein_sequence_with_null_byte_raises() -> None:
    """Embedded NUL bytes are not standard AAs — must be rejected at validation."""
    data = _valid()
    data["sequences"] = [{"protein": {"id": "A", "sequence": "MEEP\x00G"}}]
    with pytest.raises(InvalidAf3Input, match="non-standard"):
        validate_af3_input(data)


def test_protein_sequence_with_10000_aas_is_accepted_by_validator() -> None:
    """The structural validator deliberately has no size cap — the cap lives
    at the Pydantic input boundary (``ProteinSpec.sequence: max_length=3000``,
    enforced by ``POST /api/v1/jobs``). Keeping the validator unbounded means
    builder-emitted JSON can still be revalidated without spurious failures
    if the Pydantic cap ever loosens.
    """
    data = _valid()
    data["sequences"] = [{"protein": {"id": "A", "sequence": "A" * 10000}}]
    validate_af3_input(data)


def test_chain_id_with_leading_whitespace_raises() -> None:
    """The chain-ID regex is ``^[A-Z]+$`` (anchored) — leading/trailing
    whitespace is rejected.
    """
    data = _valid()
    data["sequences"] = [{"protein": {"id": " A", "sequence": "MEEP"}}]
    with pytest.raises(InvalidAf3Input, match="chain id"):
        validate_af3_input(data)


def test_chain_id_with_trailing_whitespace_raises() -> None:
    data = _valid()
    data["sequences"] = [{"protein": {"id": "A ", "sequence": "MEEP"}}]
    with pytest.raises(InvalidAf3Input, match="chain id"):
        validate_af3_input(data)
