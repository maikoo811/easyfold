from collections.abc import Callable

import httpx
import pytest
import respx

from easyfold.external import (
    ExternalSourceUnavailable,
    MalformedExternalResponse,
    SequenceNotFound,
    fetch_uniprot,
)
from easyfold.external.uniprot import UNIPROT_BASE


@respx.mock
async def test_fetch_uniprot_happy_path(fixture_text: Callable[[str], str]) -> None:
    respx.get(f"{UNIPROT_BASE}/uniprotkb/P04637.json").mock(
        return_value=httpx.Response(200, text=fixture_text("uniprot_p04637.json"))
    )

    result = await fetch_uniprot("p04637")

    assert result.id == "P04637"
    assert result.source == "uniprot"
    assert result.length == 393
    assert result.sequence.startswith("MEEPQSDPSV")
    assert result.organism == "Homo sapiens"
    assert result.description == "Cellular tumor antigen p53"


@respx.mock
async def test_fetch_uniprot_unknown_accession_raises_not_found() -> None:
    respx.get(f"{UNIPROT_BASE}/uniprotkb/ZZZZZZ.json").mock(
        return_value=httpx.Response(400, json={"messages": ["Invalid accession"]})
    )

    with pytest.raises(SequenceNotFound):
        await fetch_uniprot("ZZZZZZ")


@respx.mock
async def test_fetch_uniprot_malformed_json_raises() -> None:
    respx.get(f"{UNIPROT_BASE}/uniprotkb/P04637.json").mock(
        return_value=httpx.Response(200, text="this is not json")
    )

    with pytest.raises(MalformedExternalResponse):
        await fetch_uniprot("P04637")


@respx.mock
async def test_fetch_uniprot_missing_sequence_field_raises() -> None:
    respx.get(f"{UNIPROT_BASE}/uniprotkb/P04637.json").mock(
        return_value=httpx.Response(200, json={"primaryAccession": "P04637"})
    )

    with pytest.raises(MalformedExternalResponse):
        await fetch_uniprot("P04637")


@respx.mock
async def test_fetch_uniprot_persistent_5xx_raises_unavailable(
    fixture_text: Callable[[str], str],
) -> None:
    respx.get(f"{UNIPROT_BASE}/uniprotkb/P04637.json").mock(
        return_value=httpx.Response(503, text="service unavailable")
    )

    with pytest.raises(ExternalSourceUnavailable):
        await fetch_uniprot("P04637")


@respx.mock
async def test_fetch_uniprot_recovers_after_one_5xx(
    fixture_text: Callable[[str], str],
) -> None:
    route = respx.get(f"{UNIPROT_BASE}/uniprotkb/P04637.json")
    route.side_effect = [
        httpx.Response(503, text="try again"),
        httpx.Response(200, text=fixture_text("uniprot_p04637.json")),
    ]

    result = await fetch_uniprot("P04637")

    assert result.length == 393
    assert route.call_count == 2


@pytest.mark.live
async def test_fetch_uniprot_live_p04637() -> None:
    result = await fetch_uniprot("P04637")
    assert result.id == "P04637"
    assert result.length == 393
    assert result.sequence.startswith("MEEPQSDPSV")
    assert result.organism == "Homo sapiens"
