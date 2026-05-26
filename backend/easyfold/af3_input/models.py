"""Pydantic models describing a prediction job in EasyFold's own terms.

These are intentionally *not* the AlphaFold 3 JSON shape — keeping the
user-facing model independent lets us swap or extend models (Boltz-2,
future AF versions) without breaking callers. See ADR 0001.
"""

from typing import Self

from pydantic import BaseModel, Field, field_validator, model_validator

STANDARD_AAS: frozenset[str] = frozenset("ACDEFGHIKLMNPQRSTVWY")


class ModificationSpec(BaseModel):
    """A post-translational modification at a 1-indexed residue position."""

    ptm_type: str = Field(min_length=1, max_length=20, description="AF3 PTM code, e.g. PHOSPHO.")
    ptm_position: int = Field(ge=1, description="1-indexed residue position within the chain.")


class ProteinSpec(BaseModel):
    """A single protein entity. ``copies`` > 1 emits a homo-multimer in the AF3 JSON."""

    # 3000 aa covers >99% of known proteins and fits comfortably on an H100;
    # tighten only if a future smaller-GPU profile demands it.
    sequence: str = Field(
        ...,
        max_length=3000,
        description="One-letter amino acid sequence; whitespace stripped, uppercased.",
    )
    # 20 copies covers realistic homo-multimer requests (capsids, ribosomes
    # would exceed this — those are out of scope for MVP).
    copies: int = Field(
        default=1, ge=1, le=20, description="Number of identical chains AF3 should generate."
    )
    modifications: list[ModificationSpec] = Field(default_factory=list, max_length=20)

    @field_validator("sequence", mode="before")
    @classmethod
    def _normalize_and_check_sequence(cls, value: object) -> str:
        if not isinstance(value, str):
            raise TypeError("sequence must be a string")
        cleaned = "".join(value.split()).upper()
        if not cleaned:
            raise ValueError("sequence is empty")
        invalid = sorted({c for c in cleaned if c not in STANDARD_AAS})
        if invalid:
            joined = ", ".join(f"'{c}'" for c in invalid)
            raise ValueError(
                f"sequence contains non-standard amino acid letters: {joined}. "
                f"Allowed: {''.join(sorted(STANDARD_AAS))}."
            )
        return cleaned

    @model_validator(mode="after")
    def _modifications_in_range(self) -> Self:
        seq_len = len(self.sequence)
        for mod in self.modifications:
            if mod.ptm_position > seq_len:
                raise ValueError(
                    f"modification at position {mod.ptm_position} exceeds sequence length {seq_len}"
                )
        return self


class LigandSpec(BaseModel):
    """A small molecule, by SMILES or PDB Chemical Component Dictionary codes."""

    smiles: str | None = Field(
        default=None, max_length=2000, description="SMILES string for the ligand."
    )
    ccd_codes: list[str] = Field(
        default_factory=list,
        max_length=5,
        description="PDB CCD codes (e.g. ['HEM', 'NAG']).",
    )
    copies: int = Field(default=1, ge=1, le=20)

    @model_validator(mode="after")
    def _need_smiles_or_ccd(self) -> Self:
        if not self.smiles and not self.ccd_codes:
            raise ValueError("ligand requires either smiles or ccd_codes")
        return self


class PredictionJob(BaseModel):
    """A complete prediction request in EasyFold's internal vocabulary."""

    name: str = Field(min_length=1, max_length=100, description="Human-readable job identifier.")
    proteins: list[ProteinSpec] = Field(
        min_length=1, max_length=10, description="One or more protein entities to predict."
    )
    ligands: list[LigandSpec] = Field(default_factory=list, max_length=10)
    model_seeds: list[int] = Field(
        default_factory=lambda: [1],
        min_length=1,
        max_length=5,
        description="Per-seed predictions enable ensemble outputs.",
    )
