"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CurrencyPairPill } from "@/components/CurrencyPairPill";
import { TopBar } from "@/components/TopBar";
import { currencyColor, pairInfo } from "@/lib/currency";
import { fetchDetail } from "@/lib/api";
import { utcClockToBogotaLabel } from "@/lib/date";
import { formatPct } from "@/lib/format";
import { instrumentIcon } from "@/lib/instrument";
import { AssetSource, DetailHistoryRow, DetailResponse, MarketCode } from "@/types/dashboard";

const RANGE_OPTIONS = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"] as const;
type RangeOption = (typeof RANGE_OPTIONS)[number];

function parseMarket(value: string | null): MarketCode {
  return value === "monedas" ? "monedas" : "indices_etfs";
}

function parseBool(value: string | null): boolean {
  return value === "1" || value === "true";
}

function parseAssetSource(value: string | null): AssetSource | undefined {
  if (value === "fred" || value === "yahoo" || value === "stooq") return value;
  return undefined;
}

function fmtNum(value: number | null, decimals = 2): string {
  if (value === null || Number.isNaN(value)) return "-";
  return value.toFixed(decimals);
}

function dynamicDecimals(value: number | null): number {
  if (value === null) return 2;
  const abs = Math.abs(value);
  if (abs >= 1000) return 2;
  if (abs >= 1) return 4;
  return 6;
}

function filterByRange(rows: DetailHistoryRow[], range: RangeOption): DetailHistoryRow[] {
  if (!rows.length || range === "MAX") return rows;

  const lastDate = new Date(rows[rows.length - 1].date);
  const start = new Date(lastDate);

  if (range === "1D") {
    return rows.slice(Math.max(0, rows.length - 2));
  }
  if (range === "5D") {
    return rows.slice(Math.max(0, rows.length - 5));
  }
  if (range === "1M") {
    start.setMonth(start.getMonth() - 1);
  }
  if (range === "6M") {
    start.setMonth(start.getMonth() - 6);
  }
  if (range === "YTD") {
    start.setMonth(0, 1);
  }
  if (range === "1Y") {
    start.setFullYear(start.getFullYear() - 1);
  }
  if (range === "5Y") {
    start.setFullYear(start.getFullYear() - 5);
  }

  return rows.filter((row) => new Date(row.date) >= start);
}

function buildPath(rows: DetailHistoryRow[], width = 1000, height = 360): { line: string; area: string; min: number; max: number } {
  const values = rows
    .map((row) => row.close)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (!values.length) {
    return { line: "", area: "", min: 0, max: 0 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points: string[] = [];
  rows.forEach((row, index) => {
    const yValue = row.close ?? values[Math.max(0, Math.min(values.length - 1, index))];
    const x = (index / Math.max(1, rows.length - 1)) * width;
    const y = height - ((yValue - min) / span) * height;
    points.push(`${x},${y}`);
  });

  const line = points.length ? `M ${points[0]} L ${points.slice(1).join(" L ")}` : "";
  const area = points.length ? `${line} L ${width},${height} L 0,${height} Z` : "";

  return { line, area, min, max };
}

function useDetailData() {
  const search = useSearchParams();
  const market = parseMarket(search.get("market"));
  const instrument = search.get("instrument") || "";
  const startDate = search.get("startDate") || "";
  const endDate = search.get("endDate") || "";
  const frequency = (search.get("frequency") || "D") as "D" | "W" | "M";
  const excludeWeekends = parseBool(search.get("excludeWeekends"));
  const invert = parseBool(search.get("invert"));
  const customSource = parseAssetSource(search.get("customSource"));
  const customSymbol = search.get("customSymbol") || undefined;

  return {
    market,
    instrument,
    startDate,
    endDate,
    frequency,
    excludeWeekends,
    invert,
    customSource,
    customSymbol,
  };
}

export function DetailPageClient() {
  const router = useRouter();
  const params = useDetailData();

  const [range, setRange] = useState<RangeOption>("1M");
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!params.instrument || !params.startDate || !params.endDate) {
        setError("Faltan parametros para abrir el detalle.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetchDetail({
          market: params.market,
          instrument: params.instrument,
          startDate: params.startDate,
          endDate: params.endDate,
          frequency: params.frequency,
          excludeWeekends: params.excludeWeekends,
          invert: params.invert,
          customSource: params.customSource,
          customSymbol: params.customSymbol,
        });
        if (!mounted) return;
        setDetail(response);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar el detalle");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [
    params.customSource,
    params.customSymbol,
    params.endDate,
    params.excludeWeekends,
    params.frequency,
    params.instrument,
    params.invert,
    params.market,
    params.startDate,
  ]);

  const filteredRows = useMemo(() => {
    if (!detail) return [];
    return filterByRange(detail.history, range);
  }, [detail, range]);

  const chart = useMemo(() => buildPath(filteredRows), [filteredRows]);
  const last = filteredRows[filteredRows.length - 1] ?? null;
  const positive = (detail?.quote.change_pct ?? 0) >= 0;
  const pInfo = detail ? pairInfo(detail.display_instrument) : null;
  const detailIcon = detail ? instrumentIcon(detail.display_instrument, params.market) : null;

  return (
    <>
      <TopBar activeSection={params.market} />

      <main className="mx-auto w-full max-w-[1400px] px-4 pb-10 lg:px-6">
        <div className="mb-4 flex items-center gap-3 text-sm text-text-muted">
          <button
            className="rounded-md border border-border-light bg-white px-3 py-1.5 transition hover:bg-gray-50"
            type="button"
            onClick={() => router.back()}
          >
            Volver
          </button>
          <Link className="hover:text-primary" href={params.market === "monedas" ? "/monedas" : "/indices-etfs"}>
            {params.market === "monedas" ? "FX / Monedas" : "Indices / ETFs"}
          </Link>
          <span>›</span>
          <span className="font-semibold text-text-main">Detalle</span>
        </div>

        {loading && <div className="card-shell p-6 text-sm text-text-muted">Cargando detalle...</div>}

        {error && <div className="card-shell border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>}

        {!loading && !error && detail && (
          <>
            <section className="mb-6">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                {detailIcon && <span className="text-2xl leading-none">{detailIcon}</span>}
                {pInfo && (
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: currencyColor(pInfo.base) }}
                    title={`Moneda base: ${pInfo.base}`}
                  />
                )}
                {pInfo && <CurrencyPairPill pair={detail.display_instrument} className="text-xs" />}
                <h1 className="text-4xl font-bold tracking-tight text-text-main">
                  {detail.display_instrument} ({detail.symbol})
                </h1>
                <button
                  className="rounded-full border border-border-light bg-white px-3 py-1 text-sm font-semibold transition hover:bg-gray-50"
                  type="button"
                >
                  Seguir
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <span className="text-6xl font-bold tracking-tight text-text-main">
                  {fmtNum(detail.quote.price, dynamicDecimals(detail.quote.price))}
                </span>
                <span className={`text-lg font-semibold ${positive ? "text-primary" : "text-accent-red"}`}>
                  {fmtNum(detail.quote.change, dynamicDecimals(detail.quote.price))} ({formatPct(detail.quote.change_pct)})
                </span>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Al cierre: {detail.as_of} · Fuente: {detail.source} · Actualizado:{" "}
                {utcClockToBogotaLabel(detail.last_update_utc)}
              </p>
            </section>

            <section className="card-shell mb-8 p-4 md:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1">
                  {RANGE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      className={`rounded px-3 py-1 text-sm font-medium transition ${
                        range === option
                          ? "bg-blue-100 text-blue-700"
                          : "text-text-muted hover:bg-gray-100 hover:text-text-main"
                      }`}
                      type="button"
                      onClick={() => setRange(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 text-sm text-text-muted">
                  <span>Eventos clave</span>
                  <span>•</span>
                  <span>Grafico avanzado</span>
                </div>
              </div>

              <div className="relative h-80 w-full overflow-hidden rounded-md border border-border-light bg-white">
                <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 360">
                  <defs>
                    <linearGradient id="detailArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#00885e" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#00885e" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {chart.area && <path d={chart.area} fill="url(#detailArea)" />}
                  {chart.line && <path d={chart.line} fill="none" stroke="#00885e" strokeWidth="2" />}
                  {last?.close !== null && last?.close !== undefined && (
                    <circle
                      cx="1000"
                      cy={
                        chart.max === chart.min
                          ? 180
                          : 360 - ((last.close - chart.min) / (chart.max - chart.min)) * 360
                      }
                      fill="#00885e"
                      r="4"
                    />
                  )}
                </svg>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                <span>{filteredRows[0]?.date ?? "-"}</span>
                <span>{filteredRows[Math.max(0, Math.floor(filteredRows.length / 2))]?.date ?? "-"}</span>
                <span>{filteredRows[filteredRows.length - 1]?.date ?? "-"}</span>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-dashed border-border-light pb-2">
                  <span className="text-text-muted">Cierre anterior</span>
                  <span className="font-semibold text-text-main">
                    {fmtNum(detail.quote.prev_close, dynamicDecimals(detail.quote.prev_close))}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-border-light pb-2">
                  <span className="text-text-muted">Apertura</span>
                  <span className="font-semibold text-text-main">{fmtNum(detail.stats.open, dynamicDecimals(detail.stats.open))}</span>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-border-light pb-2">
                  <span className="text-text-muted">Rango del dia</span>
                  <span className="font-semibold text-text-main">
                    {fmtNum(detail.stats.day_range[0], dynamicDecimals(detail.stats.day_range[0]))} -{" "}
                    {fmtNum(detail.stats.day_range[1], dynamicDecimals(detail.stats.day_range[1]))}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-border-light pb-2">
                  <span className="text-text-muted">Maximo / Minimo</span>
                  <span className="font-semibold text-text-main">
                    {fmtNum(detail.stats.high, dynamicDecimals(detail.stats.high))} /{" "}
                    {fmtNum(detail.stats.low, dynamicDecimals(detail.stats.low))}
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-dashed border-border-light pb-2">
                  <span className="text-text-muted">Rango de 52 semanas</span>
                  <span className="font-semibold text-text-main">
                    {fmtNum(detail.stats.week_52_range[0], dynamicDecimals(detail.stats.week_52_range[0]))} -{" "}
                    {fmtNum(detail.stats.week_52_range[1], dynamicDecimals(detail.stats.week_52_range[1]))}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-border-light pb-2">
                  <span className="text-text-muted">Volumen</span>
                  <span className="font-semibold text-text-main">{detail.stats.volume ?? "N/A"}</span>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-border-light pb-2">
                  <span className="text-text-muted">Volumen promedio</span>
                  <span className="font-semibold text-text-main">{detail.stats.avg_volume ?? "N/A"}</span>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-border-light pb-2">
                  <span className="text-text-muted">Instrumento</span>
                  <span className="font-semibold text-text-main">{detail.instrument}</span>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
