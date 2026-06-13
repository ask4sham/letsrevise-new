"""
Teacher Brain — P0.5 In-process idempotency / inflight-lock for generate.

Asyncio is single-loop so a plain dict + bounded TTL is race-safe for the MVP
(single-pod). On restart, locks vanish — acceptable: the cost of one duplicate
after a process restart is negligible.

For multi-pod, promote to a Mongo TTL index on a 'inflight_generations' collection.
"""
from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import Dict, Tuple

# How long a lock is considered stale (safety net if `finally` is somehow skipped)
LOCK_TTL_SECONDS = 120.0


class GenerationInProgress(Exception):
    """Mapped to HTTP 409 with code GENERATION_ALREADY_IN_PROGRESS."""


def _key(user_id: str, topic: str) -> Tuple[str, str]:
    return (user_id, (topic or "").strip().lower())


class InflightRegistry:
    def __init__(self) -> None:
        self._slots: Dict[Tuple[str, str], float] = {}

    def _gc(self, now: float) -> None:
        stale = [k for k, t in self._slots.items() if now - t > LOCK_TTL_SECONDS]
        for k in stale:
            self._slots.pop(k, None)

    @asynccontextmanager
    async def lock(self, *, user_id: str, topic: str):
        """Async context manager. Raises GenerationInProgress if a fresh lock exists."""
        now = time.monotonic()
        self._gc(now)
        key = _key(user_id, topic)
        existing = self._slots.get(key)
        if existing is not None and now - existing < LOCK_TTL_SECONDS:
            raise GenerationInProgress(
                "A generation request is already in progress for this topic."
            )
        self._slots[key] = now
        try:
            yield
        finally:
            self._slots.pop(key, None)

    # Test-only helpers
    def _force_lock(self, *, user_id: str, topic: str) -> None:
        self._slots[_key(user_id, topic)] = time.monotonic()

    def _clear(self) -> None:
        self._slots.clear()


__all__ = ["InflightRegistry", "GenerationInProgress", "LOCK_TTL_SECONDS"]
