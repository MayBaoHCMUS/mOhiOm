"""Simple per-user rate limiting with a bounded wait queue for Gemini endpoints."""

import asyncio
import time
from collections import defaultdict, deque
from dataclasses import dataclass


class QueueFullError(Exception):
    """Raised when the limiter queue is full."""


class RateLimitExceededError(Exception):
    """Raised when a request waits too long for a rate-limit slot."""

    def __init__(self, retry_after_seconds: float):
        super().__init__("Too many requests. Please retry shortly.")
        self.retry_after_seconds = retry_after_seconds


@dataclass
class LimiterToken:
    """Token released after request handling to free queue capacity."""

    _semaphore: asyncio.Semaphore
    _released: bool = False

    def release(self) -> None:
        if not self._released:
            self._semaphore.release()
            self._released = True


class PerUserRateLimiter:
    """Enforces per-user requests/sec and bounded queued waiting."""

    def __init__(self, requests_per_second: int, max_queue_size: int, max_wait_seconds: float):
        self.requests_per_second = max(1, int(requests_per_second))
        self.max_wait_seconds = max(0.1, float(max_wait_seconds))
        self._queue_semaphore = asyncio.Semaphore(max(1, int(max_queue_size)))
        self._user_timestamps: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def acquire(self, user_key: str) -> LimiterToken:
        """Wait for a queue slot and then a per-user request slot."""
        try:
            await asyncio.wait_for(self._queue_semaphore.acquire(), timeout=0.01)
        except TimeoutError as exc:
            raise QueueFullError("Server is busy. Queue is full; please retry shortly.") from exc

        started_wait = time.monotonic()

        try:
            while True:
                retry_after = await self._try_claim_request_slot(user_key)
                if retry_after <= 0:
                    return LimiterToken(self._queue_semaphore)

                waited = time.monotonic() - started_wait
                if waited >= self.max_wait_seconds:
                    raise RateLimitExceededError(retry_after_seconds=retry_after)

                await asyncio.sleep(min(retry_after, 0.25))
        except Exception:
            self._queue_semaphore.release()
            raise

    async def _try_claim_request_slot(self, user_key: str) -> float:
        """Return 0 when slot is granted, otherwise seconds until next available slot."""
        async with self._lock:
            now = time.monotonic()
            bucket = self._user_timestamps[user_key]

            while bucket and now - bucket[0] >= 1.0:
                bucket.popleft()

            if len(bucket) < self.requests_per_second:
                bucket.append(now)
                return 0.0

            return max(0.05, 1.0 - (now - bucket[0]))

