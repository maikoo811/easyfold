import httpx
import pytest
import respx

from easyfold.inference.colabfold import (
    COLABFOLD_API,
    ColabFoldError,
    ColabFoldTimeout,
    fetch_msa_for,
)


@respx.mock
def test_fetch_msa_happy_path() -> None:
    respx.post(f"{COLABFOLD_API}/ticket/msa").mock(
        return_value=httpx.Response(200, json={"id": "ticket-123"})
    )
    respx.get(f"{COLABFOLD_API}/ticket/ticket-123").mock(
        return_value=httpx.Response(200, json={"status": "COMPLETE"})
    )
    respx.get(f"{COLABFOLD_API}/result/download/ticket-123").mock(
        return_value=httpx.Response(200, text=">seq\nMEEPQSDP\n")
    )

    result = fetch_msa_for("MEEPQSDP", poll_interval_s=0.0)

    assert result == ">seq\nMEEPQSDP\n"


@respx.mock
def test_fetch_msa_polls_until_complete() -> None:
    respx.post(f"{COLABFOLD_API}/ticket/msa").mock(
        return_value=httpx.Response(200, json={"id": "t"})
    )
    poll_route = respx.get(f"{COLABFOLD_API}/ticket/t")
    poll_route.side_effect = [
        httpx.Response(200, json={"status": "PENDING"}),
        httpx.Response(200, json={"status": "RUNNING"}),
        httpx.Response(200, json={"status": "COMPLETE"}),
    ]
    respx.get(f"{COLABFOLD_API}/result/download/t").mock(
        return_value=httpx.Response(200, text="msa")
    )

    result = fetch_msa_for("MEEP", poll_interval_s=0.0)

    assert result == "msa"
    assert poll_route.call_count == 3


@respx.mock
def test_fetch_msa_raises_on_submit_5xx() -> None:
    respx.post(f"{COLABFOLD_API}/ticket/msa").mock(
        return_value=httpx.Response(503, text="unavailable")
    )

    with pytest.raises(ColabFoldError, match=r"HTTP 503"):
        fetch_msa_for("MEEP", poll_interval_s=0.0)


@respx.mock
def test_fetch_msa_raises_on_job_error() -> None:
    respx.post(f"{COLABFOLD_API}/ticket/msa").mock(
        return_value=httpx.Response(200, json={"id": "t"})
    )
    respx.get(f"{COLABFOLD_API}/ticket/t").mock(
        return_value=httpx.Response(200, json={"status": "ERROR", "reason": "bad seq"})
    )

    with pytest.raises(ColabFoldError, match=r"failed"):
        fetch_msa_for("MEEP", poll_interval_s=0.0)


@respx.mock
def test_fetch_msa_times_out() -> None:
    respx.post(f"{COLABFOLD_API}/ticket/msa").mock(
        return_value=httpx.Response(200, json={"id": "t"})
    )
    respx.get(f"{COLABFOLD_API}/ticket/t").mock(
        return_value=httpx.Response(200, json={"status": "RUNNING"})
    )

    with pytest.raises(ColabFoldTimeout):
        fetch_msa_for("MEEP", poll_interval_s=0.0, total_timeout_s=0.05)


@respx.mock
def test_fetch_msa_raises_on_empty_download() -> None:
    respx.post(f"{COLABFOLD_API}/ticket/msa").mock(
        return_value=httpx.Response(200, json={"id": "t"})
    )
    respx.get(f"{COLABFOLD_API}/ticket/t").mock(
        return_value=httpx.Response(200, json={"status": "COMPLETE"})
    )
    respx.get(f"{COLABFOLD_API}/result/download/t").mock(return_value=httpx.Response(200, text=""))

    with pytest.raises(ColabFoldError, match=r"empty"):
        fetch_msa_for("MEEP", poll_interval_s=0.0)
