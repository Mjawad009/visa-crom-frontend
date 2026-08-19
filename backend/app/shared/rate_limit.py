"""
Rate limiting - fixed-window counter backed by Redis.

This was listed under the master spec's Security requirements from the
very first prompt and never actually built. Implemented as a Redis
INCR+EXPIRE counter rather than pulling in a separate rate-limiting
library, since app/shared/cache.py already gives us a Redis seam - one
more small function on the same seam, not a new dependency.

Scope, honestly: this protects specific high-value endpoints (starting
with login, the classic brute-force target), not a blanket global rate
limit on every route. A production deployment fronted by a real reverse
proxy/CDN (Cloudflare, etc.) would typically add broader rate limiting
at that layer; this is the application-level backstop.
"""
from fastapi import HTTPException, Request, status

from app.shared.cache import _get_client


async def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    """Raises 429 if `key` has been hit more than `limit` times within
    `window_seconds`. Fails open on a Redis outage - same philosophy as
    the rest of app/shared/cache.py: a cache/Redis problem should degrade
    protection, not take the whole API down."""
    try:
        redis_client = _get_client()
        current = await redis_client.incr(key)
        if current == 1:
            await redis_client.expire(key, window_seconds)
        if current > limit:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many requests. Try again in a few minutes.",
            )
    except HTTPException:
        raise
    except Exception:
        return  # fail open


def login_rate_limit_key(request: Request, email: str) -> str:
    """Keyed on IP + email together: prevents both a single attacker
    hammering one account and a single IP spraying many accounts,
    without one legitimate user's repeated typos locking out everyone
    behind the same office IP."""
    client_ip = request.client.host if request.client else "unknown"
    return f"rate_limit:login:{client_ip}:{email.lower()}"
