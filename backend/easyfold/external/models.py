from typing import Literal

from pydantic import BaseModel, Field

Source = Literal["uniprot", "rcsb"]


class FetchedSequence(BaseModel):
    """A protein sequence with light metadata, normalized across data sources."""

    id: str = Field(..., description="UniProt accession or PDB ID, uppercase.")
    source: Source
    sequence: str = Field(..., description="Single-letter amino-acid sequence.")
    organism: str | None = Field(
        None, description="Scientific name of the source organism, if available."
    )
    length: int = Field(..., ge=1)
    description: str | None = Field(
        None, description="Human-readable protein name or structure title, if available."
    )
