import pytest

from easyfold.af3_input._chain_ids import excel_chain_id


@pytest.mark.parametrize(
    ("index", "expected"),
    [
        (1, "A"),
        (2, "B"),
        (26, "Z"),
        (27, "AA"),
        (28, "AB"),
        (52, "AZ"),
        (53, "BA"),
        (702, "ZZ"),
        (703, "AAA"),
    ],
)
def test_excel_chain_id_boundaries(index: int, expected: str) -> None:
    assert excel_chain_id(index) == expected


def test_excel_chain_id_rejects_zero() -> None:
    with pytest.raises(ValueError, match=">= 1"):
        excel_chain_id(0)


def test_excel_chain_id_rejects_negative() -> None:
    with pytest.raises(ValueError, match=">= 1"):
        excel_chain_id(-3)
