from typing import Any

import pytest

from easyfold.boltz_input import InvalidBoltzInput, validate_boltz_input


def _ok_payload() -> dict[str, Any]:
    return {
        "version": 1,
        "sequences": [{"protein": {"id": "A", "sequence": "MEEP"}}],
    }


def test_accepts_minimal_valid_payload() -> None:
    validate_boltz_input(_ok_payload())


def test_rejects_non_dict_top_level() -> None:
    with pytest.raises(InvalidBoltzInput, match="top-level"):
        validate_boltz_input([])  # type: ignore[arg-type]


def test_rejects_missing_version() -> None:
    payload = _ok_payload()
    del payload["version"]
    with pytest.raises(InvalidBoltzInput, match="version"):
        validate_boltz_input(payload)


def test_rejects_unknown_version() -> None:
    payload = _ok_payload()
    payload["version"] = 99
    with pytest.raises(InvalidBoltzInput, match="version"):
        validate_boltz_input(payload)


def test_rejects_missing_sequences() -> None:
    payload = _ok_payload()
    del payload["sequences"]
    with pytest.raises(InvalidBoltzInput, match="sequences"):
        validate_boltz_input(payload)


def test_rejects_empty_sequences_list() -> None:
    payload = _ok_payload()
    payload["sequences"] = []
    with pytest.raises(InvalidBoltzInput, match="at least one"):
        validate_boltz_input(payload)


def test_rejects_sequence_with_both_protein_and_ligand() -> None:
    payload = _ok_payload()
    payload["sequences"] = [
        {
            "protein": {"id": "A", "sequence": "MEEP"},
            "ligand": {"id": "B", "smiles": "CCO"},
        }
    ]
    with pytest.raises(InvalidBoltzInput, match="single-key dict"):
        validate_boltz_input(payload)


def test_rejects_unknown_polymer_key() -> None:
    payload = _ok_payload()
    payload["sequences"] = [{"banana": {"id": "A"}}]
    with pytest.raises(InvalidBoltzInput, match="unknown polymer key"):
        validate_boltz_input(payload)


def test_rejects_duplicate_chain_ids() -> None:
    payload = _ok_payload()
    payload["sequences"] = [
        {"protein": {"id": "A", "sequence": "MEEP"}},
        {"protein": {"id": "A", "sequence": "GGGG"}},
    ]
    with pytest.raises(InvalidBoltzInput, match="duplicate chain id"):
        validate_boltz_input(payload)


def test_rejects_list_chain_id() -> None:
    """Boltz wants one entry per chain — no AF3-style ``id: [A, B]``."""
    payload = _ok_payload()
    payload["sequences"] = [{"protein": {"id": ["A", "B"], "sequence": "MEEP"}}]
    with pytest.raises(InvalidBoltzInput, match="one chain per entry"):
        validate_boltz_input(payload)


def test_rejects_protein_with_non_standard_letters() -> None:
    payload = _ok_payload()
    payload["sequences"] = [{"protein": {"id": "A", "sequence": "MEEP*X"}}]
    with pytest.raises(InvalidBoltzInput, match="non-standard"):
        validate_boltz_input(payload)


def test_rejects_ligand_with_neither_smiles_nor_ccd() -> None:
    payload = _ok_payload()
    payload["sequences"] = [{"ligand": {"id": "A"}}]
    with pytest.raises(InvalidBoltzInput, match=r"smiles.*ccd"):
        validate_boltz_input(payload)


def test_accepts_ligand_with_ccd_only() -> None:
    payload = _ok_payload()
    payload["sequences"] = [{"ligand": {"id": "A", "ccd": ["HEM"]}}]
    validate_boltz_input(payload)


def test_rejects_chain_id_with_lowercase() -> None:
    payload = _ok_payload()
    payload["sequences"] = [{"protein": {"id": "a", "sequence": "MEEP"}}]
    with pytest.raises(InvalidBoltzInput, match=r"\^\[A-Z\]\+"):
        validate_boltz_input(payload)


# ── edge cases (Task 4.5) ─────────────────────────────────────────────


def test_rejects_protein_sequence_with_unicode_letters() -> None:
    """Non-ASCII letters must be rejected (same alphabet as AF3)."""
    payload = _ok_payload()
    payload["sequences"] = [{"protein": {"id": "A", "sequence": "MEEPα"}}]
    with pytest.raises(InvalidBoltzInput, match="non-standard"):
        validate_boltz_input(payload)


def test_accepts_multi_letter_chain_id() -> None:
    """The Excel-style multi-letter chain IDs (``AA``, ``AB``, …) the builder
    emits past chain Z must be accepted by the validator.
    """
    payload = _ok_payload()
    payload["sequences"] = [
        {"protein": {"id": "AA", "sequence": "MEEP"}},
        {"protein": {"id": "AB", "sequence": "GGGG"}},
    ]
    validate_boltz_input(payload)


def test_rejects_first_invalid_entry_when_some_are_valid() -> None:
    """If one entry in ``sequences`` is broken, the validator fails on it
    even if later entries would be fine. (Fail-fast contract.)
    """
    payload = _ok_payload()
    payload["sequences"] = [
        {"protein": {"id": "a", "sequence": "MEEP"}},  # lowercase id → fail
        {"protein": {"id": "B", "sequence": "GGGG"}},  # would be fine alone
    ]
    with pytest.raises(InvalidBoltzInput, match=r"\^\[A-Z\]\+"):
        validate_boltz_input(payload)
