import json
from pathlib import Path
from typing import Any

RUNTIME_SETTINGS_PATH = Path(__file__).resolve().parents[2] / ".runtime_settings.json"


def _mask_secret(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    if len(value) <= 4:
        return "*" * len(value)
    return ("*" * (len(value) - 4)) + value[-4:]


def _read_settings_file() -> dict[str, Any]:
    if not RUNTIME_SETTINGS_PATH.exists():
        return {}

    try:
        raw = RUNTIME_SETTINGS_PATH.read_text(encoding="utf-8")
        payload = json.loads(raw)
        if isinstance(payload, dict):
            return payload
    except Exception:
        return {}

    return {}


def _write_settings_file(data: dict[str, Any]) -> None:
    RUNTIME_SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RUNTIME_SETTINGS_PATH.write_text(json.dumps(data, ensure_ascii=True, indent=2), encoding="utf-8")


def get_runtime_fred_key() -> str:
    payload = _read_settings_file()
    value = str(payload.get("fred_key", "")).strip()
    return value

def get_runtime_gemini_key() -> str:
    payload = _read_settings_file()
    value = str(payload.get("gemini_key", "")).strip()
    return value


def set_runtime_fred_key(fred_key: str) -> str:
    payload = _read_settings_file()
    clean = (fred_key or "").strip()

    if clean:
        payload["fred_key"] = clean
    else:
        payload.pop("fred_key", None)

    _write_settings_file(payload)
    return clean

def set_runtime_gemini_key(gemini_key: str) -> str:
    payload = _read_settings_file()
    clean = (gemini_key or "").strip()

    if clean:
        payload["gemini_key"] = clean
    else:
        payload.pop("gemini_key", None)

    _write_settings_file(payload)
    return clean


def build_settings_payload(
    env_fred_key: str, runtime_fred_key: str, env_gemini_key: str, runtime_gemini_key: str
) -> dict[str, Any]:
    runtime_fred = (runtime_fred_key or "").strip()
    env_fred = (env_fred_key or "").strip()

    active_fred_source = "none"
    active_fred_key = ""
    if runtime_fred:
        active_fred_source = "runtime"
        active_fred_key = runtime_fred
    elif env_fred:
        active_fred_source = "env"
        active_fred_key = env_fred

    runtime_gem = (runtime_gemini_key or "").strip()
    env_gem = (env_gemini_key or "").strip()
    active_gem_source = "none"
    active_gem_key = ""
    if runtime_gem:
        active_gem_source = "runtime"
        active_gem_key = runtime_gem
    elif env_gem:
        active_gem_source = "env"
        active_gem_key = env_gem

    return {
        "fred": {
            "configured": bool(active_fred_key),
            "source": active_fred_source,
            "masked": _mask_secret(active_fred_key),
            "runtime_configured": bool(runtime_fred),
            "env_configured": bool(env_fred),
        },
        "gemini": {
            "configured": bool(active_gem_key),
            "source": active_gem_source,
            "masked": _mask_secret(active_gem_key),
            "runtime_configured": bool(runtime_gem),
            "env_configured": bool(env_gem),
        },
        "providers": [            {
                "id": "fred",
                "name": "FRED (St. Louis Fed)",
                "usage": "Series macro e indices (ej: SP500, DJIA, NASDAQCOM)",
                "requires_key": True,
                "configurable": True,
            },
            {
                "id": "yahoo",
                "name": "Yahoo Finance (via yfinance)",
                "usage": "ETFs, commodities, crypto y pares FX",
                "requires_key": False,
                "configurable": False,
            },
            {
                "id": "stooq",
                "name": "Stooq",
                "usage": "Indices internacionales via CSV",
                "requires_key": False,
                "configurable": False,
            },
        ],
    }
