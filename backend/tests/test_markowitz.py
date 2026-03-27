"""Unit tests for Markowitz endpoint and mathematical guarantees."""
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.fetch_cache import clear_fetch_cache


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

ASSETS = ["S&P 500", "Nasdaq 100"]


def _base_payload() -> dict:
    return {
        "market": "indices_etfs",
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
        "frequency": "D",
        "exclude_weekends": True,
        "assets": ASSETS,
        "included_assets": [],
        "preset": "Custom",
        "invert_global": False,
        "inverted_assets": [],
        "custom_assets": [],
    }


def _mock_df(n: int = 252) -> pd.DataFrame:
    np.random.seed(0)
    dates = pd.bdate_range("2024-01-01", periods=n)
    sp500  = 5000  * np.cumprod(1 + np.random.normal(0.0004, 0.010, n))
    nasdaq = 18000 * np.cumprod(1 + np.random.normal(0.0005, 0.012, n))
    return pd.DataFrame({"S&P 500": sp500, "Nasdaq 100": nasdaq}, index=dates)


def _mock_fetch(*args, **kwargs):
    df = _mock_df()
    return df, pd.DataFrame(), [], {"S&P 500": "^GSPC", "Nasdaq 100": "^NDX"}


def _mock_validate(market, assets, custom_assets=None):
    return assets


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestMarkowitz:
    def _client(self, monkeypatch) -> TestClient:
        clear_fetch_cache()
        monkeypatch.setattr("backend.app.main.fetch_all_assets", _mock_fetch)
        monkeypatch.setattr("backend.app.main._validate_assets", _mock_validate)
        return TestClient(app)

    def test_returns_puntos(self, monkeypatch):
        resp = self._client(monkeypatch).post("/api/markowitz", json=_base_payload())
        assert resp.status_code == 200
        body = resp.json()
        assert "puntos" in body
        assert len(body["puntos"]) == 2500

    def test_weights_sum_to_one(self, monkeypatch):
        puntos = self._client(monkeypatch).post("/api/markowitz", json=_base_payload()).json()["puntos"]
        for p in puntos:
            total = sum(p["pesos"].values())
            assert abs(total - 100) < 0.11, f"Weights sum {total:.2f} ≠ 100"

    def test_has_max_sharpe_and_min_vol(self, monkeypatch):
        tipos = {p["tipo"] for p in self._client(monkeypatch).post("/api/markowitz", json=_base_payload()).json()["puntos"]}
        assert "Max Sharpe" in tipos
        assert "Min Volatilidad" in tipos

    def test_max_sharpe_has_highest_sharpe(self, monkeypatch):
        puntos = self._client(monkeypatch).post("/api/markowitz", json=_base_payload()).json()["puntos"]
        ms_sharpe = next(p["sharpe"] for p in puntos if p["tipo"] == "Max Sharpe")
        assert ms_sharpe == max(p["sharpe"] for p in puntos)

    def test_min_vol_has_lowest_volatility(self, monkeypatch):
        puntos = self._client(monkeypatch).post("/api/markowitz", json=_base_payload()).json()["puntos"]
        mv_vol = next(p["volatilidad"] for p in puntos if p["tipo"] == "Min Volatilidad")
        assert mv_vol == min(p["volatilidad"] for p in puntos)

    def test_requires_at_least_two_instruments(self, monkeypatch):
        def mock_one(*a, **k):
            df = _mock_df()[["S&P 500"]]
            return df, pd.DataFrame(), [], {}

        clear_fetch_cache()
        monkeypatch.setattr("backend.app.main.fetch_all_assets", mock_one)
        monkeypatch.setattr("backend.app.main._validate_assets", _mock_validate)
        payload = {**_base_payload(), "assets": ["S&P 500"]}
        resp = TestClient(app).post("/api/markowitz", json=payload)
        assert resp.status_code == 400
