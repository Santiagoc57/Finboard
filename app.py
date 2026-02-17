import io
import os
from datetime import date, datetime, timezone
from html import escape
from textwrap import dedent
from urllib.parse import quote_plus

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import pandas as pd
import requests
import streamlit as st
import yfinance as yf
from dateutil.relativedelta import relativedelta
from streamlit.errors import StreamlitSecretNotFoundError

DECIMALS = 6
DEFAULT_START = date(date.today().year - 5, 1, 1)

ASSETS = {
    "S&P 500": {"src": "fred", "id": "SP500"},
    "Dow Jones": {"src": "fred", "id": "DJIA"},
    "Nasdaq Comp": {"src": "fred", "id": "NASDAQCOM"},
    "DAX": {"src": "stooq", "id": "^DAX"},
    "IBEX 35": {"src": "stooq", "id": "^IBEX"},
    "Nikkei 225": {"src": "stooq", "id": "^NKX"},
    "Bovespa": {"src": "stooq", "id": "^BVP"},
    "KOSPI": {"src": "stooq", "id": "^KOSPI"},
    "IPC (MXX)": {"src": "stooq", "id": "^IPC"},
    "CLX IPSA": {"src": "stooq", "id": "^IPSA"},
    "FTSE 100": {"src": "stooq", "id": "^UKX"},
    "GLAB.L (ETF)": {"src": "yahoo", "id": "GLAB.L"},
    "IBDR (ETF)": {"src": "yahoo", "id": "IBDR"},
    "COLCAP (ICOLCAP.CL)": {"src": "yahoo", "id": "ICOLCAP.CL"},
    "Gold (GC=F)": {"src": "yahoo", "id": "GC=F"},
    "Silver (SI=F)": {"src": "yahoo", "id": "SI=F"},
    "Copper (HG=F)": {"src": "yahoo", "id": "HG=F"},
    "Bitcoin (BTC-USD)": {"src": "yahoo", "id": "BTC-USD"},
    "Ethereum (ETH-USD)": {"src": "yahoo", "id": "ETH-USD"},
    "BNB (BNB-USD)": {"src": "yahoo", "id": "BNB-USD"},
    "XRP (XRP-USD)": {"src": "yahoo", "id": "XRP-USD"},
    "Solana (SOL-USD)": {"src": "yahoo", "id": "SOL-USD"},
}


def inject_styles() -> None:
    st.markdown(
        """
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Material+Symbols+Outlined:wght@400&display=swap');

          :root {
            --primary: #16a34a;
            --primary-hover: #15803d;
            --background-light: #f9fafb;
            --surface-light: #ffffff;
            --border-light: #e5e7eb;
            --text-main: #111827;
            --text-muted: #6b7280;
            --accent-red: #dc2626;
            --accent-green-soft: #dcfce7;
            --accent-red-soft: #fee2e2;
          }

          html, body, [data-testid="stAppViewContainer"], [class*="css"] {
            font-family: 'Inter', sans-serif;
            color: var(--text-main);
          }

          [data-testid="stAppViewContainer"] {
            background: radial-gradient(900px 300px at 20% -10%, #ecfdf5 0%, transparent 55%),
                        radial-gradient(700px 260px at 90% -5%, #f1f5f9 0%, transparent 60%),
                        var(--background-light);
          }

          [data-testid="stHeader"] {
            background: rgba(249, 250, 251, 0.92);
            border-bottom: 1px solid var(--border-light);
          }

          [data-testid="stSidebar"] {
            border-right: 1px solid var(--border-light);
          }

          [data-testid="stMainBlockContainer"] {
            max-width: 1400px;
            padding-top: 1.4rem;
            padding-bottom: 2.5rem;
          }

          .material-symbols-outlined {
            font-family: 'Material Symbols Outlined';
            font-weight: normal;
            font-style: normal;
            font-size: 20px;
            display: inline-block;
            line-height: 1;
            letter-spacing: normal;
            text-transform: none;
            white-space: nowrap;
            word-wrap: normal;
            direction: ltr;
            -webkit-font-smoothing: antialiased;
          }

          .mono {
            font-family: 'JetBrains Mono', monospace;
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
          }

          .fin-topbar {
            position: sticky;
            top: 0;
            z-index: 10;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(6px);
            border: 1px solid var(--border-light);
            border-radius: 12px;
            padding: 10px 16px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
          }

          .fin-topbar-left {
            display: flex;
            align-items: center;
            gap: 24px;
          }

          .fin-brand {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .fin-brand-icon {
            width: 34px;
            height: 34px;
            border-radius: 10px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #dcfce7;
            color: var(--primary);
          }

          .fin-brand-title {
            font-size: 18px;
            font-weight: 700;
            letter-spacing: -0.02em;
          }

          .fin-nav {
            display: flex;
            align-items: center;
            gap: 18px;
            font-size: 13px;
          }

          .fin-nav span {
            color: var(--text-muted);
            font-weight: 500;
          }

          .fin-nav span.fin-nav-active {
            color: var(--primary);
            border-bottom: 2px solid var(--primary);
            padding-bottom: 2px;
          }

          .fin-topbar-right {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .fin-nav-search {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            width: 300px;
            border: 1px solid var(--border-light);
            border-radius: 11px;
            background: #f3f4f6;
            color: #9ca3af;
            padding: 8px 12px;
            font-size: 14px;
          }

          .fin-circle-btn {
            width: 38px;
            height: 38px;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--border-light);
            background: #fff;
            color: #6b7280;
            position: relative;
          }

          .fin-circle-dot {
            width: 7px;
            height: 7px;
            background: #ef4444;
            border: 2px solid #fff;
            border-radius: 999px;
            position: absolute;
            right: 6px;
            top: 6px;
          }

          .fin-avatar {
            width: 38px;
            height: 38px;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #fed7aa;
            color: #78350f;
            border: 1px solid #fdba74;
          }

          .fin-breadcrumb {
            display: flex;
            align-items: center;
            gap: 6px;
            color: var(--text-muted);
            font-size: 13px;
            margin-bottom: 8px;
          }

          .fin-hero {
            margin-bottom: 8px;
          }

          .fin-hero h1 {
            margin: 0;
            font-size: 31px;
            font-weight: 700;
            line-height: 1.15;
            letter-spacing: -0.02em;
            color: var(--text-main);
          }

          .fin-hero p {
            margin: 8px 0 0 0;
            color: var(--text-muted);
            font-size: 14px;
            max-width: 900px;
          }

          .fin-chip-row {
            margin: 14px 0 20px 0;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
          }

          .fin-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: var(--surface-light);
            border: 1px solid var(--border-light);
            border-radius: 999px;
            padding: 7px 11px;
            font-size: 12px;
            color: var(--text-main);
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          }

          .fin-chip .k {
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            font-weight: 600;
            font-size: 11px;
          }

          .fin-live-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--primary);
            box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.6);
            animation: pulse 1.8s infinite;
          }

          .st-key-chip_controls .stButton > button {
            border-radius: 999px;
            border: 1px solid #d7dde5;
            background: var(--surface-light);
            min-height: 38px;
            padding: 0 14px;
            font-size: 14px;
            font-weight: 500;
            color: #111827;
            justify-content: flex-start;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
            transition: all 0.18s ease;
          }

          .st-key-chip_controls .stButton > button:hover {
            border-color: #c8d0d9;
            background: #f8fafc;
            color: #0f172a;
          }

          .st-key-chip_controls .stButton > button [data-testid="stIconMaterial"] {
            color: var(--primary);
            font-size: 17px;
          }

          .st-key-chip_controls .stButton > button p {
            font-size: 14px;
            margin: 0;
          }

          .st-key-chip_controls .stButton > button strong {
            font-weight: 700;
          }

          .st-key-chip_divider .chip-vline {
            width: 1px;
            height: 24px;
            background: var(--border-light);
            margin: 6px auto 0 auto;
          }

          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.5); }
            70% { box-shadow: 0 0 0 8px rgba(22, 163, 74, 0); }
            100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
          }

          .section-title {
            margin-top: 22px;
            margin-bottom: 8px;
            font-size: 17px;
            font-weight: 700;
            color: var(--text-main);
          }

          .fin-actions-wrap {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
          }

          .fin-toolbar-controls {
            display: grid;
            grid-template-columns: 1.2fr 1fr auto 1fr;
            gap: 12px;
            align-items: end;
            margin-bottom: 6px;
          }

          .fin-toolbar-icons {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            justify-content: center;
            border: 1px solid var(--border-light);
            border-radius: 10px;
            padding: 8px 10px;
            background: #fff;
            color: #6b7280;
            min-height: 42px;
          }

          .fin-table-shell {
            background: var(--surface-light);
            border: 1px solid var(--border-light);
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
          }

          .fin-table-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            padding: 10px 14px;
            background: #f8fafc;
            border-bottom: 1px solid var(--border-light);
            font-size: 12px;
            color: var(--text-muted);
          }

          .fin-table-scroll {
            overflow-x: auto;
          }

          table.fx-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 880px;
          }

          table.fx-table thead th {
            background: #f8fafc;
            color: var(--text-muted);
            font-size: 11px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            padding: 11px 12px;
            border-bottom: 1px solid var(--border-light);
            text-align: left;
          }

          table.fx-table tbody td {
            padding: 11px 12px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 13px;
          }

          table.fx-table tbody tr:hover {
            background: #f9fafb;
          }

          table.fx-table tbody tr.row-highlight {
            background: #f0fdf4;
          }

          .num-cell {
            text-align: right;
            font-family: 'JetBrains Mono', monospace;
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
            color: #334155;
          }

          .instrument-cell {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
          }

          .instrument-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
          }

          .change-up {
            color: var(--primary);
            font-weight: 600;
            text-align: right;
          }

          .change-down {
            color: var(--accent-red);
            font-weight: 600;
            text-align: right;
          }

          .swap-cell {
            text-align: center;
            color: #94a3b8;
          }

          .swap-cell .swap-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            text-decoration: none;
            border-radius: 6px;
            border: 1px solid transparent;
            padding: 2px 5px;
            transition: all 0.16s ease;
          }

          .swap-cell .swap-link:hover {
            color: #64748b;
            border-color: #e2e8f0;
            background: #f8fafc;
          }

          .swap-cell .swap-link.active {
            color: var(--primary);
            background: #dcfce7;
            border-color: #bbf7d0;
            border-radius: 6px;
            padding: 2px 5px;
          }

          .fin-table-footer {
            padding: 10px 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: var(--text-muted);
            background: #f8fafc;
          }

          .fin-pagination {
            margin-top: -58px;
            margin-right: 12px;
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            position: relative;
            z-index: 1;
          }

          .kpi-grid {
            margin-top: 16px;
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
          }

          .kpi-card {
            background: var(--surface-light);
            border: 1px solid var(--border-light);
            border-radius: 11px;
            padding: 12px;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
          }

          .kpi-label {
            color: var(--text-muted);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-weight: 600;
          }

          .kpi-main {
            margin-top: 6px;
            font-size: 20px;
            font-weight: 700;
            color: var(--text-main);
          }

          .kpi-sub-up {
            color: var(--primary);
            font-size: 13px;
            font-weight: 600;
          }

          .kpi-sub-down {
            color: var(--accent-red);
            font-size: 13px;
            font-weight: 600;
          }

          .kpi-sub-muted {
            color: var(--text-muted);
            font-size: 13px;
            font-weight: 500;
          }

          .kpi-row {
            margin-top: 4px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }

          .kpi-spark {
            width: 62px;
            height: 26px;
            border-radius: 6px;
            padding: 4px;
          }

          .kpi-spark path {
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .kpi-spark.up {
            background: linear-gradient(to top, #dcfce7, transparent);
          }

          .kpi-spark.up path {
            stroke: #16a34a;
          }

          .kpi-spark.down {
            background: linear-gradient(to top, #fee2e2, transparent);
          }

          .kpi-spark.down path {
            stroke: #dc2626;
          }

          .kpi-alert-dot {
            width: 14px;
            height: 14px;
            border-radius: 999px;
            background: #ef4444;
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.16);
          }

          .kpi-health-icon {
            color: var(--primary);
          }

          .streamlit-expanderHeader {
            font-size: 14px;
            font-weight: 600;
          }

          .stButton button {
            border-radius: 10px;
            border: 1px solid var(--border-light);
            background: var(--surface-light);
            color: var(--text-main);
            font-weight: 600;
          }

          .stButton button:hover {
            border-color: #9ca3af;
            color: #0f172a;
          }

          .stButton button[kind="primary"] {
            background: var(--primary);
            border-color: var(--primary);
            color: #fff;
          }

          .stButton button[kind="primary"]:hover {
            background: var(--primary-hover);
            border-color: var(--primary-hover);
          }

          .stDownloadButton button {
            border-radius: 10px;
            background: var(--primary);
            color: #fff;
            border: 1px solid var(--primary);
            font-weight: 700;
          }

          .stDownloadButton button:hover {
            background: var(--primary-hover);
            border-color: var(--primary-hover);
          }

          .stDownloadButton button[disabled] {
            background: #e5e7eb;
            color: #9ca3af;
            border-color: #d1d5db;
          }

          .stTextInput input,
          .stDateInput input,
          .stSelectbox [data-baseweb="select"] > div,
          .stMultiSelect [data-baseweb="select"] > div {
            border-radius: 10px !important;
            border: 1px solid var(--border-light) !important;
          }

          .stTextInput input:focus,
          .stDateInput input:focus {
            border-color: var(--primary) !important;
            box-shadow: 0 0 0 1px var(--primary) !important;
          }

          div[data-testid="stDataFrame"] {
            border: 1px solid var(--border-light);
            border-radius: 12px;
            overflow: hidden;
          }

          /* Optimización para laptop 1366x768 (y similares): más densidad vertical */
          @media (min-width: 1200px) and (max-width: 1420px) and (max-height: 820px) {
            [data-testid="stMainBlockContainer"] {
              padding-top: 0.6rem;
              padding-bottom: 1.2rem;
            }

            .fin-topbar {
              margin-bottom: 12px;
              padding: 8px 12px;
            }

            .fin-brand-icon {
              width: 30px;
              height: 30px;
              border-radius: 8px;
            }

            .fin-brand-title {
              font-size: 17px;
            }

            .fin-breadcrumb {
              margin-bottom: 5px;
              font-size: 12px;
            }

            .fin-hero h1 {
              font-size: 36px;
              line-height: 1.08;
            }

            .fin-hero p {
              margin-top: 5px;
              font-size: 13px;
            }

            .fin-actions-wrap {
              margin-bottom: 4px;
              gap: 8px;
            }

            .st-key-chip_controls .stButton > button {
              min-height: 34px;
              padding: 0 12px;
              font-size: 13px;
            }

            .st-key-chip_controls .stButton > button p {
              font-size: 13px;
            }

            .fin-table-shell {
              border-radius: 12px;
            }

            .fin-table-toolbar {
              padding: 8px 12px;
            }

            table.fx-table thead th {
              padding: 9px 10px;
              font-size: 10.5px;
            }

            table.fx-table tbody td {
              padding: 8px 10px;
              font-size: 12px;
            }

            .fin-table-footer {
              padding: 8px 12px;
              font-size: 11px;
            }

            .fin-pagination {
              margin-top: -52px;
            }

            .kpi-grid {
              margin-top: 10px;
              gap: 10px;
            }

            .kpi-card {
              padding: 10px;
            }

            .kpi-main {
              margin-top: 4px;
              font-size: 18px;
            }

            .section-title {
              margin-top: 14px;
            }
          }

          /* Tablet / laptop angosta */
          @media (max-width: 1200px) {
            [data-testid="stMainBlockContainer"] {
              padding-top: 0.8rem;
            }

            .fin-topbar {
              padding: 9px 12px;
            }

            .fin-topbar-left {
              gap: 14px;
            }

            .fin-nav-search {
              width: 220px;
            }

            .fin-hero h1 {
              font-size: 34px;
            }

            .kpi-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .st-key-chip_controls [data-testid="stHorizontalBlock"] {
              flex-wrap: wrap;
              gap: 8px;
            }
          }

          @media (max-width: 980px) {
            .fin-nav {
              display: none;
            }

            .fin-nav-search {
              display: none;
            }

            .fin-actions-wrap {
              justify-content: stretch;
            }

            .kpi-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .fin-toolbar-controls {
              grid-template-columns: 1fr;
            }

            .st-key-chip_controls [data-testid="stHorizontalBlock"] {
              flex-wrap: wrap;
              gap: 8px;
            }

            .fin-pagination {
              margin-top: 8px;
            }
          }

          @media (max-width: 680px) {
            [data-testid="stMainBlockContainer"] {
              padding-top: 0.55rem;
              padding-left: 0.55rem;
              padding-right: 0.55rem;
            }

            .fin-topbar {
              border-radius: 10px;
              margin-bottom: 10px;
            }

            .fin-breadcrumb {
              font-size: 12px;
            }

            .fin-hero h1 {
              font-size: 28px;
            }

            .fin-hero p {
              font-size: 13px;
            }

            .kpi-grid {
              grid-template-columns: 1fr;
            }

            .fin-table-toolbar,
            .fin-table-footer {
              font-size: 11px;
            }
          }
        </style>
        """,
        unsafe_allow_html=True,
    )


def dates_from_preset(preset: str, ref: date) -> tuple[date, date]:
    if preset == "1M":
        return ref - relativedelta(months=1), ref
    if preset == "3M":
        return ref - relativedelta(months=3), ref
    if preset == "6M":
        return ref - relativedelta(months=6), ref
    if preset == "YTD":
        return date(ref.year, 1, 1), ref
    if preset == "1Y":
        return ref - relativedelta(years=1), ref
    if preset == "5Y":
        return ref - relativedelta(years=5), ref
    if preset == "MAX":
        return date(1990, 1, 1), ref
    return DEFAULT_START, ref


def _as_float(value):
    try:
        return float(value)
    except Exception:
        return None


@st.cache_data(ttl=900, show_spinner=False)
def fetch_fred_close(series_id: str, start: str, end: str, api_key: str) -> pd.Series:
    if not api_key:
        return pd.Series(dtype=float)

    url = "https://api.stlouisfed.org/fred/series/observations"
    params = {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
        "observation_start": start,
        "observation_end": end,
    }
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()

    observations = response.json().get("observations", [])
    data = {
        item["date"]: _as_float(item["value"])
        for item in observations
        if item.get("value") not in ("", ".", "NaN")
    }
    series = pd.Series(data, dtype=float)
    if series.empty:
        return pd.Series(dtype=float)

    series.index = pd.to_datetime(series.index)
    return series.dropna().sort_index()


@st.cache_data(ttl=900, show_spinner=False)
def fetch_stooq_ohlc(symbol: str) -> pd.DataFrame:
    url = "https://stooq.com/q/d/l/"
    response = requests.get(url, params={"s": symbol, "i": "d"}, timeout=30)
    response.raise_for_status()

    df = pd.read_csv(io.StringIO(response.text))
    needed = ["Date", "Open", "High", "Low", "Close"]
    if df.empty or not all(col in df.columns for col in needed):
        return pd.DataFrame(columns=["open", "high", "low", "close"])

    df["Date"] = pd.to_datetime(df["Date"])
    ohlc = (
        df[["Date", "Open", "High", "Low", "Close"]]
        .rename(
            columns={
                "Open": "open",
                "High": "high",
                "Low": "low",
                "Close": "close",
            }
        )
        .set_index("Date")
        .sort_index()
    )
    for col in ["open", "high", "low", "close"]:
        ohlc[col] = pd.to_numeric(ohlc[col], errors="coerce")
    return ohlc.dropna(how="all")


@st.cache_data(ttl=900, show_spinner=False)
def fetch_yahoo_ohlc(symbol: str, start: str, end: str) -> pd.DataFrame:
    df = yf.download(
        symbol,
        start=start,
        end=end,
        progress=False,
        auto_adjust=False,
        threads=False,
    )
    if not isinstance(df, pd.DataFrame) or df.empty:
        return pd.DataFrame(columns=["open", "high", "low", "close"])

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0] for col in df.columns]

    column_map = {
        "Open": "open",
        "High": "high",
        "Low": "low",
        "Adj Close": "close",
    }
    if "Adj Close" not in df.columns and "Close" in df.columns:
        column_map["Close"] = "close"

    selected = {}
    for src, dst in column_map.items():
        if src in df.columns:
            selected[dst] = pd.to_numeric(df[src], errors="coerce")

    out = pd.DataFrame(selected)
    if out.empty:
        return pd.DataFrame(columns=["open", "high", "low", "close"])

    if "close" not in out.columns and "Close" in df.columns:
        out["close"] = pd.to_numeric(df["Close"], errors="coerce")

    out.index = pd.to_datetime(out.index)
    out = out.sort_index().dropna(how="all")

    for col in ["open", "high", "low"]:
        if col not in out.columns:
            out[col] = out["close"]

    return out[["open", "high", "low", "close"]]


def _apply_frequency(frame: pd.DataFrame, freq: str) -> pd.DataFrame:
    frame = frame.sort_index()
    if frame.empty:
        return frame

    if freq in {"D", "B"}:
        out = frame.asfreq(freq).ffill()
    elif freq == "W":
        out = frame.resample("W-FRI").agg(
            {"open": "first", "high": "max", "low": "min", "close": "last"}
        )
        out = out.ffill()
    elif freq == "M":
        out = frame.resample("M").agg(
            {"open": "first", "high": "max", "low": "min", "close": "last"}
        )
        out = out.ffill()
    else:
        raise ValueError("La frecuencia debe ser D, B, W o M")

    for col in ["open", "high", "low"]:
        out[col] = out[col].fillna(out["close"])

    return out.dropna(how="all")


def get_asset_frame(label: str, start: str, end: str, freq: str, fred_key: str) -> pd.DataFrame:
    meta = ASSETS[label]
    src = meta["src"]
    symbol = meta["id"]

    if src == "fred":
        close = fetch_fred_close(symbol, start, end, fred_key)
        if close.empty:
            return pd.DataFrame(columns=["open", "high", "low", "close"])
        frame = pd.DataFrame({"close": close})
        frame["open"] = frame["close"]
        frame["high"] = frame["close"]
        frame["low"] = frame["close"]
        frame = frame[["open", "high", "low", "close"]]
    elif src == "stooq":
        frame = fetch_stooq_ohlc(symbol)
    elif src == "yahoo":
        frame = fetch_yahoo_ohlc(symbol, start, end)
    else:
        return pd.DataFrame(columns=["open", "high", "low", "close"])

    if frame.empty:
        return frame

    start_dt = pd.to_datetime(start)
    end_dt = pd.to_datetime(end)
    frame = frame.loc[(frame.index >= start_dt) & (frame.index <= end_dt)]
    frame = _apply_frequency(frame, freq)
    return frame


def fetch_all_assets(
    labels: list[str],
    start: str,
    end: str,
    freq: str,
    fred_key: str,
    progress_callback=None,
):
    series_map: dict[str, pd.Series] = {}
    snapshot_rows: list[dict] = []
    failures: list[str] = []

    total = max(1, len(labels))
    for index, label in enumerate(labels, start=1):
        frame = get_asset_frame(label, start, end, freq, fred_key)

        close = frame["close"].dropna() if "close" in frame.columns else pd.Series(dtype=float)
        if close.empty:
            failures.append(label)
            if progress_callback:
                progress_callback(index, total, label)
            continue

        series_map[label] = close.rename(label)

        latest_date = close.index[-1]
        latest_row = frame.loc[latest_date]
        prev_close = close.iloc[-2] if close.size > 1 else float("nan")
        change_pct = (close.iloc[-1] / prev_close - 1.0) * 100 if pd.notna(prev_close) and prev_close != 0 else float("nan")

        snapshot_rows.append(
            {
                "Fecha": latest_date.date(),
                "Instrumento": label,
                "Apertura": float(latest_row["open"]),
                "Maximo": float(latest_row["high"]),
                "Minimo": float(latest_row["low"]),
                "Cierre": float(latest_row["close"]),
                "PrevClose": float(prev_close) if pd.notna(prev_close) else float("nan"),
                "Cambio %": float(change_pct) if pd.notna(change_pct) else float("nan"),
            }
        )

        if progress_callback:
            progress_callback(index, total, label)

    if not series_map:
        return pd.DataFrame(), pd.DataFrame(), failures

    base_df = pd.concat(series_map.values(), axis=1).sort_index().round(DECIMALS)
    snapshot_df = pd.DataFrame(snapshot_rows)
    if not snapshot_df.empty:
        snapshot_df = snapshot_df.sort_values("Cambio %", ascending=False, na_position="last").reset_index(drop=True)

    return base_df, snapshot_df, failures


def build_view_df(base_df: pd.DataFrame, included: list[str]) -> pd.DataFrame:
    if base_df.empty or not included:
        return pd.DataFrame()
    cols = [label for label in included if label in base_df.columns]
    if not cols:
        return pd.DataFrame()
    return base_df[cols].copy().round(DECIMALS)


def build_snapshot_view(
    snapshot_df: pd.DataFrame,
    invert_global: bool,
    inverted_labels: set[str] | None = None,
) -> pd.DataFrame:
    if snapshot_df.empty:
        return snapshot_df

    data = snapshot_df.copy()
    manual_inverted = data["Instrumento"].astype(str).isin(inverted_labels or set())
    effective_inverted = (~manual_inverted) if invert_global else manual_inverted

    if effective_inverted.any():
        for col in ["Apertura", "Maximo", "Minimo", "Cierre", "PrevClose"]:
            values = data.loc[effective_inverted, col]
            data.loc[effective_inverted, col] = values.where(values == 0, 1 / values)

        valid_rows = effective_inverted & data["PrevClose"].notna() & (data["PrevClose"] != 0)
        data.loc[effective_inverted, "Cambio %"] = float("nan")
        data.loc[valid_rows, "Cambio %"] = (data.loc[valid_rows, "Cierre"] / data.loc[valid_rows, "PrevClose"] - 1.0) * 100

    data["__is_inverted__"] = effective_inverted

    return data


def transform_for_chart(
    frame: pd.DataFrame,
    as_pct: bool,
    normalize: bool,
    with_ma: bool,
    ma_window: int,
) -> pd.DataFrame:
    out = frame.copy().dropna(how="all")

    if as_pct:
        out = out.pct_change().mul(100)

    if normalize and not as_pct:
        for col in out.columns:
            series = out[col].dropna()
            if not series.empty and series.iloc[0] != 0:
                out.loc[series.index, col] = series / series.iloc[0] * 100

    if with_ma:
        out = out.rolling(window=max(2, int(ma_window)), min_periods=1).mean()

    return out.dropna(how="all")


def draw_chart(
    frame: pd.DataFrame,
    series_names: list[str],
    chart_type: str,
    use_log: bool,
    mark_last: bool,
    title: str,
):
    fig, axis = plt.subplots(figsize=(12, 5.2))

    if chart_type == "area" and len(series_names) == 1:
        series = frame[series_names[0]].dropna()
        x_vals, y_vals = series.index, series.values
        axis.plot(x_vals, y_vals, linewidth=1.8, label=series_names[0])
        fill_base = float(y_vals.min()) if y_vals.size else 0.0
        if use_log:
            positive = y_vals[y_vals > 0]
            fill_base = float(positive.min()) if positive.size else 0.1
        axis.fill_between(x_vals, y_vals, fill_base, alpha=0.18)
    else:
        for name in series_names:
            axis.plot(frame.index, frame[name], linewidth=1.6, label=name)

    log_warning = None
    if use_log:
        if frame.min().min() <= 0:
            log_warning = "Hay valores <= 0; la escala log puede verse afectada."
        axis.set_yscale("log")

    if mark_last:
        last_x = frame.index[-1]
        for name in series_names:
            series = frame[name].dropna()
            if series.empty:
                continue
            y_last = float(series.iloc[-1])
            axis.axhline(y_last, linestyle="--", linewidth=0.8, alpha=0.35)
            axis.text(last_x, y_last, f" {name}: {y_last:.{DECIMALS}f}", va="center", fontsize=8)

    axis.grid(True, linestyle="--", linewidth=0.4, alpha=0.6)
    axis.set_xlim(frame.index.min(), frame.index.max())
    axis.set_title(title, loc="left", fontsize=12)
    axis.legend(loc="best", fontsize=9)

    locator = mdates.AutoDateLocator()
    axis.xaxis.set_major_locator(locator)
    axis.xaxis.set_major_formatter(mdates.ConciseDateFormatter(locator))

    fig.tight_layout()
    return fig, log_warning


def perf_summary(series: pd.Series) -> dict[str, float]:
    clean = series.dropna()
    if clean.size < 2:
        return {}

    def pct(days: int):
        idx = max(0, clean.size - 1 - days)
        if idx == clean.size - 1 or clean.iloc[idx] == 0:
            return float("nan")
        return (clean.iloc[-1] / clean.iloc[idx] - 1.0) * 100

    return {
        "1 dia": pct(1),
        "1 semana": pct(5),
        "1 mes": pct(21),
        "3 meses": pct(63),
        "6 meses": pct(126),
        "1 ano": pct(252),
        "5 anos": pct(252 * 5),
        "Max": (clean.iloc[-1] / clean.iloc[0] - 1.0) * 100 if clean.iloc[0] != 0 else float("nan"),
    }


def to_excel_bytes(view_df: pd.DataFrame, included: list[str], snapshot_df: pd.DataFrame, meta: dict) -> bytes:
    metadata_rows = []
    for label in included:
        if label not in ASSETS:
            continue
        metadata_rows.append(
            {
                "Activo": label,
                "Fuente": ASSETS[label]["src"],
                "Simbolo": ASSETS[label]["id"],
            }
        )

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        view_df.to_excel(writer, sheet_name="Datos")
        pd.DataFrame(metadata_rows).to_excel(writer, sheet_name="Activos", index=False)
        if not snapshot_df.empty:
            snapshot_df.drop(columns=["PrevClose"], errors="ignore").to_excel(
                writer,
                sheet_name="Snapshot",
                index=False,
            )
        pd.DataFrame(
            [
                {
                    "fecha_inicio": meta.get("sdate"),
                    "fecha_fin": meta.get("edate"),
                    "frecuencia": meta.get("freq"),
                    "filas": int(view_df.shape[0]),
                    "columnas": int(view_df.shape[1]),
                }
            ]
        ).to_excel(writer, sheet_name="Info", index=False)

    buffer.seek(0)
    return buffer.getvalue()


def png_bytes_from_figure(fig) -> bytes:
    buffer = io.BytesIO()
    fig.savefig(buffer, dpi=160, bbox_inches="tight")
    buffer.seek(0)
    return buffer.getvalue()


def init_state() -> None:
    defaults = {
        "base_df": pd.DataFrame(),
        "snapshot_df": pd.DataFrame(),
        "meta": {},
        "failures": [],
        "included_assets": [],
        "selected_assets": list(ASSETS.keys()),
        "show_config": False,
        "expand_history": False,
        "snapshot_page": 1,
        "last_snapshot_search": "",
        "pending_cfg_included_assets": None,
        "inverted_instruments": [],
        "invert_pairs_global": False,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def resolve_fred_key() -> str:
    env_key = os.getenv("FRED_KEY", "")
    try:
        return st.secrets.get("FRED_KEY", env_key) or env_key
    except StreamlitSecretNotFoundError:
        return env_key


def _fmt_value(value, decimals: int = DECIMALS) -> str:
    if pd.isna(value):
        return "—"
    return f"{float(value):.{decimals}f}"


def _fmt_pct(value) -> str:
    if pd.isna(value):
        return "—"
    return f"{float(value):+.2f}%"


def instrument_color(label: str) -> str:
    palette = [
        "#3b82f6",
        "#6366f1",
        "#ef4444",
        "#f59e0b",
        "#14b8a6",
        "#8b5cf6",
        "#ec4899",
        "#0ea5e9",
        "#84cc16",
        "#64748b",
    ]
    return palette[abs(hash(label)) % len(palette)]


def build_snapshot_table_html(
    page_df: pd.DataFrame,
    highlight_instrument: str | None,
    last_update_utc: str,
    start_row: int,
    end_row: int,
    total_rows: int,
) -> str:
    if total_rows == 0 or page_df.empty:
        return "<div class='fin-table-shell'><div class='fin-table-toolbar'>Sin datos disponibles en snapshot.</div></div>"

    rows_html = []
    for _, row in page_df.iterrows():
        instrument = str(row.get("Instrumento", "—"))
        raw_date = row.get("Fecha")
        if hasattr(raw_date, "strftime"):
            date_text = raw_date.strftime("%Y-%m-%d")
        else:
            date_text = str(raw_date)

        change_val = row.get("Cambio %")
        change_text = _fmt_pct(change_val)
        change_class = "change-up" if (pd.notna(change_val) and float(change_val) >= 0) else "change-down"
        row_class = "row-highlight" if instrument == highlight_instrument else ""
        is_inverted = bool(row.get("__is_inverted__", False))
        swap_class = "active" if is_inverted else ""
        swap_href = f"?toggle_invert={quote_plus(instrument)}#snapshot-table"
        swap_title = "Quitar inversión (1/x)" if is_inverted else "Invertir este instrumento (1/x)"

        rows_html.append(
            dedent(
                f"""
                <tr class="{row_class}">
                  <td class="mono">{escape(date_text)}</td>
                  <td>
                    <span class="instrument-cell">
                      <span class="instrument-dot" style="background:{instrument_color(instrument)};"></span>
                      {escape(instrument)}
                    </span>
                  </td>
                  <td class="num-cell">{_fmt_value(row.get("Apertura"))}</td>
                  <td class="num-cell">{_fmt_value(row.get("Maximo"))}</td>
                  <td class="num-cell">{_fmt_value(row.get("Minimo"))}</td>
                  <td class="num-cell">{_fmt_value(row.get("Cierre"))}</td>
                  <td class="{change_class} mono">{change_text}</td>
                  <td class="swap-cell">
                    <a class="swap-link {swap_class}" href="{swap_href}" title="{swap_title}" aria-label="{swap_title}">
                      <span class="material-symbols-outlined">swap_horiz</span>
                    </a>
                  </td>
                </tr>
                """
            ).strip()
        )

    return dedent(
        f"""
        <div class="fin-table-shell" id="snapshot-table">
          <div class="fin-table-toolbar">
            <span><b>Inversión global (1/x)</b> en controles superiores</span>
            <span class="mono">ÚLTIMA ACTUALIZACIÓN: {escape(last_update_utc)}</span>
          </div>
          <div class="fin-table-scroll">
            <table class="fx-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Instrumento</th>
                  <th style="text-align:right;">Apertura</th>
                  <th style="text-align:right;">Máximo</th>
                  <th style="text-align:right;">Mínimo</th>
                  <th style="text-align:right;">Cierre</th>
                  <th style="text-align:right;">Cambio %</th>
                  <th style="text-align:center;">Invertir</th>
                </tr>
              </thead>
              <tbody>
                {''.join(rows_html)}
              </tbody>
            </table>
          </div>
          <div class="fin-table-footer">
            <span>Mostrando {start_row} a {end_row} de {total_rows} resultados</span>
            <span class="mono">Conexión en vivo</span>
          </div>
        </div>
        """
    ).strip()


def build_market_cards_html(snapshot_df: pd.DataFrame, failures: list[str]) -> str:
    changes = snapshot_df.dropna(subset=["Cambio %"]) if not snapshot_df.empty else pd.DataFrame()

    if changes.empty:
        gainer_name, gainer_pct = "—", "—"
        loser_name, loser_pct = "—", "—"
    else:
        gain_row = changes.loc[changes["Cambio %"].idxmax()]
        lose_row = changes.loc[changes["Cambio %"].idxmin()]
        gainer_name = str(gain_row["Instrumento"])
        gainer_pct = _fmt_pct(gain_row["Cambio %"])
        loser_name = str(lose_row["Instrumento"])
        loser_pct = _fmt_pct(lose_row["Cambio %"])

    volatility_alerts = 0
    if not snapshot_df.empty:
        volatility_alerts = int(snapshot_df["Cambio %"].abs().fillna(0).ge(2.0).sum())
    critical_alerts = len(failures) + volatility_alerts
    health_label = "Saludable" if len(failures) == 0 else "Con incidencias"
    health_sub = "Latencia estimada: 12ms" if len(failures) == 0 else f"Fallos de carga: {len(failures)}"

    loser_class = "kpi-sub-down" if loser_pct != "—" else "kpi-sub-muted"
    gainer_class = "kpi-sub-up" if gainer_pct != "—" else "kpi-sub-muted"

    return dedent(
        f"""
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Mayor Ganancia (24h)</div>
            <div class="kpi-row">
              <div>
                <div class="kpi-main">{escape(gainer_name)}</div>
                <div class="{gainer_class} mono">{escape(gainer_pct)}</div>
              </div>
              <svg class="kpi-spark up" viewBox="0 0 60 24" fill="none" aria-hidden="true">
                <path d="M0 20L10 18L20 15L30 19L40 10L50 12L60 2"></path>
              </svg>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Mayor Pérdida (24h)</div>
            <div class="kpi-row">
              <div>
                <div class="kpi-main">{escape(loser_name)}</div>
                <div class="{loser_class} mono">{escape(loser_pct)}</div>
              </div>
              <svg class="kpi-spark down" viewBox="0 0 60 24" fill="none" aria-hidden="true">
                <path d="M0 5L10 8L20 12L30 10L40 18L50 16L60 22"></path>
              </svg>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Alertas Activas</div>
            <div class="kpi-row">
              <div>
                <div class="kpi-main">{critical_alerts} {'Críticas' if critical_alerts else ''}</div>
                <div class="kpi-sub-muted">Ver registros</div>
              </div>
              <span class="kpi-alert-dot"></span>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Estado del Sistema</div>
            <div class="kpi-row">
              <div>
                <div class="kpi-main">{health_label}</div>
                <div class="kpi-sub-muted">{escape(health_sub)}</div>
              </div>
              <span class="material-symbols-outlined kpi-health-icon">check_circle</span>
            </div>
          </div>
        </div>
        """
    ).strip()


def frequency_human_label(freq_code: str) -> str:
    freq_map = {
        "D": "Diaria",
        "B": "Diaria (sin fines de semana)",
        "W": "Semanal (viernes)",
        "M": "Mensual",
    }
    return freq_map.get(freq_code, "Diaria")


def dashboard_header(meta: dict, row_count: int, included_count: int):

    st.markdown(
        """
        <div class="fin-topbar">
          <div class="fin-topbar-left">
            <div class="fin-brand">
              <span class="fin-brand-icon material-symbols-outlined">analytics</span>
              <span class="fin-brand-title">FinBoard</span>
            </div>
            <div class="fin-nav">
              <span>Dashboard</span>
              <span>Índices/ETFs</span>
              <span class="fin-nav-active">FX / Monedas</span>
              <span>Ajustes</span>
            </div>
          </div>
          <div class="fin-topbar-right">
            <span class="fin-nav-search"><span class="material-symbols-outlined" style="font-size:18px;">search</span>Buscar pares, símbolos...</span>
            <span class="fin-circle-btn"><span class="material-symbols-outlined" style="font-size:18px;">notifications</span><span class="fin-circle-dot"></span></span>
            <span class="fin-avatar"><span class="material-symbols-outlined" style="font-size:18px;">account_circle</span></span>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown(
        """
        <div class="fin-breadcrumb">
          <span>Análisis de Mercado</span>
          <span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span>
          <span style="color:#111827;font-weight:600;">Datos FX</span>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown(
        """
        <div class="fin-hero">
          <h1>Datos de FX / Monedas</h1>
          <p>Procesamiento de datos forex de alta precisión y herramientas de exportación. Monitoreo en vivo de los principales pares.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

def main():
    st.set_page_config(
        page_title="FinBoard - Indices ETFs",
        page_icon="📈",
        layout="wide",
        initial_sidebar_state="collapsed",
    )
    inject_styles()
    init_state()

    today = date.today()
    freq_label_map = {
        "Diaria": "D",
        "Semanal (viernes)": "W",
        "Mensual (último)": "M",
    }
    presets = ["Custom", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"]

    if "cfg_preset" not in st.session_state:
        st.session_state["cfg_preset"] = "YTD"
    if "cfg_freq_label" not in st.session_state:
        st.session_state["cfg_freq_label"] = "Diaria"
    if "cfg_exclude_weekends" not in st.session_state:
        st.session_state["cfg_exclude_weekends"] = True
    if "cfg_start" not in st.session_state:
        st.session_state["cfg_start"] = DEFAULT_START
    if "cfg_end" not in st.session_state:
        st.session_state["cfg_end"] = today
    if "cfg_assets" not in st.session_state:
        st.session_state["cfg_assets"] = list(ASSETS.keys())

    fred_key = resolve_fred_key()
    if not fred_key:
        st.warning("FRED_KEY no configurada. Las series FRED pueden fallar.")

    base_df = st.session_state["base_df"]
    snapshot_df = st.session_state["snapshot_df"]
    failures = st.session_state["failures"]

    current_meta = st.session_state["meta"] or {
        "sdate": st.session_state["cfg_start"].strftime("%Y-%m-%d"),
        "edate": st.session_state["cfg_end"].strftime("%Y-%m-%d"),
        "freq": "B" if st.session_state["cfg_exclude_weekends"] else "D",
        "preset": st.session_state["cfg_preset"],
        "last_update_utc": datetime.now(timezone.utc).strftime("%H:%M:%S UTC"),
    }

    included_assets = st.session_state.get("included_assets", list(base_df.columns))
    included_assets = [label for label in included_assets if label in base_df.columns]
    st.session_state["included_assets"] = included_assets
    view_df = build_view_df(base_df, included_assets)

    dashboard_header(current_meta, int(view_df.shape[0]), len(included_assets))

    action_left, action_right = st.columns([0.70, 0.30])
    with action_right:
        st.markdown("<div class='fin-actions-wrap'>", unsafe_allow_html=True)
        cfg_col, export_col = st.columns([0.48, 0.52])
        with cfg_col:
            if st.button("Configurar Vista", icon=":material/settings:", use_container_width=True):
                st.session_state["show_config"] = not st.session_state["show_config"]
        with export_col:
            excel_name = (
                f"indices_view_{current_meta.get('freq', 'D')}_"
                f"{current_meta.get('sdate', '')}_to_{current_meta.get('edate', '')}.xlsx"
            )
            excel_payload = (
                to_excel_bytes(view_df, included_assets, snapshot_df, current_meta)
                if not view_df.empty
                else b""
            )
            st.download_button(
                "Exportar Excel",
                data=excel_payload,
                file_name=excel_name,
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
                icon=":material/download:",
                disabled=view_df.empty,
            )
        st.markdown("</div>", unsafe_allow_html=True)

    range_label = f"{current_meta.get('sdate', '-')} → {current_meta.get('edate', '-')}"
    preset_label = str(st.session_state.get("cfg_preset", current_meta.get("preset", "YTD")))
    freq_label = str(st.session_state.get("cfg_freq_label", frequency_human_label(current_meta.get("freq", "D"))))
    if freq_label == "Diaria" and bool(st.session_state.get("cfg_exclude_weekends", False)):
        freq_label = "Diaria (sin fines de semana)"

    total_snapshot_rows = int(len(st.session_state.get("snapshot_df", pd.DataFrame())))
    if total_snapshot_rows == 0:
        total_snapshot_rows = int(view_df.shape[0]) if not view_df.empty else 0
    snapshot_page_size = 10
    max_snapshot_pages = max(1, (total_snapshot_rows + snapshot_page_size - 1) // snapshot_page_size) if total_snapshot_rows else 1
    records_label = f"{total_snapshot_rows} filas"

    chip_refresh_requested = False
    with action_left:
        with st.container(key="chip_controls"):
            chip_col_1, chip_col_2, chip_col_3, chip_col_4, chip_divider, chip_col_5 = st.columns(
                [2.2, 2.6, 1.5, 1.3, 0.06, 1.4]
            )
            with chip_col_1:
                if st.button(
                    f"RANGO  **{range_label}**",
                    key="chip_range_btn",
                    use_container_width=True,
                    icon=":material/calendar_today:",
                    help="Cambia el rango rápido y recarga datos.",
                ):
                    range_order = ["YTD", "1M", "3M", "6M", "1Y", "5Y", "MAX"]
                    current_range = st.session_state.get("cfg_preset", "YTD")
                    if current_range not in range_order:
                        current_range = "YTD"
                    next_range = range_order[(range_order.index(current_range) + 1) % len(range_order)]
                    st.session_state["cfg_preset"] = next_range
                    r_start, r_end = dates_from_preset(next_range, today)
                    st.session_state["cfg_start"] = r_start
                    st.session_state["cfg_end"] = r_end
                    chip_refresh_requested = True
            with chip_col_2:
                if st.button(
                    f"FRECUENCIA  **{freq_label}**",
                    key="chip_freq_btn",
                    use_container_width=True,
                    icon=":material/schedule:",
                    help="Cambia la frecuencia y recarga datos.",
                ):
                    order = ["Diaria", "Semanal (viernes)", "Mensual (último)"]
                    current_freq = st.session_state.get("cfg_freq_label", "Diaria")
                    next_freq = order[(order.index(current_freq) + 1) % len(order)] if current_freq in order else "Diaria"
                    st.session_state["cfg_freq_label"] = next_freq
                    if next_freq != "Diaria":
                        st.session_state["cfg_exclude_weekends"] = False
                    chip_refresh_requested = True
            with chip_col_3:
                if st.button(
                    f"REGISTROS  **{records_label}**",
                    key="chip_records_btn",
                    use_container_width=True,
                    icon=":material/list:",
                    help="Avanza de página en la tabla snapshot.",
                ):
                    current_snapshot_page = int(st.session_state.get("snapshot_page", 1))
                    st.session_state["snapshot_page"] = (
                        1 if current_snapshot_page >= max_snapshot_pages else current_snapshot_page + 1
                    )
                    st.rerun()
            with chip_col_4:
                if st.button(
                    f"PRESET  **{preset_label}**",
                    key="chip_preset_btn",
                    use_container_width=True,
                    icon=":material/filter_alt:",
                    help="Cambia el preset de rango y recarga datos.",
                ):
                    preset_order = ["YTD", "1Y", "5Y", "MAX"]
                    current_preset = st.session_state.get("cfg_preset", "YTD")
                    if current_preset not in preset_order:
                        current_preset = "YTD"
                    next_preset = preset_order[(preset_order.index(current_preset) + 1) % len(preset_order)]
                    st.session_state["cfg_preset"] = next_preset
                    p_start, p_end = dates_from_preset(next_preset, today)
                    st.session_state["cfg_start"] = p_start
                    st.session_state["cfg_end"] = p_end
                    chip_refresh_requested = True
            with chip_divider:
                with st.container(key="chip_divider"):
                    st.markdown("<div class='chip-vline'></div>", unsafe_allow_html=True)
            with chip_col_5:
                if st.button(
                    "Conexión en vivo",
                    key="chip_live_btn",
                    use_container_width=True,
                    icon=":material/wifi:",
                    help="Recarga las series con la configuración actual.",
                ):
                    chip_refresh_requested = True

    show_config_panel = st.session_state["show_config"] or base_df.empty
    load_clicked = False
    with st.expander("Parámetros de carga y vista", expanded=show_config_panel):
        cfg_col_1, cfg_col_2, cfg_col_3 = st.columns([1.05, 1.0, 1.15])
        with cfg_col_1:
            st.selectbox("Rango", presets, key="cfg_preset")
        with cfg_col_2:
            st.selectbox("Frecuencia", list(freq_label_map.keys()), key="cfg_freq_label")
        with cfg_col_3:
            st.toggle("Excluir fines de semana (D -> B)", key="cfg_exclude_weekends")

        preset = st.session_state["cfg_preset"]
        if preset == "Custom":
            date_col_1, date_col_2 = st.columns(2)
            date_col_1.date_input("Desde", key="cfg_start")
            date_col_2.date_input("Hasta", key="cfg_end")
        else:
            auto_start, auto_end = dates_from_preset(preset, today)
            st.session_state["cfg_start"] = auto_start
            st.session_state["cfg_end"] = auto_end
            st.caption(f"Rango aplicado: {auto_start} → {auto_end}")

        st.multiselect(
            "Activos",
            options=list(ASSETS.keys()),
            key="cfg_assets",
            help="Selecciona uno o varios activos para descargar.",
        )

        if not base_df.empty:
            pending_included = st.session_state.get("pending_cfg_included_assets")
            if pending_included is not None:
                st.session_state["cfg_included_assets"] = pending_included
                st.session_state["pending_cfg_included_assets"] = None

            cfg_included = st.session_state.get("cfg_included_assets", included_assets or list(base_df.columns))
            cfg_included = [item for item in cfg_included if item in base_df.columns]
            st.session_state["cfg_included_assets"] = cfg_included
            st.multiselect(
                "Series incluidas en vista/exportación",
                options=list(base_df.columns),
                key="cfg_included_assets",
            )
            inc_col_1, inc_col_2 = st.columns([0.5, 0.5])
            if inc_col_1.button("Incluir todas", use_container_width=True):
                st.session_state["pending_cfg_included_assets"] = list(base_df.columns)
                st.rerun()
            if inc_col_2.button("Quitar todas", use_container_width=True):
                st.session_state["pending_cfg_included_assets"] = []
                st.rerun()
            st.session_state["included_assets"] = st.session_state["cfg_included_assets"]

        load_clicked = st.button("Actualizar datos", type="primary", use_container_width=True)

    load_clicked = load_clicked or chip_refresh_requested

    if load_clicked:
        preset = st.session_state["cfg_preset"]
        freq_label = st.session_state["cfg_freq_label"]
        exclude_weekends = bool(st.session_state["cfg_exclude_weekends"])
        start_dt = st.session_state["cfg_start"]
        end_dt = st.session_state["cfg_end"]
        if preset != "Custom":
            start_dt, end_dt = dates_from_preset(preset, today)
            st.session_state["cfg_start"] = start_dt
            st.session_state["cfg_end"] = end_dt

        selected_assets = st.session_state["cfg_assets"]
        freq = freq_label_map[freq_label]
        effective_freq = "B" if (freq == "D" and exclude_weekends) else freq

        if not selected_assets:
            st.error("Selecciona al menos un activo.")
        elif start_dt > end_dt:
            st.error("La fecha inicial no puede ser mayor que la final.")
        else:
            progress = st.progress(0, text="Descargando series...")

            def _progress(idx: int, total: int, label: str):
                pct = int(idx / total * 100)
                progress.progress(pct, text=f"{pct}% - {label}")

            fetched_base_df, fetched_snapshot_df, fetched_failures = fetch_all_assets(
                labels=selected_assets,
                start=start_dt.strftime("%Y-%m-%d"),
                end=end_dt.strftime("%Y-%m-%d"),
                freq=effective_freq,
                fred_key=fred_key,
                progress_callback=_progress,
            )

            progress.empty()

            if fetched_base_df.empty:
                st.error("No se pudo cargar ninguna serie con los parámetros seleccionados.")
            else:
                st.session_state["base_df"] = fetched_base_df
                st.session_state["snapshot_df"] = fetched_snapshot_df
                st.session_state["meta"] = {
                    "sdate": start_dt.strftime("%Y-%m-%d"),
                    "edate": end_dt.strftime("%Y-%m-%d"),
                    "freq": effective_freq,
                    "preset": preset,
                    "last_update_utc": datetime.now(timezone.utc).strftime("%H:%M:%S UTC"),
                }
                st.session_state["failures"] = fetched_failures
                st.session_state["included_assets"] = list(fetched_base_df.columns)
                st.session_state["pending_cfg_included_assets"] = list(fetched_base_df.columns)
                st.session_state["inverted_instruments"] = []
                st.session_state["snapshot_page"] = 1
                st.session_state["show_config"] = False
                st.rerun()

    base_df = st.session_state["base_df"]
    snapshot_df = st.session_state["snapshot_df"]
    failures = st.session_state["failures"]
    meta = st.session_state["meta"] or current_meta

    available_snapshot_instruments = (
        set(snapshot_df["Instrumento"].astype(str)) if (not snapshot_df.empty and "Instrumento" in snapshot_df.columns) else set()
    )
    stored_inverted = [str(item) for item in st.session_state.get("inverted_instruments", [])]
    stored_inverted = [item for item in stored_inverted if item in available_snapshot_instruments]
    st.session_state["inverted_instruments"] = stored_inverted

    raw_toggle_target = st.query_params.get("toggle_invert", "")
    if isinstance(raw_toggle_target, list):
        raw_toggle_target = raw_toggle_target[-1] if raw_toggle_target else ""
    toggle_target = str(raw_toggle_target).strip()
    if toggle_target:
        if toggle_target in available_snapshot_instruments:
            next_inverted = set(stored_inverted)
            if toggle_target in next_inverted:
                next_inverted.remove(toggle_target)
            else:
                next_inverted.add(toggle_target)
            st.session_state["inverted_instruments"] = sorted(next_inverted)
        try:
            st.query_params.clear()
        except Exception:
            pass
        st.rerun()

    included_assets = st.session_state.get("included_assets", list(base_df.columns))
    included_assets = [label for label in included_assets if label in base_df.columns]
    st.session_state["included_assets"] = included_assets
    view_df = build_view_df(base_df, included_assets)

    if base_df.empty:
        st.info("Configura parámetros y presiona 'Actualizar datos' para llenar el panel.")
        return

    if failures:
        st.warning("No se pudieron cargar: " + ", ".join(failures))

    ctl_col_1, ctl_col_2, ctl_col_3, ctl_col_4 = st.columns([0.24, 0.28, 0.10, 0.38])
    with ctl_col_1:
        invert_pairs = st.toggle("Inversión Global (1/x)", key="invert_pairs_global")
    with ctl_col_2:
        st.markdown(
            f"<div style='padding-top:30px;' class='mono'>ÚLTIMA ACTUALIZACIÓN: {escape(meta.get('last_update_utc', '--'))}</div>",
            unsafe_allow_html=True,
        )
    with ctl_col_3:
        st.markdown(
            "<div style='padding-top:24px;' class='fin-toolbar-icons'><span class='material-symbols-outlined' style='font-size:18px;'>filter_list</span><span class='material-symbols-outlined' style='font-size:18px;'>view_column</span></div>",
            unsafe_allow_html=True,
        )
    with ctl_col_4:
        search_term = st.text_input(
            "Filtrar tabla",
            value=st.session_state.get("last_snapshot_search", ""),
            placeholder="Filtrar tabla...",
            label_visibility="collapsed",
        )

    if search_term != st.session_state.get("last_snapshot_search", ""):
        st.session_state["snapshot_page"] = 1
        st.session_state["last_snapshot_search"] = search_term

    snapshot_view = build_snapshot_view(
        snapshot_df,
        invert_global=invert_pairs,
        inverted_labels=set(st.session_state.get("inverted_instruments", [])),
    )
    if search_term.strip():
        filt = search_term.lower().strip()
        snapshot_view = snapshot_view[snapshot_view["Instrumento"].str.lower().str.contains(filt, na=False)]
    snapshot_view = snapshot_view.sort_values("Cambio %", ascending=False, na_position="last")

    total_rows = int(len(snapshot_view))
    page_size = 10
    total_pages = max(1, (total_rows + page_size - 1) // page_size)
    current_page = int(st.session_state.get("snapshot_page", 1))
    current_page = max(1, min(current_page, total_pages))
    st.session_state["snapshot_page"] = current_page

    start_idx = (current_page - 1) * page_size
    end_idx = min(start_idx + page_size, total_rows)
    snapshot_page_df = snapshot_view.iloc[start_idx:end_idx].copy()

    highlight_instrument = None
    if not snapshot_view.empty and snapshot_view["Cambio %"].notna().any():
        highlight_instrument = str(snapshot_view.loc[snapshot_view["Cambio %"].idxmax(), "Instrumento"])

    st.markdown(
        build_snapshot_table_html(
            snapshot_page_df,
            highlight_instrument=highlight_instrument,
            last_update_utc=meta.get("last_update_utc", "--"),
            start_row=(start_idx + 1) if total_rows else 0,
            end_row=end_idx,
            total_rows=total_rows,
        ),
        unsafe_allow_html=True,
    )

    pag_col_1, pag_col_2, pag_col_3 = st.columns([0.90, 0.05, 0.05])
    with pag_col_2:
        if st.button("‹", key="snap_prev_page", disabled=current_page <= 1, use_container_width=True):
            st.session_state["snapshot_page"] = current_page - 1
            st.rerun()
    with pag_col_3:
        if st.button("›", key="snap_next_page", disabled=current_page >= total_pages, use_container_width=True):
            st.session_state["snapshot_page"] = current_page + 1
            st.rerun()

    st.markdown(build_market_cards_html(snapshot_view, failures), unsafe_allow_html=True)

    expand_history_now = bool(st.session_state.get("expand_history", False))
    st.session_state["expand_history"] = False
    with st.expander("Vista histórica (cierres)", expanded=expand_history_now):
        if view_df.empty:
            st.info("No hay series incluidas para mostrar.")
        else:
            st.dataframe(
                view_df,
                use_container_width=True,
                column_config={col: st.column_config.NumberColumn(format=f"%.{DECIMALS}f") for col in view_df.columns},
            )

    st.markdown("<div class='section-title'>Gráfico y KPIs detallados</div>", unsafe_allow_html=True)

    if view_df.empty:
        st.info("Selecciona al menos una serie incluida para graficar.")
        return

    chart_cols = st.columns([0.33, 0.67])
    with chart_cols[0]:
        chart_series = st.multiselect(
            "Series",
            options=list(view_df.columns),
            default=list(view_df.columns[:1]),
        )
        chart_type = st.selectbox("Tipo", ["line", "area"], format_func=lambda x: "Línea" if x == "line" else "Área")
        chart_pct = st.checkbox("Variación % diaria", value=False)
        chart_normalize = st.checkbox("Normalizar (base=100)", value=False)
        chart_ma = st.checkbox("Media móvil", value=False)
        chart_ma_win = st.slider("Ventana MA", min_value=2, max_value=200, value=20, step=1, disabled=not chart_ma)
        chart_log = st.checkbox("Escala log", value=False)
        chart_last_mark = st.checkbox("Marcar último valor", value=True)

    with chart_cols[1]:
        if not chart_series:
            st.info("Selecciona al menos una serie para graficar.")
        else:
            base_chart = view_df[chart_series].dropna(how="all")
            transformed = transform_for_chart(
                frame=base_chart,
                as_pct=chart_pct,
                normalize=chart_normalize,
                with_ma=chart_ma,
                ma_window=chart_ma_win,
            )

            if transformed.empty:
                st.warning("Sin datos para graficar con las opciones actuales.")
            else:
                title_parts = []
                if chart_pct:
                    title_parts.append("Variación % diaria")
                if chart_normalize:
                    title_parts.append("Base=100")
                if chart_ma:
                    title_parts.append(f"MA({chart_ma_win})")
                title = " | ".join(title_parts) if title_parts else "Series seleccionadas"

                fig, log_warning = draw_chart(
                    frame=transformed,
                    series_names=chart_series,
                    chart_type=chart_type,
                    use_log=chart_log,
                    mark_last=chart_last_mark,
                    title=title,
                )
                st.pyplot(fig, use_container_width=True)

                if log_warning:
                    st.warning(log_warning)

                png_name = f"chart_{meta.get('freq', 'D')}_{meta.get('sdate', '')}_to_{meta.get('edate', '')}.png"
                st.download_button(
                    "Exportar PNG",
                    data=png_bytes_from_figure(fig),
                    file_name=png_name,
                    mime="image/png",
                )
                plt.close(fig)

                first_series = base_chart[chart_series[0]].dropna()
                metrics = perf_summary(first_series)
                if metrics:
                    st.markdown("### KPIs (serie primaria)")
                    kpi_cols = st.columns(4)
                    for index, (label, value) in enumerate(metrics.items()):
                        col = kpi_cols[index % 4]
                        delta_text = "NA" if pd.isna(value) else f"{value:+.2f}%"
                        col.metric(label=label, value=delta_text)


if __name__ == "__main__":
    main()
