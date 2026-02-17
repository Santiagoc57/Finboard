import { pairInfo } from "@/lib/currency";

interface CurrencyPairPillProps {
  pair: string;
  className?: string;
}

export function CurrencyPairPill({ pair, className = "" }: CurrencyPairPillProps) {
  const info = pairInfo(pair);
  if (!info) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-border-light bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-text-muted ${className}`}
      title={`${info.base} / ${info.quote}`}
    >
      <span>{info.baseFlag}</span>
      <span className="text-[10px]">/</span>
      <span>{info.quoteFlag}</span>
    </span>
  );
}
