"""Pydantic request/response models for the Jobs API.

``ModelResultModel`` is a Pydantic mirror of the
:class:`easyfold.inference.result.ModelResult` dataclass. We don't
return the dataclass directly because FastAPI's OpenAPI generator
produces noticeably better schemas from ``BaseModel`` subclasses. The
dataclass stays the canonical shape inside the Modal Function (small,
no Pydantic dep needed in the container); we adapt at the API boundary
via ``ModelResultModel.model_validate(model_result.to_dict())``.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

from easyfold.af3_input.models import PredictionJob
from easyfold.inference.result import ModelName

JobStatus = Literal["pending", "running", "succeeded", "failed"]


class ModelResultModel(BaseModel):
    """Pydantic mirror of :class:`easyfold.inference.result.ModelResult`."""

    model: ModelName
    name: str
    cif: str
    plddt: list[float]
    pae: list[list[float]] | None
    iptm: float | None
    ptm: float | None
    ranking_score: float | None
    sample_dir_name: str
    extras: dict[str, Any] = Field(default_factory=dict)


class JobCreateRequest(BaseModel):
    """POST /api/v1/jobs request body."""

    model: ModelName
    job: PredictionJob


class JobStatusResponse(BaseModel):
    """Shared response shape for POST /api/v1/jobs and GET /api/v1/jobs/{id}.

    ``model`` is echoed back from the original POST. The GET endpoint
    can't recover it from Modal's ``FunctionCall`` (the SDK doesn't
    expose the originating App through the call object), so the GET
    response includes ``model: None`` — callers keep the model they
    POSTed with via URL state on the ``/predict/[jobId]`` page.
    """

    job_id: str
    model: ModelName | None
    status: JobStatus
    result: ModelResultModel | None = None
    error: str | None = None
