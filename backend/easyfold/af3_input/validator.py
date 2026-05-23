"""Hand-rolled structural validator for AlphaFold 3 input JSON.

AF3 does not publish a JSON Schema, so we encode the constraints from
``docs/input.md`` directly. Fast-fails on the first error with a key path
in the message; raises ``InvalidAf3Input`` (a ``ValueError`` subclass).
"""

import re
from typing import Any

from easyfold.af3_input.exceptions import InvalidAf3Input
from easyfold.af3_input.models import STANDARD_AAS

ACCEPTED_VERSIONS: frozenset[int] = frozenset({1, 2, 3, 4})
POLYMER_KEYS: frozenset[str] = frozenset({"protein", "rna", "dna", "ligand"})
CHAIN_ID_RE = re.compile(r"^[A-Z]+$")


def validate_af3_input(data: dict[str, Any]) -> None:
    """Raise :class:`InvalidAf3Input` if ``data`` does not match the AF3 schema."""
    if not isinstance(data, dict):
        raise InvalidAf3Input(f"top-level: expected dict, got {type(data).__name__}")

    _require_field(data, "name", str)
    if not data["name"]:
        raise InvalidAf3Input("name: must be non-empty")

    _require_field(data, "dialect", str)
    if data["dialect"] != "alphafold3":
        raise InvalidAf3Input(f"dialect: expected 'alphafold3', got {data['dialect']!r}")

    _require_field(data, "version", int)
    if data["version"] not in ACCEPTED_VERSIONS:
        raise InvalidAf3Input(
            f"version: {data['version']} not in accepted set {sorted(ACCEPTED_VERSIONS)}"
        )

    _require_field(data, "modelSeeds", list)
    seeds = data["modelSeeds"]
    if not seeds:
        raise InvalidAf3Input("modelSeeds: must contain at least one seed")
    for i, seed in enumerate(seeds):
        if not isinstance(seed, int) or isinstance(seed, bool):
            raise InvalidAf3Input(f"modelSeeds[{i}]: expected int, got {type(seed).__name__}")

    _require_field(data, "sequences", list)
    sequences = data["sequences"]
    if not sequences:
        raise InvalidAf3Input("sequences: must contain at least one entry")

    seen_chain_ids: set[str] = set()
    for i, entry in enumerate(sequences):
        if not isinstance(entry, dict) or len(entry) != 1:
            raise InvalidAf3Input(f"sequences[{i}]: expected single-key dict, got {entry!r}")
        ((polymer_key, body),) = entry.items()
        if polymer_key not in POLYMER_KEYS:
            raise InvalidAf3Input(
                f"sequences[{i}]: unknown polymer key {polymer_key!r}, "
                f"expected one of {sorted(POLYMER_KEYS)}"
            )
        if not isinstance(body, dict):
            raise InvalidAf3Input(
                f"sequences[{i}].{polymer_key}: expected dict, got {type(body).__name__}"
            )
        chain_ids = _validate_id_field(body, f"sequences[{i}].{polymer_key}")
        for cid in chain_ids:
            if cid in seen_chain_ids:
                raise InvalidAf3Input(
                    f"sequences[{i}].{polymer_key}.id: duplicate chain id {cid!r}"
                )
            seen_chain_ids.add(cid)

        if polymer_key == "protein":
            _validate_protein_body(body, f"sequences[{i}].protein")
        elif polymer_key == "ligand":
            _validate_ligand_body(body, f"sequences[{i}].ligand")


def _require_field(data: dict[str, Any], key: str, expected_type: type) -> None:
    if key not in data:
        raise InvalidAf3Input(f"missing required key: {key!r}")
    value = data[key]
    if expected_type is int:
        if not isinstance(value, int) or isinstance(value, bool):
            raise InvalidAf3Input(f"{key}: expected int, got {type(value).__name__}")
        return
    if not isinstance(value, expected_type):
        raise InvalidAf3Input(
            f"{key}: expected {expected_type.__name__}, got {type(value).__name__}"
        )


def _validate_id_field(body: dict[str, Any], path: str) -> list[str]:
    if "id" not in body:
        raise InvalidAf3Input(f"{path}.id: missing")
    raw = body["id"]
    if isinstance(raw, str):
        chain_ids = [raw]
    elif isinstance(raw, list) and all(isinstance(x, str) for x in raw):
        if not raw:
            raise InvalidAf3Input(f"{path}.id: list must be non-empty")
        chain_ids = raw
    else:
        raise InvalidAf3Input(f"{path}.id: expected str or list[str], got {raw!r}")
    for cid in chain_ids:
        if not CHAIN_ID_RE.match(cid):
            raise InvalidAf3Input(f"{path}.id: chain id {cid!r} does not match ^[A-Z]+$")
    return chain_ids


def _validate_protein_body(body: dict[str, Any], path: str) -> None:
    if "sequence" not in body:
        raise InvalidAf3Input(f"{path}.sequence: missing")
    seq = body["sequence"]
    if not isinstance(seq, str):
        raise InvalidAf3Input(f"{path}.sequence: expected str, got {type(seq).__name__}")
    if not seq:
        raise InvalidAf3Input(f"{path}.sequence: must be non-empty")
    invalid = sorted({c for c in seq if c not in STANDARD_AAS})
    if invalid:
        joined = ", ".join(f"'{c}'" for c in invalid)
        raise InvalidAf3Input(f"{path}.sequence: contains non-standard letters {joined}")


def _validate_ligand_body(body: dict[str, Any], path: str) -> None:
    has_smiles = isinstance(body.get("smiles"), str) and body["smiles"]
    ccd = body.get("ccdCodes")
    has_ccd = isinstance(ccd, list) and len(ccd) > 0 and all(isinstance(c, str) for c in ccd)
    if not has_smiles and not has_ccd:
        raise InvalidAf3Input(f"{path}: ligand requires non-empty 'smiles' or 'ccdCodes'")
