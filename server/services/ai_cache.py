"""Locked process-local result cache and rate-limit state."""
import threading
from collections import defaultdict, deque
from typing import Any
AI_CACHE_TTL_SECONDS = 24 * 60 * 60
AI_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
AI_CACHE_LOCK = threading.Lock()
AI_REQUESTS: dict[str, deque[float]] = defaultdict(deque)
AI_RATE_LOCK = threading.Lock()
