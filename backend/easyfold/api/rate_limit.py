"""Conditional per-IP rate limiter for ``POST /api/v1/jobs``.

slowapi is an **optional** dependency (see ``pyproject.toml``'s
``[project.optional-dependencies] ratelimit``). The base install stays lean
so single-user self-host deployers don't carry an unused middleware.

Activation:

1. ``uv sync --extra ratelimit`` to install slowapi.
2. Set ``EASYFOLD_RATE_LIMIT_JOBS_PER_IP_PER_HOUR=N`` (positive integer).

When either condition is unmet, :data:`LIMITER` is ``None`` and the
:func:`maybe_limit` decorator becomes a no-op. The route stays functionally
identical to the pre-rate-limit version.
"""

import logging
import os
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from slowapi import Limiter


def _make_limiter() -> "Limiter | None":
    raw = os.environ.get("EASYFOLD_RATE_LIMIT_JOBS_PER_IP_PER_HOUR", "").strip()
    if not (raw and raw.isdigit() and int(raw) > 0):
        return None
    try:
        from slowapi import Limiter
        from slowapi.util import get_remote_address
    except ImportError:
        logging.warning(
            "EASYFOLD_RATE_LIMIT_JOBS_PER_IP_PER_HOUR is set but slowapi is not "
            "installed. Run `uv sync --extra ratelimit` to enable rate limiting; "
            "ignoring the env var for now."
        )
        return None
    return Limiter(key_func=get_remote_address, default_limits=[f"{raw}/hour"])


LIMITER: "Limiter | None" = _make_limiter()


def maybe_limit(spec: str) -> Callable[[Any], Any]:
    """Return a slowapi decorator if the limiter is active, else a no-op.

    ``spec`` follows slowapi's rate-limit string syntax (e.g. ``"5/hour"``).
    Using ``"default"`` falls back to the limiter's configured default
    (``EASYFOLD_RATE_LIMIT_JOBS_PER_IP_PER_HOUR/hour``).
    """
    if LIMITER is None:
        return lambda f: f
    if spec == "default":
        spec = LIMITER._default_limits[0] if LIMITER._default_limits else "60/hour"
    return LIMITER.limit(spec)  # type: ignore[no-any-return]
