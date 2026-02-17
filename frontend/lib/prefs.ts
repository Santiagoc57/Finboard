import { DashboardQuery, MarketCode } from "@/types/dashboard";

const QUERY_PREF_PREFIX = "finboard:prefs:query:v1";
const UI_PREF_PREFIX = "finboard:prefs:ui:v1";

export type TableMode = "snapshot" | "matrix";
export type SortDirection = "asc" | "desc";

export interface DashboardUiPrefs {
  tableMode?: TableMode;
  searchTerm?: string;
  instrumentFilters?: string[] | null;
  sortField?: string;
  sortDirection?: SortDirection;
  matrixShowPercent?: boolean;
  matrixShowHeatmap?: boolean;
}

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function queryKey(market: MarketCode): string {
  return `${QUERY_PREF_PREFIX}:${market}`;
}

function uiKey(market: MarketCode): string {
  return `${UI_PREF_PREFIX}:${market}`;
}

function readJson<T>(key: string): T | null {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as T;
    }
  } catch {
    return null;
  }
  return null;
}

function writeJson(key: string, payload: unknown): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or serialization errors.
  }
}

export function readQueryPrefs(market: MarketCode): Partial<DashboardQuery> | null {
  return readJson<Partial<DashboardQuery>>(queryKey(market));
}

export function writeQueryPrefs(market: MarketCode, query: DashboardQuery): void {
  writeJson(queryKey(market), {
    startDate: query.startDate,
    endDate: query.endDate,
    frequency: query.frequency,
    excludeWeekends: query.excludeWeekends,
    preset: query.preset,
    selectedAssets: query.selectedAssets,
    includedAssets: query.includedAssets,
    invertGlobal: query.invertGlobal,
    invertedAssets: query.invertedAssets,
    customAssets: query.customAssets,
  });
}

export function readUiPrefs(market: MarketCode): DashboardUiPrefs | null {
  return readJson<DashboardUiPrefs>(uiKey(market));
}

export function writeUiPrefs(market: MarketCode, prefs: DashboardUiPrefs): void {
  writeJson(uiKey(market), prefs);
}
