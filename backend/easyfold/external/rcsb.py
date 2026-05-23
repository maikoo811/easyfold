import re
from contextlib import AsyncExitStack
from dataclasses import dataclass
from typing import Any

import httpx

from easyfold.external._http import DEFAULT_TIMEOUT, get_with_retry
from easyfold.external._rate_limit import RCSB_LIMITER
from easyfold.external.exceptions import (
    ExternalSourceUnavailable,
    MalformedExternalResponse,
    SequenceNotFound,
)
from easyfold.external.models import FetchedSequence

FASTA_BASE = "https://www.rcsb.org/fasta/entry"
DATA_BASE = "https://data.rcsb.org/rest/v1/core"

_TAXID_SUFFIX = re.compile(r"\s*\(\d+\)")


@dataclass(frozen=True)
class _FastaRecord:
    entity_id: str
    molecule_type: str
    organism: str | None
    sequence: str


async def fetch_rcsb(pdb_id: str, *, client: httpx.AsyncClient | None = None) -> FetchedSequence:
    """Fetch a single RCSB PDB entry by PDB ID (e.g. ``1TUP``).

    Returns the longest *protein* chain in the structure (DNA/RNA entities are filtered out).
    Description comes from the entry's ``struct.title``. Organism is read from the FASTA
    header when present, with a fallback to the polymer-entity data API.

    Raises:
        SequenceNotFound: no such PDB ID.
        ExternalSourceUnavailable: network failure or persistent 5xx.
        MalformedExternalResponse: 2xx body missing fields, or no protein chain present.
    """
    pdb_id_norm = pdb_id.strip().upper()

    async with AsyncExitStack() as stack:
        if client is None:
            client = await stack.enter_async_context(httpx.AsyncClient(timeout=DEFAULT_TIMEOUT))

        fasta_text = await _get_fasta(client, pdb_id_norm)
        records = _parse_fasta(fasta_text)
        protein_records = [r for r in records if r.molecule_type.upper().startswith("PROTEIN")]
        if not protein_records:
            raise MalformedExternalResponse(f"RCSB entry {pdb_id_norm} contains no protein chain")
        chosen = max(protein_records, key=lambda r: len(r.sequence))

        description = await _get_struct_title(client, pdb_id_norm)
        organism = chosen.organism or await _get_entity_organism(
            client, pdb_id_norm, chosen.entity_id
        )

        return FetchedSequence(
            id=pdb_id_norm,
            source="rcsb",
            sequence=chosen.sequence,
            organism=organism,
            length=len(chosen.sequence),
            description=description,
        )

    raise AssertionError("unreachable")  # pragma: no cover


async def _get_fasta(client: httpx.AsyncClient, pdb_id: str) -> str:
    url = f"{FASTA_BASE}/{pdb_id}"
    async with RCSB_LIMITER:
        try:
            response = await get_with_retry(client, url)
        except httpx.HTTPError as exc:
            raise ExternalSourceUnavailable(
                f"RCSB FASTA request failed for {pdb_id}: {exc}"
            ) from exc
    if response.status_code == 404:
        raise SequenceNotFound(f"RCSB has no entry for PDB ID {pdb_id}")
    if response.status_code != 200:
        raise ExternalSourceUnavailable(
            f"RCSB FASTA returned HTTP {response.status_code} for {pdb_id}"
        )
    return response.text


async def _get_struct_title(client: httpx.AsyncClient, pdb_id: str) -> str | None:
    url = f"{DATA_BASE}/entry/{pdb_id}"
    async with RCSB_LIMITER:
        try:
            response = await get_with_retry(client, url)
        except httpx.HTTPError as exc:
            raise ExternalSourceUnavailable(
                f"RCSB entry request failed for {pdb_id}: {exc}"
            ) from exc
    if response.status_code == 404:
        raise SequenceNotFound(f"RCSB has no entry for PDB ID {pdb_id}")
    if response.status_code != 200:
        raise ExternalSourceUnavailable(
            f"RCSB entry returned HTTP {response.status_code} for {pdb_id}"
        )
    try:
        payload: dict[str, Any] = response.json()
    except ValueError as exc:
        raise MalformedExternalResponse(f"RCSB entry returned non-JSON for {pdb_id}") from exc
    title = payload.get("struct", {}).get("title")
    return title if isinstance(title, str) else None


async def _get_entity_organism(
    client: httpx.AsyncClient, pdb_id: str, entity_id: str
) -> str | None:
    url = f"{DATA_BASE}/polymer_entity/{pdb_id}/{entity_id}"
    async with RCSB_LIMITER:
        try:
            response = await get_with_retry(client, url)
        except httpx.HTTPError:
            return None
    if response.status_code != 200:
        return None
    try:
        payload: dict[str, Any] = response.json()
    except ValueError:
        return None
    sources = payload.get("rcsb_entity_source_organism")
    if not isinstance(sources, list) or not sources:
        return None
    name = sources[0].get("scientific_name") if isinstance(sources[0], dict) else None
    return name if isinstance(name, str) else None


def _parse_fasta(text: str) -> list[_FastaRecord]:
    records: list[_FastaRecord] = []
    current_header: str | None = None
    current_seq: list[str] = []

    def flush() -> None:
        if current_header is None:
            return
        parts = current_header.split("|")
        if len(parts) < 3:
            return
        entry_entity = parts[0].lstrip(">")
        entity_id = entry_entity.split("_", 1)[1] if "_" in entry_entity else ""
        molecule_type = parts[2].strip()
        organism_raw = parts[3].strip() if len(parts) >= 4 else ""
        organism = _clean_organism(organism_raw) if organism_raw else None
        sequence = "".join(current_seq).replace(" ", "")
        records.append(
            _FastaRecord(
                entity_id=entity_id,
                molecule_type=molecule_type,
                organism=organism,
                sequence=sequence,
            )
        )

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line:
            continue
        if line.startswith(">"):
            flush()
            current_header = line
            current_seq = []
        else:
            current_seq.append(line)
    flush()
    return records


def _clean_organism(raw: str) -> str | None:
    cleaned = _TAXID_SUFFIX.sub("", raw).strip(" ,")
    return cleaned or None
