import { MarketCode } from "@/types/dashboard";

const INDEX_ETF_ICON_MAP: Record<string, string> = {
  "S&P 500": "🇺🇸",
  "Dow Jones": "🏛",
  "Nasdaq Comp": "💻",
  DAX: "🇩🇪",
  "IBEX 35": "🇪🇸",
  "Nikkei 225": "🇯🇵",
  Bovespa: "🇧🇷",
  KOSPI: "🇰🇷",
  "IPC (MXX)": "🇲🇽",
  "CLX IPSA": "🇨🇱",
  "FTSE 100": "🇬🇧",
  "Gold (GC=F)": "🥇",
  "Silver (SI=F)": "🥈",
  "Copper (HG=F)": "🟠",
  "Bitcoin (BTC-USD)": "₿",
  "Ethereum (ETH-USD)": "Ξ",
  "BNB (BNB-USD)": "🔶",
  "XRP (XRP-USD)": "✕",
  "Solana (SOL-USD)": "◎",
  "GLAB.L (ETF)": "📦",
  "IBDR (ETF)": "📦",
  "COLCAP (ICOLCAP.CL)": "🇨🇴",
};

function fuzzyInstrumentIcon(label: string): string | null {
  const key = label.trim().toLowerCase();

  if (key.includes("s&p")) return "🇺🇸";
  if (key.includes("dow")) return "🏛";
  if (key.includes("nasdaq")) return "💻";
  if (key.includes("dax")) return "🇩🇪";
  if (key.includes("ibex")) return "🇪🇸";
  if (key.includes("nikkei")) return "🇯🇵";
  if (key.includes("bovespa")) return "🇧🇷";
  if (key.includes("kospi")) return "🇰🇷";
  if (key.includes("ipc")) return "🇲🇽";
  if (key.includes("ipsa")) return "🇨🇱";
  if (key.includes("ftse")) return "🇬🇧";

  if (key.includes("gold") || key.includes("gc=f")) return "🥇";
  if (key.includes("silver") || key.includes("si=f")) return "🥈";
  if (key.includes("copper") || key.includes("hg=f")) return "🟠";

  if (key.includes("btc-usd") || key.includes("bitcoin")) return "₿";
  if (key.includes("eth-usd") || key.includes("ethereum")) return "Ξ";
  if (key.includes("bnb-usd") || key.includes("bnb")) return "🔶";
  if (key.includes("xrp-usd") || key.includes("xrp")) return "✕";
  if (key.includes("sol-usd") || key.includes("solana")) return "◎";

  if (key.includes("etf")) return "📦";
  if (key.includes("=f")) return "⛏";

  return null;
}

function cryptoSymbolFromLabel(label: string): string | null {
  if (label.includes("BTC-USD")) return "₿";
  if (label.includes("ETH-USD")) return "Ξ";
  if (label.includes("BNB-USD")) return "🔶";
  if (label.includes("XRP-USD")) return "✕";
  if (label.includes("SOL-USD")) return "◎";
  return null;
}

export function instrumentIcon(instrument: string, market: MarketCode): string | null {
  if (market === "monedas") return null;

  const exact = INDEX_ETF_ICON_MAP[instrument];
  if (exact) return exact;

  const fuzzy = fuzzyInstrumentIcon(instrument);
  if (fuzzy) return fuzzy;

  const crypto = cryptoSymbolFromLabel(instrument);
  if (crypto) return crypto;

  if (instrument.includes("ETF")) return "📦";
  if (instrument.includes("=F")) return "⛏";

  return "📈";
}
