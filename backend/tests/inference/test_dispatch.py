"""Unit tests for the Modal SDK wrapper.

We mock ``modal.Function.from_name`` and ``modal.FunctionCall.from_id``
directly so these tests never touch the network. The route layer tests
(``tests/api/test_jobs.py``) mock at the next-higher seam (the
``dispatch`` module functions themselves), so this file is the only
place that needs to reason about the SDK's exception classes.

``spawn_prediction`` and ``poll_prediction`` are async (they use Modal's
``.aio`` interfaces under the hood). Tests are ``async def`` and mock
the awaited methods via ``AsyncMock``.
"""

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import modal.exception
import pytest

from easyfold.inference import dispatch
from easyfold.inference.dispatch import (
    JobNotFound,
    ModalDispatchError,
    ModalFunctionNotDeployed,
    poll_prediction,
    spawn_prediction,
)

# ── spawn_prediction ─────────────────────────────────────────────────


async def test_spawn_returns_function_call_object_id(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_call = MagicMock(object_id="fc-deadbeef")
    fake_func = MagicMock()
    fake_func.spawn.aio = AsyncMock(return_value=fake_call)
    monkeypatch.setattr(dispatch.modal.Function, "from_name", lambda *_a, **_kw: fake_func)

    result = await spawn_prediction("boltz2", {"name": "smoke", "sequences": []})

    assert result == "fc-deadbeef"
    fake_func.spawn.aio.assert_awaited_once_with({"name": "smoke", "sequences": []})


async def test_spawn_raises_not_deployed_with_helpful_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def boom(*_args: Any, **_kwargs: Any) -> Any:
        raise modal.exception.NotFoundError("App easyfold-boltz not found")

    monkeypatch.setattr(dispatch.modal.Function, "from_name", boom)

    with pytest.raises(ModalFunctionNotDeployed) as excinfo:
        await spawn_prediction("boltz2", {})
    msg = str(excinfo.value)
    assert "easyfold-boltz" in msg
    assert "./modal/deploy.sh boltz" in msg


async def test_spawn_translates_unknown_modal_error_to_dispatch_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_func = MagicMock()
    fake_func.spawn.aio = AsyncMock(side_effect=modal.exception.AuthError("not logged in"))
    monkeypatch.setattr(dispatch.modal.Function, "from_name", lambda *_a, **_kw: fake_func)

    with pytest.raises(ModalDispatchError, match="not logged in"):
        await spawn_prediction("alphafold3", {})


async def test_spawn_translates_message_based_not_found_from_spawn(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Real-life Modal SDK: `Function.from_name` is lazy; the actual
    "App not found" surfaces from `spawn()` as a generic `Error`, not
    as the typed `NotFoundError`. We translate by message."""
    fake_func = MagicMock()
    fake_func.spawn.aio = AsyncMock(
        side_effect=modal.exception.ExecutionError(
            "Lookup failed for Function 'run_boltz' from the 'easyfold-boltz' app: "
            "App 'easyfold-boltz' not found in environment 'main'."
        )
    )
    monkeypatch.setattr(dispatch.modal.Function, "from_name", lambda *_a, **_kw: fake_func)

    with pytest.raises(ModalFunctionNotDeployed) as excinfo:
        await spawn_prediction("boltz2", {})
    assert "./modal/deploy.sh boltz" in str(excinfo.value)


# ── poll_prediction ──────────────────────────────────────────────────


def _empty_graph_call() -> MagicMock:
    """Return a fake FunctionCall whose ``get_call_graph().aio()`` resolves to
    an empty list — i.e. "no terminal-failure signal, fall through to get()".
    Tests that exercise the init-failure detection branch override
    ``get_call_graph.aio`` themselves.
    """
    fake = MagicMock()
    fake.get_call_graph.aio = AsyncMock(return_value=[])
    return fake


async def test_poll_returns_running_when_get_times_out(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_call = _empty_graph_call()
    fake_call.get.aio = AsyncMock(side_effect=TimeoutError("not ready"))
    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", lambda _id: fake_call)

    status, result, error = await poll_prediction("fc-xxx")
    assert status == "running"
    assert result is None
    assert error is None


async def test_poll_returns_succeeded_with_result_dict(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {"model": "boltz2", "name": "smoke", "cif": "data_x\n"}
    fake_call = _empty_graph_call()
    fake_call.get.aio = AsyncMock(return_value=payload)
    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", lambda _id: fake_call)

    status, result, error = await poll_prediction("fc-ok")
    assert status == "succeeded"
    assert result == payload
    assert error is None


async def test_poll_returns_failed_when_remote_function_raised(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_call = _empty_graph_call()
    fake_call.get.aio = AsyncMock(
        side_effect=modal.exception.RemoteError("subprocess returned non-zero")
    )
    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", lambda _id: fake_call)

    status, result, error = await poll_prediction("fc-bad")
    assert status == "failed"
    assert result is None
    assert error is not None and "subprocess returned non-zero" in error


async def test_poll_raises_job_not_found_for_unknown_id(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(_id: str) -> Any:
        raise modal.exception.NotFoundError("no such call")

    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", boom)

    with pytest.raises(JobNotFound, match="fc-missing"):
        await poll_prediction("fc-missing")


async def test_poll_translates_message_based_not_found_from_from_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Real-life Modal SDK raises a generic `Error` (not `NotFoundError`)
    with "No Function Call with ID ..." for unknown ids. Translate by message."""

    def boom(_id: str) -> Any:
        raise modal.exception.ExecutionError("No Function Call with ID 'fc-doesnotexist' found.")

    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", boom)

    with pytest.raises(JobNotFound, match="fc-doesnotexist"):
        await poll_prediction("fc-doesnotexist")


async def test_poll_raises_job_not_found_for_expired_output(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_call = _empty_graph_call()
    fake_call.get.aio = AsyncMock(
        side_effect=modal.exception.OutputExpiredError("garbage collected")
    )
    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", lambda _id: fake_call)

    with pytest.raises(JobNotFound, match="expired"):
        await poll_prediction("fc-stale")


async def test_poll_raises_dispatch_error_for_unknown_modal_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_call = _empty_graph_call()
    fake_call.get.aio = AsyncMock(side_effect=modal.exception.AuthError("token expired"))
    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", lambda _id: fake_call)

    with pytest.raises(ModalDispatchError, match="token expired"):
        await poll_prediction("fc-auth")


async def test_poll_raises_when_function_returned_non_dict(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_call = _empty_graph_call()
    fake_call.get.aio = AsyncMock(return_value="unexpected string")
    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", lambda _id: fake_call)

    with pytest.raises(ModalDispatchError, match="expected dict"):
        await poll_prediction("fc-weird")


# ── terminal-failure detection (call-graph signal) ──────────────────────


def _input_info_with_status(status: dispatch.modal.call_graph.InputStatus) -> MagicMock:
    """Mimic ``modal.call_graph.InputInfo`` with just the ``.status`` we read."""
    info = MagicMock()
    info.status = status
    return info


async def test_poll_returns_failed_on_init_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    """``INIT_FAILURE`` (container crash-loops at startup, e.g. missing image
    deps) flips the job to ``failed`` immediately rather than polling forever.
    Reproduces the user-visible symptom from the post-3.3 validation
    (pre-``add_local_python_source`` Modal runs).
    """
    fake_call = MagicMock()
    fake_call.get_call_graph.aio = AsyncMock(
        return_value=[_input_info_with_status(dispatch.modal.call_graph.InputStatus.INIT_FAILURE)]
    )
    # If the code path is wrong and we reach get(), this would also surface;
    # set it so the test fails loudly rather than hanging.
    fake_call.get.aio = AsyncMock(side_effect=AssertionError("should not reach get()"))
    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", lambda _id: fake_call)

    status, result, error = await poll_prediction("fc-crashloop")
    assert status == "failed"
    assert result is None
    assert error is not None
    assert "INIT_FAILURE" in error
    assert "fc-crashloop" in error


async def test_poll_returns_failed_on_terminated(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_call = MagicMock()
    fake_call.get_call_graph.aio = AsyncMock(
        return_value=[_input_info_with_status(dispatch.modal.call_graph.InputStatus.TERMINATED)]
    )
    fake_call.get.aio = AsyncMock(side_effect=AssertionError("should not reach get()"))
    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", lambda _id: fake_call)

    status, _result, error = await poll_prediction("fc-killed")
    assert status == "failed"
    assert error is not None and "terminated" in error.lower()


async def test_poll_returns_failed_on_timeout_status(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_call = MagicMock()
    fake_call.get_call_graph.aio = AsyncMock(
        return_value=[_input_info_with_status(dispatch.modal.call_graph.InputStatus.TIMEOUT)]
    )
    fake_call.get.aio = AsyncMock(side_effect=AssertionError("should not reach get()"))
    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", lambda _id: fake_call)

    status, _result, error = await poll_prediction("fc-slow")
    assert status == "failed"
    assert error is not None and "timeout" in error.lower()


async def test_poll_falls_through_when_call_graph_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No call-graph signal yet (just-spawned call) — fall through to get()."""
    fake_call = MagicMock()
    fake_call.get_call_graph.aio = AsyncMock(return_value=[])
    fake_call.get.aio = AsyncMock(side_effect=TimeoutError("not ready"))
    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", lambda _id: fake_call)

    status, _result, _error = await poll_prediction("fc-fresh")
    assert status == "running"


async def test_poll_falls_through_when_call_graph_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A transient call-graph API hiccup shouldn't flip the job to failed —
    suppress the error and let ``get(timeout=0)`` decide."""
    fake_call = MagicMock()
    fake_call.get_call_graph.aio = AsyncMock(
        side_effect=modal.exception.InternalError("call-graph upstream hiccup")
    )
    fake_call.get.aio = AsyncMock(return_value={"model": "boltz2", "name": "ok"})
    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", lambda _id: fake_call)

    status, result, _error = await poll_prediction("fc-flaky")
    assert status == "succeeded"
    assert result == {"model": "boltz2", "name": "ok"}


# ── edge cases (Task 4.5) ─────────────────────────────────────────────


async def test_poll_uses_only_first_input_info_when_multiple_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Single-input calls (our case) have exactly one ``InputInfo``; if the
    SDK returns multiple, we read ``[0]`` and ignore the rest. Documenting
    the current behavior in case Modal ever introduces fan-out semantics
    we'd need to revisit.
    """
    fake_call = MagicMock()
    fake_call.get_call_graph.aio = AsyncMock(
        return_value=[
            _input_info_with_status(dispatch.modal.call_graph.InputStatus.INIT_FAILURE),
            _input_info_with_status(dispatch.modal.call_graph.InputStatus.SUCCESS),
        ]
    )
    fake_call.get.aio = AsyncMock(side_effect=AssertionError("should not reach get()"))
    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", lambda _id: fake_call)

    status, _result, error = await poll_prediction("fc-multi")
    assert status == "failed"
    assert error is not None and "INIT_FAILURE" in error


async def test_poll_falls_through_on_pending_status(monkeypatch: pytest.MonkeyPatch) -> None:
    """``PENDING`` is not a terminal-failure state; fall through to ``get()``."""
    fake_call = MagicMock()
    fake_call.get_call_graph.aio = AsyncMock(
        return_value=[_input_info_with_status(dispatch.modal.call_graph.InputStatus.PENDING)]
    )
    fake_call.get.aio = AsyncMock(side_effect=TimeoutError("not ready"))
    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", lambda _id: fake_call)

    status, _result, _error = await poll_prediction("fc-pending")
    assert status == "running"


async def test_spawn_with_long_job_dict_does_not_crash(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Defensive — a 5000-aa sequence wrapped in the job dict goes through
    unchanged. No size cap in dispatch; the upstream Pydantic models +
    Modal SDK handle it."""
    fake_call = MagicMock(object_id="fc-big")
    fake_func = MagicMock()
    fake_func.spawn.aio = AsyncMock(return_value=fake_call)
    monkeypatch.setattr(dispatch.modal.Function, "from_name", lambda *_a, **_kw: fake_func)

    big_seq = "M" + ("A" * 4999)
    job = {"name": "huge", "proteins": [{"sequence": big_seq}]}
    result = await spawn_prediction("boltz2", job)

    assert result == "fc-big"
    sent_job = fake_func.spawn.aio.await_args.args[0]
    assert len(sent_job["proteins"][0]["sequence"]) == 5000


async def test_poll_handles_long_job_id(monkeypatch: pytest.MonkeyPatch) -> None:
    """A 256-char id is malformed for Modal but the dispatch wrapper must
    surface it as ``JobNotFound`` (→ 404), not crash with a different error.
    """

    def boom(_id: str) -> Any:
        raise modal.exception.NotFoundError("no such call")

    monkeypatch.setattr(dispatch.modal.FunctionCall, "from_id", boom)

    long_id = "fc-" + ("x" * 253)
    with pytest.raises(JobNotFound):
        await poll_prediction(long_id)
