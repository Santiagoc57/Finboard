import io
import time
from datetime import date
from typing import Any, Callable, Literal

import numpy as np
import pandas as pd
import requests
import yfinance as yf
from dateutil.relativedelta import relativedelta

from ..config import (
    ASSETS_INDICES_ETFS,
    CCY_FLAGS,
    CURRENCY_CANDIDATES,
    CURRENCY_PAIRS,
    DECIMALS,
    DEFAULT_MARKET,
    DEFAULT_START,
    MarketCode,
)

AssetSource = Literal["fred", "yahoo", "stooq"]
AssetMeta = dict[str, str]
AssetMap = dict[str, AssetMeta]
ProgressHook = Callable[[int, int, str, str], None]

SUPPORTED_CUSTOM_SOURCES: set[str] = {"fred", "yahoo", "stooq"}
YAHOO_SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search"
FRED_SEARCH_URL = "https://api.stlouisfed.org/fred/series/search"


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


def _empty_ohlc_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=["open", "high", "low", "close"])


def _as_float(value: Any) -> float | None:
    try:
        return float(value)
    except Exception:
        return None


def split_pair(pair: str) -> tuple[str, str]:
    left, right = pair.split("/", 1)
    return left.strip(), right.strip()


def flip_pair(pair: str) -> str:
    left, right = split_pair(pair)
    return f"{right}/{left}"


def flag_for_currency(code: str) -> str:
    return CCY_FLAGS.get(code, "")


def _currency_symbol(pair: str) -> str:
    candidates = CURRENCY_CANDIDATES.get(pair, [])
    if not candidates:
        return ""
    return candidates[0][0]


def _normalized_custom_assets(custom_assets: list[dict[str, str]] | None) -> list[dict[str, str]]:
    if not custom_assets:
        return []

    normalized: list[dict[str, str]] = []
    for row in custom_assets:
        label = str(row.get("label", "")).strip()
        source = str(row.get("source", "")).strip().lower()
        symbol = str(row.get("symbol", "")).strip()
        if not label or not symbol or source not in SUPPORTED_CUSTOM_SOURCES:
            continue
        normalized.append({"label": label, "source": source, "symbol": symbol})

    return normalized


def build_indices_asset_map(custom_assets: list[dict[str, str]] | None = None) -> AssetMap:
    asset_map: AssetMap = {label: {"src": meta["src"], "id": meta["id"]} for label, meta in ASSETS_INDICES_ETFS.items()}
    for row in _normalized_custom_assets(custom_assets):
        label = row["label"]
        if label in asset_map:
            continue
        asset_map[label] = {"src": row["source"], "id": row["symbol"]}
    return asset_map


def get_market_catalog(market: MarketCode, custom_assets: list[dict[str, str]] | None = None) -> list[dict[str, str]]:
    if market == "indices_etfs":
        asset_map = build_indices_asset_map(custom_assets)
        return [
            {
                "label": label,
                "source": meta["src"],
                "symbol": meta["id"],
            }
            for label, meta in asset_map.items()
        ]

    rows: list[dict[str, str]] = []
    for pair in CURRENCY_PAIRS:
        base, quote = split_pair(pair)
        rows.append(
            {
                "label": pair,
                "source": "yahoo_fx",
                "symbol": _currency_symbol(pair),
                "base_currency": base,
                "quote_currency": quote,
                "base_flag": flag_for_currency(base),
                "quote_flag": flag_for_currency(quote),
            }
        )
    return rows


def list_market_instruments(market: MarketCode, custom_assets: list[dict[str, str]] | None = None) -> list[str]:
    if market == "indices_etfs":
        return list(build_indices_asset_map(custom_assets).keys())
    return list(CURRENCY_PAIRS)


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


def fetch_stooq_ohlc(symbol: str) -> pd.DataFrame:
    url = "https://stooq.com/q/d/l/"
    response = requests.get(url, params={"s": symbol, "i": "d"}, timeout=30)
    response.raise_for_status()

    df = pd.read_csv(io.StringIO(response.text))
    needed = ["Date", "Open", "High", "Low", "Close"]
    if df.empty or not all(col in df.columns for col in needed):
        return _empty_ohlc_frame()

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


def fetch_yahoo_ohlc(symbol: str, start: str, end: str, retries: int = 3) -> pd.DataFrame:
    last_error: Exception | None = None

    for attempt in range(retries):
        try:
            df = yf.download(
                symbol,
                start=start,
                end=end,
                progress=False,
                auto_adjust=False,
                threads=False,
            )
            if not isinstance(df, pd.DataFrame) or df.empty:
                time.sleep(0.7 * (attempt + 1))
                continue

            if isinstance(df.columns, pd.MultiIndex):
                df.columns = [col[0] for col in df.columns]

            out = pd.DataFrame(index=pd.to_datetime(df.index))
            out["open"] = pd.to_numeric(df.get("Open"), errors="coerce")
            out["high"] = pd.to_numeric(df.get("High"), errors="coerce")
            out["low"] = pd.to_numeric(df.get("Low"), errors="coerce")

            if "Adj Close" in df.columns:
                out["close"] = pd.to_numeric(df.get("Adj Close"), errors="coerce")
            else:
                out["close"] = pd.to_numeric(df.get("Close"), errors="coerce")

            out = out.sort_index().dropna(how="all")
            if out.empty:
                time.sleep(0.7 * (attempt + 1))
                continue

            for col in ["open", "high", "low"]:
                out[col] = out[col].fillna(out["close"])

            return out[["open", "high", "low", "close"]]
        except Exception as exc:
            last_error = exc
            time.sleep(0.7 * (attempt + 1))

    if last_error:
        return _empty_ohlc_frame()
    return _empty_ohlc_frame()


def _display_label(name: str, symbol: str) -> str:
    clean_name = str(name or "").strip()
    clean_symbol = str(symbol or "").strip()
    if not clean_name:
        return clean_symbol
    if clean_symbol and clean_symbol.upper() in clean_name.upper():
        return clean_name
    if clean_symbol:
        return f"{clean_name} ({clean_symbol})"
    return clean_name


def search_fred_instruments(query: str, api_key: str, limit: int = 10) -> list[dict[str, Any]]:
    if not api_key:
        return []

    params = {
        "search_text": query,
        "api_key": api_key,
        "file_type": "json",
        "limit": max(1, min(limit, 25)),
        "sort_order": "desc",
    }
    try:
        response = requests.get(FRED_SEARCH_URL, params=params, timeout=6)
        response.raise_for_status()
        rows = response.json().get("seriess", [])
    except Exception:
        return []

    out: list[dict[str, Any]] = []
    seen_symbols: set[str] = set()
    for row in rows:
        symbol = str(row.get("id", "")).strip()
        if not symbol or symbol in seen_symbols:
            continue
        seen_symbols.add(symbol)

        title = str(row.get("title", "")).strip() or symbol
        frequency = str(row.get("frequency_short", "")).strip()
        units = str(row.get("units_short", "")).strip()
        notes = " · ".join(part for part in [frequency, units] if part)
        out.append(
            {
                "label": _display_label(title, symbol),
                "source": "fred",
                "symbol": symbol,
                "provider": "FRED",
                "description": notes,
            }
        )
        if len(out) >= limit:
            break
    return out


def search_yahoo_instruments(query: str, limit: int = 10) -> list[dict[str, Any]]:
    params = {
        "q": query,
        "quotesCount": max(5, min(limit * 3, 50)),
        "newsCount": 0,
    }
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        response = requests.get(YAHOO_SEARCH_URL, params=params, headers=headers, timeout=6)
        response.raise_for_status()
        rows = response.json().get("quotes", [])
    except Exception:
        return []

    out: list[dict[str, Any]] = []
    seen_symbols: set[str] = set()
    for row in rows:
        symbol = str(row.get("symbol", "")).strip()
        if not symbol or symbol in seen_symbols:
            continue
        seen_symbols.add(symbol)

        short_name = str(row.get("shortname", "")).strip()
        long_name = str(row.get("longname", "")).strip()
        display_name = short_name or long_name or symbol
        quote_type = str(row.get("quoteType", "")).strip()
        exchange = str(row.get("exchDisp", "")).strip()
        notes = " · ".join(part for part in [quote_type, exchange] if part)
        out.append(
            {
                "label": _display_label(display_name, symbol),
                "source": "yahoo",
                "symbol": symbol,
                "provider": "Yahoo",
                "description": notes,
            }
        )
        if len(out) >= limit:
            break
    return out


def search_market_instruments(
    market: MarketCode,
    query: str,
    fred_key: str,
    limit: int = 12,
    custom_assets: list[dict[str, str]] | None = None,
) -> list[dict[str, Any]]:
    clean_query = query.strip()
    if not clean_query:
        return []

    if market != "indices_etfs":
        return []

    max_limit = max(1, min(limit, 30))
    yahoo_rows = search_yahoo_instruments(clean_query, limit=max_limit)
    fred_rows = search_fred_instruments(clean_query, api_key=fred_key, limit=max_limit)

    merged: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, str]] = set()
    for row in [*yahoo_rows, *fred_rows]:
        key = (str(row.get("source", "")).strip(), str(row.get("symbol", "")).strip().upper())
        if key in seen_keys:
            continue
        seen_keys.add(key)
        merged.append(row)
        if len(merged) >= max_limit:
            break

    known_labels = set(list_market_instruments(market, custom_assets))
    for row in merged:
        row["exists_in_catalog"] = row.get("label") in known_labels

    return merged


def _invert_ohlc(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return frame

    out = frame.copy()
    open_values = out["open"].replace(0, pd.NA)
    high_values = out["high"].replace(0, pd.NA)
    low_values = out["low"].replace(0, pd.NA)
    close_values = out["close"].replace(0, pd.NA)

    out["open"] = 1 / open_values
    out["close"] = 1 / close_values
    out["high"] = 1 / low_values
    out["low"] = 1 / high_values

    out = out.replace([np.inf, -np.inf], np.nan)
    return out.dropna(how="all")


def _apply_frequency(frame: pd.DataFrame, freq: str) -> pd.DataFrame:
    frame = frame.sort_index()
    if frame.empty:
        return frame

    if freq in {"D", "B"}:
        out = frame.asfreq(freq)
        out[["open", "high", "low", "close"]] = out[["open", "high", "low", "close"]].ffill()
    elif freq == "W":
        out = frame.resample("W-FRI").agg(
            {
                "open": "first",
                "high": "max",
                "low": "min",
                "close": "last",
            }
        )
        out = out.ffill()
    elif freq == "M":
        out = frame.resample("ME").agg(
            {
                "open": "first",
                "high": "max",
                "low": "min",
                "close": "last",
            }
        )
        out = out.ffill()
    else:
        raise ValueError("La frecuencia debe ser D, B, W o M")

    for col in ["open", "high", "low"]:
        out[col] = out[col].fillna(out["close"])

    return out[out["close"].notna()]


def _slice_dates(frame: pd.DataFrame, start: str, end: str) -> pd.DataFrame:
    if frame.empty:
        return frame
    start_dt = pd.to_datetime(start)
    end_dt = pd.to_datetime(end)
    return frame.loc[(frame.index >= start_dt) & (frame.index <= end_dt)]


def get_indices_frame(
    label: str,
    start: str,
    end: str,
    freq: str,
    fred_key: str,
    asset_map: AssetMap | None = None,
) -> tuple[pd.DataFrame, str]:
    effective_map = asset_map or build_indices_asset_map()
    meta = effective_map.get(label)
    if meta is None:
        return _empty_ohlc_frame(), ""

    src = meta["src"]
    symbol = meta["id"]

    if src == "fred":
        close = fetch_fred_close(symbol, start, end, fred_key)
        if close.empty:
            return _empty_ohlc_frame(), symbol
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
        return _empty_ohlc_frame(), symbol

    frame = _slice_dates(frame, start, end)
    frame = _apply_frequency(frame, freq)
    return frame, symbol


def get_currency_frame(pair: str, start: str, end: str, freq: str) -> tuple[pd.DataFrame, str]:
    candidates = CURRENCY_CANDIDATES.get(pair, [])
    if not candidates:
        return _empty_ohlc_frame(), ""

    for ticker, invert in candidates:
        frame = fetch_yahoo_ohlc(ticker, start, end)
        if frame.empty:
            continue

        if invert:
            frame = _invert_ohlc(frame)

        frame = _slice_dates(frame, start, end)
        frame = _apply_frequency(frame, freq)
        if frame.empty:
            continue

        return frame, ticker

    return _empty_ohlc_frame(), ""


def get_asset_frame(
    market: MarketCode,
    instrument: str,
    start: str,
    end: str,
    freq: str,
    fred_key: str,
    indices_asset_map: AssetMap | None = None,
) -> tuple[pd.DataFrame, str]:
    if market == "indices_etfs":
        return get_indices_frame(instrument, start, end, freq, fred_key, indices_asset_map)
    return get_currency_frame(instrument, start, end, freq)


def fetch_all_assets(
    market: MarketCode,
    labels: list[str],
    start: str,
    end: str,
    freq: str,
    fred_key: str,
    custom_assets: list[dict[str, str]] | None = None,
    progress_hook: ProgressHook | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame, list[str], dict[str, str]]:
    series_map: dict[str, pd.Series] = {}
    snapshot_rows: list[dict[str, Any]] = []
    failures: list[str] = []
    resolved_symbols: dict[str, str] = {}
    source_map: dict[str, str] = {}
    indices_asset_map = build_indices_asset_map(custom_assets) if market == "indices_etfs" else None

    total = len(labels)
    for index, label in enumerate(labels, start=1):
        if progress_hook:
            progress_hook(index - 1, total, label, "fetching")

        frame, resolved_symbol = get_asset_frame(
            market=market,
            instrument=label,
            start=start,
            end=end,
            freq=freq,
            fred_key=fred_key,
            indices_asset_map=indices_asset_map,
        )

        close = frame["close"].dropna() if "close" in frame.columns else pd.Series(dtype=float)
        if close.empty:
            failures.append(label)
            if progress_hook:
                progress_hook(index, total, label, "failed")
            continue

        resolved_symbols[label] = resolved_symbol
        if market == "indices_etfs" and indices_asset_map:
            source_map[label] = str(indices_asset_map.get(label, {}).get("src", ""))
        else:
            source_map[label] = "yahoo_fx"
        series_map[label] = close.rename(label)

        latest_date = close.index[-1]
        latest_row = frame.loc[latest_date]
        prev_close = close.iloc[-2] if close.size > 1 else float("nan")
        change_pct = (
            (close.iloc[-1] / prev_close - 1.0) * 100
            if pd.notna(prev_close) and prev_close != 0
            else float("nan")
        )

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
                "Symbol": resolved_symbol,
                "Source": source_map.get(label, ""),
            }
        )
        if progress_hook:
            progress_hook(index, total, label, "loaded")

    if not series_map:
        return pd.DataFrame(), pd.DataFrame(), failures, resolved_symbols

    base_df = pd.concat(series_map.values(), axis=1).sort_index().round(DECIMALS)
    snapshot_df = pd.DataFrame(snapshot_rows)
    if not snapshot_df.empty:
        snapshot_df = snapshot_df.sort_values("Cambio %", ascending=False, na_position="last").reset_index(drop=True)

    return base_df, snapshot_df, failures, resolved_symbols


def _effective_inversion(
    labels: list[str],
    invert_global: bool,
    inverted_labels: set[str] | None,
) -> dict[str, bool]:
    manual = set(inverted_labels or set())
    return {
        label: ((label not in manual) if invert_global else (label in manual))
        for label in labels
    }


def build_view_df(
    base_df: pd.DataFrame,
    included: list[str],
    invert_global: bool = False,
    inverted_labels: set[str] | None = None,
    market: MarketCode = DEFAULT_MARKET,
) -> pd.DataFrame:
    if base_df.empty or not included:
        return pd.DataFrame()

    labels = [label for label in included if label in base_df.columns]
    if not labels:
        return pd.DataFrame()

    inversion_map = _effective_inversion(labels, invert_global, inverted_labels)
    series_list: list[pd.Series] = []

    for label in labels:
        series = base_df[label].copy()
        out_label = label
        if inversion_map.get(label, False):
            series = 1 / series.replace(0, pd.NA)
            if market == "monedas":
                out_label = flip_pair(label)
        series_list.append(series.rename(out_label))

    if not series_list:
        return pd.DataFrame()

    return pd.concat(series_list, axis=1).round(DECIMALS)


def build_snapshot_view(
    snapshot_df: pd.DataFrame,
    invert_global: bool,
    inverted_labels: set[str] | None = None,
    market: MarketCode = DEFAULT_MARKET,
) -> pd.DataFrame:
    if snapshot_df.empty:
        return snapshot_df

    data = snapshot_df.copy()
    labels = data["Instrumento"].astype(str).tolist()
    inversion_map = _effective_inversion(labels, invert_global, inverted_labels)
    effective_mask = data["Instrumento"].astype(str).map(inversion_map).fillna(False)

    if effective_mask.any():
        open_values = data.loc[effective_mask, "Apertura"].replace(0, pd.NA)
        high_values = data.loc[effective_mask, "Maximo"].replace(0, pd.NA)
        low_values = data.loc[effective_mask, "Minimo"].replace(0, pd.NA)
        close_values = data.loc[effective_mask, "Cierre"].replace(0, pd.NA)
        prev_values = data.loc[effective_mask, "PrevClose"].replace(0, pd.NA)

        data.loc[effective_mask, "Apertura"] = 1 / open_values
        data.loc[effective_mask, "Maximo"] = 1 / low_values
        data.loc[effective_mask, "Minimo"] = 1 / high_values
        data.loc[effective_mask, "Cierre"] = 1 / close_values
        data.loc[effective_mask, "PrevClose"] = 1 / prev_values

        valid_rows = effective_mask & data["PrevClose"].notna() & (data["PrevClose"] != 0)
        data.loc[effective_mask, "Cambio %"] = float("nan")
        data.loc[valid_rows, "Cambio %"] = (
            data.loc[valid_rows, "Cierre"] / data.loc[valid_rows, "PrevClose"] - 1.0
        ) * 100

        if market == "monedas":
            data.loc[effective_mask, "Instrumento"] = data.loc[effective_mask, "Instrumento"].map(flip_pair)

    data["isInverted"] = effective_mask.astype(bool)

    if "Cambio %" in data.columns:
        data = data.sort_values("Cambio %", ascending=False, na_position="last").reset_index(drop=True)

    return data


def to_excel_bytes(
    view_df: pd.DataFrame,
    included: list[str],
    snapshot_df: pd.DataFrame,
    meta: dict[str, Any],
    market: MarketCode,
    resolved_symbols: dict[str, str] | None = None,
    custom_assets: list[dict[str, str]] | None = None,
) -> bytes:
    symbol_map = resolved_symbols or {}
    indices_asset_map = build_indices_asset_map(custom_assets) if market == "indices_etfs" else {}

    metadata_rows = []
    for label in included:
        if market == "indices_etfs":
            asset_meta = indices_asset_map.get(label, {})
            metadata_rows.append(
                {
                    "Instrumento": label,
                    "Fuente": asset_meta.get("src", ""),
                    "Simbolo": asset_meta.get("id", symbol_map.get(label, "")),
                }
            )
        else:
            metadata_rows.append(
                {
                    "Instrumento": label,
                    "Fuente": "yahoo_fx",
                    "Simbolo": symbol_map.get(label, _currency_symbol(label)),
                }
            )

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        view_df.to_excel(writer, sheet_name="Datos")
        pd.DataFrame(metadata_rows).to_excel(writer, sheet_name="Activos", index=False)
        if not snapshot_df.empty:
            snapshot_df.drop(columns=["PrevClose", "isInverted"], errors="ignore").to_excel(
                writer,
                sheet_name="Snapshot",
                index=False,
            )
        pd.DataFrame(
            [
                {
                    "mercado": market,
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


def dataframe_to_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    if frame.empty:
        return []

    out = frame.copy().sort_index()
    out.index = pd.to_datetime(out.index).strftime("%Y-%m-%d")
    out = out.reset_index()
    first_col = out.columns[0]
    out = out.rename(columns={first_col: "date"})
    out = out.replace({np.nan: None})
    return out.to_dict(orient="records")


def snapshot_to_records(snapshot_df: pd.DataFrame) -> list[dict[str, Any]]:
    if snapshot_df.empty:
        return []

    out = snapshot_df.copy()
    date_col = pd.to_datetime(out.get("Fecha"), errors="coerce")
    out["Fecha"] = date_col.dt.strftime("%Y-%m-%d")

    renamed = out.rename(
        columns={
            "Fecha": "date",
            "Instrumento": "instrument",
            "Apertura": "open",
            "Maximo": "high",
            "Minimo": "low",
            "Cierre": "close",
            "PrevClose": "prev_close",
            "Cambio %": "change_pct",
            "Symbol": "symbol",
            "Source": "source",
        }
    )

    if "isInverted" not in renamed.columns:
        renamed["isInverted"] = False

    renamed = renamed.replace({np.nan: None})
    records = renamed.to_dict(orient="records")
    for row in records:
        row["isInverted"] = bool(row.get("isInverted", False))
    return records


def _to_history_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    if frame.empty:
        return []

    data = frame.copy().sort_index().replace({np.nan: None})
    records: list[dict[str, Any]] = []

    for ts, row in data.iterrows():
        records.append(
            {
                "date": pd.to_datetime(ts).strftime("%Y-%m-%d"),
                "open": None if row.get("open") is None else float(row.get("open")),
                "high": None if row.get("high") is None else float(row.get("high")),
                "low": None if row.get("low") is None else float(row.get("low")),
                "close": None if row.get("close") is None else float(row.get("close")),
            }
        )

    return records


def _safe_float_or_none(value: Any) -> float | None:
    if value is None:
        return None
    try:
        out = float(value)
    except Exception:
        return None
    if not np.isfinite(out):
        return None
    return out


def get_detail_payload(
    market: MarketCode,
    instrument: str,
    start: str,
    end: str,
    freq: str,
    exclude_weekends: bool,
    fred_key: str,
    invert: bool = False,
    custom_assets: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    effective_freq = "B" if (freq == "D" and exclude_weekends) else freq
    indices_asset_map = build_indices_asset_map(custom_assets) if market == "indices_etfs" else None

    frame, symbol = get_asset_frame(
        market=market,
        instrument=instrument,
        start=start,
        end=end,
        freq=effective_freq,
        fred_key=fred_key,
        indices_asset_map=indices_asset_map,
    )
    if frame.empty:
        raise ValueError("No se encontraron datos para el instrumento solicitado")

    display_instrument = instrument
    if invert:
        frame = _invert_ohlc(frame)
        if market == "monedas":
            display_instrument = flip_pair(instrument)

    close = frame["close"].dropna()
    if close.empty:
        raise ValueError("No hay cierres disponibles para construir el detalle")

    latest_date = close.index[-1]
    latest_row = frame.loc[latest_date]
    prev_close = close.iloc[-2] if close.size > 1 else float("nan")

    change = close.iloc[-1] - prev_close if pd.notna(prev_close) else float("nan")
    change_pct = (
        (close.iloc[-1] / prev_close - 1.0) * 100
        if pd.notna(prev_close) and prev_close != 0
        else float("nan")
    )

    # 52-week range computed from last ~370 days up to latest known date.
    start_52 = (pd.to_datetime(latest_date) - pd.Timedelta(days=370)).strftime("%Y-%m-%d")
    end_52 = pd.to_datetime(latest_date).strftime("%Y-%m-%d")
    frame_52, _ = get_asset_frame(
        market=market,
        instrument=instrument,
        start=start_52,
        end=end_52,
        freq="B",
        fred_key=fred_key,
        indices_asset_map=indices_asset_map,
    )
    if invert and not frame_52.empty:
        frame_52 = _invert_ohlc(frame_52)

    close_52 = frame_52["close"].dropna() if not frame_52.empty else close

    low_52 = close_52.min() if not close_52.empty else float("nan")
    high_52 = close_52.max() if not close_52.empty else float("nan")

    if market == "monedas":
        source = "yahoo_fx"
    else:
        source = (indices_asset_map or {}).get(instrument, {}).get("src", "")

    return {
        "market": market,
        "instrument": instrument,
        "display_instrument": display_instrument,
        "source": source,
        "symbol": symbol,
        "is_inverted": bool(invert),
        "as_of": pd.to_datetime(latest_date).strftime("%Y-%m-%d"),
        "quote": {
            "price": _safe_float_or_none(close.iloc[-1]),
            "change": _safe_float_or_none(change),
            "change_pct": _safe_float_or_none(change_pct),
            "prev_close": _safe_float_or_none(prev_close),
        },
        "stats": {
            "open": _safe_float_or_none(latest_row.get("open")),
            "high": _safe_float_or_none(latest_row.get("high")),
            "low": _safe_float_or_none(latest_row.get("low")),
            "day_range": [
                _safe_float_or_none(latest_row.get("low")),
                _safe_float_or_none(latest_row.get("high")),
            ],
            "week_52_range": [_safe_float_or_none(low_52), _safe_float_or_none(high_52)],
            "volume": None,
            "avg_volume": None,
        },
        "history": _to_history_records(frame),
        "meta": {
            "sdate": start,
            "edate": end,
            "freq": effective_freq,
        },
    }
