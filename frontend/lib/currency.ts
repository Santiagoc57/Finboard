const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  CHF: "🇨🇭",
  COP: "🇨🇴",
  DOP: "🇩🇴",
  CRC: "🇨🇷",
  BRL: "🇧🇷",
  MXN: "🇲🇽",
  PEN: "🇵🇪",
  ARS: "🇦🇷",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
  NZD: "🇳🇿",
  CLP: "🇨🇱",
};

const CURRENCY_COLORS: Record<string, string> = {
  USD: "#2563eb",
  EUR: "#6366f1",
  GBP: "#ef4444",
  JPY: "#06b6d4",
  CHF: "#64748b",
  COP: "#a855f7",
  DOP: "#14b8a6",
  CRC: "#8b5cf6",
  BRL: "#16a34a",
  MXN: "#10b981",
  PEN: "#22c55e",
  ARS: "#0ea5e9",
  CAD: "#0d9488",
  AUD: "#eab308",
  NZD: "#f97316",
  CLP: "#f43f5e",
};

export function isCurrencyPair(value: string): boolean {
  return /^[A-Z]{3}\/[A-Z]{3}$/.test(value.trim());
}

export function splitPair(value: string): [string, string] | null {
  if (!isCurrencyPair(value)) return null;
  const [base, quote] = value.trim().split("/");
  return [base, quote];
}

export function currencyFlag(code: string): string {
  return CURRENCY_FLAGS[code] ?? "💱";
}

export function currencyColor(code: string): string {
  return CURRENCY_COLORS[code] ?? "#64748b";
}

export function pairInfo(pair: string):
  | {
      base: string;
      quote: string;
      baseFlag: string;
      quoteFlag: string;
    }
  | null {
  const parts = splitPair(pair);
  if (!parts) return null;

  const [base, quote] = parts;
  return {
    base,
    quote,
    baseFlag: currencyFlag(base),
    quoteFlag: currencyFlag(quote),
  };
}
