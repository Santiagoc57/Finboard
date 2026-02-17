import { ChangeEvent, useMemo } from "react";

import { DateTripletInput } from "@/components/DateTripletInput";
import { pairInfo } from "@/lib/currency";
import { toDateInputValue } from "@/lib/date";
import { instrumentIcon } from "@/lib/instrument";
import { AssetItem, DashboardQuery, Preset } from "@/types/dashboard";

interface ConfigPanelProps {
  query: DashboardQuery;
  catalog: AssetItem[];
  assetsLoaded: string[];
  loading: boolean;
  onPatch: (patch: Partial<DashboardQuery>) => void;
  onPresetChange: (preset: Preset) => void;
  onLoad: () => void;
}

const presetOptions: Preset[] = ["Custom", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"];

export function ConfigPanel({
  query,
  catalog,
  assetsLoaded,
  loading,
  onPatch,
  onPresetChange,
  onLoad,
}: ConfigPanelProps) {
  const todayIso = useMemo(() => toDateInputValue(new Date()), []);

  const onMultiSelect = (event: ChangeEvent<HTMLSelectElement>, key: "selectedAssets" | "includedAssets") => {
    const values = Array.from(event.target.selectedOptions, (option) => option.value);
    onPatch({ [key]: values });
  };

  const fullCatalog: AssetItem[] = (() => {
    const map = new Map<string, AssetItem>();
    for (const item of catalog) map.set(item.label, item);
    for (const item of query.customAssets) {
      if (!map.has(item.label)) {
        map.set(item.label, {
          label: item.label,
          source: item.source,
          symbol: item.symbol,
        });
      }
    }
    return Array.from(map.values());
  })();

  return (
    <section className="mb-4 card-shell p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm font-medium text-text-muted">
          Preset
          <select
            className="mt-1 w-full rounded-lg border border-border-light bg-white p-2 text-sm"
            value={query.preset}
            onChange={(e) => onPresetChange(e.target.value as Preset)}
          >
            {presetOptions.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-text-muted">
          Desde
          <DateTripletInput
            disabled={loading}
            maxDate={todayIso}
            value={query.startDate}
            onChange={(next) => {
              if (!next) return;
              onPatch({ startDate: next, preset: "Custom" });
            }}
          />
        </label>

        <label className="text-sm font-medium text-text-muted">
          Hasta
          <DateTripletInput
            disabled={loading}
            maxDate={todayIso}
            value={query.endDate}
            onChange={(next) => {
              if (!next) return;
              onPatch({ endDate: next, preset: "Custom" });
            }}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="text-sm font-medium text-text-muted">
          Frecuencia
          <select
            className="mt-1 w-full rounded-lg border border-border-light bg-white p-2 text-sm"
            value={query.frequency}
            onChange={(e) => onPatch({ frequency: e.target.value as DashboardQuery["frequency"] })}
          >
            <option value="D">Diaria</option>
            <option value="W">Semanal (viernes)</option>
            <option value="M">Mensual (ultimo)</option>
          </select>
        </label>

        <label className="mt-7 inline-flex items-center gap-2 text-sm text-text-main">
          <input
            checked={query.excludeWeekends}
            className="h-4 w-4 rounded border-border-light"
            type="checkbox"
            onChange={(e) => onPatch({ excludeWeekends: e.target.checked })}
          />
          Excluir fines de semana (D -&gt; B)
        </label>

        <button
          className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
          disabled={loading}
          type="button"
          onClick={onLoad}
        >
          {loading ? "Cargando..." : "Actualizar datos"}
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium text-text-muted">
          Activos seleccionados
          <select
            className="mt-1 h-40 w-full rounded-lg border border-border-light bg-white p-2 text-sm"
            multiple
            value={query.selectedAssets}
            onChange={(event) => onMultiSelect(event, "selectedAssets")}
          >
            {fullCatalog.map((asset) => (
              <option key={asset.label} value={asset.label}>
                {(() => {
                  const pInfo = pairInfo(asset.label);
                  const icon = pInfo
                    ? `${pInfo.baseFlag}/${pInfo.quoteFlag} `
                    : `${instrumentIcon(asset.label, query.market) ?? ""} `;
                  return `${icon}${asset.label} (${asset.source}:${asset.symbol})`;
                })()}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-text-muted">
          Series incluidas
          <select
            className="mt-1 h-40 w-full rounded-lg border border-border-light bg-white p-2 text-sm"
            multiple
            value={query.includedAssets}
            onChange={(event) => onMultiSelect(event, "includedAssets")}
          >
            {assetsLoaded.map((label) => (
              <option key={label} value={label}>
                {(() => {
                  const pInfo = pairInfo(label);
                  const icon = pInfo
                    ? `${pInfo.baseFlag}/${pInfo.quoteFlag} `
                    : `${instrumentIcon(label, query.market) ?? ""} `;
                  return `${icon}${label}`;
                })()}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
