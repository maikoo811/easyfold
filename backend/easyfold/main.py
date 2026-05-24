import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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

app = FastAPI(title="EasyFold API", version="0.1.0")

_cors_origins = os.environ.get("EASYFOLD_CORS_ORIGINS", "http://localhost:3000")
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
