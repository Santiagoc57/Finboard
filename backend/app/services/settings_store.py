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


def set_runtime_fred_key(fred_key: str) -> str:
    payload = _read_settings_file()
    clean = (fred_key or "").strip()

    if clean:
        payload["fred_key"] = clean
    else:
        payload.pop("fred_key", None)

    _write_settings_file(payload)
    return clean


def build_settings_payload(env_fred_key: str, runtime_fred_key: str) -> dict[str, Any]:
    runtime = (runtime_fred_key or "").strip()
    env = (env_fred_key or "").strip()

    active_source = "none"
    active_key = ""
    if runtime:
        active_source = "runtime"
        active_key = runtime
    elif env:
        active_source = "env"
        active_key = env

    return {
        "fred": {
            "configured": bool(active_key),
            "source": active_source,
            "masked": _mask_secret(active_key),
            "runtime_configured": bool(runtime),
            "env_configured": bool(env),
        },
        "providers": [
            {
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
