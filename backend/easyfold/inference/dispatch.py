"""Thin wrapper around the Modal SDK for spawning and polling predictions.

This is the **only** module outside the Function-definition files
(``inference/af3.py``, ``inference/boltz.py``) that imports ``modal``.
Concentrating the SDK surface here means route handlers
(``api/v1/jobs.py``) stay easy to unit-test — they can monkeypatch
``spawn_prediction`` and ``poll_prediction`` without ever importing
``modal``.

Design constraints (see ADR 0004):

- **Stateless.** No DB, no in-memory job map. The string returned by
  :func:`spawn_prediction` is Modal's :attr:`FunctionCall.object_id`;
  the eventual GET reconstructs the FunctionCall via ``from_id``.
- **Lazy Function lookup per request.** :func:`modal.Function.from_name`
  is called inside :func:`spawn_prediction` rather than at module import.
  The backend boots even when neither Function is deployed; the user
  gets a clear ``ModalFunctionNotDeployed`` error only when they try to
  spawn.
- **Exception normalization.** Modal's exception tree is wide; we
  collapse it into three local exceptions (``JobNotFound``,
  ``ModalFunctionNotDeployed``, ``ModalDispatchError``) that the route
  layer maps to clean HTTP statuses.
"""

from typing import Any

import modal
import modal.call_graph
import modal.exception
from modal import Function

from easyfold.inference.result import ModelName

APP_BY_MODEL: dict[ModelName, tuple[str, str]] = {
    "alphafold3": ("easyfold-af3", "run_af3"),
    "boltz2": ("easyfold-boltz", "run_boltz"),
}


class JobNotFound(LookupError):
    """No Modal FunctionCall exists with the given object_id."""


class ModalFunctionNotDeployed(RuntimeError):
    """The requested Modal Function isn't deployed in this workspace.

    Surfaces a deploy-this-first message including the exact
    ``./modal/deploy.sh`` invocation the user needs.
    """


class ModalDispatchError(RuntimeError):
    """A Modal SDK call failed for an unexpected reason (network, auth, …)."""


async def spawn_prediction(model: ModelName, job_dict: dict[str, Any]) -> str:
    """Spawn a Modal call for ``model`` with ``job_dict`` and return its object_id.

    Uses Modal's async API (``.aio``) so the FastAPI event loop isn't blocked
    during the spawn round-trip.

    Raises:
        ModalFunctionNotDeployed: when the App / Function isn't deployed
            in the currently-authenticated workspace.
        ModalDispatchError: for any other Modal SDK failure.
    """
    func = _lookup_function(model)
    try:
        call = await func.spawn.aio(job_dict)
    except modal.exception.NotFoundError as exc:
        raise _not_deployed(model, exc) from exc
    except modal.exception.Error as exc:
        # Modal's ``Function.from_name`` is lazy — the actual "App not found"
        # error often surfaces here as a generic ``Error`` rather than the
        # typed ``NotFoundError``. Detect it by message and surface the
        # actionable "deploy this first" message.
        if _is_not_found_error(exc):
            raise _not_deployed(model, exc) from exc
        raise ModalDispatchError(f"failed to spawn {model} job: {exc}") from exc
    object_id: str = call.object_id
    return object_id


async def poll_prediction(
    job_id: str,
) -> tuple[str, dict[str, Any] | None, str | None]:
    """Return ``(status, result, error)`` for a previously-spawned Modal call.

    Uses Modal's async ``call.get.aio()`` so the FastAPI event loop isn't
    blocked during the (immediate-timeout) poll. ``from_id`` is kept sync
    because it doesn't touch the network — it just constructs a reference.

    Status is one of ``"running"``, ``"succeeded"``, or ``"failed"``.
    (``"pending"`` is what :func:`spawn_prediction`'s caller reports for
    the immediate post-spawn snapshot — we don't poll Modal there.)

    Raises:
        JobNotFound: when ``job_id`` doesn't map to a known FunctionCall
            (including the case where the result has expired beyond
            Modal's retention window).
        ModalDispatchError: for any other Modal SDK failure.
    """
    try:
        call = modal.FunctionCall.from_id(job_id)
    except modal.exception.NotFoundError as exc:
        raise JobNotFound(f"unknown job {job_id}") from exc
    except modal.exception.Error as exc:
        # As with ``Function.from_name`` (see ``spawn_prediction``),
        # ``FunctionCall.from_id`` can surface "no such call" as a generic
        # ``Error``. Treat any "not found" message as JobNotFound (→ 404)
        # so the route layer doesn't 502 on a legitimately-missing id.
        if _is_not_found_error(exc):
            raise JobNotFound(f"unknown job {job_id}") from exc
        raise ModalDispatchError(f"failed to poll {job_id}: {exc}") from exc

    # Inspect the call graph BEFORE polling the result. ``get(timeout=0)``
    # raises ``TimeoutError`` while Modal is still retrying a crash-looping
    # container, so without this check the route reports ``"running"``
    # forever (until the Function's 30-minute timeout fires). The call
    # graph surfaces ``INIT_FAILURE`` / ``TERMINATED`` directly so we can
    # flip the job to ``"failed"`` immediately. See the post-3.3 validation
    # report for the user-visible symptom this addresses.
    terminal_failure = await _check_terminal_failure(call, job_id)
    if terminal_failure is not None:
        return ("failed", None, terminal_failure)

    try:
        result = await call.get.aio(timeout=0)
    except TimeoutError:
        return ("running", None, None)
    except modal.exception.OutputExpiredError as exc:
        raise JobNotFound(f"job {job_id} expired beyond Modal's retention window") from exc
    except modal.exception.RemoteError as exc:
        return ("failed", None, str(exc))
    except modal.exception.Error as exc:
        if _is_not_found_error(exc):
            raise JobNotFound(f"unknown job {job_id}") from exc
        raise ModalDispatchError(f"failed to poll {job_id}: {exc}") from exc

    if not isinstance(result, dict):
        raise ModalDispatchError(f"job {job_id} returned {type(result).__name__}, expected dict")
    typed_result: dict[str, Any] = result
    return ("succeeded", typed_result, None)


async def _check_terminal_failure(call: "modal.FunctionCall[Any]", job_id: str) -> str | None:
    """Return an error string if the call is in a terminal-failure state, else None.

    Detects ``INIT_FAILURE`` (container couldn't start — e.g. missing image
    deps, ``ModuleNotFoundError`` at boot) and ``TERMINATED`` (call was
    cancelled). Both are non-recoverable; the route should flip the job to
    ``"failed"`` instead of polling forever.

    Empty / unavailable call graphs (e.g. transient Modal API hiccup, or
    the call hasn't been scheduled yet) are treated as "no signal" and the
    caller falls through to ``get(timeout=0)``. We err on the side of
    "keep polling" so a flaky call-graph call doesn't cause spurious
    ``failed`` reports.
    """
    try:
        graph = await call.get_call_graph.aio()
    except modal.exception.Error:
        # Don't surface call-graph failures to the user; just skip the check
        # and let ``get(timeout=0)`` do its job.
        return None

    if not graph:
        return None

    # Single-input calls (our case — POST /jobs always spawns one) have one
    # InputInfo in the top-level list. Look at its status.
    top = graph[0]
    status = top.status
    if status == modal.call_graph.InputStatus.INIT_FAILURE:
        return (
            f"job {job_id} failed: container could not start (Modal INIT_FAILURE). "
            "Check `uv run modal app logs <app-name>` for the underlying error — "
            "common causes are missing image dependencies or a startup-time import error."
        )
    if status == modal.call_graph.InputStatus.TERMINATED:
        return f"job {job_id} was terminated before completion."
    if status == modal.call_graph.InputStatus.TIMEOUT:
        return f"job {job_id} exceeded the Modal Function's configured timeout."
    return None


def _lookup_function(model: ModelName) -> "Function[Any, Any, Any]":
    app_name, func_name = APP_BY_MODEL[model]
    try:
        return modal.Function.from_name(app_name, func_name)
    except modal.exception.NotFoundError as exc:
        raise _not_deployed(model, exc) from exc


def _not_deployed(model: ModelName, exc: BaseException) -> ModalFunctionNotDeployed:
    app_name, func_name = APP_BY_MODEL[model]
    deploy_arg = "af3" if model == "alphafold3" else "boltz"
    return ModalFunctionNotDeployed(
        f"Modal Function {app_name}/{func_name} is not deployed in this workspace. "
        f"Run `./modal/deploy.sh {deploy_arg}` first. (Underlying error: {exc})"
    )


def _is_not_found_error(exc: BaseException) -> bool:
    """Modal sometimes surfaces 'not found' as a generic ``Error`` rather than
    the typed ``NotFoundError`` (especially from the lazy ``Function.from_name``
    + ``spawn`` path and from ``FunctionCall.from_id``). Match on the message."""
    msg = str(exc).lower()
    return "not found" in msg or "no function call" in msg
