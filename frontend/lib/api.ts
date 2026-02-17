import {
  AssetItem,
  DashboardQuery,
  DetailRequest,
  DetailResponse,
  FetchResponse,
  InstrumentSearchResponse,
  MarketCode,
  SettingsResponse,
} from "@/types/dashboard";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchAssets(market: MarketCode): Promise<AssetItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/assets?market=${market}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readError(response, "No se pudo cargar el catalogo de activos"));
  }
  const payload = (await response.json()) as { assets: AssetItem[] };
  return payload.assets;
}

function mapQueryToPayload(query: DashboardQuery) {
  return {
    market: query.market,
    start_date: query.startDate,
    end_date: query.endDate,
    frequency: query.frequency,
    exclude_weekends: query.excludeWeekends,
    assets: query.selectedAssets,
    included_assets: query.includedAssets,
    preset: query.preset,
    invert_global: query.invertGlobal,
    inverted_assets: query.invertedAssets,
    custom_assets: query.customAssets,
  };
}

export async function fetchDashboard(query: DashboardQuery): Promise<FetchResponse> {
  const response = await fetch(`${API_BASE_URL}/api/fetch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mapQueryToPayload(query)),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "No se pudieron cargar los datos"));
  }

  return (await response.json()) as FetchResponse;
}

export interface FetchStreamProgress {
  percent: number;
  stage?: string;
  status?: string;
  current?: number;
  total?: number;
  label?: string;
}

function toProgressPayload(data: Record<string, unknown>): FetchStreamProgress | null {
  const percent = Number(data.percent);
  if (!Number.isFinite(percent)) return null;

  return {
    percent,
    stage: typeof data.stage === "string" ? data.stage : undefined,
    status: typeof data.status === "string" ? data.status : undefined,
    current: typeof data.current === "number" ? data.current : undefined,
    total: typeof data.total === "number" ? data.total : undefined,
    label: typeof data.label === "string" ? data.label : undefined,
  };
}

function parseSseBlock(rawBlock: string): { event: string; data: string } | null {
  const lines = rawBlock.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (!dataLines.length) return null;
  return { event, data: dataLines.join("\n") };
}

export async function fetchDashboardStream(
  query: DashboardQuery,
  handlers?: { onProgress?: (progress: FetchStreamProgress) => void }
): Promise<FetchResponse> {
  const response = await fetch(`${API_BASE_URL}/api/fetch/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mapQueryToPayload(query)),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "No se pudieron cargar los datos"));
  }
  if (!response.body) {
    throw new Error("El servidor no retorno stream de progreso");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let finalPayload: FetchResponse | null = null;
  let streamError: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
      while (true) {
        const splitIndex = buffer.indexOf("\n\n");
        if (splitIndex === -1) break;
        const rawBlock = buffer.slice(0, splitIndex).trim();
        buffer = buffer.slice(splitIndex + 2);
        if (!rawBlock) continue;

        const parsed = parseSseBlock(rawBlock);
        if (!parsed) continue;

        try {
          const data = JSON.parse(parsed.data) as Record<string, unknown>;
          if (parsed.event === "progress") {
            const progress = toProgressPayload(data);
            if (progress) handlers?.onProgress?.(progress);
            continue;
          }
          if (parsed.event === "result") {
            finalPayload = data.response as FetchResponse;
            continue;
          }
          if (parsed.event === "error") {
            streamError = String(data.message ?? "Error durante la carga");
          }
        } catch {
          // Ignore malformed stream chunks and continue.
        }
      }
    }
    if (done) break;
  }

  if (streamError) throw new Error(streamError);
  if (!finalPayload) throw new Error("No se recibio resultado final del stream");

  return finalPayload;
}

export async function exportDashboard(query: DashboardQuery): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...mapQueryToPayload(query),
      filename: `${query.market}_view_${query.frequency}_${query.startDate}_to_${query.endDate}.xlsx`,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "No se pudo exportar el archivo"));
  }

  return await response.blob();
}

export async function fetchDetail(payload: DetailRequest): Promise<DetailResponse> {
  const response = await fetch(`${API_BASE_URL}/api/detail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      market: payload.market,
      instrument: payload.instrument,
      start_date: payload.startDate,
      end_date: payload.endDate,
      frequency: payload.frequency,
      exclude_weekends: payload.excludeWeekends,
      invert: payload.invert,
      custom_source: payload.customSource,
      custom_symbol: payload.customSymbol,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readError(response, "No se pudo cargar el detalle"));
  }

  return (await response.json()) as DetailResponse;
}

export async function searchInstruments(
  market: MarketCode,
  query: string,
  limit = 12
): Promise<InstrumentSearchResponse> {
  const params = new URLSearchParams({
    market,
    q: query,
    limit: String(limit),
  });
  const response = await fetch(`${API_BASE_URL}/api/instrument-search?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "No se pudo buscar instrumentos"));
  }
  return (await response.json()) as InstrumentSearchResponse;
}

export async function fetchSettings(): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/settings`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readError(response, "No se pudieron cargar los ajustes"));
  }
  return (await response.json()) as SettingsResponse;
}

export async function saveSettings(fredKey: string): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fred_key: fredKey }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "No se pudieron guardar los ajustes"));
  }
  return (await response.json()) as SettingsResponse;
}
