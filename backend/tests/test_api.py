import pandas as pd
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.fetch_cache import clear_fetch_cache


def _payload() -> dict:
    return {
        "market": "indices_etfs",
        "start_date": "2026-01-01",
        "end_date": "2026-02-16",
        "frequency": "D",
        "exclude_weekends": True,
        "assets": ["S&P 500"],
        "included_assets": ["S&P 500"],
        "preset": "YTD",
        "invert_global": False,
        "inverted_assets": [],
        "custom_assets": [],
    }


def _mock_fetch_all_assets(*args, **kwargs):
    progress_hook = kwargs.get("progress_hook")
    labels = kwargs.get("labels") or []
    total = len(labels)
    for idx, label in enumerate(labels, start=1):
        if progress_hook:
            progress_hook(idx - 1, total, label, "fetching")
            progress_hook(idx, total, label, "loaded")

    base_df = pd.DataFrame(
        {"S&P 500": [6021.1, 6055.2]},
        index=pd.to_datetime(["2026-02-13", "2026-02-16"]),
    )
    snapshot_df = pd.DataFrame(
        [
            {
                "Fecha": pd.to_datetime("2026-02-16"),
                "Instrumento": "S&P 500",
                "Apertura": 6030.0,
                "Maximo": 6070.0,
                "Minimo": 6012.0,
                "Cierre": 6055.2,
                "PrevClose": 6021.1,
                "Cambio %": 0.5663,
                "Symbol": "SP500",
                "Source": "fred",
            }
        ]
    )
    return base_df, snapshot_df, [], {"S&P 500": "SP500"}


def test_health_ok():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_fetch_uses_cache(monkeypatch):
    clear_fetch_cache()
    calls = {"count": 0}

    def wrapped_mock(*args, **kwargs):
        calls["count"] += 1
        return _mock_fetch_all_assets(*args, **kwargs)

    monkeypatch.setattr("backend.app.main.fetch_all_assets", wrapped_mock)
    client = TestClient(app)

    response_1 = client.post("/api/fetch", json=_payload())
    response_2 = client.post("/api/fetch", json=_payload())

    assert response_1.status_code == 200
    assert response_2.status_code == 200
    assert calls["count"] == 1

    body = response_2.json()
    assert body["assets_loaded"] == ["S&P 500"]
    assert body["snapshot_rows_raw"][0]["instrument"] == "S&P 500"


def test_fetch_stream_returns_progress_and_result(monkeypatch):
    clear_fetch_cache()
    monkeypatch.setattr("backend.app.main.fetch_all_assets", _mock_fetch_all_assets)
    client = TestClient(app)

    with client.stream("POST", "/api/fetch/stream", json=_payload()) as response:
        assert response.status_code == 200
        text = "".join(chunk for chunk in response.iter_text())

    assert "event: progress" in text
    assert "event: result" in text
    assert "S&P 500" in text
