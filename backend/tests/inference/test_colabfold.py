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


# ── edge cases (Task 4.5) ─────────────────────────────────────────────


@respx.mock
def test_fetch_msa_raises_on_submit_html_body() -> None:
    """Some upstream proxies return an HTML error page on overload —
    ``response.json()`` then raises ``ValueError``.
    """
    respx.post(f"{COLABFOLD_API}/ticket/msa").mock(
        return_value=httpx.Response(200, text="<html><body>503 — overloaded</body></html>"),
    )
    with pytest.raises(ColabFoldError, match=r"non-JSON"):
        fetch_msa_for("MEEP", poll_interval_s=0.0)


@respx.mock
def test_fetch_msa_raises_on_submit_500() -> None:
    """5xx during submit surfaces as ``ColabFoldError`` with the HTTP status."""
    respx.post(f"{COLABFOLD_API}/ticket/msa").mock(return_value=httpx.Response(500, text="oops"))
    with pytest.raises(ColabFoldError, match=r"HTTP 500"):
        fetch_msa_for("MEEP", poll_interval_s=0.0)


@respx.mock
def test_fetch_msa_raises_on_submit_response_missing_id() -> None:
    """200 OK + JSON body without ``id`` → ``ColabFoldError``."""
    respx.post(f"{COLABFOLD_API}/ticket/msa").mock(
        return_value=httpx.Response(200, json={"unexpected": "shape"})
    )
    with pytest.raises(ColabFoldError, match=r"'id'"):
        fetch_msa_for("MEEP", poll_interval_s=0.0)


@respx.mock
def test_fetch_msa_raises_on_poll_5xx() -> None:
    """A 5xx during polling surfaces as ``ColabFoldError`` (not a hang)."""
    respx.post(f"{COLABFOLD_API}/ticket/msa").mock(
        return_value=httpx.Response(200, json={"id": "t"})
    )
    respx.get(f"{COLABFOLD_API}/ticket/t").mock(return_value=httpx.Response(502, text=""))
    with pytest.raises(ColabFoldError, match=r"HTTP 502"):
        fetch_msa_for("MEEP", poll_interval_s=0.0)


@respx.mock
def test_fetch_msa_raises_on_poll_non_json() -> None:
    """Non-JSON body during polling → ``ColabFoldError``."""
    respx.post(f"{COLABFOLD_API}/ticket/msa").mock(
        return_value=httpx.Response(200, json={"id": "t"})
    )
    respx.get(f"{COLABFOLD_API}/ticket/t").mock(
        return_value=httpx.Response(200, text="<html>error</html>")
    )
    with pytest.raises(ColabFoldError, match=r"non-JSON"):
        fetch_msa_for("MEEP", poll_interval_s=0.0)
