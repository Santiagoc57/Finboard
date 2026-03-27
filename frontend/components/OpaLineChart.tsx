/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceArea,
} from "recharts";
import { MarketCode, SeriesRow } from "@/types/dashboard";
import { instrumentCategory, InstrumentCategory } from "@/lib/instrument";

const COLORS = [
    "#10b981", // green-500
    "#3b82f6", // blue-500
    "#f59e0b", // amber-500
    "#ef4444", // red-500
    "#8b5cf6", // violet-500
    "#ec4899", // pink-500
    "#06b6d4", // cyan-500
    "#14b8a6", // teal-500
    "#f97316", // orange-500
    "#6366f1", // indigo-500
];

interface OpaLineChartProps {
    market: MarketCode;
    viewRows: SeriesRow[];
    opaPrices: Record<string, number>;
    opaDate: string;
}

export function OpaLineChart({ market, viewRows, opaPrices, opaDate }: OpaLineChartProps) {
    const activeInstruments = Object.keys(opaPrices);

    const allCategories: InstrumentCategory[] = ["Índices", "ETFs", "Materias Primas", "Criptomonedas", "Otros"];
    const [selectedCategories, setSelectedCategories] = useState<InstrumentCategory[]>(allCategories);

    // --- Zoom state ---
    const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
    const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [zoomedDomain, setZoomedDomain] = useState<[string, string] | null>(null);

    function startSelect(e: any) {
        const date = e?.activeLabel;
        if (!date) return;
        setRefAreaLeft(date);
        setRefAreaRight(null);
        setIsSelecting(true);
    }
    function moveSelect(e: any) {
        if (!isSelecting) return;
        const date = e?.activeLabel;
        if (date) setRefAreaRight(date);
    }
    function endSelect() {
        if (!isSelecting) return;
        setIsSelecting(false);
        if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
            const sorted = [refAreaLeft, refAreaRight].sort();
            setZoomedDomain([sorted[0], sorted[1]]);
        }
        setRefAreaLeft(null);
        setRefAreaRight(null);
    }
    function resetZoom() {
        setZoomedDomain(null);
        setRefAreaLeft(null);
        setRefAreaRight(null);
    }

    const toggleCategory = (cat: InstrumentCategory) => {
        setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const visibleInstruments = useMemo(() => {
        return activeInstruments.filter(inst => {
            const cat = instrumentCategory(inst, market);
            return selectedCategories.includes(cat);
        });
    }, [activeInstruments, selectedCategories, market]);

    const chartData = useMemo(() => {
        if (!opaDate || activeInstruments.length === 0 || viewRows.length === 0) return [];

        // Ensure chronological order (oldest to newest) for left-to-right plotting
        const ascendingRows = [...viewRows].sort((a, b) => new Date(String(a.date)).getTime() - new Date(String(b.date)).getTime());

        const mapped = ascendingRows.map((row) => {
            const dataPoint: Record<string, any> = { date: String(row.date) };
            for (const instrument of activeInstruments) {
                const rawVal = row[instrument];
                const price = typeof rawVal === "number" && Number.isFinite(rawVal) ? rawVal : null;
                const opaPrice = opaPrices[instrument];
                dataPoint[instrument] = (price !== null && opaPrice && opaPrice !== 0)
                    ? (price / opaPrice) * 100
                    : null;
            }
            return dataPoint;
        });

        // Apply zoom domain filter
        if (zoomedDomain) {
            return mapped.filter(d => d.date >= zoomedDomain[0] && d.date <= zoomedDomain[1]);
        }
        return mapped;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewRows, opaPrices, opaDate, zoomedDomain]);

    if (!opaDate || activeInstruments.length === 0) {
        return (
            <div className="card-shell p-10 text-center text-text-muted">
                Selecciona una Fecha OPA (Base) en el panel superior para ver la gráfica de evolución.
            </div>
        );
    }

    if (chartData.length === 0) {
        return (
            <div className="card-shell p-10 text-center text-text-muted">
                No hay datos suficientes para graficar el rango seleccionado.
            </div>
        );
    }

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear().toString().slice(-2)}`;
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;

        const sorted = [...payload]
            .filter((p: any) => p.value != null)
            .sort((a: any, b: any) => b.value - a.value);

        return (
            <div style={{ borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "10px 14px", minWidth: 200 }}>
                <p style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Fecha: {label}</p>
                {sorted.map((entry: any) => (
                    <div key={entry.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                        <span style={{ color: entry.stroke ?? entry.color }}>{entry.name}</span>
                        <span style={{ color: "#0f172a" }}>{typeof entry.value === "number" ? entry.value.toFixed(2) : entry.value}</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <section className="card-shell overflow-hidden p-4 md:p-6" style={{ height: "650px" }}>
            <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
                        Evolución Base 100
                    </h3>
                    {zoomedDomain && (
                        <button
                            onClick={resetZoom}
                            className="text-xs font-semibold text-primary border border-primary/30 rounded-full px-3 py-0.5 bg-primary/5 hover:bg-primary/10 transition"
                        >
                            ↩ Reset zoom
                        </button>
                    )}
                    {!zoomedDomain && (
                        <span className="text-[11px] text-gray-400 hidden md:inline">Arrastra en la gráfica para hacer zoom</span>
                    )}
                </div>

                {/* Category Toggles */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setSelectedCategories(
                            selectedCategories.length === allCategories.length ? [] : allCategories
                        )}
                        className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${selectedCategories.length === allCategories.length
                            ? "bg-text-main text-white border-text-main shadow-sm"
                            : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                            }`}
                    >
                        Todos
                    </button>
                    {allCategories.map(cat => {
                        const isActive = selectedCategories.includes(cat);
                        // Only show the toggle if there is at least one active instrument in this category
                        const hasInstruments = activeInstruments.some(inst => instrumentCategory(inst, market) === cat);
                        if (!hasInstruments) return null;

                        return (
                            <button
                                key={cat}
                                onClick={() => toggleCategory(cat)}
                                className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${isActive
                                    ? "bg-primary text-white border-primary shadow-sm"
                                    : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                                    }`}
                            >
                                {cat}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="h-[520px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                        onMouseDown={startSelect}
                        onMouseMove={moveSelect}
                        onMouseUp={endSelect}
                        style={{ userSelect: "none" }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatDate}
                            tick={{ fontSize: 12, fill: "#64748b" }}
                            tickMargin={12}
                            minTickGap={30}
                            axisLine={false}
                            tickLine={false}
                            allowDataOverflow
                        />
                        <YAxis
                            domain={['auto', 'auto']}
                            tick={{ fontSize: 12, fill: "#64748b" }}
                            tickMargin={8}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val) => val.toFixed(0)}
                            allowDataOverflow
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ paddingTop: "20px" }}
                            iconType="circle"
                            iconSize={8}
                        />
                        {visibleInstruments
                            .sort((a, b) => {
                                const lastPoint = chartData[chartData.length - 1];
                                const valA = lastPoint ? (lastPoint[a] as number ?? -Infinity) : 0;
                                const valB = lastPoint ? (lastPoint[b] as number ?? -Infinity) : 0;
                                return valB - valA;
                            })
                            .map((instrument) => (
                                <Line
                                    key={instrument}
                                    type="monotone"
                                    dataKey={instrument}
                                    name={instrument}
                                    stroke={COLORS[activeInstruments.indexOf(instrument) % COLORS.length]}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                    connectNulls
                                    isAnimationActive={false}
                                />
                            ))}
                        {/* Zoom selection area */}
                        {isSelecting && refAreaLeft && refAreaRight && (
                            <ReferenceArea
                                x1={refAreaLeft}
                                x2={refAreaRight}
                                strokeOpacity={0.3}
                                fill="#3b82f6"
                                fillOpacity={0.15}
                            />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}
