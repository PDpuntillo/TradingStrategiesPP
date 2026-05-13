"""
Configuración global del backend.
Carga variables de entorno desde .env usando Pydantic Settings.
"""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings cargados desde variables de entorno."""

    # ===== Google Sheets API =====
    google_sheets_api_key: str

    # Spreadsheet IDs por ticker
    spreadsheet_id_ggal: str
    spreadsheet_id_ypf: str
    spreadsheet_id_pamp: str

    # ===== FastAPI =====
    app_name: str = "Trading Strategy Analyzer"
    app_version: str = "0.1.0"
    debug: bool = True
    host: str = "127.0.0.1"
    port: int = 8000

    # ===== CORS =====
    cors_origins: str = "http://localhost:5173"

    # ===== Cache =====
    cache_ttl_seconds: int = 300

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Convierte CSV de origins a lista."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def spreadsheet_ids_map(self) -> dict[str, str]:
        """Mapea ticker → spreadsheet_id."""
        return {
            "GGAL": self.spreadsheet_id_ggal,
            "YPF": self.spreadsheet_id_ypf,
            "PAMP": self.spreadsheet_id_pamp,
        }


@lru_cache()
def get_settings() -> Settings:
    """Cached settings (evita re-leer .env en cada request)."""
    return Settings()
