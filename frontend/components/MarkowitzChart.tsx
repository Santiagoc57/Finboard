/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { MarkowitzPoint } from "@/types/dashboard";

interface MarkowitzChartProps {
    data: MarkowitzPoint[];
    loading: boolean;
}

const TIPO_COLORS: Record<string, { badge: string; bar: string }> = {
    "Max Sharpe": { badge: "bg-blue-100 text-blue-700 border-blue-300", bar: "#3b82f6" },
    "Min Volatilidad": { badge: "bg-green-100 text-green-700 border-green-300", bar: "#10b981" },
    Random: { badge: "bg-gray-100 text-gray-500 border-gray-200", bar: "#94a3b8" },
};

function TooltipCard({ data, pinned }: { data: MarkowitzPoint; pinned?: boolean }) {
    const colors = TIPO_COLORS[data.tipo] ?? TIPO_COLORS["Random"];
    const sorted = Object.entries(data.pesos).sort((a, b) => b[1] - a[1]);
    const maxW = sorted[0]?.[1] ?? 1;

    return (
        <div
            className="rounded-xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur-sm"
            style={{ minWidth: 260, maxWidth: 320, padding: "14px 16px" }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    {pinned ? "📌 Portafolio fijado" : "Portafolio"}
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${colors.badge}`}>
                    {data.tipo}
                </span>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Retorno</p>
                    <p className={`text-sm font-bold ${data.retorno >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {data.retorno >= 0 ? "+" : ""}{data.retorno.toFixed(1)}%
                    </p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Volatilidad</p>
                    <p className="text-sm font-bold text-gray-700">{data.volatilidad.toFixed(1)}%</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Sharpe</p>
                    <p className={`text-sm font-bold ${data.sharpe >= 1 ? "text-blue-600" : data.sharpe >= 0 ? "text-gray-700" : "text-red-500"}`}>
                        {data.sharpe.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Pesos con barras */}
            <div className="border-t border-gray-100 pt-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-semibold">Composición</p>
                <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {sorted.filter(([, w]) => w > 0.1).map(([asset, weight]) => (
                        <li key={asset}>
                            <div className="flex justify-between text-[11px] mb-0.5">
                                <span className="text-gray-600 truncate max-w-[160px]" title={asset}>{asset}</span>
                                <span className="font-semibold text-gray-800 ml-2">{weight.toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{ width: `${(weight / maxW) * 100}%`, backgroundColor: colors.bar }}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
                {pinned && (
                    <p className="text-[10px] text-gray-400 mt-2 text-center">
                        Clic fuera o en otro punto para cerrar
                    </p>
                )}
            </div>
        </div>
    );
}

/** Hover tooltip — shown by Recharts */
const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return <TooltipCard data={payload[0].payload as MarkowitzPoint} />;
};

export function MarkowitzChart({ data, loading }: MarkowitzChartProps) {
    const [pinned, setPinned] = useState<MarkowitzPoint | null>(null);
    const [pinnedPos, setPinnedPos] = useState<{ x: number; y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { randomData, maxSharpeData, minVolData } = useMemo(() => {
        const randomData: MarkowitzPoint[] = [];
        const maxSharpeData: MarkowitzPoint[] = [];
        const minVolData: MarkowitzPoint[] = [];
        data.forEach(p => {
            if (p.tipo === "Max Sharpe") maxSharpeData.push(p);
            else if (p.tipo === "Min Volatilidad") minVolData.push(p);
            else randomData.push(p);
        });
        return { randomData, maxSharpeData, minVolData };
    }, [data]);

    // Click outside → unpin
    useEffect(() => {
        if (!pinned) return;
        function onDocClick(e: MouseEvent) {
            const pinnedEl = document.getElementById("markowitz-pinned-tooltip");
            if (pinnedEl && pinnedEl.contains(e.target as Node)) return;
            // If click is on the chart scatter area, let the chart handler decide
            setPinned(null);
            setPinnedPos(null);
        }
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [pinned]);

    function handleScatterClick(scatterData: any, _idx: number, e: React.MouseEvent) {
        if (!scatterData) return;
        e.stopPropagation();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const point = scatterData as MarkowitzPoint;
        if (pinned === point) {
            setPinned(null);
            setPinnedPos(null);
        } else {
            setPinned(point);
            setPinnedPos({ x, y });
        }
    }

    if (loading) {
        return (
            <div className="card-shell flex h-[600px] items-center justify-center p-10 text-center text-text-muted">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary"></div>
                    <p>Simulando miles de portafolios de Markowitz...</p>
                </div>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="card-shell p-10 text-center text-text-muted">
                No hay datos calculados para la Frontera Eficiente. Selecciona más instrumentos o amplía el rango temporal.
            </div>
        );
    }

    // Clamp pinned tooltip so it doesn't overflow the container
    function pinnedStyle(): React.CSSProperties {
        if (!pinnedPos) return {};
        const containerW = containerRef.current?.offsetWidth ?? 800;
        const containerH = containerRef.current?.offsetHeight ?? 650;
        let left = pinnedPos.x + 12;
        let top = pinnedPos.y + 12;
        if (left + 340 > containerW) left = pinnedPos.x - 340;
        if (top + 420 > containerH) top = pinnedPos.y - 420;
        return { position: "absolute", left, top, zIndex: 50, pointerEvents: "auto" };
    }

    return (
        <section
            className="card-shell overflow-hidden p-4 md:p-6"
            style={{ height: "650px", position: "relative" }}
            ref={containerRef}
        >
            <div className="mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
                    Frontera Eficiente de Markowitz
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                    Simulación de Monte Carlo ({data.length} portafolios) — <span className="font-medium text-gray-600">Clic en un punto para fijar su composición.</span>
                </p>
            </div>

            <div className="h-[520px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                            type="number"
                            dataKey="volatilidad"
                            name="Volatilidad"
                            unit="%"
                            domain={['auto', 'auto']}
                            tick={{ fontSize: 12, fill: "#64748b" }}
                            label={{ value: 'Riesgo / Volatilidad Anualizada (%)', position: 'insideBottom', offset: -10, fontSize: 13, fill: '#475569' }}
                        />
                        <YAxis
                            type="number"
                            dataKey="retorno"
                            name="Retorno Esperado"
                            unit="%"
                            domain={['auto', 'auto']}
                            tick={{ fontSize: 12, fill: "#64748b" }}
                            label={{ value: 'Retorno Esperado Anualizado (%)', angle: -90, position: 'insideLeft', fontSize: 13, fill: '#475569' }}
                        />
                        {/* Only show hover tooltip when nothing is pinned */}
                        {!pinned && <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />}
                        <Legend wrapperStyle={{ paddingTop: "20px" }} />

                        <Scatter
                            name="Portafolios Simulados"
                            data={randomData}
                            fill="#94a3b8"
                            opacity={0.4}
                            line={false}
                            shape="circle"
                            onClick={handleScatterClick}
                            style={{ cursor: "pointer" }}
                        />
                        <Scatter
                            name="Mínima Varianza"
                            data={minVolData}
                            fill="#10b981"
                            shape="circle"
                            r={7}
                            onClick={handleScatterClick}
                            style={{ cursor: "pointer" }}
                        />
                        <Scatter
                            name="Máximo Sharpe"
                            data={maxSharpeData}
                            fill="#3b82f6"
                            shape="star"
                            r={8}
                            onClick={handleScatterClick}
                            style={{ cursor: "pointer" }}
                        />
                    </ScatterChart>
                </ResponsiveContainer>
            </div>

            {/* Pinned tooltip — rendered outside Recharts DOM */}
            {pinned && pinnedPos && (
                <div id="markowitz-pinned-tooltip" style={pinnedStyle()}>
                    <TooltipCard data={pinned} pinned />
                </div>
            )}
        </section>
    );
}
