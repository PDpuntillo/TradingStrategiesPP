"""
Configuración global del backend.
Carga variables de entorno desde .env usando Pydantic Settings.
"""
import json
import logging
import os
import re
from functools import lru_cache
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


logger = logging.getLogger(__name__)


# Pattern para escanear env vars dinámicas: SPREADSHEET_ID_<TICKER>
_SPREADSHEET_ID_PATTERN = re.compile(r"^SPREADSHEET_ID_([A-Z0-9]+)$", re.IGNORECASE)


class Settings(BaseSettings):
    """Settings cargados desde variables de entorno."""

    # ===== Google Sheets API =====
    google_sheets_api_key: str

    # ===== Spreadsheet IDs por ticker =====
    # Formato preferido: una env var por ticker, escaneada dinámicamente
    # del environment con el pattern SPREADSHEET_ID_<TICKER>=<sheet_id>.
    # Pegable directo en el modal "Add from .env" de Render — una línea
    # por ticker. Para 50 tickers son 50 líneas, pero copiable de un saque.
    #
    # Alternativa legacy: SHEET_IDS_JSON='{"TICKER":"id",...}' como una
    # sola env var. Soportado para retrocompatibilidad pero no necesario.

    sheet_ids_json: str = "{}"  # alternativa JSON, opcional

    # Las 3 originales se mantienen como fields explícitos para que pydantic
    # no rompa si están seteadas (también las captura el scan de abajo).
    spreadsheet_id_ggal: Optional[str] = None
    spreadsheet_id_ypf: Optional[str] = None
    spreadsheet_id_pamp: Optional[str] = None

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
        extra="ignore",  # SPREADSHEET_ID_TXAR etc. son extras, no fallar
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Convierte CSV de origins a lista."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def spreadsheet_ids_map(self) -> dict[str, str]:
        """
        Mapea ticker → spreadsheet_id.

        Layers (de menor a mayor prioridad):
        1. SPREADSHEET_ID_<TICKER> escaneado dinámicamente de os.environ
           (incluye GGAL/YPF/PAMP automáticamente y cualquier otro)
        2. SHEET_IDS_JSON parseado como dict (alternativa legacy/bulk)

        Pydantic Settings carga el .env file en os.environ antes de
        instanciar Settings, así que el escaneo de os.environ ve tanto
        los env vars del shell como los del .env.
        """
        result: dict[str, str] = {}

        # Layer 1: escaneo dinámico SPREADSHEET_ID_*
        for key, val in os.environ.items():
            m = _SPREADSHEET_ID_PATTERN.match(key)
            if m and val:
                result[m.group(1).upper()] = val

        # Layer 2: SHEET_IDS_JSON (alternativa, override en colisión)
        if self.sheet_ids_json and self.sheet_ids_json != "{}":
            try:
                extra = json.loads(self.sheet_ids_json)
                if isinstance(extra, dict):
                    result.update({k.upper(): v for k, v in extra.items() if v})
                else:
                    logger.warning("SHEET_IDS_JSON no es un object JSON, se ignora")
            except json.JSONDecodeError as e:
                logger.warning(f"SHEET_IDS_JSON no es JSON válido: {e}")

        return result


@lru_cache()
def get_settings() -> Settings:
    """Cached settings (evita re-leer .env en cada request)."""
    return Settings()
