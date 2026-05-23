from fastapi import APIRouter, Path

from easyfold.external import fetch_rcsb, fetch_uniprot
from easyfold.external.models import FetchedSequence

router = APIRouter(prefix="/sequences", tags=["sequences"])


@router.get("/uniprot/{accession}", response_model=FetchedSequence)
async def get_uniprot_sequence(
    accession: str = Path(..., pattern=r"^[A-Za-z0-9_]+$"),
) -> FetchedSequence:
    return await fetch_uniprot(accession)


@router.get("/rcsb/{pdb_id}", response_model=FetchedSequence)
async def get_rcsb_sequence(
    pdb_id: str = Path(..., pattern=r"^[A-Za-z0-9]{4}$"),
) -> FetchedSequence:
    return await fetch_rcsb(pdb_id)
