"""Route-level tests for POST /jobs and GET /jobs/{id}.

Modal is mocked at the ``inference.dispatch`` boundary — never imported
directly in these tests. The dispatch module's own tests
(``tests/inference/test_dispatch.py``) cover the Modal SDK behavior.
"""

from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest
from httpx import ASGITransport

from easyfold.inference.dispatch import (
    JobNotFound,
    ModalDispatchError,
    ModalFunctionNotDeployed,
)
from easyfold.main import app

transport = ASGITransport(app=app)


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=transport, base_url="http://test")


def _sample_result() -> dict[str, Any]:
    return {
        "model": "boltz2",
        "name": "smoke",
        "cif": "data_smoke\n",
        "plddt": [80.0, 85.0],
        "pae": [[0.0, 5.0], [5.0, 0.0]],
        "iptm": None,
        "ptm": 0.81,
        "ranking_score": 0.78,
        "sample_dir_name": "smoke_model_0",
        "extras": {"confidence_summary": {"ptm": 0.81}},
    }


def _job_body(model: str = "boltz2") -> dict[str, Any]:
    return {
        "model": model,
        "job": {"name": "smoke", "proteins": [{"sequence": "MEEPGGGG"}]},
    }


# ── POST /api/v1/jobs ────────────────────────────────────────────────


async def test_post_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "easyfold.api.v1.jobs.spawn_prediction", AsyncMock(return_value="fc-abc123")
    )

    async with _client() as c:
        resp = await c.post("/api/v1/jobs", json=_job_body())

    assert resp.status_code == 200
    body = resp.json()
    assert body["job_id"] == "fc-abc123"
    assert body["model"] == "boltz2"
    assert body["status"] == "pending"
    assert body["result"] is None
    assert body["error"] is None


async def test_post_routes_model_through_to_dispatch(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    async def fake_spawn(model: str, job: dict[str, Any]) -> str:
        captured["model"] = model
        captured["job"] = job
        return "fc-zzz"

    monkeypatch.setattr("easyfold.api.v1.jobs.spawn_prediction", fake_spawn)

    async with _client() as c:
        await c.post("/api/v1/jobs", json=_job_body("alphafold3"))

    assert captured["model"] == "alphafold3"
    assert captured["job"]["name"] == "smoke"
    assert captured["job"]["proteins"][0]["sequence"] == "MEEPGGGG"


async def test_post_returns_502_when_function_not_deployed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def boom(_m: str, _j: dict[str, Any]) -> str:
        raise ModalFunctionNotDeployed(
            "Modal Function easyfold-boltz/run_boltz is not deployed in this workspace. "
            "Run `./modal/deploy.sh boltz` first."
        )

    monkeypatch.setattr("easyfold.api.v1.jobs.spawn_prediction", boom)

    async with _client() as c:
        resp = await c.post("/api/v1/jobs", json=_job_body())

    assert resp.status_code == 502
    detail = resp.json()["detail"]
    assert "./modal/deploy.sh boltz" in detail


async def test_post_returns_502_when_dispatch_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    async def boom(_m: str, _j: dict[str, Any]) -> str:
        raise ModalDispatchError("auth token expired")

    monkeypatch.setattr("easyfold.api.v1.jobs.spawn_prediction", boom)

    async with _client() as c:
        resp = await c.post("/api/v1/jobs", json=_job_body())

    assert resp.status_code == 502
    assert "auth token expired" in resp.json()["detail"]


async def test_post_returns_422_for_unknown_model() -> None:
    async with _client() as c:
        resp = await c.post(
            "/api/v1/jobs",
            json={"model": "rosettafold", "job": {"name": "x", "proteins": [{"sequence": "M"}]}},
        )
    assert resp.status_code == 422


async def test_post_returns_422_for_missing_proteins() -> None:
    async with _client() as c:
        resp = await c.post("/api/v1/jobs", json={"model": "boltz2", "job": {"name": "x"}})
    assert resp.status_code == 422


async def test_post_returns_422_for_invalid_sequence() -> None:
    async with _client() as c:
        resp = await c.post(
            "/api/v1/jobs",
            json={"model": "boltz2", "job": {"name": "x", "proteins": [{"sequence": "ZZZ*!"}]}},
        )
    assert resp.status_code == 422


async def test_post_accepts_full_assembly(monkeypatch: pytest.MonkeyPatch) -> None:
    """Task 3.4 surface: POST accepts a job with copies + modifications + ligand."""
    captured: dict[str, Any] = {}

    async def fake_spawn(model: str, job: dict[str, Any]) -> str:
        captured["job"] = job
        return "fc-assembly"

    monkeypatch.setattr("easyfold.api.v1.jobs.spawn_prediction", fake_spawn)

    body = {
        "model": "alphafold3",
        "job": {
            "name": "p53_complex",
            "proteins": [
                {
                    "sequence": "MEEPGGGG",
                    "copies": 2,
                    "modifications": [{"ptm_type": "PHOSPHO", "ptm_position": 4}],
                }
            ],
            "ligands": [{"smiles": "CCO", "copies": 1}],
        },
    }

    async with _client() as c:
        resp = await c.post("/api/v1/jobs", json=body)

    assert resp.status_code == 200
    assert resp.json()["job_id"] == "fc-assembly"
    # Dispatch sees the full PredictionJob shape: copies preserved,
    # modifications round-tripped through Pydantic, ligand included.
    job = captured["job"]
    assert job["proteins"][0]["copies"] == 2
    assert job["proteins"][0]["modifications"] == [{"ptm_type": "PHOSPHO", "ptm_position": 4}]
    assert job["ligands"][0]["smiles"] == "CCO"


# ── GET /api/v1/jobs/{id} ────────────────────────────────────────────


async def test_get_running_returns_status_only(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "easyfold.api.v1.jobs.poll_prediction",
        AsyncMock(return_value=("running", None, None)),
    )

    async with _client() as c:
        resp = await c.get("/api/v1/jobs/fc-abc")

    assert resp.status_code == 200
    body = resp.json()
    assert body["job_id"] == "fc-abc"
    assert body["status"] == "running"
    assert body["result"] is None
    assert body["error"] is None


async def test_get_succeeded_returns_full_model_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "easyfold.api.v1.jobs.poll_prediction",
        AsyncMock(return_value=("succeeded", _sample_result(), None)),
    )

    async with _client() as c:
        resp = await c.get("/api/v1/jobs/fc-done")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "succeeded"
    assert body["result"] is not None
    assert body["result"]["model"] == "boltz2"
    assert body["result"]["plddt"] == [80.0, 85.0]
    assert body["result"]["pae"] == [[0.0, 5.0], [5.0, 0.0]]
    assert body["result"]["ptm"] == 0.81
    assert body["error"] is None


async def test_get_failed_returns_error_string(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "easyfold.api.v1.jobs.poll_prediction",
        AsyncMock(return_value=("failed", None, "subprocess returned non-zero")),
    )

    async with _client() as c:
        resp = await c.get("/api/v1/jobs/fc-bad")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "failed"
    assert body["result"] is None
    assert body["error"] == "subprocess returned non-zero"


async def test_get_returns_404_for_unknown_job(monkeypatch: pytest.MonkeyPatch) -> None:
    async def boom(_id: str) -> Any:
        raise JobNotFound("unknown job fc-nope")

    monkeypatch.setattr("easyfold.api.v1.jobs.poll_prediction", boom)

    async with _client() as c:
        resp = await c.get("/api/v1/jobs/fc-nope")

    assert resp.status_code == 404
    assert "fc-nope" in resp.json()["detail"]


async def test_get_returns_502_when_modal_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    async def boom(_id: str) -> Any:
        raise ModalDispatchError("network unreachable")

    monkeypatch.setattr("easyfold.api.v1.jobs.poll_prediction", boom)

    async with _client() as c:
        resp = await c.get("/api/v1/jobs/fc-net")

    assert resp.status_code == 502
    assert "network unreachable" in resp.json()["detail"]


async def test_get_response_model_is_none_per_design(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The GET response has model=null — Modal doesn't surface the App name."""
    monkeypatch.setattr(
        "easyfold.api.v1.jobs.poll_prediction",
        AsyncMock(return_value=("succeeded", _sample_result(), None)),
    )
    async with _client() as c:
        resp = await c.get("/api/v1/jobs/fc-x")
    assert resp.json()["model"] is None
