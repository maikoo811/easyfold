"""Structural validator for Boltz-2 input payloads (pre-YAML serialization).

Boltz-2 accepts both FASTA and YAML inputs; we always emit YAML (see
ADR 0003). The Boltz YAML format is documented at
https://github.com/jwohlwend/boltz/blob/main/docs/prediction.md.

Key differences vs AF3 input (validated in ``af3_input.validator``):

- One sequence entry per **chain** (no homo-multimer collapsing into
  ``"id": ["A","B"]`` like AF3 does).
- Top-level keys are ``version`` (currently 1) and ``sequences``.
- Each sequence entry has exactly one of ``protein`` / ``ligand`` /
  (planned: ``rna``, ``dna``) — same single-key-dict pattern as AF3.

We re-use AF3's chain-ID regex and amino-acid alphabet for consistency.
"""

import re
from typing import Any

from easyfold.af3_input.models import STANDARD_AAS
from easyfold.boltz_input.exceptions import InvalidBoltzInput

ACCEPTED_VERSIONS: frozenset[int] = frozenset({1})
POLYMER_KEYS: frozenset[str] = frozenset({"protein", "ligand"})
CHAIN_ID_RE = re.compile(r"^[A-Z]+$")


def validate_boltz_input(data: dict[str, Any]) -> None:
    """Raise :class:`InvalidBoltzInput` if ``data`` does not match the Boltz YAML schema."""
    if not isinstance(data, dict):
        raise InvalidBoltzInput(f"top-level: expected dict, got {type(data).__name__}")

    if "version" not in data:
        raise InvalidBoltzInput("missing required key: 'version'")
    version = data["version"]
    if not isinstance(version, int) or isinstance(version, bool):
        raise InvalidBoltzInput(f"version: expected int, got {type(version).__name__}")
    if version not in ACCEPTED_VERSIONS:
        raise InvalidBoltzInput(
            f"version: {version} not in accepted set {sorted(ACCEPTED_VERSIONS)}"
        )

    if "sequences" not in data:
        raise InvalidBoltzInput("missing required key: 'sequences'")
    sequences = data["sequences"]
    if not isinstance(sequences, list):
        raise InvalidBoltzInput(f"sequences: expected list, got {type(sequences).__name__}")
    if not sequences:
        raise InvalidBoltzInput("sequences: must contain at least one entry")

    seen_chain_ids: set[str] = set()
    for i, entry in enumerate(sequences):
        if not isinstance(entry, dict) or len(entry) != 1:
            raise InvalidBoltzInput(f"sequences[{i}]: expected single-key dict, got {entry!r}")
        ((polymer_key, body),) = entry.items()
        if polymer_key not in POLYMER_KEYS:
            raise InvalidBoltzInput(
                f"sequences[{i}]: unknown polymer key {polymer_key!r}, "
                f"expected one of {sorted(POLYMER_KEYS)}"
            )
        if not isinstance(body, dict):
            raise InvalidBoltzInput(
                f"sequences[{i}].{polymer_key}: expected dict, got {type(body).__name__}"
            )
        chain_id = _validate_chain_id(body, f"sequences[{i}].{polymer_key}")
        if chain_id in seen_chain_ids:
            raise InvalidBoltzInput(
                f"sequences[{i}].{polymer_key}.id: duplicate chain id {chain_id!r}"
            )
        seen_chain_ids.add(chain_id)

        if polymer_key == "protein":
            _validate_protein_body(body, f"sequences[{i}].protein")
        elif polymer_key == "ligand":
            _validate_ligand_body(body, f"sequences[{i}].ligand")


def _validate_chain_id(body: dict[str, Any], path: str) -> str:
    if "id" not in body:
        raise InvalidBoltzInput(f"{path}.id: missing")
    cid = body["id"]
    if not isinstance(cid, str):
        # Boltz expects a single string per entry — one chain per dict
        raise InvalidBoltzInput(
            f"{path}.id: expected str (one chain per entry), got {type(cid).__name__}"
        )
    if not CHAIN_ID_RE.match(cid):
        raise InvalidBoltzInput(f"{path}.id: chain id {cid!r} does not match ^[A-Z]+$")
    return cid


def _validate_protein_body(body: dict[str, Any], path: str) -> None:
    if "sequence" not in body:
        raise InvalidBoltzInput(f"{path}.sequence: missing")
    seq = body["sequence"]
    if not isinstance(seq, str):
        raise InvalidBoltzInput(f"{path}.sequence: expected str, got {type(seq).__name__}")
    if not seq:
        raise InvalidBoltzInput(f"{path}.sequence: must be non-empty")
    invalid = sorted({c for c in seq if c not in STANDARD_AAS})
    if invalid:
        joined = ", ".join(f"'{c}'" for c in invalid)
        raise InvalidBoltzInput(f"{path}.sequence: contains non-standard letters {joined}")


def _validate_ligand_body(body: dict[str, Any], path: str) -> None:
    has_smiles = isinstance(body.get("smiles"), str) and body["smiles"]
    ccd = body.get("ccd")
    has_ccd = isinstance(ccd, list) and len(ccd) > 0 and all(isinstance(c, str) for c in ccd)
    if not has_smiles and not has_ccd:
        raise InvalidBoltzInput(f"{path}: ligand requires non-empty 'smiles' or 'ccd'")
