"""POST /jobs and GET /jobs/{id} routes for prediction job submission.

The route layer is intentionally thin: parse + dispatch + map exceptions.
All Modal-SDK contact happens inside :mod:`easyfold.inference.dispatch`,
which the tests mock at the boundary.
"""

from fastapi import APIRouter

from easyfold.api.models import (
    JobCreateRequest,
    JobStatusResponse,
    ModelResultModel,
)
from easyfold.inference.dispatch import poll_prediction, spawn_prediction

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", response_model=JobStatusResponse)
async def create_job(request: JobCreateRequest) -> JobStatusResponse:
    """Spawn a Modal prediction job and return the Modal FunctionCall id.

    The response always carries ``status="pending"`` — we don't poll
    Modal here. The frontend's first GET will flip it to ``"running"``.
    """
    job_id = await spawn_prediction(request.model, request.job.model_dump())
    return JobStatusResponse(
        job_id=job_id,
        model=request.model,
        status="pending",
        result=None,
        error=None,
    )


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job(job_id: str) -> JobStatusResponse:
    """Return current status (and result/error if terminal) for a job."""
    status, result_dict, error = await poll_prediction(job_id)
    result_model = ModelResultModel.model_validate(result_dict) if result_dict is not None else None
    return JobStatusResponse(
        job_id=job_id,
        model=None,  # see JobStatusResponse docstring — Modal doesn't surface this
        status=status,
        result=result_model,
        error=error,
    )
