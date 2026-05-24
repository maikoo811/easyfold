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


def spawn_prediction(model: ModelName, job_dict: dict[str, Any]) -> str:
    """Spawn a Modal call for ``model`` with ``job_dict`` and return its object_id.

    Raises:
        ModalFunctionNotDeployed: when the App / Function isn't deployed
            in the currently-authenticated workspace.
        ModalDispatchError: for any other Modal SDK failure.
    """
    func = _lookup_function(model)
    try:
        call = func.spawn(job_dict)
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


def poll_prediction(job_id: str) -> tuple[str, dict[str, Any] | None, str | None]:
    """Return ``(status, result, error)`` for a previously-spawned Modal call.

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

    try:
        result = call.get(timeout=0)
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
