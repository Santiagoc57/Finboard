import asyncio
import os
import threading
from datetime import datetime, timezone
from queue import Queue
from typing import Any
import numpy as np

from fastapi import FastAPI, HTTPException, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import DEFAULT_MARKET, MarketCode
from .schemas import (
    DetailRequest,
    ExportRequest,
    FetchRequest,
    SettingsUpdateRequest,
    ChatRequest,
)
from .services.market_data import (
    ProgressHook,
    build_snapshot_view,
    build_view_df,
    dataframe_to_records,
    get_detail_payload,
    get_market_catalog,
    fetch_all_assets,
    list_market_instruments,
    search_market_instruments,
    snapshot_to_records,
    to_excel_bytes,
)
from .services.fetch_cache import (
    build_fetch_cache_key,
    clear_fetch_cache,
    get_fetch_cache,
    set_fetch_cache,
)
from .services.settings_store import (
    build_settings_payload,
    get_runtime_fred_key,
    set_runtime_fred_key,
    get_runtime_gemini_key,
    set_runtime_gemini_key,
)

import google.generativeai as genai

app = FastAPI(title="FinBoard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# WebSocket connection manager for real-time market data
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self._active: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._active.append(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._active = [c for c in self._active if c is not ws]

    async def send(self, ws: WebSocket, data: dict) -> None:
        try:
            await ws.send_json(data)
        except Exception:
            await self.disconnect(ws)


_ws_manager = ConnectionManager()


@app.websocket("/ws/market_data")
async def ws_market_data(ws: WebSocket) -> None:
    """
    Real-time market snapshot stream.

    Client sends once on connect:
        { "market": "indices_etfs", "assets": [...], "frequency": "D",
          "exclude_weekends": true, "custom_assets": [] }

    Server pushes every ~30 s:
        { "type": "snapshot", "ts": "...", "rows": [...snapshot_rows...] }
    or
        { "type": "error", "message": "..." }
    """
    await _ws_manager.connect(ws)
    loop = asyncio.get_event_loop()
    subscription: dict | None = None

    async def push_snapshot() -> None:
        if not subscription:
            return
        try:
            fred_key = _resolve_fred_key()
            market = subscription.get("market", DEFAULT_MARKET)
            labels = subscription.get("assets", [])
            freq_raw = subscription.get("frequency", "D")
            exclude = subscription.get("exclude_weekends", True)
            custom = _normalize_custom_assets(subscription.get("custom_assets", []))
            effective_freq = "B" if (freq_raw == "D" and exclude) else freq_raw

            from datetime import date, timedelta
            end = date.today().strftime("%Y-%m-%d")
            start = (date.today() - timedelta(days=7)).strftime("%Y-%m-%d")

            _, snapshot_df, _, _ = await loop.run_in_executor(
                None,
                lambda: fetch_all_assets(
                    market=market,
                    labels=labels,
                    start=start,
                    end=end,
                    freq=effective_freq,
                    fred_key=fred_key,
                    custom_assets=custom,
                ),
            )
            rows = snapshot_to_records(snapshot_df)
            await _ws_manager.send(ws, {
                "type": "snapshot",
                "ts": datetime.now(timezone.utc).strftime("%H:%M:%S UTC"),
                "rows": rows,
            })
        except Exception as exc:
            await _ws_manager.send(ws, {"type": "error", "message": str(exc)})

    try:
        # First message is the subscription payload
        raw = await ws.receive_json()
        subscription = raw
        print(f"WS SUBSCRIBE: {subscription}")
        # Immediately send first snapshot
        await push_snapshot()
        # Then push every 30 s
        while True:
            await asyncio.sleep(30)
            await push_snapshot()
    except WebSocketDisconnect:
        pass
    finally:
        await _ws_manager.disconnect(ws)


def _resolve_fred_key() -> str:
    runtime_key = get_runtime_fred_key()
    if runtime_key:
        return runtime_key
    return os.getenv("FRED_KEY", "")

def _resolve_gemini_key() -> str:
    runtime_key = get_runtime_gemini_key()
    if runtime_key:
        return runtime_key
    return os.getenv("GEMINI_API_KEY", "")

def _normalize_custom_assets(rows: list) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for row in rows:
        if isinstance(row, dict):
            out.append(
                {
                    "label": str(row.get("label", "")),
                    "source": str(row.get("source", "")),
                    "symbol": str(row.get("symbol", "")),
                }
            )
        else:
            out.append({"label": row.label, "source": row.source, "symbol": row.symbol})
    return out


def _validate_assets(
    market: MarketCode,
    assets: list[str],
    custom_assets: list[dict[str, str]] | None = None,
) -> list[str]:
    valid_assets = set(list_market_instruments(market, custom_assets))
    invalid = [item for item in assets if item not in valid_assets]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Instrumentos no reconocidos: {', '.join(invalid)}")
    return list(dict.fromkeys(assets))


def _meta_payload(payload: FetchRequest, effective_freq: str) -> dict[str, str]:
    return {
        "market": payload.market,
        "sdate": payload.start_date.strftime("%Y-%m-%d"),
        "edate": payload.end_date.strftime("%Y-%m-%d"),
        "freq": effective_freq,
        "preset": payload.preset,
        "last_update_utc": datetime.now(timezone.utc).strftime("%H:%M:%S UTC"),
    }


def _build_fetch_response(
    payload: FetchRequest,
    progress_hook: ProgressHook | None = None,
) -> tuple[dict[str, Any], bool]:
    if payload.start_date > payload.end_date:
        raise HTTPException(status_code=400, detail="La fecha inicial no puede ser mayor que la final")

    custom_assets = _normalize_custom_assets(payload.custom_assets)
    selected_assets = _validate_assets(payload.market, payload.assets, custom_assets)
    fred_key = _resolve_fred_key()
    effective_freq = "B" if (payload.frequency == "D" and payload.exclude_weekends) else payload.frequency

    cache_key = build_fetch_cache_key(
        market=payload.market,
        start_date=payload.start_date.strftime("%Y-%m-%d"),
        end_date=payload.end_date.strftime("%Y-%m-%d"),
        effective_freq=effective_freq,
        exclude_weekends=payload.exclude_weekends,
        preset=payload.preset,
        assets=selected_assets,
        included_assets=payload.included_assets,
        invert_global=payload.invert_global,
        inverted_assets=payload.inverted_assets,
        custom_assets=custom_assets,
        fred_key=fred_key,
    )
    cached = get_fetch_cache(cache_key)
    if cached is not None:
        return cached, True

    base_df, snapshot_df, failures, resolved_symbols = fetch_all_assets(
        market=payload.market,
        labels=selected_assets,
        start=payload.start_date.strftime("%Y-%m-%d"),
        end=payload.end_date.strftime("%Y-%m-%d"),
        freq=effective_freq,
        fred_key=fred_key,
        custom_assets=custom_assets,
        progress_hook=progress_hook,
    )

    if base_df.empty:
        response_payload = {
            "meta": _meta_payload(payload, effective_freq),
            "failures": failures,
            "resolved_symbols": resolved_symbols,
            "assets_loaded": [],
            "included_assets": [],
            "base_rows": [],
            "view_rows": [],
            "snapshot_rows_raw": [],
            "snapshot_rows": [],
        }
        set_fetch_cache(cache_key, response_payload)
        return response_payload, False

    assets_loaded = list(base_df.columns)
    included_assets = payload.included_assets or assets_loaded
    included_assets = [label for label in included_assets if label in assets_loaded]
    if not included_assets:
        included_assets = assets_loaded

    view_df = build_view_df(
        base_df,
        included_assets,
        invert_global=payload.invert_global,
        inverted_labels=set(payload.inverted_assets),
        market=payload.market,
    )

    snapshot_rows_raw = snapshot_to_records(snapshot_df)
    snapshot_view = build_snapshot_view(
        snapshot_df,
        invert_global=payload.invert_global,
        inverted_labels=set(payload.inverted_assets),
        market=payload.market,
    )
    snapshot_rows = snapshot_to_records(snapshot_view)

    response_payload = {
        "meta": _meta_payload(payload, effective_freq),
        "failures": failures,
        "resolved_symbols": resolved_symbols,
        "assets_loaded": assets_loaded,
        "included_assets": included_assets,
        "base_rows": dataframe_to_records(base_df),
        "view_rows": dataframe_to_records(view_df),
        "snapshot_rows_raw": snapshot_rows_raw,
        "snapshot_rows": snapshot_rows,
    }
    set_fetch_cache(cache_key, response_payload)
    return response_payload, False


def _sse_event(event: str, payload: dict[str, Any]) -> str:
    import json

    return f"event: {event}\\ndata: {json.dumps(payload, ensure_ascii=True)}\\n\\n"


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "service": "finboard-api"}


@app.get("/api/settings")
def get_settings() -> dict:
    env_fred = os.getenv("FRED_KEY", "")
    runtime_fred = get_runtime_fred_key()
    env_gemini = os.getenv("GEMINI_API_KEY", "")
    runtime_gemini = get_runtime_gemini_key()
    return build_settings_payload(env_fred, runtime_fred, env_gemini, runtime_gemini)


@app.post("/api/settings")
def update_settings(payload: SettingsUpdateRequest) -> dict:
    set_runtime_fred_key(payload.fred_key)
    set_runtime_gemini_key(payload.gemini_key)
    clear_fetch_cache()
    
    env_fred = os.getenv("FRED_KEY", "")
    runtime_fred = get_runtime_fred_key()
    env_gemini = os.getenv("GEMINI_API_KEY", "")
    runtime_gemini = get_runtime_gemini_key()
    
    result = build_settings_payload(env_fred, runtime_fred, env_gemini, runtime_gemini)
    result["message"] = "Ajustes guardados"
    return result


@app.get("/api/assets")
def assets(market: MarketCode = DEFAULT_MARKET) -> dict:
    return {"market": market, "assets": get_market_catalog(market)}


@app.get("/api/instrument-search")
def instrument_search(q: str, market: MarketCode = DEFAULT_MARKET, limit: int = 12) -> dict:
    query = q.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Ingresa un texto para buscar instrumentos")

    effective_limit = max(1, min(limit, 30))
    fred_key = _resolve_fred_key()
    results = search_market_instruments(
        market=market,
        query=query,
        fred_key=fred_key,
        limit=effective_limit,
    )
    warnings: list[str] = []
    if market == "indices_etfs" and not fred_key:
        warnings.append("Sin FRED key configurada: solo se muestran coincidencias de Yahoo.")
    if market != "indices_etfs":
        warnings.append("La busqueda dinamica esta disponible para Indices/ETFs.")

    return {
        "market": market,
        "query": query,
        "count": len(results),
        "results": results,
        "warnings": warnings,
    }


@app.post("/api/fetch")
def fetch(payload: FetchRequest) -> dict:
    print(f"API FETCH: {payload.market}, {len(payload.assets)} assets")
    response_payload, _ = _build_fetch_response(payload)
    print(f"API FETCH SUCCESS: {payload.market}")
    return response_payload


@app.post("/api/fetch/stream")
def fetch_stream(payload: FetchRequest) -> StreamingResponse:
    print(f"API FETCH STREAM: {payload.market}")
    def event_generator():
        event_queue: Queue[dict[str, Any]] = Queue()
        result_holder: dict[str, Any] = {}
        error_holder: dict[str, Exception] = {}

        def on_progress(current: int, total: int, label: str, status: str) -> None:
            event_queue.put(
                {
                    "current": current,
                    "total": total,
                    "label": label,
                    "status": status,
                }
            )

        def worker() -> None:
            try:
                response_payload, cache_hit = _build_fetch_response(payload, progress_hook=on_progress)
                result_holder["response"] = response_payload
                result_holder["cache_hit"] = cache_hit
            except Exception as exc:  # pragma: no cover - emitted as stream error
                error_holder["error"] = exc
            finally:
                event_queue.put({"done": True})

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()

        yield _sse_event("progress", {"percent": 3, "stage": "Validando parametros..."})
        last_percent = 3

        while True:
            item = event_queue.get()
            if item.get("done"):
                break

            current = int(item.get("current", 0))
            total = max(1, int(item.get("total", 1)))
            label = str(item.get("label", "")).strip()
            status = str(item.get("status", "")).strip().lower()

            percent = max(last_percent, min(92, 10 + int((current / total) * 80)))
            last_percent = percent

            if status == "fetching":
                stage = f"Consultando {label}..."
            elif status == "loaded":
                stage = f"Cargado {label} ({current}/{total})"
            elif status == "failed":
                stage = f"Sin datos {label} ({current}/{total})"
            else:
                stage = "Procesando instrumentos..."

            yield _sse_event(
                "progress",
                {
                    "percent": percent,
                    "stage": stage,
                    "status": status,
                    "current": current,
                    "total": total,
                    "label": label,
                },
            )

        if "error" in error_holder:
            exc = error_holder["error"]
            if isinstance(exc, HTTPException):
                message = str(exc.detail)
            else:
                message = str(exc)
            yield _sse_event("error", {"message": message})
            return

        response_payload = result_holder.get("response", {})
        cache_hit = bool(result_holder.get("cache_hit", False))
        yield _sse_event(
            "progress",
            {
                "percent": 97,
                "stage": "Construyendo vista final..." if not cache_hit else "Aplicando resultados en cache...",
                "status": "finalizing",
            },
        )
        yield _sse_event("result", {"response": response_payload, "cache_hit": cache_hit})
        yield _sse_event(
            "progress",
            {
                "percent": 100,
                "stage": "Actualizacion completada",
                "status": "completed",
            },
        )
        yield _sse_event("complete", {"ok": True})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/export")
def export_excel(payload: ExportRequest) -> Response:
    if payload.start_date > payload.end_date:
        raise HTTPException(status_code=400, detail="La fecha inicial no puede ser mayor que la final")

    custom_assets = _normalize_custom_assets(payload.custom_assets)
    selected_assets = _validate_assets(payload.market, payload.assets, custom_assets)
    fred_key = _resolve_fred_key()
    effective_freq = "B" if (payload.frequency == "D" and payload.exclude_weekends) else payload.frequency

    base_df, snapshot_df, failures, resolved_symbols = fetch_all_assets(
        market=payload.market,
        labels=selected_assets,
        start=payload.start_date.strftime("%Y-%m-%d"),
        end=payload.end_date.strftime("%Y-%m-%d"),
        freq=effective_freq,
        fred_key=fred_key,
        custom_assets=custom_assets,
    )

    if base_df.empty:
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo generar exportación. Fallos: {', '.join(failures) if failures else 'sin datos'}",
        )

    assets_loaded = list(base_df.columns)
    included_assets = payload.included_assets or assets_loaded
    included_assets = [label for label in included_assets if label in assets_loaded]
    if not included_assets:
        included_assets = assets_loaded

    view_df = build_view_df(
        base_df,
        included_assets,
        invert_global=payload.invert_global,
        inverted_labels=set(payload.inverted_assets),
        market=payload.market,
    )
    snapshot_view = build_snapshot_view(
        snapshot_df,
        invert_global=payload.invert_global,
        inverted_labels=set(payload.inverted_assets),
        market=payload.market,
    )

    meta = {
        "market": payload.market,
        "sdate": payload.start_date.strftime("%Y-%m-%d"),
        "edate": payload.end_date.strftime("%Y-%m-%d"),
        "freq": effective_freq,
        "preset": payload.preset,
        "last_update_utc": datetime.now(timezone.utc).strftime("%H:%M:%S UTC"),
    }

    xlsx = to_excel_bytes(
        view_df,
        included_assets,
        snapshot_view,
        meta,
        market=payload.market,
        resolved_symbols=resolved_symbols,
        custom_assets=custom_assets,
    )
    filename = payload.filename or (
        f"{payload.market}_view_{effective_freq}_{meta['sdate']}_to_{meta['edate']}.xlsx"
    )

    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/detail")
def detail(payload: DetailRequest) -> dict:
    if payload.start_date > payload.end_date:
        raise HTTPException(status_code=400, detail="La fecha inicial no puede ser mayor que la final")

    custom_assets: list[dict[str, str]] = []
    if payload.custom_source and payload.custom_symbol:
        custom_assets.append(
            {
                "label": payload.instrument,
                "source": payload.custom_source,
                "symbol": payload.custom_symbol,
            }
        )

    _validate_assets(payload.market, [payload.instrument], custom_assets)
    fred_key = _resolve_fred_key()

    try:
        detail_payload = get_detail_payload(
            market=payload.market,
            instrument=payload.instrument,
            start=payload.start_date.strftime("%Y-%m-%d"),
            end=payload.end_date.strftime("%Y-%m-%d"),
            freq=payload.frequency,
            exclude_weekends=payload.exclude_weekends,
            fred_key=fred_key,
            invert=payload.invert,
            custom_assets=custom_assets,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    detail_payload["last_update_utc"] = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
    return detail_payload


@app.post("/api/chat")
def chat_assistant(payload: ChatRequest) -> dict:
    gemini_key = _resolve_gemini_key()
    if not gemini_key:
        raise HTTPException(
            status_code=401,
            detail="La llave de Gemini (GEMINI_API_KEY) no está configurada. Agrégala en Ajustes para usar la IA."
        )

    import json
    
    context_parts = []
    if payload.rows:
        context_parts.append(f"PRECIOS Y EVOLUCIÓN:\\n{json.dumps(payload.rows, ensure_ascii=False)}")
    if payload.risk_metrics:
        context_parts.append(f"RIESGO (Sharpe, Drawdown):\\n{json.dumps(payload.risk_metrics, ensure_ascii=False)}")
    if payload.markowitz_points:
        context_parts.append(f"MARKOWITZ (Frontera Eficiente):\\n{json.dumps(payload.markowitz_points, ensure_ascii=False)}")
    
    # Fallback to old context_data if new ones are empty
    if not context_parts and payload.context_data:
        context_parts.append(json.dumps(payload.context_data, ensure_ascii=False))
        
    context_str = "\\n---\\n".join(context_parts)
    
    system_instruction = (
        "Eres el asistente IA financiero de FinBoard. "
        f"El mercado actual es '{payload.market}' y la vista es '{payload.context_type}'. "
        "Analiza los datos adjuntos para responder preguntas sobre evolución, riesgo o de optimización de portafolio. "
        "Tus respuestas deben ser concisas, en español y con formato markdown."
    )
    
    full_prompt = (
        f"{system_instruction}\\n\\n"
        f"--- DATOS DEL TABLERO ---\\n{context_str}\\n------------------------\\n\\n"
        f"Pregunta del usuario: {payload.prompt}"
    )

    try:
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(full_prompt)
        return {"response": response.text}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al consultar Gemini: {str(exc)}")


@app.post("/api/risk-metrics")
def risk_metrics(payload: FetchRequest) -> dict:
    """Compute per-instrument risk metrics: Sharpe Ratio and Max Drawdown."""
    if payload.start_date > payload.end_date:
        raise HTTPException(status_code=400, detail="La fecha inicial no puede ser mayor que la final")

    custom_assets = _normalize_custom_assets(payload.custom_assets)
    selected_assets = _validate_assets(payload.market, payload.assets, custom_assets)
    fred_key = _resolve_fred_key()
    effective_freq = "B" if (payload.frequency == "D" and payload.exclude_weekends) else payload.frequency

    base_df, _, _, _ = fetch_all_assets(
        market=payload.market,
        labels=selected_assets,
        start=payload.start_date.strftime("%Y-%m-%d"),
        end=payload.end_date.strftime("%Y-%m-%d"),
        freq=effective_freq,
        fred_key=fred_key,
        custom_assets=custom_assets,
    )

    if base_df.empty:
        return {"metrics": []}

    RISK_FREE_RATE = 0.02  # 2% annual risk-free rate
    results = []

    for col in base_df.columns:
        series = base_df[col].dropna()
        if len(series) < 2:
            results.append({"instrument": col, "sharpe": None, "max_drawdown": None})
            continue

        daily_returns = series.pct_change().dropna()

        # Annualized Sharpe
        mean_r = float(daily_returns.mean()) * 252
        std_r  = float(daily_returns.std())  * np.sqrt(252)
        sharpe = round((mean_r - RISK_FREE_RATE) / std_r, 3) if std_r > 0 else None

        # Max Drawdown: (trough / peak) - 1
        cumulative = (1 + daily_returns).cumprod()
        rolling_max = cumulative.cummax()
        drawdown = (cumulative - rolling_max) / rolling_max
        max_drawdown = round(float(drawdown.min()) * 100, 2)  # as percentage

        results.append({
            "instrument": col,
            "sharpe": sharpe,
            "max_drawdown": max_drawdown,
        })

    return {"metrics": results}


@app.post("/api/markowitz")
def markowitz_efficient_frontier(payload: FetchRequest) -> dict:
    if payload.start_date > payload.end_date:
        raise HTTPException(status_code=400, detail="La fecha inicial no puede ser mayor que la final")

    from .main import _normalize_custom_assets, _validate_assets, _resolve_fred_key
    custom_assets = _normalize_custom_assets(payload.custom_assets)
    selected_assets = _validate_assets(payload.market, payload.assets, custom_assets)
    fred_key = _resolve_fred_key()
    effective_freq = "B" if (payload.frequency == "D" and payload.exclude_weekends) else payload.frequency

    base_df, _, _, _ = fetch_all_assets(
        market=payload.market,
        labels=selected_assets,
        start=payload.start_date.strftime("%Y-%m-%d"),
        end=payload.end_date.strftime("%Y-%m-%d"),
        freq=effective_freq,
        fred_key=fred_key,
        custom_assets=custom_assets,
    )

    if base_df.empty or len(base_df.columns) < 2:
        raise HTTPException(status_code=400, detail="Se requieren al menos 2 instrumentos con datos para calcular Markowitz")

    # Calcula matriz de covarianza y retornos
    returns = base_df.pct_change().dropna()
    if returns.empty:
        raise HTTPException(status_code=400, detail="No hay suficientes datos superpuestos para calcular retornos diarios.")
        
    mean_returns = returns.mean() * 252 # Anualizado
    cov_matrix = returns.cov() * 252

    num_portfolios = 2500
    num_assets = len(base_df.columns)

    np.random.seed(42)  # Reproducibility
    
    # Store random weights
    weights_record = np.random.random((num_portfolios, num_assets))
    # Normalize weights so they sum to 1
    weights_record /= np.sum(weights_record, axis=1)[:, np.newaxis]
    
    # Expected returns
    port_returns = np.sum(mean_returns.values * weights_record, axis=1)
    
    # Expected volatility
    # einsum is very fast for calculating inner products for multiple weights against a covariance matrix
    port_vols = np.sqrt(np.einsum('ij,ji->i', np.dot(weights_record, cov_matrix.values), weights_record.T))
    
    # Sharpe ratio (risk-free rate = 0 for simplicity)
    port_sharpes = port_returns / port_vols

    max_sharpe_idx = int(np.argmax(port_sharpes))
    min_vol_idx = int(np.argmin(port_vols))

    scatter_points = []
    assets_list = list(base_df.columns)
    
    for i in range(num_portfolios):
        w_dict = {assets_list[j]: round(float(weights_record[i][j]) * 100, 2) for j in range(num_assets)}
        is_max_sharpe = (i == max_sharpe_idx)
        is_min_vol = (i == min_vol_idx)
        
        tipo = "Random"
        if is_max_sharpe:
            tipo = "Max Sharpe"
        elif is_min_vol:
            tipo = "Min Volatilidad"

        scatter_points.append({
            "retorno": round(float(port_returns[i]) * 100, 2),
            "volatilidad": round(float(port_vols[i]) * 100, 2),
            "sharpe": round(float(port_sharpes[i]), 3),
            "pesos": w_dict,
            "tipo": tipo
        })

    return {
        "puntos": scatter_points,
    }
