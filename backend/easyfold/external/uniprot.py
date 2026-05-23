from contextlib import AsyncExitStack
from typing import Any

import httpx

from easyfold.external._http import DEFAULT_TIMEOUT, get_with_retry
from easyfold.external._rate_limit import UNIPROT_LIMITER
from easyfold.external.exceptions import (
    ExternalSourceUnavailable,
    MalformedExternalResponse,
    SequenceNotFound,
)
from easyfold.external.models import FetchedSequence

UNIPROT_BASE = "https://rest.uniprot.org"


async def fetch_uniprot(
    accession: str, *, client: httpx.AsyncClient | None = None
) -> FetchedSequence:
    """Fetch a single UniProtKB entry by accession (e.g. ``P04637``).

    Raises:
        SequenceNotFound: the accession does not exist (UniProt returns 400 or 404).
        ExternalSourceUnavailable: network failure or persistent 5xx.
        MalformedExternalResponse: 2xx body missing required fields or invalid JSON.
    """
    accession_norm = accession.strip().upper()
    url = f"{UNIPROT_BASE}/uniprotkb/{accession_norm}.json"

    async with AsyncExitStack() as stack:
        if client is None:
            client = await stack.enter_async_context(httpx.AsyncClient(timeout=DEFAULT_TIMEOUT))
        async with UNIPROT_LIMITER:
            try:
                response = await get_with_retry(client, url)
            except httpx.HTTPError as exc:
                raise ExternalSourceUnavailable(
                    f"UniProt request failed for {accession_norm}: {exc}"
                ) from exc

        if response.status_code in (400, 404):
            raise SequenceNotFound(f"UniProt has no entry for accession {accession_norm}")
        if response.status_code != 200:
            raise ExternalSourceUnavailable(
                f"UniProt returned HTTP {response.status_code} for {accession_norm}"
            )

        try:
            payload: dict[str, Any] = response.json()
        except ValueError as exc:
            raise MalformedExternalResponse(
                f"UniProt returned non-JSON body for {accession_norm}"
            ) from exc

        return _parse_uniprot_payload(accession_norm, payload)

    raise AssertionError("unreachable")  # pragma: no cover  # narrows AsyncExitStack typing


def _parse_uniprot_payload(accession: str, payload: dict[str, Any]) -> FetchedSequence:
    try:
        sequence_block = payload["sequence"]
        sequence: str = sequence_block["value"]
        length: int = sequence_block["length"]
    except (KeyError, TypeError) as exc:
        raise MalformedExternalResponse(
            f"UniProt response for {accession} missing sequence fields"
        ) from exc

    organism = _safe_get(payload, "organism", "scientificName")
    description = _safe_get(payload, "proteinDescription", "recommendedName", "fullName", "value")

    return FetchedSequence(
        id=accession,
        source="uniprot",
        sequence=sequence,
        organism=organism,
        length=length,
        description=description,
    )


def _safe_get(d: dict[str, Any], *path: str) -> str | None:
    cur: Any = d
    for key in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
        if cur is None:
            return None
    return cur if isinstance(cur, str) else None
