"""
Cache - single seam over Redis.

Phase 2 wired up REDIS_URL and a redis service in docker-compose, but
nothing in the codebase actually used it until Phase 15. First real
consumer: caching a user's resolved permission list (see core/deps.py),
which was doing a join query on every single authenticated request -
the hottest path in the whole system.

Fails open on purpose: if Redis is unreachable, callers fall back to
computing the value fresh rather than erroring. A cache outage should
degrade performance, not take the API down.
"""
import json
from typing import Any, Optional

import redis.asyncio as redis

from app.core.config import get_settings

settings = get_settings()
_client: Optional[redis.Redis] = None


def _get_client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client


async def cache_get(key: str) -> Optional[Any]:
    try:
        raw = await _get_client().get(key)
    except Exception:
        return None  # fail open - treat a cache miss/outage the same way
    return json.loads(raw) if raw else None


async def cache_set(key: str, value: Any, ttl_seconds: int = 300) -> None:
    try:
        await _get_client().set(key, json.dumps(value), ex=ttl_seconds)
    except Exception:
        pass  # a failed cache write should never break the request


async def cache_delete(key: str) -> None:
    try:
        await _get_client().delete(key)
    except Exception:
        pass
