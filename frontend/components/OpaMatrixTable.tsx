import React, { useRef, useState, useEffect } from "react";
import { instrumentIcon } from "@/lib/instrument";
import { MarketCode, SeriesRow } from "@/types/dashboard";
import { formatFixed, formatPct } from "@/lib/format";

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

interface OpaMatrixTableProps {
    market: MarketCode;
    viewRows: SeriesRow[];
    opaPrices: Record<string, number>;
    opaDate: string;
    tickerItems: {
        instrument: string;
        displayInstrument: string;
        change_pct: number | null;
        sparkline: number[];
    }[];
    showHeatmap: boolean;
}

export function OpaMatrixTable({ market, viewRows, opaPrices, opaDate, tickerItems, showHeatmap }: OpaMatrixTableProps) {
    // Find index of the OPA Date so we don't render rows from BEFORE the OPA date if desired.
    // The user said "evolucionó en adelante", but standard Base 100 might show backwards too. Let's just show everything.
    const activeInstruments = Object.keys(opaPrices);

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
    }, [viewRows, opaPrices]);

    if (!opaDate || Object.keys(opaPrices).length === 0) {
        return (
            <div className="card-shell p-10 text-center text-text-muted">
                Selecciona una Fecha OPA (Base) en el panel superior para ver la matriz de evolución.
            </div>
        );
    }

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
                className="max-h-[820px] overflow-auto flex-1 custom-scrollbar"
                onScroll={handleBottomScroll}
            >
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="table-head">
                            <th
                                rowSpan={2}
                                className="sticky-col sticky left-0 z-20 min-w-[120px] border-b border-border-light bg-gray-50/95 px-4 py-3 text-left font-semibold text-text-main shadow-[1px_0_0_0_#e2e8f0]"
                            >
                                Fecha
                            </th>
                            {activeInstruments.map((instrument) => {
                                const tickerData = tickerItems.find(t => t.instrument === instrument);
                                const points = tickerData?.sparkline || [];
                                const path = sparklinePath(points);
                                const positive = points.length > 1 ? points[points.length - 1] >= points[0] : true;
                                const icon = instrumentIcon(instrument, market);
                                const displayName = tickerData?.displayInstrument || instrument;

                                return (
                                    <th
                                        key={`header-${instrument}`}
                                        colSpan={4}
                                        className="border-b border-border-light bg-white px-3 py-2 text-center"
                                    >
                                        <div className="flex flex-col items-center justify-center gap-0.5">
                                            <div className="inline-flex items-center gap-1.5 font-bold normal-case tracking-normal text-text-main text-[13px]">
                                                {icon && <span className="text-sm">{icon}</span>}
                                                <span>{displayName}</span>
                                            </div>
                                            {path && (
                                                <svg className="h-5 w-[72px]" preserveAspectRatio="none" viewBox="0 0 72 22">
                                                    <path
                                                        d={path}
                                                        fill="none"
                                                        stroke={positive ? "#16a34a" : "#dc2626"}
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
                        <tr className="table-head">
                            {activeInstruments.map((instrument) => (
                                <React.Fragment key={`subheader-${instrument}-group`}>
                                    <th className="border-b border-border-light bg-gray-50/50 px-2 py-2 text-center text-[10px] uppercase font-medium text-text-muted">
                                        Index
                                    </th>
                                    <th className="border-b border-border-light bg-gray-50/50 px-2 py-2 text-center text-[10px] uppercase font-medium text-text-muted">
                                        Var
                                    </th>
                                    <th className="border-b border-border-light bg-gray-50/50 px-2 py-2 text-center text-[10px] uppercase font-medium text-text-muted">
                                        % Opa
                                    </th>
                                    <th className="border-b border-border-light bg-gray-50/50 px-2 py-2 text-center text-[10px] uppercase font-medium text-text-muted border-r border-border-light">
                                        Vs Opa
                                    </th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light text-sm">
                        {viewRows.map((row, i) => {
                            const dateStr = String(row.date);
                            const isOpaDate = dateStr === opaDate;
                            // To calculate basic 'Var', we need the next chronological row (which is i+1 since dates are descending)
                            const prevRow = i < viewRows.length - 1 ? viewRows[i + 1] : null;

                            return (
                                <tr key={`matrix-row-${dateStr}`} className={`group hover:bg-gray-50 ${isOpaDate ? "bg-green-50/30" : ""}`}>
                                    <td className="sticky-col sticky left-0 z-10 min-w-[120px] whitespace-nowrap border-r border-slate-300 bg-white px-4 py-2 font-mono text-text-main shadow-[1px_0_0_0_#cbd5e1] group-hover:bg-gray-50">
                                        <div className="flex items-center gap-2">
                                            {dateStr}
                                            {isOpaDate && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-primary">OPA</span>}
                                        </div>
                                    </td>

                                    {activeInstruments.map((instrument) => {
                                        const basePrice = opaPrices[instrument];
                                        const rawValue = row[instrument];
                                        const prevValue = prevRow ? prevRow[instrument] : null;

                                        let indexVal = "-";
                                        let varPct = "-";
                                        let vsOpa = "-";
                                        let pctOpa = "-";

                                        let vsOpaNum: number | null = null;

                                        if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
                                            indexVal = formatFixed(rawValue) as string;

                                            // "Var" is day over day variation
                                            if (typeof prevValue === "number" && Number.isFinite(prevValue) && prevValue !== 0) {
                                                varPct = formatPct((rawValue / prevValue) - 1) as string;
                                            }

                                            if (basePrice !== 0 && typeof basePrice === "number") {
                                                vsOpaNum = (rawValue / basePrice) * 100;
                                                // Round "Vs Opa" to 2 decimals like in Excel (100.00, 101.61)
                                                vsOpa = (Math.round(vsOpaNum * 100) / 100).toFixed(2);
                                                pctOpa = formatPct((rawValue / basePrice) - 1) as string;
                                            }
                                        }

                                        const isBest = vsOpaNum !== null && vsOpaNum > 100;
                                        const isWorst = vsOpaNum !== null && vsOpaNum < 100;

                                        const varPctNum = varPct !== "-" ? parseFloat(varPct) : null;
                                        const isVarPos = varPctNum !== null && varPctNum > 0;
                                        const isVarNeg = varPctNum !== null && varPctNum < 0;

                                        const scorePct = vsOpaNum !== null ? vsOpaNum - 100 : null; // Base 100 heat measure. Over 100 is green, under is red.

                                        return (
                                            <React.Fragment key={`cell-${dateStr}-${instrument}`}>
                                                <td className={`px-2 py-2 text-center text-xs table-cell-mono ${showHeatmap ? heatCellClass(scorePct) : "text-slate-500"}`}>
                                                    {indexVal}
                                                </td>
                                                <td className={`px-2 py-2 text-center text-xs table-cell-mono ${showHeatmap ? heatCellClass(scorePct) : isVarPos ? "text-primary" : isVarNeg ? "text-accent-red" : "text-slate-500"}`}>
                                                    {varPct}
                                                </td>
                                                <td className={`px-2 py-2 text-center text-xs table-cell-mono ${showHeatmap ? heatCellClass(scorePct) : isOpaDate ? "" : isBest ? "text-primary" : isWorst ? "text-accent-red" : "text-slate-500"}`}>
                                                    {isOpaDate ? "" : pctOpa}
                                                </td>
                                                <td className={`px-2 py-2 text-center font-medium text-xs table-cell-mono border-r border-border-light last:border-r-0 ${showHeatmap ? heatCellClass(scorePct) : isOpaDate ? "text-text-main" : isBest ? "text-primary" : isWorst ? "text-accent-red" : "text-slate-700"}`}>
                                                    {vsOpa}
                                                </td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>
                            );
                        })}

                        {activeInstruments.length === 0 && (
                            <tr>
                                <td className="px-6 py-8 text-center" colSpan={viewRows.length + 1}>
                                    No hay datos para calcular la matriz con los filtros actuales
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
