export type MarketCode = "indices_etfs" | "monedas";
export type TopNavSection = MarketCode | "settings";
export type FrequencyCode = "D" | "W" | "M";
export type Preset = "Custom" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "MAX";
export type AssetSource = "fred" | "yahoo" | "stooq";

export interface AssetItem {
  label: string;
  source: string;
  symbol: string;
  base_currency?: string;
  quote_currency?: string;
  base_flag?: string;
  quote_flag?: string;
}

export interface CustomAssetItem {
  label: string;
  source: AssetSource;
  symbol: string;
}

export interface InstrumentSearchResult extends CustomAssetItem {
  provider: "FRED" | "Yahoo";
  description?: string;
  exists_in_catalog?: boolean;
}

export interface InstrumentSearchResponse {
  market: MarketCode;
  query: string;
  count: number;
  results: InstrumentSearchResult[];
  warnings: string[];
}

export interface FetchMeta {
  market: MarketCode;
  sdate: string;
  edate: string;
  freq: string;
  preset: string;
  last_update_utc: string;
}

export interface SeriesRow {
  date: string;
  [key: string]: string | number | null;
}

export interface SnapshotRow {
  date: string;
  instrument: string;
  symbol?: string | null;
  source?: string | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  prev_close: number | null;
  change_pct: number | null;
  isInverted: boolean;
}

export interface FetchResponse {
  meta: FetchMeta;
  failures: string[];
  resolved_symbols: Record<string, string>;
  assets_loaded: string[];
  included_assets: string[];
  base_rows: SeriesRow[];
  view_rows: SeriesRow[];
  snapshot_rows_raw: SnapshotRow[];
  snapshot_rows: SnapshotRow[];
}

export interface DashboardQuery {
  market: MarketCode;
  startDate: string;
  endDate: string;
  frequency: FrequencyCode;
  excludeWeekends: boolean;
  preset: Preset;
  selectedAssets: string[];
  includedAssets: string[];
  invertGlobal: boolean;
  invertedAssets: string[];
  customAssets: CustomAssetItem[];
}

export interface DetailHistoryRow {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
}

export interface DetailQuote {
  price: number | null;
  change: number | null;
  change_pct: number | null;
  prev_close: number | null;
}

export interface DetailStats {
  open: number | null;
  high: number | null;
  low: number | null;
  day_range: [number | null, number | null];
  week_52_range: [number | null, number | null];
  volume: number | null;
  avg_volume: number | null;
}

export interface DetailResponse {
  market: MarketCode;
  instrument: string;
  display_instrument: string;
  source: string;
  symbol: string;
  is_inverted: boolean;
  as_of: string;
  last_update_utc?: string;
  quote: DetailQuote;
  stats: DetailStats;
  history: DetailHistoryRow[];
  meta: {
    sdate: string;
    edate: string;
    freq: string;
  };
}

export interface DetailRequest {
  market: MarketCode;
  instrument: string;
  startDate: string;
  endDate: string;
  frequency: FrequencyCode;
  excludeWeekends: boolean;
  invert: boolean;
  customSource?: AssetSource;
  customSymbol?: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  usage: string;
  requires_key: boolean;
  configurable: boolean;
}

export interface SettingsResponse {
  fred: {
    configured: boolean;
    source: "runtime" | "env" | "none";
    masked: string;
    runtime_configured: boolean;
    env_configured: boolean;
  };
  providers: ProviderInfo[];
  message?: string;
}
