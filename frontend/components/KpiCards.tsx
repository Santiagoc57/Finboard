import { SnapshotViewRow } from "@/hooks/useSnapshotTable";
import { CurrencyPairPill } from "@/components/CurrencyPairPill";
import { formatPct } from "@/lib/format";
import { instrumentIcon } from "@/lib/instrument";
import { MarketCode } from "@/types/dashboard";

interface KpiCardsProps {
  market: MarketCode;
  rows: SnapshotViewRow[];
  failures: string[];
  showSystemCards: boolean;
}

export function KpiCards({ market, rows, failures, showSystemCards }: KpiCardsProps) {
  const validRows = rows.filter((row) => row.change_pct !== null);
  const gain = validRows.length
    ? validRows.reduce((best, row) => ((row.change_pct ?? -Infinity) > (best.change_pct ?? -Infinity) ? row : best))
    : null;
  const loss = validRows.length
    ? validRows.reduce((worst, row) => ((row.change_pct ?? Infinity) < (worst.change_pct ?? Infinity) ? row : worst))
    : null;

  const volatilityAlerts = validRows.filter((row) => Math.abs(row.change_pct ?? 0) >= 2).length;
  const criticalAlerts = failures.length + volatilityAlerts;

  return (
    <section className={`mt-8 grid grid-cols-1 gap-4 ${showSystemCards ? "md:grid-cols-4" : "md:grid-cols-2"}`}>
      <article className="card-shell p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Mayor Ganancia (24h)</p>
        <div className="mt-2 flex items-center gap-2">
          {gain?.displayInstrument && <span className="text-base">{instrumentIcon(gain.displayInstrument, market)}</span>}
          {gain?.displayInstrument && <CurrencyPairPill pair={gain.displayInstrument} />}
          <p className="text-xl font-bold tracking-tight text-text-main">{gain?.displayInstrument ?? "-"}</p>
        </div>
        <p className="text-sm font-semibold text-primary">{formatPct(gain?.change_pct ?? null)}</p>
      </article>

      <article className="card-shell p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Mayor Perdida (24h)</p>
        <div className="mt-2 flex items-center gap-2">
          {loss?.displayInstrument && <span className="text-base">{instrumentIcon(loss.displayInstrument, market)}</span>}
          {loss?.displayInstrument && <CurrencyPairPill pair={loss.displayInstrument} />}
          <p className="text-xl font-bold tracking-tight text-text-main">{loss?.displayInstrument ?? "-"}</p>
        </div>
        <p className="text-sm font-semibold text-accent-red">{formatPct(loss?.change_pct ?? null)}</p>
      </article>

      {showSystemCards && (
        <>
          <article className="card-shell p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Alertas Activas</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-text-main">{criticalAlerts}</p>
            <p className="text-sm text-text-muted">Incluye fallos de carga y volatilidad</p>
          </article>

          <article className="card-shell p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Estado del Sistema</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-text-main">
              {failures.length ? "Con incidencias" : "Saludable"}
            </p>
            <p className="text-sm text-text-muted">Latencia: 12ms</p>
          </article>
        </>
      )}
    </section>
  );
}
