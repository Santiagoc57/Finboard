/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";

import { AiAssistant } from "@/components/AiAssistant";
import { ChipRow } from "@/components/ChipRow";
import { OpaSummaryTable } from "@/components/OpaSummaryTable";
import { OpaMatrixTable } from "@/components/OpaMatrixTable";
import { OpaLineChart } from "@/components/OpaLineChart";
import { MarkowitzChart } from "@/components/MarkowitzChart";
import { DatePickerPopover } from "@/components/DatePickerPopover";
import { ExportPdfButton } from "@/components/ExportPdfButton";
import { RangePickerPopover } from "@/components/RangePickerPopover";
import { TopBar } from "@/components/TopBar";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMarketSocket } from "@/hooks/useMarketSocket";
import { fetchDashboard, fetchMarkowitz, fetchRiskMetrics } from "@/lib/api";
import { presetDates, toDateInputValue } from "@/lib/date";
import { DashboardQuery, MarketCode, Preset, SeriesRow, MarkowitzPoint, RiskMetric } from "@/types/dashboard";

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function buildDailyTrendPoints(row: {
    prev_close: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
}): number[] {
    const prevClose = toFiniteNumber(row.prev_close);
    const open = toFiniteNumber(row.open);
    const high = toFiniteNumber(row.high);
    const low = toFiniteNumber(row.low);
    const close = toFiniteNumber(row.close);

    const points: number[] = [];
    const push = (value: number | null) => {
        if (value === null) return;
        if (!points.length || Math.abs(points[points.length - 1] - value) > 1e-12) {
            points.push(value);
        }
    };

    const start = prevClose ?? open ?? close;
    const openRef = open ?? start;
    push(start);
    push(open);

    if (high !== null && low !== null) {
        const closesUp = close !== null && openRef !== null && close >= openRef;
        if (closesUp) {
            push(low);
            push(high);
        } else {
            push(high);
            push(low);
        }
    } else {
        push(high);
        push(low);
    }

    push(close);

    if (points.length === 1) {
        points.push(points[0]);
    }

    return points.length >= 2 ? points : [];
}

interface OpaDashboardProps {
    market: MarketCode;
}

export function OpaDashboard({ market }: OpaDashboardProps) {
    const {
        query,
        loading,
        error,
        patchQuery,
        loadData,
        viewRows,
        snapshotRawRows,
    } = useDashboardData(market);

    // --- Persistent state: survives tab navigation ---
    const LS_OPA_DATE = `finboard_opa_date_${market}`;
    const LS_TABLE_MODE = `finboard_table_mode_${market}`;

    const [opaDate, setOpaDateState] = useState<string>(() => {
        if (typeof window === "undefined") return "";
        return localStorage.getItem(LS_OPA_DATE) ?? "";
    });
    const setOpaDate = (date: string) => {
        localStorage.setItem(LS_OPA_DATE, date);
        setOpaDateState(date);
    };

    const [opaDateValid, setOpaDateValid] = useState(true);
    const [fetchingOpa, setFetchingOpa] = useState(false);
    const [externalOpaRow, setExternalOpaRow] = useState<SeriesRow | null>(null);

    const [showRangePicker, setShowRangePicker] = useState(false);
    const [showOpaRangePicker, setShowOpaRangePicker] = useState(false);

    const [tableMode, setTableModeState] = useState<"summary" | "matrix" | "chart" | "markowitz">(() => {
        if (typeof window === "undefined") return "matrix";
        const saved = localStorage.getItem(LS_TABLE_MODE);
        return (saved as "summary" | "matrix" | "chart" | "markowitz") ?? "matrix";
    });
    const setTableMode = (mode: "summary" | "matrix" | "chart" | "markowitz") => {
        localStorage.setItem(LS_TABLE_MODE, mode);
        setTableModeState(mode);
    };

    const [showHeatmap, setShowHeatmap] = useState(true);

    const [markowitzData, setMarkowitzData] = useState<MarkowitzPoint[] | null>(null);
    const [loadingMarkowitz, setLoadingMarkowitz] = useState(false);

    const [riskMetrics, setRiskMetrics] = useState<RiskMetric[]>([]);

    // --- Caching for Markowitz calculation ---
    const [markowitzCache, setMarkowitzCache] = useState<Record<string, MarkowitzPoint[]>>({});

    // --- WebSockets for live prices ---
    const { rows: liveRows } = useMarketSocket({
        market,
        assets: query.selectedAssets,
        autoConnect: true,
    });

    // --- Local OPA instrument visibility (decoupled from backend includedAssets) ---
    // Starts with all instruments; user can toggle off individual ones here.
    const [opaHiddenInstruments, setOpaHiddenInstruments] = useState<Set<string>>(new Set());

    // Default to today's date if nothing was saved
    const todayIso = useMemo(() => toDateInputValue(new Date()), []);

    useEffect(() => {
        if (!opaDate) {
            setOpaDate(todayIso);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [todayIso, opaDate]);

    // Fetch the OPA row from the backend, always with ALL selectedAssets
    // (never use viewRows shortcut — it only includes the currently-loaded 11 instruments)
    useEffect(() => {
        if (!opaDate || !opaDateValid) return;

        async function fetchOpaRow() {
            setFetchingOpa(true);
            try {
                // Fetch a small 7-day window to catch the nearest trading day <= opaDate
                const d = new Date(opaDate);
                d.setUTCDate(d.getUTCDate() - 7);
                const startWindow = d.toISOString().split("T")[0];

                const q: DashboardQuery = {
                    ...query,
                    // Force ALL selectedAssets so every instrument's OPA price is loaded
                    includedAssets: query.selectedAssets,
                    startDate: startWindow,
                    endDate: opaDate,
                    preset: "Custom",
                };
                const res = await fetchDashboard(q);
                if (res.view_rows && res.view_rows.length > 0) {
                    // view_rows are descending, index 0 is the closest trading day <= opaDate
                    setExternalOpaRow(res.view_rows[0]);
                } else {
                    setExternalOpaRow(null);
                }
            } catch (err) {
                console.error("Error fetching OPA row", err);
                setExternalOpaRow(null);
            } finally {
                setFetchingOpa(false);
            }
        }
        fetchOpaRow();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opaDate, opaDateValid, query.selectedAssets, query.market]);

    // Fetch risk metrics whenever the date range or instruments change
    useEffect(() => {
        if (viewRows.length === 0) return;
        let cancelled = false;
        async function loadRiskMetrics() {
            try {
                const res = await fetchRiskMetrics(query);
                if (!cancelled) setRiskMetrics(res.metrics);
            } catch {
                if (!cancelled) setRiskMetrics([]);
            }
        }
        loadRiskMetrics();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query.startDate, query.endDate, query.selectedAssets, query.preset]);


    // Fetch Markowitz when tab is active and data varies (using cache)
    useEffect(() => {
        if (tableMode !== "markowitz") return;

        const cacheKey = JSON.stringify({
            assets: query.selectedAssets,
            start: query.startDate,
            end: query.endDate,
            market
        });

        if (markowitzCache[cacheKey]) {
            setMarkowitzData(markowitzCache[cacheKey]);
            return;
        }

        async function loadMarkowitz() {
            setLoadingMarkowitz(true);
            try {
                const res = await fetchMarkowitz(query);
                setMarkowitzData(res.puntos);
                setMarkowitzCache(prev => ({ ...prev, [cacheKey]: res.puntos }));
            } catch (err) {
                console.error("Error fetching Markowitz:", err);
                setMarkowitzData([]);
            } finally {
                setLoadingMarkowitz(false);
            }
        }

        loadMarkowitz();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableMode, query.startDate, query.endDate, query.selectedAssets, query.preset]);

    // Extract OPA prices mapping
    const opaPrices = useMemo(() => {
        const prices: Record<string, number> = {};

        // 1. Start with the explicit external row for the exact date
        if (externalOpaRow) {
            for (const [key, value] of Object.entries(externalOpaRow)) {
                if (key !== "date" && typeof value === "number" && Number.isFinite(value)) {
                    prices[key] = value;
                }
            }
        }

        // 2. For any instrument that was selected but missing on that exact date (due to holidays, etc),
        // find its closest available price in viewRows
        if (viewRows.length > 0) {
            const allInstruments = Object.keys(viewRows[0]).filter(k => k !== "date");

            for (const inst of allInstruments) {
                if (prices[inst] !== undefined) continue;

                // Try to find the closest price ON OR BEFORE opaDate
                // viewRows is descending (newest first). Filter those <= opaDate.
                const beforeDates = viewRows.filter(r => String(r.date) <= opaDate);
                for (const row of beforeDates) {
                    const val = row[inst];
                    if (typeof val === "number" && Number.isFinite(val)) {
                        prices[inst] = val;
                        break;
                    }
                }

                // If still missing (opaDate is earlier than any trade date for this instrument),
                // try to find the closest price ON OR AFTER opaDate
                if (prices[inst] === undefined) {
                    const afterDates = viewRows.filter(r => String(r.date) > opaDate);
                    // reverse to get closest first (ascending)
                    const afterDatesAsc = [...afterDates].reverse();
                    for (const row of afterDatesAsc) {
                        const val = row[inst];
                        if (typeof val === "number" && Number.isFinite(val)) {
                            prices[inst] = val;
                            break;
                        }
                    }
                }
            }
        }

        return prices;
    }, [externalOpaRow, viewRows, opaDate]);

    // Filter opaPrices by the local OPA hidden set.
    // Uses opaPrices (= ALL instruments with OPA data), not includedAssets.
    const filteredOpaPrices = useMemo(() => {
        if (opaHiddenInstruments.size === 0) return opaPrices;
        return Object.fromEntries(
            Object.entries(opaPrices).filter(([inst]) => !opaHiddenInstruments.has(inst))
        );
    }, [opaPrices, opaHiddenInstruments]);

    // All OPA instruments (for the chip selector)
    const opaAllInstruments = useMemo(() => Object.keys(opaPrices), [opaPrices]);
    const opaActiveInstruments = useMemo(
        () => opaAllInstruments.filter(i => !opaHiddenInstruments.has(i)),
        [opaAllInstruments, opaHiddenInstruments]
    );

    const summaryRows = useMemo(() => {
        if (!opaDate || Object.keys(filteredOpaPrices).length === 0) return [];

        // Build a snapshot map: instrument → most recent close from today's snapshot
        const snapshotMap: Record<string, number> = {};
        for (const s of snapshotRawRows) {
            const c = typeof s.close === "number" && Number.isFinite(s.close) ? s.close : null;
            if (c !== null) snapshotMap[s.instrument] = c;
        }

        // Find the latest non-null value for each instrument across all viewRows
        const sortedRows = [...viewRows].sort((a, b) =>
            String(b.date).localeCompare(String(a.date))
        );

        // Build a live map: instrument → most recent close from WebSocket
        const liveMap: Record<string, number> = {};
        for (const l of liveRows) {
            if (typeof l.close === "number" && Number.isFinite(l.close)) {
                liveMap[l.instrument] = l.close;
            }
        }

        function getBestCurrentPrice(instrument: string): number | null {
            // Priority:
            // 1. Live price (WebSocket)
            if (liveMap[instrument] !== undefined) return liveMap[instrument];

            // 2. Latest viewRow
            const latestRow = sortedRows[0];
            if (latestRow) {
                const v = latestRow[instrument];
                if (typeof v === "number" && Number.isFinite(v)) return v;
            }

            // 3. Snapshot (today's close from the ticker bar data)
            if (snapshotMap[instrument] !== undefined) return snapshotMap[instrument];

            // 4. Scan all viewRows for the most recent non-null value
            for (const row of sortedRows) {
                const v = row[instrument];
                if (typeof v === "number" && Number.isFinite(v)) return v;
            }
            return null;
        }

        const rows = [];
        for (const [instrument, opaPrice] of Object.entries(filteredOpaPrices)) {
            const currentPrice = getBestCurrentPrice(instrument);

            let evolution: number | null = null;
            let changePct: number | null = null;

            if (currentPrice !== null && opaPrice !== 0) {
                evolution = (currentPrice / opaPrice) * 100;
                changePct = ((currentPrice / opaPrice) - 1) * 100;
            }

            rows.push({ instrument, opaPrice, currentPrice, evolution, changePct });
        }

        // Sort by best performance
        return rows.sort((a, b) => (b.evolution || 0) - (a.evolution || 0));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewRows, snapshotRawRows, opaDate, filteredOpaPrices]);

    const tickerItems = useMemo(() => {
        // Use liveRows if available, otherwise fallback to snapshotRawRows
        const sourceData = (liveRows && liveRows.length > 0) ? liveRows : snapshotRawRows;
        if (!sourceData || sourceData.length === 0) return [];

        return sourceData.map((row) => ({
            instrument: row.instrument,
            displayInstrument: query.customAssets.find((a) => a.label === row.instrument)?.symbol || row.instrument,
            change_pct: toFiniteNumber(row.change_pct),
            sparkline: buildDailyTrendPoints({
                prev_close: row.prev_close,
                open: row.open,
                high: row.high,
                low: row.low,
                close: row.close,
            }),
        }));
    }, [snapshotRawRows, liveRows, query.customAssets]);

    const rangeLabel = `${query.startDate} → ${query.endDate}`;

    async function onApplyRange(startDate: string, endDate: string) {
        await loadData({ preset: "Custom", startDate, endDate });
        setShowRangePicker(false);
    }

    async function onTemporalityChange(preset: Preset) {
        if (preset === "Custom") {
            patchQuery({ preset });
            return;
        }
        const dates = presetDates(preset);
        await loadData({ preset, startDate: dates.startDate, endDate: dates.endDate });
    }

    async function onFrequencyChange(nextFrequency: DashboardQuery["frequency"]) {
        const nextExclude = nextFrequency === "D" ? query.excludeWeekends : false;
        await loadData({ frequency: nextFrequency, excludeWeekends: nextExclude });
    }

    return (
        <>
            <TopBar activeSection="analisis" />

            <main className="mx-auto mt-6 w-full max-w-[1400px] px-4 pb-8 lg:px-6">
                <div className="mb-8">
                    <h1 className="text-5xl font-bold tracking-tight text-text-main">Análisis OPA (Base 100)</h1>
                    <p className="mt-2 max-w-3xl text-sm text-text-muted">
                        Evolución porcentual rebasada a 100 desde una fecha inicial.
                    </p>
                </div>

                <ChipRow
                    rangeLabel={rangeLabel}
                    presetValue={query.preset}
                    frequencyValue={query.frequency}
                    instrumentValues={opaActiveInstruments}
                    instrumentOptions={opaAllInstruments.map(a => ({ value: a, label: a }))}
                    refreshProgress={0}
                    refreshing={loading}
                    onFrequencyChange={onFrequencyChange}
                    onPresetChange={onTemporalityChange}
                    onInstrumentChange={(values) => {
                        // values = currently active list (or null = all)
                        const active = new Set(values ?? opaAllInstruments);
                        setOpaHiddenInstruments(new Set(opaAllInstruments.filter(i => !active.has(i))));
                    }}
                    onLiveClick={() => loadData()}
                    onRangeClick={() => setShowRangePicker((prev) => !prev)}
                />
                <div className="relative">
                    <RangePickerPopover
                        initialEndDate={query.endDate}
                        initialStartDate={query.startDate}
                        loading={loading}
                        open={showRangePicker}
                        onApply={onApplyRange}
                        onClose={() => setShowRangePicker(false)}
                    />
                </div>

                <section className="mb-4 flex flex-col gap-4 rounded-t-xl border border-border-light bg-gray-50/40 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-4">
                        <span className="text-sm font-medium text-text-main">Rango OPA (Análisis):</span>

                        <div className="relative">
                            <button
                                className="flex min-w-[140px] items-center justify-between rounded-lg border border-border-light bg-white px-3 py-1.5 text-sm font-semibold shadow-sm transition hover:bg-gray-50"
                                type="button"
                                onClick={() => setShowOpaRangePicker((prev) => !prev)}
                            >
                                <span>{opaDate}</span>
                                <span className="text-[10px] text-text-muted">▼</span>
                            </button>

                            <DatePickerPopover
                                initialDate={opaDate}
                                loading={fetchingOpa}
                                open={showOpaRangePicker}
                                onApply={async (date) => {
                                    setOpaDate(date);
                                    setOpaDateValid(true);
                                    setShowOpaRangePicker(false);
                                }}
                                onClose={() => setShowOpaRangePicker(false)}
                            />
                        </div>

                        {fetchingOpa && <span className="text-xs text-text-muted">Buscando precios...</span>}
                        {(!externalOpaRow && !fetchingOpa && opaDateValid && opaDate) && (
                            <span className="text-xs text-amber-600">No hay cotizaciones ese día. Mueve la fecha.</span>
                        )}
                    </div>

                    <div className="flex w-full items-center gap-2 md:w-auto">
                        <div className="inline-flex rounded-lg border border-border-light bg-white p-0.5">
                            <button
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tableMode === "summary" ? "bg-primary text-white" : "text-text-main hover:bg-gray-50"
                                    }`}
                                type="button"
                                onClick={() => setTableMode("summary")}
                            >
                                Resumen
                            </button>
                            <button
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tableMode === "matrix" ? "bg-primary text-white" : "text-text-main hover:bg-gray-50"
                                    }`}
                                type="button"
                                onClick={() => setTableMode("matrix")}
                            >
                                Matriz Base 100
                            </button>
                            <button
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tableMode === "chart" ? "bg-primary text-white" : "text-text-main hover:bg-gray-50"
                                    }`}
                                type="button"
                                onClick={() => setTableMode("chart")}
                            >
                                Gráfica
                            </button>
                            <button
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tableMode === "markowitz" ? "bg-primary text-white" : "text-text-main hover:bg-gray-50"
                                    }`}
                                type="button"
                                onClick={() => setTableMode("markowitz")}
                            >
                                Markowitz
                            </button>
                        </div>

                        <ExportPdfButton targetId="opa-dashboard-export" filename="finboard-analisis-opa.pdf" />

                        {tableMode === "matrix" && (
                            <button
                                className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${showHeatmap
                                    ? "border-primary/40 bg-green-50 text-primary"
                                    : "border-border-light bg-white text-text-main hover:bg-gray-50"
                                    }`}
                                type="button"
                                onClick={() => setShowHeatmap(!showHeatmap)}
                            >
                                Heatmap {showHeatmap ? "ON" : "OFF"}
                            </button>
                        )}

                        <AiAssistant
                            market={market}
                            contextData={
                                tableMode === "summary"
                                    ? { type: "snapshot", rows: summaryRows as any, risk: riskMetrics }
                                    : tableMode === "markowitz"
                                        ? { type: "markowitz", points: markowitzData, risk: riskMetrics }
                                        : { type: "matrix", rows: viewRows, risk: riskMetrics }
                            }
                        />
                    </div>
                </section>

                {error && (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
                )}

                {tableMode === "summary" && (
                    <OpaSummaryTable market={market} opaDate={opaDate} rows={summaryRows} riskMetrics={riskMetrics} />
                )}

                {tableMode === "matrix" && (
                    <OpaMatrixTable market={market} opaDate={opaDate} opaPrices={filteredOpaPrices} viewRows={viewRows} tickerItems={tickerItems} showHeatmap={showHeatmap} />
                )}

                {tableMode === "chart" && (
                    <OpaLineChart market={market} opaDate={opaDate} opaPrices={filteredOpaPrices} viewRows={viewRows} />
                )}

                {tableMode === "markowitz" && (
                    <MarkowitzChart data={markowitzData || []} loading={loadingMarkowitz} />
                )}
            </main>
        </>
    );
}
