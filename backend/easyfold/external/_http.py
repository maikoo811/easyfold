import asyncio

import httpx

USER_AGENT = "easyfold/0.1 (+https://github.com/easyfold/easyfold)"
DEFAULT_TIMEOUT = httpx.Timeout(10.0, connect=5.0)

_RETRY_DELAYS_S = (0.5, 1.0)


def default_headers() -> dict[str, str]:
    return {"User-Agent": USER_AGENT}


async def get_with_retry(client: httpx.AsyncClient, url: str) -> httpx.Response:
    """GET `url`, retrying twice on 5xx with backoff (0.5s, 1s). Returns the last Response.

    Caller is responsible for raising domain-specific exceptions on non-2xx and for
    coordinating with any rate limiter (wrap the call in `async with LIMITER:`).
    """
    last_exc: Exception | None = None
    for attempt, delay in enumerate((0.0, *_RETRY_DELAYS_S)):
        if delay:
            await asyncio.sleep(delay)
        try:
            response = await client.get(url, headers=default_headers())
        except httpx.RequestError as exc:
            last_exc = exc
            if attempt == len(_RETRY_DELAYS_S):
                raise
            continue
        if response.status_code < 500:
            return response
        last_exc = httpx.HTTPStatusError(
            f"server returned {response.status_code}", request=response.request, response=response
        )
    assert last_exc is not None
    raise last_exc
