"""Unit tests for the /api/risk-metrics endpoint."""
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.fetch_cache import clear_fetch_cache

ASSETS = ["S&P 500", "Nasdaq 100"]


def _base_payload() -> dict:
    return {
        "market": "indices_etfs",
        "start_date": "2022-01-01",
        "end_date": "2023-12-31",
        "frequency": "D",
        "exclude_weekends": True,
        "assets": ASSETS,
        "included_assets": [],
        "preset": "Custom",
        "invert_global": False,
        "inverted_assets": [],
        "custom_assets": [],
    }


def _mock_df(n: int = 500) -> pd.DataFrame:
    np.random.seed(7)
    dates = pd.bdate_range("2022-01-01", periods=n)
    sp500  = 4600 * np.cumprod(1 + np.random.normal(0.0003, 0.011, n))
    nasdaq = 15000 * np.cumprod(1 + np.random.normal(0.00035, 0.014, n))
    return pd.DataFrame({"S&P 500": sp500, "Nasdaq 100": nasdaq}, index=dates)


def _mock_fetch(*args, **kwargs):
    return _mock_df(), pd.DataFrame(), [], {}


def _mock_validate(market, assets, custom_assets=None):
    return assets


class TestRiskMetrics:
    def _client(self, monkeypatch) -> TestClient:
        clear_fetch_cache()
        monkeypatch.setattr("backend.app.main.fetch_all_assets", _mock_fetch)
        monkeypatch.setattr("backend.app.main._validate_assets", _mock_validate)
        return TestClient(app)

    def test_returns_metrics_list(self, monkeypatch):
        resp = self._client(monkeypatch).post("/api/risk-metrics", json=_base_payload())
        assert resp.status_code == 200
        body = resp.json()
        assert "metrics" in body
        assert len(body["metrics"]) == 2

    def test_all_instruments_present(self, monkeypatch):
        body = self._client(monkeypatch).post("/api/risk-metrics", json=_base_payload()).json()
        instruments = {m["instrument"] for m in body["metrics"]}
        assert "S&P 500" in instruments
        assert "Nasdaq 100" in instruments

    def test_sharpe_is_finite(self, monkeypatch):
        body = self._client(monkeypatch).post("/api/risk-metrics", json=_base_payload()).json()
        for m in body["metrics"]:
            if m["sharpe"] is not None:
                assert -20 < m["sharpe"] < 20, f"Sharpe {m['sharpe']} out of range"

    def test_max_drawdown_between_minus_100_and_zero(self, monkeypatch):
        body = self._client(monkeypatch).post("/api/risk-metrics", json=_base_payload()).json()
        for m in body["metrics"]:
            if m["max_drawdown"] is not None:
                assert -100 <= m["max_drawdown"] <= 0, (
                    f"Max drawdown {m['max_drawdown']} out of (-100, 0] range"
                )

    def test_empty_data_returns_empty_list(self, monkeypatch):
        def mock_empty(*a, **k):
            return pd.DataFrame(), pd.DataFrame(), [], {}

        clear_fetch_cache()
        monkeypatch.setattr("backend.app.main.fetch_all_assets", mock_empty)
        monkeypatch.setattr("backend.app.main._validate_assets", _mock_validate)
        resp = TestClient(app).post("/api/risk-metrics", json=_base_payload())
        assert resp.status_code == 200
        assert resp.json()["metrics"] == []
