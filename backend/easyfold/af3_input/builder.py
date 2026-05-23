"""Translate an EasyFold :class:`PredictionJob` into AlphaFold 3 input JSON.

The AF3 schema is documented at
https://github.com/google-deepmind/alphafold3/blob/main/docs/input.md.
"""

from typing import Any

from easyfold.af3_input._chain_ids import excel_chain_id
from easyfold.af3_input.exceptions import InvalidAf3Input
from easyfold.af3_input.models import LigandSpec, PredictionJob, ProteinSpec
from easyfold.af3_input.validator import validate_af3_input

DIALECT = "alphafold3"
VERSION = 4


def build_af3_input(job: PredictionJob) -> dict[str, Any]:
    """Return the AF3 input JSON (as a dict) corresponding to ``job``.

    Chain IDs are assigned in Excel column order (``A, B, …, Z, AA, AB, …``)
    starting from the first protein and continuing through the ligands. A
    :class:`ProteinSpec` or :class:`LigandSpec` with ``copies > 1`` consumes
    multiple consecutive chain IDs and surfaces as ``"id": ["A", "B"]`` in
    the JSON, matching AF3's homo-multimer convention.

    The result is run through :func:`validate_af3_input` before return as a
    defensive double-check; that call should never fail in practice.
    """
    sequences: list[dict[str, Any]] = []
    next_chain_index = 1

    for protein in job.proteins:
        chain_ids = _take_chain_ids(next_chain_index, protein.copies)
        next_chain_index += protein.copies
        sequences.append({"protein": _protein_body(protein, chain_ids)})

    for ligand in job.ligands:
        chain_ids = _take_chain_ids(next_chain_index, ligand.copies)
        next_chain_index += ligand.copies
        sequences.append({"ligand": _ligand_body(ligand, chain_ids)})

    result: dict[str, Any] = {
        "name": job.name,
        "modelSeeds": list(job.model_seeds),
        "sequences": sequences,
        "dialect": DIALECT,
        "version": VERSION,
    }

    try:
        validate_af3_input(result)
    except InvalidAf3Input as exc:  # pragma: no cover  # defense in depth
        raise InvalidAf3Input(f"builder produced invalid AF3 input: {exc}") from exc

    return result


def _take_chain_ids(start: int, count: int) -> list[str]:
    return [excel_chain_id(start + offset) for offset in range(count)]


def _protein_body(protein: ProteinSpec, chain_ids: list[str]) -> dict[str, Any]:
    body: dict[str, Any] = {
        "id": chain_ids[0] if len(chain_ids) == 1 else chain_ids,
        "sequence": protein.sequence,
    }
    if protein.modifications:
        body["modifications"] = [
            {"ptmType": m.ptm_type, "ptmPosition": m.ptm_position} for m in protein.modifications
        ]
    return body


def _ligand_body(ligand: LigandSpec, chain_ids: list[str]) -> dict[str, Any]:
    body: dict[str, Any] = {
        "id": chain_ids[0] if len(chain_ids) == 1 else chain_ids,
    }
    if ligand.smiles:
        body["smiles"] = ligand.smiles
    if ligand.ccd_codes:
        body["ccdCodes"] = list(ligand.ccd_codes)
    return body
