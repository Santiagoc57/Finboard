import { useMemo, useRef, useState, useEffect } from "react";

import { instrumentIcon } from "@/lib/instrument";
import { MarketCode, SeriesRow } from "@/types/dashboard";

interface MatrixTableProps {
  market: MarketCode;
  rows: SeriesRow[];
  loading?: boolean;
  orderedColumns?: string[];
  totalRows: number;
  startRow: number;
  endRow: number;
  showPercent: boolean;
  showHeatmap: boolean;
  onShowPercentChange: (value: boolean) => void;
  onShowHeatmapChange: (value: boolean) => void;
}

function parseNum(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCell(value: number | null, asPercent: boolean): string {
  if (value === null) return "—";
  if (asPercent) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  }
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toFixed(2);
  return value.toFixed(6);
}

function sparklinePath(points: number[], width = 72, height = 22): string {
  if (points.length < 2) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points.map((point, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - ((point - min) / span) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return `M ${coords[0]} L ${coords.slice(1).join(" L ")}`;
}

function heatCellClass(scorePct: number | null): string {
  if (scorePct === null) return "text-slate-500";
  const intensity = Math.min(1, Math.abs(scorePct) / 2.5);
  if (scorePct >= 0) {
    if (intensity > 0.66) return "bg-green-200/70 text-green-900";
    if (intensity > 0.33) return "bg-green-100/80 text-green-800";
    return "bg-green-50/80 text-green-700";
  }
  if (intensity > 0.66) return "bg-red-200/70 text-red-900";
  if (intensity > 0.33) return "bg-red-100/80 text-red-800";
  return "bg-red-50/80 text-red-700";
}

export function MatrixTable({
  market,
  rows,
  loading = false,
  orderedColumns,
  totalRows,
  startRow,
  endRow,
  showPercent,
  showHeatmap,
  onShowPercentChange,
  onShowHeatmapChange,
}: MatrixTableProps) {
  const columns = useMemo(() => {
    if (orderedColumns && orderedColumns.length) {
      return orderedColumns;
    }
    if (!rows.length) return [] as string[];
    const set = new Set<string>();
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (key !== "date") set.add(key);
      });
    });
    return Array.from(set);
  }, [rows, orderedColumns]);

  const numericRows = useMemo(() => {
    return rows.map((row) => {
      const out: Record<string, number | null | string> = { date: String(row.date) };
      columns.forEach((col) => {
        out[col] = parseNum((row[col] as string | number | null) ?? null);
      });
      return out;
    });
  }, [columns, rows]);

  const displayRows = useMemo(() => {
    return numericRows.map((row, idx) => {
      const out: Record<string, number | null | string> = { date: String(row.date) };
      columns.forEach((col) => {
        const curr = row[col] as number | null;
        if (!showPercent) {
          out[col] = curr;
          return;
        }
        if (idx === 0) {
          out[col] = null;
          return;
        }
        const prev = numericRows[idx - 1][col] as number | null;
        if (curr === null || prev === null || prev === 0) {
          out[col] = null;
          return;
        }
        out[col] = ((curr / prev) - 1) * 100;
      });
      return out;
    });
  }, [columns, numericRows, showPercent]);

  const columnSparklines = useMemo(() => {
    const out: Record<string, { path: string; positive: boolean }> = {};
    columns.forEach((col) => {
      const points = numericRows
        .map((row) => row[col] as number | null)
        .filter((v): v is number => v !== null)
        .slice(-24);
      const path = sparklinePath(points);
      const positive = points.length > 1 ? points[points.length - 1] >= points[0] : true;
      out[col] = { path, positive };
    });
    return out;
  }, [columns, numericRows]);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(0);
  const isSyncingLeft = useRef(false);

  useEffect(() => {
    const bottomEl = bottomScrollRef.current;
    if (!bottomEl) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTableWidth(entry.target.scrollWidth);
      }
    });

    const tableEl = bottomEl.querySelector("table");
    if (tableEl) {
      observer.observe(tableEl);
      setTableWidth(tableEl.scrollWidth);
    } else {
      observer.observe(bottomEl);
      setTableWidth(bottomEl.scrollWidth);
    }

    return () => observer.disconnect();
  }, [numericRows, columns]);

  const handleTopScroll = () => {
    if (isSyncingLeft.current) {
      isSyncingLeft.current = false;
      return;
    }
    if (bottomScrollRef.current && topScrollRef.current) {
      isSyncingLeft.current = true;
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (isSyncingLeft.current) {
      isSyncingLeft.current = false;
      return;
    }
    if (bottomScrollRef.current && topScrollRef.current) {
      isSyncingLeft.current = true;
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  };

  return (
    <section className="card-shell overflow-hidden flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-light bg-gray-50/80 px-4 py-2.5">
        <div className="text-xs font-medium uppercase tracking-wider text-text-muted">Vista Matricial</div>
        <div className="flex items-center gap-2">
          <button
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${showPercent
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-border-light bg-white text-text-main hover:bg-gray-50"
              }`}
            type="button"
            onClick={() => onShowPercentChange(!showPercent)}
          >
            {showPercent ? "Ver Precio" : "Ver %"}
          </button>
          <button
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${showHeatmap
              ? "border-primary/40 bg-green-50 text-primary"
              : "border-border-light bg-white text-text-main hover:bg-gray-50"
              }`}
            type="button"
            onClick={() => onShowHeatmapChange(!showHeatmap)}
          >
            Heatmap {showHeatmap ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      <div
        ref={topScrollRef}
        className="overflow-x-auto overflow-y-hidden border-b border-border-light bg-gray-50 flex-none"
        style={{ height: "14px" }}
        onScroll={handleTopScroll}
      >
        <div style={{ width: tableWidth ? `${tableWidth}px` : "100%", height: "1px" }} />
      </div>

      <div
        ref={bottomScrollRef}
        className="max-h-[620px] overflow-auto flex-1 custom-scrollbar"
        onScroll={handleBottomScroll}
      >
        <table className="w-full min-w-[1200px] border-collapse text-right">
          <thead className="table-head">
            <tr>
              <th className="sticky left-0 top-0 z-30 min-w-[130px] border-r border-border-light bg-gray-50 px-4 py-2 text-left shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                Fecha
              </th>
              {columns.map((col) => {
                const spark = columnSparklines[col];
                const icon = instrumentIcon(col, market);
                return (
                  <th key={col} className="sticky top-0 z-20 min-w-[132px] border-b border-border-light bg-gray-50 px-3 py-2">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="inline-flex items-center gap-1.5 font-semibold normal-case tracking-normal text-text-main">
                        {icon && <span className="text-sm">{icon}</span>}
                        <span>{col}</span>
                      </div>
                      {spark.path && (
                        <svg className="h-5 w-[72px]" preserveAspectRatio="none" viewBox="0 0 72 22">
                          <path
                            d={spark.path}
                            fill="none"
                            stroke={spark.positive ? "#16a34a" : "#dc2626"}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.4"
                          />
                        </svg>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-border-light text-sm">
            {displayRows.map((row, rowIdx) => (
              <tr
                key={`${String(row.date)}-${rowIdx}`}
                className={`group ${rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50"} transition-colors hover:bg-gray-100`}
              >
                <td className={`table-cell-mono sticky left-0 z-10 border-r border-border-light px-4 py-2.5 text-left font-bold text-text-main shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] transition-colors ${rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50"} group-hover:bg-gray-100`}>
                  {String(row.date)}
                </td>
                {columns.map((col) => {
                  const value = row[col] as number | null;
                  let score: number | null = null;
                  if (rowIdx > 0) {
                    const currRaw = numericRows[rowIdx][col] as number | null;
                    const prevRaw = numericRows[rowIdx - 1][col] as number | null;
                    if (currRaw !== null && prevRaw !== null && prevRaw !== 0) {
                      score = ((currRaw / prevRaw) - 1) * 100;
                    }
                  }
                  if (showPercent) score = value;

                  return (
                    <td
                      key={`${String(row.date)}-${col}`}
                      className={`table-cell-mono px-3 py-2.5 ${showHeatmap ? heatCellClass(score) : "text-slate-700"
                        }`}
                    >
                      {formatCell(value, showPercent)}
                    </td>
                  );
                })}
              </tr>
            ))}

            {!displayRows.length && (
              <tr>
                <td className="px-6 py-10 text-center text-sm text-text-muted" colSpan={Math.max(columns.length + 1, 1)}>
                  {loading ? "Cargando datos de mercado..." : "No hay datos para mostrar con los filtros actuales."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border-light bg-gray-50/60 px-4 py-2.5 text-xs text-text-muted">
        <span>
          Mostrando <span className="font-semibold text-text-main">{startRow}</span> a{" "}
          <span className="font-semibold text-text-main">{endRow}</span> de{" "}
          <span className="font-semibold text-text-main">{totalRows}</span>
        </span>
        <span>{showPercent ? "Modo %" : "Modo precio"} · {showHeatmap ? "Heatmap activo" : "Heatmap inactivo"}</span>
      </div>
    </section>
  );
}
