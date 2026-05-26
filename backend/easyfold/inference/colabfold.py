"""Fetch protein MSAs from ColabFold's public mmseqs2 server.

The server is the open-source ColabFold MSA backend
(https://github.com/sokrypton/ColabFold) hosted at api.colabfold.com.
For academic use it is free and rate-limited; commercial users should
self-host the same server image.

This module is imported from inside the Modal container (see ``af3.py``),
so ``httpx`` is a hard runtime dep — but it's already required by
easyfold.external. The synchronous client is fine here because the calling
Modal Function is itself sync (Modal runs each invocation in its own worker).

The exact endpoint / poll cadence below matches the public API as of writing.
On the **first real end-to-end run** (once AF3 weights are provisioned),
verify the response shapes still match — the ColabFold project has changed
the wire format historically. See `modal/README.md` § Troubleshooting.
"""

import time

import httpx

COLABFOLD_API = "https://api.colabfold.com"
USER_AGENT = "easyfold/0.1 (+https://github.com/easyfold/easyfold)"

DEFAULT_POLL_INTERVAL_S = 5.0
DEFAULT_TOTAL_TIMEOUT_S = 60.0 * 10  # 10 min — ColabFold can be slow under load


class ColabFoldError(RuntimeError):
    """The MSA server returned an error or unexpected response."""


class ColabFoldTimeout(ColabFoldError):
    """Polling for an MSA job exceeded the total timeout budget."""


def fetch_msa_for(
    sequence: str,
    *,
    mode: str = "env",
    poll_interval_s: float = DEFAULT_POLL_INTERVAL_S,
    total_timeout_s: float = DEFAULT_TOTAL_TIMEOUT_S,
    client: httpx.Client | None = None,
) -> str:
    """Submit ``sequence`` to ColabFold and return the A3M MSA text.

    Args:
        sequence: Single-letter amino acid sequence (no FASTA header).
        mode: ColabFold MSA mode. ``"env"`` (default) uses ColabFold's
            environmental databases; ``"pdb"`` uses templates only. Match
            whatever AF3 expects for ``unpairedMsa``.
        poll_interval_s: Seconds between job-status polls.
        total_timeout_s: Total wall-clock budget for the entire fetch.
        client: Optional pre-configured ``httpx.Client``; useful in tests.

    Raises:
        ColabFoldError: server returned a non-success status or unparseable body.
        ColabFoldTimeout: total_timeout_s elapsed before the job finished.
    """
    own_client = client is None
    if client is None:
        client = httpx.Client(
            base_url=COLABFOLD_API,
            headers={"User-Agent": USER_AGENT},
            timeout=httpx.Timeout(30.0, connect=10.0),
        )

    try:
        ticket_id = _submit_ticket(client, sequence=sequence, mode=mode)
        _poll_until_complete(
            client,
            ticket_id=ticket_id,
            poll_interval_s=poll_interval_s,
            total_timeout_s=total_timeout_s,
        )
        return _download_a3m(client, ticket_id=ticket_id)
    finally:
        if own_client:
            client.close()


def _submit_ticket(client: httpx.Client, *, sequence: str, mode: str) -> str:
    response = client.post("/ticket/msa", data={"q": sequence, "mode": mode})
    if response.status_code != 200:
        raise ColabFoldError(
            f"MSA submit returned HTTP {response.status_code}: {response.text[:200]}"
        )
    try:
        payload = response.json()
    except ValueError as exc:
        raise ColabFoldError("MSA submit returned non-JSON body") from exc
    ticket_id = payload.get("id")
    if not isinstance(ticket_id, str):
        raise ColabFoldError(f"MSA submit response missing 'id': {payload!r}")
    return ticket_id


def _poll_until_complete(
    client: httpx.Client,
    *,
    ticket_id: str,
    poll_interval_s: float,
    total_timeout_s: float,
) -> None:
    deadline = time.monotonic() + total_timeout_s
    while time.monotonic() < deadline:
        response = client.get(f"/ticket/{ticket_id}")
        if response.status_code != 200:
            raise ColabFoldError(
                f"MSA poll returned HTTP {response.status_code} for ticket {ticket_id}"
            )
        try:
            payload = response.json()
        except ValueError as exc:
            raise ColabFoldError("MSA poll returned non-JSON body") from exc
        status = payload.get("status")
        if status == "COMPLETE":
            return
        if status == "ERROR":
            raise ColabFoldError(f"MSA job {ticket_id} failed: {payload!r}")
        time.sleep(poll_interval_s)
    raise ColabFoldTimeout(f"MSA job {ticket_id} did not complete within {total_timeout_s:.0f}s")


def _download_a3m(client: httpx.Client, *, ticket_id: str) -> str:
    response = client.get(f"/result/download/{ticket_id}")
    if response.status_code != 200:
        raise ColabFoldError(
            f"MSA download returned HTTP {response.status_code} for ticket {ticket_id}"
        )
    # ColabFold returns the A3M body either as raw text or inside a tarball
    # depending on the endpoint version. Treat the response as text for the
    # raw-A3M path; the tarball path requires a parser we can add later if
    # the server forces it.
    content_type = response.headers.get("content-type", "").lower()
    if content_type.startswith(("text/html", "application/json")):
        # ColabFold occasionally returns an error page (HTML) or a JSON
        # error payload instead of the A3M body — surface that as an error
        # rather than feeding HTML to the downstream parser.
        raise ColabFoldError(
            f"MSA download for ticket {ticket_id} returned {content_type!r} instead of A3M "
            "— ColabFold may be returning an error page or rate-limit response"
        )

    body = response.text
    if not body.strip():
        raise ColabFoldError(f"MSA download for ticket {ticket_id} was empty")

    # A3M files start with a FASTA-style header line (e.g. ">seq\n..."). If the
    # body looks like anything else, fail loudly rather than passing garbage to
    # the downstream AF3 / Boltz consumers.
    if not body.lstrip().startswith(">"):
        raise ColabFoldError(
            f"MSA download for ticket {ticket_id} returned unexpected format "
            f"(expected A3M starting with '>'); body prefix={body[:200]!r}"
        )
    return body
