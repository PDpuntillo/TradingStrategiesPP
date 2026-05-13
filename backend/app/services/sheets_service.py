"""
Google Sheets service usando API Key (solo lectura, spreadsheets públicas).
Cachea resultados para minimizar requests.
"""
from datetime import datetime
from typing import List, Optional
import logging

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from cachetools import TTLCache

from app.config import get_settings
from app.models.strategy import Ticker, PriceBar, TickerData


logger = logging.getLogger(__name__)


class SheetsService:
    """
    Cliente de Google Sheets API (solo lectura con API Key).

    Las spreadsheets deben estar compartidas como "Anyone with link can view".
    """

    def __init__(self):
        self.settings = get_settings()
        self.service = build(
            "sheets",
            "v4",
            developerKey=self.settings.google_sheets_api_key,
            cache_discovery=False,
        )
        # Cache: 5 min TTL, max 100 entries
        self._cache: TTLCache = TTLCache(
            maxsize=100,
            ttl=self.settings.cache_ttl_seconds,
        )

    def _get_spreadsheet_id(self, ticker: Ticker) -> str:
        """Resuelve el spreadsheet_id desde el ticker."""
        spreadsheet_id = self.settings.spreadsheet_ids_map.get(ticker.value)
        if not spreadsheet_id:
            raise ValueError(f"No spreadsheet configurado para ticker: {ticker}")
        return spreadsheet_id

    def read_range(
        self,
        ticker: Ticker,
        sheet_name: str,
        cell_range: str,
    ) -> List[List[str]]:
        """
        Lee un rango de celdas de una sheet.

        Args:
            ticker: Ticker que mapea al spreadsheet
            sheet_name: Nombre de la pestaña (ej: "RAW_DATA")
            cell_range: Rango A1 (ej: "A2:G500")

        Returns:
            Lista de filas (cada fila es lista de strings)
        """
        cache_key = f"{ticker.value}:{sheet_name}:{cell_range}"
        if cache_key in self._cache:
            logger.debug(f"Cache HIT: {cache_key}")
            return self._cache[cache_key]

        spreadsheet_id = self._get_spreadsheet_id(ticker)
        full_range = f"{sheet_name}!{cell_range}"

        try:
            result = (
                self.service.spreadsheets()
                .values()
                .get(spreadsheetId=spreadsheet_id, range=full_range)
                .execute()
            )
            values = result.get("values", [])
            self._cache[cache_key] = values
            logger.info(f"Sheets READ: {ticker.value}/{sheet_name} ({len(values)} rows)")
            return values

        except HttpError as e:
            logger.error(f"Error leyendo Sheets: {e}")
            raise

    def get_raw_data(self, ticker: Ticker, limit: int = 500) -> TickerData:
        """
        Lee la sheet RAW_DATA y la convierte a TickerData.

        Estructura esperada de RAW_DATA:
        Columna A: Timestamp
        Columna B: Open
        Columna C: High
        Columna D: Low
        Columna E: Close
        Columna F: Volume
        """
        cell_range = f"A2:F{limit + 1}"
        rows = self.read_range(ticker, "RAW_DATA", cell_range)

        bars: List[PriceBar] = []
        for row in rows:
            if len(row) < 6:
                continue
            try:
                bars.append(
                    PriceBar(
                        timestamp=self._parse_timestamp(row[0]),
                        open=float(row[1]),
                        high=float(row[2]),
                        low=float(row[3]),
                        close=float(row[4]),
                        volume=float(row[5]),
                    )
                )
            except (ValueError, IndexError) as e:
                logger.warning(f"Skip row inválida: {row} - {e}")
                continue

        return TickerData(
            ticker=ticker,
            bars=bars,
            last_updated=datetime.now(),
        )

    def get_strategy_sheet(
        self,
        ticker: Ticker,
        strategy_number: int,
        limit: int = 100,
    ) -> List[List[str]]:
        """
        Lee una sheet de estrategia específica.

        Sheet naming convention:
            STRATEGY_11_SMA
            STRATEGY_12_DMA
            STRATEGY_13_TMA
            STRATEGY_14_PIVOT
            STRATEGY_15_CHANNEL
            STRATEGY_18_PORTFOLIO
        """
        sheet_map = {
            11: "STRATEGY_11_SMA",
            12: "STRATEGY_12_DMA",
            13: "STRATEGY_13_TMA",
            14: "STRATEGY_14_PIVOT",
            15: "STRATEGY_15_CHANNEL",
            18: "STRATEGY_18_PORTFOLIO",
        }
        sheet_name = sheet_map.get(strategy_number)
        if not sheet_name:
            raise ValueError(f"Strategy {strategy_number} no soportada")

        return self.read_range(ticker, sheet_name, f"A2:Z{limit + 1}")

    @staticmethod
    def _parse_timestamp(value: str) -> datetime:
        """Parsea timestamp en formatos comunes de Google Sheets."""
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y",
            "%m/%d/%Y %H:%M:%S",   # GOOGLEFINANCE US locale: 5/13/2025 17:00:00
            "%m/%d/%Y",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        raise ValueError(f"Formato de fecha no reconocido: {value}")

    def clear_cache(self):
        """Limpia el cache (útil para forzar refresh)."""
        self._cache.clear()
        logger.info("Cache de Sheets limpiado")


# Singleton instance
_sheets_service: Optional[SheetsService] = None


def get_sheets_service() -> SheetsService:
    """Dependency injection para FastAPI."""
    global _sheets_service
    if _sheets_service is None:
        _sheets_service = SheetsService()
    return _sheets_service
