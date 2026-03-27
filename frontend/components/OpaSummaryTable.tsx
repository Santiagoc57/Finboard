import { formatFixed, formatPct } from "@/lib/format";
import { instrumentIcon, instrumentTooltip } from "@/lib/instrument";
import { MarketCode, RiskMetric } from "@/types/dashboard";

/** Column header with a tooltip shown on hover (dotted underline cue). */
function Th({ children, tip, className = "" }: { children: React.ReactNode; tip: string; className?: string }) {
    return (
        <th
            className={`px-6 py-3 text-right font-semibold text-text-main ${className}`}
            title={tip}
            style={{ cursor: "help" }}
        >
            <span style={{ borderBottom: "1px dotted #94a3b8", paddingBottom: 1 }}>{children}</span>
        </th>
    );
}

export interface OpaSummaryRow {
    instrument: string;
    opaPrice: number | null;
    currentPrice: number | null;
    evolution: number | null;
    changePct: number | null;
}

interface OpaSummaryTableProps {
    rows: OpaSummaryRow[];
    opaDate: string;
    market: MarketCode;
    riskMetrics?: RiskMetric[];
}

function SharpeCell({ sharpe }: { sharpe: number | null }) {
    if (sharpe === null) return <span className="text-slate-300">—</span>;
    const color = sharpe >= 1.5
        ? "text-emerald-600"
        : sharpe >= 0.5
            ? "text-sky-600"
            : sharpe >= 0
                ? "text-slate-500"
                : "text-red-500";
    return (
        <span title="Sharpe Ratio Anualizado (RF=2%)" className={`font-semibold ${color}`}>
            {sharpe.toFixed(2)}
        </span>
    );
}

function DrawdownCell({ dd }: { dd: number | null }) {
    if (dd === null) return <span className="text-slate-300">—</span>;
    const color = dd >= -10 ? "text-amber-600" : dd >= -25 ? "text-orange-600" : "text-red-600";
    const barWidth = Math.min(100, Math.abs(dd));
    return (
        <div className="flex flex-col items-end gap-0.5">
            <span title="Máxima caída desde el pico (Max Drawdown)" className={`font-semibold ${color}`}>
                {dd.toFixed(1)}%
            </span>
            <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full bg-current opacity-40"
                    style={{ width: `${barWidth}%`, backgroundColor: dd >= -10 ? "#d97706" : dd >= -25 ? "#ea580c" : "#dc2626" }}
                />
            </div>
        </div>
    );
}

export function OpaSummaryTable({ rows, opaDate, market, riskMetrics = [] }: OpaSummaryTableProps) {
    if (!opaDate) {
        return (
            <div className="card-shell p-10 text-center text-text-muted">
                Selecciona una Fecha OPA (Base) en el panel superior para ver la evolución.
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="card-shell p-10 text-center text-text-muted">
                No hay datos suficientes para calcular la evolución en la fecha seleccionada.
            </div>
        );
    }

    const riskMap = new Map(riskMetrics.map((r) => [r.instrument, r]));
    const hasRisk = riskMetrics.length > 0;

    return (
        <section className="card-shell overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse">
                    <thead>
                        <tr className="table-head">
                            <th className="px-6 py-3 text-left font-semibold text-text-main">
                                Instrumento
                            </th>
                            <Th tip="Precio del instrumento en la Fecha OPA elegida como base de comparación.">Precio OPA ({opaDate})</Th>
                            <Th tip="Último precio de cierre disponible.">Precio Actual</Th>
                            <Th tip="Evolución rebasada: 100 = precio de la fecha OPA. Si muestra 214, el precio subió 114% desde esa fecha.">Evolución (Base 100)</Th>
                            <Th tip="Variación porcentual acumulada desde la Fecha OPA hasta hoy.">Variación %</Th>
                            {hasRisk && (
                                <>
                                    <Th tip="Sharpe Ratio anualizado: mide el rendimiento ajustado por riesgo. Tasa libre de riesgo = 2%. Mayor es mejor.">Sharpe</Th>
                                    <Th tip="Max Drawdown: caída máxima desde el pico histórico en el período. Valores más negativos indican mayor riesgo.">Max Drawdown</Th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light text-sm">
                        {rows.map((row) => {
                            const bestPerformance = (row.evolution ?? 100) > 100;
                            const worstPerformance = (row.evolution ?? 100) < 100;
                            const risk = riskMap.get(row.instrument);

                            return (
                                <tr
                                    key={row.instrument}
                                    className="group transition-colors hover:bg-gray-50"
                                >
                                    <td className="px-6 py-3 font-semibold text-text-main flex items-center gap-2">
                                        <span
                                            className="text-lg cursor-help"
                                            title={instrumentTooltip(row.instrument)}
                                        >{instrumentIcon(row.instrument, market)}</span>
                                        {row.instrument}
                                    </td>
                                    <td className="table-cell-mono px-6 py-3 text-right text-slate-600">
                                        {formatFixed(row.opaPrice)}
                                    </td>
                                    <td className="table-cell-mono px-6 py-3 text-right text-slate-800">
                                        {formatFixed(row.currentPrice)}
                                    </td>
                                    <td
                                        className={`table-cell-mono px-6 py-3 text-right font-bold ${bestPerformance
                                            ? "text-primary"
                                            : worstPerformance
                                                ? "text-accent-red"
                                                : "text-slate-600"
                                            }`}
                                    >
                                        {formatFixed(row.evolution)}
                                    </td>
                                    <td
                                        className={`table-cell-mono px-6 py-3 text-right font-semibold ${bestPerformance
                                            ? "text-primary"
                                            : worstPerformance
                                                ? "text-accent-red"
                                                : "text-slate-500"
                                            }`}
                                    >
                                        {formatPct(row.changePct)}
                                    </td>
                                    {hasRisk && (
                                        <>
                                            <td className="table-cell-mono px-6 py-3 text-right">
                                                <SharpeCell sharpe={risk?.sharpe ?? null} />
                                            </td>
                                            <td className="table-cell-mono px-6 py-3 text-right">
                                                <DrawdownCell dd={risk?.max_drawdown ?? null} />
                                            </td>
                                        </>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
