# ADR 0001 — AlphaFold 3 input mapping

## Status

Accepted — 2026-05-23.

## Context

EasyFold's differentiation rests on hiding the AlphaFold 3 input JSON from users (CLAUDE.md: *"Are we asking the user about the science, or about the JSON schema? Aim for the former."*). To do that we need an internal job representation that can produce a valid AF3 JSON when needed, without leaking AF3-specific terminology — field names, chain ID rules, version pins — into the rest of the system.

AF3's input format ([`docs/input.md`](https://github.com/google-deepmind/alphafold3/blob/main/docs/input.md)) defines a JSON object with required top-level keys (`name`, `modelSeeds`, `sequences`, `dialect`, `version`) and a polymorphic `sequences` array whose entries are one-key dicts (`protein` / `rna` / `dna` / `ligand`). The schema is documented in prose only — DeepMind ships no JSON Schema file.

## Decision

Introduce `backend/easyfold/af3_input/` as the sole bridge between EasyFold's domain model and AF3's wire format.

1. **Internal Pydantic models** (`PredictionJob`, `ProteinSpec`, `LigandSpec`, `ModificationSpec`) describe jobs in EasyFold's vocabulary — snake_case, sequence-first, no chain IDs surfaced to callers. The rest of the backend depends only on these models, never on the AF3 JSON shape.

2. **`build_af3_input(job) -> dict`** assigns chain IDs and emits the AF3 JSON. Chain IDs follow **Excel column order** (`A, B, …, Z, AA, AB, …`) — the order users naturally expect and the one the Task 1.4 spec called out. A `ProteinSpec` or `LigandSpec` with `copies > 1` consumes consecutive chain IDs and emits `"id": ["A", "B"]` as a list, matching AF3's homo-multimer convention (this preserves the "same entity" signal for AF3's MSA and template handling).

3. **`validate_af3_input(data) -> None`** is a hand-rolled structural validator. We avoid the `jsonschema` dep — AF3 publishes no schema, so a third-party validator would only run rules we'd have written ourselves. The validator double-checks the builder's output and is also usable on hand-authored JSON. It fast-fails with a key-path message (`sequences[1].protein.sequence: contains non-standard letters 'X'`).

4. **Version pin**: `dialect = "alphafold3"` and `version = 4` are constants in `builder.py`. The validator's allow-set `{1, 2, 3, 4}` is the only other place a new AF3 version needs to be added. The version is intentionally not exposed in `PredictionJob` — callers describe a job, not a wire-protocol revision.

5. **MSA / template fields are omitted from the internal model.** AF3 computes its own MSAs by default; offering MSA config is explicitly out of scope for the MVP. If we surface MSA customization later, it lives on `ProteinSpec`, not in `build_af3_input`'s signature.

## Consequences

**Positive**
- Callers (and future tasks: backend routes, Modal jobs) depend on a stable EasyFold model, not AF3's JSON.
- Adding Boltz-2 means a sibling `boltz_input` module with the same `PredictionJob` input — the model is provider-agnostic.
- Validation messages reference the field path, making backend logs readable when an upstream change ships a malformed payload.

**Negative**
- Two layers (Pydantic + hand-rolled validator) check overlapping things. The duplication is the cost of letting `validate_af3_input` accept raw dicts (e.g. for sanity-checking hand-authored JSON).
- Bumping AF3 to version 5 requires both a constant change in `builder.py` and an addition to `validator.ACCEPTED_VERSIONS`. Catch-23 documented here so a future PR knows where to look.

**Open**
- When the prediction route lands (later task), we'll need to decide where `build_af3_input` runs — backend process vs. Modal worker. Probably the worker (so failures show up in the run log next to the AF3 invocation), but the function's purity means it doesn't matter for now.
