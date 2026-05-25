"""Property-based tests for serialization round-trips and builder invariants.

Hypothesis generates arbitrary *valid* inputs and asserts properties that
must hold for **all** of them. This catches classes of bugs that example-
based tests miss — e.g. "any PredictionJob you can build survives a
round-trip through ``model_dump`` + ``model_validate``" or "the AF3 builder
never produces output that fails its own validator."

Examples are kept small (``max_size=3``) to keep the suite fast in CI.
"""

import re
import string

import yaml
from hypothesis import given, settings
from hypothesis import strategies as st

from easyfold.af3_input import (
    LigandSpec,
    ModificationSpec,
    PredictionJob,
    ProteinSpec,
    build_af3_input,
    validate_af3_input,
)
from easyfold.af3_input._chain_ids import excel_chain_id
from easyfold.boltz_input import build_boltz_yaml, validate_boltz_input

# Hypothesis strategy: amino-acid sequences from the 20 standard letters,
# 1–60 letters long. Short to keep generation cheap; longer sequences add
# nothing beyond what example-based tests already cover.
_STANDARD_AAS = "ACDEFGHIKLMNPQRSTVWY"
sequences = st.text(alphabet=_STANDARD_AAS, min_size=1, max_size=60)

# Modifications — only valid PTMs (anything matches the validator) at
# positions guaranteed to fall within the sequence. We compose the
# modification *after* we know the sequence length to ensure
# ``ptm_position <= len(sequence)``.
ptm_types = st.text(alphabet=string.ascii_uppercase + "_", min_size=1, max_size=12)


def _protein_with_mods() -> st.SearchStrategy[ProteinSpec]:
    return sequences.flatmap(
        lambda seq: st.builds(
            ProteinSpec,
            sequence=st.just(seq),
            copies=st.integers(min_value=1, max_value=3),
            modifications=st.lists(
                st.builds(
                    ModificationSpec,
                    ptm_type=ptm_types,
                    ptm_position=st.integers(min_value=1, max_value=len(seq)),
                ),
                max_size=3,
            ),
        )
    )


# Ligand strategy — one of (smiles, ccd_codes); at least one must be set
# per ``LigandSpec``'s model validator.
ligands = st.one_of(
    st.builds(
        LigandSpec,
        smiles=st.text(alphabet=string.ascii_letters + "()=", min_size=1, max_size=20),
        ccd_codes=st.just([]),
        copies=st.integers(min_value=1, max_value=2),
    ),
    st.builds(
        LigandSpec,
        smiles=st.none(),
        ccd_codes=st.lists(
            st.text(alphabet=string.ascii_uppercase, min_size=3, max_size=3),
            min_size=1,
            max_size=3,
        ),
        copies=st.integers(min_value=1, max_value=2),
    ),
)

# Job name: keep simple ASCII so it always survives Pydantic's ``min_length=1``
# without hitting any future stricter validation.
job_names = st.text(alphabet=string.ascii_letters + string.digits + "-_", min_size=1, max_size=20)


prediction_jobs = st.builds(
    PredictionJob,
    name=job_names,
    proteins=st.lists(_protein_with_mods(), min_size=1, max_size=3),
    ligands=st.lists(ligands, max_size=2),
    model_seeds=st.lists(st.integers(min_value=1, max_value=1000), min_size=1, max_size=3),
)


# ── 1. PredictionJob round-trip ─────────────────────────────────────────


@given(job=prediction_jobs)
@settings(max_examples=50, deadline=None)
def test_prediction_job_round_trip_via_dict(job: PredictionJob) -> None:
    """``model_validate(model_dump())`` must reproduce the original job."""
    re_validated = PredictionJob.model_validate(job.model_dump())
    assert re_validated == job


# ── 2. excel_chain_id always matches ^[A-Z]+$ ───────────────────────────


_CHAIN_ID_RE = re.compile(r"^[A-Z]+$")


@given(n=st.integers(min_value=1, max_value=5_000))
@settings(max_examples=100, deadline=None)
def test_excel_chain_id_produces_only_uppercase_letters(n: int) -> None:
    cid = excel_chain_id(n)
    assert _CHAIN_ID_RE.match(cid), f"excel_chain_id({n}) = {cid!r}"


# ── 3. excel_chain_id is strictly order-preserving ──────────────────────


@given(n=st.integers(min_value=1, max_value=5_000))
@settings(max_examples=100, deadline=None)
def test_excel_chain_id_is_order_preserving(n: int) -> None:
    """Successive chain IDs sort strictly increasing under
    (length, lexicographic) order — what the Excel-column convention
    promises.
    """
    a = excel_chain_id(n)
    b = excel_chain_id(n + 1)
    assert (len(a), a) < (len(b), b), f"{a!r} should be < {b!r}"


# ── 4. AF3 builder output always passes the validator ───────────────────


@given(job=prediction_jobs)
@settings(max_examples=30, deadline=None)
def test_build_af3_input_always_passes_validate_af3_input(job: PredictionJob) -> None:
    """The builder runs ``validate_af3_input`` as defense-in-depth, but
    asserting it here surfaces builder/validator drift independently of
    that internal check.
    """
    data = build_af3_input(job)
    validate_af3_input(data)


# ── 5. Boltz builder output always parses + validates ──────────────────


@given(job=prediction_jobs)
@settings(max_examples=30, deadline=None)
def test_build_boltz_yaml_always_passes_validator(job: PredictionJob) -> None:
    """``build_boltz_yaml`` already runs the validator internally; round-tripping
    through ``yaml.safe_load`` and re-validating catches serialization-side
    regressions (e.g. a future change that emits non-quoted strings the loader
    interprets as ints).
    """
    text = build_boltz_yaml(job)
    parsed = yaml.safe_load(text)
    assert isinstance(parsed, dict)
    validate_boltz_input(parsed)
