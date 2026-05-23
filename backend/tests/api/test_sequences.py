from collections.abc import Callable

import httpx
import respx
from httpx import ASGITransport

from easyfold.external.rcsb import DATA_BASE, FASTA_BASE
from easyfold.external.uniprot import UNIPROT_BASE
from easyfold.main import app

transport = ASGITransport(app=app)


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=transport, base_url="http://test")


# ── UniProt ──────────────────────────────────────────────────────────


@respx.mock
async def test_uniprot_happy_path(fixture_text: Callable[[str], str]) -> None:
    respx.get(f"{UNIPROT_BASE}/uniprotkb/P04637.json").mock(
        return_value=httpx.Response(200, text=fixture_text("uniprot_p04637.json"))
    )

    async with _client() as c:
        resp = await c.get("/api/v1/sequences/uniprot/P04637")

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "P04637"
    assert body["source"] == "uniprot"
    assert body["length"] == 393
    assert body["organism"] == "Homo sapiens"


@respx.mock
async def test_uniprot_not_found() -> None:
    respx.get(f"{UNIPROT_BASE}/uniprotkb/ZZZZZZ.json").mock(
        return_value=httpx.Response(400, json={"messages": ["Invalid accession"]})
    )

    async with _client() as c:
        resp = await c.get("/api/v1/sequences/uniprot/ZZZZZZ")

    assert resp.status_code == 404
    assert "detail" in resp.json()


@respx.mock
async def test_uniprot_upstream_error(fixture_text: Callable[[str], str]) -> None:
    respx.get(f"{UNIPROT_BASE}/uniprotkb/P04637.json").mock(
        return_value=httpx.Response(503, text="service unavailable")
    )

    async with _client() as c:
        resp = await c.get("/api/v1/sequences/uniprot/P04637")

    assert resp.status_code == 502
    assert "detail" in resp.json()


async def test_uniprot_invalid_accession() -> None:
    async with _client() as c:
        resp = await c.get("/api/v1/sequences/uniprot/BAD!ID")

    assert resp.status_code == 422


# ── RCSB ─────────────────────────────────────────────────────────────


@respx.mock
async def test_rcsb_happy_path(fixture_text: Callable[[str], str]) -> None:
    respx.get(f"{FASTA_BASE}/1TUP").mock(
        return_value=httpx.Response(200, text=fixture_text("rcsb_1tup.fasta"))
    )
    respx.get(f"{DATA_BASE}/entry/1TUP").mock(
        return_value=httpx.Response(200, text=fixture_text("rcsb_1tup_entry.json"))
    )

    async with _client() as c:
        resp = await c.get("/api/v1/sequences/rcsb/1TUP")

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "1TUP"
    assert body["source"] == "rcsb"
    assert body["length"] == 219
    assert body["organism"] == "Homo sapiens"


@respx.mock
async def test_rcsb_not_found() -> None:
    respx.get(f"{FASTA_BASE}/ZZZZ").mock(return_value=httpx.Response(404))

    async with _client() as c:
        resp = await c.get("/api/v1/sequences/rcsb/ZZZZ")

    assert resp.status_code == 404
    assert "detail" in resp.json()


@respx.mock
async def test_rcsb_upstream_error() -> None:
    respx.get(f"{FASTA_BASE}/1TUP").mock(
        return_value=httpx.Response(503, text="service unavailable")
    )

    async with _client() as c:
        resp = await c.get("/api/v1/sequences/rcsb/1TUP")

    assert resp.status_code == 502
    assert "detail" in resp.json()


async def test_rcsb_invalid_pdb_id() -> None:
    async with _client() as c:
        resp = await c.get("/api/v1/sequences/rcsb/TOOLONG")

    assert resp.status_code == 422
