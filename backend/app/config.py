from datetime import date
from typing import Literal

DECIMALS = 6
DEFAULT_START = date(date.today().year - 5, 1, 1)

MarketCode = Literal["indices_etfs", "monedas"]
DEFAULT_MARKET: MarketCode = "indices_etfs"

ASSETS_INDICES_ETFS = {
    "S&P 500": {"src": "fred", "id": "SP500"},
    "Dow Jones": {"src": "fred", "id": "DJIA"},
    "Nasdaq Comp": {"src": "fred", "id": "NASDAQCOM"},
    "DAX": {"src": "stooq", "id": "^DAX"},
    "IBEX 35": {"src": "stooq", "id": "^IBEX"},
    "Nikkei 225": {"src": "stooq", "id": "^NKX"},
    "Bovespa": {"src": "stooq", "id": "^BVP"},
    "KOSPI": {"src": "stooq", "id": "^KOSPI"},
    "IPC (MXX)": {"src": "stooq", "id": "^IPC"},
    "CLX IPSA": {"src": "stooq", "id": "^IPSA"},
    "FTSE 100": {"src": "stooq", "id": "^UKX"},
    "GLAB.L (ETF)": {"src": "yahoo", "id": "GLAB.L"},
    "IBDR (ETF)": {"src": "yahoo", "id": "IBDR"},
    "COLCAP (ICOLCAP.CL)": {"src": "yahoo", "id": "ICOLCAP.CL"},
    "Gold (GC=F)": {"src": "yahoo", "id": "GC=F"},
    "Silver (SI=F)": {"src": "yahoo", "id": "SI=F"},
    "Copper (HG=F)": {"src": "yahoo", "id": "HG=F"},
    "Bitcoin (BTC-USD)": {"src": "yahoo", "id": "BTC-USD"},
    "Ethereum (ETH-USD)": {"src": "yahoo", "id": "ETH-USD"},
    "BNB (BNB-USD)": {"src": "yahoo", "id": "BNB-USD"},
    "XRP (XRP-USD)": {"src": "yahoo", "id": "XRP-USD"},
    "Solana (SOL-USD)": {"src": "yahoo", "id": "SOL-USD"},
}

CURRENCY_PAIRS = [
    "COP/USD",
    "DOP/USD",
    "CRC/USD",
    "EUR/USD",
    "CHF/USD",
    "BRL/USD",
    "MXN/USD",
    "PEN/USD",
    "ARS/USD",
    "JPY/USD",
    "GBP/USD",
]

# Canonical pair is X/USD stored as "X per 1 USD".
# Each candidate tuple is (ticker, invert_after_download)
CURRENCY_CANDIDATES = {
    "COP/USD": [("USDCOP=X", False), ("COP=X", False), ("COPUSD=X", True)],
    "DOP/USD": [("USDDOP=X", False), ("DOP=X", False), ("DOPUSD=X", True)],
    "CRC/USD": [("USDCRC=X", False), ("CRC=X", False), ("CRCUSD=X", True)],
    "EUR/USD": [("USDEUR=X", False), ("EURUSD=X", True)],
    "CHF/USD": [("USDCHF=X", False), ("CHF=X", False), ("CHFUSD=X", True)],
    "BRL/USD": [("USDBRL=X", False), ("BRL=X", False), ("BRLUSD=X", True)],
    "MXN/USD": [("USDMXN=X", False), ("MXN=X", False), ("MXNUSD=X", True)],
    "PEN/USD": [("USDPEN=X", False), ("PEN=X", False), ("PENUSD=X", True)],
    "ARS/USD": [("USDARS=X", False), ("ARS=X", False), ("ARSUSD=X", True)],
    "JPY/USD": [("USDJPY=X", False), ("JPY=X", False), ("JPYUSD=X", True)],
    "GBP/USD": [("USDGBP=X", False), ("GBP=X", False), ("GBPUSD=X", True)],
}

CCY_FLAGS = {
    "USD": "🇺🇸",
    "COP": "🇨🇴",
    "DOP": "🇩🇴",
    "CRC": "🇨🇷",
    "EUR": "🇪🇺",
    "CHF": "🇨🇭",
    "BRL": "🇧🇷",
    "MXN": "🇲🇽",
    "PEN": "🇵🇪",
    "ARS": "🇦🇷",
    "JPY": "🇯🇵",
    "GBP": "🇬🇧",
}

FREQUENCY_LABELS = {
    "D": "Diaria",
    "B": "Diaria (sin fines de semana)",
    "W": "Semanal (viernes)",
    "M": "Mensual (ultimo)",
}
