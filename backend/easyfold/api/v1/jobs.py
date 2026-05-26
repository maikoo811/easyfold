"""POST /jobs and GET /jobs/{id} routes for prediction job submission.

The route layer is intentionally thin: parse + dispatch + map exceptions.
All Modal-SDK contact happens inside :mod:`easyfold.inference.dispatch`,
which the tests mock at the boundary.
"""

from fastapi import APIRouter, Request

from easyfold.api.models import (
    JobCreateRequest,
    JobStatusResponse,
    ModelResultModel,
)
from easyfold.api.rate_limit import maybe_limit
from easyfold.inference.dispatch import poll_prediction, spawn_prediction

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", response_model=JobStatusResponse)
@maybe_limit("default")
async def create_job(request: Request, body: JobCreateRequest) -> JobStatusResponse:
    """Spawn a Modal prediction job and return the Modal FunctionCall id.

    The response always carries ``status="pending"`` — we don't poll
    Modal here. The frontend's first GET will flip it to ``"running"``.

    ``request`` is a FastAPI :class:`Request` object that slowapi's
    optional rate-limit decorator reads (for ``get_remote_address``). It's
    unused inside the handler when the rate limiter is disabled.
    """
    del request  # only consumed by the @maybe_limit decorator, when active
    job_id = await spawn_prediction(body.model, body.job.model_dump())
    return JobStatusResponse(
        job_id=job_id,
        model=body.model,
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
