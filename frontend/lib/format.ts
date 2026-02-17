export function formatFixed(value: number | null, decimals = 6): string {
  if (value === null || Number.isNaN(value)) return "-";
  return value.toFixed(decimals);
}

export function formatPct(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function freqHumanLabel(code: string): string {
  const map: Record<string, string> = {
    D: "Diaria",
    B: "Diaria (sin fines de semana)",
    W: "Semanal (viernes)",
    M: "Mensual (ultimo)",
  };
  return map[code] ?? code;
}
