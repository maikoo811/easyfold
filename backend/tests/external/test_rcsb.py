from collections.abc import Callable

import httpx
import pytest
import respx

from easyfold.external import (
    MalformedExternalResponse,
    SequenceNotFound,
    fetch_rcsb,
)
from easyfold.external.rcsb import DATA_BASE, FASTA_BASE


@respx.mock
async def test_fetch_rcsb_happy_path_picks_longest_protein(
    fixture_text: Callable[[str], str],
) -> None:
    respx.get(f"{FASTA_BASE}/1TUP").mock(
        return_value=httpx.Response(200, text=fixture_text("rcsb_1tup.fasta"))
    )
    respx.get(f"{DATA_BASE}/entry/1TUP").mock(
        return_value=httpx.Response(200, text=fixture_text("rcsb_1tup_entry.json"))
    )

    result = await fetch_rcsb("1tup")

    assert result.id == "1TUP"
    assert result.source == "rcsb"
    assert result.length == 219
    assert result.sequence.startswith("SSSVPSQKTY")
    assert result.organism == "Homo sapiens"
    assert result.description == "TUMOR SUPPRESSOR P53 COMPLEXED WITH DNA"


@respx.mock
async def test_fetch_rcsb_falls_back_to_entity_for_organism(
    fixture_text: Callable[[str], str],
) -> None:
    # FASTA without the trailing organism field
    fasta_no_organism = ">1TUP_3|Chains C[auth A]|PROTEIN (P53)|\nSSSVPSQKTYQGSYGFRLGFLHSGTAKSVT\n"
    respx.get(f"{FASTA_BASE}/1TUP").mock(return_value=httpx.Response(200, text=fasta_no_organism))
    respx.get(f"{DATA_BASE}/entry/1TUP").mock(
        return_value=httpx.Response(200, text=fixture_text("rcsb_1tup_entry.json"))
    )
    respx.get(f"{DATA_BASE}/polymer_entity/1TUP/3").mock(
        return_value=httpx.Response(200, text=fixture_text("rcsb_1tup_entity3.json"))
    )

    result = await fetch_rcsb("1TUP")

    assert result.organism == "Homo sapiens"


@respx.mock
async def test_fetch_rcsb_unknown_id_raises_not_found(
    fixture_text: Callable[[str], str],
) -> None:
    respx.get(f"{FASTA_BASE}/ZZZZ").mock(return_value=httpx.Response(404))

    with pytest.raises(SequenceNotFound):
        await fetch_rcsb("ZZZZ")


@respx.mock
async def test_fetch_rcsb_no_protein_chain_raises_malformed() -> None:
    dna_only = ">1XYZ_1|Chain A|DNA|\nATCGATCGATCG\n>1XYZ_2|Chain B|DNA|\nGCTAGCTAGCTA\n"
    respx.get(f"{FASTA_BASE}/1XYZ").mock(return_value=httpx.Response(200, text=dna_only))

    with pytest.raises(MalformedExternalResponse):
        await fetch_rcsb("1XYZ")


@pytest.mark.live
async def test_fetch_rcsb_live_1tup() -> None:
    result = await fetch_rcsb("1TUP")
    assert result.id == "1TUP"
    assert result.source == "rcsb"
    assert result.length == 219
    assert result.sequence.startswith("SSSVPSQKTY")
    assert "Homo sapiens" in (result.organism or "")
