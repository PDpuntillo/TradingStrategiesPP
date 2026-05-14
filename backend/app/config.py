"""
Configuración global del backend.
Carga variables de entorno desde .env usando Pydantic Settings.
"""
import json
import logging
from functools import lru_cache
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Settings cargados desde variables de entorno."""

    # ===== Google Sheets API =====
    google_sheets_api_key: str

    # ===== Spreadsheet IDs por ticker =====
    # Formato preferido (escalable a 50+ tickers): JSON env var con un mapa
    # ticker → sheet_id. Ejemplo:
    #   SHEET_IDS_JSON='{"GGAL":"abc...","YPF":"def...","PAMP":"xyz..."}'
    sheet_ids_json: str = "{}"

    # Legacy: 3 vars individuales (compatibilidad hacia atrás con el deploy
    # original). Si están seteadas se merguean con SHEET_IDS_JSON, donde el
    # JSON tiene prioridad ante colisión.
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
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Convierte CSV de origins a lista."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def spreadsheet_ids_map(self) -> dict[str, str]:
        """
        Mapea ticker → spreadsheet_id.

        Combina las vars legacy individuales (SPREADSHEET_ID_GGAL/YPF/PAMP)
        con SHEET_IDS_JSON. El JSON sobrescribe valores legacy en clave
        repetida (permite migración gradual).
        """
        result: dict[str, str] = {}

        # Layer 1: legacy individual env vars (si están seteadas)
        if self.spreadsheet_id_ggal:
            result["GGAL"] = self.spreadsheet_id_ggal
        if self.spreadsheet_id_ypf:
            result["YPF"] = self.spreadsheet_id_ypf
        if self.spreadsheet_id_pamp:
            result["PAMP"] = self.spreadsheet_id_pamp

        # Layer 2: JSON (overrides legacy en clave duplicada)
        if self.sheet_ids_json and self.sheet_ids_json != "{}":
            try:
                extra = json.loads(self.sheet_ids_json)
                if isinstance(extra, dict):
                    # Normalizar tickers a uppercase
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
