import { CurrencyPairPill } from "@/components/CurrencyPairPill";
import { SnapshotSortField, SnapshotSortState, SnapshotViewRow } from "@/hooks/useSnapshotTable";
import { currencyColor, pairInfo } from "@/lib/currency";
import { formatFixed, formatPct } from "@/lib/format";
import { instrumentIcon } from "@/lib/instrument";
import { MarketCode } from "@/types/dashboard";

interface SnapshotTableProps {
  market: MarketCode;
  rows: SnapshotViewRow[];
  sparklineByInstrument: Record<string, number[]>;
  totalRows: number;
  startRow: number;
  endRow: number;
  highlightInstrument: string | null;
  sort: SnapshotSortState;
  onSortChange: (field: SnapshotSortField) => void;
  onOpenDetail: (instrument: string, isInverted: boolean) => void;
}

interface SparklineProps {
  points: number[];
  positive: boolean;
}

function buildSparklinePath(points: number[], width = 96, height = 30): string {
  if (points.length < 2) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((value - min) / span) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return `M ${coords[0]} L ${coords.slice(1).join(" L ")}`;
}

function Sparkline({ points, positive }: SparklineProps) {
  const path = buildSparklinePath(points);
  if (!path) {
    return <span className="text-xs text-text-muted">-</span>;
  }

  const color = positive ? "#16a34a" : "#ef4444";
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-[104px]"
      preserveAspectRatio="none"
      viewBox="0 0 96 30"
    >
      <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function SnapshotTable({
  market,
  rows,
  sparklineByInstrument,
  totalRows,
  startRow,
  endRow,
  highlightInstrument,
  sort,
  onSortChange,
  onOpenDetail,
}: SnapshotTableProps) {
  const sortIcon = (field: SnapshotSortField) => {
    if (sort.field !== field) return "↕";
    return sort.direction === "asc" ? "↑" : "↓";
  };

  return (
    <section className="card-shell overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="table-head">
              <th className="px-6 py-3 text-left">
                <button
                  className={`inline-flex items-center gap-1 transition ${sort.field === "date" ? "text-text-main" : "hover:text-text-main"}`}
                  type="button"
                  onClick={() => onSortChange("date")}
                >
                  Fecha <span className="text-[11px]">{sortIcon("date")}</span>
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  className={`inline-flex items-center gap-1 transition ${sort.field === "instrument" ? "text-text-main" : "hover:text-text-main"}`}
                  type="button"
                  onClick={() => onSortChange("instrument")}
                >
                  Instrumento <span className="text-[11px]">{sortIcon("instrument")}</span>
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  className={`ml-auto inline-flex items-center gap-1 transition ${sort.field === "open" ? "text-text-main" : "hover:text-text-main"}`}
                  type="button"
                  onClick={() => onSortChange("open")}
                >
                  Apertura <span className="text-[11px]">{sortIcon("open")}</span>
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  className={`ml-auto inline-flex items-center gap-1 transition ${sort.field === "high" ? "text-text-main" : "hover:text-text-main"}`}
                  type="button"
                  onClick={() => onSortChange("high")}
                >
                  Maximo <span className="text-[11px]">{sortIcon("high")}</span>
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  className={`ml-auto inline-flex items-center gap-1 transition ${sort.field === "low" ? "text-text-main" : "hover:text-text-main"}`}
                  type="button"
                  onClick={() => onSortChange("low")}
                >
                  Minimo <span className="text-[11px]">{sortIcon("low")}</span>
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  className={`ml-auto inline-flex items-center gap-1 transition ${sort.field === "close" ? "text-text-main" : "hover:text-text-main"}`}
                  type="button"
                  onClick={() => onSortChange("close")}
                >
                  Cierre <span className="text-[11px]">{sortIcon("close")}</span>
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  className={`ml-auto inline-flex items-center gap-1 transition ${sort.field === "change_pct" ? "text-text-main" : "hover:text-text-main"}`}
                  type="button"
                  onClick={() => onSortChange("change_pct")}
                >
                  Cambio % <span className="text-[11px]">{sortIcon("change_pct")}</span>
                </button>
              </th>
              <th className="px-6 py-3 text-center">Tendencia</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border-light text-sm">
            {rows.map((row) => {
              const isTop = row.instrument === highlightInstrument;
              const positive = (row.change_pct ?? 0) >= 0;
              const pInfo = market === "monedas" ? pairInfo(row.displayInstrument) : null;
              const icon = market === "indices_etfs" ? instrumentIcon(row.displayInstrument, market) : null;
              const sparkPoints = sparklineByInstrument[row.instrument] || [];
              const sparkPositive =
                sparkPoints.length >= 2
                  ? sparkPoints[sparkPoints.length - 1] >= sparkPoints[0]
                  : positive;

              return (
                <tr
                  key={`${row.instrument}-${row.date}`}
                  className={`group transition-colors ${isTop ? "bg-green-50/50" : "hover:bg-gray-50"}`}
                >
                  <td className="table-cell-mono px-6 py-2.5 text-text-muted">{row.date}</td>

                  <td className="px-6 py-2.5">
                    <button
                      className="inline-flex items-center gap-2 font-semibold text-text-main transition hover:text-primary"
                      type="button"
                      onClick={() => onOpenDetail(row.instrument, row.isInverted)}
                    >
                      {icon && <span className="text-base leading-none">{icon}</span>}
                      {pInfo && (
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: currencyColor(pInfo.base) }}
                        />
                      )}
                      {market === "monedas" && <CurrencyPairPill pair={row.displayInstrument} />}
                      <span>{row.displayInstrument}</span>
                    </button>
                  </td>

                  <td className="table-cell-mono px-6 py-2.5 text-right text-slate-600">{formatFixed(row.open)}</td>
                  <td className="table-cell-mono px-6 py-2.5 text-right text-slate-600">{formatFixed(row.high)}</td>
                  <td className="table-cell-mono px-6 py-2.5 text-right text-slate-600">{formatFixed(row.low)}</td>
                  <td className="table-cell-mono px-6 py-2.5 text-right font-semibold text-text-main">
                    {formatFixed(row.close)}
                  </td>
                  <td
                    className={`table-cell-mono px-6 py-2.5 text-right font-semibold ${
                      positive ? "text-primary" : "text-accent-red"
                    }`}
                  >
                    {formatPct(row.change_pct)}
                  </td>
                  <td className="px-6 py-2.5 text-center">
                    <div className="flex justify-center">
                      <Sparkline points={sparkPoints} positive={sparkPositive} />
                    </div>
                  </td>
                </tr>
              );
            })}

            {!rows.length && (
              <tr>
                <td className="px-6 py-10 text-center text-sm text-text-muted" colSpan={8}>
                  No hay datos para mostrar con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border-light bg-gray-50/50 px-6 py-4 text-sm text-text-muted">
        <span>
          Mostrando <span className="font-semibold text-text-main">{startRow}</span> a{" "}
          <span className="font-semibold text-text-main">{endRow}</span> de{" "}
          <span className="font-semibold text-text-main">{totalRows}</span> resultados
        </span>
        <span>Conexion en vivo</span>
      </div>
    </section>
  );
}
