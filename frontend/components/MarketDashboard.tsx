"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AddInstrumentModal } from "@/components/AddInstrumentModal";
import { ChipRow } from "@/components/ChipRow";
import { ConfigPanel } from "@/components/ConfigPanel";
import { MatrixTable } from "@/components/MatrixTable";
import { RangePickerPopover } from "@/components/RangePickerPopover";
import { SnapshotTable } from "@/components/SnapshotTable";
import { TopBar } from "@/components/TopBar";
import { useDashboardData } from "@/hooks/useDashboardData";
import {
  useSnapshotTable,
  SnapshotSortDirection,
  SnapshotSortField,
  SnapshotSortState,
} from "@/hooks/useSnapshotTable";
import { exportDashboard } from "@/lib/api";
import { presetDates, utcClockToBogotaLabel } from "@/lib/date";
import { readUiPrefs, writeUiPrefs } from "@/lib/prefs";
import { CustomAssetItem, DashboardQuery, MarketCode, Preset } from "@/types/dashboard";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const PAGE_COPY: Record<
  MarketCode,
  {
    title: string;
    description: string;
    invertLabel: string;
    recordsAsPairs: boolean;
  }
> = {
  indices_etfs: {
    title: "Datos de Indices / ETFs",
    description: "",
    invertLabel: "Inversion Global (1/x)",
    recordsAsPairs: false,
  },
  monedas: {
    title: "Datos de FX / Monedas",
    description:
      "Monitor de indices de monedas globales frente al USD con herramientas de inversion y analisis tecnico.",
    invertLabel: "Inversion Global (USD/X ↔ X/USD)",
    recordsAsPairs: true,
  },
};

interface MarketDashboardProps {
  market: MarketCode;
}

const SORT_FIELDS: SnapshotSortField[] = ["date", "instrument", "open", "high", "low", "close", "change_pct"];

function isSortField(value: string | undefined): value is SnapshotSortField {
  if (!value) return false;
  return SORT_FIELDS.includes(value as SnapshotSortField);
}

function isSortDirection(value: string | undefined): value is SnapshotSortDirection {
  return value === "asc" || value === "desc";
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildDailyTrendPoints(row: {
  prev_close: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
}): number[] {
  const prevClose = toFiniteNumber(row.prev_close);
  const open = toFiniteNumber(row.open);
  const high = toFiniteNumber(row.high);
  const low = toFiniteNumber(row.low);
  const close = toFiniteNumber(row.close);

  const points: number[] = [];
  const push = (value: number | null) => {
    if (value === null) return;
    if (!points.length || Math.abs(points[points.length - 1] - value) > 1e-12) {
      points.push(value);
    }
  };

  const start = prevClose ?? open ?? close;
  const openRef = open ?? start;
  push(start);
  push(open);

  if (high !== null && low !== null) {
    const closesUp = close !== null && openRef !== null && close >= openRef;
    if (closesUp) {
      push(low);
      push(high);
    } else {
      push(high);
      push(low);
    }
  } else {
    push(high);
    push(low);
  }

  push(close);

  if (points.length === 1) {
    points.push(points[0]);
  }

  return points.length >= 2 ? points : [];
}

function loadUiState(market: MarketCode): {
  tableMode: "snapshot" | "matrix";
  searchTerm: string;
  instrumentFilters: string[] | null;
  sortState: SnapshotSortState;
  matrixShowPercent: boolean;
  matrixShowHeatmap: boolean;
} {
  const defaults = {
    tableMode: "snapshot" as const,
    searchTerm: "",
    instrumentFilters: null as string[] | null,
    sortState: {
      field: "change_pct" as SnapshotSortField,
      direction: "desc" as SnapshotSortDirection,
    },
    matrixShowPercent: false,
    matrixShowHeatmap: false,
  };

  const prefs = readUiPrefs(market);
  if (!prefs) return defaults;

  const sortField = isSortField(prefs.sortField) ? prefs.sortField : defaults.sortState.field;
  const sortDirection = isSortDirection(prefs.sortDirection) ? prefs.sortDirection : defaults.sortState.direction;

  return {
    tableMode: prefs.tableMode === "matrix" ? "matrix" : "snapshot",
    searchTerm: typeof prefs.searchTerm === "string" ? prefs.searchTerm : defaults.searchTerm,
    instrumentFilters: Array.isArray(prefs.instrumentFilters)
      ? prefs.instrumentFilters.filter((value): value is string => typeof value === "string")
      : null,
    sortState: {
      field: sortField,
      direction: sortDirection,
    },
    matrixShowPercent:
      typeof prefs.matrixShowPercent === "boolean" ? prefs.matrixShowPercent : defaults.matrixShowPercent,
    matrixShowHeatmap:
      typeof prefs.matrixShowHeatmap === "boolean" ? prefs.matrixShowHeatmap : defaults.matrixShowHeatmap,
  };
}

export function MarketDashboard({ market }: MarketDashboardProps) {
  const copy = PAGE_COPY[market];
  const router = useRouter();
  const canAddInstruments = market === "indices_etfs";
  const initialUiState = useMemo(() => loadUiState(market), [market]);

  const {
    catalog,
    assetsLoaded,
    query,
    meta,
    failures,
    loading,
    error,
    patchQuery,
    loadData,
    loadDataWithProgress,
    viewRows,
    snapshotRawRows,
  } = useDashboardData(market);

  const [showConfig, setShowConfig] = useState(false);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [showAddInstrumentModal, setShowAddInstrumentModal] = useState(false);
  const [addingInstruments, setAddingInstruments] = useState(false);
  const [searchTerm, setSearchTerm] = useState(initialUiState.searchTerm);
  const [instrumentFilters, setInstrumentFilters] = useState<string[] | null>(initialUiState.instrumentFilters);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [tableMode, setTableMode] = useState<"snapshot" | "matrix">(initialUiState.tableMode);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [sortState, setSortState] = useState<SnapshotSortState>(initialUiState.sortState);
  const [matrixShowPercent, setMatrixShowPercent] = useState(initialUiState.matrixShowPercent);
  const [matrixShowHeatmap, setMatrixShowHeatmap] = useState(initialUiState.matrixShowHeatmap);
  const refreshResetTimeoutRef = useRef<number | null>(null);
  const snapshotPageSize = Math.max(snapshotRawRows.length, 1);

  const snapshot = useSnapshotTable({
    market,
    rowsRaw: snapshotRawRows,
    invertGlobal: query.invertGlobal,
    invertedAssets: query.invertedAssets,
    instrumentFilters,
    searchTerm,
    sort: sortState,
    page,
    pageSize: snapshotPageSize,
  });

  const matrixRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return viewRows;

    return viewRows.filter((row) => {
      if (String(row.date).toLowerCase().includes(term)) return true;

      return Object.entries(row).some(([key, value]) => {
        if (key === "date") return false;
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(term);
      });
    });
  }, [viewRows, searchTerm]);

  const sparklineByInstrument = useMemo(() => {
    const out: Record<string, number[]> = {};
    for (const row of snapshot.rows) {
      out[row.instrument] = buildDailyTrendPoints(row);
    }
    return out;
  }, [snapshot.rows]);

  const matrixTotalRows = matrixRows.length;
  const matrixPageRows = matrixRows;

  useEffect(() => {
    const safePage = snapshot.safePage;
    if (safePage !== page) {
      setPage(safePage);
    }
  }, [page, snapshot.safePage]);

  useEffect(() => {
    return () => {
      if (refreshResetTimeoutRef.current !== null) {
        window.clearTimeout(refreshResetTimeoutRef.current);
        refreshResetTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (instrumentFilters === null) return;
    const available = new Set(snapshot.instrumentOptions.map((opt) => opt.value));
    const cleaned = instrumentFilters.filter((value) => available.has(value));
    if (cleaned.length === snapshot.instrumentOptions.length) {
      setInstrumentFilters(null);
      return;
    }
    if (cleaned.length !== instrumentFilters.length) {
      setInstrumentFilters(cleaned);
    }
  }, [instrumentFilters, snapshot.instrumentOptions]);

  useEffect(() => {
    writeUiPrefs(market, {
      tableMode,
      searchTerm,
      instrumentFilters,
      sortField: sortState.field,
      sortDirection: sortState.direction,
      matrixShowPercent,
      matrixShowHeatmap,
    });
  }, [
    instrumentFilters,
    market,
    matrixShowHeatmap,
    matrixShowPercent,
    searchTerm,
    sortState.direction,
    sortState.field,
    tableMode,
  ]);

  const rangeLabel = `${query.startDate} → ${query.endDate}`;

  function applyPreset(preset: Preset) {
    if (preset === "Custom") {
      patchQuery({ preset });
      return;
    }
    const dates = presetDates(preset);
    patchQuery({ preset, startDate: dates.startDate, endDate: dates.endDate });
  }

  function onRangeChipClick() {
    setShowRangePicker((prev) => !prev);
  }

  async function onApplyRange(startDate: string, endDate: string) {
    setPage(1);
    await loadData({ preset: "Custom", startDate, endDate });
    setShowRangePicker(false);
  }

  async function onTemporalityChange(preset: Preset) {
    if (preset === "Custom") {
      patchQuery({ preset });
      setShowConfig(true);
      return;
    }
    const dates = presetDates(preset);
    setPage(1);
    await loadData({ preset, startDate: dates.startDate, endDate: dates.endDate });
  }

  async function onFrequencyChange(nextFrequency: DashboardQuery["frequency"]) {
    const nextExclude = nextFrequency === "D" ? query.excludeWeekends : false;
    setPage(1);
    await loadData({ frequency: nextFrequency, excludeWeekends: nextExclude });
  }

  function onInstrumentChange(value: string[] | null) {
    setInstrumentFilters(value);
    setPage(1);
  }

  function defaultSortDirection(field: SnapshotSortField): SnapshotSortDirection {
    if (field === "instrument") return "asc";
    return "desc";
  }

  function onSortChange(field: SnapshotSortField) {
    setPage(1);
    setSortState((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { field, direction: defaultSortDirection(field) };
    });
  }

  async function onLiveChipClick() {
    if (refreshing || loading) return;

    if (refreshResetTimeoutRef.current !== null) {
      window.clearTimeout(refreshResetTimeoutRef.current);
      refreshResetTimeoutRef.current = null;
    }

    setRefreshing(true);
    setRefreshProgress(3);
    setPage(1);

    try {
      await loadDataWithProgress({
        onProgress: (progress) => {
          const next = Number(progress.percent ?? 0);
          if (!Number.isFinite(next)) return;
          setRefreshProgress(Math.max(0, Math.min(100, next)));
        },
      });
      setRefreshProgress(100);
    } catch {
      setRefreshProgress(0);
    } finally {
      refreshResetTimeoutRef.current = window.setTimeout(() => {
        setRefreshing(false);
        setRefreshProgress(0);
        refreshResetTimeoutRef.current = null;
      }, 480);
    }
  }

  function openDetail(instrument: string, isInverted: boolean) {
    const custom = query.customAssets.find((item) => item.label === instrument);
    const params = new URLSearchParams({
      market,
      instrument,
      startDate: query.startDate,
      endDate: query.endDate,
      frequency: query.frequency,
      excludeWeekends: query.excludeWeekends ? "1" : "0",
      invert: isInverted ? "1" : "0",
    });
    if (custom) {
      params.set("customSource", custom.source);
      params.set("customSymbol", custom.symbol);
    }
    router.push(`/detalle?${params.toString()}`);
  }

  async function onAddInstruments(items: CustomAssetItem[]) {
    if (!items.length) return;

    const catalogSet = new Set(catalog.map((item) => item.label));
    const customMap = new Map(query.customAssets.map((item) => [item.label, item]));
    const selectedSet = new Set(query.selectedAssets);
    const includedSet = new Set(query.includedAssets);

    for (const item of items) {
      if (!catalogSet.has(item.label) && !customMap.has(item.label)) {
        customMap.set(item.label, item);
      }
      selectedSet.add(item.label);
      includedSet.add(item.label);
    }

    setAddingInstruments(true);
    setPage(1);
    try {
      await loadData({
        customAssets: Array.from(customMap.values()),
        selectedAssets: Array.from(selectedSet),
        includedAssets: Array.from(includedSet),
      });
    } finally {
      setAddingInstruments(false);
    }
  }

  async function onExport() {
    setExporting(true);
    try {
      const blob = await exportDashboard(query);
      const filename = `${market}_view_${query.frequency}_${query.startDate}_to_${query.endDate}.xlsx`;
      downloadBlob(blob, filename);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo exportar";
      window.alert(message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <TopBar activeSection={market} />

      <main className="mx-auto w-full max-w-[1400px] px-4 pb-8 lg:px-6">
        <div className="mb-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-5xl font-bold tracking-tight text-text-main">{copy.title}</h1>
              {copy.description && <p className="mt-2 max-w-3xl text-sm text-text-muted">{copy.description}</p>}
            </div>

            <div className="flex w-full gap-3 md:w-auto">
              <button
                className="rounded-lg border border-border-light bg-white px-4 py-2 text-sm font-medium text-text-main shadow-sm transition hover:border-slate-400"
                type="button"
                onClick={() => setShowConfig((prev) => !prev)}
              >
                Configurar Vista
              </button>
              <button
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-green-300"
                disabled={exporting || !snapshotRawRows.length}
                type="button"
                onClick={onExport}
              >
                {exporting ? "Exportando..." : "Exportar Excel"}
              </button>
            </div>
          </div>
        </div>

        <ChipRow
          rangeLabel={rangeLabel}
          presetValue={query.preset}
          frequencyValue={query.frequency}
          instrumentValues={instrumentFilters}
          instrumentOptions={snapshot.instrumentOptions}
          refreshProgress={refreshProgress}
          refreshing={refreshing}
          onFrequencyChange={onFrequencyChange}
          onPresetChange={onTemporalityChange}
          onInstrumentChange={onInstrumentChange}
          onLiveClick={onLiveChipClick}
          onRangeClick={onRangeChipClick}
        />
        <div className="relative">
          <RangePickerPopover
            initialEndDate={query.endDate}
            initialStartDate={query.startDate}
            loading={loading}
            open={showRangePicker}
            onApply={onApplyRange}
            onClose={() => setShowRangePicker(false)}
          />
        </div>

        {showConfig && (
          <ConfigPanel
            assetsLoaded={assetsLoaded}
            catalog={catalog}
            loading={loading}
            query={query}
            onLoad={async () => {
              setPage(1);
              await loadData();
            }}
            onPatch={patchQuery}
            onPresetChange={applyPreset}
          />
        )}

        <section className="mb-4 flex flex-col gap-4 rounded-t-xl border border-b-0 border-border-light bg-gray-50/40 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-text-main">
              <input
                checked={query.invertGlobal}
                className="h-4 w-4 rounded border-border-light"
                type="checkbox"
                onChange={(e) => patchQuery({ invertGlobal: e.target.checked })}
              />
              {copy.invertLabel}
            </label>
            <div className="hidden h-6 w-px bg-border-light md:block" />
            <span className="font-mono text-xs text-text-muted">
              ULTIMA ACTUALIZACION: {utcClockToBogotaLabel(meta?.last_update_utc)}
            </span>
          </div>

          <div className="flex w-full items-center gap-2 md:w-auto">
            <div className="inline-flex rounded-lg border border-border-light bg-white p-0.5">
              <button
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  tableMode === "snapshot" ? "bg-primary text-white" : "text-text-main hover:bg-gray-50"
                }`}
                type="button"
                onClick={() => {
                  setTableMode("snapshot");
                  setPage(1);
                }}
              >
                Mercados
              </button>
              <button
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  tableMode === "matrix" ? "bg-primary text-white" : "text-text-main hover:bg-gray-50"
                }`}
                type="button"
                onClick={() => {
                  setTableMode("matrix");
                  setPage(1);
                }}
              >
                Matriz
              </button>
            </div>

            <input
              className="w-full rounded-md border border-border-light bg-white px-3 py-1.5 text-sm md:w-52"
              placeholder={tableMode === "matrix" ? "Filtrar matriz..." : "Filtrar tabla..."}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </section>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {!!failures.length && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            No se pudieron cargar: {failures.join(", ")}
          </div>
        )}

        {tableMode === "snapshot" ? (
          <SnapshotTable
            endRow={Math.min(snapshot.pageStart + snapshot.pageRows.length, snapshot.totalRows)}
            highlightInstrument={snapshot.highlightInstrument}
            market={market}
            rows={snapshot.pageRows}
            sparklineByInstrument={sparklineByInstrument}
            sort={sortState}
            startRow={snapshot.totalRows ? snapshot.pageStart + 1 : 0}
            totalRows={snapshot.totalRows}
            onOpenDetail={openDetail}
            onSortChange={onSortChange}
          />
        ) : (
          <MatrixTable
            rows={matrixPageRows}
            market={market}
            totalRows={matrixTotalRows}
            startRow={matrixTotalRows ? 1 : 0}
            endRow={matrixTotalRows}
            showPercent={matrixShowPercent}
            showHeatmap={matrixShowHeatmap}
            onShowPercentChange={setMatrixShowPercent}
            onShowHeatmapChange={setMatrixShowHeatmap}
          />
        )}

        {canAddInstruments && (
          <div className="mt-3 flex justify-end">
            <button
              className="rounded-lg border border-border-light bg-white px-3 py-1.5 text-sm font-medium text-text-main transition hover:bg-gray-50 disabled:opacity-45"
              disabled={loading || addingInstruments}
              type="button"
              onClick={() => setShowAddInstrumentModal(true)}
            >
              + Añadir nuevo instrumento
            </button>
          </div>
        )}

      </main>

      {canAddInstruments && (
        <AddInstrumentModal
          knownLabels={[...catalog.map((item) => item.label), ...query.customAssets.map((item) => item.label)]}
          loading={loading || addingInstruments}
          market={market}
          open={showAddInstrumentModal}
          onAdd={onAddInstruments}
          onClose={() => setShowAddInstrumentModal(false)}
        />
      )}
    </>
  );
}
