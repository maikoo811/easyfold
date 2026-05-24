"""Pure-Python helpers for staging AlphaFold 3 inputs on disk.

Kept separate from the Modal-decorated function so the disk-layout / command
construction logic is unit-testable without spinning up a container.
"""

import json
from collections.abc import Mapping
from copy import deepcopy
from pathlib import Path
from typing import Any

# Path AF3's CLI lives at inside the Modal container (cloned to /opt/alphafold3
# by the image build in af3.py).
AF3_RUN_SCRIPT = "/opt/alphafold3/run_alphafold.py"


def write_input_json(payload: Mapping[str, Any], workdir: Path) -> Path:
    """Serialize ``payload`` to ``<workdir>/input.json`` and return the path.

    The AF3 CLI accepts ``--json_path``; we use a constant filename so callers
    don't have to thread it through.
    """
    workdir.mkdir(parents=True, exist_ok=True)
    target = workdir / "input.json"
    target.write_text(json.dumps(payload))
    return target


def build_af3_command(
    *,
    input_path: Path,
    output_dir: Path,
    weights_dir: Path,
    run_data_pipeline: bool = False,
) -> list[str]:
    """Construct the ``run_alphafold.py`` argv for ``subprocess.run``.

    ``run_data_pipeline=False`` (default) sets ``--norun_data_pipeline`` so AF3
    skips its MSA / template build step — appropriate when MSAs have already
    been injected into the input JSON (see :func:`enrich_with_msa`).
    """
    cmd = [
        "python",
        AF3_RUN_SCRIPT,
        f"--json_path={input_path}",
        f"--output_dir={output_dir}",
        f"--model_dir={weights_dir}",
    ]
    if not run_data_pipeline:
        cmd.append("--norun_data_pipeline")
    return cmd


def enrich_with_msa(
    input_json: Mapping[str, Any],
    msa_by_sequence: Mapping[str, str],
) -> dict[str, Any]:
    """Return a deep copy of ``input_json`` with ``unpairedMsa`` filled per protein.

    For every protein entry whose ``sequence`` appears in ``msa_by_sequence``,
    set ``unpairedMsa`` to the corresponding A3M string. ``pairedMsa`` is set
    to an empty string (ColabFold's mmseqs2 server doesn't return paired MSAs
    by default).

    Existing ``unpairedMsa`` / ``pairedMsa`` values are preserved if the caller
    already supplied them.
    """
    out: dict[str, Any] = deepcopy(dict(input_json))
    for entry in out.get("sequences", []):
        protein = entry.get("protein")
        if not isinstance(protein, dict):
            continue
        sequence = protein.get("sequence")
        if not isinstance(sequence, str):
            continue
        if "unpairedMsa" in protein:
            continue
        msa = msa_by_sequence.get(sequence)
        if msa is None:
            continue
        protein["unpairedMsa"] = msa
        protein.setdefault("pairedMsa", "")
    return out
