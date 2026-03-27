import { instrumentIcon } from "@/lib/instrument";
import { CurrencyPairPill } from "@/components/CurrencyPairPill";
import { MarketCode } from "@/types/dashboard";

interface SparklineProps {
    points: number[];
    positive: boolean;
}

function buildSparklinePath(points: number[], width = 60, height = 24): string {
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
            className="h-6 w-[60px]"
            preserveAspectRatio="none"
            viewBox="0 0 60 24"
        >
            <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
    );
}

interface HorizontalTickerProps {
    market: MarketCode;
    items: {
        instrument: string;
        displayInstrument: string;
        change_pct: number | null;
        sparkline: number[];
    }[];
}

export function HorizontalTicker({ market, items }: HorizontalTickerProps) {
    if (!items.length) return null;

    // Double the items so the marquee loops seamlessly
    const marqueeItems = [...items, ...items];

    return (
        <div className="flex w-full overflow-hidden border-b border-border-light bg-white py-2 shadow-sm">
            <div className="flex animate-marquee items-center gap-8 whitespace-nowrap pl-8 hover:[animation-play-state:paused]">
                {marqueeItems.map((item, idx) => {
                    const isPositive = (item.change_pct ?? 0) >= 0;
                    const sparkPositive =
                        item.sparkline.length >= 2
                            ? item.sparkline[item.sparkline.length - 1] >= item.sparkline[0]
                            : isPositive;

                    return (
                        <div key={`${item.instrument}-${idx}`} className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1.5">
                                {market === "monedas" ? (
                                    <CurrencyPairPill pair={item.displayInstrument} />
                                ) : (
                                    <span className="text-sm">{instrumentIcon(item.displayInstrument, market)}</span>
                                )}
                                <span className="text-xs font-bold text-text-main">{item.displayInstrument}</span>
                            </div>
                            <Sparkline points={item.sparkline} positive={sparkPositive} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
