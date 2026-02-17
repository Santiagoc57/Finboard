import copy
import hashlib
import json
import os
import threading
import time
from typing import Any

DEFAULT_FETCH_CACHE_TTL = int(os.getenv("FETCH_CACHE_TTL_SECONDS", "120"))
DEFAULT_FETCH_CACHE_MAX_ITEMS = int(os.getenv("FETCH_CACHE_MAX_ITEMS", "256"))

_CACHE_LOCK = threading.Lock()
_FETCH_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}


def _now() -> float:
    return time.time()


def _prune_expired(now: float) -> None:
    expired = [key for key, (expiry, _) in _FETCH_CACHE.items() if expiry <= now]
    for key in expired:
        _FETCH_CACHE.pop(key, None)


def _enforce_max_size() -> None:
    if len(_FETCH_CACHE) <= DEFAULT_FETCH_CACHE_MAX_ITEMS:
        return
    # Evict oldest entries first based on expiry timestamp.
    for key, _ in sorted(_FETCH_CACHE.items(), key=lambda item: item[1][0])[
        : max(0, len(_FETCH_CACHE) - DEFAULT_FETCH_CACHE_MAX_ITEMS)
    ]:
        _FETCH_CACHE.pop(key, None)


def build_fetch_cache_key(
    *,
    market: str,
    start_date: str,
    end_date: str,
    effective_freq: str,
    exclude_weekends: bool,
    preset: str,
    assets: list[str],
    included_assets: list[str],
    invert_global: bool,
    inverted_assets: list[str],
    custom_assets: list[dict[str, str]] | None,
    fred_key: str,
) -> str:
    normalized_custom = [
        {
            "label": str(row.get("label", "")).strip(),
            "source": str(row.get("source", "")).strip().lower(),
            "symbol": str(row.get("symbol", "")).strip(),
        }
        for row in (custom_assets or [])
    ]
    normalized_custom.sort(key=lambda row: (row["label"], row["source"], row["symbol"]))

    payload = {
        "v": 1,
        "market": market,
        "start_date": start_date,
        "end_date": end_date,
        "effective_freq": effective_freq,
        "exclude_weekends": bool(exclude_weekends),
        "preset": str(preset),
        "assets": list(assets),
        "included_assets": list(included_assets),
        "invert_global": bool(invert_global),
        "inverted_assets": sorted(set(inverted_assets)),
        "custom_assets": normalized_custom,
        "fred_key_fingerprint": hashlib.sha256(fred_key.encode("utf-8")).hexdigest()[:16],
    }

    raw = json.dumps(payload, sort_keys=True, ensure_ascii=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_fetch_cache(cache_key: str) -> dict[str, Any] | None:
    now = _now()
    with _CACHE_LOCK:
        _prune_expired(now)
        hit = _FETCH_CACHE.get(cache_key)
        if not hit:
            return None
        expiry, payload = hit
        if expiry <= now:
            _FETCH_CACHE.pop(cache_key, None)
            return None
        return copy.deepcopy(payload)


def set_fetch_cache(cache_key: str, payload: dict[str, Any], ttl_seconds: int = DEFAULT_FETCH_CACHE_TTL) -> None:
    expiry = _now() + max(1, int(ttl_seconds))
    with _CACHE_LOCK:
        _prune_expired(_now())
        _FETCH_CACHE[cache_key] = (expiry, copy.deepcopy(payload))
        _enforce_max_size()


def clear_fetch_cache() -> None:
    with _CACHE_LOCK:
        _FETCH_CACHE.clear()
