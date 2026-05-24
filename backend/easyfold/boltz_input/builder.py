"""Translate an EasyFold :class:`PredictionJob` into a Boltz-2 YAML input string.

Boltz-2's YAML schema is documented at
https://github.com/jwohlwend/boltz/blob/main/docs/prediction.md.

Single source of truth: we reuse the AF3 ``PredictionJob`` (Pydantic) so a
job description doesn't change as the user switches models in the UI.
Only the on-disk emission format differs (AF3 JSON vs Boltz YAML).

Unlike AF3, Boltz expresses homo-multimers as **one entry per chain** —
no list-of-ids collapsing. We expand ``ProteinSpec.copies`` here so
downstream Boltz sees one independent protein entry per copy.

PTM modifications (``ProteinSpec.modifications``) are **not** emitted at
MVP. Boltz supports them through CCD codes inline in the sequence, which
the UI doesn't expose yet (see TASK-3.2 § Out of scope; will revisit in
TASK-3.4). Modifications are silently ignored — documented behavior.
"""

from typing import Any

import yaml

from easyfold.af3_input._chain_ids import excel_chain_id
from easyfold.af3_input.models import LigandSpec, PredictionJob, ProteinSpec
from easyfold.boltz_input.exceptions import InvalidBoltzInput
from easyfold.boltz_input.validator import validate_boltz_input

BOLTZ_VERSION = 1


def build_boltz_yaml(job: PredictionJob) -> str:
    """Return a YAML string representing ``job`` in Boltz-2's input format.

    Chain IDs follow the same Excel-column convention used by the AF3
    builder so a given protein has stable chain identifiers across both
    models — useful for downstream comparison.

    The intermediate dict is validated via :func:`validate_boltz_input`
    before serialization; that call should never fail in practice and
    acts as defense-in-depth.
    """
    sequences: list[dict[str, Any]] = []
    next_chain_index = 1

    for protein in job.proteins:
        for offset in range(protein.copies):
            chain_id = excel_chain_id(next_chain_index + offset)
            sequences.append({"protein": _protein_body(protein, chain_id)})
        next_chain_index += protein.copies

    for ligand in job.ligands:
        for offset in range(ligand.copies):
            chain_id = excel_chain_id(next_chain_index + offset)
            sequences.append({"ligand": _ligand_body(ligand, chain_id)})
        next_chain_index += ligand.copies

    payload: dict[str, Any] = {"version": BOLTZ_VERSION, "sequences": sequences}

    try:
        validate_boltz_input(payload)
    except InvalidBoltzInput as exc:  # pragma: no cover  # defense in depth
        raise InvalidBoltzInput(f"builder produced invalid Boltz input: {exc}") from exc

    return yaml.safe_dump(payload, sort_keys=False)


def _protein_body(protein: ProteinSpec, chain_id: str) -> dict[str, Any]:
    body: dict[str, Any] = {
        "id": chain_id,
        "sequence": protein.sequence,
    }
    # ProteinSpec.modifications is intentionally not emitted — see module docstring.
    return body


def _ligand_body(ligand: LigandSpec, chain_id: str) -> dict[str, Any]:
    body: dict[str, Any] = {"id": chain_id}
    if ligand.smiles:
        body["smiles"] = ligand.smiles
    if ligand.ccd_codes:
        body["ccd"] = list(ligand.ccd_codes)
    return body
