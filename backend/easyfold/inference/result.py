"""Unified result shape for structure-prediction Modal Functions.

Both ``inference/af3.py`` and ``inference/boltz.py`` return a dict produced
by :meth:`ModelResult.to_dict`. Keeping a single shape across models means
downstream consumers (the FastAPI route added in Task 3.3, the
``/demo/viewer`` frontend, the LLM interpretation prompt) work against a
stable contract regardless of which model produced the prediction.

Model-specific raw outputs (AF3's ``confidences.json`` / ``summary_confidences.json``,
Boltz's ``confidence_*.json``) are preserved verbatim under ``extras`` so
that callers who need the raw signal (e.g. the LLM interpretation pass)
can reach for it without a second round trip.
"""

from dataclasses import dataclass, field
from typing import Any, Literal

ModelName = Literal["alphafold3", "boltz2"]


@dataclass(frozen=True)
class ModelResult:
    """Normalized output of a structure-prediction Modal Function.

    Confidence-scale conventions:

    - ``plddt`` values are 0-100 (matches AF3 and Boltz on-disk arrays and
      the ``/demo/viewer`` Recharts series).
    - ``pae`` values are predicted aligned error in Ångströms (typically 0-32).
    - ``iptm`` / ``ptm`` / ``ranking_score`` are 0-1.

    Nullable fields surface as ``None`` rather than NaN or sentinel values
    so JSON serialization is unambiguous.
    """

    model: ModelName
    """Which predictor produced this result."""
    name: str
    """Job name (echo of ``PredictionJob.name`` for traceability)."""
    cif: str
    """mmCIF text of the predicted structure."""
    plddt: list[float]
    """Per-residue (or per-token) pLDDT values, 0-100."""
    pae: list[list[float]] | None
    """NxN PAE matrix in Å, or ``None`` when the model omitted it
    (single-chain jobs sometimes do)."""
    iptm: float | None
    """Interface pTM, 0-1; ``None`` for single-chain jobs."""
    ptm: float | None
    """Predicted TM-score, 0-1."""
    ranking_score: float | None
    """The model's own self-ranking metric, 0-1. AF3 calls this
    ``ranking_score``; Boltz calls it ``confidence_score``."""
    sample_dir_name: str
    """Per-sample subdirectory name on disk — useful for log correlation.
    e.g. ``"seed-1_sample-0"`` (AF3) or ``"smoke_model_0"`` (Boltz)."""
    extras: dict[str, Any] = field(default_factory=dict)
    """Model-specific raw outputs preserved verbatim. AF3 stores
    ``{"confidences": ..., "summary_confidences": ...}``; Boltz stores
    ``{"confidence_summary": ...}``."""

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict — the shape the Modal Function returns."""
        return {
            "model": self.model,
            "name": self.name,
            "cif": self.cif,
            "plddt": self.plddt,
            "pae": self.pae,
            "iptm": self.iptm,
            "ptm": self.ptm,
            "ranking_score": self.ranking_score,
            "sample_dir_name": self.sample_dir_name,
            "extras": self.extras,
        }


def nullable_float(value: object) -> float | None:
    """Coerce ``value`` to float; return ``None`` when missing or non-numeric.

    Centralizes the safe-cast used by both ``output_parse`` (AF3) and
    ``boltz_output`` parsers — the upstream JSON keys vary in presence
    and occasionally come through as strings.
    """
    if value is None:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
