from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from backend.app.config import DEFAULT_MARKET, MarketCode


class CustomAssetPayload(BaseModel):
    label: str
    source: Literal["fred", "yahoo", "stooq"]
    symbol: str

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Etiqueta de instrumento vacia")
        return cleaned

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Simbolo de instrumento vacio")
        return cleaned


class FetchRequest(BaseModel):
    market: MarketCode = DEFAULT_MARKET
    start_date: date
    end_date: date
    frequency: Literal["D", "W", "M"] = "D"
    exclude_weekends: bool = True
    assets: list[str] = Field(default_factory=list)
    included_assets: list[str] = Field(default_factory=list)
    preset: str = "Custom"
    invert_global: bool = False
    inverted_assets: list[str] = Field(default_factory=list)
    custom_assets: list[CustomAssetPayload] = Field(default_factory=list)

    @field_validator("assets")
    @classmethod
    def validate_assets_not_empty(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("Selecciona al menos un activo")
        return value


class ExportRequest(FetchRequest):
    filename: str | None = None


class DetailRequest(BaseModel):
    market: MarketCode = DEFAULT_MARKET
    instrument: str
    start_date: date
    end_date: date
    frequency: Literal["D", "W", "M"] = "D"
    exclude_weekends: bool = True
    invert: bool = False
    custom_source: Literal["fred", "yahoo", "stooq"] | None = None
    custom_symbol: str | None = None

    @field_validator("instrument")
    @classmethod
    def validate_instrument_not_empty(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Instrumento requerido")
        return value

    @field_validator("custom_symbol")
    @classmethod
    def validate_custom_symbol(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class SettingsUpdateRequest(BaseModel):
    fred_key: str = ""
