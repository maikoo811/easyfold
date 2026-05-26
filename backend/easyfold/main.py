import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import RequestResponseEndpoint

from easyfold.api.rate_limit import LIMITER
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

# When true, upstream-error handlers ('ModalDispatchError' etc.) return a
# generic message body instead of echoing the underlying exception. The
# verbose detail still goes to server logs. Recommended for deployments
# serving untrusted users — see SECURITY.md.
GENERIC_ERRORS = os.environ.get("EASYFOLD_GENERIC_ERRORS", "").strip().lower() in (
    "1",
    "true",
    "yes",
)

_LOG = logging.getLogger("easyfold")

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


# CORS defaults to `http://localhost:3000` so the Quickstart's local dev
# stack works out of the box. Set `EASYFOLD_CORS_ORIGINS` to a comma-separated
# list to override — e.g. when Next.js dev falls back to 3001 (port collision):
#   EASYFOLD_CORS_ORIGINS=http://localhost:3000,http://localhost:3001
# or when serving the backend behind a real frontend domain in production:
#   EASYFOLD_CORS_ORIGINS=https://your-frontend.example.com
_cors_origins_raw = os.environ.get("EASYFOLD_CORS_ORIGINS", "http://localhost:3000").strip()
_cors_origins = (
    [o.strip() for o in _cors_origins_raw.split(",") if o.strip()] if _cors_origins_raw else []
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Rate limit (optional, see api/rate_limit.py) ─────────────────────────
if LIMITER is not None:
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware

    app.state.limiter = LIMITER
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limit_exceeded(_request: object, _exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={"detail": "rate limit exceeded; try again later"},
        )


app.include_router(v1_router, prefix="/api/v1")


def _upstream_detail(exc: BaseException, kind: str) -> str:
    """Decide whether to expose the upstream exception message in the response.

    When ``GENERIC_ERRORS`` is on, log the real detail and return a generic
    message; otherwise return the exception's ``str()`` (the self-host default
    — verbose errors help the deployer who's debugging their own setup).
    """
    if GENERIC_ERRORS:
        _LOG.error("upstream %s: %s", kind, exc)
        return "upstream error"
    return str(exc)


@app.exception_handler(SequenceNotFound)
async def _sequence_not_found(_request: object, exc: SequenceNotFound) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ExternalSourceUnavailable)
async def _source_unavailable(_request: object, exc: ExternalSourceUnavailable) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"detail": _upstream_detail(exc, "external_source_unavailable")},
    )


@app.exception_handler(MalformedExternalResponse)
async def _malformed_response(_request: object, exc: MalformedExternalResponse) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"detail": _upstream_detail(exc, "malformed_external_response")},
    )


@app.exception_handler(JobNotFound)
async def _job_not_found(_request: object, exc: JobNotFound) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ModalFunctionNotDeployed)
async def _modal_not_deployed(_request: object, exc: ModalFunctionNotDeployed) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"detail": _upstream_detail(exc, "modal_function_not_deployed")},
    )


@app.exception_handler(ModalDispatchError)
async def _modal_dispatch_error(_request: object, exc: ModalDispatchError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"detail": _upstream_detail(exc, "modal_dispatch_error")},
    )
