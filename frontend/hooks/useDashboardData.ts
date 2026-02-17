"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchAssets, fetchDashboard, fetchDashboardStream, FetchStreamProgress } from "@/lib/api";
import { presetDates } from "@/lib/date";
import { readQueryPrefs, writeQueryPrefs } from "@/lib/prefs";
import {
  AssetItem,
  CustomAssetItem,
  DashboardQuery,
  FetchMeta,
  FetchResponse,
  MarketCode,
  Preset,
  SeriesRow,
  SnapshotRow,
} from "@/types/dashboard";

const initialPreset = "YTD" as const;
const PRESET_VALUES: Preset[] = ["Custom", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"];
const FREQUENCY_VALUES: DashboardQuery["frequency"][] = ["D", "W", "M"];

function createInitialQuery(market: MarketCode): DashboardQuery {
  const initialDates = presetDates(initialPreset);
  return {
    market,
    startDate: initialDates.startDate,
    endDate: initialDates.endDate,
    frequency: "D",
    excludeWeekends: true,
    preset: initialPreset,
    selectedAssets: [],
    includedAssets: [],
    invertGlobal: false,
    invertedAssets: [],
    customAssets: [],
  };
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidPreset(value: unknown): value is Preset {
  return typeof value === "string" && PRESET_VALUES.includes(value as Preset);
}

function isValidFrequency(value: unknown): value is DashboardQuery["frequency"] {
  return typeof value === "string" && FREQUENCY_VALUES.includes(value as DashboardQuery["frequency"]);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCustomAssets(value: unknown, market: MarketCode): CustomAssetItem[] {
  if (market !== "indices_etfs" || !Array.isArray(value)) return [];

  const out: CustomAssetItem[] = [];
  const seen = new Set<string>();

  for (const row of value) {
    if (!row || typeof row !== "object") continue;

    const raw = row as { label?: string; source?: string; symbol?: string };
    const label = String(raw.label ?? "").trim();
    const source = String(raw.source ?? "").trim();
    const symbol = String(raw.symbol ?? "").trim();

    if (!label || !symbol) continue;
    if (source !== "fred" && source !== "yahoo" && source !== "stooq") continue;
    if (seen.has(label)) continue;

    seen.add(label);
    out.push({ label, source, symbol });
  }

  return out;
}

function clampDateRange(
  startDate: unknown,
  endDate: unknown,
  fallbackStart: string,
  fallbackEnd: string
): { startDate: string; endDate: string } {
  const today = fallbackEnd;
  let nextStart = isIsoDate(startDate) ? startDate : fallbackStart;
  let nextEnd = isIsoDate(endDate) ? endDate : fallbackEnd;

  if (nextEnd > today) nextEnd = today;
  if (nextStart > today) nextStart = today;
  if (nextStart > nextEnd) nextStart = nextEnd;

  return { startDate: nextStart, endDate: nextEnd };
}

function buildSeedQuery(
  market: MarketCode,
  catalogLabels: string[],
  stored: Partial<DashboardQuery> | null
): DashboardQuery {
  const base = createInitialQuery(market);
  if (!stored) {
    return {
      ...base,
      selectedAssets: catalogLabels,
      includedAssets: catalogLabels,
    };
  }

  const customAssets = normalizeCustomAssets(stored.customAssets, market);
  const availableSet = new Set<string>([
    ...catalogLabels,
    ...customAssets.map((item) => item.label),
  ]);

  const selectedAssetsRaw = normalizeStringArray(stored.selectedAssets);
  const selectedAssets = selectedAssetsRaw.filter((label) => availableSet.has(label));
  const finalSelected = selectedAssets.length ? selectedAssets : catalogLabels;

  const includedAssetsRaw = normalizeStringArray(stored.includedAssets);
  const includedAssets = includedAssetsRaw.filter((label) => finalSelected.includes(label));
  const finalIncluded = includedAssets.length ? includedAssets : finalSelected;

  const invertedAssetsRaw = normalizeStringArray(stored.invertedAssets);
  const invertedAssets = invertedAssetsRaw.filter((label) => availableSet.has(label));

  const range = clampDateRange(stored.startDate, stored.endDate, base.startDate, base.endDate);

  return {
    ...base,
    ...range,
    frequency: isValidFrequency(stored.frequency) ? stored.frequency : base.frequency,
    excludeWeekends:
      typeof stored.excludeWeekends === "boolean" ? stored.excludeWeekends : base.excludeWeekends,
    preset: isValidPreset(stored.preset) ? stored.preset : base.preset,
    selectedAssets: finalSelected,
    includedAssets: finalIncluded,
    invertGlobal: Boolean(stored.invertGlobal),
    invertedAssets,
    customAssets,
  };
}

export function useDashboardData(market: MarketCode) {
  const [catalog, setCatalog] = useState<AssetItem[]>([]);
  const [assetsLoaded, setAssetsLoaded] = useState<string[]>([]);
  const [query, setQuery] = useState<DashboardQuery>(() => createInitialQuery(market));
  const [meta, setMeta] = useState<FetchMeta | null>(null);
  const [baseRows, setBaseRows] = useState<SeriesRow[]>([]);
  const [viewRows, setViewRows] = useState<SeriesRow[]>([]);
  const [snapshotRawRows, setSnapshotRawRows] = useState<SnapshotRow[]>([]);
  const [failures, setFailures] = useState<string[]>([]);
  const [resolvedSymbols, setResolvedSymbols] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryRef = useRef<DashboardQuery>(createInitialQuery(market));
  const bootstrappedRef = useRef(false);

  const commitQuery = useCallback((next: DashboardQuery) => {
    queryRef.current = next;
    setQuery(next);
  }, []);

  const patchQuery = useCallback(
    (patch: Partial<DashboardQuery>) => {
      const next = { ...queryRef.current, ...patch, market };
      commitQuery(next);
      return next;
    },
    [commitQuery, market]
  );

  const applyFetchResponse = useCallback(
    (nextQuery: DashboardQuery, response: FetchResponse) => {
      setMeta(response.meta);
      setFailures(response.failures);
      setAssetsLoaded(response.assets_loaded);
      setBaseRows(response.base_rows);
      setViewRows(response.view_rows);
      setSnapshotRawRows(response.snapshot_rows_raw);
      setResolvedSymbols(response.resolved_symbols || {});

      const validIncluded = (
        nextQuery.includedAssets.length ? nextQuery.includedAssets : response.included_assets
      ).filter((label) => response.assets_loaded.includes(label));

      commitQuery({
        ...nextQuery,
        includedAssets: validIncluded,
        invertedAssets: nextQuery.invertedAssets.filter((label) =>
          response.snapshot_rows_raw.some((row) => row.instrument === label)
        ),
      });
    },
    [commitQuery]
  );

  const loadData = useCallback(
    async (patch: Partial<DashboardQuery> = {}) => {
      const nextQuery = patchQuery(patch);

      if (!nextQuery.selectedAssets.length) {
        setError("Selecciona al menos un instrumento.");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetchDashboard(nextQuery);
        applyFetchResponse(nextQuery, response);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [applyFetchResponse, patchQuery]
  );

  const loadDataWithProgress = useCallback(
    async ({
      patch = {},
      onProgress,
    }: {
      patch?: Partial<DashboardQuery>;
      onProgress?: (progress: FetchStreamProgress) => void;
    }) => {
      const nextQuery = patchQuery(patch);

      if (!nextQuery.selectedAssets.length) {
        setError("Selecciona al menos un instrumento.");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetchDashboardStream(nextQuery, { onProgress });
        applyFetchResponse(nextQuery, response);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [applyFetchResponse, patchQuery]
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const catalogRows = await fetchAssets(market);
        if (!mounted) return;

        setCatalog(catalogRows);
        const labels = catalogRows.map((row) => row.label);
        const stored = readQueryPrefs(market);
        const seeded = buildSeedQuery(market, labels, stored);

        bootstrappedRef.current = true;
        commitQuery(seeded);
        await loadData(seeded);
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "No se pudo inicializar";
        setError(message);
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [commitQuery, loadData, market]);

  useEffect(() => {
    if (!bootstrappedRef.current) return;
    writeQueryPrefs(market, query);
  }, [market, query]);

  return {
    catalog,
    assetsLoaded,
    query,
    meta,
    baseRows,
    viewRows,
    snapshotRawRows,
    failures,
    resolvedSymbols,
    loading,
    error,
    patchQuery,
    applyFetchResponse,
    loadData,
    loadDataWithProgress,
  };
}
