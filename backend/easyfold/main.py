import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import RequestResponseEndpoint

from easyfold.api.v1 import router as v1_router
from easyfold.external import (
    ExternalSourceUnavailable,
    MalformedExternalResponse,
    SequenceNotFound,
)
from easyfold.inference.dispatch import (
    JobNotFound,
    ModalDispatchError,
    ModalFunctionNotDeployed,
)

# 5 MB is comfortably above the largest legitimate assembly POST (a
# 3000 aa x 10 chains x 5 seeds job is ~150 KB) and well below the point
# where parsing starts costing real CPU. The cap is defense-in-depth:
# Pydantic validation would also reject oversized inputs, but bouncing
# huge bodies before parsing avoids waste.
MAX_REQUEST_BODY_BYTES = 5 * 1024 * 1024

app = FastAPI(title="EasyFold API", version="0.1.0")


@app.middleware("http")
async def limit_request_body_size(request: Request, call_next: RequestResponseEndpoint) -> Response:
    """Reject requests whose declared body size exceeds ``MAX_REQUEST_BODY_BYTES``.

    Only enforces against ``Content-Length`` — chunked requests without a
    declared length pass through to the route, which is fine because every
    real EasyFold body is small JSON.
    """
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_REQUEST_BODY_BYTES:
        return JSONResponse(
            status_code=413,
            content={
                "detail": (
                    f"request body too large ({declared} bytes > "
                    f"{MAX_REQUEST_BODY_BYTES} bytes limit)"
                )
            },
        )
    return await call_next(request)


# Default includes both 3000 and 3001 because Next.js dev auto-falls-back to
# 3001 when 3000 is busy — a common dev-time footgun. Override via env var if
# you run the frontend on a different port.
_cors_origins = os.environ.get(
    "EASYFOLD_CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3001",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")


@app.exception_handler(SequenceNotFound)
async def _sequence_not_found(_request: object, exc: SequenceNotFound) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ExternalSourceUnavailable)
async def _source_unavailable(_request: object, exc: ExternalSourceUnavailable) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.exception_handler(MalformedExternalResponse)
async def _malformed_response(_request: object, exc: MalformedExternalResponse) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.exception_handler(JobNotFound)
async def _job_not_found(_request: object, exc: JobNotFound) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ModalFunctionNotDeployed)
async def _modal_not_deployed(_request: object, exc: ModalFunctionNotDeployed) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.exception_handler(ModalDispatchError)
async def _modal_dispatch_error(_request: object, exc: ModalDispatchError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": str(exc)})
