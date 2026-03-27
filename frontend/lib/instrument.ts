import { MarketCode } from "@/types/dashboard";

const INDEX_ETF_ICON_MAP: Record<string, string> = {
  "S&P 500": "🇺🇸",
  "Dow Jones": "🏛",
  "Nasdaq Comp": "💻",
  "Nasdaq 100": "🚀",
  DAX: "🇩🇪",
  "IBEX 35": "🇪🇸",
  "Nikkei 225": "🇯🇵",
  Bovespa: "🇧🇷",
  KOSPI: "🇰🇷",
  "IPC (MXX)": "🇲🇽",
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
  if (key.includes("nasdaq 100") || key.includes("ndx")) return "🚀";
  if (key.includes("nasdaq")) return "💻";
  if (key.includes("dax")) return "🇩🇪";
  if (key.includes("ibex")) return "🇪🇸";
  if (key.includes("nikkei")) return "🇯🇵";
  if (key.includes("bovespa")) return "🇧🇷";
  if (key.includes("kospi")) return "🇰🇷";
  if (key.includes("ipc")) return "🇲🇽";
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

export type InstrumentCategory = "Índices" | "Materias Primas" | "Criptomonedas" | "ETFs" | "Otros";

export function instrumentCategory(instrument: string, market: MarketCode): InstrumentCategory {
  if (market === "monedas") return "Otros";

  const key = instrument.trim().toLowerCase();

  if (cryptoSymbolFromLabel(instrument) || key.includes("btc") || key.includes("eth") || key.includes("bnb") || key.includes("xrp") || key.includes("sol")) {
    return "Criptomonedas";
  }

  if (key.includes("gold") || key.includes("silver") || key.includes("copper") || key.includes("=f")) {
    return "Materias Primas";
  }

  if (key.includes("etf")) {
    return "ETFs";
  }

  return "Índices"; // Default fallback assuming it's part of the standard index list
}

const INSTRUMENT_TIPS: Record<string, string> = {
  "S&P 500": "Índice bursátil de las 500 empresas más grandes de EE.UU.",
  "Dow Jones": "Índice de las 30 principales empresas industriales de EE.UU.",
  "Nasdaq Comp": "Índice tecnológico del mercado Nasdaq.",
  "Nasdaq 100": "Las 100 mayores empresas no financieras del Nasdaq.",
  DAX: "Índice bursátil de las 40 empresas líderes de Alemania.",
  "IBEX 35": "Índice de las 35 principales empresas de España.",
  "Nikkei 225": "Índice bursátil de las 225 empresas líderes de Japón.",
  Bovespa: "Índice principal de la Bolsa de Valores de Brasil (B3).",
  KOSPI: "Índice bursátil principal de Corea del Sur.",
  "IPC (MXX)": "Índice de Precios y Cotizaciones de México.",
  "CLX IPSA": "Índice selectivo de la Bolsa de Santiago, Chile.",
  "FTSE 100": "Índice de las 100 empresas más capitalizadas del Reino Unido.",
  "COLCAP (ICOLCAP.CL)": "Índice de las acciones más líquidas de la Bolsa de Colombia.",
  "Gold (GC=F)": "Oro — materia prima refugio de valor.",
  "Silver (SI=F)": "Plata — metal industrial y refugio de valor.",
  "Copper (HG=F)": "Cobre — metal industrial clave para la economía global.",
  "Bitcoin (BTC-USD)": "₿ Bitcoin — criptomoneda líder, dinero digital descentralizado.",
  "Ethereum (ETH-USD)": "Ξ Ethereum — plataforma de contratos inteligentes.",
  "BNB (BNB-USD)": "BNB — token nativo del ecosistema Binance.",
  "XRP (XRP-USD)": "XRP — criptomoneda de pagos internacionales de Ripple.",
  "Solana (SOL-USD)": "SOL — blockchain de alta velocidad y bajas comisiones.",
  "GLAB.L (ETF)": "ETF de GraniteShares — exposición a acciones globales seleccionadas.",
  "IBDR (ETF)": "ETF de iShares — exposición a deuda soberana emergente.",
};

export function instrumentTooltip(instrument: string): string {
  if (INSTRUMENT_TIPS[instrument]) return INSTRUMENT_TIPS[instrument];

  const key = instrument.toLowerCase();
  if (key.includes("btc") || key.includes("bitcoin")) return "Criptomoneda descentralizada — dinero digital.";
  if (key.includes("eth") || key.includes("ethereum")) return "Plataforma blockchain de contratos inteligentes.";
  if (key.includes("bnb")) return "Token nativo del ecosistema Binance.";
  if (key.includes("xrp")) return "Criptomoneda para pagos internacionales.";
  if (key.includes("sol") || key.includes("solana")) return "Blockchain rápido y de bajas comisiones.";
  if (key.includes("etf")) return "ETF — Fondo cotizado en bolsa (cesta de activos).";
  if (key.includes("gold") || key.includes("gc=f")) return "Oro — materia prima, activo refugio.";
  if (key.includes("silver") || key.includes("si=f")) return "Plata — metal precioso e industrial.";
  if (key.includes("copper") || key.includes("hg=f")) return "Cobre — metal industrial clave.";
  if (key.includes("=f")) return "Contrato de futuros sobre materia prima.";
  return "Instrumento financiero.";
}
